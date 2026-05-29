import Box from "@mui/material/Box";
import Container from "@mui/material/Container";
import Typography from "@mui/material/Typography";
import { connection } from "next/server";
import { getBeyTubeFeatured } from "@/lib/beytube";
import { db, schema, desc, eq } from "@/lib/db";
import { createPageMetadata } from "@/lib/seo-utils";
import { getTikTokVideos } from "@/lib/tiktok";
import { getRPBClips, getRPBStreamInfo } from "@/lib/twitch";
import { TvFeed } from "./_components/TvFeed";

export const metadata = createPageMetadata({
  title: "RPB TV | Clips & Rediffusions",
  description: "Le meilleur du Beyblade X : Clips Twitch, rediffusions et selection BeyTube FR.",
  path: "/tv",
});

export default async function TVPage() {
  await connection();
  const domain = process.env.NEXT_PUBLIC_DOMAIN || "rpbey.fr";

  const safeFetch = async <T,>(promise: Promise<T>, fallback: T): Promise<T> => {
    try {
      return await promise;
    } catch {
      return fallback;
    }
  };

  // Stream info (for "En direct" section)
  const streamPromise = safeFetch(getRPBStreamInfo(), null);

  // Clips
  const clipsPromise = safeFetch(getRPBClips(20), []);

  // Rediffusions — vidéos YouTube RPB depuis la DB (avec vrais logos)
  const rpbVideosPromise = db.query.youtubeVideos
    .findMany({
      where: eq(schema.youtubeVideos.channelId, "UCHiDwWI-2uQrsUiJhXt6rng"),
      orderBy: desc(schema.youtubeVideos.publishedAt),
      limit: 20,
    })
    .then((vids) =>
      vids.map((v) => ({
        id: v.id,
        title: v.title,
        url: v.url,
        thumbnailUrl: v.thumbnail,
        duration: v.duration,
        publishedAt: new Date(v.publishedAt),
        viewCount: v.views,
        channelName: v.channelName,
        channelAvatar: v.channelAvatar,
      })),
    )
    .catch(() => []);

  // BeyTube community videos
  const beyTubeVideosPromise = safeFetch(getBeyTubeFeatured(), []);

  // TikTok
  const tikTokVideosPromise = (async () => {
    const [rpbTikTok, skarnTikTok, sunTikTok] = await Promise.all([
      safeFetch(getTikTokVideos("rpbeyblade1"), []),
      safeFetch(getTikTokVideos("skarngamemaster"), []),
      safeFetch(getTikTokVideos("sunafterthereign"), []),
    ]);
    return [...rpbTikTok, ...skarnTikTok, ...sunTikTok]
      .sort((a, b) => b.createTime - a.createTime)
      .slice(0, 20);
  })();

  return (
    <Box
      sx={{
        minHeight: "100vh",
        bgcolor: "background.default",
        pb: 4,
      }}
    >
      <Container maxWidth="xl" sx={{ px: { xs: 1.5, sm: 3 } }}>
        {/* Header */}
        <Box sx={{ pt: { xs: 2, md: 4 }, pb: { xs: 1.5, md: 3 } }}>
          <Typography
            variant="h3"
            component="h1"
            sx={{
              fontWeight: 900,
              fontSize: { xs: "1.5rem", md: "2.2rem" },
              letterSpacing: "-0.03em",
              background: "linear-gradient(135deg, var(--rpb-primary), var(--rpb-secondary))",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            RPB TV
          </Typography>
          <Typography
            sx={{
              color: "text.secondary",
              opacity: 0.7,
              fontSize: { xs: "0.82rem", md: "0.92rem" },
              mt: 0.3,
            }}
          >
            Clips, rediffusions et BeyTube FR
          </Typography>
        </Box>

        {/* Feed: Live, Clips, Rediffusions, BeyTube, TikTok */}
        <TvFeed
          streamPromise={streamPromise}
          clipsPromise={clipsPromise}
          rpbVideosPromise={rpbVideosPromise}
          beyTubeVideosPromise={beyTubeVideosPromise}
          tikTokVideosPromise={tikTokVideosPromise}
          domain={domain}
        />
      </Container>
    </Box>
  );
}
