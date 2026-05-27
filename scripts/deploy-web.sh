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
SA=.next/standalone/apps/web

echo "[deploy] build present ?"; test -f .next/BUILD_ID || { echo "ERREUR: lance d'abord 'next build'"; exit 1; }

echo "[deploy] static → standalone (chunks JS/fonts, hash-matched au server.js du build)"
rm -rf "$SA/.next/static"
cp -r .next/static "$SA/.next/static"

echo "[deploy] public → assets cdn/rpb-dashboard"
ln -sfn "$ASSETS" public
ln -sfn "$ASSETS" "$SA/public"

echo "[deploy] data/exports : COPIE des B_TS*.json (PAS un symlink → /var/www :"
echo "         Turbopack rejette un symlink hors racine projet au build)"
mkdir -p "$DATA_SRC/exports"
cp -f "$EXPORTS_CDN"/*.json "$DATA_SRC/exports/"
echo "[deploy] data/* repo → standalone"
ln -sfn "$DATA_SRC" "$SA/data"

echo "[deploy] OK — restart : sudo systemctl restart rpbey-web.service"
