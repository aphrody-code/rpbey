/**
 * config-service.ts — Configuration dynamique du bot depuis la table `bot_config`.
 *
 * Stratégie :
 *   1. Cache mémoire par guildId (TTL 5 min). Pas de Redis : la config est rarement
 *      changée, un TTL court suffit ; la clé Redis reste pour l'invalidation urgente.
 *   2. Lecture via `prisma.botConfig` (façade Drizzle) → jamais Drizzle inline.
 *   3. Merge DB + constantes (DB gagne champ par champ ; champ absent → fallback).
 *   4. Hot-reload Redis : canal `rpb:events:config`, payload `{ type:"invalidate", guildId }`.
 *      Gracieux : panne Redis → le TTL 5 min est le filet de sécurité.
 *   5. ensureSeed : si la row n'existe pas, insère les vraies valeurs des constantes
 *      pour garantir zéro changement de comportement.
 *
 * INVARIANTS :
 *   - `import { PrismaService }` (jamais `import type`) — sinon DI tsyringe = undefined.
 *   - Aucun throw vers l'appelant : toute erreur → log + fallback constants.
 *   - Aucun `Bun.$` ni code SWC-incompatible.
 */

import {
  type BotConfig,
  type ChannelsConfig,
  type CooldownsConfig,
  type EconomyConfig,
  type FeatureToggle,
  type GoodbyeConfig,
  type LevelingConfig,
  type LoggingConfig,
  type ModerationConfig,
  type PanelsConfig,
  type RolesConfig,
  type WelcomeConfig,
  BotConfigSchema,
  ChannelsConfigSchema,
  CooldownsConfigSchema,
  EconomyConfigSchema,
  GoodbyeConfigSchema,
  LevelingConfigSchema,
  LoggingConfigSchema,
  ModerationConfigSchema,
  PanelsConfigSchema,
  RolesConfigSchema,
  WelcomeConfigSchema,
} from "@rpbey/api-contract";
import { singleton } from "tsyringe";

import { RPB } from "./constants.js";
import { logger } from "./logger.js";
import { PrismaService } from "./prisma.js";
import { ROLE_PANELS } from "./role-panels.js";

// ─── Types ────────────────────────────────────────────────────────────────────

interface CacheEntry {
  config: BotConfig;
  fetchedAt: number;
}

const CACHE_TTL_MS = 5 * 60_000; // 5 min

// ─── Valeurs par défaut issues des constantes courantes ──────────────────────

/** Constantes canaux utilisées comme fallback si la DB ne les a pas. */
const DEFAULT_CHANNELS: Partial<ChannelsConfig> = {
  welcome: RPB.Channels.Welcome,
  rules: RPB.Channels.Rules,
  roles: RPB.Channels.Roles,
  announcements: RPB.Channels.Announcements,
  tournaments: RPB.Channels.Tournaments,
  social: RPB.Channels.Social,
  generalChat: RPB.Channels.GeneralChat,
  suggestions: RPB.Channels.Suggestions,
  media: RPB.Channels.Media,
  bot: process.env.BOT_CHANNEL_ID ?? null,
  log: process.env.LOG_CHANNEL_ID ?? null,
  muted: process.env.MUTED_CHANNEL_ID ?? "1456761597245784260",
  classement: process.env.CLASSEMENT_CHANNEL_ID ?? "1489804785430302851",
};

/** Constantes rôles utilisées comme fallback. */
const DEFAULT_ROLES: Partial<RolesConfig> = {
  admin: RPB.Roles.Admin,
  rh: RPB.Roles.Rh,
  modo: RPB.Roles.Modo,
  staff: RPB.Roles.Staff,
  partenaires: RPB.Roles.Partenaires,
  participant: RPB.Roles.Participant,
  spectateur: RPB.Roles.Spectateur,
  reseaux: RPB.Roles.Reseaux,
  events: RPB.Roles.Events,
  leaks: RPB.Roles.Leaks,
  restock: RPB.Roles.Restock,
  mudae: RPB.Roles.Mudae,
  blader: RPB.Roles.Blader,
  tournoiNotification: RPB.Roles.TournoiNotification,
};

