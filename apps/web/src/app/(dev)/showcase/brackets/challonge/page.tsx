import GitHubIcon from "@mui/icons-material/GitHub";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import RefreshIcon from "@mui/icons-material/Refresh";
import AppBar from "@mui/material/AppBar";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import Container from "@mui/material/Container";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import Link from "@mui/material/Link";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";

import { BracketsViewer } from "@/components/brackets";
import { convertChallongeToBrackets } from "@/server/actions/brackets";

export const dynamic = "force-dynamic";

const DEFAULT_SLUG = "T_SS1";

interface PageProps {
	searchParams: Promise<{ slug?: string; transport?: string }>;
}

type Transport = "auto" | "api" | "htmlrewriter";

function isTransport(v: unknown): v is Transport {
	return v === "auto" || v === "api" || v === "htmlrewriter";
}

export default async function ChallongeImportPage({
	searchParams,
}: PageProps): Promise<React.ReactElement> {
	const sp = await searchParams;
	const slug = (sp.slug ?? DEFAULT_SLUG).trim();
	const transport: Transport = isTransport(sp.transport)
		? sp.transport
		: "auto";
	const result = await convertChallongeToBrackets(slug, { transport });

	return (
		<Box sx={{ minHeight: "100dvh", bgcolor: "background.default" }}>
			<AppBar
				position="sticky"
				color="default"
				elevation={0}
				sx={{ borderBottom: 1, borderColor: "divider" }}
			>
				<Toolbar>
					<Typography variant="h6" sx={{ flexGrow: 1, fontWeight: 600 }}>
						Challonge → @rose-griffon/challonge-core
					</Typography>
					<Chip
						label={
							result.success
								? `${result.source.matchesCount} matches`
								: "erreur"
						}
						size="small"
						color={result.success ? "success" : "error"}
						variant="outlined"
						sx={{ mr: 2 }}
					/>
					<IconButton
						component="a"
						href="https://github.com/rpbey/brackets-viewer.js"
						target="_blank"
						rel="noreferrer noopener"
					>
						<GitHubIcon />
					</IconButton>
				</Toolbar>
			</AppBar>

			<Container maxWidth="xl" sx={{ py: 4 }}>
				<Stack spacing={3}>
					<Box>
						<Typography variant="h4" gutterBottom sx={{ fontWeight: 600 }}>
							Import live Challonge
						</Typography>
						<Typography
							variant="body1"
							color="text.secondary"
							sx={{ maxWidth: 760 }}
						>
							Server action <code>convertChallongeToBrackets(idOrSlug)</code>{" "}
							qui pull l&apos;API Challonge v1 (<code>ChallongeApi.get</code>),
							normalise via <code>toCanonical()</code> puis projette en{" "}
							<code>ViewerData</code> consomme par le viewer rpbey. Cache
							serveur 5 min.
						</Typography>
					</Box>

					<Card variant="outlined" sx={{ borderRadius: 3 }}>
						<CardContent>
							<Box
								component="form"
								method="GET"
								action=""
								sx={{
									display: "flex",
									gap: 2,
									alignItems: "flex-start",
									flexWrap: "wrap",
								}}
							>
								<TextField
									name="slug"
									label="Slug Challonge ou id"
									defaultValue={slug}
									size="small"
									sx={{ flexGrow: 1, minWidth: 240, maxWidth: 360 }}
									helperText='ex. "T_SS1", "B_TS4", id "17779621"'
								/>
								<TextField
									select
									name="transport"
									label="Transport"
									defaultValue={transport}
									size="small"
									slotProps={{ select: { native: true } } as any}
									sx={{ minWidth: 180 }}
									helperText="auto = API si key, sinon HTMLRewriter"
								>
									<option value="auto">auto</option>
									<option value="api">api (Challonge v1)</option>
									<option value="htmlrewriter">htmlrewriter (Bun)</option>
								</TextField>
								<Button
									type="submit"
									variant="contained"
									startIcon={<RefreshIcon />}
									sx={{ alignSelf: "flex-start", mt: 1 }}
								>
									Importer
								</Button>
							</Box>
						</CardContent>
					</Card>

					{result.success ? (
						<>
							<Card variant="outlined" sx={{ borderRadius: 3 }}>
								<CardContent>
									<Stack
										direction={{ xs: "column", md: "row" }}
										spacing={2}
										divider={<Divider orientation="vertical" flexItem />}
									>
										<Stack spacing={0.5} sx={{ minWidth: 200 }}>
											<Typography variant="overline" color="text.secondary">
												Tournoi
											</Typography>
											<Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
												{result.source.name}
											</Typography>
											<Link
												href={result.source.url}
												target="_blank"
												rel="noreferrer noopener"
												variant="body2"
												sx={{ display: "inline-flex", gap: 0.5 }}
											>
												{result.source.url.replace(/^https?:\/\//, "")}{" "}
												<OpenInNewIcon fontSize="inherit" />
											</Link>
										</Stack>
										<Stack spacing={0.5}>
											<Typography variant="overline" color="text.secondary">
												Format
											</Typography>
											<Chip label={result.source.type ?? "?"} size="small" />
											{result.source.state && (
												<Chip
													label={result.source.state}
													size="small"
													variant="outlined"
												/>
											)}
											<Chip
												label={`transport: ${result.transport}`}
												size="small"
												color={
													result.transport === "htmlrewriter"
														? "secondary"
														: "primary"
												}
											/>
										</Stack>
										<Stack spacing={0.5}>
											<Typography variant="overline" color="text.secondary">
												Volumetrie
											</Typography>
											<Typography variant="body2">
												{result.source.participantsCount} participants
											</Typography>
											<Typography variant="body2">
												{result.source.matchesCount} matches
											</Typography>
										</Stack>
										<Stack spacing={0.5}>
											<Typography variant="overline" color="text.secondary">
												Cache
											</Typography>
											<Typography variant="body2">
												Fetch :{" "}
												{new Date(result.fetchedAt).toLocaleString("fr-FR")}
											</Typography>
											<Typography variant="body2" color="text.secondary">
												TTL serveur 5 min (revalidate)
											</Typography>
										</Stack>
									</Stack>
								</CardContent>
							</Card>

							<Card elevation={1} sx={{ borderRadius: 3 }}>
								<CardContent>
									<Typography variant="overline" color="text.secondary">
										Rendu viewer (Material Design 3)
									</Typography>
									<Box sx={{ mt: 2 }}>
										<BracketsViewer
											data={result.data}
											sx={{ minHeight: 480 }}
										/>
									</Box>
								</CardContent>
							</Card>
						</>
					) : (
						<Card
							variant="outlined"
							sx={{ borderRadius: 3, borderColor: "error.main" }}
						>
							<CardContent>
								<Typography variant="overline" color="error.main">
									Erreur import
								</Typography>
								<Typography variant="body1" sx={{ mt: 1 }}>
									{result.error}
								</Typography>
								{result.code && (
									<Typography
										variant="caption"
										color="text.secondary"
										sx={{ display: "block", mt: 1, fontFamily: "monospace" }}
									>
										code : {String(result.code)}
									</Typography>
								)}
							</CardContent>
						</Card>
					)}

					<Divider />

					<Typography variant="caption" color="text.secondary">
						Server action :{" "}
						<code>
							src/server/actions/brackets.ts → convertChallongeToBrackets()
						</code>
						. Convertisseur : <code>src/lib/brackets/challonge.ts</code>.
					</Typography>
				</Stack>
			</Container>
		</Box>
	);
}
