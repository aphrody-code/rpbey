---
title: "bxc — Recettes"
description: "Recettes pratiques bxc testées sur le VPS : Challonge TLS, checkpoint Vercel, SPA, miroir."
scope:
  - packages/challonge
  - scripts
status: "stable"
last_updated: "2026-06-02"
related_symbols:
  - Browser.newPage
  - bxc-engine
---

# bxc — Recettes

Commandes testées sur ce VPS. Toutes sous **bun**.

## Page statique → Markdown (le plus courant)

```bash
bxc scrape "https://example.com" --markdown
bxc scrape "https://news.ycombinator.com" ".titleline a" --max 30   # CSS → textContent
```

## SPA / page rendue en JS

```bash
# profil fast = Lightpanda/bxc-engine (nécessite bxc-engine compilé, cf README §4)
bun run /home/ubuntu/bxc/src/cli/index.ts scrape "https://spa.exemple" --markdown --profile fast --timeout 60000
```

## Recon complète d'un domaine

```bash
bxc recon "https://design.google" --snapshot-dir /tmp/recon-google
bxc detect "https://challonge.com" --json     # techno + WAF
```

## Recherche Google

```bash
bxc search "beyblade x meta wbo" --num 8 --hl fr --gl FR --markdown
bxc search "who invented beyblade" --rich --json   # + featured snippet / PAA
```

## Bypass TLS-fingerprint (Challonge) — profil `http`

challonge.com filtre le **handshake TLS**. Le profil `http` (curl-impersonate,
JA3/JA4 spoofé) passe sans navigateur :

```bash
bxc challonge "https://challonge.com/fr/B_TS5" --pretty
# ou en lib :
```

```ts
const page = await Browser.newPage({
  profile: "http",
  cookies: "./cookies/private/challonge.json",
});
await page.goto("https://challonge.com/fr/B_TS5");
const html = await page.content();
```

C'est ce que fait `packages/challonge` en prod.

## Checkpoint Vercel (bbxweekly) {#checkpoint-vercel-bbxweekly}

`bbxweekly.com` (source de `/meta`) est derrière le **Vercel Attack Challenge
Mode** : challenge **WebGL/canvas**, pas un filtre IP. Les profils `static`/`http`
renvoient la page « Vercel Security Checkpoint » ; `fast` l'atteint mais ne
résout pas le challenge en one-shot.

**Solution de prod** (`apps/web/scripts/scrape-bbx-weekly.ts`) — chromium système

- stealth + **SwiftShader (WebGL logiciel)** + attente de la résolution, sous
  `xvfb`, exécuté par **bun** :

```bash
cd apps/web
xvfb-run -a --server-args="-screen 0 1400x1000x24" bun scripts/scrape-bbx-weekly.ts        # écrit data/bbx-weekly.json
xvfb-run -a --server-args="-screen 0 1400x1000x24" bun scripts/scrape-bbx-weekly.ts --dry  # dry-run (valide le parsing)
```

Ingrédients qui font passer le challenge (sinon boucle infinie « verifying ») :

```js
puppeteer.launch({
  headless: false, // headful sous xvfb
  executablePath: "/usr/local/bin/chromium",
  userDataDir: "/tmp/bbx-chrome-profile2", // persiste le cookie de clearance
  args: [
    "--use-gl=angle",
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
    "--enable-webgl",
    "--ignore-gpu-blocklist",
    "--disable-blink-features=AutomationControlled",
    "--no-sandbox",
  ],
});
// + puppeteer-extra-plugin-stealth (spoof navigator.webdriver / WebGL vendor)
// + boucle : attendre que document.title ne contienne plus "Checkpoint"/"verifying" (~12 s)
```

**Réutiliser la clearance dans bxc** : une fois le cookie obtenu (profil persistant
ci-dessus, ou export du jar), le rejouer via l'option `cookies` d'un profil
`fast`/`ghost` pour des passes suivantes plus légères.

> `bxc` seul ne franchit pas (encore) ce challenge ici : `static`/`http` n'ont
> pas de JS/WebGL, et `bxc-engine`/Lightpanda en one-shot n'attend pas la
> résolution + n'expose pas de WebGL logiciel fiable sous xvfb. D'où le fallback
> chromium+swiftshader. Le tout reste **bun-only** (chromium = simple binaire
> navigateur, pas node).

## Miroir d'un site

```bash
bxc mirror "https://exemple.fr" /tmp/mirror-exemple --same-origin-only --concurrency 8
```

## Site → API JSON

```bash
bxc api --port 8787 --auth "$TOKEN"     # GET /?url=…&selector=… → JSON
```
