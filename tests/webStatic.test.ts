/**
 * tests/webStatic.test.ts — the renderer at build time: the small DOM it runs
 * on (`src/web/static/`), and the Quartz and Digital Garden hosts.
 *
 * Quartz and Digital Garden draw heading and inline callouts while the site is
 * built, in Node, on somebody else's pages. Three promises follow, and each is
 * the kind that breaks without anyone seeing it until a site looks wrong:
 *
 * - **What the renderer did not touch comes back exactly as it went in.** The
 *   fragment parser is not an HTML parser and does not need to be, *because*
 *   it keeps every byte it reads; that is pinned here on markup chosen to be
 *   awkward. For Quartz the same promise is about object identity: an
 *   untouched node is the very object Quartz handed over.
 * - **The hosts fit the platforms as their source says they are shaped** —
 *   a Quartz transformer's fields, a garden plugin's hook. These are checked
 *   against real builds by hand (see the internals docs); here they are held
 *   to the shape those builds accepted.
 * - **A build never fails because of us.** A note the renderer cannot handle
 *   goes out as it came.
 *
 * That the renderer itself gives the same answer on this DOM as on a real one
 * is `webRuntime.test.ts`'s business, which runs every case over both.
 */
import assert from "node:assert";
import { createHash } from "node:crypto";
import nodePath from "node:path";
import { describe, it } from "node:test";
import * as core from "../src/web/core";
import { eleventy } from "../src/web/static/eleventy";
import { fromHast, toHast, type HastNode } from "../src/web/static/hastBridge";
import { parseFragment, parseIconNodes, serializeFragment } from "../src/web/static/htmlFragment";
import { LiteElement, LiteText } from "../src/web/static/liteDom";
import { quartz, type QuartzBuildCtx, type QuartzDirent, type QuartzNode } from "../src/web/static/quartz";
import { QUARTZ_NOTE, QUARTZ_NOTE_NAME, newQuartzNoteFrontmatter } from "../src/web/static/quartzNote";
import { buildNoteBody } from "../src/web/static/webNote";
import type { WebBundleData } from "../src/web/webBundleData";

const DATA: WebBundleData = {
	version: 1,
	heading: true,
	inline: true,
	content: true,
	fallback: "note",
	defs: [
		{
			id: "note",
			name: "Note",
			icon: '<svg viewBox="0 0 24 24" stroke-width="2" class="i-note"><path d="M1 1h2"/></svg>',
		},
		{ id: "tip", name: "Tip", aliases: ["hint"], icon: "💡" },
	],
	css: '.cs-inline-callout[data-callout="tip"] { & b { color: red; } }',
};

/* -------------------------------------------------------------------------- */
/* The fragment parser                                                        */
/* -------------------------------------------------------------------------- */

describe("an HTML fragment nobody changed", () => {
	const roundTrip = (markup: string): string => serializeFragment(parseFragment(markup));

	for (const markup of [
		"<p>plain &amp; simple</p>",
		"<p>a &nbsp; b &copy; 2026 and AT&T</p>",
		`<p class='single' data-x="a &quot;b&quot;" hidden>text</p>`,
		"<img src=x.png alt=unquoted><br><hr/>",
		"<!-- a comment with <b> in it --><p>after</p>",
		"<!DOCTYPE html><p>after a doctype</p>",
		"<p>unclosed <b>bold<p>and another",
		"stray </div> closing tag and a bare < sign",
		"<script>if (a < b && c) { x = '</p>'; }</script><p>next</p>",
		"<style>.a > .b { content: '<'; }</style>",
		"<textarea>[!note] <b>not markup</b></textarea>",
		'<svg viewBox="0 0 24 24"><linearGradient id="g"/><path d="M1 1"/></svg>',
		"<p>\n\tindented\n</p>\n",
		'<a href="?a=1&amp;b=2">link</a>',
		"<DIV CLASS=Loud>shouting</DIV>",
	]) {
		it(`is printed byte for byte: ${JSON.stringify(markup)}`, () => {
			assert.strictEqual(roundTrip(markup), markup);
		});
	}

	it("still is, around a callout that was drawn in the middle of it", () => {
		const before = `<!-- c --><p class='x' data-y="&quot;">AT&T &nbsp;</p>\n`;
		const after = "\n<script>var a = '[!tip]';</script><p>unclosed";
		const host = eleventy(core, DATA);
		const out = host.render(`${before}<p>see [!tip] here</p>${after}`);
		assert.ok(out.startsWith(before), out);
		assert.ok(out.endsWith(after), out);
		assert.ok(out.includes('<span class="cs-inline-callout" data-callout="tip">'));
	});
});

