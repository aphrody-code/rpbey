import { AutoAwesome, SportsEsports, Toys } from "@mui/icons-material";
import { Box, Chip, Container, Stack, Typography } from "@mui/material";
import { getGenerationShowcase, type WikiIntel } from "@/server/services/entity-graph";

// Langage visuel « intelligence RAG » partagé avec ProductIntel (cohérence) :
// carte surface-container + bordure outline-variant + ressort M3 au survol.
const SPRING = "cubic-bezier(0.34, 1.4, 0.64, 1)";
const CARD_SX = {
  borderRadius: 3,
  border: "1px solid",
  borderColor: "var(--md-sys-color-outline-variant, rgba(255,255,255,0.08))",
  bgcolor: "var(--md-sys-color-surface-container, rgba(255,255,255,0.02))",
} as const;

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
            ...CARD_SX,
            p: 1.25,
            textDecoration: "none",
            color: "inherit",
            display: "flex",
            flexDirection: "column",
            gap: 0.75,
            transition: `transform 0.3s ${SPRING}, border-color 0.25s, box-shadow 0.25s`,
            "&:hover": {
              transform: "translateY(-5px)",
              borderColor: "var(--rpb-primary)",
              boxShadow:
                "0 10px 28px -10px color-mix(in srgb, var(--rpb-primary) 30%, transparent)",
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
      <Stack direction="row" sx={{ alignItems: "center", gap: 1.25, mb: 0.5 }}>
        <Box
          sx={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 38,
            height: 38,
            borderRadius: 2.5,
            flexShrink: 0,
            color: "var(--rpb-secondary)",
            bgcolor: "color-mix(in srgb, var(--rpb-secondary) 16%, transparent)",
          }}
        >
          <AutoAwesome sx={{ fontSize: 22 }} />
        </Box>
        <Typography
          component="h2"
          sx={{
            fontWeight: 900,
            fontSize: { xs: "1.3rem", md: "1.7rem" },
            letterSpacing: "-0.02em",
          }}
        >
          L'univers de cette génération
        </Typography>
      </Stack>
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
                  ...CARD_SX,
                  p: 1.5,
                  textDecoration: "none",
                  color: "inherit",
                  display: "block",
                  transition: `transform 0.3s ${SPRING}, border-color 0.2s`,
                  "&:hover": {
                    transform: "translateY(-3px)",
                    borderColor: "var(--rpb-secondary)",
                  },
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
