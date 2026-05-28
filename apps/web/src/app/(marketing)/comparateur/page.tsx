import { LocalFireDepartment, Storefront } from "@mui/icons-material";
import {
	Box,
	Chip,
	Container,
	Link as MuiLink,
	Stack,
	Typography,
} from "@mui/material";
import { type Metadata } from "next";
import { type ItemList, type WithContext } from "schema-dts";
import { JsonLd } from "@/components/seo/JsonLd";
import NextLink from "@/components/ui/NextLink";
import {
	type BxProductGroup,
	computeGroups,
	groupSlug,
	loadCatalog,
} from "@/lib/bx-catalog";
import {
	createPageMetadata,
	generateBreadcrumbJsonLd,
} from "@/lib/seo-utils";
import { ComparateurClient } from "./_components/ComparateurClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = createPageMetadata({
	title: "Comparateur de prix Beyblade X — toupies, lanceurs, stades | RPB",
	description:
		"Comparez les prix Beyblade X sur 100+ boutiques (France, Europe, UK, USA, Japon). Trouvez le meilleur prix pour chaque toupie, lanceur, ratchet, bit et stade. Mis à jour en continu.",
	path: "/comparateur",
});

const SITE = "https://rpbey.fr";
const eur = (v: number | null | undefined) =>
	v == null ? "—" : new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(v);

function savePct(g: BxProductGroup): number {
	const ps = g.offers.map((o) => o.priceEur).filter((n): n is number => n != null);
	if (ps.length < 2) return 0;
	const lo = Math.min(...ps), hi = Math.max(...ps);
	return hi > lo ? Math.round((1 - lo / hi) * 100) : 0;
}

