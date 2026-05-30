---
title: "Stratégie SEO — devenir le site Beyblade n°1 en France"
description: "Plan SEO actionnable pour rpbey.fr, fondé sur la veille concurrentielle de x-rank.fr et beyblade-espace.fr (2026-05-30) : forces, failles exploitables, et feuille de route technique + contenu pour dominer le référencement Beyblade FR."
scope:
  - apps/web
status: "draft"
last_updated: "2026-05-30"
---

# Stratégie SEO — devenir le site Beyblade n°1 en France

> Document fondé sur une veille concurrentielle réelle menée le 2026-05-30 sur les
> deux principaux concurrents FR (x-rank.fr, beyblade-espace.fr). Toutes les valeurs
> citées proviennent de réponses HTTP réelles. Objectif : faire de **rpbey.fr** le
> résultat de référence sur les requêtes Beyblade francophones.

## 1. Paysage concurrentiel (synthèse de la veille)

| Axe | x-rank.fr | beyblade-espace.fr | rpbey.fr (nous) |
| --- | --- | --- | --- |
| Stack front | Next.js/Vercel (fra1) | Next.js/Vercel (fra1) | Next.js 16/VPS, RSC SSR |
| Backend | Supabase (PostgREST) | API routes Next → MySQL Hostinger + Firebase | Postgres local + Drizzle, DAL server-only |
| Âge domaine | 2025-11-27 (~6 mois) | 2025-03-20 (~14 mois) | établi |
| Rendu | **CSR pur** (cyberpunk SPA) | **CSR quasi-pur** (shell vide en SSR) | **SSR/RSC** (contenu visible crawler) |
| robots.txt | **absent (404)** | présent mais permissif | présent (`robots.ts`) |
| sitemap.xml | **absent (404)** | **absent** | présent (`sitemap.ts`) |
| JSON-LD | **aucun** | **aucun** | présent (`JsonLd`/`SchemaOrg`) |
| canonical | **aucun** | **aucun** | per-page |
| meta description | unique mais générique EN | **dupliquée** sur toutes les pages | per-page (40 `generateMetadata`) |
| OG dynamique | statique (logo) | statique (logo) | routes OG dynamiques (`/api/og/*`) |

**Conclusion centrale :** les deux concurrents ont un **SEO technique quasi inexistant**
(contenu invisible aux crawlers car CSR, ni sitemap, ni JSON-LD, ni canonical, metas
pauvres). C'est notre **principal levier** : nous rendons déjà en SSR/RSC et disposons
de l'ossature SEO. Le travail consiste à **étendre** cette ossature à toutes les
nouvelles surfaces et à **saturer le champ lexical Beyblade FR** avec du contenu unique.

### Forces des concurrents à neutraliser
- **x-rank.fr** : ELO régional FR, stats de finish par match (Burst/Spin/Over/Xtreme),
  base pièces/combos Beyblade X (1664 combos), inscriptions tournoi avec deck, PWA push,
  système d'équipes (`team_list`).
- **beyblade-espace.fr** : encyclopédie produit grand public (1819 toupies, 4 générations,
  descriptions FR éditoriales), magazine PDF maison (37 volumes), news éditoriales,
  classement « Ligue Dynastie » (Challonge).

### Avantages rpbey à mettre en avant (contenu unique = SEO long-terme)
- Gacha/TCG, économie, duels, battle-engine Elo/MMR — **personne d'autre ne les a**.
- Bot Discord + Discord Activity (trafic entrant + engagement).
- Base de connaissances anime/lore (~17k entités) + recherche BM25F.
- **Désormais** : système d'équipes complet + profils ultra-personnalisables.
- **Confiance / RGPD** : contrôles de visibilité du profil (localisation/réseaux masqués
  par défaut). Différenciateur fort face à x-rank (fuite de PII observée chez eux ;
  nous ne l'exploitons pas — nous faisons l'inverse, by-design privacy).

## 2. Mots-clés cibles (champ lexical FR)

**Têtes de requête** (volume, intention transactionnelle/navigationnelle) :
`classement beyblade france`, `tournoi beyblade`, `tournoi beyblade x`,
`communauté beyblade france`, `équipe beyblade` / `clan beyblade`,
`deck beyblade x`, `meta beyblade x`, `combo beyblade x`, `pièces beyblade x`.

**Longue traîne (génératif, 1 page indexable par entité)** :
- par pièce/bey : `<nom> beyblade x stats`, `meilleur combo <blade>` ;
- par tournoi : `<nom tournoi> résultats <ville>` (cf. la seule page bien titrée de
  x-rank : `[BE] Golden Claw - Lyon ... | Tournoi X-RANK` — à battre avec JSON-LD `SportsEvent`) ;
- par équipe : `équipe <tag> beyblade` ;
- par blader : `<bladerName> blader profil classement` ;
- par anime : `beyblade <saison> épisodes streaming` (couvrir les 4 générations).

