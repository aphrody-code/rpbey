"use client";

import { Save } from "@mui/icons-material";
import {
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  CircularProgress,
  Grid,
  TextField,
  Typography,
} from "@mui/material";
import { useEffect, useState } from "react";
import { useToast } from "@/components/ui";
import { actionUpdateRankingConfig, getRankingConfig } from "@/server/actions/maintenance";

export default function RankingConfigForm() {
  const [config, setConfig] = useState<Record<string, string | number | Date> | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { showToast } = useToast();

  useEffect(() => {
    getRankingConfig().then((data) => {
      setConfig(data ?? null);
      setLoading(false);
    });
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const res = await actionUpdateRankingConfig(config);
    if (res.success) {
      showToast(res.message || "Configuration mise à jour", "success");
    } else {
      showToast(res.error || "Erreur lors de la mise à jour", "error");
    }
    setSaving(false);
  };

  const handleChange = (key: string, val: string) => {
    setConfig({ ...config, [key]: val });
  };

  if (loading || !config) return <CircularProgress />;

  return (
    <Card variant="outlined">
      <CardHeader
        title={
          <Typography
            sx={{
              fontWeight: "bold",
            }}
          >
            Barème des Points (Ranking)
          </Typography>
        }
      />
      <CardContent>
        <Box component="form" onSubmit={handleSave}>
          <Grid container spacing={3}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                label="Participation"
                type="number"
                value={config.participation}
                onChange={(e) => handleChange("participation", e.target.value)}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                label="Top 8 (Bonus)"
                type="number"
                value={config.top8}
                onChange={(e) => handleChange("top8", e.target.value)}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <TextField
                fullWidth
                label="1ère Place"
                type="number"
                value={config.firstPlace}
                onChange={(e) => handleChange("firstPlace", e.target.value)}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <TextField
                fullWidth
                label="2ème Place"
                type="number"
                value={config.secondPlace}
                onChange={(e) => handleChange("secondPlace", e.target.value)}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <TextField
                fullWidth
                label="3ème Place"
                type="number"
                value={config.thirdPlace}
                onChange={(e) => handleChange("thirdPlace", e.target.value)}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                label="Win (Winner Bracket)"
                type="number"
                value={config.matchWinWinner}
                onChange={(e) => handleChange("matchWinWinner", e.target.value)}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                label="Win (Loser Bracket)"
                type="number"
                value={config.matchWinLoser}
                onChange={(e) => handleChange("matchWinLoser", e.target.value)}
              />
            </Grid>
            <Grid size={12}>
              <Button
                fullWidth
                variant="contained"
                type="submit"
                disabled={saving}
                startIcon={saving ? <CircularProgress size={20} /> : <Save />}
              >
                Sauvegarder le barème
              </Button>
            </Grid>
          </Grid>
        </Box>
      </CardContent>
    </Card>
  );
}
