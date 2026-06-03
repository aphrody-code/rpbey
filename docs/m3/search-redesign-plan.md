---
title: "Refonte /search & /comparateur — Material 3 vivant et moderne"
description: "Diagnostic visuel (captures prod), écart vs M3, et plan d'exécution pour transformer la page search (gabarit MUI-free) et le comparateur d'un clone Google Search plat en une UI Material You / M3 Expressive : profondeur tonale, couleur générée, imagerie, motion chorégraphiée."
scope:
  - apps/web
status: "draft"
last_updated: "2026-06-02"
related_symbols:
  - SearchClient
  - SerpResults
  - KnowledgePanel
  - SerpTabs
  - SearchField
---

# Refonte /search & /comparateur — Material 3 vivant et moderne

Suite de [migration-plan](./migration-plan.md) et [theme-tokens](./theme-tokens.md).
Ce doc cible spécifiquement **l'expérience visuelle** de `/search` (déjà MUI-free, gabarit
de rendu) et du `/comparateur` : non pas « est-ce techniquement M3 » mais « est-ce que ça
**ressemble** à Material You, est-ce que c'est **vivant** et **moderne** ».

Base factuelle : 3 captures de `https://rpbey.fr/search` (desktop home, desktop SERP
`?q=dranzer`, mobile SERP) + lecture de la doc M3 du repo.

---

## 1. Diagnostic visuel (ce que montrent les captures)

L'UI actuelle est un **clone fidèle de Google Search**, pas une UI Material You. Sept
problèmes concrets, par ordre d'impact sur le ressenti « mort / daté » :

| # | Constat (capture) | Pourquoi ça fait « plat / Google, pas M3 » |
| --- | --- | --- |
| 1 | **Palette = gris Google** : fond `#202124`, surfaces `#303134/#3c4043`, liens **bleu Google** `#8ab4f8`, visité `#c58af9`, sparkle Gemini. Le rouge de marque n'apparaît QUE dans le rail + logo. | Zéro rôle `--md-sys-color-*`. Aucune identité tonale (pas de primary/secondary/tertiary container). M3 = couleur **générée d'un seed**, présente partout ; ici la couleur est absente du contenu. |
| 2 | **Aucune profondeur** : tout est quasi-noir uniforme. Lignes de résultat séparées par un simple hairline. Knowledge panel = boîte sombre plate. | M3 structure l'espace par **surfaces tonales** (`surface-container-low → highest`) + elevation. Ici 1 seul niveau → l'œil n'a aucun relief, ça paraît éteint. |
| 3 | **Liste mono-rythme** : chaque ligne = pastille-icône + titre bleu + meta grise + chip rouge. **Aucune image** alors que les Beys/parts ONT des visuels (visibles dans le knowledge panel). | Densité Google sans la hiérarchie M3. Pas de thumbnail = pas d'accroche, scan difficile, « catalogue mort ». |
| 4 | **Typo générique** : titres tous même poids/taille, pas de rythme display/headline/title/body/label. | Pas de typescale M3. Rien ne « respire », pas de point focal. |
| 5 | **Rail = bande d'icônes fine** (style app-launcher Google), état actif = simple teinte rouge. | Pas une **NavigationRail M3** (80–96 px, label sous l'icône, **pilule d'indicateur actif** `secondary-container`). |
| 6 | **Motion minimal** : seulement fade-through (90/210 ms) au changement d'état. Pas de transition sur changement d'onglet, pas de morph résultat→détail. | M3 Expressive = chorégraphie (shared-axis, container-transform, stagger, spring). Statique = daté. |
| 7 | **Knowledge panel** : prix `0.00 €` (bug), bouton rouge pleine largeur « Comparer 7 offres » dur, pas de forme/elevation M3. Mobile : toast Discord recouvre le contenu. | Le seul bloc « riche » de la page est lui-même plat et buggé. |

**Le seul élément vivant aujourd'hui** : la pilule « Mode IA » à dégradé Gemini. C'est le
ton à généraliser, pas l'exception.

---

## 2. Principe directeur

> Ne pas « ajouter des animations » sur un fond plat. **Rendre l'espace lisible
> (profondeur tonale) + colorer le contenu (rôles M3 générés) + montrer les produits
> (imagerie)**, ET ALORS la motion a quelque chose à animer.

Quatre leviers, dans l'ordre où ils produisent du « vivant » :

1. **Profondeur** — empiler 3–4 niveaux de `surface-container-*` (rail / page / résultats /
   panneau) au lieu d'un seul noir.
