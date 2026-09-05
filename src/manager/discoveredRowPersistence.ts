import type { CalloutDefinition } from "../types";
import { isCalloutModified } from "./calloutCompare";

export interface PersistedRowContext {

	previewActiveId: string | null;
	previewShadowedDef: CalloutDefinition | null;

	builtInDefault(id: string): CalloutDefinition | undefined;
}

export function selectPersistedRows(
	callouts: ReadonlyMap<string, CalloutDefinition>,
	ctx: PersistedRowContext,
): CalloutDefinition[] {
	const out: CalloutDefinition[] = [];
	for (const [id, entry] of callouts) {
		let def = entry;
		if (id === ctx.previewActiveId) {
			if (!ctx.previewShadowedDef) continue;
			def = ctx.previewShadowedDef;
		}
		if (def.source === "theme") continue;
		if (def.builtIn) {
			const original = ctx.builtInDefault(id);
			if (original && isCalloutModified(def, original)) out.push(def);
			continue;
		}
		out.push(def);
	}
	return out;
}
