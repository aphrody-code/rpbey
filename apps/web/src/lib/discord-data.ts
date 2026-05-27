import { BOT_API_KEY, getBotApiUrl } from "@/lib/bot-config";
import { type DiscordStats, type TeamGroup } from "@/lib/discord-types";
import { db, schema, eq, asc, desc } from "@/lib/db";
import { DiscordRoleMapping, type RoleType } from "@/lib/role-colors";
import { type BotMember } from "@/types";

export { type DiscordStats, type TeamGroup };

export async function getDiscordStats(): Promise<DiscordStats> {
	const fallbackName = "République Populaire du Beyblade";

	try {
		// Fetch from bot API + Discord invite API in parallel
		const [botRes, inviteRes] = await Promise.all([
			fetch(`${getBotApiUrl()}/api/status`, {
				headers: { "x-api-key": BOT_API_KEY },
				next: { revalidate: 60 },
			}).catch(() => null),
			fetch("https://discord.com/api/v9/invites/rpb?with_counts=true", {
				next: { revalidate: 60 },
			}).catch(() => null),
		]);

		const botData = botRes?.ok ? await botRes.json() : null;
		const inviteData = inviteRes?.ok ? await inviteRes.json() : null;

		return {
			serverName: inviteData?.guild?.name || fallbackName,
			memberCount:
				botData?.memberCount || inviteData?.approximate_member_count || 0,
			onlineCount:
				inviteData?.approximate_presence_count || botData?.onlineCount || 0,
		};
	} catch (error) {
		console.error("Failed to fetch Discord stats:", error);
	}

	return { onlineCount: 0, memberCount: 0, serverName: fallbackName };
}

export async function getDiscordTeam(): Promise<TeamGroup[]> {
	try {
		// Fetch from Database (Source of Truth via /sync command)
		const staffMembers = await db.query.staffMembers.findMany({
			where: eq(schema.staffMembers.isActive, true),
			orderBy: [
				asc(schema.staffMembers.displayIndex),
				desc(schema.staffMembers.createdAt),
			],
		});

		const roles = Object.entries(DiscordRoleMapping);

		// Group by Role
		const teamData = roles.map(([roleId, roleType]) => {
			// Filter members who have this role assigned in DB
			// Note: member.role in DB is the RoleType key (e.g. "ADMIN")
			const members = staffMembers
				.filter((m) => m.role === roleType)
				.map((m) => {
					// Map DB model to BotMember interface
					return {
						id: m.discordId || m.id,
						username: m.name,
						displayName: m.nickname || m.name,
						avatar: m.imageUrl,
						nickname: m.nickname || undefined,
						joinedAt: m.joinedAt ?? undefined,
						premiumSince: m.premiumSince ?? null,
						roles: (m.roles as unknown[]) || [],
						status: m.status || undefined,
						activities: (m.activities as unknown[]) || [],
						serverAvatar: m.serverAvatar || null,
						globalName: m.globalName || null,
						createdAt: m.accountCreatedAt ?? undefined,
					} as BotMember;
				});

			return {
				roleId,
				roleType: roleType as RoleType,
				members,
			};
		});

		// Sort order: ADMIN -> RH -> ARBITRE -> STAFF -> Others
		const sortOrder: RoleType[] = ["ADMIN", "RH", "ARBITRE", "STAFF"];

		return teamData
			.filter((t) => t.members.length > 0)
			.sort((a, b) => {
				const indexA = sortOrder.indexOf(a.roleType);
				const indexB = sortOrder.indexOf(b.roleType);

				// Items in sortOrder come first
				if (indexA !== -1 && indexB !== -1) return indexA - indexB;
				if (indexA !== -1) return -1;
				if (indexB !== -1) return 1;

				// Fallback to alphabetical or defined order
				return 0;
			});
	} catch (error) {
		console.error("Failed to fetch Discord team:", error);
		return [];
	}
}
