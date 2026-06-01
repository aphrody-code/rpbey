"use client";

import type { SearchCategory } from "@rpbey/api-contract";
import styles from "./SerpTabs.module.css";

const TABS: { label: string; value: SearchCategory | "all" }[] = [
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
  active: SearchCategory | "all";
  onChange: (v: SearchCategory | "all") => void;
  facets?: Record<string, number>;
}

export function SerpTabs({ active, onChange, facets }: SerpTabsProps) {
  const visible = TABS.filter((t) => t.value === "all" || !facets || (facets[t.value] ?? 0) > 0);

  return (
    <nav className={styles.tabsWrap} aria-label="Catégories de résultats">
      <ul className={styles.tabsList} role="tablist">
        {visible.map((t) => {
          const isActive = active === t.value;
          const count = facets?.[t.value];
          const showCount = t.value !== "all" && count != null;
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
                <span className={styles.tabLabel}>{t.label}</span>
                {showCount && <span className={styles.count}>{count}</span>}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
