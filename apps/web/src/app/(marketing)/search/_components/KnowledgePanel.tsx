"use client";

import Link from "next/link";
import type { BxProductGroup, RecommendedProduct } from "../../comparateur/_components/types";
import styles from "./KnowledgePanel.module.css";

// ── Icônes SVG inline ─────────────────────────────────────────────────────────

function IconStore() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M20 4H4v2l8 5 8-5V4zM4 13v7h16v-7l-8 5-8-5z" />
    </svg>
  );
}

function IconCart() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7 18c-1.1 0-1.99.9-1.99 2S5.9 22 7 22s2-.9 2-2-.9-2-2-2zM1 2v2h2l3.6 7.59-1.35 2.45c-.16.28-.25.61-.25.96C5 16.1 6.9 18 9 18h12v-2H9.42c-.14 0-.25-.11-.25-.25l.03-.12.9-1.63H19c.75 0 1.41-.41 1.75-1.03l3.58-6.49A1 1 0 0 0 23.5 5H5.21l-.94-2H1zm16 16c-1.1 0-1.99.9-1.99 2s.89 2 1.99 2 2-.9 2-2-.9-2-2-2z" />
    </svg>
  );
}

function IconOpenInNew() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M19 19H5V5h7V3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z" />
    </svg>
  );
}

// ── Tier helpers ──────────────────────────────────────────────────────────────

function tierColor(tier: "S" | "A" | "B" | "C"): string {
  if (tier === "S") return "var(--rpb-tier-s, #f59e0b)";
  if (tier === "A") return "var(--rpb-price-good, #22c55e)";
  if (tier === "B") return "var(--rpb-tier-b, #3b82f6)";
  return "var(--rpb-tier-c, #6b7280)";
}

const EUR = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });

// ── Props ─────────────────────────────────────────────────────────────────────

interface KnowledgePanelProps {
  group: BxProductGroup;
  reco: RecommendedProduct | null;
  related: BxProductGroup[];
}

// ── KnowledgePanel ────────────────────────────────────────────────────────────

export function KnowledgePanel({ group, reco, related }: KnowledgePanelProps) {
  const slug = group.slug ?? group.key;
  const minPrice = group.cheapestEur;
  const maxPrice =
    group.offers.reduce((m, o) => (o.priceEur != null && o.priceEur > m ? o.priceEur : m), 0) ||
    null;
  const image = group.cheapest?.image ?? null;
  const parts = reco?.includedParts ?? [];
  const tier = reco?.includedParts[0]?.tier ?? null;

  return (
    <aside className={styles.panel} aria-label={`Fiche ${group.name}`}>
      <h2 className={styles.title}>{group.name}</h2>

      {/* Image produit */}
      {image ? (
        <div className={styles.imageWrap}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={image} alt={group.name} className={styles.productImage} loading="lazy" />
        </div>
      ) : (
        <div className={styles.imagePlaceholder} aria-hidden="true">
          <IconStore />
        </div>
      )}

      {/* Fourchette de prix */}
      <div className={styles.priceRow}>
        <span className={styles.priceMin}>{minPrice != null ? EUR.format(minPrice) : "—"}</span>
        {maxPrice != null && maxPrice !== minPrice && (
          <span className={styles.priceMax}>à {EUR.format(maxPrice)}</span>
        )}
      </div>

      {/* Nb boutiques */}
      <div className={styles.shopRow}>
        <IconStore />
        <span className={styles.shopCount}>
          {group.shopCount} boutique{group.shopCount > 1 ? "s" : ""}
        </span>
      </div>

      {/* Tier meta */}
      {tier && (
        <div className={styles.tierRow}>
          <span
            className={styles.tierBadge}
            style={{
              color: tierColor(tier),
              backgroundColor: `color-mix(in srgb, ${tierColor(tier)} 15%, transparent)`,
              borderColor: `color-mix(in srgb, ${tierColor(tier)} 30%, transparent)`,
            }}
          >
            Tier {tier}
          </span>
          {reco?.metaRelevanceScore != null && (
            <span className={styles.tierScore}>
              Score meta : {(reco.metaRelevanceScore * 100).toFixed(0)}/100
            </span>
          )}
        </div>
      )}

      {/* Pièces incluses */}
      {parts.length > 0 && (
        <div>
          <p className={styles.sectionLabel}>Pièces incluses</p>
          <div className={styles.chipsWrap}>
            {parts.map((p) => (
              <span key={p.id} className={styles.chip}>
                {p.name}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* CTA */}
      <Link href={`/comparateur/${slug}`} className={styles.cta}>
        <IconCart />
        Comparer {group.shopCount} offre{group.shopCount > 1 ? "s" : ""}
      </Link>

      <div className={styles.divider} aria-hidden="true" />

      {/* Recherches associées */}
      {related.length > 0 && (
        <>
          <p className={styles.sectionLabel}>Recherches associées</p>
          <ul className={styles.relatedList}>
            {related.slice(0, 6).map((r) => (
              <li key={r.key}>
                <Link
                  href={`/search?q=${encodeURIComponent(r.name)}`}
                  className={styles.relatedLink}
                >
                  <IconOpenInNew />
                  {r.name}
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </aside>
  );
}
