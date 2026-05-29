---
title: "bxc — API TypeScript"
description: "Référence de l'API TypeScript bxc : Browser.newPage, Page, profil ghost et interop Puppeteer."
scope:
  - packages/challonge
status: "stable"
last_updated: "2026-05-29"
related_symbols:
  - Browser.newPage
  - ImpersonatedClient
  - launchGhostBrowser
  - HttpPage
---

# bxc — API TypeScript

Import : `@aphrody-code/bxc` (publié sur GitHub Packages) ou depuis la source
`/home/ubuntu/bxc/src/api/browser.ts`. Surface proche de Puppeteer, mais le
transport dépend du **profil** (cf. [README §1](./README.md#1-profils-le-concept-central)).

## `Browser.newPage(opts)`

```ts
import { Browser } from "@aphrody-code/bxc";

const page = await Browser.newPage({ profile: "static" });
await page.goto("https://example.com");
console.log(await page.title());
console.log(await page.markdown()); // HTML → GFM Markdown
await page.close();
```

### `PageOptions`

| Champ       | Type                                                 | Détail                                                                                                    |
| ----------- | ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `profile`   | `"static" \| "http" \| "fast" \| "stealth" \| "max"` | prioritaire sur `mode`. Décide du transport.                                                              |
| `mode`      | `"static" \| "full"`                                 | `full` ⇒ `fast`.                                                                                          |
| `headless`  | `boolean`                                            | défaut Linux `true`, Windows `false`.                                                                     |
| `viewport`  | `{width,height}`                                     | transmis en mode full.                                                                                    |
| `userAgent` | `string`                                             | header en `static`/`http`, CDP en full.                                                                   |
| `httpOpts`  | `{ profile: "chrome131", timeoutMs }`                | options curl-impersonate (profil `http`).                                                                 |
| `insecure`  | `boolean`                                            | bypass TLS.                                                                                               |
| `cookies`   | `string \| Cookie[]`                                 | **clé pour bypass** : chemin de jar (Playwright/CDP/Netscape) ou tableau. Injecté avant toute navigation. |

### Type de retour selon le profil

- `static` / `fast` / `stealth` / `max` → `Page` (CDP, DOM-capable).
- `http` → `HttpPage` (curl-impersonate, **pas de DOM/JS** : `$`, `evaluate`,
  `screenshot` lèvent une erreur explicite ; `content()`/`markdown()`/`title()` OK).

## Méthodes `Page`

`goto(url, {waitUntil, timeoutMs, referer})` · `title()` · `content()` (outerHTML) ·
`markdown()` · `setContent(html)` · `evaluate(fn, arg)` · `screenshot({format,quality,fullPage})`
(profils JS only) · `pdf()` (fast) · `$(sel)` / `$$(sel)` · `click(sel)` ·
`type(sel, text)` · `waitForSelector(sel, timeoutMs)` · `locator(sel)` ·
`addCookies([...])` / `getCookies(urls?)` / `clearCookies(filter?)` ·
`route(pattern, handler)` / `unroute()` / `blockResources(["image","font","media"])` ·
`close()` (+ `await using` via `Symbol.asyncDispose`).

## Cookies pré-authentifiés (bypass Cloudflare / checkpoint)

```ts
const page = await Browser.newPage({
  profile: "http",
  cookies: "./cookies/private/challonge.json", // jar exporté d'un vrai navigateur
  httpOpts: { profile: "chrome131" },
});
await page.goto("https://challonge.com/fr/B_TS5");
```

Comportement : `http` ⇒ header `Cookie:` (RFC 6265 domain/path) ; `static`/`fast`
⇒ `Network.setCookies` via CDP. Sert à **rejouer une session validée** (login,
clearance Cloudflare/Vercel).

## Profil `ghost` (anti-détection)

`src/profiles/ghost/` — Lightpanda + suite de patches stealth CDP + fingerprint
cohérent (UA, viewport, locale, timezone, vendor/renderer WebGL). ~80 ms cold,
40 MB RSS.

```ts
import { launchGhostBrowser } from "@aphrody-code/bxc/profiles/ghost";

const ghost = await launchGhostBrowser({
  fingerprint: { os: "linux", browser: "chrome", version: 131 },
  locale: "fr-FR",
  timezone: "Europe/Paris",
  cookies: "./cookies/private/site.json",
});
await ghost.page.goto("https://nowsecure.nl");
await ghost.close();
```

## Interop Puppeteer

```ts
import puppeteer from "puppeteer-core";
import { Browser } from "@aphrody-code/bxc";

const b = await puppeteer.connect({ transport: Browser.transport() });
const page = await b.newPage();
await page.goto("data:text/html,<h1>hi</h1>");
```

Utile pour piloter le transport bxc avec une logique Puppeteer existante (waits,
boucles de résolution de challenge, etc.).
