/**
 * tests/dragPlaceholderStyles.test.ts — the drop placeholder a drag draws
 * (ui/DragSortList.ts), as styles.css draws it.
 *
 * dragSortList.test.ts drives the placeholder on the fake DOM, which has no
 * cascade, so what it looks like is invisible there. Each rule here is one a
 * tidy-up would plausibly undo:
 *
 * - The box is laid out from the four properties DragSortList writes, against
 *   the list, which therefore has to be positioned.
 * - It is the row's shape — the row's corners — and the theme's neutral
 *   resting-border shade, rather than the accent highlight.
 * - It never takes a pointer that is meant for the rows under the drag.
 * - It fades in only where motion is allowed, and its entrance animates
 *   `scale`, never `transform`: the FLIP slide between slots owns that one.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { parseRules, valueOf, type CssRule } from "./support/cssInjectorHarness";

const rules = parseRules(readFileSync(join(process.cwd(), "styles.css"), "utf8"));

/** The one rule, outside any at-rule, whose selector is exactly `selector`. */
function only(selector: string, at: string[] = []): CssRule {
	const hits = rules.filter((r) => r.selector === selector && r.at.join("|") === at.join("|"));
	assert.equal(hits.length, 1, `expected one rule for ${selector}, found ${hits.length}`);
	return hits[0]!;
}

describe("the drop placeholder", () => {
	const box = only(".cs-drag-placeholder");

	it("is laid out from DragSortList's measurements, against the list", () => {
		assert.equal(valueOf(box, "position"), "absolute");
		for (const side of ["top", "left", "width", "height"]) {
			assert.match(valueOf(box, side) ?? "", new RegExp(`^var\\(--cs-drag-placeholder-${side},`));
		}
		assert.equal(valueOf(only(".cs-menu-customize-list"), "position"), "relative");
	});

	it("has the row's corners and the theme's neutral UI shade", () => {
		assert.equal(valueOf(box, "border-radius"), valueOf(only(".callout-studio-row"), "border-radius"));
		assert.equal(valueOf(box, "background"), "var(--background-modifier-border)");
	});

	it("never takes the pointer", () => {
		assert.equal(valueOf(box, "pointer-events"), "none");
	});

	it("fades in only where motion is allowed, scaling rather than transforming", () => {
		assert.equal(valueOf(box, "animation"), undefined);
		const entrance = only(".cs-drag-placeholder", ["@media (prefers-reduced-motion: no-preference)"]);
		const name = valueOf(entrance, "animation")?.split(" ")[0] ?? "";
		const frames = rules.filter((r) => r.at.includes(`@keyframes ${name}`));
		assert.ok(frames.length > 0, `@keyframes ${name} exists`);
		const animated = new Set(frames.flatMap((r) => r.props));
		assert.deepEqual([...animated].sort(), ["opacity", "scale"]);
	});
});
