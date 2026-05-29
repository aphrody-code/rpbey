/**
 * Serveur gacha — Colyseus 0.17 sur Bun (transport BunWebSockets), :5050.
 * Recréé depuis le template colyseus/discord-activity + le contrat client
 * apps/bot/src/lib/gacha-api.ts. Backé par la DB partagée @rpbey/db.
 *
 *   - REST économie (bot)  → routes express (src/rest.ts)
 *   - Discord Activity     → POST /discord_token (src/discord-token.ts) + GachaRoom
 *   - Realtime             → GachaRoom (état Schema synchronisé)
 *
 * Lancer : `bun src/index.ts` depuis apps/gacha-server (charge .env).
 */
import { JWT } from "@colyseus/auth";
import { BunWebSockets } from "@colyseus/bun-websockets";
import { monitor } from "@colyseus/monitor";
import { playground } from "@colyseus/playground";
import { defineRoom, defineServer } from "colyseus";
import express from "express";
import { HOST, PORT } from "./config";
import { configureCors } from "./cors";
import { mountDiscordToken } from "./discord-token";
import { mountRest } from "./rest";
import { GachaRoom } from "./rooms/GachaRoom";

// Secret JWT pour l'auth de la Room (Discord Activity). Partage le secret de
// l'écosystème (better-auth) : `BETTER_AUTH_SECRET` (clé canonique du bot/web).
const jwtSecret =
  process.env.JWT_SECRET ??
  process.env.AUTH_SECRET ??
  process.env.BETTER_AUTH_SECRET ??
  "gacha-dev-secret-change-me";
JWT.settings.secret = jwtSecret;
if (jwtSecret === "gacha-dev-secret-change-me" && process.env.NODE_ENV === "production") {
  // Refuse de démarrer : un secret JWT public en prod rend l'auth de Room
  // (Discord Activity) forgeable. Pose BETTER_AUTH_SECRET dans l'environnement.
  process.stderr.write(
    "[gacha-server] FATAL — JWT secret = fallback dev en PRODUCTION. Pose BETTER_AUTH_SECRET.\n",
  );
  process.exit(78); // EX_CONFIG
}

// Restreint le CORS de Colyseus (permissif par défaut : reflète toute origine).
configureCors();

const server = defineServer({
  transport: new BunWebSockets(),

  rooms: {
    gacha: defineRoom(GachaRoom).filterBy(["channelId"]),
  },

  express: (app) => {
    app.use(express.json());

    app.get("/health", (_req, res) => {
      res.json({ ok: true, service: "gacha-server", port: PORT });
    });

    // REST économie (consommée par le bot) + token-exchange Discord Activity.
    // L'app Colyseus est express-compatible — cast vers nos types souples.
    mountRest(app as never);
    mountDiscordToken(app as never);

    // Outils Colyseus (playground hors prod, monitor à protéger en prod).
    if (process.env.NODE_ENV !== "production") app.use("/playground", playground());
    app.use("/monitor", monitor());
  },
});

server.listen(PORT, HOST);
process.stderr.write(`[gacha-server] Colyseus écoute sur http://${HOST}:${PORT}\n`);
