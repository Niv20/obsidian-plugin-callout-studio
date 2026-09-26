/**
 * utils/admonitionFormat.ts — What the "Obsidian Admonition" plugin writes.
 *
 * Only the file shapes live here; what to do about them is
 * `admonitionImport.ts`. The two are separate because they answer to different
 * things: this half answers to another plugin's format and changes when that
 * does, while the other answers to this vault's registry.
 *
 * The format is documented at `docs/advanced/json-spec.md` upstream, and every
 * field but `type` is optional:
 *
 *   { "type": "my-type", "title": "My Type",
 *     "icon": { "type": "fas", "name": "star" }, "color": "200, 50, 50" }
 *
 * Three containers reach us and all three are accepted, because somebody
 * handing over their admonitions has no reason to know which one they have:
 *
 * - the documented **array**, which is what Admonition's export button writes;
 * - a bare **`Record<type, Admonition>`**, which is what its `userAdmonitions`
 *   setting is;
 * - a whole **`data.json`** with that record inside it, which is what reading
 *   the installed plugin's own settings file gives.
 *
 * Nothing here validates: an entry is read as far as its shape allows and every
 * judgement about it — is the id usable, does the icon exist, is the colour a
 * colour — is the planner's, so that all of them can be reported together.
 */
import { assertImportStructure } from "./importLimits";

/** One admonition as it appears in the file, before anything is decided about it. */
export interface AdmonitionRaw {
	type: string;
	title?: unknown;
	icon?: unknown;
	color?: unknown;
	iconWithCss?: unknown;
	command?: unknown;
	copy?: unknown;
	noTitle?: unknown;
	injectColor?: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * One admonition out of an unknown value, or null when it is not one.
 *
 * `fallbackType` is the key an entry was filed under in a
 * `Record<type, Admonition>`, used when the object itself does not repeat its
 * type — which is how Admonition's own `userAdmonitions` is written.
 */
function readEntry(value: unknown, fallbackType = ""): AdmonitionRaw | null {
	if (!isRecord(value)) return null;
	const own = typeof value.type === "string" ? value.type.trim() : "";
	return {
		type: own || fallbackType.trim(),
		title: value.title,
		icon: value.icon,
		color: value.color,
		iconWithCss: value.iconWithCss,
		command: value.command,
		copy: value.copy,
		noTitle: value.noTitle,
		injectColor: value.injectColor,
	};
}

/** Every entry of a `Record<type, Admonition>`, keeping the key as the type. */
function readRecord(record: Record<string, unknown>): AdmonitionRaw[] {
	const entries: AdmonitionRaw[] = [];
	for (const [key, value] of Object.entries(record)) {
		const entry = readEntry(value, key);
		if (entry) entries.push(entry);
	}
	return entries;
}

/**
 * Find the admonitions in whatever was handed over, or null when the value is
 * not Admonition data at all.
 *
 * An empty array is not a failure — a vault whose Admonition has no custom
 * types parses fine and simply has nothing to import, which the planner says in
 * its own words. Only an unrecognizable shape is null.
 */
export function parseAdmonitionExport(raw: unknown): AdmonitionRaw[] | null {
	assertImportStructure(raw);
	// The documented import format.
	if (Array.isArray(raw)) {
		// Entries that are not objects are dropped here rather than reported:
		// a stray null in an array says nothing about a callout, and the count
		// shown in the report already comes from what survived.
		return raw
			.map((value) => readEntry(value))
			.filter((entry): entry is AdmonitionRaw => entry !== null);
	}

	if (!isRecord(raw)) return null;

	// A whole data.json — Admonition's settings file, which is what reading the
	// installed plugin's own folder gives.
	if (isRecord(raw.userAdmonitions)) return readRecord(raw.userAdmonitions);

	// A single admonition on its own.
	if (typeof raw.type === "string" && raw.type.trim()) {
		const entry = readEntry(raw);
		return entry ? [entry] : null;
	}

	// A bare `Record<type, Admonition>` — the shape `userAdmonitions` holds,
	// pasted without its wrapper. Only accepted when every value looks like an
	// admonition, so an unrelated JSON object is rejected instead of importing
	// as a pile of empty callouts.
	const values = Object.values(raw);
	if (values.length > 0 && values.every((value) => isRecord(value))) {
		return readRecord(raw);
	}

	return null;
}
