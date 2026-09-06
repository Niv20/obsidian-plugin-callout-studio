/**
 * tests/calloutPostProcessor.test.ts — reading view's rendering of the heading
 * and inline callout roles.
 *
 * This is the surface with the least control over its own input: Live Preview
 * reads raw source lines, while this one is handed whatever Obsidian's markdown
 * renderer already produced and has to rewrite it in place. Everything asserted
 * below follows from that:
 *
 * - **The source line is authoritative when it exists, and only then.** Markdown
 *   consumes the `\` of `\[!id]`, so the rendered text of an escaped token is
 *   byte-identical to a real one — only `ctx.getSectionInfo` can tell them
 *   apart. It answers `null` inside embeds and during PDF export, which is a
 *   *different* path rather than a broken one, and both are pinned here.
 * - **A heading is restyled in place.** The `hN` element survives — outline,
 *   TOC and anchor links all key off it — so the token prefix is swapped for
 *   token DOM rather than the heading being rebuilt.
 * - **Content pills move nodes, never re-render them.** `[!warning]{a **b** c}`
 *   has already become three DOM siblings by the time this runs, so the closing
 *   brace is not in the node the payload opened in. The walk that finds it is
 *   deliberately strict, and every shape it refuses stays literal text — the
 *   alternative is swallowing the author's own words.
 * - **Escape pairing is ordinal, and it knows when it is lying.** Rendered
 *   candidates are matched to source `[!` occurrences by position; when the
 *   counts disagree, or when pass A already removed some, everything renders. A
 *   missing escape is a milder failure than a missing pill.
 *
 * The last suite is the odd one out: it reads this processor's own source
 * rather than running it, because "the two heading passes share one branch" has
 * no behaviour to observe — and a duplicated branch on one setting is precisely
 * the shape a later edit splits in half.
 *
 * The DOM is the fake one from `tests/support/fakeDom.ts` and icons are Lucide
 * throughout, so painting bottoms out in the stubbed `setIcon`.
 */
import assert from "node:assert";
import { describe, it } from "node:test";
// Listed first: importing it installs the DOM globals before anything under
// test loads (see tests/support/fakeDom.ts).
import { fakeDom, type FakeElement } from "./support/fakeDom";
import {
	addCallout,
	readingHarness,
	type ReadingHarness,
} from "./support/readingHarness";
import { pluginSourceFiles } from "./support/sourceScan";
import { CSS_GRAD_CHAR } from "../src/reading/gradientTitleText";
import {
	CSS_ANIM_IN,
	CSS_CALLOUT_PAYLOAD,
	CSS_HEADING_LINE,
	CSS_HEADING_TITLE,
	CSS_HEADING_TITLE_GAP,
	CSS_HEADING_TOKEN,
	CSS_INLINE_HAS_CONTENT,
	CSS_INLINE_TOKEN,
	CSS_REF_TOKEN,
	CSS_REF_TOKEN_LINK,
	CSS_TOKEN_NAME,
	CSS_UNKNOWN,
	beginStartupEntranceWindow,
} from "../src/editor/renderShared";
import type { BgGradient } from "../src/types";

/* -------------------------------------------------------------------------- */
/* Harness                                                                    */
/* -------------------------------------------------------------------------- */

const classes = (element: FakeElement): string[] => element.classList.toArray();

const hasClass = (element: FakeElement, cls: string): boolean =>
	element.classList.contains(cls);

/** Every inline pill in the block, in document order. */
const pills = (root: FakeElement): FakeElement[] =>
	root.querySelectorAll(`.${CSS_INLINE_TOKEN}`);

/** The one element matching `selector`, asserted to exist. */
function one(root: FakeElement, selector: string): FakeElement {
	const found = root.querySelector(selector);
	assert.ok(found, `no ${selector} in ${root.textContent}`);
	return found;
}

/** A harness with the `quiet` callout already defined. */
function withQuiet(
	over: Parameters<typeof addCallout>[1] = {},
): ReadingHarness {
	const h = readingHarness();
	addCallout(h.registry, over);
	return h;
}

/** A gradient whose TEXT sweep is on — the state that bakes print colours. */
const textSweep: BgGradient = {
	angleDeg: 90,
	toColorLight: "#eeeeee",
	toColorDark: "#222222",
	textGradient: true,
	textToColorLight: "#aabbcc",
};

/* -------------------------------------------------------------------------- */
/* Bail-outs                                                                  */
/* -------------------------------------------------------------------------- */

describe("the cheap bail-outs", () => {
	it("does nothing at all while both roles are off", () => {
		const h = withQuiet();
		h.settings.headingCallouts.enabled = false;
		h.settings.inlineCallouts.enabled = false;

		const root = h.render("<p>see [!quiet] here</p>", "see [!quiet] here");
		assert.strictEqual(root.textContent, "see [!quiet] here");
		assert.strictEqual(pills(root).length, 0);
	});

	it("does nothing to a block that carries no `[!` at all", () => {
		const h = withQuiet();
		const root = h.render("<p>ordinary prose</p>", "ordinary prose");

		assert.strictEqual(root.textContent, "ordinary prose");
		assert.strictEqual(h.sectionReads(), 0);
	});

	it("never asks for the section source when nothing needs it", () => {
		// `[!` with no closing bracket is not a token, so no candidate ever makes
		// the (comparatively expensive) source fetch necessary.
		const h = withQuiet();
		h.render("<p>an [! unclosed thing</p>", "an [! unclosed thing");

		assert.strictEqual(h.sectionReads(), 0);
	});

	it("asks for it at most once, however many passes want it", () => {
		const h = withQuiet();
		h.render(
			"<div><h2>[!quiet] Title with [!quiet] inside</h2></div>",
			"## [!quiet] Title with [!quiet] inside",
		);

		assert.strictEqual(h.sectionReads(), 1);
	});
});

