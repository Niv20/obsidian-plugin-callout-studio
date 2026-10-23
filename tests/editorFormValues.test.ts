/**
 * tests/editorFormValues.test.ts — two small details of the callout editor's
 * form that follow Obsidian (findings S5-V2 and S5-V3).
 *
 * - A built-in callout's name cannot change (Obsidian declares it), so the
 *   editor shows it as Obsidian shows a value you cannot change: quiet text at
 *   the row's end (`Setting.addDisplayValue`), not a field that looks editable
 *   but is greyed out.
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

	it("is a display value, not a disabled text field", () => {
		assert.match(source, /if \(this\.isBuiltIn\) \{[\s\S]{0,400}?nameSetting\.addDisplayValue\(\(value\) => value\.setValue\(this\.displayName\)\)/);
		assert.doesNotMatch(source, /text\.setDisabled\(true\)/, "no greyed-out name field any more");
	});
});

describe("Save while a save runs", () => {
	/** An editor for the built-in Note, with only what `updateSaveState` reads. */
	function editorWithSaveButton(busy: boolean) {
		const registry = new CalloutRegistry();
		registry.load(null);
		const plugin = {
			app: {} as App, registry, settings: registry.settings,
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
		assert.equal(saveBtn.textContent, t("editor.saveChanges"), "not \"Saving…\"");
	});

	it("drops the spinner once the save is done", () => {
		const saveBtn = editorWithSaveButton(false);
		assert.equal(saveBtn.hasClass("mod-loading"), false);
		assert.equal(saveBtn.getAttribute("aria-busy"), "false");
		assert.equal(saveBtn.disabled, false);
		assert.equal(saveBtn.textContent, t("editor.saveChanges"));
	});
});