2. **Couleur générée** — passer les `--rpb-*` en **alias des rôles `--md-sys-color-*`**
   dérivés du seed rouge RPB (HCT), et **teinter le contenu** : tiers, chips, liens,
   accents = rôles `primary/secondary/tertiary` + `*-container`, plus le bleu Google.
3. **Imagerie + hiérarchie** — thumbnail produit dans chaque résultat Bey/part, typescale
   M3, cartes M3 Expressive (coins `large`/`extra-large`).
4. **Motion chorégraphiée** — shared-axis (onglets), container-transform (résultat→détail /
   → knowledge panel), stagger d'apparition, spring sur les interactions, le tout gardé
   `prefers-reduced-motion`.

---

## 3. Fondations tokens (vague 0 — pré-requis, zéro changement de structure)

Aligné sur [theme-tokens](./theme-tokens.md) §2-3.

1. **Générer le CSS `--md-sys-color-*`** depuis le seed rouge RPB via
   `material-web/migration/scripts/theme-to-tokens.ts` (ou Material Theme Builder pour la
   pleine échelle `surface-container-*`). Dark-first. Émet `:root` + `[data-theme]`.
2. **Réécrire `search/_components/tokens.ts`** pour que chaque `--rpb-*` devienne un **alias**
   d'un rôle M3 (rétro-compat : aucun `.module.css` à toucher en vague 0) :

   ```ts
   // AVANT (Google-derived)            // APRÈS (alias rôle M3)
   BG:          "var(--rpb-bg,#202124)"        → "var(--md-sys-color-surface)"
   BG_DEEP:     "#161719"                       → "var(--md-sys-color-surface-container-lowest)"
   SURFACE:     "var(--rpb-surface-main,#303134)"→ "var(--md-sys-color-surface-container)"
   SURFACE_HOVER:"var(--rpb-surface-high,#3c4043)"→"var(--md-sys-color-surface-container-high)"
   BORDER:      "#3c4043"                        → "var(--md-sys-color-outline-variant)"
   TEXT_PRIMARY:"var(--rpb-text,#e8eaed)"        → "var(--md-sys-color-on-surface)"
   TEXT_SECONDARY:"#bdc1c6"                       → "var(--md-sys-color-on-surface-variant)"
   ACCENT:      "var(--rpb-primary)"             → "var(--md-sys-color-primary)"
   PRICE_GOOD:  "#22c55e"                         → "var(--md-sys-color-tertiary)" (vert tertiaire dédié)
   LINK_BLUE:   "#8ab4f8"   → conserver OU "var(--md-sys-color-primary)" (cf. §4.3)
   ```
3. **Tokens runtime exposés** : importer `@aphrody-code/m3-tokens/m3-tokens.css` (62 vars :
   typescale/shape/elevation/motion) pour avoir le typescale + les coins + les easings en CSS
   runtime, pas juste les couleurs.
4. **Gate** : brancher `@aphrody-code/eslint-plugin-m3` (oxlint) — `m3/no-hardcoded-color`,
   `m3/valid-color-role` — sur `apps/web` pour empêcher la réintroduction de hex.

Résultat vague 0 : **aucun changement visuel**, mais la page consomme désormais le vrai
système. Tout le reste du plan ne touche que des `.module.css`.

---

## 4. Refonte surface par surface (`/search`)

### 4.1 Barre de recherche (`SearchField.module.css`)
- Forme **`corner-full`** (déjà pill) mais surface = `surface-container-high`, bordure
  `outline-variant`, **elevation level 1** au repos → **level 3 + halo `primary`** au focus
  (transition `standard` 200 ms). C'est le geste « le champ s'éveille ».
- Dropdown suggestions : surface `surface-container`, coins `corner-large` (16 px),
  elevation 2, lignes en `body-large`, item survolé = `surface-container-highest` +
  state-layer `on-surface 8%`.
- Pilule « Mode IA » : garder le dégradé Gemini (signature), mais l'aligner sur un coin
  `corner-full` et un state-layer au survol.
- **Home state** : agrandir le logo (motion-physics léger : flotte/scale spring au mount),
  champ centré en `corner-extra-large`, 2 boutons → **boutons M3** (`Rechercher` = filled
  `primary`, `J'ai de la chance` = tonal `secondary-container`). Aujourd'hui ce sont 2
  rectangles gris ternes.

### 4.2 Onglets (`SerpTabs.module.css`)
- Vrais **Primary Tabs M3** : label `title-small`, **indicateur actif = barre `primary`
  3 dp coin haut arrondi**, état actif texte `primary`, inactif `on-surface-variant`.
