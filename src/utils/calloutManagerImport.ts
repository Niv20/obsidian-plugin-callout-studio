/**
 * utils/calloutManagerImport.ts — Bringing callouts over from the competing
 * "Obsidian Callout Manager" plugin.
 *
 * Two sources reach here and both end at one entry shape and one planner:
 *
 * - the **CSS its Copy button puts on the clipboard**, parsed by
 *   `parseCalloutManagerExport` below, e.g.
 *
 *       .callout[data-callout="test"] {
 *       	--callout-icon: lucide-bean;
 *       	--callout-color: 255, 31, 31
 *       }
 *
 * - its **own `data.json`**, read out of this vault and shape-read by
 *   `calloutManagerFormat.ts`, then interpreted here by
 *   {@link toCalloutManagerEntries}.
 *
 * Parsing is pure and never touches the registry; planning reads the registry
 * (to decide update-vs-create per id) and Obsidian's icon set (to reject an
 * icon name that names nothing) but doesn't mutate either — the actual
 * mutation is `CalloutRegistry.applyCalloutManagerImport`. Split this way so
 * the modal can show a report (via the same `ValidationIssue` shape the JSON
 * importer uses) before anything changes.
 */
import type { CalloutIcon } from "../types";
import type { CalloutRegistry } from "../manager/CalloutRegistry";
import type { ValidationIssue } from "./importValidator";
import type { CalloutManagerNote, CalloutManagerRaw } from "./calloutManagerFormat";
import { createLucideNameCheck } from "../icons/nameCheck";
import { normalizeCalloutId } from "./calloutId";
import { parseCssColorToHex } from "./colorUtils";
import { parseIconDecl } from "./calloutCssParse";
import { validateIdString } from "./importValidator";

/**
 * The colour a callout gets when the source declares it but never styled it.
 *
 * Callout Manager's own value for an unstyled callout: Obsidian's fallback grey
 * (`158, 158, 158`), which is what the user was actually looking at, and is the
 * first entry in that plugin's `default_colors.json` under the name "light
 * gray". Fidelity beats house style here — the point of reading the file is
 * that it knows things the clipboard doesn't.
 */
const CALLOUT_MANAGER_DEFAULT_COLOR = "#9e9e9e";

export interface CalloutManagerEntry {
	/** Raw `data-callout` attribute value from the selector, e.g. "test". */
	id: string;
	/** Present only when an icon was found and non-empty. */
	icon?: CalloutIcon;
	/**
	 * `#rrggbb`, present only when a colour parsed cleanly. When `colorDark` is
	 * also set this is specifically the **light**-mode accent.
	 */
	color?: string;
	/**
	 * Set only when the source stated a genuinely *different* dark-mode accent,
	 * which only `data.json` can — a copied stylesheet is one flat cascade
	 * already resolved for whichever scheme was active.
	 */
	colorDark?: string;
	/**
	 * The source says this callout exists in its own right (Callout Manager's
	 * `callouts.custom`), rather than merely restyling one that already does.
	 *
	 * It is what lets one planner serve both doors without either knowing who
	 * called it. A copied stylesheet never sets it, so a colourless block stays
	 * the error it has always been; a callout the user actually created in
	 * Callout Manager is worth importing even when that plugin stored no colour
	 * for it, because it exists in their notes either way.
	 */
	declared?: boolean;
	/** What the format layer could not bring over, for the planner to report. */
	notes?: readonly CalloutManagerNote[];
}

/**
 * Interprets what `calloutManagerFormat.ts` read: colour strings become hexes
 * and icon ids become `CalloutIcon`s.
 *
 * A pure `map` with no filtering, deliberately — `ValidationIssue.index` is the
 * row number the report shows, so it has to keep lining up with this array.
 * Everything droppable was already dropped by the format layer.
 */
export function toCalloutManagerEntries(
	raws: readonly CalloutManagerRaw[],
): CalloutManagerEntry[] {
	return raws.map((raw) => {
		const light = raw.colorLight
			? (parseCssColorToHex(raw.colorLight) ?? undefined)
			: undefined;
		const dark = raw.colorDark
			? (parseCssColorToHex(raw.colorDark) ?? undefined)
			: undefined;
		// Only a real disagreement is worth carrying as two colours. One accent
		// covers both modes perfectly well, because `derivePaletteFromColor`
		// contrast-corrects it per mode anyway — so a source that stated the same
		// hex twice, or only one of the two, collapses to the single-colour path
		// and can still match an existing palette.
		const twoTone = !!light && !!dark && light.toLowerCase() !== dark.toLowerCase();
		return {
			id: raw.id,
			icon: raw.icon ? parseIconDecl(raw.icon) : undefined,
			color: twoTone ? light : (light ?? dark),
			colorDark: twoTone ? dark : undefined,
			declared: raw.declared,
			notes: raw.notes,
		};
	});
}

