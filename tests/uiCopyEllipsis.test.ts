/**
 * tests/uiCopyEllipsis.test.ts — what a trailing "…" is allowed to mean.
 *
 * The ellipsis was used on four action labels out of some sixty, and on two of
 * them for the wrong reason: **Convert selected…** opened only a yes/no
 * confirmation, exactly like **Delete** and **Reset everything**, which carried
 * none, while **Import**, **Export** and **Replace in vault** each opened a step
 * that asks for something the label does not say, and carried none either. Nothing
 * decided it, so each label got whatever its author felt that day.
 *
 * The rule (docs/internals-docs/16, "Button labels and the ellipsis") is one
 * sentence: `…` says *the next step asks for a detail this label does not
 * name* — a source, a format, a file, a replacement, the text itself. A button
 * that acts at once, that only asks "sure?", that opens the form or window its
 * own name already says, or that is an icon with an aria-label, stays plain.
 *
 * A sentence in a document is a habit until something fails. This suite fails
 * in three places:
 *
 * - **A new "…" nobody has classified.** Every English string that carries one
 *   must be filed under what its dots mean — asking for a detail, something in
 *   progress, a placeholder, or a cut-short list. Adding one means choosing, which is the step that used to be skipped.
 * - **An action label on the wrong side.** The asking actions end in `…`; the
 *   near misses (the labels most likely to be "fixed" the wrong way) do not.
 * - **A different glyph.** Three periods and a space before the dots are both
 *   ways of drawing the same mark twice.
 *
 * English only. The translations follow English by hand: a locale ends a label
 * in its language's ellipsis exactly when English does, and `t()` falls back per
 * key, so a locale that trails behind still reads correctly.
 */
import assert from "node:assert";
import { describe, it } from "node:test";
import { en } from "../src/i18n/en";
import { pluginSourceFiles, report } from "./support/sourceScan";

/**
 * Actions whose next step asks for a detail the label does not name. They end
 * in `…`.
 */
const ASKS_NEXT: readonly string[] = [
	"settings.import", // opens "Import from": which source?
	"settings.export", // opens "Export as": which format?
	"import.upload", // opens the file picker
	"import.replace", // the same button once a file is staged
	"deleteModal.replaceInstead", // goes on to choose the replacement
	"settings.replaceAction", // opens "Replace with:": which callout?
	"portable.customize", // starts the inline editor: what text?
	"portable.editCustom", // the same, for a replacement that is already custom
];

/** Text that says something is going on. The dots mean "still running". */
const IN_PROGRESS: readonly string[] = [
	"saveStatus.working",
	"recovery.loading",
	"recovery.details.loading",
	"manualDiscovery.scanning",
	"locale.downloading",
	"portable.scanning",
	"portable.converting",
	"editor.saving",
	"iconPack.downloading",
	"usage.loading",
	"usage.stale",
	"usage.missing",
	"usage.changed",
	"import.importing",
	"import.cmVaultChecking",
	"import.admVaultChecking",
];

/** Hint text inside an empty field. */
const PLACEHOLDER: readonly string[] = [
	"replaceModal.searchPlaceholder",
	"calloutPicker.placeholder",
	"editor.paletteSearchPlaceholder",
	"import.cmPlaceholder",
];

/** A list that was cut short; the dots stand for the rest of it. */
const TRUNCATION: readonly string[] = ["recovery.details.value.more"];

const FILED: Readonly<Record<string, readonly string[]>> = {
	ASKS_NEXT,
	IN_PROGRESS,
	PLACEHOLDER,
	TRUNCATION,
};

/**
 * The labels most likely to be "corrected" onto the wrong side, each with the
 * reason it takes no dots. Every key here is read by the plugin; a key that goes
 * away should leave this list with it.
 */
const STAYS_PLAIN: Readonly<Record<string, string>> = {
	// The form or window the label already names.
	"settings.addNewCallout": "opens the editor the label names",
	"settings.newPalette": "opens the editor the label names",
	"commandBuilder.newCommand": "opens the editor the label names",
	"contextMenu.createCallout": "opens the editor the label names",
	"contextMenu.editCallout": "opens the editor the label names",

	// Only a yes/no confirmation follows.
	"portable.convertSelected": "only a confirmation follows",
	"portable.finishConversion": "only a confirmation follows",
	"settings.resetAllButton": "only a confirmation follows",
	"settings.deleteAction": "only a confirmation follows",
	"settings.clearUsesAction": "only a confirmation follows",
	"recovery.restore": "only a confirmation follows",
	"saveStatus.restoreSettings": "only a confirmation follows",
	"saveStatus.createSettingsFile": "only a confirmation follows",
	"saveStatus.replaceUnreadable": "only a confirmation follows",
	"saveStatus.discardRecoveryCopy": "only a confirmation follows",

	// A window that is itself the destination.
	"settings.recoveryButton": "the window carries the same name",
	"portable.review": "opens the review it names",
	"settings.customCommandsButton": "opens a manager",
	"settings.customizeMenuButton": "opens a settings window",
	"settings.globalSettingsCustomize": "opens a settings window",
	"footer.iconCredits": "opens a read-only window",
	"contextMenu.openSettings": "opens settings",
	"usage.menu": "opens the Find callouts view",
	"saveStatus.goToBackups": "navigates, asks nothing",

	// Does it at once.
	"settings.resetAction": "acts at once",
	"settings.duplicateAction": "acts at once",
	"settings.makeFallbackAction": "acts at once",
	"settings.rescanVaultHintAction": "acts at once",
	"import.pasteButton": "acts at once",
	"iconPack.download": "acts at once",

	// The last step of a dialog: nothing follows it.
	"vault.confirmReplace": "the dialog's own final step",
	"import.confirmAction": "the dialog's own final step",
	"import.cmBtnImport": "the dialog's own final step",
	"import.admBtnImport": "the dialog's own final step",
	"confirm.ok": "the dialog's own final step",
	"portable.confirmAction": "the dialog's own final step",
	"deleteModal.deleteInUse": "the dialog's own final step",
	"deleteModal.clearUsages": "the dialog's own final step",
	"deleteModal.deleteUnused": "the dialog's own final step",

	// Points at a row on the page; opens nothing.
	"importBanner.action": "only highlights the Import row",

	// Icon-only controls: these strings are aria-labels, never visible text.
	"iconPicker.uploadCustom": "icon-only; an aria-label",
	"editor.pickIcon": "icon-only; an aria-label",
	"editor.replaceIcon": "icon-only; an aria-label",
};

