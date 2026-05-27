/*
 * -------------------------------------------------------------------------------------------------------
 * Copyright (c) Vijay Meena <vijayymmeena@gmail.com> (https://github.com/vijayymmeena). All rights reserved.
 * Licensed under the Apache License. See License.txt in the project root for license information.
 * -------------------------------------------------------------------------------------------------------
 */

export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function omitKeys<T extends object>(
  obj: T,
  keys: readonly string[],
): Partial<T> {
  const out: Record<string, unknown> = {};
  const src = obj as Record<string, unknown>;
  for (const k of Object.keys(src)) {
    if (!keys.includes(k)) {
      out[k] = src[k];
    }
  }
  return out as Partial<T>;
}

export function deepEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (
    typeof a !== "object" ||
    typeof b !== "object" ||
    a === null ||
    b === null
  ) {
    return false;
  }
  if (Array.isArray(a)) {
    if (!Array.isArray(b) || a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!deepEqual(a[i], b[i])) return false;
    }
    return true;
  }
  if (Array.isArray(b)) return false;
  const aRec = a as Record<string, unknown>;
  const bRec = b as Record<string, unknown>;
  const ka = Object.keys(aRec);
  const kb = Object.keys(bRec);
  if (ka.length !== kb.length) return false;
  for (const k of ka) {
    if (!Object.hasOwn(bRec, k)) return false;
    if (!deepEqual(aRec[k], bRec[k])) return false;
  }
  return true;
}
