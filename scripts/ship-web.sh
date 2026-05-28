#!/usr/bin/env bash
# ship-web.sh — déploiement web en UNE commande.
#   build (Next 16 canary + Turbopack, FS cache) → standalone deploy → restart → healthcheck.
# Idempotent. Usage : bash scripts/ship-web.sh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WEB="$ROOT/apps/web"
URL="${SHIP_HEALTHCHECK_URL:-https://rpbey.fr/}"

echo "▸ [1/4] build (turbopack)…"
cd "$WEB"
bun --env-file=../../.env next build --turbopack

echo "▸ [2/4] deploy standalone (static/public/data)…"
bash "$ROOT/scripts/deploy-web.sh"

echo "▸ [3/4] restart rpbey-web.service…"
sudo systemctl restart rpbey-web.service

echo "▸ [4/4] healthcheck $URL …"
for i in $(seq 1 15); do
	code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 8 "$URL" || echo 000)"
	if [ "$code" = "200" ]; then
		echo "✓ live ($code) — déploiement OK"
		exit 0
	fi
	sleep 2
done
echo "✗ healthcheck KO (dernier code: ${code:-?}) — vérifier: sudo journalctl -u rpbey-web.service -n 50" >&2
exit 1
