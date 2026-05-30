#!/usr/bin/env bash
# deploy-gacha-client.sh — build + déploie le client Discord Activity gacha
# (apps/gacha-client, PixiJS/Vite) sur play.rpbey.fr (nginx statique).
#
# - VITE_DISCORD_CLIENT_ID est lu depuis apps/bot/.env (Application ID, PUBLIC —
#   baké dans le bundle navigateur ; aucun secret n'entre dans dist/).
# - Les bases réseau (api.rpbey.fr/gacha, rpbey.fr) ont déjà les bons défauts
#   dans src/env.ts ; surchargeables via VITE_GACHA_WS_URL / VITE_GACHA_REST_URL
#   / VITE_WEB_BASE si besoin.
# - dist/ → /var/www/play.rpbey.fr (servi par /etc/nginx/conf.d/play.rpbey.fr.conf).
#
# Usage : bash scripts/deploy-gacha-client.sh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WEBROOT="/var/www/play.rpbey.fr"

cd "$ROOT/apps/gacha-client"

# Application (Client) ID public depuis l'env du bot — jamais affiché.
set -a
# shellcheck disable=SC1091
. "$ROOT/apps/bot/.env"
set +a
: "${DISCORD_CLIENT_ID:?DISCORD_CLIENT_ID manquant dans apps/bot/.env}"

echo "[gacha-client] type-check…"
bunx tsc --noEmit

echo "[gacha-client] build (Vite)…"
VITE_DISCORD_CLIENT_ID="$DISCORD_CLIENT_ID" bun run build

echo "[gacha-client] déploiement → $WEBROOT"
sudo mkdir -p "$WEBROOT"
if command -v rsync >/dev/null 2>&1; then
  sudo rsync -a --delete dist/ "$WEBROOT/"
else
  sudo rm -rf "${WEBROOT:?}/"* && sudo cp -r dist/. "$WEBROOT/"
fi
sudo chown -R www-data:www-data "$WEBROOT"
sudo find "$WEBROOT" -type d -exec chmod 755 {} \;
sudo find "$WEBROOT" -type f -exec chmod 644 {} \;

echo "[gacha-client] reload nginx"
sudo nginx -t && sudo systemctl reload nginx

echo "[gacha-client] OK — https://play.rpbey.fr/ ($(curl -s -o /dev/null -w '%{http_code}' https://play.rpbey.fr/))"
