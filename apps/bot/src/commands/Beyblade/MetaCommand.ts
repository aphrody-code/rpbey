import { Discord, Slash, SlashGroup, SlashOption } from "@rpbey/discordx";
import {
  ApplicationCommandOptionType,
  AttachmentBuilder,
  type CommandInteraction,
  EmbedBuilder,
} from "discord.js";
import { injectable } from "tsyringe";

// Serverless: the web app runs on Vercel. Default to the public origin so the
// Cloud Run bot reaches it with zero extra config; `RPBEY_WEB_BASE` overrides
// (e.g. a preview deployment or local dev against http://127.0.0.1:3002).
const WEB_BASE = process.env.RPBEY_WEB_BASE ?? "https://rpbey.fr";

import { logger } from "../../lib/logger.js";
import {
  generateMetaCategoryCanvas,
  generateMetaComboCanvas,
  generateMetaPieceCanvas,
  generateMetaTopCanvas,
} from "../../lib/meta-canvas.js";
import { resolveDataPath } from "../../lib/paths.js";

// --- Types ---
interface MetaSynergy {
  name: string;
  score: number;
}

interface MetaComponent {
  name: string;
  score: number;
  position_change: number | "NEW";
  synergy: MetaSynergy[];
}

interface MetaCategory {
  category: string;
  components: MetaComponent[];
}

interface MetaPeriod {
  metadata: {
    dataSource: string;
    weekId: string;
    startDate: string;
    endDate: string;
    eventsScanned: number;
    partsAnalyzed: number;
  };
  categories: MetaCategory[];
}

interface MetaFileData {
  scrapedAt: string;
  periods: {
    "2weeks": MetaPeriod;
    "4weeks": MetaPeriod;
  };
}

// --- Constants ---
const CATEGORY_CHOICES = [
  { name: "⚔️ Blade", value: "Blade" },
  { name: "⚙️ Ratchet", value: "Ratchet" },
  { name: "🔩 Bit", value: "Bit" },
  { name: "🔒 Lock Chip", value: "Lock Chip" },
  { name: "🛡️ Assist Blade", value: "Assist Blade" },
];

const PERIOD_CHOICES = [
  { name: "📅 2 semaines", value: "2weeks" },
  { name: "📅 4 semaines", value: "4weeks" },
];

// --- Helpers ---
async function loadMetaData(): Promise<MetaFileData | null> {
  const file = Bun.file(resolveDataPath("bbx-weekly.json"));
  if (!(await file.exists())) return null;
  return file.json() as Promise<MetaFileData>;
}

function fallbackEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle("📊 Méta Beyblade X")
    .setColor(0xfbbf24)
    .setDescription(
      "Les données méta ne sont pas disponibles actuellement.\n\n" +
        "**Consultez la page dédiée pour les informations à jour :**\n" +
        "[rpbey.fr/meta](https://rpbey.fr/meta)",
    )
    .setFooter({ text: "Données mises à jour régulièrement sur le site." });
}

function resolvePeriod(
  data: MetaFileData,
  key: string | undefined,
): { period: MetaPeriod; pKey: string } | null {
  const pKey = key === "4weeks" ? "4weeks" : "2weeks";
  const period = data.periods[pKey];
  if (!period?.categories?.length) return null;
  return { period, pKey };
}

// --- Command ---
@Discord()
@SlashGroup({
  name: "meta",
  description: "Méta Beyblade X — rankings et combos populaires",
})
@SlashGroup("meta")
@injectable()
export class MetaCommand {
  @Slash({
    name: "top",
    description: "Classement global des pièces par catégorie",
  })
  @SlashGroup("meta")
  async top(
    @SlashOption({
      name: "periode",
      description: "Fenêtre d'analyse (défaut: 2 semaines)",
      required: false,
      type: ApplicationCommandOptionType.String,
      autocomplete: (interaction) => {
        const focused = interaction.options.getFocused().toLowerCase();
        return interaction.respond(
          PERIOD_CHOICES.filter((c) => c.name.toLowerCase().includes(focused)),
        );
      },
    })
    periodKey: string | undefined,
    interaction: CommandInteraction,
  ) {
    await interaction.deferReply();

    try {
      const data = await loadMetaData();
      if (!data) return interaction.editReply({ embeds: [fallbackEmbed()] });

      const resolved = resolvePeriod(data, periodKey);
      if (!resolved) return interaction.editReply({ embeds: [fallbackEmbed()] });

      const { period, pKey } = resolved;
      const buffer = await generateMetaTopCanvas(period, data.scrapedAt, pKey);
      const attachment = new AttachmentBuilder(buffer, {
        name: "meta-top.png",
      });

      return interaction.editReply({ files: [attachment] });
    } catch (err) {
      logger.error("Failed to generate meta top:", err);
      return interaction.editReply({ embeds: [fallbackEmbed()] });
    }
  }

