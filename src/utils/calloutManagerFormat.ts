/**
 * utils/calloutManagerFormat.ts — What the "Obsidian Callout Manager" plugin
 * writes into its own `data.json`.
 *
 * Only the file shape lives here; what to do about it is
 * `calloutManagerImport.ts`. Same split as `admonitionFormat.ts` and for the
 * same reason: this half answers to another plugin's format and changes when
 * that does, while the other answers to this vault's registry. Nothing here is
 * interpreted — colors stay the strings the file holds and icons stay raw
 * Obsidian icon ids, so every judgement about them is made in one place.
 *
 * This is the second door into the Callout Manager importer. The first reads
 * the CSS its Copy button puts on the clipboard (`parseCalloutManagerExport`),
 * and that text is already resolved for whichever color scheme was active when
 * the button was pressed — so it structurally cannot carry a callout stored
 * with a different light and dark color, and a callout that was created but
 * never restyled emits no CSS at all and is invisible to it. Reading the
 * settings file recovers both.
 *
 * The format, from Callout Manager's own `src/settings.ts` and
 * `src/callout-settings.ts`:
 *
 *   { "callouts": {
 *       "custom": ["my-callout"],
 *       "settings": {
 *         "my-callout": [
 *           { "changes": { "icon": "lucide-bean" } },
 *           { "condition": { "colorScheme": "light" }, "changes": { "color": "255, 31, 31" } },
 *           { "condition": { "colorScheme": "dark"  }, "changes": { "color": "180, 20, 20" } }
 *         ]
 *       } },
 *     "calloutDetection": { "obsidian": true, "theme": true, "snippet": true } }
 *
 * Two things about it are easy to get wrong:
 *
 * - **`color` is a comma-delimited RGB tuple**, not a hex and not a CSS color:
 *   Callout Manager emits it as `--callout-color: rgb(<color>)`.
 * - **`settings` is not a subset of `custom`.** It holds every callout the user
 *   restyled, which includes Obsidian's built-ins (`note`, `help`) and callouts
 *   that came from a theme or a CSS snippet. Those are imported too — they are
 *   customizations the user made, and the paste path already brings them over
 *   because the copied CSS contains them.
 *
 * Nothing here validates or reports either. What could not be brought over is
 * recorded as a {@link CalloutManagerNote} and the planner — which owns the
 * entry index a `ValidationIssue` needs — turns it into a warning, so every
 * issue is still reported together.
 */
import { assertImportStructure } from "./importLimits";

/** What could not be brought over, for the planner to turn into report rows. */
export type CalloutManagerNote = "conditional" | "customStyles" | "schemeIcon";

/** One Callout Manager callout as the file describes it, uninterpreted. */
export interface CalloutManagerRaw {
	/** The id exactly as the file keys it. */
	id: string;
	/**
	 * The id is listed in `callouts.custom` — a callout Callout Manager itself
	 * created, rather than one it merely restyled. Only such a callout is worth
	 * creating when the file gives it no color at all.
	 */
	declared: boolean;
	/** Raw `changes.icon`: an Obsidian icon id, e.g. `lucide-bean`. */
	icon?: string;
	/** Raw `changes.color`, normally a comma triplet such as `"158, 158, 158"`. */
	colorLight?: string;
	colorDark?: string;
	notes: readonly CalloutManagerNote[];
}

type Scheme = "light" | "dark";

/**
 * Whether one `CalloutSettings` entry applies to a color scheme.
 *
 * Three-valued on purpose. Callout Manager's conditions are richer than
 * anything a `CalloutDefinition` can express: only `colorScheme` maps onto our
 * light/dark split, while a theme name means "while that theme is active" and
 * `and`/`or` combine conditions arbitrarily. A callout here is styled once for
 * all themes, so those cannot be honoured as written — but they are still the
 * color the user picked, and dropping them outright is how an importer loses
 * somebody's work. `"maybe"` is the third answer: applied only where nothing
 * unconditional already decided, and reported when it is.
 */
