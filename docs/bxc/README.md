# bxc — moteur de navigation « Zero-Spawn » pour agents

> Doc interne rpbey. Source : `/home/ubuntu/bxc` (repo `aphrody-code/bxc`,
> Apache-2.0). Binaire CLI : `/home/ubuntu/.local/bin/bxc`. Consommé par
> `packages/challonge` (`@aphrody-code/bxc`).

`bxc` est un moteur navigateur Bun-natif (Rust + Lightpanda) pour scraper, faire
de la recon, détecter des stacks et franchir des protections anti-bot **sans
spawn de Chromium lourd**. Trois transports : DOM in-process (Rust), HTTP
TLS-fingerprinté (curl-impersonate), et navigateur complet via CDP (Lightpanda /
`bxc-engine`).

- [API TypeScript](./api.md) — `Browser` / `Page`, profils, cookies, ghost.
- [Serveur MCP](./mcp.md) — 6 outils, branché dans Claude Code.
- [Recettes](./recipes.md) — SPA, bypass TLS Challonge, checkpoint Vercel, Google.

---

## 1. Profils (le concept central)

Le profil décide du **transport** utilisé. C'est le seul réglage qui compte.

| Profil               | Moteur                                                                                                         | JS / DOM              | Coût           | Pour quoi                                                                          |
| -------------------- | -------------------------------------------------------------------------------------------------------------- | --------------------- | -------------- | ---------------------------------------------------------------------------------- |
| `static` _(défaut)_  | `StaticDomTransport` (DOM Rust in-process)                                                                     | DOM oui, **JS non**   | ~85 ms / 38 MB | HTML statique, → Markdown, requêtes CSS. Le plus rapide.                           |
| `http`               | `curl-impersonate` (FFI, TLS JA3/JA4)                                                                          | **ni JS ni DOM**      | léger          | Bypass des WAF qui fingerprintent le **handshake TLS** (ex : Challonge). Pur HTTP. |
| `fast`               | Lightpanda / `bxc-engine` via CDP WebSocket                                                                    | **JS + DOM complets** | ~80 ms cold    | SPA, screenshots, PDF, interception réseau.                                        |
| `stealth`            | idem `fast` + patches stealth CDP                                                                              | JS + DOM              | +              | Cibles avec détection d'automation.                                                |
| `max`                | idem, stealth maximal                                                                                          | JS + DOM              | ++             | Cibles les plus dures.                                                             |
| `ghost` _(lib only)_ | `launchGhostBrowser` : Lightpanda + suite de patches stealth + fingerprint cohérent (UA/locale/timezone/WebGL) | JS + DOM              | ~80 ms / 40 MB | Anti-bot « Google-grade ». C'est le mode furtif phare.                             |

> **Règle** : `static` pour du HTML rendu côté serveur ; `http` quand seul le TLS
> est filtré ; `fast`/`stealth`/`ghost` dès qu'il faut exécuter du JS (SPA,
> challenges). `static` **ne franchit jamais** un challenge JS.

---

## 2. CLI

Globales : `--json`, `--insecure`/`-k`, `--proxy <url>`, `--quiet`/`-q`,
`--timeout <ms>` (défaut 30000). Codes de sortie : `0` ok · `1` mauvais usage ·
`65` erreur data/runtime · `70` interne · `130` interrompu. Erreurs sur `stderr`
(`[error] …`), data sur `stdout`.

| Commande                      | Usage                                  | Notes                                                                                                                                                                   |
| ----------------------------- | -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `bxc recon <url>`             | recon one-shot → Markdown              | `--profile static\|fast\|http` (défaut http), `--output <f>`, `--snapshot-dir <d>`, `--screenshot` (force `fast`), `--plain`                                            |
| `bxc detect <url>`            | fingerprint techno / WAF / CMS         | `--wapp-only`, `--json`                                                                                                                                                 |
| `bxc scrape <url> <css>`      | `textContent` des éléments             | `--profile static\|fast\|http`, `--max N`                                                                                                                               |
| `bxc scrape <url> --markdown` | page entière → GFM Markdown            | idem profils                                                                                                                                                            |
| `bxc search <query…>`         | Google Web Search → résultats propres  | `--num`, `--page`/`--start`, `--hl`, `--gl`, `--domain`, `--safe`, `--rich`, `--markdown`/`--json`, `--transport auto\|fetch\|ghost\|http`, `--cookies <f>`/`--no-auth` |
| `bxc serve --cdp-port N`      | serveur CDP in-process                 | `--host`, `--profile`, **`--auto-profile`** (escalade sur 403/Cloudflare), `--proxy`, `--log-level`                                                                     |
| `bxc mirror <url> <dir>`      | miroir complet (HTML+CSS+JS+assets)    | `--profile http\|static\|fast`, `--cookies`, `--concurrency`, `--same-origin-only`, `--max-asset-bytes`, `--user-agent`                                                 |
| `bxc cookies load <jar.json>` | inspecte un cookie jar                 | formats Playwright/CDP/Netscape/EditThisCookie                                                                                                                          |
| `bxc har record\|replay`      | enregistre/inspecte un HAR             |                                                                                                                                                                         |
| `bxc challonge <url>`         | snapshot typé d'un tournoi Challonge   | `--cookies`, `--summary`, `--pretty`                                                                                                                                    |
| `bxc api`                     | expose n'importe quel site en API JSON | `--port` (8787), `--host`, `--auth <token>`                                                                                                                             |
| `bxc install`                 | télécharge Lightpanda (≈124 MB)        | **ne télécharge PAS `bxc-engine`** (cf. §4)                                                                                                                             |
| `bxc chrome fetch\|launch`    | gestion Chromium natif                 | nécessite `bxc-engine` compilé                                                                                                                                          |

