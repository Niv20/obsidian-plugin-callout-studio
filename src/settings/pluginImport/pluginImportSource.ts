/**
 * settings/pluginImport/pluginImportSource.ts — what one competing plugin has
 * to tell PluginImportModal, and the vault probe every source shares.
 *
 * A source never touches the DOM. It knows how its plugin's data is shaped —
 * where the plugin keeps it, which one other way in its window offers, how its
 * data.json and that file or pasted text are read, and how the entries are
 * planned and applied — and nothing else. The modal owns every pixel, so the
 * Admonition and Callout Manager windows cannot drift apart again, which is
 * how each came to grow a second Import button.
 *
 * Entries stay behind closures (`PluginImportBatch`) rather than a type
 * parameter: the modal never needs to look at one, and a modal class with type
 * parameters would slip past the scan in tests/modalChrome.test.ts that holds
 * every window to the shared chrome.
 */
import { normalizePath, type App } from "obsidian";
import type { ValidationIssue } from "../../utils/importValidator";
import { assertImportSize, parseImportJson } from "../../utils/importLimits";
import type { SettingsSectionContext } from "../sections/types";

/** A planned import, ready for the report and then for the registry. */
export interface PluginImportPlan {
	readonly issues: ValidationIssue[];
	/** Entries that survived planning — the report's "valid" count. */
	readonly applyCount: number;
	/** The registry mutation; saving is the registry's own doing. */
	apply(): { created: number; updated: number };
	/** Runs once the window has closed, e.g. fetching missing icon artwork. */
	afterApply?(): void;
}

/** Entries one route turned up, bound to the planner that knows their shape. */
export interface PluginImportBatch {
	/** Zero makes the report fatal: there is no "import the valid ones". */
	readonly size: number;
	plan(ctx: SettingsSectionContext): Promise<PluginImportPlan>;
}

/** A file or pasted text, read: entries, or the report message saying why not. */
export type PluginImportParse =
	| { batch: PluginImportBatch }
	| { errorKey: string };

/** i18n keys, resolved at render time. */
export interface PluginImportCopy {
	title: string;
	instructions: string;
	fromVault: string;
	vaultChecking: string;
	/** Takes `{{count}}`. */
	vaultFound: string;
	/** The manual option, before it holds anything: its name, and what it takes. */
	manual: string;
	manualDesc: string;
	cancel: string;
	importButton: string;
	/** Takes `{{created}}` and `{{updated}}`. */
	notice: string;
}

/**
 * The window's fallback: the one way in besides this vault.
 *
 * One per plugin, matching what that plugin hands its users: Admonition's
 * export button writes a file (and its shared packs are files), so its window
 * takes an uploaded file; Callout Manager's Copy button fills the clipboard,
 * so its window has a box to paste into, and a Paste button. Both windows used
 * to offer both.
 */
export type PluginImportManual =
	| {
			readonly kind: "file";
			/** The file picker's `accept`. */
			readonly accept: string;
	  }
	| {
			readonly kind: "paste";
			/** i18n key: what the empty paste box says it takes. */
			readonly placeholder: string;
	  };

export interface PluginImportSource {
	/** The plugin's id, and so its folder under the config directory. */
	readonly pluginId: string;
	/** The window's own class — a styling hook user snippets may target. */
	readonly modalClass: string;
	readonly manual: PluginImportManual;
	readonly copy: PluginImportCopy;
	/** The plugin's data.json, already JSON-parsed; null when unrecognized. */
	fromDataJson(raw: unknown): PluginImportBatch | null;
	/** The manual option's text — an uploaded file's or a paste's, of unknown shape. */
	fromText(text: string): PluginImportParse;
}

export type VaultProbe =
	| { kind: "found"; batch: PluginImportBatch }
	| { kind: "empty" }
	| { kind: "notInstalled" }
	| { kind: "unreadable" };

/**
 * Look for the plugin's own settings file in this vault.
 *
 * Deliberately reads the file rather than asking `app.plugins`: somebody moving
 * off a plugin has very likely disabled it already, and its data.json is then
 * the only record of what they built. Read-only and local — the file and its
 * folder are looked at, never written, and nothing is fetched.
 *
 * With nothing to import, the plugin's folder tells two cases apart, so the
 * window can say which one the user is in. No folder at all is `notInstalled`.
 * A folder with no data.json in it (a plugin that never saved a setting), an
 * empty `{}` (one that saved nothing), or a file with no entries is `empty`.
 * A file that is there but cannot be read, parsed or recognized is
 * `unreadable`, so the window can say that instead of claiming there was
 * nothing to find.
 */
export async function probeVault(
	app: App,
	source: PluginImportSource,
): Promise<VaultProbe> {
	const { adapter, configDir } = app.vault;
	const folder = normalizePath(`${configDir}/plugins/${source.pluginId}`);
	const path = normalizePath(`${folder}/data.json`);
	try {
		// The file first: when it is there, so is the folder, and the common
		// case costs one lookup.
		if (!(await adapter.exists(path))) {
			return (await adapter.exists(folder)) ? { kind: "empty" } : { kind: "notInstalled" };
		}
		const stat = await adapter.stat(path);
		if (stat) assertImportSize(stat.size);
		const raw = parseImportJson(await adapter.read(path));
		const batch = source.fromDataJson(raw);
		if (!batch) return isEmptyObject(raw) ? { kind: "empty" } : { kind: "unreadable" };
		return batch.size > 0 ? { kind: "found", batch } : { kind: "empty" };
	} catch {
		return { kind: "unreadable" };
	}
}

function isEmptyObject(raw: unknown): boolean {
	return (
		typeof raw === "object" &&
		raw !== null &&
		!Array.isArray(raw) &&
		Object.keys(raw).length === 0
	);
}
