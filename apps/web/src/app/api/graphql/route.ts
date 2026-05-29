import { createYoga } from "graphql-yoga";
import { schema } from "./schema";

const yoga = createYoga({
  schema,
  graphqlEndpoint: "/api/graphql",
  fetchAPI: { Response },
  landingPage: true,
});

const handler = yoga as unknown as (request: Request) => Promise<Response>;

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const GET = handler;
export const POST = handler;
