# Guide de Crawling & RAG X.com (Twitter)

Ce document décrit le fonctionnement et la structure du système de crawling autonome et de RAG (Retrieval-Augmented Generation) pour extraire, stocker et exploiter les discussions stratégiques Beyblade X depuis x.com.

---

## 1. Session de Crawling x.com
Le crawler autonome effectue des requêtes structurées en mimant un navigateur réel pour contourner le rate limit (avec des cookies injectés dans la session).

### A. Mécanisme de Session (`XSession` & `XClient`)
* **Localisation du code** : `packages/x/src/core/session.ts` et `client.ts`.
* **Authentification** : Utilise les cookies de session injectés (`auth_token`, `ct0`, `__cf_bm`, etc.) pour s'authentifier.
* **Navigation** : Le `XClient` implémente des requêtes HTTP directes vers l'API interne de Twitter/X (GraphQL et endpoints de recherche/timeline) avec des en-têtes d'impersonation (ex. agents utilisateurs réalistes).

### B. Algorithme de Crawling Ciblée (`Crawler`)
* **Localisation** : `packages/x/src/services/crawler.ts`.
* **Fonctionnement** :
  1. Utilise des utilisateurs "seeds" de départ (ex. `@zankye`, `@Chillaccinoo`) et des hashtags spécifiques (ex. `#BeybladeX`).
  2. Parcours la timeline de tweets de ces cibles.
  3. Extrait dynamiquement de nouvelles cibles (nouveaux comptes mentionnés, hashtags) dans le texte des tweets pour les insérer dans la file d'attente (`queueUsers`).
  4. Sauvegarde les tweets et les profils utilisateurs correspondants dans le magasin local SQLite (`x-store.sqlite`).
  5. Applique un délai de politesse (`delayMs`, par défaut 5s) entre chaque requête.

---

## 2. Système RAG (Retrieval-Augmented Generation)
Le RAG permet de répondre à des questions complexes sur le métagame Beyblade X (ex. *"Quel est le meilleur combo pour Wizard Rod ?"*) en se basant uniquement sur la base de connaissances fraîchement crawlée.

### A. Indexation des Embeddings
* **Modèle d'embedding** : `gemini-embedding-001` via l'API Gemini (vecteurs à 768 dimensions).
* **Base vectorielle** : Un index vectoriel dans Redis (`tweet_embeddings`) stocke les embeddings des tweets nettoyés pour permettre des recherches par similarité cosinus ultra-rapides.
* **Script de build/indexation** : `packages/x/src/bin/run-index-embeddings.ts` génère les embeddings manquants et peuple l'index Redis.

### B. Moteur de Recherche RAG (`BeybladeXRag`)
* **Localisation** : `packages/x/src/services/rag.ts`.
* **Étapes de résolution d'une requête blader** :
  1. **Extraction de Mots-Clés** : Un appel léger à `gemini-2.5-flash` extrait les 3 à 5 mots-clés de recherche depuis la question de l'utilisateur.
  2. **Recherche Vectorielle (Retrieval)** : Interroge l'index Redis via la commande `VSIM` sur `tweet_embeddings` avec le vecteur de la question pour récupérer les 15 tweets les plus pertinents.
  3. **Recherche Textuelle FTS (Fallback)** : En cas d'absence d'API ou de Redis, effectue un `FTS5 MATCH` en SQLite sur les mots-clés extraits.
  4. **Génération de la Réponse** : Injecte les tweets sources dans le prompt système de `gemini-2.5-flash` :
     ```text
     [Contexte de tweets récupérés]
     ---
     Question: [Question du blader]
     Réponds de manière précise en te basant uniquement sur le contexte ci-dessus.
     ```
  5. Retourne la réponse structurée ainsi que la liste des tweets sources originaux (auteurs, likes, textes).
