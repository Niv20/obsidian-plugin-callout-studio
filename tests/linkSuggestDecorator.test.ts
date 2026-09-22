/**
 * tests/linkSuggestDecorator.test.ts — cleaning up the `[[#` popup.
 *
 * Obsidian's link suggester renders each heading suggestion's raw text, so
 * `# [!tip] My Title` shows up in the popup as `[!tip] My Title`. The suggester
 * is not part of the typed API, so this decorator reaches into
 * `workspace.editorSuggest` and wraps every registered `renderSuggestion` — core's
 * and other plugins' alike.
 *
 * That is a risky thing to do, and the design is almost entirely about *not*
 * being harmful when the guess is wrong. What is pinned here:
 *
 * - **The original always runs, and its return value always survives**, whatever
 *   this decorator then does or fails to do. The whole rewrite sits in a
 *   `try`/`catch` for exactly that reason.
 * - **Anything unrecognized passes through untouched.** Heading suggestions are
 *   recognized by *value shape* (`{type: "heading", heading: string}`), so
 *   wrapping an unrelated suggester costs nothing.
 * - **The leading text node must start with the exact prefix that was parsed off
 *   the heading.** A search-highlight span inside the token, or a renderer that
 *   shows something other than the heading text, breaks that invariant — and
 *   those are left alone rather than sliced blind.
 * - **`uninstall` restores what it replaced**, so unloading the plugin leaves
 *   core's popup exactly as it found it.
 */
import assert from "node:assert";
import { describe, it } from "node:test";
// Listed first: importing it installs the DOM globals before anything under
// test loads (see tests/support/fakeDom.ts).
import { asEl, el, type FakeElement } from "./support/fakeDom";
import { CalloutRegistry } from "../src/manager/CalloutRegistry";
import { LinkSuggestDecorator } from "../src/editor/LinkSuggestDecorator";
import { CSS_REF_TOKEN } from "../src/editor/renderShared";

type Registry = InstanceType<typeof CalloutRegistry>;

/* -------------------------------------------------------------------------- */
/* Harness                                                                    */
/* -------------------------------------------------------------------------- */

interface Suggester {
	renderSuggestion?: (value: unknown, element: unknown) => unknown;
}

interface Harness {
	registry: Registry;
	decorator: InstanceType<typeof LinkSuggestDecorator>;
	suggests: unknown[];
	/** Every (value, element) the ORIGINAL renderSuggestion was called with. */
	calls: Array<[unknown, unknown]>;
	core: Suggester;
}

function harness(suggests?: unknown): Harness {
	const registry = new CalloutRegistry();
	registry.load(null);
	const calls: Array<[unknown, unknown]> = [];
	const core: Suggester = {
		renderSuggestion(value, element) {
			calls.push([value, element]);
			return "from core";
		},
	};
	const list = suggests === undefined ? [core] : suggests;
	const host = {
		app: { workspace: { editorSuggest: { suggests: list } } },
		registry,
		settings: registry.settings,
	};
	return {
		registry,
		decorator: new LinkSuggestDecorator(host as never),
		suggests: Array.isArray(list) ? list : [],
		calls,
		core,
	};
}

function addCallout(
	registry: Registry,
	over: Partial<Parameters<Registry["add"]>[0]> = {},
): void {
	registry.add({
		id: "quiet",
		displayName: "Quiet",
		icon: { type: "lucide", value: "pencil" },
		colorLight: "#336699",
		colorDark: "#88bbee",
		foldable: false,
		defaultFolded: false,
		builtIn: false,
		source: "user",
		...over,
	});
}

/** A rendered suggestion row: one `.suggestion-title` holding the raw text. */
function row(text: string, cls = "suggestion-title"): {
	root: FakeElement;
	title: FakeElement;
} {
	const title = el({ cls, text });
	return { root: el({ cls: "suggestion-item", children: [title] }), title };
}

const heading = (text: string) => ({ type: "heading", heading: text });

/** Render one suggestion through the (possibly wrapped) core suggester. */
function render(h: Harness, value: unknown, element: unknown): unknown {
	assert.ok(h.core.renderSuggestion);
	return h.core.renderSuggestion(value, element);
}

/** The classes on an element, as an array. */
const classes = (element: unknown): string[] =>
	(element as { classList: { toArray(): string[] } }).classList.toArray();

/* -------------------------------------------------------------------------- */
/* install / uninstall                                                         */
/* -------------------------------------------------------------------------- */

