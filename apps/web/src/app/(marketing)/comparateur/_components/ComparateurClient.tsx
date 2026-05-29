"use client";

import {
  Box,
  Container,
  Dialog,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  Stack,
  Tab,
  Tabs,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useMemo, useState } from "react";
import Fuse from "fuse.js";
import { Close } from "@mui/icons-material";
import type { BxCatalog, BxProductGroup, BxShop, BxProduct, RecommendedProduct } from "./types";
import { FilterBar, type FilterState } from "./compare/FilterBar";
import { GroupsGrid } from "./compare/GroupsGrid";
import { RecoPanel } from "./compare/RecoPanel";
import { ProductsGrid } from "./compare/ProductsGrid";
import { ShopsGrid } from "./compare/ShopsGrid";
import { StatsView } from "./compare/StatsView";
import { DetailPane } from "./compare/DetailPane";
import { CompareTray } from "./compare/CompareTray";
import { normalizeText, inferProductType } from "./compare/fmt";
import { MAX_COMPARE } from "./compare/constants";

interface Props {
  products: BxProduct[];
  shops: BxShop[];
  groups: BxProductGroup[];
  generatedAt: string;
  stats?: BxCatalog["stats"];
  recommendations: RecommendedProduct[];
}

const TAB_LABELS = ["Meilleurs prix", "Recommandations", "Tous les produits", "Boutiques"] as const;

