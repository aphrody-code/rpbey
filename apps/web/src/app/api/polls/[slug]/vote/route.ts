/** POST /api/polls/[slug]/vote → enregistre le vote (compte ou anonyme cookie). */
import { PollVoteInputSchema } from "@rpbey/api-contract";
import { getPoll, PollError, votePoll } from "@/server/dal/polls";
import { resolveVoter } from "@/server/api/voter";

export async function POST(request: Request, ctx: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await ctx.params;
    const raw = await request.json().catch(() => ({}));
    const parsed = PollVoteInputSchema.safeParse(raw);
    if (!parsed.success) {
      return Response.json(
        { ok: false, error: { code: "bad_request", message: "Options invalides." } },
        { status: 422 },
      );
    }
    const voter = await resolveVoter();
    await votePoll(slug, voter, parsed.data.optionIds);
    const result = await getPoll(slug, voter);
    return Response.json({ ok: true, data: result });
  } catch (e) {
    if (e instanceof PollError) {
      const status = e.code === "not_found" ? 404 : e.code === "closed" ? 409 : 400;
      return Response.json({ ok: false, error: { code: e.code, message: e.message } }, { status });
    }
    console.error("[api/polls/[slug]/vote]", e);
    return Response.json(
      { ok: false, error: { code: "internal", message: "Erreur interne" } },
      { status: 500 },
    );
  }
}
