import type { CalloutDefinition } from "../types";
import { DEFAULT_CALLOUTS } from "../constants";
import { obsidianDefaultTitle } from "../utils/calloutId";

interface DefinitionLookup {
	get(id: string): CalloutDefinition | undefined;
}

export function fallbackSourceFor(
	registry: DefinitionLookup,
	fallbackCalloutId: string,
): CalloutDefinition {
	const noteDefault =
		DEFAULT_CALLOUTS.find((c) => c.id === "note") ?? DEFAULT_CALLOUTS[0]!;
	return registry.get(fallbackCalloutId || "note") ?? noteDefault;
}

export function buildDiscoveredRow(
	id: string,
	fallback: CalloutDefinition,
): CalloutDefinition {
	return {
		...fallback,

		icon: { ...fallback.icon },

		bgGradient: fallback.bgGradient ? { ...fallback.bgGradient } : undefined,
		iconAdjust: fallback.iconAdjust
			? structuredClone(fallback.iconAdjust)
			: undefined,
		id,

		displayName: obsidianDefaultTitle(id),

		aliases: [],
		builtIn: false,
		source: "fallback",

		customized: undefined,

		externalStyle: undefined,
	};
}

export function mirroredFallbackRow(
	def: CalloutDefinition,
	fallback: CalloutDefinition,
): CalloutDefinition | null {
	const next: CalloutDefinition = {
		...def,
		icon: { ...fallback.icon },
		hideIcon: fallback.hideIcon,
		colorLight: fallback.colorLight,
		colorDark: fallback.colorDark,
		bgColorLight: fallback.bgColorLight,
		bgColorDark: fallback.bgColorDark,
		bgGradient: fallback.bgGradient ? { ...fallback.bgGradient } : undefined,

		transparentBg: fallback.transparentBg,
		textColorLight: fallback.textColorLight,
		textColorDark: fallback.textColorDark,

		iconAdjust: fallback.iconAdjust
			? structuredClone(fallback.iconAdjust)
			: undefined,
		iconOffsetX: fallback.iconOffsetX,
		iconOffsetY: fallback.iconOffsetY,
		iconSize: fallback.iconSize,
	};

	return JSON.stringify(next) === JSON.stringify(def) ? null : next;
}
