/**
 * tests/paletteMetadataRename.test.ts — what renaming a palette asks about the
 * notes that name it, and when it must not ask at all.
 *
 * A rename changes the palette's word in callout metadata, so its notes are
 * asked about the way the callout editor asks: by Save, before anything is
 * saved, in "Update your notes?" — Leave them as they are (chosen on opening)
 * or Change them to the new word. Cancel goes back to the palette editor.
 *
 * A rewrite cannot tell which callouts meant the palette, so nothing is asked
 * for a word that meant something else too: a built-in colour's word (a
 * palette called "Pink" from before that preset) or one the theme or a
 * snippet styles — those notes may mean the other thing, and stay as written.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { setImmediate } from "node:timers/promises";
import type { App } from "obsidian";
import { t } from "../src/i18n";
import { PaletteEditorModal, type PaletteEditorResult } from "../src/settings/PaletteEditorModal";
import { PaletteNotesModal, type PaletteNotesModalInput } from "../src/settings/PaletteNotesModal";
import {
	askMetadataRename,
	isBuiltInColorWord,
	isStylingWord,
	ownedMetadataKey,
	renamedMetadataWords,
	type AskMetadataRenameInput,
} from "../src/settings/sections/paletteMetadataRename";
import type { CustomPalette } from "../src/types";
import { fakeDom, NODE_TEXT, type FakeElement } from "./support/fakeDom";
import { TestKeymap, TestScope } from "./support/fakeKeymap";

const palette = (id: string, name: string): CustomPalette => ({
	id,
	name,
	colorLight: "#aa0000",
	colorDark: "#ff5555",
	bgColorLight: "#ffeeee",
	bgColorDark: "#331111",
	textColorLight: "#111111",
	textColorDark: "#eeeeee",
});

/** An app whose vault fails the test if anything reads it. */
const untouchableApp = (): App =>
	({
		vault: new Proxy({}, { get: (_t, prop) => { throw new Error(`vault.${String(prop)} was read`); } }),
	}) as unknown as App;

/** An app whose vault holds `notes`, by path. */
function vaultOf(notes: Record<string, string>): App {
	const handles = Object.keys(notes).map((path) => ({ path }));
	return { vault: {
		getMarkdownFiles: () => handles,
		getAbstractFileByPath: (path: string) => handles.find((file) => file.path === path) ?? null,
		cachedRead: (file: { path: string }) => Promise.resolve(notes[file.path]!),
	} } as unknown as App;
}

const renameInput = (over: Partial<AskMetadataRenameInput> & Pick<AskMetadataRenameInput, "word">): AskMetadataRenameInput => ({
	app: untouchableApp(),
	name: { from: "Comic Red", to: "Comic Blue" },
	sharedWord: () => false,
	stillWanted: () => true,
	open: () => assert.fail("nothing to ask"),
	...over,
});

describe("which words mean something else too", () => {
	it("knows the built-in colours and their aliases", () => {
		for (const word of ["pink", "purple", "gray", "grey", "sky"]) assert.ok(isBuiltInColorWord(word), word);
		for (const word of ["comic-red", "violet", "amber", "wide"]) assert.ok(!isBuiltInColorWord(word), word);
	});

	it("knows a styling word in any case the stylesheet would match", () => {
		const sources = [{ label: "Dune", words: [{ word: "Rot", placement: "spaced" as const, guards: null }] }];
		assert.ok(isStylingWord("rot", sources));
		assert.ok(!isStylingWord("blau", sources));
	});
});

describe("ownedMetadataKey", () => {
	it("is empty for a palette whose word the user's own snippet keeps", () => {
		const palettes = [palette("cp-1", "Comic Red")];
		assert.equal(ownedMetadataKey(palettes, "cp-1"), "comic-red");
		assert.equal(ownedMetadataKey(palettes, "cp-1", new Set(["comic-red"])), "");
	});
});

describe("renamedMetadataWords", () => {
	it("reads the word now and the one the new name would give, without renaming anything", () => {
		const palettes = [palette("cp-1", "Comic Red")];
		assert.deepEqual(renamedMetadataWords(palettes, "cp-1", "Comic Blue"), { from: "comic-red", to: "comic-blue" });
		assert.equal(palettes[0]!.name, "Comic Red");
	});

	it("gives the same word for a name that only changes case", () => {
		const words = renamedMetadataWords([palette("cp-1", "Comic Red")], "cp-1", "comic red");
		assert.equal(words.from, words.to);
	});
});

