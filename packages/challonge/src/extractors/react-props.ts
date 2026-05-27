/**
 * Extract React component props from a Challonge HTML page.
 *
 * Challonge mounts each interactive component with the pattern:
 *
 *   <div data-react-class="LogEntriesController"
 *        data-react-props="&quot;{&quot;entries&quot;:[…]}&quot;"
 *        data-react-cache-id="LogEntriesController-0">
 *
 * The `data-react-props` attribute holds the COMPLETE props payload as JSON
 * (HTML-entity-encoded). Parsing the DOM + decoding gives us the same data
 * the React app uses, without running JS.
 *
 * Confirmed components (BTS4 sample):
 *   - LogEntriesController       /log
 *   - StandingsController        /standings
 *   - ParticipantsController     /participants
 *   - StationsController         /stations
 *   - PredictionsController      /predictions
 *   - AnnouncementsController    /announcements
 *   - BracketController          /module
 *   - TournamentHeaderController /
 *
 * Implementation: uses Bun's native HTMLRewriter (lol-html, C bindings).
 * Benchmarked 8–20x faster than node-html-parser on real BTS4 fixtures
 * (61–248KB HTML), zero npm deps.
 */

const ENTITY_DECODE: Record<string, string> = {
	"&quot;": '"',
	"&apos;": "'",
	"&amp;": "&",
	"&lt;": "<",
	"&gt;": ">",
	"&#39;": "'",
	"&#x27;": "'",
	"&#x2F;": "/",
};

function decodeEntities(s: string): string {
	return s.replace(
		/&(?:quot|apos|amp|lt|gt|#39|#x27|#x2F);/g,
		(m) => ENTITY_DECODE[m] ?? m,
	);
}

export interface ReactRoot<T = unknown> {
	/** Component name (e.g. "LogEntriesController"). */
	className: string;
	/** Cache ID, useful when several roots share the same component class. */
	cacheId?: string | null;
	/** Decoded JSON payload — `null` if parsing failed. */
	props: T | null;
	/** Raw, still-encoded attribute value. */
	rawProps: string;
}

/**
 * Find every React mount point in the HTML and decode its props.
 *
 * @example
 *   const roots = extractReactRoots<{ entries: Array<{...}> }>(html);
 *   const log = roots.find(r => r.className === "LogEntriesController");
 *   for (const e of log?.props?.entries ?? []) console.log(e);
 */
export function extractReactRoots<T = unknown>(html: string): ReactRoot<T>[] {
	const out: ReactRoot<T>[] = [];
	new HTMLRewriter()
		.on("[data-react-class]", {
			element(el) {
				const className = el.getAttribute("data-react-class") ?? "";
				const rawProps = el.getAttribute("data-react-props") ?? "";
				const cacheId = el.getAttribute("data-react-cache-id") ?? null;
				let props: T | null = null;
				try {
					const decoded = decodeEntities(rawProps);
					props = decoded ? (JSON.parse(decoded) as T) : null;
				} catch {
					props = null;
				}
				out.push({ className, cacheId, props, rawProps });
			},
		})
		.transform(html);
	return out;
}

/** Convenience: get the first root matching a component class. */
export function getReactRoot<T = unknown>(
	html: string,
	className: string,
): ReactRoot<T> | null {
	return (
		extractReactRoots<T>(html).find((r) => r.className === className) ?? null
	);
}

/**
 * Read a `data-foo` attribute set on a top-level container (Challonge sets a
 * lot of metadata that way: `data-tournament-id`, `data-tournament-type`,
 * `data-rankings`, `data-rounds`, etc.).
 *
 * The `selector` must be a CSS selector supported by HTMLRewriter / lol-html
 * (tag, `#id`, `.class`, `[attr]` and combinations). The default is `"body"`.
 */
export function readDataAttrs(
	html: string,
	selector = "body",
): Record<string, string> {
	const out: Record<string, string> = {};
	new HTMLRewriter()
		.on(selector, {
			element(el) {
				for (const [k, v] of el.attributes) {
					if (k.startsWith("data-")) out[k.slice(5)] = v;
				}
			},
		})
		.transform(html);
	return out;
}

// ─── Typed projections of known components ──────────────────────────────────

/** Raw entry shape from LogEntriesController.entries OR _initialStoreState.LogEntryListStore. */
export interface ChallongeRawLogEntry {
	id?: number;
	key?: string;
	created_at?: string;
	timestamp?: string;
	type?: string;
	action?: string;
	description?: string;
	message?: string;
	user?: { id?: number; name?: string };
	owner?: {
		username?: string;
		portrait_url?: string;
		premier?: boolean;
	} | null;
	trackable?: Record<string, unknown> | null;
	textParams?: Record<string, unknown>;
	text?: string | null;
	tournament_id?: number;
	[key: string]: unknown;
}

export interface LogEntriesProps {
	entries?: ChallongeRawLogEntry[];
	pagination?: { page: number; per_page: number; total: number };
}

export interface StandingsProps {
	standings?: Array<{
		rank: number;
		name?: string;
		display_name?: string;
		username?: string | null;
		wins?: number;
		losses?: number;
		points?: number;
	}>;
}

export interface ParticipantsProps {
	participants?: Array<{
		id: number;
		display_name?: string;
		name?: string;
		username?: string | null;
		final_rank?: number | null;
		seed?: number;
		portrait_url?: string | null;
		attached_participatable_portrait_url?: string | null;
	}>;
	rankings?: unknown;
	tournament?: { id: number; name: string; state: string };
}