const ELLIPSIS = "…";
const dotted = Object.keys(en).filter((key) => (en[key] ?? "").includes(ELLIPSIS));

/** Every hand-written plugin source file in one string; `src/i18n/` is not in it. */
const sourceText = pluginSourceFiles().map((file) => file.text).join("\n");
const isRead = (key: string): boolean => sourceText.includes(`"${key}"`);

/* -------------------------------------------------------------------------- */
/* Every ellipsis has a meaning on file                                       */
/* -------------------------------------------------------------------------- */

describe("every ellipsis in the English strings has a meaning on file", () => {
	it("files each string that carries one, and none twice", () => {
		const where = new Map<string, string[]>();
		for (const [meaning, keys] of Object.entries(FILED)) {
			for (const key of keys) where.set(key, [...(where.get(key) ?? []), meaning]);
		}
		const unfiled = dotted.filter((key) => !where.has(key));
		assert.deepStrictEqual(
			unfiled,
			[],
			report(
				'These strings end in "…" but no meaning is filed for them. Ask the three questions in ' +
					"docs/internals-docs/16 (Button labels and the ellipsis), then add each key to the " +
					"list in tests/uiCopyEllipsis.test.ts that says what its dots mean — or drop the dots:",
				unfiled,
			),
		);
		const twice = [...where].filter(([, meanings]) => meanings.length > 1).map(([key, m]) => `${key}: ${m.join(" + ")}`);
		assert.deepStrictEqual(twice, [], report("These keys are filed under more than one meaning:", twice));
	});

	it("keeps no entry for a string that has lost its dots or its key", () => {
		const stale = Object.values(FILED).flat().filter((key) => !dotted.includes(key));
		assert.deepStrictEqual(
			stale,
			[],
			report("Filed as carrying an ellipsis, but en.ts no longer does. Remove them from the list:", stale),
		);
	});
});

/* -------------------------------------------------------------------------- */
/* Action labels sit on the right side of the line                            */
/* -------------------------------------------------------------------------- */

describe("an action label ends in the ellipsis exactly when its next step asks for something", () => {
	it("ends every asking action with the ellipsis, and puts nothing after it", () => {
		const bad = ASKS_NEXT.filter((key) => !(en[key] ?? "").endsWith(ELLIPSIS));
		assert.deepStrictEqual(bad, [], report('These asking actions do not end in "…":', bad));
	});

	it("leaves the near misses plain", () => {
		const bad = Object.keys(STAYS_PLAIN)
			.filter((key) => (en[key] ?? "").includes(ELLIPSIS))
			.map((key) => `${key} ("${en[key]}") — ${STAYS_PLAIN[key]}`);
		assert.deepStrictEqual(
			bad,
			[],
			report(
				'These labels take no dots (their reason is on the right), yet they end in "…". ' +
					"If the next step now asks for a detail the label lacks, move the key to ASKS_NEXT:",
				bad,
			),
		);
	});

	it("keeps both lists pointed at keys the plugin still reads", () => {
		const missing = [...ASKS_NEXT, ...Object.keys(STAYS_PLAIN)].filter((key) => !(key in en) || !isRead(key));
		assert.deepStrictEqual(
			missing,
			[],
			report("No English string, or no code that reads it, for these keys. Drop or fix the entry:", missing),
		);
	});

});

/* -------------------------------------------------------------------------- */
/* The mark itself                                                            */
/* -------------------------------------------------------------------------- */

describe("the ellipsis is one character", () => {
	it("is never spelled with three periods", () => {
		const bad = Object.keys(en).filter((key) => (en[key] ?? "").includes("..."));
		assert.deepStrictEqual(
			bad,
			[],
			report('These strings spell the ellipsis as "...". Use the one character "…" (U+2026):', bad),
		);
	});

	it("never has a space before it", () => {
		const bad = dotted.filter((key) => /\s…/.test(en[key] ?? ""));
		assert.deepStrictEqual(bad, [], report('These strings put a space before "…":', bad));
	});
});
