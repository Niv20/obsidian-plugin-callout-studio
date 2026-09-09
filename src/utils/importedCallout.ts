import type { CalloutDefinition } from "../types";
import type { CalloutRegistry } from "../manager/CalloutRegistry";
import { calloutIdentity } from "./calloutId";

/** Restore a validated backup row, preserving spellings still used in notes. */
export function applyImportedCallout(registry: CalloutRegistry, def: CalloutDefinition): boolean {
	return writeImportedCallout(registry, def, true);
}

/** Create from an import; a saved row added since planning must not be overwritten. */
export function addImportedCallout(registry: CalloutRegistry, def: CalloutDefinition): boolean {
	return writeImportedCallout(registry, def, false);
}

function writeImportedCallout(
	registry: CalloutRegistry, def: CalloutDefinition, overwrite: boolean,
): boolean {
	const existing = registry.getReal(def.id);
	// Check the entire replacement before removing local placeholders. Alias
	// and dash/space collisions count too; saved definitions still win.
	const target = existing?.source === "theme" ? undefined : existing;
	if (target && !overwrite) return false;
	const overlays = new Map<string, CalloutDefinition>();
	for (const id of [def.id, ...(def.aliases ?? [])]) {
		const conflict = registry.findByIdentity(id);
		if (!conflict || conflict.id === target?.id) continue;
		if (conflict.source !== "theme") return false;
		overlays.set(conflict.id, conflict);
	}
	return registry.batch(() => {
		for (const row of overlays.values()) registry.remove(row.id);
		const applied = target
			? replaceSavedCallout(registry, def, target)
			: registry.add(def);
		// A live preview can also block add(). Never lose the overlay on failure.
		if (!applied) for (const row of overlays.values()) registry.add(row);
		return applied;
	});
}

function replaceSavedCallout(
	registry: CalloutRegistry, def: CalloutDefinition, existing: CalloutDefinition,
): boolean {
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
