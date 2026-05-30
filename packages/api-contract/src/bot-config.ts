import { z } from "zod";

/**
 * Contrat de configuration du bot — pilotée 100% par la DB (table `bot_config`,
 * une ligne par `guildId`, mono-guilde). Source de vérité UNIQUE partagée par :
 *   - le bot (ConfigService — seed au boot + lecture runtime),
 *   - le dashboard web (éditeurs canaux/rôles/éco/modé/welcome/panels/toggles).
 *
 * Chaque section porte un `.default(...)` raisonnable pour que `BotConfigSchema.parse({})`
 * produise une config valide d'amorçage. Les valeurs numériques (économie, cooldowns,
 * leveling) sont des défauts réels ; les maps canaux/rôles partent vides.
 *
 * Conventions DB : aucune table auth → timestamps en string ISO (`mode:"string"`).
 */

const DiscordId = z.string();

// ── Canaux (Record<clé, snowflake|null>). Clés fonctionnelles connues du bot. ──
export const ChannelsConfigSchema = z
  .object({
    welcome: DiscordId.nullable().default(null),
    rules: DiscordId.nullable().default(null),
    roles: DiscordId.nullable().default(null),
    announcements: DiscordId.nullable().default(null),
    tournaments: DiscordId.nullable().default(null),
    social: DiscordId.nullable().default(null),
    generalChat: DiscordId.nullable().default(null),
    suggestions: DiscordId.nullable().default(null),
    media: DiscordId.nullable().default(null),
    bot: DiscordId.nullable().default(null),
    log: DiscordId.nullable().default(null),
    muted: DiscordId.nullable().default(null),
    classement: DiscordId.nullable().default(null),
    tournamentReminder: DiscordId.nullable().default(null),
  })
  // Autorise des clés de canaux additionnelles non encore typées.
  .catchall(DiscordId.nullable());
export type ChannelsConfig = z.infer<typeof ChannelsConfigSchema>;

// ── Rôles (Record<clé, snowflake|null>). Clés métier du serveur RPB. ──
export const RolesConfigSchema = z
  .object({
    admin: DiscordId.nullable().default(null),
    rh: DiscordId.nullable().default(null),
    modo: DiscordId.nullable().default(null),
    staff: DiscordId.nullable().default(null),
    partenaires: DiscordId.nullable().default(null),
    participant: DiscordId.nullable().default(null),
    spectateur: DiscordId.nullable().default(null),
    reseaux: DiscordId.nullable().default(null),
    events: DiscordId.nullable().default(null),
    leaks: DiscordId.nullable().default(null),
    restock: DiscordId.nullable().default(null),
    mudae: DiscordId.nullable().default(null),
    blader: DiscordId.nullable().default(null),
    tournoiNotification: DiscordId.nullable().default(null),
    mute: DiscordId.nullable().default(null),
  })
  .catchall(DiscordId.nullable());
export type RolesConfig = z.infer<typeof RolesConfigSchema>;

// ── Modération. ──
export const ModerationAutoActionSchema = z.enum(["none", "mute", "kick", "ban"]);
export type ModerationAutoAction = z.infer<typeof ModerationAutoActionSchema>;

export const ModerationConfigSchema = z
  .object({
    /** Durées de mute proposées (ms), du plus court au plus long. */
    muteDurationsMs: z.array(z.number().int().positive()).default([
      5 * 60_000, // 5 min
      60 * 60_000, // 1 h
      6 * 60 * 60_000, // 6 h
      24 * 60 * 60_000, // 1 j
      7 * 24 * 60 * 60_000, // 7 j
    ]),
    /** Nombre de warnings avant déclenchement de l'action automatique. */
    maxWarnings: z.number().int().positive().default(3),
    /** Seuil de warns à partir duquel l'action auto s'applique. */
    autoActionAtWarns: z.number().int().positive().default(3),
    /** Action automatique appliquée au seuil. */
    autoActionType: ModerationAutoActionSchema.default("mute"),
    /** Raison par défaut d'un ban manuel sans motif fourni. */
    defaultBanReason: z.string().default("Comportement contraire au règlement"),
  })
  .catchall(z.unknown());
