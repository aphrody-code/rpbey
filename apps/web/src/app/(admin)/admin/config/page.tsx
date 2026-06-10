import { Box, Typography } from "@mui/material";
import { PageHeader } from "@/components/ui";
import { requireAdmin } from "@/lib/auth-utils";
import { redirect } from "next/navigation";
import { getBotConfig, listDiscordChannels, listDiscordRoles } from "@/server/dal/bot-config";
import { BotConfigEditor } from "./_components/BotConfigEditor";

export default async function AdminConfigPage() {
  const session = await requireAdmin();
  if (!session) redirect("/");

  const guildId = process.env.GUILD_ID ?? process.env.DISCORD_GUILD_ID ?? "";

  const [config, channels, roles] = await Promise.all([
    getBotConfig(guildId),
    listDiscordChannels(),
    listDiscordRoles(),
  ]);

  return (
    <Box>
      <PageHeader
        title="Configuration du bot"
        description="Edite les parametres du bot Discord et publie les changements en temps reel."
      />
      {!guildId && (
        <Typography color="error" sx={{ mb: 2 }}>
          GUILD_ID non configure — les modifications ne pourront pas etre sauvegardees.
        </Typography>
      )}
      <BotConfigEditor initialConfig={config} channels={channels} roles={roles} />
    </Box>
  );
}
