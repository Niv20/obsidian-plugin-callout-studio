/**
 * tests/themeRowActions.test.ts — what a theme-owned row may show and do.
 *
 * Four separate promises, each of which has a quiet way of breaking:
 *
 * **The row must not offer to edit what it cannot change.** Under the absolute
 * rule the plugin emits nothing onto a theme-owned callout, so the full editor
 * there is a trap: a user changes colour, icon, name and ID, presses Save, and
 * sees nothing happen. The pencil opens the preview window instead, and every
 * route to the editor — settings, context menu, quick insert, the public API —
 * goes through `openCalloutEditorFor`, so the refusal has to live there rather
 * than in the row.
 *
 * **The menu must be true before the click, not only in the confirmation.**
 * *Delete* on a theme row deletes nothing: the theme keeps supplying the type.
 * The word is *Clear uses in your notes*.
 *
 * **The taking-over action is gone.** There is no adopting a theme callout any
 * more — while the theme names the id, the theme paints it — so the route out
 * is a new callout under a different ID.
 *
 * **The labels are gone and must stay gone.** The `Theme` / `Studio` pill was
 * removed because the group answers the same question; the last suite is what
 * stops it growing back one badge at a time. So were the two that survived it —
 * the *Default fallback* tag and the use count — because both described a
 * callout the user cannot act on, in the spot where the rows they *can* act on
 * put something actionable.
 */
import assert from "node:assert";
import { describe, it } from "node:test";
import { installFakeDom } from "./support/fakeDom";
import { pluginSourceFiles, readRepoFile } from "./support/sourceScan";
import { CalloutRegistry } from "../src/manager/CalloutRegistry";
import type { CalloutDefinition } from "../src/types";

installFakeDom();

function def(over: Partial<CalloutDefinition> = {}): CalloutDefinition {
	return {
		id: "recite",
		displayName: "Recite",
		icon: { type: "lucide", value: "star" },
		colorLight: "#336699",
		colorDark: "#88bbee",
		foldable: true,
		defaultFolded: false,
		builtIn: false,
		source: "theme",
		...over,
	};
}

/** A registry with one theme-minted row, as the sweep would leave it. */
function vaultWithThemeRow(over: Partial<CalloutDefinition> = {}) {
	const registry = new CalloutRegistry();
	registry.load(null);
	registry.add(def(over));
	return registry;
}

/** The slice of the settings context these surfaces actually touch. */
function fakeCtx(registry: CalloutRegistry, themeIds: string[]) {
	registry.setThemeOwnedIds(new Set(themeIds));
	let displayed = 0;
	const ctx = {
		app: {} as never,
		display: () => {
			displayed++;
		},
		registerDisposer: () => {},
		plugin: {
			app: {} as never,
			registry,
			settings: registry.settings,
			saveSettings: () => Promise.resolve(),
			refreshCallouts: () => {},
			refreshRenderModes: () => {},
			themeAppearance: {
				results: () => new Map(),
				ensure: () => Promise.resolve(),
				invalidate: () => {},
			},
			cssInjector: {
				themeCallouts: () => ({
					themeDefinedIds: () => new Set(themeIds),
					patternClaims: () => [],
				}),
			},
		},
	};
	return { ctx: ctx as never, displayed: () => displayed };
}

