"use client";

import { BarChart, Download, Hub, Shield, TrendingUp } from "@mui/icons-material";
import {
  Avatar,
  alpha,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Grid,
  List,
  ListItem,
  Stack,
  Tooltip,
  Typography,
  useTheme,
} from "@mui/material";
import { useEffect, useState } from "react";
import { getMetaStats } from "@/server/actions/admin-meta";

type MetaStats = Awaited<ReturnType<typeof getMetaStats>>;
type MetaItem = MetaStats["blades"][number];

function downloadBlob(content: string, filename: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function buildMetaCsv(stats: MetaStats): string {
  const sections: string[] = [];
  const categories: Array<[string, MetaItem[]]> = [
    ["Top Blades", stats.blades],
    ["Top Ratchets", stats.ratchets],
    ["Top Bits", stats.bits],
    ["Top Assists (CX)", stats.assists],
  ];
  for (const [title, items] of categories) {
    sections.push(`# ${title}`);
    sections.push("Rang,Nom,Utilisations");
    items.forEach((item, idx) => {
      const name = (item.name ?? "").replace(/"/g, '""');
      sections.push(`${idx + 1},"${name}",${item.count}`);
    });
    sections.push("");
  }
  return sections.join("\n");
}

export default function AdminMetaPage() {
  const theme = useTheme();
  const [stats, setStats] = useState<MetaStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getMetaStats().then((data) => {
      setStats(data);
      setLoading(false);
    });
  }, []);

  const today = new Date().toISOString().slice(0, 10);

  function handleExportCsv() {
    if (!stats) return;
    downloadBlob(buildMetaCsv(stats), `rpb-meta-${today}.csv`, "text/csv;charset=utf-8");
  }

  function handleExportJson() {
    if (!stats) return;
    downloadBlob(JSON.stringify(stats, null, 2), `rpb-meta-${today}.json`, "application/json");
  }

  if (loading || !stats) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 10 }}>
        <CircularProgress color="primary" />
      </Box>
    );
  }

  return (
    <Box sx={{ px: { xs: 1, sm: 0 } }}>
      <Box
        sx={{
          mb: { xs: 3, md: 4 },
          display: "flex",
          flexDirection: { xs: "column", sm: "row" },
          alignItems: { xs: "flex-start", sm: "center" },
          gap: { xs: 1, sm: 2 },
        }}
      >
        <Box
          sx={{
            p: 1.5,
            borderRadius: 3,
            bgcolor: alpha(theme.palette.primary.main, 0.1),
            display: "flex",
          }}
        >
          <Hub sx={{ fontSize: { xs: 32, md: 40 }, color: "primary.main" }} />
        </Box>
        <Box sx={{ flex: 1 }}>
          <Typography
            variant="h4"
            sx={{
              fontWeight: "900",
            }}
          >
            GESTION META
          </Typography>
          <Typography
            variant="body2"
            sx={{
              color: "text.secondary",
            }}
          >
            Analyse de l'utilisation des pieces basee sur les decks de la communaute.
          </Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          <Tooltip title="Exporter en CSV">
            <Button
              variant="outlined"
              size="small"
              startIcon={<Download />}
              onClick={handleExportCsv}
              sx={{ fontWeight: 600 }}
            >
              CSV
            </Button>
          </Tooltip>
          <Tooltip title="Exporter en JSON">
            <Button
              variant="outlined"
              size="small"
              startIcon={<Download />}
              onClick={handleExportJson}
              sx={{ fontWeight: 600 }}
            >
              JSON
            </Button>
          </Tooltip>
        </Stack>
      </Box>
      <Grid container spacing={3}>
        <StatSection
          title="Top Blades"
          data={stats.blades}
          icon={<BarChart />}
          color={theme.palette.primary.main}
        />
        <StatSection
          title="Top Ratchets"
          data={stats.ratchets}
          icon={<TrendingUp />}
          color={theme.palette.secondary.main}
        />
        <StatSection
          title="Top Bits"
          data={stats.bits}
          icon={<TrendingUp />}
          color="var(--md-sys-color-tertiary)"
        />
        <StatSection
          title="Top Assists (CX)"
          data={stats.assists}
          icon={<Shield />}
          color="var(--md-sys-color-secondary)"
        />
      </Grid>
    </Box>
  );
}

function StatSection({
  title,
  data,
  icon,
  color,
}: {
  title: string;
  data: MetaItem[];
  icon: React.ReactNode;
  color: string;
}) {
  const maxUsage = data.length > 0 ? Math.max(...data.map((d) => d.count)) : 1;

  return (
    <Grid size={{ xs: 12, md: 6, lg: 3 }}>
      <Card
        sx={{
          borderRadius: 4,
          border: "1px solid",
          borderColor: "divider",
          height: "100%",
          bgcolor: "background.paper",
        }}
      >
        <CardContent sx={{ p: 3 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 3 }}>
            <Box sx={{ color: color, display: "flex" }}>{icon}</Box>
            <Typography
              variant="h6"
              sx={{
                fontWeight: "900",
                fontSize: "1rem",
                letterSpacing: 0.5,
              }}
            >
              {title.toUpperCase()}
            </Typography>
          </Box>

          {data.length === 0 ? (
            <Typography
              variant="body2"
              sx={{
                color: "text.disabled",
                textAlign: "center",
                py: 4,
              }}
            >
              Aucune donnée
            </Typography>
          ) : (
            <List disablePadding>
              {data.map((item) => (
                <ListItem
                  key={item.id}
                  disablePadding
                  sx={{ mb: 2, flexDirection: "column", alignItems: "stretch" }}
                >
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      gap: 1.5,
                      mb: 0.5,
                    }}
                  >
                    <Avatar
                      src={item.imageUrl ?? undefined}
                      variant="rounded"
                      sx={{
                        width: 32,
                        height: 32,
                        bgcolor: alpha(color, 0.1),
                        border: "1px solid",
                        borderColor: alpha(color, 0.2),
                      }}
                    >
                      {item.name?.[0]}
                    </Avatar>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography
                        variant="body2"
                        noWrap
                        sx={{
                          fontWeight: "bold",
                        }}
                      >
                        {item.name}
                      </Typography>
                    </Box>
                    <Typography
                      variant="caption"
                      sx={{
                        fontWeight: "900",
                        color: "text.secondary",
                      }}
                    >
                      {item.count}
                    </Typography>
                  </Box>
                  <Box
                    sx={{
                      height: 4,
                      width: "100%",
                      bgcolor: "action.hover",
                      borderRadius: 2,
                      overflow: "hidden",
                    }}
                  >
                    <Box
                      sx={{
                        height: "100%",
                        width: `${(item.count / maxUsage) * 100}%`,
                        bgcolor: color,
                        borderRadius: 2,
                        opacity: 0.8,
                      }}
                    />
                  </Box>
                </ListItem>
              ))}
            </List>
          )}
        </CardContent>
      </Card>
    </Grid>
  );
}
