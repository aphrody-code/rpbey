import { listRoutes, okEnvelope, ErrorEnvelopeSchema } from "@rpbey/api-contract";

const BASE_URL = process.env.API_BASE || "http://localhost:3000";

const PATH_OVERRIDES: Record<string, string> = {
  id: "bts4",
  slug: "the-stardust-series-1",
  category: "blade",
};

async function testRoute(route: any) {
  let path = route.path;
  if (route.pathParams) {
    for (const param of route.pathParams) {
      const val = PATH_OVERRIDES[param];
      if (!val) {
        throw new Error(`Missing path param override for '${param}' in route ${route.path}`);
      }
      path = path.replace(`{${param}}`, val);
    }
  }

  const url = `${BASE_URL}/api/v1${path}`;
  console.log(`Testing ${route.method.toUpperCase()} ${url}...`);

  let res: Response;
  const init: RequestInit = {
    method: route.method.toUpperCase(),
    headers: {
      "Content-Type": "application/json",
    },
  };

  if (route.method === "post" && route.body) {
    // Construct dummy body for analytics
    if (path === "/analytics") {
      init.body = JSON.stringify({
        event: "pageview",
        url: "https://rpbey.fr/test-smoke",
        referrer: "",
        userId: null,
      });
    } else {
      // General fallback for post routes
      init.body = JSON.stringify({});
    }
  }

  try {
    res = await fetch(url, init);
  } catch (err) {
    console.error(`❌ Network error on ${url}:`, err);
    return false;
  }

  let json: any;
  try {
    json = await res.json();
  } catch (err) {
    console.error(`❌ JSON parse error on ${url} (status ${res.status}):`, err);
    return false;
  }

  // Validate response shape:
  // 1. Success envelope (ok: true)
  const successSchema = okEnvelope(route.response);
  const successParse = successSchema.safeParse(json);
  if (successParse.success) {
    console.log(`✅ ${route.operationId}: Success envelope matches contract`);
    return true;
  }

  // 2. Error envelope (ok: false)
  const errorParse = ErrorEnvelopeSchema.safeParse(json);
  if (errorParse.success) {
    console.log(
      `⚠️ ${route.operationId}: Error envelope matches contract (Error: ${json.error?.message})`,
    );
    return true;
  }

  console.error(`❌ ${route.operationId}: Response does not match success or error contract!`);
  console.error("Received payload:", JSON.stringify(json, null, 2));
  console.error("Success validation errors:", successParse.error?.format());
  console.error("Error validation errors:", errorParse.error?.format());
  return false;
}

async function main() {
  const routes = listRoutes();
  console.log(`Loaded ${routes.length} routes from contract.`);

  let passed = 0;
  let failed = 0;

  for (const route of routes) {
    const success = await testRoute(route);
    if (success) {
      passed++;
    } else {
      failed++;
    }
  }

  console.log(`\n--- Smoke Test Results ---`);
  console.log(`Passed: ${passed}/${routes.length}`);
  if (failed > 0) {
    console.log(`Failed: ${failed}/${routes.length}`);
    process.exit(1);
  }
  console.log("All routes matched contracts!");
  process.exit(0);
}

main().catch((err) => {
  console.error("Unhandled error:", err);
  process.exit(1);
});
