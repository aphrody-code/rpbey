---
title: "Best practices du pipeline de données rpbey"
description: "Référentiel opinioné — scraping → validation → consolidation → recherche hybride/RAG → observabilité — confronté à l'état réel du pipeline rpbey, avec backlog d'actions priorisé."
scope:
  - apps/web/src/server/services
  - apps/web/scripts
  - apps/web/src/lib/search-rank.ts
status: "stable"
last_updated: "2026-05-30"
related_symbols:
  - buildGlobalSearchIndex
  - getSearchCorpus
  - rankSearch
  - removeUniformLightBackground
---

# Best practices du pipeline de données rpbey

Synthèse des pratiques 2025-2026 (recherche web sourcée en bas) **confrontée à
l'état réel** de notre pipeline. Notre pipeline va de l'ingestion multi-source
(boutiques Shopify, Amazon, ZenMarket, Reddit, X, WBO, frames anime) à la
**recherche** (`/search`, `/comparateur`) en passant par la consolidation Redis.

Deux cadres de référence structurent ce doc :

- **2 étapes de retrieval** — *retrieval* (haute recall : hybride lexical+dense,
  RRF) puis *reranking* (haute précision). Les confondre est l'erreur d'archi #1.
- **5 piliers d'observabilité data** — fraîcheur, volume, schéma, distribution,
  lignage. « La table a chargé » ≠ « les chiffres sont justes ».

Légende priorité : **P0** = à faire (impact fort / dette réelle), **P1** =
prochaine vague, **P2** = nice-to-have.

---

## A. Ingestion / scraping

**Principes.** Le scraping est la couche d'entrée : séparer extraction et
traitement (modèle Scrapy : *spider produit des items, le pipeline valide/dédup/
stocke*). Rate-limiting **adaptatif et par domaine** (token bucket, pas délai
fixe), retries avec **backoff exponentiel**, **non-destructif** (un run vide ne
doit jamais écraser un bon dataset), session authentifiée + cookies persistants
pour les cibles protégées.

