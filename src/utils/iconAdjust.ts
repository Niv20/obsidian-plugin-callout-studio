import {
	CALLOUT_RENDER_ROLES,
	type CalloutDefinition,
	type CalloutRenderRole,
	type IconAdjust,
} from "../types";

/**
 * Icon size and offsets, per render role.
 *
 * `CalloutDefinition` stores this in two layers — a per-role `iconAdjust` map
 * over a flat legacy trio — and nothing outside this module should read either
 * layer directly: {@link resolveIconAdjust} is what collapses them, and the
 * editor, the CSS generator and the import validator all go through here so the
 * fallback rules and the slider ranges cannot drift apart.
 */

/** A fully resolved adjustment: no optional fields, ready to render. */
export interface ResolvedIconAdjust {
	offsetX: number;
	offsetY: number;
	size: number;
}

/** The neutral adjustment — no offset, no scaling. */
export const DEFAULT_ICON_ADJUST: ResolvedIconAdjust = {
	offsetX: 0,
	offsetY: 0,
	size: 1,
};

/**
 * Slider ranges, shared by the editor's controls and the import validator's
 * range checks so a hand-edited file can never carry a value the UI cannot
 * represent (nor the reverse).
 */
export const ICON_ADJUST_LIMITS = {
	offset: { min: -10, max: 10, step: 1 },
	size: { min: 0.5, max: 1.5 },
} as const;

/** The subset of a definition this module reads. */
export type IconAdjustSource = Pick<
	CalloutDefinition,
	"iconAdjust" | "iconOffsetX" | "iconOffsetY" | "iconSize"
>;

/**
 * Clamp into range, falling back for anything absent or non-finite. `data.json`
 * syncs and can be hand-edited, so a stored value is never assumed sane.
 */
function clamp(
	value: number | undefined,
	min: number,
	max: number,
	fallback: number,
): number {
	if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
	return Math.max(min, Math.min(value, max));
}

/**
 * The adjustment one role should actually render with.
 *
 * Resolution is per *field*, not per role object: a role entry that sets only
 * `offsetY` still inherits the definition's legacy size rather than snapping it
 * back to 1. Each field reads `iconAdjust[role].<field>` → the legacy flat
 * field → the default, then clamps.
 *
 * `def` is nullable so callers holding a possibly-absent definition — the
 * editor seeding a brand-new callout, say — need no guard of their own.
 */
export function resolveIconAdjust(
	def: IconAdjustSource | null | undefined,
	role: CalloutRenderRole,
): ResolvedIconAdjust {
	if (!def) return { ...DEFAULT_ICON_ADJUST };
	const perRole = def.iconAdjust?.[role];
	const { offset, size } = ICON_ADJUST_LIMITS;
	return {
		offsetX: clamp(
			perRole?.offsetX ?? def.iconOffsetX,
			offset.min,
			offset.max,
			DEFAULT_ICON_ADJUST.offsetX,
		),
		offsetY: clamp(
			perRole?.offsetY ?? def.iconOffsetY,
			offset.min,
			offset.max,
			DEFAULT_ICON_ADJUST.offsetY,
		),
		size: clamp(
			perRole?.size ?? def.iconSize,
			size.min,
			size.max,
			DEFAULT_ICON_ADJUST.size,
		),
	};
}

/** True when an adjustment renders identically to no adjustment at all. */
export function isDefaultIconAdjust(a: ResolvedIconAdjust): boolean {
	return equalIconAdjust(a, DEFAULT_ICON_ADJUST);
}

/** Field-wise equality of two resolved adjustments. */
export function equalIconAdjust(
	a: ResolvedIconAdjust,
	b: ResolvedIconAdjust,
): boolean {
	return (
		a.offsetX === b.offsetX && a.offsetY === b.offsetY && a.size === b.size
	);
}

/**
 * Whether two stored adjustment shapes render identically in every role.
 *
 * This intentionally compares resolved values rather than raw storage. The
 * editor mirrors Regular into the legacy flat trio and stores role-specific
 * departures in `iconAdjust`, while imported or older data may spell the same
 * result with a partial role object. Built-in reset needs to recognise all of
 * those as the shipped result so it can restore the shipped raw fields exactly
 * instead of persisting explicit 0 / 0 / 1 values as a customization.
 */
export function iconAdjustSourcesEqual(
	a: IconAdjustSource,
	b: IconAdjustSource,
): boolean {
	return CALLOUT_RENDER_ROLES.every((role) =>
		equalIconAdjust(resolveIconAdjust(a, role), resolveIconAdjust(b, role)),
	);
}

/** Clone the four raw fields without materializing defaults for absent values. */
export function cloneIconAdjustFields(
	source: IconAdjustSource,
): IconAdjustSource {
	return {
		iconAdjust: source.iconAdjust
			? structuredClone(source.iconAdjust)
			: undefined,
		iconOffsetX: source.iconOffsetX,
		iconOffsetY: source.iconOffsetY,
		iconSize: source.iconSize,
	};
}

/**
 * The `iconAdjust` map to persist for a set of resolved per-role values.
 *
 * A role is omitted when it matches `regular`, **not** when it matches the
 * neutral default — because the caller mirrors `regular` into the flat legacy
 * trio, and that trio is what {@link resolveIconAdjust} falls an omitted role
 * back to. Omitting on neutral instead would silently resurrect regular's
 * offset on any role the user deliberately zeroed while regular stayed nudged.
 *
 * All three roles matching therefore collapses to `undefined`, leaving an
 * untouched callout byte-identical in `data.json` and in an export — which is
 * also what keeps `CalloutRegistry`'s modified-built-in comparison honest, since
 * that compares this field by value.
 */
export function buildIconAdjust(
	byRole: Record<CalloutRenderRole, ResolvedIconAdjust>,
): Partial<Record<CalloutRenderRole, IconAdjust>> | undefined {
	const out: Partial<Record<CalloutRenderRole, IconAdjust>> = {};
	let any = false;
	for (const role of Object.keys(byRole) as CalloutRenderRole[]) {
		const a = byRole[role];
		if (equalIconAdjust(a, byRole.regular)) continue;
		// Every field is written, never a partial entry: the per-field fallback
		// in resolveIconAdjust exists for hand-edited files, not for this writer.
		out[role] = { offsetX: a.offsetX, offsetY: a.offsetY, size: a.size };
		any = true;
	}
	return any ? out : undefined;
}
