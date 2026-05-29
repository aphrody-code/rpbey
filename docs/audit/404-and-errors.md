---
title: "404 / 500 / erreurs console / images cassées — consolidé"
description: "Détail des erreurs réseau (404, 500, ORB, 429) relevées lors de l'audit prod rpbey.fr du 2026-05-28."
scope:
  - apps/web
status: "stable"
last_updated: "2026-05-29"
related_symbols:
  - /api/auth/get-session
  - /comparateur/[slug]
  - /api/image
---

# 404 / 500 / erreurs console / images cassées — consolidé

Audit prod `https://rpbey.fr` du **2026-05-28** (Chromium réel, viewport desktop 1440x900 + mobile 390x844, ~1.5 s d'hydratation). Données brutes : `docs/audit/results.json`.

> Légende des classes d'erreur réseau observées :
>
> - **500 Internal Server Error** — vrai crash serveur (à corriger).
> - **404 Not Found** — ressource introuvable (asset / avatar / favicon).
> - **`net::ERR_ABORTED` sur `?_rsc=…`** — **bénin** : annulation de prefetch RSC Next.js quand on quitte la page avant la fin du prefetch. Non bloquant, n'impacte pas l'utilisateur. Listé pour exhaustivité mais **pas un bug**.
> - **`net::ERR_BLOCKED_BY_ORB`** — blocage navigateur (Opaque Response Blocking) d'images cross-origin (avatars Discord / Challonge) chargées sans attribut adéquat. Cosmétique : avatar absent → fallback.
> - **429 Too Many Requests** — rate-limit sur `/api/auth/get-session`, déclenché par le **crawl rapide séquentiel** de l'audit (artefact de test). À surveiller car le seuil semble bas.

---

## 1. 500 — Internal Server Error (RÉSOLU, commit 9f4d15a)

### `/comparateur/[slug]` — les fiches produit renvoyaient 500 (corrigé)

- **Au snapshot (2026-05-28)** : `curl -s -o /dev/null -w "%{http_code}" https://rpbey.fr/comparateur/arrow-wizard-4-80b` → **500** ; page d'erreur **brute non stylée** ("Internal Server Error", fond blanc) — voir `screenshots/comparateur-arrow-wizard-4-80b-desktop.png`.
- Impact en cascade d'alors : sur `/comparateur` (l'index, qui répond 200), Next.js **prefetchait** les ~40 fiches → 40 réponses 500 en console (voir `results.json` route `comparateur`).
- Slugs alors vérifiés en 500 (échantillon) : `arrow-wizard-4-80b`, `sword-dran-3-60f`, `horn-rhino-3-80s`, `lance-knight-4-80hn`, `claw-leon-5-60p`, `rock-golem-1-60un`, `scorpio-spear-0-70z`, …
- **RÉSOLU sur HEAD (commit 9f4d15a)** : la page `/comparateur/[slug]/page.tsx` est passée `force-static` + `generateStaticParams` (`dynamicParams = true`, `notFound()` sur slug inconnu). Les fiches sont pré-générées et répondent 200 ; la repro curl 500 n'est plus vraie et le prefetch de l'index ne génère plus de 500.

---

## 2. 404 — Not Found

