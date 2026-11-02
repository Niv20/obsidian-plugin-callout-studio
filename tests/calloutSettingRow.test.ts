/**
 * tests/calloutSettingRow.test.ts — a callout in the settings lists is one of
 * Obsidian's own setting rows (finding S2-14,
 * src/settings/sections/CalloutRowRenderer.ts).
 *
 * What this pins:
 *
 * - **The shape.** `.setting-item.cs-callout-row`: the callout's icon first,
 *   the name (with its Default tag) as the setting's name, the `[!id]`
 *   spellings as its description, and the swatches, ✎ and ⋮ as its controls,
 *   the buttons made with `addExtraButton`. A real setting row is what
 *   Obsidian's arrow keys walk and its focus ring outlines.
 * - **One line, wherever it is.** The rows sit in Obsidian's list boxes
 *   (`.setting-group.mod-list`, checked by the page tests), which keep a row
 *   one line in a narrow tab and on a phone; styles.css leaves that to them.
 *   The ids stay one line too, cut between whole ids.
 * - **Two lines, each one line.** The name ends in "…" when it is too long,
 *   with its tag beside it (never pushed under it); the ids are whole ids, as
 *   many as fit, and a `+N` for the rest (idsLineFit.test.ts), except that a
 *   row with a single id shortens that one with "…".
 * - **Where the colour is shown, by device and not by width.** A computer
 *   shows the circles. A phone or an iPad (`.is-mobile`) shows none and paints
 *   the icon (a tile in the callout's background, drawn in its accent) and the
 *   name in the accent instead, using the row's `--cs-row-accent` and
 *   `--cs-row-bg`, which the draw sets and clears.
 *
 * The CSS is read as text, because the fake DOM these tests run in has no
 * cascade; the look itself was checked against Obsidian 1.14.4's app.css.
 */
import assert from "node:assert";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { installFakeDom } from "./support/fakeDom";
import { CalloutRegistry } from "../src/manager/CalloutRegistry";
import { Setting } from "obsidian";
import { drawCalloutRow } from "../src/settings/sections/CalloutRowRenderer";
import type { CalloutDefinition } from "../src/types";

installFakeDom();

/** A user's callout with two aliases. */
function def(over: Partial<CalloutDefinition> = {}): CalloutDefinition {
	return {
		id: "recite",
		displayName: "Recite",
		aliases: ["quote2", "cite2"],
		icon: { type: "emoji", value: "📌" },
		colorLight: "#336699",
		colorDark: "#88bbee",
		foldable: true,
		defaultFolded: false,
		builtIn: false,
		source: "user",
		...over,
	};
}

/** The slice of the settings context a row touches. */
function fakeCtx(registry: CalloutRegistry) {
	return {
		app: {},
		redraw: () => {},
		registerDisposer: () => {},
		plugin: { app: {}, registry, settings: registry.settings },
	} as never;
}

/**
 * Draw one row of `kind` for `rowDef` into a fresh host, and return the host.
 * `asFallback` makes the callout the vault's default fallback first.
 */
function drawRow(rowDef: CalloutDefinition, kind: "user" | "builtin" | "theme" = "user", edits: string[] = [], asFallback = false) {
	const registry = new CalloutRegistry();
	registry.load(null);
	registry.add(rowDef);
	if (asFallback) registry.settings.fallbackCalloutId = rowDef.id;
	const host = createDiv();
	drawCalloutRow(fakeCtx(registry), new Setting(host), registry.get(rowDef.id) ?? rowDef, kind, {
		onEdit: (edited) => edits.push(edited.id),
		onOpenBuiltInMenu: () => {},
		onOpenUserMenu: () => {},
	});
	return { host, registry };
}

