/**
 * tests/webQuartzPlugin.test.ts — the Callout Studio Quartz plugin, as the
 * files a site installs, and the file it reads from the vault.
 *
 * Three promises, each one a user would only meet on their live site:
 *
 * - **What Callout Studio writes is what the plugin reads.** The real
 *   exporter writes the file into a pretend vault; the file is copied, byte
 *   for byte, into a real content folder on disk; and the plugin's
 *   `dist/index.js`, joined exactly as the release joins it, is imported the
 *   way Quartz imports a plugin — an ES module, from a file, found through its
 *   `package.json` — and draws a page with it. "The file a site installs
 *   starts and draws" is a claim about bytes, and only running them answers
 *   it.
 * - **The package is one Quartz 5 and npm both take.** A `quartz` manifest
 *   that places it between the plugins that give headings their ids and the
 *   one that reads the page's text, an entry point in a committed `dist/`
 *   (Quartz 5 then builds nothing), and no import Quartz 5 would refuse.
 * - **The panel, the README and the package agree** on the command that
 *   installs it and the file it reads, since a user copies one and the plugin
 *   obeys the other.
 *
 * The transformer's own behaviour (what it draws, what it says in the build
 * log, what it refuses to read) is `webStatic.test.ts`'s, on a pretend site.
 */
import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { pathToFileURL } from "node:url";
// Listed first among the project imports: it installs the DOM globals before
// anything under test loads (see tests/support/fakeDom.ts).
import "./support/fakeDom";
import type { App } from "obsidian";
import { WEB_CORE_GLOBAL, WEB_CORE_JS, WEB_STATIC_GLOBAL, WEB_STATIC_JS } from "virtual:callout-studio-web-assets";
import { quartzPluginIndex } from "../scripts/lib/quartzPluginIndex.mjs";
import { CSSInjector } from "../src/manager/CSSInjector";
import {
	QUARTZ_NOTE_NAME,
	QUARTZ_PLUGIN_PACKAGE,
	QUARTZ_PLUGIN_REPO_URL,
	QUARTZ_PLUGIN_SOURCE,
} from "../src/manager/web/targets";
import { exportWebTarget, summarize } from "../src/manager/web/writeTarget";
import type { HastNode } from "../src/web/static/hastBridge";
import type { QuartzTransformer } from "../src/web/static/quartz";
import { definition } from "./support/cssInjectorHarness";
import { readingHarness } from "./support/readingHarness";
import { readRepoFile } from "./support/sourceScan";
import { webFileMemory } from "./support/webFileMemory";

/** The plugin's `package.json`, as its repository holds it. */
const PACKAGE = JSON.parse(readRepoFile("web-plugins/quartz/package.json")) as {
	name: string;
	version: string;
	type: string;
	exports: Record<string, { import?: string; types?: string } | string>;
	files: string[];
	homepage: string;
	repository: { url: string };
	dependencies?: unknown;
	peerDependencies?: unknown;
	quartz: Record<string, unknown>;
};

/** What Quartz 5 names the plugin: its repository's name, the address's last part. */
const REPO_NAME = new URL(QUARTZ_PLUGIN_REPO_URL).pathname.split("/").pop() ?? "";

/** `dist/index.js`, joined as `scripts/lib/quartzPlugin.mjs` joins the release's. */
const INDEX = quartzPluginIndex({
	coreJs: WEB_CORE_JS,
	coreGlobal: WEB_CORE_GLOBAL,
	hostJs: WEB_STATIC_JS,
	hostGlobal: WEB_STATIC_GLOBAL,
	version: "test",
});

/** A vault the real exporter writes into, with one callout of the user's. */
function vault(): { app: App; files: Map<string, string>; plugin: Parameters<typeof exportWebTarget>[1] } {
	const files = new Map<string, string>();
	const folders = new Set<string>();
	const app = {
		vault: {
			configDir: ".obsidian",
			adapter: {
				exists: (path: string) => Promise.resolve(files.has(path) || folders.has(path)),
				read: (path: string) => Promise.resolve(files.get(path) ?? ""),
				write(path: string, data: string): Promise<void> {
					files.set(path, data);
					return Promise.resolve();
				},
				mkdir(path: string): Promise<void> {
					folders.add(path);
					return Promise.resolve();
				},
			},
		},
	} as unknown as App;
	const { registry } = readingHarness();
	registry.add(definition({ id: "quiet", displayName: "Quiet", aliases: ["hush"] }));
	return { app, files, plugin: { registry, cssInjector: new CSSInjector(app, registry), webFiles: webFileMemory() } };
}

