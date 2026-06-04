import { Discord, Slash, SlashOption } from "@rpbey/discordx";
import {
  ApplicationCommandOptionType,
  EmbedBuilder,
  MessageFlags,
  type CommandInteraction,
} from "discord.js";
import { injectable } from "tsyringe";

import { Colors } from "../../lib/constants.js";

// Catégories disponibles sur /api/v1/search (SearchCategorySchema)
const SEARCH_CATEGORIES = [
  { name: "Produit", value: "product" },
  { name: "Pièce", value: "part" },
  { name: "Tournoi", value: "tournament" },
  { name: "Blader", value: "blader" },
  { name: "Lexique", value: "lexicon" },
  { name: "Combo", value: "combo" },
  { name: "Anime", value: "anime" },
  { name: "Méta", value: "meta" },
  { name: "Discussion", value: "discussion" },
  { name: "Page", value: "page" },
] as const;

// Serverless: the web app runs on Vercel. Default to the public origin so the
// Cloud Run bot reaches it with zero extra config; `RPBEY_WEB_BASE` overrides
// (e.g. a preview deployment or local dev against http://127.0.0.1:3002).
const WEB_BASE = process.env.RPBEY_WEB_BASE ?? "https://rpbey.fr";

@Discord()
@injectable()
export class SearchCommand {
  @Slash({
    name: "recherche",
    description: "Recherche globale sur rpbey.fr (pièces, tournois, bladers, méta…)",
  })
  async recherche(
    @SlashOption({
      name: "q",
      description: "Termes de recherche",
      required: true,
      type: ApplicationCommandOptionType.String,
      minLength: 2,
      maxLength: 120,
    })
    query: string,
    @SlashOption({
      name: "categorie",
      description: "Filtrer par catégorie (optionnel)",
      required: false,
      type: ApplicationCommandOptionType.String,
      autocomplete: (interaction) => {
        const focused = interaction.options.getFocused().toLowerCase();
        return interaction.respond(
          SEARCH_CATEGORIES.filter(
            (c) =>
              c.name.toLowerCase().includes(focused) || c.value.toLowerCase().includes(focused),
          ).slice(0, 25),
        );
      },
    })
    category: string | undefined,
    interaction: CommandInteraction,
  ) {
    await interaction.deferReply();

    try {
      const params = new URLSearchParams({ q: query, limit: "8" });
      if (category) params.set("category", category);

      const res = await fetch(`${WEB_BASE}/api/v1/search?${params}`, {
        signal: AbortSignal.timeout(5_000),
        headers: { Accept: "application/json" },
      });

      if (!res.ok) {
        return interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor(Colors.Warning)
              .setTitle("Recherche indisponible")
              .setDescription(
                `Le service de recherche a renvoyé une erreur (HTTP ${res.status}). Réessayez dans quelques instants.`,
              ),
          ],
        });
      }

      const json = (await res.json()) as {
        count: number;
        data: {
          id: string;
          title: string;
          subtitle: string;
          category: string;
          url: string;
          details?: string;
          badge?: string;
          score?: number;
        }[];
        query?: string;
        facets?: Record<string, number>;
      };

      const items = json.data.slice(0, 8);

      if (items.length === 0) {
        return interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor(Colors.Warning)
              .setTitle(`Aucun résultat pour « ${query} »`)
              .setDescription(
                "Essayez d'autres mots-clés ou consultez [rpbey.fr/recherche](https://rpbey.fr/recherche) pour la recherche complète.",
              ),
          ],
        });
      }

      const CATEGORY_EMOJI: Record<string, string> = {
        product: "📦",
        part: "⚙️",
        tournament: "🏆",
        blader: "👤",
        lexicon: "📖",
        combo: "🌀",
        anime: "📺",
        meta: "📊",
        discussion: "💬",
        page: "📄",
        frame: "🖼️",
        site: "🌐",
      };

      const lines = items.map((item) => {
        const emoji = CATEGORY_EMOJI[item.category] ?? "•";
        const url = item.url.startsWith("http") ? item.url : `https://rpbey.fr${item.url}`;
        const badge = item.badge ? ` \`${item.badge}\`` : "";
        const sub = item.subtitle ? ` — ${item.subtitle}` : "";
        return `${emoji} **[${item.title}](${url})**${badge}${sub}`;
      });

      const embed = new EmbedBuilder()
        .setColor(Colors.Primary)
        .setTitle(`Résultats pour « ${query} »`)
        .setDescription(lines.join("\n"))
        .setFooter({
          text: `${json.count} résultat${json.count !== 1 ? "s" : ""} · rpbey.fr/recherche`,
        })
        .setURL(`https://rpbey.fr/recherche?q=${encodeURIComponent(query)}`);

      if (category && json.facets) {
        const facetParts = Object.entries(json.facets)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 5)
          .map(([cat, n]) => `${CATEGORY_EMOJI[cat] ?? "•"} ${cat}: ${n}`)
          .join(" · ");
        if (facetParts) embed.setFooter({ text: facetParts });
      }

      return interaction.editReply({ embeds: [embed] });
    } catch (err: unknown) {
      const isTimeout =
        err instanceof Error && (err.name === "TimeoutError" || err.message.includes("timeout"));
      return interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(Colors.Error)
            .setTitle("Recherche indisponible")
            .setDescription(
              isTimeout
                ? "Le service de recherche met trop de temps à répondre (>5 s). Réessayez dans quelques instants."
                : "Une erreur inattendue s'est produite. Consultez directement [rpbey.fr/recherche](https://rpbey.fr/recherche).",
            ),
        ],
      });
    }
  }
}
