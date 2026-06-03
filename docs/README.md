---
title: "Documentation — index"
description: "Index arborescent généré de toute la doc sous docs/."
scope:
  - docs
status: "generated"
last_updated: "2026-06-03"
---
# Documentation — index

> Généré par `bun scripts/docs.ts index --write`. Ne pas éditer à la main : régénéré par le script ci-dessous.

Cartographie du repo (apps/packages) : [REPO_MAP.md](REPO_MAP.md).

## Général

- [Connaissance Beyblade — crawler wiki, entité canonique & graphe de liens](beyblade-knowledge.md) `stable` — Le pipeline de connaissance rpbey : crawler MediaWiki exhaustif (toutes saisons), module d'entité canonique, combos enrichis, graphe d'entités cross-linké et son câblage dans la recherche + les pages produit/anime/builder.
- [Système communautaire — profils enrichis, équipes & onboarding](community-system.md) `draft` — Architecture API-first de la transformation communautaire de rpbey : personnalisation complète du profil, système d'équipes (clans) avec membres/invitations/chat, et flow d'inscription + onboarding. Tables DB, surface API, DAL et UI.
- [Guide de Crawling & RAG X.com (Twitter)](crawling-rag-x.md) `draft` — Système de crawling autonome et RAG Gemini sur les discussions métagame Beyblade X depuis x.com.
- [Best practices du pipeline de données rpbey](data-pipeline-best-practices.md) `stable` — Référentiel opinioné — scraping → validation → consolidation → recherche hybride/RAG → observabilité — confronté à l'état réel du pipeline rpbey, avec backlog d'actions priorisé.
- [Système de documentation (structuré, automatisé, sync)](documentation-system.md) `stable` — Convention frontmatter, commandes docs.ts et hook git qui gardent la doc typée et synchronisée avec le code.
- [Métagame WBO — extraction & données consommées par rpbey](metagame-wbo.md) `stable` — Pipeline d'extraction des classements et du métagame WBO (Wayback Machine) consommé par le dashboard rpbey.
- [Sondages, Tier Lists & Beyblade Awards](polls-awards.md) `draft` — Système de vote communautaire de rpbey : sondages (choix unique/multiple/notation), tier lists S→F, et le concept phare Beyblade Awards France (éditions, nominés Discord/X, résultats réels 2025 importés du Google Form). Schéma DB, API, DAL, UI et invariants (enveloppe SWR, vote anonyme).
- [Assistant RAG conversationnel & UI d'ambiance](rag-assistant-ui.md) `stable` — Couche de consommation du RAG rpbey : backend de chat « Rpbey » (retrieval hybride déterministe) — UI retirée du site, conservé en background — et fonds d'ambiance par page/section (frames d'animé, parallaxe au scroll) tirés du corpus.
- [Stratégie SEO — devenir le site Beyblade n°1 en France](seo-strategy.md) `draft` — Plan SEO actionnable pour rpbey.fr, fondé sur la veille concurrentielle de x-rank.fr et beyblade-espace.fr (2026-05-30) : forces, failles exploitables, et feuille de route technique + contenu pour dominer le référencement Beyblade FR.

## audit

- [404 / 500 / erreurs console / images cassées — consolidé](audit/404-and-errors.md) `stable` — Détail des erreurs réseau (404, 500, ORB, 429) relevées lors de l'audit prod rpbey.fr du 2026-05-28.
- [Audit complet — rpbey.fr (apps/web)](audit/AUDIT.md) `stable` — Rapport d'audit Chromium prod rpbey.fr (27 routes, desktop + mobile) du 2026-05-28 avec top 10 problèmes prioritaires.

## bun

- [Bun — doc vendorée (knowledge base monorepo rpbey)](bun/README.md) `stable` — Documentation vendorée du runtime Bun 1.3.x utilisé par tout le monorepo rpbey.

## bxc

- [bxc — API TypeScript](bxc/api.md) `stable` — Référence de l'API TypeScript bxc : Browser.newPage, Page, profil ghost et interop Puppeteer.
- [bxc — Serveur MCP](bxc/mcp.md) `stable` — Serveur MCP stdio bxc-native-mcp : installation, 6 outils exposés et cas d'usage agent.
- [bxc — moteur de navigation « Zero-Spawn » pour agents](bxc/README.md) `stable` — Présentation du toolchain bxc : profils, CLI, pièges bxc-engine et intégration rpbey.
- [bxc — Recettes](bxc/recipes.md) `stable` — Recettes pratiques bxc testées sur le VPS : Challonge TLS, checkpoint Vercel, SPA, miroir.

## challonge

- [Challonge — Cartographie des routes & API](challonge/api-routes.md) `stable` — Table exhaustive des endpoints Challonge : REST v1, v2.1 OAuth JSON:API, routes SSR internes et GraphQL interne.
- [Challonge — Inventaire des données (extrait vs manquant)](challonge/data-inventory.md) `stable` — Mapping fixtures vs données déjà extraites par ScrapedTournament, et gaps à combler dans le module scraper.
- [Challonge — Stack applicative & signatures de détection](challonge/framework-stack.md) `stable` — Ruby on Rails, react-rails, asset pipeline dual, Faye, analytics et signatures CSS/HTML de détection pour le scraper.
- [Challonge — Infrastructure / DNS / CDN](challonge/infra-dns-cdn.md) `stable` — DNS, IPs Cloudflare, sous-domaines, TLS, posture bot-management et impact sur le scraper curl-impersonate.
- [Challonge — Types de page, stores & sélecteurs CSS](challonge/pages-selectors.md) `stable` — Par type de page : url pattern, statut CF live, stores _initialStoreState, sélecteurs CSS exacts et données extractables.
- [Challonge — Stores `window._initialStoreState`](challonge/react-stores.md) `stable` — Inventaire de chaque store Flux Challonge : clé, shape, sérialisation JS-literal vs JSON et parsers disponibles.
- [Challonge.com — cartographie pour le scraper rpbey](challonge/README.md) `stable` — Vue d'ensemble factuelle de challonge.com — stack, routes, accès API et scraper — pour le module @rose-griffon/challonge.
- [Challonge — Moteur de recherche / découverte de tournois](challonge/search-engine.md) `stable` — Endpoints de recherche et découverte de tournois Challonge : XHR tournaments.json, games.json, filtres game_id et gating CF.

## drizzle

- [Drizzle — doc vendorée (knowledge base refactor rpbey)](drizzle/README.md) `stable` — Documentation vendorée de Drizzle ORM 0.45.2 et drizzle-kit 0.31.10 pour le schéma partagé rpbey.

## gacha

- [Client Discord Activity gacha — `apps/gacha-client` (PixiJS v8)](gacha/activity-client.md) `stable` — Client de jeu gacha embarqué dans Discord (Activity) : rendu PixiJS pixel-perfect des frames d'anime, scène de pull/reveal, Colyseus temps réel, auth Embedded App SDK, build Vite/Bun, déploiement play.rpbey.fr.
- [Gacha — Pipeline d'assets (catalogue)](gacha/assets-pipeline.md) `stable` — Chaîne Bun-native scrape→optim→classif→montage→publication Discord pour le catalogue de cartes gacha.
- [Gacha — Bot Discord (client du serveur `:5050`)](gacha/bot.md) `stable` — Client gacha du bot Discord : authentification Bearer, endpoints appelés, commandes /gacha /duel /jeu.
- [Gacha — Base de données](gacha/database.md) `stable` — Tables gacha dans @rpbey/db : schéma, enums, invariant timestamp mode string vs date.
- [Système Gacha — RPBey](gacha/README.md) `stable` — Documentation canonique du gacha TCG Beyblade : trois surfaces web, bot, serveur sur une DB partagée.
- [Gacha — Règles & mécaniques](gacha/rules.md) `stable` — Raretés, coûts, pity, daily/streak, duel, économie/dette, badges, fusion et roster bannière 1.
- [Gacha server — références (Colyseus / Discord Activity)](gacha/server-references.md) `stable` — Liens de référence Colyseus 0.17, Discord Activity template, PixiJS et notes d'intégration réseau.
- [Serveur gacha `:5050` — `apps/gacha-server` (Colyseus / Bun)](gacha/server.md) `stable` — Serveur de jeu gacha Colyseus/Bun : REST économie, salle temps réel, CORS, déploiement systemd/nginx.
- [Gacha — Couche web (`apps/web`, Next.js `:3002`)](gacha/web.md) `stable` — Routes API gacha Next.js (legacy + v1), DAL Drizzle, service, server actions et pages dashboard.

## m3

- [Mapping composants MUI → Material Design 3 (web)](m3/component-mapping.md) `draft` — Table de correspondance MUI v9 → composants M3 (md-* @material/web + Md* @aphrody-code/m3-react), disponibilité web, gaps et composants sans équivalent.
- [Plan de migration MUI → Material Design 3 (apps/web)](m3/migration-plan.md) `draft` — Stratégie, véhicule, phasage en vagues, gates et risques pour migrer le dashboard Next.js de MUI v9 + Emotion vers Material Design 3 sur le web.
- [Inventaire MUI — surface actuelle (apps/web)](m3/mui-inventory.md) `draft` — Volume, composants, idiomes de style, système de thème et surface MUI X du dashboard, snapshot pré-migration M3.
- [Refonte /search & /comparateur — Material 3 vivant et moderne](m3/search-redesign-plan.md) `draft` — Diagnostic visuel (captures prod), écart vs M3, et plan d'exécution pour transformer la page search (gabarit MUI-free) et le comparateur d'un clone Google Search plat en une UI Material You / M3 Expressive : profondeur tonale, couleur générée, imagerie, motion chorégraphiée.
- [Stratégie tokens, thème, typo & motion (MUI → M3)](m3/theme-tokens.md) `draft` — Mapping palette/typo/forme MUI → tokens M3 (--md-sys-*), dynamic color HCT, comparatif des véhicules web, échelle typographique et tokens de motion.

## nextjs

- [Next.js — notes build rpbey (apps/web)](nextjs/README.md) `stable` — Pièges de build Next.js App Router pour le dashboard rpbey (VPS standalone). La doc Next.js complète est bundlée et version-matchée — voir ci-dessous.
