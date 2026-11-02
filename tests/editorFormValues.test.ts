/**
 * tests/editorFormValues.test.ts — small details of the callout editor's form
 * that follow Obsidian (findings S5-V2, S5-V3, S5-15 and S5-07).
 *
 * - The four rows that describe the callout share one Obsidian settings box
 *   (`SettingGroup`), and the preview below is set off by a gap, not a line.
 * - The preview's title is an Obsidian heading above its box, and Picture is
 *   an Obsidian group like the icon adjustments (`iconAdjustGroup.test.ts`).
 * - A built-in callout's name cannot change (Obsidian declares it), so the
 *   editor shows it inside a disabled, field-shaped box (not bare text pinned
 *   to the row's edge).
 * - While a save runs, Save keeps its words and its size and shows Obsidian's
 *   own spinner (`mod-loading`), instead of turning into "Saving…".
 *
 * Opening the whole editor needs the whole plugin, so the name row is checked
 * in the source, and the Save button through the one method that paints it.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { App } from "obsidian";
import { t } from "../src/i18n";
import { CalloutRegistry } from "../src/manager/CalloutRegistry";
import { CalloutEditor } from "../src/settings/CalloutEditor";
import type { CalloutEditorPlugin } from "../src/settings/editor/types";
import { installFakeDom } from "./support/fakeDom";
import { readRepoFile } from "./support/sourceScan";

installFakeDom();

describe("a built-in callout's name", () => {
	const source = readRepoFile("src/settings/CalloutEditor.ts");

	it("is a disabled text field box, not bare text at the row's end", () => {
		assert.match(
			source,
			/if \(this\.isBuiltIn\) \{[\s\S]{0,600}?nameSetting\.addText\(\(text\) => \{[\s\S]{0,200}?text\.setValue\(this\.displayName\)\.setDisabled\(true\)/,
		);
		assert.doesNotMatch(source, /nameSetting\.addDisplayValue/);
	});
});

describe("the form box (S5-15)", () => {
	const source = readRepoFile("src/settings/CalloutEditor.ts");
	const styles = readRepoFile("styles.css");

	it("builds the four form rows into one SettingGroup without a heading", () => {
		assert.match(
			source,
			/const general = new SettingGroup\(contentEl\);\s*general\.addClass\("cs-editor-group"\);/,
		);
		for (const name of ["nameSetting", "idsSetting", "colorSetting", "iconSetting"]) {
			assert.match(
				source,
				new RegExp(`const ${name} = new Setting\\(general\\.listEl\\)`),
				`${name} lives in the box`,
			);
		}
		assert.doesNotMatch(source, /general\.setHeading\(/, "the form box has no heading");
	});

	it("sets the panel off by a gap, not by a line", () => {
		// `?.[1] ?? ""`: the declarations inside the braces, or "" when the rule is
		// missing (which the first assertion then reports).
		const body = /\.callout-studio-editor \.callout-studio-preview-panel \{([^}]*)\}/.exec(styles)?.[1] ?? "";
		assert.match(body, /margin-top: var\(--size-4-6\)/, "the panel starts 24px below the box");
		assert.doesNotMatch(body, /border-top/);
	});
});

describe("the panel beside the form (S5-07)", () => {
	it("titles the live preview with an Obsidian heading above its box", () => {
		const preview = readRepoFile("src/settings/LiveCalloutPreview.ts");
		assert.match(preview, /new Setting\(parentEl\)\.setHeading\(\)\.setName\(this\.opts\.title\)/);
		assert.doesNotMatch(preview, /callout-studio-preview-header/, "no grey strip inside the box");
	});

	it("builds the Picture group as an Obsidian group, like the adjustments", () => {
		const source = readRepoFile("src/settings/CalloutEditor.ts");
		assert.match(
			source,
			/new SettingGroup\(adjustCol\)\s*\.setHeading\(t\("editor\.picture"\)\)\s*\.addClass\("cs-editor-group"\)/,
		);
		assert.doesNotMatch(source, /createControlGroup\(/, "no plugin-drawn box left in the editor");
	});
});

describe("Save while a save runs", () => {
	/** An editor for the built-in Note, with only what `updateSaveState` reads. */
	function editorWithSaveButton(busy: boolean) {
		const registry = new CalloutRegistry();
		registry.load(null);
		const plugin = {
			app: {} as App,
			registry,
			settings: registry.settings,
		} as unknown as CalloutEditorPlugin;
		const editor = new CalloutEditor(plugin, registry.get("note"));
		const saveBtn = createEl("button");
		// `as unknown as` lets the test reach private fields; the editor's own
		// code is unchanged.
		Object.assign(editor as unknown as Record<string, unknown>, {
			saveBtn,
			saveSession: { busy },
			hasStateChanges: () => true,
			isStateValid: () => true,
		});
		(editor as unknown as { updateSaveState(): void }).updateSaveState();
		return saveBtn;
	}

	it("shows Obsidian's spinner and keeps its words while busy", () => {
		const saveBtn = editorWithSaveButton(true);
		assert.ok(saveBtn.hasClass("mod-loading"));
		assert.equal(saveBtn.getAttribute("aria-busy"), "true");
		assert.equal(saveBtn.disabled, true, "a second press cannot start a second save");
		assert.equal(saveBtn.textContent, t("editor.saveChanges"), 'not "Saving…"');
	});

	it("drops the spinner once the save is done", () => {
		const saveBtn = editorWithSaveButton(false);
		assert.equal(saveBtn.hasClass("mod-loading"), false);
		assert.equal(saveBtn.getAttribute("aria-busy"), "false");
		assert.equal(saveBtn.disabled, false);
		assert.equal(saveBtn.textContent, t("editor.saveChanges"));
	});
});

describe("the preview's inline sample", () => {
	it("writes the name as it is, even with $ patterns in it", () => {
		const registry = new CalloutRegistry();
		registry.load(null);
		const plugin = { app: {} as App, registry, settings: registry.settings } as unknown as CalloutEditorPlugin;
		const editor = new CalloutEditor(plugin, registry.get("note"));
		const name = "Price $& $$ $` $'";
		(editor as unknown as { displayName: string }).displayName = name;
		const sample = (editor as unknown as { buildSampleText(): string }).buildSampleText();
		assert.ok(sample.includes(`[!note]{${name}}`), sample);
	});
});
