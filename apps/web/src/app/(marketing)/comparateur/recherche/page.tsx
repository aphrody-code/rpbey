import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/**
 * Ancienne URL de la recherche. Le moteur canonique est `/search` (entrée de
 * navigation, SEO). On redirige en préservant la requête (`?q=`, `?mode=ai`).
 */
export default async function ComparateurRechercheRedirect({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const params = new URLSearchParams();
  const q = sp.q;
  const mode = sp.mode;
  if (typeof q === "string" && q) params.set("q", q);
  if (typeof mode === "string" && mode) params.set("mode", mode);
  const qs = params.toString();
  redirect(qs ? `/search?${qs}` : "/search");
}
