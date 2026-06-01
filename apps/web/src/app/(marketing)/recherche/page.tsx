import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/** Alias FR → route canonique `/search` (préserve `?q=`). */
export default async function RechercheAlias({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const params = new URLSearchParams();
  if (typeof sp.q === "string" && sp.q) params.set("q", sp.q);
  const qs = params.toString();
  redirect(qs ? `/search?${qs}` : "/search");
}
