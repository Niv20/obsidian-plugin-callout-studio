import type { CalloutDefinition, PluginData } from "../types";

/** Read legacy evidence before rebuilding rows; only literal true affected users. */
export function retiredExternalCssState(data: Partial<PluginData> | null): {
	changed: boolean;
	affected: boolean;
} {
	let changed = false;
	let affected = false;
	for (const row of data?.callouts ?? []) {
		if (!Object.prototype.hasOwnProperty.call(row, "externalStyle")) continue;
		changed = true;
		if ((row as { externalStyle?: unknown }).externalStyle === true) affected = true;
	}
	return { changed, affected };
}

/** Keep retired keys out of every registry entry without changing incoming bytes. */
export function withoutExternalStyle(def: CalloutDefinition): CalloutDefinition {
	if (!Object.prototype.hasOwnProperty.call(def, "externalStyle")) return def;
	const clean = { ...def };
	delete (clean as { externalStyle?: unknown }).externalStyle;
	return clean;
}
