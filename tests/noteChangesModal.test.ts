/**
 * "Update your notes?" — what the callout editor's Save asks before a note
 * changes (GitHub: Nathan, after #86). Removing an id leaves its notes alone
 * unless the user says otherwise — moving the id to another callout, or
 * changing the notes; a rename and a fold change open on doing what they
 * always did; Cancel saves nothing.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { setImmediate } from "node:timers/promises";
import type { App } from "obsidian";
import { t } from "../src/i18n";
import { CalloutRegistry } from "../src/manager/CalloutRegistry";
import { askNoteChanges } from "../src/settings/editor/askNoteChanges";
import { NoteChangesModal, type NoteChangesAnswer, type NoteChangesModalInput } from "../src/settings/editor/NoteChangesModal";
import { pendingNoteChanges, type NoteChangeFormState, type PendingNoteChanges } from "../src/settings/editor/noteChanges";
import {
	choicesFromAnswers,
	defaultAnswers,
	foldTally,
	noteChangeQuestion,
} from "../src/settings/editor/noteChangeQuestion";
import type { CalloutDefinition } from "../src/types";
import type { IdNoteStats, NoteTally } from "../src/utils/idNoteStats";
import { fakeDom, type FakeElement } from "./support/fakeDom";
import { TestKeymap, TestScope } from "./support/fakeKeymap";

function def(over: Partial<CalloutDefinition> & { id: string }): CalloutDefinition {
	return {
		displayName: over.id, icon: { type: "lucide", value: "star" }, colorLight: "#448aff", colorDark: "#448aff",
		foldable: false, defaultFolded: false, builtIn: false, source: "user", ...over,
	};
}

function form(over: Partial<NoteChangeFormState> = {}): NoteChangeFormState {
	return { calloutId: "abstract2", aliases: [], displayName: "Abstract2", foldable: false, defaultFolded: false, ...over };
}

const pendingOf = (existing: CalloutDefinition, state: NoteChangeFormState): PendingNoteChanges =>
	pendingNoteChanges({ existing, state, vaultIdFormsFor: (d, forms) => forms ?? [d.id, ...(d.aliases ?? [])] });

function tally(count: number, ...files: string[]): NoteTally {
	return { count, files: new Set(files) };
}

function stats(entries: Record<string, Partial<IdNoteStats>>): Map<string, IdNoteStats> {
	return new Map(Object.entries(entries).map(([key, one]) => [key, {
		uses: one.uses ?? tally(0), foldDiffers: one.foldDiffers ?? tally(0), titled: one.titled ?? tally(0),
	}]));
}

describe("what the question asks", () => {
	const callout = def({ id: "abstract2", displayName: "Abstract2", aliases: ["test"] });

	it("asks nothing when no note uses what would change", () => {
		const pending = pendingOf(callout, form());
		assert.equal(noteChangeQuestion(pending, stats({ test: {} })), null);
	});

	it("asks about a removed id its notes use, and leaves them by default", () => {
		const pending = pendingOf(callout, form());
		const question = noteChangeQuestion(pending, stats({ test: { uses: tally(12, "a.md", "b.md") } }));
		assert.ok(question);
		assert.deepEqual(question.ids.map(({ leaving }) => leaving.id), ["test"]);
		const { choices, keep, give } = choicesFromAnswers(question, defaultAnswers(question));
		assert.equal(choices.rewrite.size, 0, "nothing is rewritten unless the user says so");
		assert.deepEqual(keep, []);
		assert.deepEqual(give, []);
	});

	it("hands a removed id to the callout picked, and rewrites no note for it", () => {
		const pending = pendingOf(callout, form());
		const question = noteChangeQuestion(pending, stats({ test: { uses: tally(1, "a.md") } }));
		assert.ok(question);
		const moved = choicesFromAnswers(question, { ids: new Map([["test", { kind: "move", to: "tip" }]]), titles: false, fold: false });
		assert.deepEqual(moved.give, [{ id: "test", to: "tip" }]);
		assert.equal(moved.choices.rewrite.size, 0);
		assert.deepEqual(moved.keep, []);
	});

	it("opens a rename on following it, titles and all — or keeps the old id", () => {
		const renamed = def({ id: "idea", displayName: "Idea" });
		const pending = pendingOf(renamed, form({ calloutId: "insight", displayName: "Insight" }));
		const question = noteChangeQuestion(pending, stats({ idea: { uses: tally(3, "a.md") } }));
		assert.ok(question);
		const followed = choicesFromAnswers(question, defaultAnswers(question));
		assert.deepEqual([...followed.choices.rewrite], [["idea", { kind: "self" }]]);
		assert.equal(followed.choices.titles, true);
		const kept = choicesFromAnswers(question, { ids: new Map([["idea", { kind: "keep" }]]), titles: true, fold: false });
		assert.equal(kept.choices.rewrite.size, 0);
		assert.deepEqual(kept.keep, ["idea"]);
		assert.equal(kept.choices.titles, false, "kept: the notes stay as they are, titles and all");
	});

	it("asks about titles alone when only the name changed", () => {
		const named = def({ id: "tip2", displayName: "Old Name" });
		const pending = pendingOf(named, form({ calloutId: "tip2", displayName: "New Name" }));
		const question = noteChangeQuestion(pending, stats({ tip2: { uses: tally(2, "a.md"), titled: tally(2, "a.md") } }));
		assert.ok(question?.titles);
		assert.equal(question.titles.from, "Old Name");
		assert.equal(choicesFromAnswers(question, defaultAnswers(question)).choices.titles, true);
	});

	it("counts fold marks over the ids being sent here, and only asks when one would change", () => {
		const folding = def({ id: "f", aliases: ["g"] });
		const pending = pendingOf(folding, form({ calloutId: "f", displayName: "f", foldable: true, defaultFolded: true }));
		const counts = stats({ f: { foldDiffers: tally(1, "a.md") }, g: { uses: tally(2, "b.md"), foldDiffers: tally(2, "b.md") } });
		assert.equal(foldTally(pending, counts, [])?.count, 1);
		assert.equal(foldTally(pending, counts, ["g"])?.count, 3);
		assert.equal(noteChangeQuestion(pending, counts)?.fold, "-");
		const settled = stats({ f: {}, g: {} });
		assert.equal(noteChangeQuestion(pending, settled), null);
	});

	it("asks everything that might apply when the notes could not all be read", () => {
		const both = def({ id: "idea", displayName: "Idea", aliases: ["test"] });
		const pending = pendingOf(both, form({ calloutId: "insight", displayName: "Insight", foldable: true }));
		const question = noteChangeQuestion(pending, null);
		assert.ok(question);
		assert.deepEqual(question.ids.map(({ leaving, uses }) => [leaving.id, uses]), [["idea", null], ["test", null]]);
		assert.equal(question.fold, "+");
	});
});

/** Open the window on the fake DOM and drive it. */
function open(input: NoteChangesModalInput) {
	fakeDom.light();
	const app = { keymap: new TestKeymap(), scope: new TestScope() } as unknown as App;
	const modal = new NoteChangesModal(app, input);
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
	let answer: NoteChangesAnswer | null | undefined;
	void modal.ask().then((result) => { answer = result; });
	const button = (label: string): FakeElement =>
		modalEl.querySelectorAll(".cs-modal-footer button").find((el) => el.textContent === label)!;
	return {
		titleEl, contentEl,
		answer: async () => { await setImmediate(); return answer; },
		parts: () => contentEl.querySelectorAll(".cs-note-change"),
		cards: () => contentEl.querySelectorAll(".cs-option-box"),
		chosen: () => contentEl.querySelectorAll(".cs-option-box.is-selected").map((el) => el.querySelector(".cs-option-box-title")!.textContent),
		save: () => button(t("editor.saveChanges")).fire("click"),
		cancel: () => button(t("editor.cancel")).fire("click"),
		escape: () => modal.onClose(),
	};
}

