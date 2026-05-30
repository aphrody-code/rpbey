// data-doctor.ts — observabilité du pipeline de données rpbey (apps/web/data)
//
// Script Bun rejouable qui audite chaque source data du pipeline selon les
// 5 piliers d'observabilité (section E de docs/data-pipeline-best-practices.md) :
//   1. existence + taille fichier
//   2. fraîcheur (âge du timestamp de génération vs SLO par catégorie)
//   3. volume (nombre d'enregistrements vs baseline persistée)
//   4. schéma (% d'enregistrements ayant les champs clés non vides)
//   5. distribution (best-effort : prix, régions, domaines, sources, subreddits…)
//
// Sortie : rapport texte aligné OK/WARN/FAIL + résumé + exit code (0 si aucun FAIL).
// Les FAIL ne concernent que les sources critiques manquantes (bx-catalog, meta-enrichment).
// Les WARN n'échouent pas.
//
// Usage :
//   bun apps/web/scripts/data-doctor.ts                  # audit + rapport
//   bun apps/web/scripts/data-doctor.ts --update-baseline # réécrit la baseline des counts
//
// 100% Bun (Bun.file / Bun.write). Aucune dépendance npm. Ce script ne se commit pas.

import { resolve } from "node:path";

// Racine des données auditées (apps/web/data) — résolue relativement à ce script.
const DATA_DIR = resolve(import.meta.dir, "..", "data");
const BASELINE_PATH = resolve(DATA_DIR, "_doctor-baseline.json");

const UPDATE_BASELINE = process.argv.includes("--update-baseline");

// ---------------------------------------------------------------------------
// Types & contrat de définition de source
// ---------------------------------------------------------------------------

// Une vérification de champ clé : nom lisible + prédicat « non vide » sur un record.
type FieldCheck = {
  label: string;
  ok: (rec: Record<string, unknown>) => boolean;
};

type SourceDef = {
  // Identifiant stable (sert de clé de baseline) + nom de fichier.
  key: string;
  file: string;
  // Source critique → son absence/échec de lecture déclenche un FAIL global.
  critical: boolean;
  // Catégorie de fraîcheur → choisit le seuil SLO (jours).
  freshness: "catalogue" | "discussions" | "meta" | "default";
  // Détection du tableau principal : liste ordonnée de champs candidats.
  // Si aucun ne matche et que la racine est un Array, on prend la racine.
  arrayFields: string[];
  // Champs clés pour le sanity-check de schéma.
  schema: FieldCheck[];
  // Calcul de distribution best-effort (renvoie des lignes texte à afficher).
  distribution?: (records: Record<string, unknown>[]) => string[];
};

// Seuils de fraîcheur (jours) par catégorie.
const FRESHNESS_SLO_DAYS: Record<SourceDef["freshness"], number> = {
  catalogue: 14,
  discussions: 30,
  meta: 14,
  default: 30,
};

// Seuil d'anomalie de volume : chute > 30% vs baseline = WARN.
const VOLUME_DROP_THRESHOLD = 0.3;
// Seuil de conformité de schéma : < 90% de records valides = WARN.
const SCHEMA_MIN_RATIO = 0.9;

type Status = "OK" | "WARN" | "FAIL";

type SourceReport = {
  key: string;
  file: string;
  status: Status;
  notes: string[];
  distribution: string[];
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Vrai si une valeur est non vide (chaîne non blanche, nombre fini, bool, objet/array non vide).
function isNonEmpty(v: unknown): boolean {
  if (v === null || v === undefined) return false;
  if (typeof v === "string") return v.trim().length > 0;
  if (typeof v === "number") return Number.isFinite(v);
  if (typeof v === "boolean") return true;
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === "object") return Object.keys(v as object).length > 0;
  return true;
}

// Récupère le premier champ timestamp présent en tête d'objet (formats variés).
function readGeneratedAt(root: Record<string, unknown>): string | null {
  const candidates = ["generatedAt", "generated_at", "updatedAt", "scrapedAt", "timestamp"];
  for (const c of candidates) {
    const v = root[c];
    if (typeof v === "string" && v.trim().length > 0) return v;
  }
  return null;
}