describe("a callout row is an Obsidian setting row", () => {
	it("puts the icon first, then the name, the ids and the controls", () => {
		const edits: string[] = [];
		const { host } = drawRow(def(), "user", edits);
		const row = host.querySelector(".setting-item.cs-callout-row");
		assert.ok(row, "one Obsidian setting row");
		const parts = Array.from(row.children, (child) => child.className);
		assert.deepStrictEqual(parts, ["callout-studio-row-icon", "setting-item-info", "setting-item-control"]);
		assert.strictEqual(row.querySelector(".callout-studio-row-icon")?.textContent, "📌");
		assert.strictEqual(row.querySelector(".setting-item-name")?.textContent, "Recite");
		// The words are a span of their own: only a box can end in "…".
		assert.strictEqual(row.querySelector(".setting-item-name .cs-row-name")?.textContent, "Recite");

		// The spellings, sorted, one code chip each, with a space between them, and
		// the `+N` chip after them (out of sight until an id does not fit).
		const desc = row.querySelector(".setting-item-description");
		const codes = Array.from(desc?.querySelectorAll("code.callout-studio-row-syntax") ?? []);
		assert.deepStrictEqual(
			codes.filter((code) => !code.classList.contains("callout-studio-row-more")).map((code) => code.textContent),
			["[!cite2]", "[!quote2]", "[!recite]"],
		);
		assert.ok(codes[3]?.classList.contains("callout-studio-row-more") && codes[3].classList.contains("cs-id-cut"));
		assert.strictEqual(desc?.textContent?.startsWith("[!cite2] [!quote2] [!recite]"), true);

		// Swatches, then ✎ and ⋮ as Obsidian icon buttons.
		const control = row.querySelector(".setting-item-control");
		assert.ok(control?.firstElementChild?.classList.contains("callout-studio-row-colors"));
		const buttons = control?.querySelectorAll(".clickable-icon") ?? [];
		assert.strictEqual(buttons.length, 2);
		assert.ok(buttons[1]?.classList.contains("callout-studio-more-btn"));
		buttons[0]?.dispatchEvent({ type: "click" } as unknown as Event);
		assert.deepStrictEqual(edits, ["recite"], "✎ opens the editor");
	});

	it("tags the fallback after its name, as Obsidian tags a setting", () => {
		const { host } = drawRow(def(), "user", [], true);
		const tag = host.querySelector(".setting-item-name .flair.mod-flat.cs-fallback-tag");
		assert.ok(tag, "Obsidian's flat flair, inside the name");
		assert.ok(tag.textContent);
	});

	it("tags nothing on a theme's row, whose look the plugin does not decide", () => {
		const { host } = drawRow(def({ source: "fallback", customized: false }), "theme");
		assert.strictEqual(host.querySelector(".cs-fallback-tag"), null);
		assert.strictEqual(host.querySelectorAll(".setting-item-control .clickable-icon").length, 2, "👁 and ⋮");
	});
});

describe("a callout row hands its colours to the style sheet", () => {
	/** The row's own value of a CSS variable. */
	const variable = (host: HTMLElement, name: string): string =>
		host.querySelector<HTMLElement>(".setting-item.cs-callout-row")?.style.getPropertyValue(name) ?? "";

	it("sets the accent and the background the circles show, for the icon and name of a phone's row", () => {
		const { host } = drawRow(def({ bgColorLight: "#dde8f4", bgColorDark: "#dde8f4" }));
		const circles = host.querySelector(".callout-studio-row-colors");
		assert.ok(circles, "the circles are there for a row that has room");
		// Both modes carry the same background here, so the test does not depend on the page's theme.
		assert.strictEqual(variable(host, "--cs-row-bg"), "#dde8f4");
		const accent = variable(host, "--cs-row-accent");
		assert.ok(accent === "#336699" || accent === "#88bbee", "the accent of the current mode");
	});

	it("sets no background for a callout that paints none, and keeps the accent", () => {
		const { host } = drawRow(def({ transparentBg: true }));
		assert.ok(variable(host, "--cs-row-accent"));
		assert.strictEqual(variable(host, "--cs-row-bg"), "", "no tile for a callout with no background");
	});

	it("clears what the last draw set, when the same row is drawn again without colours", () => {
		const registry = new CalloutRegistry();
		registry.load(null);
		const theme = def({ id: "themed", source: "theme", builtIn: false });
		registry.add(theme);
		const host = createDiv();
		const setting = new Setting(host);
		const ctx = fakeCtx(registry);
		const handlers = { onEdit: () => {}, onOpenBuiltInMenu: () => {}, onOpenUserMenu: () => {} };
		const rowEl = setting.settingEl;

		drawCalloutRow(ctx, setting, theme, "user", handlers);
		assert.ok(rowEl.style.getPropertyValue("--cs-row-accent"), "drawn as the user's own: its stored colours");

		// The same element is drawn again as a theme row the theme has not measured:
		// no colours to show, so none may stay from the draw before. (Obsidian
		// empties a row's parts itself before it draws it again.)
		setting.controlEl.empty();
		setting.nameEl.empty();
		setting.descEl.empty();
		drawCalloutRow(ctx, setting, theme, "theme", handlers);
		assert.strictEqual(rowEl.style.getPropertyValue("--cs-row-accent"), "");
		assert.strictEqual(rowEl.style.getPropertyValue("--cs-row-bg"), "");
		assert.strictEqual(rowEl.querySelector(".callout-studio-row-colors"), null);
	});
});