**Notre état.** Bon socle : scrapers Bun natifs (curl-impersonate / HTMLRewriter /
bxc), sessions authentifiées stockées hors repo et jamais ré-affichées
(`~/.aphrody/<site>-cookies.txt`, cf. [pièges bxc](#)), non-destructivité déjà en
place (`scrape-reddit-discussions.ts` : 0 post → `exit 2` sans réécrire),
sleeps entre requêtes, fallback gracieux. Provenance présente (`source` sur chaque
`GlobalSearchItem`).

**Écarts → actions.**

- **P1** — Rate-limiting **par domaine** centralisé (token bucket) plutôt que
  `sleep` codés en dur par script ; délais plus longs sur les endpoints de
  recherche (5-10 s) que sur le crawl de contenu (3-7 s).
- **P1** — **Backoff exponentiel** explicite sur 429/5xx (l'agent méta l'a fait
  ad hoc — Reddit/X 429 backfillés ; à généraliser dans un helper `fetchRetry`).
- **P2** — **Quarantine zone** : router les enregistrements rejetés vers un
  `data/_quarantine/<source>.json` au lieu de les jeter silencieusement.

---

## B. Validation & qualité des données

**Principes.** *Enforce le schéma à l'entrée* (Zod/JSON-Schema) — attraper les
données malformées **avant** le stockage. Déduplication par **content-hash /
fingerprint** (l'URL ne suffit pas : même contenu sur plusieurs URLs ; le hash
attrape les boucles de pagination infinie). Validation en paliers : schéma →
fraîcheur → anomalie de volume → cohérence format → règles métier.

**Notre état.** Partiel. `RedditDiscussionSchema` valide au scrape (bon modèle).
La dédup catalogue se fait par **clé de groupe** (`groupKey` : code produit, sinon
nom normalisé) dans `bx-catalog.ts` — efficace pour le comparateur. Le contrat
`GlobalSearchItemSchema` (`@rpbey/api-contract`) type le corpus en sortie.

**Écarts → actions.**

- **P0** — **Validation Zod à l'ingestion pour TOUS les scrapers** (Amazon,
  ZenMarket, X-export n'ont pas de garde Zod au moment d'écrire). Pattern :
  `Schema.safeParse` par enregistrement, compter/loguer les rejets, n'écrire que
  les valides (déjà fait pour Reddit — à répliquer).
- **P1** — **Dédup par fingerprint cross-source** : un même produit shopify
  apparaissant sur 2 boutiques mirror, ou un tweet retweeté, devraient fusionner
  par hash de contenu normalisé, pas seulement par URL/clé.
- **P2** — **Profilage statistique** : détecter les prix aberrants (déjà : Yahoo
  « 1 yen » écarté dans `scrape-zenmarket.ts` ; à généraliser via un seuil
  z-score sur `priceEur` par groupe).

---

## C. Consolidation & stockage

**Principes.** Une **source de vérité unique** par donnée. Cache multi-niveaux
avec read-through et TTL. Idempotence : retraiter ne corrompt pas l'aval.

**Notre état.** Solide. `getSearchCorpus()` consolide ~15 sources dans **une clé
Redis** (`rpbey:search:corpus:v1`, TTL 1 h) avec memo in-process 60 s (stabilité
de référence pour le cache BM25F `WeakMap`), fallback live si Redis down. Postgres
= source de vérité du schéma métier (`@rpbey/db`). `invalidateSearchCorpus()`
après refresh de data.

**Écarts → actions.**

- **P1** — **Versionner la clé de corpus** au changement de shape (déjà `:v1` —
  bumper à `:v2` quand `GlobalSearchItem` évolue, pour éviter de servir un cache
  d'ancien schéma après deploy).
- **P2** — Documenter la **matrice source → clé/table** (lignage) dans ce doc ou
  `REPO_MAP`.

---

## D. Recherche : hybride lexical + dense (RAG)

**Principes (le cœur).** Le pattern de prod consensuel :
**BM25 + dense (ANN/HNSW) → fusion RRF (k=60) → rerank cross-encoder → réponse.**

- Recall vs précision : *retrieval* = recall (hybride), *rerank* = précision.
- **RRF k=60 = baseline sans tuning** qui « marche » à travers les échelles de
  score incompatibles. Migrer vers une **combinaison convexe pondérée** seulement
  une fois **40+ paires query/pertinence labellisées** disponibles.
- Le **dense seul échoue en silence** sur les tokens exacts (SKU, codes, versions,
  négation) → BM25 sauve la recall là où le littéral compte. Notre corpus est
  **plein de littéraux** (codes `BX-35`, drivers `3-60F`, noms JP) → hybride =
  exactement notre cas.
- **Tester sur SES données** : MTEB ne transfère pas. `multilingual-e5-small`
  (384d) a été validé en local sur notre corpus (FR/EN/JP cross-lingue OK, 102 ms
  / 4 textes, voir probe). Le *chunking* est quasi N/A ici : nos « documents »
  sont courts (titre+sous-titre+détails) → 1 item = 1 chunk ; juste **tronquer**
  le texte X/Reddit à ~512 tokens avant d'embed.
- **Re-embed** sur gain mesuré / changement de modèle, **pas sur planning**.

**Notre état.** BM25F mûr et spécialisé (`search-rank.ts`) : tokenisation
accent-fold NFD, synonymes/alias FR/EN/JP, fuzzy Damerau-Levenshtein borné, bonus
exact/préfixe, boosts par champ + catégorie + popularité. **C'est la moitié
« lexicale » de l'hybride, déjà excellente.**

> ⚠️ **Dette critique découverte** : le vector set Redis `tweet_embeddings`
> (9187×768d) a été généré avec des **vecteurs aléatoires** (`run-index-embeddings.ts`
> renvoie `Math.random()` quand `GEMINI_API_KEY` est vide — il l'est). Donc toute
> recherche « sémantique » dessus = **bruit**. À ne pas câbler tel quel.

**Écarts → actions.**

- **P0** — **Embeddings réels via sidecar isolé** : service Bun chargeant
  `multilingual-e5-small` (Transformers.js/ONNX) sur loopback, **hors du bundle
  Next** (ONNX natif ne doit pas entrer dans le build web — invariant CLAUDE.md).
  Le web n'appelle le sidecar qu'en `fetch`.
- **P0** — Index vectoriel **corpus** `rpbey:search:vec` (VADD FP32, élément =
  `item.id`) construit par un script batch depuis `getSearchCorpus()`.
- **P0** — **Fusion RRF (k=60)** dans `/api/v1/search` : `rankSearch` (BM25F) ⊕
  VSIM, **dégradation gracieuse** vers BM25F seul si sidecar/Redis down. Fonction
  pure `fuseHybrid()` dans `search-rank.ts`.
- **P0** — **Jeu d'éval adverse AVANT d'optimiser** (ROI le plus haut selon la
  recherche) : ~40 requêtes Beyblade labellisées incluant des **littéraux**
  (`BX-35`, `dran sword`, `ドランソード`, fautes `dran swrod`) + harnais
  Recall@K / MRR / nDCG. Tout changement de retrieval passe ce gate.
- **P2** — **Rerank cross-encoder** seulement si on observe un trou de précision
  positions 1-2 (le bon doc revient en position 3-8). Pas par défaut.

---

## E. Fraîcheur & observabilité

**Principes.** 5 piliers (fraîcheur, volume, schéma, distribution, lignage). SLO
de fraîcheur + alertes anti-fatigue. **Détection de schema drift** (contrats
versionnés, compat ascendante). Logs structurés (JSON). Retries + circuit breaker
+ dead-letter. Validation *shift-left & shift-right*.

**Notre état.** Faible côté monitoring. Refresh via cron (`Bun.cron`) +
`invalidateSearchCorpus`, mais **pas de surveillance de fraîcheur/volume** sur les
`data/*.json`. Le `source` sur les items donne un lignage minimal.

**Écarts → actions.**

- **P1** — **`scripts/data-doctor.ts`** : pour chaque source data
  (`bx-catalog.json`, `x-discussions.json`, `reddit-discussions.json`,
  `bbx-weekly.json`, `meta-enrichment.json`) → vérifier l'âge de `generatedAt`
  (SLO fraîcheur), le nombre d'enregistrements (anomalie de volume vs run
  précédent), la conformité au schéma Zod, et un rapport unique. Branché au
  `pre-commit` ou à un cron quotidien.
- **P1** — **Timestamps de génération partout** : `generatedAt` + `count` en tête
  de chaque `data/*.json` (déjà sur Reddit/X — à généraliser).
- **P2** — Alerte Discord (le bot a déjà un webhook) sur source stale > seuil.

---

## État appliqué (2026-05-30)

Le backlog **P0 + P1 est livré et déployé**, et le pipeline a été étendu d'un étage
**connaissance / graphe d'entités** (cf. [beyblade-knowledge](beyblade-knowledge.md)) :

- **Hybride live** : sidecar `apps/embed-sidecar/` + index vectoriel `rpbey:search:vec`
  (multilingual-e5-small 384d) + fusion RRF k=60 ; éval adverse `eval-search.ts`
  (+11.9 % MRR@10, +64 % conceptuel vs BM25F seul). Indexeur `build-search-vectors.ts`
  **durci** (retry/backoff sur ECONNRESET sidecar).
- **Durcissement scrapers** : validation Zod ingestion, `fetchRetry` backoff, rate-limit
  par domaine, dédup fingerprint (`scripts/lib/scrape-utils.ts`).
- **Observabilité** : `scripts/data-doctor.ts` (fraîcheur/volume/schéma, baseline) +
  `generatedAt`/`count` en tête de tous les exports.
- **Entité canonique** : `lib/beyblade-entity.ts` — clé canonique + tables de tier uniques
  (ex-triplicées), consommé par index/ranker/reco. Dédup canonique bey/produit dans le corpus.
- **Combos enrichis** : `enrich-combos.ts` joint combos↔méta↔communauté (`wbo-combos-enriched.json`).
- **Connaissance wiki exhaustive** : crawler MediaWiki `crawl-fandom.ts` →
  `beyblade-knowledge.json` (8 459 entités, toutes saisons) câblé dans la recherche
  (**corpus 9 018 → 17 082**).
- **Graphe de liens** : `entity-graph.ts` (`getProductIntel`, `getGenerationShowcase`) relie
  produit↔blade↔tier↔combos↔buzz↔wiki↔voisins denses, et série anime↔génération↔beys/
  personnages/jeux. Surfacé sur les pages comparateur (`ProductIntel`), anime
  (`SeriesCrosslinks`) et builder (`DeckSynergy`).

Restant : **P2** uniquement (rerank cross-encoder — différé, aucun trou de précision mesuré ;
quarantine/profilage ; versionnement de clé au changement de shape ; alerte Discord stale).

---

## Backlog priorisé

| Prio | Action | Fichiers |
| --- | --- | --- |
| **P0** | Sidecar embeddings local isolé (multilingual-e5-small) | `apps/embed-sidecar/` (nouveau) |
| **P0** | Index vectoriel corpus + fusion RRF k=60 (hybride, dégradation gracieuse) | `search-rank.ts`, `api/v1/search/route.ts`, `services/embeddings.ts` |
| **P0** | Jeu d'éval adverse (littéraux + fautes + JP) + harnais Recall@K/MRR/nDCG | `scripts/eval-search.ts` (nouveau) |
| **P0** | Validation Zod à l'ingestion pour tous les scrapers | `scripts/scrape-*.ts` |
| **P1** | Rate-limit par domaine + `fetchRetry` backoff exponentiel | helper partagé scrapers |
| **P1** | Dédup par fingerprint cross-source | `bx-catalog.ts`, exports |
| **P1** | `data-doctor.ts` (fraîcheur/volume/schéma) + `generatedAt`/`count` partout | `scripts/data-doctor.ts` (nouveau) |
| **P1** | Versionner la clé de corpus au changement de shape | `services/search-corpus.ts` |
| **P2** | Rerank cross-encoder (si trou de précision 1-2) | sidecar |
| **P2** | Quarantine zone + profilage statistique (prix aberrants) | scrapers |

---

## Sources

- [Hybrid Search in Production: Why BM25 Still Wins — TianPan.co](https://tianpan.co/blog/2026-04-12-hybrid-search-production-bm25-dense-embeddings)
- [Hybrid Search + Reranking Playbook — OptyxStack](https://optyxstack.com/rag-reliability/hybrid-search-reranking-playbook)
- [Hybrid Search Explained — Weaviate](https://weaviate.io/blog/hybrid-search-explained)
- [Optimizing RAG with Hybrid Search & Reranking — Superlinked VectorHub](https://superlinked.com/vectorhub/articles/optimizing-rag-with-hybrid-search-reranking)
- [RAG Chunking Strategies & Embeddings — 2026 Benchmark Guide](https://nandigamharikrishna.substack.com/p/rag-chunking-strategies-and-embeddings)
- [Building Production RAG: Architecture, Chunking, Evaluation & Monitoring (2026) — PremAI](https://blog.premai.io/building-production-rag-architecture-chunking-evaluation-monitoring-2026-guide/)
- [Best Embedding Models for RAG in 2026 — StackAI](https://www.stackai.com/insights/best-embedding-models-for-rag-in-2026-a-comparison-guide)
- [Data Quality in Web Scraping: Validation, Cleaning, Deduplication — DEV](https://dev.to/agenthustler/data-quality-in-web-scraping-validation-cleaning-and-deduplication-502k)
- [Web Scraping and Data Pipelines: A Practical Guide — DEV](https://dev.to/vietnam/web-scraping-and-data-pipelines-a-practical-guide-for-developers-5adj)
- [Data Observability Guide 2025 — SYNQ](https://www.synq.io/blog/data-observability-guide)
- [Resilient Data Pipelines: Schema, Errors & CDC — Matia](https://www.matia.io/blog/resilient-data-pipelines-schema-drift-cdc)
