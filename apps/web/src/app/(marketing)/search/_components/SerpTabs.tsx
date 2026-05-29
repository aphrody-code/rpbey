"use client";

import type { SearchCategory } from "@rpbey/api-contract";
import styles from "./SerpTabs.module.css";

function IconSparkle() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" style={{ width: 10, height: 10 }}>
      <path d="M12 2 9.5 9.5 2 12l7.5 2.5L12 22l2.5-7.5L22 12l-7.5-2.5z" />
    </svg>
  );
}

const TABS: { label: string; value: SearchCategory | "all" | "ai" }[] = [
  { label: "Mode IA", value: "ai" },
  { label: "Tous", value: "all" },
  { label: "Beys", value: "product" },
  { label: "Parts", value: "part" },
  { label: "Combos", value: "combo" },
  { label: "Tournois", value: "tournament" },
  { label: "Bladers", value: "blader" },
  { label: "Anime", value: "anime" },
  { label: "Lexique", value: "lexicon" },
  { label: "Sites", value: "site" },
  { label: "Pages", value: "page" },
  { label: "Frames", value: "frame" },
];

interface SerpTabsProps {
  active: SearchCategory | "all" | "ai";
  onChange: (v: SearchCategory | "all" | "ai") => void;
  facets?: Record<string, number>;
}

export function SerpTabs({ active, onChange, facets }: SerpTabsProps) {
  const visible = TABS.filter(
    (t) => t.value === "ai" || t.value === "all" || !facets || (facets[t.value] ?? 0) > 0,
  );

  return (
    <nav className={styles.tabsWrap} aria-label="Catégories de résultats">
      <ul className={styles.tabsList} role="tablist">
        {visible.map((t) => {
          const isActive = active === t.value;
          const count = facets?.[t.value];
          const showCount = t.value !== "ai" && t.value !== "all" && count != null;
          const cls = [styles.tab, isActive ? styles.tabActive : ""].filter(Boolean).join(" ");

          return (
            <li key={t.value} role="none">
              <button
                type="button"
                role="tab"
                aria-selected={isActive}
                className={cls}
                onClick={() => onChange(t.value)}
              >
                {t.value === "ai" && (
                  <span className={styles.aiSparkle} aria-hidden="true">
                    <IconSparkle />
                  </span>
                )}
                {showCount ? `${t.label} (${count})` : t.label}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
