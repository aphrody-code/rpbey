import { logger } from "../../lib/logger.js";
import { resolveRootPath } from "../../lib/paths.js";

// apps/web/scripts/refresh-search-corpus.ts : DEL de rpbey:search:corpus:v1 dans Redis.
// Le prochain hit /api/v1/search reconstruit le corpus depuis les sources fraîches.
const SCRIPT = "apps/web/scripts/refresh-search-corpus.ts";
const TIMEOUT_MS = 30_000; // opération Redis seule : 30s largement suffisant

/**
 * Invalide le corpus de recherche consolidé (rpbey:search:corpus:v1) toutes les 6h.
 * Le prochain appel à /api/v1/search refera le rebuild depuis les tables fraîches.
 *
 * Graceful : si Redis est injoignable, le script sort avec code 1. On log warn.
 */
export async function refreshSearchCorpusTask(): Promise<void> {
  const cwd = resolveRootPath();
  logger.info(`[RefreshSearchCorpus] Lancement : bun ${SCRIPT} (cwd=${cwd})`);

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
        `[RefreshSearchCorpus] Script terminé avec code ${exitCode} — Redis injoignable ? stderr: ${stderr.slice(0, 300)}`,
      );
      return;
    }

    const stdout = await new Response(proc.stdout).text().catch(() => "");
    logger.info(`[RefreshSearchCorpus] OK — ${stdout.trim()}`);
  } catch (err) {
    if (timer) clearTimeout(timer);
    if (timedOut) {
      logger.warn(`[RefreshSearchCorpus] Timeout — tâche annulée après ${TIMEOUT_MS / 1000}s`);
    } else {
      logger.error("[RefreshSearchCorpus] Erreur inattendue :", err);
    }
  }
}