/* -------------------------------------------------------------------------- */
/* Heading callouts                                                           */
/* -------------------------------------------------------------------------- */

describe("heading callouts — the transform", () => {
	/** Render `## [!quiet] My title` and hand back the (in-place) heading. */
	function heading(
		h: ReadingHarness,
		rendered = "[!quiet] My title",
		source = "## [!quiet] My title",
	): FakeElement {
		const root = h.render(`<div><h2>${rendered}</h2></div>`, source);
		return one(root, "h2");
	}

	it("keeps the hN element and restyles it in place", () => {
		// Rebuilding the heading would cost the outline pane, the TOC and every
		// anchor link that resolves against it.
		const h = withQuiet();
		const el = heading(h);

		assert.strictEqual(el.tagName, "H2");
		assert.ok(hasClass(el, CSS_HEADING_LINE));
	});

	it("stamps the callout id where per-callout CSS can find it", () => {
		const h = withQuiet();
		assert.strictEqual(heading(h).getAttribute("data-callout"), "quiet");
	});

	it("swaps the `[!id] ` prefix for the token DOM", () => {
		const h = withQuiet();
		const el = heading(h);

		assert.ok(hasClass(el.children[0] as FakeElement, CSS_HEADING_TOKEN));
		assert.strictEqual(el.textContent, "My title");
	});

	it("wraps the title in its own inline box, after the token", () => {
		// A full-width bar would only ever show a gradient sweep's opening slice;
		// the title needs a box that hugs the words (see CSS_HEADING_TITLE).
		const h = withQuiet();
		const el = heading(h);

		assert.deepStrictEqual(
			el.children.map((child) => classes(child)),
			[[CSS_HEADING_TOKEN], [CSS_HEADING_TITLE, CSS_HEADING_TITLE_GAP]],
		);
		assert.strictEqual(one(el, `.${CSS_HEADING_TITLE}`).textContent, "My title");
	});

	it("gives back the separating space it consumed, as a margin class", () => {
		const h = withQuiet();
		assert.ok(
			hasClass(one(heading(h), `.${CSS_HEADING_TITLE}`), CSS_HEADING_TITLE_GAP),
		);
	});

	it("but not when the title started right at the bracket", () => {
		// `## [!quiet]-glued` has no space to give back, and Live Preview renders
		// it glued to the icon.
		const h = withQuiet();
		const el = heading(h, "[!quiet]-glued", "## [!quiet]-glued");

		assert.strictEqual(
			hasClass(one(el, `.${CSS_HEADING_TITLE}`), CSS_HEADING_TITLE_GAP),
			false,
		);
	});

	it("shows the display name when the heading has no title of its own", () => {
		const h = withQuiet({ displayName: "Library Voice" });
		const el = heading(h, "[!quiet]", "## [!quiet]");

		assert.strictEqual(el.textContent, "Library Voice");
		assert.strictEqual(el.querySelector(`.${CSS_HEADING_TITLE}`), null);
	});

	it("marks an unrecognized id, and keeps what the user wrote", () => {
		const h = readingHarness();
		const el = heading(h, "[!mystery]", "## [!mystery]");

		assert.ok(hasClass(el, CSS_UNKNOWN));
		assert.strictEqual(el.getAttribute("data-callout"), "mystery");
		assert.strictEqual(el.textContent, "mystery");
	});

	it("mirrors Obsidian's data-callout-metadata, and drops it from the id", () => {
		const h = withQuiet();
		const el = heading(h, "[!quiet|purple] My title", "## [!quiet|purple] My title");

		assert.strictEqual(el.getAttribute("data-callout"), "quiet");
		assert.strictEqual(el.getAttribute("data-callout-metadata"), "purple");
	});

	it("leaves the metadata attribute off entirely when there is none", () => {
		// An empty attribute still matches `[data-callout-metadata]`.
		const h = withQuiet();
		assert.strictEqual(heading(h).hasAttribute("data-callout-metadata"), false);
	});

	it("steps over Obsidian's own collapse indicator", () => {
		const h = withQuiet();
		const root = h.render(
			`<div><h2><div class="heading-collapse-indicator"></div>[!quiet] My title</h2></div>`,
			"## [!quiet] My title",
		);
		const el = one(root, "h2");

		assert.deepStrictEqual(
			el.children.map((child) => classes(child)),
			[
				["heading-collapse-indicator"],
				[CSS_HEADING_TOKEN],
				[CSS_HEADING_TITLE, CSS_HEADING_TITLE_GAP],
			],
		);
	});

	it("animates in only while the startup entrance window is open", () => {
		const h = withQuiet();
		assert.strictEqual(hasClass(heading(h), CSS_ANIM_IN), false);

		const close = beginStartupEntranceWindow(
			fakeDom.document as unknown as Document,
		);
		try {
			assert.ok(hasClass(heading(h), CSS_ANIM_IN));
		} finally {
			close();
		}
		assert.strictEqual(hasClass(heading(h), CSS_ANIM_IN), false);
	});
});

