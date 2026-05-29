# Guide de Crawling & RAG X.com (Twitter)

Ce document décrit le fonctionnement et la structure du système de crawling autonome et de RAG (Retrieval-Augmented Generation) pour extraire, stocker et exploiter les discussions stratégiques Beyblade X depuis x.com.

> **Où vit le code et les données** (le repo `rpbey` ne contient QUE cette doc) :
>
> - Package : `/home/ubuntu/aphrody/packages/x/` (`@aphrody-code/x`). Bins dans `src/bin/`.
> - Store SQLite : `/home/ubuntu/.aphrody/x-store.sqlite` (tables `tweets`, `users`, FTS5 `tweets_fts`, `tweet_embeddings`).
> - Session (cookies, SECRET) : `/home/ubuntu/.aphrody/x-session.json`.
> - Clé Gemini : `GEMINI_API_KEY` (fallback `GOOGLE_API_KEY`) — vit dans `/home/ubuntu/aphrody/.env`.
>   Les bins lisent `process.env` ; sourcer l'env avant de lancer : `set -a; . /home/ubuntu/aphrody/.env; set +a`.
> - Infra : Redis (vector sets `VADD`/`VSIM`), Bun (jamais node/npm/tsx).

---

## 1. Session de Crawling x.com

Le crawler autonome effectue des requêtes structurées en mimant un navigateur réel pour contourner le rate limit (avec des cookies injectés dans la session).

### A. Mécanisme de Session (`XSession` & `XClient`)

- **Localisation du code** : `packages/x/src/core/session.ts` et `client.ts`.
- **Authentification** : Utilise les cookies de session injectés (`auth_token`, `ct0`, `__cf_bm`, etc.) pour s'authentifier.
- **Navigation** : Le `XClient` implémente des requêtes HTTP directes vers l'API interne de Twitter/X (GraphQL et endpoints de recherche/timeline) avec des en-têtes d'impersonation (ex. agents utilisateurs réalistes).

### B. Algorithme de Crawling Ciblée (`run-targeted-crawler.ts`)

- **Localisation** : `packages/x/src/bin/run-targeted-crawler.ts` (le bin opérationnel ; `services/crawler.ts` reste un service générique).
- **Commande exacte** (depuis `/home/ubuntu/aphrody/packages/x`, env sourcé) :
  ```bash
  set -a; . /home/ubuntu/aphrody/.env; set +a
  bun run src/bin/run-targeted-crawler.ts
  ```
- **Fonctionnement (observé)** :
  1. Charge la session (`XSession.load()` depuis `x-session.json`), instancie `XClient`, vérifie `whoami`, connecte Redis.
  2. **Seeds réels (codés en dur dans le bin)** :
     - `followTargets = ["rpb_ey", "SunAfterTheBey"]` → récupère leurs _followings_ (100 chacun).
     - `verifiedFollowersTargets = ["SunAfterTheBey", "Beyblade_Espace", "x_beyblade"]` → leurs _blue verified followers_ (op GraphQL `BlueVerifiedFollowers`, 80 chacun).
     - `directTweetTargets = ["x_beyblade"]`.
       (Pas de `@zankye`/`@Chillaccinoo`/`#BeybladeX` en seed — ces comptes apparaissent dans les _données_ crawlées, pas dans la config de seed.)
  3. Construit une file unique de handles (`queueUsernames`, ~160 comptes par run observé).
  4. Pour chaque handle : résout l'ID, upsert le profil, récupère ~15 derniers tweets (`userTweets`), upsert chaque tweet dans SQLite (`upsertTweet`) **ET génère immédiatement son embedding** (Gemini) qu'il pousse dans SQLite (`tweet_embeddings` BLOB) + Redis (`VADD tweet_embeddings FP32 …`).
  5. Délai de politesse de 2s entre requêtes (5s sur échec). Pas de `delayMs=5s` configurable.
  - **Note runtime** : le crawler embedde _inline_ en gardant la connexion SQLite ouverte ; sous charge on observe quelques `database is locked` transitoires (non fatals, ne bloquent que le tweet concerné).

---

## 2. Système RAG (Retrieval-Augmented Generation)

