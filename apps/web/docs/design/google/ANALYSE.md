# Analyse design — captures Google (réf. comparateur RPB)

> Source : `apps/web/docs/design/google/` (sync Drive `1GQC0zkN1osJHahcak9rKooUQonb4jJO6`, commit `1cfd4ad`).
> But : décortiquer la grammaire visuelle de Google Search (dark mode + AI Mode) pour la transposer fidèlement au **comparateur Beyblade X** de RPB, en respectant la contrainte rpbey **« tout est algorithmique, aucun LLM »**.
> Palette extraite par échantillonnage ImageMagick (`-colors`, isolation des teintes) + recalage sur les tokens canoniques Google dark.

## Tokens dark extraits (consolidés)

| Rôle                     | Hex                                                  | Usage observé                                                         |
| ------------------------ | ---------------------------------------------------- | --------------------------------------------------------------------- |
| `bg` (fond page)         | `#1f2026` → `#202124`                                | fond global, gouttières                                               |
| `bg-deep`                | `#161719`                                            | bandeau header SERP (légèrement plus sombre)                          |
| `surface` (barre/­carte) | `#303134`                                            | barre de recherche, cartes Knowledge/sources                          |
| `surface-hover`          | `#3c4043`                                            | survol barre, chips, boutons header home                              |
| `border`                 | `#3c4043` / `#5f6368`                                | contour barre focus, séparateurs                                      |
| `text` primaire          | `#e8eaed` (`#f4f4f4` au logo)                        | titres, réponse IA                                                    |
| `text` secondaire        | `#bdc1c6` (`#c0c3cb`)                                | snippets, URL/breadcrumb, labels                                      |
| `text` tertiaire         | `#9aa0a6` (`#73767b`)                                | placeholder, méta discrète                                            |
| `link` (bleu dark)       | `#8ab4f8` (échant. `#3087fd`/`#1b60cd` aux contours) | titres de résultats, liens                                            |
| `link-visited`           | `#c58af9`                                            | liens visités                                                         |
| **gradient Gemini / AI** | `#4285f4` → `#9b72cb` → `#d96570`                    | icône « sparkle », contour/halo « AI Mode », chips de citation actifs |

> **Décision RPB** : on conserve la **structure** Google à l'identique (la grammaire), mais l'accent « AI » reprend `--rpb-primary`/`--rpb-secondary` (cohérence de marque) tout en gardant la facture du gradient « sparkle ». Les bleus de liens restent proches de `#8ab4f8` (lisibilité dark) ou virent `--rpb-primary` selon le thème actif (le comparateur est multi-thème via `ThemeRegistry`).

---

## 1. `google.png` — page d'accueil (état « repos »)

**Rôle** : point d'entrée vide, avant toute requête. C'est l'écran « hero » du comparateur.

### Anatomie (grille verticale centrée)

1. **Top bar** (coin haut-droit, le reste vide) : liens texte `Gmail` `Images`, icône **Labs** (fiole), **app grid** (9 points 3×3), **avatar** (cercle). Alignement à droite, ~64 px de hauteur, padding ~16-24 px.
2. **Wordmark** centré (`Google` blanc `#f4f4f4`), large (~92 px de hauteur de glyphe), à ~38 % de la hauteur visible.
3. **Barre de recherche** : pill très arrondie (`border-radius` ≈ 24-28 px, hauteur ~46-52 px), largeur max ~584 px (desktop), fond `#303134`. Contenu :
   - gauche : icône **`+`** (ajout de contexte/sources — nouveau pattern AI),
   - centre : zone de saisie vide (placeholder absent ici),
   - droite : icône **micro** (couleur Google multicolore), icône **lens** (caméra), puis **pilule « AI Mode »** (icône sparkle + label), légèrement surélevée, fond translucide clair.
4. **Boutons** sous la barre : `Google Search` et `I'm Feeling Lucky` — surfaces `#3c4043`, coins arrondis 4 px, texte `#e8eaed`, padding ~9×16.
5. **Ligne de langue** : `Google offered in: Français` (lien bleu).

### Transposition RPB

