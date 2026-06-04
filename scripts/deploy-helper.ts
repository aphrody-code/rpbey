import { $ } from "bun";
import { resolve } from "node:path";

const GCP_PROJECT = "aphrody";
const REGION = "europe-west3";
const IMAGE_BASE = `europe-west3-docker.pkg.dev/${GCP_PROJECT}/rpbey`;

export interface DeployOptions {
  service: string;
  configPath: string; // e.g., "apps/bot/cloudbuild.yaml"
  allowUnauthenticated: boolean;
  secrets: string[];
  extraDeployArgs?: string[];
}

export async function deployToCloudRun(options: DeployOptions) {
  const root = resolve(import.meta.dir, "..");

  console.log(
    `\n\x1b[1;34m=== [RPBEY] Deploying Service: ${options.service} to Cloud Run ===\x1b[0m`,
  );

  // 1. Check/Set gcloud project
  console.log("▶ Configuring gcloud project...");
  await $`gcloud config set project ${GCP_PROJECT} --quiet`;

  // 2. Retrieve GitHub token
  console.log("▶ Retrieving GitHub packages token...");
  let ghTok = process.env.GITHUB_TOKEN || "";
  if (!ghTok) {
    try {
      ghTok = (await $`gh auth token`.text()).trim();
    } catch {
      // gh CLI not authenticated or not installed
    }
  }

  if (!ghTok) {
    ghTok = prompt("Enter your GitHub Packages Token (read:packages): ") || "";
    console.log("");
  }

  if (!ghTok) {
    console.error(
      "\x1b[1;31m✗ Error: GitHub Packages Token is required to fetch @rose-griffon dependency packages.\x1b[0m",
    );
    process.exit(1);
  }

  // 3. Git tag
  let tag = "latest";
  try {
    tag = (await $`git rev-parse --short=8 HEAD`.text()).trim();
  } catch {
    // Not a git repo or git not in path
  }
  const imageTagged = `${IMAGE_BASE}/${options.service}:${tag}`;

  // 4. Build image via Cloud Build
  console.log(`▶ Building image \x1b[32m${imageTagged}\x1b[0m via Cloud Build...`);
  const substitutions = `_IMAGE=${imageTagged},_GH_PACKAGES_TOKEN=${ghTok}`;

  try {
    await $`gcloud builds submit --project ${GCP_PROJECT} --region ${REGION} \
      --config ${options.configPath} \
      --substitutions=${substitutions} ${root}`;
  } catch (error) {
    console.error(`\x1b[1;31m✗ Cloud Build failed: ${error}\x1b[0m`);
    process.exit(1);
  }

  // 5. Deploy to Cloud Run
  console.log(`▶ Deploying service \x1b[32m${options.service}\x1b[0m to Cloud Run...`);

  const secretsStr = options.secrets.join(",");
  const deployArgs = [
    options.service,
    `--project=${GCP_PROJECT}`,
    `--region=${REGION}`,
    `--image=${imageTagged}`,
    `--cpu=1`,
    `--memory=1Gi`,
    `--port=8080`,
    options.allowUnauthenticated ? "--allow-unauthenticated" : "--no-allow-unauthenticated",
    `--set-secrets=${secretsStr}`,
    "--quiet",
  ];

  if (options.extraDeployArgs) {
    deployArgs.push(...options.extraDeployArgs);
  }

  try {
    await $`gcloud run deploy ${deployArgs}`;
  } catch (error) {
    console.error(`\x1b[1;31m✗ Cloud Run deployment failed: ${error}\x1b[0m`);
    process.exit(1);
  }

  console.log("\x1b[1;32m=== [RPBEY] Deployment complete! ===\x1b[0m");

  try {
    const url = (
      await $`gcloud run services describe ${options.service} --project=${GCP_PROJECT} --region=${REGION} --format='value(status.url)'`.text()
    ).trim();
    console.log(`Service URL: \x1b[4;36m${url}\x1b[0m\n`);
  } catch {
    // Describe failed, ignore URL printing
  }
}
