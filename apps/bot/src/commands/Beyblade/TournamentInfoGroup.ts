import { Discord, Slash, SlashOption } from "@rpbey/discordx";
import { ApplicationCommandOptionType, EmbedBuilder, type CommandInteraction } from "discord.js";
import { injectable } from "tsyringe";

import { Colors } from "../../lib/constants.js";

const WEB_BASE = "http://127.0.0.1:3002";

// Statuts "à venir" à filtrer côté client depuis la réponse
const UPCOMING_STATUSES = new Set([
  "UPCOMING",
  "REGISTRATION_OPEN",
  "REGISTRATION_CLOSED",
  "CHECKIN",
]);

interface TournamentCard {
  id: string;
  name: string;
  description?: string | null;
  date: string;
  location?: string | null;
  format: string;
  status: string;
  challongeUrl?: string | null;
  posterUrl?: string | null;
  participantsCount: number;
  category?: { name: string; color?: string | null } | null;
}

const STATUS_LABEL: Record<string, string> = {
  UPCOMING: "A venir",
  REGISTRATION_OPEN: "Inscriptions ouvertes",
  REGISTRATION_CLOSED: "Inscriptions fermees",
  CHECKIN: "Check-in",
  UNDERWAY: "En cours",
  COMPLETE: "Termine",
  CANCELLED: "Annule",
  ARCHIVED: "Archive",
};

const STATUS_EMOJI: Record<string, string> = {
  UPCOMING: "📅",
  REGISTRATION_OPEN: "✅",
  REGISTRATION_CLOSED: "🔒",
  CHECKIN: "📋",
  UNDERWAY: "⚔️",
};

@Discord()
@injectable()
export class TournamentInfoGroup {
  @Slash({
    name: "tournoi-prochain",
    description: "Affiche les prochains tournois RPB à venir",
  })
  async tournamentNext(
    @SlashOption({
      name: "limite",
      description: "Nombre de tournois à afficher (1-10, défaut: 5)",
      required: false,
      type: ApplicationCommandOptionType.Integer,
      minValue: 1,
      maxValue: 10,
    })
    limite: number = 5,
    interaction: CommandInteraction,
  ) {
    await interaction.deferReply();

    try {
      // Fetch upcoming first, then fallback to registration_open if none
      const params = new URLSearchParams({ limit: "20" });
      const res = await fetch(`${WEB_BASE}/api/v1/tournaments?${params}`, {
        signal: AbortSignal.timeout(5_000),
        headers: { Accept: "application/json" },
      });

      if (!res.ok) {
        return interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor(Colors.Warning)
              .setTitle("Tournois indisponibles")
              .setDescription(
                `L'API a renvoyé une erreur (HTTP ${res.status}). Consultez [rpbey.fr/tournois](https://rpbey.fr/tournois).`,
              ),
          ],
        });
      }

      const json = (await res.json()) as {
        items: TournamentCard[];
        total: number;
      };

      const now = Date.now();

      // Filter upcoming: status in UPCOMING_STATUSES and date in the future
      const upcoming = json.items
        .filter((t) => UPCOMING_STATUSES.has(t.status) && new Date(t.date).getTime() >= now)
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        .slice(0, limite);

      if (upcoming.length === 0) {
        return interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor(Colors.Info)
              .setTitle("Aucun tournoi à venir")
              .setDescription(
                "Aucun tournoi planifié pour le moment. Surveillez [rpbey.fr/tournois](https://rpbey.fr/tournois) pour les annonces !",
              ),
          ],
        });
      }

      const embed = new EmbedBuilder()
        .setColor(Colors.Secondary)
        .setTitle("Prochains tournois RPB")
        .setURL("https://rpbey.fr/tournois");

      for (const t of upcoming) {
        const tsUnix = Math.floor(new Date(t.date).getTime() / 1000);
        const emoji = STATUS_EMOJI[t.status] ?? "📅";
        const status = STATUS_LABEL[t.status] ?? t.status;
        const cat = t.category?.name ? `[${t.category.name}] ` : "";
        const loc = t.location ? `📍 ${t.location}` : "";
        const format = `Format: ${t.format}`;
        const participants = `👥 ${t.participantsCount} inscrit(s)`;
        const challongeLink = t.challongeUrl
          ? `[Bracket Challonge](${t.challongeUrl})`
          : "[Voir sur le site](https://rpbey.fr/tournois)";

        const lines = [
          `${emoji} **${status}** · <t:${tsUnix}:D> (<t:${tsUnix}:R>)`,
          loc,
          `${format} · ${participants}`,
          challongeLink,
        ]
          .filter(Boolean)
          .join("\n");

        embed.addFields({
          name: `${cat}${t.name}`,
          value: lines,
        });
      }

      embed.setFooter({ text: `${json.total} tournoi(s) au total · rpbey.fr/tournois` });

      return interaction.editReply({ embeds: [embed] });
    } catch (err: unknown) {
      const isTimeout =
        err instanceof Error && (err.name === "TimeoutError" || err.message.includes("timeout"));
      return interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(Colors.Error)
            .setTitle("Erreur")
            .setDescription(
              isTimeout
                ? "Le service de tournois met trop de temps à répondre. Consultez [rpbey.fr/tournois](https://rpbey.fr/tournois)."
                : "Impossible de charger les tournois. Réessayez dans quelques instants.",
            ),
        ],
      });
    }
  }
}
