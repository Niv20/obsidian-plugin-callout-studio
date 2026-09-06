import type { CalloutDefinition } from "../types";
import type { CalloutRegistry } from "../manager/CalloutRegistry";
import { calloutIdentity } from "./calloutId";

/** Restore a validated backup row, preserving spellings still used in notes. */
export function applyImportedCallout(registry: CalloutRegistry, def: CalloutDefinition): boolean {
	const existing = registry.getReal(def.id);
	if (!existing) return registry.add(def);
	// A backup describes a whole appearance. Omitted optional values mean the
	// default/inherited value, not whatever was changed after the backup.
	const replacement: CalloutDefinition = {
		bgColorLight: undefined, bgColorDark: undefined, bgGradient: undefined,
		transparentBg: undefined, hideIcon: undefined,
		textColorLight: undefined, textColorDark: undefined,
		iconAdjust: undefined, iconOffsetX: undefined, iconOffsetY: undefined,
		iconSize: undefined, paletteId: undefined, customized: undefined,
		externalStyle: undefined, metadata: undefined,
		...def,
	};
	// Importing a backup does not rewrite notes. Keep every previously accepted
	// spelling until an explicit editor rename/removal can rewrite its usages.
	const seen = new Set([calloutIdentity(def.id)]);
	const aliases = [...(def.aliases ?? []), ...(existing.aliases ?? [])].filter(alias => {
		const identity = calloutIdentity(alias);
		if (seen.has(identity)) return false;
		seen.add(identity); return true;
	});
	replacement.aliases = aliases.length ? aliases : undefined;
	return registry.update(def.id, replacement);
}