/** Constantes économie issues de EconomyGroup.ts. */
const DEFAULT_ECONOMY: Partial<EconomyConfig> = {
  gachaCost: 50,
  multiPullCost: 450,
  giftCooldownMs: 12 * 3_600_000,
  streakBonuses: [50, 150, 300, 750],
  debtInterestPct: 15,
  badges: {
    Débutant: { count: 5, reward: 200, emoji: "🥉" },
    Collectionneur: { count: 10, reward: 500, emoji: "🥈" },
    Expert: { count: 15, reward: 750, emoji: "🥇" },
    Maître: { count: 20, reward: 1000, emoji: "🏆" },
    Champion: { count: 25, reward: 1500, emoji: "👑" },
    Légende: { count: 31, reward: 3000, emoji: "⭐" },
  },
  rarityConfig: {
    COMMON: { weight: 35, label: "Commune", color: "#9ca3af" },
    RARE: { weight: 22, label: "Rare", color: "#3b82f6" },
    SUPER_RARE: { weight: 10, label: "Super Rare", color: "#8b5cf6" },
    LEGENDARY: { weight: 3, label: "Légendaire", color: "#fbbf24" },
    SECRET: { weight: 1, label: "Secrète", color: "#ef4444" },
  },
};

/** Constantes cooldowns duel issues de DuelCommand.ts. */
const DEFAULT_COOLDOWNS: Partial<CooldownsConfig> = {
  duelChallengeTimeoutMs: 60_000,
  duelSelectionTimeoutMs: 90_000,
  duelRoundDelayMs: 3_500,
  duelCooldownMs: 3 * 60_000,
};

/** Constantes modération (valeurs actuelles — @SlashChoice statiques inchangées). */
const DEFAULT_MODERATION: Partial<ModerationConfig> = {
  muteDurationsMs: [60_000, 5 * 60_000, 10 * 60_000, 60 * 60_000, 24 * 60 * 60_000],
  maxWarnings: 0,
  autoActionAtWarns: 0,
  autoActionType: "none",
  defaultBanReason: "Comportement contraire au règlement",
};

/**
 * Accueil — reflète le comportement actuel de `events/guild/memberJoin.ts` :
 * accueil ACTIF, autorole = Blader. `enabled:true` par défaut (bot) pour zéro
 * changement de comportement ; le dashboard peut désactiver. Le texte effectif
 * reste rendu via le contentBlock `bot-welcome-text` (CMS) — `message` est la
 * valeur de repli affichée/éditable.
 */
const DEFAULT_WELCOME: Partial<WelcomeConfig> = {
  enabled: true,
  channelId: RPB.Channels.Welcome,
  message: "Bienvenue {user} sur la République Populaire du Beyblade !",
  dm: false,
  autoroleIds: [RPB.Roles.Blader],
};

/** Départ — aucun message de départ aujourd'hui → désactivé par défaut. */
const DEFAULT_GOODBYE: Partial<GoodbyeConfig> = {
  enabled: false,
  channelId: null,
  message: "{user} a quitté le serveur.",
};

/** Leveling — système non encore branché côté runtime → désactivé par défaut. */
const DEFAULT_LEVELING: Partial<LevelingConfig> = {
  enabled: false,
};

// ─── ConfigService ─────────────────────────────────────────────────────────

@singleton()
export class ConfigService {
  private readonly cache = new Map<string, CacheEntry>();
  private redisSubscribed = false;

  constructor(private readonly prisma: PrismaService) {
    // Abonnement Redis au canal d'invalidation (best-effort, non-bloquant).
    this.subscribeRedis();
  }

  // ────────────────────────────── Public API ──────────────────────────────────

