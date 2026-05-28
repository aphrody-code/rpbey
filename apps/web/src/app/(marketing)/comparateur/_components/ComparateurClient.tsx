"use client";

import { OpenInNew } from "@mui/icons-material";
import {
	Box,
	Chip,
	Dialog,
	DialogContent,
	DialogTitle,
	Link as MuiLink,
	MenuItem,
	Stack,
	Tab,
	Tabs,
	TextField,
	Typography,
} from "@mui/material";
import { DataGrid, type GridColDef } from "@mui/x-data-grid";
import Fuse from "fuse.js";
import Link from "next/link";
import { useMemo, useState } from "react";
import type {
	BxProduct,
	BxProductGroup,
	BxShop,
} from "./types";

interface Props {
	products: BxProduct[];
	shops: BxShop[];
	groups: BxProductGroup[];
	generatedAt: string;
}

const REGION_LABEL: Record<string, string> = {
	FR: "France", BE: "Belgique", CH: "Suisse", UK: "Royaume-Uni",
	EU: "Europe", US: "USA", JP: "Japon", INT: "International",
};

const TYPE_LABEL: Record<string, string> = {
	specialist: "Spécialiste", marketplace: "Marketplace",
	retailer: "Enseigne", official: "Officiel", import: "Import JP",
};

const fmtPrice = (v: number | null | undefined, currency: string) =>
	v == null
		? "—"
		: new Intl.NumberFormat("fr-FR", {
				style: "currency",
				currency: currency === "?" ? "EUR" : currency,
				maximumFractionDigits: currency === "JPY" ? 0 : 2,
			}).format(v);

const fmtEur = (v: number | null | undefined) =>
	v == null ? "—" : new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(v);

