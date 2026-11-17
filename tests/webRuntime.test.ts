/**
 * tests/webRuntime.test.ts — the renderer that draws heading and inline
 * callouts outside Obsidian (`src/web/core.ts`), and the host that runs it in
 * a browser (`src/web/browser.ts`).
 *
 * It is the third render surface and the one with the least to go on: no
 * registry, no icon packs, no source line, and a page it does not own. So what
 * is pinned here is what follows from each of those:
 *
 * - **The snapshot resolves like the registry.** An id, an alias and either in
 *   its attribute form must find the same callout, stamp the same
 *   `data-callout` and show the same label a note does — the stylesheet beside
 *   it selects on exactly those spellings.
 * - **A heading keeps its element, its id and its platform's furniture.**
 *   Quartz hangs an anchor link off every heading and styles it through a
 *   child combinator; Publish appends a copy-link button. The title wrapper
 *   stops before either, and neither makes a title-less heading look titled.
 * - **Only the author's content is touched.** A token in a site's navigation
 *   stays text, a table of contents is cleaned rather than pilled, and a block
 *   callout the platform has not converted yet is left for the platform.
 * - **A second pass changes nothing.** That is the whole reason one mutation
 *   observer can stand in for every platform's navigation and lazy rendering.
 * - **The build-time DOM gives the same answer.** Quartz and Digital Garden
 *   run this renderer on `web/static/liteDom.ts`, which implements only what
 *   the renderer calls. Every case that goes through {@link render} is run
 *   over that DOM too and the two results compared, so a DOM member the
 *   renderer starts using and `liteDom` lacks fails here, not on someone's
 *   site.
 *
 * Parity with reading view — same markup in, same DOM out — is asserted in
 * `webExport.test.ts`, where a real registry builds the data.
 */
import assert from "node:assert";
import { afterEach, describe, it } from "node:test";
// Listed first: importing it installs the DOM globals before anything under
// test loads (see tests/support/fakeDom.ts).
import { asEl, fakeDom, html, type FakeElement } from "./support/fakeDom";
import { installFakeDomParser } from "./support/fakeDomParser";
import {
	CSS_CALLOUT_LEAD,
	CSS_CALLOUT_PAYLOAD,
	CSS_HEADING_LINE,
	CSS_HEADING_TITLE,
	CSS_HEADING_TITLE_GAP,
	CSS_HEADING_TOKEN,
	CSS_INLINE_HAS_CONTENT,
	CSS_INLINE_TOKEN,
	CSS_TOKEN_EMPTY,
	CSS_TOKEN_ICON,
	CSS_TOKEN_NAME,
	CSS_UNKNOWN,
} from "../src/editor/tokenClasses";
import * as renderShared from "../src/editor/renderShared";
import * as tokenClasses from "../src/editor/tokenClasses";
import { sweep } from "../src/web/browser";
import * as core from "../src/web/core";
import { createWebRenderer, type WebRenderer } from "../src/web/core";
import { parseFragment, parseIconNodes, serializeFragment } from "../src/web/static/htmlFragment";
import type { WebBundleData } from "../src/web/webBundleData";

/* -------------------------------------------------------------------------- */
/* Harness                                                                    */
/* -------------------------------------------------------------------------- */

// The runtime parses a baked icon with `DOMParser`, which a browser has and
// Node does not — see tests/support/fakeDomParser.ts for why it is not global.
installFakeDomParser();

/** A bundle with one of each kind of callout the lookups have to tell apart. */
function bundle(over: Partial<WebBundleData> = {}): WebBundleData {
	return {
		version: 1,
		heading: true,
		inline: true,
		content: true,
		fallback: "note",
		defs: [
			{ id: "note", name: "Note", icon: '<svg class="i-note"></svg>' },
			{
				id: "quiet",
				name: "Quiet",
				aliases: ["hush", "banner icon"],
				icon: '<svg class="i-quiet"></svg>',
				headingIcon: '<svg class="i-quiet-heading"></svg>',
			},
			{ id: "bare", name: "Bare", hideIcon: true },
			{ id: "multi word", name: "Multi word", icon: "🔥" },
		],
		css: ".cs-inline-callout{}",
		...over,
	};
}

