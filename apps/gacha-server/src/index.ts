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
import { ALLOWED_HEADERS, ALLOWED_METHODS, FALLBACK_ORIGIN, HOST, PORT } from "./config";
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
    // CORS OUVERT sur toutes les routes express (REST économie, /discord_token,
    // /health). Colyseus ne pose son CORS que sur ses endpoints matchmaking ;
    // les routes express doivent l'avoir explicitement. On reflète l'origine
    // reçue (compatible credentials / header Authorization) → toute origine est
    // admise ; `*` si aucune `Origin`. Preflight OPTIONS → 204.
    app.use((req, res, next) => {
      const origin = req.headers.origin;
      res.setHeader("Access-Control-Allow-Origin", origin ?? FALLBACK_ORIGIN);
      res.setHeader("Access-Control-Allow-Credentials", "true");
      res.setHeader("Access-Control-Allow-Methods", ALLOWED_METHODS);
      res.setHeader("Access-Control-Allow-Headers", ALLOWED_HEADERS);
      res.setHeader("Access-Control-Max-Age", "86400");
      res.setHeader("Vary", "Origin");
      if (req.method === "OPTIONS") {
        res.statusCode = 204;
        res.end();
        return;
      }
      next();
    });

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

// Arrêt gracieux. @colyseus/core enregistre déjà SIGTERM/SIGINT/SIGUSR2 (option
// `gracefullyShutdown: true` par défaut) qui dispose les rooms en mémoire et
// appelle ce callback. Cloud Run envoie SIGTERM avant de recycler l'instance ;
// les rooms étant stateful (état en mémoire, AUCUNE persistance disque), on les
// laisse se disposer proprement — l'état dérivable est en DB Neon (best-effort
// en mémoire). On loggue pour l'observabilité.
server.onShutdown(() => {
  process.stderr.write("[gacha-server] arrêt gracieux (rooms disposées)\n");
});

server.listen(PORT, HOST);
process.stderr.write(`[gacha-server] Colyseus écoute sur http://${HOST}:${PORT}\n`);
