---
title: "Stratégie tokens, thème, typo & motion (MUI → M3)"
description: "Mapping palette/typo/forme MUI → tokens M3 (--md-sys-*), dynamic color HCT, comparatif des véhicules web, échelle typographique et tokens de motion."
scope:
  - apps/web
status: "draft"
last_updated: "2026-05-29"
related_symbols:
  - createTheme
  - muiThemeToTokens
---

# Stratégie tokens, thème, typo & motion (MUI → M3)

Moitié « cible » de la [migration M3](./migration-plan.md). Sources :
`material-web/migration/02-theme-token-migration.md`, `docs/02-tokens-theming-web.md`,
`docs/design/aphrody-m3-tokens.md`, `docs/design/m3-motion.md`.

## 1. Le problème de fond

MUI v9 = palette d'**intentions Material 2** (`primary/secondary/error/warning/info/success`
× `main/light/dark/contrastText` + `background/text/divider/action`), choisie à la main.
M3 = **schéma génératif** : ~47–50 rôles dérivés algorithmiquement d'un seul seed **HCT**
(Hue/Chroma/Tone). **La plupart des rôles M3 n'ont pas de source MUI.** Stratégie :
(1) mapper l'existant des deux côtés ; (2) **générer** les rôles manquants via
`material-color-utilities` depuis `palette.primary.main` ; (3) ré-imposer les couleurs MUI
explicites ; (4) documenter les pertes.

## 2. Mapping couleur (la part directe)

| MUI | → `--md-sys-color-*` | Type |
| --- | --- | --- |
| `primary.main` / `.contrastText` | `primary` / `on-primary` | direct |
| `secondary.main` / `.contrastText` | `secondary` / `on-secondary` | direct |
| `error.main` / `.contrastText` | `error` / `on-error` | direct |
| `background.default` | `background` + `surface` | direct |
| `background.paper` | `surface-container` | approx |
| `text.primary` | `on-background` + `on-surface` | direct |
| `text.secondary` | `on-surface-variant` | approx |
| `divider` | `outline-variant` | direct |
| *(aucune)* | `tertiary*`, tous `*-container`, `surface-variant`, `outline`, `inverse-*`, `scrim`, `shadow` | **généré MCU** |

L'échelle `--rpb-surface-lowest/low/main/high/highest` (déjà dans `lib/theme.ts`) mappe
proprement sur les 5 niveaux `--md-sys-color-surface-container-*`. Les `--rpb-*` deviennent
des **alias** des rôles M3 → les `*.module.css` existants (search/comparateur) continuent
de fonctionner sans réécriture.

### Schéma dark canonique (réutilisable)

rpbey est dark-first. Valeurs dark canoniques (Material Theme Builder `SchemeTonalSpot`,
`docs/design/aphrody-m3-tokens.md`) — la **structure** (échelle `surface-container`, paires
`container`/`on-container`) est réutilisable telle quelle, **en changeant le seed** vers la
teinte de marque rpbey :

```css
:root {
  --md-sys-color-primary: #ffb4a6;
  --md-sys-color-on-primary: #561e14;
  --md-sys-color-primary-container: #733428;
  --md-sys-color-on-primary-container: #ffdad3;
  --md-sys-color-secondary: #e7bdb5;
  --md-sys-color-tertiary: #dcc48c;
  --md-sys-color-error: #ffb4ab;
  --md-sys-color-surface: #1a1110;      /* + background */
  --md-sys-color-on-surface: #f1dfdb;
  --md-sys-color-surface-container-lowest: #140c0b;
  --md-sys-color-surface-container-low: #231918;
  --md-sys-color-surface-container: #271d1c;
  --md-sys-color-surface-container-high: #322826;
  --md-sys-color-surface-container-highest: #3d3230;
  --md-sys-color-outline: #a08c89;
  --md-sys-color-outline-variant: #534340;
}
```

## 3. Comparatif des véhicules web

| Critère | (a) `@aphrody-code/m3-react` + `m3-tokens` | (b) React + CSS Modules + `--rpb-*` (prouvé /search) |
| --- | --- | --- |
| Fidélité M3 | **maximale** (vrais `md-*`, tokens canoniques, ripple/state/elevation intégrés, 47 rôles) | approximation visuelle (surfaces/states/ripple refaits main) |
| SSR / Next 16 | **lourde** : WC ne SSR pas → `'use client'` partout, imports client-only, anti-FOUC `:not(:defined)`, `select.value` SSR | **propre** : React+CSS rendu serveur, hydratation sans FOUC, RSC-friendly |
| Shadow-DOM | **coût réel** : Tailwind/`sx`/CSS externe ne franchissent pas la frontière → tokens-only ; 3 383 `sx` sans équivalent in-shadow | **pas de frontière** : tout le CSS atteint le markup |
| Bundle | Lit tree-shakable ; **élimine Emotion + ~653 Mo `@mui`** | plus petit (ni Lit ni Emotion, CSS compile-time) |
| Effort | codemod-able (~70 % méca) mais **3 deps à installer** (`@lit/react`, `m3-react`, `m3-tokens`) | pattern déjà possédé ; chaque composant fait main (pas de levier codemod composant) |
| Risque maintenance | **scindé** : `md-*` stable sur MWC (maintenance) ; tout le reste fork-only, **pas de release Google** | **zéro** dépendance externe |

**Recommandation : hybride mené par (b), empruntant les tokens de (a).**

