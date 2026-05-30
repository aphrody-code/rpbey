"use client";

import * as React from "react";
import type { GlobalSearchItem } from "@rpbey/api-contract";
import type { BxProductGroup, RecommendedProduct } from "../../comparateur/_components/types";
import { SearchField } from "./SearchField";
import styles from "./AiSynthesis.module.css";

// ── Icônes SVG inline ─────────────────────────────────────────────────────────

function IconSparkle() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 2 9.5 9.5 2 12l7.5 2.5L12 22l2.5-7.5L22 12l-7.5-2.5z" />
    </svg>
  );
}

function IconGlobe() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zm6.93 6h-2.95c-.32-1.25-.78-2.45-1.38-3.56 1.84.63 3.37 1.91 4.33 3.56zM12 4.04c.83 1.2 1.48 2.53 1.91 3.96h-3.82c.43-1.43 1.08-2.76 1.91-3.96zM4.26 14C4.1 13.36 4 12.69 4 12s.1-1.36.26-2h3.38c-.08.66-.14 1.32-.14 2s.06 1.34.14 2H4.26zm.82 2h2.95c.32 1.25.78 2.45 1.38 3.56-1.84-.63-3.37-1.9-4.33-3.56zm2.95-8H5.08c.96-1.66 2.49-2.93 4.33-3.56C8.81 5.55 8.35 6.75 8.03 8zM12 19.96c-.83-1.2-1.48-2.53-1.91-3.96h3.82c-.43 1.43-1.08 2.76-1.91 3.96zM14.34 14H9.66c-.09-.65-.16-1.32-.16-2s.07-1.35.16-2h4.68c.09.65.16 1.32.16 2s-.07 1.35-.16 2zm.25 5.56c.6-1.11 1.06-2.31 1.38-3.56h2.95c-.96 1.65-2.49 2.93-4.33 3.56zM16.36 14c.08-.66.14-1.32.14-2s-.06-1.34-.14-2h3.38c.16.64.26 1.31.26 2s-.1 1.36-.26 2h-3.38z" />
    </svg>
  );
}

// ── Utilitaires ───────────────────────────────────────────────────────────────

function shortDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

// ── CitationChip ──────────────────────────────────────────────────────────────

function CitationChip({ url, label }: { url: string; label: string }) {
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className={styles.citation}>
      {label}
    </a>
  );
}

// ── SourceCard ────────────────────────────────────────────────────────────────

function SourceCard({ url, title }: { url: string; title: string }) {
  const domain = shortDomain(url);
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className={styles.sourceCard}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`https://www.google.com/s2/favicons?domain=${domain}&sz=32`}
        alt=""
        width={16}
        height={16}
      />
      <div>
        <div className={styles.sourceTitle}>{title}</div>
        <div className={styles.sourceDomain}>{domain}</div>
      </div>
    </a>
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface AiSynthesisProps {
  query: string;
  group: BxProductGroup | null;
  reco: RecommendedProduct | null;
  suggestions: GlobalSearchItem[];
  onNewSearch: (v: string) => void;
}

const EUR = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });

// ── AiSynthesis ───────────────────────────────────────────────────────────────

