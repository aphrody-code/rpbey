import { type Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Container from "@mui/material/Container";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { getAnimeFrames, getSeriesDetail } from "@/server/services/anime";

interface Props {
	params: Promise<{ slug: string }>;
	searchParams: Promise<{
		episode?: string;
		character?: string;
		notable?: string;
	}>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
	const { slug } = await params;
	const series = await getSeriesDetail(slug);
	if (!series) return { title: "Galerie introuvable | RPB" };
	const name = series.titleFr || series.title;
	return {
		title: `Galerie d'images — ${name} | Anime RPB`,
		description: `Captures haute qualité de ${name} : recherche par personnage et épisode.`,
	};
}

/**
 * Galerie de frames d'anime façon « Google Images » (captures fancaps
 * re-hébergées en PNG lossless sur le CDN). RSC pur — vignettes lazy, liens vers
 * le PNG plein format. Filtres via query : `?episode=`, `?character=`, `?notable=true`.
 */
export default async function GaleriePage({ params, searchParams }: Props) {
	const { slug } = await params;
	const { episode, character, notable } = await searchParams;
	const series = await getSeriesDetail(slug);
	if (!series) notFound();

	const { frames, total } = await getAnimeFrames({
		series: slug,
		episode: episode ? Number(episode) : undefined,
		character,
		notable: notable === "true",
		limit: 100,
	});

	// Personnages les plus présents (facette de filtre rapide).
	const charCounts = new Map<string, number>();
	for (const f of frames)
		for (const c of f.characterNames)
			charCounts.set(c, (charCounts.get(c) ?? 0) + 1);
	const topChars = [...charCounts.entries()]
		.sort((a, b) => b[1] - a[1])
		.slice(0, 16);

	const name = series.titleFr || series.title;
	const baseHref = `/anime/${slug}/galerie`;

	return (
		<Container maxWidth="xl" sx={{ py: 4 }}>
			<Stack spacing={0.5} sx={{ mb: 3 }}>
				<Typography variant="h4" sx={{ fontWeight: 800 }}>
					Galerie — {name}
				</Typography>
				<Typography variant="body2" color="text.secondary">
					{total.toLocaleString("fr-FR")} captures
					{episode ? ` · épisode ${episode}` : ""}
					{character ? ` · ${character}` : ""}
				</Typography>
			</Stack>

			{topChars.length > 0 && (
				<Stack
					direction="row"
					useFlexGap
					spacing={1}
					sx={{ flexWrap: "wrap", mb: 3 }}
				>
					<Chip
						component={Link}
						href={baseHref}
						label="Tout"
						clickable
						color={character ? "default" : "primary"}
						size="small"
					/>
					{topChars.map(([c, n]) => (
						<Chip
							key={c}
							component={Link}
							href={`${baseHref}?character=${encodeURIComponent(c)}`}
							label={`${c} (${n})`}
							clickable
							color={character === c ? "primary" : "default"}
							size="small"
						/>
					))}
				</Stack>
			)}

			{frames.length === 0 ? (
				<Typography color="text.secondary">
					Aucune capture pour ce filtre.
				</Typography>
			) : (
				<Box
					sx={{
						display: "grid",
						gap: 1,
						gridTemplateColumns: {
							xs: "repeat(2, 1fr)",
							sm: "repeat(3, 1fr)",
							md: "repeat(4, 1fr)",
							lg: "repeat(5, 1fr)",
						},
					}}
				>
					{frames.map((f) => (
						<Box
							key={f.id}
							component="a"
							href={f.imageUrl}
							target="_blank"
							rel="noreferrer"
							title={
								f.characterNames.join(", ") ||
								`Épisode ${f.episodeNumber ?? "?"}`
							}
							sx={{
								position: "relative",
								aspectRatio: "16 / 9",
								overflow: "hidden",
								borderRadius: 1,
								bgcolor: "action.hover",
								display: "block",
								transition: "transform .15s",
								"&:hover": { transform: "scale(1.03)", zIndex: 1 },
							}}
						>
							{/* eslint-disable-next-line @next/next/no-img-element — galerie CDN, pas d'optimisation Next requise */}
							<img
								src={f.thumbUrl ?? f.imageUrl}
								alt={
									f.characterNames.join(", ") ||
									`Frame épisode ${f.episodeNumber ?? "?"}`
								}
								loading="lazy"
								decoding="async"
								style={{
									width: "100%",
									height: "100%",
									objectFit: "cover",
									display: "block",
								}}
							/>
							{f.episodeNumber != null && (
								<Box
									sx={{
										position: "absolute",
										bottom: 4,
										left: 4,
										px: 0.75,
										py: 0.25,
										borderRadius: 0.5,
										fontSize: 11,
										fontWeight: 700,
										color: "#fff",
										bgcolor: "rgba(0,0,0,0.6)",
									}}
								>
									Ép. {f.episodeNumber}
								</Box>
							)}
						</Box>
					))}
				</Box>
			)}
		</Container>
	);
}