const renderer = (over: Partial<WebBundleData> = {}): WebRenderer => createWebRenderer(bundle(over));

/**
 * The same pass over the build-time DOM: parsed by the fragment parser, turned
 * by the same renderer, printed again.
 */
function renderStatic(markup: string, over: Partial<WebBundleData> = {}): string {
	const root = parseFragment(markup);
	createWebRenderer(bundle(over), {
		parseIcon: (icon) => parseIconNodes(icon) as unknown as Node[],
	}).process(root as unknown as HTMLElement);
	return serializeFragment(root);
}

/**
 * Parse `markup`, run one pass over it, hand the root back — having checked
 * that the build-time DOM turns the same markup into the same elements.
 */
function render(markup: string, over: Partial<WebBundleData> = {}): FakeElement {
	const root = html(markup);
	renderer(over).process(asEl(root));
	assert.strictEqual(
		html(renderStatic(markup, over)).outerHTML,
		root.outerHTML,
		`liteDom and the DOM disagree about ${markup}`,
	);
	return root;
}

const pills = (root: FakeElement): FakeElement[] => root.querySelectorAll(`.${CSS_INLINE_TOKEN}`);

function one(root: FakeElement, selector: string): FakeElement {
	const found = root.querySelector(selector);
	assert.ok(found, `no ${selector} in ${root.outerHTML}`);
	return found;
}

const hasClass = (element: FakeElement, cls: string): boolean => element.classList.contains(cls);

/* -------------------------------------------------------------------------- */
/* The class names                                                            */
/* -------------------------------------------------------------------------- */

describe("the class names the three surfaces share", () => {
	it("are the same strings whichever module a builder imports them from", () => {
		// `renderShared` re-exports `tokenClasses`; the runtime can only import
		// the latter. A constant redefined in either would split the surfaces.
		const shared = renderShared as unknown as Record<string, unknown>;
		for (const [name, value] of Object.entries(tokenClasses)) {
			assert.strictEqual(shared[name], value, `${name} differs between the two modules`);
		}
	});
});

/* -------------------------------------------------------------------------- */
/* Inline pills                                                               */
/* -------------------------------------------------------------------------- */

