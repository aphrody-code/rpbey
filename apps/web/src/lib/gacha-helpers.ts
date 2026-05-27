import type { CardRarity, TransactionType } from "@/lib/types";

export const RARITY_COLORS: Record<CardRarity, string> = {
	COMMON: "#94a3b8",
	RARE: "#3b82f6",
	SUPER_RARE: "#a855f7",
	LEGENDARY: "#fbbf24",
	SECRET: "#ec4899",
};

export const RARITY_LABELS: Record<CardRarity, string> = {
	COMMON: "Commun",
	RARE: "Rare",
	SUPER_RARE: "Super Rare",
	LEGENDARY: "Légendaire",
	SECRET: "Secrète",
};

interface TransactionMeta {
	label: string;
	color: string;
	icon: string;
}

export const TRANSACTION_LABELS: Record<TransactionType, TransactionMeta> = {
	DAILY_CLAIM: {
		label: "Récompense quotidienne",
		color: "#22c55e",
		icon: "today",
	},
	GACHA_PULL: { label: "Pull x1", color: "#ef4444", icon: "casino" },
	MULTI_PULL: { label: "Pull x5", color: "#f97316", icon: "casino" },
	ADMIN_GIVE: {
		label: "Don admin",
		color: "#6366f1",
		icon: "admin_panel_settings",
	},
	ADMIN_TAKE: {
		label: "Retrait admin",
		color: "#dc2626",
		icon: "remove_circle",
	},
	TOURNAMENT_REWARD: {
		label: "Récompense tournoi",
		color: "#f59e0b",
		icon: "emoji_events",
	},
	SELL_CARD: { label: "Vente de carte", color: "#3b82f6", icon: "sell" },
	STREAK_BONUS: {
		label: "Bonus de série",
		color: "#10b981",
		icon: "local_fire_department",
	},
	BADGE_REWARD: {
		label: "Récompense badge",
		color: "#8b5cf6",
		icon: "military_tech",
	},
	DUEL_REWARD: {
		label: "Récompense duel",
		color: "#ec4899",
		icon: "sports_martial_arts",
	},
};