function modalInput(callout: CalloutDefinition, state: NoteChangeFormState, counts: Map<string, IdNoteStats>, roomForIds = 9): NoteChangesModalInput {
	const registry = new CalloutRegistry();
	registry.load(null);
	const pending = pendingOf(callout, state);
	const question = noteChangeQuestion(pending, counts);
	assert.ok(question);
	const saved = { ...callout, id: state.calloutId, displayName: state.displayName };
	return {
		question, pending, stats: counts, saved, roomForIds, registry,
		targets: () => [saved, ...registry.getAll()],
		moveTargets: () => registry.getAll(),
	};
}

/** Pick `name` in the callout picker on `card`, the way a mouse would. */
function pick(card: FakeElement, name: string): void {
	const input = card.querySelector(".cs-combobox-input") as FakeElement & { value: string };
	input.fire("focus");
	input.value = name;
	input.fire("input");
	const menu = card.querySelector(".cs-combobox-menu")!;
	const row = menu.querySelectorAll(".cs-combobox-option")[0];
	assert.ok(row, `no callout matches ${name}`);
	menu.fire("mousedown", { preventDefault: () => undefined });
	row.fire("click");
}

describe("the window", () => {
	const callout = def({ id: "abstract2", displayName: "Abstract2", aliases: ["test"] });

	it("says what was removed and how often it is used, asks, and starts on Leave them", async () => {
		const h = open(modalInput(callout, form(), stats({ test: { uses: tally(12, "a.md", "b.md") } })));
		assert.equal(h.titleEl.textContent, t("noteChanges.title"));
		assert.equal(h.parts().length, 1);
		assert.equal(
			h.contentEl.querySelector(".cs-note-change-line")?.textContent,
			'You removed the ID "test" from Abstract2, but it\'s still used by 12 callouts in 2 notes. What should happen to those callouts?',
		);
		assert.deepEqual(h.cards().map((card) => card.querySelector(".cs-option-box-title")!.textContent), [
			t("noteChanges.leave"), t("noteChanges.moveTo", { id: "test" }), t("noteChanges.rewrite"),
		]);
		assert.deepEqual(h.chosen(), [t("noteChanges.leave")]);
		h.save();
		const answer = await h.answer();
		assert.equal(answer?.choices.rewrite.size, 0);
		assert.deepEqual(answer?.give, []);
	});

	it("counts one callout in one note in the singular, and asks about that one", () => {
		const h = open(modalInput(callout, form(), stats({ test: { uses: tally(1, "a.md") } })));
		assert.match(h.contentEl.textContent, /still used by 1 callout in 1 note\. What should happen to that callout\?/);
	});

	it("asks about those callouts when the notes could not all be counted", () => {
		const pending = pendingOf(callout, form());
		const question = noteChangeQuestion(pending, null);
		assert.ok(question);
		const registry = new CalloutRegistry();
		registry.load(null);
		const saved = { ...callout };
		const h = open({ question, pending, stats: null, saved, roomForIds: 9, registry, targets: () => [saved], moveTargets: () => [] });
		assert.equal(
			h.contentEl.querySelector(".cs-note-change-line")?.textContent,
			'You removed the ID "test" from Abstract2, but some notes may still use it. What should happen to those callouts?',
		);
	});

	it("puts a card's picker at its trailing edge, just before the dot", () => {
		const h = open(modalInput(callout, form(), stats({ test: { uses: tally(1, "a.md") } })));
		for (const card of h.cards().slice(1)) {
			const parts = card.children.map((child) => child.className.split(" ")[0]);
			assert.deepEqual(parts, ["cs-option-box-text", "cs-note-change-target", "cs-option-radio"]);
		}
	});

	it("says no more than what the answer does — no undo line", () => {
		const h = open(modalInput(callout, form(), stats({ test: { uses: tally(1, "a.md") } })));
		assert.doesNotMatch(h.contentEl.textContent, /undo/i);
	});

	it("rewrites to this callout when Change them in your notes is chosen", async () => {
		const h = open(modalInput(callout, form(), stats({ test: { uses: tally(1, "a.md") } })));
		const rewrite = h.cards()[2]!;
		assert.equal(rewrite.querySelector(".cs-option-box-desc")?.textContent, "Every [!test] in your notes becomes [!abstract2].");
		rewrite.fire("click");
		assert.deepEqual(h.chosen(), [t("noteChanges.rewrite")]);
		h.save();
		const answer = await h.answer();
		assert.deepEqual([...answer!.choices.rewrite], [["test", { kind: "self" }]]);
	});

	it("rewrites to another callout picked, and says what the notes become", async () => {
		const h = open(modalInput(callout, form(), stats({ test: { uses: tally(1, "a.md") } })));
		const rewrite = h.cards()[2]!;
		pick(rewrite, "Warning");
		assert.equal(rewrite.querySelector(".cs-option-box-desc")?.textContent, "Every [!test] in your notes becomes [!warning].");
		assert.deepEqual(h.chosen(), [t("noteChanges.rewrite")]);
		h.save();
		const answer = await h.answer();
		assert.deepEqual([...answer!.choices.rewrite], [["test", { kind: "callout", id: "warning", name: "Warning" }]]);
	});

	it("moves the id to the callout picked, changing no note", async () => {
		const h = open(modalInput(callout, form(), stats({ test: { uses: tally(1, "a.md") } })));
		const move = h.cards()[1]!;
		// Nothing picked yet: a click opens the list rather than choosing a
		// move to nowhere.
		move.fire("click");
		assert.deepEqual(h.chosen(), [t("noteChanges.leave")]);
		pick(move, "Tip");
		assert.deepEqual(h.chosen(), [t("noteChanges.moveTo", { id: "test" })]);
		h.save();
		const answer = await h.answer();
		assert.deepEqual(answer?.give, [{ id: "test", to: "tip" }]);
		assert.equal(answer?.choices.rewrite.size, 0);
	});

	it("will not move the id when no other callout has room for it", () => {
		const input = modalInput(callout, form(), stats({ test: { uses: tally(1, "a.md") } }));
		const h = open({ ...input, moveTargets: () => [] });
		const move = h.cards()[1]!;
		assert.equal(move.hasClass("is-blocked"), true);
		assert.equal(move.querySelector(".cs-option-box-desc")?.textContent, t("noteChanges.moveNoRoom", { max: 10 }));
		move.fire("click");
		assert.deepEqual(h.chosen(), [t("noteChanges.leave")]);
	});

	it("saves nothing on Cancel, or when the window is closed", async () => {
		const cancelled = open(modalInput(callout, form(), stats({ test: { uses: tally(1, "a.md") } })));
		cancelled.cancel();
		assert.equal(await cancelled.answer(), null);
		const closed = open(modalInput(callout, form(), stats({ test: { uses: tally(1, "a.md") } })));
		closed.escape();
		assert.equal(await closed.answer(), null);
	});

	it("will not keep a renamed id the callout has no room for", async () => {
		const renamed = def({ id: "idea", displayName: "Idea" });
		const h = open(modalInput(renamed, form({ calloutId: "insight", displayName: "Insight" }),
			stats({ idea: { uses: tally(1, "a.md") } }), 0));
		assert.deepEqual(h.chosen(), [t("noteChanges.renameChange", { id: "insight" })]);
		const keep = h.cards()[1]!;
		assert.equal(keep.hasClass("is-blocked"), true);
		keep.fire("click");
		assert.deepEqual(h.chosen(), [t("noteChanges.renameChange", { id: "insight" })]);
	});

	it("counts a removed id's titles only while its notes are sent here", () => {
		// The title pass covers what ends up in this callout, so the count must.
		const named = def({ id: "x", displayName: "Old", aliases: ["al"] });
		const counts = stats({ x: { titled: tally(1, "a.md") }, al: { uses: tally(2, "b.md"), titled: tally(2, "b.md") } });
		const h = open(modalInput(named, form({ calloutId: "x", displayName: "New" }), counts));
		const [, titlesPart] = h.parts();
		assert.ok(titlesPart);
		assert.match(titlesPart.textContent, /still the title of 1 callout in 1 note\./);
		h.cards()[2]!.fire("click"); // "al": Change them in your notes → this callout
		assert.match(titlesPart.textContent, /still the title of 3 callouts in 2 notes\./);
	});

	it("counts a kept old id's notes in the fold part — they take the new mark too", () => {
		// Keep makes the old id another id of this callout, so the fold pass
		// covers its notes. Hiding them from the count would change them unasked.
		const renamed = def({ id: "oscar", displayName: "Oscar" });
		const counts = stats({ oscar: { uses: tally(3, "a.md", "b.md"), foldDiffers: tally(2, "a.md") }, papa: {} });
		const h = open(modalInput(renamed, form({ calloutId: "papa", displayName: "Papa", foldable: true, defaultFolded: true }), counts));
		const [, foldPart] = h.parts();
		assert.ok(foldPart);
		assert.match(foldPart.textContent, /set on 2 callouts in 1 note\./);
		h.cards()[1]!.fire("click"); // Keep "oscar" as another ID
		assert.equal(foldPart.hasClass("cs-row-hidden"), false);
		assert.match(foldPart.textContent, /set on 2 callouts in 1 note\./);
	});

	it("moves the fold count as ids are sent here, and hides the part when nothing would change", async () => {
		const folding = def({ id: "f", displayName: "F", aliases: ["g"] });
		const counts = stats({ f: {}, g: { uses: tally(2, "b.md"), foldDiffers: tally(2, "b.md") } });
		const h = open(modalInput(folding, form({ calloutId: "f", displayName: "F", foldable: true }), counts));
		const [, foldPart] = h.parts();
		assert.ok(foldPart);
		assert.equal(foldPart.hasClass("cs-row-hidden"), true, "g's notes stay g's: nothing of this callout differs");
		h.cards()[2]!.fire("click"); // Change them in your notes → this callout
		assert.equal(foldPart.hasClass("cs-row-hidden"), false);
		assert.match(foldPart.textContent, /set on 2 callouts in 1 note\./);
	});
});

