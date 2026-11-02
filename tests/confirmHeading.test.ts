/**
 * tests/confirmHeading.test.ts — a confirmation's two-line heading
 * (utils/ConfirmModal.ts, `withMascot(subtitle)`, and the heading rules in styles.css).
 *
 * The title, and under it the subtitle; the brush mascot beside both, except on a
 * phone; the message below, at the window's full width. How that looks is CSS, so
 * what the suite holds is what the CSS relies on: the order of the heading's
 * children, its two classes, that a window never lays itself out by the length of
 * its message, and that everything is let go again when the window closes.
 */
import { fakeDom, type FakeElement } from "./support/fakeDom";
import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { Platform, type App } from "obsidian";
import { ConfirmModal } from "../src/utils/ConfirmModal";
import { TestKeymap, TestScope } from "./support/fakeKeymap";

const globals = globalThis as Record<string, unknown>;

const app = (): App => ({ keymap: new TestKeymap(), scope: new TestScope() }) as unknown as App;

/** A question; with the mascot and this subtitle unless `subtitle` is null. */
function open(subtitle: string | null, acknowledgement?: string): ConfirmModal {
	const modal = new ConfirmModal(
		app(),
		"Delete palette",
		"Callouts that use its colors are not affected.",
		undefined,
		undefined,
		undefined,
		acknowledgement,
	);
	if (subtitle !== null) modal.withMascot(subtitle);
	void modal.confirm();
	return modal;
}

const headerOf = (modal: ConfirmModal): FakeElement => modal.titleEl.parentElement as unknown as FakeElement;
const windowOf = (modal: ConfirmModal): FakeElement => modal.modalEl as unknown as FakeElement;
const names = (element: FakeElement): string[] => element.children.map((child) => child.className.split(" ")[0] ?? "");

describe("a confirmation's heading", () => {
	beforeEach(() => {
		fakeDom.light();
		const createEl = globals.createEl as (tag: string, options?: unknown) => FakeElement;
		globals.createSvg = (tag: string, options?: unknown) => createEl(tag, options);
	});
	afterEach(() => {
		delete globals.createSvg;
	});

	it("puts the mascot first, then the title, then the subtitle", () => {
		const modal = open("“Sunset”");
		const header = headerOf(modal);
		assert.deepEqual(names(header), ["cs-mascot-box", "modal-title", "cs-confirm-subtitle"]);
		assert.ok(header.hasClass("cs-confirm-heading"));
		assert.ok(header.hasClass("cs-mascot-header"));
		modal.close();
	});

	it("shows the subtitle exactly as given, so the quotes are the translation's", () => {
		for (const subtitle of ["“Sunset”", "„Sunset“", "「Sunset」", "An exact copy is saved first"]) {
			const modal = open(subtitle);
			assert.equal(headerOf(modal).querySelector(".cs-confirm-subtitle")?.textContent, subtitle);
			modal.close();
		}
	});

	it("keeps the two lines where the mascot cannot be drawn", () => {
		delete globals.createSvg;
		const modal = open("“Sunset”");
		const header = headerOf(modal);
		assert.deepEqual(names(header), ["modal-title", "cs-confirm-subtitle"]);
		assert.ok(header.hasClass("cs-confirm-heading"));
		assert.equal(header.hasClass("cs-mascot-header"), false, "no brush, so no column for it");
		modal.close();
	});

	it("has no mascot on a phone, and the two lines stay", () => {
		const wasPhone = Platform.isPhone;
		Platform.isPhone = true;
		try {
			const modal = open("“Sunset”");
			const header = headerOf(modal);
			assert.deepEqual(names(header), ["modal-title", "cs-confirm-subtitle"]);
			assert.ok(header.hasClass("cs-confirm-heading"));
			assert.equal(header.hasClass("cs-mascot-header"), false);
			modal.close();
		} finally {
			Platform.isPhone = wasPhone;
		}
	});

	it("is the same heading in the window that scrolls its body", () => {
		const modal = open("Take a moment to appreciate what you've built", "I have read and understood");
		assert.ok(windowOf(modal).hasClass("mod-scrollable-content"), "Reset everything scrolls");
		assert.deepEqual(names(headerOf(modal)), ["cs-mascot-box", "modal-title", "cs-confirm-subtitle"]);
		modal.close();
	});

	it("is laid out the same whatever the message says, with no class that depends on its length", () => {
		for (const body of ["One.", "One.\nTwo.\nThree.\nFour.\nFive.\nSix.\nSeven."]) {
			const modal = new ConfirmModal(app(), "Delete palette", body).withMascot("“Sunset”");
			void modal.confirm();
			assert.equal(windowOf(modal).hasClass("cs-mascot-beside"), false);
			assert.equal(windowOf(modal).hasClass("cs-mascot-modal"), false);
			assert.deepEqual(names(headerOf(modal)), ["cs-mascot-box", "modal-title", "cs-confirm-subtitle"]);
			modal.close();
		}
	});

	it("lets go of the subtitle, the mascot and the classes when it closes", () => {
		const modal = open("“Sunset”");
		const header = headerOf(modal);
		modal.close();
		assert.deepEqual(names(header), ["modal-title"]);
		assert.equal(header.hasClass("cs-confirm-heading"), false);
		assert.equal(header.hasClass("cs-mascot-header"), false);
	});

	it("leaves a question without the mascot as it was", () => {
		const modal = open(null);
		const header = headerOf(modal);
		assert.deepEqual(names(header), ["modal-title"], "the title alone");
		assert.equal(header.hasClass("cs-confirm-heading"), false);
		modal.close();
	});
});
