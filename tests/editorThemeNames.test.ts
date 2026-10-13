/**
 * tests/editorThemeNames.test.ts — the editor's note on a callout the theme
 * names only in part (issue #84).
 *
 * Such a callout stays editable, but a block callout written with a claimed
 * name looks the way the theme draws it, not like the preview. The editor says
 * so under the IDs field, as a note and never a block on saving.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { App } from "obsidian";
import { t } from "../src/i18n";
import { CalloutRegistry } from "../src/manager/CalloutRegistry";
import { CalloutEditor } from "../src/settings/CalloutEditor";
import type { CalloutEditorPlugin } from "../src/settings/editor/types";
import { definition } from "./support/discoveryHarness";

function editorFor(themeIds: string[], aliases: string[]) {
	const registry = new CalloutRegistry();
	registry.load({
		callouts: [definition({ id: "описание", displayName: "Описание", aliases })],
	});
	registry.setThemeOwnedIds(new Set(themeIds));
	const app = { customCss: { theme: "Fixture" } } as unknown as App;
	const plugin = {
		app,
		registry,
		settings: registry.settings,
		cssInjector: {
			themeCallouts: () => ({
				themeDefinedIds: () => new Set(themeIds),
				patternClaims: () => [],
			}),
		},
	} as unknown as CalloutEditorPlugin;
	const editor = new CalloutEditor(plugin, registry.get("описание"));
	const shown: string[] = [];
	let cleared = 0;
	Object.assign(editor, {
		idsTagInput: {
			showExternalError: (msg: string) => shown.push(msg),
			clearExternalError: () => void cleared++,
		},
	});
	(editor as unknown as { updateIdWarning(): void }).updateIdWarning();
	return { shown, cleared: () => cleared };
}

describe("the callout editor on a name the theme draws", () => {
	it("names the claimed names and the theme", () => {
		const { shown } = editorFor(["description"], ["вид", "description"]);
		assert.deepEqual(shown, [
			t("editor.namesFromTheme", { theme: "Fixture", names: "[!description]" }),
		]);
	});

	it("says nothing when the theme names none of them", () => {
		const { shown, cleared } = editorFor(["infobox"], ["вид"]);
		assert.deepEqual(shown, []);
		assert.equal(cleared(), 1);
	});
});
