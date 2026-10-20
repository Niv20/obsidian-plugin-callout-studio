/**
 * "Update your notes?" — what the callout editor's Save asks before a note
 * changes (GitHub: Nathan, after #86). One question for everything: the
 * changes, then Leave them as they are (chosen on opening — no note changes
 * unless the user says so) or Change them to one of this callout's own ids.
 * Cancel saves nothing.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { setImmediate } from "node:timers/promises";
import type { App } from "obsidian";
import { t } from "../src/i18n";
import { CalloutRegistry } from "../src/manager/CalloutRegistry";
import { askNoteChanges } from "../src/settings/editor/askNoteChanges";
import { NoteChangesModal, type NoteChangesModalInput } from "../src/settings/editor/NoteChangesModal";
import {
	pendingNoteChanges,
	type NoteChangeFormState,
	type NoteChoices,
	type PendingNoteChanges,
} from "../src/settings/editor/noteChanges";
import { choicesFor, foldTally, noteChangeQuestion } from "../src/settings/editor/noteChangeQuestion";
import type { CalloutDefinition } from "../src/types";
import type { IdNoteStats, NoteTally } from "../src/utils/idNoteStats";
import { fakeDom, NODE_TEXT, type FakeElement } from "./support/fakeDom";
import { TestKeymap, TestScope } from "./support/fakeKeymap";
import { dropdownOptions, pickDropdown } from "./support/selectDropdown";

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

	it("lists a removed id its notes use, and Leave changes nothing", () => {
		const pending = pendingOf(callout, form());
		const question = noteChangeQuestion(pending, stats({ test: { uses: tally(12, "a.md", "b.md") } }));
		assert.ok(question);
		assert.deepEqual(question.ids.map(({ leaving }) => leaving.id), ["test"]);
		assert.equal(question.affected?.count, 12);
		const left = choicesFor(question, null);
		assert.equal(left.rewrite.size, 0, "nothing is rewritten unless the user says so");
		assert.equal(left.titles, false);
		assert.equal(left.fold, false);
	});

	it("changes every listed id to the one picked, and lets titles and fold marks follow", () => {
		const idea = def({ id: "idea", displayName: "Idea", aliases: ["test", "thought"] });
		const pending = pendingOf(idea, form({ calloutId: "insight", displayName: "Insight", aliases: ["thought"] }));
		const question = noteChangeQuestion(pending, stats({ idea: { uses: tally(3, "a.md") }, test: { uses: tally(2, "b.md") } }));
		assert.ok(question);
		assert.equal(question.affected?.count, 5);
		const changed = choicesFor(question, "thought");
		assert.deepEqual([...changed.rewrite], [["idea", "thought"], ["test", "thought"]]);
		assert.equal(changed.titles, true);
		assert.equal(changed.fold, true);
	});

	it("lists a new name alone when only the name changed, counting its titles", () => {
		const named = def({ id: "tip2", displayName: "Old Name" });
		const pending = pendingOf(named, form({ calloutId: "tip2", displayName: "New Name" }));
		const question = noteChangeQuestion(pending, stats({ tip2: { uses: tally(2, "a.md"), titled: tally(2, "a.md") } }));
		assert.ok(question?.name);
		assert.equal(question.name.from, "Old Name");
		assert.equal(question.affected?.count, 2);
		assert.equal(choicesFor(question, "tip2").titles, true);
	});

	it("does not list the name again when the main id's rename already says it", () => {
		const renamed = def({ id: "idea", displayName: "Idea" });
		const pending = pendingOf(renamed, form({ calloutId: "insight", displayName: "Insight" }));
		const question = noteChangeQuestion(pending, stats({ idea: { uses: tally(3, "a.md"), titled: tally(3, "a.md") } }));
		assert.ok(question);
		assert.equal(question.name, null);
		assert.equal(question.affected?.count, 3, "the old id's titled callouts are its uses, counted once");
	});

	it("lists fold marks only when one would change", () => {
		const folding = def({ id: "f", aliases: ["g"] });
		const pending = pendingOf(folding, form({ calloutId: "f", displayName: "f", foldable: true, defaultFolded: true }));
		const counts = stats({ f: { foldDiffers: tally(1, "a.md") }, g: { uses: tally(2, "b.md"), foldDiffers: tally(2, "b.md") } });
		assert.equal(foldTally(pending, counts, [])?.count, 1);
		assert.equal(foldTally(pending, counts, ["g"])?.count, 3);
		assert.equal(noteChangeQuestion(pending, counts)?.fold, "-");
		const settled = stats({ f: {}, g: {} });
		assert.equal(noteChangeQuestion(pending, settled), null);
	});

	it("lists everything that might apply when the notes could not all be read", () => {
		const both = def({ id: "idea", displayName: "Idea", aliases: ["test"] });
		const pending = pendingOf(both, form({ calloutId: "insight", displayName: "Insight", foldable: true }));
		const question = noteChangeQuestion(pending, null);
		assert.ok(question);
		assert.deepEqual(question.ids.map(({ leaving, uses }) => [leaving.id, uses]), [["idea", null], ["test", null]]);
		assert.equal(question.fold, "+");
		assert.equal(question.affected, null);
	});
});

/** A line as it reads, a `\n` for each of its line breaks. */
function lineText(line: FakeElement): string {
	return line.childNodes.map((node) => (node.nodeType === NODE_TEXT ? node.nodeValue : "\n")).join("");
}

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
	let answer: NoteChoices | null | undefined;
	void modal.ask().then((result) => { answer = result; });
	const button = (label: string): FakeElement =>
		modalEl.querySelectorAll(".cs-modal-footer button").find((el) => el.textContent === label)!;
	const cards = () => contentEl.querySelectorAll(".cs-option-box");
	return {
		titleEl, contentEl,
		buttons: () => modalEl.querySelectorAll(".cs-modal-footer button").map((el) => el.textContent),
		answer: async () => { await setImmediate(); return answer; },
		changes: () => contentEl.querySelectorAll(".cs-note-change-list li").map((li) => li.textContent),
		lines: () => contentEl.querySelectorAll(".cs-note-change-line").map(lineText),
		cards,
		titles: () => cards().map((card) => card.querySelector(".cs-option-box-title")!.textContent),
		desc: (card: FakeElement) => card.querySelector(".cs-option-box-desc")?.textContent,
		chosen: () => contentEl.querySelectorAll(".cs-option-box.is-selected").map((el) => el.querySelector(".cs-option-box-title")!.textContent),
		save: () => button(t("editor.saveChanges")).fire("click"),
		cancel: () => button(t("editor.cancel")).fire("click"),
		escape: () => modal.onClose(),
	};
}

