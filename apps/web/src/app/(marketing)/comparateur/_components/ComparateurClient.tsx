"use client";

import {
  Close,
  FilterList,
  OpenInNew,
  Search,
  TrendingUp,
  AccountBalanceWallet,
  Tune,
  Shield,
} from "@mui/icons-material";
import {
  Box,
  Chip,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  InputAdornment,
  Link as MuiLink,
  MenuItem,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
  Slider,
  LinearProgress,
  Paper,
} from "@mui/material";
import { DataGrid, type GridColDef } from "@mui/x-data-grid";
import Fuse from "fuse.js";
import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useEffect } from "react";
import type { BxCatalog, BxProduct, BxProductGroup, BxShop, RecommendedProduct } from "./types";

interface Props {
  products: BxProduct[];
  shops: BxShop[];
  groups: BxProductGroup[];
  generatedAt: string;
  stats?: BxCatalog["stats"];
  recommendations?: RecommendedProduct[];
}

const REGION_LABEL: Record<string, string> = {
  FR: "France",
  BE: "Belgique",
  CH: "Suisse",
  UK: "Royaume-Uni",
  EU: "Europe",
  US: "USA",
  JP: "Japon",
  INT: "International",
};

const REGION_FLAG: Record<string, string> = {
  FR: "🇫🇷",
  BE: "🇧🇪",
  CH: "🇨🇭",
  UK: "🇬🇧",
  EU: "🇪🇺",
  US: "🇺🇸",
  JP: "🇯🇵",
  INT: "🌍",
};

const TYPE_LABEL: Record<string, string> = {
  specialist: "Spécialiste",
  marketplace: "Marketplace",
  retailer: "Enseigne",
  official: "Officiel",
  import: "Import JP",
};

const fmtPrice = (v: number | null | undefined, currency: string) =>
  v == null
    ? "—"
    : new Intl.NumberFormat("fr-FR", {
        style: "currency",
        currency: currency === "?" ? "EUR" : currency,
        maximumFractionDigits: currency === "JPY" ? 0 : 2,
      }).format(v);

const fmtEur = (v: number | null | undefined) =>
  v == null
    ? "—"
    : new Intl.NumberFormat("fr-FR", {
        style: "currency",
        currency: "EUR",
      }).format(v);

const normalizeText = (str: string): string => {
  if (!str) return "";
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
};

