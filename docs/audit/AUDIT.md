# Audit complet — rpbey.fr (apps/web)

**Date** : 2026-05-28 · **Cible** : `https://rpbey.fr` (prod) · **Méthode** : Chromium réel (Puppeteer), desktop 1440x900 + mobile 390x844, `fullPage`, ~1.5 s d'hydratation. Capture du status HTTP, console (`error`), `pageerror`, requêtes échouées/≥400, images cassées (`naturalWidth===0`).
**Pages auditées** : 27 routes (14 statiques publiques + 9 dynamiques échantillonnées + 4 auth-gated + variantes). Données brutes : `results.json`. Détail erreurs : `404-and-errors.md`. Captures : `screenshots/`.

---

## Synthèse — Top 10 problèmes prioritaires

| # | Sévérité | Problème | Page(s) |
|---|---|---|---|
| 1 | 🔴 HAUTE | **`/comparateur/[slug]` renvoie 500 sur TOUTES les fiches** (server error, reproduit hors crawl via curl). Page d'erreur **brute non stylée** ("Internal Server Error", fond blanc, sans nav). | `/comparateur/<slug>` |
| 2 | 🔴 HAUTE | **Cascade de 500 sur l'index `/comparateur`** : le prefetch RSC des ~40 fiches déclenche 40 réponses 500 → console polluée à chaque visite, et tous les liens "Voir la fiche" mènent au 500. | `/comparateur` |
| 3 | 🟠 MOY | **Page d'erreur globale non brandée** : le `error.tsx`/`not-found.tsx` semble absent ou non stylé (la 500 du comparateur tombe sur le fallback Next minimal). Aucune issue utilisateur (pas de bouton retour, pas de nav). | global |
| 4 | 🟠 MOY | **`/parts` (outil de gestion CRUD) exposé publiquement** : boutons Ajouter / Importer / Export / éditer / supprimer (icônes crayon + corbeille) visibles sans auth. Soit c'est volontaire (read-only côté serveur), soit fuite d'UI admin. À vérifier que les mutations sont gated côté API. | `/parts` |
| 5 | 🟠 MOY | **Rate-limit `/api/auth/get-session` trop agressif** : 429 dès qu'on enchaîne quelques pages. Le client ne dégrade pas (session échoue en silence). Dédupliquer/cacher l'appel session. | transverse |
| 6 | 🟡 BASSE | **Avatars cross-origin non affichés** (ORB) : Discord + Challonge bloqués par le navigateur sur `/rankings` et `/notre-equipe` → fallback gris. Proxifier via `/api/image`. | `/rankings`, `/notre-equipe` |
| 7 | 🟡 BASSE | **Colonnes de table tronquées** sur `/parts` (entêtes "S...", "P...", "R...", lettres seules "J","L","I") — illisibles sans hover/tooltip. | `/parts` |
| 8 | 🟡 BASSE | **Table comparateur : colonne droite ("Meilleur prix chez") coupée en mobile** ; sur desktop un toast/popup flotte par-dessus le tableau (overlay mal positionné). | `/comparateur` (mobile + desktop) |
| 9 | 🟡 BASSE | **2 avatars Discord en vrai 404** (guild-avatars expirés) sur `/rankings`. | `/rankings` |
| 10 | 🟢 INFO | **États vides minimalistes** sur profils sans données ("Aucun match", "Aucune pièce", "Pas encore renseigné") — corrects mais sans CTA ni illustration. | `/profile/[id]` |

