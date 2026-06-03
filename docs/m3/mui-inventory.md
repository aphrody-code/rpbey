---
title: "Inventaire MUI — surface actuelle (apps/web)"
description: "Volume, composants, idiomes de style, système de thème et surface MUI X du dashboard, snapshot pré-migration M3."
scope:
  - apps/web
status: "draft"
last_updated: "2026-06-02"
related_symbols:
  - ThemeRegistry
  - DataTable
---

# Inventaire MUI — surface actuelle (apps/web)

Snapshot factuel de l'empreinte MUI v9 + Emotion dans `@rose-griffon/dashboard`, base de
chiffrage de la [migration M3](./migration-plan.md). Relevé read-only le 2026-05-29.

## 1. Volume par package

| Package | Fichiers | Note |
| --- | --- | --- |
| `@mui/material` | 244 | composants, hooks, utilitaires (~44 % du code) |
| `@mui/icons-material` | 128 | 203 imports d'icônes PascalCase |
| `@mui/x-data-grid` | 6 | grilles admin + comparateur |
| `@mui/x-charts` | 14 | Bar/Pie/Line/Radar/Scatter (lazy) |
| `@mui/x-date-pickers` | 2 | `DatePicker` wrapper + dialog tournoi |
| `@mui/x-tree-view` · `@mui/lab` · `@mui/system` | 0 | non utilisés |
| `@emotion/styled` · `@emotion/react` (direct) | 0 | transitif via MUI uniquement |

Total références `@mui/*` : **~901**. `styled()` : 2 fichiers. `useTheme()` : 55 appels.

## 2. Top composants

| Composant | Instances | Criticité |
| --- | --- | --- |
| `Box` | 424 | layout primitif |
| `Typography` | 240 | texte |
| `Grid` | 218 | grille responsive |
| `Stack` | 193 | flex + espacement |
| `Tooltip` | 67 | |
| `CircularProgress` | 67 | |
| `Button` | 46 | |
| `Card` | 45 | |
| `Container` | 33 | |
| `Alert` | 31 | pas d'équivalent M3 (shim) |
| `IconButton` | 26 | |
| `Chip` | 19 | → 4 types M3 selon rôle |
| `List` / `Dialog` / `Table` | 18 / 12 / 11 | |
| `Avatar` / `Paper` | 10 / 9 | shim |
| `Select` / `TextField` / `Radio` / `Badge` | 5 / 2 / 2 / 2 | |

Layout (`Box+Typography+Grid+Stack`) = **1 075 instances** : le gros, mécanique, sans
composant M3 (→ `<div>` + utilitaires CSS).

### Fichiers les plus denses

`(admin)/admin/tournaments/[id]/page.tsx` (27) · `(admin)/admin/users/page.tsx` (22) ·
`components/deck/DeckCard.tsx` (16) · `components/profile/MatchHistory.tsx` (15) ·
`components/profile/DeckBoxEditor.tsx` (14) · `components/ui/DataTable.tsx` (13) ·
`components/rankings/RankingsTable.tsx` (13) · `components/deck/DeckBuilderModal.tsx` (13) ·
`components/cards/UserCard.tsx` (13) · `(marketing)/tournaments/page.tsx` (13).

## 3. Idiomes de style

| Pattern | Count | Note |
| --- | --- | --- |
| `sx={{}}` | 3 383 (235 fichiers) | méthode dominante → CSS Modules + tokens |
| `styled()` | 2 | `GalerieClient.tsx`, `UserCard.tsx` |
| `useTheme()` | 55 | lecture palette conditionnelle |
| `makeStyles` / `tss` | 0 | absent |

Hotspots `sx` : `(marketing)/tournaments/page.tsx` (84) ·
`comparateur/_components/compare/DetailPane.tsx` (56) ·
`anime/_components/SeriesDetail.tsx` (55) · `(admin)/admin/stream/page.tsx` (54) ·
`(admin)/admin/tournaments/[id]/page.tsx` (48).

## 4. Système de thème

- **Provider** : `src/components/theme/ThemeRegistry.tsx` (121 l.) — client component,
  contexte React, 2 modes `red` (défaut) / `blue` (tournoi), persistance localStorage
  `rpb-theme-mode`, hook `useThemeMode()`.
