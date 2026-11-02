/**
 * tests/tagInputMessages.test.ts — where the IDs field says things (finding
 * S5-V1).
 *
 * A short error goes under the field, through the row's `setErrorMessage` as
 * Obsidian shows a rejected value: the refusal of what is typed (which stays,
 * with the typed text, until the text changes) and the lasting errors the
 * editor sets. A long one — marked `wide(...)`, like the editor's "move it
 * here" offer, which names another callout — goes under the label, in the wide
 * column, with the notes. The two places show their own message together. The
 * field is wired here exactly as the editor wires it.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Setting } from "obsidian";
import { asEl, fakeDom, type FakeElement } from "./support/fakeDom";
import { t } from "../src/i18n";
import { TagInput, wide, type TagRefusal } from "../src/ui/TagInput";
import { setSettingError } from "../src/ui/settingError";

function setup(validate: (tag: string) => TagRefusal | null = () => null, maxTags?: number) {
	fakeDom.document.body.empty();
	const added: string[] = [];
	const setting = new Setting(asEl(fakeDom.document.body));
	const noteEl = setting.descEl.createDiv();
	const tags = new TagInput(setting.controlEl, {
		onChange: () => undefined,
		onTagAdded: (tag) => added.push(tag),
		validate,
		maxTags,
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
	/** The note under the label: the first of the two lines in `noteEl`. */
	const note = (): string => (noteEl as unknown as FakeElement).children[0]?.textContent ?? "";
	/** The long message under the label, or "" while there is none. */
	const wideEl = (): FakeElement => (noteEl as unknown as FakeElement).querySelector(".cs-tag-message")!;
	const wideMessage = (): string => wideEl().textContent;
	return { tags, input, type, enter, row, setting, fieldError, note, wideEl, wideMessage, added };
}

/** An offer the way the editor draws one: words, and a button. */
function offer(onPress: () => void): TagRefusal {
	return wide((el) => {
		el.createSpan({ text: t("editor.idOwnedBy", { id: "test", name: "Abstract", link: "" }) });
		el.createEl("button", { text: t("editor.idMoveHere") }).addEventListener("click", onPress);
	});
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

	it("draws the error as a line of the whole row, not inside the field's narrow column", () => {
		const h = setup();
		const line = (): FakeElement => h.setting.errorEl as unknown as FakeElement;
		const controlEl = h.setting.controlEl as unknown as FakeElement;
		const settingEl = h.setting.settingEl as unknown as FakeElement;

		// A plain refusal, then a renderer: the same element each time, always a
		// child of the row itself.
		h.tags.setTags(["one"]);
		h.type("one");
		h.enter();
		assert.equal(line().parentElement, settingEl);
		assert.equal(controlEl.querySelector(".setting-item-error"), null);
		assert.equal(line().textContent, t("editor.idAlreadyHere"));

		const first = line();
		setSettingError(h.setting, (el) => el.createSpan({ text: "with a link" }));
		assert.equal(line(), first);
		assert.equal(line().parentElement, settingEl);
		assert.equal(line().textContent, "with a link");
	});

	it("says a duplicate in words from the translations", () => {
		const h = setup();
		h.tags.setTags(["one"]);
		h.type("one");
		h.enter();
		assert.equal(h.fieldError(), t("editor.idAlreadyHere"));
	});

	it("shows an offer, with its button, under the label while the short lasting error stays under the field", () => {
		let pressed = 0;
		const h = setup((tag) => (tag === "test" ? offer(() => { pressed++; }) : null));
		h.tags.showExternalError("At least one ID is required");
		assert.equal(h.fieldError(), "At least one ID is required");
		assert.equal(h.wideMessage(), "");
		h.type("test");
		h.enter();
		assert.match(h.wideMessage(), /is an ID of Abstract/);
		assert.equal(h.fieldError(), "At least one ID is required", "a short message keeps its own place");
		h.wideEl().querySelector("button")!.fire("click");
		assert.equal(pressed, 1);
		h.type("tes");
		assert.equal(h.wideMessage(), "");
		assert.equal(h.fieldError(), "At least one ID is required");
	});

	it("draws a wide sentence that is only words under the label, not under the field", () => {
		// "…is the main ID of X. To use it here, delete X first." names a callout.
		const h = setup(() => wide("\"test\" is the main ID of Abstract. To use it here, delete Abstract first."));
		h.type("test");
		h.enter();
		assert.equal(h.input.value, "test", "the refused id stays, to be corrected");
		assert.match(h.wideMessage(), /main ID of Abstract/);
		assert.equal(h.fieldError(), "");
		h.type("tes");
		assert.equal(h.wideMessage(), "");
	});

	it("says a lasting wide error under the label, and a lasting short one under the field", () => {
		const h = setup();
		h.tags.showExternalError(wide("The theme already supplies a callout with this ID."));
		assert.match(h.wideMessage(), /theme already supplies/);
		assert.equal(h.fieldError(), "");
		h.tags.showExternalError("At least one ID is required");
		assert.equal(h.wideMessage(), "");
		assert.equal(h.fieldError(), "At least one ID is required");
		h.tags.clearExternalError();
		assert.equal(h.fieldError(), "");
	});

	it("says the field is full under it, even beside a note under the label", () => {
		// Found by hand: the tenth id arrived by "move it here", and the editor's
		// "On save, … moves here" note replaced the "Maximum … IDs" line, leaving
		// a disabled field with no reason given.
		fakeDom.document.body.empty();
		const setting = new Setting(asEl(fakeDom.document.body));
		const noteEl = setting.descEl.createDiv();
		let field: TagInput | null = null;
		field = new TagInput(setting.controlEl, {
			maxTags: 2,
			noteEl,
			showFieldError: (message) => setSettingError(setting, message),
			onChange: () => field?.showExternalNote('On save, "test" moves here from Abstract.'),
		});
		field.addTagUnchecked("one");
		field.addTagUnchecked("test");
		const row = setting.settingEl as unknown as FakeElement;
		const line = setting.errorEl as unknown as FakeElement;
		assert.match((noteEl as unknown as FakeElement).textContent, /moves here from Abstract/);
		assert.equal(row.hasClass("is-invalid") ? line.textContent : "", t("editor.maxIds", { max: 2 }));
		// Room again: the line goes, the note stays.
		field.setTags(["one"]);
		field.showExternalNote('On save, "test" moves here from Abstract.');
		assert.equal(row.hasClass("is-invalid"), false);
	});

	it("keeps the offer's button when a blur commits the same id again", () => {
		// Swapping the button out from under a tap that is still landing would
		// lose the tap on a touch screen.
		const h = setup(() => offer(() => undefined));
		h.type("test");
		h.enter();
		const before = h.wideEl().querySelector("button");
		h.input.fire("blur");
		assert.ok(before);
		assert.equal(h.wideEl().querySelector("button"), before);
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
		assert.equal(h.wideMessage(), "");
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
