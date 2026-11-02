/**
 * icons/resolver.ts — IconResolver over the registry's SVG cache.
 *
 * Resolution order is the same for every pack: whatever was copied into
 * `data.json` when the icon was chosen, then whatever the pack can build from
 * data it holds locally. The `data.json` copy comes first on purpose — it is
 * the one that syncs, so a device that never downloaded a pack still renders
 * the icons the vault actually uses.
 *
 * The cache is typed structurally rather than as `CalloutRegistry`, so this
 * module carries no dependency on the manager layer.
 */
import type { CalloutIcon, CalloutRenderRole, IconPackId } from "../types";
import type { IconResolver } from "./types";
import { packFor } from "./registry";

/** The slice of CalloutRegistry's SVG cache that resolving actually needs. */
export interface IconSvgLookup {
	findIconSvg(pack: IconPackId, name: string, variant: string): { svg: string } | undefined;
}

/** Reports icons whose fetch has permanently failed (see MaterialSvgManager). */
export type IconFailureLookup = (icon: CalloutIcon, role: CalloutRenderRole) => boolean;

/**
 * Memo for the plain (no failure-state) resolver, which is the one requested
 * from the hot paths: a full-document repaint sweep asks for it once per token.
 */
const plainResolvers = new WeakMap<IconSvgLookup, IconResolver>();

/**
 * Wrap a cache lookup as an IconResolver.
 *
 * `hasFailed` is optional because most render surfaces have no failure state to
 * show — they paint a placeholder either way. Only the settings list and the
 * editor preview distinguish "still downloading" from "gave up".
 */
export function createIconResolver(lookup: IconSvgLookup, hasFailed?: IconFailureLookup): IconResolver {
	if (!hasFailed) {
		const memoized = plainResolvers.get(lookup);
		if (memoized) return memoized;
	}
	const resolver: IconResolver = {
		resolveSvg(icon: CalloutIcon, role: CalloutRenderRole): string | null {
			const pack = packFor(icon);
			if (!pack) return null;
			const variant = pack.cacheVariant(icon, role);
			// Keyed by the icon's own type, not its source: one source can own
			// several bodies of artwork (Font Awesome's three styles), and each
			// keeps its own cache entry.
			const cached = lookup.findIconSvg(icon.type, icon.value, variant);
			if (cached) return cached.svg;
			return pack.buildSvg?.(icon, role) ?? null;
		},
		hasFailed(icon: CalloutIcon, role: CalloutRenderRole): boolean {
			return hasFailed ? hasFailed(icon, role) : false;
		},
	};
	if (!hasFailed) plainResolvers.set(lookup, resolver);
	return resolver;
}

/** The slice of the plugin surface a failure-aware resolver reads. */
export interface IconStatusHost {
	registry: IconSvgLookup;
	hasIconFetchFailed(icon: CalloutIcon, role: CalloutRenderRole): boolean;
}

/**
 * Resolver for the two surfaces that must tell "still downloading" apart from
 * "gave up": the settings callout list and the editor's icon preview. Every
 * other surface paints a placeholder either way and uses the plain resolver.
 */
export function createStatusIconResolver(host: IconStatusHost): IconResolver {
	return createIconResolver(host.registry, (icon, role) => host.hasIconFetchFailed(icon, role));
}