describe("heading callouts — what the source vetoes", () => {
	/** Assert the heading came out exactly as Obsidian rendered it. */
	function untouched(root: FakeElement, text: string): void {
		const el = one(root, "h2");
		assert.strictEqual(el.textContent, text);
		assert.deepStrictEqual(classes(el), []);
		assert.strictEqual(el.hasAttribute("data-callout"), false);
	}

	it("refuses an escaped token, which renders identically to a real one", () => {
		// Markdown eats the `\`, so the DOM alone cannot tell these apart.
		const h = withQuiet();
		const root = h.render(
			"<div><h2>[!quiet] My title</h2></div>",
			"## \\[!quiet] My title",
		);

		untouched(root, "[!quiet] My title");
	});

	it("refuses a heading-looking line inside a blockquote", () => {
		// `> # [!quiet]` is an inline callout on a quoted line, not a heading
		// callout — the scanner classifies it that way and the DOM must follow.
		const h = withQuiet();
		const root = h.render(
			"<blockquote><h2>[!quiet] My title</h2></blockquote>",
			"> # [!quiet] My title",
		);

		untouched(root, "[!quiet] My title");
	});

	it("refuses when the source line carries no heading token at all", () => {
		const h = withQuiet();
		const root = h.render(
			"<div><h2>[!quiet] My title</h2></div>",
			"just some prose",
		);

		untouched(root, "[!quiet] My title");
	});

	it("does not consult the source for a multi-heading block", () => {
		// More than one heading in one `el` is the print / PDF-export path, where
		// `getSectionInfo` is null anyway — so the rendered text is trusted.
		const h = withQuiet();
		const root = h.render(
			"<div><h2>[!quiet] One</h2><h2>[!quiet] Two</h2></div>",
			"## \\[!quiet] One\n## \\[!quiet] Two",
		);

		assert.strictEqual(h.sectionReads(), 0);
		for (const el of root.querySelectorAll("h2")) {
			assert.ok(hasClass(el, CSS_HEADING_LINE));
		}
	});

	it("leaves a theme-owned callout's heading completely alone", () => {
		// No theme styles a `## [!id]` heading, so there is nothing for "external
		// style" to hand it to — the raw text stays, and none of our classes land.
		const h = withQuiet({ externalStyle: true });
		const root = h.render(
			"<div><h2>[!quiet] My title</h2></div>",
			"## [!quiet] My title",
		);

		untouched(root, "[!quiet] My title");
	});

	it("leaves a heading that does not start with plain text", () => {
		const h = withQuiet();
		const root = h.render(
			"<div><h2><em>x</em>[!quiet] My title</h2></div>",
			"## *x*[!quiet] My title",
		);
		const el = one(root, "h2");

		assert.strictEqual(el.querySelector(`.${CSS_HEADING_TOKEN}`), null);
	});
});

describe("heading callouts — with no source at all", () => {
	// Embeds and some export paths: `getSectionInfo` answers null and the
	// rendered text is all there is.

	it("trusts the rendered text", () => {
		const h = withQuiet();
		const root = h.render("<div><h2>[!quiet] My title</h2></div>");
		const el = one(root, "h2");

		assert.ok(hasClass(el, CSS_HEADING_LINE));
		assert.strictEqual(el.textContent, "My title");
	});

	it("still splits the metadata off the id", () => {
		const h = withQuiet();
		const root = h.render("<div><h2>[!quiet|purple] My title</h2></div>");

		assert.strictEqual(one(root, "h2").getAttribute("data-callout"), "quiet");
	});

	it("sees a title that lives in a following sibling node", () => {
		// `## [!quiet] **bold**` renders the title as an element, so the leading
		// text node is just the token and is left empty by the strip —
		// `nextSibling`, not the remaining text, is what says there is a title.
		const h = withQuiet({ displayName: "Library Voice" });
		const root = h.render("<div><h2>[!quiet] <strong>b</strong></h2></div>");
		const el = one(root, "h2");

		// "Library Voice" nowhere: a heading with a title shows no token name.
		assert.strictEqual(el.textContent, "b");
		assert.strictEqual(one(el, `.${CSS_HEADING_TITLE}`).textContent, "b");
	});

	it("refuses a token whose id is nothing but whitespace", () => {
		const h = withQuiet();
		const root = h.render("<div><h2>[! ] My title</h2></div>");

		assert.strictEqual(one(root, "h2").querySelector(`.${CSS_HEADING_TOKEN}`), null);
	});
});

describe("heading callouts — the gradient bake", () => {
	// paintIcons already swept the container before these nodes existed (this
	// post-processor is registered after the one that runs it), so the
	// per-grapheme print colours have to be baked here or never.

	it("bakes the title's per-grapheme print colours", () => {
		const h = withQuiet({ bgGradient: textSweep });
		const root = h.render(
			"<div><h2>[!quiet] ab</h2></div>",
			"## [!quiet] ab",
		);

		const chars = one(root, `.${CSS_HEADING_TITLE}`).querySelectorAll(
			`.${CSS_GRAD_CHAR}`,
		);
		assert.deepStrictEqual(
			chars.map((c) => c.style.getPropertyValue("--cs-gch")),
			["#336699", "#aabbcc"],
		);
	});

	it("bakes the token's name instead when the heading has no title", () => {
		const h = withQuiet({ displayName: "ab", bgGradient: textSweep });
		const root = h.render("<div><h2>[!quiet]</h2></div>", "## [!quiet]");

		const nameEl = one(root, `.${CSS_TOKEN_NAME}`);
		assert.strictEqual(nameEl.querySelectorAll(`.${CSS_GRAD_CHAR}`).length, 2);
	});

	it("bakes nothing for a callout with no text sweep", () => {
		const h = withQuiet();
		const root = h.render(
			"<div><h2>[!quiet] ab</h2></div>",
			"## [!quiet] ab",
		);

		assert.strictEqual(root.querySelectorAll(`.${CSS_GRAD_CHAR}`).length, 0);
	});

	it("bakes nothing for an unknown id borrowing the fallback's look", () => {
		// The sweep it would borrow belongs to another callout; the CSS keyed on
		// `[data-callout="mystery"]` never draws it.
		const h = readingHarness();
		h.registry.update("note", { bgGradient: textSweep });
		const root = h.render(
			"<div><h2>[!mystery] ab</h2></div>",
			"## [!mystery] ab",
		);

		assert.strictEqual(root.querySelectorAll(`.${CSS_GRAD_CHAR}`).length, 0);
	});
});

