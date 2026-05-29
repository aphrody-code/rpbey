"use client";

import { AddCircleOutlined, CheckCircle, OpenInNew } from "@mui/icons-material";
import { Box, Chip, IconButton, Link as MuiLink, Stack, Tooltip, Typography } from "@mui/material";
import { DataGrid, type GridColDef, type GridColumnVisibilityModel } from "@mui/x-data-grid";
import Link from "next/link";
import { useMemo } from "react";
import type { BxProductGroup, RecommendedProduct } from "../types";
import { fmtEur, savingPct } from "./fmt";
import { REGION_LABEL, MAX_COMPARE, type SortOption } from "./constants";

interface GroupsGridProps {
  groups: BxProductGroup[];
  recommendations: RecommendedProduct[];
  sort: SortOption;
  selectedKeys: Set<string>;
  onRowClick: (g: BxProductGroup) => void;
  onToggleCompare: (g: BxProductGroup) => void;
  canAddMore: boolean;
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
  "& .MuiDataGrid-row.Mui-selected": {
    bgcolor: "color-mix(in srgb, var(--rpb-primary) 6%, transparent) !important",
  },
  "& .MuiDataGrid-footerContainer": {
    borderTop: "1px solid rgba(255,255,255,0.05)",
    bgcolor: "rgba(0,0,0,0.08)",
  },
} as const;

