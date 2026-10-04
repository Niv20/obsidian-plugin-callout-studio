/**
 * A confirmation that cannot be taken back can ask for a tick first: the
 * checkbox sits under the message and the confirm button stays disabled until
 * it is ticked. "Reset everything" is the one that asks.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { App } from "obsidian";
import { ConfirmModal } from "../src/utils/ConfirmModal";
import { en } from "../src/i18n/en";
import { fakeDom, type FakeElement } from "./support/fakeDom";
import { TestKeymap, TestScope } from "./support/fakeKeymap";

function open(acknowledgement?: string) {
	fakeDom.light();
	const app = { keymap: new TestKeymap(), scope: new TestScope() } as unknown as App;
	const modal = new ConfirmModal(app, "Title", "First.\nSecond.", "Go", undefined, undefined, acknowledgement);
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
	const answer = modal.confirm();
	const button = (text: string): FakeElement => {
		const found = modalEl.querySelectorAll("button").find((b) => b.textContent === text);
		assert.ok(found, `a "${text}" button`);
		return found;
	};
	return { answer, contentEl, confirm: button("Go"), destroy: () => containerEl.remove() };
}

describe("ConfirmModal acknowledgement", () => {
	it("leaves the confirm button enabled when none is asked for", () => {
		const h = open();
		try {
			assert.equal(h.contentEl.querySelector(".cs-confirm-acknowledge"), null);
			assert.notEqual(h.confirm.getAttribute("aria-disabled"), "true");
		} finally { h.destroy(); }
	});

	it("keeps the confirm button disabled until the box is ticked", async () => {
		const h = open(en["confirm.acknowledge"]);
		try {
			const label = h.contentEl.querySelector(".cs-confirm-acknowledge");
			assert.ok(label, "the checkbox row is drawn");
			assert.equal(label.textContent, en["confirm.acknowledge"]);
			assert.equal(h.contentEl.lastChild, label, "it sits under the message");
			const box = label.querySelector("input");
			assert.ok(box);
			assert.equal(h.confirm.getAttribute("aria-disabled"), "true");
			assert.equal(label.hasClass("is-checked"), false, "an unchecked box keeps its neutral outline");
			Object.assign(box, { checked: true });
			box.fire("change");
			assert.notEqual(h.confirm.getAttribute("aria-disabled"), "true");
			assert.equal(label.hasClass("is-checked"), true, "the checked box gets its red outline");
			Object.assign(box, { checked: false });
			box.fire("change");
			assert.equal(h.confirm.getAttribute("aria-disabled"), "true");
			assert.equal(label.hasClass("is-checked"), false, "unticking restores the neutral outline");
			Object.assign(box, { checked: true });
			box.fire("change");
			assert.equal(label.hasClass("is-checked"), true);
			h.confirm.fire("click");
			assert.equal(await h.answer, true);
		} finally { h.destroy(); }
	});
});

describe("ConfirmModal locked button", () => {
	it("flashes the label and scrolls the body to its very end instead of confirming", () => {
		const h = open(en["confirm.acknowledge"]);
		try {
			const label = h.contentEl.querySelector(".cs-confirm-acknowledge");
			assert.ok(label);
			const scrolls: unknown[] = [];
			Object.assign(window, { matchMedia: () => ({ matches: false }) });
			Object.assign(h.contentEl, {
				scrollHeight: 900,
				scrollTo: (options: unknown) => { scrolls.push(options); },
			});
			h.confirm.fire("click");
			assert.ok(label.hasClass("cs-nudge"), "the label does not flash");
			assert.equal(scrolls.length, 1, "a box scrolled out of view stays out of view");
			assert.deepEqual(scrolls[0], { top: 900, behavior: "smooth" }, "it stopped short of the end");
			assert.ok(h.contentEl.querySelector(".cs-confirm-acknowledge"), "the window closed");
		} finally { h.destroy(); }
	});
});