describe("text and attributes the renderer does change", () => {
	it("reads the entities markdown-it writes, and writes them back", () => {
		const root = parseFragment("<p>a &lt;b&gt; &amp; &quot;c&quot; [!tip]</p>");
		const text = (root.children[0] as LiteElement).children[0] as LiteText;
		assert.strictEqual(text.data, 'a <b> & "c" [!tip]');
		// Cutting it is a change, so the head is re-encoded rather than replayed.
		text.splitText(text.data.indexOf("[!tip]"));
		assert.strictEqual(serializeFragment(root), '<p>a &lt;b&gt; &amp; "c" [!tip]</p>');
	});

	it("leaves text with any other entity exactly as written, even when cut", () => {
		const root = parseFragment("<p>a&nbsp;b [!tip]</p>");
		const text = (root.children[0] as LiteElement).children[0] as LiteText;
		assert.strictEqual(text.data, "a&nbsp;b [!tip]");
		text.splitText(9);
		assert.strictEqual(serializeFragment(root), "<p>a&nbsp;b [!tip]</p>");
	});

	it("rewrites an opening tag only when one of its attributes was set", () => {
		const root = parseFragment(`<h2 id='a-b' data-x="1 &amp; 2" hidden>T</h2>`);
		const h2 = root.children[0] as LiteElement;
		h2.classList.add("cs-heading-callout");
		h2.setAttribute("data-callout", 'a"b');
		assert.strictEqual(
			serializeFragment(root),
			'<h2 id="a-b" data-x="1 &amp; 2" hidden class="cs-heading-callout" data-callout="a&quot;b">T</h2>',
		);
	});

	it("builds an element that was never in the source with a closing tag of its own", () => {
		const root = parseFragment("<p></p>");
		const span = new LiteElement("span");
		span.textContent = "1 < 2";
		(root.children[0] as LiteElement).appendChild(span);
		assert.strictEqual(serializeFragment(root), "<p><span>1 &lt; 2</span></p>");
	});

	it("refuses a selector it cannot match, rather than match nothing", () => {
		const el = new LiteElement("p");
		assert.ok(el.matches("p, .x"));
		assert.ok(!el.matches("a.internal-link"));
		assert.throws(() => el.matches("p > a"), /cannot match the selector/);
		assert.throws(() => el.matches("[data-x]"), /cannot match the selector/);
	});

	it("hands an icon over as detached nodes", () => {
		const nodes = parseIconNodes('<svg class="i"><path d="M1 1"/></svg>');
		assert.strictEqual(nodes.length, 1);
		assert.strictEqual(nodes[0]?.parent, null);
		assert.strictEqual(parseIconNodes("💡")[0]?.textContent, "💡");
	});
});

/* -------------------------------------------------------------------------- */
/* Quartz                                                                     */
/* -------------------------------------------------------------------------- */

const text = (value: string): HastNode => ({ type: "text", value });
const element = (tagName: string, properties: Record<string, unknown>, children: HastNode[]): HastNode => ({
	type: "element",
	tagName,
	properties,
	children,
});

const hex = (text: string): string => createHash("sha256").update(text, "utf8").digest("hex");

/** The note Callout Studio writes for `data`, as `writeTarget.ts` writes it, under `frontmatter`. */
const quartzNote = (data: unknown, frontmatter = newQuartzNoteFrontmatter()): string => {
	const json = JSON.stringify(data);
	return frontmatter + buildNoteBody(QUARTZ_NOTE, hex(json), json);
};

