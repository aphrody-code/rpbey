import { AnimeSeriesDetailResponseSchema } from "@rpbey/api-contract";
import { jsonErr, jsonOk } from "@/server/api/handler";
import { getSeriesBySlug } from "@/server/dal/anime";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(_request: Request, ctx: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await ctx.params;
    const series = await getSeriesBySlug(slug);
    return jsonOk(AnimeSeriesDetailResponseSchema.parse({ series: series ?? null }));
  } catch (e) {
    console.error("[api/v1/anime/[slug]]", e);
    return jsonErr({ code: "internal", message: "internal error" }, 500);
  }
}