describe("a theme row is not editable", () => {
	it("renders a preview button and a ⋯, and no editor", async () => {
		const { renderCalloutRow } = await import(
			"../src/settings/sections/CalloutRowRenderer"
		);
		const registry = vaultWithThemeRow();
		const { ctx } = fakeCtx(registry, ["recite"]);
		const host = createDiv();

		renderCalloutRow(ctx, host, registry.get("recite")!, "theme", {
			onEdit: () => assert.fail("a theme row must not open the editor"),
			onOpenBuiltInMenu: () => assert.fail("wrong menu"),
			onOpenUserMenu: () => assert.fail("wrong menu"),
		});

		// Same two controls, same two places, as every other row in the tab —
		// the pencil just leads somewhere honest.
		assert.strictEqual(host.querySelectorAll(".callout-studio-more-btn").length, 1);
		assert.strictEqual(
			host.querySelectorAll(".callout-studio-row-buttons button").length,
			2,
		);
	});

	it("still gives a user row its pencil and its ⋯", async () => {
		const { renderCalloutRow } = await import(
			"../src/settings/sections/CalloutRowRenderer"
		);
		const registry = vaultWithThemeRow({ source: "user" });
		const { ctx } = fakeCtx(registry, []);
		const host = createDiv();
		let edited = false;
		renderCalloutRow(ctx, host, registry.get("recite")!, "user", {
			onEdit: () => {
				edited = true;
			},
			onOpenBuiltInMenu: () => {},
			onOpenUserMenu: () => {},
		});
		assert.strictEqual(host.querySelectorAll(".callout-studio-more-btn").length, 1);
		const buttons = host.querySelectorAll<HTMLElement>(
			".callout-studio-row-buttons button",
		);
		assert.strictEqual(buttons.length, 2);
		buttons[0]?.dispatchEvent({ type: "click" } as unknown as Event);
		assert.strictEqual(edited, true, "the pencil really opens the editor");
	});

	it("shows the theme's colours, never the ones stored on the row", async () => {
		// The row carries #336699. Nothing paints it while the theme owns the
		// id, so a swatch showing it would name a colour that is not on screen.
		const { renderCalloutRow } = await import(
			"../src/settings/sections/CalloutRowRenderer"
		);
		const registry = vaultWithThemeRow();
		registry.setThemeAppearances(
			new Map([
				[
					"recite",
					{
						accent: "rgb(1, 2, 3)",
						background: "rgb(4, 5, 6)",
						icon: { kind: "unknown" as const },
					},
				],
			]),
		);
		const { ctx } = fakeCtx(registry, ["recite"]);
		const host = createDiv();
		renderCalloutRow(ctx, host, registry.get("recite")!, "theme", {
			onEdit: () => {},
			onOpenBuiltInMenu: () => {},
			onOpenUserMenu: () => {},
		});
		const circles = host.querySelector<HTMLElement>(".cs-color-circles");
		assert.ok(circles, "two measured colours are worth showing");
		// The label spells both out, which is also what a screen reader gets.
		const label = circles.getAttribute("aria-label") ?? "";
		assert.ok(label.includes("rgb(1, 2, 3)"), label);
		assert.ok(label.includes("rgb(4, 5, 6)"), label);
		assert.ok(!label.includes("#336699"), "never the stored accent");
	});

	it("shows no swatch at all when the theme has not been measured", async () => {
		// Better an empty slot than a confident wrong colour.
		const { renderCalloutRow } = await import(
			"../src/settings/sections/CalloutRowRenderer"
		);
		const registry = vaultWithThemeRow();
		const { ctx } = fakeCtx(registry, ["recite"]);
		const host = createDiv();
		renderCalloutRow(ctx, host, registry.get("recite")!, "theme", {
			onEdit: () => {},
			onOpenBuiltInMenu: () => {},
			onOpenUserMenu: () => {},
		});
		assert.strictEqual(host.querySelector(".callout-studio-row-colors"), null);
	});
});

describe("the External CSS label", () => {
	it("marks a row the user handed to their own snippet", async () => {
		// The one label on any row, and the only state the list's structure
		// cannot express: a callout among the user's own that Callout Studio
		// has nonetheless stopped painting.
		const { renderCalloutRow } = await import(
			"../src/settings/sections/CalloutRowRenderer"
		);
		const registry = vaultWithThemeRow({ source: "user", externalStyle: true });
		const { ctx } = fakeCtx(registry, []);
		const host = createDiv();
		renderCalloutRow(ctx, host, registry.get("recite")!, "user", {
			onEdit: () => {},
			onOpenBuiltInMenu: () => {},
			onOpenUserMenu: () => {},
		});
		assert.strictEqual(host.querySelectorAll(".cs-external-tag").length, 1);
		// And no icon or swatches: there is no rendered element of ours to
		// measure, and the stored pair is not what the snippet draws.
		assert.strictEqual(host.querySelector(".callout-studio-row-colors"), null);
	});

	it("does not mark a theme row, whose section already says it", async () => {
		const { renderCalloutRow } = await import(
			"../src/settings/sections/CalloutRowRenderer"
		);
		const registry = vaultWithThemeRow();
		const { ctx } = fakeCtx(registry, ["recite"]);
		const host = createDiv();
		renderCalloutRow(ctx, host, registry.get("recite")!, "theme", {
			onEdit: () => {},
			onOpenBuiltInMenu: () => {},
			onOpenUserMenu: () => {},
		});
		assert.strictEqual(host.querySelectorAll(".cs-external-tag").length, 0);
	});
});

