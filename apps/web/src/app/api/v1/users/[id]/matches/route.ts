import { UserMatchesQuerySchema, UserMatchesResponseSchema } from "@rpbey/api-contract";
import { z } from "zod";
import { jsonErr, jsonOk } from "@/server/api/handler";
import { getUserMatches } from "@/server/dal/users";

export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const url = new URL(request.url);
  const parsed = UserMatchesQuerySchema.safeParse(Object.fromEntries(url.searchParams.entries()));
  if (!parsed.success) {
    return jsonErr({ code: "bad_request", message: z.prettifyError(parsed.error) }, 422);
  }

  try {
    const { id } = await ctx.params;
    const result = await getUserMatches(id, {
      limit: parsed.data.limit,
      offset: parsed.data.offset,
    });
    return jsonOk(UserMatchesResponseSchema.parse(result));
  } catch (e) {
    console.error("[api/v1/users/[id]/matches]", e);
    return jsonErr({ code: "internal", message: "internal error" }, 500);
  }
}