describe("a callout row stays two lines", () => {
	const css = readFileSync(join(process.cwd(), "styles.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");

	/** The declarations of the rule whose selector is exactly `selector`. */
	const ruleBody = (selector: string): string => {
		const at = css.indexOf(`${selector} {`);
		assert.ok(at >= 0, `no rule for ${selector}`);
		return css.slice(at, css.indexOf("}", at));
	};

	it("leaves the row's layout to Obsidian's list box, and is no size container", () => {
		// Copies of `.mod-list`'s rules would only drift from Obsidian's.
		const body = ruleBody(".setting-item.cs-callout-row");
		assert.doesNotMatch(body, /flex-direction|align-items|padding/);
		assert.ok(!css.includes(".is-phone .modal .setting-item.cs-callout-row"));
		// A row that is a size container meets Obsidian's unnamed container queries
		// (docs/internals-docs/23-common-pitfalls.md). Nothing measures this one's
		// width any more: the colour is shown by device, not by how wide the row is.
		assert.doesNotMatch(body, /container-type/);
		assert.ok(!css.includes("@container (max-width: 280px)"), "the old narrow-row rule is gone");
	});

	it("keeps 16px between the icon, the text and the buttons on every device", () => {
		// Obsidian's phone rows have this gap and a computer's none, so an id ran
		// right up to the circles there. Its margin after a row's first child
		// would double the icon's share on a phone.
		assert.match(ruleBody(".setting-item.cs-callout-row"), /\bgap: var\(--size-4-3\) var\(--size-4-4\)/);
		assert.match(ruleBody(".setting-item.cs-callout-row > .callout-studio-row-icon"), /margin-inline-end: 0/);
	});

	it("keeps the name one line, ending in an ellipsis, with its tag beside it", () => {
		// A flex row, not a wrapping one: the tag never drops under the name.
		const row = ruleBody(".setting-item.cs-callout-row .setting-item-name");
		assert.match(row, /display: flex/);
		assert.match(row, /align-items: baseline/);
		assert.match(row, /\bgap: /);
		assert.doesNotMatch(row, /flex-wrap|overflow-wrap/);
		// The name's own box is what ends in "…", taking the room the tag leaves.
		const words = ruleBody(".cs-callout-row .cs-row-name");
		assert.match(words, /min-width: 0/, "a flex item otherwise refuses to go below its text");
		assert.match(words, /overflow: hidden/);
		assert.match(words, /text-overflow: ellipsis/);
		assert.match(words, /white-space: nowrap/);
		// A Hebrew name in an English window is cut at its own end.
		assert.match(words, /unicode-bidi: plaintext/);
	});

	it("sets the tag at its own width, flush with the name, a hair raised", () => {
		const body = ruleBody(".setting-item.cs-callout-row .cs-fallback-tag");
		assert.match(body, /flex: none/, "the name is what gives way, never the tag");
		// Obsidian's `.flair` margin is the row's gap now.
		assert.match(body, /margin-inline-start: 0/);
		assert.match(body, /top: -1px/);
		// 1px, not 2: as tall as an inline tag looks, so a flex item does not make its line taller than the name.
		assert.match(body, /padding-block: 1px/);
	});

	it("keeps the ids one line, in a flex row that draws no whitespace of its own", () => {
		const body = ruleBody(".setting-item.cs-callout-row .setting-item-description");
		assert.match(body, /white-space: nowrap/);
		assert.match(body, /display: flex/);
		assert.match(body, /\bgap: /, "stands where the space between two ids was");
		assert.match(ruleBody(".cs-callout-row .callout-studio-row-syntax"), /display: inline-block/);
		// Every id keeps its natural width, so the line is measured at it.
		assert.match(ruleBody(".cs-callout-row .callout-studio-row-syntax"), /flex: none/);
		// The line is the containing block of the ids that are out of it, so it clips them.
		assert.match(body, /position: relative/);
		// An id the line had no room for goes out of the flow and out of sight, but
		// keeps a box, so its width can still be read; the extra class is what
		// outweighs the rule above.
		const cut = ruleBody(".cs-callout-row .callout-studio-row-syntax.cs-id-cut");
		assert.match(cut, /position: absolute/);
		assert.match(cut, /visibility: hidden/);
		assert.doesNotMatch(cut, /display: none/, "no box, no width to read");
	});

	it("shortens an id only when it is the row's only one", () => {
		const body = ruleBody(".cs-callout-row .callout-studio-row-syntax.cs-id-lone");
		assert.match(body, /flex: 0 1 auto/);
		assert.match(body, /min-width: 0/, "a flex item otherwise refuses to go below its text");
		assert.match(body, /overflow: hidden/);
		assert.match(body, /text-overflow: ellipsis/);
		// With two or more ids nothing is ever cut in half: they are shown whole or
		// counted, and the class is set only on a lone id (idsLineFit.ts), not
		// picked out by a selector that could reach an id with others beside it.
		assert.ok(!css.includes(":only-child"));
		assert.ok(!css.includes("cs-id-clip"), "the class this rule had");
	});

	it("draws the +N with the ids' own look, only keeping it out of a selection", () => {
		// It shares `callout-studio-row-syntax`, so the fill, the monospace and the
		// corners are the ids'; a copy of them here would drift from the ids.
		const body = ruleBody(".cs-callout-row .callout-studio-row-more");
		assert.match(body, /user-select: none/);
		assert.doesNotMatch(body, /background|padding|font|border-radius|color/);
	});

	it("gives the ids line all the room the buttons leave", () => {
		// Obsidian sizes both `flex: 1 1 auto`, which makes the text as wide as its
		// content plus half the spare room: hiding an id would resize the line that
		// was just measured. The ids fit by their width, so it must not depend on them.
		assert.match(ruleBody(".setting-item.cs-callout-row .setting-item-info"), /flex: 1 1 0;/);
		assert.match(ruleBody(".setting-item.cs-callout-row .setting-item-control"), /flex: 0 1 auto;/);
	});

	it("moves the colour into the row on a phone or an iPad, at any width, and nowhere else", () => {
		// The circles are gone, whatever the row's width.
		assert.match(ruleBody(".is-mobile .cs-callout-row .callout-studio-row-colors"), /display: none/);
		// The icon is drawn in the accent on a tile of the background, unless it failed to load.
		const icon = ruleBody(".is-mobile .cs-callout-row .callout-studio-row-icon:not(.is-error)");
		assert.match(icon, /color: var\(--cs-row-accent\)/);
		assert.match(icon, /background-color: var\(--cs-row-bg\)/);
		// The name is in the accent, as a callout's title is in a note.
		assert.match(ruleBody(".is-mobile .cs-callout-row .cs-row-name"), /color: var\(--cs-row-accent\)/);
		// Nothing else hides the circles, as the 450px rule once did, and nothing
		// else paints the name: a computer's rows keep their circles and their text colour.
		const hiding = css.match(/\.callout-studio-row-colors\s*\{[^}]*display:\s*none/g) ?? [];
		assert.strictEqual(hiding.length, 1, "one rule hides the circles");
		assert.ok(!css.includes("max-width: 450px"));
	});

	it("lets Obsidian turn ⋮ on its side on macOS", () => {
		// The iPad paint workaround has no weight of its own, so Obsidian's
		// `.mod-macos .lucide-more-vertical { transform: rotate(90deg) }` wins.
		assert.match(ruleBody(":where(.cs-callout-row .setting-item-control .clickable-icon) svg"), /translateZ\(0\)/);
		assert.ok(!css.includes(".cs-callout-row .setting-item-control .clickable-icon svg"));
	});
});
