import { type Metadata } from "next";
import { FrameBackdrop } from "@/components/ui/FrameBackdrop";
import { createPageMetadata } from "@/lib/seo-utils";
import { getFeaturedSeries, getSeriesByGeneration } from "@/server/services/anime";
import { AnimeCarousel } from "./_components/AnimeCarousel";
import { AnimeLanding } from "./_components/AnimeLanding";

export const metadata: Metadata = createPageMetadata({
  title: "Anime Beyblade | RPB",
  description:
    "Regardez toutes les séries anime Beyblade : de l'Original à Beyblade X, en streaming gratuit sur la RPB.",
  path: "/anime",
});

export default async function AnimePage() {
  const [featured, seriesByGeneration] = await Promise.all([
    getFeaturedSeries(),
    getSeriesByGeneration(),
  ]);

  const generationOrder = ["ORIGINAL", "METAL", "BURST", "X"];

  return (
    <>
      <FrameBackdrop intensity={0.26} />
      <AnimeLanding featured={featured}>
        {generationOrder.map((gen) => {
          const series = seriesByGeneration[gen];
          if (!series || series.length === 0) return null;
          return <AnimeCarousel key={gen} generation={gen} series={series} />;
        })}
      </AnimeLanding>
    </>
  );
}
