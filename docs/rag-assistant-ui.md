---
title: "Assistant RAG conversationnel & UI d'ambiance"
description: "Couche de consommation du RAG rpbey : chat « Rpbey » style Gemini branché au NLP algorithmique (zéro LLM) sur la recherche hybride, et fonds d'ambiance par page (frames d'animé, PixiJS) tirés du corpus."
scope:
  - apps/web/src/server/services/chat.ts
  - apps/web/src/lib/chat-nlp.ts
  - apps/web/src/app/api/chat
  - apps/web/src/components/chat
  - apps/web/src/components/ui/FrameBackdrop.tsx
  - apps/web/src/components/ui/LivingBackdrop.tsx
  - apps/web/src/app/api/v1/anime/frames/ambient
status: "stable"
last_updated: "2026-05-30"
related_symbols:
  - answerQuestion
  - detectIntent
  - RpbeyChat
  - RpbeyChatLauncher
  - FrameBackdrop
  - LivingBackdrop
---

# Assistant RAG conversationnel & UI d'ambiance

La couche de **consommation** du RAG. Le retrieval (corpus unifié, recherche
hybride BM25F ⊕ dense, RRF) est décrit dans **[Best practices du pipeline de
données](data-pipeline-best-practices.md)** et **[Crawling & RAG X.com](crawling-rag-x.md)**.
Ce doc couvre ce qui se branche dessus côté produit : un **chat conversationnel**
et des **fonds d'ambiance** issus du même corpus.

Principe transverse : **ZÉRO LLM**. Tout est algorithmique (NLP à règles +
retrieval + synthèse extractive). Aucune réponse n'est inventée ; les faits
viennent du corpus, la « voix » et la mise en forme sont des templates.

## A. Chat « Rpbey » (conversationnel)

Assistant Beyblade omniscient, présenté en **style Gemini app** (gradient
signature, sparkle, bulles), mais 100 % algorithmique.

| Couche | Fichier | Rôle |
| --- | --- | --- |
| NLP | `apps/web/src/lib/chat-nlp.ts` | `detectIntent` (12 intentions, règles regex priorisées), `searchTerms` (retire l'échafaudage interrogatif pour focaliser sur l'entité), `INTENT_CATEGORY` (biais de catégorie), types partagés `ChatAnswer`/`ChatSource`, `STARTER_PROMPTS`. Pur, client+serveur. Miroir de `apps/bot/src/lib/rpbey/nlp.ts`. |
| Cerveau | `apps/web/src/server/services/chat.ts` (`server-only`) | `answerQuestion()` : retrieval **in-process** (`getSearchCorpus` + `rankSearch` + `searchVectorIds` + `fuseHybrid`, pas d'aller-retour HTTP) puis **synthèse extractive par intention** (combo/best/meta/buy/tournament en listes ; define/character/compare en lead faisant autorité + détails). Miroir de `apps/bot/src/lib/rpbey/answer.ts`. |
| API | `apps/web/src/app/api/chat/route.ts` | `POST /api/chat` `{ message }` → `{ ok, data: ChatAnswer }`. Self-contained (validation inline, **pas** de contrat partagé) pour rester découplé. |
| UI | `apps/web/src/components/chat/RpbeyChat.tsx` | Panneau Gemini : sparkle gradient 4-couleurs, bulles 22px, prompt-bar pill à **bordure gradient au focus**, thinking-dots, cartes de sources, chips de suggestions/relances. Markdown via `react-markdown`. Motion M3 (emphasized-decelerate). Tokens `--rpb-gradient-ai` / `--rpb-surface-*` (cf. `m3.css`). |
| Launcher | `apps/web/src/components/chat/RpbeyChatLauncher.tsx` | FAB flottant (sparkle) → `Drawer` ; `RpbeyChat` chargé en `next/dynamic` `ssr:false` (lazy, hors bundle initial). Monté dans `app/(marketing)/layout.tsx` → présent sur toutes les pages marketing, dont `/search`. |

La cohérence avec le bot Discord (`/rpbey`, mentions) est volontaire : même
NLP, même corpus, même synthèse — deux surfaces (web + Discord) d'un seul
cerveau. Garde-fou : aucun loader vide — l'état initial est un sparkle + des
chips de départ, l'attente est un thinking-dots animé (indicateur réel).

## B. Fonds d'ambiance (frames d'animé)

Les **frames d'animé** du corpus (`data/anime-frames/*.json`, URLs wikia HD ou
`cdn.rpbey.fr`) servent de fond décoratif, choisi par topic et teinté par le
thème actif.

