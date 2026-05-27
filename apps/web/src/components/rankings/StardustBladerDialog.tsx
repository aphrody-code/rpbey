"use client";

import CloseIcon from "@mui/icons-material/Close";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import {
	Box,
	Chip,
	Collapse,
	Dialog,
	DialogContent,
	DialogTitle,
	Divider,
	IconButton,
	List,
	ListItem,
	ListItemText,
	Stack,
	Typography,
} from "@mui/material";
import { useState } from "react";

import { TournamentBracketDb } from "@/components/tournaments/TournamentBracketDb";
import { type StardustBlader } from "@/lib/types";

interface HistoryEntry {
	tournamentSlug: string;
	tournamentLabel: string;
	finalRank: number | null;
	wins: number;
	losses: number;
	date: string;
}

interface Props {
	blader: StardustBlader | null;
	open: boolean;
	onClose: () => void;
}

const ACCENT = "#60A5FA";

/**
 * Dialog Stardust : remplace l'ancien lien "voir tournoi" par un bracket
 * inline (TournamentBracketDb) déplié au clic. Le bracket vient de la DB
 * via `/api/brackets/db/[id]` (le slug stardust = id Prisma).
 */
export function StardustBladerDialog({ blader, open, onClose }: Props) {
	const [expanded, setExpanded] = useState<string | null>(null);

	if (!blader) return null;

	const history = (blader.history as unknown as HistoryEntry[]) ?? [];
	const totalMatches = blader.totalWins + blader.totalLosses;
	const winrate =
		totalMatches > 0
			? ((blader.totalWins / totalMatches) * 100).toFixed(1)
			: "0";

	return (
		<Dialog
			open={open}
			onClose={onClose}
			maxWidth="md"
			fullWidth
			slotProps={{
				paper: {
					sx: {
						bgcolor: "rgba(8, 4, 16, 0.95)",
						backdropFilter: "blur(12px)",
						border: `1px solid ${ACCENT}40`,
						borderRadius: 4,
					},
				},
			}}
		>
			<DialogTitle
				sx={{
					display: "flex",
					justifyContent: "space-between",
					alignItems: "center",
					borderBottom: "1px solid rgba(255,255,255,0.05)",
					pb: 2,
				}}
			>
				<Typography
					variant="h6"
					sx={{ fontWeight: 900, color: "#fff", letterSpacing: 0.5 }}
				>
					{blader.name}
				</Typography>
				<IconButton onClick={onClose} size="small">
					<CloseIcon />
				</IconButton>
			</DialogTitle>
			<DialogContent sx={{ mt: 2 }}>
				<Stack direction="row" spacing={2} sx={{ mb: 3, flexWrap: "wrap" }}>
					<Chip
						label={`🏆 ${blader.tournamentWins} titre${blader.tournamentWins > 1 ? "s" : ""}`}
						sx={{ bgcolor: `${ACCENT}20`, color: ACCENT, fontWeight: 900 }}
					/>
					<Chip
						label={`W/L: ${blader.totalWins}/${blader.totalLosses}`}
						sx={{ bgcolor: "rgba(255,255,255,0.05)", fontWeight: 700 }}
					/>
					<Chip
						label={`Winrate: ${winrate}%`}
						sx={{ bgcolor: "rgba(255,255,255,0.05)", fontWeight: 700 }}
					/>
					<Chip
						label={`${blader.tournamentsCount} tournois`}
						sx={{ bgcolor: "rgba(255,255,255,0.05)", fontWeight: 700 }}
					/>
				</Stack>

				<Divider sx={{ borderColor: "rgba(255,255,255,0.05)", mb: 2 }} />

				<Typography
					variant="overline"
					sx={{ color: "text.secondary", fontWeight: 900, letterSpacing: 1 }}
				>
					Tournois Stardust · clique pour voir le bracket
				</Typography>

				{history.length === 0 ? (
					<Typography
						variant="body2"
						sx={{ color: "text.secondary", mt: 2, textAlign: "center", py: 4 }}
					>
						Aucun historique disponible
					</Typography>
				) : (
					<List dense sx={{ mt: 1 }}>
						{history
							.slice()
							.sort((a, b) => (a.date < b.date ? 1 : -1))
							.map((h) => {
								const isOpen = expanded === h.tournamentSlug;
								return (
									<Box key={h.tournamentSlug} sx={{ mb: 0.5 }}>
										<ListItem
											onClick={() =>
												setExpanded(isOpen ? null : h.tournamentSlug)
											}
											sx={{
												py: 1.2,
												px: 1.5,
												borderRadius: 2,
												bgcolor: isOpen
													? `${ACCENT}15`
													: "rgba(255,255,255,0.02)",
												cursor: "pointer",
												"&:hover": { bgcolor: `${ACCENT}12` },
											}}
											secondaryAction={
												isOpen ? <ExpandLessIcon /> : <ExpandMoreIcon />
											}
										>
											<ListItemText
												primary={
													<Box
														sx={{
															display: "flex",
															justifyContent: "space-between",
															alignItems: "center",
															gap: 1,
															pr: 4,
														}}
													>
														<Typography
															sx={{
																fontWeight: 800,
																color: "#fff",
																fontSize: "0.9rem",
															}}
														>
															{h.tournamentLabel}
														</Typography>
														{h.finalRank != null && (
															<Chip
																label={`#${h.finalRank}`}
																size="small"
																sx={{
																	bgcolor:
																		h.finalRank <= 3
																			? `${ACCENT}30`
																			: "rgba(255,255,255,0.05)",
																	color:
																		h.finalRank <= 3
																			? ACCENT
																			: "text.secondary",
																	fontWeight: 900,
																	height: 20,
																}}
															/>
														)}
													</Box>
												}
												secondary={
													<Typography
														variant="caption"
														sx={{ color: "text.secondary" }}
													>
														W/L : {h.wins}/{h.losses} ·{" "}
														{new Date(h.date).toLocaleDateString("fr-FR", {
															day: "2-digit",
															month: "short",
															year: "numeric",
														})}
													</Typography>
												}
											/>
										</ListItem>

										<Collapse in={isOpen} timeout="auto" unmountOnExit>
											<Box
												sx={{
													mt: 1,
													mb: 1.5,
													p: 1,
													borderRadius: 2,
													bgcolor: "rgba(0,0,0,0.4)",
													border: `1px solid ${ACCENT}25`,
												}}
											>
												<TournamentBracketDb
													tournamentId={h.tournamentSlug}
													height={500}
												/>
											</Box>
										</Collapse>
									</Box>
								);
							})}
					</List>
				)}
			</DialogContent>
		</Dialog>
	);
}