- **Définitions** : `src/lib/theme.ts` (412 l.) — `createTheme()`, `redTheme`/`blueTheme`,
  palette augmentée (`surface.lowest/low/main/high/highest`, `onContainer`), typo Google Sans
  Flex sur l'échelle M3, overrides Button/Card/AppBar/DataGrid. **Dark-only.**
- **Variables `--rpb-*`** : injectées au mount par `ThemeRegistry` sur `document.documentElement`
  (`--rpb-primary`, `--rpb-secondary`, `--rpb-bg`, `--rpb-paper`, `--rpb-text(-secondary)`,
  `--rpb-divider`, `--rpb-surface-lowest…highest`, `--rpb-primary-container/-on-container`).
- **CSS global** : `src/app/globals.css` (249 l.) — reset, scrollbar, glassmorphism
  (`color-mix` + `backdrop-filter`), patterns BBX, keyframes.

L'échelle `--rpb-surface-*` mappe 1:1 sur les `--md-sys-color-surface-container-*` M3 (cf.
[tokens & thème](./theme-tokens.md)).

## 5. Surface MUI X (la plus dure)

- **DataGrid** (6 fichiers / 7 grilles) : `comparateur/_components/compare/`
  (`ShopsGrid`, `GroupsGrid`, `ProductsGrid`, `RecoPanel`), `(public-parts)/parts/page.tsx`
  (×2, cellules éditables), `(admin)/admin/users/page.tsx` (12+ cols, locale `frFR`).
  Features : `GridColDef` + `renderCell`, `GridColumnVisibilityModel`, `initialState`
  pagination/tri, `density="compact"`. Pas de premium/virtualisation lourde.
- **Charts** (14 fichiers / 12 graphiques) : wrapper `components/ui/DynamicCharts.tsx`
  (Bar/Pie/Line/Radar/Scatter lazy), `rankings/SatrCharts.tsx`/`WbCharts.tsx`,
  `admin/StatsCharts.tsx`. Features simples (séries, tooltip, légende). **`recharts ^3.8.0`
  est déjà dans `package.json`** → doublon mort à consolider.
- **DatePicker** (2 fichiers) : `components/ui/DatePicker.tsx` (wrapper, `AdapterDayjs`, fr) +
  `(admin)/admin/tournaments/TournamentDialog.tsx`. Pas de time picker ni de range.

## 6. Précédent MUI-free (gabarit cible)

`src/app/(marketing)/search/_components/` — 7 fichiers, **0 `@mui`** :
`SearchClient.tsx`, `tokens.ts`, `SearchField`, `SerpTabs`, `SerpResults`, `KnowledgePanel`,
`AiSynthesis` (+ `*.module.css`). Conventions :

1. `tokens.ts` exporte des constantes = références CSS vars (`SURFACE = "var(--rpb-surface-main, #303134)"`).
2. Style en **CSS Modules** (`.module.css`, scope local).
3. Icônes SVG inline / `lucide` (pas `@mui/icons-material`).
4. Layout flexbox/grid natif (pas `Box`/`Grid`).
5. État React + classes CSS (pas de hooks MUI).
6. Animation **framer-motion** (35 fichiers au total dans le repo) + gardes `useReducedMotion()`.

`comparateur/_components` suit partiellement ce pattern mais conserve 20 imports `@mui` +
`DataGrid` ×4 → **à migrer**, pas un précédent propre.

## 7. Heat map routes

| Route | Réfs `@mui` | Densité |
| --- | --- | --- |
| `(marketing)` | 207 | très lourde |
| `(admin)/admin` | 122 | très lourde |
| `anime` | 38 | moyenne-haute |
| `tournaments` | 29 | moyenne-haute |
| `tv` | 26 | moyenne-haute |
| `dashboard` | 23 | lourde |
| `comparateur` | 23 | moyenne-lourde (DataGrid ×4) |
| `builder` | 20 | moyenne |
| `rankings` / `meta` | 12 / 12 | moyenne |
| `profile` / `parts` / `sign-in` | 5 / 5 / 2 | légère |
| `search` | 0 | **déjà MUI-free** |
