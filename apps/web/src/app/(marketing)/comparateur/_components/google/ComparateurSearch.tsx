"use client";

import * as React from "react";
import { Box, Container } from "@mui/material";
import { useRouter, useSearchParams } from "next/navigation";
import type { GlobalSearchItem, SearchCategory } from "@rpbey/api-contract";
import type { BxProductGroup, RecommendedProduct } from "../types";
import { AiSynthesis } from "./AiSynthesis";
import { GoogleHome } from "./GoogleHome";
import { GoogleSearchField } from "./GoogleSearchField";
import { GoogleTopBar } from "./GoogleTopBar";
import { KnowledgePanel } from "./KnowledgePanel";
import { SerpResults } from "./SerpResults";
import { SerpTabs } from "./SerpTabs";
import { BG, BG_DEEP, BORDER } from "./tokens";

// Etats de la machine a etats de recherche
type ViewState = "home" | "serp" | "synthesis";

interface ComparateurSearchProps {
  groups: BxProductGroup[];
  recommendations: RecommendedProduct[];
}

// Recherche prefixe insensible a la casse + accents
function normalizeQ(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();
}

// Correspond un groupe au query (fuzzy prefixe)
function matchesGroup(g: BxProductGroup, q: string): boolean {
  const nq = normalizeQ(q);
  return normalizeQ(g.name).includes(nq) || (g.code != null && normalizeQ(g.code).includes(nq));
}

