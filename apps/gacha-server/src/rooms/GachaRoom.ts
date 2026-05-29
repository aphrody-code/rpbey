/**
 * Room temps réel pour la Discord Activity. État synchronisé (Schema) :
 * joueurs présents + leur solde/pity. Les actions (pull, daily) réutilisent
 * les handlers économie partagés avec la couche REST.
 */
import { JWT } from "@colyseus/auth";
import { type Client, Room } from "colyseus";
import { MapSchema, Schema, type } from "@colyseus/schema";
import type { AuthUser } from "../auth";
import * as h from "../handlers";

export class PlayerState extends Schema {
  @type("string") userId = "";
  @type("string") name = "";
  @type("number") currency = 0;
  @type("number") pity = 0;
  @type("string") lastPull = "";
}

export class GachaState extends Schema {
  @type({ map: PlayerState }) players = new MapSchema<PlayerState>();
}

interface JwtPayload {
  userId: string;
  name?: string;
}

/** AuthUser minimal pour les handlers (la Room ne fait pas d'action admin). */
function asAuth(p: JwtPayload): AuthUser {
  return {
    id: p.userId,
    name: p.name ?? null,
    image: null,
    role: "user",
    isAdmin: false,
  };
}

export class GachaRoom extends Room {
  override maxClients = 16;
  override state = new GachaState();

  static override async onAuth(token: string): Promise<JwtPayload> {
    return (await JWT.verify(token)) as JwtPayload;
  }

  override onCreate(): void {
    this.onMessage("pull", async (client) => {
      const user = asAuth(client.auth as JwtPayload);
      try {
        const r = await h.pull(user);
        const p = this.state.players.get(client.sessionId);
        if (p) {
          p.currency = r.result.newBalance;
          p.pity = r.result.pityCount;
          p.lastPull = r.result.rarity ?? "MISS";
        }
        client.send("pull:result", r.result);
      } catch (e) {
        client.send("error", { message: (e as Error).message });
      }
    });

    this.onMessage("daily", async (client) => {
      const user = asAuth(client.auth as JwtPayload);
      try {
        const r = await h.daily(user);
        const p = this.state.players.get(client.sessionId);
        if (p) p.currency = r.result.newBalance;
        client.send("daily:result", r.result);
      } catch (e) {
        client.send("error", { message: (e as Error).message });
      }
    });

    this.onMessage("balance", async (client) => {
      const user = asAuth(client.auth as JwtPayload);
      const b = await h.balance(user);
      const p = this.state.players.get(client.sessionId);
      if (p) {
        p.currency = b.currency;
        p.pity = b.pityCount;
      }
      client.send("balance:result", b);
    });
  }

  override async onJoin(client: Client): Promise<void> {
    const payload = client.auth as JwtPayload;
    const p = new PlayerState();
    p.userId = payload.userId;
    p.name = payload.name ?? "Blader";
    try {
      const b = await h.balance(asAuth(payload));
      p.currency = b.currency;
      p.pity = b.pityCount;
    } catch {
      // profil créé à la volée au 1er appel ; ignore si lecture échoue.
    }
    this.state.players.set(client.sessionId, p);
  }

  override onLeave(client: Client): void {
    this.state.players.delete(client.sessionId);
  }
}
