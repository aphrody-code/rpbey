# 404 / 500 / erreurs console / images cassées — consolidé

Audit prod `https://rpbey.fr` du **2026-05-28** (Chromium réel, viewport desktop 1440x900 + mobile 390x844, ~1.5 s d'hydratation). Données brutes : `docs/audit/results.json`.

> Légende des classes d'erreur réseau observées :
> - **500 Internal Server Error** — vrai crash serveur (à corriger).
> - **404 Not Found** — ressource introuvable (asset / avatar / favicon).
> - **`net::ERR_ABORTED` sur `?_rsc=…`** — **bénin** : annulation de prefetch RSC Next.js quand on quitte la page avant la fin du prefetch. Non bloquant, n'impacte pas l'utilisateur. Listé pour exhaustivité mais **pas un bug**.
> - **`net::ERR_BLOCKED_BY_ORB`** — blocage navigateur (Opaque Response Blocking) d'images cross-origin (avatars Discord / Challonge) chargées sans attribut adéquat. Cosmétique : avatar absent → fallback.
> - **429 Too Many Requests** — rate-limit sur `/api/auth/get-session`, déclenché par le **crawl rapide séquentiel** de l'audit (artefact de test). À surveiller car le seuil semble bas.

---

## 1. 500 — Internal Server Error (CRITIQUE)

### `/comparateur/[slug]` — TOUTES les fiches produit renvoient 500
- **Confirmé hors crawl** : `curl -s -o /dev/null -w "%{http_code}" https://rpbey.fr/comparateur/arrow-wizard-4-80b` → **500**.
- La page d'erreur est une page **brute non stylée** ("Internal Server Error", fond blanc, sans nav ni branding) — voir `screenshots/comparateur-arrow-wizard-4-80b-desktop.png`.
- Impact en cascade : sur `/comparateur` (l'index, qui répond 200), Next.js **prefetch** les ~40 fiches de la liste → 40 réponses 500 enregistrées dans la console (voir `results.json` route `comparateur`). Donc chaque visite de l'index pollue la console de 500.
- Slugs vérifiés en 500 (échantillon, tous identiques) : `arrow-wizard-4-80b`, `sword-dran-3-60f`, `horn-rhino-3-80s`, `lance-knight-4-80hn`, `claw-leon-5-60p`, `rock-golem-1-60un`, `scorpio-spear-0-70z`, … (toute la liste préfetchée).
- **Note** : un fix est annoncé en cours côté agent principal. Signalé ici factuellement.

---

## 2. 404 — Not Found

| Ressource | Page source | Type |
|---|---|---|
| `cdn.discordapp.com/guilds/1319715782032228463/users/1244715598102138970/avatars/972fbee12d423227459efea1fddc2d6c.png` | `/rankings` | avatar Discord membre — guild avatar expiré/supprimé |
| `cdn.discordapp.com/guilds/1319715782032228463/users/381213310881628160/avatars/a_4ccefdcec70b8bd7b6f7af17c059abdb.gif` | `/rankings` | avatar Discord membre (animé) — idem |
| `https://rpbey.fr/favicon.ico` | `/comparateur/[slug]` (page d'erreur 500) | favicon absent **sur la page d'erreur brute** uniquement (les pages normales servent l'icône via le `<head>` Next) |

> Les deux avatars Discord 404 sont des URLs de guild-avatar qui n'existent plus côté Discord. Le reste des avatars membres est bloqué par ORB (cf. §3), pas 404.

---

## 3. Images cross-origin bloquées (ERR_BLOCKED_BY_ORB) — cosmétique

Aucune image **interne** cassée détectée (`naturalWidth===0` = 0 partout). Les images manquantes sont **toutes cross-origin** et bloquées par le navigateur (ORB), avec fallback avatar par défaut affiché :

- `/rankings` : ~10 avatars `cdn.discordapp.com/avatars/...` + `user-assets.challonge.com/users/images/...` (photos de profil Challonge des joueurs).
- `/notre-equipe` : ~11 avatars `cdn.discordapp.com/avatars/...` (photos staff).

**Cause probable** : `<img src>` cross-origin sans passer par un proxy/Image Optimizer interne (ou `crossorigin` manquant), donc Chromium applique l'ORB. Reco : proxifier les avatars via `/api/image` (route déjà existante) ou Next `<Image>` avec un loader, pour servir same-origin.

---

## 4. 429 — Too Many Requests (artefact de crawl, à surveiller)

`GET /api/auth/get-session` a renvoyé 429 sur plusieurs pages pendant le crawl rapide (`/tournaments`, `/meta`, `/tv`, `/builder`, `/notre-equipe`, `/tournaments/wb`, `/anime/.../1`, `/profile/[id]`, les fiches tournoi).

- Déclenché par le **rythme du crawl** (toutes les pages d'affilée → beaucoup de hits get-session). Un utilisateur réel ne devrait pas l'atteindre en navigation normale.
- **Mais** : le seuil semble bas et le client ne dégrade pas gracieusement (la session échoue silencieusement). Reco : augmenter le rate-limit sur `get-session` ou dédupliquer/cacher l'appel côté client (1 fetch session partagé par navigation au lieu d'1 par page).

---

## 5. pageerror (exceptions JS non catchées)

Aucune vraie exception applicative. Les seuls `pageerror` enregistrés sont des `NAV_ERROR: TimeoutError: Navigation timeout of 45000 ms exceeded` — ils proviennent de la **phase de reload mobile du script d'audit** (le `waitUntil:"networkidle2"` n'atteint jamais l'idle réseau à cause des prefetch RSC continus + websockets). Ce sont des artefacts du harness, **pas** des erreurs du site. Conséquence : sur 4 pages (`home`, `tournaments`, `builder`, `notre-equipe`) le screenshot mobile n'a pas été régénéré et le shot desktop a été pris au viewport mobile (fallback) — le rendu reste lisible et valide.

---

## Récapitulatif chiffré

| Classe | Compte | Gravité |
|---|---|---|
| 500 serveur (`/comparateur/[slug]`) | 1 route, ~40 hits/visite index | 🔴 haute |
| 404 réels (avatars Discord guild) | 2 | 🟡 basse |
| 404 favicon (sur page erreur 500 only) | 1 | 🟢 négligeable (disparaît si 500 corrigé) |
| Images ORB cross-origin | ~21 (rankings + notre-equipe) | 🟡 basse (cosmétique) |
| 429 get-session (crawl) | ~12 | 🟡 moyenne (config rate-limit) |
| Images internes cassées | 0 | — |
| Exceptions JS applicatives | 0 | — |