export function GroupsGrid({
  groups,
  recommendations,
  sort,
  selectedKeys,
  onRowClick,
  onToggleCompare,
  canAddMore,
  isMobile,
}: GroupsGridProps) {
  const recMap = useMemo(() => {
    const m = new Map<string, RecommendedProduct>();
    for (const r of recommendations) m.set(r.key, r);
    return m;
  }, [recommendations]);

  const sorted = useMemo(() => {
    const list = [...groups];
    switch (sort) {
      case "cheapest_asc":
        list.sort((a, b) => (a.cheapestEur ?? Infinity) - (b.cheapestEur ?? Infinity));
        break;
      case "cheapest_desc":
        list.sort((a, b) => (b.cheapestEur ?? -Infinity) - (a.cheapestEur ?? -Infinity));
        break;
      case "savings_desc":
        list.sort(
          (a, b) => savingPct(b.cheapestEur, b.offers) - savingPct(a.cheapestEur, a.offers),
        );
        break;
      case "shops_desc":
        list.sort((a, b) => b.shopCount - a.shopCount);
        break;
      case "meta_desc":
        list.sort(
          (a, b) =>
            (recMap.get(b.key)?.metaRelevanceScore ?? 0) -
            (recMap.get(a.key)?.metaRelevanceScore ?? 0),
        );
        break;
      case "hype_desc":
        list.sort(
          (a, b) => (recMap.get(b.key)?.hypeScore ?? 0) - (recMap.get(a.key)?.hypeScore ?? 0),
        );
        break;
    }
    return list.map((g, i) => ({ id: `${g.key}-${i}`, ...g }));
  }, [groups, sort, recMap]);

  const columns: GridColDef[] = useMemo(
    () => [
      {
        field: "__compare",
        headerName: "",
        width: 48,
        sortable: false,
        renderCell: (p) => {
          const g = p.row as BxProductGroup;
          const inCompare = selectedKeys.has(g.key);
          const disabled = !inCompare && !canAddMore;
          return (
            <Tooltip
              title={
                inCompare
                  ? "Retirer de la comparaison"
                  : disabled
                    ? `Max ${MAX_COMPARE} produits`
                    : "Ajouter a la comparaison"
              }
            >
              <span>
                <IconButton
                  size="small"
                  disabled={disabled}
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleCompare(g);
                  }}
                  sx={{ color: inCompare ? "var(--rpb-primary)" : "text.disabled" }}
                >
                  {inCompare ? (
                    <CheckCircle sx={{ fontSize: 18 }} />
                  ) : (
                    <AddCircleOutlined sx={{ fontSize: 18 }} />
                  )}
                </IconButton>
              </span>
            </Tooltip>
          );
        },
      },
      {
        field: "name",
        headerName: "Produit",
        flex: 2,
        minWidth: isMobile ? 150 : 220,
        renderCell: (p) => {
          const g = p.row as BxProductGroup;
          return (
            <Stack direction="row" sx={{ alignItems: "center", gap: 1, minWidth: 0 }}>
              {g.cheapest?.image && (
                <Box
                  component="img"
                  src={g.cheapest.image}
                  alt={g.name}
                  loading="lazy"
                  sx={{ width: 28, height: 28, objectFit: "contain", flexShrink: 0 }}
                />
              )}
              {g.slug ? (
                <MuiLink
                  component={Link}
                  href={`/comparateur/${g.slug}`}
                  onClick={(e) => e.stopPropagation()}
                  sx={{
                    color: "text.primary",
                    fontWeight: 700,
                    fontSize: "0.85rem",
                    textDecoration: "none",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    "&:hover": { color: "var(--rpb-primary)" },
                  }}
                >
                  {g.name}
                </MuiLink>
              ) : (
                <Typography noWrap sx={{ fontWeight: 700, fontSize: "0.85rem" }}>
                  {g.name}
                </Typography>
              )}
            </Stack>
          );
        },
      },
      {
        field: "code",
        headerName: "Code",
        width: 90,
        renderCell: (p) =>
          p.value ? (
            <Chip
              size="small"
              label={p.value}
              sx={{ fontWeight: 800, fontSize: "0.65rem", bgcolor: "rgba(255,255,255,0.06)" }}
            />
          ) : (
            <Typography sx={{ color: "text.disabled", fontSize: "0.8rem" }}>—</Typography>
          ),
      },
      {
        field: "cheapestEur",
        headerName: "Meilleur prix",
        width: isMobile ? 90 : 120,
        type: "number",
        renderCell: (p) => (
          <Typography sx={{ fontWeight: 900, color: "#22c55e", fontSize: "0.92rem" }}>
            {fmtEur(p.value as number)}
          </Typography>
        ),
      },
      {
        field: "__savings",
        headerName: "Economie",
        width: 90,
        sortable: false,
        renderCell: (p) => {
          const g = p.row as BxProductGroup;
          const pct = savingPct(g.cheapestEur, g.offers);
          return pct > 0 ? (
            <Chip
              size="small"
              label={`-${pct}%`}
              sx={{
                height: 20,
                fontSize: "0.65rem",
                fontWeight: 900,
                bgcolor: "rgba(34,197,94,0.12)",
                color: "#22c55e",
              }}
            />
          ) : (
            <Typography sx={{ color: "text.disabled", fontSize: "0.8rem" }}>—</Typography>
          );
        },
      },
      {
        field: "shopCount",
        headerName: "Sites",
        width: 65,
        type: "number",
        renderCell: (p) => (
          <Typography sx={{ fontWeight: 800, fontSize: "0.82rem" }}>{p.value as number}</Typography>
        ),
      },
      {
        field: "cheapest",
        headerName: "Moins cher chez",
        flex: 1,
        minWidth: isMobile ? 110 : 150,
        sortable: false,
        renderCell: (p) => {
          const g = p.row as BxProductGroup;
          if (!g.cheapest) return <Typography sx={{ color: "text.disabled" }}>—</Typography>;
          return (
            <MuiLink
              href={g.cheapest.url}
              target="_blank"
              rel="noopener noreferrer nofollow"
              onClick={(e) => e.stopPropagation()}
              sx={{
                display: "inline-flex",
                alignItems: "center",
                gap: 0.5,
                fontWeight: 700,
                fontSize: "0.8rem",
                color: "text.secondary",
                textDecoration: "none",
                "&:hover": { color: "var(--rpb-primary)" },
              }}
            >
              {REGION_LABEL[g.cheapest.region] ?? g.cheapest.region} — {g.cheapest.shop}
              <OpenInNew sx={{ fontSize: 11, opacity: 0.6 }} />
            </MuiLink>
          );
        },
      },
      {
        field: "__meta",
        headerName: "Meta",
        width: 70,
        sortable: false,
        renderCell: (p) => {
          const g = p.row as BxProductGroup;
          const rec = recMap.get(g.key);
          if (!rec) return <Typography sx={{ color: "text.disabled" }}>—</Typography>;
          const val = Math.round(rec.metaRelevanceScore * 100);
          return (
            <Typography sx={{ fontWeight: 800, fontSize: "0.8rem", color: "#a855f7" }}>
              {val}%
            </Typography>
          );
        },
      },
      {
        field: "__available",
        headerName: "Stock",
        width: 70,
        sortable: false,
        renderCell: (p) => {
          const g = p.row as BxProductGroup;
          const avail = g.offers.filter((o) => o.available).length;
          return (
            <Stack direction="row" sx={{ alignItems: "center", gap: 0.5 }}>
              <Box
                sx={{
                  width: 7,
                  height: 7,
                  borderRadius: "50%",
                  bgcolor: avail > 0 ? "#22c55e" : "#f59e0b",
                }}
              />
              <Typography sx={{ fontSize: "0.75rem", fontWeight: 700 }}>{avail}</Typography>
            </Stack>
          );
        },
      },
      {
        field: "__link",
        headerName: "",
        width: 48,
        sortable: false,
        renderCell: (p) => {
          const g = p.row as BxProductGroup;
          return g.slug ? (
            <Tooltip title="Fiche produit">
              <IconButton
                component={Link}
                href={`/comparateur/${g.slug}`}
                size="small"
                onClick={(e) => e.stopPropagation()}
                sx={{ color: "text.disabled", "&:hover": { color: "var(--rpb-primary)" } }}
              >
                <OpenInNew sx={{ fontSize: 15 }} />
              </IconButton>
            </Tooltip>
          ) : null;
        },
      },
    ],
    [isMobile, selectedKeys, canAddMore, onToggleCompare, recMap],
  );

  const colVisibility: GridColumnVisibilityModel = isMobile
    ? {
        code: false,
        __savings: false,
        shopCount: false,
        __meta: false,
        __available: false,
        __link: false,
      }
    : {};

  return (
    <DataGrid
      rows={sorted}
      columns={columns}
      density="compact"
      sx={GRID_SX}
      initialState={{ pagination: { paginationModel: { pageSize: 50 } } }}
      pageSizeOptions={[25, 50, 100]}
      onRowClick={(p) => onRowClick(p.row as BxProductGroup)}
      disableRowSelectionOnClick
      autoHeight
      columnVisibilityModel={colVisibility}
    />
  );
}