Le RAG permet de répondre à des questions complexes sur le métagame Beyblade X (ex. _"Quel est le meilleur combo pour Wizard Rod ?"_) en se basant uniquement sur la base de connaissances fraîchement crawlée.

### A. Indexation des Embeddings

- **Modèle d'embedding** : `gemini-embedding-001` via l'API Gemini, `outputDimensionality: 768` (vecteurs 768d, FP32).
- **Double stockage** : chaque embedding est écrit **à la fois** dans SQLite (`tweet_embeddings(tweet_id, embedding BLOB, updated_at)`, source de vérité persistante) **et** dans le vector set Redis `tweet_embeddings` via `VADD tweet_embeddings FP32 <blob> <tweet_id>` (index pour la similarité). Sans clé Gemini, les bins génèrent un **vecteur mock normalisé** (mode offline) — ne pas confondre avec un embedding réel.
- **Script d'indexation** : `packages/x/src/bin/run-index-embeddings.ts` — **boucle continue** (pas un one-shot) :
  ```bash
  set -a; . /home/ubuntu/aphrody/.env; set +a
  bun run src/bin/run-index-embeddings.ts   # tourne en boucle ; Ctrl-C / timeout pour sortir
  ```
  Au démarrage, il resynchronise tous les embeddings SQLite existants vers Redis, puis boucle : embedde par lots de 50 les tweets sans embedding (`tweets LEFT JOIN tweet_embeddings WHERE e.tweet_id IS NULL`), 500ms entre appels, attend 30s quand il n'y a plus rien à faire. Comme le crawler embedde déjà inline, ce bin trouve souvent 0 tweet à traiter.

### B. Moteur de Recherche RAG (`BeybladeXRag`)

- **Localisation** : `packages/x/src/services/rag.ts` ; bin d'exécution `packages/x/src/bin/run-rag.ts`.
- **Commande exacte** (le flag est `--query`/`-q`, pas un argument positionnel) :
  ```bash
  set -a; . /home/ubuntu/aphrody/.env; set +a
  bun run src/bin/run-rag.ts --query "Quel est le meilleur combo pour Wizard Rod ?"
  ```
- **Étapes de résolution d'une requête blader** (`BeybladeXRag.query`) :
  1. **Recherche Vectorielle (Retrieval, en premier)** : embedde la question (Gemini `gemini-embedding-001`, 768d) puis interroge Redis `VSIM tweet_embeddings FP32 <vecteur> COUNT 15 WITHSCORES` ; les IDs retournés sont réhydratés depuis SQLite (`tweets`).
  2. **Recherche Textuelle FTS (hybride, pas seulement fallback)** : extrait 3–5 mots-clés via `gemini-2.5-flash` (fallback tokenisation locale si pas de clé), puis `store.search(kw)` = `FTS5 MATCH` sur `tweets_fts`. Les résultats s'ajoutent aux candidats VSIM (déduplication par id). _Bug connu mineur : un mot-clé contenant `#` (ex. `#BeybladeX`) déclenche `fts5: syntax error near "#"` — non fatal, le VSIM couvre._
  3. **Tri + Expansion de thread** : candidats triés par `like_count`, top 15 retenus ; pour chaque seed avec `conversation_id`, jusqu'à 10 tweets du même fil sont ajoutés au contexte.
  4. **Génération** : prompt « professional Beyblade X analyst » injectant le contexte formaté (`[Source N] User/Likes/Content`) dans `gemini-2.5-flash`. En l'absence de clé, réponse mock offline.
  5. Retourne `{ query, answer, sources[] }` — sources = `{ id, author_username, text, like_count, conversation_id }`.

---

## 3. Opérer le pipeline (runbook)

```bash
cd /home/ubuntu/aphrody/packages/x
set -a; . /home/ubuntu/aphrody/.env; set +a   # charge GEMINI_API_KEY (secret, ne jamais l'afficher)

# 1. État du store
sqlite3 /home/ubuntu/.aphrody/x-store.sqlite \
  "SELECT 'tweets',count(*) FROM tweets UNION ALL SELECT 'embeddings',count(*) FROM tweet_embeddings;"
redis-cli VCARD tweet_embeddings

# 2. Crawl frais (borner la durée, ~3 min suffisent pour un run)
timeout 220 bun run src/bin/run-targeted-crawler.ts

# 3. Compléter les embeddings manquants (boucle ; sortir au Ctrl-C)
timeout 45 bun run src/bin/run-index-embeddings.ts

# 4. Interroger le métagame
bun run src/bin/run-rag.ts --query "Quels sont les top tier blades actuels en Beyblade X ?"
```

