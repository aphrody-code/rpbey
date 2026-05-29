# Challonge — Infrastructure / DNS / CDN

Probé live le 2026-05-29 (`dig`, `host`, `curl`, `curl_chrome131`, `bxc detect`).
Source recon : aphrody `dns_recon`/`advanced_recon`, croisé live.

## DNS (zone)

| Record | Valeur |
| --- | --- |
| `challonge.com` A | `104.20.17.209`, `172.66.145.188` (CLOUDFLARENET AS13335, 104.16.0.0/12) |
| `challonge.com` AAAA | `2606:4700:10::6814:11d1`, `2606:4700:10::ac42:91bc` |
| NS | `greg.ns.cloudflare.com`, `elsa.ns.cloudflare.com` (zone sur Cloudflare DNS, full proxy) |
| MX | Google Workspace (`aspmx.l.google.com` + alt1/alt2 + `aspmx2-5.googlemail.com`) |
| SPF (TXT) | `v=spf1 a:outbound.challonge.com include:_spf.google.com include:amazonses.com include:spf.mandrillapp.com include:spf.sendinblue.com -all` |
| DMARC | `v=DMARC1; p=none; rua=mailto:admin@challonge.com; sp=none; pct=100; aspf=r` |
| CAA | aucun |
| PTR sur `104.20.17.209` | aucun |

Les IPs résolues correspondent **exactement** à la recon aphrody.

## TLS

- Cert : `CN=*.challonge.com`, `SAN=[*.challonge.com, challonge.com]`.
- Issuer : **GoGetSSL RSA DV CA**, validité **2026-01-14 → 2027-02-14**.
- Conséquence : cert **wildcard** → ni le DNS ni le cert ne permettent de
  distinguer un vrai sous-domaine d'un catch-all. La distinction se fait
  **uniquement par le comportement HTTP**.

## Sous-domaines

51 sous-domaines reportés par la recon. Pattern : `<32hex>.challonge.com` =
sous-domaine org/user custom ; orgs nommées comme `1-2smash.challonge.com`,
`0oz.challonge.com`, `beyblade.challonge.com`, `worldbeyblade.challonge.com`.
Tous partagent la **même paire anycast Cloudflare** → la résolution seule n'est
pas diagnostique.

Sous-domaines **HTTP-confirmés distincts** :

| Sous-domaine | Comportement réel |
| --- | --- |
| `api.challonge.com` | API origin. `/v1` → 302 → `https://challonge.apidog.io` (docs v1 hébergées sur Apidog, `server: openresty/1.25.3.2`). `/v1/tournaments.json` → **401** `www-authenticate: Basic realm="Application"`. `/v2.1/tournaments.json` → **415** puis **406** (exige `Content-Type` ET `Accept: application/vnd.api+json`). **PAS** de `cf-mitigated` : passe direct à l'origin Rails. |
| `assets.challonge.com` | CDN statique réel : `/favicon.ico` → **200**, `cf-cache-status: HIT`, `max-age=14400`. C'est la valeur du `meta[name=asset-host]` (`https://assets.challonge.com`, confirmé fixture). |
| `user-assets.challonge.com` | Portraits participants / bannières orgs (référencé dans `attached_participatable_portrait_url`, `banner` de la recherche). |
| `kb.challonge.com` | **Seul CNAME distinct** → `custom.crisp.help` (172.65.251.114). KB externalisée chez Crisp. |
| `outbound.challonge.com` | **Seule A record non-Cloudflare** : `152.44.37.98` = **UpCloud USA Inc** (UU-7, 152.44.32.0/20, Chicago). Origin d'envoi de mail. Seule fuite d'IP hors CF. |
| `stream.challonge.com` | Faye/Bayeux pub-sub sur le **port 8000** (`meta[name=stream-url]=https://stream.challonge.com:8000/faye`). |

Sous-domaines **non-confirmables** (tous 403 `cf-mitigated: challenge`,
identiques à un sous-domaine de contrôle bogus `zzznonexistent-xyz123.challonge.com`) :
`images`, `static`, `blog`, `my`, `app`, `cdn`, `connect`, `graphql`, `www`,
`media`, `uploads`, `s3`, `api2`. La liste nommée Gemini (`images/assets/connect/kb`)
est **plausible** mais seuls `assets`, `kb`, `api` (+ `outbound`, `stream`) sont
HTTP-confirmés.

## Ports

Recon : `80`, `443`, `8080`, `8443` ouverts sur l'edge. `8000` confirmé pour Faye
sur `stream.challonge.com`. Pas de probing live des 8080/8443 (gap).

## CDN / Edge

- `server: cloudflare` sur **tous** les hosts. `cf-ray …-FRA` (edge Frankfurt). HTTP/2.
  Pas de `alt-svc` HTTP/3 annoncé.
