/**
 * A main button that cannot act is dimmed but stays pressable, and a press on
 * it says why — one notice at a time, however often it is pressed.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Notice } from "obsidian";
import { explainIfBlocked, paintBlocked } from "../src/ui/blockedButton";
import { asEl, el } from "./support/fakeDom";

const last = (): { message: string; hidden: boolean } | null => (Notice as unknown as { last: { message: string; hidden: boolean } | null }).last;

describe("a blocked button", () => {
	it("is dimmed for a reason and undimmed without one, never disabled", () => {
		const button = el();
		paintBlocked(asEl(button), "Choose something first.");
		assert.equal(button.getAttribute("aria-disabled"), "true");
		assert.equal(button.hasClass("cs-btn-disabled"), true);
		assert.notEqual((button as unknown as { disabled?: boolean }).disabled, true);
		paintBlocked(asEl(button), null);
		assert.equal(button.getAttribute("aria-disabled"), "false");
		assert.equal(button.hasClass("cs-btn-disabled"), false);
	});
	it("lets a press through when there is no reason", () => {
		const before = last();
		assert.equal(explainIfBlocked(null), false);
		assert.equal(last(), before, "nothing was said");
	});
	it("answers a press with the reason, and tells the handler to stop", () => {
		assert.equal(explainIfBlocked("Select an icon first."), true);
		assert.equal(last()?.message, "Select an icon first.");
	});
	it("replaces its own notice on the next press instead of stacking another", () => {
		explainIfBlocked("First reason.");
		const first = last();
		explainIfBlocked("Second reason.");
		assert.equal(first?.hidden, true);
		assert.notEqual(last(), first);
		assert.equal(last()?.message, "Second reason.");
	});
});
