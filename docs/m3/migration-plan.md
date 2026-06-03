---
title: "Plan de migration MUI → Material Design 3 (apps/web)"
description: "Stratégie, véhicule, phasage en vagues, gates et risques pour migrer le dashboard Next.js de MUI v9 + Emotion vers Material Design 3 sur le web."
scope:
  - apps/web
status: draft
last_updated: "2026-06-02"
related_symbols:
  - ThemeRegistry
  - createTheme
---

# Plan de migration MUI → Material Design 3 (apps/web)

> **État d'exécution (2026-05-30).** La **vague 0** et le **pilote `/search`** sont
> livrés (branche `feat/search-m3-redesign`) :
> - `apps/web/src/app/m3.css` : les ~47 rôles `--md-sys-color-*` (rouge défaut +
>   bleu `[data-theme="blue"]`) + shape/elevation/motion/typescale/state-layer, générés
>   via `@aphrody-code/m3-tokens` `schemeFromSeed(seed,{variant:"vibrant"})`.
> - `@aphrody-code/m3-tokens`, `@aphrody-code/m3-react`, `@aphrody-code/eslint-plugin-m3`
>   **sont installés** (la question ouverte de la vague 0 est tranchée : install + génération).
> - Gate lint M3 branché sous oxlint (`jsPlugins`), scopé à `search/_components`.
> - `/search` refait : profondeur tonale, cartes + imagerie, motion, `dynamic-color`
>   (Material You autour du produit), boutons/CTA en `Md*`. Détails :
>   [search-redesign-plan](./search-redesign-plan.md).
>
> Conséquences sur ce plan : le risque MCU (§6) est **levé** (m3-tokens émet l'échelle
> complète) ; l'alias `--rpb-*` n'est PAS global mais **scopé** (cf. §3, piège ThemeRegistry).

Migration de `@rose-griffon/dashboard` (Next.js 16 App Router, RSC + SSR, MUI v9 +
Emotion) vers **Material Design 3** sur le web. Plan établi à partir de trois audits
read-only (inventaire, dimensionnement spec, mapping cible) croisés avec le corpus
`material-web/` (dont `migration/10-case-study-rpbey.md`, une étude déjà ciblée sur ce repo).

Documents liés : [inventaire](./mui-inventory.md) · [mapping composants](./component-mapping.md) ·
[tokens & thème](./theme-tokens.md).