describe("an inline token", () => {
	it("becomes a pill carrying the icon and the callout's name", () => {
		const root = render("<p>see [!quiet] here</p>");
		const pill = one(root, `.${CSS_INLINE_TOKEN}`);
		assert.strictEqual(pill.getAttribute("data-callout"), "quiet");
		assert.strictEqual(one(pill, `.${CSS_TOKEN_NAME}`).textContent, "Quiet");
		assert.strictEqual(one(pill, `.${CSS_TOKEN_ICON}`).innerHTML, '<svg class="i-quiet"></svg>');
		assert.strictEqual(root.textContent, "see Quiet here");
	});

	it("resolves an alias and labels it as Obsidian titles that spelling", () => {
		const pill = one(render("<p>[!hush]</p>"), `.${CSS_INLINE_TOKEN}`);
		assert.strictEqual(pill.getAttribute("data-callout"), "hush");
		assert.strictEqual(one(pill, `.${CSS_TOKEN_NAME}`).textContent, "Hush");
	});

	it("stamps the stored spelling when only the attribute form matched", () => {
		// `[!multi-word]` is the callout `multi word`; no generated selector
		// carries the dashed spelling, so the attribute must be the id.
		const byId = one(render("<p>[!multi-word]</p>"), `.${CSS_INLINE_TOKEN}`);
		assert.strictEqual(byId.getAttribute("data-callout"), "multi word");
		assert.strictEqual(one(byId, `.${CSS_TOKEN_NAME}`).textContent, "Multi word");

		const byAlias = one(render("<p>[!banner-icon]</p>"), `.${CSS_INLINE_TOKEN}`);
		assert.strictEqual(byAlias.getAttribute("data-callout"), "banner icon");
	});

	it("draws an unknown id with the fallback's icon and its own spelling", () => {
		const pill = one(render("<p>[!Nope]</p>"), `.${CSS_INLINE_TOKEN}`);
		assert.ok(hasClass(pill, CSS_UNKNOWN));
		assert.strictEqual(pill.getAttribute("data-callout"), "nope");
		assert.strictEqual(one(pill, `.${CSS_TOKEN_NAME}`).textContent, "Nope");
		assert.strictEqual(one(pill, `.${CSS_TOKEN_ICON}`).innerHTML, '<svg class="i-note"></svg>');
	});

	it("keeps the metadata on the pill and out of the id", () => {
		const pill = one(render("<p>[!quiet|purple wide]</p>"), `.${CSS_INLINE_TOKEN}`);
		assert.strictEqual(pill.getAttribute("data-callout"), "quiet");
		assert.strictEqual(pill.getAttribute("data-callout-metadata"), "purple wide");
	});

	it("builds no icon span at all for a callout that hides its icon", () => {
		const pill = one(render("<p>[!bare]</p>"), `.${CSS_INLINE_TOKEN}`);
		assert.strictEqual(pill.querySelector(`.${CSS_TOKEN_ICON}`), null);
		assert.strictEqual(one(pill, `.${CSS_TOKEN_NAME}`).textContent, "Bare");
	});

	it("turns every token in a text node, adjacent ones included", () => {
		const root = render("<p>[!note][!quiet] and [!note]</p>");
		assert.deepStrictEqual(
			pills(root).map((p) => p.getAttribute("data-callout")),
			["note", "quiet", "note"],
		);
	});

	it("leaves code, links and a block callout's title alone", () => {
		const root = render(
			"<div>" +
				"<p>inline <code>[!quiet]</code></p>" +
				"<pre>[!quiet]</pre>" +
				'<p><a href="x">[!quiet]</a></p>' +
				'<div class="callout-title">[!quiet]</div>' +
				"</div>",
		);
		assert.strictEqual(pills(root).length, 0);
	});

	it("stays literal while the inline role is off", () => {
		const root = render("<p>see [!quiet] here</p>", { inline: false });
		assert.strictEqual(root.textContent, "see [!quiet] here");
	});

	it("leaves the token that opens a blockquote: that is a block callout's header", () => {
		// Digital Garden converts `> [!tip] Title` after this renderer has run,
		// by finding this very text. A pill here would leave a plain quotation.
		const root = render(
			"<div>" +
				"<blockquote>\n<p>[!quiet] A block callout<br>with [!note] in its body</p>\n</blockquote>" +
				"<blockquote><p>[!quiet]{not a payload either}</p></blockquote>" +
				"<blockquote><p>a quotation that mentions [!quiet]</p></blockquote>" +
				"</div>",
		);
		const quotes = root.querySelectorAll("blockquote");
		assert.ok((quotes[0]?.textContent ?? "").includes("[!quiet] A block callout"));
		assert.deepStrictEqual(
			pills(quotes[0] as FakeElement).map((p) => p.getAttribute("data-callout")),
			["note"],
		);
		assert.strictEqual(pills(quotes[1] as FakeElement).length, 0);
		assert.strictEqual(pills(quotes[2] as FakeElement).length, 1);
	});
});

/* -------------------------------------------------------------------------- */
/* Content pills                                                              */
/* -------------------------------------------------------------------------- */

