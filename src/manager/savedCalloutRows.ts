/**
 * manager/savedCalloutRows.ts — reading one saved callout row against the
 * built-ins this version ships.
 *
 * `CalloutRegistry.load()` seeds all 13 defaults and then folds `data.json`'s
 * rows over them. Two of the three cases that fold can hit are repairs, and
 * both come down to the same rule: **there is only ever one callout per id.**
 * A note writing `[!note]` means the built-in, whatever a row's own `builtIn`
 * flag says — so a row whose flag disagrees with the shipped set is that
 * callout with its flag wrong, never a second callout to choose between.
 *
 * A third repair rides along, on the row's colours rather than its flags — see
 * {@link normalizeRowColors}. It belongs here because it needs exactly the same
 * two inputs and feeds the same `repaired` flag.
 *
 * Its own module rather than an inline branch because the reasoning is longer
 * than the code and neither half reads the registry's state: given a row and
 * the answer to "does this version ship a built-in for that id", the verdict is
 * a pure function. `load()` is left with the loop and the save flag.
 */
import type { CalloutDefinition } from "../types";
import { parseCssColorToHex } from "../utils/colorUtils";

/** Shown by a row whose colour nothing could read and that has no default behind it. */
const UNREADABLE_COLOR_FALLBACK = "#7d7d7d";

/**
 * Bring one saved row's colours back to `#rrggbb`.
 *
 * `CSSInjector` concatenates these straight into the sheet and feeds them to
 * `color-mix()`, and both steps assume a real colour. The importer enforces
 * that (`HEX_COLOR_RE`), but `data.json` has two other ways in — an older build
 * and a hand edit — and neither is checked. A stored `8, 109, 221` is not a
 * colour, so every declaration reading it is dropped and the callout renders
 * with no background and no border: the same symptom a ≤1.12-era theme causes,
 * and just as hard to trace back to its cause.
 *
 * Mostly lossless normalization rather than repair — `parseCssColorToHex` knows
 * the pre-1.13 bare triplet, `rgb()`/`rgba()` and short hex, so the user keeps
 * the colour they picked. Only a value nothing can read falls back to the
 * shipped default, and a row with no built-in behind it has nothing to fall
 * back to but grey.
 *
 * The optional text colours are dropped instead of replaced: absent already
 * means "inherit the theme's", so there is no need to invent one.
 *
 * Keyed on content rather than on `data.version`, like the flag repairs beside
 * it, and idempotent — a `#rrggbb` parses back to itself, so a row that needs
 * nothing is returned untouched rather than cloned.
 */
function normalizeRowColors(
	saved: CalloutDefinition,
	seeded: CalloutDefinition | undefined,
): { def: CalloutDefinition; changed: boolean } {
	const patch: Partial<CalloutDefinition> = {};
	const drop: ("textColorLight" | "textColorDark")[] = [];

	for (const field of ["colorLight", "colorDark"] as const) {
		const current = saved[field];
		const parsed =
			typeof current === "string" ? parseCssColorToHex(current) : null;
		const fixed = parsed ?? seeded?.[field] ?? UNREADABLE_COLOR_FALLBACK;
		if (fixed !== current) patch[field] = fixed;
	}
	for (const field of ["textColorLight", "textColorDark"] as const) {
		const current = saved[field];
		if (current === undefined) continue;
		const parsed =
			typeof current === "string" ? parseCssColorToHex(current) : null;
		if (parsed === current) continue;
		if (parsed === null) drop.push(field);
		else patch[field] = parsed;
	}

	if (drop.length === 0 && Object.keys(patch).length === 0) {
		return { def: saved, changed: false };
	}
	const def = { ...saved, ...patch };
	for (const field of drop) delete def[field];
	return { def, changed: true };
}

/** What `load()` should store for one saved row, and why it differs from it. */
export interface RowVerdict {
	/** The definition to put in the map. */
	def: CalloutDefinition;
	/**
	 * True when the stored row is not the saved one — the file carries a shape
	 * this version had to repair, so it must be written back or every launch
	 * repairs it again and every export copies the broken shape onward.
	 */
	repaired: boolean;
}

/**
 * Fold a saved row onto the built-in default it claims, or demote it.
 *
 * @param saved   the row as `data.json` spelled it
 * @param seeded  the seeded default for that id, or `undefined` when this
 *                version ships no built-in by that name
 *
 * Callers must key `seeded` on the **shipped defaults**, not on what the map
 * holds so far: a user row added by an earlier turn of the same loop is also
 * "already there", and stamping that one as a built-in is precisely the
 * confusion being repaired.
 */
export function reconcileSavedRow(
	saved: CalloutDefinition,
	seeded: CalloutDefinition | undefined,
): RowVerdict {
	const { def: row, changed } = normalizeRowColors(saved, seeded);
	if (seeded) {
		// A row on one of the 13 ids. An older build, a hand-edited file or a
		// foreign importer could write one that does not claim to BE the
		// built-in, and it used to overwrite the seed outright: the map came
		// back with 12 built-ins, breaking the invariant every other subsystem
		// reads (`getAll()` always returns every built-in), and
		// `isBuiltInModified("note")` answered about a row whose own `builtIn`
		// was false. Merging onto the default keeps every edit the row carries
		// while restoring the seed, and the flags are re-stamped, never trusted.
		return {
			def: { ...seeded, ...row, builtIn: true, source: "builtin" },
			repaired: changed || saved.builtIn !== true,
		};
	}
	if (saved.builtIn) {
		// The mirror image: a row claiming to BE a built-in on an id this
		// version does not ship one for. It used to be skipped entirely, which
		// deleted the user's own styling for a type their notes still write —
		// a built-in retired in some later version would take every vault's
		// customization of it along with it. It keeps everything but the claim.
		return {
			def: {
				...row,
				builtIn: false,
				// `"builtin"` is the one source the row demonstrably is not;
				// anything else it claims (an import's `"theme"`, discovery's
				// `"fallback"`) is still true of it.
				source: saved.source === "builtin" ? "user" : saved.source,
			},
			repaired: true,
		};
	}
	if (row.source === "theme") {
		return { def: { ...row, source: "fallback" }, repaired: true };
	}
	return { def: row, repaired: changed };
}
