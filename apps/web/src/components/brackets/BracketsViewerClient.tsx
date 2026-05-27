"use client";

import { useEffect, useId, useRef, useState } from "react";
import Box from "@mui/material/Box";
import type { SxProps, Theme } from "@mui/material/styles";

import type {
	BracketsTheme,
	Config,
	MatchClickCallback,
	ViewerData,
} from "@/lib/brackets/types";

import { BracketsLoader } from "./BracketsLoader";

const SCRIPT_URL = "/vendor/brackets/brackets-viewer.min.js";
const STYLE_URL = "/vendor/brackets/brackets-viewer.min.css";
const SCRIPT_ID = "rpbey-brackets-viewer-script";
const STYLE_ID = "rpbey-brackets-viewer-style";

type WindowWithViewer = Window & {
	bracketsViewer?: {
		render: (data: ViewerData, config?: Partial<Config>) => Promise<void>;
	};
};

let scriptLoadPromise: Promise<void> | null = null;

function loadScriptOnce(): Promise<void> {
	if (typeof window === "undefined") return Promise.reject(new Error("SSR"));
	const w = window as WindowWithViewer;
	if (w.bracketsViewer) return Promise.resolve();
	if (scriptLoadPromise) return scriptLoadPromise;

	scriptLoadPromise = new Promise<void>((resolve, reject) => {
		if (!document.getElementById(STYLE_ID)) {
			const link = document.createElement("link");
			link.id = STYLE_ID;
			link.rel = "stylesheet";
			link.href = STYLE_URL;
			document.head.appendChild(link);
		}

		const existing = document.getElementById(
			SCRIPT_ID,
		) as HTMLScriptElement | null;
		if (existing) {
			existing.addEventListener("load", () => resolve());
			existing.addEventListener("error", () =>
				reject(new Error("script load failed")),
			);
			return;
		}

		const script = document.createElement("script");
		script.id = SCRIPT_ID;
		script.src = SCRIPT_URL;
		script.async = true;
		script.onload = (): void => resolve();
		script.onerror = (): void =>
			reject(new Error(`failed to load ${SCRIPT_URL}`));
		document.body.appendChild(script);
	});

	return scriptLoadPromise;
}

export interface BracketsViewerClientProps {
	data: ViewerData;
	config?: Partial<Config>;
	theme?: BracketsTheme;
	onMatchClick?: MatchClickCallback;
	sx?: SxProps<Theme>;
	minHeight?: number | string;
}

export function BracketsViewerClient({
	data,
	config,
	theme = "auto",
	onMatchClick,
	sx,
	minHeight = 320,
}: BracketsViewerClientProps): React.ReactElement {
	const containerId = useId().replace(/:/g, "");
	const ref = useRef<HTMLDivElement | null>(null);
	const [ready, setReady] = useState(false);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		let cancelled = false;
		loadScriptOnce()
			.then(() => {
				if (!cancelled) setReady(true);
			})
			.catch((err: unknown) => {
				if (!cancelled)
					setError(err instanceof Error ? err.message : String(err));
			});
		return (): void => {
			cancelled = true;
		};
	}, []);

	useEffect(() => {
		if (!ready || !ref.current) return;
		const container = ref.current;
		container.classList.add("brackets-viewer");
		const w = window as WindowWithViewer;
		const viewer = w.bracketsViewer;
		if (!viewer) return;

		container.innerHTML = "";
		const merged: Partial<Config> = {
			selector: `#${containerId}`,
			clear: true,
			...config,
			...(onMatchClick ? { onMatchClick } : {}),
		};

		void viewer.render(data, merged);

		return (): void => {
			container.innerHTML = "";
		};
	}, [ready, data, config, onMatchClick, containerId]);

	useEffect(() => {
		if (!ref.current) return;
		const el = ref.current;
		if (theme === "auto") {
			el.removeAttribute("data-theme");
		} else {
			el.setAttribute("data-theme", theme);
		}
	}, [theme]);

	if (error) {
		return (
			<Box
				sx={{
					p: 3,
					borderRadius: 2,
					border: "1px solid",
					borderColor: "error.main",
					color: "error.main",
					bgcolor: "error.50",
					...sx,
				}}
				role="alert"
			>
				Erreur chargement viewer brackets : {error}
			</Box>
		);
	}

	return (
		<Box sx={{ position: "relative", minHeight, ...sx }}>
			{!ready && <BracketsLoader />}
			<Box
				id={containerId}
				ref={ref}
				sx={{
					display: ready ? "block" : "none",
					"&.brackets-viewer": {
						borderRadius: 1,
					},
				}}
			/>
		</Box>
	);
}

export default BracketsViewerClient;
