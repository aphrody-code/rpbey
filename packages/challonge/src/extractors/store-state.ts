/**
 * Challonge `window._initialStoreState` extractor (shared, isomorphic).
 *
 * Challonge embeds its hydration store inline in a `<script>` tag, in one of
 * three historical layouts:
 *
 *   1. Object literal (old layout):
 *        `window._initialStoreState = { ... };`
 *   2. JSON.parse wrapper:
 *        `window._initialStoreState = JSON.parse('...');`
 *   3. Keyed assignments (current 2026 layout):
 *        `window._initialStoreState['KEY'] = { ... };`
 *        `window._initialStoreState['KEY'] = [ ... ];`
 *
 * This is the deduplicated home of the brace-counting walker that previously
 * lived (byte-identically) in `scraper.ts` (`parseStoreState`) and
 * `reverse.ts` (`extractInitialStoreState`). It is pure TS — no `server-only`,
 * no FFI, no Node/Bun built-ins — so it stays bundlable from both apps.
 *
 * `parseInitialStoreState` always returns a `Record` (empty when nothing was
 * found). Callers that need the legacy "null when empty" contract should test
 * `Object.keys(result).length`.
 */

/**
 * Parse every `window._initialStoreState` assignment from a Challonge HTML
 * page. Handles the object-literal, `JSON.parse('...')` and keyed-assignment
 * layouts. Returns an empty object when no store could be parsed.
 */
export function parseInitialStoreState(html: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  // Pattern 1: window._initialStoreState = { ... }; (object literal — old layout)
  const literalMatch = /window\._initialStoreState\s*=\s*(\{[\s\S]*?\});\s*<\/script>/.exec(html);
  if (literalMatch) {
    try {
      const parsed = JSON.parse(literalMatch[1] ?? "") as Record<string, unknown>;
      Object.assign(result, parsed);
      return result;
    } catch {
      // Fall through to next pattern
    }
  }

  // Pattern 2: window._initialStoreState = JSON.parse('...');
  const parseMatch =
    /window\._initialStoreState\s*=\s*JSON\.parse\s*\(\s*(['"`])([\s\S]*?)\1\s*\)/.exec(html);
  if (parseMatch) {
    try {
      const raw = (parseMatch[2] ?? "")
        .replace(/\\n/g, "\n")
        .replace(/\\r/g, "\r")
        .replace(/\\t/g, "\t")
        .replace(/\\'/g, "'")
        .replace(/\\"/g, '"')
        .replace(/\\\\/g, "\\");
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      Object.assign(result, parsed);
      return result;
    } catch {
      // Store not available — not fatal, fall through to keyed pattern
    }
  }

  // Pattern 3: window._initialStoreState['KEY'] = JSON_VALUE; (current 2026 layout)
  // Multiple keyed assignments. Brace-counting walker to handle nested objects
  // and string contents (skips braces/brackets inside quoted strings).
  const keyRe = /window\._initialStoreState\[\s*['"](\w+)['"]\s*\]\s*=\s*/g;
  let m: RegExpExecArray | null;
  while ((m = keyRe.exec(html)) !== null) {
    const key = m[1] ?? "";
    const valueStart = m.index + m[0].length;

    // Detect opener (object or array). Challonge serializes some stores as
    // arrays directly, e.g. _initialStoreState['LogEntryListStore'] = [...].
    let i = valueStart;
    while (i < html.length && /\s/.test(html[i] ?? "")) i++;
    const opener = html[i] ?? "";
    if (opener !== "{" && opener !== "[") {
      keyRe.lastIndex = i;
      continue;
    }
    const closer = opener === "{" ? "}" : "]";

    let depth = 0;
    let inString = false;
    let escape = false;
    for (; i < html.length; i++) {
      const ch = html[i] ?? "";
      if (escape) {
        escape = false;
        continue;
      }
      if (ch === "\\") {
        if (inString) escape = true;
        continue;
      }
      if (ch === '"' || ch === "'") {
        inString = !inString;
        continue;
      }
      if (inString) continue;
      if (ch === opener) {
        depth++;
      } else if (ch === closer) {
        depth--;
        if (depth === 0) {
          i++; // include the closing "}" or "]"
          break;
        }
      }
    }

    const raw = html.slice(valueStart, i).trim();
    try {
      result[key] = JSON.parse(raw);
    } catch {
      // malformed JSON for this key — skip silently
    }

    // Advance keyRe past the value we just consumed
    keyRe.lastIndex = i;
  }

  return result;
}

/**
 * Read a single typed store out of a parsed `_initialStoreState` map.
 * Returns `null` when the key is absent.
 */
export function getStore<T>(state: Record<string, unknown>, key: string): T | null {
  if (key in state) {
    return state[key] as T;
  }
  return null;
}
