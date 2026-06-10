import { Terminal } from "@mui/icons-material";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import CardHeader from "@mui/material/CardHeader";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { type Metadata } from "next";
import { getBotCommands, getBotLogs, getBotStatus } from "@/lib/bot";
import { BotConsole } from "./_components/BotConsole";

export const metadata: Metadata = { title: "Console & Logs" };

export default async function AdminLogsPage() {
  const [status, logs, commands] = await Promise.all([
    getBotStatus(),
    getBotLogs(200),
    getBotCommands(),
  ]);

  return (
    <Box sx={{ py: 4 }}>
      <Box sx={{ mb: 4 }}>
        <Stack direction="row" spacing={1.5} sx={{ alignItems: "center", mb: 1 }}>
          <Terminal color="primary" />
          <Typography variant="h4" sx={{ fontWeight: "bold" }}>
            Console &amp; Logs
          </Typography>
        </Stack>
        <Typography sx={{ color: "text.secondary" }}>
          État en direct du bot Discord, journaux temps réel et contrôle du service.
        </Typography>
      </Box>

      <BotConsole initialStatus={status} initialLogs={logs} />

      <Card variant="outlined" sx={{ mt: 3 }}>
        <CardHeader
          title={
            <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
              <Typography variant="h6" sx={{ fontWeight: "bold" }}>
                Commandes enregistrées
              </Typography>
              <Chip size="small" label={commands.length} variant="outlined" />
            </Stack>
          }
          subheader="Slash commands actuellement chargées par le bot (Discord application commands)."
        />
        <CardContent>
          {commands.length === 0 ? (
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              Aucune commande remontée par l&apos;API du bot.
            </Typography>
          ) : (
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: {
                  xs: "1fr",
                  sm: "repeat(2, 1fr)",
                  lg: "repeat(3, 1fr)",
                },
                gap: 1.5,
              }}
            >
              {commands.map((cmd) => (
                <Box
                  key={cmd.name}
                  sx={{
                    p: 1.5,
                    borderRadius: 2,
                    border: "1px solid",
                    borderColor: "divider",
                    bgcolor: "background.default",
                  }}
                >
                  <Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 0.5 }}>
                    <Typography sx={{ fontWeight: "bold", fontFamily: "monospace" }}>
                      /{cmd.name}
                    </Typography>
                    {cmd.category && cmd.category !== "Général" && (
                      <Chip size="small" label={cmd.category} variant="outlined" />
                    )}
                  </Stack>
                  <Typography variant="body2" sx={{ color: "text.secondary" }}>
                    {cmd.description}
                  </Typography>
                </Box>
              ))}
            </Box>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}