// Âge en jours d'un timestamp ISO. NaN si invalide.
function ageInDays(iso: string): number {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return Number.NaN;
  return (Date.now() - t) / (1000 * 60 * 60 * 24);
}

// Détecte le tableau principal d'un fichier chargé.
// Retourne { records, fromRoot } ; records vide si introuvable.
function detectRecords(
  parsed: unknown,
  arrayFields: string[],
): { records: Record<string, unknown>[]; field: string | null } {
  if (Array.isArray(parsed)) {
    return { records: parsed as Record<string, unknown>[], field: "<root>" };
  }
  if (parsed && typeof parsed === "object") {
    const root = parsed as Record<string, unknown>;
    for (const f of arrayFields) {
      if (Array.isArray(root[f])) {
        return { records: root[f] as Record<string, unknown>[], field: f };
      }
    }
    // Fallback générique : premier champ tableau rencontré.
    for (const [k, v] of Object.entries(root)) {
      if (Array.isArray(v)) return { records: v as Record<string, unknown>[], field: k };
    }
    // Aucun tableau : certains fichiers stockent un objet-map (ex bbx-weekly.periods).
    // On signale 0 record-tableau mais on laisse l'appelant compter les clés si besoin.
  }
  return { records: [], field: null };
}

// Formate un octet-count en taille lisible.
function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

