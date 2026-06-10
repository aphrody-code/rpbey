import { redirect } from "next/navigation";

/**
 * Ancienne URL de la recherche. Le moteur canonique est `/search` (entrée de
 * navigation, SEO). On redirige en préservant la requête (`?q=`).
 */
export default async function ComparateurRechercheRedirect({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const params = new URLSearchParams();
  const q = sp.q;
  if (typeof q === "string" && q) params.set("q", q);
  const qs = params.toString();
  redirect(qs ? `/search?${qs}` : "/search");
}
