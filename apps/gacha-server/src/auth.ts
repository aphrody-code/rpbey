/**
 * Auth Bearer : valide un token contre la table `sessions` partagée (le bot
 * minte ces tokens via apps/bot/src/lib/gacha-api.ts). Renvoie l'utilisateur
 * (modèle « service-token » : token brut non haché, même DB).
 */
import { db, schema } from "@rpbey/db";
import { and, eq, gt } from "drizzle-orm";

const { sessions, users } = schema;

export interface AuthUser {
  id: string;
  name: string | null;
  image: string | null;
  role: string;
  isAdmin: boolean;
}

/** Extrait le Bearer token de l'en-tête Authorization. */
export function bearerToken(req: Request): string | null {
  const h = req.headers.get("authorization");
  if (!h?.startsWith("Bearer ")) return null;
  const t = h.slice(7).trim();
  return t.length > 0 ? t : null;
}

/** Résout un token de session valide → utilisateur, ou null. */
export async function resolveUser(token: string): Promise<AuthUser | null> {
  const rows = await db
    .select({
      id: sessions.userId,
      name: users.name,
      image: users.image,
      role: users.role,
      banned: users.banned,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(and(eq(sessions.token, token), gt(sessions.expiresAt, new Date())))
    .limit(1);

  const row = rows[0];
  if (!row || row.banned) return null;
  const role = row.role ?? "user";
  return {
    id: row.id,
    name: row.name,
    image: row.image,
    role,
    isAdmin: role === "admin" || role === "superadmin",
  };
}
