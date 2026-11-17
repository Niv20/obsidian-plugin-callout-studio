/**
 * tests/webExport.test.ts — the website export: what is written into the vault
 * for each kind of site, and what those bytes do.
 *
 * Four promises meet here, and each has its own way of being broken quietly:
 *
 * - **It writes like the CSS snippet does, to several files.** Only when the
 *   bytes would change; a file the user edited costs one confirmation rather
 *   than their edit, and declining writes nothing; nothing throws. Asserted on
 *   the fake adapter's write log, not only on the returned status.
 * - **`publish.js` and `publish.css` are the user's files.** The export owns a
 *   marked block in each and must hand back every other byte unchanged.
 * - **An automatic refresh is narrower than a write by hand.** It never creates
 *   a file, never replaces one that was edited, and never asks.
 * - **A page reads like the note.** The same markup through reading view's
 *   post-processor and through the exported renderer must come out as the same
 *   DOM. This is the suite that would notice the two surfaces drifting, which
 *   is why it compares whole elements rather than sampling classes.
 *
 * The last suites evaluate the generated files themselves: the renderer is
 * unit-tested in `webRuntime.test.ts` and the build-time hosts in
 * `webStatic.test.ts`, but "the file a user copies to their site starts and
 * draws" is a claim about the bytes, and only running them answers it.
 */
import assert from "node:assert";
import { afterEach, describe, it } from "node:test";
import vm from "node:vm";
// Listed first among the project imports: it installs the DOM globals before
// anything under test loads (see tests/support/fakeDom.ts).
import { asEl, fakeDom, html, type FakeElement } from "./support/fakeDom";
import { installFakeDomParser } from "./support/fakeDomParser";
import type { App } from "obsidian";
import {
	WEB_BROWSER_JS,
	WEB_CORE_JS,
	WEB_GARDEN_JS,
	WEB_STATIC_JS,
	WEB_STRUCTURAL_CSS,
} from "virtual:callout-studio-web-assets";
import { CSS_HEADING_LINE, CSS_INLINE_TOKEN, CSS_TOKEN_ICON } from "../src/editor/tokenClasses";
import { CSSInjector } from "../src/manager/CSSInjector";
import { sha256 } from "../src/manager/cssSnippetFile";
import { findBlock } from "../src/manager/web/managedBlock";
import {
	GARDEN_NOTE_PATH,
	PUBLISH_CSS,
	PUBLISH_JS,
	QUARTZ_NOTE_KEY,
	QUARTZ_NOTE_NAME,
	WEB_TARGET_IDS,
	targetFiles,
	type WebTargetId,
} from "../src/manager/web/targets";
import {
	buildWebBundleData,
	pendingIcons,
	webBundleDefinitions,
	type WebExportPlugin,
} from "../src/manager/web/webData";
import { exportWebTarget, summarize, webTargetStatus, type WebExportOutcome } from "../src/manager/web/writeTarget";
import { createWebRenderer } from "../src/web/core";
import { readNoteBody, splitFrontmatter } from "../src/web/static/webNote";
import { definition, parseRules } from "./support/cssInjectorHarness";
import { readingHarness } from "./support/readingHarness";
import { readRepoFile } from "./support/sourceScan";
import { webFileMemory } from "./support/webFileMemory";

// The browser host parses a baked icon with `DOMParser`, which a browser has
// and Node does not — see tests/support/fakeDomParser.ts for why it is not global.
installFakeDomParser();

/* --- The fake vault -------------------------------------------------------- */

interface Vault {
	writes: [string, string][];
	files: Map<string, string>;
	folders: Set<string>;
	failRead: boolean;
	failWrite: boolean;
}

interface Fake {
	app: App;
	vault: Vault;
	plugin: WebExportPlugin;
}

function fake(onDisk: Record<string, string> = {}): Fake {
	const vault: Vault = {
		writes: [],
		files: new Map(Object.entries(onDisk)),
		folders: new Set(),
		failRead: false,
		failWrite: false,
	};
	const app = {
		vault: {
			configDir: ".obsidian",
			adapter: {
				exists: (path: string): Promise<boolean> =>
					Promise.resolve(vault.files.has(path) || vault.folders.has(path)),
				read(path: string): Promise<string> {
					if (vault.failRead) return Promise.reject(new Error("EIO"));
					return Promise.resolve(vault.files.get(path) ?? "");
				},
				write(path: string, data: string): Promise<void> {
					if (vault.failWrite) return Promise.reject(new Error("EPERM"));
					const slash = path.lastIndexOf("/");
					if (slash > 0 && !vault.folders.has(path.slice(0, slash))) {
						return Promise.reject(new Error(`ENOENT: no folder for ${path}`));
					}
					vault.writes.push([path, data]);
					vault.files.set(path, data);
					return Promise.resolve();
				},
				mkdir(path: string): Promise<void> {
					vault.folders.add(path);
					return Promise.resolve();
				},
			},
		},
	} as unknown as App;
	// The reading harness seeds a registry exactly as a first run does, and
	// hands back the post-processor the parity suite compares against.
	const { registry } = readingHarness();
	registry.add(definition({ id: "quiet", displayName: "Quiet", aliases: ["hush"] }));
	// One device: what it writes by hand it may refresh by itself afterwards.
	return { app, vault, plugin: { registry, cssInjector: new CSSInjector(app, registry), webFiles: webFileMemory() } };
}