/** `note` with the first digit of its fingerprint changed: what an edit by hand looks like to the plugin. */
const tampered = (note: string): string =>
	note.replace(/(sha256:)([0-9a-f])/, (_, prefix: string, digit: string) => `${prefix}${digit === "0" ? "1" : "0"}`);

/** The build's context, as Quartz passes it: the content folder it builds from. */
const CTX: QuartzBuildCtx = { argv: { directory: "content" } };

/**
 * A pretend Quartz site: Node's own `path` and `crypto`, files that are only
 * a map of paths to text, and folders that are whatever those paths imply.
 * `links` are folders that are links to other folders. `fail` makes every
 * read throw that error instead.
 */
function site(files: Record<string, string>, fail?: { code: string }, links: Record<string, string> = {}): QuartzNode {
	const real = (path: string): string => {
		for (const [link, target] of Object.entries(links)) {
			if (path === link || path.startsWith(`${link}/`)) return real(target + path.slice(link.length));
		}
		return path;
	};
	const dirent = (name: string, kind: "file" | "folder" | "link"): QuartzDirent => ({
		name,
		isDirectory: () => kind === "folder",
		isFile: () => kind === "file",
		isSymbolicLink: () => kind === "link",
	});
	const isFolder = (path: string): boolean => Object.keys(files).some((file) => file.startsWith(`${real(path)}/`));
	const throwIfFailing = (): void => {
		if (fail) throw Object.assign(new Error(fail.code), fail);
	};
	return {
		fs: {
			readFileSync(file: string): string {
				throwIfFailing();
				const text = files[real(file)];
				if (text === undefined) throw Object.assign(new Error(`ENOENT: ${file}`), { code: "ENOENT" });
				return text;
			},
			readdirSync(folder: string): QuartzDirent[] {
				throwIfFailing();
				const at = real(folder);
				if (!isFolder(at)) throw Object.assign(new Error(`ENOENT: ${folder}`), { code: "ENOENT" });
				const names = new Map<string, QuartzDirent>();
				for (const file of Object.keys(files)) {
					if (!file.startsWith(`${at}/`)) continue;
					const [name = "", ...rest] = file.slice(at.length + 1).split("/");
					names.set(name, dirent(name, rest.length > 0 ? "folder" : "file"));
				}
				for (const link of Object.keys(links)) {
					const slash = link.lastIndexOf("/");
					if (real(link.slice(0, slash)) !== at) continue;
					const name = link.slice(slash + 1);
					names.set(name, dirent(name, "link"));
				}
				return [...names.values()];
			},
			statSync(file: string) {
				const folder = isFolder(file);
				const isFile = files[real(file)] !== undefined;
				if (!folder && !isFile) throw Object.assign(new Error(`ENOENT: ${file}`), { code: "ENOENT" });
				return { isDirectory: () => folder, isFile: () => isFile };
			},
			realpathSync: (file: string): string => real(file),
		},
		path: nodePath.posix,
		crypto: { createHash },
	};
}

/** A site with `data` in its content folder. */
const siteWith = (data: unknown): QuartzNode => site({ [`content/${QUARTZ_NOTE_NAME}`]: quartzNote(data) });

/** Run the Quartz plugin over one tree, as Quartz runs a rehype plugin. */
function runQuartz(tree: HastNode, file: { data: Record<string, unknown> } = { data: {} }): void {
	const plugin = quartz(core, siteWith(DATA))();
	for (const attach of plugin.htmlPlugins(CTX)) attach()(tree, file);
}

/** What `fn` said to the build log. */
function logOf(fn: () => void): string[] {
	const lines: string[] = [];
	const original = console.warn;
	console.warn = (...args: unknown[]) => lines.push(args.map(String).join(" "));
	try {
		fn();
	} finally {
		console.warn = original;
	}
	return lines;
}

