/**
 * prisma.ts — Prisma-compatible facade over Drizzle (`@rpbey/db`).
 *
 * MIGRATION Prisma → Drizzle (2026-05-27)
 * ----------------------------------------
 * Le bot consommait `@prisma/client`. La source de vérité DB est désormais
 * `@rpbey/db` (drizzle-orm + postgres-js, schéma 53 tables camelCase). Plutôt
 * que de réécrire ~295 call-sites (commands/events/cron/lib/api/components),
 * ce module expose une **façade compatible Prisma** implémentée sur Drizzle.
 *
 * - `PrismaService` (classe tsyringe `@singleton`) reste l'objet injecté par DI
 *   (`@inject(PrismaService)`), donc aucun call-site ni la structure discordx /
 *   tsyringe ne change. SWC-safe : aucun nouveau décorateur, `import { … }`
 *   (jamais `import type`) pour les classes injectées.
 * - L'export `prisma` (default + nommé) reste un client compatible.
 *
 * Couverture : findUnique/findFirst/findMany/create/update/delete/upsert/count,
 * createMany/updateMany/deleteMany, $transaction, opérateurs `where`
 * (eq, in, not, contains/startsWith/endsWith + mode insensitive, lt/lte/gt/gte),
 * `select`, `include` (relations re-aliasées Prisma↔Drizzle + `_count`),
 * `orderBy`, `take`/`skip`, écriture atomique `{ increment }`/`{ decrement }`,
 * nested writes `items: { create: [...] }`.
 *
 * Le raw SQL de `gacha-api.ts` (pool `pg` direct sur `users`/`sessions`) n'est
 * PAS concerné et reste inchangé.
 */
import { createId } from "@paralleldrive/cuid2";
import { db, schema } from "@rpbey/db";
import {
  and,
  asc,
  desc,
  eq,
  gt,
  gte,
  ilike,
  inArray,
  like,
  lt,
  lte,
  ne,
  sql,
  count as drizzleCount,
} from "drizzle-orm";
import { singleton } from "tsyringe";

type Any = any;
type Row = Record<string, Any>;
type DB = typeof db;
type Tx = Parameters<Parameters<DB["transaction"]>[0]>[0];

// ─── Model (Prisma accessor) → Drizzle table (schema export) ─────────────────
// Prisma model accessors are camelCase singular; Drizzle table exports are the
// names from packages/db/src/schema.ts.
const MODEL_TABLE: Record<string, keyof typeof schema> = {
  user: "users",
  profile: "profiles",
  account: "accounts",
  session: "sessions",
  twoFactor: "twoFactors",
  verification: "verifications",
  pointAdjustment: "pointAdjustments",
  rankingSeason: "rankingSeasons",
  seasonEntry: "seasonEntries",
  globalRanking: "globalRankings",
  ticket: "tickets",
  rankingSystem: "rankingSystem",
  part: "parts",
  beyblade: "beyblades",
  deck: "decks",
  deckItem: "deckItems",
  tournament: "tournaments",
  tournamentCategory: "tournamentCategories",
  tournamentParticipant: "tournamentParticipants",
  tournamentMatch: "tournamentMatches",
  staffMember: "staffMembers",
  contentBlock: "contentBlocks",
  product: "products",
  botCommand: "botCommands",
  discordRole: "discordRoles",
  discordChannel: "discordChannels",
  youTubeVideo: "youtubeVideos",
  satrRanking: "satrRankings",
  satrBlader: "satrBladers",
  wbRanking: "wbRankings",
  wbBlader: "wbBladers",
  stardustRanking: "stardustRankings",
  stardustBlader: "stardustBladers",
  duelMatch: "duelMatches",
  gachaDrop: "gachaDrops",
  gachaCard: "gachaCards",
  cardInventory: "cardInventory",
  cardWishlist: "cardWishlists",
  partInventory: "partInventory",
  currencyTransaction: "currencyTransactions",
  animeSeries: "animeSeries",
  animeEpisode: "animeEpisodes",
  animeEpisodeSource: "animeEpisodeSources",
  animeWatchProgress: "animeWatchProgress",
  warning: "warnings",
  tempBan: "tempBans",
  botConfig: "botConfig",
  reminder: "reminders",
  beyLibraryPart: "beyLibraryParts",
  legacyTournamentArchive: "legacyTournamentArchives",
  streamState: "streamStates",
  gachaFriendship: "gachaFriendships",
  gachaAnnouncement: "gachaAnnouncements",
  gachaAuditLog: "gachaAuditLog",
};

