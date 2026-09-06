/**
 * icons/packs/material.ts — Google's Material Symbols.
 *
 * The one pack whose artwork is fetched per icon rather than as a whole file.
 * Material Symbols is a variable font: 3,870 icons across 4 styles and 7
 * weights is over 100,000 distinct drawings, so there is no bulk file worth
 * bundling or downloading. Google serves each drawing individually, and only
 * the icons a vault actually uses ever get fetched.
 *
 * The picker previews the grid with the Material Symbols webfont instead, which
 * is why this pack renders its grid from a font while every other SVG pack
 * renders it from path data. That font lives in `materialFont.ts`.
 */
import { requestUrl } from "obsidian";
import type { CalloutIcon, MaterialIconStyle } from "../../types";
import type {
	IconEntry,
	IconIndex,
	IconPack,
	IconVariantState,
} from "../types";
import { decodeIndex, memoizeIndex } from "../data/codec";
import { MATERIAL_INDEX } from "../data/material.index";
import { sanitizeSVG } from "../svg";

const loadIndex = memoizeIndex(() => decodeIndex(MATERIAL_INDEX));
const DOWNLOAD_TIMEOUT_MS = 30_000;

/** Defaults applied when an icon omits the fields (pre-2.0 data, or imports). */
export const MATERIAL_DEFAULT_STYLE: MaterialIconStyle = "outlined";
export const MATERIAL_DEFAULT_WEIGHT = 400;

export const MATERIAL_STYLES: readonly MaterialIconStyle[] = [
	"outlined",
	"filled",
	"rounded",
	"sharp",
];

/** The variable font's weight axis, in the steps Google exposes. */
export const MATERIAL_WEIGHTS: readonly number[] = [
	100, 200, 300, 400, 500, 600, 700,
];

/** The style/weight pair an icon actually renders at. */
export function materialVariantOf(icon: CalloutIcon): {
	style: MaterialIconStyle;
	weight: number;
} {
	return {
		style: icon.style ?? MATERIAL_DEFAULT_STYLE,
		weight: icon.weight ?? MATERIAL_DEFAULT_WEIGHT,
	};
}

export const materialPack: IconPack = {
	id: "material",
	kind: "perIconRemote",
	labelKey: "iconPicker.material",
	descriptionKey: "iconPicker.descMaterial",
	emblemIcon: "shapes",
	searchPlaceholderKey: "iconPicker.searchMaterial",
	hasCategories: true,
	variants: [
		{
			kind: "select",
			key: "style",
			labelKey: "iconPicker.materialStyle",
			options: MATERIAL_STYLES,
			optionLabelKeys: [
				"iconPicker.materialStyleOutlined",
				"iconPicker.materialStyleFilled",
				"iconPicker.materialStyleRounded",
				"iconPicker.materialStyleSharp",
			],
		},
		{
			kind: "select",
			key: "weight",
			labelKey: "iconPicker.materialWeight",
			options: MATERIAL_WEIGHTS,
			optionLabelKeys: [
				"iconPicker.materialWeight100",
				"iconPicker.materialWeight200",
				"iconPicker.materialWeight300",
				"iconPicker.materialWeight400",
				"iconPicker.materialWeight500",
				"iconPicker.materialWeight600",
				"iconPicker.materialWeight700",
			],
		},
	],

	attribution: {
		title: "Material Symbols",
		homepage: "https://fonts.google.com/icons",
		version: "Material Symbols",
		licenses: [
			{
				name: "Apache License 2.0",
				spdx: "Apache-2.0",
				url: "https://www.apache.org/licenses/LICENSE-2.0",
				holder: "Google LLC",
			},
		],
	},

	loadIndex(): Promise<IconIndex> {
		return loadIndex();
	},

	makeIcon(entry: IconEntry, variants: IconVariantState): CalloutIcon {
		return {
			type: "material",
			value: entry.name,
			style: variants.style ?? MATERIAL_DEFAULT_STYLE,
			weight: variants.weight ?? MATERIAL_DEFAULT_WEIGHT,
		};
	},

	cacheVariant(icon: CalloutIcon): string {
		const { style, weight } = materialVariantOf(icon);
		return `${style}|${weight}`;
	},
};

// ── Per-icon artwork ────────────────────────────────────────────────────

/**
 * Where Google serves one drawing. The weight segment precedes the fill
 * segment ("wght300fill1", never the reverse); weight 400 is the default and is
 * omitted, and a URL with no segments uses the literal variant "default".
 */
function materialSvgUrl(
	name: string,
	style: MaterialIconStyle,
	weight: number,
): string {
	const family = style === "filled" ? "outlined" : style;
	const parts: string[] = [];
	if (weight !== MATERIAL_DEFAULT_WEIGHT) parts.push(`wght${weight}`);
	if (style === "filled") parts.push("fill1");
	const variant = parts.length > 0 ? parts.join("") : "default";
	return `https://fonts.gstatic.com/s/i/short-term/release/materialsymbols${family}/${name}/${variant}/24px.svg`;
}

/** Fetch and sanitize one Material Symbols drawing. */
export async function downloadMaterialSvg(
	name: string,
	style: MaterialIconStyle,
	weight: number = MATERIAL_DEFAULT_WEIGHT,
): Promise<string> {
	// requestUrl cannot be aborted; a late response is ignored by the race.
	// Bound each attempt so one stalled icon cannot hold the startup queue.
	let timer = 0;
	const timeout = new Promise<never>((_, reject) => {
		timer = window.setTimeout(() => reject(new Error("Material icon download timed out")), DOWNLOAD_TIMEOUT_MS);
	});
	try {
		const response = await Promise.race([
			requestUrl({ url: materialSvgUrl(name, style, weight) }), timeout,
		]);
		const sanitized = sanitizeSVG(response.text);
		if (!sanitized) throw new Error(`Invalid SVG received for Material icon "${name}"`);
		return sanitized;
	} finally {
		window.clearTimeout(timer);
	}
}
