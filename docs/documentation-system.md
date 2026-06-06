---
title: "Système de documentation (structuré, automatisé, sync)"
description: "Convention frontmatter, commandes docs.ts et hook git qui gardent la doc typée et synchronisée avec le code."
scope:
  - scripts
status: "stable"
last_updated: "2026-06-04"
related_symbols:
  - FrontmatterSchema
  - buildMap
  - buildIndex
---

# Système de documentation (structuré, automatisé, sync)

Toute la doc du monorepo est gérée par **`scripts/docs.ts`** — outil 100 % Bun-natif,
sans dépendance externe hormis `zod` (déjà dans le workspace). Trois garanties :

| Pilier | Mécanisme |
| --- | --- |
| **Structuré** | frontmatter Zod-typé **obligatoire** sur tout `docs/**` (hors fichiers générés) |
| **Automatisé** | `docs/README.md` (index) et `docs/REPO_MAP.md` (cartographie) **générés** depuis les frontmatters et les `package.json` |
| **Sync** | drift code↔doc détecté via git ; fichiers générés et `scope` validés à chaque `check` |

## Frontmatter — schéma obligatoire

Chaque fichier sous `docs/` (sauf `README.md` et `REPO_MAP.md`, générés) commence par :

```yaml
---
title: "Titre exact du H1"            # doit être identique au « # … » du corps
description: "Résumé une-ligne pour le tri de pertinence par un agent."
scope:                                 # chemins repo-relatifs documentés — tous validés présents
  - apps/web
  - packages/db
status: "stable"                       # stable | draft | generated | deprecated
last_updated: "2026-05-29"             # ISO court (YYYY-MM-DD), date de dernière revue
related_symbols:                       # optionnel — exports/tables/fonctions clés
  - executeCardPullTx
---
```

Le schéma est `strict` : une clé non prévue ou un champ manquant fait **échouer** `check`.

## Commandes

| Commande | Effet |
| --- | --- |
| `bun run docs` | umbrella : régénère map + index, normalise, puis `check` (à lancer après tout changement de doc/package) |
| `bun run docs:check` | audit complet — **exit 1** si erreur dure (le gate) |
| `bun run docs:map` | (re)génère `docs/REPO_MAP.md` depuis les `package.json` |
| `bun run docs:index` | (re)génère `docs/README.md` (index + statut + description) |
| `bun run docs:fmt` | normalise le format (LF, pas d'espace en fin, 1 newline finale) |
| `bun run docs:list` | liste les docs suivies (chemin, statut, titre) |

## Catégories de findings

**Durs** (bloquent `check`) : `render` (CommonMark/GFM), `link` (lien interne cassé),
`format`, `frontmatter` (absent/invalide), `scope` (chemin inexistant), `generated`
(index/REPO_MAP obsolète sur disque).

**Warnings** (informatifs) : `orphan` (aucun lien entrant), `stale` (code du `scope`
modifié après `last_updated` — relire & bumper la date), `title` (frontmatter ≠ H1).

La détection `stale` interroge git : `git log -1 --format=%cs -- <scope>`. Si le dernier
commit touchant le périmètre est postérieur à `last_updated`, le doc est probablement
à rafraîchir.

## Automatisation — hook pré-commit

`.githooks/pre-commit` (activé par `core.hooksPath`, posé par le script `prepare`)
se déclenche dès qu'un commit touche un `.md`, un `package.json` ou `scripts/docs.ts` :
il régénère map + index, normalise, re-stage les fichiers concernés, puis lance `check`
et **bloque le commit** en cas d'erreur dure. Zéro dépendance, zéro husky.

## Ajouter / déplacer une doc

1. Créer le fichier sous `docs/<thème>/` avec le frontmatter ci-dessus.
2. Lancer `bun run docs` (régénère l'index qui le référence, vérifie tout).
3. Commiter — le hook revalide.

Le `scope` est le contrat de synchronisation : il doit lister les chemins réels que
le doc décrit. Supprimer un package documenté fait échouer `check` (scope inexistant),
ce qui force la mise à jour de la doc.
