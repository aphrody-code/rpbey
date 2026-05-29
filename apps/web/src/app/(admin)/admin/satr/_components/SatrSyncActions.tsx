"use client";

import CloudSyncIcon from "@mui/icons-material/CloudSync";
import LinkIcon from "@mui/icons-material/Link";
import { Box, Button, CircularProgress, Stack, Typography } from "@mui/material";
import { useState } from "react";
import { toast } from "sonner";
import { linkSatrBladers, syncSatrRanking } from "@/server/actions/satr";

export default function SatrSyncActions() {
  const [loadingRanking, setLoadingRanking] = useState(false);
  const [loadingLinking, setLoadingLinking] = useState(false);

  const handleSyncRanking = async () => {
    setLoadingRanking(true);
    try {
      const result = await syncSatrRanking();
      if (result.success) {
        toast.success(`Saison 2 synchronisée (${result.count} joueurs)`);
      } else {
        toast.error(`Erreur: ${result.error}`);
      }
    } catch {
      toast.error("Erreur réseau");
    } finally {
      setLoadingRanking(false);
    }
  };

  const handleLinkBladers = async () => {
    setLoadingLinking(true);
    try {
      const result = await linkSatrBladers();
      if (result.success) {
        toast.success(`${result.linkedCount} bladers liés avec succès !`);
      } else {
        toast.error(`Erreur: ${result.error}`);
      }
    } catch {
      toast.error("Erreur réseau");
    } finally {
      setLoadingLinking(false);
    }
  };

  return (
    <Stack spacing={3}>
      <Box
        sx={{
          p: 2,
          border: "1px solid",
          borderColor: "divider",
          borderRadius: 2,
        }}
      >
        <Typography
          variant="subtitle1"
          sx={{
            fontWeight: "bold",
          }}
        >
          Classement Saison 2
        </Typography>
        <Typography
          variant="body2"
          sx={{
            color: "text.secondary",
            mb: 2,
          }}
        >
          Récupère les dernières données du Google Sheet officiel (SAtR - Top Bladers).
        </Typography>
        <Button
          variant="contained"
          startIcon={
            loadingRanking ? <CircularProgress size={20} color="inherit" /> : <CloudSyncIcon />
          }
          onClick={handleSyncRanking}
          disabled={loadingRanking}
        >
          {loadingRanking ? "Synchronisation..." : "Synchroniser maintenant"}
        </Button>
      </Box>
      <Box
        sx={{
          p: 2,
          border: "1px solid",
          borderColor: "divider",
          borderRadius: 2,
        }}
      >
        <Typography
          variant="subtitle1"
          sx={{
            fontWeight: "bold",
          }}
        >
          Liaison des Comptes
        </Typography>
        <Typography
          variant="body2"
          sx={{
            color: "text.secondary",
            mb: 2,
          }}
        >
          Analyse les noms des bladers SATR et tente de les lier aux comptes utilisateurs RPB
          existants.
        </Typography>
        <Button
          variant="outlined"
          startIcon={loadingLinking ? <CircularProgress size={20} color="inherit" /> : <LinkIcon />}
          onClick={handleLinkBladers}
          disabled={loadingLinking}
        >
          {loadingLinking ? "Liaison en cours..." : "Lancer la liaison automatique"}
        </Button>
      </Box>
    </Stack>
  );
}