**Verdict global** : le site est **majoritairement sain et soigné** (dark theme cohérent, navigation, hero, brackets, tier-list, lecteur anime, comparateur de prix tous fonctionnels et responsive). **Un seul bug bloquant** : les fiches détail du comparateur (500). Le reste = polish (avatars proxy, rate-limit, troncatures de table, page d'erreur à brander).

---

## Tableau récapitulatif par route

| Route | Status | #err console* | #req échouées** | Verdict |
|---|---|---|---|---|
| `/` (home) | 200 | 0 | 0 réel | OK |
| `/rankings` | 200 | 10 (404 avatars) | 2×404 + ORB | ⚠️ avatars |
| `/tournaments` | 200 | 1 (429) | 1×429 | OK |
| `/meta` | 200 | 2 (429) | 2×429 | OK |
| `/tv` | 200 | 1 (429) | 1×429 | OK |
| `/anime` | 200 | 0 | 0 réel | OK |
| `/builder` | 200 | 2 (429) | 2×429 | OK |
| `/comparateur` | 200 | 40 (500 prefetch) | 40×500 | 🔴 cascade 500 |
| `/comparateur/<slug>` | **500** | — | 500 | 🔴 crash |
| `/notre-equipe` | 200 | 1 (429) | ORB avatars + 429 | ⚠️ avatars |
| `/reglement` | 200 | 0 | 0 réel | OK |
| `/privacy` | 200 | 0 | 0 réel | OK |
| `/parts` | 200 | 0 | 0 | ⚠️ CRUD public + colonnes tronquées |
| `/sign-in` | 200 | 0 | 0 | OK |
| `/sign-up` | 200 (→ sign-in) | 0 | 0 | OK (redirige vers /sign-in) |
| `/tournaments/satr` | 200 | 0 | 0 réel | OK |
| `/tournaments/wb` | 200 | 1 (429) | 1×429 | OK |
| `/tournaments/stardust` | 200 | 0 | 0 réel | OK |
| `/profile` | 200 (→ sign-in) | 0 | 0 | OK (gate via /sign-in) |
| `/tournaments/<id>` (bts4) | 200 | 1 (429) | 1×429 | OK (redirige vers slug `bts4`) |
| `/tournaments/<id2>` | 200 | 1 (429) | 1×429 | OK |
| `/anime/<slug>` | 200 | 0 | 0 réel | OK |
| `/anime/<slug>/<ep>` | 200 | 2 (429) | 2×429 | OK |
| `/profile/<id>` | 200 | 1 (429) | 1×429 | OK |
| `/dashboard` | **307 → /sign-in** | 0 | 0 | OK (auth-gated, attendu) |
| `/admin` | **307 → /sign-in** | 0 | 0 | OK (auth-gated, attendu) |

\* "#err console" hors prefetch RSC `ERR_ABORTED` (bénins). Les 429 viennent du crawl rapide (artefact). 
\** "#req échouées" : on ne compte ici que les vraies erreurs (404/500/429) ; les `ERR_ABORTED ?_rsc=` (prefetch annulés) sont exclus car non bloquants.

---

## Détail par page

### `/` — Accueil
- Capture : `screenshots/home-desktop.png` (rendu au viewport mobile suite au timeout reload — voir 404-and-errors §5).
- Rendu : hero "RÉPUBLIQUE POPULAIRE BEYBLADE", CTA "Rejoindre l'Arène" / "Notre Discord", carrousel "Nos Tournois" (affiche Bey-Tamashii), nav bottom mobile (Accueil/Tournois/Classements/Meta/Anime/Connexion).
- Problèmes : aucun bloquant. Bannière promo flottante en bas ("Rejoins la communauté RPB !").
- 404/erreurs : aucune réelle.
- Verdict : **OK**.

### `/rankings` — Classements
- Capture : `screenshots/rankings-desktop.png` · `rankings-mobile.png`.
- Rendu : leaderboard (rang/joueur/stats) + bracket "Bey-Tamashii Séries #2" complet.
- Problèmes UI : (BASSE) avatars joueurs en fallback gris — Discord/Challonge bloqués ORB ; 2 avatars en vrai 404.
- Reco : proxifier les avatars via `/api/image` pour servir same-origin (supprime ORB + 404 gérés via fallback serveur).
- Verdict : **⚠️ avatars** (fonctionnel sinon).

### `/tournaments` — Liste tournois
- Capture : `screenshots/tournaments-desktop.png`.
- Rendu : "Bey-Tamashii Séries" (badge OFFICIEL RPB), cartes tournoi avec affiche/date/nb joueurs, encart "Suis la RPB sur X".
- Problèmes : aucun (429 = artefact crawl).
- Verdict : **OK**.

### `/meta` — Tier list Beyblade X
- Capture : `screenshots/meta-desktop.png` · `meta-mobile.png`.
- Rendu : sections Blade / Ratchet / Bit / Lock Chip / Assist Blade / Over Blade, chaque entrée avec rang, icône, barre d'usage colorée. Filtres en haut (Côté X, 3-on-1, Bit, Assist Blade).
- Problèmes : aucun.
- Verdict : **OK** (page riche et lisible).

### `/tv` — Vidéos
- Capture : `screenshots/tv-desktop.png` · `tv-mobile.png`.
- Rendu : grille de vidéos type YouTube (thumbnails, titres, sections). Mobile stacke correctement.
- Problèmes : aucun.
- Verdict : **OK**.

### `/anime` — Index séries
- Capture : `screenshots/anime-desktop.png` · `anime-mobile.png`.
- Rendu : hero + grille de séries Beyblade.
- Problèmes : aucun réel.
- Verdict : **OK**.

### `/builder` — Constructeur de deck
- Capture : `screenshots/builder-desktop.png`.
- Rendu : interface builder.
- Problèmes : 429 (artefact). Vérifier interactivité (non testée au clic).
- Verdict : **OK** (rendu).

### `/comparateur` — Comparateur de prix (index)
- Capture : `screenshots/comparateur-desktop.png` · `comparateur-mobile.png`.
- Rendu : "Comparateur de prix Beyblade X — 2278 offres / 17 boutiques", recherche, filtres (Meilleurs prix / Tous les produits / Boutiques), grande table Produit/Code/Boutiques/Meilleur prix.
- Problèmes :
  - 🔴 (HAUTE) chaque ligne préfetche sa fiche `/comparateur/<slug>` → **40× 500** en console ; tous les liens fiche mènent au 500 (#1/#2).
  - 🟡 (BASSE) desktop : un toast/popup flotte par-dessus le tableau (overlay mal placé, gêne la lecture des dernières colonnes).
  - 🟡 (BASSE) mobile : colonne "Meilleur prix chez" coupée (table non scrollable horizontalement visible).
- Verdict : **🔴** (l'index s'affiche mais le parcours fiche est cassé).

### `/comparateur/[slug]` — Fiche produit
- Capture : `screenshots/comparateur-arrow-wizard-4-80b-desktop.png` (= page 500 brute).
- Problèmes : 🔴 **500 systématique** (confirmé curl). Page d'erreur non brandée.
- Reco : corriger le crash serveur (data fetch fiche) + ajouter un `error.tsx` stylé avec nav + retour. (Fix annoncé en cours.)
- Verdict : **🔴 crash**.

### `/notre-equipe` — Staff
- Capture : `screenshots/notre-equipe-desktop.png`.
- Rendu : grille de cartes staff.
- Problèmes : 🟡 avatars Discord bloqués ORB (fallback). Proxifier (cf. `/rankings`).
- Verdict : **⚠️ avatars**.

### `/reglement` & `/privacy` — Pages légales/règles
- Captures : `reglement-desktop.png`/`-mobile.png`, `privacy-desktop.png`/`-mobile.png`.
- Rendu : pages de texte, lisibles, responsive.
- Problèmes : aucun.
- Verdict : **OK**.

### `/parts` — Base de pièces & Beyblades
- Capture : `screenshots/parts-desktop.png` · `parts-mobile.png`.
- Rendu : stats (Total 437, Blades 221, Ratchets 40, Bits 154…), onglets Pièces/Beyblades/Import, recherche + filtres, table de 437 lignes avec actions par ligne (éditer/dupliquer/supprimer), boutons **Export** + **Ajouter**.
- Problèmes :
  - 🟠 (MOY) **outil CRUD exposé publiquement** (pas d'auth gate visible) — confirmer que les mutations sont refusées côté API pour un non-admin ; sinon, gater la page.
  - 🟡 (BASSE) **entêtes de colonnes tronquées** ("S...", "P...", "R...", "J", "L", "I") — ajouter tooltips ou élargir.
  - 🟡 (BASSE) mobile : table déborde horizontalement (scroll horizontal — acceptable mais à confirmer).
- Verdict : **⚠️** (fonctionnel ; question de gating + lisibilité entêtes).

### `/sign-in` & `/sign-up`
- Captures : `sign-in-*.png`, `sign-up-*.png`.
- Rendu : page d'auth (sign-up redirige vers sign-in).
- Problèmes : aucun.
- Verdict : **OK**.

### `/tournaments/satr`, `/wb`, `/stardust` — Séries dédiées
- Captures : `tournaments-satr-*.png`, `tournaments-wb-*.png`, `tournaments-stardust-*.png`.
- Rendu : leaderboards thématiques (WB = thème violet, ranking complet ; satr/stardust = OK), responsive correct.
- Problèmes : aucun (429 artefact).
- Verdict : **OK**.

### `/tournaments/[id]` — Détail tournoi
- Captures : `tournament-cmnukkwyt0000z4ro9fvkcko6-*.png` (redirige vers slug `/tournaments/bts4`), `tournament-cmobvakra0001s7rog85nt10h-*.png` ("The Stardust Series #1").
- Rendu : description, onglets Tableau/Poules/Classement, bracket Winner/Loser, affiche, date/lieu, CTA "S'inscrire maintenant" + "Rejoindre le Discord", carte map. Très complet.
- Problèmes : aucun (les ids cuid redirigent proprement vers un slug).
- Verdict : **OK** (page la plus aboutie).

### `/anime/[slug]` & `/anime/[slug]/[episode]`
- Captures : `anime-metal-fight-beyblade-*.png`, `anime-metal-fight-beyblade-ep1-*.png`.
- Rendu : hero série + grille d'épisodes ; page épisode = lecteur vidéo + liste épisodes sidebar + "Épisode suivant". Responsive OK.
- Problèmes : aucun.
- Verdict : **OK**.

### `/profile/[id]` — Profil joueur public
- Capture : `profile-cmn2jxtyv003w7ma3jp31xplh-*.png`.
- Rendu : header (avatar, pseudo, "Partager", "Carte Bey..."), stats globales, sections Rivalités / Pièces favorites / Historique des matchs.
- Problèmes : 🟢 états vides minimalistes ("Aucun match", "Aucune pièce") sans CTA — correct mais améliorable.
- Verdict : **OK**.

### `/dashboard`, `/admin` — Auth-gated
- Captures : `dashboard-*.png`, `admin-*.png` (= page `/sign-in` après redirect).
- Comportement : **307 → /sign-in** (curl confirme). Gating correct, pas d'auth tentée.
- Verdict : **OK** (attendu).

---

## Notes de méthode

- Les `net::ERR_ABORTED` sur `…?_rsc=…` sont des **prefetch RSC Next.js annulés** (l'utilisateur/le crawler quitte la page avant la fin) → **bénins**, exclus des comptes "vrais bugs".
- Les **429** proviennent du **crawl séquentiel rapide** (beaucoup de `get-session` d'affilée) — artefact de test, mais révèle un rate-limit bas + un appel session non-dédupliqué (reco #5).
- 4 pages (`home`, `tournaments`, `builder`, `notre-equipe`) ont vu leur reload mobile timeout (réseau jamais idle à cause des prefetch/websockets continus) → screenshot desktop pris au viewport mobile en fallback. Rendu lisible, contenu validé.
- **Aucune** image interne cassée, **aucune** exception JS applicative détectée.
