/**
 * Classement publisher — service natif declenche en fin de tournoi
 * (ou manuellement via slash command / API) pour poster un canvas
 * de classement BTS dans le salon #classement avec ping @Tournois.
 *
 * Source de verite : `getBtsRanking(season)` + `generateLeaderboardCard`.
 * Aucune duplication de logique, aucun appel externe — tout passe par
 * le client Discord.js du bot deja initialise.
 *
 * Triggers :
 *   - `POST /api/tournaments/finalize { publishRanking: true }`
 *     (apps/rpb-bot/src/api/routes/tournaments.ts)
 *   - Slash command `/admin publier-classement`
 *     (apps/rpb-bot/src/commands/Admin/AdminGroup.ts)
 *   - Direct call : `await publishBtsRanking({ season: 2 })`
 */
import { AttachmentBuilder, type TextChannel } from "discord.js";

import { bot } from "./bot.js";
import { type BtsSeason, getBtsRanking } from "./bts-ranking.js";
import {
	generateLeaderboardCard,
	type LeaderboardEntry,
} from "./canvas-utils.js";
import { logger } from "./logger.js";

// IDs prod RPB guild — verrouilles, mais override possible via env
// (utile pour tests ou si on veut publier dans un autre salon).
export const CLASSEMENT_CHANNEL_ID =
	process.env.CLASSEMENT_CHANNEL_ID ?? "1489804785430302851";
export const TOURNOIS_ROLE_ID =
	process.env.TOURNOIS_ROLE_ID ?? "1451549606608371814";

const SEASON_LABELS: Record<BtsSeason, string> = {
	1: "Saison 1 · BTS 1",
	2: "Saison 2 · BTS 2 → 5",
};

export interface PublishRankingOptions {
	/** BTS season to publish (default: 2). */
	season?: BtsSeason;
	/** Number of top entries to render in the card (default: 10). */
	topN?: number;
	/** Override the destination channel (defaults to #classement). */
	channelId?: string;
	/** Skip the @Tournois role ping (default: false). */
	silent?: boolean;
	/** Delete the previous bot message in the channel before posting. */
	purgePrevious?: boolean;
}

export interface PublishRankingResult {
	ok: boolean;
	messageId?: string;
	channelId: string;
	rendered: number;
	total: number;
	error?: string;
}

/**
 * Genere le classement BTS top N et le publie dans le salon #classement
 * avec un ping role @Tournois et le lien vers rpbey.fr/rankings.
 *
 * Best-effort : si la generation echoue, log + retourne `{ ok: false }`,
 * ne throw pas (pour ne pas casser le finalize endpoint).
 */
export async function publishBtsRanking(
	options: PublishRankingOptions = {},
): Promise<PublishRankingResult> {
	const season = options.season ?? 2;
	const topN = options.topN ?? 10;
	const channelId = options.channelId ?? CLASSEMENT_CHANNEL_ID;
	const silent = options.silent ?? false;

	const result: PublishRankingResult = {
		ok: false,
		channelId,
		rendered: 0,
		total: 0,
	};

	try {
		// 1. Charger ranking
		const ranking = await getBtsRanking(season, { page: 1, pageSize: topN });
		result.total = ranking.total;
		result.rendered = ranking.entries.length;

		const entries: LeaderboardEntry[] = ranking.entries.map((e) => ({
			rank: e.rank,
			name: e.playerName,
			points: e.points,
			winRate:
				e.wins + e.losses === 0
					? "0"
					: String(Math.round((e.wins / (e.wins + e.losses)) * 100)),
			avatarUrl: e.avatarUrl ?? null,
			wins: e.wins,
			losses: e.losses,
			participations: e.participations,
		}));

		// 2. Render canvas (DA BTS5)
		const png = await generateLeaderboardCard(entries, {
			variant: "rpb",
			subtitle: SEASON_LABELS[season],
		});

		// 3. Resoudre channel
		const channel = await bot.channels.fetch(channelId);
		if (!channel?.isTextBased()) {
			result.error = `Channel ${channelId} not text-based or not found`;
			logger.warn(`[classement-publisher] ${result.error}`);
			return result;
		}
		const textChannel = channel as TextChannel;

		// 4. Optionnel : purger le precedent message du bot pour garder
		//    le salon lisible (1 seul classement visible a la fois).
		if (options.purgePrevious) {
			try {
				const recent = await textChannel.messages.fetch({ limit: 20 });
				const own = recent.filter((m) => m.author.id === bot.user?.id);
				if (own.size > 0) {
					await textChannel.bulkDelete(own, true).catch(() => {
						own.forEach((m) => m.delete().catch(() => {}));
					});
				}
			} catch (err) {
				logger.warn(
					`[classement-publisher] purge prev failed: ${(err as Error).message}`,
				);
			}
		}

		// 5. Envoyer message + canvas + ping
		const file = new AttachmentBuilder(png, {
			name: `classement-bts-s${season}.png`,
		});
		const content = silent
			? `Mise à jour du classement Bey-Tamashii Séries\nhttps://rpbey.fr/rankings`
			: `Mise à jour du classement Bey-Tamashii Séries <@&${TOURNOIS_ROLE_ID}>\nhttps://rpbey.fr/rankings`;

		const msg = await textChannel.send({
			content,
			files: [file],
			allowedMentions: silent ? { parse: [] } : { roles: [TOURNOIS_ROLE_ID] },
		});

		result.ok = true;
		result.messageId = msg.id;
		logger.info(
			`[classement-publisher] Published BTS S${season} top ${topN} to #${channelId} · msg ${msg.id}`,
		);
		return result;
	} catch (err) {
		result.error = (err as Error).message;
		logger.error("[classement-publisher] Publish failed:", err);
		return result;
	}
}