  @Slash({
    name: "categorie",
    description: "Détail complet d'une catégorie de pièces",
  })
  @SlashGroup("meta")
  async categorie(
    @SlashOption({
      name: "type",
      description: "Catégorie à afficher",
      required: true,
      type: ApplicationCommandOptionType.String,
      autocomplete: (interaction) => {
        const focused = interaction.options.getFocused().toLowerCase();
        return interaction.respond(
          CATEGORY_CHOICES.filter((c) => c.name.toLowerCase().includes(focused)),
        );
      },
    })
    categoryName: string,
    @SlashOption({
      name: "periode",
      description: "Fenêtre d'analyse (défaut: 2 semaines)",
      required: false,
      type: ApplicationCommandOptionType.String,
      autocomplete: (interaction) => {
        const focused = interaction.options.getFocused().toLowerCase();
        return interaction.respond(
          PERIOD_CHOICES.filter((c) => c.name.toLowerCase().includes(focused)),
        );
      },
    })
    periodKey: string | undefined,
    interaction: CommandInteraction,
  ) {
    await interaction.deferReply();

    try {
      const data = await loadMetaData();
      if (!data) return interaction.editReply({ embeds: [fallbackEmbed()] });

      const resolved = resolvePeriod(data, periodKey);
      if (!resolved) return interaction.editReply({ embeds: [fallbackEmbed()] });

      const { period, pKey } = resolved;
      const cat = period.categories.find(
        (c) => c.category.toLowerCase() === categoryName.toLowerCase(),
      );
      if (!cat) {
        return interaction.editReply(
          `❌ Catégorie "${categoryName}" introuvable. Disponibles : ${period.categories.map((c) => c.category).join(", ")}`,
        );
      }

      const buffer = await generateMetaCategoryCanvas(cat, period, data.scrapedAt, pKey);
      const attachment = new AttachmentBuilder(buffer, {
        name: `meta-${cat.category.toLowerCase().replace(/\s/g, "-")}.png`,
      });

      return interaction.editReply({ files: [attachment] });
    } catch (err) {
      logger.error("Failed to generate meta category:", err);
      return interaction.editReply({ embeds: [fallbackEmbed()] });
    }
  }

  @Slash({
    name: "combo",
    description: "Le meilleur combo du moment basé sur les données de tournois",
  })
  @SlashGroup("meta")
  async combo(
    @SlashOption({
      name: "periode",
      description: "Fenêtre d'analyse (défaut: 2 semaines)",
      required: false,
      type: ApplicationCommandOptionType.String,
      autocomplete: (interaction) => {
        const focused = interaction.options.getFocused().toLowerCase();
        return interaction.respond(
          PERIOD_CHOICES.filter((c) => c.name.toLowerCase().includes(focused)),
        );
      },
    })
    periodKey: string | undefined,
    interaction: CommandInteraction,
  ) {
    await interaction.deferReply();

    try {
      const data = await loadMetaData();
      if (!data) return interaction.editReply({ embeds: [fallbackEmbed()] });

      const resolved = resolvePeriod(data, periodKey);
      if (!resolved) return interaction.editReply({ embeds: [fallbackEmbed()] });

      const { period, pKey } = resolved;
      const buffer = await generateMetaComboCanvas(period, data.scrapedAt, pKey);
      const attachment = new AttachmentBuilder(buffer, {
        name: "meta-combo.png",
      });

      return interaction.editReply({ files: [attachment] });
    } catch (err) {
      logger.error("Failed to generate meta combo:", err);
      return interaction.editReply({ embeds: [fallbackEmbed()] });
    }
  }

