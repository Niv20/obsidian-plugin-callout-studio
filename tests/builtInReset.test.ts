/**
 * A built-in row's Reset to default takes the ids the user added off the
 * callout. It used to warn that notes using them would "stop working" and
 * offer only Cancel or Reset; now it asks what the callout editor asks when an
 * id is removed there — Leave them as they are, or Change them to one of the
 * built-in's own ids — with Reset to default as the button. Notes change only
 * when the user picks Change, and they change before the reset.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { App } from "obsidian";
import { t } from "../src/i18n";
import { CalloutRegistry } from "../src/manager/CalloutRegistry";
import type { NoteChangesModalInput } from "../src/settings/editor/NoteChangesModal";
import { choicesFor } from "../src/settings/editor/noteChangeQuestion";
import type { NoteChoices } from "../src/settings/editor/noteChanges";
import { handleBuiltInReset } from "../src/settings/sections/builtInResetAction";
import type { SettingsSectionContext } from "../src/settings/sections/types";
import { fakeDom } from "./support/fakeDom";
import { Notice } from "./support/obsidianStub";

/** A Note the user gave the id `memo`, and a vault holding `notes`. */
function setup(notes: Record<string, string>, opts: { failWrites?: boolean } = {}) {
	fakeDom.light();
	const contents = new Map(Object.entries(notes));
	const handles = [...contents.keys()].map((path) => ({ path }));
	const app = { vault: {
		getMarkdownFiles: () => handles,
		getAbstractFileByPath: (path: string) => handles.find((file) => file.path === path) ?? null,
		cachedRead: (file: { path: string }) => Promise.resolve(contents.get(file.path)!),
		process: (file: { path: string }, fn: (text: string) => string) => {
			if (opts.failWrites) return Promise.reject(new Error("EIO"));
			contents.set(file.path, fn(contents.get(file.path)!));
			return Promise.resolve();
		},
	} } as unknown as App;
	const registry = new CalloutRegistry();
	registry.load(null);
	registry.update("note", { aliases: ["memo"] });
	let displayed = 0;
	const ctx = { app, plugin: { registry }, display: () => { displayed++; } } as unknown as SettingsSectionContext;
	return {
		ctx, registry, contents,
		displayed: () => displayed,
		ids: () => [registry.getReal("note")!.id, ...(registry.getReal("note")!.aliases ?? [])],
	};
}

const answering = (answer: (input: NoteChangesModalInput) => NoteChoices | null) => {
	const asked: NoteChangesModalInput[] = [];
	const open = (input: NoteChangesModalInput) => {
		asked.push(input);
		return Promise.resolve(answer(input));
	};
	return { asked, open };
};

describe("a built-in's Reset to default", () => {
	it("resets at once, asking nothing, when no note uses an id the user added", async () => {
		const h = setup({ "a.md": "> [!note] Note" });
		await handleBuiltInReset(h.ctx, h.registry.get("note")!, () => assert.fail("nothing to ask"));
		assert.deepEqual(h.ids(), ["note"]);
		assert.equal(h.displayed(), 1);
	});

	it("asks about an added id its notes use, in Reset's words and with Reset's button", async () => {
		const h = setup({ "a.md": "> [!memo] Memo" });
		const { asked, open } = answering(() => null);
		await handleBuiltInReset(h.ctx, h.registry.get("note")!, open);
		assert.equal(asked.length, 1);
		const [input] = asked;
		assert.deepEqual(input!.question.ids.map(({ leaving }) => leaving.id), ["memo"]);
		assert.equal(input!.question.name, null, "a built-in's name is not asked about");
		assert.equal(input!.question.fold, null, "nor are fold marks");
		assert.equal(input!.question.affected?.count, 1);
		assert.equal(input!.action?.confirm, t("settings.resetAction"));
		assert.equal(input!.action?.removed(["memo"]), 'Reset to default removes the ID "memo" that you added.');
		assert.equal(input!.action?.removed(["memo", "jot"]), "Reset to default removes the IDs you added: memo, jot.");
		assert.deepEqual([input!.saved.id, ...(input!.saved.aliases ?? [])], ["note"], "Change offers the built-in's own ids");
	});

	it("changes nothing on Cancel", async () => {
		const h = setup({ "a.md": "> [!memo] Memo" });
		await handleBuiltInReset(h.ctx, h.registry.get("note")!, answering(() => null).open);
		assert.deepEqual(h.ids(), ["note", "memo"]);
		assert.equal(h.contents.get("a.md"), "> [!memo] Memo");
		assert.equal(h.displayed(), 0);
	});

	it("resets and leaves the notes as written on Leave them as they are", async () => {
		const h = setup({ "a.md": "> [!memo] Memo" });
		await handleBuiltInReset(h.ctx, h.registry.get("note")!, answering(({ question }) => choicesFor(question, null)).open);
		assert.deepEqual(h.ids(), ["note"]);
		assert.equal(h.contents.get("a.md"), "> [!memo] Memo");
		assert.equal(h.displayed(), 1);
	});

	it("changes the notes to the built-in's id, title too, then resets, on Change", async () => {
		const h = setup({ "a.md": "> [!memo] Memo\n> body", "b.md": "> [!memo] My own title" });
		await handleBuiltInReset(h.ctx, h.registry.get("note")!, answering(({ question }) => choicesFor(question, "note")).open);
		assert.equal(h.contents.get("a.md"), "> [!note] Note\n> body");
		assert.equal(h.contents.get("b.md"), "> [!note] My own title", "a title the user wrote stays");
		assert.deepEqual(h.ids(), ["note"]);
		assert.equal(h.displayed(), 1);
	});

	it("leaves the callout as it was when the notes cannot all be changed", async () => {
		const h = setup({ "a.md": "> [!memo] Memo" }, { failWrites: true });
		const { warn, error } = console;
		console.warn = console.error = () => undefined;
		try {
			await handleBuiltInReset(h.ctx, h.registry.get("note")!, answering(({ question }) => choicesFor(question, "note")).open);
		} finally {
			Object.assign(console, { warn, error });
		}
		assert.deepEqual(h.ids(), ["note", "memo"]);
		assert.equal(String(Notice.last?.message), t("vault.resetNotesFailed"));
		assert.equal(h.displayed(), 0);
	});
});
