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

		// The spellings, sorted, one code chip each, with a space between them.
		const desc = row.querySelector(".setting-item-description");
		assert.deepStrictEqual(
			Array.from(desc?.querySelectorAll("code.callout-studio-row-syntax") ?? [], (code) => code.textContent),
			["[!cite2]", "[!quote2]", "[!recite]"],
		);
		assert.strictEqual(desc?.textContent, "[!cite2] [!quote2] [!recite]");

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

describe("a callout row stays one line", () => {
	const css = readFileSync(join(process.cwd(), "styles.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");

	/** The declarations of the rule whose selector is exactly `selector`. */
	const ruleBody = (selector: string): string => {
		const at = css.indexOf(`${selector} {`);
		assert.ok(at >= 0, `no rule for ${selector}`);
		return css.slice(at, css.indexOf("}", at));
	};

	it("leaves the row's layout to Obsidian's list box", () => {
		// Copies of `.mod-list`'s rules would only drift from Obsidian's.
		const body = ruleBody(".setting-item.cs-callout-row");
		assert.doesNotMatch(body, /flex-direction|align-items|padding/);
		assert.ok(!css.includes(".is-phone .modal .setting-item.cs-callout-row"));
		// The row is still the size container that hides its colour dots when narrow.
		assert.match(body, /container-type: inline-size/);
	});

	it("keeps the ids one line, cut between whole ids", () => {
		assert.match(ruleBody(".setting-item.cs-callout-row .setting-item-description"), /white-space: nowrap/);
		assert.match(ruleBody(".cs-callout-row .callout-studio-row-syntax"), /display: inline-block/);
	});

	it("lets Obsidian turn ⋮ on its side on macOS", () => {
		// The iPad paint workaround has no weight of its own, so Obsidian's
		// `.mod-macos .lucide-more-vertical { transform: rotate(90deg) }` wins.
		assert.match(ruleBody(":where(.cs-callout-row .setting-item-control .clickable-icon) svg"), /translateZ\(0\)/);
		assert.ok(!css.includes(".cs-callout-row .setting-item-control .clickable-icon svg"));
	});
});