export default async function ComparateurPage() {
	const catalog = await loadCatalog();
	const groups: BxProductGroup[] = catalog ? computeGroups(catalog) : [];
	for (const g of groups) g.slug = groupSlug(g);

	const countries = catalog ? new Set(catalog.shops.map((s) => s.region)).size : 0;
	const topDeals = [...groups]
		.filter((g) => g.shopCount >= 3 && g.cheapestEur != null)
		.sort((a, b) => savePct(b) - savePct(a))
		.slice(0, 6);

	const itemList: WithContext<ItemList> | null =
		groups.length >= 3
			? {
					"@context": "https://schema.org",
					"@type": "ItemList",
					name: "Comparateur de prix Beyblade X",
					numberOfItems: groups.length,
					itemListElement: groups.slice(0, 100).map((g, i) => ({
						"@type": "ListItem",
						position: i + 1,
						url: `${SITE}/comparateur/${g.slug}`,
						name: g.name,
					})),
				}
			: null;

	const accent = "var(--rpb-primary)";
	const accent2 = "var(--rpb-secondary)";

	return (
		<Box sx={{ minHeight: "100vh", bgcolor: "background.default" }}>
			<JsonLd
				data={generateBreadcrumbJsonLd([
					{ name: "Accueil", item: "/" },
					{ name: "Comparateur Beyblade X", item: "/comparateur" },
				])}
			/>
			{itemList && <JsonLd data={itemList} />}

			{/* HERO */}
			<Box
				className="bbx-scanlines"
				sx={{
					position: "relative",
					overflow: "hidden",
					borderBottom: "1px solid",
					borderColor: "divider",
					"&::before": {
						content: '""',
						position: "absolute",
						inset: 0,
						background:
							"radial-gradient(ellipse 60% 80% at 50% -20%, rgba(var(--rpb-primary-rgb),0.22) 0%, transparent 65%)",
						pointerEvents: "none",
					},
				}}
			>
				<Container maxWidth="xl" sx={{ py: { xs: 3, md: 5 }, position: "relative" }}>
					<Chip
						size="small"
						label="100% BEYBLADE X · PRIX EN DIRECT"
						sx={{ fontWeight: 900, fontSize: "0.6rem", letterSpacing: 1.2, mb: 1.5, bgcolor: "color-mix(in srgb, var(--rpb-primary) 16%, transparent)", color: accent, border: "1px solid color-mix(in srgb, var(--rpb-primary) 30%, transparent)" }}
					/>
					<Typography
						component="h1"
						sx={{ fontWeight: 900, fontSize: { xs: "2rem", md: "3.4rem" }, lineHeight: 0.98, letterSpacing: "-0.04em", maxWidth: 900 }}
					>
						Le comparateur de prix{" "}
						<Box component="span" sx={{ background: `linear-gradient(135deg, ${accent}, ${accent2})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
							Beyblade X
						</Box>
					</Typography>
					<Typography sx={{ color: "text.secondary", mt: 1.5, maxWidth: 680, fontSize: { xs: "0.9rem", md: "1.05rem" } }}>
						Toupies, lanceurs, ratchets, bits et stades comparés sur 100+ boutiques — France, Europe, UK, USA, Japon. Trouve le meilleur prix, en direct.
					</Typography>
					{catalog && (
						<Stack direction="row" spacing={{ xs: 2, md: 4 }} sx={{ mt: 3, flexWrap: "wrap", rowGap: 1.5 }}>
							{[
								{ n: catalog.productCount.toLocaleString("fr-FR"), l: "offres comparées" },
								{ n: catalog.shopCount, l: "boutiques" },
								{ n: groups.length, l: "produits" },
								{ n: countries, l: "pays" },
							].map((s) => (
								<Box key={s.l}>
									<Typography sx={{ fontWeight: 900, fontSize: { xs: "1.4rem", md: "2rem" }, lineHeight: 1, background: `linear-gradient(135deg, ${accent}, ${accent2})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
										{s.n}
									</Typography>
									<Typography variant="caption" sx={{ color: "text.secondary", textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 700, fontSize: "0.6rem" }}>
										{s.l}
									</Typography>
								</Box>
							))}
						</Stack>
					)}
				</Container>
			</Box>

			<Container maxWidth="xl" sx={{ py: { xs: 2.5, md: 4 } }}>
				{/* TOP DEALS */}
				{topDeals.length > 0 && (
					<Box sx={{ mb: 4 }}>
						<Stack direction="row" sx={{ alignItems: "center", gap: 1, mb: 1.5 }}>
							<LocalFireDepartment sx={{ color: accent2 }} />
							<Typography variant="h6" sx={{ fontWeight: 900, letterSpacing: "-0.01em" }}>
								Meilleurs deals du moment
							</Typography>
						</Stack>
						<Box
							sx={{
								display: "grid",
								gridTemplateColumns: { xs: "repeat(2,1fr)", sm: "repeat(3,1fr)", md: "repeat(6,1fr)" },
								gap: 1.5,
							}}
						>
							{topDeals.map((g) => {
								const pct = savePct(g);
								return (
									<MuiLink
										key={g.slug}
										component={NextLink}
										href={`/comparateur/${g.slug}`}
										sx={{
											textDecoration: "none",
											p: 1.5,
											borderRadius: 3,
											border: "1px solid",
											borderColor: "divider",
											bgcolor: "surface.high",
											display: "flex",
											flexDirection: "column",
											gap: 0.5,
											transition: "transform .2s, border-color .2s, box-shadow .2s",
											"&:hover": { transform: "translateY(-4px)", borderColor: accent, boxShadow: `0 8px 24px color-mix(in srgb, var(--rpb-primary) 20%, transparent)` },
										}}
									>
										<Box sx={{ aspectRatio: "1", borderRadius: 2, bgcolor: "rgba(0,0,0,0.2)", mb: 0.5, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
											{g.cheapest?.image ? (
												// eslint-disable-next-line @next/next/no-img-element
												<Box component="img" src={g.cheapest.image} alt={g.name} loading="lazy" sx={{ width: "100%", height: "100%", objectFit: "contain" }} />
											) : (
												<Storefront sx={{ color: "text.disabled", fontSize: 32 }} />
											)}
										</Box>
										<Typography noWrap sx={{ fontWeight: 700, fontSize: "0.78rem", color: "text.primary" }}>{g.name}</Typography>
										<Stack direction="row" sx={{ alignItems: "baseline", justifyContent: "space-between" }}>
											<Typography sx={{ fontWeight: 900, color: "#22c55e", fontSize: "0.95rem" }}>{eur(g.cheapestEur)}</Typography>
											{pct > 0 && <Chip size="small" label={`-${pct}%`} sx={{ height: 18, fontSize: "0.6rem", fontWeight: 800, bgcolor: "rgba(34,197,94,0.15)", color: "#22c55e" }} />}
										</Stack>
										<Typography variant="caption" sx={{ color: "text.secondary", fontSize: "0.62rem" }}>{g.shopCount} boutiques</Typography>
									</MuiLink>
								);
							})}
						</Box>
					</Box>
				)}

				{catalog ? (
					<ComparateurClient
						products={catalog.products}
						shops={catalog.shops}
						groups={groups}
						generatedAt={catalog.generatedAt}
					/>
				) : (
					<Typography sx={{ color: "text.secondary", py: 6, textAlign: "center" }}>
						Le catalogue n'est pas encore disponible.
					</Typography>
				)}
			</Container>
		</Box>
	);
}