> Périmètre : **`apps/web` uniquement**. `apps/bot` rend en Skia (zéro MUI),
> `apps/gacha-server` est Colyseus (pas d'UI). Le bot/gacha ne sont pas concernés.

## 1. Constat (dimensionnement)

| Métrique | Valeur | Source |
| --- | --- | --- |
| Fichiers important `@mui/*` | **244** (~44 % du code) | inventaire |
| Références `@mui/*` totales | **886–901** | inventaire + audit |
| `sx={{}}` | **3 383** sur 235 fichiers | audit |
| Couleurs hex/rgb hardcodées (hors `var(--…,#fb)`) | **~1 574** lignes | audit |
| `font-weight` hors 400/500 | **1 019** | audit |
| `@mui/icons-material` | 203 imports / 128 fichiers | audit |
| `@mui/x-data-grid` | 6 fichiers / 7 grilles | inventaire |
| `@mui/x-charts` | 14 fichiers / 12 graphiques | inventaire |
| `@mui/x-date-pickers` | 2 fichiers | inventaire |
| Fichiers animés sans garde `prefers-reduced-motion` | 44 / 49 | audit |
| `styled()` / `@emotion` direct | 2 / 0 | inventaire + audit |

**Le mur, c'est le modèle de style (`sx`), pas la couverture composant.** Les trois
coûts dominants sont, dans l'ordre : retrait des `sx` (3 383), remplacement `@mui/*`
(886 / 245 fichiers), tokenisation des couleurs (~1 574 lignes, seedées surtout par
`lib/theme.ts` + `lib/og/theme.ts`).

## 2. Le repo a déjà les deux moitiés de la cible

1. **Pattern MUI-free prouvé en prod** : `src/app/(marketing)/search/_components/`
   (7 fichiers, **0 `@mui`**) = React + **CSS Modules** + rôles `--rpb-*` + framer-motion.
   C'est le véhicule de rendu cible, déjà éprouvé (recode `/search` de cette session).
2. **Thème M3 reconstruit à la main** : `src/lib/theme.ts` (412 lignes) recrée déjà
   l'échelle M3 par-dessus MUI — surfaces `lowest/low/main/high/highest`,
   `container`/`onContainer`, variantes Card `filled/elevated/outlined`, `borderRadius:12`,
   boutons pill, axes variables `opsz/wght/wdth`. C'est littéralement le jeu de tokens M3,
   à promouvoir en `--md-sys-*` canoniques.

> Correctif d'audit : `comparateur/_components` n'est **pas** MUI-free (20 imports +
> `DataGrid` dans 4 fichiers). Seul `/search` l'est. Il est compté dans la migration.

## 3. Décision de véhicule — hybride, mené par les CSS Modules

Détail et comparatif complet : [tokens & thème](./theme-tokens.md) §3. Synthèse :

1. **Tokens = source de vérité unique `--md-sys-*`.** Générer le CSS statique des ~47 rôles
   (fait : `apps/web/src/app/m3.css` via `@aphrody-code/m3-tokens`). C'est du **CSS pur** :
   SSR-safe, zéro coût shadow-DOM, remplace à terme `lib/theme.ts` + les schémas OKLCH. Les
   `--rpb-*` deviennent des **alias** des rôles M3 (rétro-compat des `*.module.css` existants).
   > **Piège vérifié (correction du plan initial).** Aliaser `--rpb-*` **globalement** sur
   > `:root{ --rpb-bg: var(--md-sys-color-surface); … }` **ne marche pas** tant que
   > `ThemeRegistry` injecte `--rpb-*` au runtime via `documentElement.style` (inline) : le
   > style inline sur `:root` **gagne** sur la règle de feuille. Deux issues : (a) **scoper**
   > l'alias sur un ancêtre plus proche que `:root` — un wrapper `.m3-search` par surface
   > migrée écrase les valeurs runtime *localement* sans toucher les ~40 fichiers qui lisent
   > `--rpb-*` (mécanisme retenu pour `/search`) ; (b) à la **vague 5**, faire injecter à
   > ThemeRegistry les rôles M3 (ou retirer l'injection) et basculer l'alias en global. Garder
   > `--rpb-primary`/`--rpb-secondary` non-aliasés = accents de marque (rouge/bleu) conservés.
2. **Véhicule de rendu par défaut = React + CSS Modules + rôles** (pattern `/search`).
   RSC/SSR-propre, déjà possédé, pas de mur shadow-DOM ni de taxe `'use client'`/FOUC sur
   235 fichiers. Porte le gros : layout, surfaces, cards, listes, typo, tout le `sx`.
3. **Wrappers `@aphrody-code/m3-react` (`Md*`) en ponctuel**, seulement là où la couche
   d'interaction est dure à refaire à la main et la valeur haute : contrôles de formulaire
   (`MdCheckbox/MdRadio/MdSwitch/MdSlider`, form-associated + ARIA), `MdDialog`/`MdMenu`
   (focus-trap + top-layer), `MdTextField`/`MdSelect`, et les gains **fork-only**
   (`MdTable`, snackbar, autocomplete, date/time pickers). Isolés en leaf `'use client'`.

> ~~`@aphrody-code/m3-react`, `@aphrody-code/m3-tokens` et `@lit/react` ne sont pas
> installés~~ → **installés (2026-05-30, @3.2.0)** dans `apps/web` via le scope GitHub
> Packages déjà câblé (bunfig `@aphrody-code` → npm.pkg.github.com). Décision tranchée :
> **install + génération CSS** (le CSS statique sert les rôles, `dynamic-color` le runtime,
> les `Md*` les leaves interactifs). `m3-motion` écarté (redondant avec `framer-motion`).

Décisions annexes :

- **Graphiques** : `recharts ^3.8.0` est **déjà installé** → consolider les 14 fichiers de
  charts sur **recharts** et **retirer `@mui/x-charts`** (doublon mort relevé par l'audit).
- **DataGrid** (6 fichiers) : grilles simples → table React + CSS (façon `/search`) ou
  `MdTable` fork ; garder `@mui/x-data-grid` seulement si une feature avancée le justifie
  (à trancher par grille en vague 4).
- **Icônes** (203) : PascalCase `@mui/icons-material` → Material Symbols (snake_case) ou
  SVG inline / `lucide` (déjà le choix de `/search`). Les 8 SVG de marque (`Icons.tsx`)
  restent custom.

## 4. Phasage en vagues

Ordre par effet de levier + risque croissant. Chaque vague est livrable et déployable seule.

| Vague | Contenu | Pourquoi d'abord |
| --- | --- | --- |
| **0 — Fondations** | Générer/câbler le CSS `--md-sys-*` (tokens) ; mapper `--rpb-*` → rôles M3 (alias rétro-compat) ; brancher le lint `@aphrody-code/eslint-plugin-m3` en gate oxlint (no-regression). **Zéro changement visuel.** | Débloque tout le reste sans risque UI. |
| **1 — Primitives** | `Box/Stack/Grid/Container/Typography/Paper` → utilitaires layout CSS Modules + classes typescale. ~1 075 instances, mécanique. | Plus gros volume, 1:1 trivial, pose les helpers partagés. |
| **2 — Composants simples (routes légères)** | `Button/IconButton/Card/Chip/Tooltip/Alert/List/Dialog/Menu` → CSS Modules ou `Md*` ponctuels. Routes basses d'abord : `profile`, `sign-in`, `parts`, `meta`. | Rode le pattern sur surfaces à faible risque. |
| **3 — Routes lourdes** | `rankings` (tables+charts), `comparateur` (DataGrid), `(admin)` (DataGrid+forms+charts), `anime`, `tournaments`, `tv`. | Cœur du `sx` et des hotspots. |
| **4 — MUI X** | `DataGrid` → table custom/`MdTable` ; `Charts` → recharts ; `DatePicker` → `MdDatePicker`/natif. | Sans équivalent M3 direct, traité isolément. |
| **5 — Démantèlement** | Retirer `ThemeRegistry` (provider MUI), `createTheme`, `lib/theme.ts` ; désinstaller `@mui/*` + Emotion. Gate final : `rg @mui = 0`. | Clôture, gain bundle (~653 Mo node_modules + runtime Emotion). |

Transverses (à chaque vague touchant la zone) : icônes PascalCase→Symbols/SVG ; gardes
`prefers-reduced-motion` (44 fichiers) ; touch targets ≥ 48 dp ; couleurs hardcodées →
rôles. Les couleurs des routes OG/satori (`app/api/**/card/route.tsx`) restent **littérales**
(rasterisées en PNG, non convertibles) — à exclure du gate couleur.

## 5. Gates de vérification (par PR/vague)

Issus des invariants prod du repo (cf. `apps/web/AGENTS.md`, CLAUDE.md) :

1. `bunx tsc --noEmit` = 0.
2. **`bun run build` (next build)** — OBLIGATOIRE : `tsc` ne voit pas la frontière
   server/client du bundler ; un client component important une façade server-only casse le
   bundle browser sans erreur de type. (Bun 1.3.14 peut crasher en SIGILL **au teardown**
   après « Compiled ✓ + static ✓ » — artefacts valides, exit 132 bénin.)
3. `bunx oxfmt --check` (un hook éditeur re-tabule après Edit → relancer `oxfmt` avant).
4. `rg "@mui/|@emotion/|sx=\{" <route migrée>` = **vide**.
5. `scripts/deploy-web.sh` (standalone n'inclut pas `public/`+`data/`) puis
   `systemctl restart rpbey-web.service` + smoke `200`.
6. Lint M3 (`@aphrody-code/eslint-plugin-m3`) sans nouvelle violation sur la zone.

## 6. Risques & inconnues

- **Shadow-DOM / SSR** si véhicule `Md*` : web components ne SSR pas (FOUC, `'use client'`,
  `:not(:defined){visibility:hidden}`). **Mitigé** en menant par les CSS Modules.
- ~~**Fidélité tokens** : `material-color-utilities@0.2.7` (vendoré) n'émet que ~29 rôles~~ →
  **levé.** `@aphrody-code/m3-tokens@3.2.0` (MCU 0.4.0) `schemeFromSeed()` émet l'échelle
  **complète** (~47 rôles : `surface-container-*`, `*-fixed`, `surface-tint`, `inverse-*`).
  Material Theme Builder n'est plus requis. `m3.css` est déjà rempli de cette source.
- **Composants fork-only** (`md-table`, charts, snackbar, autocomplete, Expressive) : **aucune
  release npm Google** — leur pérennité = celle de la fork aphrody, pas de Google.
- **Gap M3 Expressive web** : split button, button groups, FAB menu, docked toolbar, loading
  indicator existent **fork-only** ; le **shape morphing** n'a **aucun** équivalent web
  (Compose-only). `@material/web` upstream est en maintenance (zéro feature depuis 06-2024).
- **DataGrid** : parité de features (édition cellulaire, visibilité colonnes responsive) à
  valider grille par grille avant de quitter `@mui/x`.

## 7. Effort (ordre de grandeur)

~70 % mécanique (codemod-able : retrait `sx`, substitution tokens couleur, renommage icônes,
normalisation `font-weight`), ~30 % manuel (DataGrid, charts, dialogs/menus, touch targets,
gardes reduced-motion). Le pilote `/search` (déjà MUI-free) sert de gabarit par route.
Estimation par lots de routes plutôt qu'en big-bang : 244 fichiers × ~3,7 refs ≈ 900 points
de migration, répartis sur les vagues 1→5.