const text = (value: string): HastNode => ({ type: "text", value });
const element = (tagName: string, children: HastNode[]): HastNode => ({
	type: "element",
	tagName,
	properties: {},
	children,
});

/** What `fn` said to the build log. */
async function logOf(fn: () => Promise<void>): Promise<string[]> {
	const lines: string[] = [];
	const original = console.warn;
	console.warn = (...args: unknown[]) => lines.push(args.map(String).join(" "));
	try {
		await fn();
	} finally {
		console.warn = original;
	}
	return lines;
}

describe("the Callout Studio Quartz plugin, installed in a site", () => {
	for (const route of ["the vault itself", "a plugin that kept only the note's title"] as const) {
		it(`reads the note Callout Studio wrote, reaching the site as ${route}, draws a page with it, and keeps the note off the site`, async () => {
			const v = vault();
			assert.equal(summarize(await exportWebTarget(v.app, v.plugin, "quartz", {})), "created");
			const exported = v.files.get(QUARTZ_NOTE_NAME);
			assert.ok(exported, "the exporter wrote the note Quartz is to read");
			// What Quartz Syncer publishes by default: the properties it knows, and
			// the note wherever the user moved it, under the name they gave it.
			const stripped = route !== "the vault itself";
			const written = stripped
				? exported.replace(/^---\n[\s\S]*?\n---\n/, "---\ntitle: Callouts\n---\n")
				: exported;
			const notePath = stripped ? "notes/Callouts.md" : QUARTZ_NOTE_NAME;

			const site = await mkdtemp(join(tmpdir(), "callout-quartz-"));
			try {
				// The plugin as Quartz 5 clones it into .quartz/plugins/, under its
				// repository's name, and the vault as the site's content folder.
				const plugin = join(site, ".quartz", "plugins", REPO_NAME);
				const entry = PACKAGE.exports["."];
				const main = typeof entry === "string" ? entry : (entry?.import ?? "");
				await mkdir(join(plugin, dirname(main)), { recursive: true });
				await writeFile(join(plugin, "package.json"), JSON.stringify(PACKAGE));
				await writeFile(join(plugin, main), INDEX);
				const content = join(site, "content");
				await mkdir(join(content, dirname(notePath)), { recursive: true });
				await writeFile(join(content, notePath), written);
				await writeFile(join(content, "page.md"), "# A page");

				const tree: HastNode = {
					type: "root",
					children: [element("h2", [text("[!quiet] Title")]), element("p", [text("an [!hush] inline")])],
				};
				let head: unknown[] = [];
				const note = { data: { relativePath: notePath, frontmatter: stripped ? { title: "Callouts" } : {} } };
				const page = { data: { relativePath: "page.md", frontmatter: { title: "A page" } } };
				let kept: boolean[] = [];
				const log = await logOf(async () => {
					// eslint-disable-next-line no-unsanitized/method -- the file this test just wrote into its own temporary folder, imported as Quartz imports a plugin: its address cannot be a literal.
					const loaded = (await import(pathToFileURL(join(plugin, main)).href)) as {
						CalloutStudio: (options?: unknown) => QuartzTransformer;
						default: unknown;
					};
					assert.equal(loaded.default, loaded.CalloutStudio, "both ways Quartz finds a factory");
					// Quartz 5 passes the options `plugin add` wrote, `{}`.
					const instance = loaded.CalloutStudio({});
					assert.equal(instance.name, "CalloutStudio");
					const ctx = { argv: { directory: content } };
					for (const attach of instance.htmlPlugins(ctx)) {
						const transform = attach();
						transform(tree, page);
						transform({ type: "root", children: [] }, note);
					}
					head = instance.externalResources(ctx).additionalHead;
					kept = [note, page].map((file) => instance.shouldPublish({}, [{}, file]));
				});

				assert.deepEqual(log, [], "a site that is set up hears nothing from the plugin");
				const [h2, p] = tree.children ?? [];
				assert.deepEqual(h2?.properties?.className, ["cs-heading-callout"]);
				assert.equal(h2?.properties?.dataCallout, "quiet");
				assert.deepEqual(p?.children?.[1]?.properties?.className, ["cs-inline-callout"]);
				assert.equal(head.length, 1, "the stylesheet travels as one head element");
				const css = (head[0] as { props: { dangerouslySetInnerHTML: { __html: string } } }).props
					.dangerouslySetInnerHTML.__html;
				assert.ok(css.includes('[data-callout="quiet"]'), "the user's own callout has its rules");
				assert.ok(!css.includes(".theme-dark"), "dark mode is Quartz's attribute, not Obsidian's class");
				assert.deepEqual(kept, [false, true], "the note is left out, the page kept");
				assert.equal((note.data.frontmatter as Record<string, unknown>).draft, true, "and marked a draft");
			} finally {
				await rm(site, { recursive: true, force: true });
			}
		});
	}
});

