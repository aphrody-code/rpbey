"use client";

import Brightness4Icon from "@mui/icons-material/Brightness4";
import Brightness7Icon from "@mui/icons-material/Brightness7";
import BrightnessAutoIcon from "@mui/icons-material/BrightnessAuto";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";

import type { BracketsTheme } from "@/lib/brackets/types";

interface Props {
	value: BracketsTheme;
	onChange: (next: BracketsTheme) => void;
	size?: "small" | "medium" | "large";
}

const NEXT: Record<BracketsTheme, BracketsTheme> = {
	light: "dark",
	dark: "auto",
	auto: "light",
};

const LABEL: Record<BracketsTheme, string> = {
	light: "Theme clair (cliquez pour basculer)",
	dark: "Theme sombre (cliquez pour basculer)",
	auto: "Theme automatique (suit l'OS)",
};

/**
 * Toggle theme du viewer (light -> dark -> auto -> light).
 * Le composant parent gere le data-theme via `useBracketsTheme`.
 */
export function BracketsThemeSwitch({
	value,
	onChange,
	size = "medium",
}: Props): React.ReactElement {
	const Icon =
		value === "light"
			? Brightness7Icon
			: value === "dark"
				? Brightness4Icon
				: BrightnessAutoIcon;

	return (
		<Tooltip title={LABEL[value]} arrow>
			<IconButton
				size={size}
				onClick={() => onChange(NEXT[value])}
				aria-label={`Theme actuel: ${value}. Cliquez pour passer a ${NEXT[value]}.`}
			>
				<Icon fontSize={size === "large" ? "large" : "medium"} />
			</IconButton>
		</Tooltip>
	);
}

export default BracketsThemeSwitch;
