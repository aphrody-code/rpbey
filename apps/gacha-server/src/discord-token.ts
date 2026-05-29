/**
 * Échange OAuth Discord Embedded App SDK → session gacha.
 * POST /discord_token : { code } → mint d'une session Bearer dans la table
 * `sessions` partagée (même modèle que apps/bot/src/lib/gacha-api.ts) + un JWT
 * Colyseus pour l'authentification de la Room (Discord Activity).
 */
import crypto from "node:crypto";
import { JWT } from "@colyseus/auth";
import { db, schema } from "@rpbey/db";

const { users, sessions } = schema;
const SESSION_TTL_MS = 6 * 3_600_000;

interface DiscordProfile {
  id: string;
  username?: string;
  global_name?: string | null;
}

/** Upsert user (par discordId) + minte une session Bearer. Renvoie {userId, token}. */
async function mintGachaSession(
  profile: DiscordProfile,
): Promise<{ userId: string; token: string }> {
  const name = profile.global_name || profile.username || `blader-${profile.id.slice(0, 6)}`;
  const email = `${profile.id}@discord.rpbey.fr`;
  const upserted = await db
    .insert(users)
    .values({
      id: crypto.randomUUID(),
      name,
      email,
      emailVerified: false,
      discordId: profile.id,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: users.discordId,
      set: { updatedAt: new Date() },
    })
    .returning({ id: users.id });
  const userId = upserted[0]!.id;

  const token = crypto.randomBytes(32).toString("hex");
  await db.insert(sessions).values({
    id: crypto.randomUUID(),
    userId,
    token,
    expiresAt: new Date(Date.now() + SESSION_TTL_MS),
    createdAt: new Date(),
    updatedAt: new Date(),
    userAgent: "gacha-activity",
  });
  return { userId, token };
}

type ExpressApp = { post: (path: string, ...fns: unknown[]) => void };
interface Req {
  body?: Record<string, unknown>;
}
interface Res {
  status: (c: number) => Res;
  send: (b: unknown) => void;
}

export function mountDiscordToken(app: ExpressApp): void {
  app.post("/discord_token", async (req: Req, res: Res) => {
    const code = String(req.body?.code ?? "");
    try {
      // Dev : code mock → session anonyme.
      if (code === "mock_code") {
        const profile: DiscordProfile = {
          id: `mock${Date.now()}`,
          username: "MockBlader",
        };
        const { userId, token } = await mintGachaSession(profile);
        res.send({
          access_token: "mocked",
          token: await JWT.sign({ userId }),
          gacha_token: token,
          gacha_user_id: userId,
          user: profile,
        });
        return;
      }

      const clientId = process.env.DISCORD_CLIENT_ID;
      const clientSecret = process.env.DISCORD_CLIENT_SECRET;
      if (!clientId || !clientSecret) {
        res.status(500).send({
          error: "DISCORD_CLIENT_ID / DISCORD_CLIENT_SECRET non configurés",
        });
        return;
      }

      const tokenRes = await fetch("https://discord.com/api/oauth2/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          grant_type: "authorization_code",
          code,
        }),
      });
      const { access_token } = (await tokenRes.json()) as {
        access_token?: string;
      };
      if (!access_token) {
        res.status(400).send({ error: "Échange OAuth Discord échoué" });
        return;
      }
      const profile = (await (
        await fetch("https://discord.com/api/users/@me", {
          headers: { Authorization: `Bearer ${access_token}` },
        })
      ).json()) as DiscordProfile;

      const { userId, token } = await mintGachaSession(profile);
      res.send({
        access_token,
        token: await JWT.sign({ userId }),
        gacha_token: token,
        gacha_user_id: userId,
        user: profile,
      });
    } catch (e) {
      res.status(400).send({ error: (e as Error).message });
    }
  });
}
