import { EmojiEvents, OpenInNew } from "@mui/icons-material";
import {
	Avatar,
	Box,
	Button,
	Chip,
	Container,
	Link as MuiLink,
	Stack,
	Typography,
} from "@mui/material";
import { type Metadata } from "next";
import { notFound } from "next/navigation";
import { type Product, type WithContext } from "schema-dts";
import { JsonLd } from "@/components/seo/JsonLd";
import NextLink from "@/components/ui/NextLink";
import {
	type BxProductGroup,
	computeGroups,
	groupSlug,
	loadCatalog,
} from "@/lib/bx-catalog";
import { createPageMetadata, generateBreadcrumbJsonLd } from "@/lib/seo-utils";

export const dynamic = "force-static";
export const revalidate = 3600;
export const dynamicParams = true;

const REGION_LABEL: Record<string, string> = {
	FR: "France", BE: "Belgique", CH: "Suisse", UK: "Royaume-Uni",
	EU: "Europe", US: "USA", JP: "Japon", INT: "International",
};
const REGION_FLAG: Record<string, string> = {
	FR: "🇫🇷", BE: "🇧🇪", CH: "🇨🇭", UK: "🇬🇧", EU: "🇪🇺", US: "🇺🇸", JP: "🇯🇵", INT: "🌍",
};
const MEDAL = ["#FFD700", "#C0C0C0", "#CD7F32"];

const eur = (v: number | null | undefined) =>
	v == null ? "—" : new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(v);
const native = (v: number | null | undefined, c: string) =>
	v == null ? "—" : new Intl.NumberFormat("fr-FR", { style: "currency", currency: c === "?" ? "EUR" : c, maximumFractionDigits: c === "JPY" ? 0 : 2 }).format(v);

async function findGroup(slug: string): Promise<BxProductGroup | null> {
	const catalog = await loadCatalog();
	if (!catalog) return null;
	return computeGroups(catalog).find((g) => groupSlug(g) === slug) ?? null;
}

export async function generateStaticParams(): Promise<{ slug: string }[]> {
	const catalog = await loadCatalog();
	if (!catalog) return [];
	return computeGroups(catalog).map((g) => ({ slug: groupSlug(g) }));
}

export async function generateMetadata({
	params,
}: {
	params: Promise<{ slug: string }>;
}): Promise<Metadata> {
	const { slug } = await params;
	const g = await findGroup(slug);
	if (!g) return createPageMetadata({ title: "Produit introuvable | RPB", description: "", path: `/comparateur/${slug}` });
	const price = g.cheapestEur != null ? ` dès ${eur(g.cheapestEur)}` : "";
	return createPageMetadata({
		title: `Acheter ${g.name} au meilleur prix${price} | Beyblade X — RPB`,
		description: `Comparez le prix de ${g.name}${g.code ? ` (${g.code})` : ""} sur ${g.shopCount} boutiques Beyblade X (France, Europe, UK, USA, Japon).${price ? ` Meilleur prix${price}.` : ""} Trouvez où l'acheter au meilleur tarif.`,
		path: `/comparateur/${slug}`,
		image: g.cheapest?.image ?? undefined,
	});
}

