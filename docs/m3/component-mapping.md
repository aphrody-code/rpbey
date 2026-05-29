---
title: "Mapping composants MUI → Material Design 3 (web)"
description: "Table de correspondance MUI v9 → composants M3 (md-* @material/web + Md* @aphrody-code/m3-react), disponibilité web, gaps et composants sans équivalent."
scope:
  - apps/web
status: "draft"
last_updated: "2026-05-29"
---

# Mapping composants MUI → Material Design 3 (web)

Correspondance pour la [migration M3](./migration-plan.md). Sources : corpus
`material-web/migration/01-component-mapping.md`, `05-gap-analysis.md`,
`docs/03-material-web-google.md`, `docs/material-web/APHRODY-M3.md`.

**Légende disponibilité :** `stable` = MWC stable upstream · `labs` = preview upstream
promue par la fork · `fork` = ajout aphrody (pas de release npm Google) · `shim` = aucun
élément M3, construire un shim Lit/React · `platform` = feature plateforme web ·
`Tailwind/div` = layout, pas de composant.

> Note maintenance : `@material/web` upstream est en **maintenance** (zéro feature depuis
> 06-2024). Les familles intéressantes (table, charts, autocomplete, snackbar, app-bars,
> Expressive) sont **fork-only** dans ce monorepo — pérennité = celle de la fork aphrody.

## Table de correspondance