describe("askMetadataRename", () => {
	it("asks nothing — and reads no note — for a word that means something else", async () => {
		assert.deepEqual(await askMetadataRename(renameInput({ word: { from: "pink", to: "rose" }, sharedWord: isBuiltInColorWord })), { rewrite: null });
		assert.deepEqual(await askMetadataRename(renameInput({ word: { from: "rot", to: "ruby" }, sharedWord: (word) => word === "rot" })), { rewrite: null });
	});

	it("asks nothing when the word did not change, or there is no word", async () => {
		for (const word of [{ from: "comic-red", to: "comic-red" }, { from: "", to: "comic-red" }, { from: "comic-red", to: "" }]) {
			assert.deepEqual(await askMetadataRename(renameInput({ word })), { rewrite: null });
		}
	});

	it("asks nothing when no note uses the old word", async () => {
		const app = vaultOf({ "a.md": "> [!note|comic-blue] Already new" });
		assert.deepEqual(await askMetadataRename(renameInput({ app, word: { from: "comic-red", to: "comic-blue" } })), { rewrite: null });
	});

	it("opens the window on what the notes hold, and turns its answer into the rewrite", async () => {
		const app = vaultOf({ "a.md": "> [!note|comic-red] One\n\n> [!tip|comic-red wide] Two", "b.md": "> [!mark|comic-red] Three" });
		const word = { from: "comic-red", to: "comic-blue" };
		let asked: PaletteNotesModalInput | undefined;
		const answering = (change: boolean | null) => renameInput({ app, word, open: (input) => { asked = input; return Promise.resolve(change); } });
		assert.deepEqual(await askMetadataRename(answering(true)), { rewrite: word });
		assert.deepEqual(asked, { name: { from: "Comic Red", to: "Comic Blue" }, word, reach: { callouts: 3, notes: 2 } });
		assert.deepEqual(await askMetadataRename(answering(false)), { rewrite: null }, "Leave saves, notes untouched");
		assert.equal(await askMetadataRename(answering(null)), null, "Cancel goes back to the editor");
	});

	it("does not ask about a save the editor has closed on", async () => {
		const app = vaultOf({ "a.md": "> [!note|comic-red] One" });
		const answer = await askMetadataRename(renameInput({ app, word: { from: "comic-red", to: "comic-blue" }, stillWanted: () => false }));
		assert.equal(answer, null);
	});
});

/** A line as it reads, a `\n` for each of its line breaks. */
function lineText(line: FakeElement): string {
	return line.childNodes.map((node) => (node.nodeType === NODE_TEXT ? node.nodeValue : "\n")).join("");
}

/** Open the window on the fake DOM and drive it. */
function open(input: PaletteNotesModalInput) {
	fakeDom.light();
	const app = { keymap: new TestKeymap(), scope: new TestScope() } as unknown as App;
	const modal = new PaletteNotesModal(app, input);
	const containerEl = fakeDom.document.body.createDiv({ cls: "modal-container" });
	const modalEl = containerEl.createDiv({ cls: "modal" });
	const titleEl = modalEl.createDiv({ cls: "modal-header" }).createDiv({ cls: "modal-title" });
	const contentEl = modalEl.createDiv({ cls: "modal-content" });
	Object.assign(modal, {
		containerEl, modalEl, titleEl, contentEl, app, scope: app.scope,
		setTitle: (title: string) => { titleEl.setText(title); return modal; },
		open: () => modal.onOpen(),
		close: () => modal.onClose(),
	});
	let answer: boolean | null | undefined;
	void modal.ask().then((result) => { answer = result; });
	const button = (label: string): FakeElement =>
		modalEl.querySelectorAll(".cs-modal-footer button").find((el) => el.textContent === label)!;
	const cards = () => contentEl.querySelectorAll(".cs-option-box");
	return {
		titleEl, contentEl, cards,
		answer: async () => { await setImmediate(); return answer; },
		lines: () => contentEl.querySelectorAll(".cs-note-change-line").map(lineText),
		titles: () => cards().map((card) => card.querySelector(".cs-option-box-title")!.textContent),
		desc: (card: FakeElement) => card.querySelector(".cs-option-box-desc")?.textContent,
		chosen: () => contentEl.querySelectorAll(".cs-option-box.is-selected").map((el) => el.querySelector(".cs-option-box-title")!.textContent),
		save: () => button(t("editor.saveChanges")).fire("click"),
		cancel: () => button(t("editor.cancel")).fire("click"),
		escape: () => modal.onClose(),
	};
}

