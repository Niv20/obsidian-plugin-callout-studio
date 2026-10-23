/**
 * tests/tagInputMessages.test.ts — where the IDs field says things (finding
 * S5-V1).
 *
 * Errors go under the field, through the row's `setErrorMessage` as Obsidian
 * shows a rejected value: the refusal of what is typed (which stays, with the
 * typed text, until the text changes), an offer with a way forward (the
 * editor's "move it here"), and the lasting errors the editor sets. Notes go
 * under the label. The field is wired here exactly as the editor wires it.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Setting } from "obsidian";
import { asEl, fakeDom, type FakeElement } from "./support/fakeDom";
import { t } from "../src/i18n";
import { TagInput, type TagMessage } from "../src/ui/TagInput";
import { setSettingError } from "../src/ui/settingError";

function setup(validate: (tag: string) => TagMessage | null = () => null) {
	fakeDom.document.body.empty();
	const added: string[] = [];
	const setting = new Setting(asEl(fakeDom.document.body));
	const noteEl = setting.descEl.createDiv();
	const tags = new TagInput(setting.controlEl, {
		onChange: () => undefined,
		onTagAdded: (tag) => added.push(tag),
		validate,
		noteEl,
		showFieldError: (message) => setSettingError(setting, message),
	});
	const input = fakeDom.document.body.querySelector("input") as unknown as FakeElement & { value: string };
	const type = (text: string): void => {
		input.value = text;
		input.fire("input");
	};
	const enter = (): void => input.fire("keydown", { key: "Enter", preventDefault: () => undefined });
	const row = setting.settingEl as unknown as FakeElement;
	/** The text under the field, or "" while the row shows no error. */
	const fieldError = (): string => {
		const line = setting.errorEl as unknown as FakeElement | null;
		return row.hasClass("is-invalid") && line ? line.textContent : "";
	};
	const note = (): string => (noteEl as unknown as FakeElement).textContent;
	return { tags, input, type, enter, row, setting, fieldError, note, added };
}

/** An offer the way the editor draws one: words, and a button. */
function offer(onPress: () => void): TagMessage {
	return (el) => {
		el.createSpan({ text: t("editor.idOwnedBy", { id: "test", name: "Abstract", link: "" }) });
		el.createEl("button", { text: t("editor.idMoveHere") }).addEventListener("click", onPress);
	};
}

describe("TagInput — what the IDs field says, and where", () => {
	it("keeps a refused id in the field and says why under it, until the text changes", () => {
		const h = setup(() => "This ID conflicts with an existing callout");
		h.type("taken");
		h.enter();
		assert.equal(h.input.value, "taken");
		assert.deepEqual(h.tags.getTags(), []);
		assert.match(h.fieldError(), /conflicts/);
		// No timer takes it away: it is about the text, and the text is still there.
		fakeDom.window.flushTimers();
		assert.match(h.fieldError(), /conflicts/);
		h.type("take");
		assert.equal(h.fieldError(), "");
		assert.equal(h.row.hasClass("is-invalid"), false);
	});

	it("says a duplicate in words from the translations", () => {
		const h = setup();
		h.tags.setTags(["one"]);
		h.type("one");
		h.enter();
		assert.equal(h.fieldError(), t("editor.idAlreadyHere"));
	});

	it("shows an offer, with its button, over the lasting error, and puts the error back when the text changes", () => {
		let pressed = 0;
		const h = setup((tag) => (tag === "test" ? offer(() => { pressed++; }) : null));
		h.tags.showExternalError("At least one ID is required");
		assert.equal(h.fieldError(), "At least one ID is required");
		h.type("test");
		h.enter();
		assert.match(h.fieldError(), /is an ID of Abstract/);
		(h.setting.errorEl as unknown as FakeElement).querySelector("button")!.fire("click");
		assert.equal(pressed, 1);
		h.type("tes");
		assert.equal(h.fieldError(), "At least one ID is required");
	});

	it("keeps the offer's button when a blur commits the same id again", () => {
		// Swapping the button out from under a tap that is still landing would
		// lose the tap on a touch screen.
		const h = setup(() => offer(() => undefined));
		h.type("test");
		h.enter();
		const line = h.setting.errorEl as unknown as FakeElement;
		const before = line.querySelector("button");
		h.input.fire("blur");
		assert.ok(before);
		assert.equal(line.querySelector("button"), before);
	});

	it("adds a moved id without asking again, clearing the typed text and the offer", () => {
		const h = setup(() => offer(() => undefined));
		h.type("test");
		h.enter();
		h.tags.addTagUnchecked("test");
		assert.deepEqual(h.tags.getTags(), ["test"]);
		assert.deepEqual(h.added, ["test"]);
		assert.equal(h.input.value, "");
		assert.equal(h.fieldError(), "");
	});

	it("keeps the note the parent sets while a tag is added, under the label", () => {
		// Found in a real Obsidian: the editor draws "On save, … moves here" from
		// onChange, and the field's own input-state pass used to clear it after.
		fakeDom.document.body.empty();
		const setting = new Setting(asEl(fakeDom.document.body));
		const noteEl = setting.descEl.createDiv();
		let field: TagInput | null = null;
		field = new TagInput(setting.controlEl, {
			noteEl,
			showFieldError: (message) => setSettingError(setting, message),
			onChange: () => field?.showExternalNote('On save, "test" moves here from Abstract.'),
		});
		field.addTagUnchecked("test");
		assert.match((noteEl as unknown as FakeElement).textContent, /moves here from Abstract/);
		assert.equal((setting.settingEl as unknown as FakeElement).hasClass("is-invalid"), false, "a note is not an error");
	});

	it("shows a note and a refusal side by side, each in its place", () => {
		const h = setup();
		h.tags.setTags(["one"]);
		h.tags.showExternalNote('On save, "test" moves here from Abstract.');
		h.type("one");
		h.enter();
		assert.equal(h.fieldError(), t("editor.idAlreadyHere"));
		assert.match(h.note(), /moves here from Abstract/);
	});

	it("lets a lasting error outrank the refusal of the typed text, which shows once it clears", () => {
		const h = setup();
		h.tags.setTags(["one"]);
		h.tags.showExternalError("At least one ID is required");
		h.type("one");
		h.enter();
		assert.equal(h.fieldError(), "At least one ID is required");
		h.tags.clearExternalError();
		assert.equal(h.fieldError(), t("editor.idAlreadyHere"));
	});
});

describe("TagInput — on its own, without a row", () => {
	it("draws Obsidian's error line itself, under the pills", () => {
		fakeDom.document.body.empty();
		const tags = new TagInput(asEl(fakeDom.document.body), { maxTags: 1, onChange: () => undefined });
		tags.setTags(["one"]);
		const line = fakeDom.document.body.querySelector(".setting-item-error");
		assert.ok(line);
		assert.ok(line.closest(".cs-tag-wrapper"), "inside the field's own wrapper");
		assert.equal(line.textContent, t("editor.maxIds", { max: 1 }));
		tags.setTags([]);
		assert.equal(line.textContent, "");
	});
});