export interface CalloutManagerPlanItem {
	action: "update" | "create";
	/** Set when `action === "update"`: the definition's actual (real) id. */
	existingId?: string;
	entry: CalloutManagerEntry;
}

export interface CalloutManagerPlan {
	toApply: CalloutManagerPlanItem[];
	issues: ValidationIssue[];
}

/**
 * Decides update-vs-create per parsed entry against the current registry.
 * Read-only: never mutates. Matching an existing callout uses
 * `findByAttrId`, which resolves the DOM `data-callout` attribute form
 * (exactly what a CSS selector contains) back to whichever definition —
 * built-in included — already owns it.
 *
 * Serves both doors unchanged. Everything that differs between a copied
 * stylesheet and a read `data.json` is already a property of the entry
 * (`declared`, `colorDark`, `notes`), so nothing here asks where it came from.
 */
export function planCalloutManagerImport(
	entries: readonly CalloutManagerEntry[],
	registry: CalloutRegistry,
): CalloutManagerPlan {
	if (entries.length === 0) {
		return {
			toApply: [],
			issues: [
				{
					index: -1,
					entryLabel: "",
					level: "error",
					messageKey: "import.err.cmNoBlocksFound",
				},
			],
		};
	}

	const toApply: CalloutManagerPlanItem[] = [];
	const issues: ValidationIssue[] = [];
	const lucideExists = createLucideNameCheck();

	entries.forEach((rawEntry, index) => {
		// `--callout-icon` is free text in the pasted CSS, so a typo (or an icon
		// from an Obsidian version this vault does not have) names nothing. Drop
		// it rather than storing it: a stored non-name renders as an empty
		// square, which reads as the plugin being broken. Copied, never mutated
		// — the caller's parsed entries are not ours to edit.
		let entry = rawEntry;
		const unknownIcon = entry.icon && !lucideExists(entry.icon.value);
		if (unknownIcon) {
			entry = { ...rawEntry, icon: undefined };
		}

		const existing = registry.findByAttrId(entry.id);
		if (unknownIcon) {
			issues.push({
				index,
				entryLabel: entry.id,
				field: "icon",
				level: "warning",
				// The two outcomes really do differ: an existing callout keeps
				// the icon it already has, while a new one has nothing to keep
				// and takes the default.
				messageKey: existing
					? "import.warn.cmIconUnknownExisting"
					: "import.warn.cmIconUnknownNew",
				params: {
					value: rawEntry.icon?.value ?? "",
					id: existing?.id ?? entry.id,
				},
			});
		}

		// What the source held but this plugin has no home for. Reported for an
		// update as well as a create: the callout comes over either way, and the
		// user still needs to know why it does not look quite the same.
		for (const note of entry.notes ?? []) {
			issues.push({
				index,
				entryLabel: entry.id,
				level: "warning",
				messageKey:
					note === "conditional"
						? "import.warn.cmThemeCondition"
						: "import.warn.cmCustomStyles",
			});
		}

		// A CSS selector realistically cannot carry a `|`, but a hand-edited or
		// hand-written `data.json` key can — and `note|purple` normalizes to
		// `note`, which would silently repaint the reader's real Note callout.
		// The shared rule is to reject such an id, not fold it onto its base.
		const normalizedId = normalizeCalloutId(entry.id);
		let idOk = true;
		validateIdString(
			normalizedId,
			(issue) => {
				idOk = false;
				issues.push({ ...issue, index, entryLabel: entry.id });
			},
			"id",
			entry.id,
		);
		if (!idOk) return;

		if (existing) {
			toApply.push({ action: "update", existingId: existing.id, entry });
			return;
		}

		if (!entry.color) {
			// A callout the source only ever restyled, with nothing usable left
			// after parsing, describes no callout at all — inventing one would
			// put a callout in the list that nobody asked for.
			if (!entry.declared) {
				issues.push({
					index,
					entryLabel: entry.id,
					level: "error",
					messageKey: "import.err.cmNoColorForNew",
					params: { value: entry.id },
				});
				return;
			}
			// But one the user actually created is worth keeping even unstyled:
			// it exists in their notes, and Callout Manager simply had no
			// override to store for it.
			issues.push({
				index,
				entryLabel: entry.id,
				field: "color",
				level: "warning",
				messageKey: "import.warn.cmNoColorDefault",
			});
			entry = { ...entry, color: CALLOUT_MANAGER_DEFAULT_COLOR };
		}

		const conflict = registry.findByAlias(normalizedId);
		if (conflict) {
			issues.push({
				index,
				entryLabel: entry.id,
				level: "error",
				messageKey: "import.err.cmIdConflict",
				params: { value: entry.id, other: conflict.id },
			});
			return;
		}

		toApply.push({ action: "create", entry });
	});

	return { toApply, issues };
}
