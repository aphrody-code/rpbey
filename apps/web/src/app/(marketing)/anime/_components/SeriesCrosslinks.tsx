import { SportsEsports, Toys } from "@mui/icons-material";
import { Box, Chip, Container, Stack, Typography } from "@mui/material";
import { getGenerationShowcase, type WikiIntel } from "@/server/services/entity-graph";

/**
 * Cross-links de la page anime `/anime/[slug]` — relie une série à l'univers de sa
 * génération via la connaissance wiki (`getGenerationShowcase`) : ses toupies
 * emblématiques, ses personnages, ses jeux vidéo. Server component, best-effort
 * (rend `null` si la génération est inconnue ou la connaissance absente). Ne touche
 * pas à `SeriesDetail` (composant existant) — section additionnelle sous la fiche.
 */

function CardGrid({ items, kind }: { items: WikiIntel[]; kind: "bey" | "character" }) {
  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: {
          xs: "repeat(2, 1fr)",
          sm: "repeat(3, 1fr)",
          md: kind === "bey" ? "repeat(6, 1fr)" : "repeat(6, 1fr)",
        },
        gap: 1.5,
      }}
    >
      {items.map((it) => (
        <Box
          key={it.url}
          component="a"
          href={it.url}
          target="_blank"
          rel="noopener noreferrer"
          sx={{
            p: 1.25,
            borderRadius: 3,
            border: "1px solid",
            borderColor: "divider",
            bgcolor: "var(--mui-palette-surface-high, rgba(255,255,255,0.02))",
            textDecoration: "none",
            color: "inherit",
            display: "flex",
            flexDirection: "column",
            gap: 0.75,
            transition: "all 0.25s cubic-bezier(0.16,1,0.3,1)",
            "&:hover": {
              transform: "translateY(-4px)",
              borderColor: "var(--rpb-primary)",
              boxShadow: "0 8px 24px -8px color-mix(in srgb, var(--rpb-primary) 25%, transparent)",
            },
          }}
        >
          <Box
            sx={{
              aspectRatio: "1",
              borderRadius: 2,
              bgcolor: "rgba(0,0,0,0.25)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              overflow: "hidden",
              p: kind === "bey" ? 0.5 : 0,
            }}
          >
            {it.imageUrl ? (
              <Box
                component="img"
                src={it.imageUrl}
                alt={it.title}
                loading="lazy"
                sx={{
                  width: "100%",
                  height: "100%",
                  objectFit: kind === "bey" ? "contain" : "cover",
                }}
              />
            ) : (
              <Typography sx={{ fontSize: "1.5rem", opacity: 0.3 }}>
                {kind === "bey" ? "🌀" : "👤"}
              </Typography>
            )}
          </Box>
          <Typography
            sx={{
              fontWeight: 700,
              fontSize: "0.72rem",
              lineHeight: 1.2,
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {it.title}
          </Typography>
          {(it.beyType || it.jpName) && (
            <Typography noWrap sx={{ fontSize: "0.62rem", color: "text.secondary", mt: "auto" }}>
              {it.beyType ?? it.jpName}
            </Typography>
          )}
        </Box>
      ))}
    </Box>
  );
}

export default async function SeriesCrosslinks({ generation }: { generation: string }) {
  const showcase = await getGenerationShowcase(generation, { beys: 12, characters: 12, games: 6 });
  const total = showcase.beys.length + showcase.characters.length + showcase.games.length;
  if (total === 0) return null;

  return (
    <Container maxWidth="lg" sx={{ py: { xs: 3, md: 5 } }}>
      <Typography
        component="h2"
        sx={{
          fontWeight: 900,
          fontSize: { xs: "1.3rem", md: "1.7rem" },
          mb: 0.5,
          letterSpacing: "-0.02em",
        }}
      >
        L'univers de cette génération
      </Typography>
      <Typography sx={{ color: "text.secondary", fontSize: "0.9rem", mb: 3 }}>
        Toupies, bladers et jeux liés — issus du Beyblade Wiki.
      </Typography>

      {showcase.beys.length > 0 && (
        <Box sx={{ mb: 4 }}>
          <Stack direction="row" sx={{ alignItems: "center", gap: 1, mb: 1.5 }}>
            <Toys sx={{ fontSize: 20, color: "var(--rpb-primary)" }} />
            <Typography sx={{ fontWeight: 800, fontSize: "1rem" }}>Toupies</Typography>
            <Chip
              size="small"
              label={showcase.beys.length}
              sx={{ height: 18, fontSize: "0.62rem", fontWeight: 800 }}
            />
          </Stack>
          <CardGrid items={showcase.beys} kind="bey" />
        </Box>
      )}

      {showcase.characters.length > 0 && (
        <Box sx={{ mb: 4 }}>
          <Stack direction="row" sx={{ alignItems: "center", gap: 1, mb: 1.5 }}>
            <Typography sx={{ fontWeight: 800, fontSize: "1rem" }}>Personnages</Typography>
            <Chip
              size="small"
              label={showcase.characters.length}
              sx={{ height: 18, fontSize: "0.62rem", fontWeight: 800 }}
            />
          </Stack>
          <CardGrid items={showcase.characters} kind="character" />
        </Box>
      )}

      {showcase.games.length > 0 && (
        <Box>
          <Stack direction="row" sx={{ alignItems: "center", gap: 1, mb: 1.5 }}>
            <SportsEsports sx={{ fontSize: 20, color: "var(--rpb-secondary)" }} />
            <Typography sx={{ fontWeight: 800, fontSize: "1rem" }}>Jeux vidéo</Typography>
          </Stack>
          <Stack spacing={1}>
            {showcase.games.map((g) => (
              <Box
                key={g.url}
                component="a"
                href={g.url}
                target="_blank"
                rel="noopener noreferrer"
                sx={{
                  p: 1.5,
                  borderRadius: 3,
                  border: "1px solid",
                  borderColor: "divider",
                  bgcolor: "var(--mui-palette-surface-high, rgba(255,255,255,0.02))",
                  textDecoration: "none",
                  color: "inherit",
                  display: "block",
                  transition: "all 0.2s",
                  "&:hover": { borderColor: "var(--rpb-secondary)" },
                }}
              >
                <Typography sx={{ fontWeight: 800, fontSize: "0.9rem" }}>{g.title}</Typography>
                {g.summary && (
                  <Typography
                    sx={{
                      color: "text.secondary",
                      fontSize: "0.78rem",
                      mt: 0.25,
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                    }}
                  >
                    {g.summary}
                  </Typography>
                )}
              </Box>
            ))}
          </Stack>
        </Box>
      )}
    </Container>
  );
}