function prompt(answer: boolean): ((paths: string[]) => Promise<boolean>) & { asked: string[][] } {
	const fn = Object.assign(
		(paths: string[]) => {
			fn.asked.push(paths);
			return Promise.resolve(answer);
		},
		{ asked: [] as string[][] },
	);
	return fn;
}

const noPrompt = (_paths: string[]): Promise<boolean> => {
	throw new Error("the overwrite prompt should not have been reached");
};

const byHand = (
	f: Fake,
	target: WebTargetId,
	confirm: (paths: string[]) => Promise<boolean> = noPrompt,
): Promise<WebExportOutcome> => exportWebTarget(f.app, f.plugin, target, { confirmOverwrite: confirm });

const automatic = (f: Fake, target: WebTargetId): Promise<WebExportOutcome> =>
	exportWebTarget(f.app, f.plugin, target, { auto: true });

const results = (outcome: WebExportOutcome): string[] =>
	outcome.status === "written" ? outcome.files.map((file) => `${file.path}: ${file.result}`) : [outcome.status];

const recolour = (f: Fake): void => {
	f.plugin.registry.update("quiet", { colorLight: "#aa0000" });
};

/* --- Writing a file of our own --------------------------------------------- */

describe("writing a website target by hand", () => {
	/** Quartz's note, where a new one goes: the top of the vault. */
	const QUARTZ = QUARTZ_NOTE_NAME;

	/** The note's data block, read back. */
	const quartzData = (f: Fake, path = QUARTZ): { json: string; fingerprint: string } | null =>
		readNoteBody(QUARTZ_NOTE_KEY, splitFrontmatter(f.vault.files.get(path) ?? "").body);

	it("creates a note that is a draft, says what it is, and carries its data with a fingerprint", async () => {
		const f = fake();
		const outcome = await byHand(f, "quartz");

		assert.deepStrictEqual(results(outcome), [`${QUARTZ}: created`]);
		assert.strictEqual(summarize(outcome), "created");
		const text = f.vault.files.get(QUARTZ) ?? "";
		const { frontmatter, body } = splitFrontmatter(text);
		assert.strictEqual(frontmatter, "---\ndraft: true\ncallout-studio-quartz: 1\n---\n");
		assert.ok(body.startsWith("# READ THIS\n"), "what it is comes first");
		assert.ok(body.includes("Callout Studio Quartz plugin"), "it names who reads it");
		const data = quartzData(f);
		assert.ok(data);
		assert.strictEqual(data.fingerprint, await sha256(data.json), "the fingerprint is of the data");
		assert.strictEqual((JSON.parse(data.json) as { version: number }).version, 1);
	});

	it("writes nothing when nothing changed", async () => {
		const f = fake();
		await byHand(f, "quartz");
		const again = await byHand(f, "quartz");
		assert.strictEqual(summarize(again), "unchanged");
		assert.strictEqual(f.vault.writes.length, 1);
	});

	it("rewrites its note's body without asking once a callout changed, and keeps the user's properties", async () => {
		const f = fake();
		await byHand(f, "quartz");
		const mine = "---\ndraft: true\ntags: [site]\ncallout-studio-quartz: 1\npublish: true\n---\n";
		f.vault.files.set(QUARTZ, mine + splitFrontmatter(f.vault.files.get(QUARTZ) ?? "").body);
		recolour(f);
		const again = await byHand(f, "quartz");
		assert.deepStrictEqual(results(again), [`${QUARTZ}: updated`]);
		assert.strictEqual(splitFrontmatter(f.vault.files.get(QUARTZ) ?? "").frontmatter, mine);
	});

	it("asks once before replacing a note of the user's that has the name, and writes nothing on a no", async () => {
		const foreign = fake({ [QUARTZ]: "# My own note\n" });
		const no = prompt(false);
		assert.strictEqual((await byHand(foreign, "quartz", no)).status, "cancelled");
		assert.deepStrictEqual(no.asked, [[QUARTZ]]);
		assert.strictEqual(foreign.vault.writes.length, 0);
	});

	it("puts its data back in a note of its own that was edited, without asking", async () => {
		const f = fake();
		await byHand(f, "quartz");
		const text = f.vault.files.get(QUARTZ) ?? "";
		f.vault.files.set(
			QUARTZ,
			text.replace(/(sha256:)([0-9a-f])/, (_, p: string, d: string) => p + (d === "0" ? "1" : "0")),
		);
		assert.strictEqual(await webTargetStatus(f.app, f.plugin, "quartz"), "edited");
		assert.strictEqual(summarize(await byHand(f, "quartz")), "updated");
		assert.strictEqual(f.vault.files.get(QUARTZ), text);
	});

	it("reports a failed write, and an unreadable note as one to ask about", async () => {
		const readOnly = fake();
		readOnly.vault.failWrite = true;
		assert.strictEqual((await byHand(readOnly, "quartz")).status, "failed");

		const unreadable = fake({ [QUARTZ]: "anything" });
		unreadable.vault.failRead = true;
		const no = prompt(false);
		assert.strictEqual((await byHand(unreadable, "quartz", no)).status, "cancelled");
		assert.strictEqual(no.asked.length, 1);
	});

	it("still writes while both roles are switched off: the block callouts' styles travel", async () => {
		const f = fake();
		f.plugin.registry.settings.headingCallouts.enabled = false;
		f.plugin.registry.settings.inlineCallouts.enabled = false;
		assert.strictEqual(await webTargetStatus(f.app, f.plugin, "quartz"), "missing");
		for (const target of WEB_TARGET_IDS) {
			assert.strictEqual(summarize(await byHand(f, target)), "created", target);
		}
		assert.ok(
			(f.vault.files.get(PUBLISH_CSS) ?? "").includes('.callout.callout[data-callout="quiet"]'),
			"publish.css has no rule for the user's block callout",
		);
		for (const target of WEB_TARGET_IDS) {
			assert.strictEqual(await webTargetStatus(f.app, f.plugin, target), "current", target);
		}
	});

	it("writes the Digital Garden note and the Quartz one at the top of the vault, in no folder", async () => {
		const f = fake();
		assert.deepStrictEqual(results(await byHand(f, "garden")), [`${GARDEN_NOTE_PATH}: created`]);
		assert.deepStrictEqual(results(await byHand(f, "quartz")), [`${QUARTZ}: created`]);
		assert.ok(!GARDEN_NOTE_PATH.includes("/") && !QUARTZ.includes("/"));
		assert.equal(f.vault.folders.size, 0);
	});

	it("puts a new Quartz note under content/ when the vault is the Quartz repository", async () => {
		const f = fake();
		f.vault.folders.add("content");
		const outcome = await exportWebTarget(f.app, f.plugin, "quartz", {
			confirmOverwrite: noPrompt,
			quartzInVault: true,
		});
		assert.deepStrictEqual(results(outcome), [`content/${QUARTZ}: created`]);
	});

	it("puts a new Quartz note where the plugin that publishes the notes looks, with its property on", async () => {
		const f = fake();
		const outcome = await exportWebTarget(f.app, f.plugin, "quartz", {
			confirmOverwrite: noPrompt,
			noteFolder: "Public/site",
			noteMarkers: ["publish"],
		});
		assert.deepStrictEqual(results(outcome), [`Public/site/${QUARTZ}: created`]);
		assert.ok(f.vault.folders.has("Public/site"), "its folder was made first");
		assert.strictEqual(
			splitFrontmatter(f.vault.files.get(`Public/site/${QUARTZ}`) ?? "").frontmatter,
			"---\ndraft: true\npublish: true\ncallout-studio-quartz: 1\n---\n",
		);
	});

	it("takes a note whose line endings changed for its own, with its data current", async () => {
		const f = fake();
		await byHand(f, "quartz");
		const text = f.vault.files.get(QUARTZ) ?? "";
		f.vault.files.set(QUARTZ, text.replace(/\n/g, "\r\n"));
		// The data is what this device would write: nothing for an automatic
		// refresh to do, and nothing to ask about by hand.
		assert.strictEqual(await webTargetStatus(f.app, f.plugin, "quartz"), "current");
		assert.strictEqual(summarize(await byHand(f, "quartz")), "updated");
	});

	it("tells the Publish to the web page what is on disk", async () => {
		const f = fake();
		assert.strictEqual(await webTargetStatus(f.app, f.plugin, "quartz"), "missing");
		await byHand(f, "quartz");
		const written = f.vault.writes.length;
		assert.strictEqual(await webTargetStatus(f.app, f.plugin, "quartz"), "current");
		recolour(f);
		assert.strictEqual(await webTargetStatus(f.app, f.plugin, "quartz"), "stale");
		assert.strictEqual(f.vault.writes.length, written, "asking for the status writes nothing");
	});
});

