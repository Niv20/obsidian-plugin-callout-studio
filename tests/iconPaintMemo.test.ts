/**
 * tests/iconPaintMemo.test.ts — the icon sweep leaves a slot that already
 * shows its icon.
 *
 * `CSSInjector.paintIcons` runs after every stylesheet pass, over every
 * callout and token in every open window, and used to replace each icon with
 * an identical copy: a DOM write per callout on screen per pass. Now a slot
 * painted with the same key whose painted node is still in place is left
 * alone (`icons/iconPaintMemo.ts`). What is pinned here is both halves: the
 * write that no longer happens, and every case that must still repaint — a
 * new icon, the other mode's colour, a slot somebody else rewrote, an id that
 * stopped being ours.
 *
 * An emoji icon, because it is the one the fake DOM draws for real: its glyph
 * lands in a node a case can hold on to.
 */
import assert from "node:assert";
import { describe, it } from "node:test";
// Listed first: importing it installs the DOM globals before anything under
// test loads (see tests/support/fakeDom.ts).
import { asEl, el } from "./support/fakeDom";
import { definition, harness } from "./support/cssInjectorHarness";
import { CSS_INLINE_TOKEN, CSS_TOKEN_ICON } from "../src/editor/renderShared";

const CACTUS = { type: "emoji" as const, value: "🌵" };
const STAR = { type: "emoji" as const, value: "⭐" };

/** A block callout of `id` with an empty icon slot, and that slot. */
function blockCallout(id: string) {
	const callout = el({ cls: "callout", attrs: { "data-callout": id } });
	const icon = callout.createDiv({ cls: "callout-title" }).createDiv({ cls: "callout-icon" });
	return { callout, icon };
}

function withMine() {
	const h = harness();
	h.registry.add(definition({ id: "mine", icon: CACTUS }));
	return h;
}

describe("the icon sweep and a block callout's icon", () => {
	it("leaves a slot that already shows the icon", () => {
		const h = withMine();
		const { callout, icon } = blockCallout("mine");

		h.injector.paintIcons(asEl(callout));
		const first = icon.firstChild;
		assert.ok(first, "the first sweep paints it");
		h.injector.paintIcons(asEl(callout));

		assert.strictEqual(icon.firstChild, first, "the second sweep wrote nothing");
		assert.strictEqual(icon.textContent, CACTUS.value);
	});

	it("repaints it when the icon changed", () => {
		const h = withMine();
		const { callout, icon } = blockCallout("mine");
		h.injector.paintIcons(asEl(callout));

		h.registry.update("mine", { icon: STAR });
		h.injector.paintIcons(asEl(callout));

		assert.strictEqual(icon.textContent, STAR.value);
	});

	it("repaints it when the colour it bakes for print changed", () => {
		const h = withMine();
		const { callout, icon } = blockCallout("mine");
		h.injector.paintIcons(asEl(callout));
		const first = icon.firstChild;

		h.registry.update("mine", { colorLight: "#aa0000", colorDark: "#aa0000" });
		h.injector.paintIcons(asEl(callout));

		assert.notStrictEqual(icon.firstChild, first);
	});

	it("repaints a slot somebody else rewrote", () => {
		const h = withMine();
		const { callout, icon } = blockCallout("mine");
		h.injector.paintIcons(asEl(callout));

		icon.empty();
		icon.createSpan({ text: "core's own" });
		h.injector.paintIcons(asEl(callout));

		assert.strictEqual(icon.textContent, CACTUS.value);
	});

	it("paints again after the slot was handed to someone else", () => {
		// An id that stops being ours (here: the theme claims it) is restored
		// to core's icon, and the memo forgets the slot, so taking it back
		// paints it whatever the slot happens to hold.
		const h = withMine();
		const { callout, icon } = blockCallout("mine");
		h.injector.paintIcons(asEl(callout));

		h.registry.setThemeOwnedIds(new Set(["mine"]));
		h.injector.paintIcons(asEl(callout));
		h.registry.setThemeOwnedIds(new Set());
		h.injector.paintIcons(asEl(callout));

		assert.strictEqual(icon.textContent, CACTUS.value);
	});
});

describe("the icon sweep and a token's icon", () => {
	it("leaves a token that already shows the icon, and repaints a changed one", () => {
		const h = withMine();
		const token = el({ cls: CSS_INLINE_TOKEN, attrs: { "data-callout": "mine" } });
		const icon = token.createSpan({ cls: CSS_TOKEN_ICON });

		const host = el({ cls: "host" });
		host.appendChild(token);
		h.injector.paintIcons(asEl(host));
		const first = icon.firstChild;
		assert.ok(first);
		h.injector.paintIcons(asEl(host));
		assert.strictEqual(icon.firstChild, first, "the second sweep wrote nothing");

		h.registry.update("mine", { icon: STAR });
		h.injector.paintIcons(asEl(host));
		assert.strictEqual(icon.textContent, STAR.value);
	});
});
