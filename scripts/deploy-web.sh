#!/usr/bin/env bash
# Déploiement web self-host VPS (Next 16 standalone).
# Idempotent — à relancer APRÈS chaque `next build` : le build régénère
# `.next/standalone/` et N'INCLUT PAS `public/` ni les `data/*` exclus du
# tracing (cf. outputFileTracingExcludes). Sans ce script → JS chunks 404,
# images 404, rankings/tournois vides.
set -eo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(dirname "$SCRIPT_DIR")"
cd "$ROOT/apps/web"

ASSETS="$ROOT/apps/cdn/assets/rpb-dashboard"   # public/ (logos, parts, partners…)
DATA_SRC="$ROOT/apps/web/data"                 # data/* (a exports→CDN, satr/wb history, pools...)
EXPORTS_CDN=/var/www/cdn/static/rpb-dashboard/data/exports # B_TS*.json + participants_map.json
BEYLIB_CDN="$ROOT/apps/cdn/assets/rpb-bey-library/bey-library-complete.json" # /api/bey-library
SA=.next/standalone/apps/web

echo "[deploy] build present ?"; test -f .next/BUILD_ID || { echo "ERREUR: lance d'abord 'next build'"; exit 1; }

echo "[deploy] static → standalone (chunks JS/fonts, hash-matched au server.js du build)"
rm -rf "$SA/.next/static"
cp -r .next/static "$SA/.next/static"

# Cache ISR : standalone n'embarque PAS .next/cache. Sans ce dir, le runtime
# tente un mkdir bloqué par systemd (ProtectSystem=strict, ReadWritePaths=.next)
# → EROFS en boucle + InvariantError "client reference manifest" en cascade.
# Le pré-créer (sous ReadWritePaths donc inscriptible) suffit.
mkdir -p "$SA/.next/cache"

echo "[deploy] public → assets cdn/rpb-dashboard"
ln -sfn "$ASSETS" public
ln -sfn "$ASSETS" "$SA/public"

echo "[deploy] data/exports : COPIE des B_TS*.json (PAS un symlink → /var/www :"
echo "         Turbopack rejette un symlink hors racine projet au build)"
mkdir -p "$DATA_SRC/exports"
cp -f "$EXPORTS_CDN"/*.json "$DATA_SRC/exports/"
echo "[deploy] data/bey-library : COPIE (exclu du tracing, lu via process.cwd() par /api/bey-library)"
mkdir -p "$DATA_SRC/bey-library"
[ -f "$BEYLIB_CDN" ] && cp -f "$BEYLIB_CDN" "$DATA_SRC/bey-library/bey-library-complete.json"

echo "[deploy] data/* repo → standalone (rm d'abord : sinon ln crée un nested symlink dans le dir réel généré par le build)"
rm -rf "$SA/data"
ln -sfn "$DATA_SRC" "$SA/data"

# @tobyg74/tiktok-api-dl : Next trace le package dans standalone mais PAS son
# sous-dossier helper/ (chargé via __dirname au runtime → ENOENT signature.js).
# On le copie (feature TikTok du /tv, sinon unhandledRejection en boucle).
TT_PKG_SRC="$ROOT/node_modules/@tobyg74/tiktok-api-dl"
TT_HELPER_SRC="$TT_PKG_SRC/helper"
if [ -d "$TT_PKG_SRC" ]; then
	# Next trace @tobyg74/tiktok-api-dl de façon INCOMPLÈTE : helper/ est chargé via
	# __dirname au runtime, donc seul xbogus.js est tracé (signature.js absent) →
	# ENOENT helper/signature.js en boucle (unhandledRejection /tv). Le runtime peut
	# résoudre le package depuis l'une des copies (root standalone OU apps/web/node_modules).
	# On garantit le package complet dans apps/web/node_modules ET on re-remplit helper/
	# dans TOUTE copie tracée (root + apps/web + .next) pour couvrir la résolution réelle.
	echo "[deploy] tiktok-api-dl (+helper) → toutes copies standalone"
	mkdir -p "$SA/node_modules/@tobyg74"
	cp -rf "$TT_PKG_SRC" "$SA/node_modules/@tobyg74/"
	find .next/standalone -type d -path "*@tobyg74/tiktok-api-dl" -exec cp -rf "$TT_HELPER_SRC" {}/ \;
fi

echo "[deploy] OK — restart : sudo systemctl restart rpbey-web.service"