/* -------------------------------------------------------------------------- */
/* Heading references inside links                                            */
/* -------------------------------------------------------------------------- */

/** `[[#[!quiet]]]` as Obsidian renders it: a truncated anchor + a stray `]`. */
const TRUNCATED_LINK =
	`<p><a class="internal-link" data-href="#[!quiet" href="#[!quiet">` +
	`#[!quiet</a>]</p>`;

/** `[[#[!quiet] My Title]]` — parsed cleanly, so nothing to repair. */
const WHOLE_LINK =
	`<p><a class="internal-link" data-href="#[!quiet] My Title" ` +
	`href="#[!quiet] My Title">#[!quiet] My Title</a></p>`;

describe("heading references — navigation repair", () => {
	it("restores the `]` Obsidian's link parser cut off", () => {
		// `[[#[!quiet]]]` ends in a `]]]` run: the parser stops at the FIRST `]]`,
		// so the anchor points at `#[!quiet`, which resolves nothing.
		const h = withQuiet();
		const anchor = one(h.render(TRUNCATED_LINK), "a");

		assert.strictEqual(anchor.getAttribute("data-href"), "#[!quiet]");
		assert.strictEqual(anchor.getAttribute("href"), "#[!quiet]");
	});

	it("swallows the stray `]` the truncation left behind", () => {
		const h = withQuiet();
		const root = h.render(TRUNCATED_LINK);

		assert.strictEqual(root.textContent.includes("]"), false);
	});

	it("repairs even while title cleaning is switched off", () => {
		// Navigation is not cosmetic; only the display half is optional.
		const h = withQuiet();
		h.settings.headingCallouts.refCleanTitles = false;
		const root = h.render(TRUNCATED_LINK);
		const anchor = one(root, "a");

		assert.strictEqual(anchor.getAttribute("data-href"), "#[!quiet]");
		assert.strictEqual(anchor.textContent, "#[!quiet");
		// The stray bracket belongs to the display text, which stays raw.
		assert.ok(root.textContent.endsWith("]"));
	});

	it("is idempotent — a repaired href no longer matches", () => {
		const h = withQuiet();
		const root = h.render(TRUNCATED_LINK);
		h.run(root);

		assert.strictEqual(one(root, "a").getAttribute("data-href"), "#[!quiet]");
	});

	it("leaves a non-truncated reference's href untouched", () => {
		const h = withQuiet();
		const anchor = one(h.render(WHOLE_LINK), "a");

		assert.strictEqual(anchor.getAttribute("data-href"), "#[!quiet] My Title");
	});
});

describe("heading references — display cleaning", () => {
	it("drops the token and puts the callout's icon where it was", () => {
		const h = withQuiet();
		const anchor = one(h.render(WHOLE_LINK), "a");

		assert.strictEqual(anchor.textContent, "My Title");
		assert.ok(hasClass(one(anchor, `.${CSS_REF_TOKEN}`), CSS_REF_TOKEN_LINK));
	});

	it("shows the display name for a title-less reference", () => {
		const h = withQuiet({ displayName: "Library Voice" });
		const anchor = one(h.render(TRUNCATED_LINK), "a");

		assert.strictEqual(anchor.textContent, "Library Voice");
	});

	it("shows what the user wrote when the id is unknown", () => {
		const h = readingHarness();
		const anchor = one(
			h.render(
				`<p><a class="internal-link" data-href="#[!mystery" href="#[!mystery">#[!mystery</a>]</p>`,
			),
			"a",
		);

		assert.strictEqual(anchor.textContent, "mystery");
	});

	it("drops a bare same-file `#`, and keeps a real prefix", () => {
		const h = withQuiet();
		assert.strictEqual(one(h.render(WHOLE_LINK), "a").textContent, "My Title");

		const other = withQuiet();
		const anchor = one(
			other.render(
				`<p><a class="internal-link" data-href="Note#[!quiet] My Title">Note &gt; [!quiet] My Title</a></p>`.replace(
					"&gt;",
					">",
				),
			),
			"a",
		);
		assert.strictEqual(anchor.textContent, "Note > My Title");
	});

	it("draws no icon while reference icons are off", () => {
		const h = withQuiet();
		h.settings.headingCallouts.refShowIcon = false;
		const anchor = one(h.render(WHOLE_LINK), "a");

		assert.strictEqual(anchor.textContent, "My Title");
		assert.strictEqual(anchor.querySelector(`.${CSS_REF_TOKEN}`), null);
	});

	it("leaves the display text raw while title cleaning is off", () => {
		const h = withQuiet();
		h.settings.headingCallouts.refCleanTitles = false;

		assert.strictEqual(
			one(h.render(WHOLE_LINK), "a").textContent,
			"#[!quiet] My Title",
		);
	});
});

