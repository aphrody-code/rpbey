/** POST /api/tier-lists/[slug]/submit → enregistre le placement complet du votant. */
import { TierListSubmitInputSchema } from "@rpbey/api-contract";
import { getTierList, PollError, submitTierList } from "@/server/dal/polls";
import { resolveVoter } from "@/server/api/voter";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request, ctx: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await ctx.params;
    const raw = await request.json().catch(() => ({}));
    const parsed = TierListSubmitInputSchema.safeParse(raw);
    if (!parsed.success) {
      return Response.json(
        { ok: false, error: { code: "bad_request", message: "Placements invalides." } },
        { status: 422 },
      );
    }
    const voter = await resolveVoter();
    await submitTierList(slug, voter, parsed.data.placements);
    const result = await getTierList(slug, voter);
    return Response.json({ ok: true, data: result });
  } catch (e) {
    if (e instanceof PollError) {
      const status = e.code === "not_found" ? 404 : 400;
      return Response.json({ ok: false, error: { code: e.code, message: e.message } }, { status });
    }
    console.error("[api/tier-lists/[slug]/submit]", e);
    return Response.json(
      { ok: false, error: { code: "internal", message: "Erreur interne" } },
      { status: 500 },
    );
  }
}
