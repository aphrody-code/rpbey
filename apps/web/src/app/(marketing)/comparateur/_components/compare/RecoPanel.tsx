"use client";

import { AccountBalanceWallet, Shield, TrendingUp, Tune } from "@mui/icons-material";
import {
  Box,
  Chip,
  LinearProgress,
  Link as MuiLink,
  Slider,
  Stack,
  Typography,
} from "@mui/material";
import { DataGrid, type GridColDef, type GridColumnVisibilityModel } from "@mui/x-data-grid";
import Link from "next/link";
import { useMemo, useState } from "react";
import type { BxProductGroup, RecommendedProduct } from "../types";
import { fmtEur, inferProductType, normalizeText } from "./fmt";
import type { FilterState } from "./FilterBar";

interface RecoPanelProps {
  recommendations: RecommendedProduct[];
  groups: BxProductGroup[];
  filters: FilterState;
  onRowClick: (r: RecommendedProduct) => void;
  isMobile: boolean;
}

const GRID_SX = {
  borderColor: "divider",
  borderRadius: 3,
  bgcolor: "surface.high",
  "& .MuiDataGrid-columnHeaders": {
    bgcolor: "rgba(255,255,255,0.015)",
    borderBottom: "1px solid rgba(255,255,255,0.06)",
  },
  "& .MuiDataGrid-columnHeader": {
    fontSize: "0.65rem",
    textTransform: "uppercase",
    letterSpacing: 1,
    fontWeight: 900,
    color: "text.secondary",
  },
  "& .MuiDataGrid-cell": {
    borderColor: "rgba(255,255,255,0.04)",
    fontSize: "0.85rem",
    display: "flex",
    alignItems: "center",
    "&:focus, &:focus-within": { outline: "none !important" },
  },
  "& .MuiDataGrid-row": {
    cursor: "pointer",
    transition: "background 0.15s",
    "&:hover": { bgcolor: "rgba(255,255,255,0.025) !important" },
  },
  "& .MuiDataGrid-footerContainer": {
    borderTop: "1px solid rgba(255,255,255,0.05)",
    bgcolor: "rgba(0,0,0,0.08)",
  },
} as const;

const BADGE_STYLE: Record<string, { bgcolor: string; color: string }> = {
  "Competitive Pick": { bgcolor: "rgba(168,85,247,0.15)", color: "#c084fc" },
  "Hype / New Release": { bgcolor: "rgba(244,63,94,0.15)", color: "#fda4af" },
  "Budget / Great Value": { bgcolor: "rgba(6,182,212,0.15)", color: "#67e8f9" },
  "Collector Choice": { bgcolor: "rgba(59,130,246,0.15)", color: "#93c5fd" },
  "Starter Pick": { bgcolor: "rgba(34,197,94,0.15)", color: "#86efac" },
  "Essential Accessory": { bgcolor: "rgba(255,255,255,0.08)", color: "#d1d5db" },
};