**Stratégie** : chaque entité de nos bases (beys, pièces, combos, tournois, équipes,
profils, séries anime) = **une URL canonique SSR unique**, avec title/description/JSON-LD
propres. C'est la masse de pages indexables (des milliers) qui creuse l'écart — les
concurrents en CSR n'indexent quasiment rien.

## 3. Feuille de route technique

### 3.1 Données structurées (JSON-LD) — à compléter
Réutiliser `@/components/seo/JsonLd` + `SchemaOrg`. Ajouter / vérifier :
- `Organization` + `WebSite` (avec `SearchAction` → `/recherche?q=`) sur la home.
- `SportsEvent` sur chaque page tournoi (nom, date, lieu, organisateur, résultats).
- `SportsTeam` sur chaque page `/equipes/[slug]` (nom, logo, membres = `member`/`athlete`,
  `memberOf` Organization RPBey).
- `Person` / `ProfilePage` sur `/profile/[id]` (nom, image, équipe via `memberOf`).
- `ItemList` sur les classements et le leaderboard d'équipes.
- `BreadcrumbList` sur toutes les pages profondes (équipe, tournoi, bey, anime).
- `VideoObject` sur BeyTube, `FAQPage` sur les pages d'aide/règles.
- `Product` (déjà via comparateur) pour les pièces/produits.

### 3.2 sitemap & robots
- Étendre `apps/web/src/app/sitemap.ts` pour inclure dynamiquement : `/equipes`,
  chaque `/equipes/[slug]` publique, chaque `/profile/[id]` public (visibilité != PRIVATE),
  pages pièces/beys/combos, séries anime, tournois. Priorités et `lastModified` réels.
- `robots.ts` : autoriser tout sauf `/dashboard`, `/admin`, `/api` ; déclarer le sitemap.

### 3.3 Métadonnées par page
- Garder un `generateMetadata` par route dynamique (titre unique FR + description
  spécifique + canonical + OG/Twitter). Modèle de titre : `<Entité> — <contexte> | RPBey`.
- OG dynamiques : étendre `/api/og/*` (déjà `tournament`, `stardust`) à `team` et `profile`
  (image générée avec logo/avatar + stats). Forte amélioration du CTR social.
- `hreflang` : site FR mono-langue → `<html lang="fr">` + `og:locale=fr_FR` (déjà le cas).

### 3.4 Performance / Core Web Vitals
- RSC streaming (déjà) ; images via `next/image` + formats modernes ; `fetchPriority`
  sur le LCP ; cache edge/ISR sur les pages publiques (revalidate raisonnable).
- Éviter les gros bundles client sur les pages publiques (les concurrents chargent
  ~150-250 KB de SDK Supabase/Firebase côté client — nous restons légers via RSC).

### 3.5 Maillage interne
- Breadcrumbs partout ; cartes « équipes liées / membres / tournois récents » ;
  liens profil ↔ équipe ↔ tournois ↔ classements. Footer riche (plan du site).
- Les nouvelles surfaces (équipes, profils enrichis) densifient fortement le maillage.

## 4. Contenu & autorité
- **Encyclopédie** : exposer la base de connaissances (~17k entités) en pages SSR
  indexables (déjà partiellement via la recherche) — cible directe du catalogue
  beyblade-espace (1819) et de la base combos x-rank (1664), en plus riche.
- **Méta hebdomadaire** Beyblade X (déjà calculée) : page éditoriale fraîche = signal
  de fraîcheur + requêtes `meta beyblade x`.
- **Tournois** : pages résultats SSR avec `SportsEvent` (battre la seule force SEO de x-rank).
- **Équipes & profils** : des milliers de pages communautaires uniques (nouveau).
- **Anime/lore** : couvrir les 4 générations (requêtes streaming/épisodes).
- Le **bot Discord** et l'**Activity** alimentent le trafic et l'engagement (signaux indirects).

## 5. Checklist de domination (ordre d'impact)
1. [ ] Étendre `sitemap.ts` (équipes, profils publics, beys, combos, tournois, anime).
2. [ ] JSON-LD `SportsTeam` (équipes) + `Person`/`ProfilePage` (profils) + `ItemList` (classements).
3. [ ] `generateMetadata` + canonical sur `/equipes`, `/equipes/[slug]`, profils enrichis.
4. [ ] OG dynamiques `team` + `profile`.
5. [ ] `SportsEvent` JSON-LD sur les pages tournoi.
6. [ ] Pages entités encyclopédie SSR indexables (beys/pièces/combos).
7. [ ] Breadcrumbs + maillage interne sur toutes les pages profondes.
8. [ ] Surveiller CWV (LCP/INP) et budget JS des pages publiques.
9. [ ] Mettre en avant la confiance/RGPD (contrôles de visibilité) — page « confidentialité ».

> Avantage décisif : nos concurrents sont en CSR sans sitemap/JSON-LD/canonical. En
> rendant chaque entité en SSR avec données structurées et un sitemap exhaustif, rpbey
> peut indexer des ordres de grandeur plus de pages qu'eux — c'est le chemin le plus
> court vers la première place sur le Beyblade francophone.
