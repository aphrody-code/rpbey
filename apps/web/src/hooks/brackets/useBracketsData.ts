"use client";

import { useEffect, useState } from "react";

import type { ViewerData } from "@/lib/brackets/types";

interface State {
	data: ViewerData | null;
	isLoading: boolean;
	error: Error | null;
}

/**
 * Fetch un `ViewerData` depuis une route API rpb-dashboard.
 *
 * Par defaut tape `/api/brackets/{key}` ou `key` est :
 *   - un mock id (`roundRobin`, `singleElimination`, `doubleElimination`)
 *   - ou un stage id reel cote DB (a wirer dans la route handler)
 *
 * @example
 *   const { data, isLoading, error } = useBracketsData("roundRobin");
 *   if (data) return <BracketsViewer data={data} />;
 */
export function useBracketsData(
	key: string | null,
	endpoint = "/api/brackets",
): State {
	const [state, setState] = useState<State>({
		data: null,
		isLoading: key !== null,
		error: null,
	});

	useEffect(() => {
		if (key === null) {
			setState({ data: null, isLoading: false, error: null });
			return;
		}

		let cancelled = false;
		const controller = new AbortController();
		setState((s) => ({ ...s, isLoading: true, error: null }));

		fetch(`${endpoint}/${encodeURIComponent(key)}`, {
			signal: controller.signal,
		})
			.then(async (res) => {
				if (!res.ok) throw new Error(`HTTP ${res.status}`);
				return (await res.json()) as ViewerData;
			})
			.then((data) => {
				if (!cancelled) setState({ data, isLoading: false, error: null });
			})
			.catch((err: unknown) => {
				if (cancelled) return;
				if (err instanceof DOMException && err.name === "AbortError") return;
				setState({
					data: null,
					isLoading: false,
					error: err instanceof Error ? err : new Error(String(err)),
				});
			});

		return (): void => {
			cancelled = true;
			controller.abort();
		};
	}, [key, endpoint]);

	return state;
}