describe("install", () => {
	it("wraps every registered suggester", () => {
		const h = harness();
		const original = h.core.renderSuggestion;
		h.decorator.install([]);

		assert.notStrictEqual(h.core.renderSuggestion, original);
	});

	it("lets the original run and hands its return value back", () => {
		const h = harness();
		h.decorator.install([]);

		const { root } = row("[!quiet] My Title");
		const value = heading("[!quiet] My Title");
		assert.strictEqual(render(h, value, asEl(root)), "from core");
		assert.deepStrictEqual(h.calls, [[value, asEl(root)]]);
	});

	it("leaves the suggesters it was told to skip", () => {
		// Our own autocomplete is one of them: it renders its own callout rows.
		const h = harness();
		const original = h.core.renderSuggestion;
		h.decorator.install([h.core]);

		assert.strictEqual(h.core.renderSuggestion, original);
	});

	it("ignores anything without a renderSuggestion to wrap", () => {
		const noRender = {};
		const notAFunction = { renderSuggestion: "nope" };
		const h = harness([null, "string", noRender, notAFunction]);

		assert.doesNotThrow(() => h.decorator.install([]));
		assert.strictEqual(notAFunction.renderSuggestion, "nope");
	});

	it("stands down entirely when the internal shape is not what it expects", () => {
		// A changed internal simply disables the cleanup rather than breaking.
		assert.doesNotThrow(() => harness(undefined as never).decorator.install([]));
		assert.doesNotThrow(() => harness({ not: "an array" }).decorator.install([]));
	});

	it("never lets its own failure break someone else's popup", () => {
		const h = harness();
		h.decorator.install([]);

		// An element the decorator cannot read at all.
		assert.strictEqual(
			render(h, heading("[!quiet] Title"), { querySelector: null }),
			"from core",
		);
	});
});

describe("uninstall", () => {
	it("puts every original back", () => {
		const h = harness();
		const original = h.core.renderSuggestion;
		h.decorator.install([]);
		h.decorator.uninstall();

		assert.strictEqual(h.core.renderSuggestion, original);
	});

	it("is safe to call twice, and leaves a re-install possible", () => {
		const h = harness();
		const original = h.core.renderSuggestion;
		h.decorator.install([]);
		h.decorator.uninstall();
		h.decorator.uninstall();

		assert.strictEqual(h.core.renderSuggestion, original);
		h.decorator.install([]);
		assert.notStrictEqual(h.core.renderSuggestion, original);
	});
});

/* -------------------------------------------------------------------------- */
/* What it rewrites                                                            */
/* -------------------------------------------------------------------------- */

describe("the rewrite", () => {
	it("strips the token and prepends the callout's icon", () => {
		const h = harness();
		addCallout(h.registry);
		h.decorator.install([]);

		const { root, title } = row("[!quiet] My Title");
		render(h, heading("[!quiet] My Title"), asEl(root));

		assert.strictEqual(title.textContent, "My Title");
		assert.ok(classes(title.children[0]).includes(CSS_REF_TOKEN));
	});

	it("puts the icon before the title, not after it", () => {
		const h = harness();
		addCallout(h.registry);
		h.decorator.install([]);

		const { root, title } = row("[!quiet] My Title");
		render(h, heading("[!quiet] My Title"), asEl(root));

		assert.strictEqual(title.childNodes[0], title.children[0]);
		assert.strictEqual(title.childNodes[1]?.textContent, "My Title");
	});

	it("shows the display name for a heading with no title of its own", () => {
		// Same as the outline pane: the token IS the label there.
		const h = harness();
		addCallout(h.registry, { displayName: "Library Voice" });
		h.decorator.install([]);

		const { root, title } = row("[!quiet]");
		render(h, heading("[!quiet]"), asEl(root));

		assert.strictEqual(title.textContent, "Library Voice");
	});

	it("shows what the user wrote when the id is unknown and titleless", () => {
		const h = harness();
		h.decorator.install([]);

		const { root, title } = row("[!never-heard-of-it]");
		render(h, heading("[!never-heard-of-it]"), asEl(root));

		assert.strictEqual(title.textContent, "never-heard-of-it");
	});

	it("draws no icon while reference icons are off", () => {
		const h = harness();
		addCallout(h.registry);
		h.registry.settings.headingCallouts.refShowIcon = false;
		h.decorator.install([]);

		const { root, title } = row("[!quiet] My Title");
		render(h, heading("[!quiet] My Title"), asEl(root));

		assert.strictEqual(title.textContent, "My Title");
		assert.strictEqual(title.children.length, 0);
	});

	it("finds the title through .suggestion-content when there is no .suggestion-title", () => {
		const h = harness();
		addCallout(h.registry);
		h.decorator.install([]);

		const { root, title } = row("[!quiet] My Title", "suggestion-content");
		render(h, heading("[!quiet] My Title"), asEl(root));

		assert.strictEqual(title.textContent, "My Title");
	});

	it("falls back to the row itself when neither is present", () => {
		const h = harness();
		addCallout(h.registry);
		h.decorator.install([]);

		const root = el({ cls: "suggestion-item", text: "[!quiet] My Title" });
		render(h, heading("[!quiet] My Title"), asEl(root));

		assert.ok(root.textContent.endsWith("My Title"));
		assert.ok(!root.textContent.includes("[!quiet]"));
	});

	it("keeps the metadata out of the resolved callout", () => {
		const h = harness();
		addCallout(h.registry);
		h.decorator.install([]);

		const { root, title } = row("[!quiet|purple] My Title");
		render(h, heading("[!quiet|purple] My Title"), asEl(root));

		assert.strictEqual(title.textContent, "My Title");
		assert.strictEqual(
			title.children[0]?.getAttribute("data-callout"),
			"quiet",
		);
	});
});

