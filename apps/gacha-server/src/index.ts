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

// Secret JWT pour l'auth de la Room (Discord Activity).
JWT.settings.secret =
  process.env.JWT_SECRET ?? process.env.AUTH_SECRET ?? "gacha-dev-secret-change-me";

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