// Compte par clé (renvoyé trié décroissant) — pour les distributions catégorielles.
function countBy(
  records: Record<string, unknown>[],
  pick: (r: Record<string, unknown>) => string | undefined,
): Array<[string, number]> {
  const m = new Map<string, number>();
  for (const r of records) {
    const k = pick(r);
    if (!k) continue;
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
}

// Médiane d'une liste de nombres (renvoie 0 si vide).
function median(nums: number[]): number {
  if (nums.length === 0) return 0;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

// ---------------------------------------------------------------------------
// Distributions best-effort par source
// ---------------------------------------------------------------------------

function catalogDistribution(records: Record<string, unknown>[]): string[] {
  const lines: string[] = [];
  const prices = records
    .map((r) => r.price)
    .filter((p): p is number => typeof p === "number" && Number.isFinite(p));
  if (prices.length > 0) {
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    lines.push(
      `prix (n=${prices.length}) : min ${min.toFixed(2)} / med ${median(prices).toFixed(2)} / max ${max.toFixed(2)}`,
    );
  }
  const byRegion = countBy(records, (r) => (typeof r.region === "string" ? r.region : undefined));
  if (byRegion.length > 0) {
    lines.push("régions : " + byRegion.map(([k, n]) => `${k}=${n}`).join("  "));
  }
  const byDomain = countBy(records, (r) => (typeof r.domain === "string" ? r.domain : undefined));
  if (byDomain.length > 0) {
    const top = byDomain
      .slice(0, 5)
      .map(([k, n]) => `${k}=${n}`)
      .join("  ");
    lines.push(`domaines (${byDomain.length} uniques, top5) : ${top}`);
  }
  return lines;
}

function discussionsDistribution(records: Record<string, unknown>[]): string[] {
  const lines: string[] = [];
  // X.com : pas de `source` par item mais `topic` + `lang` ; Reddit : `subreddit`.
  const bySource = countBy(records, (r) => (typeof r.source === "string" ? r.source : undefined));
  if (bySource.length > 0) {
    lines.push("source : " + bySource.map(([k, n]) => `${k}=${n}`).join("  "));
  }
  const bySub = countBy(records, (r) =>
    typeof r.subreddit === "string" ? r.subreddit : undefined,
  );
  if (bySub.length > 0) {
    const top = bySub
      .slice(0, 6)
      .map(([k, n]) => `${k}=${n}`)
      .join("  ");
    lines.push(`subreddits (${bySub.length} uniques, top6) : ${top}`);
  }
  const byTopic = countBy(records, (r) => (typeof r.topic === "string" ? r.topic : undefined));
  if (byTopic.length > 0) {
    lines.push("topics : " + byTopic.map(([k, n]) => `${k}=${n}`).join("  "));
  }
  const byLang = countBy(records, (r) => (typeof r.lang === "string" ? r.lang : undefined));
  if (byLang.length > 0) {
    const top = byLang
      .slice(0, 6)
      .map(([k, n]) => `${k}=${n}`)
      .join("  ");
    lines.push(`langues (top6) : ${top}`);
  }
  return lines;
}

// ---------------------------------------------------------------------------
// Définition des sources auditées
// ---------------------------------------------------------------------------

const SOURCES: SourceDef[] = [
  {
    key: "bx-catalog",
    file: "bx-catalog.json",
    critical: true,
    freshness: "catalogue",
    arrayFields: ["products"],
    schema: [
      { label: "title", ok: (r) => isNonEmpty(r.title) },
      { label: "price", ok: (r) => typeof r.price === "number" && Number.isFinite(r.price) },
    ],
    distribution: catalogDistribution,
  },
  {
    key: "x-discussions",
    file: "x-discussions.json",
    critical: false,
    freshness: "discussions",
    arrayFields: ["discussions"],
    schema: [
      { label: "text/title", ok: (r) => isNonEmpty(r.text) || isNonEmpty(r.title) },
      { label: "url", ok: (r) => isNonEmpty(r.url) },
    ],
    distribution: discussionsDistribution,
  },
  {
    key: "reddit-discussions",
    file: "reddit-discussions.json",
    critical: false,
    freshness: "discussions",
    arrayFields: ["discussions"],
    schema: [
      { label: "title", ok: (r) => isNonEmpty(r.title) },
      { label: "url", ok: (r) => isNonEmpty(r.url) },
    ],
    distribution: discussionsDistribution,
  },
  {
    key: "bbx-weekly",
    file: "bbx-weekly.json",
    critical: false,
    freshness: "discussions",
    // `periods` est un objet-map (pas un tableau) ; détecté à part plus bas.
    arrayFields: ["periods", "data", "items"],
    schema: [],
  },
  {
    key: "meta-enrichment",
    file: "meta-enrichment.json",
    critical: true,
    freshness: "meta",
    arrayFields: ["blades"],
    schema: [
      { label: "name", ok: (r) => isNonEmpty(r.name) },
      {
        label: "communityScore",
        ok: (r) => typeof r.communityScore === "number" && Number.isFinite(r.communityScore),
      },
    ],
  },
  {
    key: "wbo-combos",
    file: "wbo-combos.json",
    critical: false,
    freshness: "default",
    arrayFields: ["combos", "events", "data", "items"],
    schema: [
      { label: "name", ok: (r) => isNonEmpty(r.name) },
      { label: "placements/date", ok: (r) => isNonEmpty(r.placements) || isNonEmpty(r.date) },
    ],
  },
  {
    key: "universe_beys",
    file: "universe_beys.json",
    critical: false,
    freshness: "default",
    arrayFields: [],
    schema: [
      { label: "title", ok: (r) => isNonEmpty(r.title) },
      { label: "url", ok: (r) => isNonEmpty(r.url) },
    ],
  },
  {
    key: "universe_characters",
    file: "universe_characters.json",
    critical: false,
    freshness: "default",
    arrayFields: [],
    schema: [
      { label: "title", ok: (r) => isNonEmpty(r.title) },
      { label: "url", ok: (r) => isNonEmpty(r.url) },
    ],
  },
  {
    key: "beyblade-sites",
    file: "beyblade-sites.json",
    critical: false,
    freshness: "default",
    arrayFields: ["sites", "data", "items"],
    schema: [
      { label: "name", ok: (r) => isNonEmpty(r.name) },
      { label: "url", ok: (r) => isNonEmpty(r.url) },
    ],
    distribution: (records) => {
      const lines: string[] = [];
      const byCat = countBy(records, (r) =>
        typeof r.category === "string" ? r.category : undefined,
      );
      if (byCat.length > 0)
        lines.push("catégories : " + byCat.map(([k, n]) => `${k}=${n}`).join("  "));
      const byRegion = countBy(records, (r) =>
        typeof r.region === "string" ? r.region : undefined,
      );
      if (byRegion.length > 0)
        lines.push("régions : " + byRegion.map(([k, n]) => `${k}=${n}`).join("  "));
      return lines;
    },
  },
];

// ---------------------------------------------------------------------------
// Baseline (map key → count)
// ---------------------------------------------------------------------------

async function loadBaseline(): Promise<Record<string, number>> {
  const f = Bun.file(BASELINE_PATH);
  if (!(await f.exists())) return {};
  try {
    const parsed = JSON.parse(await f.text());
    return parsed && typeof parsed === "object" && parsed.counts ? parsed.counts : {};
  } catch {
    return {};
  }
}

async function writeBaseline(counts: Record<string, number>): Promise<void> {
  const payload = {
    description:
      "Baseline de volume pour data-doctor (map source → count). Régénéré via --update-baseline.",
    generatedAt: new Date().toISOString(),
    counts,
  };
  await Bun.write(BASELINE_PATH, JSON.stringify(payload, null, 2) + "\n");
}

// ---------------------------------------------------------------------------
// Audit d'une source
// ---------------------------------------------------------------------------

async function auditSource(
  def: SourceDef,
  baseline: Record<string, number>,
): Promise<{ report: SourceReport; count: number }> {
  const path = resolve(DATA_DIR, def.file);
  const file = Bun.file(path);
  const notes: string[] = [];
  let status: Status = "OK";

  // Promeut le statut sans jamais le rétrograder.
  const bump = (s: Status) => {
    if (s === "FAIL") status = "FAIL";
    else if (s === "WARN" && status !== "FAIL") status = "WARN";
  };

  // ---- Pilier 1 : existence + taille ----
  if (!(await file.exists())) {
    bump(def.critical ? "FAIL" : "WARN");
    notes.push(`fichier ABSENT (${def.file})`);
    return { report: { key: def.key, file: def.file, status, notes, distribution: [] }, count: 0 };
  }
  const size = file.size;
  notes.push(`taille ${humanSize(size)}`);

  // ---- Parsing ----
  let parsed: unknown;
  try {
    parsed = JSON.parse(await file.text());
  } catch (err) {
    bump(def.critical ? "FAIL" : "WARN");
    notes.push(`JSON illisible : ${(err as Error).message}`);
    return { report: { key: def.key, file: def.file, status, notes, distribution: [] }, count: 0 };
  }

  const root =
    parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};

  // ---- Pilier 2 : fraîcheur ----
  const genAt = readGeneratedAt(root);
  if (genAt) {
    const age = ageInDays(genAt);
    const slo = FRESHNESS_SLO_DAYS[def.freshness];
    if (Number.isNaN(age)) {
      bump("WARN");
      notes.push(`timestamp invalide (${genAt})`);
    } else {
      const ageStr = `${age.toFixed(1)}j`;
      if (age > slo) {
        bump("WARN");
        notes.push(`STALE : âge ${ageStr} > SLO ${slo}j`);
      } else {
        notes.push(`fraîcheur ${ageStr} (SLO ${slo}j)`);
      }
    }
  } else {
    notes.push("pas de timestamp");
  }

  // ---- Détection des enregistrements ----
  const { records, field } = detectRecords(parsed, def.arrayFields);
  let count = records.length;

  // Cas spécial objet-map (ex bbx-weekly.periods) : compter les clés.
  if (count === 0 && def.arrayFields.length > 0) {
    for (const f of def.arrayFields) {
      const v = root[f];
      if (v && typeof v === "object" && !Array.isArray(v)) {
        count = Object.keys(v).length;
        notes.push(`${count} entrées (map [${f}])`);
        break;
      }
    }
  } else {
    notes.push(`${count} enregistrements${field && field !== "<root>" ? ` [${field}]` : ""}`);
  }

  // ---- Pilier 3 : volume vs baseline ----
  const base = baseline[def.key];
  if (typeof base === "number" && base > 0) {
    const drop = (base - count) / base;
    if (drop > VOLUME_DROP_THRESHOLD) {
      bump("WARN");
      notes.push(`CHUTE volume : ${count} vs baseline ${base} (-${(drop * 100).toFixed(0)}%)`);
    } else {
      const delta = count - base;
      const sign = delta >= 0 ? "+" : "";
      notes.push(`volume vs baseline ${base} (${sign}${delta})`);
    }
  } else {
    notes.push("pas de baseline (1er run)");
  }

  // ---- Pilier 4 : schéma ----
  if (def.schema.length > 0 && records.length > 0) {
    for (const check of def.schema) {
      const okCount = records.reduce((acc, r) => acc + (check.ok(r) ? 1 : 0), 0);
      const ratio = okCount / records.length;
      const pct = (ratio * 100).toFixed(1);
      if (ratio < SCHEMA_MIN_RATIO) {
        bump("WARN");
        notes.push(`schéma ${check.label} : ${pct}% non vide (< 90%)`);
      } else {
        notes.push(`schéma ${check.label} : ${pct}%`);
      }
    }
  }

  // ---- Pilier 5 : distribution (best-effort, jamais d'échec) ----
  let distribution: string[] = [];
  if (def.distribution && records.length > 0) {
    try {
      distribution = def.distribution(records);
    } catch (err) {
      distribution = [`(distribution indisponible : ${(err as Error).message})`];
    }
  }

  return { report: { key: def.key, file: def.file, status, notes, distribution }, count };
}

// ---------------------------------------------------------------------------
// Rapport
// ---------------------------------------------------------------------------

const STATUS_TAG: Record<Status, string> = {
  OK: "[ OK ]",
  WARN: "[WARN]",
  FAIL: "[FAIL]",
};

function printReport(reports: SourceReport[]): void {
  const keyWidth = Math.max(...reports.map((r) => r.key.length));
  console.log("");
  console.log("=== data-doctor — observabilité du pipeline rpbey ===");
  console.log(`source: ${DATA_DIR}`);
  console.log("");
  for (const r of reports) {
    const pad = r.key.padEnd(keyWidth);
    console.log(`${STATUS_TAG[r.status]} ${pad}  ${r.notes.join("  |  ")}`);
    for (const line of r.distribution) {
      console.log(`${" ".repeat(7 + keyWidth)}↳ ${line}`);
    }
  }
}

// ---------------------------------------------------------------------------
// Notification Discord (préparée mais JAMAIS envoyée)
// ---------------------------------------------------------------------------

function maybePrepareWebhook(
  reports: SourceReport[],
  ok: number,
  warn: number,
  fail: number,
): void {
  const url = process.env.DOCTOR_WEBHOOK;
  if (!url) return;
  const issues = reports
    .filter((r) => r.status !== "OK")
    .map((r) => `${STATUS_TAG[r.status]} ${r.key}`)
    .join(", ");
  const payload = {
    username: "data-doctor",
    content:
      `Pipeline data rpbey — ${ok} OK / ${warn} WARN / ${fail} FAIL` +
      (issues ? `\nÀ surveiller : ${issues}` : ""),
  };
  console.log("");
  console.log(`[webhook] DOCTOR_WEBHOOK détecté — would notify (NON envoyé) :`);
  console.log(`          ${JSON.stringify(payload)}`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const baseline = await loadBaseline();
  const reports: SourceReport[] = [];
  const counts: Record<string, number> = {};

  for (const def of SOURCES) {
    const { report, count } = await auditSource(def, baseline);
    reports.push(report);
    counts[def.key] = count;
  }

  printReport(reports);

  const ok = reports.filter((r) => r.status === "OK").length;
  const warn = reports.filter((r) => r.status === "WARN").length;
  const fail = reports.filter((r) => r.status === "FAIL").length;

  // Écriture de la baseline : au 1er run (aucune baseline existante) ou sur demande.
  const firstRun = Object.keys(baseline).length === 0;
  if (UPDATE_BASELINE || firstRun) {
    await writeBaseline(counts);
    console.log("");
    console.log(
      `[baseline] ${UPDATE_BASELINE ? "réécrite" : "créée (1er run)"} → ${BASELINE_PATH}`,
    );
  }

  console.log("");
  console.log(`Résumé : ${ok} OK / ${warn} WARN / ${fail} FAIL  (sur ${reports.length} sources)`);

  maybePrepareWebhook(reports, ok, warn, fail);

  process.exit(fail > 0 ? 1 : 0);
}

await main();
