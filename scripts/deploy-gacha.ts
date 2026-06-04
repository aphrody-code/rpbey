import { deployToCloudRun } from "./deploy-helper";

const secrets = ["DATABASE_URL=DATABASE_URL:latest", "AUTH_SECRET=BETTER_AUTH_SECRET:latest"];

await deployToCloudRun({
  service: "rpbey-gacha",
  configPath: "apps/gacha-server/cloudbuild.yaml",
  allowUnauthenticated: true,
  secrets,
});
