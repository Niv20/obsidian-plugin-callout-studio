import type { CalloutIcon } from "../types";
import { CALLOUT_RENDER_ROLES } from "../types";
import type { CalloutRegistry } from "../manager/CalloutRegistry";
import { packFor } from "./registry";

/**
 * Whether every drawing this icon could need is already in `data.json`.
 *
 * All roles, not just the one on screen: `copyPackArtwork` stores them all,
 * so anything short of that means the pack is still needed — to fill in the
 * heading callout or inline callout the user may enable later.
 */
export function isIconFullyCached(registry: CalloutRegistry, icon: CalloutIcon): boolean {
	const pack = packFor(icon);
	if (!pack) return true;
	// Lucide and emoji carry no artwork of their own to be missing, and a
	// user's own picture is already sitting in settings — none of the three
	// has anything a download could add.
	if (
		pack.kind === "builtin" ||
		pack.kind === "glyph" ||
		pack.kind === "local"
	) {
		return true;
	}
	return CALLOUT_RENDER_ROLES.every((role) =>
		registry.findIconSvg(
			icon.type,
			icon.value,
			pack.cacheVariant(icon, role),
		),
	);
}

/**
 * Copy this icon's drawings out of the pack and into `data.json`.
 *
 * Every render role is copied, not just the one on screen: a pack can draw
 * the same icon differently per surface (Octicons' 16px and 24px art), and
 * enabling inline callouts later must not require the pack to still be around.
 * Two roles that share a drawing collapse to one entry via the cache key.
 */
export function copyIconPackArtwork(registry: CalloutRegistry, icon: CalloutIcon): boolean {
	const pack = packFor(icon);
	if (!pack?.buildSvg) return false;

	let stored = false;
	for (const role of CALLOUT_RENDER_ROLES) {
		const variant = pack.cacheVariant(icon, role);
		if (registry.findIconSvg(icon.type, icon.value, variant)) {
			continue;
		}
		const svg = pack.buildSvg(icon, role);
		if (!svg) continue;
		registry.addIconSvg({
			pack: icon.type,
			name: icon.value,
			variant,
			svg,
		});
		stored = true;
	}
	return stored;
}