export function ComparateurClient({ products, shops, groups, generatedAt }: Props) {
	const [tab, setTab] = useState(0);
	const [search, setSearch] = useState("");
	const [region, setRegion] = useState("all");
	const [openGroup, setOpenGroup] = useState<BxProductGroup | null>(null);

	const regions = useMemo(
		() => [...new Set(shops.map((s) => s.region))].sort(),
		[shops],
	);

	// ── Fuse indexes ──
	const productFuse = useMemo(
		() => new Fuse(products, { keys: ["title", "shop"], threshold: 0.38, ignoreLocation: true }),
		[products],
	);
	const groupFuse = useMemo(
		() => new Fuse(groups, { keys: ["name", "code"], threshold: 0.38, ignoreLocation: true }),
		[groups],
	);

	// ── filtered datasets ──
	const filteredProducts = useMemo(() => {
		let list = search.trim() ? productFuse.search(search).map((r) => r.item) : products;
		if (region !== "all") list = list.filter((p) => p.region === region);
		return list.map((p, i) => ({ id: `${p.domain}-${i}`, ...p }));
	}, [products, productFuse, search, region]);

	const filteredGroups = useMemo(() => {
		let list = search.trim() ? groupFuse.search(search).map((r) => r.item) : groups;
		if (region !== "all")
			list = list.filter((g) => g.offers.some((o) => o.region === region));
		return list.map((g, i) => ({ id: `${g.key}-${i}`, ...g }));
	}, [groups, groupFuse, search, region]);

	const filteredShops = useMemo(() => {
		let list = shops;
		if (search.trim())
			list = list.filter((s) => s.name.toLowerCase().includes(search.toLowerCase()) || s.domain.includes(search.toLowerCase()));
		if (region !== "all") list = list.filter((s) => s.region === region);
		return list.map((s, i) => ({ id: `${s.domain}-${i}`, ...s }));
	}, [shops, search, region]);

	// ── columns ──
	const groupCols: GridColDef[] = [
		{
			field: "name",
			headerName: "Produit",
			flex: 2,
			minWidth: 220,
			renderCell: (p) => {
				const g = p.row as BxProductGroup;
				return g.slug ? (
					<MuiLink component={Link} href={`/comparateur/${g.slug}`} sx={{ color: "inherit", fontWeight: 600, "&:hover": { color: "primary.main" } }}>
						{g.name}
					</MuiLink>
				) : (
					g.name
				);
			},
		},
		{
			field: "code",
			headerName: "Code",
			width: 90,
			renderCell: (p) => (p.value ? <Chip size="small" label={p.value} sx={{ fontWeight: 700 }} /> : "—"),
		},
		{ field: "shopCount", headerName: "Boutiques", width: 100, type: "number" },
		{
			field: "cheapestEur",
			headerName: "Meilleur prix",
			width: 130,
			type: "number",
			renderCell: (p) => (
				<Typography sx={{ fontWeight: 800, color: "success.main" }}>{fmtEur(p.value as number)}</Typography>
			),
		},
		{
			field: "cheapest",
			headerName: "Moins cher chez",
			flex: 1,
			minWidth: 160,
			sortable: false,
			renderCell: (p) => {
				const g = p.row as BxProductGroup;
				return g.cheapest ? (
					<MuiLink href={g.cheapest.url} target="_blank" rel="noopener noreferrer" sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
						{g.cheapest.shop} <OpenInNew sx={{ fontSize: 13 }} />
					</MuiLink>
				) : "—";
			},
		},
	];

	const productCols: GridColDef[] = [
		{
			field: "title",
			headerName: "Produit",
			flex: 2,
			minWidth: 240,
			renderCell: (p) => (
				<MuiLink href={(p.row as BxProduct).url} target="_blank" rel="noopener noreferrer" sx={{ color: "inherit", "&:hover": { color: "primary.main" } }}>
					{p.value as string}
				</MuiLink>
			),
		},
		{ field: "shop", headerName: "Boutique", flex: 1, minWidth: 150 },
		{
			field: "region",
			headerName: "Région",
			width: 120,
			renderCell: (p) => REGION_LABEL[p.value as string] ?? p.value,
		},
		{
			field: "priceEur",
			headerName: "Prix ≈ €",
			width: 110,
			type: "number",
			renderCell: (p) => <Typography sx={{ fontWeight: 700 }}>{fmtEur(p.value as number)}</Typography>,
		},
		{
			field: "price",
			headerName: "Prix (devise)",
			width: 130,
			type: "number",
			renderCell: (p) => fmtPrice(p.value as number, (p.row as BxProduct).currency),
		},
		{
			field: "available",
			headerName: "Stock",
			width: 90,
			renderCell: (p) =>
				p.value ? <Chip size="small" color="success" label="Oui" variant="outlined" /> : <Chip size="small" label="?" variant="outlined" />,
		},
	];

	const shopCols: GridColDef[] = [
		{
			field: "name",
			headerName: "Boutique",
			flex: 1.5,
			minWidth: 180,
			renderCell: (p) => (
				<MuiLink href={(p.row as BxShop).url} target="_blank" rel="noopener noreferrer" sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
					{p.value as string} <OpenInNew sx={{ fontSize: 13 }} />
				</MuiLink>
			),
		},
		{ field: "domain", headerName: "Domaine", flex: 1, minWidth: 160 },
		{ field: "region", headerName: "Région", width: 120, renderCell: (p) => REGION_LABEL[p.value as string] ?? p.value },
		{ field: "type", headerName: "Type", width: 130, renderCell: (p) => TYPE_LABEL[p.value as string] ?? p.value },
		{ field: "productCount", headerName: "Produits scrapés", width: 140, type: "number" },
	];

	const gridSx = {
		bgcolor: "surface.high",
		borderColor: "divider",
		borderRadius: 2,
		"& .MuiDataGrid-columnHeaders": { bgcolor: "surface.highest", fontWeight: 800 },
	} as const;

	return (
		<Box>
			{/* Filtres */}
			<Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ mb: 2 }}>
				<TextField
					size="small"
					placeholder="Rechercher (ex: Dran Sword, 3-60F, lanceur…)"
					value={search}
					onChange={(e) => setSearch(e.target.value)}
					sx={{ flex: 1, maxWidth: { sm: 420 } }}
				/>
				<TextField
					select
					size="small"
					label="Région"
					value={region}
					onChange={(e) => setRegion(e.target.value)}
					sx={{ minWidth: 160 }}
				>
					<MenuItem value="all">Toutes</MenuItem>
					{regions.map((r) => (
						<MenuItem key={r} value={r}>
							{REGION_LABEL[r] ?? r}
						</MenuItem>
					))}
				</TextField>
			</Stack>

			<Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }} variant="scrollable" scrollButtons="auto">
				<Tab label={`Meilleurs prix (${filteredGroups.length})`} />
				<Tab label={`Tous les produits (${filteredProducts.length})`} />
				<Tab label={`Boutiques (${filteredShops.length})`} />
			</Tabs>

			{tab === 0 && (
				<DataGrid
					rows={filteredGroups}
					columns={groupCols}
					density="compact"
					sx={gridSx}
					initialState={{ pagination: { paginationModel: { pageSize: 50 } } }}
					pageSizeOptions={[25, 50, 100]}
					onRowClick={(p) => setOpenGroup(p.row as BxProductGroup)}
					disableRowSelectionOnClick
					autoHeight
				/>
			)}
			{tab === 1 && (
				<DataGrid
					rows={filteredProducts}
					columns={productCols}
					density="compact"
					sx={gridSx}
					initialState={{
						pagination: { paginationModel: { pageSize: 50 } },
						sorting: { sortModel: [{ field: "priceEur", sort: "asc" }] },
					}}
					pageSizeOptions={[25, 50, 100]}
					disableRowSelectionOnClick
					autoHeight
				/>
			)}
			{tab === 2 && (
				<DataGrid
					rows={filteredShops}
					columns={shopCols}
					density="compact"
					sx={gridSx}
					initialState={{
						pagination: { paginationModel: { pageSize: 50 } },
						sorting: { sortModel: [{ field: "productCount", sort: "desc" }] },
					}}
					pageSizeOptions={[25, 50, 100]}
					disableRowSelectionOnClick
					autoHeight
				/>
			)}

			<Typography variant="caption" sx={{ color: "text.secondary", display: "block", mt: 2, opacity: 0.6 }}>
				Données mises à jour le {new Date(generatedAt).toLocaleString("fr-FR")} · prix convertis en € à titre indicatif (taux approximatifs).
			</Typography>

			{/* Dialog détail produit */}
			<Dialog open={!!openGroup} onClose={() => setOpenGroup(null)} maxWidth="sm" fullWidth>
				<DialogTitle>
					{openGroup?.name}
					{openGroup?.code && <Chip size="small" label={openGroup.code} sx={{ ml: 1, fontWeight: 700 }} />}
				</DialogTitle>
				<DialogContent>
					<Stack spacing={1}>
						{openGroup?.offers.map((o, i) => (
							<Stack
								key={`${o.domain}-${i}`}
								direction="row"
								sx={{
									justifyContent: "space-between",
									alignItems: "center",
									p: 1,
									borderRadius: 1,
									bgcolor: i === 0 ? "rgba(34,197,94,0.08)" : "transparent",
									border: "1px solid",
									borderColor: i === 0 ? "rgba(34,197,94,0.3)" : "divider",
								}}
							>
								<Box>
									<MuiLink href={o.url} target="_blank" rel="noopener noreferrer" sx={{ fontWeight: 700, display: "flex", alignItems: "center", gap: 0.5 }}>
										{o.shop} <OpenInNew sx={{ fontSize: 13 }} />
									</MuiLink>
									<Typography variant="caption" sx={{ color: "text.secondary" }}>
										{REGION_LABEL[o.region] ?? o.region} · {o.title}
									</Typography>
								</Box>
								<Box sx={{ textAlign: "right" }}>
									<Typography sx={{ fontWeight: 800, color: i === 0 ? "success.main" : "text.primary" }}>
										{fmtEur(o.priceEur)}
									</Typography>
									<Typography variant="caption" sx={{ color: "text.secondary" }}>
										{fmtPrice(o.price, o.currency)}
									</Typography>
								</Box>
							</Stack>
						))}
					</Stack>
				</DialogContent>
			</Dialog>
		</Box>
	);
}
