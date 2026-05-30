"use client";

import { useState } from "react";
import type { GlobalSearchItem, SearchCategory } from "@rpbey/api-contract";
import styles from "./SerpResults.module.css";

// ── Icônes SVG inline ─────────────────────────────────────────────────────────

function IconProduct() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M20 4H4v2l8 5 8-5V4zM4 13v7h16v-7l-8 5-8-5z" />
    </svg>
  );
}
function IconPart() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M22.7 19l-9.1-9.1c.9-2.3.4-5-1.5-6.9-2-2-5-2.4-7.4-1.3L9 6 6 9 1.6 4.7C.4 7.1.9 10.1 2.9 12.1c1.9 1.9 4.6 2.4 6.9 1.5l9.1 9.1c.4.4 1 .4 1.4 0l2.3-2.3c.5-.4.5-1.1.1-1.4z" />
    </svg>
  );
}
function IconTournament() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M19 5h-2V3H7v2H5c-1.1 0-2 .9-2 2v1c0 2.55 1.92 4.63 4.39 4.94.63 1.5 1.98 2.63 3.61 2.96V19H7v2h10v-2h-4v-3.1c1.63-.33 2.98-1.46 3.61-2.96C19.08 12.63 21 10.55 21 8V7c0-1.1-.9-2-2-2zM5 8V7h2v3.82C5.84 10.4 5 9.3 5 8zm14 0c0 1.3-.84 2.4-2 2.82V7h2v1z" />
    </svg>
  );
}
function IconBlader() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
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

function CategoryIcon({ category }: { category: SearchCategory }) {
  switch (category) {
    case "product":
      return <IconProduct />;
    case "part":
      return <IconPart />;
    case "tournament":
      return <IconTournament />;
    case "blader":
      return <IconBlader />;
    default:
      return <IconGlobe />;
  }
}

// ── Utilitaires ───────────────────────────────────────────────────────────────

function domainFrom(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

// Chips tiers solides sur rôles M3 (échelle de chaleur S→C : sang/or/terracotta/neutre)
function badgeStyle(badge: string): React.CSSProperties {
  const map: Record<string, [string, string]> = {
    S: ["var(--rpb-tier-s)", "var(--rpb-tier-s-on)"],
    A: ["var(--rpb-tier-a)", "var(--rpb-tier-a-on)"],
    B: ["var(--rpb-tier-b)", "var(--rpb-tier-b-on)"],
    C: ["var(--rpb-tier-c)", "var(--rpb-tier-c-on)"],
  };
  const [bg, on] = map[badge] ?? [
    "var(--md-sys-color-primary-container)",
    "var(--md-sys-color-on-primary-container)",
  ];
  return { backgroundColor: bg, color: on };
}

// Catégories rendues en grille d'images
const IMAGE_CATEGORIES = new Set<SearchCategory>(["frame", "anime"]);

// ── ImageGrid ─────────────────────────────────────────────────────────────────

function ImageGrid({ items }: { items: GlobalSearchItem[] }) {
  const withThumb = items.filter((i) => i.thumbnail);
  if (withThumb.length === 0) return null;
  return (
    <div className={styles.imageGrid}>
      {withThumb.map((item, idx) => (
        <a
          key={item.id}
          href={item.url || "#"}
          className={styles.imageCard}
          target={item.url.startsWith("http") ? "_blank" : undefined}
          rel={item.url.startsWith("http") ? "noopener noreferrer" : undefined}
          style={{ animationDelay: `${idx * 30}ms` }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={item.thumbnail} alt={item.title} className={styles.imageThumb} loading="lazy" />
          <div className={styles.imageLabel}>{item.title}</div>
        </a>
      ))}
    </div>
  );
}

// ── Leading visuel (thumbnail produit/part → avatar tonal en fallback) ──────────

function ResultLeading({
  item,
  faviconSrc,
}: {
  item: GlobalSearchItem;
  faviconSrc: string | null;
}) {
  const [thumbFailed, setThumbFailed] = useState(false);
  // Thumbnail réel (produit/part) tant qu'il charge ; sinon avatar tonal.
  if (item.thumbnail && !thumbFailed) {
    return (
      <div className={styles.thumb}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={item.thumbnail}
          alt=""
          className={styles.thumbImg}
          loading="lazy"
          onError={() => setThumbFailed(true)}
        />
      </div>
    );
  }
  return (
    <div className={styles.avatar} data-cat={item.category} aria-hidden="true">
      {faviconSrc ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={faviconSrc} alt="" width={20} height={20} className={styles.faviconImg} />
      ) : (
        <CategoryIcon category={item.category} />
      )}
    </div>
  );
}

// ── TextResult ────────────────────────────────────────────────────────────────

function TextResult({ item, index }: { item: GlobalSearchItem; index: number }) {
  const isExternal = item.url.startsWith("http");
  const domain = isExternal ? domainFrom(item.url) : null;
  const faviconSrc = domain ? `https://www.google.com/s2/favicons?domain=${domain}&sz=64` : null;

  return (
    <li className={styles.item} style={{ animationDelay: `${index * 45}ms` }}>
      <a
        className={styles.itemLink}
        href={item.url || "#"}
        target={isExternal ? "_blank" : undefined}
        rel={isExternal ? "noopener noreferrer" : undefined}
      >
        {/* Leading : thumbnail produit OU avatar tonal (favicon / icône type) */}
        <ResultLeading item={item} faviconSrc={faviconSrc} />

        {/* Corps */}
        <div className={styles.itemBody}>
          <div className={styles.siteLine}>
            <span className={styles.siteName}>{domain ?? item.subtitle}</span>
            {domain && (
              <span className={styles.siteUrl}>
                {item.url.length > 56 ? `${item.url.slice(0, 56)}…` : item.url}
              </span>
            )}
          </div>

          <span className={styles.titleLink}>{item.title}</span>

          <p className={styles.snippet}>{item.details ?? item.subtitle}</p>

          {item.badge && (
            <span className={styles.badge} style={badgeStyle(item.badge)}>
              {item.price != null ? `${item.price.toFixed(2)} €` : item.badge}
            </span>
          )}
        </div>
      </a>
    </li>
  );
}

// ── SerpResults ───────────────────────────────────────────────────────────────

interface SerpResultsProps {
  items: GlobalSearchItem[];
  query: string;
}

export function SerpResults({ items, query }: SerpResultsProps) {
  if (items.length === 0) {
    return (
      <div className={styles.empty} role="status">
        Aucun résultat pour &ldquo;{query}&rdquo;
      </div>
    );
  }

  // Sépare les items visuels (grille) des items texte
  const imageItems = items.filter((i) => IMAGE_CATEGORIES.has(i.category) && i.thumbnail);
  const textItems = items.filter((i) => !IMAGE_CATEGORIES.has(i.category) || !i.thumbnail);

  return (
    <>
      {imageItems.length > 0 && <ImageGrid items={imageItems} />}
      <ol className={styles.list} aria-label="Résultats de recherche">
        {textItems.map((item, idx) => (
          <TextResult key={item.id} item={item} index={idx} />
        ))}
      </ol>
    </>
  );
}