| Composant | Fichier | Usage |
| --- | --- | --- |
| Route ambient | `apps/web/src/app/api/v1/anime/frames/ambient/route.ts` | `GET …?series=&count=` — sert un échantillon léger d'URLs **lu directement des JSON** (échantillon stridé, repli diversifié). Indépendant de l'import DB lourd `anime_frames` (re-hébergement CDN, souvent non exécuté). |
| Fond de page | `apps/web/src/components/ui/FrameBackdrop.tsx` | Fond fixe `z-index:-1` derrière le contenu : frame keyée par série + **teinte thème** (`--rpb-primary-rgb`), Ken Burns, scrim `color-mix` (contraste AA), `prefers-reduced-motion`. Câblé sur `anime`, `anime/[slug]`, `meta`, `builder`, `comparateur`. |
| Hero vivant | `apps/web/src/components/ui/LivingBackdrop.tsx` | Fond du hero home : frame en Ken Burns CSS + calque **PixiJS v8** de braises **procédurales** (texture canvas runtime). Hero **épuré** (commit `7a501b4`) : gros titre + tagline + 2 CTAs retirés, ne reste que la puce « EN DIRECT » + le fond ; `minHeight` 44/52vh, frame **prominente** (`intensity` 0.82, voile léger 26/8/92 %). Perf mobile : DPR capé 2, `maxFPS=30`, pause `visibilitychange`, désactivé en reduced-motion, `app.destroy()` au démontage, fallback si WebGL absent. `import("pixi.js")` dynamique (hors bundle initial). |

> `pixi.js` est dep de `apps/web` (et `apps/gacha-client`). Toujours via import
> dynamique dans un `useEffect` — Pixi est WebGL/browser-only, jamais en SSR.

> ⚠️ **Frames chargées en direct depuis le CDN**, jamais via le proxy `/api/img`
> (commit `7a501b4`). Une frame est un `background-image` CSS décoratif → **aucun
> CORS requis**. Le proxy ferait deux dégâts : (1) `cdn.rpbey.fr` **n'est pas dans
> `ALLOWED_IMAGE_HOSTS`** (`lib/img-proxy.ts`) → **403** → fond invisible ; (2) il
> applique `removeUniformLightBackground` (détourage produit) → troue les ciels /
> aplats clairs des frames. Régression vécue : avant le fix, seul le dégradé de
> marque s'affichait.

## Invariants

- **Zéro LLM, zéro hallucination** : `answerQuestion` n'émet que des items du
  corpus + templates ; si rien n'est trouvé, le dire (repli in-character).
- **Découplage API** : `/api/chat` ne dépend pas de `@rpbey/api-contract`
  (validation inline) — évolue sans toucher le contrat partagé.
- **Dégradation gracieuse** : sidecar embeddings / Redis absent → `fuseHybrid`
  préserve l'ordre BM25F ; WebGL absent → `LivingBackdrop` reste sur l'image CSS ;
  frames indisponibles → dégradé de marque (jamais d'état vide).
- **Hands-off** : le chat est monté via le layout marketing, sans toucher
  `app/(marketing)/search/_components/*` (refonte M3 en cours, cf.
  [plan de refonte search](m3/search-redesign-plan.md)).
