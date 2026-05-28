"use client";

import {
	KeyboardArrowLeft,
	KeyboardArrowRight,
} from "@mui/icons-material";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { useCallback, useState } from "react";
import { RankingPreview } from "./RankingPreview";

// MUI alpha() ne gère pas les CSS variables (var(--rpb-primary)) — color-mix
// fonctionne pour les hex ET les var(), donc on l'utilise pour teinter l'accent.
const tint = (color: string, pct: number) =>
	`color-mix(in srgb, ${color} ${pct}%, transparent)`;

export interface RankingEntry {
	id: string;
	userId: string | null;
	playerName: string;
	points: number;
	wins: number;
	losses: number;
	tournamentWins: number;
	avatarUrl: string | null;
}

export interface RankingBoard {
	key: "global" | "wb" | "satr" | "stardust";
	label: string;
	sublabel: string;
	color: string;
	href: string;
	entries: RankingEntry[];
}

const SWIPE_CONFIDENCE = 60;

export function RankingsCarousel({ boards }: { boards: RankingBoard[] }) {
	const available = boards.filter((b) => b.entries.length > 0);
	const [[index, direction], setState] = useState<[number, number]>([0, 0]);

	const count = available.length;
	const safeIndex = count > 0 ? ((index % count) + count) % count : 0;
	const board = available[safeIndex];

	const paginate = useCallback(
		(next: number, dir: number) => setState([next, dir]),
		[],
	);

	const go = useCallback(
		(dir: number) => paginate(safeIndex + dir, dir),
		[paginate, safeIndex],
	);

	if (!board) {
		return (
			<Typography
				variant="body2"
				sx={{ color: "text.secondary", py: 4, textAlign: "center" }}
			>
				Aucun classement disponible
			</Typography>
		);
	}

	return (
		<Box>
			{/* Tabs — un onglet par classement */}
			<Box
				sx={{
					display: "flex",
					gap: 1,
					mb: 2.5,
					overflowX: "auto",
					pb: 0.5,
					"&::-webkit-scrollbar": { display: "none" },
					scrollbarWidth: "none",
				}}
			>
				{available.map((b, i) => {
					const isActive = i === safeIndex;
					return (
						<Box
							key={b.key}
							component="button"
							type="button"
							onClick={() => paginate(i, i > safeIndex ? 1 : -1)}
							aria-pressed={isActive}
							sx={{
								flexShrink: 0,
								display: "flex",
								alignItems: "center",
								gap: 0.75,
								px: { xs: 1.25, md: 1.75 },
								py: 0.75,
								borderRadius: 2.5,
								cursor: "pointer",
								border: "1px solid",
								borderColor: isActive ? tint(b.color, 50) : "divider",
								bgcolor: isActive ? tint(b.color, 12) : "rgba(255,255,255,0.02)",
								boxShadow: isActive ? `0 0 16px ${tint(b.color, 25)}` : "none",
								color: isActive ? b.color : "text.secondary",
								transition: "all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)",
								"&:hover": {
									bgcolor: tint(b.color, isActive ? 16 : 6),
									color: b.color,
								},
							}}
						>
							<Box
								sx={{
									width: 7,
									height: 7,
									borderRadius: "50%",
									bgcolor: b.color,
									boxShadow: `0 0 6px ${b.color}`,
									flexShrink: 0,
								}}
							/>
							<Typography
								component="span"
								sx={{
									fontWeight: 800,
									fontSize: { xs: "0.72rem", md: "0.8rem" },
									whiteSpace: "nowrap",
									letterSpacing: 0.2,
								}}
							>
								{b.label}
							</Typography>
						</Box>
					);
				})}
			</Box>

			{/* Sous-titre + flèches */}
			<Stack
				direction="row"
				sx={{ justifyContent: "space-between", alignItems: "center", mb: 1.5 }}
			>
				<Typography
					variant="caption"
					sx={{
						color: "text.secondary",
						fontWeight: 700,
						textTransform: "uppercase",
						letterSpacing: 0.6,
						fontSize: "0.62rem",
					}}
				>
					{board.sublabel}
				</Typography>
				{count > 1 && (
					<Stack direction="row" spacing={0.5}>
						<IconButton
							onClick={() => go(-1)}
							size="small"
							aria-label="Classement précédent"
							sx={{
								width: 30,
								height: 30,
								color: "text.secondary",
								border: "1px solid",
								borderColor: "divider",
								"&:hover": { color: board.color, borderColor: tint(board.color, 50) },
							}}
						>
							<KeyboardArrowLeft fontSize="small" />
						</IconButton>
						<IconButton
							onClick={() => go(1)}
							size="small"
							aria-label="Classement suivant"
							sx={{
								width: 30,
								height: 30,
								color: "text.secondary",
								border: "1px solid",
								borderColor: "divider",
								"&:hover": { color: board.color, borderColor: tint(board.color, 50) },
							}}
						>
							<KeyboardArrowRight fontSize="small" />
						</IconButton>
					</Stack>
				)}
			</Stack>

			{/* Panneau animé — swipe horizontal */}
			<Box sx={{ position: "relative", overflow: "hidden" }}>
				<AnimatePresence initial={false} custom={direction} mode="wait">
					<motion.div
						key={board.key}
						custom={direction}
						initial={{ opacity: 0, x: direction >= 0 ? 40 : -40 }}
						animate={{ opacity: 1, x: 0 }}
						exit={{ opacity: 0, x: direction >= 0 ? -40 : 40 }}
						transition={{ duration: 0.28, ease: [0.2, 0, 0, 1] }}
						drag={count > 1 ? "x" : false}
						dragConstraints={{ left: 0, right: 0 }}
						dragElastic={0.2}
						onDragEnd={(_, info) => {
							if (info.offset.x < -SWIPE_CONFIDENCE) go(1);
							else if (info.offset.x > SWIPE_CONFIDENCE) go(-1);
						}}
						style={{ touchAction: "pan-y" }}
					>
						<RankingPreview rankings={board.entries} accent={board.color} />
					</motion.div>
				</AnimatePresence>
			</Box>

			{/* Pagination dots */}
			{count > 1 && (
				<Stack
					direction="row"
					spacing={0.75}
					sx={{ justifyContent: "center", mt: 2 }}
				>
					{available.map((b, i) => (
						<Box
							key={b.key}
							component="button"
							type="button"
							aria-label={`Aller au classement ${b.label}`}
							onClick={() => paginate(i, i > safeIndex ? 1 : -1)}
							sx={{
								width: i === safeIndex ? 20 : 7,
								height: 7,
								borderRadius: 4,
								border: "none",
								p: 0,
								cursor: "pointer",
								bgcolor:
									i === safeIndex ? board.color : "rgba(255,255,255,0.18)",
								transition: "all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)",
							}}
						/>
					))}
				</Stack>
			)}

			{/* CTA */}
			<Box sx={{ mt: 2.5 }}>
				<Button
					component={Link}
					href={board.href}
					fullWidth
					variant="outlined"
					sx={{
						borderRadius: 3,
						fontWeight: 800,
						textTransform: "none",
						color: board.color,
						borderColor: tint(board.color, 40),
						"&:hover": {
							borderColor: board.color,
							bgcolor: tint(board.color, 8),
						},
					}}
				>
					Voir le classement {board.label}
				</Button>
			</Box>
		</Box>
	);
}