> **IP datacenter du VPS** : l'auth GraphQL via cookies fonctionne (whoami OK). Si X renvoie un challenge/403/0 nouveau tweet, c'est la session qui a expiré — rafraîchir `x-session.json`, ne pas conclure à un succès silencieux.

---

## 4. Écosystème X complet (au-delà du module Bun)

Le pipeline crawl→RAG décrit ci-dessus (§1–3) n'est qu'**une** des couches. Tout l'écosystème X vit dans le **monorepo aphrody** (`github.com/aphrody-code/aphrody`, remote `origin = /home/ubuntu/aphrody.git`) et **partage le même store** `~/.aphrody/x-store.sqlite` + la même session `x-session.json` + le même vector set Redis `tweet_embeddings`.

| Couche                    | Emplacement                                              | Rôle                                                                                                                                                        |
| ------------------------- | -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Crawl/RAG Bun**         | `aphrody/packages/x/` (`@aphrody-code/x`)                | la couche opérationnelle de ce guide : crawl ciblé, embeddings Gemini 768d, RAG hybride VSIM+FTS5. C'est ce que pilote ce document.                         |
| **Client natif Rust**     | `crates/aphrody-x-client` (bin `aphrody-x`)              | framework de contrôle de compte headless complet (lib + CLI).                                                                                               |
| **Canal messaging Rust**  | `crates/aphrody-messaging/src/channels/x.rs`             | adaptateur `MessagingChannel` qui **shell-out** le binaire `aphrody-x` (post/timeline) ; ne relie pas la lib (bug CSRF `ct0` des libs upstream non résolu). |
| **Classification Python** | `aphrody/scripts/classify_tweets.py`                     | analytique post-hoc (pas dans le chemin RAG).                                                                                                               |
| **Cache**                 | Redis 8.x (vector set) + SQLite (FTS5 + BLOB)            | retrieval cosinus + plein-texte.                                                                                                                            |
| **Docs canoniques**       | `aphrody/docs/x/{README,architecture,commands,store}.md` | spec détaillée des couches Rust.                                                                                                                            |

### A. Client natif Rust `aphrody-x` (`crates/aphrody-x-client`)

