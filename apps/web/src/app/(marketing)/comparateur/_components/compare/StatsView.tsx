"use client";

import { Box, Chip, Stack, Typography } from "@mui/material";
import type { BxCatalog, BxShop } from "../types";
import { fmtEur } from "./fmt";
import { REGION_LABEL } from "./constants";

interface StatsViewProps {
  stats: NonNullable<BxCatalog["stats"]>;
  shops: BxShop[];
}

export function StatsView({ stats, shops }: StatsViewProps) {
  const activeShops = shops.filter((s) => s.productCount > 0).length;

  return (
    <Stack spacing={3}>
      {/* Top KPIs */}
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr 1fr", md: "1fr 1fr 1fr 1fr" },
          gap: 2,
        }}
      >
        {[
          {
            label: "Prix moyen global",
            value: fmtEur(stats.averagePriceEur),
            color: "var(--rpb-primary)",
          },
          {
            label: "Taux scraping",
            value: `${stats.successRate}%`,
            color: "#22c55e",
          },
          {
            label: "Boutiques actives",
            value: `${activeShops}/${shops.length}`,
            color: "#06b6d4",
          },
          {
            label: "Regions couvertes",
            value: String(stats.regionStats.length),
            color: "#a855f7",
          },
        ].map((kpi) => (
          <Box
            key={kpi.label}
            sx={{
              p: 2.5,
              borderRadius: 3,
              border: "1px solid",
              borderColor: "divider",
              bgcolor: "surface.high",
            }}
          >
            <Typography
              sx={{
                fontSize: "0.62rem",
                fontWeight: 900,
                textTransform: "uppercase",
                letterSpacing: 0.8,
                color: "text.secondary",
                mb: 0.75,
              }}
            >
              {kpi.label}
            </Typography>
            <Typography
              sx={{ fontWeight: 900, fontSize: "1.6rem", lineHeight: 1, color: kpi.color }}
            >
              {kpi.value}
            </Typography>
          </Box>
        ))}
      </Box>

      {/* Region + Platform breakdown */}
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
          gap: 2.5,
        }}
      >
        {/* By region */}
        <Box
          sx={{
            p: 2.5,
            borderRadius: 3,
            border: "1px solid",
            borderColor: "divider",
            bgcolor: "surface.high",
          }}
        >
          <Typography sx={{ fontWeight: 900, fontSize: "0.9rem", mb: 2 }}>Par region</Typography>
          <Stack spacing={1.5}>
            {stats.regionStats.map((r) => {
              const maxCount = Math.max(...stats.regionStats.map((x) => x.productCount));
              const pct = maxCount > 0 ? (r.productCount / maxCount) * 100 : 0;
              return (
                <Box key={r.region}>
                  <Stack
                    direction="row"
                    sx={{ justifyContent: "space-between", alignItems: "baseline", mb: 0.5 }}
                  >
                    <Typography sx={{ fontWeight: 700, fontSize: "0.85rem" }}>
                      {REGION_LABEL[r.region] ?? r.region}
                    </Typography>
                    <Stack direction="row" sx={{ alignItems: "baseline", gap: 1.5 }}>
                      <Typography sx={{ fontSize: "0.72rem", color: "text.secondary" }}>
                        {r.productCount} offres
                      </Typography>
                      {r.averagePriceEur != null && (
                        <Typography sx={{ fontWeight: 800, fontSize: "0.82rem" }}>
                          {fmtEur(r.averagePriceEur)}
                        </Typography>
                      )}
                    </Stack>
                  </Stack>
                  <Box
                    sx={{
                      height: 4,
                      borderRadius: 2,
                      bgcolor: "rgba(255,255,255,0.05)",
                      overflow: "hidden",
                    }}
                  >
                    <Box
                      sx={{
                        height: "100%",
                        width: `${pct}%`,
                        borderRadius: 2,
                        bgcolor: "var(--rpb-primary)",
                        transition: "width 0.6s cubic-bezier(0.16,1,0.3,1)",
                      }}
                    />
                  </Box>
                </Box>
              );
            })}
          </Stack>
        </Box>

        {/* By platform */}
        <Box
          sx={{
            p: 2.5,
            borderRadius: 3,
            border: "1px solid",
            borderColor: "divider",
            bgcolor: "surface.high",
          }}
        >
          <Typography sx={{ fontWeight: 900, fontSize: "0.9rem", mb: 2 }}>
            Par plateforme
          </Typography>
          <Stack spacing={1.5}>
            {stats.platformStats.map((p) => {
              const rate = p.total > 0 ? Math.round((p.active / p.total) * 100) : 0;
              return (
                <Stack
                  key={p.platform}
                  direction="row"
                  sx={{
                    justifyContent: "space-between",
                    alignItems: "center",
                    pb: 1.5,
                    borderBottom: "1px solid rgba(255,255,255,0.05)",
                    "&:last-child": { pb: 0, border: 0 },
                  }}
                >
                  <Box>
                    <Typography
                      sx={{ fontWeight: 700, textTransform: "capitalize", fontSize: "0.88rem" }}
                    >
                      {p.platform}
                    </Typography>
                    <Typography sx={{ fontSize: "0.68rem", color: "text.secondary" }}>
                      {p.active} actives / {p.total} totales
                    </Typography>
                  </Box>
                  <Chip
                    size="small"
                    label={`${rate}%`}
                    sx={{
                      height: 22,
                      fontSize: "0.7rem",
                      fontWeight: 900,
                      bgcolor:
                        rate >= 80
                          ? "rgba(34,197,94,0.12)"
                          : rate >= 50
                            ? "rgba(234,179,8,0.12)"
                            : "rgba(239,68,68,0.12)",
                      color: rate >= 80 ? "#22c55e" : rate >= 50 ? "#eab308" : "#f87171",
                    }}
                  />
                </Stack>
              );
            })}
          </Stack>
        </Box>
      </Box>
    </Stack>
  );
}
