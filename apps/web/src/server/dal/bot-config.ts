import "server-only";
import {
  BotConfigSchema,
  ChannelsConfigSchema,
  RolesConfigSchema,
  ModerationConfigSchema,
  EconomyConfigSchema,
  CooldownsConfigSchema,
  LevelingConfigSchema,
  WelcomeConfigSchema,
  GoodbyeConfigSchema,
  PanelsConfigSchema,
  LoggingConfigSchema,
  FeaturesConfigSchema,
} from "@rpbey/api-contract";
import { db, schema, eq } from "@/lib/db";

/**
 * Data Access Layer — configuration du bot (table `bot_config`).
 * Table NON-auth → timestamps en string ISO (`mode:"string"`).
 *
 * SEUL endroit autorisé à importer `@rpbey/db` pour ce domaine.
 */

const SECTION_SCHEMAS = {
  channels: ChannelsConfigSchema,
  roles: RolesConfigSchema,
  moderation: ModerationConfigSchema,
  economy: EconomyConfigSchema,
  cooldowns: CooldownsConfigSchema,
  leveling: LevelingConfigSchema,
  welcome: WelcomeConfigSchema,
  goodbye: GoodbyeConfigSchema,
  panels: PanelsConfigSchema,
  logging: LoggingConfigSchema,
  features: FeaturesConfigSchema,
} as const;

export type BotConfigSection = keyof typeof SECTION_SCHEMAS;

/** Source unique des sections valides (consommée par la route guild-config). */
export const BOT_CONFIG_SECTIONS = Object.keys(SECTION_SCHEMAS) as BotConfigSection[];

/** Retourne la config du bot, ou les valeurs par défaut du contrat si absent. */
export async function getBotConfig(guildId: string) {
  const row = await db.query.botConfig.findFirst({
    where: eq(schema.botConfig.guildId, guildId),
  });
  if (row) {
    return BotConfigSchema.parse({
      guildId: row.guildId,
      channels: row.channels,
      roles: row.roles,
      ownerIds: row.ownerIds,
      moderation: row.moderation,
      economy: row.economy,
      cooldowns: row.cooldowns,
      leveling: row.leveling,
      welcome: row.welcome,
      goodbye: row.goodbye,
      panels: row.panels,
      logging: row.logging,
      features: row.features,
      updatedAt: row.updatedAt,
    });
  }
  return BotConfigSchema.parse({ guildId });
}

/** Upsert d'une section (valide via le schéma Zod avant écriture). */
export async function updateBotConfigSection(
  guildId: string,
  section: BotConfigSection,
  data: unknown,
) {
  const validated = SECTION_SCHEMAS[section].parse(data);
  const now = new Date().toISOString();

  const [row] = await db
    .insert(schema.botConfig)
    .values({
      guildId,
      [section]: validated,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: schema.botConfig.guildId,
      set: {
        [section]: validated,
        updatedAt: now,
      },
    })
    .returning();

  return row;
}

/** Lecture légère des canaux Discord disponibles (pour les selects). */
export async function listDiscordChannels() {
  return db.query.discordChannels.findMany({
    columns: { id: true, name: true, type: true, parentId: true, position: true },
  });
}

/** Lecture légère des rôles Discord disponibles (pour les selects). */
export async function listDiscordRoles() {
  return db.query.discordRoles.findMany({
    columns: { id: true, name: true, color: true, position: true },
  });
}
