#!/usr/bin/env bun
/**
 * refresh-search-corpus.ts — invalide le corpus de recherche consolidé dans Redis
 * (clé `rpbey:search:corpus:v1`). À lancer après tout refresh de data indexée
 * (export X, bx-catalog, bbx-weekly, frames…) : le prochain hit `/api/v1/search`
 * reconstruit le corpus depuis les sources fraîches et le ré-consolide dans Redis.
 *
 *   bun apps/web/scripts/refresh-search-corpus.ts
 */
const KEY = "rpbey:search:corpus:v1";
const url = process.env.REDIS_URL ?? "redis://127.0.0.1:6379";
const r = new Bun.RedisClient(url);
const removed = await r.del(KEY);
console.log(`corpus Redis invalidé (${KEY}, del=${removed}) — rebuild au prochain /api/v1/search`);
r.close();
