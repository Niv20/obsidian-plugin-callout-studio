/**
 * tests/calloutListsSectionCounts.test.ts — the "(N)" suffix on each of the
 * three list headings.
 *
 * Each heading names how many rows its own section is currently showing —
 * "Callouts from your theme (N)", "My callout types (N)", "Built-in
 * callouts (N)" — and has to stay right as rows are added, removed, or moved
 * between sections (a theme claiming or releasing a built-in). `refresh()` is
 * the only path a live settings tab repaints through — `registry.onChange`
 * and `css-change` both reach it — so that is what every case here drives.
 */
import assert from "node:assert";
import { describe, it } from "node:test";
import type { App } from "obsidian";
import { CalloutRegistry } from "../src/manager/CalloutRegistry";
import { createCalloutListsController } from "../src/settings/sections/CalloutListsSection";
import { installFakeDom } from "./support/fakeDom";

installFakeDom();

type Registry = CalloutRegistry;

function themeApp(themeIds: string[]) {
	const customCss = {
		theme: "Nord",
		themes: { Nord: { version: "1.0.0" } } as Record<
			string,
			{ version: string }
		>,
		styleEl: {
			textContent: themeIds
				.map((id) => `.callout[data-callout="${id}"] {}`)
				.join("\n"),
		},
		snippets: [] as string[],
		enabledSnippets: new Set<string>(),
		extraStyleEls: [] as unknown[],
	};
	return { customCss } as unknown as App;
}

/** The slice of the settings context the three lists actually touch. */
function listsCtx(registry: Registry, app: App, themeIds: string[]) {
	registry.setThemeOwnedIds(new Set(themeIds));
	return {
		app,
		display: () => {},
		registerDisposer: () => {},
		plugin: {
			app,
			registry,
			settings: registry.settings,
			saveSettings: () => Promise.resolve(),
			refreshCallouts: () => {},
			refreshRenderModes: () => {},
			cssInjector: {
				themeCallouts: () => ({
					themeDefinedIds: () => new Set(themeIds),
					patternClaims: () => [],
				}),
			},
		},
	} as never;
}

function vault(): Registry {
	const registry = new CalloutRegistry();
	registry.load(null);
	return registry;
}

function addUserCallout(registry: Registry, id: string): void {
	registry.add({
		id,
		displayName: id,
		icon: { type: "lucide", value: "pencil" },
		colorLight: "#336699",
		colorDark: "#88bbee",
		foldable: false,
		defaultFolded: false,
		builtIn: false,
		source: "user",
	});
}

/** The count each heading is currently carrying, keyed by its dataset name. */
function headingCounts(host: HTMLElement): {
	theme: string;
	mine: string;
	builtIn: string;
} {
	const headings = Array.from(
		host.querySelectorAll<HTMLElement>(".setting-item"),
	).map((el) => el.dataset.csName ?? "");
	const find = (needle: string) =>
		headings.find((name) => name.startsWith(needle)) ?? "";
	return {
		theme: find("Callouts from your theme"),
		mine: find("My callout types"),
		builtIn: find("Built-in callouts"),
	};
}

/** Whether the theme section is on screen (it hides itself at zero rows). */
function themeSectionVisible(host: HTMLElement): boolean {
	const el = Array.from(
		host.querySelectorAll<HTMLElement>(".cs-subheader-row"),
	).find((row) => (row.dataset.csName ?? "").startsWith("Callouts from your theme"));
	return el !== undefined && !el.hasClass("cs-hidden");
}

function render(registry: Registry, app: App, themeIds: string[]) {
	const ctx = listsCtx(registry, app, themeIds);
	const host: HTMLElement = createDiv();
	const lists = createCalloutListsController(ctx, {
		onAddNewCallout: () => Promise.resolve(),
		renderRow: () => {},
	});
	lists.render(host);
	return { host, lists };
}

describe("each list heading carries the count of rows it is showing", () => {
	it("starts with every built-in in Built-in callouts and none of my own", () => {
		const registry = vault();
		const app = themeApp([]);
		const { host } = render(registry, app, []);

		const builtInCount = registry.getBuiltIn().length;
		const counts = headingCounts(host);
		assert.strictEqual(counts.mine, "My callout types (0)");
		assert.strictEqual(
			counts.builtIn,
			`Built-in callouts (${builtInCount})`,
		);
		// The theme section names a count even at zero, but stays off screen —
		// nothing to display means nothing to count in the user's eyes.
		assert.strictEqual(counts.theme, "Callouts from your theme (0)");
		assert.strictEqual(themeSectionVisible(host), false);
	});

	it("counts up in My callout types when a callout is added, back down when removed", () => {
		const registry = vault();
		const app = themeApp([]);
		const { host, lists } = render(registry, app, []);

		addUserCallout(registry, "quiet");
		lists.refresh();
		assert.strictEqual(headingCounts(host).mine, "My callout types (1)");

		addUserCallout(registry, "loud");
		lists.refresh();
		assert.strictEqual(headingCounts(host).mine, "My callout types (2)");

		registry.remove("quiet");
		lists.refresh();
		assert.strictEqual(headingCounts(host).mine, "My callout types (1)");
	});

	it("moves the count from Built-in to Callouts from your theme when a theme claims a built-in, and back on release", () => {
		const registry = vault();
		const app = themeApp(["note"]);
		const { host, lists } = render(registry, app, ["note"]);

		const totalBuiltIn = registry.getBuiltIn().length;
		let counts = headingCounts(host);
		assert.strictEqual(counts.theme, "Callouts from your theme (1)");
		assert.strictEqual(
			counts.builtIn,
			`Built-in callouts (${totalBuiltIn - 1})`,
		);

		registry.setThemeOwnedIds(new Set());
		lists.refresh();
		counts = headingCounts(host);
		assert.strictEqual(counts.theme, "Callouts from your theme (0)");
		assert.strictEqual(themeSectionVisible(host), false);
		assert.strictEqual(
			counts.builtIn,
			`Built-in callouts (${totalBuiltIn})`,
		);
	});
});