describe("a Quartz page", () => {
	it("hands back the very nodes it did not touch", () => {
		const untouched = element("p", { className: ["keep"] }, [text("nothing here")]);
		const comment: HastNode = { type: "comment", value: "c" };
		const changed = element("p", {}, [text("see [!tip] here")]);
		const tree: HastNode = { type: "root", children: [untouched, comment, changed] };
		const untouchedText = untouched.children?.[0];

		runQuartz(tree);

		assert.strictEqual(tree.children?.[0], untouched);
		assert.strictEqual(untouched.children?.[0], untouchedText);
		assert.deepStrictEqual(untouched.properties, { className: ["keep"] });
		assert.strictEqual(tree.children?.[1], comment);
		assert.strictEqual(tree.children?.[2], changed, "a changed element is still Quartz's own object");
	});

	it("is left entirely alone when it holds no token", () => {
		const tree: HastNode = { type: "root", children: [element("p", {}, [text("plain")])] };
		const children = tree.children;
		runQuartz(tree);
		assert.strictEqual(tree.children, children);
	});

	it("draws a heading in place, keeping its id and Quartz's anchor outside the title", () => {
		const anchor = element("a", { role: "anchor", ariaHidden: true, href: "#tip-title" }, []);
		const h2 = element("h2", { id: "tip-title" }, [text("[!tip] Title"), anchor]);
		const tree: HastNode = { type: "root", children: [h2] };
		runQuartz(tree);

		assert.deepStrictEqual(h2.properties, {
			id: "tip-title",
			className: ["cs-heading-callout"],
			dataCallout: "tip",
		});
		const [token, title, last] = h2.children ?? [];
		assert.deepStrictEqual(token?.properties?.className, ["cs-heading-token"]);
		assert.deepStrictEqual(title?.properties?.className, ["cs-heading-title", "cs-heading-title-gap"]);
		assert.deepStrictEqual(title?.children, [{ type: "text", value: "Title" }]);
		assert.strictEqual(last, anchor);
	});

	it("writes an icon's markup as elements, with its attributes as they were spelled", () => {
		const tree: HastNode = { type: "root", children: [element("p", {}, [text("a [!note] b")])] };
		runQuartz(tree);
		const pill = tree.children?.[0]?.children?.[1];
		// The icon came through the file, so its markup survived the JSON both ways.
		assert.deepStrictEqual(pill?.properties, { className: ["cs-inline-callout"], dataCallout: "note" });
		const svg = pill?.children?.[0]?.children?.[0];
		assert.strictEqual(svg?.tagName, "svg");
		assert.deepStrictEqual(svg?.properties, { viewBox: "0 0 24 24", "stroke-width": "2", className: ["i-note"] });
		assert.strictEqual(svg?.children?.[0]?.tagName, "path");
	});

	it("leaves Quartz's own block callout and its title alone", () => {
		const title = element("div", { className: ["callout-title"] }, [text("[!tip] kept")]);
		const body = element("p", {}, [text("but [!tip] here is drawn")]);
		const tree: HastNode = {
			type: "root",
			children: [element("blockquote", { className: ["callout", "tip"] }, [title, body])],
		};
		runQuartz(tree);
		assert.deepStrictEqual(title.children, [{ type: "text", value: "[!tip] kept" }]);
		assert.strictEqual(body.children?.length, 3);
	});

	it("cleans the contents list Quartz built from the Markdown, and keeps each link", () => {
		const file = {
			data: {
				toc: [
					{ depth: 0, text: "[!tip] Title", slug: "tip-title" },
					{ depth: 1, text: "[!hint]", slug: "hint" },
					{ depth: 1, text: "An ordinary heading", slug: "an-ordinary-heading" },
				],
			},
		};
		runQuartz({ type: "root", children: [element("p", {}, [text("no token in the body")])] }, file);
		assert.deepStrictEqual(file.data.toc, [
			{ depth: 0, text: "Title", slug: "tip-title" },
			{ depth: 1, text: "Hint", slug: "hint" },
			{ depth: 1, text: "An ordinary heading", slug: "an-ordinary-heading" },
		]);
	});

	it("says so, once, when it was placed after the plugin that reads the page's text", () => {
		const warnings = logOf(() => {
			const plugin = quartz(core, siteWith(DATA))();
			const transform = plugin.htmlPlugins(CTX)[0]?.();
			const page = (): HastNode => ({ type: "root", children: [element("p", {}, [text("[!tip]")])] });
			transform?.(page(), { data: { text: "already computed" } });
			transform?.(page(), { data: { text: "already computed" } });
			transform?.(page(), { data: {} });
		});
		assert.strictEqual(warnings.length, 1);
		assert.match(warnings[0] ?? "", /before Description/);
	});

	it("sends its stylesheet as a head element that carries it raw", () => {
		const resources = quartz(core, siteWith(DATA))().externalResources(CTX);
		// Not as an inline `css` resource: Quartz renders that as escaped text,
		// which turns every `"` and `&` of the sheet into an entity.
		assert.deepStrictEqual(resources.css, []);
		assert.deepStrictEqual(resources.js, [], "nothing is loaded in the reader's browser");
		const style = resources.additionalHead[0] as Record<string, unknown>;
		assert.strictEqual(style.type, "style");
		assert.deepStrictEqual(style.props, { dangerouslySetInnerHTML: { __html: DATA.css } });
		// The marker Preact's renderer requires of an element.
		assert.ok(Object.prototype.hasOwnProperty.call(style, "constructor"));
		assert.strictEqual(style.constructor, undefined);
	});

	it("cannot have its style element closed by the sheet", () => {
		const sneaky = siteWith({ ...DATA, css: 'a::after { content: "</style>"; }' });
		const resources = quartz(core, sneaky)().externalResources(CTX);
		const style = resources.additionalHead[0] as { props: { dangerouslySetInnerHTML: { __html: string } } };
		assert.ok(!style.props.dangerouslySetInnerHTML.__html.includes("</style"));
	});
});