export function ComparateurSearch({ groups, recommendations }: ComparateurSearchProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Initialisation depuis l'URL (?q=..., ?mode=ai)
  const initialQ = searchParams.get("q") ?? "";
  const initialMode = searchParams.get("mode") === "ai";

  const [view, setView] = React.useState<ViewState>(initialQ ? "serp" : "home");
  const [query, setQuery] = React.useState(initialQ);
  const [aiMode, setAiMode] = React.useState(initialMode);
  const [category, setCategory] = React.useState<SearchCategory | "all" | "ai">(
    initialMode ? "ai" : "all",
  );

  // Index de recherche (fetch depuis /api/v1/search)
  const [searchIndex, setSearchIndex] = React.useState<GlobalSearchItem[]>([]);
  React.useEffect(() => {
    fetch("/api/v1/search")
      .then((r) => r.json())
      .then((d) => {
        if (d?.ok && Array.isArray(d.data?.data)) setSearchIndex(d.data.data);
      })
      .catch(() => {});
  }, []);

  // Suggestions filtrees par prefixe
  const suggestions = React.useMemo((): GlobalSearchItem[] => {
    if (!query.trim()) return [];
    const nq = normalizeQ(query);
    return searchIndex.filter((item) => normalizeQ(item.title).includes(nq)).slice(0, 8);
  }, [query, searchIndex]);

  // Resultats filtres par categorie
  const results = React.useMemo((): GlobalSearchItem[] => {
    if (!query.trim()) return [];
    const nq = normalizeQ(query);
    return searchIndex.filter((item) => {
      if (category !== "all" && category !== "ai" && item.category !== category) return false;
      return normalizeQ(item.title).includes(nq) || normalizeQ(item.subtitle).includes(nq);
    });
  }, [query, searchIndex, category]);

  // Entite produit matchee pour le Knowledge Panel et la synthese
  const matchedGroup = React.useMemo((): BxProductGroup | null => {
    if (!query.trim()) return null;
    return groups.find((g) => matchesGroup(g, query)) ?? null;
  }, [query, groups]);

  const matchedReco = React.useMemo((): RecommendedProduct | null => {
    if (!matchedGroup) return null;
    return (
      recommendations.find((r) => r.key === matchedGroup.key || r.slug === matchedGroup.slug) ??
      null
    );
  }, [matchedGroup, recommendations]);

  // Top reco pour "J'ai de la chance"
  const topReco = recommendations[0] ?? null;

  // Groupes lies (recherches associees dans le Knowledge Panel)
  const relatedGroups = React.useMemo((): BxProductGroup[] => {
    if (!matchedGroup) return [];
    return groups.filter((g) => g.key !== matchedGroup.key).slice(0, 6);
  }, [matchedGroup, groups]);

  // Mise a jour URL sans navigation (pushState silencieux)
  function syncUrl(q: string, mode: boolean) {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (mode) params.set("mode", "ai");
    const path = params.toString() ? `/comparateur/recherche?${params}` : "/comparateur/recherche";
    router.replace(path, { scroll: false });
  }

  function handleSubmit(q: string) {
    if (!q.trim()) return;
    setQuery(q);
    const newMode = aiMode;
    setView(newMode ? "synthesis" : "serp");
    setCategory(newMode ? "ai" : "all");
    syncUrl(q, newMode);
  }

  function handleChange(v: string) {
    setQuery(v);
    if (!v.trim() && view !== "home") {
      setView("home");
      syncUrl("", aiMode);
    }
  }

  function handleToggleAi() {
    const next = !aiMode;
    setAiMode(next);
    if (view === "serp") setView("synthesis");
    else if (view === "synthesis") setView("serp");
    if (query.trim()) syncUrl(query, next);
  }

  function handleTabChange(v: SearchCategory | "all" | "ai") {
    setCategory(v);
    if (v === "ai") {
      setAiMode(true);
      setView("synthesis");
      syncUrl(query, true);
    } else {
      setAiMode(false);
      setView("serp");
      syncUrl(query, false);
    }
  }

  function handleLucky() {
    if (!topReco) return;
    router.push(`/comparateur/${topReco.slug}`);
  }

  // ── Vue HOME ──────────────────────────────────────────────────
  if (view === "home") {
    return (
      <Box sx={{ bgcolor: BG, minHeight: "100vh" }}>
        <GoogleHome
          suggestions={suggestions}
          query={query}
          aiMode={aiMode}
          topReco={topReco}
          onChange={handleChange}
          onSubmit={handleSubmit}
          onToggleAi={handleToggleAi}
          onLucky={handleLucky}
        />
      </Box>
    );
  }

  // ── Vue SERP ou SYNTHESIS ──────────────────────────────────────
  return (
    <Box sx={{ bgcolor: BG, minHeight: "100vh" }}>
      {/* Header SERP compact */}
      <Box
        sx={{
          bgcolor: BG_DEEP,
          borderBottom: "1px solid",
          borderColor: BORDER,
          position: "sticky",
          top: 0,
          zIndex: 100,
        }}
      >
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 2,
            px: { xs: 1.5, sm: 3 },
            py: 1,
          }}
        >
          {/* Logo compact */}
          <Box
            component="button"
            onClick={() => {
              setView("home");
              setQuery("");
              syncUrl("", aiMode);
            }}
            sx={{
              fontWeight: 900,
              fontSize: "1.1rem",
              letterSpacing: "-0.03em",
              background: "linear-gradient(135deg, var(--rpb-primary), var(--rpb-secondary))",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              border: "none",
              bgcolor: "transparent",
              cursor: "pointer",
              flexShrink: 0,
              p: 0,
            }}
          >
            RPB
          </Box>

          {/* Barre de recherche inline */}
          <Box sx={{ flex: 1, maxWidth: 640 }}>
            <GoogleSearchField
              value={query}
              suggestions={suggestions}
              aiMode={aiMode}
              maxWidth="100%"
              onChange={handleChange}
              onSubmit={handleSubmit}
              onToggleAi={handleToggleAi}
            />
          </Box>

          <GoogleTopBar compact showLabs={false} />
        </Box>

        {/* Onglets */}
        <SerpTabs active={category} onChange={handleTabChange} />
      </Box>

      {/* Corps SERP : 2 colonnes */}
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: matchedGroup
              ? { xs: "1fr", md: "minmax(0,600px) minmax(0,380px)" }
              : "minmax(0,700px)",
            gap: 4,
          }}
        >
          {/* Colonne gauche : resultats ou synthese */}
          <Box>
            {view === "synthesis" ? (
              <AiSynthesis
                query={query}
                group={matchedGroup}
                reco={matchedReco}
                suggestions={suggestions}
                onNewSearch={handleSubmit}
              />
            ) : (
              <SerpResults items={results} query={query} />
            )}
          </Box>

          {/* Colonne droite : Knowledge Panel */}
          {matchedGroup && view !== "synthesis" && (
            <Box>
              <KnowledgePanel group={matchedGroup} reco={matchedReco} related={relatedGroups} />
            </Box>
          )}
        </Box>
      </Container>
    </Box>
  );
}