export function AiSynthesis({ query, group, reco, suggestions, onNewSearch }: AiSynthesisProps) {
  const [newQuery, setNewQuery] = React.useState("");

  const minPrice = group?.cheapestEur ?? null;
  const maxPrice =
    group?.offers.reduce((m, o) => (o.priceEur != null && o.priceEur > m ? o.priceEur : m), 0) ??
    null;
  const cheapestOffer = group?.cheapest ?? null;
  const shopCount = group?.shopCount ?? 0;
  const parts = reco?.includedParts ?? [];
  const topReco = reco ?? null;

  // Sources déduites par domaine unique
  const sourcesByDomain = React.useMemo(() => {
    if (!group) return [];
    const seen = new Set<string>();
    return group.offers
      .filter((o) => {
        if (!o.url || seen.has(o.domain)) return false;
        seen.add(o.domain);
        return true;
      })
      .slice(0, 8)
      .map((o) => ({ url: o.url, title: o.title, domain: o.domain }));
  }, [group]);

  if (!group) {
    return (
      <div className={styles.empty}>Aucune synthèse disponible pour &ldquo;{query}&rdquo;.</div>
    );
  }

  return (
    <div className={styles.wrap}>
      {/* Colonne principale */}
      <div className={styles.main}>
        {/* Bulle requête */}
        <div className={styles.queryBubble}>
          <span className={styles.queryChip}>{query}</span>
        </div>

        {/* Indicateur algorithmique */}
        <div className={styles.aiHeader}>
          <span className={styles.aiSparkle} aria-hidden="true">
            <IconSparkle />
          </span>
          <span className={styles.aiLabel}>
            Synthèse algorithmique — toutes les données sont tracées vers leur source.
          </span>
        </div>

        {/* Paragraphe d'introduction */}
        <p className={styles.paragraph}>
          <span className={styles.strong}>{group.name}</span>
          {group.code && <span className={styles.secondary}> ({group.code})</span>} est disponible
          sur{" "}
          <span className={styles.strong}>
            {shopCount} boutique{shopCount > 1 ? "s" : ""}
          </span>
          , à partir de{" "}
          <span className={styles.priceGood}>{minPrice != null ? EUR.format(minPrice) : "—"}</span>
          {maxPrice != null && maxPrice !== minPrice && (
            <>
              {" "}
              jusqu&apos;à <span className={styles.secondary}>{EUR.format(maxPrice)}</span>
            </>
          )}
          .
          {cheapestOffer && (
            <CitationChip url={cheapestOffer.url} label={shortDomain(cheapestOffer.url)} />
          )}
        </p>

        <div className={styles.divider} aria-hidden="true" />

        {/* Meilleur prix */}
        {cheapestOffer && (
          <div>
            <h3 className={styles.sectionTitle}>Meilleur prix</h3>
            <p className={styles.sectionText}>
              La meilleure offre actuellement est{" "}
              <a
                href={cheapestOffer.url}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.citation}
              >
                {shortDomain(cheapestOffer.url)}
              </a>{" "}
              à{" "}
              <span className={styles.priceGood}>
                {cheapestOffer.priceEur != null ? EUR.format(cheapestOffer.priceEur) : "—"}
              </span>{" "}
              ({cheapestOffer.currency}).
              <CitationChip url={cheapestOffer.url} label={shortDomain(cheapestOffer.url)} />
            </p>
          </div>
        )}

        {/* Niveau méta */}
        {topReco && topReco.includedParts.length > 0 && (
          <div>
            <h3 className={styles.sectionTitle}>Niveau méta</h3>
            {topReco.includedParts.slice(0, 3).map((p) => (
              <p key={p.id} className={styles.sectionText}>
                <span className={styles.strong}>{p.name}</span> ({p.type}) — Tier{" "}
                <span className={styles.strong}>{p.tier}</span>, score{" "}
                {(p.metaScore * 100).toFixed(0)}/100.
                <CitationChip url="https://www.wbo.co.uk/forum/beyblades/beyblade-x" label="WBO" />
              </p>
            ))}
          </div>
        )}

        {/* Composition */}
        {parts.length > 0 && (
          <div>
            <h3 className={styles.sectionTitle}>Composition</h3>
            <div className={styles.partsWrap}>
              {parts.map((p) => (
                <span key={p.id} className={styles.partChip}>
                  {p.name} ({p.type})
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Score combo */}
        {topReco && (
          <div>
            <h3 className={styles.sectionTitle}>Combo recommandé</h3>
            <p className={styles.sectionText}>
              Score global :{" "}
              <span className={styles.strong}>{(topReco.overallScore * 100).toFixed(0)}/100</span>{" "}
              (méta {(topReco.metaRelevanceScore * 100).toFixed(0)}, efficacité prix{" "}
              {(topReco.priceEfficiencyScore * 100).toFixed(0)}).
              {cheapestOffer && (
                <CitationChip url={cheapestOffer.url} label={shortDomain(cheapestOffer.url)} />
              )}
            </p>
          </div>
        )}

        <div className={styles.divider} aria-hidden="true" />

        {/* Barre de relance */}
        <p className={styles.relanceLabel}>Demander autre chose</p>
        <SearchField
          value={newQuery}
          suggestions={suggestions}
          aiMode
          maxWidth="100%"
          onChange={setNewQuery}
          onSubmit={(v) => {
            setNewQuery("");
            onNewSearch(v);
          }}
        />
      </div>

      {/* Panneau sources */}
      <div className={styles.sources}>
        <div className={styles.sourcesPanel}>
          <div className={styles.sourcesHeader}>
            <IconGlobe />
            <span className={styles.sourcesTitle}>
              {sourcesByDomain.length} source{sourcesByDomain.length > 1 ? "s" : ""}
            </span>
          </div>
          {sourcesByDomain.map((s) => (
            <SourceCard key={s.domain} url={s.url} title={s.title} />
          ))}
        </div>
      </div>
    </div>
  );
}
