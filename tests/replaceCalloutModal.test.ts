/**
 * The replacement picker rewrites every note that uses a callout, with no undo,
 * and its search field opens focused on every device. Enter used to pick the
 * top row *and* confirm, so one reflexive keypress rewrote the vault. Enter now
 * only chooses; confirming takes the button, which reads as the warning it is.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { setImmediate } from "node:timers/promises";
import type { App } from "obsidian";
import { CalloutRegistry } from "../src/manager/CalloutRegistry";
import { ReplaceCalloutModal, type DeleteAction } from "../src/utils/ReplaceCalloutModal";
import { fakeDom, type FakeElement } from "./support/fakeDom";
import { TestKeymap, TestScope } from "./support/fakeKeymap";

function open(mode: "replace" | "delete") {
	fakeDom.light();
	const registry = new CalloutRegistry();
	registry.load(null);
	const app = { keymap: new TestKeymap(), scope: new TestScope() } as unknown as App;
	const modal = new ReplaceCalloutModal(app, {
		mode, message: "", registry,
		availableCallouts: registry.getAll().filter((def) => def.id !== "note"),
	});
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
	let answer: DeleteAction | undefined;
	void modal.prompt().then((result) => { answer = result; });
	const confirm = (): FakeElement => {
		const buttons = modalEl.querySelectorAll(".cs-modal-footer button");
		assert.equal(buttons.length, 1);
		return buttons[0]!;
	};
	return {
		modalEl, contentEl, confirm,
		answer: () => answer,
		search: () => contentEl.querySelector(".callout-studio-replace-search")!,
		close: () => { modal.onClose(); containerEl.remove(); },
	};
}

describe("the replacement picker", () => {
	it("chooses the top row on Enter but leaves confirming to the button", async () => {
		const h = open("replace");
		try {
			h.search().fire("keydown", { type: "keydown", key: "Enter", preventDefault: () => {} });
			await setImmediate();
			assert.equal(h.answer(), undefined, "Enter confirmed a vault-wide rewrite");
			const chosen = h.contentEl.querySelectorAll(".callout-studio-replace-item.is-selected");
			assert.equal(chosen.length, 1);
			assert.equal(h.confirm().disabled, false);
			const id = chosen[0]!.querySelector(".callout-studio-replace-item-id")!.textContent;
			h.confirm().fire("click");
			await setImmediate();
			assert.deepEqual(h.answer(), { action: "replace", replaceWith: id });
		} finally { h.close(); }
	});

	for (const mode of ["replace", "delete"] as const) {
		it(`marks its ${mode} button as destructive`, () => {
			const h = open(mode);
			try {
				assert.ok(h.confirm().hasClass("mod-warning"));
				assert.ok(!h.confirm().hasClass("mod-cta"));
			} finally { h.close(); }
		});
	}
});