  /**
   * Retourne la config complète pour la guilde donnée.
   * Priorité : cache → DB → fallback constants.
   * Jamais de throw.
   */
  async getConfig(guildId: string): Promise<BotConfig> {
    const cached = this.cache.get(guildId);
    if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
      return cached.config;
    }
    return this.fetchAndCache(guildId);
  }

  /** Invalide le cache d'une guilde (appelé par le hot-reload Redis). */
  invalidate(guildId: string): void {
    this.cache.delete(guildId);
    logger.debug(`[ConfigService] Cache invalidé pour guild ${guildId}`);
  }

  // ─── Getters typés avec fallback ──────────────────────────────────────────

  async getChannel(guildId: string, key: keyof ChannelsConfig): Promise<string | null> {
    const cfg = await this.getConfig(guildId);
    return (cfg.channels[key] as string | null | undefined) ?? null;
  }

  async getRole(guildId: string, key: keyof RolesConfig): Promise<string | null> {
    const cfg = await this.getConfig(guildId);
    return (cfg.roles[key] as string | null | undefined) ?? null;
  }

  async getOwnerIds(guildId: string): Promise<string[]> {
    const cfg = await this.getConfig(guildId);
    const fromEnv = process.env.OWNER_IDS?.split(",").filter(Boolean) ?? [];
    const fromCfg = cfg.ownerIds ?? [];
    // Union : DB + env (env = fallback si DB vide)
    if (fromCfg.length > 0) return fromCfg;
    return fromEnv;
  }

  async getEconomy(guildId: string): Promise<EconomyConfig> {
    const cfg = await this.getConfig(guildId);
    return cfg.economy;
  }

  async getCooldowns(guildId: string): Promise<CooldownsConfig> {
    const cfg = await this.getConfig(guildId);
    return cfg.cooldowns;
  }

  async getModeration(guildId: string): Promise<ModerationConfig> {
    const cfg = await this.getConfig(guildId);
    return cfg.moderation;
  }

  async getPanels(guildId: string): Promise<PanelsConfig> {
    const cfg = await this.getConfig(guildId);
    return cfg.panels;
  }

  async getLogging(guildId: string, category?: keyof LoggingConfig): Promise<string | null>;
  async getLogging(guildId: string): Promise<LoggingConfig>;
  async getLogging(
    guildId: string,
    category?: keyof LoggingConfig,
  ): Promise<LoggingConfig | string | null> {
    const cfg = await this.getConfig(guildId);
    if (category !== undefined) {
      return (cfg.logging[category] as string | null | undefined) ?? null;
    }
    return cfg.logging;
  }

  /**
   * Vérifie si une feature est activée pour la guilde.
   * Défaut : `enabled = true` si la feature n'est pas configurée (non-cassant).
   * Si `roleIds` ou `channelId` sont fournis, vérifie les restrictions optionnelles.
   */
  async isFeatureEnabled(
    guildId: string,
    name: string,
    opts: { roleIds?: string[]; channelId?: string } = {},
  ): Promise<boolean> {
    const cfg = await this.getConfig(guildId);
    const toggle: FeatureToggle | undefined = cfg.features[name];
    if (!toggle) return true; // Non configuré → enabled par défaut

    if (!toggle.enabled) return false;

    if (toggle.allowedRoles && toggle.allowedRoles.length > 0 && opts.roleIds) {
      if (!opts.roleIds.some((r) => toggle.allowedRoles!.includes(r))) return false;
    }

    if (toggle.allowedChannels && toggle.allowedChannels.length > 0 && opts.channelId) {
      if (!toggle.allowedChannels.includes(opts.channelId)) return false;
    }

    return true;
  }

  // ─── Seed ─────────────────────────────────────────────────────────────────

  /**
   * Si aucune row n'existe pour la guilde, insère les valeurs des constantes
   * actuelles. Idempotent. Ne throw pas.
   */
  async ensureSeed(guildId: string): Promise<void> {
    try {
      const existing = await this.prisma.botConfig.findUnique({ where: { guildId } });
      if (existing) return;

      const ownerIds = process.env.OWNER_IDS?.split(",").filter(Boolean) ?? [];

      // Panels : convertit ROLE_PANELS (format buttons) en PanelsConfig générique
      const panels = PanelsConfigSchema.parse(
        ROLE_PANELS.map((p, i) => ({
          id: `panel-${i}`,
          title: p.title,
          description: p.description,
          mode: "buttons" as const,
          exclusive: false,
          options: p.buttons.map((b) => ({
            roleId: RPB.Roles[b.roleKey],
            label: b.label,
            emoji: b.emoji,
            description: b.description,
          })),
        })),
      );

      const seed = {
        guildId,
        channels: ChannelsConfigSchema.parse(DEFAULT_CHANNELS),
        roles: RolesConfigSchema.parse(DEFAULT_ROLES),
        ownerIds,
        moderation: ModerationConfigSchema.parse(DEFAULT_MODERATION),
        economy: EconomyConfigSchema.parse(DEFAULT_ECONOMY),
        cooldowns: CooldownsConfigSchema.parse(DEFAULT_COOLDOWNS),
        leveling: LevelingConfigSchema.parse(DEFAULT_LEVELING),
        welcome: WelcomeConfigSchema.parse(DEFAULT_WELCOME),
        goodbye: GoodbyeConfigSchema.parse(DEFAULT_GOODBYE),
        panels,
        logging: LoggingConfigSchema.parse({
          messages: process.env.LOG_CHANNEL_ID ?? null,
          members: process.env.LOG_CHANNEL_ID ?? null,
          moderation: process.env.LOG_CHANNEL_ID ?? null,
          voice: process.env.LOG_CHANNEL_ID ?? null,
          server: process.env.LOG_CHANNEL_ID ?? null,
        }),
        features: {},
        updatedAt: new Date().toISOString(),
      };

      await this.prisma.botConfig.upsert({
        where: { guildId },
        create: seed,
        update: {}, // Ne pas écraser si elle a été créée entretemps
      });

      logger.info(`[ConfigService] Seed inséré pour guild ${guildId}`);
    } catch (err) {
      logger.warn("[ConfigService] ensureSeed échoué (non-bloquant):", err);
    }
  }

  // ─── Internals ────────────────────────────────────────────────────────────

  private async fetchAndCache(guildId: string): Promise<BotConfig> {
    try {
      let row = await this.prisma.botConfig.findUnique({ where: { guildId } });
      if (!row) {
        await this.ensureSeed(guildId);
        row = await this.prisma.botConfig.findUnique({ where: { guildId } });
      }
      const config = this.mergeWithDefaults(guildId, row);
      this.cache.set(guildId, { config, fetchedAt: Date.now() });
      return config;
    } catch (err) {
      logger.warn("[ConfigService] Erreur DB, fallback constants:", err);
      return this.buildFallback(guildId);
    }
  }

  /**
   * Fusionne la row DB avec les valeurs par défaut.
   * La DB gagne champ par champ (un champ null/absent → fallback constants).
   */
  private mergeWithDefaults(guildId: string, row: Record<string, unknown> | null): BotConfig {
    const dbChannels = (row?.channels as Record<string, string | null>) ?? {};
    const dbRoles = (row?.roles as Record<string, string | null>) ?? {};

    // Merge channels : DEFAULT_CHANNELS fournit les fallbacks pour les clés manquantes
    // Cast explicite : DEFAULT_CHANNELS est Partial<> (undefined possible), on strip ici.
    const mergedChannels: Record<string, string | null> = Object.fromEntries(
      Object.entries(DEFAULT_CHANNELS).map(([k, v]) => [k, v ?? null]),
    );
    for (const [k, v] of Object.entries(dbChannels)) {
      if (v !== null && v !== undefined && v !== "") mergedChannels[k] = v;
    }

    // Merge roles
    const mergedRoles: Record<string, string | null> = Object.fromEntries(
      Object.entries(DEFAULT_ROLES).map(([k, v]) => [k, v ?? null]),
    );
    for (const [k, v] of Object.entries(dbRoles)) {
      if (v !== null && v !== undefined && v !== "") mergedRoles[k] = v;
    }

    // Pour les sections objets (economy, cooldowns, etc.), on parse avec les défauts
    // du schéma Zod pour combler les champs manquants.
    const rawEconomy = (row?.economy as Record<string, unknown>) ?? {};
    const rawCooldowns = (row?.cooldowns as Record<string, number>) ?? {};
    const rawModeration = (row?.moderation as Record<string, unknown>) ?? {};
    const rawLogging = (row?.logging as Record<string, string | null>) ?? {};
    const rawPanels = (row?.panels as unknown[]) ?? [];
    const rawFeatures = (row?.features as Record<string, unknown>) ?? {};

    // Merge economy : DEFAULT_ECONOMY comble les champs absents de la DB
    const mergedEconomy = { ...DEFAULT_ECONOMY, ...rawEconomy };
    const mergedCooldowns = { ...DEFAULT_COOLDOWNS, ...rawCooldowns };
    const mergedModeration = { ...DEFAULT_MODERATION, ...rawModeration };

    const parsed = BotConfigSchema.safeParse({
      guildId,
      channels: mergedChannels,
      roles: mergedRoles,
      ownerIds: row?.ownerIds ?? [],
      moderation: mergedModeration,
      economy: mergedEconomy,
      cooldowns: mergedCooldowns,
      leveling: { ...DEFAULT_LEVELING, ...((row?.leveling as Record<string, unknown>) ?? {}) },
      welcome: { ...DEFAULT_WELCOME, ...((row?.welcome as Record<string, unknown>) ?? {}) },
      goodbye: { ...DEFAULT_GOODBYE, ...((row?.goodbye as Record<string, unknown>) ?? {}) },
      panels: rawPanels,
      logging: mergedLogging(rawLogging),
      features: rawFeatures,
      updatedAt: typeof row?.updatedAt === "string" ? row.updatedAt : undefined,
    });

    if (parsed.success) return parsed.data;
    logger.warn("[ConfigService] Parse Zod échoué, fallback total:", parsed.error.issues);
    return this.buildFallback(guildId);
  }

  private buildFallback(guildId: string): BotConfig {
    const ownerIds = process.env.OWNER_IDS?.split(",").filter(Boolean) ?? [];
    const result = BotConfigSchema.safeParse({
      guildId,
      channels: DEFAULT_CHANNELS,
      roles: DEFAULT_ROLES,
      ownerIds,
      moderation: DEFAULT_MODERATION,
      economy: DEFAULT_ECONOMY,
      cooldowns: DEFAULT_COOLDOWNS,
      leveling: DEFAULT_LEVELING,
      welcome: DEFAULT_WELCOME,
      goodbye: DEFAULT_GOODBYE,
    });
    // BotConfigSchema.parse({}) avec prefault → ne peut pas échouer avec des valeurs valides
    if (result.success) return result.data;
    // Ultime filet (ne devrait jamais arriver)
    return BotConfigSchema.parse({ guildId });
  }

  // ─── Redis pub/sub hot-reload ──────────────────────────────────────────────

  private async subscribeRedis(): Promise<void> {
    if (this.redisSubscribed) return;
    try {
      // Import dynamique pour éviter une dépendance circulaire au boot.
      // Bun RedisClient: duplicate() est async et retourne une nouvelle connexion.
      // subscribe(channel, callback) — pas d'EventEmitter .on().
      const { redis } = await import("./redis.js");
      const sub = await redis.duplicate();
      await sub.subscribe("rpb:events:config", (message: string) => {
        try {
          const payload = JSON.parse(message) as { type?: string; guildId?: string };
          if (payload.type === "invalidate" && typeof payload.guildId === "string") {
            this.invalidate(payload.guildId);
          }
        } catch {
          // Payload malformé — ignorer
        }
      });
      this.redisSubscribed = true;
      logger.info("[ConfigService] Redis sub actif sur rpb:events:config");
    } catch (err) {
      // Redis injoignable — TTL 5 min reste le filet de sécurité
      logger.warn("[ConfigService] Redis sub indisponible (TTL 5min actif):", err);
    }
  }
}

// ─── Helper ───────────────────────────────────────────────────────────────────

function mergedLogging(raw: Record<string, string | null>): Record<string, string | null> {
  const logChannelId = process.env.LOG_CHANNEL_ID ?? null;
  const defaults: Record<string, string | null> = {
    messages: logChannelId,
    members: logChannelId,
    moderation: logChannelId,
    voice: logChannelId,
    server: logChannelId,
  };
  return { ...defaults, ...Object.fromEntries(Object.entries(raw).filter(([, v]) => v)) };
}

// ─── guildId helper (lire la guilde principale depuis l'env) ──────────────────

export function primaryGuildId(): string {
  return process.env.GUILD_ID ?? process.env.DISCORD_GUILD_ID ?? "";
}
