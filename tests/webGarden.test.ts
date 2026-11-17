/**
 * tests/webGarden.test.ts — Digital Garden: the note that carries the callouts,
 * from the vault it is written in to the garden build that reads it.
 *
 * Four promises, each one a user would only meet on their live site:
 *
 * - **The note survives the trip.** Whatever Callout Studio writes, the garden
 *   plugin reads back to the same snapshot — through Digital Garden's way of
 *   rewriting a note's properties on publish, simulated here as its compiler
 *   does it (JSON on one line, the user's properties under
 *   `dg-note-properties`).
 * - **The note is recognised by its property, on both sides, and only by it.**
 *   Moved or renamed, it is still the one written; a note of the user's that
 *   merely has the name is not replaced without a yes.
 * - **Its body is Callout Studio's and its properties are the user's.** A
 *   body edited by hand is replaced, by hand and automatically, without
 *   asking — the one exception to "never replace an edit" — and the
 *   properties come back byte for byte.
 * - **A garden build never fails because of us**, and when the note cannot be
 *   used, the build log says why and the note still stays off the site.
 *
 * The last suite runs the garden plugin's `index.js`, joined exactly as the
 * release joins it, on a pretend garden: "the file a garden installs starts
 * and draws" is a claim about bytes.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import nodePath from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import vm from "node:vm";
// Listed first among the project imports: it installs the DOM globals before
// anything under test loads (see tests/support/fakeDom.ts).
import "./support/fakeDom";
import type { App } from "obsidian";
import { WEB_CORE_GLOBAL, WEB_CORE_JS, WEB_GARDEN_GLOBAL, WEB_GARDEN_JS } from "virtual:callout-studio-web-assets";
import { gardenPluginIndex } from "../scripts/lib/gardenPluginIndex.mjs";
import { CSSInjector } from "../src/manager/CSSInjector";
import { locateWebNote } from "../src/manager/web/webNoteLocation";
import { GARDEN_NOTE_PATH } from "../src/manager/web/targets";
import { buildWebBundleData, type WebExportPlugin } from "../src/manager/web/webData";
import { exportWebTarget, summarize, webTargetStatus } from "../src/manager/web/writeTarget";
import * as core from "../src/web/core";
import { garden, GARDEN_GLOBAL, type GardenHooks, type GardenNode } from "../src/web/static/garden";
import {
	buildGardenNoteBody,
	GARDEN_NOTE,
	GARDEN_NOTE_FORMAT,
	GARDEN_NOTE_INTRO,
	GARDEN_NOTE_KEY,
	GARDEN_STYLESHEET_URL,
	gardenNoteFormat,
	readGardenNoteBody,
	splitFrontmatter,
} from "../src/web/static/gardenNote";
import type { WebBundleData } from "../src/web/webBundleData";

import { definition } from "./support/cssInjectorHarness";
import { readingHarness } from "./support/readingHarness";
import { readRepoFile } from "./support/sourceScan";
import { webFileMemory } from "./support/webFileMemory";

/** Where the garden note is, as the panel and the writer look for it. */
const locateGardenNote = (app: App) => locateWebNote(app, GARDEN_NOTE, GARDEN_NOTE_PATH);

const hex = (text: string): string => createHash("sha256").update(text, "utf8").digest("hex");

const DATA: WebBundleData = {
	version: 1,
	heading: true,
	inline: true,
	content: true,
	fallback: "note",
	defs: [
		{ id: "note", name: "Note", icon: '<svg viewBox="0 0 24 24"><path d="M1 1h2"/></svg>' },
		{ id: "tip", name: "Tip — עצה", aliases: ["hint"], icon: "💡" },
	],
	css: '.cs-heading-callout[data-callout="tip"] { color: red; }\n.theme-dark .cs-inline-callout { color: pink; }',
};

/* --- The note's own format ------------------------------------------------- */