- Wordmark → **logo/wordmark RPB** ou « Comparateur Beyblade X » stylé.
- `+` → **ajout de filtres/contexte** (région, type de pièce, budget) — chip-launcher.
- micro → recherche vocale (Web Speech API, optionnel) ; lens → **recherche par image** (scan d'une toupie — futur).
- « AI Mode » → bascule vers la **réponse synthétisée algorithmique** (cf. §4).
- boutons → `Rechercher` + `J'ai de la chance` (= ouvre directement la meilleure reco du moment, réutilise `getRecommendations()` top-1).

---

## 2. `ai_mode.png` — accueil AI Mode + autocomplétion

**Rôle** : entrée dédiée « AI Mode », avec **rail latéral gauche** et **dropdown de suggestions** pendant la frappe.

### Anatomie

1. **Rail gauche** (~112 px) : **G** coloré en haut, puis pile d'icônes — **liste+sparkle** (historique/découvrir), **compose/edit** (nouvelle conversation). Vertical, centré, espacé ~80 px.
2. **Greeting** centré : `Hi, Yohan. What's on your mind?` — titre ~44-52 px, `#e8eaed` (personnalisé au prénom).
3. **Barre de prompt** (plus large que l'accueil classique, ~760 px) : `+` à gauche, texte saisi `beyblade x` (curseur visible), **`✕` clear**, pilule **« AI Mode → »** (flèche = soumettre).
4. **Dropdown autocomplétion** (attaché sous la barre, même largeur, fond `#303134`, coins bas arrondis) : 5 lignes, chacune **icône sparkle** (suggestion générée) + texte (`beyblade x stadium`, `… anime`, `… launcher`, `… hurricane enlil`, `… shark scale`). Hauteur de ligne ~52 px, hover = surface plus claire.
5. **Footer dropdown** : `Report inappropriate predictions` + `Learn more` (lien bleu), aligné droite.

### Détails d'interaction

- L'icône **sparkle** devant chaque suggestion signale une **prédiction générée** (vs loupe = historique). Pour RPB : sparkle = suggestion issue de l'index (pièces/produits/lexique), loupe = recherche récente locale.
- La pilule passe de `AI Mode` (repos) à `AI Mode →` (prête à soumettre) dès qu'il y a du texte.

### Transposition RPB

- Greeting : `Salut {prénom}. Quelle pièce cherches-tu ?` (ou neutre si déconnecté).
- Suggestions : top-N de l'**index de recherche** (`/api/v1/search` → `GlobalSearchItem`) filtré par préfixe, **groupé/priorisé** produit > pièce > lexique. Icône sparkle pour les complétions sémantiques, loupe pour l'historique `localStorage`.
- Rail gauche : `Historique` + `Nouvelle recherche` (réinitialise l'état).

---

## 3. `search.png` — page de résultats classique (SERP)

**Rôle** : le cœur fonctionnel — liste de résultats organiques + **panneau de connaissance** (Knowledge Panel). C'est la vue « Tous ».

### Anatomie (2 colonnes)

1. **Header SERP** (fond `#161719`, sticky) : logo Google compact (coloré) à gauche, **barre de recherche remplie** (`beyblade x` + `✕` + micro + lens + loupe), avatar à droite.
2. **Barre d'onglets** sous le header : `Mode IA` · **`Tous`** (actif, soulignement) · `Images` · `Shopping` · `Vidéos` · `Vidéos courtes` · `Actualités` · `Plus ▾`. Texte `#bdc1c6`, actif `#e8eaed` + indicateur.
3. **Colonne gauche (résultats, ~600 px)** — chaque résultat :
   - ligne site : **favicon** (pastille ronde) + **nom du site** (`#e8eaed`) + sur 2nde ligne `URL/breadcrumb` (`#bdc1c6`) + `· Traduire cette page`,
   - **titre** lien (`#8ab4f8`, ~20 px, cliquable),
   - **snippet** (2-3 lignes, `#bdc1c6`),
   - menu `⋮` à droite.
     Résultats observés : _BEYBLADE X official website_, _Amazon — Beyblade: New Releases_, _Netflix — Watch BEYBLADE X_, _YouTube — BEYBLADE English Official Channel_, _Reddit — r/Beyblade_.
4. **Colonne droite (Knowledge Panel, ~380 px)** : titre **`Beyblade X`**, **grille d'images** (mosaïque 2×2 + bouton « plus »), description (`Beyblade X est un manga et une collection d'équipements sportifs japonais…`), `Source : Wikipédia`, paires clé/valeur (`Éditeur : (ja) Shōgakukan`, `Sortie initiale : 15 mai 2023 – en cours`), bloc **`Recherches associées`**.

### Transposition RPB (le mapping le plus riche)

- **Onglets** = les **catégories de l'index** : `Mode IA` · `Tous` · `Boutiques` (product) · `Pièces` (part) · `Tournois` (tournament) · `Bladers` (blader) · `Lexique` (lexicon) · `Plus ▾`. Mappe 1:1 sur `SearchCategory`.
- **Résultats organiques** = `GlobalSearchItem` : favicon = favicon du domaine boutique (ou icône de catégorie), nom = `title`, URL = domaine, snippet = `subtitle`/`details`, badge = prix (`price`) ou tier. Le titre lie vers `url` (fiche `/comparateur/[slug]`, lexique, tournoi…).
- **Knowledge Panel** = **fiche entité produit/pièce** quand la requête matche un `BxProductGroup` ou une `PartAnalysis` : image produit, **fourchette de prix** (`cheapestEur` → max), **nb de boutiques**, **tier méta** + `metaScore`, **pièces incluses** (`includedParts`), **CTA « Comparer N offres »**. `Recherches associées` = pièces/combos liés (via reco).

> C'est ici que le comparateur devient un vrai « moteur » : la colonne gauche agrège toutes les sources, la colonne droite est la **carte de synthèse de l'entité** — exactement le rôle du Knowledge Panel.

---

## 4. `result.png` — AI Mode, réponse synthétisée

**Rôle** : réponse rédigée + citations + cartes de sources + relance conversationnelle. **Pour RPB : 100 % algorithmique** (aucun LLM — cf. CLAUDE.md bot). La « réponse » est un **gabarit rempli par les données** (fourchette de prix, meilleure boutique, tier méta, combo recommandé).

### Anatomie

1. **Rail gauche** (collapse / compose) — idem AI Mode.
2. **Bulle requête** (`beyblade x`) alignée à droite, style « message utilisateur » (chip surface claire).
3. **Réponse générée** : paragraphe d'intro avec **fragments soulignés** (entités cliquables : `the fourth and fastest generation`, `Takara Tomy`) + **chip de citation** en fin de phrase (`Wikipedia`, pastille favicon). Puis structure rédigée : titres (`Core Mechanics: The X-Celerator Rail`), **listes à puces** avec termes en gras (`The Gimmick`, `The Stadium`, `Xtreme Dash`) et **chips de citation inline** (ex. `Spin City Imports`).
4. **Colonne droite — carte « sources »** : en-tête **`◫ 13 sites`**, puis cartes empilées : `Beyblade: New Releases - Amazon.com` (favicon Amazon), `Beyblade X - Wikipedia`, `Beyblade X – SpinCityImports` (vignette `YBLAD`). Chaque carte = titre + source + favicon/thumb.
5. **Barre de relance** en bas : `Ask anything` (champ pleine largeur, fond `#303134`).

### Transposition RPB — « Mode Synthèse » (algorithmique)

- **Génération sans LLM** : un _renderer_ déterministe assemble la réponse à partir de l'entité matchée :
  - intro : `{Nom} — {classification}. Disponible sur {shopCount} boutiques, de {cheapestEur} € à {maxEur} €.`
  - sections data : **Meilleur prix** (boutique + lien), **Méta** (tier `S/A/B/C` + `metaScore`, usage), **Composition** (`includedParts` avec tiers), **Combo recommandé** (top reco liée).
  - chaque assertion porte une **citation** vers sa **source réelle** : l'offre boutique (`BxOffer.url`/`domain`), la fiche produit, la source méta (bbxweekly/WBO). Aucune invention — chaque chip pointe une URL du dataset.
- **Carte sources** = `◫ {N} boutiques/sources` : la liste dédupliquée des `offers` + sources data (Fandom, bbxweekly), avec favicon de domaine.
- **Relance** : champ `Demander autre chose` → relance une recherche (nouvelle entité), pas une conversation libre.

> Honnêteté : on **n'affiche jamais** de texte non sourcé. Le « ton IA » vient du gabarit rédactionnel, pas d'un modèle. C'est conforme à « tout est algorithmique » et ça reste vérifiable (chaque chiffre/lien tracé jusqu'à la donnée).

---

## Synthèse — système de composants cible

| Composant                                                                      | Réf. image              | Données                                                      |
| ------------------------------------------------------------------------------ | ----------------------- | ------------------------------------------------------------ |
| `tokens.ts` (dark Google + accent RPB)                                         | toutes                  | —                                                            |
| `GoogleTopBar` (liens + app-grid + avatar)                                     | google, search, ai_mode | session better-auth (avatar)                                 |
| `GoogleSearchField` (pill : `+`, mic, lens, AI Mode) + dropdown autocomplétion | google, ai_mode         | index `/api/v1/search` (préfixe) + historique `localStorage` |
| `GoogleHome` (wordmark + field + 2 boutons + greeting)                         | google, ai_mode         | reco top-1 (« J'ai de la chance »)                           |
| `SerpTabs` (Mode IA/Tous/Boutiques/Pièces/Tournois/Bladers/Lexique)            | search                  | `SearchCategory`                                             |
| `SerpResults` (liste favicon+site+url+titre+snippet+badge)                     | search                  | `GlobalSearchItem[]`                                         |
| `KnowledgePanel` (fiche entité : image, fourchette, tier, pièces, CTA)         | search                  | `BxProductGroup` / `PartAnalysis` / reco                     |
| `AiSynthesis` (réponse gabarit + citations inline + carte sources + relance)   | result                  | entité matchée + `offers` + reco (déterministe)              |
| `ComparateurSearch` (orchestrateur d'états : home → typing → serp → synthèse)  | toutes                  | tout ce qui précède                                          |

### Machine à états (orchestrateur)

```
home ──(focus/typing)──► suggesting ──(submit)──┬─► serp     (Tous + onglets, défaut)
  ▲                                             └─► synthesis (si onglet « Mode IA »)
  └───────────────(clear/logo)──────────────────────────────┘
serp ⇄ synthesis  (bascule onglet « Mode IA » ↔ « Tous »)
```

### Contraintes d'implémentation (rpbey)

- **MUI v9 + Emotion**, multi-thème via `ThemeRegistry` → consommer `--rpb-*` + tokens dark de ce doc (pas de couleurs en dur hors fallback).
- **Aucun LLM** : `AiSynthesis` = gabarit déterministe, citations tracées au dataset.
- **API-first** : lectures via `/api/v1/search` (déjà migré) ; pas d'accès `@rpbey/db` côté client.
- **Indentation 2 espaces (oxfmt)**, pas d'emoji en code, `bunx tsc --noEmit` vert.
- Additif : la nouvelle vue vit sous `_components/google/` + route `/comparateur/recherche` — le comparateur existant (`page.tsx`, DataGrid) reste intact pendant la bascule.

---

## Plan de mise en œuvre (incrémental)

1. **Tokens + chrome** : `tokens.ts`, `GoogleTopBar`, `GoogleSearchField` (sans dropdown), `GoogleHome` statique. Build vert.
2. **Recherche live** : dropdown autocomplétion + état `suggesting` branché sur `/api/v1/search`.
3. **SERP** : `SerpTabs` + `SerpResults` + `KnowledgePanel` (entité produit). Bascule home→serp.
4. **Mode Synthèse** : `AiSynthesis` (gabarit + citations + carte sources + relance).
5. **Route** `/comparateur/recherche` + lien depuis le comparateur ; QA visuel (`scripts/shoot.ts`) comparé aux 4 captures.
