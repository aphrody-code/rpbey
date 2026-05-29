import { Alert, Box, Container, Typography } from "@mui/material";
import { type Metadata } from "next";
import { createPageMetadata } from "@/lib/seo-utils";
import { getEnrichedMeta } from "@/server/services/meta";

import { MetaClient } from "./_components/MetaClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = createPageMetadata({
  title: "Meta Beyblade X | RPB",
  description:
    "Rankings des pièces Beyblade X basés sur les résultats de tournois WBO. Scores de puissance et synergies par catégorie.",
  path: "/meta",
});

export default async function MetaPage() {
  const data = await getEnrichedMeta();

  const isEmpty =
    !data ||
    (data.periods["2weeks"].categories.length === 0 &&
      data.periods["4weeks"].categories.length === 0);

  return (
    <Box
      sx={{
        minHeight: "100vh",
        background:
          "radial-gradient(ellipse at 50% 0%, rgba(var(--rpb-primary-rgb),0.08) 0%, transparent 60%)",
      }}
    >
      <Container maxWidth="lg" sx={{ py: { xs: 2, md: 4 } }}>
        {isEmpty ? (
          <Box sx={{ mt: 8, textAlign: "center" }}>
            <Typography variant="h3" gutterBottom sx={{ fontWeight: 900 }}>
              Meta Beyblade X
            </Typography>
            <Alert severity="info" sx={{ maxWidth: 500, mx: "auto", mt: 3 }}>
              Les données meta ne sont pas encore disponibles. Elles seront mises à jour
              automatiquement chaque vendredi.
            </Alert>
          </Box>
        ) : (
          <MetaClient data={data} />
        )}
      </Container>
    </Box>
  );
}
