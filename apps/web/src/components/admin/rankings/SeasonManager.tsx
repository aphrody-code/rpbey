"use client";

import {
	Box,
	Button,
	Card,
	CardContent,
	CardHeader,
	Chip,
	Dialog,
	DialogActions,
	DialogContent,
	DialogContentText,
	DialogTitle,
	Divider,
	List,
	ListItem,
	ListItemText,
	TextField,
	Typography,
} from "@mui/material";
import { useState } from "react";
import { archiveCurrentSeason } from "@/server/actions/season";

interface Season {
	id: string;
	name: string;
	slug: string;
	startDate: Date | string;
	endDate: Date | string | null;
	isActive: boolean;
}

export default function SeasonManager({ seasons }: { seasons: Season[] }) {
	const [open, setOpen] = useState(false);
	const [nextName, setNextName] = useState("");
	const [loading, setLoading] = useState(false);

	const currentSeason = seasons.find((s) => s.isActive);

	const handleArchive = async () => {
		if (!nextName) return;
		setLoading(true);
		try {
			const slug = nextName
				.toLowerCase()
				.replace(/[^a-z0-9]+/g, "-")
				.replace(/(^-|-$)/g, "");

			await archiveCurrentSeason(nextName, slug);
			setOpen(false);
			setNextName("");
			// Force reload or let server action revalidate path
		} catch (error) {
			console.error(error);
			alert("Erreur lors de l'archivage");
		} finally {
			setLoading(false);
		}
	};

	return (
		<Card sx={{ mb: 4 }}>
			<CardHeader
				title="Gestion des Saisons"
				subheader="Archivez la saison en cours pour réinitialiser le classement et démarrer une nouvelle période."
			/>
			<Divider />
			<CardContent>
				{currentSeason ? (
					<Box sx={{ mb: 3, p: 2, bgcolor: "action.hover", borderRadius: 2 }}>
						<Typography
							variant="subtitle2"
							sx={{
								color: "text.secondary",
							}}
						>
							Saison Actuelle
						</Typography>
						<Box
							sx={{
								display: "flex",
								justifyContent: "space-between",
								alignItems: "center",
								mt: 1,
							}}
						>
							<Typography
								variant="h6"
								sx={{
									color: "primary.main",
									fontWeight: "bold",
								}}
							>
								{currentSeason.name}
							</Typography>
							<Chip label="En cours" color="success" size="small" />
						</Box>
						<Typography
							variant="caption"
							sx={{
								color: "text.secondary",
							}}
						>
							Débutée le{" "}
							{new Date(currentSeason.startDate).toLocaleDateString()}
						</Typography>

						<Button
							variant="contained"
							color="warning"
							fullWidth
							sx={{ mt: 2 }}
							onClick={() => setOpen(true)}
						>
							Archiver & Nouvelle Saison
						</Button>

						<Box sx={{ mt: 2, display: "flex", gap: 1 }}>
							<Button
								variant="outlined"
								size="small"
								onClick={() =>
									window.open(
										"/api/admin/export/rankings?seasonId=current&format=csv",
									)
								}
							>
								Export CSV
							</Button>
							<Button
								variant="outlined"
								size="small"
								onClick={() =>
									window.open(
										"/api/admin/export/rankings?seasonId=current&format=json",
									)
								}
							>
								Export JSON
							</Button>
						</Box>
					</Box>
				) : (
					<Box
						sx={{
							mb: 3,
							p: 2,
							bgcolor: "error.light",
							color: "error.contrastText",
							borderRadius: 2,
						}}
					>
						<Typography
							sx={{
								fontWeight: "bold",
							}}
						>
							Aucune saison active !
						</Typography>
						<Typography variant="body2">
							Le système de classement nécessite une saison active pour
							fonctionner correctement.
						</Typography>
						<Button
							variant="contained"
							color="inherit"
							sx={{ mt: 1, color: "error.main" }}
							onClick={() => setOpen(true)}
						>
							Démarrer une Saison
						</Button>
					</Box>
				)}

				<Typography variant="subtitle2" sx={{ mb: 1 }}>
					Historique
				</Typography>
				<List dense>
					{seasons
						.filter((s) => !s.isActive)
						.map((season) => (
							<ListItem key={season.id} divider>
								<ListItemText
									primary={season.name}
									secondary={`${new Date(season.startDate).toLocaleDateString()} - ${
										season.endDate
											? new Date(season.endDate).toLocaleDateString()
											: "?"
									}`}
								/>
								<Chip label="Archivée" size="small" />
								<Box sx={{ ml: "auto", display: "flex", gap: 1 }}>
									<Button
										size="small"
										onClick={() =>
											window.open(
												`/api/admin/export/rankings?seasonId=${season.id}&format=csv`,
											)
										}
									>
										CSV
									</Button>
								</Box>
							</ListItem>
						))}
					{seasons.filter((s) => !s.isActive).length === 0 && (
						<Typography
							variant="body2"
							sx={{
								color: "text.secondary",
							}}
						>
							Aucune archive.
						</Typography>
					)}
				</List>
			</CardContent>
			<Dialog open={open} onClose={() => setOpen(false)}>
				<DialogTitle>Nouvelle Saison</DialogTitle>
				<DialogContent>
					<DialogContentText sx={{ mb: 2 }}>
						Attention : Cette action va :
						<br />
						1. Sauvegarder le classement actuel dans l&apos;historique.
						<br />
						2. Réinitialiser les points de TOUS les joueurs à 0.
						<br />
						3. Démarrer une nouvelle saison immédiatement.
					</DialogContentText>
					<TextField
						autoFocus
						margin="dense"
						label="Nom de la nouvelle saison"
						placeholder="Ex: Saison 2 - Hiver 2026"
						fullWidth
						variant="outlined"
						value={nextName}
						onChange={(e) => setNextName(e.target.value)}
					/>
				</DialogContent>
				<DialogActions>
					<Button onClick={() => setOpen(false)}>Annuler</Button>
					<Button
						onClick={handleArchive}
						variant="contained"
						disabled={!nextName || loading}
					>
						{loading ? "Traitement..." : "Confirmer"}
					</Button>
				</DialogActions>
			</Dialog>
		</Card>
	);
}
