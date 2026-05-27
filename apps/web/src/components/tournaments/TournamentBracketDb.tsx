"use client";

import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import { useTheme } from "@mui/material/styles";
import Typography from "@mui/material/Typography";
import { useEffect, useState } from "react";

import { BracketsViewer, BracketsLoader } from "@/components/brackets";
import { useBracketsTheme } from "@/hooks/brackets";
import type { ViewerData } from "@/lib/brackets/types";

interface Props {
	tournamentId: string;
	challongeUrl?: string | null;
	height?: number | string;
}

/**
 * Affiche le bracket d'un tournoi RPB en piochant les data dans **notre DB**
 * (route `/api/brackets/db/[id]`) — plus de dépendance à l'iframe Challonge.
 *
 * V1 : double-elimination finals only (les matches pool `round=-100` ne sont
 * pas rendus ici, voir composant pool dédié).
 *
 * Fallback : si la route DB échoue, affiche un lien vers l'URL Challonge.
 */
export function TournamentBracketDb({
	tournamentId,
	challongeUrl,
	height = 700,
}: Props): React.ReactElement {
	const theme = useTheme();
	const isDark = theme.palette.mode === "dark";
	const { theme: bracketsTheme } = useBracketsTheme();
	const [data, setData] = useState<ViewerData | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		let cancelled = false;
		const controller = new AbortController();
		setLoading(true);
		setError(null);

		fetch(`/api/brackets/db/${encodeURIComponent(tournamentId)}`, {
			signal: controller.signal,
			cache: "no-store",
		})
			.then(async (res) => {
				if (!res.ok) {
					const body = await res.json().catch(() => ({}));
					throw new Error(body.error || `HTTP ${res.status}`);
				}
				return (await res.json()) as ViewerData;
			})
			.then((d) => {
				if (cancelled) return;
				if (!d.matches || d.matches.length === 0) {
					setError(
						"Aucun match de bracket en base — le bracket Challonge n'a pas encore été importé.",
					);
				} else {
					setData(d);
				}
				setLoading(false);
			})
			.catch((err: unknown) => {
				if (cancelled) return;
				if (err instanceof DOMException && err.name === "AbortError") return;
				setError(err instanceof Error ? err.message : String(err));
				setLoading(false);
			});

		return (): void => {
			cancelled = true;
			controller.abort();
		};
	}, [tournamentId]);

	return (
		<Box
			sx={{
				width: "100%",
				borderRadius: 4,
				border: "1px solid",
				borderColor: isDark ? "rgba(220, 38, 38, 0.3)" : "divider",
				bgcolor: isDark ? "#050505" : "background.paper",
				overflow: "hidden",
				boxShadow: isDark
					? "0 10px 40px rgba(0,0,0,0.5)"
					: "0 10px 30px rgba(0,0,0,0.05)",
			}}
		>
			{/* Body */}
			<Box
				sx={{
					p: { xs: 1.5, md: 3 },
					minHeight: height,
					bgcolor: isDark ? "#050505" : "transparent",
				}}
			>
				{loading && <BracketsLoader />}
				{error && !loading && (
					<Alert severity="warning" sx={{ borderRadius: 2 }}>
						{error}
						{challongeUrl && (
							<Box sx={{ mt: 1 }}>
								<Typography
									component="a"
									href={challongeUrl}
									target="_blank"
									rel="noopener noreferrer"
									variant="caption"
									sx={{
										color: "primary.main",
										textDecoration: "underline",
									}}
								>
									Voir le bracket sur Challonge
								</Typography>
							</Box>
						)}
					</Alert>
				)}
				{data && !loading && !error && (
					<BracketsViewer
						data={data}
						theme={bracketsTheme}
						minHeight={height}
					/>
				)}
			</Box>

			{/* Footer */}
			<Box
				sx={{
					p: 1.5,
					bgcolor: isDark ? "rgba(0,0,0,0.3)" : "rgba(0,0,0,0.02)",
					textAlign: "center",
					borderTop: "1px solid",
					borderColor: isDark ? "rgba(255,255,255,0.03)" : "divider",
				}}
			>
				<Typography
					variant="caption"
					sx={{ color: "grey.600", fontWeight: 700, letterSpacing: 1 }}
				>
					DONNÉES DB RPB • {data?.matches.length ?? 0} MATCHES •{" "}
					{data?.participants.length ?? 0} JOUEURS
				</Typography>
			</Box>
		</Box>
	);
}

export default TournamentBracketDb;