describe("the Callout Studio Quartz plugin, as files", () => {
	it("is a package Quartz 5 and npm both install from its repository", () => {
		assert.equal(PACKAGE.name, QUARTZ_PLUGIN_PACKAGE);
		assert.match(PACKAGE.version, /^\d+\.\d+\.\d+$/);
		assert.equal(PACKAGE.type, "module");
		assert.deepEqual(PACKAGE.exports["."], { types: "./dist/index.d.ts", import: "./dist/index.js" });
		assert.ok(PACKAGE.files.includes("dist"), "npm installs the built entry point");
		assert.equal(PACKAGE.repository.url, QUARTZ_PLUGIN_REPO_URL);
		assert.equal(PACKAGE.homepage, `${QUARTZ_PLUGIN_REPO_URL}#readme`);
		assert.equal(QUARTZ_PLUGIN_SOURCE, `github:${new URL(QUARTZ_PLUGIN_REPO_URL).pathname.slice(1)}`);
		// Quartz 5 names it after the repository, npm after the package: the
		// README's update command has the first.
		assert.equal(REPO_NAME, "quartz");
		assert.notEqual(REPO_NAME, QUARTZ_PLUGIN_PACKAGE);
		// Nothing to install: Quartz 5 links a plugin's dependencies, and npm
		// would fetch them on every site.
		assert.equal(PACKAGE.dependencies, undefined);
		assert.equal(PACKAGE.peerDependencies, undefined);
	});

	it("has the manifest that places it among Quartz's transformers, and its filters", () => {
		assert.deepEqual(PACKAGE.quartz, {
			name: "callout-studio",
			displayName: "Callout Studio",
			// A filter too, to keep the note off a site that publishes its drafts.
			category: ["transformer", "filter"],
			// After GitHub Flavored Markdown (30), which gives headings their ids,
			// and before Description (70), which reads the page's text: the orders
			// in Quartz 5.1's default configuration.
			defaultOrder: 65,
		});
	});

	it("imports only what Quartz 5 lets a plugin import without bundling it", () => {
		// The pattern Quartz 5.1's loader checks a plugin's entry point with
		// (validatePluginExternals); Node's own modules are always allowed.
		const imports = [
			...INDEX.matchAll(/^\s*(?:import\s+.*\s+from|export\s+.*\s+from)\s+["']([^"'./][^"']*)["']/gm),
		].map((match) => match[1]);
		assert.deepEqual(imports, ["node:fs", "node:path", "node:crypto"]);
		assert.ok(!/\brequire\s*\(/.test(INDEX), "an ES module has no require()");
		assert.match(readRepoFile("web-plugins/quartz/index.d.ts"), /export declare const CalloutStudio/);
	});

	it("is installed and read the way the panel and the README say", () => {
		const readme = readRepoFile("web-plugins/quartz/README.md");
		assert.ok(readme.includes(`npx quartz plugin add ${QUARTZ_PLUGIN_SOURCE}`), "Quartz 5's command");
		assert.ok(readme.includes(`npm install ${QUARTZ_PLUGIN_SOURCE}`), "Quartz 4's command");
		assert.ok(readme.includes(`from "${QUARTZ_PLUGIN_PACKAGE}"`), "Quartz 4's import");
		assert.ok(readme.includes(`npx quartz plugin install --latest ${REPO_NAME}\``), "Quartz 5's update");
		assert.ok(!readme.includes("Niv20/quartz-plugin-callout-studio"), "not the repository's first address");
		assert.ok(readme.includes(QUARTZ_NOTE_NAME), "the note it reads");
		assert.ok(INDEX.includes(QUARTZ_NOTE_NAME), "the entry point's header names the note it reads");
		assert.ok(
			!readme.includes("quartz.json") && !INDEX.includes("quartz.json"),
			"nothing of the file it used to read",
		);
	});
});