export type ModerationConfig = z.infer<typeof ModerationConfigSchema>;

// ── Économie (zéni / gacha / dette). ──
export const RarityConfigSchema = z.record(
  z.string(),
  z.object({
    weight: z.number().nonnegative(),
    label: z.string().optional(),
    color: z.string().optional(),
  }),
);
export type RarityConfig = z.infer<typeof RarityConfigSchema>;

export const EconomyConfigSchema = z
  .object({
    /** Coût d'un pull gacha simple. */
    gachaCost: z.number().int().nonnegative().default(100),
    /** Coût d'un multi-pull (x10). */
    multiPullCost: z.number().int().nonnegative().default(900),
    /** Cooldown entre deux dons (ms). */
    giftCooldownMs: z
      .number()
      .int()
      .nonnegative()
      .default(24 * 60 * 60_000),
    /** Bonus de streak journalier indexé par jour consécutif (0-based). */
    streakBonuses: z.array(z.number().int().nonnegative()).default([10, 20, 30, 40, 50, 75, 100]),
    /** Badges débloquables (clé → libellé/desc). */
    badges: z.record(z.string(), z.unknown()).default({}),
    /** Pondération de rareté du gacha. */
    rarityConfig: RarityConfigSchema.default({}),
    /** Intérêt sur la dette en pourcentage. */
    debtInterestPct: z.number().nonnegative().default(5),
  })
  .catchall(z.unknown());
export type EconomyConfig = z.infer<typeof EconomyConfigSchema>;

// ── Cooldowns (ms) — principalement le système de duels. ──
export const CooldownsConfigSchema = z
  .object({
    /** Délai d'expiration d'un défi de duel non accepté (ms). */
    duelChallengeTimeoutMs: z.number().int().nonnegative().default(60_000),
    /** Délai de sélection du deck/bey en duel (ms). */
    duelSelectionTimeoutMs: z.number().int().nonnegative().default(120_000),
    /** Délai entre deux rounds d'un duel (ms). */
    duelRoundDelayMs: z.number().int().nonnegative().default(3_000),
    /** Cooldown entre deux duels pour un même joueur (ms). */
    duelCooldownMs: z.number().int().nonnegative().default(30_000),
  })
  .catchall(z.number().int().nonnegative());
export type CooldownsConfig = z.infer<typeof CooldownsConfigSchema>;

// ── Leveling (XP messages + vocal). ──
export const LevelRoleSchema = z.object({
  level: z.number().int().nonnegative(),
  roleId: DiscordId,
});
export type LevelRole = z.infer<typeof LevelRoleSchema>;

export const XpMultiplierSchema = z.object({
  target: DiscordId,
  factor: z.number().nonnegative(),
});
export type XpMultiplier = z.infer<typeof XpMultiplierSchema>;

export const LevelingConfigSchema = z
  .object({
    enabled: z.boolean().default(true),
    /** XP gagné par message éligible. */
    xpPerMessage: z.number().int().nonnegative().default(15),
    /** Cooldown anti-spam entre deux gains d'XP message (ms). */
    xpCooldownMs: z.number().int().nonnegative().default(60_000),
    /** XP gagné par minute en vocal. */
    voiceXpPerMin: z.number().int().nonnegative().default(5),
    /** Rôles attribués à un niveau atteint. */
    levelRoles: z.array(LevelRoleSchema).default([]),
    /** Canaux exclus du gain d'XP. */
    noXpChannels: z.array(DiscordId).default([]),
    /** Multiplicateurs d'XP par rôle/canal. */
    multipliers: z.array(XpMultiplierSchema).default([]),
  })
  .catchall(z.unknown());
export type LevelingConfig = z.infer<typeof LevelingConfigSchema>;

