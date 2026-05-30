"use client";

import * as React from "react";
import type { GlobalSearchItem } from "@rpbey/api-contract";
import styles from "./SearchField.module.css";

// ── Icones SVG inline ────────────────────────────────────────────────────────

function IconSearch() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" />
    </svg>
  );
}

function IconClose() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
    </svg>
  );
}

function IconHistory() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M13 3a9 9 0 0 0-9 9H1l3.89 3.89.07.14L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.79-4.94-2.06l-1.42 1.42A8.954 8.954 0 0 0 13 21a9 9 0 0 0 0-18zm-1 5v5l4.28 2.54.72-1.21-3.5-2.08V8H12z" />
    </svg>
  );
}

function IconSparkle() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 2 9.5 9.5 2 12l7.5 2.5L12 22l2.5-7.5L22 12l-7.5-2.5z" />
    </svg>
  );
}

// ── Historique localStorage ───────────────────────────────────────────────────

const HISTORY_KEY = "rpb-search-history";

function loadHistory(): string[] {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) ?? "[]") as string[];
  } catch {
    return [];
  }
}

function saveHistory(q: string) {
  const prev = loadHistory().filter((h) => h !== q);
  localStorage.setItem(HISTORY_KEY, JSON.stringify([q, ...prev].slice(0, 8)));
}

// ── SuggestionRow ─────────────────────────────────────────────────────────────

function SuggestionRow({
  item,
  fromHistory,
  onSelect,
}: {
  item: GlobalSearchItem | string;
  fromHistory: boolean;
  onSelect: (label: string) => void;
}) {
  const label = typeof item === "string" ? item : item.title;
  const badge = typeof item !== "string" ? item.badge : undefined;

  return (
    <button className={styles.suggRow} onClick={() => onSelect(label)} type="button">
      {fromHistory ? (
        <span className={styles.suggIcon}>
          <IconHistory />
        </span>
      ) : (
        <span className={styles.sparkleSmall} aria-hidden="true">
          <IconSparkle />
        </span>
      )}
      <span className={styles.suggLabel}>{label}</span>
      {badge && <span className={styles.suggBadge}>{badge}</span>}
    </button>
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface SearchFieldProps {
  value: string;
  suggestions: GlobalSearchItem[];
  aiMode: boolean;
  placeholder?: string;
  maxWidth?: string;
  onChange: (v: string) => void;
  onSubmit: (v: string) => void;
  onFocus?: () => void;
}

// ── SearchField ───────────────────────────────────────────────────────────────

export function SearchField({
  value,
  suggestions,
  aiMode,
  placeholder = "Rechercher une toupie, pièce, blader…",
  maxWidth,
  onChange,
  onSubmit,
  onFocus,
}: SearchFieldProps) {
  const [focused, setFocused] = React.useState(false);
  const [history, setHistory] = React.useState<string[]>([]);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const wrapRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    setHistory(loadHistory());
  }, []);

  // Ferme le dropdown au clic hors du wrap
  React.useEffect(() => {
    function handlePointerDown(e: PointerEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setFocused(false);
      }
    }
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, []);

  const showDropdown =
    focused && (value.length === 0 ? history.length > 0 : suggestions.length > 0);

  const resolvedMaxWidth = maxWidth ?? (aiMode ? "760px" : "584px");

  function handleSelect(label: string) {
    onChange(label);
    setFocused(false);
    saveHistory(label);
    setHistory(loadHistory());
    onSubmit(label);
  }

  function handleSubmit() {
    if (!value.trim()) return;
    saveHistory(value.trim());
    setHistory(loadHistory());
    setFocused(false);
    onSubmit(value.trim());
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") handleSubmit();
    if (e.key === "Escape") setFocused(false);
  }

  const barClass = [
    styles.bar,
    focused ? styles.barFocused : "",
    showDropdown ? styles.barDropdownOpen : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      ref={wrapRef}
      className={styles.wrap}
      style={{ "--field-max-width": resolvedMaxWidth } as React.CSSProperties}
    >
      <div className={barClass}>
        {/* Icône décorative (affordance recherche) */}
        <span className={styles.leadingIcon} aria-hidden="true">
          <IconSearch />
        </span>

        {/* Saisie */}
        <input
          ref={inputRef}
          className={styles.input}
          value={value}
          placeholder={focused ? "" : placeholder}
          aria-label="Champ de recherche"
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => {
            setFocused(true);
            onFocus?.();
          }}
          onKeyDown={handleKeyDown}
        />

        {/* Clear */}
        {value && (
          <button
            type="button"
            className={styles.iconBtn}
            aria-label="Effacer la recherche"
            onClick={() => {
              onChange("");
              inputRef.current?.focus();
            }}
          >
            <IconClose />
          </button>
        )}

        {/* Bouton search Material (submit, trailing) */}
        <button
          type="button"
          className={styles.searchBtn}
          aria-label="Lancer la recherche"
          onClick={handleSubmit}
        >
          <IconSearch />
        </button>
      </div>

      {/* Dropdown */}
      {showDropdown && (
        <div className={styles.dropdown} role="listbox" aria-label="Suggestions de recherche">
          <div className={styles.dropdownDivider} />
          {value.length === 0
            ? history.map((h) => (
                <SuggestionRow key={h} item={h} fromHistory onSelect={handleSelect} />
              ))
            : suggestions
                .slice(0, 8)
                .map((s) => (
                  <SuggestionRow key={s.id} item={s} fromHistory={false} onSelect={handleSelect} />
                ))}
          <div className={styles.dropdownFooter}>
            <a className={styles.dropdownFooterBtn} href="/comparateur">
              En savoir plus
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
