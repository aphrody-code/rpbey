/**
 * QA du masquage de la route profil PUBLIQUE via le VRAI chemin HTTP servi :
 *   GET /api/v1/users/{id}  → getPublicUser → PublicUserResponseSchema.parse.
 * (consommée aussi par la page /profile/[id]).
 *
 * On mute le profil cible via `db`, on interroge la route live, on assert le
 * masquage, puis on RESTAURE l'état d'origine (round-trip, zéro résidu).
 *   - PUBLIC  : bio / deckBoxImage / localisation / socials exposés.
 *   - PRIVATE : bio / deckBoxImage masqués (null) ; loc/socials masqués.
 *   - MEMBERS + showLocation/showSocials=false : loc/socials masqués.
 *
 * Lancer : cd apps/web && bun scripts/qa-profile-public.ts
 */
import { db, schema } from "@rpbey/db";
import { eq } from "drizzle-orm";

const BASE = process.env.QA_BASE || "http://127.0.0.1:3002";

type Row = { test: string; result: string; verdict: "pass" | "fail" };
const rows: Row[] = [];
function rec(test: string, result: string, ok: boolean) {
  rows.push({ test, result, verdict: ok ? "pass" : "fail" });
  console.log(`[${ok ? "PASS" : "FAIL"}] ${test} — ${result}`);
}

type PublicProfile = {
  bio: string | null;
  deckBoxImage: string | null;
  country: string | null;
  twitterHandle: string | null;
  discordHandle: string | null;
  websiteUrl: string | null;
} | null;

async function fetchPublic(id: string): Promise<PublicProfile> {
  const res = await fetch(`${BASE}/api/v1/users/${encodeURIComponent(id)}`);
  if (!res.ok) throw new Error(`GET /api/v1/users/${id} → ${res.status}`);
  const body = await res.json();
  // jsonOk enveloppe { ok, data } ; data = PublicUserResponse { user }.
  return (body?.data?.user ?? body?.user)?.profile ?? null;
}

async function main() {
  const target = await db.query.profiles.findFirst({ columns: { id: true, userId: true } });
  if (!target) {
    console.error("Aucun profil — backfill-profiles.ts d'abord");
    process.exit(1);
  }

  const setVals = {
    bio: "<p>QA bio publique</p>",
    deckBoxImage: "https://cdn.rpbey.fr/deckbox/qa.webp",
    bannerImage: "https://cdn.rpbey.fr/banners/qa.webp",
    country: "France",
    region: "Bretagne",
    city: "Rennes",
    twitterHandle: "qa_tw",
    discordHandle: "qa_dc",
    websiteUrl: "https://qa.example",
  };

  const original = await db.query.profiles.findFirst({ where: eq(schema.profiles.id, target.id) });
  if (!original) {
    console.error("profil cible introuvable");
    process.exit(1);
  }
  const restore = {
    bio: original.bio,
    deckBoxImage: original.deckBoxImage,
    bannerImage: original.bannerImage,
    country: original.country,
    region: original.region,
    city: original.city,
    twitterHandle: original.twitterHandle,
    discordHandle: original.discordHandle,
    websiteUrl: original.websiteUrl,
    profileVisibility: original.profileVisibility,
    showLocation: original.showLocation,
    showSocials: original.showSocials,
  };

  async function setProfile(patch: Record<string, unknown>) {
    await db
      .update(schema.profiles)
      .set({ ...patch, updatedAt: new Date().toISOString() })
      .where(eq(schema.profiles.id, target!.id));
  }

  try {
    // ── PUBLIC : tout exposé ───────────────────────────────────────────────
    await setProfile({
      ...setVals,
      profileVisibility: "PUBLIC",
      showLocation: true,
      showSocials: true,
    });
    let p = await fetchPublic(target.userId);
    rec("PUBLIC: bio exposée", `${JSON.stringify(p?.bio)}`, p?.bio === setVals.bio);
    rec(
      "PUBLIC: deckBoxImage exposée",
      `${JSON.stringify(p?.deckBoxImage)}`,
      p?.deckBoxImage === setVals.deckBoxImage,
    );
    rec("PUBLIC: country exposé", `${JSON.stringify(p?.country)}`, p?.country === "France");
    rec(
      "PUBLIC: twitterHandle exposé",
      `${JSON.stringify(p?.twitterHandle)}`,
      p?.twitterHandle === "qa_tw",
    );
    rec(
      "PUBLIC: websiteUrl exposé",
      `${JSON.stringify(p?.websiteUrl)}`,
      p?.websiteUrl === "https://qa.example",
    );

    // ── PRIVATE : bio + deckBoxImage masqués, loc/socials masqués ──────────
    await setProfile({ profileVisibility: "PRIVATE", showLocation: true, showSocials: true });
    p = await fetchPublic(target.userId);
    rec("PRIVATE: bio masquée (null)", `${JSON.stringify(p?.bio)}`, p?.bio === null);
    rec(
      "PRIVATE: deckBoxImage masquée (null)",
      `${JSON.stringify(p?.deckBoxImage)}`,
      p?.deckBoxImage === null,
    );
    rec("PRIVATE: country masqué (null)", `${JSON.stringify(p?.country)}`, p?.country === null);
    rec(
      "PRIVATE: twitterHandle masqué (null)",
      `${JSON.stringify(p?.twitterHandle)}`,
      p?.twitterHandle === null,
    );
    rec(
      "PRIVATE: discordHandle masqué (null)",
      `${JSON.stringify(p?.discordHandle)}`,
      p?.discordHandle === null,
    );
    rec(
      "PRIVATE: websiteUrl masqué (null)",
      `${JSON.stringify(p?.websiteUrl)}`,
      p?.websiteUrl === null,
    );

    // ── MEMBERS + flags off : loc/socials masqués même non-privé ───────────
    await setProfile({ profileVisibility: "MEMBERS", showLocation: false, showSocials: false });
    p = await fetchPublic(target.userId);
    rec(
      "MEMBERS+showLocation=false: country masqué",
      `${JSON.stringify(p?.country)}`,
      p?.country === null,
    );
    rec(
      "MEMBERS+showSocials=false: twitter masqué",
      `${JSON.stringify(p?.twitterHandle)}`,
      p?.twitterHandle === null,
    );
    rec(
      "MEMBERS (non-private): bio NON masquée",
      `${JSON.stringify(p?.bio)}`,
      p?.bio === setVals.bio,
    );
  } finally {
    await setProfile(restore as Record<string, unknown>);
    const check = await db.query.profiles.findFirst({ where: eq(schema.profiles.id, target.id) });
    const restored =
      check?.bio === restore.bio && check?.profileVisibility === restore.profileVisibility;
    console.log(`\n[restore] état d'origine ${restored ? "restauré OK" : "ÉCHEC RESTAURATION"}.`);
  }

  const pass = rows.filter((r) => r.verdict === "pass").length;
  const fail = rows.filter((r) => r.verdict === "fail").length;
  console.log(
    `\n===== PROFIL PUBLIC RÉCAP: ${pass} pass / ${fail} fail (total ${rows.length}) =====`,
  );
  console.log("MARKDOWN_TABLE_START");
  console.log("| test | résultat | verdict |");
  console.log("|---|---|---|");
  for (const r of rows)
    console.log(`| ${r.test} | ${r.result.replace(/\|/g, "/")} | ${r.verdict} |`);
  console.log("MARKDOWN_TABLE_END");
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