describe("heading references — what it leaves alone", () => {
	it("a link inside a native callout's title, even for navigation", () => {
		// Live Preview leaves whole `> [!id]` lines to Obsidian, so reading view
		// does too.
		const h = withQuiet();
		const root = h.render(
			`<div class="callout-title"><a class="internal-link" data-href="#[!quiet" href="#[!quiet">#[!quiet</a>]</div>`,
		);

		assert.strictEqual(one(root, "a").getAttribute("data-href"), "#[!quiet");
		assert.strictEqual(one(root, "a").textContent, "#[!quiet");
	});

	it("an aliased link, whose display text carries no token", () => {
		const h = withQuiet();
		const anchor = one(
			h.render(
				`<p><a class="internal-link" data-href="#[!quiet] My Title">Read this</a></p>`,
			),
			"a",
		);

		assert.strictEqual(anchor.textContent, "Read this");
	});

	it("a link with no heading anchor at all", () => {
		const h = withQuiet();
		const anchor = one(
			h.render(
				`<p><a class="internal-link" data-href="Note">[!quiet] My Title</a></p>`,
			),
			"a",
		);

		assert.strictEqual(anchor.textContent, "[!quiet] My Title");
	});

	it("a reference to a theme-owned callout", () => {
		const h = withQuiet({ externalStyle: true });
		const anchor = one(h.render(WHOLE_LINK), "a");

		assert.strictEqual(anchor.textContent, "#[!quiet] My Title");
	});

	it("every link while the heading role is off", () => {
		const h = withQuiet();
		h.settings.headingCallouts.enabled = false;
		const anchor = one(h.render(WHOLE_LINK), "a");

		assert.strictEqual(anchor.textContent, "#[!quiet] My Title");
		assert.strictEqual(anchor.getAttribute("data-href"), "#[!quiet] My Title");
	});
});

/* -------------------------------------------------------------------------- */
/* Inline pills                                                               */
/* -------------------------------------------------------------------------- */

describe("inline pills", () => {
	it("replaces a mid-line token with a pill carrying the display name", () => {
		const h = withQuiet();
		const root = h.render("<p>see [!quiet] here</p>", "see [!quiet] here");

		assert.strictEqual(root.textContent, "see Quiet here");
		assert.strictEqual(pills(root).length, 1);
		assert.strictEqual(pills(root)[0]?.getAttribute("data-callout"), "quiet");
	});

	it("replaces several tokens in one text node, offsets intact", () => {
		// Replacement runs in reverse so an earlier token's offsets stay valid
		// after a later one split the node.
		const h = withQuiet();
		const root = h.render(
			"<p>a [!quiet] b [!quiet] c</p>",
			"a [!quiet] b [!quiet] c",
		);

		assert.strictEqual(root.textContent, "a Quiet b Quiet c");
		assert.strictEqual(pills(root).length, 2);
	});

	it("carries the metadata and resolves without it", () => {
		const h = withQuiet();
		const root = h.render(
			"<p>see [!quiet|purple] here</p>",
			"see [!quiet|purple] here",
		);
		const pill = pills(root)[0];

		assert.strictEqual(pill?.getAttribute("data-callout"), "quiet");
		assert.strictEqual(pill?.getAttribute("data-callout-metadata"), "purple");
	});

	it("marks an unknown id and labels it with what was written", () => {
		const h = readingHarness();
		const root = h.render("<p>see [!mystery] here</p>", "see [!mystery] here");

		assert.ok(hasClass(pills(root)[0] as FakeElement, CSS_UNKNOWN));
		assert.strictEqual(root.textContent, "see mystery here");
	});

	it("leaves a theme-owned callout as the literal text it already is", () => {
		const h = withQuiet({ externalStyle: true });
		const root = h.render("<p>see [!quiet] here</p>", "see [!quiet] here");

		assert.strictEqual(root.textContent, "see [!quiet] here");
		assert.strictEqual(pills(root).length, 0);
	});

	it("bakes the label's print colours for a swept callout", () => {
		const h = withQuiet({ displayName: "ab", bgGradient: textSweep });
		const root = h.render("<p>see [!quiet] here</p>", "see [!quiet] here");

		assert.strictEqual(root.querySelectorAll(`.${CSS_GRAD_CHAR}`).length, 2);
	});

	it("stays out of code, math, links and native callout titles", () => {
		const h = withQuiet();
		for (const markup of [
			"<p>see <code>[!quiet]</code> here</p>",
			`<p>see <span class="math">[!quiet]</span> here</p>`,
			`<p>see <a href="x">[!quiet]</a> here</p>`,
			`<div class="callout-title">[!quiet] here</div>`,
		]) {
			const root = h.render(markup);
			assert.strictEqual(pills(root).length, 0, markup);
			assert.ok(root.textContent.includes("[!quiet]"), markup);
		}
	});

	it("never degrades a heading's own token into a pill", () => {
		// The heading transform declined this one (the source says it is a quoted
		// line), and a token at the start of a heading is heading-role by
		// definition — an inline pill there would be a different callout syntax
		// than the user wrote.
		const h = withQuiet();
		const root = h.render(
			"<blockquote><h2>[!quiet] My title</h2></blockquote>",
			"> # [!quiet] My title",
		);

		assert.strictEqual(pills(root).length, 0);
		assert.strictEqual(one(root, "h2").textContent, "[!quiet] My title");
	});

	it("still pills a genuine token inside a heading's title", () => {
		const h = withQuiet();
		const root = h.render(
			"<div><h2>[!quiet] Title with [!quiet] inside</h2></div>",
			"## [!quiet] Title with [!quiet] inside",
		);

		assert.strictEqual(pills(root).length, 1);
		// The heading's own token draws no name (the title is right there); the
		// pill inside the title does.
		assert.strictEqual(one(root, "h2").textContent, "Title with Quiet inside");
		assert.ok(one(root, `.${CSS_HEADING_TITLE}`).querySelector(`.${CSS_INLINE_TOKEN}`));
	});

	it("leaves a heading's token raw when the heading role is off", () => {
		// Turning the role off must stop the BAR, not swap it for a pill. Live
		// Preview `continue`s on `role === "heading"` and leaves the raw `[!id]`
		// standing, so the guard that keeps a heading's own token out of this
		// pass has to hold whether the role is on or off — otherwise the same
		// note reads two different ways on the two surfaces.
		const h = withQuiet();
		h.settings.headingCallouts.enabled = false;
		const root = h.render(
			"<div><h2>[!quiet] My title</h2></div>",
			"## [!quiet] My title",
		);

		assert.strictEqual(pills(root).length, 0);
		assert.strictEqual(one(root, "h2").textContent, "[!quiet] My title");
	});

	it("leaves it raw with no source line to consult either", () => {
		// The embed / PDF-export path: `getSectionInfo` answers null, so the
		// guard is the only thing standing between the heading token and a pill.
		const h = withQuiet();
		h.settings.headingCallouts.enabled = false;
		const root = h.render("<div><h2>[!quiet] My title</h2></div>");

		assert.strictEqual(pills(root).length, 0);
		assert.strictEqual(one(root, "h2").textContent, "[!quiet] My title");
	});
});

