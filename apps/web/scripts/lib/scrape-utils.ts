// Helpers partagés des scrapers du pipeline data — 100% Bun natif.
// Mutualise ce que les scripts réimplémentaient ad hoc (backoff, sleeps codés en
// dur, dédup) selon les best practices du pipeline (cf. docs/data-pipeline-best-practices.md
// sections A & B) : retries à backoff exponentiel, rate-limiting par domaine
// (token bucket), fingerprint de contenu pour dédoublonner par texte normalisé.
//
// Aucune dépendance externe : fetch global / Bun.spawn / Bun.hash uniquement.

const DEFAULT_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

// ---------------------------------------------------------------------------
// 1. fetchRetry — fetch avec backoff exponentiel sur 429/5xx + timeout
// ---------------------------------------------------------------------------

export interface FetchRetryOptions {
  /** Nombre de tentatives total (défaut 3). */
  retries?: number;
  /** Délai de base en ms ; les retries attendent base * 2^(n-1) + jitter (défaut 1000). */
  baseDelayMs?: number;
  /** Timeout par tentative en ms (défaut 30000). */
  timeoutMs?: number;
  /** En-têtes supplémentaires (User-Agent par défaut si absent). */
  headers?: Record<string, string>;
  /** Méthode HTTP (défaut GET). */
  method?: string;
  /** Corps de requête éventuel. */
  body?: BodyInit;
}

/**
 * `fetch` durci : réessaie sur 429 et 5xx avec backoff exponentiel (1s/2s/4s par
 * défaut, + jitter ±20%) et coupe chaque tentative via AbortSignal.timeout. Les
 * 4xx hors 429 ne sont pas réessayés (erreur cliente définitive). Renvoie la
 * dernière `Response` obtenue ; lève seulement si toutes les tentatives ont
 * échoué au niveau réseau (jamais de Response).
 */
export async function fetchRetry(url: string, opts: FetchRetryOptions = {}): Promise<Response> {
  const retries = Math.max(1, opts.retries ?? 3);
  const baseDelay = opts.baseDelayMs ?? 1000;
  const timeoutMs = opts.timeoutMs ?? 30_000;
  const headers = { "User-Agent": DEFAULT_UA, ...(opts.headers ?? {}) };

  let lastErr: unknown = null;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        method: opts.method ?? "GET",
        headers,
        body: opts.body,
        signal: AbortSignal.timeout(timeoutMs),
      });
      // Statuts transitoires : on réessaie tant qu'il reste des tentatives.
      if ((res.status === 429 || res.status >= 500) && attempt < retries) {
        await sleep(backoffDelay(baseDelay, attempt));
        continue;
      }
      return res;
    } catch (err) {
      // Erreur réseau / timeout : réessai avec backoff, sinon on propage.
      lastErr = err;
      if (attempt < retries) {
        await sleep(backoffDelay(baseDelay, attempt));
        continue;
      }
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(`fetchRetry a échoué pour ${url}`);
}

// Délai de backoff exponentiel + jitter ±20% (évite le thundering herd).
function backoffDelay(base: number, attempt: number): number {
  const exp = base * 2 ** (attempt - 1);
  const jitter = exp * 0.2 * (Math.random() * 2 - 1);
  return Math.max(0, Math.round(exp + jitter));
}

// ---------------------------------------------------------------------------
// 1bis. curlGet — shell-out curl pour les cibles à cookie jar / TLS fingerprint
// ---------------------------------------------------------------------------

export interface CurlGetOptions {
  /** Chemin du cookie jar Netscape (lu ET réécrit via -b/-c). SECRET, hors repo. */
  jar?: string;
  /** User-Agent (défaut Chrome). */
  ua?: string;
  /** En-têtes additionnels (`Header: valeur`). */
  headers?: string[];
  /** Timeout total curl en secondes (défaut 30). */
  maxTimeSec?: number;
}

/**
 * GET via `curl` (Bun.spawn) pour les cibles nécessitant un cookie jar persistant
 * (le secret reste dans le fichier, ne transite jamais par argv visible). Renvoie
 * le corps et le code HTTP. À utiliser quand `fetchRetry` ne suffit pas (sessions
 * authentifiées, challenges à cookie de clearance).
 */
