/**
 * tests/outlineDecorator.test.ts — cleaning up heading-callout titles in the
 * Outline pane.
 *
 * The Outline view renders `HeadingCache.heading` with the brackets stripped, so
 * `## [!tip] My Title` shows up in the pane as `!tip My Title`. It is not part
 * of Obsidian's typed API, so rather than patch it this module watches its DOM
 * with one `MutationObserver` per outline leaf and rewrites each item in place.
 *
 * That makes it the riskiest decorator in the plugin — it edits a pane it does
 * not own, on a schedule it does not control — and the suite is organised around
 * the four things that keep it safe:
 *
 * - **`!bug Title` is ambiguous, and only the raw source resolves it.** It is
 *   what the pane shows for `# [!bug] Title`, and it is *also* what a heading
 *   literally written `# !bug Title` shows. So every item is checked against the
 *   file's own heading text before anything is rewritten, and a file containing
 *   both forms falls back to an exact text match.
 * - **Every rewrite is reversible.** The original text is recorded in
 *   `data-cs-orig`, so flipping the feature off, or unloading the plugin,
 *   restores the pane exactly — including for items the pane's virtual tree has
 *   since recycled onto a different heading.
 * - **`data-cs-key` is a complete snapshot of what was rendered.** A matching
 *   key skips the item; anything that would change the row — the title, the
 *   icon, the display name, turning the callout's icon off — has to move it, or
 *   a stale row survives forever behind the early return.
 * - **Our own edits must not feed the observer.** The pass mutes it and then
 *   drains the records it produced anyway, so a rewrite cannot schedule the next
 *   rewrite.
 *
 * Mutation delivery and animation frames are both deferred in the fake DOM
 * (see `tests/support/fakeDom.ts`), so every pass below happens exactly where
 * `settle()` says it does rather than racing the assertions.
 */
import assert from "node:assert";
import { describe, it } from "node:test";
// Listed first: importing it installs the DOM globals before anything under
// test loads (see tests/support/fakeDom.ts).
import {
	NODE_TEXT,
	asEl,
	el,
	fakeDom,
	type FakeElement,
	type FakeText,
} from "./support/fakeDom";
import { CalloutRegistry } from "../src/manager/CalloutRegistry";
import { OutlineDecorator } from "../src/outline/OutlineDecorator";
import {
	CSS_REF_TOKEN,
	CSS_TOKEN_EMPTY,
	CSS_TOKEN_ICON,
} from "../src/editor/renderShared";
import type { App } from "obsidian";
import type { CalloutDefinition, PluginSettings } from "../src/types";

type Registry = InstanceType<typeof CalloutRegistry>;

/* -------------------------------------------------------------------------- */
/* Harness                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * The one private member the suite drives directly.
 *
 * Same reasoning as `discoveryHarness.ts`'s `DiscoveryInternals`: whether a pane
 * is *attached* is internal bookkeeping rather than API, but it is also the only
 * way to state "attaching twice attaches once" and "a closed pane is pruned"
 * without inventing a public accessor for the test's benefit.
 */
interface OutlineInternals {
	attachments: Map<unknown, unknown>;
}

/** One outline pane: its leaf, its container, and the items it lists. */
interface Pane {
	leaf: unknown;
	container: FakeElement;
	/** Replace the pane's rows with these display texts, as a re-render does. */
	items(...texts: string[]): FakeElement[];
	/** The row elements currently in the pane. */
	rows(): FakeElement[];
	/** The pane the user closed: gone from the workspace, and off the screen. */
	close(): void;
}

interface OutlineHarness {
	decorator: OutlineDecorator;
	internals: OutlineInternals;
	registry: Registry;
	settings: PluginSettings;
	/** Open one more outline pane over `path`. */
	pane(path?: string): Pane;
	/** Set the raw heading text the metadata cache reports for `path`. */
	headings(path: string, ...raw: string[]): void;
	/** Deliver queued mutations, then run the frames they scheduled. */
	settle(): void;
}

