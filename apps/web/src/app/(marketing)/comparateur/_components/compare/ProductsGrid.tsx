"use client";

import { Box, Chip, Link as MuiLink, Stack, Typography } from "@mui/material";
import { DataGrid, type GridColDef, type GridColumnVisibilityModel } from "@mui/x-data-grid";
import { useMemo } from "react";
import Fuse from "fuse.js";
import type { BxProduct } from "../types";
import { fmtEur, fmtNative, inferProductType, normalizeText } from "./fmt";
import { REGION_LABEL } from "./constants";
import type { FilterState } from "./FilterBar";

interface ProductsGridProps {
  products: BxProduct[];
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

export function ProductsGrid({ products, filters, isMobile }: ProductsGridProps) {
  const fuse = useMemo(
    () =>
      new Fuse(products, {
        keys: [
          { name: "title", weight: 0.8 },
          { name: "shop", weight: 0.2 },
        ],
        threshold: 0.35,
        ignoreLocation: true,
        getFn: (obj, path) => {
          const keys = Array.isArray(path) ? path : (path as string).split(".");
          let v: unknown = obj;
          for (const k of keys) {
            if (v == null) return "";
            v = (v as Record<string, unknown>)[k];
          }
          return typeof v === "string" ? normalizeText(v) : v != null ? String(v) : "";
        },
      }),
    [products],
  );

  const rows = useMemo(() => {
    const q = filters.search.trim();
    let list = q ? fuse.search(normalizeText(q)).map((r) => r.item) : products;

    if (filters.region !== "all") list = list.filter((p) => p.region === filters.region);
    if (filters.productType !== "all")
      list = list.filter((p) => inferProductType(p.title, null) === filters.productType);
    if (filters.priceRange[1] < 9999)
      list = list.filter((p) => p.priceEur == null || p.priceEur <= filters.priceRange[1]);
    if (filters.availableOnly) list = list.filter((p) => p.available);

    return list.map((p, i) => ({ id: `${p.domain}-${i}`, ...p }));
  }, [products, fuse, filters]);

  const columns: GridColDef[] = useMemo(
    () => [
      {
        field: "title",
        headerName: "Produit",
        flex: 2,
        minWidth: isMobile ? 160 : 240,
        renderCell: (p) => (
          <MuiLink
            href={(p.row as BxProduct).url}
            target="_blank"
            rel="noopener noreferrer nofollow"
            sx={{
              color: "text.primary",
              fontWeight: 600,
              fontSize: "0.85rem",
              textDecoration: "none",
              "&:hover": { color: "var(--rpb-primary)" },
            }}
          >
            {p.value as string}
          </MuiLink>
        ),
      },
      {
        field: "shop",
        headerName: "Boutique",
        flex: 1,
        minWidth: isMobile ? 110 : 150,
      },
      {
        field: "region",
        headerName: "Region",
        width: 120,
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
        field: "priceEur",
        headerName: "Prix EUR",
        width: isMobile ? 90 : 110,
        type: "number",
        renderCell: (p) => (
          <Typography sx={{ fontWeight: 800, color: "#22c55e", fontSize: "0.88rem" }}>
            {fmtEur(p.value as number)}
          </Typography>
        ),
      },
      {
        field: "price",
        headerName: "Prix natif",
        width: 120,
        type: "number",
        renderCell: (p) => (
          <Typography sx={{ fontSize: "0.82rem", color: "text.secondary" }}>
            {fmtNative(p.value as number, (p.row as BxProduct).currency)}
          </Typography>
        ),
      },
      {
        field: "available",
        headerName: "Stock",
        width: 95,
        renderCell: (p) => (
          <Stack direction="row" sx={{ alignItems: "center", gap: 0.75 }}>
            <Box
              sx={{
                width: 7,
                height: 7,
                borderRadius: "50%",
                bgcolor: p.value ? "#22c55e" : "#f59e0b",
              }}
            />
            <Typography
              sx={{
                fontSize: "0.78rem",
                fontWeight: 700,
                color: p.value ? "success.main" : "warning.main",
              }}
            >
              {p.value ? "En stock" : "Incertain"}
            </Typography>
          </Stack>
        ),
      },
    ],
    [isMobile],
  );

  const colVisibility: GridColumnVisibilityModel = isMobile
    ? { region: false, price: false, available: false }
    : {};

  return (
    <DataGrid
      rows={rows}
      columns={columns}
      density="compact"
      sx={GRID_SX}
      initialState={{
        pagination: { paginationModel: { pageSize: 50 } },
        sorting: { sortModel: [{ field: "priceEur", sort: "asc" }] },
      }}
      pageSizeOptions={[25, 50, 100]}
      disableRowSelectionOnClick
      autoHeight
      columnVisibilityModel={colVisibility}
    />
  );
}