/* -------------------------------------------------------------------------- */
/* What it leaves alone                                                        */
/* -------------------------------------------------------------------------- */

describe("what it refuses to touch", () => {
	/** Run a render and assert the row came out byte-identical. */
	function unchanged(h: Harness, value: unknown, text = "[!quiet] My Title") {
		const { root, title } = row(text);
		render(h, value, asEl(root));
		assert.strictEqual(title.textContent, text);
		assert.strictEqual(title.children.length, 0);
	}

	it("anything that is not a heading suggestion", () => {
		const h = harness();
		addCallout(h.registry);
		h.decorator.install([]);

		unchanged(h, { type: "file", heading: "[!quiet] My Title" });
		unchanged(h, { type: "heading", heading: 42 });
		unchanged(h, { type: "heading" });
		unchanged(h, null);
		unchanged(h, "a bare string");
	});

	it("every suggestion while the heading role is off", () => {
		const h = harness();
		addCallout(h.registry);
		h.registry.settings.headingCallouts.enabled = false;
		h.decorator.install([]);

		unchanged(h, heading("[!quiet] My Title"));
	});

	it("every suggestion while reference cleanup is off", () => {
		const h = harness();
		addCallout(h.registry);
		h.registry.settings.headingCallouts.refCleanTitles = false;
		h.decorator.install([]);

		unchanged(h, heading("[!quiet] My Title"));
	});

	it("a heading that carries no callout token", () => {
		const h = harness();
		h.decorator.install([]);
		unchanged(h, heading("Just a heading"), "Just a heading");
	});

	it("a bracketless match, which no callout heading can produce", () => {
		// `HeadingCache.heading` is raw source text, so a real callout heading
		// always arrives bracketed. A bracketless one could only come from a
		// heading literally written `# !id Title`.
		const h = harness();
		addCallout(h.registry);
		h.decorator.install([]);

		unchanged(h, heading("!quiet My Title"), "!quiet My Title");
	});

	it("a row whose leading text does not match the parsed prefix", () => {
		// A search-highlight span inside the token, or a renderer showing
		// something other than the heading text: slicing blind would eat it.
		const h = harness();
		addCallout(h.registry);
		h.decorator.install([]);

		const { root, title } = row("Something else entirely");
		render(h, heading("[!quiet] My Title"), asEl(root));

		assert.strictEqual(title.textContent, "Something else entirely");
	});

	it("a row whose first child is an element rather than text", () => {
		const h = harness();
		addCallout(h.registry);
		h.decorator.install([]);

		const inner = el({ tag: "span", text: "[!quiet] My Title" });
		const title = el({ cls: "suggestion-title", children: [inner] });
		const root = el({ children: [title] });
		render(h, heading("[!quiet] My Title"), asEl(root));

		assert.strictEqual(title.textContent, "[!quiet] My Title");
	});

	it("a heading whose callout is owned by the theme", () => {
		// No token DOM is invented for it anywhere, so the suggestion keeps the
		// heading's raw text.
		const h = harness();
		addCallout(h.registry);
		h.registry.setThemeOwnedIds(new Set(["quiet"]));
		h.decorator.install([]);

		unchanged(h, heading("[!quiet] My Title"));
	});
});