describe("a `{…}` payload", () => {
	it("moves the rendered nodes into the pill instead of re-rendering them", () => {
		const root = html("<p>an [!quiet]{inline <strong>bold</strong> text} here</p>");
		const strong = one(root, "strong");
		renderer().process(asEl(root));

		const pill = one(root, `.${CSS_INLINE_TOKEN}`);
		assert.ok(hasClass(pill, CSS_INLINE_HAS_CONTENT));
		const payload = one(pill, `.${CSS_CALLOUT_PAYLOAD}`);
		assert.strictEqual(payload.textContent, "inline bold text");
		// The very element the page's renderer produced, not a copy of it.
		assert.strictEqual(one(payload, "strong"), strong);
		const lead = one(pill, `.${CSS_CALLOUT_LEAD}`);
		assert.strictEqual(one(lead, `.${CSS_TOKEN_ICON}`).innerHTML, '<svg class="i-quiet"></svg>');
		assert.strictEqual(root.textContent, "an inline bold text here");
	});

	it("shows no name: the payload is the label", () => {
		const pill = one(render("<p>[!quiet]{be careful}</p>"), `.${CSS_INLINE_TOKEN}`);
		assert.strictEqual(pill.querySelector(`.${CSS_TOKEN_NAME}`), null);
		assert.strictEqual(pill.textContent, "be careful");
	});

	it("marks the lead empty when the callout hides its icon", () => {
		const lead = one(render("<p>[!bare]{text}</p>"), `.${CSS_CALLOUT_LEAD}`);
		assert.ok(hasClass(lead, CSS_TOKEN_EMPTY));
		assert.strictEqual(lead.childNodes.length, 0);
	});

	it("needs the brace to touch the bracket", () => {
		const root = render("<p>[!quiet] {not a payload}</p>");
		assert.strictEqual(root.textContent, "Quiet {not a payload}");
		assert.strictEqual(root.querySelector(`.${CSS_CALLOUT_PAYLOAD}`), null);
	});

	it("refuses a payload that would close inside nested markup", () => {
		const root = render("<p>[!quiet]{open <em>and close} inside</em></p>");
		assert.strictEqual(root.querySelector(`.${CSS_CALLOUT_PAYLOAD}`), null);
		assert.strictEqual(pills(root).length, 0);
	});

	it("widens a plain pill over an empty `{}`", () => {
		const root = render("<p>a [!quiet]{} b</p>");
		assert.strictEqual(root.textContent, "a Quiet b");
	});

	it("is ordinary text while payloads are switched off", () => {
		const root = render("<p>[!quiet]{be careful}</p>", { content: false });
		assert.strictEqual(root.textContent, "Quiet{be careful}");
	});
});

/* -------------------------------------------------------------------------- */
/* Headings                                                                   */
/* -------------------------------------------------------------------------- */

describe("a heading that opens with a token", () => {
	it("is restyled in place, keeping its element and its id", () => {
		const root = html('<div><h2 id="tip-my-title">[!quiet] My title</h2></div>');
		const h = one(root, "h2");
		renderer().process(asEl(root));

		assert.strictEqual(one(root, "h2"), h);
		assert.strictEqual(h.getAttribute("id"), "tip-my-title");
		assert.ok(hasClass(h, CSS_HEADING_LINE));
		assert.strictEqual(h.getAttribute("data-callout"), "quiet");
		const token = one(h, `.${CSS_HEADING_TOKEN}`);
		// A titled heading shows the icon only; the title speaks for itself.
		assert.strictEqual(token.querySelector(`.${CSS_TOKEN_NAME}`), null);
		assert.strictEqual(one(token, `.${CSS_TOKEN_ICON}`).innerHTML, '<svg class="i-quiet-heading"></svg>');
		const title = one(h, `.${CSS_HEADING_TITLE}`);
		assert.strictEqual(title.textContent, "My title");
		assert.ok(hasClass(title, CSS_HEADING_TITLE_GAP));
	});

	it("shows the callout's name when the heading has no title of its own", () => {
		const h = one(render("<div><h3>[!quiet]</h3></div>"), "h3");
		assert.strictEqual(one(h, `.${CSS_TOKEN_NAME}`).textContent, "Quiet");
		assert.strictEqual(h.querySelector(`.${CSS_HEADING_TITLE}`), null);
	});

	it("falls back to the inline icon when the pack draws one size", () => {
		const h = one(render("<div><h2>[!note] T</h2></div>"), "h2");
		assert.strictEqual(one(h, `.${CSS_TOKEN_ICON}`).innerHTML, '<svg class="i-note"></svg>');
	});

	it("wraps inline markup in the title too", () => {
		const h = one(render("<div><h2>[!quiet] <strong>Bold</strong> title</h2></div>"), "h2");
		const title = one(h, `.${CSS_HEADING_TITLE}`);
		assert.strictEqual(title.textContent, "Bold title");
		assert.ok(title.querySelector("strong"));
	});

	it("keeps the metadata, and marks an unknown id", () => {
		const root = render("<div><h2>[!quiet|purple] T</h2><h2>[!nope] T</h2></div>");
		const [known, unknown] = root.querySelectorAll("h2");
		assert.strictEqual(known?.getAttribute("data-callout-metadata"), "purple");
		assert.ok(unknown && hasClass(unknown, CSS_UNKNOWN));
	});

	it("is handled when the heading itself is the root", () => {
		const h = render("<h2>[!quiet] Alone</h2>");
		assert.ok(hasClass(h, CSS_HEADING_LINE));
	});

	it("leaves a heading that merely contains a token to the inline pass", () => {
		const h = one(render("<div><h2>About [!quiet] things</h2></div>"), "h2");
		assert.ok(!hasClass(h, CSS_HEADING_LINE));
		assert.strictEqual(pills(h).length, 1);
	});

	it("stays raw, and is not pilled either, while the heading role is off", () => {
		const root = render("<div><h2>[!quiet] My title</h2></div>", { heading: false });
		assert.strictEqual(root.textContent, "[!quiet] My title");
		assert.strictEqual(pills(root).length, 0);
	});
});

