#!/usr/bin/env bash
# sync-profiles.sh — synchronisation COMPLÈTE des profils, en deux temps :
#
#   1. Enrichissement Discord (REST) : pour chaque user lié à un compte Discord,
#      remplit globalName / nickname / serverAvatar / image / roles / joinedAt /
#      premiumSince / discordTag depuis la guilde (apps/web/scripts/sync-discord-members.ts).
#
#   2. Recalcul global du classement : agrège les stats de CHAQUE joueur sur TOUS
#      les tournois (inscrits ET non-inscrits, par nom), réécrit `global_rankings`
#      et met à jour les `profiles` des comptes liés
#      (apps/web/scripts/recompute-rankings.ts → runFullRecalculation).
#
# Token Discord lu depuis apps/bot/.env (jamais affiché). DB via socket local.
# Lancé quotidiennement par le timer systemd `rpbey-profile-sync.timer`, ou à la main :
#   bash scripts/sync-profiles.sh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BUN="${BUN:-/home/ubuntu/.bun/bin/bun}"

cd "$ROOT/apps/web"

echo "[sync-profiles] 1/2 — enrichissement Discord des comptes liés…"
"$BUN" --env-file="$ROOT/apps/bot/.env" scripts/sync-discord-members.ts

echo "[sync-profiles] 2/2 — recalcul du classement global (tous tournois, inscrits + non-inscrits)…"
"$BUN" --env-file="$ROOT/apps/bot/.env" scripts/recompute-rankings.ts

echo "[sync-profiles] OK."