type Verdict = "yes" | "no" | "maybe";

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** A trimmed non-empty string, or undefined — the file's own "unset". */
function str(value: unknown): string | undefined {
	if (typeof value !== "string") return undefined;
	const trimmed = value.trim();
	return trimmed ? trimmed : undefined;
}

function evaluate(condition: unknown, scheme: Scheme): Verdict {
	if (condition === undefined || condition === null) return "yes";
	if (!isRecord(condition)) return "maybe";

	if (typeof condition.colorScheme === "string") {
		return condition.colorScheme === scheme ? "yes" : "no";
	}

	// Any theme name, Callout Manager's `<default>` sentinel included: that
	// sentinel is not "unconditional", it is the no-theme-specific-setting
	// branch, which is still a branch we cannot reproduce.
	if (typeof condition.theme === "string") return "maybe";

	// Ordinary boolean algebra, which is also what an empty array gives:
	// `{and: []}` is vacuously true, `{or: []}` vacuously false.
	if (Array.isArray(condition.and)) {
		let result: Verdict = "yes";
		for (const child of condition.and) {
			const verdict = evaluate(child, scheme);
			if (verdict === "no") return "no";
			if (verdict === "maybe") result = "maybe";
		}
		return result;
	}
	if (Array.isArray(condition.or)) {
		let result: Verdict = "no";
		for (const child of condition.or) {
			const verdict = evaluate(child, scheme);
			if (verdict === "yes") return "yes";
			if (verdict === "maybe") result = "maybe";
		}
		return result;
	}

	// A condition kind from a Callout Manager newer than this build. Treating it
	// as unconditional would style the callout in a case the user restricted it
	// out of; treating it as a fallback keeps the color without claiming to know.
	return "maybe";
}

interface Layer {
	color?: string;
	icon?: string;
}

interface SchemeResult {
	layer: Layer;
	/** A conditional value supplied the result, or a later conditional override was lost. */
	conditional: boolean;
	customStyles: boolean;
}

/**
 * Flattens one callout's `CalloutSettings` for a single color scheme.
 *
 * The array is a cascade in file order, last-write-wins **per property** — the
 * same thing Callout Manager's own `calloutSettingsToStyles` achieves by
 * emitting the declarations in order and letting CSS resolve them. So an entry
 * that sets only `icon` must not erase a `color` an earlier entry set.
 *
 * Definite and maybe are kept apart and merged at the end, so an unconditional
 * value always beats a theme-conditional one no matter which came first in the
 * file. Report conditional fallbacks and later conditional overrides that we
 * cannot preserve; earlier conditions erased by a later definite rule are quiet.
 */
function flatten(settings: unknown, scheme: Scheme): SchemeResult {
	const definite: Layer = {};
	const maybe: Layer = {};
	let customStyles = false;

	if (Array.isArray(settings)) {
		for (const raw of settings) {
			if (!isRecord(raw)) continue;
			const verdict = evaluate(raw.condition, scheme);
			if (verdict === "no") continue;

			const changes = isRecord(raw.changes) ? raw.changes : {};
			const into = verdict === "yes" ? definite : maybe;

			const color = str(changes.color);
			if (color) {
				into.color = color;
				if (verdict === "yes") delete maybe.color;
			}
			const icon = str(changes.icon);
			if (icon) {
				into.icon = icon;
				if (verdict === "yes") delete maybe.icon;
			}

			// Never mined for values. Callout Manager's custom-styles box is free
			// CSS; picking `--callout-color` back out of it would be a second,
			// worse parser beside the good one, and would half-apply a rule whose
			// other half we dropped. Reported and left behind, exactly as the
			// Admonition importer does for a snippet-styled admonition.
			if (str(changes.customStyles)) customStyles = true;
		}
	}

	const layer: Layer = {
		color: definite.color ?? maybe.color,
		icon: definite.icon ?? maybe.icon,
	};
	const conditional =
		(maybe.color !== undefined && maybe.color !== definite.color) ||
		(maybe.icon !== undefined && maybe.icon !== definite.icon);

	return { layer, conditional, customStyles };
}

