import type { CalloutDefinition } from "../types";
import type { CalloutRegistry } from "../manager/CalloutRegistry";
import { calloutIdentity } from "./calloutId";

/** Restore a validated backup row, preserving spellings still used in notes. */
export function applyImportedCallout(registry: CalloutRegistry, def: CalloutDefinition): boolean {
	const existing = registry.getReal(def.id);
	// A theme overlay row is not a definition to merge onto — it is a stand-in
	// for whatever the active theme draws. Merging would make the imported row
	// depend on which theme happened to be enabled, so a device with the theme
	// and one without would end up with different rows from the same backup.
	if (existing?.source === "theme") {
		registry.remove(def.id);
		return registry.add(def);
	}
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
