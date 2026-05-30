---
title: "Connaissance Beyblade — crawler wiki, entité canonique & graphe de liens"
description: "Le pipeline de connaissance rpbey : crawler MediaWiki exhaustif (toutes saisons), module d'entité canonique, combos enrichis, graphe d'entités cross-linké et son câblage dans la recherche + les pages produit/anime/builder."
scope:
  - apps/web/scripts/crawl-fandom.ts
  - apps/web/scripts/enrich-combos.ts
  - apps/web/src/lib/beyblade-entity.ts
  - apps/web/src/server/services/entity-graph.ts
  - apps/web/src/server/services/global-search.ts
status: "stable"
last_updated: "2026-05-30"
related_symbols:
  - canonicalKey
  - lookupTier
  - getProductIntel
  - getGenerationShowcase
  - loadWikiKnowledge
  - buildGlobalSearchIndex
---

# Connaissance Beyblade — crawler wiki, entité canonique & graphe de liens

rpbey.fr unifie **toute la connaissance Beyblade, toutes saisons confondues** (Original/
Plastic, HMS, Metal Saga, Burst, Beyblade X) autour d'un **module d'entité canonique** et
d'un **graphe de liens** qui relie, pour chaque toupie/blade, les faits jusque-là éparpillés :
catalogue boutiques, pièces DB, méta WBO, combos gagnants, buzz communautaire, fiche
encyclopédique wiki et voisins sémantiques denses.

## 1. Module d'entité canonique — `lib/beyblade-entity.ts`

**Source de vérité UNIQUE** (pur, partagé client + serveur), qui élimine trois duplications
historiques (une `normalizeName` ad-hoc dans 3 fichiers, les tables de tier en double, le
parsing de combo) :

- `canonicalKey(name)` — minuscule + NFKD + **repli JP→EN conservateur** (`{{nihongo}}`,
  katakana → nom EN de la **même** blade, jamais une autre) + retrait des mots-marques +
  suppression non-alphanumérique. « Wizard Rod », « wizard-rod », « ウィザードロッド » →
  `wizardrod`. Ne fusionne jamais deux entités distinctes (Wizard Rod ≠ Wizard Arrow).
- `lookupTier(name, type?)` — tier WBO (S/A/B/C) par clé canonique, tables blade/ratchet/bit
  consolidées (ex-dupliquées dans `global-search` et `recommendation-engine`). Repli sur
  l'abréviation de bit (`F`, `3-60F`).
- `parseCombo(label)` / `combinedComboScore(...)` — découpe « Blade 3-60 F » et score méta
  combiné (60 % meilleur composant + 40 % moyenne).
- `TIER_COLOR` / `TIER_RANK` — réutilisés par les badges UI (cohérence).

## 2. Crawler MediaWiki exhaustif — `scripts/crawl-fandom.ts`

Crawler de **`beyblade.fandom.com`** (MediaWiki 1.43, ~8 556 articles).

> ⚠️ Contrairement aux pages HTML (Cloudflare) / Reddit / WBO qui sont **403 sur l'IP VPS
> datacenter**, l'API `api.php` est **directement joignable** (simple `fetch` + UA Chrome).
> Inutile d'invoquer bxc/curl-impersonate ici (le package `@aphrody-code/bxc` 0.3.1 installé
> n'a d'ailleurs pas la lib native `vendor/curl-impersonate` → `ImpersonatedClient` throw).

Méthode (« le meilleur crawler possible ») :

1. **Énumération** : `list=allpages` (namespace 0, non-redirects) → tous les pageids.
2. **Bulk props 50/req** : `categories | pageimages(original) | revisions(content)`.
3. **Parse infobox** : 1er template `{{…}}` (accolades équilibrées + split des champs
   respectant `{{}}`/`[[]]` imbriqués).
4. **Classification** depuis catégories + infobox :
   - **type** : `bey | character | part | anime | episode | game | accessory | lore`
   - **génération** : `ORIGINAL | HMS | METAL | BURST | X`
   - **spin** (RIGHT/LEFT/DUAL), **beyType** (Attack/Defense/Stamina/Balance), **nom JP**,
     **système**.
5. **Résumé** : dérivé du wikitext (Fandom n'a **pas** l'extension TextExtracts ; `{{nihongo}}`
   résout le nom EN pour ne pas amputer le résumé).

**Robustesse** : `maxlag` + retry/backoff (429/5xx/maxlag), **checkpoint résumable**
(`data/.fandom-crawl-state.json`, gitignored), écriture **non-destructive**, validation Zod
(`WikiEntitySchema` dans `@rpbey/api-contract`).

**Sortie** — `data/beyblade-knowledge.json` (~10 Mo, committé) :