function outlineHarness(): OutlineHarness {
	const registry = new CalloutRegistry();
	registry.load(null);

	const leaves: unknown[] = [];
	const caches = new Map<string, { headings: Array<{ heading: string }> }>();

	const app = {
		workspace: {
			getLeavesOfType: (type: string) => (type === "outline" ? leaves : []),
		},
		metadataCache: {
			getCache: (path: string) => caches.get(path) ?? null,
		},
	} as unknown as App;

	const decorator = new OutlineDecorator({
		app,
		registry,
		// The same object main.ts hands over — `settings` there is a getter
		// returning `registry.settings`.
		settings: registry.settings,
	});

	const pane = (path = "note.md"): Pane => {
		const container = el({ cls: "outline" });
		container.isConnected = true;
		const leaf = { view: { containerEl: asEl(container), file: { path } } };
		leaves.push(leaf);
		return {
			leaf,
			container,
			items(...texts) {
				container.empty();
				return texts.map((text) =>
					container
						.createDiv({ cls: "tree-item" })
						.createDiv({ cls: "tree-item-inner", text }),
				);
			},
			rows: () => container.querySelectorAll(".tree-item-inner"),
			close() {
				const at = leaves.indexOf(leaf);
				if (at >= 0) leaves.splice(at, 1);
				container.isConnected = false;
			},
		};
	};

	return {
		decorator,
		internals: decorator as unknown as OutlineInternals,
		registry,
		settings: registry.settings,
		pane,
		headings(path, ...raw) {
			caches.set(path, { headings: raw.map((heading) => ({ heading })) });
		},
		settle: () => fakeDom.settle(),
	};
}

