---
title: "Gacha — Pipeline d'assets (catalogue)"
description: "Chaîne Bun-native scrape→optim→classif→montage→publication Discord pour le catalogue de cartes gacha."
scope:
  - apps/bot
  - apps/web
status: "stable"
last_updated: "2026-06-04"
related_symbols:
  - scrape-channel.ts
  - build-gacha-json.ts
  - render-cards.ts
  - post-gacha.ts
---

# Gacha — Pipeline d'assets (catalogue)

Chaîne d'outils pour construire le **catalogue des cartes** à partir du salon WIP Discord des artistes : scrape → optimisation → classification → montage sur le template → publication forum. 100 % Bun natif, dans `apps/bot/scripts/`. Données produites sous `apps/bot/data/scrape/<channelId>/` (**gitignored**).

```
salon Discord (WIP artistes)
  └─ scrape-channel.ts      → messages.jsonl + images/ (+ images-manifest)
       └─ optimize-images.ts → images-opt/ (PNG lossless oxipng · JPEG→WebP cwebp)
            └─ build-gacha-json.ts (+ gacha-overrides.json + extra-cards.json)
                 → gacha.json (classifié, trié, exclusions)
                 └─ render-cards.ts → images-card/<slug>.png (montées sur le template de soupy)
                      └─ post-gacha.ts → forum Discord (1 post/perso : carte + WIP) + résumé
```

## 1. `scrape-channel.ts` — récupération

Historique complet d'un salon en **REST Discord v10 brut** (pas discord.js : pas de gateway, mémoire plate). `fetch` natif + `Bun.write(dest, response)` (stream sur disque). Token via `DISCORD_TOKEN` (`.env` auto-chargé), jamais en argument. Pagination `before`, respect rate-limit (`x-ratelimit-*` + 429), reprise (skip fichiers existants). Flags : `--channel --concurrency --all --embeds --no-images --since/--days/--hours --max --force`.
Sortie : `messages.jsonl` (1 msg/ligne), `images/`, `images-manifest.jsonl`.

## 2. `optimize-images.ts` — compression

- **PNG → PNG lossless** via `oxipng` (Rust, sans perte).
- **JPEG → WebP** via `cwebp -q 90` ; **GIF → WebP** via `gif2webp`.
- Pool `Bun.spawn` borné au nb de cœurs. Originaux conservés (`images/`), sorties dans `images-opt/`, mapping `optimized-manifest.jsonl`.
Flags : `--channel --quality --oxipng --force`.

## 3. `build-gacha-json.ts` — classification

Construit `gacha.json` (1 entrée/image) :
- **artist** = auteur du message.
- **character / rarity / series / kind / status / note** = fusionnés depuis **`gacha-overrides.json`** (analyse curée, clé = `attachmentId`). Sinon `character` déduit heuristiquement du nom de fichier (jamais inventé → `null` + `needsReview`).
- `exclude:true` dans l'override → image **retirée** du catalogue (hors histoire).
- **`extra-cards.json`** → cartes **dérivées/manuelles** (ex. découpe d'illustration) ajoutées au catalogue.
- `kind ∈ {card, illustration, template, portfolio, meme}` ; tri : cartes d'abord (rareté LR>SR>R), puis perso, dessinateur, date.
- `image` pointe sur la version optimisée (`images-opt/…`), `original` sur le brut.

Fichiers de données associés (dans le dossier scrape, gitignored) :
- `gacha-overrides.json` — la classification curée (vision + contexte d'envoi).
- `extra-cards.json` — cartes dérivées (ex. `Kai Hiwatari` SR = moitié gauche du duo).

Flags : `--channel --dir --overrides --extra --all --out`.

## 4. `render-cards.ts` — montage sur le template de soupy

Composite la **meilleure illustration de chaque perso** (final > wip > lineart > sketch) **dans le cadre** (template à corps transparent) via **ImageMagick**, + nom (header) et rareté·série (footer) en `caption:` auto-ajusté (les noms longs ne débordent pas).

- Template = entrée `kind:"template"` de `gacha.json` (cadre **4961×7016**, corps transparent **x[200..4760] y[860..5760]**, bandeaux bordeaux).
- Cadrage **uniforme** : crop `gravity north` (garde le visage). Sortie **toutes 1240×1754** (ratio √2 du template).
- Produit `images-card/<slug>.png` + `images-card/_frame.png` (cadre redimensionné) + `cards-manifest.json` (character → fichier).
Flags : `--channel --width --force`.

## 5. `post-gacha.ts` — publication Discord

Poste via le **bot RPBey** (REST v10 multipart). Détection du type de salon : **texte** → 1 message/groupe ; **forum/media (15/16)** → 1 **post (thread)** par perso. Chaque post = **carte encadrée** (depuis `cards-manifest.json`) en tête + étapes WIP brutes derrière. Le template nu, le hors-histoire (portfolio/meme) ne sont pas postés.
- `--summary` : poste le résumé règles/lore/vibe (`gacha-summary.md`, découpé sur `@@@`) dans un salon texte.
- `--purge` : supprime d'abord les posts existants du bot dans le forum (re-publication propre).
Token via `.env`. Rate-limit + retry. Flags : `--channel --catalog --summary --purge --dry`.

## Exécution type

```bash
cd apps/bot
bun scripts/scrape-channel.ts   --channel=<srcId>
bun scripts/optimize-images.ts  --channel=<srcId>
bun scripts/build-gacha-json.ts --channel=<srcId>      # lit overrides + extra-cards
bun scripts/render-cards.ts     --channel=<srcId> --force
bun scripts/post-gacha.ts       --channel=<srcId> --catalog=<forumId> [--summary=<txtId>] --purge
```

## Ajouter une carte dérivée (ex. découper une illustration)

1. Découper l'image (ImageMagick `-crop`), déposer le résultat dans `images/`.
2. Ajouter une entrée dans `extra-cards.json` (`image, character, series, rarity, kind, status, artist, note`).
3. `build-gacha-json` → `render-cards --force` → `post-gacha --purge`. Tout reste **uniforme** (même cadre, même 1240×1754).

> Ces scripts servent à **produire les visuels** du catalogue ; ils sont indépendants du gameplay (web/`:5050`). Les cartes finalisées peuvent ensuite alimenter `gacha_cards.imageUrl` une fois le pipeline de jeu prêt.
