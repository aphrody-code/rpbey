---
title: "bxc — Serveur MCP"
description: "Serveur MCP stdio bxc-native-mcp : installation, 6 outils exposés et cas d'usage agent."
scope:
  - packages/challonge
status: "stable"
last_updated: "2026-05-29"
related_symbols:
  - bxc_scrape_markdown
  - bxc_search
  - bxc_cdp_evaluate
  - bxc_detect_frameworks
  - bxc_google_fetch
---

# bxc — Serveur MCP

Serveur stdio JSON-RPC (`/home/ubuntu/bxc/src/mcp/server.ts`, nom `bxc-native-mcp`)
exposant le moteur bxc à un agent. Binaire compilé self-contained :
`/home/ubuntu/bxc/dist/standalone/bxc-mcp` (rebuild : `bun run build:mcp`).

## Installation (faite, scope user)

```bash
claude mcp add bxc -s user \
  -e BXC_MEMORY_DB=/home/ubuntu/.bxc/mcp-memory.sqlite \
  -- /home/ubuntu/bxc/dist/standalone/bxc-mcp
claude mcp list        # → bxc: … ✓ Connected
```

Disponible dans tous les projets (scope `user`). Pour le retirer :
`claude mcp remove bxc -s user`.

## Outils exposés

| Outil                   | Entrée                                               | Sortie                                                                                                                |
| ----------------------- | ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `tune_memory_sqlite`    | `{action:"get"\|"set", key, value?}`                 | mémoire persistante SQLite (`BXC_MEMORY_DB`).                                                                         |
| `bxc_scrape_markdown`   | `{url, profile?: static\|fast\|http\|stealth}`       | page → GFM Markdown (défaut `static`).                                                                                |
| `bxc_detect_frameworks` | `{url}`                                              | frameworks + protections anti-bot (profil `http`).                                                                    |
| `bxc_cdp_evaluate`      | `{url, script, profile?}`                            | exécute du JS dans la page via V8 (défaut `stealth`).                                                                 |
| `bxc_search`            | `{query, num?, hl?, gl?, domain?, vertical?, rich?}` | Google Web Search → organic + (si `rich`) featured/knowledge/PAA/related. Auth auto via `~/.bxc/cookies/google.json`. |
| `bxc_google_fetch`      | `{url, profile?}`                                    | Markdown + métadonnées structurées (JSON-LD, OpenGraph, Twitter cards, canonical, meta description) en une passe.     |

## Quand l'utiliser

- **`bxc_search`** : toute recherche web / fact-finding / actualité — préférable
  à un scrape manuel.
- **`bxc_scrape_markdown`** : récupérer le contenu d'une page en Markdown
  bas-token (profil `static` si HTML SSR, `fast`/`stealth` si SPA).
- **`bxc_google_fetch`** : besoin du contenu **et** des métadonnées machine d'une page.
- **`bxc_detect_frameworks`** : savoir quelle stack / quel WAF protège une cible
  avant de choisir le profil.
- **`bxc_cdp_evaluate`** : extraire une valeur précise via du JS dans la page.

## Notes

- Les outils `static`/`http`/`search`/`google_fetch` sont **autonomes** (pas
  besoin de `bxc-engine`). `bxc_cdp_evaluate` (profil `stealth`) et
  `bxc_scrape_markdown --profile fast/stealth` réclament le moteur natif
  (cf. [README §4](./README.md#4-piège-1--le-moteur-bxc-engine-nest-pas-livré-par-bxc-install)).
- Le serveur tourne sous **bun** (binaire compilé via `bun build --compile`).