describe("a platform's furniture on a heading", () => {
	const QUARTZ_ANCHOR = '<a role="anchor" aria-hidden="true" href="#x"><svg></svg></a>';

	it("stays a direct child of the heading, outside the title", () => {
		// Quartz styles it as `h2[id] > a[href^="#"]`.
		const h = one(render(`<div><h2 id="x">[!quiet] Title${QUARTZ_ANCHOR}</h2></div>`), "h2");
		const anchor = one(h, "a");
		assert.strictEqual(anchor.parentNode, h);
		assert.strictEqual(one(h, `.${CSS_HEADING_TITLE}`).textContent, "Title");
	});

	it("does not make a title-less heading look titled", () => {
		const h = one(render(`<div><h2 id="x">[!quiet]${QUARTZ_ANCHOR}</h2></div>`), "h2");
		assert.strictEqual(one(h, `.${CSS_TOKEN_NAME}`).textContent, "Quiet");
		assert.strictEqual(h.querySelector(`.${CSS_HEADING_TITLE}`), null);
	});

	it("is skipped when it comes first, as Publish's fold arrow does", () => {
		const h = one(render('<div><h2><div class="heading-collapse-indicator"></div>[!quiet] Title</h2></div>'), "h2");
		assert.ok(hasClass(h, CSS_HEADING_LINE));
		assert.strictEqual(one(h, `.${CSS_HEADING_TITLE}`).textContent, "Title");
	});

	it("is left behind by Publish's copy-link button and the space before it", () => {
		const h = one(render('<div><h2>[!quiet] Title <span class="clickable-icon"></span></h2></div>'), "h2");
		assert.strictEqual(one(h, ".clickable-icon").parentNode, h);
	});
});

/* -------------------------------------------------------------------------- */
/* Idempotence                                                                */
/* -------------------------------------------------------------------------- */

describe("a second pass", () => {
	it("changes nothing", () => {
		const root = html(
			"<article>" +
				"<h2>[!quiet] Title</h2>" +
				"<h3>[!note]</h3>" +
				"<p>a [!quiet] b [!note]{c <em>d</em>} e <code>[!quiet]</code></p>" +
				"</article>",
		);
		const web = renderer();
		web.process(asEl(root));
		const once = root.outerHTML;
		web.process(asEl(root));
		assert.strictEqual(root.outerHTML, once);
	});
});

/* -------------------------------------------------------------------------- */
/* Tables of contents                                                         */
/* -------------------------------------------------------------------------- */

