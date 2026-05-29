"use client";

import { OpenInNew } from "@mui/icons-material";
import { Chip, Link as MuiLink, Stack, Typography } from "@mui/material";
import { DataGrid, type GridColDef, type GridColumnVisibilityModel } from "@mui/x-data-grid";
import { useMemo } from "react";
import type { BxShop } from "../types";
import { normalizeText } from "./fmt";
import { REGION_LABEL, SHOP_TYPE_LABEL } from "./constants";
import type { FilterState } from "./FilterBar";

interface ShopsGridProps {
  shops: BxShop[];
  filters: FilterState;
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
    transition: "background 0.15s",
    "&:hover": { bgcolor: "rgba(255,255,255,0.025) !important" },
  },
  "& .MuiDataGrid-footerContainer": {
    borderTop: "1px solid rgba(255,255,255,0.05)",
    bgcolor: "rgba(0,0,0,0.08)",
  },
} as const;

export function ShopsGrid({ shops, filters, isMobile }: ShopsGridProps) {
  const rows = useMemo(() => {
    const q = normalizeText(filters.search.trim());
    let list = shops;
    if (q)
      list = list.filter(
        (s) => normalizeText(s.name).includes(q) || normalizeText(s.domain).includes(q),
      );
    if (filters.region !== "all") list = list.filter((s) => s.region === filters.region);
    return list.map((s, i) => ({ id: `${s.domain}-${i}`, ...s }));
  }, [shops, filters]);

  const columns: GridColDef[] = useMemo(
    () => [
      {
        field: "name",
        headerName: "Boutique",
        flex: 1.5,
        minWidth: isMobile ? 130 : 180,
        renderCell: (p) => (
          <MuiLink
            href={(p.row as BxShop).url}
            target="_blank"
            rel="noopener noreferrer"
            sx={{
              display: "inline-flex",
              alignItems: "center",
              gap: 0.5,
              fontWeight: 700,
              fontSize: "0.85rem",
              color: "text.primary",
              textDecoration: "none",
              "&:hover": { color: "var(--rpb-primary)" },
            }}
          >
            {p.value as string}
            <OpenInNew sx={{ fontSize: 12, opacity: 0.6 }} />
          </MuiLink>
        ),
      },
      {
        field: "domain",
        headerName: "Domaine",
        flex: 1,
        minWidth: 160,
      },
      {
        field: "region",
        headerName: "Region",
        width: isMobile ? 90 : 120,
        renderCell: (p) => {
          const reg = p.value as string;
          return (
            <Chip
              size="small"
              label={REGION_LABEL[reg] ?? reg}
              sx={{
                height: 20,
                fontSize: "0.65rem",
                fontWeight: 700,
                bgcolor: "rgba(255,255,255,0.06)",
              }}
            />
          );
        },
      },
      {
        field: "type",
        headerName: "Type",
        width: 130,
        renderCell: (p) => (
          <Typography sx={{ fontSize: "0.82rem" }}>
            {SHOP_TYPE_LABEL[p.value as string] ?? (p.value as string)}
          </Typography>
        ),
      },
      {
        field: "productCount",
        headerName: "Produits",
        width: isMobile ? 90 : 120,
        type: "number",
        renderCell: (p) => (
          <Typography sx={{ fontWeight: 800, fontSize: "0.88rem" }}>{p.value as number}</Typography>
        ),
      },
      {
        field: "platform",
        headerName: "Plateforme",
        width: 120,
        renderCell: (p) => (
          <Typography
            sx={{ fontSize: "0.78rem", color: "text.secondary", textTransform: "capitalize" }}
          >
            {p.value as string}
          </Typography>
        ),
      },
    ],
    [isMobile],
  );

  const colVisibility: GridColumnVisibilityModel = isMobile
    ? { domain: false, type: false, platform: false }
    : {};

  return (
    <DataGrid
      rows={rows}
      columns={columns}
      density="compact"
      sx={GRID_SX}
      initialState={{
        pagination: { paginationModel: { pageSize: 50 } },
        sorting: { sortModel: [{ field: "productCount", sort: "desc" }] },
      }}
      pageSizeOptions={[25, 50, 100]}
      disableRowSelectionOnClick
      autoHeight
      columnVisibilityModel={colVisibility}
    />
  );
}