describe("askNoteChanges", () => {
	it("reads no note when the edit cannot reach one", async () => {
		const registry = new CalloutRegistry();
		registry.load({ callouts: [def({ id: "plain" })] });
		let reads = 0;
		const app = { vault: { getMarkdownFiles: () => { reads++; return []; } } } as unknown as App;
		const answer = await askNoteChanges({
			app, registry, existingId: "plain", state: form({ calloutId: "plain", displayName: "plain" }), moves: [],
			stillWanted: () => true, open: () => assert.fail("nothing to ask"),
		});
		assert.equal(answer?.choices.rewrite.size, 0);
		assert.equal(reads, 0);
	});

	it("opens the window only for what the notes hold", async () => {
		const registry = new CalloutRegistry();
		registry.load({ callouts: [def({ id: "x", aliases: ["used", "unused"] })] });
		const notes = new Map([["a.md", "> [!used] Used"]]);
		const handles = [...notes.keys()].map((path) => ({ path }));
		const app = { vault: {
			getMarkdownFiles: () => handles,
			getAbstractFileByPath: (path: string) => handles.find((file) => file.path === path) ?? null,
			cachedRead: (file: { path: string }) => Promise.resolve(notes.get(file.path)!),
		} } as unknown as App;
		let asked: NoteChangesModalInput | undefined;
		await askNoteChanges({
			app, registry, existingId: "x", state: form({ calloutId: "x", displayName: "x" }), moves: [],
			stillWanted: () => true,
			open: (input) => { asked = input; return Promise.resolve(null); },
		});
		assert.deepEqual(asked?.question.ids.map(({ leaving }) => leaving.id), ["used"]);
	});

	it("does not ask about a save the editor has moved on from", async () => {
		const registry = new CalloutRegistry();
		registry.load({ callouts: [def({ id: "x", aliases: ["used"] })] });
		const note = { path: "a.md" };
		const app = { vault: {
			getMarkdownFiles: () => [note],
			getAbstractFileByPath: () => note,
			cachedRead: () => Promise.resolve("> [!used] Used"),
		} } as unknown as App;
		const answer = await askNoteChanges({
			app, registry, existingId: "x", state: form({ calloutId: "x", displayName: "x" }), moves: [],
			stillWanted: () => false, open: () => assert.fail("the editor moved on"),
		});
		assert.equal(answer, null);
	});
});