function modalInput(callout: CalloutDefinition, state: NoteChangeFormState, counts: Map<string, IdNoteStats> | null): NoteChangesModalInput {
	const pending = pendingOf(callout, state);
	const question = noteChangeQuestion(pending, counts);
	assert.ok(question);
	const saved = { ...callout, id: state.calloutId, displayName: state.displayName, aliases: [...state.aliases] };
	return { question, pending, saved };
}

describe("the window", () => {
	const callout = def({ id: "abstract2", displayName: "Abstract2", aliases: ["test"] });

	it("says the one change in a line, how far it reaches, asks, and starts on Leave them", async () => {
		const h = open(modalInput(callout, form(), stats({ test: { uses: tally(12, "a.md", "b.md") } })));
		assert.equal(h.titleEl.textContent, t("noteChanges.title"));
		assert.deepEqual(h.changes(), [], "one change is a line, not a list");
		assert.deepEqual(h.lines(), [
			'You removed the ID "test".',
			"This affects 12 callouts in 2 notes.\nWhat should happen to those callouts?",
		]);
		assert.deepEqual(h.titles(), [t("noteChanges.leave"), 'Change them to "abstract2"']);
		assert.equal(h.desc(h.cards()[0]!), "They keep [!test] and fall back to the default style.");
		assert.equal(h.desc(h.cards()[1]!), "Every [!test] in your notes becomes [!abstract2].");
		assert.equal(h.contentEl.querySelector(".cs-select-dropdown"), null, "one id to change to: no dropdown");
		assert.deepEqual(h.chosen(), [t("noteChanges.leave")]);
		h.save();
		const answer = await h.answer();
		assert.equal(answer?.rewrite.size, 0);
		assert.equal(answer?.titles, false);
	});

	it("counts one callout in one note in the singular, and asks about that one", () => {
		const h = open(modalInput(callout, form(), stats({ test: { uses: tally(1, "a.md") } })));
		assert.equal(h.lines()[1], "This affects 1 callout in 1 note.\nWhat should happen to that callout?");
	});

	it("asks about those callouts when the notes could not all be counted", () => {
		const h = open(modalInput(callout, form(), null));
		assert.equal(h.lines()[1], `${t("noteChanges.affectsUnknown")}\nWhat should happen to those callouts?`);
	});

	it("lists several changes, and changes every old id to the one picked from this callout's own", async () => {
		const idea = def({ id: "idea", displayName: "Idea", aliases: ["test", "thought"] });
		const h = open(modalInput(idea, form({ calloutId: "insight", displayName: "Insight", aliases: ["thought"] }),
			stats({ idea: { uses: tally(3, "a.md") }, test: { uses: tally(2, "b.md") } })));
		assert.deepEqual(h.changes(), [
			'You changed the display name from "Idea" to "Insight", so the main ID changes from "idea" to "insight".',
			'You removed the ID "test".',
		]);
		assert.equal(h.lines()[0], "This affects 5 callouts in 2 notes.\nWhat should happen to those callouts?");
		assert.deepEqual(h.titles(), [t("noteChanges.leave"), t("noteChanges.changeTo")]);
		assert.equal(h.desc(h.cards()[0]!), t("noteChanges.leaveManyDesc"));
		const change = h.cards()[1]!;
		assert.equal(h.desc(change), "Every old ID in your notes becomes [!insight].");
		// Only this callout's own ids, its main id first: never another callout.
		const dropdown = change.querySelector(".cs-select-dropdown") as unknown as HTMLElement;
		assert.deepEqual(dropdownOptions(dropdown).map((row) => row.textContent), ["insight", "thought"]);
		pickDropdown(dropdown, "thought");
		assert.equal(h.desc(change), "Every old ID in your notes becomes [!thought].");
		assert.deepEqual(h.chosen(), [t("noteChanges.changeTo")]);
		h.save();
		const answer = await h.answer();
		assert.deepEqual([...answer!.rewrite], [["idea", "thought"], ["test", "thought"]]);
		assert.equal(answer?.titles, true);
	});

	it("says several removed ids in one sentence, listed after a colon", () => {
		const many = def({ id: "abstract2", displayName: "Abstract2", aliases: ["test", "dfgdf", "sss"] });
		const h = open(modalInput(many, form(), stats({ test: { uses: tally(1, "a.md") }, dfgdf: { uses: tally(1, "b.md") }, sss: { uses: tally(1, "c.md") } })));
		assert.deepEqual(h.changes(), [], "one line, not a list of the same sentence");
		assert.equal(h.lines()[0], "You removed these IDs: test, dfgdf, sss.");
	});

	it("puts the dropdown at the card's trailing edge, just before the dot", () => {
		const idea = def({ id: "idea", displayName: "Idea", aliases: ["test", "thought"] });
		const h = open(modalInput(idea, form({ calloutId: "idea", displayName: "Idea", aliases: ["thought"] }),
			stats({ test: { uses: tally(1, "a.md") } })));
		const parts = h.cards()[1]!.children.map((child) => child.className.split(" ")[0]);
		assert.deepEqual(parts, ["cs-option-box-text", "cs-note-change-target", "cs-option-radio"]);
	});

	it("follows a rename back to the main id, titles and all", async () => {
		const renamed = def({ id: "idea", displayName: "Idea" });
		const h = open(modalInput(renamed, form({ calloutId: "insight", displayName: "Insight" }), stats({ idea: { uses: tally(2, "a.md") } })));
		assert.deepEqual(h.lines(), [
			'You changed the display name from "Idea" to "Insight", so the main ID changes from "idea" to "insight".',
			"This affects 2 callouts in 1 note.\nWhat should happen to those callouts?",
		]);
		const change = h.cards()[1]!;
		assert.equal(h.desc(change), 'Every [!idea] in your notes becomes [!insight], and titles that read "Idea" become "Insight".');
		change.fire("click");
		h.save();
		const answer = await h.answer();
		assert.deepEqual([...answer!.rewrite], [["idea", "insight"]]);
		assert.equal(answer?.titles, true);
	});

	it("asks about titles alone when only the name changed", async () => {
		const named = def({ id: "tip2", displayName: "Old Name" });
		const h = open(modalInput(named, form({ calloutId: "tip2", displayName: "New Name" }),
			stats({ tip2: { uses: tally(2, "a.md"), titled: tally(2, "a.md") } })));
		assert.equal(h.lines()[0], 'You changed the display name from "Old Name" to "New Name".');
		assert.deepEqual(h.titles(), [t("noteChanges.leave"), 'Change them to "New Name"']);
		assert.equal(h.desc(h.cards()[0]!), 'They keep reading "Old Name".');
		h.cards()[1]!.fire("click");
		h.save();
		const answer = await h.answer();
		assert.equal(answer?.rewrite.size, 0);
		assert.equal(answer?.titles, true);
	});

	it("says no more than what the answer does — no undo line", () => {
		const h = open(modalInput(callout, form(), stats({ test: { uses: tally(1, "a.md") } })));
		assert.doesNotMatch(h.contentEl.textContent, /undo/i);
	});

	it("speaks for another action when it stands before one — a built-in's Reset to default", async () => {
		const reset = { removed: (ids: readonly string[]) => `Reset removes "${ids.join(" and ")}".`, confirm: t("settings.resetAction") };
		const h = open({ ...modalInput(callout, form(), stats({ test: { uses: tally(2, "a.md") } })), action: reset });
		assert.equal(h.titleEl.textContent, t("noteChanges.title"));
		assert.equal(h.lines()[0], 'Reset removes "test".');
		assert.deepEqual(h.buttons(), [t("editor.cancel"), t("settings.resetAction")]);
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
		assert.equal(answer?.rewrite.size, 0);
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