  @Slash({
    name: "piece",
    description: "Rechercher les stats et synergies d'une pièce",
  })
  @SlashGroup("meta")
  async piece(
    @SlashOption({
      name: "nom",
      description: "Nom de la pièce (ex: Shark Scale, 1-60, Hexa)",
      required: true,
      type: ApplicationCommandOptionType.String,
    })
    pieceName: string,
    @SlashOption({
      name: "periode",
      description: "Fenêtre d'analyse (défaut: 2 semaines)",
      required: false,
      type: ApplicationCommandOptionType.String,
      autocomplete: (interaction) => {
        const focused = interaction.options.getFocused().toLowerCase();
        return interaction.respond(
          PERIOD_CHOICES.filter((c) => c.name.toLowerCase().includes(focused)),
        );
      },
    })
    periodKey: string | undefined,
    interaction: CommandInteraction,
  ) {
    await interaction.deferReply();

    try {
      const data = await loadMetaData();
      if (!data) return interaction.editReply({ embeds: [fallbackEmbed()] });

      const resolved = resolvePeriod(data, periodKey);
      if (!resolved) return interaction.editReply({ embeds: [fallbackEmbed()] });

      const { period, pKey } = resolved;
      const query = pieceName.toLowerCase();

      // Search across all categories
      let foundComp: MetaComponent | null = null;
      let foundCategory = "";
      for (const cat of period.categories) {
        const match = cat.components.find((c) => c.name.toLowerCase() === query);
        if (match) {
          foundComp = match;
          foundCategory = cat.category;
          break;
        }
      }

      // Fuzzy fallback
      if (!foundComp) {
        for (const cat of period.categories) {
          const match = cat.components.find((c) => c.name.toLowerCase().includes(query));
          if (match) {
            foundComp = match;
            foundCategory = cat.category;
            break;
          }
        }
      }

      if (!foundComp) {
        return interaction.editReply(`❌ Pièce "${pieceName}" introuvable dans les données méta.`);
      }

      const buffer = await generateMetaPieceCanvas(
        foundComp,
        foundCategory,
        period,
        data.scrapedAt,
        pKey,
      );
      const attachment = new AttachmentBuilder(buffer, {
        name: `meta-${foundComp.name.toLowerCase().replace(/\s/g, "-")}.png`,
      });

      return interaction.editReply({ files: [attachment] });
    } catch (err) {
      logger.error("Failed to generate meta piece:", err);
      return interaction.editReply({ embeds: [fallbackEmbed()] });
    }
  }

  // ─── /meta live ───────────────────────────────────────────────────────────
  // Fetches the enriched meta from the web API instead of the local file.
  // Falls back gracefully if the API is unavailable.

  @Slash({
    name: "live",
    description: "Méta Beyblade X fraîche depuis le site rpbey.fr",
  })
  @SlashGroup("meta")
  async live(interaction: CommandInteraction) {
    await interaction.deferReply();

    try {
      const res = await fetch(`${WEB_BASE}/api/v1/meta`, {
        signal: AbortSignal.timeout(5_000),
        headers: { Accept: "application/json" },
      });

      if (!res.ok) {
        return interaction.editReply({ embeds: [fallbackEmbed()] });
      }

      const json = (await res.json()) as { data: MetaFileData | null };

      if (!json.data) {
        return interaction.editReply({ embeds: [fallbackEmbed()] });
      }

      // Re-use the existing canvas renderer with the fresh data
      const resolved = resolvePeriod(json.data, "2weeks");
      if (!resolved) return interaction.editReply({ embeds: [fallbackEmbed()] });

      const { period, pKey } = resolved;
      const buffer = await generateMetaTopCanvas(period, json.data.scrapedAt, pKey);
      const attachment = new AttachmentBuilder(buffer, { name: "meta-live.png" });

      const scrapedTs = Math.floor(new Date(json.data.scrapedAt).getTime() / 1000);
      const caption = new EmbedBuilder()
        .setColor(0xfbbf24)
        .setTitle("Méta live — Beyblade X")
        .setDescription(
          `Données fraîches du site · Mis à jour <t:${scrapedTs}:R>\n` +
            `[Voir la méta complète](https://rpbey.fr/meta)`,
        );

      return interaction.editReply({ embeds: [caption], files: [attachment] });
    } catch (err) {
      logger.error("Failed to fetch live meta:", err);
      return interaction.editReply({ embeds: [fallbackEmbed()] });
    }
  }
}
