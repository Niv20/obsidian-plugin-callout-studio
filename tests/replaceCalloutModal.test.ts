/**
 * The replacement picker rewrites every note that uses a callout, with no undo,
 * and its search field opens focused on every device. Enter used to pick the
 * top row *and* confirm, so one reflexive keypress rewrote the vault. Enter now
 * only chooses; confirming takes the button, which is red, as the warning it is.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { setImmediate } from "node:timers/promises";
import type { App } from "obsidian";
import { t } from "../src/i18n";
import { CalloutRegistry } from "../src/manager/CalloutRegistry";
import { ReplaceCalloutModal, type ReplaceChoice } from "../src/utils/ReplaceCalloutModal";
import { fakeDom, type FakeElement } from "./support/fakeDom";
import { TestKeymap, TestScope } from "./support/fakeKeymap";
import { Notice } from "./support/obsidianStub";

function open() {
	fakeDom.light();
	const registry = new CalloutRegistry();
	registry.load(null);
	const app = { keymap: new TestKeymap(), scope: new TestScope() } as unknown as App;
	const modal = new ReplaceCalloutModal(app, {
		message: "",
		registry,
		availableCallouts: registry.getAll().filter((def) => def.id !== "note"),
	});
	const containerEl = fakeDom.document.body.createDiv({ cls: "modal-container" });
	const modalEl = containerEl.createDiv({ cls: "modal" });
	const titleEl = modalEl.createDiv({ cls: "modal-header" }).createDiv({ cls: "modal-title" });
	const contentEl = modalEl.createDiv({ cls: "modal-content" });
	Object.assign(modal, {
		containerEl,
		modalEl,
		titleEl,
		contentEl,
		app,
		scope: app.scope,
		setTitle: (title: string) => {
			titleEl.setText(title);
			return modal;
		},
		open: () => modal.onOpen(),
		close: () => modal.onClose(),
	});
	let answer: ReplaceChoice | undefined;
	void modal.prompt().then((result) => {
		answer = result;
	});
	const confirm = (): FakeElement => {
		const buttons = modalEl.querySelectorAll(".modal-button-container button");
		assert.equal(buttons.length, 1);
		return buttons[0]!;
	};
	return {
		modalEl,
		contentEl,
		confirm,
		answer: () => answer,
		search: () => contentEl.querySelector(".callout-studio-replace-search")!,
		close: () => {
			modal.onClose();
			containerEl.remove();
		},
	};
}

describe("the replacement picker", () => {
	it("chooses the top row on Enter but leaves confirming to the button", async () => {
		const h = open();
		try {
			h.search().fire("keydown", { type: "keydown", key: "Enter", preventDefault: () => {} });
			await setImmediate();
			assert.equal(h.answer(), undefined, "Enter confirmed a vault-wide rewrite");
			const chosen = h.contentEl.querySelectorAll(".callout-studio-replace-item.is-selected");
			assert.equal(chosen.length, 1);
			assert.equal(h.confirm().getAttribute("aria-disabled"), "false");
			const id = chosen[0]!.getAttribute("data-callout-id");
			h.confirm().fire("click");
			await setImmediate();
			assert.deepEqual(h.answer(), { action: "replace", replaceWith: id });
		} finally {
			h.close();
		}
	});

	it("dims its button until a row is chosen, and says what to choose when it is pressed", async () => {
		const h = open();
		try {
			assert.equal(h.confirm().getAttribute("aria-disabled"), "true");
			assert.equal(h.confirm().hasClass("cs-btn-disabled"), true);
			h.confirm().fire("click");
			await setImmediate();
			assert.equal(h.answer(), undefined, "a dimmed button must not confirm");
			assert.equal(String(Notice.last?.message), t("replaceModal.chooseFirstReplace"));
			h.search().fire("keydown", { type: "keydown", key: "Enter", preventDefault: () => {} });
			assert.equal(h.confirm().getAttribute("aria-disabled"), "false");
			assert.equal(h.confirm().hasClass("cs-btn-disabled"), false);
		} finally {
			h.close();
		}
	});

	it("marks its button as destructive", () => {
		const h = open();
		try {
			// Obsidian's quiet red (Log out's look) on every device, never the solid one.
			assert.ok(h.confirm().hasClass("mod-destructive"));
			assert.ok(!h.confirm().hasClass("mod-cta"));
		} finally {
			h.close();
		}
	});

	it("lists only callouts: nothing to delete here", () => {
		const h = open();
		try {
			const rows = h.contentEl.querySelectorAll(".callout-studio-replace-item");
			assert.ok(rows.length > 0);
			for (const row of rows) assert.ok(row.getAttribute("data-callout-id"), "a row that is not a callout");
		} finally {
			h.close();
		}
	});

	it("walks the list with the arrows from nothing chosen", () => {
		const h = open();
		try {
			const key = (name: string) =>
				h.search().fire("keydown", { type: "keydown", key: name, preventDefault: () => {} });
			const chosenId = () =>
				h.contentEl.querySelector(".callout-studio-replace-item.is-selected")?.getAttribute("data-callout-id");
			const ids = h.contentEl
				.querySelectorAll(".callout-studio-replace-item")
				.map((el) => el.getAttribute("data-callout-id"));
			key("ArrowDown");
			assert.equal(chosenId(), ids[0]);
			key("ArrowDown");
			assert.equal(chosenId(), ids[1]);
			key("ArrowUp");
			key("ArrowUp");
			assert.equal(chosenId(), ids[0], "stops at the top");
		} finally {
			h.close();
		}
	});

	it("draws each callout as a row of the Built-in callouts list", () => {
		const h = open();
		try {
			const row = h.contentEl.querySelector(".callout-studio-replace-item")!;
			assert.ok(row.hasClass("setting-item"), "not one of Obsidian's setting rows");
			assert.ok(row.hasClass("cs-callout-row"), "not dressed like the settings' callout rows");
			assert.ok(row.querySelector(".callout-studio-row-icon"));
			assert.ok(row.querySelector(".setting-item-name .cs-row-name"));
			assert.ok(row.querySelector(".setting-item-description .callout-studio-row-syntax"), "no [!id] line");
			assert.ok(row.querySelector(".callout-studio-row-colors"), "no colour circles");
			assert.ok(row.querySelector(".callout-studio-replace-item-check"));
			assert.ok(
				h.contentEl.querySelector(".setting-group.mod-list .setting-items"),
				"not in Obsidian's list box",
			);
		} finally {
			h.close();
		}
	});

	it("keeps its choice when the filter hides the chosen row", () => {
		const h = open();
		try {
			h.search().fire("keydown", { type: "keydown", key: "Enter", preventDefault: () => {} });
			const input = h.search() as unknown as FakeElement & { value: string };
			input.value = "zzzz-no-such-callout";
			input.fire("input");
			assert.equal(h.contentEl.querySelectorAll(".callout-studio-replace-item").length, 0);
			assert.equal(h.confirm().getAttribute("aria-disabled"), "false");
		} finally {
			h.close();
		}
	});

	it("says nothing matches, in words, where the mascot cannot be drawn", () => {
		const h = open();
		try {
			const query = "zzzz-no-such-callout";
			const input = h.search() as unknown as FakeElement & { value: string };
			input.value = query;
			input.fire("input");
			const empty = h.contentEl.querySelector(".callout-studio-empty-state");
			assert.ok(empty, "no empty state");
			assert.equal(empty.textContent, t("calloutPicker.noMatches", { query }));
			assert.equal(h.contentEl.querySelectorAll(".cs-mascot-box").length, 0);
		} finally {
			h.close();
		}
	});

	it("puts the sad brush over the words of a search that found nothing, and takes it away", () => {
		const globals = globalThis as Record<string, unknown>;
		const createEl = globals.createEl as (tag: string, options?: unknown) => FakeElement;
		// The mascot can only be drawn where Obsidian's `createSvg` is.
		globals.createSvg = (tag: string, options?: unknown) => createEl(tag, options);
		fakeDom.window.clearTimers();
		const h = open();
		try {
			const input = h.search() as unknown as FakeElement & { value: string };
			const type = (text: string): void => {
				input.value = text;
				input.fire("input");
			};
			assert.equal(h.contentEl.querySelectorAll(".cs-mascot-box").length, 0, "a mascot with nothing searched");

			type("zzzz-no-such-callout");
			const empty = h.contentEl.querySelector(".callout-studio-empty-state");
			assert.ok(empty, "no empty state");
			assert.ok(empty.hasClass("cs-mascot-line"), "the empty state is not the mascot's line");
			assert.equal(empty.querySelectorAll(".cs-mascot-box").length, 1);
			assert.match(empty.textContent, /zzzz-no-such-callout/, "the words went with the picture");

			// Another key of the same dead end keeps the one mascot.
			type("zzzz-no-such-callout-x");
			assert.equal(h.contentEl.querySelectorAll(".cs-mascot-box").length, 1);

			// A match brings the list back and the mascot goes.
			type("tip");
			assert.equal(h.contentEl.querySelectorAll(".cs-mascot-box").length, 0);
			assert.equal(h.contentEl.querySelector(".callout-studio-empty-state"), null);
			assert.ok(h.contentEl.querySelectorAll(".callout-studio-replace-item").length > 0);
		} finally {
			h.close();
			delete globals.createSvg;
			fakeDom.window.clearTimers();
			// The brush's frames end once its drawing has left the page, which it never was in.
			fakeDom.window.flushFrames();
		}
	});
});