describe("taking a theme callout over is gone", () => {
	it("exports no adopt action any more", async () => {
		const mod = await import("../src/settings/sections/themeRowActions");
		assert.ok(
			!("adoptThemeCallout" in mod),
			"while the theme names the id, the theme paints it",
		);
	});

	it("leaves no source file calling one", () => {
		const offenders = pluginSourceFiles()
			.filter((f) => /adoptThemeCallout/.test(f.text))
			.map((f) => f.path);
		assert.deepStrictEqual(offenders, []);
	});
});

describe("deleting what cannot be deleted", () => {
	it("refuses to remove the row for a type the theme supplies", async () => {
		const { deleteRemovesRow } = await import(
			"../src/settings/sections/rowOwnership"
		);
		const registry = vaultWithThemeRow();
		const { ctx } = fakeCtx(registry, ["recite"]);
		assert.strictEqual(deleteRemovesRow(ctx, registry.get("recite")!), false);
	});

	it("refuses for a built-in, for the same reason", async () => {
		const { deleteRemovesRow } = await import(
			"../src/settings/sections/rowOwnership"
		);
		const registry = vaultWithThemeRow();
		const { ctx } = fakeCtx(registry, []);
		assert.strictEqual(deleteRemovesRow(ctx, registry.get("note")!), false);
	});

	it("allows it for a callout nothing else declares", async () => {
		const { deleteRemovesRow } = await import(
			"../src/settings/sections/rowOwnership"
		);
		const registry = vaultWithThemeRow({ id: "mine", source: "user" });
		const { ctx } = fakeCtx(registry, ["recite"]);
		assert.strictEqual(deleteRemovesRow(ctx, registry.get("mine")!), true);
	});

	it("never calls it Delete on a theme row", () => {
		// The precise-wording requirement, checkable: the theme row's menu says
		// *Clear uses in your notes*, because nothing is deleted — the theme
		// keeps supplying the type. `settings.deleteAction` is the word for the
		// rows where deleting is what happens.
		const source = readRepoFile("src/settings/sections/themeRowActions.ts");
		assert.ok(source.includes("settings.clearUsesAction"));
		assert.ok(!source.includes("settings.deleteAction"));
	});
});

describe("the Theme / Studio labels are gone", () => {
	/**
	 * Asserted by absence across the whole tree rather than on one rendered
	 * row, because that is how this particular thing comes back: not as the
	 * pill returning, but as a second badge appearing somewhere the first one
	 * was removed from. The group a callout sits in is the answer now, and a
	 * row that also spells it out is saying the same thing twice.
	 */
	it("no source file mentions the pill class or its strings", () => {
		const offenders = pluginSourceFiles()
			.filter((f) => /cs-style-pill|settings\.stylePill/.test(f.text))
			.map((f) => f.path);
		assert.deepStrictEqual(offenders, []);
	});

	it("no stylesheet rule is left behind for it", () => {
		assert.ok(!readRepoFile("styles.css").includes("cs-style-pill"));
	});

	it("no locale still carries the removed keys", () => {
		const offenders = pluginSourceFiles()
			.filter((f) => f.path.startsWith("src/i18n/"))
			.filter((f) =>
				/stylePill|styleOwnerStudioAction|styleOwnerThemeAction|themeCalloutsResetAction/.test(
					f.text,
				),
			)
			.map((f) => f.path);
		assert.deepStrictEqual(offenders, []);
	});
});

describe("a theme row carries nothing it cannot act on", () => {
	/**
	 * The row is the plainest in the tab on purpose: icon, name, the `[!id]`
	 * spellings, two measured swatches, two buttons. Everything removed here was
	 * removed for the same reason — it described the callout's *styling* or its
	 * *cost*, on a row whose styling is not the user's and whose cost is a
	 * question the `⋯` menu answers next to the two actions about it.
	 */
	const render = async (
		registry: CalloutRegistry,
		id: string,
		themeIds: string[],
	) => {
		const { renderCalloutRow } = await import(
			"../src/settings/sections/CalloutRowRenderer"
		);
		const { ctx } = fakeCtx(registry, themeIds);
		const host = createDiv();
		renderCalloutRow(ctx, host, registry.get(id)!, "theme", {
			onEdit: () => {},
			onOpenBuiltInMenu: () => {},
			onOpenUserMenu: () => {},
		});
		return host;
	};

	it("wears no Default fallback tag", async () => {
		const host = await render(vaultWithThemeRow(), "recite", ["recite"]);
		assert.strictEqual(host.querySelectorAll(".cs-fallback-tag").length, 0);
	});

	it("wears none even when it IS the configured fallback callout", async () => {
		const registry = vaultWithThemeRow();
		registry.settings.fallbackCalloutId = "recite";
		const host = await render(registry, "recite", ["recite"]);
		assert.strictEqual(host.querySelectorAll(".cs-fallback-tag").length, 0);
	});

	it("wears none on a discovered row the theme has temporarily taken over", async () => {
		// The case that made this more than tidying. A pre-existing fallback row
		// keeps `source: "fallback"` while it is theme-owned, so the second
		// branch of the tag fired and it sat under *Callouts from your theme*
		// labelled *Default fallback*.
		const registry = vaultWithThemeRow({ source: "fallback" });
		const host = await render(registry, "recite", ["recite"]);
		assert.strictEqual(host.querySelectorAll(".cs-fallback-tag").length, 0);
	});

	it("shows no use count", async () => {
		const host = await render(vaultWithThemeRow(), "recite", ["recite"]);
		assert.strictEqual(host.querySelectorAll(".cs-row-usage").length, 0);
	});

	it("has no rule left in the stylesheet for either", () => {
		// Both directions matter: `repoStyles` would catch an orphaned rule, but
		// only this says the class must not come back with a new rule beside it.
		const css = readRepoFile("styles.css");
		assert.ok(!css.includes(".cs-row-usage"));
	});
});