export async function curlGet(
  url: string,
  opts: CurlGetOptions = {},
): Promise<{ html: string; status: number }> {
  const ua = opts.ua ?? DEFAULT_UA;
  const args = ["curl", "-s", "--max-time", String(opts.maxTimeSec ?? 30)];
  if (opts.jar) args.push("-c", opts.jar, "-b", opts.jar);
  args.push("-A", ua);
  for (const h of opts.headers ?? []) args.push("-H", h);
  args.push("-w", "\n__HTTP_STATUS__%{http_code}", url);

  const proc = Bun.spawn(args, { stdout: "pipe", stderr: "ignore" });
  const out = await new Response(proc.stdout).text();
  await proc.exited;
  const marker = out.lastIndexOf("\n__HTTP_STATUS__");
  if (marker === -1) return { html: out, status: 0 };
  const status = Number(out.slice(marker + "\n__HTTP_STATUS__".length).trim());
  return { html: out.slice(0, marker), status };
}

// ---------------------------------------------------------------------------
// 2. RateLimiter — token bucket simple, délai mini par hôte
// ---------------------------------------------------------------------------

/**
 * Espace les requêtes par hôte : `await limiter.wait(host)` ne rend la main
 * qu'une fois le délai mini écoulé depuis le dernier appel pour cet hôte. Un
 * délai par défaut s'applique aux hôtes non configurés. Délai recommandé :
 * 3-7 s pour le crawl de contenu, 5-10 s pour les endpoints de recherche.
 */
export class RateLimiter {
  private readonly perHost: Map<string, number>;
  private readonly defaultDelay: number;
  private readonly lastHit = new Map<string, number>();

  constructor(perHostDelayMs: Record<string, number> = {}, defaultDelayMs = 3000) {
    this.perHost = new Map(Object.entries(perHostDelayMs));
    this.defaultDelay = defaultDelayMs;
  }

  /** Attend le temps nécessaire pour respecter le délai mini de cet hôte. */
  async wait(host: string): Promise<void> {
    const delay = this.perHost.get(host) ?? this.defaultDelay;
    const now = Date.now();
    const last = this.lastHit.get(host) ?? 0;
    const elapsed = now - last;
    if (elapsed < delay) await sleep(delay - elapsed);
    this.lastHit.set(host, Date.now());
  }

  /** Extrait l'hôte d'une URL (utilitaire pour appeler `wait`). */
  static hostOf(url: string): string {
    try {
      return new URL(url).host;
    } catch {
      return url;
    }
  }
}

// ---------------------------------------------------------------------------
// 3. contentFingerprint — hash stable d'un texte normalisé
// ---------------------------------------------------------------------------

/**
 * Empreinte stable d'un texte : normalise (minuscules, accents repliés, espaces
 * compactés, ponctuation retirée) puis hash via Bun.hash. Deux contenus
 * équivalents au bruit de présentation près produisent la même empreinte —
 * base de la dédup par contenu (l'URL ne suffit pas : même contenu, URLs
 * différentes ; et la pagination infinie reboucle).
 */
export function contentFingerprint(s: string): string {
  const normalized = (s ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
  return Bun.hash(normalized).toString(36);
}

// ---------------------------------------------------------------------------
// 4. dedupeByFingerprint — garde le 1er de chaque empreinte
// ---------------------------------------------------------------------------

/**
 * Dédoublonne une liste par empreinte de contenu : `keyFn` extrait le texte
 * significatif (ex. titre), `contentFingerprint` le réduit à une empreinte, on
 * garde la PREMIÈRE occurrence (l'ordre d'entrée porte la priorité — trier en
 * amont par engagement/pertinence garde la meilleure version).
 */
export function dedupeByFingerprint<T>(items: T[], keyFn: (item: T) => string): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of items) {
    const fp = contentFingerprint(keyFn(item));
    if (seen.has(fp)) continue;
    seen.add(fp);
    out.push(item);
  }
  return out;
}