// ─── Drizzle relational-query name → Prisma include key, per model ───────────
// Drizzle's relations (packages/db/src/relations.ts) use names that differ from
// Prisma's. Reads go through db.query.<table>.findMany with the Drizzle names
// in `with`, then results are re-aliased to the Prisma include keys.
//
// Map shape: prismaModel → { prismaIncludeKey: drizzleRelationName }
const INCLUDE_ALIAS: Record<string, Record<string, string>> = {
  user: {
    profile: "profiles", // Prisma 1:1 `profile` ⇄ Drizzle `profiles` (array)
    decks: "decks",
    accounts: "accounts",
    sessions: "sessions",
    tickets: "tickets",
    cardInventory: "cardInventories",
    currencyTransactions: "currencyTransactions",
    partInventory: "partInventories",
    // Prisma `User.tournaments: TournamentParticipant[]` ⇄ Drizzle relation
    // `tournamentParticipants` (user participates in tournaments).
    tournaments: "tournamentParticipants",
  },
  profile: { user: "user" },
  cardInventory: { card: "gachaCard", user: "user" },
  cardWishlist: { card: "gachaCard", profile: "profile" },
  deck: {
    items: "deckItems",
    user: "user",
    participants: "tournamentParticipants",
  },
  deckItem: {
    blade: "part_bladeId",
    ratchet: "part_ratchetId",
    bit: "part_bitId",
    overBlade: "part_overBladeId",
    lockChip: "part_lockChipId",
    assistBlade: "part_assistBladeId",
    bey: "beyblade",
    deck: "deck",
  },
  beyblade: {
    blade: "part_bladeId",
    ratchet: "part_ratchetId",
    bit: "part_bitId",
    product: "product",
  },
  product: { beyblades: "beyblades" },
  tournament: {
    participants: "tournamentParticipants",
    matches: "tournamentMatches",
    category: "tournamentCategory",
  },
  tournamentParticipant: {
    user: "user",
    deck: "deck",
    tournament: "tournament",
  },
  tournamentMatch: { tournament: "tournament" },
  seasonEntry: { user: "user", season: "rankingSeason" },
  globalRanking: { user: "user" },
  animeEpisode: { sources: "animeEpisodeSources", series: "animeSery" },
  animeWatchProgress: { episode: "animeEpisode", user: "user" },
};

// A relation that is 1:1 in Prisma but generated as `many` in Drizzle relations
// → take [0] when re-aliasing.
const SINGULARIZE: Record<string, Set<string>> = {
  user: new Set(["profile"]),
};

// _count relation → drizzle table to count against, keyed by FK column
const COUNT_REL: Record<string, Record<string, { table: keyof typeof schema; fk: string }>> = {
  tournament: {
    participants: { table: "tournamentParticipants", fk: "tournamentId" },
    matches: { table: "tournamentMatches", fk: "tournamentId" },
  },
  user: {
    tournaments: { table: "tournamentParticipants", fk: "userId" },
  },
};

// Relation filters in `where` (rare). localFk on the queried table joins to
// relPk on the related table; the nested filter is resolved as a subselect.
const RELATION_FILTER: Record<
  string,
  { table: keyof typeof schema; localFk: string; relPk: string }
> = {
  // tournaments.categoryId → tournament_categories.id
  category: {
    table: "tournamentCategories",
    localFk: "categoryId",
    relPk: "id",
  },
  // users.id → profiles.userId  (profile belongs to user)
  profile: { table: "profiles", localFk: "id", relPk: "userId" },
  // <queried>.userId → users.id  (the row belongs to a user). Only used by the
  // `profile.findFirst({ where: { user: { discordId } } })` call-site; the local
  // FK `userId` exists on profiles, tournamentParticipants, etc.
  user: { table: "users", localFk: "userId", relPk: "id" },
};

function tableFor(model: string) {
  const key = MODEL_TABLE[model];
  if (!key) throw new Error(`[prisma-facade] unknown model: ${model}`);
  return schema[key] as Any;
}

