import "server-only";
import crypto from "node:crypto";
import { db, schema } from "@/lib/db";

/**
 * Data Access Layer — pont d'authentification gacha pour le jeu navigateur
 * (play.rpbey.fr hors Discord). Minte une session Bearer dans la table `sessions`
 * PARTAGÉE, de la MÊME forme que `apps/gacha-server/src/discord-token.ts`, pour un
 * utilisateur RÉEL déjà authentifié via better-auth (proxy login rpbey). Le serveur
 * gacha (REST économie) valide ce Bearer contre la même table → le joueur navigateur
 * joue avec SON vrai compte (monnaie/pity synchronisés avec Discord).
 *
 * `sessions` est une table AUTH (`mode:"date"`) → colonnes timestamp en objets Date.
 */
const SESSION_TTL_MS = 6 * 3_600_000; // 6 h, aligné sur discord-token.ts

export async function mintGachaWebSession(userId: string): Promise<string> {
  const token = crypto.randomBytes(32).toString("hex");
  const now = new Date();
  await db.insert(schema.sessions).values({
    id: crypto.randomUUID(),
    userId,
    token,
    expiresAt: new Date(Date.now() + SESSION_TTL_MS),
    createdAt: now,
    updatedAt: now,
    userAgent: "gacha-web",
  });
  return token;
}