function readCallout(
	id: string,
	declared: boolean,
	settings: unknown,
): CalloutManagerRaw {
	const light = flatten(settings, "light");
	const dark = flatten(settings, "dark");

	const notes: CalloutManagerNote[] = [];
	if (light.conditional || dark.conditional) notes.push("conditional");
	if (light.customStyles || dark.customStyles) notes.push("customStyles");
	if (light.layer.icon !== dark.layer.icon) notes.push("schemeIcon");

	return {
		id,
		declared,
		// One icon per callout here, so light decides and dark only fills in when
		// light said nothing. Callout Manager can render per-scheme icons from a
		// hand-edited file, even though its visual editor calls them "complex".
		// Report that loss rather than claiming these files import faithfully.
		icon: light.layer.icon ?? dark.layer.icon,
		colorLight: light.layer.color,
		colorDark: dark.layer.color,
		notes,
	};
}

/** Reads the `custom` / `settings` pair into one raw per callout. */
function readCallouts(custom: unknown, settings: unknown): CalloutManagerRaw[] {
	const settingsRecord = isRecord(settings) ? settings : {};

	const declared = new Set<string>();
	if (Array.isArray(custom)) {
		for (const id of custom) {
			if (typeof id === "string" && str(id)) declared.add(id);
		}
	}

	// `custom` first, so the callouts the user actually made head the report,
	// then everything they only restyled — built-ins, theme and snippet callouts.
	const ids = [...declared];
	for (const id of Object.keys(settingsRecord)) {
		// Keep the original key for lookup and validation. Trimming first loses
		// its settings and hides forbidden leading/trailing tabs or newlines.
		if (str(id) && !declared.has(id)) ids.push(id);
	}

	return (
		ids
			.map((id) => readCallout(id, declared.has(id), settingsRecord[id]))
			// A callout that is not the user's own and carries nothing importable
			// is dropped rather than reported: real files are full of `{"changes":
			// {}}` leftovers, and a report padded with rows saying "nothing
			// happened" buries the rows that matter. Unsupported styling still
			// needs a report row. A *declared* callout is kept even when bare.
			.filter(
				(entry) =>
					entry.declared ||
					entry.icon !== undefined ||
					entry.colorLight !== undefined ||
					entry.colorDark !== undefined ||
					entry.notes.length > 0,
			)
	);
}

/**
 * Find the callouts in whatever was handed over, or null when the value is not
 * Callout Manager data at all.
 *
 * An empty array is not a failure — a vault whose Callout Manager has no custom
 * callouts and no overrides parses fine and simply has nothing to import. Only
 * an unrecognizable shape is null.
 */
export function parseCalloutManagerData(
	raw: unknown,
): CalloutManagerRaw[] | null {
	// Direct callers get the same depth/work limits as file and paste routes.
	assertImportStructure(raw);
	if (!isRecord(raw)) return null;

	// A whole data.json — what reading the installed plugin's own folder gives.
	if (isRecord(raw.callouts)) {
		return readCallouts(raw.callouts.custom, raw.callouts.settings);
	}

	// The `callouts` object on its own, without its wrapper.
	if (Array.isArray(raw.custom) || isRecord(raw.settings)) {
		return readCallouts(raw.custom, raw.settings);
	}

	// A bare `Record<id, CalloutSettings>`. Accepted only when every value is an
	// array of `{changes}` records, which is what a `CalloutSettings` is. That
	// test is what keeps an unrelated JSON object out — and, in particular, an
	// Admonition `userAdmonitions` record, whose values are objects, not arrays.
	const values = Object.values(raw);
	if (
		values.length > 0 &&
		values.every(
			(value) =>
				Array.isArray(value) &&
				value.every((item) => isRecord(item) && isRecord(item.changes)),
		)
	) {
		return readCallouts(undefined, raw);
	}

	return null;
}