/* --- A block in the user's own file ---------------------------------------- */

describe("the Obsidian Publish target", () => {
	const THEME = "/* my theme */\nbody { --accent: red; }\n";
	const ANALYTICS = "console.log('my analytics');\n";

	it("creates both files when the vault has neither", async () => {
		const f = fake();
		assert.deepStrictEqual(results(await byHand(f, "publish")), [
			`${PUBLISH_JS}: created`,
			`${PUBLISH_CSS}: created`,
		]);
		const js = f.vault.files.get(PUBLISH_JS) ?? "";
		assert.ok(js.startsWith("/* callout-studio:start"));
		assert.ok(js.endsWith("/* callout-studio:end */\n"));
		assert.ok(js.includes("CalloutStudioBrowser.init(CalloutStudioCore, {"), "the block starts the renderer");
	});

	it("adds its block after what is already there, and hands the rest back untouched", async () => {
		const f = fake({ [PUBLISH_JS]: ANALYTICS, [PUBLISH_CSS]: THEME });
		// Adding to a file is not replacing anything, so nobody is asked.
		assert.strictEqual(summarize(await byHand(f, "publish")), "updated");
		const js = f.vault.files.get(PUBLISH_JS) ?? "";
		const css = f.vault.files.get(PUBLISH_CSS) ?? "";
		assert.ok(js.startsWith(`${ANALYTICS}\n/* callout-studio:start`));
		assert.ok(css.startsWith(`${THEME}\n/* callout-studio:start`));
	});

	it("replaces only its own block when the callouts change", async () => {
		const f = fake({ [PUBLISH_JS]: ANALYTICS });
		await byHand(f, "publish");
		const tail = "\nconsole.log('added below, later');\n";
		f.vault.files.set(PUBLISH_JS, `${f.vault.files.get(PUBLISH_JS)}${tail}`);
		recolour(f);

		assert.strictEqual(summarize(await byHand(f, "publish")), "updated");
		const js = f.vault.files.get(PUBLISH_JS) ?? "";
		assert.ok(js.startsWith(ANALYTICS), "what was above the block is still there");
		assert.ok(js.endsWith(tail), "what was below the block is still there");
		assert.strictEqual(js.split("callout-studio:start").length, 2, "there is still exactly one block");
		assert.strictEqual((await findBlock(js)).kind, "ours");
		// The colour lives in the stylesheet; the script's data did not change.
		assert.ok((f.vault.files.get(PUBLISH_CSS) ?? "").includes("#aa0000"));
	});

	it("writes nothing when nothing changed", async () => {
		const f = fake({ [PUBLISH_JS]: ANALYTICS });
		await byHand(f, "publish");
		const writes = f.vault.writes.length;
		assert.strictEqual(summarize(await byHand(f, "publish")), "unchanged");
		assert.strictEqual(f.vault.writes.length, writes);
	});

	it("asks before replacing a block that was edited", async () => {
		const f = fake();
		await byHand(f, "publish");
		f.vault.files.set(PUBLISH_CSS, (f.vault.files.get(PUBLISH_CSS) ?? "").replace("inline-flex", "flex"));
		recolour(f);
		const no = prompt(false);
		assert.strictEqual((await byHand(f, "publish", no)).status, "cancelled");
		assert.deepStrictEqual(no.asked, [[PUBLISH_CSS]]);
	});

	it("refuses a file whose block has no end, rather than guess where it stops", async () => {
		const f = fake({ [PUBLISH_JS]: "/* callout-studio:start — cut short */\nvar half = 1;\n" });
		assert.strictEqual((await byHand(f, "publish")).status, "failed");
		assert.strictEqual(f.vault.writes.length, 0);
	});

	it("keeps the stylesheet in publish.css and out of the script", () => {
		const data = buildWebBundleData(fake().plugin, "publish");
		const [js, css] = targetFiles("publish", data);
		assert.strictEqual(css?.body, data.css);
		assert.ok(!(js?.body ?? "").includes(".cs-inline-callout {"), "the rules travel in publish.css only");
		assert.ok((js?.body ?? "").includes('"defs":['));
	});
});

