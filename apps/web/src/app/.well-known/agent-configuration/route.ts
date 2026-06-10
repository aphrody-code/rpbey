import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

/**
 * Document de découverte Agent Auth Protocol (§3.1). Les agents IA le lisent à
 * `/.well-known/agent-configuration` pour découvrir le provider RPB, ses modes,
 * ses méthodes d'approbation et l'URL d'exécution des capabilities.
 * Cf. plugin `agentAuth` dans `@/lib/auth`.
 */
export async function GET() {
  try {
    // `getAgentConfiguration` n'existe que si le plugin agentAuth est monté.
    const api = auth.api as unknown as {
      getAgentConfiguration?: () => Promise<unknown>;
    };
    if (typeof api.getAgentConfiguration !== "function") {
      return NextResponse.json({ error: "Agent Auth not enabled" }, { status: 404 });
    }
    const configuration = await api.getAgentConfiguration();
    return NextResponse.json(configuration);
  } catch (error) {
    console.error("agent-configuration error:", error);
    return NextResponse.json({ error: "Failed to build agent configuration" }, { status: 500 });
  }
}
