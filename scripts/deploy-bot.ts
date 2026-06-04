import { deployToCloudRun } from "./deploy-helper";

const secrets = [
  "DISCORD_TOKEN=DISCORD_TOKEN:latest",
  "DATABASE_URL=DATABASE_URL:latest",
  "DIRECT_DATABASE_URL=DIRECT_DATABASE_URL:latest",
  "DISCORD_CLIENT_ID=DISCORD_CLIENT_ID:latest",
  "DISCORD_CLIENT_SECRET=DISCORD_CLIENT_SECRET:latest",
  "DISCORD_PUBLIC_KEY=DISCORD_PUBLIC_KEY:latest",
  "DISCORD_GUILD_ID=DISCORD_GUILD_ID:latest",
  "GUILD_ID=GUILD_ID:latest",
  "BOT_API_KEY=BOT_API_KEY:latest",
  "BETTER_AUTH_SECRET=BETTER_AUTH_SECRET:latest",
  "CHALLONGE_API_KEY=CHALLONGE_API_KEY:latest",
];

await deployToCloudRun({
  service: "rpbey-bot",
  configPath: "apps/bot/cloudbuild.yaml",
  allowUnauthenticated: false,
  secrets,
  extraDeployArgs: ["--min-instances=1", "--max-instances=1", "--no-cpu-throttling"],
});