- Compteurs (`Beys (27)`) en chip `label-small` `secondary-container`.
- **Motion shared-axis X** au changement d'onglet : le contenu sortant translate -X + fade
  out (accelerate), l'entrant +X + fade in (decelerate), 300 ms. Remplace le fade-through
  actuel → donne le sens « on navigue latéralement entre catégories ».
- Badge IA : sparkle dégradé conservé.

### 4.3 Résultats (`SerpResults.module.css`) — le cœur du « vivant »
- **Carte par résultat** (pas une ligne nue) : surface `surface-container-low`, coins
  `corner-large` (16 px), padding 16, gap 12 ; survol → `surface-container` + elevation 1 +
  **state-layer** ; sélection → bordure `primary` 1 dp + `primary-container` 8 %.
- **Thumbnail produit** 56×56 `corner-medium` à gauche pour Bey/part/combo (les images
  existent, cf. knowledge panel). Fallback = pastille tonale par type (BLADE/RATCHET/BIT)
  colorée en `*-container`. **C'est le plus gros gain de « vie »** : la page passe de mur de
  texte à catalogue visuel.
- **Hiérarchie typescale** : titre `title-medium` (couleur : voir ci-dessous), méta
  `body-medium` `on-surface-variant`, badge en chip.
- **Liens** : trancher l'identité. Option A (recommandée, plus M3/marque) : titre en
  `on-surface`, accent `primary` (rouge RPB) au survol → on quitte le bleu Google, l'UI
  devient « RPB » et non « Google ». Option B (familiarité search) : garder le bleu mais le
  promouvoir en rôle `--md-sys-color-primary` du thème « bleu tournoi ». **Choix : A** pour
  identité, B reste dispo via le thème bleu.
- **Tiers (S/A/B/C)** : aujourd'hui hex hardcodés (rouge/pourpre/bleu/gris). → chips
  `corner-full` `label-large` mappés sur `error-container` (S), `tertiary-container` (A),
  `primary-container` (B), `surface-container-highest` (C) — cohérents avec le thème.
- **Grille images** (catégories image) : vraies cartes M3 `corner-large`, ratio constant,
  **stagger d'apparition** (`animationDelay idx*30ms` déjà là → garder, passer en spring).
- **Skeleton** : remplacer le shimmer linéaire par des cartes squelette aux mêmes coins
  `corner-large`, pulse `surface-container` ↔ `surface-container-high` (cohérent au lieu
  d'un shimmer générique).

### 4.4 Knowledge panel (`KnowledgePanel.module.css`)
- Carte **`corner-extra-large`** (28 px), surface `surface-container`, elevation 2 ; image
  héro en `corner-large` ; titre `headline-small` ; specs en liste `body-medium`.
- Prix : `title-large` `tertiary` (corriger le bug `0.00 €`). Économie en chip
  `tertiary-container`.
- Bouton « Comparer N offres » : **filled M3** `primary` `corner-full`, **ripple + state**
  (via `MdFilledButton` ou state-layer CSS) ; au clic → **container-transform** vers
  `/comparateur` (la carte se morphe en page comparateur, 500 ms emphasized).
- **Entrée** : shared-axis Y / container-transform depuis le résultat cliqué, pas une
  simple apparition.

### 4.5 NavigationRail (rail latéral desktop)
- Passer le rail de « bande d'icônes » à **NavigationRail M3** : 80–96 px, icône + **label
  `label-medium` dessous**, **pilule d'indicateur actif** `secondary-container`
  `corner-full` derrière l'item courant (le `md-navigation-rail` du monorepo a déjà 96 px /
  target 64 px). Survol = state-layer. Le FAB « flamme » en haut = vrai **FAB M3**
  (`primary-container`, elevation 3).
- Mobile : bottom nav → **NavigationBar M3** (indicateur pilule actif, `label-medium`).

### 4.6 Mobile (capture mobile SERP)
- Cartes pleine largeur `corner-large`, thumbnails, **touch targets ≥ 48 dp**.
- Header sticky : `surface-container` + elevation à l'amorce du scroll (pas bordure fixe).
- Toast Discord : ne plus recouvrir le contenu → l'ancrer au-dessus de la bottom-nav avec
  marge, ou le passer en **snackbar M3** dismissible.

---

## 5. Motion — « vivant et moderne » (M3 Expressive)

Tokens : easings + durées de [theme-tokens](./theme-tokens.md) §7. Tout sous
`MotionConfig reducedMotion="user"` (déjà en place dans `SearchClient`).