/* --- Keeping it up to date ------------------------------------------------- */

describe("an automatic refresh", () => {
	it("creates nothing: a target that was never written stays unwritten", async () => {
		const f = fake();
		for (const target of WEB_TARGET_IDS) {
			const outcome = await automatic(f, target);
			assert.strictEqual(summarize(outcome), "unchanged", `${target} was written`);
		}
		assert.strictEqual(f.vault.writes.length, 0);
	});

	it("adds no block to a publish.js that never had one", async () => {
		const f = fake({ [PUBLISH_JS]: "console.log('mine');\n" });
		await automatic(f, "publish");
		assert.strictEqual(f.vault.writes.length, 0);
	});

	it("rewrites what it wrote once a callout changed", async () => {
		for (const target of WEB_TARGET_IDS) {
			const f = fake();
			await byHand(f, target);
			const before = f.vault.writes.length;
			recolour(f);
			assert.strictEqual(summarize(await automatic(f, target)), "updated", target);
			assert.ok(f.vault.writes.length > before, `${target} was not refreshed`);
			assert.strictEqual(await webTargetStatus(f.app, f.plugin, target), "current");
		}
	});

	it("leaves an edited block alone and never asks", async () => {
		const f = fake();
		await byHand(f, "publish");
		const path = PUBLISH_JS;
		const mine = (f.vault.files.get(path) ?? "").replace("(function () {", "(function () { /* mine */");
		assert.notStrictEqual(mine, f.vault.files.get(path));
		f.vault.files.set(path, mine);
		recolour(f);
		const writes = f.vault.writes.length;
		assert.ok(results(await automatic(f, "publish")).includes(`${path}: skipped`));
		assert.strictEqual(f.vault.files.get(path), mine);
		assert.ok(!f.vault.writes.slice(writes).some(([written]) => written === path), "never written");
	});

	it("waits while an icon is still on its way, where a write by hand does not", async () => {
		const f = fake();
		await byHand(f, "quartz");
		// An Octicons icon, and no Octicons data on this device yet.
		f.plugin.registry.add(
			definition({ id: "octo", displayName: "Octo", icon: { type: "octicons", value: "alert" } }),
		);
		assert.deepStrictEqual(pendingIcons(f.plugin), ["octo"]);

		const before = f.vault.writes.length;
		assert.deepStrictEqual(await automatic(f, "quartz"), { status: "waiting" });
		assert.strictEqual(f.vault.writes.length, before);
		// By hand, the file shows what the note shows.
		assert.strictEqual(summarize(await byHand(f, "quartz")), "updated");
	});

	it("does not wait for an icon whose download failed: that would wait forever", async () => {
		const f = fake();
		await byHand(f, "quartz");
		f.plugin.registry.add(
			definition({ id: "octo", displayName: "Octo", icon: { type: "octicons", value: "alert" } }),
		);
		const plugin: WebExportPlugin = { ...f.plugin, hasIconFetchFailed: () => true };
		assert.deepStrictEqual(pendingIcons(plugin), []);
		assert.strictEqual(summarize(await exportWebTarget(f.app, plugin, "quartz", { auto: true })), "updated");
	});

	it("never waits for an icon that is always here", () => {
		const f = fake();
		f.plugin.registry.add(definition({ id: "spark", displayName: "Spark", icon: { type: "emoji", value: "🔥" } }));
		f.plugin.registry.add(
			definition({ id: "bare", displayName: "Bare", hideIcon: true, icon: { type: "octicons", value: "x" } }),
		);
		assert.deepStrictEqual(pendingIcons(f.plugin), []);
	});

	it("does not bring back a file the user deleted", async () => {
		const f = fake();
		await byHand(f, "quartz");
		f.vault.files.delete(QUARTZ_NOTE_NAME);
		recolour(f);
		const writes = f.vault.writes.length;
		assert.deepStrictEqual(results(await automatic(f, "quartz")), []);
		assert.strictEqual(f.vault.writes.length, writes);
		assert.ok(!f.vault.files.has(QUARTZ_NOTE_NAME));
	});
});