| MUI | `md-*` (@material/web) | `Md*` (@aphrody-code/m3-react) | Dispo | Notes / gap |
| --- | --- | --- | --- | --- |
| Button (contained/outlined/text) | `md-filled/outlined/text-button` (+ elevated, filled-tonal) | `MdFilledButton`… | stable | label slotté (children) ; `color`→tokens, `loading`→compose `md-circular-progress` |
| ButtonGroup | `md-button-group` | `MdButtonGroup` | fork | sémantique ≠ MUI |
| (split button) | `md-split-button` | `MdSplitButton` | fork | **Expressive — absent MWC** |
| ToggleButton(Group) | `md-outlined-segmented-button(-set)` | `MdOutlinedSegmentedButton(Set)` | labs | `exclusive`→`multiselect=false` |
| IconButton | `md-icon-button` (+ filled/tonal/outlined) | `MdIconButton`… | stable | `toggle`+`selected` bonus ; icône = children `md-icon` |
| Fab | `md-fab` / `md-branded-fab` | `MdFab` / `MdBrandedFab` | stable | `color`→`variant` |
| SpeedDial | `md-fab-menu` (+ `-item`) | `MdFabMenu` | fork | **Expressive — absent MWC** |
| TextField / OutlinedInput | `md-filled/outlined-text-field` | `MdFilledTextField`… | stable | `label`/`supportingText`/`error` = props ; `standard`→pas d'équiv ; lire `e.target.value` |
| Select / NativeSelect | `md-filled/outlined-select` (+ option) | `MdFilledSelect`… | stable | SSR : `selected`+`displayText` ; `multiple`→**GAP** |
| Autocomplete | `md-autocomplete` | `MdAutocomplete` | fork | data-driven `options[]` ; `multiple`/`freeSolo`/`renderOption`→**GAP** |
| Menu / MenuItem | `md-menu` / `md-menu-item` (+ sub-menu, group) | `MdMenu`… | stable | `anchorEl`→`anchor` (id) ou `positioning="popover"` |
| Dialog | `md-dialog` | `MdDialog` | stable | Title/Content/Actions→`slot="headline/content/actions"` |
| Drawer / SwipeableDrawer | `md-navigation-drawer(-modal)` | `MdNavigationDrawer(Modal)` | labs | `open`→**`opened`** ; `anchor`→`pivot:start/end` (top/bottom non) ; pas de swipe |
| BottomSheet (Drawer bottom) | `md-bottom-sheet` | `MdBottomSheet` | fork | radius 28dp, drag-to-dismiss |
| Tabs / Tab | `md-tabs` + `md-primary/secondary-tab` | `MdTabs`… | stable | `value`→`activeTabIndex` (num) |
| Chip | `md-assist/filter/input/suggestion-chip` (+ chip-set) | `MdAssistChip`… | stable | 1 `Chip`→4 types par rôle ; toujours dans `md-chip-set` |
| Card | `md-elevated/filled/outlined-card` | `MdElevatedCard`… | labs (+fork `md-card`) | **pas de CardHeader/Content/Actions** → `<div>`+`md-divider`+boutons slottés |
| Tooltip | `md-tooltip` | `MdTooltip` | fork | cible via `for="id"`/`slot="trigger"` (ne wrappe pas l'enfant) ; `title`→`text` |
| Snackbar | `md-snackbar` | `MdSnackbar` | fork | Popover API ; `message`→`label-text`, `autoHideDuration`→`timeout-ms` |
| Alert / AlertTitle | — | `MdAlert` (codemod) | **shim** | **aucun Alert M3** → shim Lit (container tonal par sévérité + icône) |
| Switch | `md-switch` | `MdSwitch` | stable | **`checked`→`selected`** ; lire `e.target.selected` |
| Checkbox | `md-checkbox` | `MdCheckbox` | stable | lire `e.target.checked` |
| Radio / RadioGroup | `md-radio` | `MdRadio` | stable | **pas de RadioGroup** → grouper par `name` natif |
| Slider | `md-slider` | `MdSlider` | stable | `marks`→`ticks` ; range→`range`+`value-start/-end` |
| Badge | `md-badge` | `MdBadge` | labs | ne wrappe pas l'ancre → positionner soi-même ; `dot`→`value` vide |
| AppBar / Toolbar | `md-top/bottom-app-bar` / `md-toolbar` | `MdTopAppBar`… | fork | top: `small/medium/large/center` ; Toolbar souvent `<div>` |
| (docked toolbar) | `md-toolbar` (`docked`/`floating`) | `MdToolbar` | fork | **Expressive — absent MWC** |
| List / ListItem | `md-list` / `md-list-item` | `MdList` / `MdListItem` | stable | `primary/secondary`→`slot="headline/supporting-text"` |
| Table | `md-table` | `MdTable` | fork | **paradigme : `columns[]`/`rows[]` data-driven**, pas `<tr>/<td>` → réécriture cellules |
| DataGrid (`@mui/x`) | `md-table` (tri/filtre/pagination/CSV/i18n) | `MdTable` | fork | grilles simples migrables ; features lourdes → garder custom/`@mui/x` |
| Charts (`@mui/x-charts`) | `md-bar/pie/line/radar/scatter-chart` | (wrappers fork) | fork | **ou `recharts` déjà installé** → consolider dessus, retirer `@mui/x-charts` |
| Grid / Stack / Box / Container | — | — | Tailwind/div | aucun élément M3 ; `<div>` + flex/grid CSS |
| Paper | `<div>` surface + `md-elevation` | `MdSurface` (shim) | shim | `elevation` 0–24 → niveau M3 0–5 via `--md-elevation-level` |
| Typography | `md-type` | `MdType` | fork | `variant`→`scale` (`title-large`) ; ou classes `--md-sys-typescale-*` directes |
| Avatar / AvatarGroup | — | `MdAvatar` (shim) | shim | aucun Avatar M3 |
| CircularProgress / LinearProgress | `md-circular/linear-progress` (+ loading-indicator) | `MdCircularProgress`… | stable (+fork) | **`value` 0–100 → 0–1** ; `valueBuffer`→`buffer` |
| (loading indicator) | `md-loading-indicator` | `MdLoadingIndicator` | fork | **Expressive — absent MWC** |
| Pagination | `md-paginator` | `MdPaginator` | fork | modèle TablePagination (≠ pagination 1..N à pastilles) → **GAP partiel** |
| Breadcrumbs | — | `Breadcrumbs` (React) | shim | `<nav><ol>` + liens tokenisés |
| Skeleton | — | `MdSkeleton` (shim) | shim | CSS pur + tokens motion |
| Accordion | `md-accordion` + `md-expansion-panel` | `MdAccordion`… | fork | `AccordionSummary`→`slot="header"` |
| Modal / Popover / Popper | — | — | platform | Popover API + CSS Anchor Positioning ; ou `md-dialog`/`md-menu` |
| Collapse/Fade/Grow/Slide/Zoom | — | — | platform | transitions CSS + `--md-sys-motion-*` (cf. [tokens & thème](./theme-tokens.md) §4) |
| Stepper | `md-stepper` / `md-step` | `MdStepper` / `MdStep` | fork | `MobileStepper`→shim |
| DatePicker / TimePicker (`@mui/x`) | `md-date/time-picker` | `MdDatePicker` / `MdTimePicker` | fork | le 1 DatePicker migrable |
| (shape morphing) | — | — | **non-web-2026** | **Android/Compose-only** — aucun élément ni CSS |

## Gap M3 Expressive (web)

L'annonce M3 Expressive 2025 (Android/Wear OS) a introduit : **split button, button
groups, FAB menu, docked toolbar, loading indicator, shape morphing**. Sur le web canonique
(`@material/web`), **aucun n'a shippé**. Dans ce monorepo, la fork aphrody comble une partie
en éléments Lit **fork-only** (`md-split-button`, `md-button-group`, `md-fab-menu`,
`md-toolbar`, `md-loading-indicator`). Exception : le **shape morphing**, sans équivalent
fork ni CSS — reste Compose-only.

## Sans équivalent M3 (custom/shim obligatoire)

Confirmés absents des 93 vrais tags `md-*` : `Alert`/`AlertTitle`, `Avatar`/`AvatarGroup`,
`Rating`, `Skeleton`, `Backdrop`, `Breadcrumbs`, `Link`, `MobileStepper`, `Pagination` à
pastilles, `Modal`/`Popover`/`Popper`, toutes les transitions, `CssBaseline`/`GlobalStyles`,
et **tout le système de layout** (`Box`/`Stack`/`Grid`/`Container`/`Paper`) — intentionnel :
M3 n'a pas de composant grille, c'est `<div>` + CSS.

## Renommages de props critiques (pièges runtime)

`Switch` `checked`→**`selected`** · `Drawer`/`Dialog` `open`→**`opened`** · `Tabs`
`value`→**`activeTabIndex`** · `Tooltip`/`Snackbar` `title`/`message`→**`text`/`label-text`**
· progress `value` **0–100 → 0–1**. Lecture d'événements : `e.target.value`/`.checked`/
`.selected` (pas de 2ᵉ argument façon MUI).
