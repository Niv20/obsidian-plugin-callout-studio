/**
 * icons/lucideId.ts — Lucide's two spellings, and which one actually draws.
 *
 * `getIconIds()` hands back three different things under one list, and only the
 * first is spelled with a prefix:
 *
 * - Obsidian's own ~1900 Lucide icons, as `lucide-book`.
 * - Ids other plugins registered with `addIcon()`, bare — `remix-QuestionnaireFill`.
 * - ~44 icons internal to Obsidian, also bare — `dice`, `discord`, `help`.
 *
 * `getIcon()` reads that prefix as an instruction, not as decoration: seeing it,
 * it looks in the core Lucide table and **nowhere else**, while a bare id is
 * tried against the plugin table, the internal table, the deprecated-name
 * aliases and core Lucide in turn. A bare id therefore resolves through four
 * tables and a prefixed one through a single table — so `lucide-` prepended to
 * an id that isn't core Lucide names nothing at all.
 *
 * v2.7.0 prepended it to every bare value on the way into the registry, which is
 * exactly that mistake, and it is why this module exists. The rule it replaces
 * that with: **store whatever `getIconIds()` said, and normalize only when
 * comparing.** {@link canonicalIconValue} and {@link iconsEqual} are the
 * comparison side; {@link resolveLucideId} repairs a value that was already
 * written the other way.
 */
import { getIconIds } from "obsidian";
import type { CalloutIcon } from "../types";

const LUCIDE_PREFIX = "lucide-";

/** The name without Obsidian's core-Lucide prefix, if it carried one. */
export function bareLucideName(name: string): string {
	return name.startsWith(LUCIDE_PREFIX) ? name.slice(LUCIDE_PREFIX.length) : name;
}

/**
 * Snapshot of just the prefixed half of `getIconIds()` — Obsidian's own Lucide
 * table, which is fully registered before any plugin loads and never grows
 * afterwards. Reading it once is safe for that reason and that reason only:
 * the bare half keeps growing as other plugins call `addIcon()`, which is why
 * `packs/lucide.ts` must go on reading the list fresh every time.
 */
let coreLucideIds: ReadonlySet<string> | null = null;

function isCoreLucideId(id: string): boolean {
	coreLucideIds ??= new Set(getIconIds().filter((name) => name.startsWith(LUCIDE_PREFIX)));
	return coreLucideIds.has(id);
}

/**
 * The spelling of a `lucide` value that Obsidian can actually draw.
 *
 * A bare id is already the forgiving spelling, so it is returned untouched. A
 * prefixed one is only meaningful if core Lucide has it; if it doesn't, the
 * prefix can only have come from v2.7.0–2.7.1 rewriting a bare id, and dropping
 * it hands the id back to the three tables that might know it.
 *
 * Cheap enough for the paint path — a set lookup, no `getIcon()` clone.
 */
export function resolveLucideId(value: string): string {
	const id = value.trim();
	if (!id.startsWith(LUCIDE_PREFIX) || isCoreLucideId(id)) return id;
	return id.slice(LUCIDE_PREFIX.length);
}

/**
 * An icon's value reduced to a form two spellings of the same icon share.
 *
 * For comparison only — never store this. The picker writes the `getIconIds()`
 * spelling and `constants.ts` writes the bare one; both name the same drawing,
 * and every `===` between them has to say so.
 */
export function canonicalIconValue(icon: CalloutIcon): string {
	return icon.type === "lucide" ? bareLucideName(icon.value.trim()) : icon.value;
}

/**
 * Every own field except the two {@link iconsEqual} has already compared, in a
 * key order neither side chose. Two icons built by different code paths spell
 * the same object with different key orders, and a plain `JSON.stringify` diff
 * would call that a difference. An explicit `undefined` is dropped so it equals
 * an absent field, which is what a round-trip through `data.json` produces.
 */
function comparableRest(icon: CalloutIcon): string {
	const rest = Object.entries(icon)
		.filter(([key, value]) => key !== "type" && key !== "value" && value !== undefined)
		.sort(([a], [b]) => (a < b ? -1 : 1));
	return JSON.stringify(rest);
}

/**
 * Do these two icons name the same drawing, drawn the same way?
 *
 * Structural, so a field added to {@link CalloutIcon} later is covered without
 * being spelled out here — but Lucide-spelling-insensitive, which is the whole
 * point: a built-in's bare `pencil` and the picker's `lucide-pencil` are one
 * icon, and anything diffing them (`isModified`, the editor's revert
 * affordance) must not report a change the user never made.
 */
export function iconsEqual(a?: CalloutIcon, b?: CalloutIcon): boolean {
	if (a === b) return true;
	if (!a || !b) return false;
	if (a.type !== b.type) return false;
	if (canonicalIconValue(a) !== canonicalIconValue(b)) return false;
	return comparableRest(a) === comparableRest(b);
}