Binaire Rust cross-platform unique (Linux #1, Windows, macOS), **sans navigateur, sans clé API, sans developer portal** — il drive un compte entier depuis les seuls cookies (`auth_token` + `ct0`). Sortie JSON par défaut (`--plain` pour l'humain). Surpasse les références `@steipete/bird` (CLI) et `steipete/birdclaw` (archive locale).

- **Auth** : trois signaux coopérants par requête — `Cookie: auth_token; ct0`, header `X-Csrf-Token: <ct0>` (double-submit, doit être identique au cookie), `Authorization: Bearer <web_bearer>` (bearer public statique du bundle JS). Plus des marqueurs browser-like (`x-twitter-active-user`, `x-client-uuid`, `x-client-transaction-id` aléatoire 32-hex…). Résolution des creds : `--cookie-string`/`X_COOKIE_STRING` → `~/.aphrody/x-session.json` → `X_AUTH_TOKEN`+`X_CT0`.
- **Cœur de résilience — auto-refresh des `queryId`** : catalogue embarqué de **158 ops GraphQL** (`data/x-graphql-catalog.json`) ; X tourne les `queryId` à chaque nouveau bundle web. `runtime_query_ids.rs` les redécouvre depuis les bundles `abs.twimg.com/.../*.js` (client **non authentifié**), cache 24h (`<config>/aphrody/x/query-ids-cache.json`), et **recovery POST-hybride sur 404** : une query qui 404 est rejouée en POST-hybride (variables en URL, `{features,queryId}` en body) avant de payer un refresh — c'est ainsi que `SearchTimeline` est servi et que le client survit aux rotations sans recompile (`aphrody-x query-ids --refresh`).
- **47 sous-commandes** (`docs/x/commands.md`) : écriture (`post`/`reply`/`delete`/`note`/`upload-media`, fallback legacy `statuses/update.json` sur erreur `226`), engagement (`like`/`retweet`/`bookmark`/`pin`/`follow`/`block`/`mute`/`dm`), lecture paginée (`read`/`thread`/`replies`/`search`/`user-tweets`/`home`/`likes`/`bookmarks`/`mentions`/`following`/`followers`/`list-timeline`/`news`), invocateur générique `graphql <Op>` sur les 158 ops, diagnostics (`whoami`/`check`/`rate-limit`/`catalog`/`query-ids`).
- **Store local-first** (`docs/x/store.md`) — **même fichier** que le pipeline Bun : `~/.aphrody/x-store.sqlite` (SQLite bundlé, FTS5). Tables `tweets`/`users`/`edges`/`follows`/`tweets_fts`/`tweet_embeddings`. `aphrody-x sync <authored|likes|bookmarks|timeline|mentions|graph>` paginate le live dans le store (dédup par id, upsert in-place) ; `db search` (FTS5), `db digest` (déterministe), `db export` (json/jsonl/md), `graph mutuals`/`non-mutual-following` (set-ops SQL, 0 quota API), `import archive` (export officiel Twitter), `jobs` (snippet scheduler cross-OS : schtasks/launchd/systemd, jamais installé automatiquement).
- **Honnêteté rate-limit** : les caps sont **server-side par compte** (ex. `344` daily cap) — aucun client ne les contourne ; `aphrody-x` capture les `x-rate-limit-*` et expose les caps durs en `XError::Api{code,message}`.
- **Build** : `cd crates/aphrody-x-client && cargo build --release` (workspace auto-rooté, `Cargo.lock` propre).

> Deux clients X coexistent volontairement : le **Bun** (`packages/x`, ce guide — orienté crawl de masse + embeddings + RAG) et le **Rust** (`aphrody-x` — contrôle de compte généraliste 158 ops + archive birdclaw-class). Ils écrivent dans le **même store**, donc archive + crawl + sync fusionnent et se dédupliquent proprement.

### B. Classification Python (`scripts/classify_tweets.py`)

Analytique **hors chemin RAG** : lit `~/.aphrody/x-store.sqlite`, nettoie le texte (strip URLs), classe chaque tweet par **regex bilingues EN/JP** en topics métagame — _Stamina meta_ (`wizard rod`, `ball`, `hexa`, `leon crest`, `black shell`…), _Attack strategy_ (`cobalt drake`, `dran sword/buster`, `shark edge`, `weiss tiger`, `xtreme finish`…), _parts complaints_ (`shatter`, `crack`, `teeth wear`, 壊れた/破損/摩耗…), _tournaments_, _other_ — calcule engagement + impact-followers, et exporte un JSON + un rapport markdown (sous `~/.gemini/antigravity-cli/brain/…`). Sert l'analyse de tendances, pas la réponse RAG temps réel.

---

## 5. État live (dernière opération vérifiée — 2026-05-29)

Pipeline exécuté de bout en bout (auth `@mbapessi91`, IP VPS **non** bloquée en GraphQL authentifié) :

|                                      | tweets   | users | embeddings SQLite | Redis `VCARD` |
| ------------------------------------ | -------- | ----- | ----------------- | ------------- |
| avant                                | 7018     | 10258 | 7017              | 7017          |
| après crawl ciblé (+1 run, cap 220s) | **7490** | 10258 | **7490**          | **7490**      |

Invariant sain : `tweets == embeddings SQLite == Redis` (0 tweet sans vecteur). RAG validé en live sur 3 questions métagame — retrieval VSIM → réhydratation SQLite → expansion de thread → génération `gemini-2.5-flash`, réponses **ancrées** citant de vrais tweets (ex. tier-lists @Chillaccinoo, rapports tournoi @kio_moe / @DeltyThe73rd sur bits AP660H/WW160R, String Launcher). Reproduire : §3 (runbook).