1. **Tokens `--md-sys-*` = source unique** via `theme-to-tokens.ts`
   (`muiThemeToTokens(light, {darkTheme})`, bun) → CSS statique (`:root{}` +
   `@media (prefers-color-scheme:dark)` ou `[data-theme='dark']`). SSR-safe, zéro FOUC, pas
   de `ThemeProvider`. Remplace `lib/theme.ts` + les schémas OKLCH.
2. **Véhicule par défaut = (b)** pour layout/surfaces/cards/listes/typo et tout le `sx`.
3. **Wrappers `Md*` (a) ponctuels** : contrôles de formulaire (`MdCheckbox/Radio/Switch/Slider`),
   `MdDialog`/`MdMenu` (focus-trap + top-layer), `MdTextField`/`MdSelect`, gains fork-only
   (`MdTable`, snackbar, autocomplete, pickers). Isolés en leaf `'use client'`.

## 4. Dynamic color (seed HCT) vs les schémas hardcodés

M3 dérive light ET dark d'un seul seed via `material-color-utilities` :
`themeFromSourceColor(argbFromHex(seed))` → `theme.schemes.light/.dark.toJSON()`. Chaque
« thème » (red/blue/…) devient **un seed**, régénérant tous les rôles au build — remplace les
palettes écrites à la main.

**Caveat fidélité :** MCU `0.2.7` (version vendorée) n'émet que **~29 rôles** — **pas** les
surfaces tonales `surface-bright/-dim/-container-low/-lowest/-high/-highest`, `*-fixed`,
`surface-tint`, exactement celles dont rpbey a besoin. Options : (a) **Material Theme
Builder** (pleine fidélité, recommandé pour le thème canonique) ; (b) accepter les fallbacks
internes `md-*`. Vérifier la version MCU à la migration.

## 5. Typographie

MUI 13 variants → 15 typescales M3 : `h1..h6`→`display-large..headline-small`,
`subtitle1/2`→`title-medium/small`, `body1/2`→`body-large/medium`, `button`→`label-large`,
`caption`→`body-small`, `overline`→`label-small`. Token =
`--md-sys-typescale-<scale>-<size>-<property>`.

Échelle canonique (size·line-height @weight) : Display L/M/S 57·64 / 45·52 / 36·44 @400 ·
Headline L/M/S 32·40 / 28·36 / 24·32 @400 · Title L 22·28 @400, M 16·24 @500, S 14·20 @500 ·
Body L 16·24, M 14·20, S 12·16 @400 · Label L 14·20, M 12·16, S 11·16 @500.

Familles : **Google Sans / Google Sans Flex** (display/headline/title, brand) ·
**Google Sans Text** ou Roboto (body/label) · **Google Sans Code** ou Roboto Mono (code).
rpbey utilise déjà `fontVariationSettings opsz/wght/wdth` → mappe sur les axes Flex.

**Pièges :** M3 n'a pas de font-family globale (par token) ; `lineHeight` ratio MUI (1.5) →
**longueur** M3 (1.5×fontSize px), perte d'adaptivité. Les styles « emphasized » Expressive
ne sont pas dans l'échelle web stable.

## 6. Forme

`--md-sys-shape-corner-*` : none 0 / extra-small 4 / small 8 / medium 12 / large 16 /
extra-large 28 / full 9999. **Piège majeur** : MUI `shape.borderRadius` défaut 4 est une
**unité de base**, PAS `corner-medium` (12). Mapper par **ratio = `borderRadius/4`**.
rpbey `borderRadius:12` → ratio 3.0 (tous coins triplés) — à vérifier vs l'intention ; les
boutons pill (9999) → `corner-full`.

## 7. Motion

**Easings (cubic-bezier exacts) :** Standard `(0.2,0,0,1)` · Standard Decelerate `(0,0,0,1)`
· Standard Accelerate `(0.3,0,1,1)` · Emphasized Decelerate `(0.05,0.7,0.1,1)` · Emphasized
Accelerate `(0.3,0,0.8,0.15)` · Linear `(0,0,1,1)`.

**Caveat Emphasized (full) :** courbe à **deux segments** (Android/Flutter), **pas de
`cubic-bezier` CSS unique** → fallback **Standard** sur le web ; utiliser Emphasized
**Decelerate** (entrée) / **Accelerate** (sortie), qui ont des béziers valides.

**16 durées (ms) :** Short 50/100/150/200 · Medium 250/300/350/400 · Long 450/500/550/600 ·
Extra-long 700/800/900/1000.

**Transitions MUI → M3 :** `Fade`→opacity, medium2 (300)/standard · `Grow`→scale(.75→1)+opacity,
medium4 (400)/emphasized · `Zoom`→scale(0→1), medium2/emphasized · `Slide`→translate, long1
(450)/emphasized-decelerate (in) / -accelerate (out) · `Collapse`→`grid-template-rows:0fr→1fr`,
medium4/emphasized. Toujours `@media (prefers-reduced-motion: reduce){ transition:none }`.

**Patterns nommés** (chorégraphies CSS, pas des composants) : **fade-through** (opacity
out-puis-in, contenu non lié), **shared-axis** (translate X/Y/Z + fade, nav hiérarchique),
**container transform** (un élément se morphe en surface : FAB→sheet 400ms emphasized,
card→plein écran 500ms). **Springs / motion-physics = natif-only** (aucun token numérique
publié, concern Compose/SwiftUI).

> Le recode `/search` de cette session applique déjà ces tokens (fade-through 90/210ms,
> shared-axis panneau, easings enter/exit, `MotionConfig reducedMotion="user"`) — gabarit
> motion de référence.