export function ComparateurClient({
  products,
  shops,
  groups,
  generatedAt,
  stats,
  recommendations,
}: Props) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const isDesktop = useMediaQuery(theme.breakpoints.up("lg"));

  // ── Global filter state ──
  const maxPrice = useMemo(() => {
    const prices = groups.map((g) => g.cheapestEur).filter((n): n is number => n != null);
    return prices.length ? Math.ceil(Math.max(...prices) / 10) * 10 : 500;
  }, [groups]);

  const [filters, setFilters] = useState<FilterState>({
    search: "",
    region: "all",
    productType: "all",
    priceRange: [0, maxPrice],
    availableOnly: false,
    sort: "cheapest_asc",
  });

  const regions = useMemo(() => [...new Set(shops.map((s) => s.region))].sort(), [shops]);

  // ── Tab state ──
  const [tab, setTab] = useState(0);

  // ── Detail pane (right side / modal on mobile) ──
  const [openGroup, setOpenGroup] = useState<BxProductGroup | null>(null);

  const activeRec = useMemo(
    () => (openGroup ? (recommendations.find((r) => r.key === openGroup.key) ?? null) : null),
    [openGroup, recommendations],
  );

  // ── Multi-site compare tray (2-4 products) ──
  const [compareList, setCompareList] = useState<BxProductGroup[]>([]);

  const toggleCompare = useCallback((g: BxProductGroup) => {
    setCompareList((prev) => {
      const exists = prev.some((x) => x.key === g.key);
      if (exists) return prev.filter((x) => x.key !== g.key);
      if (prev.length >= MAX_COMPARE) return prev;
      return [...prev, g];
    });
  }, []);

  const removeFromCompare = useCallback((key: string) => {
    setCompareList((prev) => prev.filter((x) => x.key !== key));
  }, []);

  const clearCompare = useCallback(() => setCompareList([]), []);

  const compareKeys = useMemo(() => new Set(compareList.map((g) => g.key)), [compareList]);
  const canAddMore = compareList.length < MAX_COMPARE;

  // ── Fuse index for groups (used in tab 0) ──
  const groupFuse = useMemo(
    () =>
      new Fuse(groups, {
        keys: [
          { name: "name", weight: 0.8 },
          { name: "code", weight: 0.2 },
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
    [groups],
  );

  // ── Filtered groups for tab 0 ──
  const filteredGroups = useMemo(() => {
    const q = filters.search.trim();
    let list = q ? groupFuse.search(normalizeText(q)).map((r) => r.item) : groups;
    if (filters.region !== "all")
      list = list.filter((g) => g.offers.some((o) => o.region === filters.region));
    if (filters.productType !== "all")
      list = list.filter((g) => inferProductType(g.name, g.code ?? null) === filters.productType);
    if (filters.priceRange[1] < maxPrice)
      list = list.filter((g) => g.cheapestEur == null || g.cheapestEur <= filters.priceRange[1]);
    if (filters.availableOnly) list = list.filter((g) => g.offers.some((o) => o.available));
    return list;
  }, [groups, groupFuse, filters, maxPrice]);

  // ── Handlers ──
  const handleGroupClick = useCallback((g: BxProductGroup) => {
    setOpenGroup((prev) => (prev?.key === g.key ? null : g));
  }, []);

  const handleRecoClick = useCallback(
    (rec: RecommendedProduct) => {
      const g = groups.find((x) => x.key === rec.key);
      if (g) setOpenGroup((prev) => (prev?.key === g.key ? null : g));
    },
    [groups],
  );

  const tabLabels = useMemo(
    () => [
      `Meilleurs prix (${filteredGroups.length})`,
      `Recommandations (${recommendations.length})`,
      `Tous les produits (${products.length})`,
      `Boutiques (${shops.length})`,
      ...(stats ? ["Stats"] : []),
    ],
    [filteredGroups.length, recommendations.length, products.length, shops.length, stats],
  );

  // ── Bottom padding when CompareTray is visible ──
  const trayPadding = compareList.length >= 2 ? "340px" : 0;

  return (
    <Box sx={{ pb: trayPadding }}>
      {/* Filter bar */}
      <Box sx={{ mb: 2 }}>
        <FilterBar state={filters} onChange={setFilters} regions={regions} maxPrice={maxPrice} />
      </Box>

      {/* Compare tray hint */}
      {compareList.length === 1 && (
        <Box
          sx={{
            mb: 1.5,
            px: 2,
            py: 1,
            borderRadius: 2,
            border: "1px dashed",
            borderColor: "color-mix(in srgb, var(--rpb-primary) 40%, transparent)",
            bgcolor: "color-mix(in srgb, var(--rpb-primary) 5%, transparent)",
          }}
        >
          <Typography sx={{ fontSize: "0.78rem", color: "var(--rpb-primary)", fontWeight: 700 }}>
            1 produit selectionne — ajoutes-en 1 a 3 autres pour comparer cote a cote.
          </Typography>
        </Box>
      )}

      {/* Tabs + content */}
      <Stack direction="row" spacing={2} sx={{ alignItems: "flex-start" }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Tabs
            value={tab}
            onChange={(_, v: number) => {
              setTab(v);
              if (v !== 0 && v !== 1) setOpenGroup(null);
            }}
            variant="scrollable"
            scrollButtons="auto"
            sx={{
              mb: 2,
              minHeight: 40,
              "& .MuiTabs-indicator": { display: "none" },
              "& .MuiTabs-flexContainer": { gap: 0.75 },
            }}
          >
            {tabLabels.map((label, idx) => (
              <Tab
                key={idx}
                label={label}
                sx={{
                  textTransform: "none",
                  fontWeight: 800,
                  fontSize: "0.82rem",
                  borderRadius: 2.5,
                  minHeight: 36,
                  py: 0.75,
                  px: 2,
                  color: "text.secondary",
                  transition: "all 0.18s",
                  "&.Mui-selected": {
                    color: "#fff",
                    bgcolor: "color-mix(in srgb, var(--rpb-primary) 85%, #000)",
                    boxShadow: "0 3px 12px rgba(var(--rpb-primary-rgb),0.28)",
                  },
                  "&:hover:not(.Mui-selected)": {
                    bgcolor: "rgba(255,255,255,0.04)",
                    color: "text.primary",
                  },
                }}
              />
            ))}
          </Tabs>

          {tab === 0 && (
            <GroupsGrid
              groups={filteredGroups}
              recommendations={recommendations}
              sort={filters.sort}
              selectedKeys={compareKeys}
              onRowClick={handleGroupClick}
              onToggleCompare={toggleCompare}
              canAddMore={canAddMore}
              isMobile={isMobile}
            />
          )}

          {tab === 1 && (
            <RecoPanel
              recommendations={recommendations}
              groups={groups}
              filters={filters}
              onRowClick={handleRecoClick}
              isMobile={isMobile}
            />
          )}

          {tab === 2 && <ProductsGrid products={products} filters={filters} isMobile={isMobile} />}

          {tab === 3 && <ShopsGrid shops={shops} filters={filters} isMobile={isMobile} />}

          {tab === 4 && stats && <StatsView stats={stats} shops={shops} />}

          <Typography
            sx={{
              fontSize: "0.68rem",
              color: "text.disabled",
              mt: 2,
              display: "block",
            }}
          >
            Donnees mises a jour le {new Date(generatedAt).toLocaleString("fr-FR")} · prix convertis
            en EUR a titre indicatif (taux approximatifs) · liens marchands
          </Typography>
        </Box>

        {/* Detail pane — sticky right panel on desktop */}
        <AnimatePresence>
          {isDesktop && openGroup && (tab === 0 || tab === 1) && (
            <Box
              component={motion.div}
              key={openGroup.key}
              initial={{ opacity: 0, x: 24, width: 0 }}
              animate={{ opacity: 1, x: 0, width: 380 }}
              exit={{ opacity: 0, x: 24, width: 0 }}
              transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
              sx={{
                width: 380,
                flexShrink: 0,
                position: "sticky",
                top: 80,
                maxHeight: "calc(100vh - 110px)",
                overflowY: "auto",
                borderRadius: 4,
                border: "1px solid rgba(255,255,255,0.08)",
                bgcolor: "surface.high",
                boxShadow: "0 16px 48px rgba(0,0,0,0.45)",
                p: 2.5,
                "&::-webkit-scrollbar": { width: 5 },
                "&::-webkit-scrollbar-thumb": {
                  bgcolor: "rgba(255,255,255,0.1)",
                  borderRadius: 3,
                },
              }}
            >
              <DetailPane
                group={openGroup}
                rec={activeRec}
                onClose={() => setOpenGroup(null)}
                compareCount={compareList.length}
                onAddToCompare={toggleCompare}
                onRemoveFromCompare={removeFromCompare}
                isInCompare={compareKeys.has(openGroup.key)}
                canAddMore={canAddMore}
              />
            </Box>
          )}
        </AnimatePresence>
      </Stack>

      {/* Detail modal on mobile/tablet */}
      <Dialog
        open={!isDesktop && !!openGroup}
        onClose={() => setOpenGroup(null)}
        maxWidth="sm"
        fullWidth
        slotProps={{
          backdrop: { sx: { backdropFilter: "blur(10px)", bgcolor: "rgba(0,0,0,0.6)" } },
          paper: {
            sx: {
              borderRadius: 4,
              bgcolor: "surface.high",
              border: "1px solid rgba(255,255,255,0.08)",
              boxShadow: "0 24px 70px rgba(0,0,0,0.5)",
              overflow: "hidden",
            },
          },
        }}
      >
        {openGroup && (
          <>
            <DialogTitle
              sx={{
                fontWeight: 900,
                fontSize: "1rem",
                pr: 6,
                borderBottom: "1px solid rgba(255,255,255,0.05)",
              }}
            >
              {openGroup.name}
            </DialogTitle>
            <IconButton
              aria-label="close"
              onClick={() => setOpenGroup(null)}
              sx={{
                position: "absolute",
                right: 12,
                top: 12,
                color: "text.secondary",
              }}
            >
              <Close />
            </IconButton>
            <DialogContent sx={{ p: 2.5 }}>
              <DetailPane
                group={openGroup}
                rec={activeRec}
                onClose={() => setOpenGroup(null)}
                compareCount={compareList.length}
                onAddToCompare={toggleCompare}
                onRemoveFromCompare={removeFromCompare}
                isInCompare={compareKeys.has(openGroup.key)}
                canAddMore={canAddMore}
              />
            </DialogContent>
          </>
        )}
      </Dialog>

      {/* Multi-site compare tray */}
      <CompareTray selected={compareList} onRemove={removeFromCompare} onClear={clearCompare} />
    </Box>
  );
}