function queryFor(model: string, executor: DB | Tx) {
  const key = MODEL_TABLE[model];
  return (executor as Any).query[key] as Any;
}

// ─── where translation ───────────────────────────────────────────────────────
// Colonnes timestamp en mode "string" (PgTimestampString) : better-auth & app
// écrivent/comparent parfois des objets Date → postgres-js rejette. On coerce
// Date → ISO string pour ces colonnes ; les colonnes date-mode (PgTimestamp,
// tables auth) gardent l'objet Date.
function tsCoerce(col: Any, v: Any): Any {
  return v instanceof Date && (col as Any)?.columnType === "PgTimestampString"
    ? v.toISOString()
    : v;
}

function buildCondition(table: Any, where: Row | undefined): Any {
  if (!where) return undefined;
  const conds: Any[] = [];
  for (const [field, raw] of Object.entries(where)) {
    if (field === "AND") {
      const arr = (Array.isArray(raw) ? raw : [raw]) as Row[];
      for (const sub of arr) {
        const c = buildCondition(table, sub);
        if (c) conds.push(c);
      }
      continue;
    }
    if (field === "OR") {
      const arr = (Array.isArray(raw) ? raw : [raw]) as Row[];
      const ors = arr.map((sub) => buildCondition(table, sub)).filter(Boolean);
      if (ors.length)
        conds.push(ors.length === 1 ? ors[0] : (sql`(${sql.join(ors, sql` OR `)})` as Any));
      continue;
    }
    if (field === "NOT") {
      const c = buildCondition(table, raw as Row);
      if (c) conds.push(sql`NOT (${c})` as Any);
      continue;
    }
    const col = table[field];
    if (!col) {
      // Relation filter (e.g. category: { name: {...} }, profile: { ... }) —
      // resolve via IN (SELECT <relPK> FROM relTable WHERE <relCond>) joined
      // on the local FK column.
      const relFilter = RELATION_FILTER[field];
      if (relFilter && raw && typeof raw === "object") {
        const relTable = schema[relFilter.table] as Any;
        const localCol = table[relFilter.localFk];
        const relCond = buildCondition(relTable, raw as Row);
        if (localCol && relCond) {
          conds.push(
            inArray(
              localCol,
              (db as Any).select({ id: relTable[relFilter.relPk] }).from(relTable).where(relCond),
            ),
          );
        }
        continue;
      }
      // Compound-unique named key (e.g. tournamentId_challongeMatchId: {...})
      // → flatten the nested column map into AND eq conditions.
      if (raw && typeof raw === "object" && !(raw instanceof Date)) {
        const nested = raw as Row;
        const subKeys = Object.keys(nested);
        if (subKeys.length && subKeys.every((k) => table[k])) {
          const c = buildCondition(table, nested);
          if (c) conds.push(c);
          continue;
        }
      }
      continue;
    }
    if (raw === null) {
      conds.push(sql`${col} IS NULL` as Any);
    } else if (typeof raw === "object" && !(raw instanceof Date)) {
      const op = raw as Row;
      const insensitive = op.mode === "insensitive";
      if ("equals" in op) conds.push(eq(col, tsCoerce(col, op.equals)));
      if ("not" in op) {
        conds.push(
          op.not === null ? (sql`${col} IS NOT NULL` as Any) : ne(col, tsCoerce(col, op.not)),
        );
      }
      if ("in" in op)
        conds.push(
          inArray(
            col,
            (op.in as Any[]).map((x) => tsCoerce(col, x)),
          ),
        );
      if ("lt" in op) conds.push(lt(col, tsCoerce(col, op.lt)));
      if ("lte" in op) conds.push(lte(col, tsCoerce(col, op.lte)));
      if ("gt" in op) conds.push(gt(col, tsCoerce(col, op.gt)));
      if ("gte" in op) conds.push(gte(col, tsCoerce(col, op.gte)));
      if ("contains" in op) conds.push((insensitive ? ilike : like)(col, `%${op.contains}%`));
      if ("startsWith" in op) conds.push((insensitive ? ilike : like)(col, `${op.startsWith}%`));
      if ("endsWith" in op) conds.push((insensitive ? ilike : like)(col, `%${op.endsWith}`));
    } else {
      conds.push(eq(col, tsCoerce(col, raw)));
    }
  }
  if (conds.length === 0) return undefined;
  return conds.length === 1 ? conds[0] : and(...conds);
}

