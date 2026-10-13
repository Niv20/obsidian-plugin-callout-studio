/**
 * tests/restoreCoreIcon.test.ts - writing an icon slot only when it differs.
 *
 * `paintIcons` runs on every inject, which is every `css-change`, and for each
 * theme-owned or unknown callout it used to empty the slot and refill it. The
 * read of the next callout's `--callout-icon` then forced a style recalculation
 * of the page - 1.5 ms apiece under Serenity, 66 ms per event for thirty
 * callouts. The slot is read first now and left alone when it already holds
 * what `setIcon` would put there; the DOM that results is the same either way,
 * which is the whole of what is pinned here.
 */
import assert from "node:assert";
import { afterEach, describe, it } from "node:test";
import { installFakeDom } from "./support/fakeDom";
import {
	CSS_FALLBACK_ICON_HIDDEN,
	restoreCoreIcon,
	slotAlreadyShows,
} from "../src/manager/css/fallbackIcon";

installFakeDom();

interface IconSeams {
	__CS_ICONS__?: Record<string, { outerHTML: string }>;
}
const seams = globalThis as unknown as IconSeams;

afterEach(() => {
	delete seams.__CS_ICONS__;
});

const svg = (name: string) => `<svg class="svg-icon ${name}"></svg>`;

/**
 * A callout whose core icon is `value`, read off the attribute core stamps. A
 * slot child is any element: it is the markup, not the tag, that is compared.
 */
function callout(value: string, slotChildren: string[] = []) {
	const calloutEl = document.body.createDiv({ cls: "callout" });
	calloutEl.setAttribute("data-callout-icon", value);
	const iconEl = calloutEl.createDiv({ cls: "callout-icon" });
	for (const cls of slotChildren) iconEl.createSpan({ cls });
	return { calloutEl, iconEl };
}

describe("what already shows", () => {
	const holding = (...outer: string[]) => ({
		childNodes: { length: outer.length },
		firstElementChild: outer[0] === undefined ? null : { outerHTML: outer[0] },
	});

	it("is true for one child whose markup is the wanted drawing", () => {
		assert.strictEqual(slotAlreadyShows(holding(svg("lucide-pencil")), { outerHTML: svg("lucide-pencil") }), true);
	});

	it("is false for another drawing, an empty slot, or two children", () => {
		assert.strictEqual(slotAlreadyShows(holding(svg("lucide-flame")), { outerHTML: svg("lucide-pencil") }), false);
		assert.strictEqual(slotAlreadyShows(holding(), { outerHTML: svg("lucide-pencil") }), false);
		assert.strictEqual(
			slotAlreadyShows(holding(svg("lucide-pencil"), svg("lucide-pencil")), { outerHTML: svg("lucide-pencil") }),
			false,
		);
	});

	it("is false when Obsidian has no drawing for the id", () => {
		assert.strictEqual(slotAlreadyShows(holding(svg("lucide-pencil")), null), false);
	});
});

describe("restoring core's icon", () => {
	it("leaves a slot that already holds the drawing untouched", () => {
		const { calloutEl, iconEl } = callout("lucide-pencil");
		const drawn = iconEl.createSpan({ cls: "svg-icon lucide-pencil" });
		seams.__CS_ICONS__ = { "lucide-pencil": { outerHTML: drawn.outerHTML } };

		restoreCoreIcon(calloutEl, iconEl);

		assert.strictEqual(iconEl.firstElementChild, drawn, "the same node, not a rebuilt copy");
		assert.strictEqual(iconEl.childNodes.length, 1);
	});

	it("still lifts the hidden marker off a slot it leaves alone", () => {
		const { calloutEl, iconEl } = callout("lucide-pencil");
		const drawn = iconEl.createSpan({ cls: "svg-icon lucide-pencil" });
		iconEl.addClass(CSS_FALLBACK_ICON_HIDDEN);
		seams.__CS_ICONS__ = { "lucide-pencil": { outerHTML: drawn.outerHTML } };

		restoreCoreIcon(calloutEl, iconEl);

		assert.ok(!iconEl.classList.contains(CSS_FALLBACK_ICON_HIDDEN));
		assert.strictEqual(iconEl.firstElementChild, drawn);
	});

	it("replaces a slot that holds something else", () => {
		const { calloutEl, iconEl } = callout("lucide-pencil", ["svg-icon cs-export-icon"]);
		seams.__CS_ICONS__ = { "lucide-pencil": { outerHTML: svg("lucide-pencil") } };

		restoreCoreIcon(calloutEl, iconEl);

		// The test double of setIcon draws nothing, so what is left is the
		// emptied slot: the old content is gone, which is the point.
		assert.strictEqual(iconEl.childNodes.length, 0);
	});

	it("falls through to the full restore for an id Obsidian cannot draw", () => {
		const { calloutEl, iconEl } = callout("not-a-real-icon", ["svg-icon lucide-pencil"]);
		restoreCoreIcon(calloutEl, iconEl);
		assert.strictEqual(iconEl.childNodes.length, 0, "emptied, as before");
	});

	it("empties the slot when core names no icon at all", () => {
		const { calloutEl, iconEl } = callout("", ["svg-icon lucide-pencil"]);
		restoreCoreIcon(calloutEl, iconEl);
		assert.strictEqual(iconEl.childNodes.length, 0);
	});
});