describe("inline pills — escaped tokens", () => {
	it("renders the real token and leaves the escaped one as text", () => {
		const h = withQuiet();
		const root = h.render(
			"<p>a [!quiet] b [!quiet] c</p>",
			"a \\[!quiet] b [!quiet] c",
		);

		assert.strictEqual(root.textContent, "a [!quiet] b Quiet c");
		assert.strictEqual(pills(root).length, 1);
	});

	it("pairs by ordinal position, so the escape can come second", () => {
		const h = withQuiet();
		const root = h.render(
			"<p>a [!quiet] b [!quiet] c</p>",
			"a [!quiet] b \\[!quiet] c",
		);

		assert.strictEqual(root.textContent, "a Quiet b [!quiet] c");
	});

	it("skips the pairing pass entirely when the source has no `\\[!`", () => {
		const h = withQuiet();
		const root = h.render("<p>a [!quiet] b</p>", "a [!quiet] b");

		assert.strictEqual(root.textContent, "a Quiet b");
	});

	it("preserves literal text when source and DOM disagree on the count", () => {
		const h = withQuiet();
		const root = h.render("<p>a [!quiet] b</p>", "a \\[!quiet] b \\[!quiet] c");
		assert.strictEqual(root.textContent, "a [!quiet] b");
		assert.strictEqual(pills(root).length, 0);
	});

	it("preserves text when equal counts have different token identities", () => {
		const h = withQuiet();
		const root = h.render("<p>[!quiet] [!warning]</p>", "\\[!warning] [!quiet]");
		assert.strictEqual(root.textContent, "[!quiet] [!warning]");
		assert.strictEqual(pills(root).length, 0);
	});

	it("pairs metadata with its token before splitting content", () => {
		const h = withQuiet();
		const root = h.render(
			"<p>[!quiet|one]{payload} [!quiet|two] [!quiet|three]</p>",
			"[!quiet|one]{payload} \\[!quiet|two] [!quiet|three]",
		);
		assert.strictEqual(root.textContent, "payload [!quiet|two] Quiet");
		assert.strictEqual(pills(root).length, 2);
		assert.strictEqual(pills(root)[1]?.getAttribute("data-callout-metadata"), "three");
	});

	it("renders everything when there is no source to pair against", () => {
		const h = withQuiet();
		const root = h.render("<p>a [!quiet] b</p>");

		assert.strictEqual(root.textContent, "a Quiet b");
	});

	it("ignores an escape hidden inside inline code", () => {
		// `stripInlineCode` blanks it on the source side; the DOM side never sees
		// it either, because `code` is excluded from the pill walk.
		const h = withQuiet();
		const root = h.render(
			"<p>a <code>\\[!quiet]</code> b [!quiet] c</p>",
			"a `\\[!quiet]` b [!quiet] c",
		);

		assert.strictEqual(pills(root).length, 1);
		assert.strictEqual(root.textContent, "a \\[!quiet] b Quiet c");
	});
});

/* -------------------------------------------------------------------------- */
/* Content pills                                                              */
/* -------------------------------------------------------------------------- */