/* --- What is in it --------------------------------------------------------- */

describe("the callouts the bundle carries", () => {
	it("are every callout a note may name, untouched built-ins included, in a stable order", () => {
		const f = fake();
		const ids = webBundleDefinitions(f.plugin).map((def) => def.id);
		assert.ok(ids.includes("note") && ids.includes("warning"), "built-ins nobody edited are there");
		assert.ok(ids.includes("quiet"));
		assert.deepStrictEqual(ids, [...ids].sort(), "sorted by codepoint, so the file is byte-stable");
	});

	it("read nothing of the active theme, so every device writes the same files", () => {
		const f = fake();
		const files = (): unknown =>
			WEB_TARGET_IDS.map((target) => targetFiles(target, buildWebBundleData(f.plugin, target)));
		const before = files();
		const { registry } = f.plugin;
		// What a theme does here at runtime: adds a callout of its own, and
		// takes over a built-in, which then wears whatever the theme draws.
		registry.add(definition({ id: "kanban", displayName: "Kanban", source: "theme" }));
		registry.setThemeOwnedIds(new Set(["note", "kanban"]));
		assert.strictEqual(registry.get("kanban")?.source, "theme", "the theme's row is in the registry");
		assert.ok(registry.themeOwns(registry.get("note")!), "the theme now owns note here");

		assert.deepStrictEqual(files(), before);
		assert.ok(!webBundleDefinitions(f.plugin).some((def) => def.id === "kanban"));
	});

	it("colour metadata words even where this device's snippets style them", () => {
		const f = fake();
		const css = buildWebBundleData(f.plugin, "publish").css;
		const words = [...css.matchAll(/\/\* metadata colour: ([^*]+?) \*\//g)].map((match) => match[1] ?? "");
		assert.ok(words.length > 0, "the default settings have metadata colours");

		// A snippet on this device styles every one of those words. In the vault
		// the plugin stands down on them; on a site, where the snippet is not,
		// it must not — and another device without the snippet must agree.
		const injector = f.plugin.cssInjector;
		const live = injector.metadataColorEntries().length;
		(injector.metadataCatalog as unknown as { snippetWords(): ReadonlySet<string> }).snippetWords = () =>
			new Set(words);
		assert.ok(injector.metadataColorEntries().length < live, "the vault's own sheet does stand down");
		assert.strictEqual(buildWebBundleData(f.plugin, "publish").css, css);
	});

	it("are reduced to a name, the aliases and a baked icon", () => {
		const f = fake();
		f.plugin.registry.add(definition({ id: "spark", displayName: "Spark", icon: { type: "emoji", value: "🔥" } }));
		f.plugin.registry.add(definition({ id: "bare", displayName: "Bare", hideIcon: true }));
		const data = buildWebBundleData(f.plugin, "publish");
		const byId = new Map(data.defs.map((def) => [def.id, def]));

		assert.deepStrictEqual(byId.get("spark"), { id: "spark", name: "Spark", icon: "🔥" });
		assert.deepStrictEqual(byId.get("bare"), { id: "bare", name: "Bare", hideIcon: true });
		assert.deepStrictEqual(byId.get("quiet")?.aliases, ["hush"]);
		assert.strictEqual(data.fallback, f.plugin.registry.settings.fallbackCalloutId);
		assert.strictEqual(data.version, 1);
	});

	it("carry the three switches the renderer reads", () => {
		const f = fake();
		const settings = f.plugin.registry.settings;
		settings.headingCallouts.enabled = false;
		settings.inlineCallouts.allowContent = false;
		const data = buildWebBundleData(f.plugin, "publish");
		assert.deepStrictEqual([data.heading, data.inline, data.content], [false, true, false]);
	});
});

describe("the stylesheet every target carries", () => {
	const selectors = (css: string): string[] => parseRules(css).map((rule) => rule.selector);

	it("opens with the structural rules out of styles.css", () => {
		const data = buildWebBundleData(fake().plugin, "publish");
		assert.ok(data.css.startsWith(WEB_STRUCTURAL_CSS));
		assert.ok(WEB_STRUCTURAL_CSS.includes(`.${CSS_INLINE_TOKEN} {`));
		assert.ok(WEB_STRUCTURAL_CSS.includes(`.${CSS_HEADING_LINE} {`));
		assert.ok(!WEB_STRUCTURAL_CSS.includes("/*"), "the comments stay in styles.css");
	});

	it("colours each callout's two roles, for its id and every alias", () => {
		const all = selectors(buildWebBundleData(fake().plugin, "publish").css).join("\n");
		for (const name of ["quiet", "hush", "note"]) {
			assert.ok(all.includes(`.${CSS_INLINE_TOKEN}[data-callout="${name}"]`), `no pill rule for ${name}`);
			assert.ok(all.includes(`.${CSS_HEADING_LINE}[data-callout="${name}"]`), `no bar rule for ${name}`);
		}
	});

	it("ends with the block callouts, which tests/webBlockCSS.test.ts follows per site", () => {
		for (const target of WEB_TARGET_IDS) {
			const all = selectors(buildWebBundleData(fake().plugin, target).css);
			const firstBlock = all.findIndex((selector) => /(^|[\s,>+~(])\.callout(?![\w-])/.test(selector));
			const lastToken = all.map((selector) => selector.includes(`.${CSS_INLINE_TOKEN}`)).lastIndexOf(true);
			assert.ok(firstBlock > lastToken, `${target}: a block rule sits among the heading and inline rules`);
		}
	});

	it("leans on no variable only Obsidian defines, for a heading bar or a pill", () => {
		// An untouched built-in defers to `--callout-default` in a vault; on a
		// published site that variable does not exist, so the colour is spelled.
		// The block rules after them do name the site's own variable: that is
		// how each site is told a colour (tests/webBlockCSS.test.ts).
		for (const target of WEB_TARGET_IDS) {
			const full = buildWebBundleData(fake().plugin, target).css;
			const blocks = full.indexOf(".callout.callout");
			assert.ok(blocks > 0, `${target}: no block rules`);
			const tokens = full.slice(0, blocks);
			assert.ok(!tokens.includes("--callout-"), `${target}: an Obsidian callout variable reached the bundle`);
			assert.ok(!full.includes("--cs-accent-theme"), target);
		}
		const css = buildWebBundleData(fake().plugin, "publish").css;
		const note = parseRules(css).find((rule) =>
			rule.selector.split(",").some((s) => s.trim() === `.${CSS_INLINE_TOKEN}[data-callout="note"]`),
		);
		assert.ok(
			note?.decls.some((decl) => /^--cs-accent: #[0-9a-f]{6}$/i.test(decl)),
			"note has a literal accent",
		);
	});

	it("carries the global frame and a callout's own icon adjustment", () => {
		const f = fake();
		f.plugin.registry.settings.globalStyle.inline.borderRadius = 4;
		f.plugin.registry.update("quiet", { iconAdjust: { inline: { offsetX: 0, offsetY: 2, size: 1 } } });
		const css = buildWebBundleData(f.plugin, "publish").css;
		assert.ok(css.includes("--cs-inline-radius: 4px;"));
		const nudge = parseRules(css).find(
			(rule) =>
				rule.selector.includes(`[data-callout="quiet"] > .${CSS_TOKEN_ICON}`) &&
				rule.props.includes("transform"),
		);
		assert.ok(nudge, "the inline icon nudge is missing");
	});
});

/* --- Each service's own files ---------------------------------------------- */

describe("what each service is given", () => {
	const files = (target: WebTargetId): Map<string, string> =>
		new Map(targetFiles(target, buildWebBundleData(fake().plugin, target)).map((file) => [file.path, file.body]));

	it("Quartz: one note carrying the whole snapshot, stylesheet included", () => {
		// The renderer is the Quartz plugin's, installed once in the site; only
		// the data is the vault's. tests/webQuartzPlugin.test.ts follows it into a build.
		const data = buildWebBundleData(fake().plugin, "quartz");
		const target = targetFiles("quartz", data);
		assert.deepStrictEqual(
			target.map((file) => [file.path, file.kind]),
			[[QUARTZ_NOTE_NAME, "note"]],
		);
		const body = target[0]?.body ?? "";
		const value = JSON.parse(body) as { css: string; defs: unknown[] };
		assert.deepStrictEqual(value.defs, JSON.parse(JSON.stringify(data.defs)));
		assert.ok(!body.includes("CalloutStudioCore"), "no code travels in the vault");
	});

	it("Quartz: dark mode is written against Quartz's own attribute", () => {
		const css = (JSON.parse(files("quartz").get(QUARTZ_NOTE_NAME) ?? "{}") as { css?: string }).css ?? "";
		assert.ok(!css.includes(".theme-dark"), "a .theme-dark rule would never match on a Quartz page");
		assert.ok(css.includes('[saved-theme="dark"] .cs-inline-callout'));
		// The band's own rule outweighs a Quartz 4 theme's `html[saved-theme="dark"] body h2`,
		// and no rule of a single callout: it is the only one weighed up.
		assert.ok(!/(^|[\n}])\s*\.cs-heading-callout\s*\{/.test(css), "the plain band rule is gone");
		assert.ok(css.includes("html body .cs-heading-callout:is(h1, h2, h3, h4, h5, h6):not(span):not(div) {"));
		assert.ok(css.includes('.cs-heading-callout[data-callout="quiet"]'), "a callout's own rules are as they were");
		// Everywhere else the class is what the site sets.
		const garden = JSON.parse(files("garden").get(GARDEN_NOTE_PATH) ?? "{}") as { css?: string };
		assert.ok((garden.css ?? "").includes(".theme-dark "));
	});

	it("Quartz: the note reads back to the snapshot it was written from", async () => {
		const f = fake();
		await byHand(f, "quartz");
		const read = readNoteBody(QUARTZ_NOTE_KEY, splitFrontmatter(f.vault.files.get(QUARTZ_NOTE_NAME) ?? "").body);
		assert.ok(read);
		assert.strictEqual(read.fingerprint, await sha256(read.json));
		assert.strictEqual(read.json, targetFiles("quartz", buildWebBundleData(f.plugin, "quartz"))[0]?.body);
	});

	it("Digital Garden: one note carrying the whole snapshot, stylesheet included", () => {
		// The renderer is the garden plugin's, installed once; only the data
		// is the vault's. tests/webGarden.test.ts follows it into the note.
		const target = targetFiles("garden", buildWebBundleData(fake().plugin, "garden"));
		assert.deepStrictEqual(
			target.map((file) => [file.path, file.kind]),
			[[GARDEN_NOTE_PATH, "note"]],
		);
		assert.deepStrictEqual(JSON.parse(target[0]?.body ?? "{}"), buildWebBundleData(fake().plugin, "garden"));
	});
});

/* --- Standing on a foreign page -------------------------------------------- */

describe("the scripts, as bytes on someone's site", () => {
	const BUNDLES = { core: WEB_CORE_JS, browser: WEB_BROWSER_JS, static: WEB_STATIC_JS, garden: WEB_GARDEN_JS };

	it("need nothing a browser or a bare Node build does not have", () => {
		for (const [name, text] of Object.entries(BUNDLES)) {
			assert.ok(!/\brequire\s*\(/.test(text), `${name} calls require()`);
			assert.ok(!text.includes("obsidian"), `${name} mentions obsidian`);
			assert.ok(!/\b(?:activeDocument|activeWindow|createSpan|createDiv|createEl)\b/.test(text), name);
		}
	});

	it("carry the renderer once: a host is built without it", () => {
		// The grammar's own regular expression is in the core and nowhere else.
		assert.ok(WEB_CORE_JS.includes("cs-inline-callout"));
		for (const host of [WEB_BROWSER_JS, WEB_STATIC_JS, WEB_GARDEN_JS]) {
			assert.ok(!host.includes("cs-inline-callout"), "a host bundle has a copy of the renderer");
		}
		assert.ok(WEB_BROWSER_JS.length < 4000, "the browser host should stay a few lines");
	});

	it("cannot close the <script> element they may be inlined in", () => {
		const f = fake();
		f.plugin.registry.add(definition({ id: "sneaky", displayName: "</script><b>" }));
		const script = targetFiles("publish", buildWebBundleData(f.plugin, "publish"))[0]?.body ?? "";
		assert.ok(!/<\/script/i.test(script), "a literal </script survived");
		assert.ok(script.includes("<\\/script><b>"), "the name is still there, escaped");
	});

	it("are the same text for the same settings", () => {
		for (const target of WEB_TARGET_IDS) {
			const first = targetFiles(target, buildWebBundleData(fake().plugin, target));
			const second = targetFiles(target, buildWebBundleData(fake().plugin, target));
			assert.deepStrictEqual(first, second, target);
		}
	});

	it("are cut from styles.css between two markers that are still there", () => {
		const styles = readRepoFile("styles.css");
		const start = styles.indexOf("/* @cs-web:start */");
		const end = styles.indexOf("/* @cs-web:end */");
		assert.ok(start > 0 && end > start, "styles.css lost a @cs-web marker");
		const region = styles.slice(start, end);
		for (const selector of [
			".cs-inline-callout {",
			".cs-callout-payload {",
			".cs-heading-callout {",
			".cs-heading-token {",
			".cs-token-empty {",
		]) {
			assert.ok(region.includes(selector), `${selector} is outside the exported region`);
		}
	});
});

/* --- A page reads like the note -------------------------------------------- */

describe("the same markup, in reading view and on a page", () => {
	const CASES = [
		"<div><h2>[!quiet] My title</h2></div>",
		"<div><h3>[!quiet]</h3></div>",
		"<div><h1>[!hush|purple] Aliased <strong>bold</strong> title</h1></div>",
		"<div><h2>[!nope] Unknown</h2></div>",
		"<div><h2>[!spark]-glued</h2></div>",
		"<p>see [!quiet] here, [!hush] there and [!spark] too</p>",
		"<p>unknown [!nope] and metadata [!quiet|purple]</p>",
		"<p>an [!quiet]{inline <strong>bold</strong> text} here</p>",
		"<p>[!bare]{no icon} and [!bare] plain</p>",
		"<p>empty [!quiet]{} braces, spaced [!quiet] {not one}</p>",
		"<p>adjacent [!quiet][!spark]</p>",
		'<p>kept: <code>[!quiet]</code> and <a href="x">[!quiet]</a></p>',
		"<div><h2>About [!quiet] in a title</h2><p>and [!quiet]{a <em>b</em> c}</p></div>",
	];

	const setup = (): { reading: ReturnType<typeof readingHarness>; web: ReturnType<typeof createWebRenderer> } => {
		const reading = readingHarness();
		const { registry } = reading;
		registry.add(definition({ id: "quiet", displayName: "Quiet", aliases: ["hush"] }));
		registry.add(definition({ id: "spark", displayName: "Spark", icon: { type: "emoji", value: "🔥" } }));
		registry.add(definition({ id: "bare", displayName: "Bare", hideIcon: true }));
		const data = buildWebBundleData({ registry, cssInjector: new CSSInjector({} as App, registry) }, "publish");
		return { reading, web: createWebRenderer(data) };
	};

	for (const markup of CASES) {
		it(`comes out as the same DOM: ${markup}`, () => {
			const { reading, web } = setup();
			// No section source: reading view's embed and export path, which
			// trusts the rendered text exactly as a published page must.
			const inNote = reading.render(markup);
			const onPage = html(markup);
			web.process(asEl(onPage));
			assert.strictEqual(onPage.outerHTML, inNote.outerHTML);
		});
	}
});

/* --- The generated files, run ---------------------------------------------- */

describe("publish.js, evaluated on a page", () => {
	const doc = fakeDom.document;
	const win = fakeDom.window as unknown as Record<string, unknown>;

	/** Run a file as a browser would run a script element. */
	const run = (script: string): void => {
		vm.runInThisContext(script);
	};

	const article = (): FakeElement => {
		const found = doc.body.querySelector("article");
		assert.ok(found);
		return found;
	};

	/** Our block of `publish.js`: Publish runs the whole file, and the rest is the user's. */
	const publishJs = (): string => targetFiles("publish", buildWebBundleData(fake().plugin, "publish"))[0]?.body ?? "";

	afterEach(() => {
		doc.body.replaceChildren();
		delete win.__calloutStudioWeb;
		delete win.publish;
	});

	it("turns what is there, and keeps up with what arrives", () => {
		doc.body.appendChild(html("<article><h2>[!quiet] Title</h2><p>see [!note]</p></article>"));

		run(publishJs());

		assert.ok(article().querySelector(`h2.${CSS_HEADING_LINE}`));
		assert.strictEqual(article().querySelectorAll(`.${CSS_INLINE_TOKEN}`).length, 1);

		// A section rendered later — Publish scrolling, or opening another note.
		article().appendChild(html("<p>later [!quiet]{with <em>content</em>}</p>"));
		fakeDom.settle();
		assert.strictEqual(article().querySelectorAll(`.${CSS_INLINE_TOKEN}`).length, 2);
		assert.strictEqual(article().textContent, "Titlesee Notelater with content");
	});

	it("starts once, however often it is loaded", () => {
		const processors: unknown[] = [];
		win.publish = { registerMarkdownPostProcessor: (processor: unknown) => processors.push(processor) };
		const script = publishJs();
		run(script);
		// The same file loaded twice, or pasted into the console.
		run(script);
		assert.strictEqual(processors.length, 1);
	});

	it("leaves no global of ours on the page", () => {
		run(publishJs());
		const globals = globalThis as Record<string, unknown>;
		assert.strictEqual(globals.CalloutStudioCore, undefined);
		assert.strictEqual(globals.CalloutStudioBrowser, undefined);
	});

	it("on Obsidian Publish, registers a post-processor and injects no stylesheet", () => {
		const processors: Array<(el: HTMLElement) => void> = [];
		win.publish = {
			registerMarkdownPostProcessor: (processor: (el: HTMLElement) => void) => processors.push(processor),
		};
		const styles = doc.head.querySelectorAll("style").length;
		run(publishJs());

		assert.strictEqual(processors.length, 1);
		// Publish hands over a block before attaching it to the page.
		const block = html("<div><h2>[!quiet] Title</h2></div>");
		processors[0]?.(asEl(block));
		assert.ok(block.querySelector(`h2.${CSS_HEADING_LINE}`));
		// Its rules are in publish.css, which the site loads itself.
		assert.strictEqual(doc.head.querySelectorAll("style").length, styles);
	});
});
