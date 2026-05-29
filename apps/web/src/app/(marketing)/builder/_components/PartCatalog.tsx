"use client";

import {
  AutoFixHigh,
  Bolt,
  Casino,
  Construction,
  Layers,
  Search,
  Shield,
} from "@mui/icons-material";
import {
  Box,
  CircularProgress,
  InputAdornment,
  Pagination,
  Tab,
  Tabs,
  TextField,
  Typography,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { type Part } from "@/lib/types";
import { getPublicParts } from "@/server/actions/parts";
import { type BuilderStep, isCXBlade, useBuilder } from "./BuilderContext";
import { CatalogFilters } from "./CatalogFilters";
import { CatalogPartCard } from "./CatalogPartCard";

const STEP_TO_TYPE: Record<BuilderStep, string> = {
  BLADE: "BLADE",
  OVER_BLADE: "OVER_BLADE",
  RATCHET: "RATCHET",
  BIT: "BIT",
  LOCK_CHIP: "LOCK_CHIP",
  ASSIST_BLADE: "ASSIST_BLADE",
};

interface TabDef {
  label: string;
  value: BuilderStep;
  icon: React.ReactElement;
}

const BASE_TABS: TabDef[] = [
  { label: "Lames", value: "BLADE", icon: <Shield sx={{ fontSize: 18 }} /> },
  {
    label: "Ratchets",
    value: "RATCHET",
    icon: <Construction sx={{ fontSize: 18 }} />,
  },
  { label: "Bits", value: "BIT", icon: <Bolt sx={{ fontSize: 18 }} /> },
];

const CX_TABS: TabDef[] = [
  { label: "Lames", value: "BLADE", icon: <Shield sx={{ fontSize: 18 }} /> },
  {
    label: "Over",
    value: "OVER_BLADE",
    icon: <Layers sx={{ fontSize: 18 }} />,
  },
  { label: "Chip", value: "LOCK_CHIP", icon: <Casino sx={{ fontSize: 18 }} /> },
  {
    label: "Assist",
    value: "ASSIST_BLADE",
    icon: <AutoFixHigh sx={{ fontSize: 18 }} />,
  },
  {
    label: "Ratchets",
    value: "RATCHET",
    icon: <Construction sx={{ fontSize: 18 }} />,
  },
  { label: "Bits", value: "BIT", icon: <Bolt sx={{ fontSize: 18 }} /> },
];

export function PartCatalog() {
  const { state, dispatch, usedPartIds, usedPartNames } = useBuilder();
  const [parts, setParts] = useState<Part[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [systems, setSystems] = useState<string[]>([]);
  const [beyTypes, setBeyTypes] = useState<string[]>([]);
  const [spin, setSpin] = useState("ALL");
  const [isPending, startTransition] = useTransition();

  // Determine if the current active slot has a CX blade
  const activeSlot = state.beys[state.activeSlotIndex as 0 | 1 | 2];
  const showCXTabs = isCXBlade(activeSlot);
  const TABS = useMemo(() => (showCXTabs ? CX_TABS : BASE_TABS), [showCXTabs]);

  const fetchParts = useCallback(
    (p: number) => {
      startTransition(async () => {
        const result = await getPublicParts({
          type: STEP_TO_TYPE[state.activeStep] as
            | "BLADE"
            | "RATCHET"
            | "BIT"
            | "LOCK_CHIP"
            | "ASSIST_BLADE"
            | "OVER_BLADE",
          search: search || undefined,
          systems: systems.length > 0 ? systems : undefined,
          beyTypes: beyTypes.length > 0 ? beyTypes : undefined,
          spin: spin !== "ALL" ? spin : undefined,
          page: p,
          pageSize: 24, // Reduced for better grid fit
        });
        setParts(result.parts);
        setTotal(result.total);
        setTotalPages(result.totalPages);
      });
    },
    [state.activeStep, search, systems, beyTypes, spin],
  );

  // Debounce the search input so we don't fire a server roundtrip per keystroke
  useEffect(() => {
    const id = setTimeout(() => setSearch(searchInput), 300);
    return () => clearTimeout(id);
  }, [searchInput]);

  // Reset to page 1 and fetch when filters change
  useEffect(() => {
    setPage(1);
    fetchParts(1);
  }, [fetchParts]);

  const handleTabChange = (_: unknown, value: number) => {
    const tab = TABS[value];
    if (tab) dispatch({ type: "SET_ACTIVE_STEP", step: tab.value });
  };

  const handlePartClick = (part: Part) => {
    dispatch({ type: "SET_PART", part });
    // Scroll to top or switch tab on mobile
    if (window.innerWidth < 900) {
      dispatch({ type: "SET_MOBILE_TAB", tab: "deck" });
    }
  };

  const activeTabIndex = TABS.findIndex((t) => t.value === state.activeStep);
  const resolvedTabIndex = activeTabIndex !== -1 ? activeTabIndex : 0;

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        gap: 3,
        height: "100%",
        animation: "fadeIn 0.5s ease-out",
      }}
    >
      <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <TextField
          placeholder="Rechercher une pièce par nom..."
          size="medium"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <Search fontSize="medium" sx={{ color: "error.main", opacity: 0.7 }} />
                </InputAdornment>
              ),
            },
          }}
          sx={{
            "& .MuiOutlinedInput-root": {
              borderRadius: 4,
              bgcolor: "background.paper",
              boxShadow: "0 4px 12px rgba(0,0,0,0.03)",
              transition: "all 0.2s",
              "&:hover": {
                boxShadow: "0 4px 20px rgba(0,0,0,0.06)",
              },
              "&.Mui-focused": {
                boxShadow: (theme) => `0 4px 20px ${alpha(theme.palette.error.main, 0.1)}`,
              },
            },
          }}
          fullWidth
        />

        <CatalogFilters
          systems={systems}
          onSystemsChange={setSystems}
          beyTypes={beyTypes}
          onBeyTypesChange={setBeyTypes}
          spin={spin}
          onSpinChange={setSpin}
        />
      </Box>
      <Tabs
        value={resolvedTabIndex}
        onChange={handleTabChange}
        variant="scrollable"
        scrollButtons="auto"
        sx={{
          minHeight: 48,
          bgcolor: (theme) => alpha(theme.palette.action.hover, 0.04),
          borderRadius: 4,
          p: 0.5,
          "& .MuiTabs-flexContainer": {
            gap: 1,
          },
          "& .MuiTab-root": {
            minHeight: 40,
            py: 1,
            px: 2,
            fontWeight: "900",
            fontSize: "0.8rem",
            borderRadius: 3.5,
            textTransform: "uppercase",
            letterSpacing: 0.5,
            color: "text.secondary",
            transition: "all 0.2s",
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            gap: 1,
            "&:hover": {
              color: "error.main",
              bgcolor: (theme) => alpha(theme.palette.error.main, 0.04),
            },
          },
          "& .Mui-selected": {
            color: "error.main !important",
            bgcolor: "background.paper",
            boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
          },
          "& .MuiTabs-indicator": {
            display: "none",
          },
        }}
      >
        {TABS.map((tab) => (
          <Tab key={tab.value} label={tab.label} icon={tab.icon} iconPosition="start" />
        ))}
      </Tabs>
      <Box sx={{ position: "relative", flex: 1, minHeight: 400 }}>
        {isPending && (
          <Box
            sx={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              bgcolor: "rgba(255,255,255,0.4)",
              zIndex: 10,
              borderRadius: 4,
              backdropFilter: "blur(4px)",
              transition: "all 0.3s",
            }}
          >
            <CircularProgress size={40} thickness={5} color="error" />
          </Box>
        )}

        {parts.length === 0 && !isPending ? (
          <Box
            sx={{
              textAlign: "center",
              py: 12,
              bgcolor: (theme) => alpha(theme.palette.action.hover, 0.02),
              borderRadius: 4,
              border: "2px dashed",
              borderColor: "divider",
            }}
          >
            <Typography
              variant="h6"
              sx={{
                color: "text.disabled",
                fontWeight: "bold",
              }}
            >
              Aucune pièce trouvée
            </Typography>
            <Typography
              variant="body2"
              sx={{
                color: "text.secondary",
                mt: 1,
              }}
            >
              Essayez de modifier vos filtres ou votre recherche.
            </Typography>
          </Box>
        ) : (
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: {
                xs: "repeat(auto-fill, minmax(130px, 1fr))",
                sm: "repeat(auto-fill, minmax(150px, 1fr))",
                lg: "repeat(auto-fill, minmax(170px, 1fr))",
              },
              gap: 2,
            }}
          >
            {parts.map((part) => (
              <CatalogPartCard
                key={part.id}
                part={part}
                isUsed={usedPartIds.has(part.id) || usedPartNames.has(part.name)}
                onClick={() => handlePartClick(part)}
              />
            ))}
          </Box>
        )}
      </Box>
      {totalPages > 1 && (
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            pt: 2,
            borderTop: "1px solid",
            borderColor: "divider",
          }}
        >
          <Typography
            variant="caption"
            sx={{
              color: "text.secondary",
              fontWeight: "900",
              letterSpacing: 1,
            }}
          >
            {total} PIÈCES DISPONIBLES
          </Typography>

          <Pagination
            count={totalPages}
            page={page}
            onChange={(_, p) => {
              setPage(p);
              fetchParts(p);
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
            size="medium"
            siblingCount={1}
            color="standard"
            sx={{
              "& .MuiPaginationItem-root": {
                fontWeight: "bold",
                borderRadius: 2,
              },
            }}
          />
        </Box>
      )}
    </Box>
  );
}
