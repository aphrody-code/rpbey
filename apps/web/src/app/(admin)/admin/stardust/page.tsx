import {
	Alert,
	AlertTitle,
	Box,
	Card,
	CardContent,
	Divider,
	Grid,
	Paper,
	Stack,
	Typography,
} from "@mui/material";
import { PageHeader } from "@/components/ui/PageHeader";
import { db, schema, count, desc, eq, ilike } from "@/lib/db";
import { formatDateTime } from "@/lib/utils";
import StardustSyncActions from "./_components/StardustSyncActions";

export const dynamic = "force-dynamic";

export default async function AdminStardustPage() {
	const [rankingCountRows, bladerCountRows, tournamentCountRows, lastUpdate] =
		await Promise.all([
			db.select({ value: count() }).from(schema.stardustRankings),
			db.select({ value: count() }).from(schema.stardustBladers),
			db
				.select({ value: count() })
				.from(schema.tournaments)
				.innerJoin(
					schema.tournamentCategories,
					eq(schema.tournaments.categoryId, schema.tournamentCategories.id),
				)
				.where(ilike(schema.tournamentCategories.name, "%STARDUST%")),
			db.query.stardustRankings.findFirst({
				orderBy: desc(schema.stardustRankings.updatedAt),
				columns: { updatedAt: true },
			}),
		]);
	const rankingCount = rankingCountRows[0]?.value ?? 0;
	const bladerCount = bladerCountRows[0]?.value ?? 0;
	const tournamentCount = tournamentCountRows[0]?.value ?? 0;

	return (
		<Box sx={{ py: 4 }}>
			<PageHeader
				title="Gestion Stardust Séries"
				description="Contrôlez la synchronisation du classement RPB Nord."
			/>
			<Grid container spacing={3}>
				<Grid size={{ xs: 12, md: 8 }}>
					<Paper
						sx={{
							p: 3,
							borderRadius: 4,
							border: "1px solid",
							borderColor: "divider",
						}}
					>
						<Typography variant="h6" gutterBottom sx={{ fontWeight: "bold" }}>
							Synchronisation manuelle
						</Typography>
						<Typography variant="body2" sx={{ color: "text.secondary", mb: 3 }}>
							Recalcule les points Stardust à partir des tournois catégorie
							&laquo;&nbsp;STARDUST&nbsp;&raquo; déjà en base (pas de scraping
							externe requis).
						</Typography>
						<StardustSyncActions />
					</Paper>
				</Grid>
				<Grid size={{ xs: 12, md: 4 }}>
					<Stack spacing={3}>
						<Card variant="outlined" sx={{ borderRadius: 3 }}>
							<CardContent>
								<Typography
									variant="overline"
									sx={{ color: "text.secondary", fontWeight: "bold" }}
								>
									État des données
								</Typography>
								<Box sx={{ mt: 1 }}>
									<Box
										sx={{
											display: "flex",
											justifyContent: "space-between",
											mb: 1,
										}}
									>
										<Typography variant="body2">Tournois source</Typography>
										<Typography variant="body2" sx={{ fontWeight: "bold" }}>
											{tournamentCount}
										</Typography>
									</Box>
									<Box
										sx={{
											display: "flex",
											justifyContent: "space-between",
											mb: 1,
										}}
									>
										<Typography variant="body2">Classement</Typography>
										<Typography variant="body2" sx={{ fontWeight: "bold" }}>
											{rankingCount} joueurs
										</Typography>
									</Box>
									<Box
										sx={{
											display: "flex",
											justifyContent: "space-between",
											mb: 1,
										}}
									>
										<Typography variant="body2">Carrière</Typography>
										<Typography variant="body2" sx={{ fontWeight: "bold" }}>
											{bladerCount} profils
										</Typography>
									</Box>
									<Divider sx={{ my: 1 }} />
									<Typography
										variant="caption"
										sx={{ color: "text.secondary" }}
									>
										Dernière MAJ :{" "}
										{lastUpdate?.updatedAt
											? formatDateTime(lastUpdate.updatedAt)
											: "Jamais"}
									</Typography>
								</Box>
							</CardContent>
						</Card>
						<Alert severity="info" sx={{ borderRadius: 3 }}>
							<AlertTitle>Catégorie requise</AlertTitle>
							Les tournois doivent être rattachés à une{" "}
							<strong>TournamentCategory</strong> dont le nom contient «
							STARDUST » et avoir un <strong>status</strong> parmi{" "}
							<code>COMPLETE</code>, <code>ARCHIVED</code>,{" "}
							<code>UNDERWAY</code>.
						</Alert>
					</Stack>
				</Grid>
			</Grid>
		</Box>
	);
}