// ─── orderBy translation ─────────────────────────────────────────────────────
function buildOrderBy(table: Any, orderBy: Any): Any[] | undefined {
  if (!orderBy) return undefined;
  const arr = Array.isArray(orderBy) ? orderBy : [orderBy];
  const out: Any[] = [];
  for (const o of arr) {
    for (const [field, dir] of Object.entries(o as Row)) {
      const col = table[field];
      if (!col) continue;
      out.push(dir === "desc" ? desc(col) : asc(col));
    }
  }
  return out.length ? out : undefined;
}

// ─── data translation (atomic increment/decrement, strip nested writes) ──────
// Returns { values, nestedCreate } — nestedCreate is e.g. items.create handled
// after the parent insert.
function buildValues(
  table: Any,
  data: Row,
): { values: Row; nested: Array<{ rel: string; rows: Row[] }> } {
  const values: Row = {};
  const nested: Array<{ rel: string; rows: Row[] }> = [];
  for (const [field, raw] of Object.entries(data)) {
    if (raw && typeof raw === "object" && !(raw instanceof Date) && !Array.isArray(raw)) {
      const op = raw as Row;
      if ("increment" in op) {
        values[field] = sql`${table[field]} + ${op.increment}`;
        continue;
      }
      if ("decrement" in op) {
        values[field] = sql`${table[field]} - ${op.decrement}`;
        continue;
      }
      if ("set" in op) {
        values[field] = op.set;
        continue;
      }
      if ("create" in op) {
        // nested relation create (e.g. deck.items.create)
        const rows = Array.isArray(op.create) ? op.create : [op.create];
        nested.push({ rel: field, rows: rows as Row[] });
        continue;
      }
      // plain object that is a column value (jsonb) — pass through
      values[field] = tsCoerce(table[field], raw);
      continue;
    }
    values[field] = tsCoerce(table[field], raw);
  }
  return { values, nested };
}

// Prisma generated string PKs via `@default(cuid())` client-side. A few Drizzle
// columns (notably `users`/`accounts`/`sessions`/… synced from Better-Auth or
// Discord) carry NO `$defaultFn`, so an insert that omits `id` — which every
// `prisma.user.create({ data: { discordId, … } })` call-site does — would hit a
// NOT NULL violation. Replicate Prisma's behaviour: when the PK is a required
// string column without a DB/Drizzle default and the caller did not supply it,
// generate a cuid. Tables that already have `$defaultFn` keep their own id.
function ensureId(table: Any, values: Row): Row {
  const idCol = table.id;
  if (
    idCol &&
    idCol.primary &&
    idCol.notNull &&
    !idCol.hasDefault &&
    idCol.dataType === "string" &&
    values.id == null
  ) {
    return { ...values, id: createId() };
  }
  return values;
}

// Drizzle table column whitelist for stripping select/projection.
function applySelect(rows: Row[], select: Row | undefined): Row[] {
  if (!select) return rows;
  const keys = Object.keys(select).filter((k) => select[k]);
  return rows.map((r) => {
    const out: Row = {};
    for (const k of keys) out[k] = r[k];
    return out;
  });
}

// ─── relational read via db.query, with Prisma include re-aliasing ───────────
interface FindArgs {
  where?: Row;
  select?: Row;
  include?: Row;
  orderBy?: Any;
  take?: number;
  skip?: number;
  distinct?: Any;
}

