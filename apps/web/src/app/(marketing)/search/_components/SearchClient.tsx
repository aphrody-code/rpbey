"use client";

import * as React from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, MotionConfig, motion, useReducedMotion } from "framer-motion";
import type { GlobalSearchItem, SearchCategory } from "@rpbey/api-contract";
import { facetCounts, normalize, rankSearch, suggest } from "@/lib/search-rank";
import type { BxProductGroup, RecommendedProduct } from "../../comparateur/_components/types";
import { KnowledgePanel } from "./KnowledgePanel";
import { SearchField } from "./SearchField";
import { SerpResults } from "./SerpResults";
import { SerpTabs } from "./SerpTabs";
import styles from "./SearchClient.module.css";
import "./shimmer.css";

// ── Easings M3 (docs/01-md3-spec-foundations.md, Motion) ───────────────────────
// Transitions spatiales : entrée = Emphasized Decelerate, sortie = Emphasized Accelerate.
const EASING_ENTER = [0.05, 0.7, 0.1, 1] as const; // emphasized decelerate
const EASING_EXIT = [0.3, 0, 0.8, 0.15] as const; // emphasized accelerate

// ── Variantes framer-motion ───────────────────────────────────────────────────

// Fade-through (+ légère montée d'échelle) : sortant accélère et disparaît (90ms),
// entrant décélère en apparaissant (210ms) — durées canoniques du motif fade-through.
const fadeThrough = {
  initial: { opacity: 0, scale: 0.96 },
  animate: { opacity: 1, scale: 1, transition: { duration: 0.21, ease: EASING_ENTER } },
  exit: { opacity: 0, scale: 0.96, transition: { duration: 0.09, ease: EASING_EXIT } },
};

// Shared-axis X (M3) : changement d'onglet = navigation latérale entre catégories.
// Sortant translate -X (accelerate), entrant +X → 0 (decelerate).
const sharedAxisX = {
  initial: { opacity: 0, x: 28 },
  animate: { opacity: 1, x: 0, transition: { duration: 0.3, ease: EASING_ENTER } },
  exit: { opacity: 0, x: -28, transition: { duration: 0.09, ease: EASING_EXIT } },
};

// Logo animé RPB — hero unique de la home + retour accueil en SERP.
const LOGO_GIF = "/rpb-3d.gif";

// ── Helpers ───────────────────────────────────────────────────────────────────

type ViewState = "home" | "serp";

