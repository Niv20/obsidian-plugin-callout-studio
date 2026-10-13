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

/**
 * `themeIds` is what the theme's text names; `drawn` is what the claim check
 * published as the theme's (the registry's owned set). They differ when a rule
 * sits behind an option that is off, or changes nothing on screen.
 */
function editorFor(
	themeIds: string[],
	aliases: string[],
	drawn: string[] = themeIds,
	newId?: string,
) {
	const registry = new CalloutRegistry();
	registry.load({
		callouts: [definition({ id: "описание", displayName: "Описание", aliases })],
	});
	registry.setThemeOwnedIds(new Set(drawn));
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
	const editor =
		newId === undefined
			? new CalloutEditor(plugin, registry.get("описание"))
			: new CalloutEditor(plugin);
	if (newId !== undefined) {
		Object.assign(editor, { calloutId: newId, aliases: [] });
	}
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

	it("says nothing for a name the theme names but does not draw", () => {
		// Catppuccin restates core's own icon for every built-in, and Retroma
		// keeps its types behind an option: the text names them, the page does
		// not show them, and this plugin paints them. The note would be false.
		const { shown, cleared } = editorFor(["description"], ["вид", "description"], []);
		assert.deepEqual(shown, []);
		assert.equal(cleared(), 1);
	});

	it("calls a taken id the user's own when the theme does not draw it", () => {
		// A new callout named `note`: the built-in has it. Only when the theme
		// really draws Note is "your theme supplies it" the right reason.
		const own = editorFor(["note"], [], [], "note");
		assert.deepEqual(own.shown, [t("editor.idExists")]);
		const theirs = editorFor(["note"], [], ["note"], "note");
		assert.deepEqual(theirs.shown, [
			t("editor.idFromTheme", { theme: "Fixture" }),
		]);
	});
});
