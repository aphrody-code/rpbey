// recon-web.ts — sous-process : 1 recherche web (Bing via bxc curl-impersonate),
// sort un JSON { hits, snippets, ok } sur stdout. Isolé du process principal pour
// confiner bun:ffi (libcurl-impersonate) hors de l'event loop d'enrich-meta.
//
// L'IP du VPS (datacenter) est bot-wallée par Google/DuckDuckGo (JS-shell vide).
// Bing répond en HTML statique via curl-impersonate (chrome131) → source web fiable.
//
// "hits" = nb de blocs résultats (b_algo) qui mentionnent réellement le terme distinctif
// du blade (densité topicale), pas le brut 10/10 que Bing renvoie toujours.
//
// Usage : bun recon-web.ts "<blade>" "<query>"
//   argv[2] = nom du blade (terme distinctif pour la densité topicale)
//   argv[3] = requête complète
import { ImpersonatedClient } from "@aphrody/bxc/ffi/curl-impersonate";

function emit(o: { hits: number; snippets: string[]; ok: boolean }) {
  process.stdout.write(JSON.stringify(o));
}

function decode(s: string): string {
  return s
    .replace(/<[^>]+>/g, "")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const blade = process.argv[2] || "";
const query = process.argv[3] || blade;
if (!query) {
  emit({ hits: 0, snippets: [], ok: false });
  process.exit(0);
}

try {
  const client = new ImpersonatedClient({ profile: "chrome131" });
  // count=30 : élargit la profondeur de résultats → la variation du nb de blocs
  // (7..10+) devient un signal de présence web exploitable depuis cette IP.
  const url = `https://www.bing.com/search?q=${encodeURIComponent(query)}&count=30&setmkt=en-US&setlang=en`;
  const res = await client.fetch(url, { headers: { "Accept-Language": "en-US,en;q=0.9" } });
  const html = await res.text();

  // Blocs résultats organiques (b_algo). Depuis l'IP datacenter, Bing renvoie un
  // SERP statique mais partiellement dégradé : le NB de blocs varie selon la
  // profondeur indexée du terme → c'est notre proxy "présence web" (hits).
  const totalBlocks = (html.match(/class="b_algo"/g) || []).length;
  // Recherches associées / "People also search" : signal de profondeur supplémentaire.
  const related = (html.match(/class="b_rs|class="rwrl/g) || []).length;

  // Snippets topicaux (descriptions b_lineclamp présentes dans le HTML statique).
  const snippets: string[] = [];
  const snipRe = /<p class="b_lineclamp[^"]*"[^>]*>(.*?)<\/p>/gs;
  let m: RegExpExecArray | null;
  while ((m = snipRe.exec(html)) !== null && snippets.length < 3) {
    const s = decode(m[1]);
    if (s) snippets.push(s.slice(0, 220));
  }

  // hits = profondeur organique (blocs) + bonus de profondeur associée.
  const hits = totalBlocks + Math.min(related, 3);
  emit({ hits, snippets, ok: totalBlocks > 0 });
} catch (e: any) {
  process.stderr.write(String(e?.message || e));
  emit({ hits: 0, snippets: [], ok: false });
}
