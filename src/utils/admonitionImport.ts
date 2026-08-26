/**
 * utils/admonitionImport.ts — Turning another plugin's admonitions into callouts.
 *
 * Admonition is the plugin most people arrive here from, and its custom types
 * carry exactly what a callout needs: a name, an icon and a colour. Reading its
 * file shapes is `admonitionFormat.ts`; deciding what each one should do to
 * this vault is here.
 *
 * Split the same way `calloutManagerImport.ts` is, and for the same reason:
 * planning reads the registry but mutates nothing, and the mutation itself is
 * `CalloutRegistry.applyAdmonitionImport`. That is what lets the import modal
 * show the user a report — in the same `ValidationIssue` shape the JSON
 * importer uses — before anything changes.
 *
 * Fields with no equivalent here (`command`, `copy`, `noTitle`, `injectColor`)
 * are dropped in silence; there is nothing useful to say about a setting this
 * plugin has no concept of. `iconWithCss` is the exception and warns, because
 * it means the admonition's whole appearance lives in a CSS snippet that is not
 * coming with it.
 */
import type { CalloutIcon, UserImageIcon } from "../types";
import type { CalloutRegistry } from "../manager/CalloutRegistry";
import type { AdmonitionRaw } from "./admonitionFormat";
import type { ValidationIssue } from "./importValidator";
import { MAX_DISPLAY_NAME, validateIdString } from "./importValidator";
import { createIconNameCheck } from "../icons/nameCheck";
import {
	convertAdmonitionImage,
	iconCandidates,
	isAdmonitionImage,
	readAdmonitionIcon,
	resolveIcon,
} from "./admonitionIcons";
import {
	calloutIdentity,
	normalizeCalloutId,
	obsidianDefaultTitle,
} from "./calloutId";
import { parseCssColorToHex } from "./colorUtils";
import { takenUserImageNames } from "./userImages";

/**
 * The colour a new callout takes when the admonition names none.
 *
 * Upstream picks a random colour in this case, which is friendly in the moment
 * and unrepeatable afterwards — importing the same file twice would give the
 * same callout two different looks. Obsidian's own Note blue instead: bland on
 * purpose, stable, and the one colour every vault already shows somewhere.
 */
const DEFAULT_IMPORT_COLOR = "#448aff";

/** One admonition after mapping, in this plugin's own terms. */
export interface AdmonitionEntry {
	/** Normalized callout id. */
	id: string;
	/**
	 * Always set for a create (falling back to the title Obsidian itself would
	 * show); set on an update only when the admonition carried an explicit
	 * `title`, so importing one that did not never renames a callout.
	 */
	displayName?: string;
	/** Absent when the file named no icon, or named one that exists nowhere. */
	icon?: CalloutIcon;
	/** `#rrggbb`. Absent only on an update, where the callout keeps its own. */
	color?: string;
}

/**
 * A union rather than one shape with optional halves, so the two actions can
 * state what they each guarantee: an update knows which definition it is
 * updating, and a create always has a colour (a callout cannot be drawn without
 * one, and the planner supplies the default). Both facts then hold at the apply
 * site without a cast or a second fallback.
 */
export type AdmonitionPlanItem =
	| { action: "update"; existingId: string; entry: AdmonitionEntry }
	| { action: "create"; entry: AdmonitionEntry & { color: string } };

export interface AdmonitionPlan {
	toApply: AdmonitionPlanItem[];
	/** Pictures that have to be added before the callouts pointing at them. */
	newImages: UserImageIcon[];
	issues: ValidationIssue[];
}

/* ------------------------------------------------------------------ *
 * Planning
 * ------------------------------------------------------------------ */

/**
 * Decide what each parsed admonition should do to the registry, and report
 * anything the user should know before it does.
 *
 * Read-only with respect to the registry and to settings: pictures are decoded
 * here (that is where the artwork is, and it has to be checked before it can be
 * promised) but handing them over is the caller's move.
 *
 * Async because both of those steps are: icon names are checked against the
 * bundled search indexes, which decode on demand, and a picture is re-encoded
 * through a canvas. Neither touches the network — an import has to work offline.
 */