- Tous les sous-domaines tournoi org/user (`<32hex>` ou nommés) → **403 sur curl nu**
  (wildcard CF-fronted SPA).

### Posture bot-management (le fait opérationnel #1)

Cloudflare a **escaladé** vers un **JS managed challenge actif** sur la surface HTML/SPA :

- `challonge.com/<lang>/<slug>`, `/tournaments`, `images.`, `my.`, `/graphql` →
  **HTTP 403** + header `cf-mitigated: challenge`, body `<title>Just a moment...</title>`,
  CSP n'autorisant que `challenges.cloudflare.com` (Turnstile).
- Ce 403+challenge est retourné **même à curl-impersonate Chrome 131** :
  `curl_chrome131` direct sur `/fr/B_TS4` → HTTP/2 403 `cf-mitigated: challenge`,
  interstitiel ~5961 bytes, **0 occurrence de `_initialStoreState`**. Le fingerprint
  JA3/TLS ne suffit plus seul : CF demande désormais l'exécution JS / un cookie
  `cf_clearance` sur ces routes.
- Headers de challenge observés (HAR) : `cf-mitigated: challenge`, CSP
  `default-src 'none'; script-src 'nonce-…' 'unsafe-eval' https://challenges.cloudflare.com`,
  `accept-ch`/`critical-ch: Sec-CH-UA-Bitness, -Arch, -Full-Version, -Mobile, -Model, -Platform-Version`,
  `cross-origin-embedder-policy: require-corp`, `coop/corp: same-origin`,
  `x-frame-options: SAMEORIGIN`, `content-encoding: br`. **Aucun header origin**
  exposé (pas de `Set-Cookie _challonge_session`, pas de `X-Request-Id`, pas de
  `Server: puma/nginx`) — CF les masque sur la réponse de challenge.
- En revanche `api.challonge.com/v1` + `/v2.1` + `assets.challonge.com` → **pas**
  de `cf-mitigated`, passent à l'origin. Seules les surfaces SPA + images sont JS-challengées.

> Nuance importante vs les autres dimensions de recon : `/module` reste, en
> pratique, le chemin **le plus souvent 200** en curl-impersonate (3/3 sur certaines
> sessions), alors que la racine et la découverte sont systématiquement 403. Le
> challenge est donc **path-spécifique et stochastique** plutôt qu'un blocage
> global. Le contournement validé du repo pour la découverte = Wayback Machine
> (commit `bbc35bc`).

## Impact sur le scraper + escape hatch

- `BxcTransport` (profile `chrome131`) et `bxc challonge` échouent sur les routes
  CF-gated (interstitiel → `extractChallongeTournament` throw
  "`window._initialStoreState['TournamentStore']` not found").
- Le package a déjà l'escape hatch : **cookie jar** à
  `storage/cookies/challonge_cookie.json` (résolu via `cwd` + `../../`, voir
  `packages/challonge/src/utils/cookies.ts:30-43`). `hasCfClearance()`
  (`cookies.ts:103-105`) vérifie un cookie `cf_clearance`. `isSessionCookieValid()`
  (`cookies.ts:93-98`) vérifie `_challonge_session_production` (shape
  `<base64>--<sig>--<sig2>`, longueur > 100). `reverse.ts:23-24` documente que la
  session cookie doit rester valide et que le profil chrome131 peut nécessiter un
  bump tous les ~6 mois quand CF tourne sa détection.
- **Le jar est actuellement ABSENT** sur disque (les deux chemins candidats
  manquent) → `resolveDefaultCookiePath()` renvoie `null`, scraper non fonctionnel
  sur les routes gated tant qu'un `cf_clearance` n'est pas frappé.
- bxc supporte des profils CDP réels (`stealth`/`max`, `~/bxc/src/api/browser.ts`)
  qui lancent un vrai Chrome capable de résoudre le Turnstile et de frapper un
  `cf_clearance`, ensuite réutilisable par le path curl-impersonate (cheap). Étape
  recommandée : bootstrap `cf_clearance` via CDP, persister dans le jar, garder
  curl-impersonate pour les fetches en masse.

## Gaps

- Origin app/web réel **jamais révélé** (full CF). Seul `outbound.challonge.com`
  (mail, UpCloud) fuit. L'hypothèse Gemini "AWS origin" pour l'app reste non
  confirmée (SES n'est que dans le SPF).
- 13 sous-domaines (`images/static/blog/my/app/cdn/connect/graphql/media/uploads/s3/api2`)
  403 identiques à un contrôle bogus → impossible de prouver lesquels sont des
  origins distincts vs pur wildcard.
- Aucun `cf_clearance` frais frappé cette session (pas de CDP lancé) → le path
  cookie n'a pas été live-validé.
- Ports 8080/8443 non probés ; pas de QUIC/HTTP3.
