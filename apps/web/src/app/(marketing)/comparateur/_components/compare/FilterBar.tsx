"use client";

import { Close, FilterList, Search, Sort, TuneOutlined } from "@mui/icons-material";
import {
  Box,
  Chip,
  Collapse,
  IconButton,
  InputAdornment,
  MenuItem,
  Slider,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import { useState } from "react";
import {
  PRODUCT_TYPE_OPTIONS,
  REGION_LABEL,
  SORT_OPTIONS,
  type ProductTypeOption,
  type SortOption,
} from "./constants";

export interface FilterState {
  search: string;
  region: string;
  productType: ProductTypeOption;
  priceRange: [number, number];
  availableOnly: boolean;
  sort: SortOption;
}

interface FilterBarProps {
  state: FilterState;
  onChange: (s: FilterState) => void;
  regions: string[];
  maxPrice: number;
}

export function FilterBar({ state, onChange, regions, maxPrice }: FilterBarProps) {
  const [expanded, setExpanded] = useState(false);

  const set = <K extends keyof FilterState>(k: K, v: FilterState[K]) =>
    onChange({ ...state, [k]: v });

  const activeFilters =
    (state.region !== "all" ? 1 : 0) +
    (state.productType !== "all" ? 1 : 0) +
    (state.priceRange[1] < maxPrice ? 1 : 0) +
    (state.availableOnly ? 1 : 0);

  return (
    <Box
      sx={{
        borderRadius: 3,
        border: "1px solid",
        borderColor: "divider",
        bgcolor: "rgba(255,255,255,0.01)",
        overflow: "hidden",
      }}
    >
      {/* Primary row */}
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={1.5}
        sx={{ p: 1.5, alignItems: { sm: "center" } }}
      >
        {/* Search */}
        <TextField
          size="small"
          fullWidth
          placeholder="Bey, code (BX-01), Blade, Ratchet..."
          value={state.search}
          onChange={(e) => set("search", e.target.value)}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <Search sx={{ color: "text.disabled", fontSize: 18 }} />
                </InputAdornment>
              ),
              endAdornment: state.search ? (
                <InputAdornment position="end">
                  <IconButton size="small" onClick={() => set("search", "")}>
                    <Close sx={{ fontSize: 16 }} />
                  </IconButton>
                </InputAdornment>
              ) : null,
            },
          }}
          sx={{
            flex: 1,
            "& .MuiOutlinedInput-root": { borderRadius: 2, bgcolor: "rgba(0,0,0,0.12)" },
          }}
        />

        {/* Region */}
        <TextField
          select
          size="small"
          label="Region"
          value={state.region}
          onChange={(e) => set("region", e.target.value)}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <FilterList sx={{ color: "text.disabled", fontSize: 16, mr: 0.5 }} />
                </InputAdornment>
              ),
            },
          }}
          sx={{
            minWidth: 150,
            "& .MuiOutlinedInput-root": { borderRadius: 2, bgcolor: "rgba(0,0,0,0.12)" },
          }}
        >
          <MenuItem value="all">All regions</MenuItem>
          {regions.map((r) => (
            <MenuItem key={r} value={r}>
              {REGION_LABEL[r] ?? r}
            </MenuItem>
          ))}
        </TextField>

        {/* Sort */}
        <TextField
          select
          size="small"
          label="Tri"
          value={state.sort}
          onChange={(e) => set("sort", e.target.value as SortOption)}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <Sort sx={{ color: "text.disabled", fontSize: 16, mr: 0.5 }} />
                </InputAdornment>
              ),
            },
          }}
          sx={{
            minWidth: 180,
            "& .MuiOutlinedInput-root": { borderRadius: 2, bgcolor: "rgba(0,0,0,0.12)" },
          }}
        >
          {SORT_OPTIONS.map((o) => (
            <MenuItem key={o.value} value={o.value}>
              {o.label}
            </MenuItem>
          ))}
        </TextField>

        {/* Expand filters button */}
        <IconButton
          size="small"
          onClick={() => setExpanded((x) => !x)}
          sx={{
            borderRadius: 2,
            border: "1px solid",
            borderColor: activeFilters > 0 ? "var(--rpb-primary)" : "divider",
            color: activeFilters > 0 ? "var(--rpb-primary)" : "text.secondary",
            bgcolor:
              activeFilters > 0
                ? "color-mix(in srgb, var(--rpb-primary) 10%, transparent)"
                : "transparent",
            px: 1.5,
            gap: 0.5,
          }}
        >
          <TuneOutlined sx={{ fontSize: 18 }} />
          {activeFilters > 0 && (
            <Typography sx={{ fontSize: "0.72rem", fontWeight: 900 }}>{activeFilters}</Typography>
          )}
        </IconButton>
      </Stack>

      {/* Expanded filters */}
      <Collapse in={expanded}>
        <Box
          sx={{
            px: 2.5,
            pb: 2,
            pt: 0.5,
            borderTop: "1px solid",
            borderColor: "divider",
          }}
        >
          <Stack
            direction={{ xs: "column", md: "row" }}
            spacing={3}
            sx={{ alignItems: { md: "flex-start" }, mt: 1.5 }}
          >
            {/* Product type chips */}
            <Box sx={{ flex: 2 }}>
              <Typography
                sx={{
                  fontSize: "0.68rem",
                  fontWeight: 900,
                  textTransform: "uppercase",
                  letterSpacing: 0.8,
                  color: "text.secondary",
                  mb: 1,
                }}
              >
                Type produit
              </Typography>
              <Stack direction="row" sx={{ flexWrap: "wrap", gap: 0.75 }}>
                {PRODUCT_TYPE_OPTIONS.map((opt) => (
                  <Chip
                    key={opt.value}
                    label={opt.label}
                    size="small"
                    onClick={() => set("productType", opt.value)}
                    sx={{
                      height: 24,
                      fontSize: "0.72rem",
                      fontWeight: 800,
                      cursor: "pointer",
                      border: "1px solid",
                      borderColor:
                        state.productType === opt.value
                          ? "var(--rpb-primary)"
                          : "rgba(255,255,255,0.1)",
                      bgcolor:
                        state.productType === opt.value
                          ? "color-mix(in srgb, var(--rpb-primary) 18%, transparent)"
                          : "rgba(255,255,255,0.03)",
                      color:
                        state.productType === opt.value ? "var(--rpb-primary)" : "text.secondary",
                      "&:hover": { borderColor: "var(--rpb-primary)" },
                    }}
                  />
                ))}
              </Stack>
            </Box>

            {/* Price range */}
            <Box sx={{ flex: 1, minWidth: 200 }}>
              <Stack direction="row" sx={{ justifyContent: "space-between", mb: 0.5 }}>
                <Typography
                  sx={{
                    fontSize: "0.68rem",
                    fontWeight: 900,
                    textTransform: "uppercase",
                    letterSpacing: 0.8,
                    color: "text.secondary",
                  }}
                >
                  Prix max (EUR)
                </Typography>
                <Typography
                  sx={{ fontSize: "0.78rem", fontWeight: 800, color: "var(--rpb-primary)" }}
                >
                  {state.priceRange[1] >= maxPrice ? "Illimite" : `<= ${state.priceRange[1]} EUR`}
                </Typography>
              </Stack>
              <Slider
                size="small"
                value={state.priceRange[1]}
                min={0}
                max={maxPrice}
                step={5}
                onChange={(_, v) => set("priceRange", [0, v as number])}
                sx={{
                  color: "var(--rpb-primary)",
                  "& .MuiSlider-thumb": { width: 14, height: 14 },
                }}
              />
            </Box>

            {/* Availability toggle */}
            <Box>
              <Typography
                sx={{
                  fontSize: "0.68rem",
                  fontWeight: 900,
                  textTransform: "uppercase",
                  letterSpacing: 0.8,
                  color: "text.secondary",
                  mb: 1,
                }}
              >
                Disponibilite
              </Typography>
              <ToggleButtonGroup
                size="small"
                exclusive
                value={state.availableOnly ? "available" : "all"}
                onChange={(_, v) => {
                  if (v != null) set("availableOnly", v === "available");
                }}
              >
                <ToggleButton
                  value="all"
                  sx={{ fontSize: "0.72rem", fontWeight: 800, px: 1.5, textTransform: "none" }}
                >
                  Tout
                </ToggleButton>
                <ToggleButton
                  value="available"
                  sx={{
                    fontSize: "0.72rem",
                    fontWeight: 800,
                    px: 1.5,
                    textTransform: "none",
                    "&.Mui-selected": { color: "#22c55e", borderColor: "rgba(34,197,94,0.4)" },
                  }}
                >
                  En stock
                </ToggleButton>
              </ToggleButtonGroup>
            </Box>
          </Stack>

          {/* Active filter chips */}
          {activeFilters > 0 && (
            <Stack direction="row" spacing={0.75} sx={{ mt: 1.5, flexWrap: "wrap" }}>
              <Typography sx={{ fontSize: "0.68rem", color: "text.disabled", alignSelf: "center" }}>
                Actifs :
              </Typography>
              {state.region !== "all" && (
                <Chip
                  size="small"
                  label={REGION_LABEL[state.region] ?? state.region}
                  onDelete={() => set("region", "all")}
                  sx={{ height: 20, fontSize: "0.68rem" }}
                />
              )}
              {state.productType !== "all" && (
                <Chip
                  size="small"
                  label={PRODUCT_TYPE_OPTIONS.find((o) => o.value === state.productType)?.label}
                  onDelete={() => set("productType", "all")}
                  sx={{ height: 20, fontSize: "0.68rem" }}
                />
              )}
              {state.priceRange[1] < maxPrice && (
                <Chip
                  size="small"
                  label={`max ${state.priceRange[1]} EUR`}
                  onDelete={() => set("priceRange", [0, maxPrice])}
                  sx={{ height: 20, fontSize: "0.68rem" }}
                />
              )}
              {state.availableOnly && (
                <Chip
                  size="small"
                  label="En stock"
                  onDelete={() => set("availableOnly", false)}
                  sx={{ height: 20, fontSize: "0.68rem" }}
                />
              )}
              <Chip
                size="small"
                label="Tout effacer"
                onClick={() =>
                  onChange({
                    ...state,
                    region: "all",
                    productType: "all",
                    priceRange: [0, maxPrice],
                    availableOnly: false,
                  })
                }
                sx={{ height: 20, fontSize: "0.68rem", color: "text.secondary" }}
              />
            </Stack>
          )}
        </Box>
      </Collapse>
    </Box>
  );
}
