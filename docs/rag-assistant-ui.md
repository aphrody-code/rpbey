---
title: "Assistant RAG conversationnel & UI d'ambiance"
description: "Couche de consommation du RAG rpbey : backend de chat « Rpbey » (retrieval hybride déterministe) — UI retirée du site, conservé en background — et fonds d'ambiance par page/section (frames d'animé, parallaxe au scroll) tirés du corpus."
scope:
  - apps/web/src/server/services/chat.ts
  - apps/web/src/lib/chat-nlp.ts
  - apps/web/src/app/api/chat
  - apps/web/src/components/ui/FrameBackdrop.tsx
  - apps/web/src/components/ui/SectionFrameBg.tsx
  - apps/web/src/app/api/v1/anime/frames/ambient
status: "stable"
last_updated: "2026-06-04"
related_symbols:
  - prepareTurn
  - answerQuestion
  - detectIntent
  - FrameBackdrop
  - SectionFrameBg
---

# Assistant RAG conversationnel & UI d'ambiance

La couche de **consommation** du RAG. Le retrieval (corpus unifié, recherche
hybride BM25F ⊕ dense, RRF) est décrit dans **[Best practices du pipeline de
données](data-pipeline-best-practices.md)** et **[Crawling & RAG X.com](crawling-rag-x.md)**.
Ce doc couvre ce qui se branche dessus côté produit : un **chat conversationnel**
et des **fonds d'ambiance** issus du même corpus.

Principe transverse : **aucune hallucination**. Le retrieval et le NLP à règles
sont algorithmiques ; les faits viennent **toujours** du corpus. Le LLM local
(llama.cpp, `rpbey-llm.service`, etc.) a été retiré pour alléger l'infrastructure,
le pipeline fonctionnant entièrement en mode synthèse extractive déterministe.

## A. Chat « Rpbey » (backend uniquement)

> ⚠️ **UI RETIRÉE DU SITE le 2026-06-01** (commit `fd03ba8`) : les composants
> `components/chat/RpbeyChat.tsx` + `RpbeyChatLauncher.tsx` ont été supprimés et
> démontés de `app/(marketing)/layout.tsx`. L'utilisateur ne voit plus de chat.
> **Le backend reste en place, inerte sans UI** (route + services conservés en
> background — repointables sur le daemon aphrody, cf. `RPBEY_LLM_URL`). Le « Mode
> IA » de `/search` (synthèse + onglet) a aussi été retiré.

Pipeline backend conservé (retrieval hybride déterministe) :

| Couche | Fichier | Rôle |
| --- | --- | --- |
| NLP | `apps/web/src/lib/chat-nlp.ts` | `detectIntent` (12 intentions, règles regex priorisées), `searchTerms`, `INTENT_CATEGORY`, types `ChatAnswer`/`ChatSource`, `STARTER_PROMPTS`. Pur, importé par le backend (et anciennement par l'UI). Miroir de `apps/bot/src/lib/rpbey/nlp.ts`. |
| Cerveau | `apps/web/src/server/services/chat.ts` (`server-only`) | `prepareTurn(message, history)` : retrieval **in-process** (`getSearchCorpus` + `rankSearch` + `searchVectorIds` + `fuseHybrid`) + brouillon extractif + `buildMessages` (système + historique capé + contexte RAG). `answerQuestion()` = wrapper non-stream / repli. |
| API | `apps/web/src/app/api/chat/route.ts` | `POST /api/chat` `{ message, history }` → **flux SSE** (`meta`/`delta`/`done`) renvoyant le brouillon extractif directement. Self-contained (validation inline, **pas** de contrat partagé). |

La cohérence avec le bot Discord (`/rpbey`, mentions) reste volontaire : même
NLP, même corpus, même retrieval — un seul cerveau, désormais sans surface web
visible. La doc exhaustive de l'environnement RAG vit dans
`aphrody/docs/rpbey-rag/` (chat, llm, search, crawling-x, knowledge, infra).

## B. Fonds d'ambiance (frames d'animé)

Les **frames d'animé** du corpus (`data/anime-frames/*.json`, URLs wikia HD ou
`cdn.rpbey.fr`) servent de fond décoratif, choisi par topic et teinté par le
thème actif.

| Composant | Fichier | Usage |
| --- | --- | --- |
| Route ambient | `apps/web/src/app/api/v1/anime/frames/ambient/route.ts` | `GET …?series=&count=` — sert un échantillon léger d'URLs **lu directement des JSON** (échantillon stridé, repli diversifié). Indépendant de l'import DB lourd `anime_frames` (re-hébergement CDN, souvent non exécuté). |
| Fond de page | `apps/web/src/components/ui/FrameBackdrop.tsx` | Fond fixe `z-index:-1` derrière le contenu : frame keyée par série + **teinte thème** (`--rpb-primary-rgb`), Ken Burns, scrim `color-mix` (contraste AA), `prefers-reduced-motion`. Câblé sur `anime`, `anime/[slug]`, `meta`, `builder`, `comparateur`. |
| Fond de section (home) | `apps/web/src/components/ui/SectionFrameBg.tsx` | Fond plein-cadre **par section** de la home : une frame d'animé (« meilleur moment » d'une saison) en `background-image`, avec **parallaxe + scale au scroll** (framer-motion `useScroll`/`useTransform`) et fondu d'apparition. La home n'a **plus de hero/header** : chaque section porte sa saison (Tournois→Beyblade X, Vidéos→Metal Fight, Classements/Meta→Burst, Partenariat→Bakuten) → le scroll fait défiler les générations. Scrim vertical (dense aux jointures, clair au centre) pour la lisibilité du contenu. Parallaxe coupée en `prefers-reduced-motion`. Pas de Pixi (CSS pur, perf sur page longue). |

> ⚠️ **Frames chargées en direct depuis le CDN**, jamais via le proxy `/api/img`
> (commits `7a501b4`, `SectionFrameBg`). Une frame est un `background-image` CSS
> décoratif → **aucun CORS requis**. Le proxy ferait deux dégâts : (1) `cdn.rpbey.fr`
> **n'est pas dans `ALLOWED_IMAGE_HOSTS`** (`lib/img-proxy.ts`) → **403** → fond
> invisible ; (2) il applique `removeUniformLightBackground` (détourage produit) →
> troue les ciels / aplats clairs des frames. Régression vécue : avant le fix, seul
> le dégradé de marque s'affichait.

## Invariants

- **Grounding strict, zéro hallucination** : synthèse extractive déterministe pure. Les faits viennent directement du corpus indexé.
- **Découplage API** : `/api/chat` ne dépend pas de `@rpbey/api-contract`
  (validation inline) — évolue sans toucher le contrat partagé.
- **Dégradation gracieuse** : sidecar embeddings / Redis absent → `fuseHybrid`
  préserve l'ordre BM25F ; frames indisponibles / lentes → dégradé de marque visible
  d'emblée (jamais d'état vide) ; `prefers-reduced-motion` → parallaxe coupée.
- **Backend en background** : depuis le 2026-06-01 le chat n'a **plus de surface
  web** (UI retirée). La route `/api/chat` + les services restent déployés, inertes
  sans appelant, prêts à être repointés sur le daemon aphrody (`RPBEY_LLM_URL`).
