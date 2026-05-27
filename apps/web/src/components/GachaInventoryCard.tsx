"use client";

import { Badge, Box, Card, Chip, Typography } from "@mui/material";
import Image from "next/image";
import { RARITY_COLORS, RARITY_LABELS } from "@/lib/gacha-helpers";
import type { CardRarity } from "@/lib/types";

export interface InventoryItemShape {
	id: string;
	count: number;
	obtainedAt: Date | string;
	card: {
		id: string;
		name: string;
		rarity: CardRarity;
		imageUrl: string | null;
		series: string;
		att: number;
		def: number;
		end: number;
		specialMove: string | null;
		description: string | null;
		drop: {
			name: string;
		} | null;
	};
}

interface GachaInventoryCardProps {
	item: InventoryItemShape;
	onClick?: (item: InventoryItemShape) => void;
}

export function GachaInventoryCard({ item, onClick }: GachaInventoryCardProps) {
	const rarityColor = RARITY_COLORS[item.card.rarity];
	const rarityLabel = RARITY_LABELS[item.card.rarity];

	return (
		<Badge
			badgeContent={item.count > 1 ? `x${item.count}` : undefined}
			color="primary"
			sx={{
				width: "100%",
				"& .MuiBadge-badge": {
					fontWeight: 700,
					fontSize: "0.7rem",
				},
			}}
		>
			<Card
				elevation={0}
				onClick={() => onClick?.(item)}
				sx={{
					width: "100%",
					border: "2px solid",
					borderColor: rarityColor,
					borderRadius: 2,
					cursor: onClick ? "pointer" : "default",
					transition: "transform 0.15s ease, box-shadow 0.15s ease",
					"&:hover": onClick
						? {
								transform: "translateY(-2px)",
								boxShadow: `0 4px 20px ${rarityColor}40`,
							}
						: {},
					overflow: "hidden",
				}}
			>
				{/* Card image */}
				<Box
					sx={{
						position: "relative",
						aspectRatio: "3/4",
						bgcolor: "background.default",
					}}
				>
					{item.card.imageUrl ? (
						<Image
							src={item.card.imageUrl}
							alt={item.card.name}
							fill
							style={{ objectFit: "cover" }}
							sizes="(max-width: 600px) 50vw, 25vw"
						/>
					) : (
						<Box
							sx={{
								width: "100%",
								height: "100%",
								display: "flex",
								alignItems: "center",
								justifyContent: "center",
								bgcolor: `${rarityColor}20`,
							}}
						>
							<Typography
								variant="h4"
								sx={{ color: rarityColor, fontWeight: 700 }}
							>
								{item.card.name.charAt(0)}
							</Typography>
						</Box>
					)}
					{/* Rarity chip overlay */}
					<Chip
						label={rarityLabel}
						size="small"
						sx={{
							position: "absolute",
							bottom: 6,
							left: 6,
							bgcolor: rarityColor,
							color: "#fff",
							fontWeight: 700,
							fontSize: "0.65rem",
							height: 20,
						}}
					/>
				</Box>

				{/* Card footer */}
				<Box sx={{ p: 1 }}>
					<Typography
						variant="caption"
						sx={{
							fontWeight: 700,
							display: "block",
							overflow: "hidden",
							textOverflow: "ellipsis",
							whiteSpace: "nowrap",
						}}
					>
						{item.card.name}
					</Typography>
					{item.card.drop && (
						<Typography
							variant="caption"
							sx={{
								color: "text.secondary",
								display: "block",
								fontSize: "0.6rem",
							}}
						>
							{item.card.drop.name}
						</Typography>
					)}
				</Box>
			</Card>
		</Badge>
	);
}
