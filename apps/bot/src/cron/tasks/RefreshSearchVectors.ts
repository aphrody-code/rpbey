import { logger } from "../../lib/logger.js";
import { resolveRootPath } from "../../lib/paths.js";

// Script absolu depuis la racine du monorepo.
// Le bot tourne depuis dist/ en prod — on utilise resolveRootPath() pour
// obtenir /home/ubuntu/rpbey, puis on passe le chemin relatif au script
// comme argument à `bun` (bun résout depuis cwd).
const SCRIPT = "apps/web/scripts/build-search-vectors.ts";
const TIMEOUT_MS = 120_000; // 2 min (le sidecar peut être lent au démarrage)

/**
 * Reconstruit l'index vectoriel Redis (rpbey:search:vec) à partir du corpus
 * consolidé. Appelle apps/web/scripts/build-search-vectors.ts depuis la racine.
 *
 * Graceful : si le sidecar embeddings (port 7077) ou Redis sont absents,
 * le script sort avec code 1 en logguant lui-même l'erreur. On log warn ici.
 */
export async function refreshSearchVectorsTask(): Promise<void> {
  const cwd = resolveRootPath();
  logger.info(`[RefreshSearchVectors] Lancement : bun ${SCRIPT} (cwd=${cwd})`);

  let proc: Bun.ReadableSubprocess | null = null;
  let timedOut = false;
  let timer: Timer | null = null;

  try {
    proc = Bun.spawn(["bun", SCRIPT], {
      cwd,
      stdout: "pipe",
      stderr: "pipe",
      env: { ...process.env },
    });

    const exitCode = await Promise.race([
      proc.exited,
      new Promise<number>((_, reject) => {
        timer = setTimeout(() => {
          timedOut = true;
          proc?.kill();
          reject(new Error(`timeout après ${TIMEOUT_MS / 1000}s`));
        }, TIMEOUT_MS);
      }),
    ]);

    if (timer) clearTimeout(timer);

    if (exitCode !== 0) {
      const stderr = await new Response(proc.stderr).text().catch(() => "");
      logger.warn(
        `[RefreshSearchVectors] Script terminé avec code ${exitCode} — sidecar ou Redis injoignable ? stderr: ${stderr.slice(0, 300)}`,
      );
      return;
    }

    const stdout = await new Response(proc.stdout).text().catch(() => "");
    const lastLine = stdout.trim().split("\n").pop() ?? "";
    logger.info(`[RefreshSearchVectors] OK — ${lastLine}`);
  } catch (err) {
    if (timer) clearTimeout(timer);
    if (timedOut) {
      logger.warn(`[RefreshSearchVectors] Timeout — tâche annulée après ${TIMEOUT_MS / 1000}s`);
    } else {
      logger.error("[RefreshSearchVectors] Erreur inattendue :", err);
    }
  }
}
