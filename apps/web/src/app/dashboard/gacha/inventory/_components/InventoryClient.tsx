"use client";

import { useState, useTransition } from "react";
import {
	Box,
	Button,
	Chip,
	Dialog,
	DialogContent,
	DialogTitle,
	Divider,
	FormControl,
	Grid,
	IconButton,
	InputLabel,
	MenuItem,
	Select,
	type SelectChangeEvent,
	Stack,
	Typography,
} from "@mui/material";
import {
	Close,
	NavigateBefore,
	NavigateNext,
	Favorite,
	FavoriteBorder,
} from "@mui/icons-material";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import {
	GachaInventoryCard,
	type InventoryItemShape,
} from "@/components/GachaInventoryCard";
import { RARITY_COLORS, RARITY_LABELS } from "@/lib/gacha-helpers";
import type { CardRarity } from "@/lib/types";

interface DropOption {
	id: string;
	name: string;
}

interface InventoryClientProps {
	items: InventoryItemShape[];
	drops: DropOption[];
	hasPrev: boolean;
	hasNext: boolean;
	nextCursor: string | null;
	prevCursor: string | null;
	rarity: string;
	dropId: string;
	wishlistIds: Set<string>;
}

export function InventoryClient({
	items,
	drops,
	hasPrev,
	hasNext,
	nextCursor,
	prevCursor,
	rarity,
	dropId,
	wishlistIds: initialWishlistIds,
}: InventoryClientProps) {
	const router = useRouter();
	const searchParams = useSearchParams();
	const [, startTransition] = useTransition();
	const [selected, setSelected] = useState<InventoryItemShape | null>(null);
	const [wishlistIds, setWishlistIds] =
		useState<Set<string>>(initialWishlistIds);
	const [wishlistLoading, setWishlistLoading] = useState(false);

	function buildUrl(params: Record<string, string | null>) {
		const sp = new URLSearchParams(searchParams.toString());
		for (const [k, v] of Object.entries(params)) {
			if (v === null || v === "") {
				sp.delete(k);
			} else {
				sp.set(k, v);
			}
		}
		// Reset cursor on filter change
		if ("rarity" in params || "dropId" in params) {
			sp.delete("cursor");
			sp.delete("prev");
		}
		return `/dashboard/gacha/inventory?${sp.toString()}`;
	}

	function handleRarityChange(e: SelectChangeEvent) {
		startTransition(() => {
			router.push(buildUrl({ rarity: e.target.value || null }));
		});
	}

	function handleDropChange(e: SelectChangeEvent) {
		startTransition(() => {
			router.push(buildUrl({ dropId: e.target.value || null }));
		});
	}

	async function toggleWishlist(cardId: string) {
		if (wishlistLoading) return;
		setWishlistLoading(true);
		const isWishlisted = wishlistIds.has(cardId);
		try {
			const res = await fetch("/api/gacha/wishlist", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					cardId,
					action: isWishlisted ? "remove" : "add",
				}),
			});
			if (res.ok) {
				setWishlistIds((prev) => {
					const next = new Set(prev);
					if (isWishlisted) {
						next.delete(cardId);
					} else {
						next.add(cardId);
					}
					return next;
				});
			}
		} finally {
			setWishlistLoading(false);
		}
	}

	const rarityValues: CardRarity[] = [
		"COMMON",
		"RARE",
		"SUPER_RARE",
		"LEGENDARY",
		"SECRET",
	];

	return (
		<>
			{/* Filters */}
			<Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ mb: 3 }}>
				<FormControl size="small" sx={{ minWidth: 160 }}>
					<InputLabel>Rareté</InputLabel>
					<Select value={rarity} label="Rareté" onChange={handleRarityChange}>
						<MenuItem value="">Toutes</MenuItem>
						{rarityValues.map((r) => (
							<MenuItem key={r} value={r}>
								<Box
									sx={{
										display: "flex",
										alignItems: "center",
										gap: 1,
									}}
								>
									<Box
										sx={{
											width: 8,
											height: 8,
											borderRadius: "50%",
											bgcolor: RARITY_COLORS[r],
											flexShrink: 0,
										}}
									/>
									{RARITY_LABELS[r]}
								</Box>
							</MenuItem>
						))}
					</Select>
				</FormControl>

				<FormControl size="small" sx={{ minWidth: 180 }}>
					<InputLabel>Drop</InputLabel>
					<Select value={dropId} label="Drop" onChange={handleDropChange}>
						<MenuItem value="">Tous les drops</MenuItem>
						{drops.map((d) => (
							<MenuItem key={d.id} value={d.id}>
								{d.name}
							</MenuItem>
						))}
					</Select>
				</FormControl>
			</Stack>

			{/* Grid */}
			{items.length === 0 ? (
				<Box
					sx={{
						py: 8,
						textAlign: "center",
						color: "text.secondary",
						bgcolor: "background.paper",
						borderRadius: 3,
						border: "1px dashed",
						borderColor: "divider",
					}}
				>
					<Typography variant="h6" sx={{ mb: 1 }}>
						Aucune carte trouvee
					</Typography>
					<Typography variant="body2">
						Lance /pull sur Discord pour commencer ta collection !
					</Typography>
				</Box>
			) : (
				<Grid container spacing={2}>
					{items.map((item) => (
						<Grid key={item.id} size={{ xs: 6, sm: 4, md: 3 }}>
							<GachaInventoryCard item={item} onClick={setSelected} />
						</Grid>
					))}
				</Grid>
			)}

			{/* Pagination */}
			{(hasPrev || hasNext) && (
				<Stack
					direction="row"
					spacing={2}
					sx={{ mt: 4, justifyContent: "center" }}
				>
					<Button
						variant="outlined"
						startIcon={<NavigateBefore />}
						disabled={!hasPrev}
						onClick={() =>
							router.push(buildUrl({ cursor: prevCursor, prev: "1" }))
						}
					>
						Precedent
					</Button>
					<Button
						variant="outlined"
						endIcon={<NavigateNext />}
						disabled={!hasNext}
						onClick={() =>
							router.push(buildUrl({ cursor: nextCursor, prev: null }))
						}
					>
						Suivant
					</Button>
				</Stack>
			)}

			{/* Detail Dialog */}
			<Dialog
				open={Boolean(selected)}
				onClose={() => setSelected(null)}
				maxWidth="sm"
				fullWidth
			>
				{selected && (
					<>
						<DialogTitle
							sx={{
								display: "flex",
								alignItems: "center",
								justifyContent: "space-between",
								pr: 1,
							}}
						>
							<Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
								<Chip
									label={RARITY_LABELS[selected.card.rarity]}
									size="small"
									sx={{
										bgcolor: RARITY_COLORS[selected.card.rarity],
										color: "#fff",
										fontWeight: 700,
									}}
								/>
								<Typography variant="h6" sx={{ fontWeight: 700 }}>
									{selected.card.name}
								</Typography>
							</Box>
							<IconButton onClick={() => setSelected(null)} size="small">
								<Close />
							</IconButton>
						</DialogTitle>

						<DialogContent>
							<Grid container spacing={3}>
								{/* Image */}
								<Grid size={{ xs: 12, sm: 5 }}>
									<Box
										sx={{
											position: "relative",
											aspectRatio: "3/4",
											borderRadius: 2,
											overflow: "hidden",
											border: "2px solid",
											borderColor: RARITY_COLORS[selected.card.rarity],
											bgcolor: "background.default",
										}}
									>
										{selected.card.imageUrl ? (
											<Image
												src={selected.card.imageUrl}
												alt={selected.card.name}
												fill
												style={{ objectFit: "cover" }}
												sizes="240px"
											/>
										) : (
											<Box
												sx={{
													width: "100%",
													height: "100%",
													display: "flex",
													alignItems: "center",
													justifyContent: "center",
												}}
											>
												<Typography
													variant="h2"
													sx={{
														color: RARITY_COLORS[selected.card.rarity],
														fontWeight: 700,
													}}
												>
													{selected.card.name.charAt(0)}
												</Typography>
											</Box>
										)}
									</Box>
								</Grid>

								{/* Stats */}
								<Grid size={{ xs: 12, sm: 7 }}>
									<Stack spacing={1.5}>
										<Box>
											<Typography
												variant="caption"
												sx={{ color: "text.secondary" }}
											>
												Serie
											</Typography>
											<Typography variant="body2" sx={{ fontWeight: 600 }}>
												{selected.card.series}
											</Typography>
										</Box>

										{selected.card.drop && (
											<Box>
												<Typography
													variant="caption"
													sx={{ color: "text.secondary" }}
												>
													Drop
												</Typography>
												<Typography variant="body2" sx={{ fontWeight: 600 }}>
													{selected.card.drop.name}
												</Typography>
											</Box>
										)}

										<Divider />

										<Grid container spacing={1}>
											{[
												{ label: "ATT", value: selected.card.att },
												{ label: "DEF", value: selected.card.def },
												{ label: "END", value: selected.card.end },
											].map(({ label, value }) => (
												<Grid key={label} size={{ xs: 4 }}>
													<Box
														sx={{
															textAlign: "center",
															p: 1,
															borderRadius: 1.5,
															bgcolor: "background.default",
															border: "1px solid",
															borderColor: "divider",
														}}
													>
														<Typography
															variant="h6"
															sx={{ fontWeight: 700, lineHeight: 1 }}
														>
															{value}
														</Typography>
														<Typography
															variant="caption"
															sx={{ color: "text.secondary" }}
														>
															{label}
														</Typography>
													</Box>
												</Grid>
											))}
										</Grid>

										{selected.card.specialMove && (
											<Box>
												<Typography
													variant="caption"
													sx={{ color: "text.secondary" }}
												>
													Coup special
												</Typography>
												<Typography variant="body2" sx={{ fontWeight: 600 }}>
													{selected.card.specialMove}
												</Typography>
											</Box>
										)}

										{selected.card.description && (
											<Box>
												<Typography
													variant="caption"
													sx={{ color: "text.secondary" }}
												>
													Description
												</Typography>
												<Typography
													variant="body2"
													sx={{ color: "text.secondary", fontStyle: "italic" }}
												>
													{selected.card.description}
												</Typography>
											</Box>
										)}

										<Box>
											<Typography
												variant="caption"
												sx={{ color: "text.secondary" }}
											>
												Quantite possedee
											</Typography>
											<Typography variant="body2" sx={{ fontWeight: 600 }}>
												x{selected.count}
											</Typography>
										</Box>

										<Button
											variant={
												wishlistIds.has(selected.card.id)
													? "contained"
													: "outlined"
											}
											startIcon={
												wishlistIds.has(selected.card.id) ? (
													<Favorite />
												) : (
													<FavoriteBorder />
												)
											}
											disabled={wishlistLoading}
											onClick={() => toggleWishlist(selected.card.id)}
											sx={{ mt: 1 }}
										>
											{wishlistIds.has(selected.card.id)
												? "Retirer de la wishlist"
												: "Ajouter a la wishlist"}
										</Button>
									</Stack>
								</Grid>
							</Grid>
						</DialogContent>
					</>
				)}
			</Dialog>
		</>
	);
}