describe("content pills", () => {
	/** The payload element of the block's one content pill. */
	function payload(root: FakeElement): FakeElement {
		return one(root, `.${CSS_CALLOUT_PAYLOAD}`);
	}

	it("wraps `[!id]{text}` into one pill whose label is the payload", () => {
		const h = withQuiet();
		const root = h.render(
			"<p>x [!quiet]{be careful} y</p>",
			"x [!quiet]{be careful} y",
		);

		assert.strictEqual(root.textContent, "x be careful y");
		assert.ok(hasClass(pills(root)[0] as FakeElement, CSS_INLINE_HAS_CONTENT));
		assert.strictEqual(payload(root).textContent, "be careful");
	});

	it("drops the callout's own name — the payload IS the label", () => {
		const h = withQuiet();
		const root = h.render("<p>[!quiet]{words}</p>", "[!quiet]{words}");

		assert.strictEqual(root.textContent.includes("Quiet"), false);
	});

	it("MOVES the rendered markup in rather than re-rendering it", () => {
		// This is the whole reason the payload keeps working links, code spans and
		// bold: Obsidian already rendered them, and those nodes are relocated.
		const h = withQuiet();
		const root = h.render(
			"<p>[!quiet]{a <strong>b</strong> c} d</p>",
			"[!quiet]{a **b** c} d",
		);

		assert.strictEqual(payload(root).textContent, "a b c");
		assert.strictEqual(one(payload(root), "strong").textContent, "b");
		assert.strictEqual(root.textContent, "a b c d");
	});

	it("counts nested braces, so `{a {b} c}` is one payload", () => {
		const h = withQuiet();
		const root = h.render("<p>[!quiet]{a {b} c} d</p>", "[!quiet]{a {b} c} d");

		assert.strictEqual(payload(root).textContent, "a {b} c");
	});

	it("ignores braces inside an opaque subtree", () => {
		// Parity contract with Live Preview, which blanks inline code before
		// counting: a `}` in a code span closes nothing on either surface.
		const h = withQuiet();
		const root = h.render(
			"<p>[!quiet]{a <code>}</code> b} c</p>",
			"[!quiet]{a `}` b} c",
		);

		assert.strictEqual(payload(root).textContent, "a } b");
		assert.strictEqual(root.textContent, "a } b c");
	});

	it("builds several pills in one block", () => {
		const h = withQuiet();
		const root = h.render(
			"<p>[!quiet]{one} and [!quiet]{two}</p>",
			"[!quiet]{one} and [!quiet]{two}",
		);

		assert.strictEqual(pills(root).length, 2);
		assert.deepStrictEqual(
			root.querySelectorAll(`.${CSS_CALLOUT_PAYLOAD}`).map((p) => p.textContent),
			["one", "two"],
		);
	});

	it("preserves escape pairing after it has built content pills", () => {
		const h = withQuiet();
		const root = h.render(
			"<p>[!quiet] text [!quiet]{payload}</p>",
			"\\[!quiet] text [!quiet]{payload}",
		);
		assert.strictEqual(pills(root).length, 1);
		assert.strictEqual(root.textContent, "[!quiet] text payload");
		assert.strictEqual(h.sectionReads(), 1);
	});

	it("leaves an escaped content token and its payload literal", () => {
		const h = withQuiet();
		const root = h.render("<p>[!quiet]{literal}</p>", "\\[!quiet]{literal}");
		assert.strictEqual(pills(root).length, 0);
		assert.strictEqual(root.textContent, "[!quiet]{literal}");
	});

	it("keeps source positions after same-node content and plain splits", () => {
		const h = withQuiet();
		const root = h.render(
			"<p>[!quiet]{one} [!quiet] [!quiet] [!quiet]{two} [!quiet]{literal}</p>",
			"[!quiet]{one} \\[!quiet] [!quiet] [!quiet]{two} \\[!quiet]{literal}",
		);
		assert.strictEqual(pills(root).length, 3);
		assert.strictEqual(root.textContent, "one [!quiet] Quiet two [!quiet]{literal}");
	});

	it("keeps source positions when content moves formatted siblings", () => {
		const h = withQuiet();
		const root = h.render(
			"<p>[!quiet]{one <strong>bold</strong> tail} [!quiet] [!quiet]{two}</p>",
			"[!quiet]{one **bold** tail} \\[!quiet] [!quiet]{two}",
		);
		assert.strictEqual(pills(root).length, 2);
		assert.strictEqual(root.textContent, "one bold tail [!quiet] two");
		assert.strictEqual(one(root, "strong").textContent, "bold");
	});

	it("accounts for literal nested tokens consumed by a content pill", () => {
		const h = withQuiet();
		const root = h.render(
			"<p>[!quiet]{one [!quiet]} [!quiet] [!quiet]</p>",
			"[!quiet]{one \\[!quiet]} \\[!quiet] [!quiet]",
		);
		assert.strictEqual(pills(root).length, 2);
		assert.strictEqual(root.textContent, "one [!quiet] [!quiet] Quiet");
	});

});