describe("a table of contents", () => {
	const clean = (markup: string, over: Partial<WebBundleData> = {}): FakeElement => {
		const toc = html(markup);
		renderer(over).cleanToc(asEl(toc));
		return toc;
	};

	it("drops the token from an entry that has a title", () => {
		const toc = clean('<div class="toc"><a href="#a">[!quiet] My title</a></div>');
		assert.strictEqual(one(toc, "a").textContent, "My title");
	});

	it("names the callout for an entry that is only a token", () => {
		const toc = clean('<div class="toc"><a href="#a">[!quiet]</a><a href="#b">[!hush]</a></div>');
		assert.deepStrictEqual(
			toc.querySelectorAll("a").map((a) => a.textContent),
			["Quiet", "Hush"],
		);
	});

	it("reads Publish's bracketless form, but only for a callout that exists", () => {
		const toc = clean(
			'<div class="outline-view">' +
				'<div class="tree-item-inner">!quiet My title</div>' +
				'<div class="tree-item-inner">!multi word Section</div>' +
				'<div class="tree-item-inner">!important Read this</div>' +
				"</div>",
		);
		assert.deepStrictEqual(
			toc.querySelectorAll(".tree-item-inner").map((item) => item.textContent),
			["My title", "Section", "!important Read this"],
		);
	});

	it("keeps an entry's surrounding whitespace and ignores a token mid-entry", () => {
		const toc = clean('<div class="toc"><a href="#a">  [!quiet] T</a><a href="#b">About [!quiet]</a></div>');
		assert.deepStrictEqual(
			toc.querySelectorAll("a").map((a) => a.textContent),
			["  T", "About [!quiet]"],
		);
	});

	it("answers the same question for an entry that is only a string", () => {
		// Quartz keeps its contents list as data, not as elements.
		const title = (text: string, over: Partial<WebBundleData> = {}): string | null =>
			renderer(over).outlineTitle(text);
		assert.strictEqual(title("[!quiet] My title"), "My title");
		assert.strictEqual(title("[!hush]"), "Hush");
		assert.strictEqual(title("[!nope] Unknown"), "Unknown");
		assert.strictEqual(title("An ordinary heading"), null);
		assert.strictEqual(title("About [!quiet]"), null);
		assert.strictEqual(title("[!quiet] My title", { heading: false }), null);
	});

	it("is never pilled, and is left alone while the heading role is off", () => {
		const toc = html('<div class="toc"><span>[!quiet] T</span></div>');
		renderer().process(asEl(toc));
		assert.strictEqual(pills(toc).length, 0);

		const off = clean('<div class="toc"><a href="#a">[!quiet] T</a></div>', { heading: false });
		assert.strictEqual(off.textContent, "[!quiet] T");
	});
});

/* -------------------------------------------------------------------------- */
/* What a page hands over                                                     */
/* -------------------------------------------------------------------------- */

describe("sweeping a page", () => {
	const body = fakeDom.document.body;

	afterEach(() => {
		body.replaceChildren();
	});

	it("turns the content and cleans the contents list, and leaves the site's own text", () => {
		body.appendChild(
			html(
				'<div id="site">' +
					"<nav><span>[!quiet] in the navigation</span></nav>" +
					'<div class="toc"><a href="#a">[!quiet] Title</a></div>' +
					"<article><h2>[!quiet] Title</h2><p>see [!note]</p></article>" +
					"</div>",
			),
		);
		sweep(core, renderer(), asEl(body));

		assert.strictEqual(one(body, "nav").textContent, "[!quiet] in the navigation");
		assert.strictEqual(one(body, ".toc a").textContent, "Title");
		assert.ok(hasClass(one(body, "h2"), CSS_HEADING_LINE));
		assert.strictEqual(pills(one(body, "article")).length, 1);
	});

	it("processes a node that already sits inside the content", () => {
		const article = html("<article><p>later [!quiet]</p></article>");
		body.appendChild(article);
		sweep(core, renderer(), asEl(one(article, "p")));
		assert.strictEqual(pills(article).length, 1);
	});

	it("takes the whole body on a page with no content root at all", () => {
		body.appendChild(html('<div class="post"><p>plain [!quiet] page</p></div>'));
		sweep(core, renderer(), asEl(body));
		assert.strictEqual(pills(body).length, 1);
	});
});