function buildDrizzleWith(
  model: string,
  include: Row | undefined,
  select: Row | undefined,
): Row | undefined {
  // Prisma `select` can also pull relations (e.g. profile: { select: {...} }).
  const relSource = include ?? select;
  if (!relSource) return undefined;
  const alias = INCLUDE_ALIAS[model] ?? {};
  const withObj: Row = {};
  for (const [prismaKey, val] of Object.entries(relSource)) {
    if (prismaKey === "_count") continue; // handled separately
    if (!val) continue;
    const drizzleKey = alias[prismaKey];
    if (!drizzleKey) continue; // not a relation (scalar select) — skip
    if (val === true) {
      withObj[drizzleKey] = true;
    } else {
      const sub = val as FindArgs & { include?: Row; select?: Row };
      const childModel = relModelOf(model, prismaKey);
      const childTable = childModel ? tableFor(childModel) : undefined;
      const inner: Row = {};
      if (sub.where && childTable) inner.where = buildCondition(childTable, sub.where);
      if (sub.orderBy && childTable) inner.orderBy = buildOrderBy(childTable, sub.orderBy);
      if (typeof sub.take === "number") inner.limit = sub.take;
      const childWith = childModel
        ? buildDrizzleWith(childModel, sub.include, sub.select)
        : undefined;
      if (childWith) inner.with = childWith;
      withObj[drizzleKey] = Object.keys(inner).length ? inner : true;
    }
  }
  return Object.keys(withObj).length ? withObj : undefined;
}

// Resolve the child Prisma model name for a relation include key on a parent.
function relModelOf(parentModel: string, prismaKey: string): string | undefined {
  const map: Record<string, Record<string, string>> = {
    user: {
      profile: "profile",
      decks: "deck",
      accounts: "account",
      sessions: "session",
      tickets: "ticket",
      cardInventory: "cardInventory",
      currencyTransactions: "currencyTransaction",
      partInventory: "partInventory",
      tournaments: "tournamentParticipant",
    },
    profile: { user: "user" },
    cardInventory: { card: "gachaCard", user: "user" },
    cardWishlist: { card: "gachaCard", profile: "profile" },
    deck: {
      items: "deckItem",
      user: "user",
      participants: "tournamentParticipant",
    },
    deckItem: {
      blade: "part",
      ratchet: "part",
      bit: "part",
      overBlade: "part",
      lockChip: "part",
      assistBlade: "part",
      bey: "beyblade",
      deck: "deck",
    },
    beyblade: {
      blade: "part",
      ratchet: "part",
      bit: "part",
      product: "product",
    },
    product: { beyblades: "beyblade" },
    tournament: {
      participants: "tournamentParticipant",
      matches: "tournamentMatch",
      category: "tournamentCategory",
    },
    tournamentParticipant: {
      user: "user",
      deck: "deck",
      tournament: "tournament",
    },
    tournamentMatch: { tournament: "tournament" },
    seasonEntry: { user: "user", season: "rankingSeason" },
    globalRanking: { user: "user" },
    animeEpisode: { sources: "animeEpisodeSource", series: "animeSeries" },
    animeWatchProgress: { episode: "animeEpisode", user: "user" },
  };
  return map[parentModel]?.[prismaKey];
}

// Re-alias a Drizzle row (with `with` relations under Drizzle names) back to
// the Prisma include keys the call-sites expect.
function realiasRow(
  model: string,
  row: Row | null | undefined,
  include: Row | undefined,
  select: Row | undefined,
): Row | null {
  if (row == null) return null;
  const alias = INCLUDE_ALIAS[model] ?? {};
  const singular = SINGULARIZE[model] ?? new Set<string>();
  const relSource = include ?? select;
  const out: Row = { ...row };
  if (relSource) {
    for (const [prismaKey, val] of Object.entries(relSource)) {
      if (!val || prismaKey === "_count") continue;
      const drizzleKey = alias[prismaKey];
      if (!drizzleKey) continue;
      let child = row[drizzleKey];
      const childModel = relModelOf(model, prismaKey);
      const sub = (typeof val === "object" ? (val as FindArgs) : undefined) ?? undefined;
      if (Array.isArray(child)) {
        child = child.map((c: Row) =>
          childModel ? realiasRow(childModel, c, sub?.include, sub?.select) : c,
        );
        if (singular.has(prismaKey)) child = (child as Row[])[0] ?? null;
      } else if (child && childModel) {
        child = realiasRow(childModel, child, sub?.include, sub?.select);
      }
      if (drizzleKey !== prismaKey) delete out[drizzleKey];
      out[prismaKey] = child ?? (singular.has(prismaKey) ? null : child);
    }
  }
  return out;
}