// ── Accueil / départ. ──
export const WelcomeConfigSchema = z
  .object({
    enabled: z.boolean().default(false),
    channelId: DiscordId.nullable().default(null),
    message: z.string().default("Bienvenue {user} sur le serveur !"),
    /** Envoie aussi le message en DM. */
    dm: z.boolean().default(false),
    /** Rôles attribués automatiquement à l'arrivée. */
    autoroleIds: z.array(DiscordId).default([]),
  })
  .catchall(z.unknown());
export type WelcomeConfig = z.infer<typeof WelcomeConfigSchema>;

export const GoodbyeConfigSchema = z
  .object({
    enabled: z.boolean().default(false),
    channelId: DiscordId.nullable().default(null),
    message: z.string().default("{user} a quitté le serveur."),
  })
  .catchall(z.unknown());
export type GoodbyeConfig = z.infer<typeof GoodbyeConfigSchema>;

// ── Panels de reaction-roles. ──
export const PanelOptionSchema = z.object({
  roleId: DiscordId,
  label: z.string(),
  emoji: z.string().optional(),
  description: z.string().optional(),
});
export type PanelOption = z.infer<typeof PanelOptionSchema>;

export const PanelSchema = z.object({
  id: z.string(),
  channelId: DiscordId.nullable().default(null),
  messageId: DiscordId.nullable().default(null),
  title: z.string().default(""),
  description: z.string().default(""),
  /** "buttons" | "select" — mode de rendu du panneau. */
  mode: z.enum(["buttons", "select"]).default("buttons"),
  /** Une seule option sélectionnable à la fois. */
  exclusive: z.boolean().default(false),
  options: z.array(PanelOptionSchema).default([]),
});
export type Panel = z.infer<typeof PanelSchema>;

export const PanelsConfigSchema = z.array(PanelSchema).default([]);
export type PanelsConfig = z.infer<typeof PanelsConfigSchema>;

// ── Logging (canaux de log par catégorie d'événement). ──
export const LoggingConfigSchema = z
  .object({
    messages: DiscordId.nullable().default(null),
    members: DiscordId.nullable().default(null),
    moderation: DiscordId.nullable().default(null),
    voice: DiscordId.nullable().default(null),
    server: DiscordId.nullable().default(null),
  })
  .catchall(DiscordId.nullable());
export type LoggingConfig = z.infer<typeof LoggingConfigSchema>;

// ── Features (toggles + permissions par commande/feature). ──
export const FeatureToggleSchema = z.object({
  enabled: z.boolean().default(true),
  /** Rôles autorisés (vide = pas de restriction de rôle). */
  allowedRoles: z.array(DiscordId).optional(),
  /** Canaux autorisés (vide = pas de restriction de canal). */
  allowedChannels: z.array(DiscordId).optional(),
});
export type FeatureToggle = z.infer<typeof FeatureToggleSchema>;

export const FeaturesConfigSchema = z.record(z.string(), FeatureToggleSchema).default({});
export type FeaturesConfig = z.infer<typeof FeaturesConfigSchema>;

// ── Agrégat : config complète d'une guilde. ──
export const BotConfigSchema = z.object({
  guildId: z.string(),
  // `prefault({})` : section absente/vide → parse `{}` à travers les défauts par champ.
  channels: ChannelsConfigSchema.prefault({}),
  roles: RolesConfigSchema.prefault({}),
  ownerIds: z.array(DiscordId).default([]),
  moderation: ModerationConfigSchema.prefault({}),
  economy: EconomyConfigSchema.prefault({}),
  cooldowns: CooldownsConfigSchema.prefault({}),
  leveling: LevelingConfigSchema.prefault({}),
  welcome: WelcomeConfigSchema.prefault({}),
  goodbye: GoodbyeConfigSchema.prefault({}),
  panels: PanelsConfigSchema,
  logging: LoggingConfigSchema.prefault({}),
  features: FeaturesConfigSchema,
  updatedAt: z.string().optional(),
});
export type BotConfig = z.infer<typeof BotConfigSchema>;

/** Patch partiel pour le dashboard — toutes les sections deviennent optionnelles. */
export const BotConfigPatchSchema = BotConfigSchema.partial();
export type BotConfigPatch = z.infer<typeof BotConfigPatchSchema>;