describe("content pills — the shapes it refuses", () => {
	it("an empty payload, which the plain pill renders better", () => {
		// Widened over the braces, so `{}` does not survive as stray text.
		const h = withQuiet();
		const root = h.render("<p>x [!quiet]{} y</p>", "x [!quiet]{} y");

		assert.strictEqual(root.textContent, "x Quiet y");
		assert.strictEqual(
			hasClass(pills(root)[0] as FakeElement, CSS_INLINE_HAS_CONTENT),
			false,
		);
	});

	it("a payload still being typed — no pill at all, not even a plain one", () => {
		const h = withQuiet();
		const root = h.render("<p>x [!quiet]{oops</p>", "x [!quiet]{oops");

		assert.strictEqual(pills(root).length, 0);
		assert.strictEqual(root.textContent, "x [!quiet]{oops");
	});

	it("a payload that would close inside nested markup", () => {
		// `[!quiet]{a **b}**` — wrapping it would have to tear the `<strong>` in
		// half, so the raw text stays instead.
		const h = withQuiet();
		const root = h.render(
			"<p>[!quiet]{a <strong>b}</strong> c</p>",
			"[!quiet]{a **b}** c",
		);

		assert.strictEqual(pills(root).length, 0);
		assert.ok(root.textContent.startsWith("[!quiet]{a b}"));
	});

	it("a payload interrupted by a soft line break", () => {
		// Live Preview scans one line at a time, so a payload could never span a
		// `<br>` there either.
		const h = withQuiet();
		const root = h.render("<p>[!quiet]{a<br>b}</p>", "[!quiet]{a\nb}");

		assert.strictEqual(pills(root).length, 0);
		assert.ok(root.textContent.startsWith("[!quiet]{a"));
	});

	it("a `{` that does not sit directly on the `]`", () => {
		// Prose uses braces freely; `[!quiet] {x}` is a plain pill and literal text.
		const h = withQuiet();
		const root = h.render("<p>[!quiet] {x}</p>", "[!quiet] {x}");

		assert.strictEqual(root.textContent, "Quiet {x}");
		assert.strictEqual(
			hasClass(pills(root)[0] as FakeElement, CSS_INLINE_HAS_CONTENT),
			false,
		);
	});

	it("every payload while allowContent is off", () => {
		// The pre-2.9 reading of the line, exactly: a plain pill and literal text.
		const h = withQuiet();
		h.settings.inlineCallouts.allowContent = false;
		const root = h.render(
			"<p>x [!quiet]{be careful} y</p>",
			"x [!quiet]{be careful} y",
		);

		assert.strictEqual(root.textContent, "x Quiet{be careful} y");
		assert.strictEqual(root.querySelector(`.${CSS_CALLOUT_PAYLOAD}`), null);
	});

	it("a payload on a theme-owned callout", () => {
		const h = withQuiet({ externalStyle: true });
		const root = h.render(
			"<p>x [!quiet]{be careful} y</p>",
			"x [!quiet]{be careful} y",
		);

		assert.strictEqual(root.textContent, "x [!quiet]{be careful} y");
	});

	it("everything while the inline role is off", () => {
		const h = withQuiet();
		h.settings.inlineCallouts.enabled = false;
		const root = h.render(
			"<p>x [!quiet]{be careful} y</p>",
			"x [!quiet]{be careful} y",
		);

		assert.strictEqual(root.textContent, "x [!quiet]{be careful} y");
	});

	it("a heading's own token, even with the heading role off", () => {
		// Same guard as the plain-pill pass, and for the same reason: with the
		// role off the heading transform never runs, so this pass is what stands
		// between `## [!quiet]{x}` and a content pill Live Preview would never
		// draw. The inline role is still on here — that is the whole point.
		const h = withQuiet();
		h.settings.headingCallouts.enabled = false;
		const root = h.render(
			"<div><h2>[!quiet]{shhh} My title</h2></div>",
			"## [!quiet]{shhh} My title",
		);

		assert.strictEqual(pills(root).length, 0);
		assert.strictEqual(root.querySelector(`.${CSS_CALLOUT_PAYLOAD}`), null);
		assert.strictEqual(
			one(root, "h2").textContent,
			"[!quiet]{shhh} My title",
		);
	});
});

describe("content pills — what survives pass A", () => {
	/**
	 * The plain-pill pass refuses a token whose payload is non-empty, because
	 * widening a pill over `{…}` would swallow the payload instead of rendering
	 * it. Reaching that guard at all takes some doing, and the two ways below
	 * are the whole list — which is what makes them worth pinning:
	 *
	 * The shapes pass A *refuses across siblings* (interleaved markup, a `<br>`,
	 * a block element) never arrive as a closed payload at all: the `}` is then
	 * in another node, so scanning this node alone reports `contentOpen` and the
	 * line above it takes them first. Neither does anything while `allowContent`
	 * is off — the scan is told not to parse payloads, so no token carries one.
	 */
	it("a payload pass A could not balance inside one node", () => {
		// Pass A counts braces in the raw node text; the scan that classified
		// the token blanks inline code first. An escaped backtick span carrying
		// an unmatched `{` is where the two disagree — the scan closes the
		// payload at the final `}`, pass A's walk never gets back to depth zero.
		const h = withQuiet();
		const root = h.render(
			"<p>[!quiet]{a `x{` b} tail</p>",
			"[!quiet]{a \\`x{\\` b} tail",
		);

		assert.strictEqual(pills(root).length, 0);
		assert.strictEqual(root.textContent, "[!quiet]{a `x{` b} tail");
	});

	it("everything past pass A's 256-splice cap", () => {
		// Pass A restarts its walk after every splice and is bounded at 256, so
		// a block with more payloads than that hands the remainder on with the
		// payload still closed. The 257th stays the author's own text.
		const h = withQuiet();
		const root = h.render(`<p>${"[!quiet]{x} ".repeat(257)}</p>`);

		assert.strictEqual(
			root.querySelectorAll(`.${CSS_CALLOUT_PAYLOAD}`).length,
			256,
		);
		assert.strictEqual(pills(root).length, 256);
		assert.ok(root.textContent.endsWith("[!quiet]{x} "));
	});
});

/* -------------------------------------------------------------------------- */
/* The entry point's own shape                                                */
/* -------------------------------------------------------------------------- */

describe("the heading passes share one branch", () => {
	// Nothing behavioural separates one `if (headingEnabled)` from two running
	// back to back, which is exactly why only the source can catch it: both
	// heading passes answer to the one setting, and a second branch on it reads
	// as a second condition. The cost is paid later — the next pass gets added
	// under whichever branch is nearest, and the two are then one edit away from
	// disagreeing about when the role is on.
	const file = pluginSourceFiles().find(
		(f) => f.path === "src/reading/calloutPostProcessor.ts",
	);

	it("is still the file this suite is about", () => {
		assert.ok(file, "src/reading/calloutPostProcessor.ts moved or is gone");
	});

	it("branches on `headingEnabled` exactly once", () => {
		// `file.code` has comments and string bodies blanked, so a mention of
		// the branch in prose above it cannot be mistaken for the branch itself.
		const hits = (file?.code ?? "").match(/if\s*\(\s*headingEnabled\s*\)/g);

		assert.strictEqual(
			hits?.length,
			1,
			`the post-processor tests headingEnabled ${hits?.length ?? 0} times — ` +
				"the heading transform and the reference repair belong in one block",
		);
	});
});