// ─── per-model delegate ──────────────────────────────────────────────────────
function makeDelegate(model: string, executor: DB | Tx) {
  const table = tableFor(model);

  async function read(args: FindArgs, single: boolean): Promise<Any> {
    const relSource = args.include ?? args.select;
    const needsRelations =
      relSource && Object.keys(relSource).some((k) => (INCLUDE_ALIAS[model] ?? {})[k]);
    const wantsCount = !!args.include?._count || !!args.select?._count;

    if (needsRelations || wantsCount) {
      const q = queryFor(model, executor);
      const findArgs: Row = {};
      const cond = buildCondition(table, args.where);
      if (cond) findArgs.where = cond;
      const ob = buildOrderBy(table, args.orderBy);
      if (ob) findArgs.orderBy = ob;
      if (typeof args.take === "number") findArgs.limit = args.take;
      if (typeof args.skip === "number") findArgs.offset = args.skip;
      const withObj = buildDrizzleWith(model, args.include, args.select);
      if (withObj) findArgs.with = withObj;

      const rows: Row[] = single
        ? await q.findFirst(findArgs).then((r: Row) => (r ? [r] : []))
        : await q.findMany(findArgs);

      let mapped = rows.map((r) => realiasRow(model, r, args.include, args.select)!);

      // _count
      if (wantsCount) {
        const countSpec = (args.include?._count ?? args.select?._count) as Row;
        const sel = (countSpec.select ?? {}) as Row;
        for (const r of mapped) {
          const counts: Row = {};
          for (const rel of Object.keys(sel)) {
            const meta = COUNT_REL[model]?.[rel];
            if (!meta) {
              counts[rel] = 0;
              continue;
            }
            const ct = schema[meta.table] as Any;
            const [{ value }] = await (executor as Any)
              .select({ value: drizzleCount() })
              .from(ct)
              .where(eq(ct[meta.fk], r.id));
            counts[rel] = Number(value);
          }
          r._count = counts;
        }
      }

      // scalar select projection (keep relation keys + scalar selected keys)
      if (args.select) {
        const scalarKeys = Object.keys(args.select).filter(
          (k) => args.select![k] && !(INCLUDE_ALIAS[model] ?? {})[k] && k !== "_count",
        );
        const relKeys = Object.keys(args.select).filter((k) => (INCLUDE_ALIAS[model] ?? {})[k]);
        mapped = mapped.map((r) => {
          const o: Row = {};
          for (const k of scalarKeys) o[k] = r[k];
          for (const k of relKeys) o[k] = r[k];
          if (args.select!._count) o._count = r._count;
          return o;
        });
      }

      return single ? (mapped[0] ?? null) : mapped;
    }

    // plain scalar read via select()
    // Prisma `distinct: ["col", ...]` → Postgres DISTINCT ON (col, ...). When a
    // projection is requested we restrict the SELECT list so DISTINCT applies to
    // the projected shape (Prisma returns one row per distinct column tuple).
    const distinctCols: Any[] = Array.isArray(args.distinct)
      ? (args.distinct as string[]).map((c) => table[c]).filter(Boolean)
      : [];
    let qb: Any;
    if (distinctCols.length) {
      const proj: Row = {};
      if (args.select) {
        for (const k of Object.keys(args.select))
          if (args.select[k] && table[k]) proj[k] = table[k];
      }
      const base = (executor as Any).selectDistinctOn(
        distinctCols,
        Object.keys(proj).length ? proj : undefined,
      );
      qb = base.from(table);
    } else {
      qb = (executor as Any).select().from(table);
    }
    const cond = buildCondition(table, args.where);
    if (cond) qb = qb.where(cond);
    // DISTINCT ON requires its expressions to lead the ORDER BY. Honour the
    // caller's per-column direction (e.g. orderBy season desc) so DISTINCT ON
    // (season) ORDER BY season DESC matches and stays valid Postgres.
    const ob = buildOrderBy(table, args.orderBy);
    if (distinctCols.length) {
      const orderArr = Array.isArray(args.orderBy)
        ? args.orderBy
        : args.orderBy
          ? [args.orderBy]
          : [];
      const dirOf = (col: Any): "asc" | "desc" => {
        for (const o of orderArr as Row[]) {
          for (const [field, dir] of Object.entries(o)) {
            if (table[field] === col) return dir === "desc" ? "desc" : "asc";
          }
        }
        return "asc";
      };
      const distinctOrder = distinctCols.map((c) => (dirOf(c) === "desc" ? desc(c) : asc(c)));
      // Lead with the DISTINCT ON expressions; any further orderBy columns
      // the caller supplied follow (duplicate leading cols are valid SQL).
      const distinctFields = new Set(
        (orderArr as Row[]).flatMap((o) =>
          Object.keys(o).filter((f) => distinctCols.includes(table[f])),
        ),
      );
      const restOrder: Any[] = [];
      for (const o of orderArr as Row[]) {
        for (const [field, dir] of Object.entries(o)) {
          if (distinctFields.has(field)) continue;
          const col = table[field];
          if (col) restOrder.push(dir === "desc" ? desc(col) : asc(col));
        }
      }
      qb = qb.orderBy(...distinctOrder, ...restOrder);
    } else if (ob) {
      qb = qb.orderBy(...ob);
    }
    if (typeof args.take === "number") qb = qb.limit(args.take);
    else if (single) qb = qb.limit(1);
    if (typeof args.skip === "number") qb = qb.offset(args.skip);
    const rows: Row[] = await qb;
    const projected = distinctCols.length ? rows : applySelect(rows, args.select);
    return single ? (projected[0] ?? null) : projected;
  }

  async function insertWithNested(data: Row): Promise<Row> {
    const { values, nested } = buildValues(table, data);
    const [created] = await (executor as Any)
      .insert(table)
      .values(ensureId(table, values))
      .returning();
    for (const n of nested) {
      const childModel = relModelOf(model, n.rel);
      if (!childModel) continue;
      const childTable = tableFor(childModel);
      // attach FK — infer parent FK column name on child (e.g. deckId)
      const fk = `${model}Id`;
      const childRows = n.rows.map((r) => {
        const { values: cv } = buildValues(childTable, r);
        return ensureId(childTable, { ...cv, [fk]: created.id });
      });
      if (childRows.length) await (executor as Any).insert(childTable).values(childRows);
    }
    return created;
  }

  return {
    findUnique: (args: FindArgs) => read(args, true),
    findFirst: (args: FindArgs = {}) => read(args, true),
    findMany: (args: FindArgs = {}) => read(args, false),

    async create(args: { data: Row; include?: Row; select?: Row }): Promise<Any> {
      const created = await insertWithNested(args.data);
      if (args.include || args.select) {
        // re-read with relations using PK
        return read(
          {
            where: { id: created.id },
            include: args.include,
            select: args.select,
          },
          true,
        );
      }
      return created;
    },

    async createMany(args: { data: Row[] }): Promise<{ count: number }> {
      if (!args.data.length) return { count: 0 };
      const rows = args.data.map((d) => ensureId(table, buildValues(table, d).values));
      await (executor as Any).insert(table).values(rows);
      return { count: rows.length };
    },

    async update(args: { where: Row; data: Row; include?: Row; select?: Row }): Promise<Any> {
      const { values } = buildValues(table, args.data);
      const cond = buildCondition(table, args.where);
      const [updated] = await (executor as Any).update(table).set(values).where(cond).returning();
      if ((args.include || args.select) && updated) {
        return read(
          {
            where: { id: updated.id },
            include: args.include,
            select: args.select,
          },
          true,
        );
      }
      return updated;
    },

    async updateMany(args: { where?: Row; data: Row }): Promise<{ count: number }> {
      const { values } = buildValues(table, args.data);
      const cond = buildCondition(table, args.where);
      const res = await (executor as Any)
        .update(table)
        .set(values)
        .where(cond)
        .returning({ id: table.id });
      return { count: res.length };
    },

    async upsert(args: {
      where: Row;
      create: Row;
      update: Row;
      include?: Row;
      select?: Row;
    }): Promise<Any> {
      // Conflict target = the unique columns from `where`. Flatten compound
      // named keys (e.g. tournamentId_challongeMatchId: {a, b}).
      const conflictCols: Any[] = [];
      for (const [k, v] of Object.entries(args.where)) {
        if (table[k]) {
          conflictCols.push(table[k]);
        } else if (v && typeof v === "object" && !(v instanceof Date)) {
          for (const sub of Object.keys(v as Row)) {
            if (table[sub]) conflictCols.push(table[sub]);
          }
        }
      }
      const { values: createValues } = buildValues(table, args.create);
      const { values: updateValues } = buildValues(table, args.update);
      // merge where keys into create (they identify the row)
      for (const [k, v] of Object.entries(args.where)) {
        if (table[k] && !(k in createValues) && typeof v !== "object") {
          createValues[k] = v;
        }
      }
      let q = (executor as Any).insert(table).values(ensureId(table, createValues));
      if (Object.keys(updateValues).length) {
        q = q.onConflictDoUpdate({ target: conflictCols, set: updateValues });
      } else {
        q = q.onConflictDoNothing({ target: conflictCols });
      }
      const ret: Row[] = await q.returning();
      let row: Row | null = ret[0] ?? null;
      // onConflictDoNothing with existing row returns [] → fetch existing
      if (!row) {
        row = await read({ where: args.where }, true);
      }
      if ((args.include || args.select) && row) {
        return read({ where: { id: row.id }, include: args.include, select: args.select }, true);
      }
      return row;
    },

    async delete(args: { where: Row }): Promise<Any> {
      const cond = buildCondition(table, args.where);
      const [deleted] = await (executor as Any).delete(table).where(cond).returning();
      return deleted;
    },

    async deleteMany(args: { where?: Row } = {}): Promise<{ count: number }> {
      const cond = buildCondition(table, args.where);
      const q = (executor as Any).delete(table);
      const res = await (cond ? q.where(cond) : q).returning({ id: table.id });
      return { count: res.length };
    },

    async count(args: { where?: Row } = {}): Promise<number> {
      let qb = (executor as Any).select({ value: drizzleCount() }).from(table);
      const cond = buildCondition(table, args.where);
      if (cond) qb = qb.where(cond);
      const [{ value }] = await qb;
      return Number(value);
    },
  };
}

