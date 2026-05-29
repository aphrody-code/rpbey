/**
 * core/fetch-engine.ts — abstraction du transport bas-niveau (M5).
 *
 * Un `FetchEngine` exécute UNE requête HTTP brute et renvoie une
 * `RawHttpResponse` (status / headers / body / finalUrl). Il ne gère NI le
 * cache, NI les cookies, NI la politique de redirection : c'est `BxcTransport`
 * (couche au-dessus) qui orchestre tout ça. L'engine est volontairement le plus
 * fin possible pour rester interchangeable / testable.
 *
 * Trois implémentations :
 *   - `ImpersonatedClientEngine` — FFI bxc (libcurl-impersonate, TLS Chrome).
 *     Extrait du `ImpersonatedClient` qu'instanciait `BxcTransport`. C'est le
 *     défaut runtime (profil `chrome131`, paramétrable `chrome146`, etc.).
 *   - `NativeFetchEngine` — `globalThis.fetch`. Pour les tests / environnements
 *     sans FFI (CI sans .so, bundle Edge). Aucune impersonation TLS.
 *   - `CdpEngine` — chemin de SECOURS Cloudflare. LAZY : `request()` fait un
 *     `import()` DYNAMIQUE de `@aphrody-code/bxc` (Browser CDP, profil `stealth`)
 *     pour minter un `cf_clearance` puis lire le HTML rendu. Jamais importé en
 *     top-level pour ne pas charger le CDP (Chrome/bxc-engine) sauf besoin réel.
 */

import {
  ImpersonatedClient,
  type ImpersonateProfile,
  type ImpersonatedResponse,
} from "@aphrody-code/bxc/ffi/curl-impersonate";

// ---------------------------------------------------------------------------
// Types bas-niveau
// ---------------------------------------------------------------------------

/** Réponse HTTP brute renvoyée par un `FetchEngine`. */
export interface RawHttpResponse {
  /** Code HTTP. */
  status: number;
  /** En-têtes aplatis (clé minuscule → valeur). */
  headers: Record<string, string>;
  /** Corps en texte. */
  body: string;
  /** URL finale après les redirections suivies par l'engine. */
  finalUrl: string;
}

/** Requête bas-niveau passée à `FetchEngine.request()`. */
export interface FetchEngineRequest {
  /** Méthode HTTP. Défaut `GET`. */
  method?: string;
  /** En-têtes à injecter. */
  headers?: Record<string, string>;
  /** Cookies (chaîne `k=v; k2=v2`). */
  cookies?: string;
  /** Timeout par requête (ms). */
  timeoutMs?: number;
  /** Override du profil d'impersonation (engines qui le supportent). */
  profile?: ImpersonateProfile;
  /**
   * Suivre les redirections au niveau de l'engine. Défaut `false` :
   * `BxcTransport` gère la politique de redirection (safe-redirect) lui-même.
   */
  followRedirects?: boolean;
  /** Signal d'annulation. */
  signal?: AbortSignal;
}

/** Contrat d'un moteur de requête HTTP bas-niveau. */
export interface FetchEngine {
  request(url: string, opts?: FetchEngineRequest): Promise<RawHttpResponse>;
  close(): void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Aplatit un `Headers` Web en `Record<string,string>` (clés minuscules). */
function flattenHeaders(h: Headers): Record<string, string> {
  const out: Record<string, string> = {};
  h.forEach((v, k) => {
    out[k] = v;
  });
  return out;
}

// ---------------------------------------------------------------------------
// ImpersonatedClientEngine — FFI bxc (défaut runtime)
// ---------------------------------------------------------------------------

/** Options de `ImpersonatedClientEngine`. */
export interface ImpersonatedClientEngineOptions {
  /** Profil TLS. Défaut `chrome131`. */
  profile?: ImpersonateProfile;
  /** Timeout global (ms). Défaut 25_000. */
  timeoutMs?: number;
  /** Suivre les redirections au niveau client. Défaut `false`. */
  followRedirects?: boolean;
  /** Nombre max de redirections suivies par le client. Défaut 10. */
  maxRedirects?: number;
}

/**
 * Engine par défaut : wrappe `ImpersonatedClient` (FFI curl-impersonate). C'est
 * EXACTEMENT ce que faisait `BxcTransport` en interne — extrait ici sans changer
 * le comportement (profil `chrome131`, `followRedirects: false`, etc.).
 */
export class ImpersonatedClientEngine implements FetchEngine {
  readonly #client: ImpersonatedClient;
  readonly #defaultProfile: ImpersonateProfile;

  constructor(opts: ImpersonatedClientEngineOptions = {}) {
    this.#defaultProfile = opts.profile ?? "chrome131";
    this.#client = new ImpersonatedClient({
      profile: this.#defaultProfile,
      timeoutMs: opts.timeoutMs ?? 25_000,
      followRedirects: opts.followRedirects ?? false,
      maxRedirects: opts.maxRedirects ?? 10,
    });
  }

  async request(url: string, opts: FetchEngineRequest = {}): Promise<RawHttpResponse> {
    const res: ImpersonatedResponse = await this.#client.fetch(url, {
      method: opts.method,
      profile: opts.profile ?? this.#defaultProfile,
      cookies: opts.cookies || undefined,
      headers: opts.headers,
      timeoutMs: opts.timeoutMs,
      followRedirects: opts.followRedirects ?? false,
      signal: opts.signal,
    });
    const body = await res.text();
    return {
      status: res.status,
      headers: flattenHeaders(res.headers),
      body,
      finalUrl: res.effectiveUrl || url,
    };
  }

  close(): void {
    this.#client.close();
  }
}