| Geste | Pattern M3 | Easing / durée |
| --- | --- | --- |
| Home → SERP | shared-axis Y + fade-through | emphasized-decel in / accel out, 300/90 |
| Changement d'onglet | **shared-axis X** | enter `(0.05,0.7,0.1,1)` / exit `(0.3,0,0.8,0.15)`, 300 |
| Apparition résultats | stagger + spring léger | `idx*30ms`, spring (raideur douce) |
| Survol carte résultat | elevation + state-layer | standard, 150 |
| Résultat → knowledge panel / → comparateur | **container-transform** | emphasized, 400–500 |
| Focus champ recherche | scale halo `primary` | standard, 200 |
| Logo home | motion-physics (float/scale) | spring mount |
| Skeleton | pulse tonal | linear, 1000 boucle |

`@aphrody-code/m3-motion@3.2.0` fournit `spring-interpolation` (spring→CSS/WAAPI) et les
patterns shared-axis — utiliser plutôt que de réécrire les béziers à la main.

---

## 6. Modernité « 2026 » (M3 Expressive) — les touches qui datent vs rajeunissent

- **Coins plus généreux** : cartes `large`/`extra-large`, knowledge panel `extra-large`
  (28). Les coins serrés de Google = M2/daté ; M3 Expressive = coins amples.
- **Shape morphing** sur l'indicateur d'onglet / FAB au press (le monorepo a les coins
  `*-increased` Expressive : `_md-sys-shape-expressive.scss`). Web = limité (pas de morph
  Compose), mais coin animé OK.
- **State-layers partout** (hover/focus/press) — c'est ce qui fait « réactif/vivant » vs la
  page actuelle sans feedback.
- **Couleur tonale sur le contenu** (chips `*-container`, accents) — sortir du noir+bleu.
- **Imagerie produit** — la modernité d'un moteur de recherche produit en 2026 = visuel,
  pas liste texte.
- **Dynamic color optionnel** : `applyDynamicColor(seed)` depuis la couleur dominante du
  Bey affiché dans le knowledge panel → la page se reteinte autour du produit (effet
  « Material You » signature, fort « waouh », faible coût via `@aphrody-code/m3-tokens`).

---

## 7. Phasage (livrable par lot, sans big-bang)

| Lot | Contenu | Gate |
| --- | --- | --- |
| **S0 — Tokens** | §3 : générer `--md-sys-*`, aliaser `tokens.ts`, importer `m3-tokens.css`, lint M3. **Zéro diff visuel.** | build next OK, lint M3 0 violation, diff visuel nul |
| **S1 — Profondeur + couleur** | Appliquer surfaces tonales (rail/page/résultats/panel) + teinter chips/tiers/accents (§4.1-4.4 couleur+surface, hors imagerie). | captures avant/après, contraste AA |
| **S2 — Cartes + imagerie + typescale** | Résultats en cartes M3 + thumbnails + typescale (§4.3), knowledge panel `extra-large` (§4.4), fix prix `0.00 €`. | scan visuel, LCP image ≤ budget |
| **S3 — Navigation** | NavigationRail M3 + FAB + NavigationBar mobile (§4.5) ; touch targets 48 dp. | a11y targets, capture |
| **S4 — Motion** | shared-axis onglets, container-transform résultat→panel→comparateur, springs, skeleton tonal (§5). | `prefers-reduced-motion` respecté partout |
| **S5 — Expressive** | coins Expressive, shape press, dynamic-color autour du produit (§6). | capture finale |

Une fois `/search` validé comme **gabarit M3 vivant**, le **comparateur** (vague 3 du
[migration-plan](./migration-plan.md)) le rejoue : les 4 DataGrid → cartes/`MdTable`
tonales, DetailPane → container-transform (déjà un `motion.div`), FilterBar/Tabs/Chips →
mêmes composants M3, suppression du `sx` et des 244 refs `@mui`.

---

## 8. Vérification (par lot)

Gates [migration-plan](./migration-plan.md) §5, plus pour cette refonte visuelle :
1. `bunx tsc --noEmit` = 0 ; `bun run build` (next) OK.
2. `rg "@mui/|@emotion/|sx=\{|#[0-9a-fA-F]{6}" search/_components` = vide (sauf SVG marque).
3. Lint `@aphrody-code/eslint-plugin-m3` : 0 nouvelle violation `no-hardcoded-color` /
   `valid-color-role`.
4. **Captures avant/après** par lot (`google-chrome --headless --screenshot`, 3 viewports :
   desktop home, desktop SERP, mobile SERP) — preuve visuelle du « plus vivant ».
5. Contraste AA sur texte (`on-surface`/`on-surface-variant` sur leurs surfaces).
6. `prefers-reduced-motion: reduce` → toutes les transitions neutralisées.
7. Smoke `200` post-`deploy-web.sh` + `systemctl restart rpbey-web.service`.