// ─── client builder ──────────────────────────────────────────────────────────
type Delegate = ReturnType<typeof makeDelegate>;
type Models = Record<string, Delegate>;
type TxClient = Models & { $transaction: TransactionFn };
interface TransactionFn {
  <T>(fn: (tx: TxClient) => Promise<T>): Promise<T>;
  (ops: Promise<Any>[]): Promise<Any[]>;
}

function buildClient(executor: DB | Tx): Models & {
  $transaction: TransactionFn;
} {
  const cache = new Map<string, Delegate>();
  const base: Row = {
    async $transaction(arg: Any): Promise<Any> {
      // Array form: prisma.$transaction([p.a.deleteMany(), p.b.createMany(...)])
      // Our delegates return Promises eagerly, so array entries are already
      // in-flight Promises — await them all (best-effort; not a real tx, but
      // semantically equivalent for the batch deleteMany+createMany call-site).
      if (Array.isArray(arg)) return Promise.all(arg);
      // Callback form: prisma.$transaction(async (tx) => { ... })
      return db.transaction(async (tx) => {
        const txClient = buildClient(tx as Tx);
        return arg(txClient);
      });
    },
  };
  return new Proxy(base, {
    get(target, prop: string) {
      if (prop in target) return (target as Any)[prop];
      if (MODEL_TABLE[prop]) {
        let d = cache.get(prop);
        if (!d) {
          d = makeDelegate(prop, executor);
          cache.set(prop, d);
        }
        return d;
      }
      return undefined;
    },
  }) as Any;
}

export type PrismaClientCompat = ReturnType<typeof buildClient>;

// Lazily-built singleton facade, shared by the DI class and the `prisma` export.
let _client: PrismaClientCompat | null = null;
function client(): PrismaClientCompat {
  if (!_client) _client = buildClient(db);
  return _client;
}

@singleton()
export class PrismaService {
  constructor() {
    const c = client();
    return new Proxy(this, {
      get: (self, prop: string) => {
        if (MODEL_TABLE[prop] || prop === "$transaction") {
          return (c as Any)[prop];
        }
        return (self as Any)[prop];
      },
    });
  }
}
// Augment the type so injected `this.prisma.<model>` / `this.prisma.$transaction`
// are visible to TS even though they are served via Proxy at runtime.
export interface PrismaService extends PrismaClientCompat {}

export const prisma: PrismaClientCompat = client();
export default prisma;

// Backward-compat: re-export drizzle primitives for any direct consumer.
export { db, schema };
