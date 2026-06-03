import { homedir } from "node:os";
import { join } from "node:path";

import { logger } from "../../lib/logger.js";
import { resolveRootPath } from "../../lib/paths.js";

// Script web qui agrège les signaux communautaires X/Reddit/Web pour enrichir
// le métagame Beyblade X. Écrit apps/web/data/meta-enrichment.json.
const SCRIPT = "apps/web/scripts/enrich-meta.ts";

// Env aphrody à sourcer : contient les tokens X, Gemini, cookies Reddit.
// Ce chemin est hors-repo (/home/ubuntu/aphrody/.env) — si absent, skip gracieux.
const home = process.env.HOME || homedir();
const APHRODY_ENV_PATH = process.env.APHRODY_ENV_PATH ?? join(home, "aphrody/.env");

// Budget temps généreux : ~60 blades × 4s de délai inter-blade + overhead réseau.
const TIMEOUT_MS = 300_000; // 5 min

/**
 * Parse un fichier .env ligne par ligne (KEY=VALUE, # commentaires ignorés).
 * Ne lève jamais — retourne {} si le fichier est absent ou illisible.
 * Note : les valeurs entre guillemets simples/doubles sont dé-quotées.
 */
async function loadAphrodyEnv(): Promise<Record<string, string>> {
  try {
    const text = await Bun.file(APHRODY_ENV_PATH).text();
    const env: Record<string, string> = {};
    for (const line of text.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq < 1) continue;
      const key = trimmed.slice(0, eq).trim();
      let val = trimmed.slice(eq + 1).trim();
      // Retirer les guillemets englobants (simples ou doubles)
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (key) env[key] = val;
    }
    return env;
  } catch {
    return {};
  }
}

/**
 * Enrichit les données métagame depuis X, Reddit et Web (lun/mer/ven 18h CEST).
 * Dépend de /home/ubuntu/aphrody (hors-repo) pour les credentials X/Gemini.
 * Graceful : si aphrody est absent ou si les sources externes sont indisponibles,
 * le script tourne avec des scores à 0 (coverage manqué) sans crasher le bot.
 */
export async function syncMetaEnrichmentTask(): Promise<void> {
  const cwd = resolveRootPath();
  logger.info(`[SyncMetaEnrichment] Lancement : bun ${SCRIPT} (cwd=${cwd})`);

  // Vérifier que le script cible existe avant de spawner
  const scriptPath = `${cwd}/${SCRIPT}`;
  try {
    if (!(await Bun.file(scriptPath).exists())) {
      logger.warn(`[SyncMetaEnrichment] Script introuvable : ${scriptPath} — tâche ignorée`);
      return;
    }
  } catch {
    logger.warn(`[SyncMetaEnrichment] Impossible de vérifier ${scriptPath} — tâche ignorée`);
    return;
  }

  // Charger l'env aphrody (credentials X, Gemini, etc.)
  const aphrodyEnv = await loadAphrodyEnv();
  if (Object.keys(aphrodyEnv).length === 0) {
    logger.warn(
      `[SyncMetaEnrichment] ${APHRODY_ENV_PATH} absent ou vide — la source X sera skippée (xAuthOk=false)`,
    );
    // On continue quand même : le script tolère l'absence de credentials X
    // (met xMentions/xEngagement à 0, fait quand même Reddit + Web).
  }

  // Fusionner l'env aphrody par-dessus process.env (process.env a priorité
  // si une clé existe déjà — les overrides aphrody sont spécifiques à ce script).
  const mergedEnv: Record<string, string> = {
    ...aphrodyEnv,
    ...process.env,
  } as Record<string, string>;

  let proc: Bun.ReadableSubprocess | null = null;
  let timedOut = false;
  let timer: Timer | null = null;

  try {
    proc = Bun.spawn(["bun", SCRIPT], {
      cwd,
      stdout: "pipe",
      stderr: "pipe",
      env: mergedEnv,
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
        `[SyncMetaEnrichment] Script terminé avec code ${exitCode}. stderr: ${stderr.slice(0, 400)}`,
      );
      return;
    }

    const stdout = await new Response(proc.stdout).text().catch(() => "");
    // Extraire les 3 dernières lignes du rapport (coverage + top 5)
    const summary = stdout.trim().split("\n").slice(-4).join(" | ");
    logger.info(`[SyncMetaEnrichment] OK — ${summary}`);
  } catch (err) {
    if (timer) clearTimeout(timer);
    if (timedOut) {
      logger.warn(
        `[SyncMetaEnrichment] Timeout — tâche annulée après ${TIMEOUT_MS / 1000}s. Certaines blades ont peut-être été traitées.`,
      );
    } else {
      logger.error("[SyncMetaEnrichment] Erreur inattendue :", err);
    }
  }
}