export async function planAdmonitionImport(
	entries: readonly AdmonitionRaw[],
	registry: CalloutRegistry,
	existingImages: readonly UserImageIcon[],
): Promise<AdmonitionPlan> {
	const issues: ValidationIssue[] = [];
	const toApply: AdmonitionPlanItem[] = [];
	const newImages: UserImageIcon[] = [];

	if (entries.length === 0) {
		issues.push({
			index: -1,
			entryLabel: "",
			level: "error",
			messageKey: "import.err.admNoEntries",
		});
		return { toApply, newImages, issues };
	}

	// Read every icon first so the name check is built once for the whole batch:
	// it decodes one search index per pack named, and doing that per entry would
	// decode the same index dozens of times. It has to see every candidate, not
	// just the icons themselves — an icon whose pack was left open is looked for
	// in six libraries, and the check only covers what it was told about.
	const icons = entries.map((entry) => readAdmonitionIcon(entry.icon));
	const iconExists = await createIconNameCheck(
		icons.flatMap((icon) => (icon ? iconCandidates(icon) : [])),
	);

	const takenNames = takenUserImageNames(existingImages);
	// Admonition stores an uploaded picture inline on every admonition that uses
	// it, so the same artwork arrives several times over. Keyed by the data URI
	// so it is stored once and the callouts share it, exactly as they did there.
	const imagesByUri = new Map<string, UserImageIcon>();
	const seenIds = new Map<string, number>();

	for (let index = 0; index < entries.length; index++) {
		const raw = entries[index];
		if (!raw) continue;
		const icon = icons[index];
		const rawType = raw.type.trim();
		const label = rawType || `#${index + 1}`;
		const push = (
			issue: Omit<ValidationIssue, "index" | "entryLabel">,
		): void => {
			issues.push({ ...issue, index, entryLabel: label });
		};

		if (!rawType) {
			push({
				field: "type",
				level: "error",
				messageKey: "import.err.admTypeMissing",
			});
			continue;
		}

		const id = normalizeCalloutId(rawType);
		if (!validateIdString(id, push, "type", rawType)) continue;

		// Keyed by identity: `banner icon` and `banner-icon` are one callout.
		const firstSeen = seenIds.get(calloutIdentity(id));
		if (firstSeen !== undefined) {
			push({
				field: "type",
				level: "error",
				messageKey: "import.err.duplicateInFile",
				params: { value: id, first: firstSeen + 1 },
			});
			continue;
		}
		seenIds.set(calloutIdentity(id), index);

		const existing = registry.findByAttrId(id);

		// Every reason to reject the entry comes before any of the mapping
		// below, and this one is the reason why: converting a picture is the
		// one step with a side effect the plan carries out of here, and an
		// entry that is about to be skipped must not leave artwork behind in
		// the user's own pictures.
		if (!existing) {
			const conflict = registry.findByAlias(id);
			if (conflict) {
				push({
					level: "error",
					messageKey: "import.err.cmIdConflict",
					params: { value: id, other: conflict.id },
				});
				continue;
			}
		}

		if (raw.iconWithCss === true) {
			push({ level: "warning", messageKey: "import.warn.admIconWithCss" });
		}

		/* -- title -- */
		let displayName: string | undefined;
		if (typeof raw.title === "string" && raw.title.trim()) {
			displayName = raw.title.trim();
			if (displayName.length > MAX_DISPLAY_NAME) {
				push({
					field: "title",
					level: "warning",
					messageKey: "import.warn.admTitleTruncated",
					params: {
						length: displayName.length,
						max: MAX_DISPLAY_NAME,
					},
				});
				displayName = displayName.slice(0, MAX_DISPLAY_NAME).trimEnd();
			}
		}

		/* -- icon -- */
		let resolvedIcon: CalloutIcon | undefined;
		if (icon && isAdmonitionImage(icon)) {
			const cached = imagesByUri.get(icon.name);
			const image =
				cached ??
				(await convertAdmonitionImage(
					icon.name,
					`admonition-${id}`,
					takenNames,
				));
			if (image) {
				if (!cached) {
					imagesByUri.set(icon.name, image);
					newImages.push(image);
				}
				resolvedIcon = {
					type: "image",
					value: image.id,
					// Same seed the picker uses (`userImages.makeIcon`): a flat
					// one-colour drawing follows the callout's colour, which is
					// the only way a black logo stays visible in a dark theme.
					recolor: image.monochrome,
				};
			} else {
				push({
					field: "icon",
					level: "warning",
					messageKey: "import.warn.admImageFailed",
				});
			}
		} else if (icon) {
			resolvedIcon = await resolveIcon(icon, iconExists);
			if (!resolvedIcon) {
				// The two outcomes really do differ: an existing callout keeps
				// the icon it already has, while a new one has nothing to keep
				// and takes the shared import fallback.
				push({
					field: "icon",
					level: "warning",
					messageKey: existing
						? "import.warn.admIconUnknownExisting"
						: "import.warn.admIconUnknown",
					params: { value: icon.name, id: existing?.id ?? id },
				});
			}
		}

		/* -- colour -- */
		const color =
			typeof raw.color === "string"
				? (parseCssColorToHex(raw.color) ?? undefined)
				: undefined;

		if (existing) {
			toApply.push({
				action: "update",
				existingId: existing.id,
				entry: { id, displayName, icon: resolvedIcon, color },
			});
			continue;
		}

		if (!color) {
			push({
				field: "color",
				level: "warning",
				messageKey: "import.warn.admNoColor",
			});
		}

		toApply.push({
			action: "create",
			entry: {
				id,
				displayName: displayName ?? obsidianDefaultTitle(rawType),
				icon: resolvedIcon,
				color: color ?? DEFAULT_IMPORT_COLOR,
			},
		});
	}

	return { toApply, newImages, issues };
}
