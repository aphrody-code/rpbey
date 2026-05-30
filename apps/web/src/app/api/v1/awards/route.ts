import { AwardsEditionsResponseSchema } from "@rpbey/api-contract";
import { getRoute } from "@/server/api/handler";
import { listPublishedEditions } from "@/server/dal/polls";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const GET = getRoute({
  response: AwardsEditionsResponseSchema,
  async handle() {
    return { editions: await listPublishedEditions() };
  },
});