| Ressource                                                                                                               | Page source                               | Type                                                                                                               |
| ----------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `cdn.discordapp.com/guilds/1319715782032228463/users/1244715598102138970/avatars/972fbee12d423227459efea1fddc2d6c.png`  | `/rankings`                               | avatar Discord membre — guild avatar expiré/supprimé                                                               |
| `cdn.discordapp.com/guilds/1319715782032228463/users/381213310881628160/avatars/a_4ccefdcec70b8bd7b6f7af17c059abdb.gif` | `/rankings`                               | avatar Discord membre (animé) — idem                                                                               |
| `https://rpbey.fr/favicon.ico`                                                                                          | `/comparateur/[slug]` (page d'erreur 500) | favicon absent **sur la page d'erreur brute** uniquement (les pages normales servent l'icône via le `<head>` Next) |

> Les deux avatars Discord 404 sont des URLs de guild-avatar qui n'existent plus côté Discord. Le reste des avatars membres est bloqué par ORB (cf. §3), pas 404.

---

## 3. Images cross-origin bloquées (ERR_BLOCKED_BY_ORB) — cosmétique

Aucune image **interne** cassée détectée (`naturalWidth===0` = 0 partout). Les images manquantes sont **toutes cross-origin** et bloquées par le navigateur (ORB), avec fallback avatar par défaut affiché :

- `/rankings` : ~10 avatars `cdn.discordapp.com/avatars/...` + `user-assets.challonge.com/users/images/...` (photos de profil Challonge des joueurs).
- `/notre-equipe` : ~11 avatars `cdn.discordapp.com/avatars/...` (photos staff).

**Cause probable** : `<img src>` cross-origin sans passer par un proxy/Image Optimizer interne (ou `crossorigin` manquant), donc Chromium applique l'ORB. Reco : `/api/image` **ne convient pas** — la route rejette tout `src` qui ne commence pas par `/` et lit depuis `join(process.cwd(), 'public', src)`, donc elle ne sert QUE des chemins locaux et ne peut PAS proxifier `cdn.discordapp.com` / `user-assets.challonge.com`. Pour servir same-origin : soit créer une vraie route proxy (ex. `/api/avatar?url=`), soit déclarer ces domaines dans `next.config` `images.remotePatterns` et passer par `next/Image`.

---

## 4. 429 — Too Many Requests (artefact de crawl, à surveiller)

`GET /api/auth/get-session` a renvoyé 429 sur plusieurs pages pendant le crawl rapide (`/tournaments`, `/meta`, `/tv`, `/builder`, `/notre-equipe`, `/tournaments/wb`, `/anime/.../1`, `/profile/[id]`, les fiches tournoi).

- Déclenché par le **rythme du crawl** (toutes les pages d'affilée → beaucoup de hits get-session). Un utilisateur réel ne devrait pas l'atteindre en navigation normale.
- **RÉSOLU** : la reco a été appliquée — `auth.ts` désactive le rate-limit sur `get-session` via `customRules: { "/get-session": false }` (endpoint pollé par `useSession`). Le 429 observé restait un artefact du crawl rapide.

---

## 5. pageerror (exceptions JS non catchées)

Aucune vraie exception applicative. Les seuls `pageerror` enregistrés sont des `NAV_ERROR: TimeoutError: Navigation timeout of 45000 ms exceeded` — ils proviennent de la **phase de reload mobile du script d'audit** (le `waitUntil:"networkidle2"` n'atteint jamais l'idle réseau à cause des prefetch RSC continus + websockets). Ce sont des artefacts du harness, **pas** des erreurs du site. Conséquence : sur 4 pages (`home`, `tournaments`, `builder`, `notre-equipe`) le screenshot mobile n'a pas été régénéré et le shot desktop a été pris au viewport mobile (fallback) — le rendu reste lisible et valide.

---

## Récapitulatif chiffré

| Classe                                 | Compte (au snapshot)           | Gravité                                              |
| -------------------------------------- | ------------------------------ | --------------------------------------------------- |
| 500 serveur (`/comparateur/[slug]`)    | 0 sur HEAD (RÉSOLU 9f4d15a)    | RÉSOLU (était haute ; force-static, plus de 500)    |
| 404 réels (avatars Discord guild)      | 2                              | basse                                               |
| 404 favicon (sur page erreur 500 only) | 0 sur HEAD                     | négligeable (a disparu avec la 500 corrigée)        |
| Images ORB cross-origin                | ~21 (rankings + notre-equipe)  | basse (cosmétique)                                  |
| 429 get-session (crawl)                | ~12                            | RÉSOLU (config rate-limit appliquée, cf. §4)        |
| Images internes cassées                | 0                              | —                                                   |
| Exceptions JS applicatives             | 0                              | —                                                   |