describe("the Quartz plugin finding the site's note", () => {
	const page = (): HastNode => ({ type: "root", children: [element("h2", {}, [text("[!tip] Title")])] });

	/** Everything a build asks of the plugin, in Quartz's order: the rehype plugins, then the resources. */
	function build(node: QuartzNode, ctx: QuartzBuildCtx = CTX): { tree: HastNode; head: unknown[]; log: string[] } {
		const tree = page();
		let head: unknown[] = [];
		const log = logOf(() => {
			const plugin = quartz(core, node)();
			for (const attach of plugin.htmlPlugins(ctx)) attach()(tree, { data: { relativePath: "page.md" } });
			head = plugin.externalResources(ctx).additionalHead;
		});
		return { tree, head, log };
	}

	const drawn = (tree: HastNode): boolean =>
		JSON.stringify(tree.children?.[0]?.properties ?? {}).includes("cs-heading-callout");

	it("draws from the note in the content folder the build was given, and says nothing", () => {
		const elsewhere = site({ [`docs/${QUARTZ_NOTE_NAME}`]: quartzNote(DATA), "docs/page.md": "hello" });
		const { tree, head, log } = build(elsewhere, { argv: { directory: "docs/" } });
		assert.ok(drawn(tree));
		assert.strictEqual(head.length, 1);
		assert.deepStrictEqual(log, []);
	});

	it("reads a note a Git checkout gave other line endings, and a formatter another fence", () => {
		const changed = quartzNote(DATA).replace(/```/g, "~~~~").replace(/\n/g, "\r\n");
		const { tree, log } = build(site({ [`content/${QUARTZ_NOTE_NAME}`]: changed }));
		assert.ok(drawn(tree));
		assert.deepStrictEqual(log, []);
	});

	it("finds a note that was renamed and moved, by its code block, with none of its properties left", () => {
		// What Quartz Syncer or Pressroom publish: properties they do not know are gone.
		const notes = [
			quartzNote(DATA, "---\ntitle: My callouts\n---\n"),
			quartzNote(DATA, '---\n{"title":"My callouts"}\n---\n'),
			quartzNote(DATA, ""),
		];
		for (const note of notes) {
			const { tree, log } = build(site({ "content/system/My callouts.md": note, "content/a.md": "x" }));
			assert.ok(drawn(tree), note.slice(0, 30));
			assert.deepStrictEqual(log, []);
		}
	});

	it("reads the note named for it before any other note that carries the block", () => {
		const other = quartzNote({ ...DATA, defs: [] });
		const { tree, log } = build(
			site({ "content/aaa.md": other, [`content/deep/${QUARTZ_NOTE_NAME}`]: quartzNote(DATA) }),
		);
		assert.ok(drawn(tree), "the named one, though another sorts first");
		assert.deepStrictEqual(log, [], "a note of another name is not looked at when one is named for it");
	});

	it("reads the one at the top first, and says which others to delete", () => {
		const { tree, log } = build(
			site({
				[`content/a/${QUARTZ_NOTE_NAME}`]: quartzNote({ ...DATA, defs: [] }),
				[`content/${QUARTZ_NOTE_NAME}`]: quartzNote(DATA),
			}),
		);
		assert.ok(drawn(tree));
		assert.strictEqual(log.length, 1);
		assert.match(
			log[0] ?? "",
			/More than one note .* Using content\/callout-studio-quartz\.md; delete content\/a\/callout-studio-quartz\.md\./,
		);
	});

	it("leaves out folders Quartz leaves out, and follows a folder that is a link, once", () => {
		const hidden = site({ [`content/.trash/${QUARTZ_NOTE_NAME}`]: quartzNote(DATA), "content/page.md": "x" });
		assert.ok(!drawn(build(hidden).tree), "a folder whose name starts with a period");
		const modules = site({
			[`content/node_modules/x/${QUARTZ_NOTE_NAME}`]: quartzNote(DATA),
			"content/page.md": "x",
		});
		assert.ok(!drawn(build(modules).tree), "node_modules");
		const linked = site({ [`vault/${QUARTZ_NOTE_NAME}`]: quartzNote(DATA), "content/page.md": "x" }, undefined, {
			"content/notes": "vault",
			"vault/loop": "content",
		});
		const { tree, log } = build(linked);
		assert.ok(drawn(tree), "through the link");
		assert.deepStrictEqual(log, [], "and once, though a link leads back");
	});

	it("does not take a note of the user's that only shares the name", () => {
		const mine = "# My own note\n\ncallout-studio-quartz is great";
		const { tree, log } = build(site({ [`content/${QUARTZ_NOTE_NAME}`]: mine }));
		assert.ok(!drawn(tree));
		assert.match(log[0] ?? "", /No note with Callout Studio's callouts was found in content\./);
	});

	it("builds the site as it was, and says why once, when there is no note", () => {
		const { tree, head, log } = build(site({ "content/page.md": "hello" }));
		assert.ok(!drawn(tree), "nothing is drawn");
		assert.deepStrictEqual(tree, page(), "the page is exactly as Quartz made it");
		assert.deepStrictEqual(head, []);
		assert.strictEqual(log.length, 1, "the workers say nothing; the resources say it once");
		assert.match(log[0] ?? "", /^\[Callout Studio\] No note with Callout Studio's callouts was found in content\./);
		assert.ok(log[0]?.includes("Publish to the web → Quartz"), "it says where to create it");
		assert.ok(log[0]?.includes("stay as text"));
	});

	it("does not draw from a note changed by hand, and says what to do", () => {
		const { tree, log } = build(site({ [`content/${QUARTZ_NOTE_NAME}`]: tampered(quartzNote(DATA)) }));
		assert.ok(!drawn(tree));
		assert.ok(log.some((line) => line.includes("was changed by hand") && line.includes("Update now")));
	});

	it("does not draw from a note with no fingerprint, no JSON, or no callouts", () => {
		const bad = [
			quartzNote(DATA).replace(/sha256:[0-9a-f]+\n/, ""),
			newQuartzNoteFrontmatter() + buildNoteBody(QUARTZ_NOTE, hex("not json"), "not json"),
			quartzNote({ ...DATA, defs: "none" }),
		];
		for (const note of bad) {
			const { tree, log } = build(site({ [`content/${QUARTZ_NOTE_NAME}`]: note }));
			assert.ok(!drawn(tree), note.slice(-60));
			assert.ok(
				log.some((line) => line.includes("was changed by hand")),
				note.slice(-60),
			);
		}
	});

	it("does not draw from a note a newer Callout Studio wrote, and asks for the plugin to be updated", () => {
		const { tree, log } = build(siteWith({ ...DATA, version: 2 }));
		assert.ok(!drawn(tree));
		assert.ok(log.some((line) => line.includes("newer Callout Studio") && line.includes("Update the Callout")));
	});

	it("never throws into the build", () => {
		const { tree, log } = build(site({}, { code: "EACCES" }));
		assert.ok(!drawn(tree));
		assert.ok(log.some((line) => line.includes("No note with Callout Studio's callouts was found")));
		const broken: QuartzNode = {
			...site({ "content/a.md": "x" }),
			path: {
				...nodePath.posix,
				join: () => {
					throw new Error("no path");
				},
			},
		};
		assert.doesNotThrow(() => build(broken));
	});
});

describe("the Quartz plugin keeping its note off the site", () => {
	type Page = { data: Record<string, unknown>; path?: string };
	const note = (data: Record<string, unknown>): Page => ({ data });

	/** The transformer run over `pages`, as Quartz runs it over each, then its filter asked about each. */
	function pass(node: QuartzNode, pages: Page[], ctx: QuartzBuildCtx = CTX): boolean[] {
		const plugin = quartz(core, node)();
		logOf(() => {
			const transforms = plugin.htmlPlugins(ctx).map((attach) => attach());
			for (const page of pages) {
				const tree: HastNode = { type: "root", children: [element("p", {}, [text("[!tip]")])] };
				for (const transform of transforms) transform(tree, page);
			}
		});
		return pages.map((page) => plugin.shouldPublish({}, [{}, page]));
	}

	it("marks the note a draft, not for publishing, and its own, and leaves it out", () => {
		const ours = note({ relativePath: QUARTZ_NOTE_NAME, frontmatter: { title: "x" } });
		const other = note({ relativePath: "page.md", frontmatter: { title: "Page" } });
		const kept = pass(siteWith(DATA), [ours, other]);
		assert.deepStrictEqual(ours.data.frontmatter, {
			title: "x",
			draft: true,
			publish: false,
			"callout-studio-quartz": 1,
		});
		assert.deepStrictEqual(other.data.frontmatter, { title: "Page" }, "any other page is untouched");
		assert.deepStrictEqual(kept, [false, true]);
	});

	it("recognises the note by where it is on disk when Quartz gives no relative path", () => {
		const node = site({ "content/sub/My callouts.md": quartzNote(DATA) });
		const byPath: Page = { data: {}, path: "content/sub/My callouts.md" };
		const byFilePath = note({ filePath: "content/sub/My callouts.md" });
		assert.deepStrictEqual(pass(node, [byPath, byFilePath]), [false, false]);
		assert.strictEqual(
			(byPath.data.frontmatter as Record<string, unknown>).draft,
			true,
			"given properties it had none of",
		);
	});

	it("leaves out every note that carries the block, even one it cannot read", () => {
		const node = site({
			[`content/${QUARTZ_NOTE_NAME}`]: tampered(quartzNote(DATA)),
			[`content/b/${QUARTZ_NOTE_NAME}`]: quartzNote(DATA),
		});
		const pages = [
			note({ relativePath: QUARTZ_NOTE_NAME }),
			note({ relativePath: `b/${QUARTZ_NOTE_NAME}` }),
			note({ relativePath: "c.md" }),
		];
		assert.deepStrictEqual(pass(node, pages), [false, false, true]);
	});

	it("leaves out a page that carries the property, whatever the transformer saw", () => {
		const plugin = quartz(core, site({}))();
		const ask = (frontmatter: unknown): boolean => plugin.shouldPublish({}, [{}, { data: { frontmatter } }]);
		assert.strictEqual(ask({ "callout-studio-quartz": 1 }), false);
		assert.strictEqual(ask({ draft: true }), true, "other drafts are Quartz's to decide");
		assert.strictEqual(plugin.shouldPublish({}, [{}, undefined]), true);
	});
});

describe("the HAST bridge", () => {
	it("translates the property names the renderer reads and writes", () => {
		const tree: HastNode = {
			type: "root",
			children: [element("a", { className: ["x", "y"], ariaHidden: true, dataNoPopover: "true", href: "#" }, [])],
		};
		const a = fromHast(tree).children[0] as LiteElement;
		assert.strictEqual(a.getAttribute("class"), "x y");
		assert.strictEqual(a.getAttribute("aria-hidden"), "true");
		assert.strictEqual(a.getAttribute("data-no-popover"), "true");
		assert.strictEqual(a.getAttribute("href"), "#");
	});

	it("writes back only what was set", () => {
		const original = element("h2", { id: "x", className: ["a"] }, []);
		const tree: HastNode = { type: "root", children: [original] };
		const root = fromHast(tree);
		const h2 = root.children[0] as LiteElement;
		h2.classList.add("b");
		h2.setAttribute("data-callout-metadata", "wide");
		toHast(root, tree);
		assert.deepStrictEqual(original.properties, { id: "x", className: ["a", "b"], dataCalloutMetadata: "wide" });
	});
});

/* -------------------------------------------------------------------------- */
/* Digital Garden                                                             */
/* -------------------------------------------------------------------------- */

describe("a Digital Garden note", () => {
	it("is drawn in the HTML markdown-it made of it", () => {
		const host = eleventy(core, DATA);
		const out = host.render(
			'<h2 id="tip-title" tabindex="-1">[!tip] Title</h2>\n<p>and [!note]{a <em>b</em>} too</p>\n',
		);
		assert.ok(out.startsWith('<h2 id="tip-title" tabindex="-1" class="cs-heading-callout" data-callout="tip">'));
		assert.ok(out.includes('<span class="cs-callout-payload">a <em>b</em></span>'));
		assert.ok(!out.includes("[!"));
	});

	it("keeps the header of a block callout the garden converts later", () => {
		const quote = "<blockquote>\n<p>[!tip] A block callout<br>\nwith [!note] inside</p>\n</blockquote>\n";
		const out = eleventy(core, DATA).render(quote);
		assert.ok(out.includes("<p>[!tip] A block callout<br>"), out);
		assert.ok(out.includes('data-callout="note"'));
	});

	it("does not even parse a note that has no token", () => {
		const html = "<p>unclosed <b>and odd & markup";
		assert.strictEqual(eleventy(core, DATA).render(html), html);
	});

	it("wraps the garden's markdown-it once, however often the hook runs", () => {
		const calls: string[] = [];
		const md = {
			render(src: string): string {
				calls.push(src);
				return `<p>${src}</p>`;
			},
		};
		const host = eleventy(core, DATA);
		host.setupMarkdown(md as never);
		host.setupMarkdown(md as never);
		assert.strictEqual(md.render("[!tip]").split("cs-inline-callout").length, 2, "drawn once, not twice");
		assert.deepStrictEqual(calls, ["[!tip]"]);
	});

	it("passes the note through untouched, and says so once, if drawing it throws", () => {
		const warnings: unknown[] = [];
		const original = console.warn;
		console.warn = (...args: unknown[]) => warnings.push(args);
		try {
			const broken = {
				...core,
				createWebRenderer: () => ({
					process: () => {
						throw new Error("boom");
					},
				}),
			};
			const host = eleventy(broken as unknown as typeof core, DATA);
			assert.strictEqual(host.render("<p>[!tip]</p>"), "<p>[!tip]</p>");
			assert.strictEqual(host.render("<p>[!tip] again</p>"), "<p>[!tip] again</p>");
		} finally {
			console.warn = original;
		}
		assert.strictEqual(warnings.length, 1);
	});
});
