/**
 * The IDs field's message line: a refused id stays typed; a refusal can carry a
 * way forward (the editor's "move it here") that sits over the lasting message
 * until the typed text changes; a lasting note never silences an error.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { asEl, fakeDom, type FakeElement } from "./support/fakeDom";
import { t } from "../src/i18n";
import { TagInput, type TagMessage } from "../src/ui/TagInput";

function setup(validate: (tag: string) => TagMessage | null) {
	fakeDom.document.body.empty();
	const added: string[] = [];
	const errorEl = asEl(fakeDom.document.body).createDiv();
	const tags = new TagInput(asEl(fakeDom.document.body), {
		onChange: () => undefined,
		onTagAdded: (tag) => added.push(tag),
		validate,
		errorEl,
	});
	const input = fakeDom.document.body.querySelector("input") as unknown as FakeElement & { value: string };
	const type = (text: string): void => {
		input.value = text;
		input.fire("input");
	};
	const enter = (): void => input.fire("keydown", { key: "Enter", preventDefault: () => undefined });
	const line = errorEl as unknown as FakeElement;
	return { tags, input, type, enter, line, added };
}

/** An offer the way the editor draws one: words, and a button. */
function offer(onPress: () => void): TagMessage {
	return (el) => {
		el.createSpan({ text: t("editor.idOwnedBy", { id: "test", name: "Abstract", link: "" }) });
		el.createEl("button", { text: t("editor.idMoveHere") }).addEventListener("click", onPress);
	};
}

describe("TagInput — what the message line says", () => {
	it("keeps a refused id in the field", () => {
		const h = setup(() => "This ID conflicts with an existing callout");
		h.type("taken");
		h.enter();
		assert.equal(h.input.value, "taken");
		assert.deepEqual(h.tags.getTags(), []);
		assert.match(h.line.textContent, /conflicts/);
	});

	it("shows an offer over the lasting message, and puts the message back when the text changes", () => {
		let pressed = 0;
		const h = setup((tag) => (tag === "test" ? offer(() => { pressed++; }) : null));
		h.tags.showExternalError("At least one ID is required");
		h.type("test");
		h.enter();
		assert.match(h.line.textContent, /is an ID of Abstract/);
		assert.equal(h.line.hasClass("is-persistent"), true, "an offer stays until the text changes");
		h.line.querySelector("button")!.fire("click");
		assert.equal(pressed, 1);
		h.type("tes");
		assert.equal(h.line.textContent, "At least one ID is required");
	});

	it("keeps the offer's button when a blur commits the same id again", () => {
		// Swapping the button out from under a tap that is still landing would
		// lose the tap on a touch screen.
		const h = setup(() => offer(() => undefined));
		h.type("test");
		h.enter();
		const before = h.line.querySelector("button");
		h.input.fire("blur");
		assert.ok(before);
		assert.equal(h.line.querySelector("button"), before);
	});

	it("adds a moved id without asking again, clearing the typed text", () => {
		const h = setup(() => offer(() => undefined));
		h.type("test");
		h.enter();
		h.tags.addTagUnchecked("test");
		assert.deepEqual(h.tags.getTags(), ["test"]);
		assert.deepEqual(h.added, ["test"]);
		assert.equal(h.input.value, "");
	});

	it("keeps the message the parent sets while a tag is added", () => {
		// Found in a real Obsidian: the editor draws "On save, … moves here" from
		// onChange, and the field's own input-state pass used to clear it after.
		fakeDom.document.body.empty();
		const errorEl = asEl(fakeDom.document.body).createDiv();
		let field: TagInput | null = null;
		field = new TagInput(asEl(fakeDom.document.body), {
			errorEl,
			onChange: () => field?.showExternalNote('On save, "test" moves here from Abstract.'),
		});
		field.addTagUnchecked("test");
		const line = errorEl as unknown as FakeElement;
		assert.match(line.textContent, /moves here from Abstract/);
		assert.equal(line.hasClass("is-visible"), true);
	});

	it("lets a passing error through a lasting note, then brings the note back", () => {
		const h = setup(() => null);
		h.tags.setTags(["one"]);
		h.tags.showExternalNote('On save, "test" moves here from Abstract.');
		assert.equal(h.line.hasClass("is-note"), true);
		h.type("one");
		h.enter();
		assert.equal(h.line.textContent, "This ID already exists");
		assert.equal(h.line.hasClass("is-note"), false);
		// The error's fade timer — fakeDom queues timers until a suite flushes them.
		fakeDom.window.flushTimers();
		assert.match(h.line.textContent, /moves here from Abstract/);
		assert.equal(h.line.hasClass("is-note"), true);
	});

	it("never lets a passing error replace a lasting error", () => {
		const h = setup(() => null);
		h.tags.setTags(["one"]);
		h.tags.showExternalError("At least one ID is required");
		h.type("one");
		h.enter();
		assert.equal(h.line.textContent, "At least one ID is required");
	});
});
