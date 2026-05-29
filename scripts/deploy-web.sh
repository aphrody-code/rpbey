#!/usr/bin/env bash
# Déploiement web self-host VPS (Next 16 standalone).
# Idempotent — à relancer APRÈS chaque `next build` : le build régénère
# `.next/standalone/` et N'INCLUT PAS `public/` ni les `data/*` exclus du
# tracing (cf. outputFileTracingExcludes). Sans ce script → JS chunks 404,
# images 404, rankings/tournois vides.
set -eo pipefail
cd /home/ubuntu/rpbey/apps/web

ASSETS=/home/ubuntu/rpbey/apps/cdn/assets/rpb-dashboard   # public/ (logos, parts, partners…)
DATA_SRC=/home/ubuntu/rpbey/apps/web/data                 # data/* (a exports→CDN, satr/wb history, pools…)
EXPORTS_CDN=/var/www/cdn/static/rpb-dashboard/data/exports # B_TS*.json + participants_map.json
BEYLIB_CDN=/home/ubuntu/rpbey/apps/cdn/assets/rpb-bey-library/bey-library-complete.json # /api/bey-library
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
TT_PKG_SRC=/home/ubuntu/rpbey/node_modules/@tobyg74/tiktok-api-dl
TT_PKG_DST="$SA/node_modules/@tobyg74/tiktok-api-dl"
if [ -d "$TT_PKG_SRC" ]; then
	# Next ne trace PAS @tobyg74/tiktok-api-dl dans standalone (dir parent absent) ;
	# l'ancienne garde [ -d dirname ] sautait donc la copie → ENOENT helper/signature.js
	# en boucle (unhandledRejection /tv). On copie le PACKAGE entier en créant le parent.
	echo "[deploy] tiktok-api-dl (+helper) → standalone (package non tracé par Next)"
	mkdir -p "$(dirname "$TT_PKG_DST")"
	cp -rf "$TT_PKG_SRC" "$(dirname "$TT_PKG_DST")/"
fi

echo "[deploy] OK — restart : sudo systemctl restart rpbey-web.service"