describe("the window", () => {
	const input: PaletteNotesModalInput = {
		name: { from: "Comic Red", to: "Comic Blue" },
		word: { from: "comic-red", to: "comic-blue" },
		reach: { callouts: 16, notes: 7 },
	};

	it("asks as the callout editor does: the change, how far it reaches, then Leave or Change, starting on Leave", async () => {
		const h = open(input);
		assert.equal(h.titleEl.textContent, t("noteChanges.title"));
		assert.deepEqual(h.lines(), [
			'You renamed the palette from "Comic Red" to "Comic Blue", so its word in callout metadata changes from "comic-red" to "comic-blue".',
			"This affects 16 callouts in 7 notes.\nWhat should happen to those callouts?",
		]);
		assert.deepEqual(h.titles(), [t("noteChanges.leave"), 'Change them to "comic-blue"']);
		assert.equal(h.desc(h.cards()[0]!), 'They keep "comic-red" and go back to their own color.');
		assert.equal(h.desc(h.cards()[1]!), "Every |comic-red in your notes becomes |comic-blue.");
		assert.deepEqual(h.chosen(), [t("noteChanges.leave")]);
		h.save();
		assert.equal(await h.answer(), false);
	});

	it("counts one callout in one note in the singular", () => {
		const h = open({ ...input, reach: { callouts: 1, notes: 1 } });
		assert.equal(h.lines()[1], "This affects 1 callout in 1 note.\nWhat should happen to that callout?");
	});

	it("changes the notes only with Change showing", async () => {
		const h = open(input);
		h.cards()[1]!.fire("click");
		assert.deepEqual(h.chosen(), ['Change them to "comic-blue"']);
		h.save();
		assert.equal(await h.answer(), true);
	});

	it("goes back to the palette editor on Cancel, or when the window is closed", async () => {
		const cancelled = open(input);
		cancelled.cards()[1]!.fire("click");
		cancelled.cancel();
		assert.equal(await cancelled.answer(), null);
		const closed = open(input);
		closed.escape();
		assert.equal(await closed.answer(), null);
	});
});

describe("the palette editor's Save asks before it closes", () => {
	type Internals = { finish(save: boolean): void; onClose(): void };

	function editor(beforeSave: (draft: PaletteEditorResult, stillOpen: () => boolean) => Promise<boolean>) {
		const modal = new PaletteEditorModal({ app: {} as App } as ConstructorParameters<typeof PaletteEditorModal>[0], {
			seedName: "Comic Blue",
			beforeSave,
		});
		let closed = 0;
		Object.assign(modal, { open: () => undefined, close: () => { closed++; } });
		let result: PaletteEditorResult | null | undefined;
		void modal.openAndWait().then((value) => { result = value; });
		const internals = modal as unknown as Internals;
		return {
			save: () => internals.finish(true),
			cancel: () => internals.finish(false),
			result: async () => { await setImmediate(); return result; },
			closed: () => closed,
		};
	}

	it("stays open with nothing saved when the question is cancelled", async () => {
		let drafts = 0;
		const h = editor((draft) => { drafts++; assert.equal(draft.name, "Comic Blue"); return Promise.resolve(false); });
		h.save();
		assert.equal(await h.result(), undefined);
		assert.equal(h.closed(), 0);
		h.save();
		await h.result();
		assert.equal(drafts, 2, "the next Save asks again");
	});

	it("saves the draft it asked about once the question agrees", async () => {
		const h = editor(() => Promise.resolve(true));
		h.save();
		assert.equal((await h.result())?.name, "Comic Blue");
		assert.equal(h.closed(), 1);
	});

	it("takes a second press while still asking as the same Save", async () => {
		let asks = 0;
		let agree: (yes: boolean) => void = () => undefined;
		const h = editor(() => { asks++; return new Promise((resolve) => { agree = resolve; }); });
		h.save();
		h.save();
		assert.equal(asks, 1);
		agree(true);
		assert.equal((await h.result())?.name, "Comic Blue");
	});

	it("saves nothing when the editor closes while the question is prepared", async () => {
		let stillOpen: () => boolean = () => true;
		let agree: (yes: boolean) => void = () => undefined;
		const h = editor((_draft, open) => { stillOpen = open; return new Promise((resolve) => { agree = resolve; }); });
		h.save();
		h.cancel();
		assert.equal(await h.result(), null);
		assert.equal(stillOpen(), false);
		agree(true);
		assert.equal(await h.result(), null);
		assert.equal(h.closed(), 1, "a late yes does not close it again");
	});
});