export function RecoPanel({
  recommendations,
  groups: _groups,
  filters,
  onRowClick,
  isMobile,
}: RecoPanelProps) {
  const [wMeta, setWMeta] = useState(0.5);
  const [wHype, setWHype] = useState(0.2);
  const [wPrice, setWPrice] = useState(0.3);

  const scored = useMemo(() => {
    const total = wMeta + wHype + wPrice || 1;
    const query = normalizeText(filters.search.trim());

    let list = recommendations.map((rec) => ({
      ...rec,
      id: rec.key,
      overallScore:
        (rec.metaRelevanceScore * wMeta +
          rec.hypeScore * wHype +
          rec.priceEfficiencyScore * wPrice) /
        total,
    }));

    if (filters.region !== "all") {
      list = list.filter((r) => r.offers.some((o) => o.region === filters.region));
    }

    if (filters.productType !== "all") {
      list = list.filter((r) => inferProductType(r.name, r.code) === filters.productType);
    }

    if (filters.priceRange[1] < 9999) {
      list = list.filter((r) => r.cheapestEur == null || r.cheapestEur <= filters.priceRange[1]);
    }

    if (filters.availableOnly) {
      list = list.filter((r) => r.offers.some((o) => o.available));
    }

    if (query) {
      list = list.filter((r) => {
        const nm = normalizeText(r.name).includes(query);
        const cm = r.code ? normalizeText(r.code).includes(query) : false;
        const pm = r.includedParts.some((p) => normalizeText(p.name).includes(query));
        return nm || cm || pm;
      });
    }

    return list.sort((a, b) => b.overallScore - a.overallScore);
  }, [recommendations, wMeta, wHype, wPrice, filters]);

  const columns: GridColDef[] = useMemo(
    () => [
      {
        field: "overallScore",
        headerName: "Score",
        width: 130,
        renderCell: (p) => {
          const val = (p.value as number) * 100;
          return (
            <Stack direction="row" sx={{ alignItems: "center", gap: 1, width: "100%", pr: 1 }}>
              <LinearProgress
                variant="determinate"
                value={val}
                sx={{
                  flex: 1,
                  height: 5,
                  borderRadius: 2.5,
                  bgcolor: "rgba(255,255,255,0.05)",
                  "& .MuiLinearProgress-bar": {
                    bgcolor: val >= 70 ? "#22c55e" : val >= 45 ? "var(--rpb-primary)" : "#eab308",
                  },
                }}
              />
              <Typography
                sx={{ fontWeight: 800, fontSize: "0.75rem", width: 30, textAlign: "right" }}
              >
                {Math.round(val)}%
              </Typography>
            </Stack>
          );
        },
      },
      {
        field: "name",
        headerName: "Produit",
        flex: 1.5,
        minWidth: isMobile ? 150 : 200,
        renderCell: (p) => {
          const r = p.row as RecommendedProduct;
          return r.slug ? (
            <MuiLink
              component={Link}
              href={`/comparateur/${r.slug}`}
              onClick={(e) => e.stopPropagation()}
              sx={{
                color: "text.primary",
                fontWeight: 700,
                fontSize: "0.85rem",
                textDecoration: "none",
                "&:hover": { color: "var(--rpb-primary)" },
              }}
            >
              {r.name}
            </MuiLink>
          ) : (
            <Typography sx={{ fontWeight: 700, fontSize: "0.85rem" }}>{r.name}</Typography>
          );
        },
      },
      {
        field: "code",
        headerName: "Code",
        width: 80,
        renderCell: (p) =>
          p.value ? (
            <Chip
              size="small"
              label={p.value}
              sx={{ fontWeight: 800, fontSize: "0.65rem", bgcolor: "rgba(255,255,255,0.06)" }}
            />
          ) : (
            <Typography sx={{ color: "text.disabled" }}>—</Typography>
          ),
      },
      {
        field: "metaRelevanceScore",
        headerName: "Meta",
        width: 72,
        type: "number",
        renderCell: (p) => (
          <Typography sx={{ fontWeight: 700, color: "#a855f7", fontSize: "0.82rem" }}>
            {Math.round((p.value as number) * 100)}%
          </Typography>
        ),
      },
      {
        field: "hypeScore",
        headerName: "Hype",
        width: 72,
        type: "number",
        renderCell: (p) => (
          <Typography sx={{ fontWeight: 700, color: "#f43f5e", fontSize: "0.82rem" }}>
            {Math.round((p.value as number) * 100)}%
          </Typography>
        ),
      },
      {
        field: "priceEfficiencyScore",
        headerName: "Q/P",
        width: 72,
        type: "number",
        renderCell: (p) => (
          <Typography sx={{ fontWeight: 700, color: "#06b6d4", fontSize: "0.82rem" }}>
            {Math.round((p.value as number) * 100)}%
          </Typography>
        ),
      },
      {
        field: "cheapestEur",
        headerName: "Prix",
        width: 100,
        type: "number",
        renderCell: (p) => (
          <Typography sx={{ fontWeight: 900, color: "#22c55e", fontSize: "0.9rem" }}>
            {fmtEur(p.value as number)}
          </Typography>
        ),
      },
      {
        field: "classifications",
        headerName: "Badges",
        flex: 1,
        minWidth: 140,
        sortable: false,
        renderCell: (p) => {
          const badges = (p.value as string[]) ?? [];
          return (
            <Stack direction="row" sx={{ gap: 0.5, flexWrap: "wrap" }}>
              {badges.slice(0, 2).map((b) => {
                const s = BADGE_STYLE[b] ?? { bgcolor: "rgba(255,255,255,0.06)", color: "#d1d5db" };
                return (
                  <Chip
                    key={b}
                    size="small"
                    label={b}
                    sx={{ height: 18, fontSize: "0.58rem", fontWeight: 800, border: "none", ...s }}
                  />
                );
              })}
            </Stack>
          );
        },
      },
    ],
    [isMobile],
  );

  const colVisibility: GridColumnVisibilityModel = isMobile
    ? { code: false, metaRelevanceScore: false, hypeScore: false, priceEfficiencyScore: false }
    : {};

  return (
    <Stack spacing={2.5}>
      {/* Weight sliders */}
      <Box
        sx={{
          p: 2.5,
          borderRadius: 3,
          border: "1px solid",
          borderColor: "divider",
          bgcolor: "surface.high",
        }}
      >
        <Stack direction="row" sx={{ alignItems: "center", gap: 1, mb: 1.5 }}>
          <Tune sx={{ color: "var(--rpb-primary)", fontSize: 18 }} />
          <Typography sx={{ fontWeight: 900, fontSize: "0.9rem" }}>Algorithme modulaire</Typography>
          <Typography sx={{ fontSize: "0.72rem", color: "text.disabled", ml: "auto" }}>
            {scored.length} produits
          </Typography>
        </Stack>

        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", md: "1fr 1fr 1fr" },
            gap: 3,
          }}
        >
          {[
            {
              label: "Meta relevance",
              icon: <Shield sx={{ fontSize: 14, color: "#a855f7" }} />,
              color: "#a855f7",
              value: wMeta,
              set: setWMeta,
              hint: "Usage en tournoi (decks) + classification WBO",
            },
            {
              label: "Hype factor",
              icon: <TrendingUp sx={{ fontSize: 14, color: "#f43f5e" }} />,
              color: "#f43f5e",
              value: wHype,
              set: setWHype,
              hint: "Popularite en magasin + sortie recente + edition limitee",
            },
            {
              label: "Price efficiency",
              icon: <AccountBalanceWallet sx={{ fontSize: 14, color: "#06b6d4" }} />,
              color: "#06b6d4",
              value: wPrice,
              set: setWPrice,
              hint: "Rapport valeur meta/hype vs meilleur prix constate",
            },
          ].map((s) => (
            <Box key={s.label}>
              <Stack direction="row" sx={{ justifyContent: "space-between", mb: 0.5 }}>
                <Stack direction="row" sx={{ alignItems: "center", gap: 0.5 }}>
                  {s.icon}
                  <Typography sx={{ fontWeight: 800, fontSize: "0.82rem" }}>{s.label}</Typography>
                </Stack>
                <Typography sx={{ fontWeight: 900, color: s.color, fontSize: "0.82rem" }}>
                  {Math.round(s.value * 100)}%
                </Typography>
              </Stack>
              <Slider
                size="small"
                value={s.value}
                min={0}
                max={1}
                step={0.05}
                onChange={(_, v) => s.set(v as number)}
                sx={{
                  color: s.color,
                  "& .MuiSlider-thumb": { width: 12, height: 12 },
                }}
              />
              <Typography sx={{ fontSize: "0.65rem", color: "text.secondary", lineHeight: 1.4 }}>
                {s.hint}
              </Typography>
            </Box>
          ))}
        </Box>
      </Box>

      {/* Results grid */}
      <DataGrid
        rows={scored}
        columns={columns}
        density="compact"
        sx={GRID_SX}
        initialState={{ pagination: { paginationModel: { pageSize: 50 } } }}
        pageSizeOptions={[25, 50, 100]}
        onRowClick={(p) => onRowClick(p.row as RecommendedProduct)}
        disableRowSelectionOnClick
        autoHeight
        columnVisibilityModel={colVisibility}
      />
    </Stack>
  );
}