/** One neutral user callout to vary from — Lucide, so no artwork is involved. */
function addCallout(
	registry: Registry,
	over: Partial<CalloutDefinition> = {},
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

/**
 * The common setup: one pane over `note.md` whose only heading is
 * `## [!quiet] My Title`, already attached and processed.
 */
function decorated(
	over: Partial<CalloutDefinition> = {},
	themeOwned = false,
): {
	h: OutlineHarness;
	pane: Pane;
	row: FakeElement;
} {
	const h = outlineHarness();
	addCallout(h.registry, over);
	if (themeOwned) h.registry.setThemeOwnedIds(new Set(["quiet"]));
	h.headings("note.md", "[!quiet] My Title");
	const pane = h.pane();
	const [row] = pane.items("!quiet My Title");
	assert.ok(row);
	h.decorator.attachAll();
	h.settle();
	return { h, pane, row };
}

/** The ref token of a decorated row, if it has one. */
const tokenOf = (row: FakeElement): FakeElement | null =>
	row.querySelector(`.${CSS_REF_TOKEN}`);

/**
 * The row's own text node — what the pane rewrites when its virtual tree
 * recycles the row onto a different heading.
 */
function textNodeOf(row: FakeElement): FakeText {
	for (const node of row.childNodes) {
		if (node.nodeType === NODE_TEXT) return node;
	}
	throw new Error(`no text node in "${row.textContent}"`);
}

/* -------------------------------------------------------------------------- */
/* Attaching                                                                  */
/* -------------------------------------------------------------------------- */

describe("attachAll", () => {
	it("attaches one observer per outline pane and processes it", () => {
		const { h, row } = decorated();

		assert.strictEqual(h.internals.attachments.size, 1);
		assert.strictEqual(row.textContent, "My Title");
	});

	it("attaches a second pane without disturbing the first", () => {
		const { h } = decorated();
		h.headings("other.md", "[!quiet] Second");
		const other = h.pane("other.md");
		const [row] = other.items("!quiet Second");
		h.decorator.attachAll();
		h.settle();

		assert.strictEqual(h.internals.attachments.size, 2);
		assert.strictEqual(row?.textContent, "Second");
	});

	it("is idempotent — a second call attaches nothing new", () => {
		// It runs on every layout-change, which fires constantly.
		const { h, row } = decorated();
		h.decorator.attachAll();
		h.settle();

		assert.strictEqual(h.internals.attachments.size, 1);
		assert.strictEqual(row.textContent, "My Title");
		assert.strictEqual(row.children.length, 1, "one icon, not two");
	});

	it("prunes a pane the user closed", () => {
		const { h, pane } = decorated();
		pane.close();
		h.decorator.attachAll();

		assert.strictEqual(h.internals.attachments.size, 0);
	});

	it("stops watching a closed pane", () => {
		const { h, pane, row } = decorated();
		pane.close();
		h.decorator.attachAll();

		// A mutation now must reach nobody.
		row.textContent = "!quiet something else";
		h.settle();
		assert.strictEqual(row.textContent, "!quiet something else");
	});

	it("copes with a pane whose file the metadata cache does not know", () => {
		const h = outlineHarness();
		addCallout(h.registry);
		const pane = h.pane("missing.md");
		const [row] = pane.items("!quiet My Title");
		h.decorator.attachAll();
		h.settle();

		// No source headings means nothing can be confirmed as a callout.
		assert.strictEqual(row?.textContent, "!quiet My Title");
	});
});

/* -------------------------------------------------------------------------- */
/* The rewrite                                                                */
/* -------------------------------------------------------------------------- */

describe("the rewrite", () => {
	it("strips the token and prepends the callout's icon", () => {
		const { row } = decorated();

		assert.strictEqual(row.textContent, "My Title");
		const token = tokenOf(row);
		assert.ok(token);
		assert.strictEqual(row.childNodes[0], token, "icon leads the row");
		assert.ok(token.querySelector(`.${CSS_TOKEN_ICON}`));
	});

	it("shows the display name for a heading with no title of its own", () => {
		const h = outlineHarness();
		addCallout(h.registry, { displayName: "Library Voice" });
		h.headings("note.md", "[!quiet]");
		const [row] = h.pane().items("!quiet");
		h.decorator.attachAll();
		h.settle();

		assert.strictEqual(row?.textContent, "Library Voice");
	});

	it("shows what the user wrote when the id is unknown and titleless", () => {
		const h = outlineHarness();
		h.headings("note.md", "[!mystery]");
		const [row] = h.pane().items("!mystery");
		h.decorator.attachAll();
		h.settle();

		assert.strictEqual(row?.textContent, "mystery");
	});

	it("keeps the metadata out of the resolved callout", () => {
		// `# [!quiet|urgent] A`: the pane shows the pipe, and the token has to be
		// rebuilt whole to match it — but the callout is `quiet`.
		const h = outlineHarness();
		addCallout(h.registry);
		h.headings("note.md", "[!quiet|urgent] A");
		const [row] = h.pane().items("!quiet|urgent A");
		h.decorator.attachAll();
		h.settle();

		assert.ok(row);
		assert.strictEqual(row.textContent, "A");
		assert.strictEqual(tokenOf(row)?.getAttribute("data-callout"), "quiet");
	});

	it("accepts a bracketed item without consulting the source", () => {
		// Only `[!id]` is callout syntax, so a pane that shows the brackets needs
		// no confirmation.
		const h = outlineHarness();
		addCallout(h.registry);
		h.headings("note.md", "[!quiet] My Title");
		const [row] = h.pane().items("[!quiet] My Title");
		h.decorator.attachAll();
		h.settle();

		assert.strictEqual(row?.textContent, "My Title");
	});

	it("draws no icon while reference icons are off", () => {
		const h = outlineHarness();
		addCallout(h.registry);
		h.registry.settings.headingCallouts.refShowIcon = false;
		h.headings("note.md", "[!quiet] My Title");
		const [row] = h.pane().items("!quiet My Title");
		h.decorator.attachAll();
		h.settle();

		assert.strictEqual(row?.textContent, "My Title");
		assert.strictEqual(row?.children.length, 0);
	});

	it("records what it replaced, and what it wrote", () => {
		const { row } = decorated();

		assert.strictEqual(row.dataset.csOrig, "!quiet My Title");
		assert.strictEqual(row.dataset.csText, "My Title");
		assert.ok(row.dataset.csKey);
	});
});

/* -------------------------------------------------------------------------- */
/* Telling the two written forms apart                                        */
/* -------------------------------------------------------------------------- */

describe("`!id` in the pane — is it really a callout?", () => {
	/** Build a pane over headings `raw` showing rows `shown`. */
	function scenario(raw: string[], shown: string[]): FakeElement[] {
		const h = outlineHarness();
		addCallout(h.registry);
		h.headings("note.md", ...raw);
		const rows = h.pane().items(...shown);
		h.decorator.attachAll();
		h.settle();
		return rows;
	}

	it("yes, when the file has a `[!id]` heading and no literal one", () => {
		const [row] = scenario(["[!quiet] My Title"], ["!quiet My Title"]);
		assert.strictEqual(row?.textContent, "My Title");
	});

	it("no, when no heading in the file is written `[!id]`", () => {
		// `# !quiet My Title` is plain text that happens to start with `!`.
		const [row] = scenario(["!quiet My Title"], ["!quiet My Title"]);
		assert.strictEqual(row?.textContent, "!quiet My Title");
	});

	it("no, for an id the file never uses at all", () => {
		const [row] = scenario(["[!quiet] A"], ["!other B"]);
		assert.strictEqual(row?.textContent, "!other B");
	});

	it("by exact text, when the file contains BOTH forms of one id", () => {
		const [bracketed, literal] = scenario(
			["[!quiet] A", "!quiet B"],
			["!quiet A", "!quiet B"],
		);

		assert.strictEqual(bracketed?.textContent, "A");
		assert.strictEqual(literal?.textContent, "!quiet B");
	});

	it("resolves a multi-word id against the file's own headings", () => {
		// Nothing delimits the id in the bracketless form but the ids the file
		// actually uses, so the longest match wins.
		const h = outlineHarness();
		addCallout(h.registry, { id: "two words", displayName: "Two Words" });
		h.headings("note.md", "[!two words] My Title");
		const [row] = h.pane().items("!two words My Title");
		h.decorator.attachAll();
		h.settle();

		assert.strictEqual(row?.textContent, "My Title");
	});
});

/* -------------------------------------------------------------------------- */
/* What it leaves alone                                                       */
/* -------------------------------------------------------------------------- */

describe("what it refuses to touch", () => {
	it("an item that is not a callout heading at all", () => {
		const h = outlineHarness();
		addCallout(h.registry);
		h.headings("note.md", "[!quiet] A", "Ordinary heading");
		const [, plain] = h.pane().items("!quiet A", "Ordinary heading");
		h.decorator.attachAll();
		h.settle();

		assert.strictEqual(plain?.textContent, "Ordinary heading");
		assert.strictEqual(plain?.children.length, 0);
	});

	it("an item that does not start with plain text", () => {
		// Anything else leading the row means it is not the shape this parses.
		const h = outlineHarness();
		addCallout(h.registry);
		h.headings("note.md", "[!quiet] My Title");
		const pane = h.pane();
		const [row] = pane.items("");
		assert.ok(row);
		row.createSpan({ cls: "tree-item-icon" });
		row.appendText("!quiet My Title");
		h.decorator.attachAll();
		h.settle();

		assert.strictEqual(row.textContent, "!quiet My Title");
		assert.strictEqual(tokenOf(row), null);
	});

	it("a heading whose callout is owned by the theme", () => {
		const { row } = decorated({}, true);

		assert.strictEqual(row.textContent, "!quiet My Title");
		assert.strictEqual(tokenOf(row), null);
	});

	it("every item while the heading role is off", () => {
		const h = outlineHarness();
		addCallout(h.registry);
		h.registry.settings.headingCallouts.enabled = false;
		h.headings("note.md", "[!quiet] My Title");
		const [row] = h.pane().items("!quiet My Title");
		h.decorator.attachAll();
		h.settle();

		assert.strictEqual(row?.textContent, "!quiet My Title");
	});

	it("every item while reference cleanup is off", () => {
		const h = outlineHarness();
		addCallout(h.registry);
		h.registry.settings.headingCallouts.refCleanTitles = false;
		h.headings("note.md", "[!quiet] My Title");
		const [row] = h.pane().items("!quiet My Title");
		h.decorator.attachAll();
		h.settle();

		assert.strictEqual(row?.textContent, "!quiet My Title");
	});
});

/* -------------------------------------------------------------------------- */
/* Putting it back                                                            */
/* -------------------------------------------------------------------------- */

describe("restoring", () => {
	it("puts a decorated row back when the feature is switched off", () => {
		const { h, row } = decorated();
		h.settings.headingCallouts.refCleanTitles = false;
		h.decorator.refreshAll();
		h.settle();

		assert.strictEqual(row.textContent, "!quiet My Title");
		assert.strictEqual(tokenOf(row), null);
		assert.strictEqual(row.dataset.csOrig, undefined);
	});

	it("puts one back when its callout becomes theme-owned", () => {
		// Routed through restoreItem rather than an early return, precisely so an
		// entry decorated before ownership moved is not left stale.
		const { h, row } = decorated();
		h.registry.setThemeOwnedIds(new Set(["quiet"]));
		h.decorator.refreshAll();
		h.settle();

		assert.strictEqual(row.textContent, "!quiet My Title");
	});

	it("restores every pane and disconnects on destroy", () => {
		const { h, row } = decorated();
		h.decorator.destroy();

		assert.strictEqual(row.textContent, "!quiet My Title");
		assert.strictEqual(tokenOf(row), null);
		assert.strictEqual(h.internals.attachments.size, 0);
	});

	it("stays quiet after destroy, however the pane churns", () => {
		const { h, pane, row } = decorated();
		h.decorator.destroy();
		pane.items("!quiet Something New");
		h.settle();

		assert.strictEqual(row.textContent, "!quiet My Title");
		assert.strictEqual(pane.rows()[0]?.textContent, "!quiet Something New");
	});

	it("treats a recycled row's current text as the new original", () => {
		// The pane's virtual tree reuses nodes for different headings. The text no
		// longer matching `data-cs-text` is how that is detected — restoring the
		// old original over it would put a stranger's title in the row.
		const { h, row } = decorated();
		textNodeOf(row).nodeValue = "Ordinary heading";
		h.decorator.refreshAll();
		h.settle();

		assert.strictEqual(row.textContent, "Ordinary heading");
		assert.strictEqual(tokenOf(row), null);
		assert.strictEqual(row.dataset.csOrig, undefined);
	});

	it("leaves text it no longer owns to whoever rewrote it", () => {
		const { h, row } = decorated();
		textNodeOf(row).nodeValue = "Rewritten by the pane";
		h.settings.headingCallouts.refCleanTitles = false;
		h.decorator.refreshAll();
		h.settle();

		assert.strictEqual(row.textContent, "Rewritten by the pane");
	});
});

/* -------------------------------------------------------------------------- */
/* The render key                                                             */
/* -------------------------------------------------------------------------- */

describe("data-cs-key", () => {
	it("skips a row whose rendered state has not moved", () => {
		// Probed by breaking the row by hand: an unchanged key means the pass
		// leaves it exactly as it found it.
		const { h, row } = decorated();
		tokenOf(row)?.remove();
		h.decorator.refreshAll();
		h.settle();

		assert.strictEqual(tokenOf(row), null);
	});

	it("moves when the display name does, so a titleless row follows it", () => {
		const h = outlineHarness();
		addCallout(h.registry, { displayName: "Library Voice" });
		h.headings("note.md", "[!quiet]");
		const [row] = h.pane().items("!quiet");
		h.decorator.attachAll();
		h.settle();
		assert.strictEqual(row?.textContent, "Library Voice");

		h.registry.update("quiet", { displayName: "Hush" });
		h.decorator.refreshAll();
		h.settle();

		assert.strictEqual(row?.textContent, "Hush");
	});

	it("moves when the callout's icon is turned off", () => {
		// `showIcon` stays true and the icon itself is untouched, so nothing else
		// here would notice — and the early return would keep the stale row.
		const { h, row } = decorated();
		assert.ok(tokenOf(row)?.querySelector(`.${CSS_TOKEN_ICON}`));

		h.registry.update("quiet", { hideIcon: true });
		h.decorator.refreshAll();
		h.settle();

		const token = tokenOf(row);
		assert.ok(token);
		assert.ok(token.classList.contains(CSS_TOKEN_EMPTY));
		assert.strictEqual(token.querySelector(`.${CSS_TOKEN_ICON}`), null);
	});

	it("moves when the reference-icon setting does", () => {
		const { h, row } = decorated();
		h.settings.headingCallouts.refShowIcon = false;
		h.decorator.refreshAll();
		h.settle();

		assert.strictEqual(tokenOf(row), null);
		assert.strictEqual(row.textContent, "My Title");
	});
});

/* -------------------------------------------------------------------------- */
/* The observer                                                               */
/* -------------------------------------------------------------------------- */

describe("the observer", () => {
	it("re-processes the pane when it re-renders", () => {
		const { h, pane } = decorated();
		h.headings("note.md", "[!quiet] My Title", "[!quiet] Another");
		const rows = pane.items("!quiet My Title", "!quiet Another");
		h.settle();

		assert.deepStrictEqual(
			rows.map((row) => row.textContent),
			["My Title", "Another"],
		);
	});

	it("coalesces a burst of mutations into one frame", () => {
		const { pane } = decorated();
		pane.items("!quiet A", "!quiet B", "!quiet C");
		fakeDom.document.flushMutations();

		assert.strictEqual(fakeDom.window.pendingFrames(), 1);
	});

	it("does not feed itself: the pass's own edits reach no observer", () => {
		// Stepped by hand rather than through `settle()`: the point is what the
		// flush AFTER a pass finds, and a settle loop would absorb it.
		const { pane } = decorated();
		pane.items("!quiet A");
		fakeDom.document.flushMutations();
		assert.strictEqual(fakeDom.window.pendingFrames(), 1, "a pass was queued");

		fakeDom.window.flushFrames();
		assert.strictEqual(pane.rows()[0]?.textContent, "A");

		fakeDom.document.flushMutations();
		assert.strictEqual(
			fakeDom.window.pendingFrames(),
			0,
			"the rewrite scheduled another rewrite",
		);
	});
});

/* -------------------------------------------------------------------------- */
/* The one combinator                                                         */
/* -------------------------------------------------------------------------- */

describe("clearDecoration removes its own token and no other", () => {
	/**
	 * `clearDecoration` is the whole reason `:scope > .cs-ref-token` exists in
	 * this plugin — the single production selector that is not a plain compound
	 * (see `tests/support/fakeDom.ts`, whose engine says so in as many words).
	 *
	 * That the fake DOM *answers* it at all is already pinned by the restore
	 * tests above: an engine that matched nothing would leave the token behind
	 * and they would fail. What they cannot see is the opposite mistake —
	 * answering it as a descendant match, which every suite in this file would
	 * pass while the real DOM reached one level deeper than production means to.
	 * The outline pane is not ours; a token below the top level of a row belongs
	 * to whoever put it there.
	 */
	it("the fake DOM's `:scope >` means a child, not a descendant", () => {
		const row = el({ cls: "tree-item-inner" });
		const deep = row.createDiv().createSpan({ cls: CSS_REF_TOKEN });

		assert.strictEqual(row.querySelector(`:scope > .${CSS_REF_TOKEN}`), null);
		assert.strictEqual(row.querySelector(`.${CSS_REF_TOKEN}`), deep);
	});

	it("a restore leaves a lookalike nested in the row alone", () => {
		// Deliberately inserted ahead of our own token, which is what makes this
		// tell the two engines apart: a descendant match takes the first hit in
		// document order, and that would be this one.
		const { h, row } = decorated();
		const wrapper = el({ tag: "span" });
		const foreign = wrapper.createSpan({ cls: CSS_REF_TOKEN });
		row.insertBefore(wrapper, row.firstChild);

		h.decorator.destroy();

		assert.strictEqual(row.querySelectorAll(`.${CSS_REF_TOKEN}`).length, 1);
		assert.strictEqual(tokenOf(row), foreign);
	});
});
