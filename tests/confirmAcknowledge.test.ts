/**
 * tests/confirmAcknowledge.test.ts — the plugin's yes/no question
 * (`utils/ConfirmModal.ts`), Obsidian's own `ConfirmationModal` (S9-06).
 *
 * Cancel, then the confirm button, in Obsidian's button bar, the confirm one
 * focused on open with a keyboard. A confirmation that cannot be taken back
 * asks for a tick first (S9-07): Obsidian's checkbox at the start of the bar,
 * and the confirm button locked until it is ticked. "Reset everything" is the
 * one that asks.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { App } from "obsidian";
import { ConfirmModal, type ConfirmKind } from "../src/utils/ConfirmModal";
import { en } from "../src/i18n/en";
import { fakeDom, type FakeElement } from "./support/fakeDom";
import { TestKeymap, TestScope } from "./support/fakeKeymap";

function open(acknowledgement?: string, kind?: ConfirmKind) {
	fakeDom.light();
	const app = { keymap: new TestKeymap(), scope: new TestScope() } as unknown as App;
	const modal = new ConfirmModal(app, "Title", "First.\nSecond.", "Go", undefined, kind, acknowledgement);
	const answer = modal.confirm();
	const bar = modal.buttonContainerEl as unknown as FakeElement;
	const button = (text: string): FakeElement => {
		const found = bar.querySelectorAll("button").find((b) => b.textContent === text);
		assert.ok(found, `a "${text}" button`);
		return found;
	};
	const contentEl = modal.contentEl as unknown as FakeElement;
	const containerEl = modal.containerEl as unknown as FakeElement;
	return {
		modal,
		answer,
		bar,
		contentEl,
		containerEl,
		confirm: button("Go"),
		cancel: button(en["confirm.cancel"] ?? "Cancel"),
	};
}

/** Let a button's press, which Obsidian awaits, run to its end. */
const settle = () => new Promise((resolve) => setImmediate(resolve));

describe("ConfirmModal — Obsidian's confirmation dialog", () => {
	it("asks with a paragraph per line, Cancel, then a red confirm that opens focused", () => {
		const h = open();
		try {
			assert.ok(h.containerEl.hasClass("mod-confirmation"), "Obsidian's confirmation dialog");
			assert.deepEqual(
				h.contentEl.querySelectorAll("p").map((p) => p.textContent),
				["First.", "Second."],
			);
			const buttons = h.bar.querySelectorAll("button");
			assert.deepEqual(
				buttons.map((b) => b.textContent),
				[en["confirm.cancel"], "Go"],
				"Cancel first, as Obsidian orders them",
			);
			assert.ok(h.cancel.hasClass("mod-cancel"));
			assert.ok(h.confirm.hasClass("mod-destructive"), "the red of a destructive yes");
			assert.equal(h.confirm.hasClass("mod-cta"), false, "the quiet red of Log out, not a solid one");
		} finally {
			h.modal.close();
		}
	});

	it("uses the accent for a yes that loses nothing", () => {
		const h = open(undefined, "cta");
		try {
			assert.ok(h.confirm.hasClass("mod-cta"));
			assert.equal(h.confirm.hasClass("mod-destructive"), false);
		} finally {
			h.modal.close();
		}
	});

	it("answers true for the confirm button, false for Cancel", async () => {
		const yes = open();
		yes.confirm.fire("click");
		assert.equal(await yes.answer, true);
		const no = open();
		no.cancel.fire("click");
		assert.equal(await no.answer, false);
	});
});

describe("ConfirmModal acknowledgement", () => {
	it("asks for no tick when none is wanted", () => {
		const h = open();
		try {
			assert.equal(h.bar.querySelector(".cs-confirm-acknowledge"), null);
			assert.notEqual(h.confirm.getAttribute("aria-disabled"), "true");
		} finally {
			h.modal.close();
		}
	});

	it("puts Obsidian's checkbox at the start of the button bar, reachable with Tab", () => {
		const h = open(en["confirm.acknowledge"]);
		try {
			const label = h.bar.querySelector(".cs-confirm-acknowledge");
			assert.ok(label, "the tick is drawn");
			assert.ok(label.hasClass("mod-checkbox"), "Obsidian's own checkbox label");
			assert.equal(h.bar.children[0], label, "before the buttons");
			assert.equal(label.textContent, en["confirm.acknowledge"]);
			assert.equal(label.querySelector("input")!.getAttribute("tabindex"), "0", "a required gate is a Tab stop");
			assert.equal(h.contentEl.querySelector(".cs-confirm-acknowledge"), null, "not in the message any more");
		} finally {
			h.modal.close();
		}
	});

	it("keeps the confirm button locked until the box is ticked", async () => {
		const h = open(en["confirm.acknowledge"]);
		const box = h.bar.querySelector(".cs-confirm-acknowledge input")!;
		assert.equal(h.confirm.getAttribute("aria-disabled"), "true");
		Object.assign(box, { checked: true });
		box.fire("change");
		assert.equal(h.confirm.getAttribute("aria-disabled"), "false");
		Object.assign(box, { checked: false });
		box.fire("change");
		assert.equal(h.confirm.getAttribute("aria-disabled"), "true");
		Object.assign(box, { checked: true });
		box.fire("change");
		h.confirm.fire("click");
		assert.equal(await h.answer, true);
	});

	it("is the same red locked and lit: only Obsidian's dim tells them apart", () => {
		const h = open(en["confirm.acknowledge"]);
		try {
			const box = h.bar.querySelector(".cs-confirm-acknowledge input")!;
			const classes = (): string => h.confirm.className;
			const locked = classes();
			assert.equal(h.confirm.getAttribute("aria-disabled"), "true");
			Object.assign(box, { checked: true });
			box.fire("change");
			assert.equal(h.confirm.getAttribute("aria-disabled"), "false");
			assert.equal(classes(), locked, "ticking the box changes no class, so no colour of ours");
			assert.ok(h.confirm.hasClass("mod-destructive"));
		} finally {
			h.modal.close();
		}
	});

	it("flashes the tick and stays open when the locked button is pressed", async () => {
		const h = open(en["confirm.acknowledge"]);
		try {
			h.confirm.fire("click");
			await settle();
			const label = h.bar.querySelector(".cs-confirm-acknowledge")!;
			assert.ok(label.hasClass("cs-nudge"), "the tick flashes");
			assert.ok(h.containerEl.parentElement, "the dialog is still open");
		} finally {
			h.modal.close();
		}
	});
});