export function ComparateurClient({
  products,
  shops,
  groups,
  generatedAt,
  stats,
  recommendations = [],
}: Props) {
  const [tab, setTab] = useState(0);
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [region, setRegion] = useState("all");
  const [openGroup, setOpenGroup] = useState<BxProductGroup | null>(null);

  const [wMeta, setWMeta] = useState(0.5);
  const [wHype, setWHype] = useState(0.2);
  const [wPrice, setWPrice] = useState(0.3);

  const [globalItems, setGlobalItems] = useState<any[]>([]);
  const [showGlobalDropdown, setShowGlobalDropdown] = useState(false);
  const [loadingGlobal, setLoadingGlobal] = useState(false);

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const isDesktop = useMediaQuery(theme.breakpoints.up("md"));

  const regions = useMemo(() => [...new Set(shops.map((s) => s.region))].sort(), [shops]);

  const handleSearchFocus = async () => {
    setShowGlobalDropdown(true);
    if (globalItems.length > 0 || loadingGlobal) return;
    setLoadingGlobal(true);
    try {
      const res = await fetch("/api/search/global");
      const json = await res.json();
      if (json.success && json.data) {
        setGlobalItems(json.data);
      }
    } catch (err) {
      console.error("Failed to load global search items", err);
    } finally {
      setLoadingGlobal(false);
    }
  };

  useEffect(() => {
    if (!showGlobalDropdown) return;
    const handleOutsideClick = () => {
      setTimeout(() => {
        setShowGlobalDropdown(false);
      }, 250);
    };
    document.addEventListener("click", handleOutsideClick);
    return () => document.removeEventListener("click", handleOutsideClick);
  }, [showGlobalDropdown]);

  // Index Fuse construit une seule fois par jeu d'items (pas à chaque frappe).
  const globalFuse = useMemo(
    () =>
      new Fuse(globalItems, {
        keys: [
          { name: "title", weight: 0.7 },
          { name: "subtitle", weight: 0.2 },
          { name: "badge", weight: 0.1 },
        ],
        threshold: 0.45,
      }),
    [globalItems],
  );

  const globalResults = useMemo(() => {
    const query = search.trim();
    const grouped = {
      product: [] as any[],
      part: [] as any[],
      tournament: [] as any[],
      blader: [] as any[],
      lexicon: [] as any[],
    };

    if (!query || globalItems.length === 0) return grouped;

    const matched = globalFuse.search(query).map((r) => r.item);

    // Le comparateur est axé produits / beys / pièces. Les autres sujets
    // (tournois, bladers, anime, lexique, toutes saisons) vivent sur /search.
    for (const item of matched) {
      if (item.category === "product") grouped.product.push(item);
      else if (item.category === "part") grouped.part.push(item);
    }

    return grouped;
  }, [search, globalItems, globalFuse]);

  const handleGlobalItemClick = (item: any) => {
    setShowGlobalDropdown(false);
    if (item.category === "product") {
      const key = item.id.replace("group-", "");
      const matchedGroup = groups.find((g) => g.key === key);
      if (matchedGroup) {
        setOpenGroup(matchedGroup);
        setTab(0);
      } else if (item.url) {
        router.push(item.url);
      }
    } else if (item.url) {
      // Le lexique n'a pas d'URL (terme purement informatif) → pas de navigation.
      router.push(item.url);
    }
  };

  // ── Recalculate and filter recommendations client-side ──
  const scoredRecommendations = useMemo(() => {
    const totalWeight = wMeta + wHype + wPrice || 1;
    const query = normalizeText(search.trim());

    let list = recommendations.map((rec) => {
      const overallScore =
        (rec.metaRelevanceScore * wMeta +
          rec.hypeScore * wHype +
          rec.priceEfficiencyScore * wPrice) /
        totalWeight;
      return {
        ...rec,
        overallScore,
        id: rec.key,
      };
    });

    if (region !== "all") {
      list = list.filter((r) => r.offers.some((o) => o.region === region));
    }

    if (query) {
      list = list.filter((r) => {
        const nameMatch = normalizeText(r.name).includes(query);
        const codeMatch = r.code && normalizeText(r.code).includes(query);
        const partsMatch = r.includedParts.some((p) => normalizeText(p.name).includes(query));
        return nameMatch || codeMatch || partsMatch;
      });
    }

    return list.sort((a, b) => b.overallScore - a.overallScore);
  }, [recommendations, wMeta, wHype, wPrice, region, search]);

  const handleRecClick = (row: any) => {
    const rec = row as RecommendedProduct;
    const matchedGroup = groups.find((g) => g.key === rec.key);
    if (matchedGroup) {
      setOpenGroup(matchedGroup);
    }
  };

  // ── active recommendation matching for the open detail pane ──
  const activeRec = useMemo(() => {
    if (!openGroup) return null;
    return recommendations.find((r) => r.key === openGroup.key) ?? null;
  }, [openGroup, recommendations]);

  const recCols: GridColDef[] = [
    {
      field: "overallScore",
      headerName: "Score Global",
      width: 140,
      renderCell: (p) => {
        const val = (p.value as number) * 100;
        return (
          <Stack direction="row" spacing={1} sx={{ alignItems: "center", width: "100%", pr: 1 }}>
            <LinearProgress
              variant="determinate"
              value={val}
              sx={{
                flex: 1,
                height: 6,
                borderRadius: 3,
                bgcolor: "rgba(255,255,255,0.05)",
                "& .MuiLinearProgress-bar": {
                  bgcolor: val >= 70 ? "#22c55e" : val >= 45 ? "#3b82f6" : "#eab308",
                },
              }}
            />
            <Typography
              sx={{
                fontWeight: 800,
                fontSize: "0.78rem",
                width: 35,
                textAlign: "right",
              }}
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
            sx={{
              color: "inherit",
              fontWeight: 700,
              transition: "color 0.2s",
              "&:hover": { color: "var(--rpb-primary)" },
            }}
          >
            {r.name}
          </MuiLink>
        ) : (
          r.name
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
            sx={{
              fontWeight: 800,
              fontSize: "0.65rem",
              bgcolor: "rgba(255,255,255,0.06)",
            }}
          />
        ) : (
          "—"
        ),
    },
    {
      field: "metaRelevanceScore",
      headerName: "Méta",
      width: 80,
      type: "number",
      renderCell: (p) => (
        <Typography sx={{ fontWeight: 700, color: "#a855f7" }}>
          {Math.round((p.value as number) * 100)}%
        </Typography>
      ),
    },
    {
      field: "hypeScore",
      headerName: "Hype",
      width: 80,
      type: "number",
      renderCell: (p) => (
        <Typography sx={{ fontWeight: 700, color: "#f43f5e" }}>
          {Math.round((p.value as number) * 100)}%
        </Typography>
      ),
    },
    {
      field: "priceEfficiencyScore",
      headerName: "Efficacité Q/P",
      width: 100,
      type: "number",
      renderCell: (p) => (
        <Typography sx={{ fontWeight: 700, color: "#06b6d4" }}>
          {Math.round((p.value as number) * 100)}%
        </Typography>
      ),
    },
    {
      field: "cheapestEur",
      headerName: "Meilleur Prix",
      width: 110,
      type: "number",
      renderCell: (p) => (
        <Typography sx={{ fontWeight: 900, color: "#22c55e", fontSize: "0.9rem" }}>
          {fmtEur(p.value as number)}
        </Typography>
      ),
    },
    {
      field: "classifications",
      headerName: "Badges / Catégorie",
      flex: 1,
      minWidth: 150,
      sortable: false,
      renderCell: (p) => {
        const badges = (p.value as string[]) ?? [];
        return (
          <Stack direction="row" spacing={0.5} sx={{ flexWrap: "wrap", gap: 0.5 }}>
            {badges.slice(0, 2).map((b) => {
              let customStyle = {};

              if (b === "Competitive Pick") {
                customStyle = {
                  bgcolor: "rgba(168, 85, 247, 0.15)",
                  color: "#c084fc",
                  fontWeight: 800,
                };
              } else if (b === "Hype / New Release") {
                customStyle = {
                  bgcolor: "rgba(244, 63, 94, 0.15)",
                  color: "#fda4af",
                  fontWeight: 800,
                };
              } else if (b === "Budget / Great Value") {
                customStyle = {
                  bgcolor: "rgba(6, 182, 212, 0.15)",
                  color: "#67e8f9",
                  fontWeight: 800,
                };
              } else if (b === "Collector Choice") {
                customStyle = {
                  bgcolor: "rgba(59, 130, 246, 0.15)",
                  color: "#93c5fd",
                  fontWeight: 800,
                };
              } else if (b === "Starter Pick") {
                customStyle = {
                  bgcolor: "rgba(34, 197, 94, 0.15)",
                  color: "#86efac",
                  fontWeight: 800,
                };
              } else if (b === "Essential Accessory") {
                customStyle = {
                  bgcolor: "rgba(255, 255, 255, 0.08)",
                  color: "#d1d5db",
                  fontWeight: 800,
                };
              }

              return (
                <Chip
                  key={b}
                  size="small"
                  label={b}
                  sx={{
                    height: 20,
                    fontSize: "0.62rem",
                    border: "none",
                    ...customStyle,
                  }}
                />
              );
            })}
          </Stack>
        );
      },
    },
  ];

  // ── Fuse indexes ──
  const productFuse = useMemo(
    () =>
      new Fuse(products, {
        keys: [
          { name: "title", weight: 0.8 },
          { name: "shop", weight: 0.2 },
        ],
        threshold: 0.35,
        ignoreLocation: true,
        useExtendedSearch: true,
        getFn: (obj: BxProduct, path: string | string[]): string | string[] => {
          const keys = Array.isArray(path) ? path : (path as string).split(".");
          let value: any = obj;
          for (const key of keys) {
            if (value == null) return "";
            value = (value as any)[key];
          }
          if (typeof value === "string") {
            return normalizeText(value);
          }
          if (Array.isArray(value)) {
            return value.map((v) => (typeof v === "string" ? normalizeText(v) : String(v)));
          }
          return value != null ? String(value) : "";
        },
      }),
    [products],
  );

  const groupFuse = useMemo(
    () =>
      new Fuse(groups, {
        keys: [
          { name: "name", weight: 0.8 },
          { name: "code", weight: 0.2 },
        ],
        threshold: 0.35,
        ignoreLocation: true,
        useExtendedSearch: true,
        getFn: (obj: BxProductGroup, path: string | string[]): string | string[] => {
          const keys = Array.isArray(path) ? path : (path as string).split(".");
          let value: any = obj;
          for (const key of keys) {
            if (value == null) return "";
            value = (value as any)[key];
          }
          if (typeof value === "string") {
            return normalizeText(value);
          }
          if (Array.isArray(value)) {
            return value.map((v) => (typeof v === "string" ? normalizeText(v) : String(v)));
          }
          return value != null ? String(value) : "";
        },
      }),
    [groups],
  );

  // ── filtered datasets ──
  const filteredProducts = useMemo(() => {
    const query = search.trim();
    let list = query ? productFuse.search(normalizeText(query)).map((r) => r.item) : products;
    if (region !== "all") list = list.filter((p) => p.region === region);
    return list.map((p, i) => ({ id: `${p.domain}-${i}`, ...p }));
  }, [products, productFuse, search, region]);

  const filteredGroups = useMemo(() => {
    const query = search.trim();
    let list = query ? groupFuse.search(normalizeText(query)).map((r) => r.item) : groups;
    if (region !== "all") list = list.filter((g) => g.offers.some((o) => o.region === region));
    return list.map((g, i) => ({ id: `${g.key}-${i}`, ...g }));
  }, [groups, groupFuse, search, region]);

  const filteredShops = useMemo(() => {
    let list = shops;
    const query = normalizeText(search.trim());
    if (query) {
      list = list.filter(
        (s) => normalizeText(s.name).includes(query) || normalizeText(s.domain).includes(query),
      );
    }
    if (region !== "all") list = list.filter((s) => s.region === region);
    return list.map((s, i) => ({ id: `${s.domain}-${i}`, ...s }));
  }, [shops, search, region]);

  // ── columns ──
  const groupCols: GridColDef[] = [
    {
      field: "name",
      headerName: "Produit",
      flex: 2,
      minWidth: isMobile ? 150 : 220,
      renderCell: (p) => {
        const g = p.row as BxProductGroup;
        return g.slug ? (
          <MuiLink
            component={Link}
            href={`/comparateur/${g.slug}`}
            sx={{
              color: "inherit",
              fontWeight: 700,
              transition: "color 0.2s",
              "&:hover": { color: "var(--rpb-primary)" },
            }}
          >
            {g.name}
          </MuiLink>
        ) : (
          g.name
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
            sx={{
              fontWeight: 800,
              fontSize: "0.65rem",
              bgcolor: "rgba(255,255,255,0.06)",
            }}
          />
        ) : (
          "—"
        ),
    },
    { field: "shopCount", headerName: "Boutiques", width: 100, type: "number" },
    {
      field: "cheapestEur",
      headerName: "Meilleur prix",
      width: isMobile ? 100 : 130,
      type: "number",
      renderCell: (p) => (
        <Typography sx={{ fontWeight: 900, color: "#22c55e", fontSize: "0.95rem" }}>
          {fmtEur(p.value as number)}
        </Typography>
      ),
    },
    {
      field: "cheapest",
      headerName: "Moins cher chez",
      flex: 1,
      minWidth: isMobile ? 120 : 160,
      sortable: false,
      renderCell: (p) => {
        const g = p.row as BxProductGroup;
        const flag = g.cheapest ? (REGION_FLAG[g.cheapest.region] ?? "") : "";
        return g.cheapest ? (
          <MuiLink
            href={g.cheapest.url}
            target="_blank"
            rel="noopener noreferrer nofollow"
            sx={{
              display: "inline-flex",
              alignItems: "center",
              gap: 0.5,
              fontWeight: 700,
              transition: "color 0.2s",
              "&:hover": { color: "var(--rpb-primary)" },
            }}
          >
            {flag} {g.cheapest.shop} <OpenInNew sx={{ fontSize: 12, opacity: 0.7 }} />
          </MuiLink>
        ) : (
          "—"
        );
      },
    },
  ];

  const productCols: GridColDef[] = [
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
            color: "inherit",
            fontWeight: 600,
            transition: "color 0.2s",
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
      headerName: "Région",
      width: 130,
      renderCell: (p) => {
        const reg = p.value as string;
        const flag = REGION_FLAG[reg] ?? "";
        return `${flag} ${REGION_LABEL[reg] ?? reg}`;
      },
    },
    {
      field: "priceEur",
      headerName: "Prix ≈ €",
      width: isMobile ? 90 : 110,
      type: "number",
      renderCell: (p) => (
        <Typography sx={{ fontWeight: 800, color: "#22c55e" }}>
          {fmtEur(p.value as number)}
        </Typography>
      ),
    },
    {
      field: "price",
      headerName: "Prix (devise)",
      width: 130,
      type: "number",
      renderCell: (p) => (
        <Typography variant="body2" sx={{ color: "text.secondary", fontWeight: 500 }}>
          {fmtPrice(p.value as number, (p.row as BxProduct).currency)}
        </Typography>
      ),
    },
    {
      field: "available",
      headerName: "Stock",
      width: 110,
      renderCell: (p) => (
        <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
          <Box
            sx={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              bgcolor: p.value ? "#22c55e" : "#ff9800",
              boxShadow: p.value ? "0 0 8px #22c55e" : "0 0 8px #ff9800",
            }}
          />
          <Typography
            sx={{
              fontSize: "0.8rem",
              fontWeight: 700,
              color: p.value ? "success.main" : "warning.main",
            }}
          >
            {p.value ? "En stock" : "Incertain"}
          </Typography>
        </Stack>
      ),
    },
  ];

  const shopCols: GridColDef[] = [
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
            transition: "color 0.2s",
            "&:hover": { color: "var(--rpb-primary)" },
          }}
        >
          {p.value as string} <OpenInNew sx={{ fontSize: 12, opacity: 0.7 }} />
        </MuiLink>
      ),
    },
    { field: "domain", headerName: "Domaine", flex: 1, minWidth: 160 },
    {
      field: "region",
      headerName: "Région",
      width: isMobile ? 90 : 120,
      renderCell: (p) => {
        const reg = p.value as string;
        const flag = REGION_FLAG[reg] ?? "";
        return `${flag} ${REGION_LABEL[reg] ?? reg}`;
      },
    },
    {
      field: "type",
      headerName: "Type",
      width: 130,
      renderCell: (p) => TYPE_LABEL[p.value as string] ?? p.value,
    },
    {
      field: "productCount",
      headerName: "Produits scrapés",
      width: isMobile ? 110 : 140,
      type: "number",
      renderCell: (p) => <Typography sx={{ fontWeight: 800 }}>{p.value as number}</Typography>,
    },
  ];

  const gridSx = {
    bgcolor: "surface.high",
    borderColor: "divider",
    borderRadius: 4,
    width: "100%",
    overflow: "hidden",
    boxShadow: "0 8px 30px rgba(0, 0, 0, 0.2)",
    "& .MuiDataGrid-main": {
      borderRadius: 4,
    },
    "& .MuiDataGrid-columnHeaders": {
      bgcolor: "rgba(255, 255, 255, 0.02)",
      borderBottom: "2px solid rgba(255, 255, 255, 0.05)",
    },
    "& .MuiDataGrid-columnHeader": {
      textTransform: "uppercase",
      fontSize: "0.7rem",
      letterSpacing: 1.2,
      fontWeight: 900,
      color: "text.secondary",
    },
    "& .MuiDataGrid-cell": {
      borderColor: "rgba(255, 255, 255, 0.05)",
      fontSize: "0.85rem",
      display: "flex",
      alignItems: "center",
      "&:focus, &:focus-within": {
        outline: "none !important",
      },
    },
    "& .MuiDataGrid-row": {
      transition: "background-color 0.2s ease-in-out, transform 0.2s ease-in-out",
      cursor: "pointer",
      "&:hover": {
        bgcolor: "rgba(255, 255, 255, 0.03) !important",
      },
    },
    "& .MuiDataGrid-footerContainer": {
      borderTop: "1px solid rgba(255, 255, 255, 0.05)",
      bgcolor: "rgba(0, 0, 0, 0.1)",
    },
    "& .MuiTablePagination-root": {
      color: "text.secondary",
    },
    // Custom scrollbar
    "& ::-webkit-scrollbar": {
      width: 8,
      height: 8,
    },
    "& ::-webkit-scrollbar-track": {
      bgcolor: "rgba(0, 0, 0, 0.1)",
    },
    "& ::-webkit-scrollbar-thumb": {
      bgcolor: "rgba(255, 255, 255, 0.1)",
      borderRadius: 4,
      "&:hover": {
        bgcolor: "rgba(255, 255, 255, 0.2)",
      },
    },
  } as const;

  return (
    <Box>
      {/* Filtres */}
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={2}
        sx={{
          mb: 3,
          p: 2,
          borderRadius: 3,
          border: "1px solid",
          borderColor: "divider",
          bgcolor: "rgba(255, 255, 255, 0.01)",
          backgroundImage:
            "linear-gradient(180deg, rgba(255,255,255,0.02) 0%, rgba(255,255,255,0) 100%)",
          boxShadow: "0 4px 20px -5px rgba(0,0,0,0.15)",
        }}
      >
        <Box sx={{ flex: 1, maxWidth: { sm: 460 }, position: "relative" }}>
          <TextField
            size="small"
            fullWidth
            placeholder="Rechercher (ex: Dran Sword, 3-60F, lanceur…)"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onFocus={handleSearchFocus}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <Search sx={{ color: "text.disabled", fontSize: 20 }} />
                  </InputAdornment>
                ),
              },
            }}
            sx={{
              "& .MuiOutlinedInput-root": {
                borderRadius: 2.5,
                bgcolor: "rgba(0, 0, 0, 0.15)",
              },
            }}
          />

          {/* Dropdown overlay */}
          {showGlobalDropdown && search.trim().length >= 2 && (
            <Paper
              sx={{
                position: "absolute",
                top: "100%",
                left: 0,
                right: 0,
                mt: 1,
                maxHeight: 450,
                overflowY: "auto",
                zIndex: 1000,
                bgcolor: "surface.high",
                border: "1px solid rgba(255, 255, 255, 0.08)",
                boxShadow: "0 10px 40px rgba(0,0,0,0.55)",
                borderRadius: 3.5,
                p: 2,
                backgroundImage:
                  "linear-gradient(180deg, rgba(255,255,255,0.02) 0%, rgba(255,255,255,0) 100%)",
                backdropFilter: "blur(10px)",
              }}
            >
              {loadingGlobal ? (
                <Typography
                  variant="body2"
                  sx={{ color: "text.secondary", p: 1, textAlign: "center" }}
                >
                  Chargement de l'index de recherche global...
                </Typography>
              ) : Object.values(globalResults).every((arr) => arr.length === 0) ? (
                <Typography
                  variant="body2"
                  sx={{ color: "text.secondary", p: 1, textAlign: "center" }}
                >
                  Aucun résultat global pour "{search}"
                </Typography>
              ) : (
                <Stack spacing={2.5}>
                  {/* CTA → moteur de recherche global (toutes saisons, tous sujets) */}
                  <Box
                    component={Link}
                    href={`/search?q=${encodeURIComponent(search)}`}
                    onClick={() => setShowGlobalDropdown(false)}
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 1,
                      p: 1,
                      borderRadius: 2,
                      textDecoration: "none",
                      border: "1px solid",
                      borderColor: "rgba(138,180,248,0.3)",
                      bgcolor: "rgba(138,180,248,0.08)",
                      color: "#8ab4f8",
                      fontWeight: 800,
                      fontSize: "0.78rem",
                      "&:hover": { bgcolor: "rgba(138,180,248,0.16)" },
                    }}
                  >
                    <span>
                      Recherche complete Beyblade (toutes saisons, tournois, anime, bladers...)
                    </span>
                    <OpenInNew sx={{ fontSize: 14 }} />
                  </Box>

                  {/* Category: Products */}
                  {globalResults.product.length > 0 && (
                    <Box>
                      <Typography
                        variant="subtitle2"
                        sx={{
                          color: "text.secondary",
                          fontWeight: 800,
                          fontSize: "0.68rem",
                          textTransform: "uppercase",
                          letterSpacing: 1,
                          mb: 1,
                          display: "flex",
                          alignItems: "center",
                          gap: 0.5,
                        }}
                      >
                        🛒 Produits ({globalResults.product.length})
                      </Typography>
                      <Stack spacing={0.5}>
                        {globalResults.product.slice(0, 4).map((item: any) => (
                          <Box
                            key={item.id}
                            onClick={() => handleGlobalItemClick(item)}
                            sx={{
                              p: 1,
                              borderRadius: 2,
                              cursor: "pointer",
                              transition: "all 0.15s",
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              "&:hover": { bgcolor: "rgba(255,255,255,0.04)" },
                            }}
                          >
                            <Box>
                              <Typography sx={{ fontWeight: 800, fontSize: "0.82rem" }}>
                                {item.title}
                              </Typography>
                              <Typography variant="caption" sx={{ color: "text.secondary" }}>
                                {item.subtitle}
                              </Typography>
                            </Box>
                            <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                              {item.price && (
                                <Typography
                                  sx={{
                                    fontWeight: 800,
                                    color: "#22c55e",
                                    fontSize: "0.82rem",
                                  }}
                                >
                                  {fmtEur(item.price)}
                                </Typography>
                              )}
                              <OpenInNew sx={{ fontSize: 12, opacity: 0.5 }} />
                            </Stack>
                          </Box>
                        ))}
                      </Stack>
                    </Box>
                  )}

                  {/* Category: Parts */}
                  {globalResults.part.length > 0 && (
                    <Box>
                      <Typography
                        variant="subtitle2"
                        sx={{
                          color: "text.secondary",
                          fontWeight: 800,
                          fontSize: "0.68rem",
                          textTransform: "uppercase",
                          letterSpacing: 1,
                          mb: 1,
                          display: "flex",
                          alignItems: "center",
                          gap: 0.5,
                        }}
                      >
                        ⚙️ Pièces détachées ({globalResults.part.length})
                      </Typography>
                      <Stack spacing={0.5}>
                        {globalResults.part.slice(0, 4).map((item: any) => (
                          <Box
                            key={item.id}
                            onClick={() => handleGlobalItemClick(item)}
                            sx={{
                              p: 1,
                              borderRadius: 2,
                              cursor: "pointer",
                              transition: "all 0.15s",
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              "&:hover": { bgcolor: "rgba(255,255,255,0.04)" },
                            }}
                          >
                            <Box>
                              <Typography sx={{ fontWeight: 800, fontSize: "0.82rem" }}>
                                {item.title}
                              </Typography>
                              <Typography variant="caption" sx={{ color: "text.secondary" }}>
                                {item.details}
                              </Typography>
                            </Box>
                            <Chip
                              size="small"
                              label={item.badge}
                              sx={{
                                height: 18,
                                fontSize: "0.58rem",
                                fontWeight: 900,
                                bgcolor: item.badge?.includes("Tier S")
                                  ? "rgba(239, 68, 68, 0.15)"
                                  : item.badge?.includes("Tier A")
                                    ? "rgba(168, 85, 247, 0.15)"
                                    : "rgba(255, 255, 255, 0.08)",
                                color: item.badge?.includes("Tier S")
                                  ? "#f87171"
                                  : item.badge?.includes("Tier A")
                                    ? "#c084fc"
                                    : "#d1d5db",
                                border: "none",
                              }}
                            />
                          </Box>
                        ))}
                      </Stack>
                    </Box>
                  )}

                  {/* Category: Tournaments */}
                  {globalResults.tournament.length > 0 && (
                    <Box>
                      <Typography
                        variant="subtitle2"
                        sx={{
                          color: "text.secondary",
                          fontWeight: 800,
                          fontSize: "0.68rem",
                          textTransform: "uppercase",
                          letterSpacing: 1,
                          mb: 1,
                          display: "flex",
                          alignItems: "center",
                          gap: 0.5,
                        }}
                      >
                        🏆 Tournois ({globalResults.tournament.length})
                      </Typography>
                      <Stack spacing={0.5}>
                        {globalResults.tournament.slice(0, 3).map((item: any) => (
                          <Box
                            key={item.id}
                            onClick={() => handleGlobalItemClick(item)}
                            sx={{
                              p: 1,
                              borderRadius: 2,
                              cursor: "pointer",
                              transition: "all 0.15s",
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              "&:hover": {
                                bgcolor: "rgba(255,255,255,0.04)",
                              },
                            }}
                          >
                            <Box>
                              <Typography sx={{ fontWeight: 800, fontSize: "0.82rem" }}>
                                {item.title}
                              </Typography>
                              <Typography variant="caption" sx={{ color: "text.secondary" }}>
                                {item.subtitle}
                              </Typography>
                            </Box>
                            <Chip
                              size="small"
                              label={item.badge}
                              color={
                                item.badge === "COMPLETE"
                                  ? "success"
                                  : item.badge === "UNDERWAY"
                                    ? "warning"
                                    : "primary"
                              }
                              variant="outlined"
                              sx={{
                                height: 18,
                                fontSize: "0.58rem",
                                fontWeight: 800,
                              }}
                            />
                          </Box>
                        ))}
                      </Stack>
                    </Box>
                  )}

                  {/* Category: Bladers */}
                  {globalResults.blader.length > 0 && (
                    <Box>
                      <Typography
                        variant="subtitle2"
                        sx={{
                          color: "text.secondary",
                          fontWeight: 800,
                          fontSize: "0.68rem",
                          textTransform: "uppercase",
                          letterSpacing: 1,
                          mb: 1,
                          display: "flex",
                          alignItems: "center",
                          gap: 0.5,
                        }}
                      >
                        👤 Bladers & Classement ({globalResults.blader.length})
                      </Typography>
                      <Stack spacing={0.5}>
                        {globalResults.blader.slice(0, 3).map((item: any) => (
                          <Box
                            key={item.id}
                            onClick={() => handleGlobalItemClick(item)}
                            sx={{
                              p: 1,
                              borderRadius: 2,
                              cursor: "pointer",
                              transition: "all 0.15s",
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              "&:hover": { bgcolor: "rgba(255,255,255,0.04)" },
                            }}
                          >
                            <Box>
                              <Typography sx={{ fontWeight: 800, fontSize: "0.82rem" }}>
                                {item.title}
                              </Typography>
                              <Typography variant="caption" sx={{ color: "text.secondary" }}>
                                {item.subtitle}
                              </Typography>
                            </Box>
                            <Typography
                              sx={{
                                fontSize: "0.72rem",
                                color: "text.secondary",
                                fontWeight: 700,
                              }}
                            >
                              {item.details}
                            </Typography>
                          </Box>
                        ))}
                      </Stack>
                    </Box>
                  )}

                  {/* Category: Lexique */}
                  {globalResults.lexicon.length > 0 && (
                    <Box>
                      <Typography
                        variant="subtitle2"
                        sx={{
                          color: "text.secondary",
                          fontWeight: 800,
                          fontSize: "0.68rem",
                          textTransform: "uppercase",
                          letterSpacing: 1,
                          mb: 1,
                          display: "flex",
                          alignItems: "center",
                          gap: 0.5,
                        }}
                      >
                        📖 Lexique ({globalResults.lexicon.length})
                      </Typography>
                      <Stack spacing={0.5}>
                        {globalResults.lexicon.slice(0, 4).map((item: any) => (
                          <Box key={item.id} sx={{ p: 1, borderRadius: 2 }}>
                            <Typography sx={{ fontWeight: 800, fontSize: "0.82rem" }}>
                              {item.title}{" "}
                              <Typography
                                component="span"
                                variant="caption"
                                sx={{
                                  color: "text.secondary",
                                  fontWeight: 600,
                                }}
                              >
                                · {item.subtitle}
                              </Typography>
                            </Typography>
                            <Typography
                              variant="caption"
                              sx={{
                                color: "text.secondary",
                                display: "block",
                                mt: 0.25,
                              }}
                            >
                              {item.details}
                            </Typography>
                          </Box>
                        ))}
                      </Stack>
                    </Box>
                  )}
                </Stack>
              )}
            </Paper>
          )}
        </Box>
        <TextField
          select
          size="small"
          label="Région"
          value={region}
          onChange={(e) => setRegion(e.target.value)}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <FilterList sx={{ color: "text.disabled", mr: 1, fontSize: 18 }} />
                </InputAdornment>
              ),
            },
          }}
          sx={{
            minWidth: 180,
            "& .MuiOutlinedInput-root": {
              borderRadius: 2.5,
              bgcolor: "rgba(0, 0, 0, 0.15)",
            },
          }}
        >
          <MenuItem value="all">Toutes les régions</MenuItem>
          {regions.map((r) => (
            <MenuItem key={r} value={r}>
              {REGION_LABEL[r] ?? r}
            </MenuItem>
          ))}
        </TextField>
      </Stack>

      <Stack
        direction="row"
        spacing={3}
        sx={{ alignItems: "flex-start", position: "relative", width: "100%" }}
      >
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Tabs
            value={tab}
            onChange={(_, v) => {
              setTab(v);
              setOpenGroup(null);
            }}
            variant="scrollable"
            scrollButtons="auto"
            sx={{
              mb: 3,
              minHeight: 48,
              "& .MuiTabs-indicator": {
                display: "none",
              },
              "& .MuiTabs-flexContainer": {
                gap: 1,
              },
            }}
          >
            {[
              `Meilleurs prix (${filteredGroups.length})`,
              `Recommandations & Analyse (${scoredRecommendations.length})`,
              `Tous les produits (${filteredProducts.length})`,
              `Boutiques (${filteredShops.length})`,
            ].map((label, idx) => (
              <Tab
                key={idx}
                label={label}
                sx={{
                  textTransform: "none",
                  fontWeight: 800,
                  fontSize: "0.85rem",
                  borderRadius: 3,
                  minHeight: 40,
                  py: 1,
                  px: 2.5,
                  color: "text.secondary",
                  transition: "all 0.2s ease-in-out",
                  "&.Mui-selected": {
                    color: "#fff",
                    bgcolor: "color-mix(in srgb, var(--rpb-primary) 85%, #000)",
                    boxShadow: "0 4px 15px rgba(var(--rpb-primary-rgb), 0.3)",
                  },
                  "&:hover:not(.Mui-selected)": {
                    bgcolor: "rgba(255, 255, 255, 0.04)",
                    color: "text.primary",
                  },
                }}
              />
            ))}
            {stats && (
              <Tab
                label="Statistiques"
                sx={{
                  textTransform: "none",
                  fontWeight: 800,
                  fontSize: "0.85rem",
                  borderRadius: 3,
                  minHeight: 40,
                  py: 1,
                  px: 2.5,
                  color: "text.secondary",
                  transition: "all 0.2s ease-in-out",
                  "&.Mui-selected": {
                    color: "#fff",
                    bgcolor: "color-mix(in srgb, var(--rpb-primary) 85%, #000)",
                    boxShadow: "0 4px 15px rgba(var(--rpb-primary-rgb), 0.3)",
                  },
                  "&:hover:not(.Mui-selected)": {
                    bgcolor: "rgba(255, 255, 255, 0.04)",
                    color: "text.primary",
                  },
                }}
              />
            )}
          </Tabs>

          {tab === 0 && (
            <DataGrid
              rows={filteredGroups}
              columns={groupCols}
              density="compact"
              sx={gridSx}
              initialState={{
                pagination: { paginationModel: { pageSize: 50 } },
              }}
              pageSizeOptions={[25, 50, 100]}
              onRowClick={(p) => setOpenGroup(p.row as BxProductGroup)}
              disableRowSelectionOnClick
              autoHeight
              columnVisibilityModel={
                isMobile
                  ? {
                      code: false,
                      shopCount: false,
                    }
                  : {}
              }
            />
          )}
          {tab === 1 && (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
              {/* Sliders Panel */}
              <Box
                sx={{
                  p: 3,
                  borderRadius: 4,
                  bgcolor: "surface.high",
                  backgroundImage:
                    "linear-gradient(180deg, rgba(255,255,255,0.02) 0%, rgba(255,255,255,0) 100%)",
                  border: "1px solid",
                  borderColor: "divider",
                  boxShadow: "0 4px 20px -5px rgba(0,0,0,0.15)",
                }}
              >
                <Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 2 }}>
                  <Tune sx={{ color: "var(--rpb-primary)", fontSize: 20 }} />
                  <Typography variant="subtitle1" sx={{ fontWeight: 900 }}>
                    Algorithme de Recommandation Modulaire
                  </Typography>
                </Stack>
                <Typography
                  variant="body2"
                  sx={{ color: "text.secondary", mb: 3, lineHeight: 1.5 }}
                >
                  Personnalisez les coefficients de pondération ci-dessous pour ajuster le score
                  d'évaluation des produits. Le classement s'actualise en temps réel.
                </Typography>

                <Box
                  sx={{
                    display: "grid",
                    gridTemplateColumns: { xs: "1fr", md: "1fr 1fr 1fr" },
                    gap: 4,
                  }}
                >
                  {/* Meta Weight */}
                  <Box>
                    <Stack
                      direction="row"
                      sx={{
                        justifyContent: "space-between",
                        alignItems: "center",
                        mb: 1,
                      }}
                    >
                      <Typography
                        sx={{
                          fontWeight: 800,
                          fontSize: "0.85rem",
                          display: "flex",
                          alignItems: "center",
                          gap: 0.5,
                        }}
                      >
                        <Shield sx={{ fontSize: 16, color: "#a855f7" }} /> Intérêt Méta
                      </Typography>
                      <Typography
                        sx={{
                          fontWeight: 900,
                          color: "#a855f7",
                          fontSize: "0.85rem",
                        }}
                      >
                        {Math.round(wMeta * 100)}%
                      </Typography>
                    </Stack>
                    <Slider
                      size="small"
                      value={wMeta}
                      min={0}
                      max={1}
                      step={0.05}
                      onChange={(_, v) => setWMeta(v as number)}
                      sx={{
                        color: "#a855f7",
                        "& .MuiSlider-thumb": {
                          boxShadow: "0 0 10px rgba(168, 85, 247, 0.3)",
                        },
                      }}
                    />
                    <Typography
                      variant="caption"
                      sx={{
                        color: "text.secondary",
                        display: "block",
                        mt: 0.5,
                        lineHeight: 1.4,
                      }}
                    >
                      Coefficients des pièces basés sur l'usage en tournoi (decks enregistrés) et la
                      classification WBO.
                    </Typography>
                  </Box>

                  {/* Hype Weight */}
                  <Box>
                    <Stack
                      direction="row"
                      sx={{
                        justifyContent: "space-between",
                        alignItems: "center",
                        mb: 1,
                      }}
                    >
                      <Typography
                        sx={{
                          fontWeight: 800,
                          fontSize: "0.85rem",
                          display: "flex",
                          alignItems: "center",
                          gap: 0.5,
                        }}
                      >
                        <TrendingUp sx={{ fontSize: 16, color: "#f43f5e" }} /> Facteur Hype
                      </Typography>
                      <Typography
                        sx={{
                          fontWeight: 900,
                          color: "#f43f5e",
                          fontSize: "0.85rem",
                        }}
                      >
                        {Math.round(wHype * 100)}%
                      </Typography>
                    </Stack>
                    <Slider
                      size="small"
                      value={wHype}
                      min={0}
                      max={1}
                      step={0.05}
                      onChange={(_, v) => setWHype(v as number)}
                      sx={{
                        color: "#f43f5e",
                        "& .MuiSlider-thumb": {
                          boxShadow: "0 0 10px rgba(244, 63, 94, 0.3)",
                        },
                      }}
                    />
                    <Typography
                      variant="caption"
                      sx={{
                        color: "text.secondary",
                        display: "block",
                        mt: 0.5,
                        lineHeight: 1.4,
                      }}
                    >
                      Popularité en magasin, fraîcheur de sortie (&lt;1 an) et statut d'édition
                      Collector/Limitée.
                    </Typography>
                  </Box>

                  {/* Price Weight */}
                  <Box>
                    <Stack
                      direction="row"
                      sx={{
                        justifyContent: "space-between",
                        alignItems: "center",
                        mb: 1,
                      }}
                    >
                      <Typography
                        sx={{
                          fontWeight: 800,
                          fontSize: "0.85rem",
                          display: "flex",
                          alignItems: "center",
                          gap: 0.5,
                        }}
                      >
                        <AccountBalanceWallet sx={{ fontSize: 16, color: "#06b6d4" }} /> Rapport
                        Qualité/Prix
                      </Typography>
                      <Typography
                        sx={{
                          fontWeight: 900,
                          color: "#06b6d4",
                          fontSize: "0.85rem",
                        }}
                      >
                        {Math.round(wPrice * 100)}%
                      </Typography>
                    </Stack>
                    <Slider
                      size="small"
                      value={wPrice}
                      min={0}
                      max={1}
                      step={0.05}
                      onChange={(_, v) => setWPrice(v as number)}
                      sx={{
                        color: "#06b6d4",
                        "& .MuiSlider-thumb": {
                          boxShadow: "0 0 10px rgba(6, 182, 212, 0.3)",
                        },
                      }}
                    />
                    <Typography
                      variant="caption"
                      sx={{
                        color: "text.secondary",
                        display: "block",
                        mt: 0.5,
                        lineHeight: 1.4,
                      }}
                    >
                      Rapport entre la valeur estimée (méta + hype) et le meilleur tarif constaté
                      sur le marché.
                    </Typography>
                  </Box>
                </Box>
              </Box>

              {/* Recommendation Data Grid */}
              <DataGrid
                rows={scoredRecommendations}
                columns={recCols}
                density="compact"
                sx={gridSx}
                initialState={{
                  pagination: { paginationModel: { pageSize: 50 } },
                }}
                pageSizeOptions={[25, 50, 100]}
                onRowClick={(p) => handleRecClick(p.row)}
                disableRowSelectionOnClick
                autoHeight
                columnVisibilityModel={
                  isMobile
                    ? {
                        code: false,
                        metaRelevanceScore: false,
                        hypeScore: false,
                        priceEfficiencyScore: false,
                      }
                    : {}
                }
              />
            </Box>
          )}
          {tab === 2 && (
            <DataGrid
              rows={filteredProducts}
              columns={productCols}
              density="compact"
              sx={gridSx}
              initialState={{
                pagination: { paginationModel: { pageSize: 50 } },
                sorting: { sortModel: [{ field: "priceEur", sort: "asc" }] },
              }}
              pageSizeOptions={[25, 50, 100]}
              disableRowSelectionOnClick
              autoHeight
              columnVisibilityModel={
                isMobile
                  ? {
                      region: false,
                      price: false,
                      available: false,
                    }
                  : {}
              }
            />
          )}
          {tab === 3 && (
            <DataGrid
              rows={filteredShops}
              columns={shopCols}
              density="compact"
              sx={gridSx}
              initialState={{
                pagination: { paginationModel: { pageSize: 50 } },
                sorting: {
                  sortModel: [{ field: "productCount", sort: "desc" }],
                },
              }}
              pageSizeOptions={[25, 50, 100]}
              disableRowSelectionOnClick
              autoHeight
              columnVisibilityModel={
                isMobile
                  ? {
                      domain: false,
                      type: false,
                    }
                  : {}
              }
            />
          )}

          {tab === 4 && stats && (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 3.5 }}>
              {/* Synthèse globale */}
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
                  gap: 2.5,
                }}
              >
                <Box
                  sx={{
                    p: 3,
                    borderRadius: 4,
                    bgcolor: "surface.high",
                    backgroundImage:
                      "linear-gradient(180deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0) 100%)",
                    border: "1px solid",
                    borderColor: "divider",
                    boxShadow: "0 4px 25px rgba(0,0,0,0.15)",
                  }}
                >
                  <Typography
                    variant="subtitle2"
                    sx={{
                      color: "text.secondary",
                      textTransform: "uppercase",
                      letterSpacing: 0.8,
                      fontWeight: 800,
                      fontSize: "0.65rem",
                      mb: 1,
                    }}
                  >
                    Prix Moyen Global
                  </Typography>
                  <Typography variant="h4" sx={{ fontWeight: 900, color: "var(--rpb-primary)" }}>
                    {fmtEur(stats.averagePriceEur)}
                  </Typography>
                  <Typography
                    variant="caption"
                    sx={{
                      color: "text.secondary",
                      mt: 1,
                      display: "block",
                      lineHeight: 1.4,
                    }}
                  >
                    Calculé à partir de toutes les offres indexées avec un prix valide converti en
                    euros.
                  </Typography>
                </Box>

                <Box
                  sx={{
                    p: 3,
                    borderRadius: 4,
                    bgcolor: "surface.high",
                    backgroundImage:
                      "linear-gradient(180deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0) 100%)",
                    border: "1px solid",
                    borderColor: "divider",
                    boxShadow: "0 4px 25px rgba(0,0,0,0.15)",
                  }}
                >
                  <Typography
                    variant="subtitle2"
                    sx={{
                      color: "text.secondary",
                      textTransform: "uppercase",
                      letterSpacing: 0.8,
                      fontWeight: 800,
                      fontSize: "0.65rem",
                      mb: 1,
                    }}
                  >
                    Taux de Réussite du Scraping
                  </Typography>
                  <Typography variant="h4" sx={{ fontWeight: 900, color: "#22c55e" }}>
                    {stats.successRate}%
                  </Typography>
                  <Typography
                    variant="caption"
                    sx={{
                      color: "text.secondary",
                      mt: 1,
                      display: "block",
                      lineHeight: 1.4,
                    }}
                  >
                    {shops.filter((s) => s.productCount > 0).length} boutiques scrapées avec succès
                    sur un total de {shops.length}.
                  </Typography>
                </Box>
              </Box>

              {/* Distribution par Région et Plateforme */}
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
                  gap: 2.5,
                }}
              >
                {/* Régions */}
                <Box
                  sx={{
                    p: 3,
                    borderRadius: 4,
                    bgcolor: "surface.high",
                    backgroundImage:
                      "linear-gradient(180deg, rgba(255,255,255,0.02) 0%, rgba(255,255,255,0) 100%)",
                    border: "1px solid",
                    borderColor: "divider",
                    boxShadow: "0 4px 25px rgba(0,0,0,0.15)",
                  }}
                >
                  <Typography variant="h6" sx={{ fontWeight: 900, mb: 2.5, fontSize: "1.1rem" }}>
                    Statistiques par Région
                  </Typography>
                  <Stack spacing={2}>
                    {stats.regionStats.map((r) => (
                      <Box
                        key={r.region}
                        sx={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          pb: 1.5,
                          borderBottom: "1px solid rgba(255,255,255,0.05)",
                          "&:last-child": { pb: 0, border: 0 },
                        }}
                      >
                        <Box>
                          <Typography sx={{ fontWeight: 700, fontSize: "0.95rem" }}>
                            {REGION_FLAG[r.region] ?? ""} {REGION_LABEL[r.region] ?? r.region}
                          </Typography>
                          <Typography variant="caption" sx={{ color: "text.secondary" }}>
                            {r.productCount} offres
                          </Typography>
                        </Box>
                        <Box sx={{ textAlign: "right" }}>
                          <Typography sx={{ fontWeight: 900, color: "text.primary" }}>
                            {r.averagePriceEur ? fmtEur(r.averagePriceEur) : "—"}
                          </Typography>
                          <Typography
                            variant="caption"
                            sx={{
                              color: "text.secondary",
                              fontSize: "0.68rem",
                            }}
                          >
                            Prix moyen
                          </Typography>
                        </Box>
                      </Box>
                    ))}
                  </Stack>
                </Box>

                {/* Plateformes */}
                <Box
                  sx={{
                    p: 3,
                    borderRadius: 4,
                    bgcolor: "surface.high",
                    backgroundImage:
                      "linear-gradient(180deg, rgba(255,255,255,0.02) 0%, rgba(255,255,255,0) 100%)",
                    border: "1px solid",
                    borderColor: "divider",
                    boxShadow: "0 4px 25px rgba(0,0,0,0.15)",
                  }}
                >
                  <Typography variant="h6" sx={{ fontWeight: 900, mb: 2.5, fontSize: "1.1rem" }}>
                    Répartition des Plateformes
                  </Typography>
                  <Stack spacing={2}>
                    {stats.platformStats.map((p) => (
                      <Box
                        key={p.platform}
                        sx={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          pb: 1.5,
                          borderBottom: "1px solid rgba(255,255,255,0.05)",
                          "&:last-child": { pb: 0, border: 0 },
                        }}
                      >
                        <Box>
                          <Typography
                            sx={{
                              fontWeight: 700,
                              textTransform: "capitalize",
                              fontSize: "0.95rem",
                            }}
                          >
                            {p.platform}
                          </Typography>
                          <Typography variant="caption" sx={{ color: "text.secondary" }}>
                            {p.active} actives / {p.total} totales
                          </Typography>
                        </Box>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                          <Chip
                            size="small"
                            label={`${Math.round((p.active / p.total) * 100)}% succès`}
                            color={p.active > 0 ? "success" : "default"}
                            variant="outlined"
                            sx={{
                              fontWeight: 800,
                              fontSize: "0.65rem",
                              bgcolor: p.active > 0 ? "rgba(34,197,94,0.05)" : "transparent",
                            }}
                          />
                        </Box>
                      </Box>
                    ))}
                  </Stack>
                </Box>
              </Box>
            </Box>
          )}

          <Typography
            variant="caption"
            sx={{
              color: "text.secondary",
              display: "block",
              mt: 2.5,
              opacity: 0.6,
            }}
          >
            Données mises à jour le {new Date(generatedAt).toLocaleString("fr-FR")} · prix convertis
            en € à titre indicatif (taux approximatifs).
          </Typography>
        </Box>

        <AnimatePresence>
          {isDesktop && openGroup && (tab === 0 || tab === 1) && (
            <Box
              component={motion.div}
              initial={{ opacity: 0, x: 20, width: 0 }}
              animate={{ opacity: 1, x: 0, width: 400 }}
              exit={{ opacity: 0, x: 20, width: 0 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              sx={{
                width: { md: "350px", lg: "400px" },
                flexShrink: 0,
                borderRadius: 5,
                bgcolor: "surface.high",
                backgroundImage:
                  "linear-gradient(180deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0) 100%)",
                border: "1px solid rgba(255, 255, 255, 0.08)",
                boxShadow: "0 16px 40px rgba(0, 0, 0, 0.4)",
                p: 3,
                position: "sticky",
                top: 80,
                maxHeight: "calc(100vh - 120px)",
                overflowY: "auto",
                display: "flex",
                flexDirection: "column",
                "&::-webkit-scrollbar": {
                  width: 6,
                },
                "&::-webkit-scrollbar-thumb": {
                  bgcolor: "rgba(255, 255, 255, 0.1)",
                  borderRadius: 3,
                },
              }}
            >
              <Box
                sx={{
                  pb: 2,
                  mb: 2,
                  borderBottom: "1px solid rgba(255,255,255,0.05)",
                  position: "relative",
                  pr: 5,
                }}
              >
                <Typography
                  variant="h6"
                  sx={{
                    fontWeight: 900,
                    display: "flex",
                    flexWrap: "wrap",
                    alignItems: "center",
                    gap: 1.5,
                    lineHeight: 1.2,
                  }}
                >
                  {openGroup.name}
                  {openGroup.code && (
                    <Chip
                      size="small"
                      label={openGroup.code}
                      sx={{
                        fontWeight: 800,
                        fontSize: "0.65rem",
                        bgcolor: "rgba(255,255,255,0.08)",
                      }}
                    />
                  )}
                </Typography>
                <IconButton
                  aria-label="close"
                  onClick={() => setOpenGroup(null)}
                  sx={{
                    position: "absolute",
                    right: 0,
                    top: 0,
                    color: "text.secondary",
                    transition: "all 0.2s",
                    "&:hover": {
                      color: "text.primary",
                      bgcolor: "rgba(255,255,255,0.05)",
                    },
                  }}
                >
                  <Close />
                </IconButton>
              </Box>

              <Typography
                variant="subtitle2"
                sx={{
                  color: "text.secondary",
                  textTransform: "uppercase",
                  letterSpacing: 0.8,
                  fontWeight: 800,
                  fontSize: "0.68rem",
                  mb: 1.5,
                }}
              >
                Offres en boutique ({openGroup.offers.length})
              </Typography>
              <Stack
                spacing={1.5}
                sx={{
                  mb: activeRec && activeRec.includedParts.length > 0 ? 4 : 0,
                }}
              >
                {openGroup.offers.map((o, i) => (
                  <Box
                    component={motion.div}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: i * 0.04 }}
                    key={`${o.domain}-${i}`}
                    sx={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      p: 2,
                      borderRadius: 3.5,
                      bgcolor: i === 0 ? "rgba(34,197,94,0.06)" : "rgba(255, 255, 255, 0.01)",
                      border: "1px solid",
                      borderColor: i === 0 ? "rgba(34,197,94,0.3)" : "rgba(255,255,255,0.04)",
                      boxShadow: i === 0 ? "0 4px 15px -4px rgba(34,197,94,0.15)" : "none",
                      transition: "all 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
                      "&:hover": {
                        borderColor: i === 0 ? "#22c55e" : "rgba(255, 255, 255, 0.15)",
                        transform: "translateY(-1px)",
                      },
                    }}
                  >
                    <Box sx={{ minWidth: 0, mr: 2 }}>
                      <Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 0.5 }}>
                        <MuiLink
                          href={o.url}
                          target="_blank"
                          rel="noopener noreferrer nofollow"
                          sx={{
                            fontWeight: 800,
                            fontSize: "0.9rem",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 0.5,
                            color: "text.primary",
                            textDecoration: "none",
                            "&:hover": { color: "var(--rpb-primary)" },
                          }}
                        >
                          {REGION_FLAG[o.region] ?? ""} {o.shop}{" "}
                          <OpenInNew sx={{ fontSize: 12, opacity: 0.7 }} />
                        </MuiLink>
                        {i === 0 && (
                          <Chip
                            size="small"
                            label="MEILLEUR PRIX"
                            sx={{
                              height: 15,
                              fontSize: "0.5rem",
                              fontWeight: 900,
                              bgcolor: "#22c55e",
                              color: "#fff",
                              px: 0.5,
                            }}
                          />
                        )}
                      </Stack>
                      <Typography
                        variant="caption"
                        noWrap
                        sx={{ color: "text.secondary", display: "block" }}
                      >
                        {o.title}
                      </Typography>
                    </Box>
                    <Box sx={{ textAlign: "right", flexShrink: 0 }}>
                      <Typography
                        sx={{
                          fontWeight: 900,
                          color: i === 0 ? "#22c55e" : "text.primary",
                          fontSize: "1rem",
                        }}
                      >
                        {fmtEur(o.priceEur)}
                      </Typography>
                      {o.currency !== "EUR" && (
                        <Typography
                          variant="caption"
                          sx={{
                            color: "text.secondary",
                            fontSize: "0.7rem",
                            display: "block",
                          }}
                        >
                          {fmtPrice(o.price, o.currency)}
                        </Typography>
                      )}
                    </Box>
                  </Box>
                ))}
              </Stack>

              {activeRec && activeRec.includedParts.length > 0 && (
                <Box sx={{ borderTop: "1px solid rgba(255,255,255,0.06)", pt: 3 }}>
                  <Typography
                    variant="subtitle2"
                    sx={{
                      color: "text.secondary",
                      textTransform: "uppercase",
                      letterSpacing: 0.8,
                      fontWeight: 800,
                      fontSize: "0.68rem",
                      mb: 2,
                      display: "flex",
                      alignItems: "center",
                      gap: 0.8,
                    }}
                  >
                    <Shield sx={{ fontSize: 14, color: "#a855f7" }} /> Méta-Analyse des Composants
                  </Typography>
                  <Stack spacing={1.5}>
                    {activeRec.includedParts.map((part) => (
                      <Box
                        key={part.id}
                        sx={{
                          p: 1.5,
                          borderRadius: 3,
                          bgcolor: "rgba(255, 255, 255, 0.02)",
                          border: "1px solid rgba(255, 255, 255, 0.04)",
                        }}
                      >
                        <Stack
                          direction="row"
                          sx={{
                            justifyContent: "space-between",
                            alignItems: "center",
                            mb: 1,
                          }}
                        >
                          <Box>
                            <Typography
                              sx={{
                                fontWeight: 850,
                                fontSize: "0.85rem",
                                lineHeight: 1.2,
                              }}
                            >
                              {part.name}
                            </Typography>
                            <Typography
                              variant="caption"
                              sx={{
                                color: "text.secondary",
                                textTransform: "capitalize",
                                fontSize: "0.65rem",
                              }}
                            >
                              {part.type}
                            </Typography>
                          </Box>
                          <Chip
                            size="small"
                            label={`Tier ${part.tier}`}
                            sx={{
                              height: 18,
                              fontSize: "0.58rem",
                              fontWeight: 900,
                              bgcolor:
                                part.tier === "S"
                                  ? "rgba(239, 68, 68, 0.15)"
                                  : part.tier === "A"
                                    ? "rgba(168, 85, 247, 0.15)"
                                    : part.tier === "B"
                                      ? "rgba(59, 130, 246, 0.15)"
                                      : "rgba(255, 255, 255, 0.08)",
                              color:
                                part.tier === "S"
                                  ? "#f87171"
                                  : part.tier === "A"
                                    ? "#c084fc"
                                    : part.tier === "B"
                                      ? "#60a5fa"
                                      : "#d1d5db",
                              border: "none",
                            }}
                          />
                        </Stack>

                        <Stack
                          direction="row"
                          sx={{
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: 1,
                          }}
                        >
                          <Typography
                            variant="caption"
                            sx={{
                              color: "text.secondary",
                              fontSize: "0.68rem",
                            }}
                          >
                            Usage deck: <strong>{part.usageCount}</strong>
                          </Typography>
                          <Typography
                            variant="caption"
                            sx={{
                              color: "text.secondary",
                              fontSize: "0.68rem",
                            }}
                          >
                            Score Méta: <strong>{Math.round(part.metaScore * 100)}%</strong>
                          </Typography>
                        </Stack>
                        <LinearProgress
                          variant="determinate"
                          value={part.normalizedUsage * 100}
                          sx={{
                            mt: 0.8,
                            height: 4,
                            borderRadius: 2,
                            bgcolor: "rgba(255,255,255,0.03)",
                            "& .MuiLinearProgress-bar": {
                              bgcolor:
                                part.tier === "S"
                                  ? "#ef4444"
                                  : part.tier === "A"
                                    ? "#a855f7"
                                    : part.tier === "B"
                                      ? "#3b82f6"
                                      : "#9ca3af",
                            },
                          }}
                        />
                      </Box>
                    ))}
                  </Stack>
                </Box>
              )}
            </Box>
          )}
        </AnimatePresence>
      </Stack>

      {/* Dialog détail produit (uniquement sur mobile/tablette) */}
      <Dialog
        open={!isDesktop && !!openGroup}
        onClose={() => setOpenGroup(null)}
        maxWidth="sm"
        fullWidth
        slotProps={{
          backdrop: {
            sx: {
              backdropFilter: "blur(12px)",
              bgcolor: "rgba(0, 0, 0, 0.6)",
            },
          },
          paper: {
            sx: {
              borderRadius: 5,
              bgcolor: "surface.high",
              backgroundImage:
                "linear-gradient(180deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0) 100%)",
              border: "1px solid rgba(255, 255, 255, 0.08)",
              boxShadow: "0 24px 70px rgba(0, 0, 0, 0.5)",
              overflow: "hidden",
              position: "relative",
            },
          },
        }}
      >
        <DialogTitle
          sx={{
            m: 0,
            p: 3,
            pr: 7,
            fontWeight: 900,
            display: "flex",
            alignItems: "center",
            gap: 1.5,
            borderBottom: "1px solid rgba(255,255,255,0.05)",
          }}
        >
          {openGroup?.name}
          {openGroup?.code && (
            <Chip
              size="small"
              label={openGroup.code}
              sx={{
                fontWeight: 800,
                fontSize: "0.65rem",
                bgcolor: "rgba(255,255,255,0.08)",
              }}
            />
          )}
        </DialogTitle>
        <IconButton
          aria-label="close"
          onClick={() => setOpenGroup(null)}
          sx={{
            position: "absolute",
            right: 16,
            top: 16,
            color: "text.secondary",
            transition: "all 0.2s",
            "&:hover": {
              color: "text.primary",
              bgcolor: "rgba(255,255,255,0.05)",
            },
          }}
        >
          <Close />
        </IconButton>
        <DialogContent sx={{ p: 3 }}>
          <Typography
            variant="subtitle2"
            sx={{
              color: "text.secondary",
              textTransform: "uppercase",
              letterSpacing: 0.8,
              fontWeight: 800,
              fontSize: "0.68rem",
              mb: 1.5,
            }}
          >
            Offres en boutique ({openGroup?.offers.length ?? 0})
          </Typography>
          <Stack
            spacing={1.5}
            sx={{
              mb:
                openGroup &&
                (recommendations.find((r) => r.key === openGroup.key)?.includedParts.length ?? 0) >
                  0
                  ? 4
                  : 0,
            }}
          >
            {openGroup?.offers.map((o, i) => (
              <Box
                component={motion.div}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: i * 0.04 }}
                key={`${o.domain}-${i}`}
                sx={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  p: 2,
                  borderRadius: 3.5,
                  bgcolor: i === 0 ? "rgba(34,197,94,0.06)" : "rgba(255, 255, 255, 0.01)",
                  border: "1px solid",
                  borderColor: i === 0 ? "rgba(34,197,94,0.3)" : "rgba(255,255,255,0.04)",
                  boxShadow: i === 0 ? "0 4px 15px -4px rgba(34,197,94,0.15)" : "none",
                  transition: "all 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
                  "&:hover": {
                    borderColor: i === 0 ? "#22c55e" : "rgba(255, 255, 255, 0.15)",
                    transform: "translateY(-1px)",
                  },
                }}
              >
                <Box sx={{ minWidth: 0, mr: 2 }}>
                  <Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 0.5 }}>
                    <MuiLink
                      href={o.url}
                      target="_blank"
                      rel="noopener noreferrer nofollow"
                      sx={{
                        fontWeight: 800,
                        fontSize: "0.9rem",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 0.5,
                        color: "text.primary",
                        textDecoration: "none",
                        "&:hover": { color: "var(--rpb-primary)" },
                      }}
                    >
                      {REGION_FLAG[o.region] ?? ""} {o.shop}{" "}
                      <OpenInNew sx={{ fontSize: 12, opacity: 0.7 }} />
                    </MuiLink>
                    {i === 0 && (
                      <Chip
                        size="small"
                        label="MEILLEUR PRIX"
                        sx={{
                          height: 15,
                          fontSize: "0.5rem",
                          fontWeight: 900,
                          bgcolor: "#22c55e",
                          color: "#fff",
                          px: 0.5,
                        }}
                      />
                    )}
                  </Stack>
                  <Typography
                    variant="caption"
                    noWrap
                    sx={{ color: "text.secondary", display: "block" }}
                  >
                    {o.title}
                  </Typography>
                </Box>
                <Box sx={{ textAlign: "right", flexShrink: 0 }}>
                  <Typography
                    sx={{
                      fontWeight: 900,
                      color: i === 0 ? "#22c55e" : "text.primary",
                      fontSize: "1rem",
                    }}
                  >
                    {fmtEur(o.priceEur)}
                  </Typography>
                  {o.currency !== "EUR" && (
                    <Typography
                      variant="caption"
                      sx={{
                        color: "text.secondary",
                        fontSize: "0.7rem",
                        display: "block",
                      }}
                    >
                      {fmtPrice(o.price, o.currency)}
                    </Typography>
                  )}
                </Box>
              </Box>
            ))}
          </Stack>

          {openGroup &&
            (recommendations.find((r) => r.key === openGroup.key)?.includedParts.length ?? 0) >
              0 && (
              <Box sx={{ borderTop: "1px solid rgba(255,255,255,0.06)", pt: 3 }}>
                <Typography
                  variant="subtitle2"
                  sx={{
                    color: "text.secondary",
                    textTransform: "uppercase",
                    letterSpacing: 0.8,
                    fontWeight: 800,
                    fontSize: "0.68rem",
                    mb: 2,
                    display: "flex",
                    alignItems: "center",
                    gap: 0.8,
                  }}
                >
                  <Shield sx={{ fontSize: 14, color: "#a855f7" }} /> Méta-Analyse des Composants
                </Typography>
                <Stack spacing={1.5}>
                  {(recommendations.find((r) => r.key === openGroup.key)?.includedParts ?? []).map(
                    (part) => (
                      <Box
                        key={part.id}
                        sx={{
                          p: 1.5,
                          borderRadius: 3,
                          bgcolor: "rgba(255, 255, 255, 0.02)",
                          border: "1px solid rgba(255, 255, 255, 0.04)",
                        }}
                      >
                        <Stack
                          direction="row"
                          sx={{
                            justifyContent: "space-between",
                            alignItems: "center",
                            mb: 1,
                          }}
                        >
                          <Box>
                            <Typography
                              sx={{
                                fontWeight: 850,
                                fontSize: "0.85rem",
                                lineHeight: 1.2,
                              }}
                            >
                              {part.name}
                            </Typography>
                            <Typography
                              variant="caption"
                              sx={{
                                color: "text.secondary",
                                textTransform: "capitalize",
                                fontSize: "0.65rem",
                              }}
                            >
                              {part.type}
                            </Typography>
                          </Box>
                          <Chip
                            size="small"
                            label={`Tier ${part.tier}`}
                            sx={{
                              height: 18,
                              fontSize: "0.58rem",
                              fontWeight: 900,
                              bgcolor:
                                part.tier === "S"
                                  ? "rgba(239, 68, 68, 0.15)"
                                  : part.tier === "A"
                                    ? "rgba(168, 85, 247, 0.15)"
                                    : part.tier === "B"
                                      ? "rgba(59, 130, 246, 0.15)"
                                      : "rgba(255, 255, 255, 0.08)",
                              color:
                                part.tier === "S"
                                  ? "#f87171"
                                  : part.tier === "A"
                                    ? "#c084fc"
                                    : part.tier === "B"
                                      ? "#60a5fa"
                                      : "#d1d5db",
                              border: "none",
                            }}
                          />
                        </Stack>

                        <Stack
                          direction="row"
                          sx={{
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: 1,
                          }}
                        >
                          <Typography
                            variant="caption"
                            sx={{ color: "text.secondary", fontSize: "0.68rem" }}
                          >
                            Usage deck: <strong>{part.usageCount}</strong>
                          </Typography>
                          <Typography
                            variant="caption"
                            sx={{ color: "text.secondary", fontSize: "0.68rem" }}
                          >
                            Score Méta: <strong>{Math.round(part.metaScore * 100)}%</strong>
                          </Typography>
                        </Stack>
                        <LinearProgress
                          variant="determinate"
                          value={part.normalizedUsage * 100}
                          sx={{
                            mt: 0.8,
                            height: 4,
                            borderRadius: 2,
                            bgcolor: "rgba(255,255,255,0.03)",
                            "& .MuiLinearProgress-bar": {
                              bgcolor:
                                part.tier === "S"
                                  ? "#ef4444"
                                  : part.tier === "A"
                                    ? "#a855f7"
                                    : part.tier === "B"
                                      ? "#3b82f6"
                                      : "#9ca3af",
                            },
                          }}
                        />
                      </Box>
                    ),
                  )}
                </Stack>
              </Box>
            )}
        </DialogContent>
      </Dialog>
    </Box>
  );
}
