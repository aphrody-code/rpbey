import "server-only";
import { cookies, headers } from "next/headers";
import { auth } from "@/lib/auth";
import type { Voter } from "@/server/dal/polls";

const ANON_COOKIE = "rpb_anon";

/**
 * Identité de vote en LECTURE seule (pas d'écriture de cookie) : compte connecté
 * ou anonyme existant. Utilisé par les routes publiques `/api/v1` (GET).
 */
export async function readVoter(): Promise<Voter> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (session?.user) return { userId: session.user.id };
  const anon = (await cookies()).get(ANON_COOKIE)?.value ?? null;
  return { anonId: anon };
}

/**
 * Identité de vote pour une MUTATION (vote / soumission) : compte connecté, sinon
 * anonyme stable via cookie (créé si absent). À n'appeler que dans un Route Handler.
 */
export async function resolveVoter(): Promise<Voter> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (session?.user) return { userId: session.user.id };
  const store = await cookies();
  let anon = store.get(ANON_COOKIE)?.value;
  if (!anon) {
    anon = crypto.randomUUID();
    store.set(ANON_COOKIE, anon, {
      httpOnly: true,
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 365,
      path: "/",
    });
  }
  return { anonId: anon };
}