export default async function ProductComparePage({
	params,
}: {
	params: Promise<{ slug: string }>;
}) {
	const { slug } = await params;
	const g = await findGroup(slug);
	if (!g) notFound();

	const prices = g.offers.map((o) => o.priceEur).filter((n): n is number => n != null);
	const low = prices.length ? Math.min(...prices) : null;
	const high = prices.length ? Math.max(...prices) : null;
	const savePct = low != null && high != null && high > low ? Math.round((1 - low / high) * 100) : 0;

	const productLd: WithContext<Product> = {
		"@context": "https://schema.org",
		"@type": "Product",
		name: g.name,
		...(g.code ? { sku: g.code, mpn: g.code } : {}),
		category: "Beyblade X",
		brand: { "@type": "Brand", name: "Takara Tomy" },
		...(g.cheapest?.image ? { image: g.cheapest.image } : {}),
		description: `${g.name}${g.code ? ` (${g.code})` : ""} — toupie Beyblade X. Comparez les prix sur ${g.shopCount} boutiques.`,
		offers: {
			"@type": "AggregateOffer",
			priceCurrency: "EUR",
			...(low != null ? { lowPrice: low } : {}),
			...(high != null ? { highPrice: high } : {}),
			offerCount: g.offers.length,
			offers: g.offers.slice(0, 30).map((o) => ({
				"@type": "Offer",
				url: o.url,
				...(o.priceEur != null ? { price: o.priceEur, priceCurrency: "EUR" } : {}),
				availability: o.available ? "https://schema.org/InStock" : "https://schema.org/LimitedAvailability",
				seller: { "@type": "Organization", name: o.shop },
			})),
		},
	};

	const accent = "var(--rpb-primary)";
	const accent2 = "var(--rpb-secondary)";

	return (
		<Box
			className="bbx-scanlines"
			sx={{
				minHeight: "100vh",
				bgcolor: "background.default",
				position: "relative",
				"&::before": {
					content: '""',
					position: "absolute",
					inset: 0,
					height: "60vh",
					background:
						"radial-gradient(ellipse 70% 50% at 50% -10%, rgba(var(--rpb-primary-rgb),0.18) 0%, transparent 70%)",
					pointerEvents: "none",
				},
			}}
		>
			<Container maxWidth="lg" sx={{ py: { xs: 2, md: 4 }, position: "relative" }}>
				<JsonLd
					data={generateBreadcrumbJsonLd([
						{ name: "Accueil", item: "/" },
						{ name: "Comparateur Beyblade X", item: "/comparateur" },
						{ name: g.name, item: `/comparateur/${slug}` },
					])}
				/>
				<JsonLd data={productLd} />

				<MuiLink component={NextLink} href="/comparateur" sx={{ fontSize: "0.8rem", color: "text.secondary", textDecoration: "none", "&:hover": { color: accent } }}>
					← Comparateur Beyblade X
				</MuiLink>

				{/* HERO — frame "champion" métallique */}
				<Box
					sx={{
						mt: 1.5,
						p: { xs: 2.5, md: 4 },
						borderRadius: 4,
						position: "relative",
						overflow: "hidden",
						border: "1px solid",
						borderColor: "divider",
						background:
							"linear-gradient(135deg, color-mix(in srgb, var(--rpb-primary) 10%, transparent), color-mix(in srgb, var(--rpb-secondary) 8%, transparent))",
						"&::after": {
							content: '""',
							position: "absolute",
							top: -80,
							right: -80,
							width: 220,
							height: 220,
							borderRadius: "50%",
							background: `conic-gradient(from 0deg, ${accent}, ${accent2}, ${accent})`,
							filter: "blur(60px)",
							opacity: 0.35,
						},
					}}
				>
					<Stack direction={{ xs: "column", md: "row" }} spacing={3} sx={{ position: "relative", alignItems: { md: "center" } }}>
						{g.cheapest?.image && (
							<Box
								sx={{
									flexShrink: 0,
									width: { xs: 120, md: 160 },
									height: { xs: 120, md: 160 },
									borderRadius: 3,
									overflow: "hidden",
									bgcolor: "rgba(0,0,0,0.25)",
									border: "1px solid",
									borderColor: "divider",
									alignSelf: { xs: "center", md: "flex-start" },
								}}
							>
								{/* eslint-disable-next-line @next/next/no-img-element */}
								<Box component="img" src={g.cheapest.image} alt={g.name} fetchPriority="high" width={160} height={160} sx={{ width: "100%", height: "100%", objectFit: "contain" }} />
							</Box>
						)}
						<Box sx={{ flex: 1, minWidth: 0 }}>
							<Stack direction="row" sx={{ alignItems: "center", gap: 1, mb: 0.5, flexWrap: "wrap" }}>
								<Chip size="small" label="BEYBLADE X" sx={{ fontWeight: 900, fontSize: "0.6rem", letterSpacing: 1, bgcolor: "color-mix(in srgb, var(--rpb-primary) 18%, transparent)", color: accent }} />
								{g.code && <Chip size="small" label={g.code} sx={{ fontWeight: 800 }} />}
							</Stack>
							<Typography component="h1" sx={{ fontWeight: 900, fontSize: { xs: "1.5rem", md: "2.3rem" }, lineHeight: 1.05, letterSpacing: "-0.03em", mb: 1.5 }}>
								Acheter {g.name}<br />
								<Box component="span" sx={{ background: `linear-gradient(135deg, ${accent}, ${accent2})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
									au meilleur prix
								</Box>
							</Typography>

							{low != null && (
								<Stack direction="row" sx={{ alignItems: "baseline", gap: 1.5, flexWrap: "wrap" }}>
									<Box>
										<Typography variant="caption" sx={{ color: "text.secondary", textTransform: "uppercase", letterSpacing: 1, fontWeight: 700, fontSize: "0.6rem" }}>Meilleur prix</Typography>
										<Typography sx={{ fontWeight: 900, fontSize: { xs: "2rem", md: "2.6rem" }, lineHeight: 1, color: "#22c55e" }}>{eur(low)}</Typography>
									</Box>
									{g.cheapest && (
										<Typography sx={{ color: "text.secondary", fontSize: "0.9rem" }}>
											chez <strong style={{ color: "var(--mui-palette-text-primary)" }}>{g.cheapest.shop}</strong> {REGION_FLAG[g.cheapest.region] ?? ""}
										</Typography>
									)}
									{savePct > 0 && (
										<Chip size="small" label={`économisez ${savePct}%`} sx={{ fontWeight: 800, bgcolor: "rgba(34,197,94,0.15)", color: "#22c55e", border: "1px solid rgba(34,197,94,0.4)" }} />
									)}
								</Stack>
							)}

							{/* Barre de spread min → max */}
							{low != null && high != null && high > low && (
								<Box sx={{ mt: 2, maxWidth: 460 }}>
									<Box sx={{ position: "relative", height: 8, borderRadius: 4, background: `linear-gradient(90deg, #22c55e, ${accent2}, #ef4444)` }}>
										<Box sx={{ position: "absolute", left: 0, top: -3, width: 14, height: 14, borderRadius: "50%", bgcolor: "#22c55e", border: "2px solid #fff", transform: "translateX(-50%)" }} />
										<Box sx={{ position: "absolute", right: 0, top: -3, width: 14, height: 14, borderRadius: "50%", bgcolor: "#ef4444", border: "2px solid #fff", transform: "translateX(50%)" }} />
									</Box>
									<Stack direction="row" sx={{ justifyContent: "space-between", mt: 0.75 }}>
										<Typography variant="caption" sx={{ color: "#22c55e", fontWeight: 700 }}>min {eur(low)}</Typography>
										<Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 600 }}>{g.shopCount} boutiques</Typography>
										<Typography variant="caption" sx={{ color: "#ef4444", fontWeight: 700 }}>max {eur(high)}</Typography>
									</Stack>
								</Box>
							)}
						</Box>
					</Stack>
				</Box>

				{/* OFFRES — podium médaillé */}
				<Typography variant="h6" sx={{ fontWeight: 900, mt: 4, mb: 1.5, letterSpacing: "-0.01em" }}>
					Toutes les offres ({g.offers.length})
				</Typography>
				<Stack spacing={1}>
					{g.offers.map((o, i) => {
						const medal = MEDAL[i];
						return (
							<Box
								key={`${o.domain}-${i}`}
								sx={{
									display: "flex",
									alignItems: "center",
									gap: { xs: 1, md: 2 },
									p: { xs: 1.25, md: 1.75 },
									borderRadius: 3,
									border: "1px solid",
									borderColor: i === 0 ? "rgba(34,197,94,0.45)" : "divider",
									background: i === 0 ? "rgba(34,197,94,0.07)" : "var(--mui-palette-surface-high, rgba(255,255,255,0.02))",
									transition: "transform .2s, border-color .2s",
									"&:hover": { transform: "translateX(4px)", borderColor: accent },
								}}
							>
								<Box sx={{ width: 34, textAlign: "center", flexShrink: 0 }}>
									{medal ? (
										<EmojiEvents sx={{ color: medal, fontSize: 26, filter: `drop-shadow(0 0 4px ${medal}80)` }} />
									) : (
										<Typography sx={{ fontWeight: 800, color: "text.secondary", fontSize: "0.85rem" }}>#{i + 1}</Typography>
									)}
								</Box>
								<Avatar src={o.image ?? undefined} alt={o.shop} variant="rounded" sx={{ width: 40, height: 40, bgcolor: "rgba(0,0,0,0.2)", flexShrink: 0, display: { xs: "none", sm: "flex" } }}>
									{o.shop.slice(0, 2)}
								</Avatar>
								<Box sx={{ flex: 1, minWidth: 0 }}>
									<Typography noWrap sx={{ fontWeight: i === 0 ? 800 : 600, fontSize: "0.9rem" }}>{o.shop}</Typography>
									<Typography variant="caption" sx={{ color: "text.secondary" }}>
										{REGION_FLAG[o.region] ?? ""} {REGION_LABEL[o.region] ?? o.region}
									</Typography>
								</Box>
								<Box sx={{ textAlign: "right", flexShrink: 0 }}>
									<Typography sx={{ fontWeight: 900, fontSize: { xs: "1rem", md: "1.2rem" }, color: i === 0 ? "#22c55e" : "text.primary", lineHeight: 1 }}>{eur(o.priceEur)}</Typography>
									{o.currency !== "EUR" && <Typography variant="caption" sx={{ color: "text.secondary" }}>{native(o.price, o.currency)}</Typography>}
								</Box>
								<Button
									component={MuiLink}
									href={o.url}
									target="_blank"
									rel="noopener noreferrer nofollow sponsored"
									variant={i === 0 ? "contained" : "outlined"}
									size="small"
									endIcon={<OpenInNew sx={{ fontSize: "14px !important" }} />}
									sx={{
										flexShrink: 0,
										borderRadius: 2,
										textTransform: "none",
										fontWeight: 700,
										...(i === 0
											? { background: `linear-gradient(135deg, ${accent}, ${accent2})`, color: "#fff" }
											: { borderColor: "color-mix(in srgb, var(--rpb-primary) 40%, transparent)", color: accent }),
									}}
								>
									Voir
								</Button>
							</Box>
						);
					})}
				</Stack>

				<Typography variant="caption" sx={{ color: "text.secondary", display: "block", mt: 3, opacity: 0.6 }}>
					Prix convertis en € à titre indicatif (taux approximatifs). Vérifiez le prix final sur la boutique. Liens marchands.
				</Typography>
			</Container>
		</Box>
	);
}
