import { type Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "@/components/ui/NextLink";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Container from "@mui/material/Container";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { getAnimeFrames, getSeriesDetail } from "@/server/services/anime";
import { GalerieClient } from "./_components/GalerieClient";

export const dynamic = "force-dynamic";

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
 * re-hébergées en PNG lossless sur le CDN). RSC pur — filtres via query :
 * `?episode=`, `?character=`, `?notable=true`.
 * Grille + lightbox déléguées à GalerieClient (client component).
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
    for (const c of f.characterNames) charCounts.set(c, (charCounts.get(c) ?? 0) + 1);
  const topChars = [...charCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 16);

  // Épisodes présents (pour filtre épisode).
  const episodesPresents = [
    ...new Set(frames.map((f) => f.episodeNumber).filter((n): n is number => n !== null)),
  ].sort((a, b) => a - b);

  const name = series.titleFr || series.title;
  const baseHref = `/anime/${slug}/galerie`;

  return (
    <Box
      sx={{
        minHeight: "100vh",
        bgcolor: "var(--rpb-bg)",
        pb: { xs: 6, md: 10 },
      }}
    >
      <Container maxWidth="xl" sx={{ pt: { xs: 3, md: 5 } }}>
        {/* En-tête */}
        <Stack spacing={0.5} sx={{ mb: 3 }}>
          {/* Fil d'Ariane */}
          <Stack direction="row" spacing={0.5} sx={{ alignItems: "center", mb: 0.5 }}>
            <Typography
              component={Link}
              href="/anime"
              variant="caption"
              sx={{
                color: "text.disabled",
                textDecoration: "none",
                "&:hover": { color: "text.secondary" },
              }}
            >
              Anime
            </Typography>
            <Typography variant="caption" sx={{ color: "text.disabled" }}>
              /
            </Typography>
            <Typography
              component={Link}
              href={`/anime/${slug}`}
              variant="caption"
              sx={{
                color: "text.disabled",
                textDecoration: "none",
                "&:hover": { color: "text.secondary" },
              }}
            >
              {name}
            </Typography>
            <Typography variant="caption" sx={{ color: "text.disabled" }}>
              /
            </Typography>
            <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 600 }}>
              Galerie
            </Typography>
          </Stack>

          <Typography
            variant="h4"
            sx={{
              fontWeight: 800,
              display: "flex",
              alignItems: "center",
              gap: 1.5,
              "&::before": {
                content: '""',
                width: 4,
                height: 32,
                borderRadius: 1,
                bgcolor: "var(--rpb-primary)",
                display: "inline-block",
                boxShadow: "0 0 12px color-mix(in srgb, var(--rpb-primary) 60%, transparent)",
              },
            }}
          >
            Galerie — {name}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {total.toLocaleString("fr-FR")} captures
            {episode ? ` · épisode ${episode}` : ""}
            {character ? ` · ${character}` : ""}
          </Typography>
        </Stack>

        {/* Filtres personnages */}
        {topChars.length > 0 && (
          <Stack direction="row" useFlexGap spacing={1} sx={{ flexWrap: "wrap", mb: 2 }}>
            <Chip
              component={Link}
              href={episode ? `${baseHref}?episode=${episode}` : baseHref}
              label="Tous"
              clickable
              size="small"
              color={character ? "default" : "primary"}
            />
            {topChars.map(([c, n]) => (
              <Chip
                key={c}
                component={Link}
                href={
                  episode
                    ? `${baseHref}?episode=${episode}&character=${encodeURIComponent(c)}`
                    : `${baseHref}?character=${encodeURIComponent(c)}`
                }
                label={`${c} (${n})`}
                clickable
                size="small"
                color={character === c ? "primary" : "default"}
              />
            ))}
          </Stack>
        )}

        {/* Filtres épisodes */}
        {episodesPresents.length > 1 && (
          <Stack
            direction="row"
            useFlexGap
            spacing={0.75}
            sx={{
              flexWrap: "wrap",
              mb: 3,
              pb: 2,
              borderBottom: "1px solid",
              borderColor: "divider",
            }}
          >
            <Typography
              variant="caption"
              sx={{
                color: "text.disabled",
                alignSelf: "center",
                mr: 0.5,
                fontWeight: 600,
              }}
            >
              Épisode :
            </Typography>
            <Chip
              component={Link}
              href={character ? `${baseHref}?character=${encodeURIComponent(character)}` : baseHref}
              label="Tous"
              clickable
              size="small"
              variant={episode ? "outlined" : "filled"}
              color={episode ? "default" : "primary"}
            />
            {episodesPresents.map((ep) => (
              <Chip
                key={ep}
                component={Link}
                href={
                  character
                    ? `${baseHref}?episode=${ep}&character=${encodeURIComponent(character)}`
                    : `${baseHref}?episode=${ep}`
                }
                label={`Ép. ${ep}`}
                clickable
                size="small"
                variant={episode === String(ep) ? "filled" : "outlined"}
                color={episode === String(ep) ? "primary" : "default"}
              />
            ))}
          </Stack>
        )}

        {frames.length === 0 ? (
          <Box
            sx={{
              textAlign: "center",
              py: 12,
              color: "text.disabled",
            }}
          >
            <Typography variant="h6" sx={{ mb: 1, fontWeight: 600 }}>
              Aucune capture
            </Typography>
            <Typography variant="body2">
              Essayez de retirer les filtres pour voir toutes les images.
            </Typography>
          </Box>
        ) : (
          <GalerieClient frames={frames} />
        )}
      </Container>
    </Box>
  );
}