### Lancer depuis la source vs binaire

- **Binaire installé** : `bxc <cmd>` (= `/home/ubuntu/.local/bin/bxc`).
- **Depuis la source** (toujours à jour) : `bun run /home/ubuntu/bxc/src/cli/index.ts <cmd>`.

Tout tourne sous **bun** (jamais node — cf. CLAUDE.md rpbey).

---

## 3. Mettre à jour le binaire

```bash
cd /home/ubuntu/bxc
bun run build:linux        # cargo --release (tout rust-bridge) + scripts/build-standalone.ts
cp dist/standalone/bxc-linux-x64 /home/ubuntu/.local/bin/bxc && chmod +x /home/ubuntu/.local/bin/bxc
bxc --version
```

`build:linux` produit `dist/standalone/bxc-{linux-x64,linux-arm64,darwin-x64,darwin-arm64}` et `bxc-windows-x64.exe`.

---

## 4. ⚠️ Piège #1 — le moteur `bxc-engine` n'est pas livré par `bxc install`

Les profils `fast`/`stealth`/`max` (et `bxc chrome`) ont besoin du **Chromium
natif Rust `bxc-engine`**. `bxc install` ne télécharge que **Lightpanda**. Sans
`bxc-engine`, ces profils plantent avec :

```
[error] Failed to resolve chrome path: error: no bin target named `bxc-engine`
```

**Fix** — le compiler une fois (≈2-3 min cold) :

```bash
cd /home/ubuntu/bxc/rust-bridge
cargo build -p bxc-engine --release    # → rust-bridge/target/release/bxc-engine
```

La cdylib FFI DOM/Markdown (`libbxc_rust_bridge.so`) est `dlopen`-ée
paresseusement ; son absence ne crash plus (fallback JS pur pour le texte/markdown),
seules les requêtes CSS natives la réclament. Override : `BXC_RUST_BRIDGE_LIB=/chemin/lib.so`.

---

## 5. ⚠️ Piège #2 — checkpoint Vercel « Attack Challenge Mode » (cas bbxweekly.com)

Certains sites (ex `bbxweekly.com`, source de `/meta`) sont derrière le
**Vercel Security Checkpoint** : un challenge **WebGL/canvas fingerprint**, pas
un simple filtre IP. Constat mesuré :

- `bxc --profile static`/`http` → renvoient la page « Vercel Security Checkpoint » (pas de JS / pas de WebGL).
- `bxc --profile fast` (Lightpanda/bxc-engine) → atteint la page mais ne résout pas le challenge en one-shot (pas d'attente de la résolution).
- **Ce qui marche** : un Chromium complet avec **WebGL logiciel (SwiftShader)** + spoof WebGL + attente de la résolution (~12 s) + profil persistant pour le cookie de clearance.

Le scraper de prod `apps/web/scripts/scrape-bbx-weekly.ts` utilise donc le
chromium système via puppeteer-extra-stealth **sous bun** (cf. [recipes.md](./recipes.md#checkpoint-vercel-bbxweekly)).
Une fois le cookie de clearance obtenu, on peut le rejouer dans bxc via l'option
`cookies` (profil `fast`/`ghost`).

---

## 6. Intégration rpbey

- `packages/challonge` dépend de `@aphrody-code/bxc ^0.3.0` (scraper Challonge via
  le profil `http` curl-impersonate — bypass du Cloudflare/TLS de challonge.com).
- Le client Challonge canonique (`@rose-griffon/challonge`) route ses transports
  par bxc (`src/transports/`).
- `gost` (`~/.local/bin/gost`) est installé comme proxy de secours, mais inutile
  pour les blocages **fingerprint** (≠ IP) comme le checkpoint Vercel.
