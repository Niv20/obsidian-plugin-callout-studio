/**
 * tests/editorPhoneSheet.test.ts — on a phone, the two editors open as
 * Obsidian's large-form sheet (finding S5-09).
 *
 * Obsidian marks a large form with `mod-lg`: on a phone its own stylesheet
 * makes that window full width and full height, rounded only at the top, the
 * way its own large forms (Keychain, Publish) rise from the bottom. On a
 * computer or a tablet the class changes nothing. The plugin's job is only to
 * add the class, and to keep its own wider width off phones, where it would
 * shrink the sheet back into a floating card.
 *
 * Read from the source and the stylesheet, because building an editor needs
 * the whole plugin; the sheet itself is Obsidian's CSS, checked in the
 * harness against the real app.css.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readRepoFile } from "./support/sourceScan";

describe("the editors open as Obsidian's large-form sheet on a phone", () => {
	for (const file of ["src/settings/CalloutEditor.ts", "src/settings/PaletteEditorModal.ts"]) {
		it(`${file} marks its window mod-lg beside its width class`, () => {
			assert.match(readRepoFile(file), /modalEl\.addClass\("callout-studio-editor-modal", "mod-lg"\)/);
		});
	}

	it("keeps the editors' 720px width off phones", () => {
		// Comments removed first: the stylesheet explains itself in prose that
		// names selectors too.
		const css = readRepoFile("styles.css").replace(/\/\*[\s\S]*?\*\//g, "");
		const widthRules = [...css.matchAll(/([^{}]+)\{[^{}]*width:\s*min\(720px[^{}]*\}/g)]
			.map((match) => (match[1] ?? "").trim())
			.filter((selector) => selector.includes("callout-studio-editor-modal"));
		assert.deepEqual(widthRules, ["body:not(.is-phone) .modal.callout-studio-editor-modal"]);
	});
});
