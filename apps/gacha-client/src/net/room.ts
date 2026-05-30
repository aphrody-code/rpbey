/**
 * Connexion temps réel Colyseus. Join la room `gacha` (filtrée par `channelId`)
 * avec le JWT minté par `/discord_token`, écoute l'état (`players`) pour mettre
 * à jour le HUD (solde, pity) et relaie les messages `pull:result` / `daily:result`.
 *
 * Le serveur synchronise `GachaState = MapSchema<PlayerState{userId,name,currency,
 * pity,lastPull}>`. On suit le PlayerState dont `userId` == le nôtre.
 */
import { Client, type Room } from "colyseus.js";
import { GACHA_WS_URL } from "../env";
import type { DailyResult, PullResult } from "../types";

export interface RoomHud {
  currency: number;
  pity: number;
  name: string;
}

export interface RoomCallbacks {
  onHud?: (hud: RoomHud) => void;
  onPull?: (r: PullResult) => void;
  onDaily?: (r: DailyResult) => void;
  onError?: (message: string) => void;
}

interface PlayerSchema {
  userId: string;
  name: string;
  currency: number;
  pity: number;
  lastPull: string;
}

interface GachaStateSchema {
  players: {
    forEach: (cb: (p: PlayerSchema, key: string) => void) => void;
    onAdd?: (cb: (p: PlayerSchema, key: string) => void) => void;
    onChange?: (cb: (p: PlayerSchema, key: string) => void) => void;
  };
}

export class GachaRoomClient {
  private room: Room<GachaStateSchema> | null = null;
  private userId = "";

  constructor(private readonly cb: RoomCallbacks) {}

  /**
   * Join la room. `jwt` = le token Colyseus (`token` de /discord_token).
   * `channelId` filtre la room (option de matchmaking, comme côté serveur).
   */
  async join(jwt: string, userId: string, channelId?: string): Promise<void> {
    this.userId = userId;
    const client = new Client(GACHA_WS_URL);
    try {
      this.room = await client.joinOrCreate<GachaStateSchema>("gacha", {
        token: jwt,
        ...(channelId ? { channelId } : {}),
      });
    } catch (err) {
      this.cb.onError?.(`Connexion temps réel impossible: ${(err as Error).message}`);
      return;
    }

    this.room.onMessage("pull:result", (r: PullResult) => this.cb.onPull?.(r));
    this.room.onMessage("daily:result", (r: DailyResult) => this.cb.onDaily?.(r));
    this.room.onMessage("error", (e: { message: string }) => this.cb.onError?.(e.message));

    const state = this.room.state;
    const emit = (p: PlayerSchema) => {
      if (p.userId !== this.userId) return;
      this.cb.onHud?.({ currency: p.currency, pity: p.pity, name: p.name });
    };
    state.players.onAdd?.(emit);
    state.players.onChange?.(emit);
    // État initial déjà reçu : balaye une fois.
    state.players.forEach(emit);
  }

  /** Demande un pull via la room (le serveur répond `pull:result`). */
  pull(): void {
    this.room?.send("pull");
  }

  daily(): void {
    this.room?.send("daily");
  }

  refreshBalance(): void {
    this.room?.send("balance");
  }

  get connected(): boolean {
    return this.room !== null;
  }

  leave(): void {
    void this.room?.leave();
    this.room = null;
  }
}