// ---------------------------------------------------------------------------
// NativeFetchEngine — globalThis.fetch (tests / env sans FFI)
// ---------------------------------------------------------------------------

/** Options de `NativeFetchEngine`. */
export interface NativeFetchEngineOptions {
  /**
   * Implémentation `fetch` à utiliser. Défaut `globalThis.fetch`. Surchargeable
   * pour les tests (stub) sans toucher au global.
   */
  fetchImpl?: typeof fetch;
}

/**
 * Engine basé sur `globalThis.fetch`. Aucune impersonation TLS — destiné aux
 * tests (avec un `fetch` stubé) et aux environnements sans FFI libcurl.
 */
export class NativeFetchEngine implements FetchEngine {
  readonly #fetch: typeof fetch;

  constructor(opts: NativeFetchEngineOptions = {}) {
    this.#fetch = opts.fetchImpl ?? globalThis.fetch;
  }

  async request(url: string, opts: FetchEngineRequest = {}): Promise<RawHttpResponse> {
    const headers: Record<string, string> = { ...(opts.headers ?? {}) };
    if (opts.cookies) headers["cookie"] = opts.cookies;

    const res = await this.#fetch(url, {
      method: opts.method ?? "GET",
      headers,
      redirect: opts.followRedirects ? "follow" : "manual",
      signal: opts.signal,
    });
    const body = await res.text();
    return {
      status: res.status,
      headers: flattenHeaders(res.headers),
      body,
      finalUrl: res.url || url,
    };
  }

  // `globalThis.fetch` ne tient aucune ressource à libérer.
  close(): void {}
}

// ---------------------------------------------------------------------------
// CdpEngine — chemin de secours Cloudflare (lazy CDP)
// ---------------------------------------------------------------------------

/** Options de `CdpEngine`. */
export interface CdpEngineOptions {
  /**
   * Profil bxc pour le rendu navigateur. Défaut `"stealth"` (Chrome CDP réel,
   * suffisant pour minter un `cf_clearance`). `"max"` pour les cas les plus durs.
   */
  profile?: "fast" | "stealth" | "max";
  /** Timeout de navigation (ms). Défaut 45_000. */
  timeoutMs?: number;
}

/**
 * Engine de SECOURS Cloudflare. Quand l'impersonation HTTP échoue (challenge JS
 * non franchi), `CdpEngine` lance un vrai navigateur via `@aphrody-code/bxc`
 * (`Browser.newPage({ profile: "stealth" })`), navigue vers l'URL pour laisser
 * Cloudflare émettre un `cf_clearance`, puis renvoie le HTML rendu.
 *
 * IMPORTANT — l'import de `@aphrody-code/bxc` (qui tire le CDP / bxc-engine) est
 * DYNAMIQUE et déclenché uniquement au premier `request()`. Aucune dépendance
 * top-level : un consommateur qui n'emprunte jamais ce chemin ne charge jamais
 * le navigateur.
 *
 * Le spécifieur est construit dynamiquement (variable, pas littéral) pour que
 * `tsc` ne tire PAS l'arbre source `.ts` brut de bxc (api/cdp/…) dans son
 * programme — ce code n'est typecheckable que sous le tsconfig de bxc, pas le
 * nôtre. On type donc le module via une interface locale minimale.
 */

/** Forme minimale du module `@aphrody-code/bxc` consommée par `CdpEngine`. */
interface BxcBrowserModule {
  Browser: {
    newPage(opts: { profile: string }): Promise<{
      goto(url: string, opts?: { timeoutMs?: number }): Promise<{ status?: number; url?: string }>;
      content(): Promise<string>;
      close?(): Promise<void> | void;
    }>;
  };
}

export class CdpEngine implements FetchEngine {
  readonly #profile: "fast" | "stealth" | "max";
  readonly #timeoutMs: number;

  constructor(opts: CdpEngineOptions = {}) {
    this.#profile = opts.profile ?? "stealth";
    this.#timeoutMs = opts.timeoutMs ?? 45_000;
  }

  async request(url: string, opts: FetchEngineRequest = {}): Promise<RawHttpResponse> {
    // Import dynamique, spécifieur non littéral : ne charge le CDP qu'au besoin
    // ET empêche `tsc` de suivre la source `.ts` brute de bxc.
    const specifier = "@aphrody-code/bxc";
    const mod = (await import(/* @vite-ignore */ specifier)) as BxcBrowserModule;

    const page = await mod.Browser.newPage({ profile: this.#profile });
    try {
      const nav = await page.goto(url, {
        timeoutMs: opts.timeoutMs ?? this.#timeoutMs,
      });
      const body = await page.content();
      return {
        status: nav?.status ?? 200,
        // Le DOM rendu ne réexpose pas les en-têtes réseau ; on signale juste
        // l'origine CDP pour que la couche au-dessus sache d'où vient le corps.
        headers: { "x-bxc-engine": "cdp" },
        body,
        finalUrl: nav?.url ?? url,
      };
    } finally {
      await page.close?.();
    }
  }

  // Pas de handle long-vécu : chaque `request()` ouvre/ferme sa page.
  close(): void {}
}
