import type { LabelConfig } from "../types/labels";

/**
 * Convert a hex colour (#RGB / #RRGGBB) to an rgba() string at the given alpha.
 * Returns the original input if it isn't a recognised hex.
 */
function hexToRgba(hex: string, alpha: number): string {
	const match = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
	if (!match) return hex;
	let body = match[1];
	if (body.length === 3) {
		body = body
			.split("")
			.map((c) => c + c)
			.join("");
	}
	const r = parseInt(body.slice(0, 2), 16);
	const g = parseInt(body.slice(2, 4), 16);
	const b = parseInt(body.slice(4, 6), 16);
	return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Given the label types active on a text range, return a CSS background-color.
 *
 * - Single label → that label's color at 30% alpha.
 * - Overlapping labels → the first label's color (order of mark application).
 *   Colour mixing can be added later if needed.
 * - Unknown labels or empty input → transparent.
 */
export function getHighlightStyle(
	labelTypes: string[],
	labelConfigs: LabelConfig[],
): string {
	if (labelTypes.length === 0) return "transparent";
	const first = labelTypes[0];
	const config = labelConfigs.find((c) => c.id === first);
	if (!config) return "transparent";
	return hexToRgba(config.color, 0.3);
}