| | |
|---|---|
| Entités | **8 459** (rétention 99 %) |
| Par type | bey 3826 · part 1116 · character 896 · episode 852 · lore 835 · anime 607 · accessory 204 · game 123 |
| Par génération | BURST 3353 · METAL 1651 · ORIGINAL 966 · X 926 · HMS 32 |
| Qualité | images 88 % · résumés 97 % |

Commandes :

```bash
bun apps/web/scripts/crawl-fandom.ts            # crawl complet (~146 s)
FANDOM_LIMIT=300 bun apps/web/scripts/crawl-fandom.ts   # échantillon (test)
FANDOM_RESET=1   bun apps/web/scripts/crawl-fandom.ts   # ignore le checkpoint (re-parse)
```

## 3. Combos enrichis — `scripts/enrich-combos.ts`

Joint les combos gagnants WBO (`wbo-combos.json`, 4045 uniques) à la méta (`bbx-weekly.json`)
et au buzz communautaire (`meta-enrichment.json`) → `data/wbo-combos-enriched.json` (top 600
par qualité, `EnrichedComboSchema`). Catalog-agnostic : la jointure prix/lien d'achat se fait
au runtime côté serveur. Score qualité = méta combinée (50) + fréquence log (25) + taux de
victoire (25).

## 4. Graphe d'entités — `server/services/entity-graph.ts`

Jointure **runtime** mémoïsée (chargée ≤ 1×/process, dégradation gracieuse par branche) :

- `getProductIntel(group)` → `{ blade, tier, metaScore, community, topCombos, related, wiki }` :
  - **tier + score méta** (tables canoniques + `bbx-weekly`),
  - **buzz communautaire** (`meta-enrichment`),
  - **top combos gagnants** contenant la blade (`wbo-combos-enriched`),
  - **produits proches** = voisins du vecteur dense (`embeddings.vectorNeighborsById`, `VSIM …
    ELE` — aucun appel sidecar, le vecteur est déjà stocké),
  - **fiche wiki** (génération, type, système, JP, résumé) via `wikiByKey()`.
- `getGenerationShowcase(generation)` → beys + personnages + jeux d'une génération (page anime).

## 5. Câblage dans la recherche — `global-search.ts`

`loadWikiKnowledge(seenTitles, seenKeys)` lit `beyblade-knowledge.json`, **subsume** les
ex-streams `universe_beys`/`universe_characters`, et mappe le type wiki vers les **catégories
EXISTANTES** du contrat (aucune nouvelle catégorie → onglets de recherche M3 inchangés) :

| type wiki | catégorie | badge |
|---|---|---|
| bey | product | Bey · `<gen>` |
| part | part | Pièce · `<gen>` |
| character / anime / episode | anime | Personnage / Anime / Épisode |
| game / accessory | product | Jeu vidéo / Accessoire |
| lore | lexicon | Lore |

Dédup canonique des beys/pièces vs catalogue/DB (mute les doublons) ; résumé tronqué au mot
(220 c) dans l'item (l'index complet est fetché côté client). **Corpus : 9 018 → 17 082 items.**

## 6. Câblage UI (pages liées)

- **`/comparateur/[slug]`** (`ProductIntel`) : Fiche encyclopédique (chips génération/type/
  système/JP + résumé + lien wiki) · Analyse compétitive (tier + score méta + buzz) · Combos
  gagnants en tournoi · Produits similaires (voisins denses).
- **`/anime/[slug]`** (`SeriesCrosslinks`) : « L'univers de cette génération » — toupies +
  personnages + jeux liés (via `getGenerationShowcase`, mapping DB-gen → enum wiki).
- **`/builder`** (`DeckSynergy`) : mètre de synergie méta temps réel (100 % client, table de
  tier canonique pure).

## 7. Procédure de rafraîchissement (ordre)

Après toute mise à jour de données amont :

```bash
cd apps/web
bun scripts/crawl-fandom.ts            # (FANDOM_RESET=1 pour re-parser intégralement)
bun scripts/enrich-combos.ts           # recalcule wbo-combos-enriched.json
bun scripts/refresh-search-corpus.ts   # DEL la clé Redis → rebuild au prochain hit
bun scripts/build-search-vectors.ts    # ré-embedde le corpus (retry/backoff durci)
```

Le sidecar `rpbey-embed` peut couper la connexion sur un pic mémoire (ECONNRESET) ;
`embedBatch` retry avec backoff (≤ 5) pour ne pas avorter l'indexation de ~17 000 items.

Voir aussi : [data-pipeline-best-practices](data-pipeline-best-practices.md),
[metagame-wbo](metagame-wbo.md), [crawling-rag-x](crawling-rag-x.md).
