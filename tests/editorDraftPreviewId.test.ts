/**
 * tests/editorDraftPreviewId.test.ts — the callout editor's draft reaches the
 * preview pane alone, and nothing else changes before Save.
 *
 * Every draft — a callout of the user's own, a built-in, a new one — is
 * previewed under the reserved placeholder id, as a demo: no note and no
 * settings row uses that id, so they all keep showing the saved callout until
 * Save, and opening, every step and closing rewrite one small sheet
 * (`CSSInjector.repaintPreview`, `releasePreview`). Until 2026-11-06 an
 * existing callout's draft stood over the real callout under its own id: in a
 * vault with 755 callouts each opening and each closing rewrote the whole
 * stylesheet and rebuilt every row of the list, and every open note repainted
 * on every step.
 *
 * The draft says whose it is (`PreviewDraft`: the saved callout it edits, and
 * the id it will carry), for what a callout's look takes from its name rather
 * than its definition: an untouched built-in's colour, which the theme gives
 * it through Obsidian's rule for that id (`CalloutRegistry.standInIdentity`),
 * and the rules a theme, a snippet or Obsidian aims at that name, which the
 * preview borrows (tests/borrowedCalloutRules.test.ts). The stylesheet side of
 * both is pinned in tests/cssInjectorPreviewLayer.test.ts.
 *
 * The editor is built without `onOpen`, as the other editor suites build it,
 * and asked directly; the wiring inside `onOpen` is read off the source.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { App } from "obsidian";
import { PREVIEW_PLACEHOLDER_ID } from "../src/constants";
import { CalloutRegistry } from "../src/manager/CalloutRegistry";
import { CalloutEditor } from "../src/settings/CalloutEditor";
import type { CalloutEditorPlugin } from "../src/settings/editor/types";
import type { CalloutDefinition } from "../src/types";
import { definition } from "./support/discoveryHarness";
import { readRepoFile } from "./support/sourceScan";

/** The private half of the editor these cases ask. */
interface DraftInternals {
	displayName: string;
	buildPreviewDefinition(): CalloutDefinition;
	updatePreview(): void;
}

function editorOn(id: string | null) {
	const registry = new CalloutRegistry();
	registry.load({ callouts: [definition({ id: "בדיקה", displayName: "בדיקה" })] });
	const plugin = {
		app: {} as App,
		registry,
		settings: registry.settings,
	} as unknown as CalloutEditorPlugin;
	const editor = id === null ? new CalloutEditor(plugin) : new CalloutEditor(plugin, registry.get(id));
	const texts: string[] = [];
	Object.assign(editor, {
		preview: { setText: (text: string) => void texts.push(text), refresh: () => {} },
	});
	return { editor: editor as unknown as DraftInternals, registry, texts };
}

describe("the id the callout editor's draft is previewed under", () => {
	it("is the placeholder for a callout of your own", () => {
		assert.equal(editorOn("בדיקה").editor.buildPreviewDefinition().id, PREVIEW_PLACEHOLDER_ID);
	});

	it("is the placeholder for a built-in too", () => {
		assert.equal(editorOn("note").editor.buildPreviewDefinition().id, PREVIEW_PLACEHOLDER_ID);
	});

	it("is the placeholder for a new callout", () => {
		assert.equal(editorOn(null).editor.buildPreviewDefinition().id, PREVIEW_PLACEHOLDER_ID);
	});
});

describe("a typed name in the preview", () => {
	it("is followed at once, in the pane: a step there rewrites one small sheet", () => {
		const { editor, texts } = editorOn("בדיקה");
		editor.displayName = "בדיקהא";
		editor.updatePreview();
		assert.match(texts.at(-1) ?? "", /בדיקהא/);
	});
});

describe("the registry and a draft that stands in for a callout", () => {
	it("hands the stylesheet the draft on the real callout's identity", () => {
		const { editor, registry } = editorOn("note");
		const draft = editor.buildPreviewDefinition();
		registry.setPreviewDefinition(draft, true, true, { savedId: "note", id: "note" });

		const identity = registry.standInIdentity(draft);
		assert.ok(identity);
		assert.equal(identity.id, "note");
		assert.equal(identity.builtIn, true);
		assert.equal(registry.isUnmodifiedBuiltIn(identity), true, "an untouched built-in");
	});

	it("is no stand-in for anything once the preview is taken down", () => {
		const { editor, registry } = editorOn("note");
		const draft = editor.buildPreviewDefinition();
		registry.setPreviewDefinition(draft, true, true, { savedId: "note", id: "note" });
		registry.setPreviewDefinition(null);

		assert.equal(registry.standInIdentity(draft), null);
		assert.equal(registry.getPreviewDraft(), null);
	});

	it("leaves the saved callout where it is, for the notes and the lists", () => {
		const { editor, registry } = editorOn("בדיקה");
		const saved = registry.get("בדיקה");
		registry.setPreviewDefinition(editor.buildPreviewDefinition(), true, true, { savedId: "בדיקה", id: "בדיקה" });

		assert.equal(registry.get("בדיקה"), saved);
		assert.ok(registry.getUserDefined().some((def) => def.id === "בדיקה"));
		assert.ok(!registry.getUserDefined().some((def) => def.id === PREVIEW_PLACEHOLDER_ID));
	});
});

describe("the editor's preview slot", () => {
	const source = readRepoFile("src/settings/CalloutEditor.ts");
	const beforeRender = /beforeRender: \(\) => \{([\s\S]*?)\n\t\t\t\},\n\t\t\tonDestroy/.exec(source)?.[1] ?? "";
	const onDestroy = /onDestroy: \(\) => \{([\s\S]*?)\n\t\t\t\},\n\t\t\}\);/.exec(source)?.[1] ?? "";

	it("registers every draft as a demo, saying whose it is", () => {
		assert.match(
			beforeRender,
			/setPreviewDefinition\(this\.buildPreviewDefinition\(\), true, true, \{\s*savedId: this\.existingId,\s*id: this\.calloutId\.trim\(\) \|\| null,\s*\}\)/,
		);
	});

	it("refreshes no note: none shows the draft", () => {
		assert.doesNotMatch(beforeRender, /refreshAllCalloutEditors|scheduleNoteDecorationRefresh/);
	});

	it("takes the draft down with the pane's sheet alone", () => {
		assert.match(onDestroy, /releasePreview\(\)/);
		assert.doesNotMatch(onDestroy, /inject\(|refreshAllCalloutEditors/);
	});

	it("keeps the draft up through Save, so the pane does not fall back to the default before it closes", () => {
		// The save's pass would find no preview and clear the pane's sheet
		// (tests/cssInjectorPreviewLayer.test.ts pins what the pass keeps).
		const save = /const def = await this\.saveSession\.run\(([\s\S]*?)performCalloutEditorSave\(/.exec(source)?.[1];
		assert.ok(save, "the save path moved; find where it calls performCalloutEditorSave");
		assert.doesNotMatch(save, /setPreviewDefinition\(null\)/);
	});
});
