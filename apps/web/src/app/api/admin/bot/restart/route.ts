import { spawn } from "node:child_process";
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-utils";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const SERVICE = "rpb-bot.service";

/**
 * Redémarre le service systemd du bot Discord.
 *
 * Le service web (`rpbey-web.service`) tourne en tant que `ubuntu`, qui dispose
 * d'un sudo NOPASSWD sur l'hôte — on peut donc piloter le service du bot via
 * `sudo systemctl restart`. Réservé aux admins (better-auth + rôle).
 */
export async function POST() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await runSystemctl("restart", SERVICE);
  if (result.code !== 0) {
    return NextResponse.json(
      {
        success: false,
        message: result.stderr || `systemctl restart a échoué (code ${result.code})`,
      },
      { status: 500 },
    );
  }

  return NextResponse.json({
    success: true,
    message: `Redémarrage de ${SERVICE} demandé.`,
  });
}

function runSystemctl(
  action: string,
  service: string,
): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const child = spawn("sudo", ["-n", "systemctl", action, service], {
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d: Buffer) => {
      stdout += d.toString();
    });
    child.stderr.on("data", (d: Buffer) => {
      stderr += d.toString();
    });
    child.on("error", (err) => {
      resolve({ code: 1, stdout, stderr: err.message });
    });
    child.on("close", (code) => {
      resolve({ code: code ?? 1, stdout, stderr });
    });
  });
}