describe("the ⋯ menu on a theme row", () => {
	it("offers exactly the vault actions, and nothing that creates", () => {
		// *Create a new callout based on this* was here and is gone: creating a
		// callout is what the section below this one is for, and offering it
		// from a theme row implied the new one would inherit something.
		const src = readRepoFile("src/settings/sections/themeRowActions.ts");
		for (const key of ["settings.usageInfo", "settings.replaceAction", "settings.clearUsesAction"]) {
			assert.ok(src.includes(key), `the menu lost ${key}`);
		}
		assert.ok(!src.includes("deriveCalloutAction"));
		assert.ok(!src.includes("openDerivedCallout"));
		assert.ok(!src.includes("settings.deleteAction"), "never Delete here");
	});

	it("leaves no source file calling a derive action", () => {
		const callers = pluginSourceFiles().filter((f) =>
			f.code.includes("openDerivedCallout"),
		);
		assert.deepStrictEqual(callers.map((f) => f.path), []);
	});

	it("has no locale carrying the retired string", () => {
		const en = readRepoFile("src/i18n/en.ts");
		assert.ok(!en.includes("deriveCalloutAction"));
	});
});

describe("the theme preview window writes nothing", () => {
	/**
	 * It briefly offered an icon-position nudge for the Heading and Inline
	 * roles. Those two formats are gone for a theme callout, so the sliders had
	 * nothing left to move — and with them went the only thing in the plugin
	 * that could stamp `customized` on a theme row, which is what let that row
	 * be an ephemeral overlay at all.
	 */
	// Read through the scanner, which blanks comments and string bodies: the
	// window's own header explains at length what it *stopped* doing, and a raw
	// text search would find every one of those words in the prose.
	const src = (): string =>
		pluginSourceFiles().find(
			(f) => f.path === "src/settings/ThemeCalloutPreviewModal.ts",
		)?.code ?? assert.fail("the preview window is gone");

	it("has no icon-adjust control", () => {
		assert.ok(!src().includes("renderIconAdjustGroup"));
		assert.ok(!src().includes("iconAdjust"));
	});

	it("has no Create a new callout instead action", () => {
		assert.ok(!src().includes("createOwn"));
		// `CalloutEditorPlugin` is the host type and stays; what must not be
		// here is the editor itself.
		assert.ok(!src().includes("new CalloutEditor("));
	});

	it("never writes to the registry", () => {
		for (const call of ["registry.update", "saveSettings", "customized"]) {
			assert.ok(!src().includes(call), `the window still calls ${call}`);
		}
	});

	it("says Heading and Inline are unavailable", () => {
		// The key is a string literal, so this one reads the file as written.
		const raw = readRepoFile("src/settings/ThemeCalloutPreviewModal.ts");
		assert.ok(raw.includes("themePreview.blockOnly"));
		const en = readRepoFile("src/i18n/en.ts");
		assert.match(en, /Heading and Inline formats are unavailable/);
	});

	it("previews the Block callout alone", () => {
		// The old sample rendered all three roles in one editor; two of them
		// would now come out as literal text inside the preview.
		const raw = readRepoFile("src/settings/ThemeCalloutPreviewModal.ts");
		assert.ok(raw.includes("themePreview.blockSample"));
		assert.ok(!raw.includes("externalStyleSample"));
	});
});
