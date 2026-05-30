/**
 * Injecte les VRAIS résultats des Beyblade Awards France 2025 dans les sondages awards,
 * à partir des réponses du Google Form (export CSV du spreadsheet officiel).
 * Pour chaque catégorie : agrège les votes par réponse, remplace les options du sondage
 * par le décompte réel (top N, voteCount + displayOrder), met à jour totalVotes et clôture.
 * Idempotent (relançable). Lancer : `cd apps/web && bun scripts/seed-awards-results.ts`.
 *
 * Source CSV : spreadsheet 1b5Kiakf8FIi4DeJH4e_6DXC2MBtvOdwH1Sw3-6emz-s (onglet réponses).
 */
import { db, schema } from "@rpbey/db";
import { eq } from "drizzle-orm";

const AWARDS_CATEGORY = "Beyblade Awards France 2025";
const SHEET_ID = "1b5Kiakf8FIi4DeJH4e_6DXC2MBtvOdwH1Sw3-6emz-s";
const TOP_N = 10; // options conservées par catégorie (gagnant + dauphins)

/** Parseur CSV RFC4180 minimal : gère guillemets, "" échappés, virgules et CRLF internes. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (ch === "\r") {
      // ignore (CRLF)
    } else field += ch;
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

const cleanAnswer = (s: string) =>
  s
    .trim()
    .replace(/\s+/g, " ")
    .replace(/^["']|["']$/g, "")
    .trim();

async function main() {
  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`CSV fetch ${res.status}`);
  const csv = await res.text();
  const rows = parseCsv(csv);
  const headers = rows[0];
  const dataRows = rows.slice(1);
  console.log(`CSV : ${dataRows.length} réponses, ${headers.length} colonnes.`);

  // Catégories = colonnes après l'Horodateur (index 0).
  const categories = headers.slice(1).map((h, i) => ({ header: h.trim(), col: i + 1 }));

  // Sondages awards existants (pour matcher par question normalisée, fallback positionnel).
  const awardPolls = await db.query.polls.findMany({
    where: eq(schema.polls.category, AWARDS_CATEGORY),
    columns: { id: true, slug: true, question: true, createdAt: true },
  });
  awardPolls.sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));

  let done = 0;
  for (let idx = 0; idx < categories.length; idx++) {
    const { header, col } = categories[idx];
    // Tally : clé insensible casse/accents, libellé d'affichage = 1ʳᵉ casse vue.
    const counts = new Map<string, { label: string; n: number }>();
    let total = 0;
    for (const r of dataRows) {
      const raw = cleanAnswer(r[col] ?? "");
      if (!raw) continue;
      total++;
      const key = norm(raw);
      if (!key) continue;
      const ex = counts.get(key);
      if (ex) ex.n++;
      else counts.set(key, { label: raw, n: 1 });
    }

    const ranked = [...counts.values()].sort((a, b) => b.n - a.n).slice(0, TOP_N);
    if (ranked.length === 0) {
      console.warn(`  ! "${header}" : aucune réponse, ignoré`);
      continue;
    }

    // Match du sondage : question normalisée == header normalisé, sinon positionnel.
    const poll =
      awardPolls.find((p) => norm(p.question) === norm(header)) ?? awardPolls[idx] ?? null;
    if (!poll) {
      console.warn(`  ! "${header}" : aucun sondage correspondant`);
      continue;
    }

    await db.transaction(async (tx) => {
      await tx.delete(schema.pollOptions).where(eq(schema.pollOptions.pollId, poll.id));
      await tx.insert(schema.pollOptions).values(
        ranked.map((o, j) => ({
          pollId: poll.id,
          label: o.label,
          displayOrder: j,
          voteCount: o.n,
        })),
      );
      await tx
        .update(schema.polls)
        .set({
          totalVotes: total,
          isClosed: true,
          isPublished: true,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(schema.polls.id, poll.id));
    });

    const win = ranked[0];
    console.log(
      `  ✓ ${header.padEnd(38)} → ${total} votes · gagnant: ${win.label} (${win.n}) · ${ranked.length} options`,
    );
    done++;
  }

  console.log(
    `\nTerminé : ${done}/${categories.length} catégories mises à jour avec les résultats réels.`,
  );
}

main()
  .then(() => db.$client.end())
  .catch((e) => {
    console.error("SEED AWARDS RESULTS FAILED:", e);
    process.exit(1);
  });
