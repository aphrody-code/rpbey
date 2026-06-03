import { describe, expect, test } from "bun:test";
import { z } from "zod";

import {
  ApiErrorSchema,
  ErrorEnvelopeSchema,
  IsoDateSchema,
  PaginationMetaSchema,
  PaginationQuerySchema,
  okEnvelope,
  paginated,
} from "../src/envelope";

// Validation runtime de l'enveloppe REST `/api/v1` — schémas Zod, ZÉRO réseau.
// On parse de vraies instances valides/invalides et on asserte `safeParse().success`.

describe("okEnvelope", () => {
  const env = okEnvelope(z.object({ value: z.number() }));

  test("accepte { ok:true, data } conforme", () => {
    const r = env.safeParse({ ok: true, data: { value: 42 } });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.data.value).toBe(42);
  });

  test("rejette { ok:false }", () => {
    expect(env.safeParse({ ok: false, data: { value: 1 } }).success).toBe(false);
  });

  test("rejette un data non conforme au schéma interne", () => {
    expect(env.safeParse({ ok: true, data: { value: "nope" } }).success).toBe(false);
  });

  test("rejette l'absence de data", () => {
    expect(env.safeParse({ ok: true }).success).toBe(false);
  });
});

describe("ErrorEnvelopeSchema", () => {
  test("accepte { ok:false, error:{ code, message } }", () => {
    const r = ErrorEnvelopeSchema.safeParse({
      ok: false,
      error: { code: "NOT_FOUND", message: "introuvable" },
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.error.code).toBe("NOT_FOUND");
  });

  test("rejette un error sans code", () => {
    expect(
      ErrorEnvelopeSchema.safeParse({ ok: false, error: { message: "oups" } }).success,
    ).toBe(false);
  });

  test("rejette ok:true", () => {
    expect(
      ErrorEnvelopeSchema.safeParse({ ok: true, error: { code: "X", message: "y" } }).success,
    ).toBe(false);
  });

  test("ApiErrorSchema exige code ET message strings", () => {
    expect(ApiErrorSchema.safeParse({ code: "E", message: "m" }).success).toBe(true);
    expect(ApiErrorSchema.safeParse({ code: 1, message: "m" }).success).toBe(false);
  });
});

describe("paginated", () => {
  const env = paginated(z.object({ id: z.number() }));

  test("valide { items, pagination } complet", () => {
    const r = env.safeParse({
      items: [{ id: 1 }, { id: 2 }],
      pagination: { total: 2, page: 1, pageSize: 50, pageCount: 1 },
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.items).toHaveLength(2);
      expect(r.data.pagination.total).toBe(2);
    }
  });

  test("rejette items non conformes à l'item schema", () => {
    expect(
      env.safeParse({
        items: [{ id: "x" }],
        pagination: { total: 1, page: 1, pageSize: 50, pageCount: 1 },
      }).success,
    ).toBe(false);
  });

  test("rejette une pagination incomplète (pageCount manquant)", () => {
    expect(
      env.safeParse({
        items: [],
        pagination: { total: 0, page: 1, pageSize: 50 },
      }).success,
    ).toBe(false);
  });
});

describe("PaginationMetaSchema", () => {
  test("rejette page non positive (page:0)", () => {
    expect(
      PaginationMetaSchema.safeParse({ total: 0, page: 0, pageSize: 50, pageCount: 0 }).success,
    ).toBe(false);
  });

  test("rejette total négatif", () => {
    expect(
      PaginationMetaSchema.safeParse({ total: -1, page: 1, pageSize: 50, pageCount: 0 }).success,
    ).toBe(false);
  });
});

describe("PaginationQuerySchema", () => {
  test("coerce les strings d'URL en nombres", () => {
    const r = PaginationQuerySchema.parse({ page: "3", pageSize: "25" });
    expect(r.page).toBe(3);
    expect(r.pageSize).toBe(25);
  });

  test("applique les défauts (page=1, pageSize=50) quand absent", () => {
    const r = PaginationQuerySchema.parse({});
    expect(r.page).toBe(1);
    expect(r.pageSize).toBe(50);
  });

  test("rejette pageSize > 200", () => {
    expect(PaginationQuerySchema.safeParse({ pageSize: "201" }).success).toBe(false);
  });

  test("accepte pageSize == 200 (borne incluse)", () => {
    const r = PaginationQuerySchema.parse({ pageSize: "200" });
    expect(r.pageSize).toBe(200);
  });

  test("rejette page == 0 (positive requis)", () => {
    expect(PaginationQuerySchema.safeParse({ page: "0" }).success).toBe(false);
  });
});

describe("IsoDateSchema", () => {
  test("accepte une string ISO 8601", () => {
    const r = IsoDateSchema.safeParse("2026-06-04T12:00:00.000Z");
    expect(r.success).toBe(true);
    if (r.success) expect(r.data).toBe("2026-06-04T12:00:00.000Z");
  });

  test("rejette un objet Date (le contrat ne voit jamais d'objet Date sur le fil)", () => {
    expect(IsoDateSchema.safeParse(new Date()).success).toBe(false);
  });
});