describe("the garden note's format", () => {
	it("round-trips any snapshot, in short lines a code block keeps", () => {
		const json = JSON.stringify(DATA);
		const body = buildGardenNoteBody(hex(json), json);
		assert.ok(body.startsWith(`${GARDEN_NOTE_INTRO.join("\n")}\n\n\`\`\`${GARDEN_NOTE_KEY}\n`));
		const block = readGardenNoteBody(body);
		assert.deepEqual(block, { json, fingerprint: hex(json) });
		const inside = body.split("\n").slice(GARDEN_NOTE_INTRO.length + 3, -2);
		assert.ok(inside.length > 1 && inside.every((line) => line.length <= 76));
		// The same base64 Node writes, so nothing about the encoding is ours alone.
		assert.equal(inside.join(""), Buffer.from(json, "utf8").toString("base64"));
	});

	it("reads nothing out of a block that is missing, unfinished or damaged", () => {
		const json = JSON.stringify(DATA);
		const body = buildGardenNoteBody(hex(json), json);
		for (const broken of [
			"just a note",
			body.replace(/\n```\n$/, "\n"),
			body.replace("sha256:", "sha1:"),
			body.replace(/sha256:[0-9a-f]{4}/, "sha256:zz"),
			body.replace(/\n([A-Za-z0-9+/]{10})/, "\n$1!"),
		]) {
			assert.equal(readGardenNoteBody(broken), null, broken.slice(0, 60));
		}
		// A fingerprint that does not match is the reader's call, not the parser's.
		assert.equal(readGardenNoteBody(body.replace(/sha256:[0-9a-f]/, "sha256:0"))?.json, json);
	});

	it("splits a note at the end of its properties, and only there", () => {
		assert.deepEqual(splitFrontmatter("---\na: 1\n---\nbody\n---\n"), {
			frontmatter: "---\na: 1\n---\n",
			body: "body\n---\n",
		});
		assert.deepEqual(splitFrontmatter("no properties"), { frontmatter: null, body: "no properties" });
		assert.deepEqual(splitFrontmatter("---\nunclosed"), { frontmatter: null, body: "---\nunclosed" });
		assert.deepEqual(splitFrontmatter("---\r\na: 1\r\n---\r\nx"), {
			frontmatter: "---\r\na: 1\r\n---\r\n",
			body: "x",
		});
	});

	it("finds the property as the vault writes it and as a garden publishes it", () => {
		assert.equal(gardenNoteFormat("---\ndg-publish: true\ncallout-studio-web: 1\n---\n"), 1);
		assert.equal(gardenNoteFormat('---\n"callout-studio-web": "2"\n---\n'), 2);
		assert.equal(gardenNoteFormat("---\ncallout-studio-web: banana\n---\n"), GARDEN_NOTE_FORMAT);
		assert.equal(gardenNoteFormat("---\ntags: [web]\n---\n"), null);
		assert.equal(gardenNoteFormat("---\nnested:\n  callout-studio-web: 1\n---\n"), null, "only at the top");
		assert.equal(gardenNoteFormat(null), null);
		// Digital Garden's compiler: JSON on one line, the user's own under dg-note-properties.
		const published = (value: unknown): string => `---\n${JSON.stringify(value)}\n---\n`;
		assert.equal(
			gardenNoteFormat(published({ "dg-publish": true, "dg-note-properties": { [GARDEN_NOTE_KEY]: 1 } })),
			1,
		);
		assert.equal(gardenNoteFormat(published({ [GARDEN_NOTE_KEY]: 3, "dg-note-properties": {} })), 3);
		assert.equal(gardenNoteFormat(published({ "dg-publish": true, "dg-note-properties": {} })), null);
	});
});

/* --- Writing it in the vault ------------------------------------------------ */

/** The YAML a note's properties block holds, as far as these tests write it. */
function properties(text: string): Record<string, unknown> | null {
	const { frontmatter } = splitFrontmatter(text);
	if (frontmatter === null) return null;
	const out: Record<string, unknown> = {};
	for (const line of frontmatter.split("\n")) {
		const match = /^([\w-]+):\s*(.*)$/.exec(line);
		if (match)
			out[match[1] ?? ""] =
				match[2] === "true" ? true : /^\d+$/.test(match[2] ?? "") ? Number(match[2]) : match[2];
	}
	return out;
}

interface Vault {
	app: App;
	files: Map<string, string>;
	writes: string[];
	plugin: WebExportPlugin;
}

/** A vault whose metadata cache reads the properties of what is on disk. */
function vault(onDisk: Record<string, string> = {}): Vault {
	const files = new Map(Object.entries(onDisk));
	const folders = new Set<string>();
	const writes: string[] = [];
	const app = {
		vault: {
			configDir: ".obsidian",
			getMarkdownFiles: () => [...files.keys()].filter((path) => path.endsWith(".md")).map((path) => ({ path })),
			adapter: {
				exists: (path: string) => Promise.resolve(files.has(path) || folders.has(path)),
				read: (path: string) => Promise.resolve(files.get(path) ?? ""),
				write(path: string, data: string): Promise<void> {
					writes.push(path);
					files.set(path, data);
					return Promise.resolve();
				},
				mkdir(path: string): Promise<void> {
					folders.add(path);
					return Promise.resolve();
				},
			},
		},
		metadataCache: {
			getFileCache: (file: { path: string }) => {
				const frontmatter = properties(files.get(file.path) ?? "");
				return frontmatter ? { frontmatter } : {};
			},
		},
	} as unknown as App;
	const { registry } = readingHarness();
	registry.add(definition({ id: "quiet", displayName: "Quiet" }));
	// One device: what it writes by hand it may refresh by itself afterwards.
	return {
		app,
		files,
		writes,
		plugin: { registry, cssInjector: new CSSInjector(app, registry), webFiles: webFileMemory() },
	};
}

const noPrompt = (): Promise<boolean> => {
	throw new Error("the overwrite prompt should not have been reached");
};
const byHand = (v: Vault, confirm: (paths: string[]) => Promise<boolean> = noPrompt) =>
	exportWebTarget(v.app, v.plugin, "garden", { confirmOverwrite: confirm });
const automatic = (v: Vault) => exportWebTarget(v.app, v.plugin, "garden", { auto: true });
const status = (v: Vault) => webTargetStatus(v.app, v.plugin, "garden");
const recolour = (v: Vault): void => {
	v.plugin.registry.update("quiet", { colorLight: "#aa0000" });
};

/** The data block of a note on disk, decoded. */
const carried = (text: string): unknown => JSON.parse(readGardenNoteBody(splitFrontmatter(text).body)?.json ?? "null");

describe("writing the garden note", () => {
	it("creates it, marked for publishing and by its property, with the snapshot inside", async () => {
		const v = vault();
		assert.equal(await status(v), "missing");
		assert.equal(summarize(await byHand(v)), "created");
		const text = v.files.get(GARDEN_NOTE_PATH) ?? "";
		assert.ok(
			text.startsWith(
				`---\ndg-publish: true\n${GARDEN_NOTE_KEY}: ${GARDEN_NOTE_FORMAT}\n---\n# READ THIS\n\n> [!question] What does this file contain?`,
			),
		);
		assert.deepEqual(carried(text), buildWebBundleData(v.plugin, "garden"));
		assert.equal(await status(v), "current");

		assert.equal(summarize(await byHand(v)), "unchanged");
		assert.deepEqual(v.writes, [GARDEN_NOTE_PATH], "writes nothing when nothing changed");
	});

	it("replaces an edited body without asking, by hand and automatically, and keeps the properties", async () => {
		const v = vault();
		await byHand(v);
		const mine = `---\ndg-publish: true\n${GARDEN_NOTE_KEY}: 1\ntags: [web, garden]\ndg-hide: true\n---\n`;
		const original = splitFrontmatter(v.files.get(GARDEN_NOTE_PATH) ?? "").body;
		v.files.set(GARDEN_NOTE_PATH, `${mine}${original.replace(/\n[A-Za-z0-9+/]{20}/, "\nmy own words here!!")}`);
		assert.equal(await status(v), "edited", "the garden could not read this");

		assert.equal(summarize(await byHand(v)), "updated");
		assert.equal(v.files.get(GARDEN_NOTE_PATH), `${mine}${original}`, "properties byte for byte, body ours again");

		v.files.set(GARDEN_NOTE_PATH, `${mine}scribbled over`);
		recolour(v);
		assert.equal(summarize(await automatic(v)), "updated");
		assert.ok((v.files.get(GARDEN_NOTE_PATH) ?? "").startsWith(mine));
		assert.deepEqual(carried(v.files.get(GARDEN_NOTE_PATH) ?? ""), buildWebBundleData(v.plugin, "garden"));
	});

	it("is out of date, not edited, after a callout changed", async () => {
		const v = vault();
		await byHand(v);
		recolour(v);
		assert.equal(await status(v), "stale");
	});

	it("follows the note wherever it was moved, and leaves the usual path empty", async () => {
		const v = vault();
		await byHand(v);
		const moved = "Garden/Settings for the web.md";
		v.files.set(moved, v.files.get(GARDEN_NOTE_PATH) ?? "");
		v.files.delete(GARDEN_NOTE_PATH);
		recolour(v);
		assert.deepEqual(await locateGardenNote(v.app), { path: moved, found: true, others: [] });
		assert.equal(summarize(await automatic(v)), "updated");
		assert.ok(!v.files.has(GARDEN_NOTE_PATH));
		assert.deepEqual(carried(v.files.get(moved) ?? ""), buildWebBundleData(v.plugin, "garden"));
	});

	it("writes the note at the usual path when there are several, and never touches the others", async () => {
		const v = vault();
		await byHand(v);
		const copy = "Archive/callout-studio-web 1.md";
		const before = `---\n${GARDEN_NOTE_KEY}: 1\n---\nan old copy`;
		v.files.set(copy, before);
		assert.deepEqual(await locateGardenNote(v.app), { path: GARDEN_NOTE_PATH, found: true, others: [copy] });
		recolour(v);
		await byHand(v);
		assert.equal(v.files.get(copy), before);
	});

	it("asks before replacing a note of the user's that only has the name", async () => {
		const notOurs = "---\ntags: [diary]\n---\nMy own note.\n";
		const v = vault({ [GARDEN_NOTE_PATH]: notOurs });
		assert.equal(await status(v), "missing");
		const asked: string[][] = [];
		const no = (paths: string[]) => {
			asked.push(paths);
			return Promise.resolve(false);
		};
		assert.equal((await byHand(v, no)).status, "cancelled");
		assert.deepEqual(asked, [[GARDEN_NOTE_PATH]]);
		assert.equal((await automatic(v)).status, "written");
		assert.equal(v.files.get(GARDEN_NOTE_PATH), notOurs, "an automatic refresh never replaces it");
		assert.deepEqual(v.writes, []);
	});

	it("never creates the note by itself", async () => {
		const v = vault();
		assert.equal(summarize(await automatic(v)), "unchanged");
		assert.deepEqual(v.writes, []);
	});
});

/* --- Reading it in the garden ---------------------------------------------- */

const ROOT = "/garden";
const NOTES = `${ROOT}/src/site/notes`;
const PLUGIN_DIR = `${ROOT}/src/plugins/callout-studio`;

/** What Digital Garden's compiler makes of a note's properties on publish. */
function published(vaultText: string, permalink: string): string {
	const { frontmatter, body } = splitFrontmatter(vaultText);
	const own = properties(vaultText) ?? {};
	delete own["dg-publish"];
	const compiled = { "dg-publish": true, permalink, "dg-note-properties": own };
	assert.ok(frontmatter !== null);
	return `---\n${JSON.stringify(compiled)}\n---\n${body}`;
}

/** A note as the garden's repository holds it, from a snapshot. */
function gardenNote(data: unknown, properties: Record<string, unknown> = { [GARDEN_NOTE_KEY]: 1 }): string {
	const json = JSON.stringify(data);
	return `---\n${JSON.stringify({ "dg-publish": true, "dg-note-properties": properties })}\n---\n${buildGardenNoteBody(hex(json), json)}`;
}

/** A garden on disk, as far as `fs.readdirSync` and `readFileSync` show it. */
function gardenNode(files: Record<string, string>, options: { failRead?: boolean } = {}): GardenNode {
	const fs: GardenNode["fs"] = {
		readdirSync(dir) {
			const names = new Map<string, boolean>();
			for (const path of Object.keys(files)) {
				if (!path.startsWith(`${dir}/`)) continue;
				const [name = "", ...deeper] = path.slice(dir.length + 1).split("/");
				names.set(name, (names.get(name) ?? false) || deeper.length > 0);
			}
			if (names.size === 0) throw new Error(`ENOENT: ${dir}`);
			return [...names].map(([name, isDir]) => ({ name, isDirectory: () => isDir, isFile: () => !isDir }));
		},
		readFileSync(file) {
			if (options.failRead) throw new Error("EIO");
			const text = files[file];
			if (text === undefined) throw new Error(`ENOENT: ${file}`);
			return text;
		},
	};
	return { fs, path: nodePath.posix, crypto: { createHash }, cwd: () => ROOT };
}

interface Recorded {
	ignores: string[];
	globals: Record<string, unknown>;
	templates: Array<{ path: string; content: string; data: Record<string, unknown> }>;
}

function eleventyConfig(): Recorded & Parameters<GardenHooks["setupEleventy"]>[0] {
	const recorded: Recorded = { ignores: [], globals: {}, templates: [] };
	return Object.assign(recorded, {
		ignores: Object.assign(recorded.ignores, { add: (path: string) => recorded.ignores.push(path) }),
		addGlobalData: (name: string, value: unknown) => {
			recorded.globals[name] = value;
		},
		addTemplate: (path: string, content: string, data: Record<string, unknown>) => {
			recorded.templates.push({ path, content, data });
		},
	});
}

/** A markdown-it whose `render` hands back what it is given. */
const markdownIt = () => ({ render: (html: unknown) => String(html) });

/** What the hooks told the build log, for the suite that reads it. */
const warnings: string[] = [];
const realWarn = console.warn;

describe("the garden plugin reading the note", () => {
	const context = { pluginDir: PLUGIN_DIR };
	beforeEach(() => {
		warnings.length = 0;
		console.warn = (...args: unknown[]) => {
			warnings.push(args.map(String).join(" "));
		};
	});
	afterEach(() => {
		console.warn = realWarn;
	});

	it("reads what Callout Studio wrote, after Digital Garden published it", async () => {
		const v = vault();
		await byHand(v);
		const note = published(v.files.get(GARDEN_NOTE_PATH) ?? "", "/callout-studio-web/");
		const hooks = garden(
			core,
			gardenNode({ [`${NOTES}/${GARDEN_NOTE_PATH}`]: note, [`${NOTES}/Home.md`]: "# Home" }),
		);
		const found = hooks.load(context);
		assert.deepEqual(found.data, JSON.parse(JSON.stringify(buildWebBundleData(v.plugin, "garden"))));
		assert.equal(found.source, GARDEN_NOTE_PATH);
		assert.deepEqual(found.ignore, [`src/site/notes/${GARDEN_NOTE_PATH}`]);
		assert.deepEqual(warnings, []);
	});

	it("draws the callouts, keeps the note off the site, and serves its stylesheet", () => {
		const hooks = garden(core, gardenNode({ [`${NOTES}/${GARDEN_NOTE_PATH}`]: gardenNote(DATA) }));
		const md = markdownIt();
		hooks.setupMarkdown(md, context);
		assert.match(md.render("<h2>[!tip] Title</h2>"), /cs-heading-callout/);
		assert.equal(md.render("<p>No callout here.</p>"), "<p>No callout here.</p>");

		const config = eleventyConfig();
		hooks.setupEleventy(config, context);
		assert.deepEqual([...config.ignores], [`src/site/notes/${GARDEN_NOTE_PATH}`]);
		assert.deepEqual(config.globals[GARDEN_GLOBAL], { stylesheet: GARDEN_STYLESHEET_URL, css: DATA.css });
		assert.equal(config.templates.length, 1);
		assert.equal(config.templates[0]?.data.permalink, GARDEN_STYLESHEET_URL);
		assert.equal(config.templates[0]?.data.eleventyExcludeFromCollections, true);
		assert.ok(!config.templates[0]?.content.includes("color"), "the rules are data, never a template");
	});

	it("finds a note moved anywhere among the notes", () => {
		const hooks = garden(core, gardenNode({ [`${NOTES}/Deep/er/web data.md`]: gardenNote(DATA) }));
		assert.equal(hooks.load(context).source, "Deep/er/web data.md");
	});

	it("says so in the build log, and draws nothing, when there is no note", () => {
		const hooks = garden(core, gardenNode({ [`${NOTES}/Home.md`]: "mentions callout-studio-web in passing" }));
		const md = markdownIt();
		const render = md.render;
		hooks.setupMarkdown(md, context);
		assert.equal(md.render, render, "markdown-it is left as it was");
		const config = eleventyConfig();
		hooks.setupEleventy(config, context);
		assert.deepEqual([...config.ignores], []);
		assert.equal(config.templates.length, 0);
		assert.equal(warnings.length, 1, "warned once, however many hooks ran");
		assert.match(warnings[0] ?? "", /^\[Callout Studio\] No note with the callout-studio-web property/);
	});

	it("keeps a note changed by hand off the site too, and says what to do", () => {
		// One digit of the fingerprint off: what any edit to the data amounts to.
		const note = gardenNote(DATA).replace(
			/sha256:([0-9a-f])/,
			(_, digit: string) => `sha256:${digit === "0" ? "1" : "0"}`,
		);
		const hooks = garden(core, gardenNode({ [`${NOTES}/${GARDEN_NOTE_PATH}`]: note }));
		const found = hooks.load(context);
		assert.equal(found.data, null);
		assert.deepEqual(found.ignore, [`src/site/notes/${GARDEN_NOTE_PATH}`]);
		assert.ok(warnings.some((line) => line.includes("was changed by hand") && line.includes("Update now")));
	});

	it("does not read a note a newer Callout Studio wrote", () => {
		const note = gardenNote(DATA, { [GARDEN_NOTE_KEY]: GARDEN_NOTE_FORMAT + 1 });
		const found = garden(core, gardenNode({ [`${NOTES}/${GARDEN_NOTE_PATH}`]: note })).load(context);
		assert.equal(found.data, null);
		assert.ok(warnings.some((line) => line.includes("newer Callout Studio")));
	});

	it("prefers the note at the usual path, as Obsidian's side does, and names the others", () => {
		const other = { ...DATA, fallback: "tip" };
		const hooks = garden(
			core,
			gardenNode({
				[`${NOTES}/${GARDEN_NOTE_PATH}`]: gardenNote(DATA),
				[`${NOTES}/A first.md`]: gardenNote(other),
			}),
		);
		const found = hooks.load(context);
		assert.equal(found.source, GARDEN_NOTE_PATH);
		assert.equal(found.data?.fallback, "note");
		assert.equal(found.ignore.length, 2, "both stay off the site");
		assert.ok(warnings.some((line) => line.includes("More than one note") && line.includes("A first.md")));
	});

	it("never throws into the build", () => {
		const hooks = garden(core, gardenNode({ [`${NOTES}/x.md`]: "callout-studio-web" }, { failRead: true }));
		const config = eleventyConfig();
		assert.doesNotThrow(() => hooks.setupEleventy(config, context));
		assert.doesNotThrow(() => hooks.setupMarkdown(markdownIt(), context));
		assert.ok(warnings.some((line) => line.includes("Could not read the garden's notes")));
	});
});

/* --- The plugin a garden installs ------------------------------------------ */

describe("the Callout Studio garden plugin, as files", () => {
	const manifest = JSON.parse(readRepoFile("web-plugins/digital-garden/garden-plugin.json")) as Record<
		string,
		unknown
	>;

	it("has the manifest the garden's loader and installer accept", () => {
		for (const field of ["id", "name", "version", "description", "author"]) {
			assert.equal(typeof manifest[field], "string", `"${field}" is required`);
		}
		const id = String(manifest.id);
		assert.match(id, /^[a-z0-9][a-z0-9-]*$/);
		assert.ok(!id.startsWith("dg-"), "the dg- prefix is the template's own");
		assert.equal(manifest.hooks, "index.js");
		assert.deepEqual(manifest.slots, { "common.head": "head.njk" });
		// The stylesheet is served under the plugin's own folder on the site.
		assert.ok(GARDEN_STYLESHEET_URL.startsWith(`/plugins/${id}/`));
		const head = readRepoFile("web-plugins/digital-garden/head.njk");
		assert.ok(head.includes(`${GARDEN_GLOBAL}.stylesheet`));
		assert.ok(readRepoFile("web-plugins/digital-garden/README.md").includes(GARDEN_NOTE_KEY));
	});

	it("starts from its own bytes and draws a note, with nothing but Node's modules", () => {
		const source = gardenPluginIndex({
			coreJs: WEB_CORE_JS,
			coreGlobal: WEB_CORE_GLOBAL,
			hostJs: WEB_GARDEN_JS,
			hostGlobal: WEB_GARDEN_GLOBAL,
			version: "test",
		});
		const node = gardenNode({ [`${NOTES}/${GARDEN_NOTE_PATH}`]: gardenNote(DATA) });
		const modules: Record<string, unknown> = { fs: node.fs, path: nodePath.posix, crypto: { createHash } };
		const module = { exports: {} as unknown };
		vm.runInNewContext(source, {
			module,
			exports: module.exports,
			require: (name: string) => {
				if (!(name in modules)) throw new Error(`the garden plugin required "${name}"`);
				return modules[name];
			},
			process: { cwd: () => ROOT },
			console,
			TextEncoder,
			TextDecoder,
		});
		const hooks = module.exports as GardenHooks;
		const md = markdownIt();
		hooks.setupMarkdown(md, { pluginDir: PLUGIN_DIR });
		assert.match(md.render("<p>An [!tip] inline.</p>"), /cs-inline-callout/);
		const config = eleventyConfig();
		hooks.setupEleventy(config, { pluginDir: PLUGIN_DIR });
		assert.deepEqual([...config.ignores], [`src/site/notes/${GARDEN_NOTE_PATH}`]);
	});
});