function matchesGroup(g: BxProductGroup, q: string): boolean {
  const nq = normalize(q);
  return normalize(g.name).includes(nq) || (g.code != null && normalize(g.code).includes(nq));
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface SearchClientProps {
  groups: BxProductGroup[];
  recommendations: RecommendedProduct[];
}

// ── SearchClient ──────────────────────────────────────────────────────────────

export function SearchClient({ groups, recommendations }: SearchClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const initialQ = searchParams.get("q") ?? "";

  const [view, setView] = React.useState<ViewState>(initialQ ? "serp" : "home");
  const [query, setQuery] = React.useState(initialQ);
  const [category, setCategory] = React.useState<SearchCategory | "all">("all");

  // ── Index complet chargé UNE seule fois depuis l'endpoint mis en cache ─────────
  // (CDN Vercel + navigateur). Toute la recherche est ensuite rankée CÔTÉ CLIENT
  // (`rankSearch` = le même BM25F que le serveur ; sur Vercel le serveur n'ajoute
  // aucun voisin vectoriel — pas de Redis en runtime Node). Conséquence : zéro
  // aller-retour réseau par frappe → résultats **instantanés** dès l'index chargé.
  const [searchIndex, setSearchIndex] = React.useState<GlobalSearchItem[]>([]);
  const [indexLoading, setIndexLoading] = React.useState(true);

  React.useEffect(() => {
    const ctrl = new AbortController();
    fetch("/api/search/global", { signal: ctrl.signal })
      .then((r) => r.json())
      .then((json: { data?: GlobalSearchItem[] }) => {
        if (Array.isArray(json.data)) setSearchIndex(json.data);
      })
      .catch(() => {})
      .finally(() => setIndexLoading(false));
    return () => ctrl.abort();
  }, []);

  // ── Suggestions autocomplétion ────────────────────────────────────────────
  const suggestions = React.useMemo(
    (): GlobalSearchItem[] => suggest(searchIndex, query, 8),
    [query, searchIndex],
  );

  // ── Résultats filtrés par catégorie active ────────────────────────────────
  // « Tous » → ranking API (pertinence globale). Catégorie → re-rank de l'INDEX
  // COMPLET filtré : on montre TOUS les items de la catégorie (pas seulement ceux
  // tombés dans le top-N global), donc le compteur de l'onglet ⇔ les résultats.
  const results = React.useMemo((): GlobalSearchItem[] => {
    if (!query.trim()) return [];
    // Ranking synchrone sur l'index en mémoire → instantané, aucune latence réseau.
    if (category === "all") return rankSearch(searchIndex, query, { limit: 60 });
    // Limite haute (couvre le max de facette observé, ex. combos) → le compteur
    // de l'onglet correspond aux résultats affichés.
    return rankSearch(searchIndex, query, { category, limit: 300 });
  }, [searchIndex, query, category]);

  // ── Compteurs de facette = MÊME source que les vues catégorie (index complet) ──
  // → le nombre affiché sur chaque onglet == le nombre de résultats au clic.
  const facets = React.useMemo((): Record<string, number> => {
    if (!query.trim()) return {};
    return facetCounts(searchIndex, query);
  }, [searchIndex, query]);

  // ── Knowledge Panel : entité produit matchée ──────────────────────────────
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

  const relatedGroups = React.useMemo((): BxProductGroup[] => {
    if (!matchedGroup) return [];
    return groups.filter((g) => g.key !== matchedGroup.key).slice(0, 6);
  }, [matchedGroup, groups]);

  // ── Sync URL ──────────────────────────────────────────────────────────────
  function syncUrl(q: string) {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    router.replace(params.toString() ? `/search?${params}` : "/search", { scroll: false });
  }

  function handleSubmit(q: string) {
    if (!q.trim()) return;
    setQuery(q);
    setView("serp");
    setCategory("all");
    syncUrl(q);
  }

  function handleChange(v: string) {
    setQuery(v);
    if (!v.trim() && view !== "home") {
      setView("home");
      syncUrl("");
    }
  }

  function handleTabChange(v: SearchCategory | "all") {
    setCategory(v);
    setView("serp");
    syncUrl(query);
  }

  // ── Shimmer de chargement (feedback vrai fetch) ────────────────────────────
  const showShimmer = indexLoading && searchIndex.length === 0;

  // ── Frame anime en image de fond de la home (full-bleed cinématique) ───────
  const animeBackdrop = React.useMemo((): string | null => {
    const frames = searchIndex.filter(
      (i) => (i.category === "anime" || i.category === "frame") && Boolean(i.thumbnail),
    );
    if (frames.length === 0) return null;
    // Pioche stable par chargement d'index (varie d'une visite à l'autre).
    const idx = Math.floor(Math.random() * frames.length);
    return frames[idx]?.thumbnail ?? null;
  }, [searchIndex]);

  // ─────────────────────────────────────────────────────────────────────────────
  // VUE HOME
  // ─────────────────────────────────────────────────────────────────────────────
  if (view === "home") {
    return (
      <MotionConfig reducedMotion="user">
        <div className={`${styles.root} m3-search`}>
          {animeBackdrop && (
            <div
              className={styles.homeBackdrop}
              style={{ backgroundImage: `url(${animeBackdrop})` }}
              aria-hidden="true"
            />
          )}
          <motion.div className={styles.homeWrap} key="home" {...fadeThrough}>
            {/* Zone centrale */}
            <div className={styles.homeCenter}>
              <Image
                src={LOGO_GIF}
                alt="RPB — Recherche Beyblade"
                width={188}
                height={188}
                className={styles.homeLogo}
                priority
                unoptimized
              />

              {/* Barre de recherche home — Entrée lance la recherche */}
              <SearchField
                value={query}
                suggestions={suggestions}
                onChange={handleChange}
                onSubmit={handleSubmit}
              />
            </div>
          </motion.div>
        </div>
      </MotionConfig>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // VUE SERP
  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <MotionConfig reducedMotion="user">
      <div className={`${styles.root} m3-search`}>
        {/* Header SERP sticky */}
        <div className={styles.serpHeader}>
          <div className={styles.serpHeaderInner}>
            {/* Logo compact → retour home */}
            <button
              type="button"
              className={styles.serpLogo}
              onClick={() => {
                setView("home");
                setQuery("");
                syncUrl("");
              }}
              aria-label="Retour à l'accueil de la recherche"
            >
              <Image
                src={LOGO_GIF}
                alt="RPB"
                width={36}
                height={36}
                className={styles.serpLogoImg}
                unoptimized
              />
            </button>

            {/* Champ inline */}
            <div className={styles.serpFieldWrap}>
              <SearchField
                value={query}
                suggestions={suggestions}
                maxWidth="100%"
                onChange={handleChange}
                onSubmit={handleSubmit}
              />
            </div>
          </div>

          {/* Onglets facettes */}
          <SerpTabs active={category} onChange={handleTabChange} facets={facets} />
        </div>

        {/* Corps */}
        <div className={styles.serpBody}>
          <div className={`${styles.serpGrid} ${matchedGroup ? styles.hasPanel : ""}`}>
            {/* Colonne résultats */}
            <div>
              <AnimatePresence mode="wait">
                <motion.div key={`serp-${category}`} {...sharedAxisX}>
                  {showShimmer ? <SearchShimmer /> : <SerpResults items={results} query={query} />}
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Knowledge Panel (colonne droite) */}
            {matchedGroup && (
              <AnimatePresence>
                <motion.div
                  key="panel"
                  initial={{ opacity: 0, x: 16 }}
                  animate={{ opacity: 1, x: 0, transition: { duration: 0.25, ease: EASING_ENTER } }}
                  exit={{ opacity: 0, x: 16, transition: { duration: 0.15, ease: EASING_EXIT } }}
                >
                  <KnowledgePanel group={matchedGroup} reco={matchedReco} related={relatedGroups} />
                </motion.div>
              </AnimatePresence>
            )}
          </div>
        </div>
      </div>
    </MotionConfig>
  );
}

// ── Shimmer de chargement (pendant le premier fetch de l'index) ───────────────

function SearchShimmer() {
  const reduce = useReducedMotion();
  return (
    <div
      aria-busy="true"
      aria-label="Chargement des résultats"
      style={{ display: "flex", flexDirection: "column", gap: 8 }}
    >
      {[1, 2, 3, 4, 5].map((i) => (
        <div
          key={i}
          style={{
            display: "flex",
            gap: 16,
            padding: "14px 16px",
            borderRadius: "var(--md-sys-shape-corner-large, 16px)",
            background: "var(--md-sys-color-surface-container-low, #271816)",
          }}
        >
          {/* Thumbnail squelette (pulse tonal) */}
          <div
            style={{
              flexShrink: 0,
              width: 72,
              height: 72,
              borderRadius: "var(--md-sys-shape-corner-medium, 12px)",
              animation: reduce ? undefined : "m3pulse 1.4s ease-in-out infinite",
              background: "var(--md-sys-color-surface-container, #2b1c1a)",
            }}
          />
          {/* Lignes squelette */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8, paddingTop: 4 }}>
            <div style={shimmerBar("38%", 11, reduce)} />
            <div style={shimmerBar("70%", 16, reduce)} />
            <div style={shimmerBar("92%", 12, reduce)} />
            <div style={shimmerBar("60%", 12, reduce)} />
          </div>
        </div>
      ))}
    </div>
  );
}

// reduce === true → pas d'animation (respecte prefers-reduced-motion).
function shimmerBar(
  width: number | string,
  height: number,
  reduce: boolean | null,
): React.CSSProperties {
  return {
    width,
    height,
    borderRadius: 6,
    background:
      "linear-gradient(90deg, var(--md-sys-color-surface-container,#2b1c1a) 25%, var(--md-sys-color-surface-container-high,#372624) 50%, var(--md-sys-color-surface-container,#2b1c1a) 75%)",
    backgroundSize: "200% 100%",
    animation: reduce ? undefined : "shimmer 1.4s infinite linear",
  };
}
