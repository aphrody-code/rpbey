import {
  Alert,
  AlertTitle,
  Box,
  Card,
  CardContent,
  Divider,
  Grid,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import { PageHeader } from "@/components/ui/PageHeader";
import { db, schema, count, desc } from "@/lib/db";
import { formatDateTime } from "@/lib/utils";
import WbSyncActions from "./_components/WbSyncActions";

export const dynamic = "force-dynamic";

export default async function AdminWbPage() {
  const [rankingCountRows, bladerCountRows, lastUpdate] = await Promise.all([
    db.select({ value: count() }).from(schema.wbRankings),
    db.select({ value: count() }).from(schema.wbBladers),
    db.query.wbRankings.findFirst({
      orderBy: desc(schema.wbRankings.updatedAt),
      columns: { updatedAt: true },
    }),
  ]);
  const rankingCount = rankingCountRows[0]?.value ?? 0;
  const bladerCount = bladerCountRows[0]?.value ?? 0;

  return (
    <Box sx={{ py: 4 }}>
      <PageHeader
        title="Gestion Wild Breakers"
        description="Contrôlez la synchronisation des données des Ultim Batailles."
      />
      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 8 }}>
          <Paper
            sx={{
              p: 3,
              borderRadius: 4,
              border: "1px solid",
              borderColor: "divider",
            }}
          >
            <Typography
              variant="h6"
              gutterBottom
              sx={{
                fontWeight: "bold",
              }}
            >
              Synchronisation Manuelle
            </Typography>
            <Typography
              variant="body2"
              sx={{
                color: "text.secondary",
                mb: 3,
              }}
            >
              Utilisez les boutons ci-dessous pour forcer la mise à jour des données Wild Breakers.
            </Typography>

            <WbSyncActions />
          </Paper>
        </Grid>

        <Grid size={{ xs: 12, md: 4 }}>
          <Stack spacing={3}>
            <Card variant="outlined" sx={{ borderRadius: 3 }}>
              <CardContent>
                <Typography
                  variant="overline"
                  sx={{
                    color: "text.secondary",
                    fontWeight: "bold",
                  }}
                >
                  État des données
                </Typography>
                <Box sx={{ mt: 1 }}>
                  <Box
                    sx={{
                      display: "flex",
                      justifyContent: "space-between",
                      mb: 1,
                    }}
                  >
                    <Typography variant="body2">Classement</Typography>
                    <Typography
                      variant="body2"
                      sx={{
                        fontWeight: "bold",
                      }}
                    >
                      {rankingCount} joueurs
                    </Typography>
                  </Box>
                  <Box
                    sx={{
                      display: "flex",
                      justifyContent: "space-between",
                      mb: 1,
                    }}
                  >
                    <Typography variant="body2">Carrière</Typography>
                    <Typography
                      variant="body2"
                      sx={{
                        fontWeight: "bold",
                      }}
                    >
                      {bladerCount} profils
                    </Typography>
                  </Box>
                  <Divider sx={{ my: 1 }} />
                  <Typography
                    variant="caption"
                    sx={{
                      color: "text.secondary",
                    }}
                  >
                    Dernière mise à jour :{" "}
                    {lastUpdate?.updatedAt ? formatDateTime(lastUpdate.updatedAt) : "Inconnue"}
                  </Typography>
                </Box>
              </CardContent>
            </Card>

            <Alert severity="info" sx={{ borderRadius: 3 }}>
              <AlertTitle>Note</AlertTitle>
              Le classement est calculé à partir des données de tournois scrapées depuis Challonge
              (wild_breakers). Lancez le script de scraping pour mettre à jour les données brutes.
            </Alert>
          </Stack>
        </Grid>
      </Grid>
    </Box>
  );
}
