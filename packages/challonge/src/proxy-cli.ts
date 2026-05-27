/**
 * CLI entry point for the Challonge local HTTP proxy.
 *
 * Usage:
 *   bun src/proxy-cli.ts
 *   PORT=7878 CHALLONGE_PROXY_TOKEN=secret bun src/proxy-cli.ts
 *
 * Environment variables:
 *   PORT                    TCP port (default 7878)
 *   CHALLONGE_PROXY_TOKEN   If set, all non-health routes require
 *                           `Authorization: Bearer <token>`
 *   CHALLONGE_COOKIE_PATH   Path to challonge_cookie.json
 *                           (default: auto-discovered by curl-impersonate transport)
 */

import { type startChallongeProxy } from "./proxy";

const port = Number(process.env.PORT ?? "7878");
const token = process.env.CHALLONGE_PROXY_TOKEN || undefined;
const cookiePath = process.env.CHALLONGE_COOKIE_PATH || undefined;

const server = startChallongeProxy({ port, token, cookiePath });

const auth = token ? " [token auth ON]" : " [no auth]";
console.log(`challonge-proxy on ${server.url}${auth}`);
console.log(
  "    routes: GET /, /:slug, /:slug/store, /:slug/log, /:slug/standings, /:slug/participants, /:slug/page/:sub",
);
console.log("    ?profile=chrome131|chrome136|firefox147|...  override curl profile");
