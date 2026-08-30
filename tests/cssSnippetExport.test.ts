/**
 * tests/cssSnippetExport.test.ts — the CSS snippet the user asks us to write
 * into their vault.
 *
 * This is the plugin's only *deliberate* write into `.obsidian/snippets/`, and
 * the folder it writes into is one the user owns and edits by hand. So the
 * properties worth pinning are not "does it produce CSS" — they are the ones
 * that decide whether the feature is safe to run twice:
 *
 * - **It writes one path, and only when the bytes would change.** Every write
 *   into the vault is a sync event, so re-exporting after no change must reach
 *   `exists` + `read` and stop. The suite asserts on the fake adapter's write
 *   log, not just on the returned status, because a status is easy to get right
 *   while still writing the file.
 * - **It can tell "the settings changed" from "the user edited this file".**
 *   Those are the same diff, which is why the header carries a fingerprint of
 *   its own body. Getting this wrong is silent: the user's edit is gone and
 *   nothing said so. The confirmation branch is therefore tested from both
 *   sides — that it is *reached*, and that answering no writes nothing.
 * - **It never throws.** A read-only vault, a suspended mobile app and a
 *   missing `crypto` all have to come back as an outcome.
 * - **The output is byte-stable.** Two exports with nothing changed in between
 *   must produce identical text, or the fingerprint is worthless and every
 *   export syncs. That rules out timestamps, version stamps, and — less
 *   obviously — any locale-aware sort.
 *
 * The content assertions are structural (`parseRules`), following
 * `printMediaIcons.test.ts`: what matters is which selectors are present and
 * which are deliberately absent, not how the text is wrapped.
 */
import assert from "node:assert";
import { describe, it } from "node:test";
import type { App } from "obsidian";
import { CalloutRegistry } from "../src/manager/CalloutRegistry";
import { CSSInjector } from "../src/manager/CSSInjector";
import {
	SNIPPET_BASENAME,
	buildSnippetCss,
	exportCssSnippet,
	exportableDefinitions,
	isSnippetEnabled,
	type SnippetExportPlugin,
} from "../src/manager/cssSnippetExport";
import { definition, parseRules } from "./support/cssInjectorHarness";
import type { CalloutDefinition } from "../src/types";

const CONFIG_DIR = ".obsidian";
const DIR = `${CONFIG_DIR}/snippets`;
const PATH = `${DIR}/${SNIPPET_BASENAME}.css`;

/* --- The fake vault -------------------------------------------------------- */

interface Vault {
	/** Every path `exists()` was asked about, in order. */
	stats: string[];
	/** Every path `read()` was asked for. */
	reads: string[];
	/** Every `mkdir()`. */
	dirs: string[];
	/** Path → content, for everything actually written. */
	writes: [string, string][];
	/** What is on disk right now. */
	files: Map<string, string>;
	failExists: boolean;
	failRead: boolean;
	failWrite: boolean;
	failMkdir: boolean;
}

interface Fake {
	app: App;
	vault: Vault;
	registry: CalloutRegistry;
	plugin: SnippetExportPlugin;
	/** Ids the last prune scan proved are written nowhere. */
	zeroUsage: Set<string>;
}

function fake(
	opts: { onDisk?: string; snippetEnabled?: boolean; customCss?: false } = {},
): Fake {
	const vault: Vault = {
		stats: [],
		reads: [],
		dirs: [],
		writes: [],
		files: new Map(),
		failExists: false,
		failRead: false,
		failWrite: false,
		failMkdir: false,
	};
	// The folder exists unless a test removes it, which is the normal vault.
	vault.files.set(DIR, "");
	if (opts.onDisk !== undefined) vault.files.set(PATH, opts.onDisk);

	const app = {
		vault: {
			configDir: CONFIG_DIR,
			adapter: {
				exists(path: string): Promise<boolean> {
					vault.stats.push(path);
					if (vault.failExists) return Promise.reject(new Error("EIO"));
					return Promise.resolve(vault.files.has(path));
				},
				read(path: string): Promise<string> {
					vault.reads.push(path);
					if (vault.failRead) return Promise.reject(new Error("EIO"));
					return Promise.resolve(vault.files.get(path) ?? "");
				},
				write(path: string, data: string): Promise<void> {
					if (vault.failWrite) return Promise.reject(new Error("EPERM"));
					vault.writes.push([path, data]);
					vault.files.set(path, data);
					return Promise.resolve();
				},
				mkdir(path: string): Promise<void> {
					vault.dirs.push(path);
					if (vault.failMkdir) return Promise.reject(new Error("EPERM"));
					vault.files.set(path, "");
					return Promise.resolve();
				},
			},
		},
		...(opts.customCss === false
			? {}
			: {
					customCss: {
						enabledSnippets: new Set(
							opts.snippetEnabled ? [SNIPPET_BASENAME] : [],
						),
					},
				}),
	} as unknown as App;

	const registry = new CalloutRegistry();
	registry.load(null);
	// A clean install hands an unconfigured built-in to the theme, and this
	// suite is about what happens when the plugin IS painting. See
	// tests/styleMode.test.ts for the default itself.
	const zeroUsage = new Set<string>();
	const plugin: SnippetExportPlugin = {
		registry,
		cssInjector: new CSSInjector(app, registry),
		isKnownZeroUsageFallback: (id) => zeroUsage.has(id),
	};
	return { app, vault, registry, plugin, zeroUsage };
}

/** Answering the overwrite prompt, and recording that it was asked. */
function prompt(answer: boolean): (() => Promise<boolean>) & { asked: number } {
	const fn = Object.assign(
		() => {
			fn.asked++;
			return Promise.resolve(answer);
		},
		{ asked: 0 },
	);
	return fn;
}

/** Never expected to be called; fails loudly if it is. */
const noPrompt = (): Promise<boolean> => {
	throw new Error("the overwrite prompt should not have been reached");
};

/** A vault with something of the user's own in it. */
function seeded(opts?: Parameters<typeof fake>[0]): Fake {
	const f = fake(opts);
	f.registry.add(definition({ id: "quiet", colorLight: "#336699" }));
	return f;
}

const selectors = (css: string): string[] =>
	parseRules(css).map((r) => r.selector);

/* --- What lands on disk ---------------------------------------------------- */

describe("writing the snippet", () => {
	it("creates the file on a first export", async () => {
		const f = seeded();
		const out = await exportCssSnippet(f.app, f.plugin, noPrompt);

		assert.deepStrictEqual(out, { status: "created", path: PATH });
		assert.strictEqual(f.vault.writes.length, 1);
		assert.strictEqual(f.vault.writes[0]?.[0], PATH);
	});

	it("creates the snippets folder when the vault has none", async () => {
		const f = seeded();
		f.vault.files.delete(DIR);

		const out = await exportCssSnippet(f.app, f.plugin, noPrompt);

		assert.strictEqual(out.status, "created");
		assert.deepStrictEqual(f.vault.dirs, [DIR]);
	});

	it("does not create the folder when it is already there", async () => {
		const f = seeded();
		await exportCssSnippet(f.app, f.plugin, noPrompt);
		assert.deepStrictEqual(f.vault.dirs, []);
	});

	it("updates a file it wrote earlier, without asking", async () => {
		const f = seeded();
		await exportCssSnippet(f.app, f.plugin, noPrompt);
		f.registry.update("quiet", { colorLight: "#ff0000" });

		const out = await exportCssSnippet(f.app, f.plugin, noPrompt);

		assert.deepStrictEqual(out, { status: "updated", path: PATH });
		assert.strictEqual(f.vault.writes.length, 2);
	});

	it("writes nothing at all when nothing changed", async () => {
		const f = seeded();
		await exportCssSnippet(f.app, f.plugin, noPrompt);
		const after = f.vault.writes.length;

		const out = await exportCssSnippet(f.app, f.plugin, noPrompt);

		// The point of the whole fingerprint: a repeat export is free. Every
		// write into the vault is a sync event.
		assert.deepStrictEqual(out, { status: "unchanged", path: PATH });
		assert.strictEqual(f.vault.writes.length, after);
	});

	it("touches exactly one path, and never lists the folder", async () => {
		const f = seeded();
		f.vault.files.set(`${DIR}/someone-elses.css`, "/* theirs */");

		await exportCssSnippet(f.app, f.plugin, noPrompt);
		await exportCssSnippet(f.app, f.plugin, noPrompt);

		assert.deepStrictEqual(
			[...new Set(f.vault.writes.map(([p]) => p))],
			[PATH],
		);
		assert.deepStrictEqual([...new Set(f.vault.reads)], [PATH]);
		assert.strictEqual(f.vault.files.get(`${DIR}/someone-elses.css`), "/* theirs */");
	});

	it("reports empty, and writes nothing, when there is nothing of the user's", async () => {
		const f = fake();

		const out = await exportCssSnippet(f.app, f.plugin, noPrompt);

		assert.deepStrictEqual(out, { status: "empty" });
		assert.deepStrictEqual(f.vault.writes, []);
		// Not even a stat: nothing to say about a file we will not touch.
		assert.deepStrictEqual(f.vault.stats, []);
	});

	it("reports empty when every callout has been handed to the theme", async () => {
		// Global style alone would still emit rules, which is exactly the trap:
		// the file would look like a successful export of nothing.
		const f = fake();
		f.registry.add(definition({ id: "theirs", externalStyle: true }));
		f.registry.settings.globalStyle.borderRadius = 12;

		const out = await exportCssSnippet(f.app, f.plugin, noPrompt);

		assert.deepStrictEqual(out, { status: "empty" });
		assert.deepStrictEqual(f.vault.writes, []);
	});
});

/* --- The user's own edits -------------------------------------------------- */

describe("a file that is not ours to replace", () => {
	it("asks before overwriting a hand-edited export", async () => {
		const f = seeded();
		await exportCssSnippet(f.app, f.plugin, noPrompt);
		// The header survives; only the body moves — the exact case a marker
		// check alone would wave through.
		const edited = `${f.vault.files.get(PATH) ?? ""}\n.callout { color: red; }\n`;
		f.vault.files.set(PATH, edited);
		f.registry.update("quiet", { colorLight: "#00ff00" });

		const ask = prompt(true);
		const out = await exportCssSnippet(f.app, f.plugin, ask);

		assert.strictEqual(ask.asked, 1);
		assert.strictEqual(out.status, "updated");
	});

	it("writes nothing when the answer is no", async () => {
		const f = seeded({ onDisk: "/* mine, by hand */\n" });

		const ask = prompt(false);
		const out = await exportCssSnippet(f.app, f.plugin, ask);

		assert.strictEqual(ask.asked, 1);
		assert.deepStrictEqual(out, { status: "cancelled" });
		assert.deepStrictEqual(f.vault.writes, []);
		assert.strictEqual(f.vault.files.get(PATH), "/* mine, by hand */\n");
	});

	it("asks about a foreign file that carries no marker", async () => {
		const f = seeded({ onDisk: ".callout { color: blue; }\n" });
		const ask = prompt(true);

		await exportCssSnippet(f.app, f.plugin, ask);

		assert.strictEqual(ask.asked, 1);
	});

	it("asks when the file cannot be read, rather than assuming it is ours", async () => {
		const f = seeded({ onDisk: "whatever" });
		f.vault.failRead = true;
		const ask = prompt(false);

		const out = await exportCssSnippet(f.app, f.plugin, ask);

		assert.strictEqual(ask.asked, 1);
		assert.strictEqual(out.status, "cancelled");
	});
});

/* --- Nothing escapes ------------------------------------------------------- */

describe("failures come back as outcomes", () => {
	it("survives a read-only vault", async () => {
		const f = seeded();
		f.vault.failWrite = true;

		const out = await exportCssSnippet(f.app, f.plugin, noPrompt);

		assert.deepStrictEqual(out, { status: "failed" });
	});

	it("survives a failing mkdir", async () => {
		const f = seeded();
		f.vault.files.delete(DIR);
		f.vault.failMkdir = true;

		assert.deepStrictEqual(await exportCssSnippet(f.app, f.plugin, noPrompt), {
			status: "failed",
		});
	});

	it("survives exists() itself throwing", async () => {
		const f = seeded();
		f.vault.failExists = true;
		const ask = prompt(true);

		// Unreadable is not absent: something may be there, so it asks — and the
		// write that follows fails on the same adapter, which is still an
		// outcome rather than a throw.
		const out = await exportCssSnippet(f.app, f.plugin, ask);

		assert.strictEqual(out.status, "failed");
	});

	it("de-duplicates two clicks into one write", async () => {
		const f = seeded();

		const [a, b] = await Promise.all([
			exportCssSnippet(f.app, f.plugin, noPrompt),
			exportCssSnippet(f.app, f.plugin, noPrompt),
		]);

		assert.deepStrictEqual(a, b);
		assert.strictEqual(f.vault.writes.length, 1);
	});
});

/* --- What is in the file --------------------------------------------------- */

describe("the generated stylesheet", () => {
	it("is byte-identical across two exports with no changes", () => {
		const f = seeded();
		assert.strictEqual(buildSnippetCss(f.plugin), buildSnippetCss(f.plugin));
	});

	it("does not depend on the order rows were added", () => {
		const a = fake();
		const b = fake();
		for (const id of ["zulu", "alpha", "mike"]) {
			a.registry.add(definition({ id }));
		}
		for (const id of ["mike", "zulu", "alpha"]) {
			b.registry.add(definition({ id }));
		}
		assert.strictEqual(buildSnippetCss(a.plugin), buildSnippetCss(b.plugin));
	});

	it("carries the global style, so the frame comes across too", () => {
		const f = seeded();
		f.registry.settings.globalStyle.borderRadius = 12;

		assert.ok(
			parseRules(buildSnippetCss(f.plugin)).some(
				(r) =>
					r.selector.startsWith(".callout") &&
					r.decls.some((d) => d.startsWith("border-radius: 12px")),
			),
			"the user's radius should be in the snippet",
		);
	});

	it("leaves out the DOM only this plugin builds", () => {
		const f = seeded();
		f.registry.settings.globalStyle.heading.borderRadius = 9;
		f.registry.settings.globalStyle.inline.fontScale = 1.4;

		const css = buildSnippetCss(f.plugin);

		for (const dead of [
			"cs-heading-callout",
			"cs-inline-callout",
			"cs-ref-token",
			"cs-heading-token",
		]) {
			assert.ok(
				!css.includes(dead),
				`${dead} only exists while the plugin runs, so it is dead weight here`,
			);
		}
	});

	it("leaves out the fallback catch-all", () => {
		const f = seeded();
		// It would restyle callouts on the target this export knows nothing
		// about, and its :not() chain is enormous.
		assert.ok(!buildSnippetCss(f.plugin).includes(":not([data-callout="));
	});

	it("keeps the plugin's live sheet unchanged", () => {
		// `standalone` must be opt-in: the same emitter still has to produce the
		// token rules for the sheet the plugin actually injects.
		const f = seeded();
		const css = f.plugin.cssInjector.generateCalloutCSS(
			f.registry.get("quiet") as CalloutDefinition,
		);
		assert.ok(css.includes("cs-inline-callout"));
	});
});

/* --- The variables the frame needs ----------------------------------------- */

describe("untouched built-ins", () => {
	const borderOn = (f: Fake): void => {
		f.registry.settings.globalStyle.borderSides = {
			top: false,
			right: false,
			bottom: false,
			left: true,
		};
	};

	it("get an accent so the global border is not grey", () => {
		const f = seeded();
		borderOn(f);

		const rule = parseRules(buildSnippetCss(f.plugin)).find(
			(r) => r.selector === '.callout[data-callout="note"]',
		);

		// The live sheet defines --cs-accent for every callout because it walks
		// the whole registry; this export walks a subset, so without this an
		// untouched [!note] falls back to currentColor.
		assert.ok(rule, "note should carry a support rule");
		assert.ok(rule.decls.some((d) => d.startsWith("--cs-accent:")));
	});

	it("still let the target's theme pick the hue", () => {
		const f = seeded();
		borderOn(f);

		const rule = parseRules(buildSnippetCss(f.plugin)).find(
			(r) => r.selector === '.callout[data-callout="note"]',
		);

		// `note` is Obsidian's unrecognized-type default, hence the name.
		assert.ok(rule?.decls.some((d) => d.includes("--callout-default")));
		assert.ok(
			!rule?.props.includes("--callout-color"),
			"pinning --callout-color would override the target theme",
		);
	});

	it("carry the @property registration that gives them a meaning", () => {
		// styles.css does not travel. Without this line --cs-accent-theme is an
		// ordinary custom property in the target vault: the <color> validation
		// vanishes, so a theme that spells --callout-default as a bare RGB
		// triplet puts that triplet into --cs-accent and every color-mix()
		// downstream of it is silently dropped.
		const f = seeded();
		borderOn(f);
		const css = buildSnippetCss(f.plugin);
		assert.ok(css.includes("--cs-accent-theme"), "precondition");
		assert.ok(css.startsWith("@property --cs-accent-theme {"), css.slice(0, 120));
		assert.ok(css.includes('syntax: "<color>"'));
		assert.ok(css.includes("initial-value: #7d7d7d;"));
	});

	it("get nothing when no border is switched on", () => {
		const f = seeded();
		f.registry.settings.globalStyle.borderSides = {
			top: false,
			right: false,
			bottom: false,
			left: false,
		};

		assert.ok(
			!selectors(buildSnippetCss(f.plugin)).includes(
				'.callout[data-callout="note"]',
			),
		);
	});
});

/* --- Which callouts -------------------------------------------------------- */

describe("the accent registration", () => {
	it("is absent from a snippet that never mentions the variable", () => {
		// Every byte in this file is read by a person and synced by a vault, so
		// a declaration nothing reads does not get to ride along.
		const f = seeded();
		const css = buildSnippetCss(f.plugin);
		assert.ok(!css.includes("--cs-accent-theme"), "precondition");
		assert.ok(!css.includes("@property"));
	});
});

describe("which callouts are covered", () => {
	it("drops a discovered row nothing uses and nobody adopted", () => {
		const f = seeded();
		f.registry.add(
			definition({ id: "ghost", source: "fallback", customized: false }),
		);
		f.zeroUsage.add("ghost");

		assert.deepStrictEqual(
			exportableDefinitions(f.plugin).map((d) => d.id),
			["quiet"],
		);
	});

	it("keeps a discovered row the user adopted", () => {
		const f = seeded();
		f.registry.add(
			definition({ id: "adopted", source: "fallback", customized: true }),
		);
		f.zeroUsage.add("adopted");

		assert.ok(
			exportableDefinitions(f.plugin).some((d) => d.id === "adopted"),
		);
	});

	it("keeps a discovered row still written in the vault", () => {
		const f = seeded();
		f.registry.add(
			definition({ id: "inuse", source: "fallback", customized: false }),
		);

		assert.ok(exportableDefinitions(f.plugin).some((d) => d.id === "inuse"));
	});

	it("covers a built-in once it has been modified", () => {
		const f = fake();
		f.registry.update("note", { colorLight: "#123456" });

		assert.ok(exportableDefinitions(f.plugin).some((d) => d.id === "note"));
	});

	it("styles nothing for a callout handed to the theme", () => {
		const f = seeded();
		f.registry.add(definition({ id: "theirs", externalStyle: true }));

		// The id does still appear — inside the global block's
		// `:not(:where(…))`, which is what keeps our own global rules off it.
		// What must not exist is a rule that targets it.
		assert.ok(
			!selectors(buildSnippetCss(f.plugin)).some((s) =>
				s.includes('.callout[data-callout="theirs"]'),
			),
		);
	});
});

/* --- The awkward definitions ----------------------------------------------- */

describe("styles that are easy to drop", () => {
	it("carries a gradient background, angle and all", () => {
		const f = fake();
		f.registry.add(
			definition({
				id: "swept",
				bgColorLight: "#eef4fb",
				bgColorDark: "#eef4fb",
				bgGradient: {
					angleDeg: 120,
					toColorLight: "#dceafc",
					toColorDark: "#dceafc",
				},
			}),
		);

		// Asserting the angle, not just the function name: a gradient built from
		// a mistyped field still emits `linear-gradient(`, with `NaNdeg` inside.
		assert.ok(buildSnippetCss(f.plugin).includes("linear-gradient(120deg,"));
	});

	it("carries a transparent background", () => {
		const f = fake();
		f.registry.add(definition({ id: "clear", transparentBg: true }));

		const rule = parseRules(buildSnippetCss(f.plugin)).find(
			(r) => r.selector === '.callout[data-callout="clear"]',
		);
		assert.ok(rule?.decls.includes("background-color: transparent !important"));
	});

	it("carries a hidden icon, including the indent it has to undo", () => {
		const f = fake();
		f.registry.settings.globalStyle.alignContentWithTitle = true;
		f.registry.add(definition({ id: "bare", hideIcon: true }));

		const css = buildSnippetCss(f.plugin);
		const icon = parseRules(css).find((r) =>
			r.selector.includes('[data-callout="bare"] > .callout-title > .callout-icon'),
		);
		assert.ok(icon?.decls.includes("display: none !important"));
		// Only correct because the export carries the global indent as well.
		assert.ok(
			parseRules(css).some(
				(r) =>
					r.selector.includes('[data-callout="bare"] > .callout-content') &&
					r.decls.includes("padding-inline-start: 0 !important"),
			),
		);
	});

	it("is unaffected by a palette the user deleted", () => {
		// Palette colours are baked into each definition when the palette is
		// applied; `paletteId` is only a grouping link, and CSSInjector never
		// reads it. A dangling one must therefore change nothing.
		const f = fake();
		f.registry.add(definition({ id: "linked", paletteId: "gone-forever" }));
		const withDangling = buildSnippetCss(f.plugin);

		f.registry.update("linked", { paletteId: undefined });

		assert.strictEqual(buildSnippetCss(f.plugin), withDangling);
	});

	it("follows a palette recolour", () => {
		const f = fake();
		f.registry.add(definition({ id: "linked", paletteId: "p1" }));
		const before = buildSnippetCss(f.plugin);

		f.registry.applyPaletteColors("p1", {
			colorLight: "#ff8800",
			colorDark: "#ff8800",
			bgColorLight: undefined,
			bgColorDark: undefined,
			bgGradient: undefined,
			transparentBg: undefined,
			textColorLight: undefined,
			textColorDark: undefined,
		});

		assert.notStrictEqual(buildSnippetCss(f.plugin), before);
	});

	it("follows the fallback callout the discovered rows mirror", () => {
		const f = fake();
		f.registry.add(
			definition({ id: "found", source: "fallback", customized: false }),
		);
		const before = buildSnippetCss(f.plugin);

		f.registry.settings.fallbackCalloutId = "warning";
		f.registry.restyleUncustomizedFallbackRows();

		assert.notStrictEqual(buildSnippetCss(f.plugin), before);
	});
});

/* --- Ids nobody typed on purpose ------------------------------------------- */

describe("hostile callout ids", () => {
	/**
	 * None of these needs the user to type them: vault discovery's header regex
	 * is `\[!([^\]\n\r]+)\]`, so opening a shared note is enough, and import
	 * permits both quote characters.
	 */
	const HOSTILE = ['ev"il', "back\\", "Multi Word", "MiXeD", "עברית"];

	it("escapes every one of them", () => {
		const f = fake();
		for (const id of HOSTILE) f.registry.add(definition({ id }));

		const css = buildSnippetCss(f.plugin);

		assert.ok(css.includes('[data-callout="ev\\"il"]'), 'the " must be escaped');
		assert.ok(css.includes('[data-callout="back\\\\"]'), "the \\ must be escaped");
		// Obsidian dasherizes and lowercases what it writes into the attribute.
		assert.ok(css.includes('[data-callout="multi-word"]'));
		assert.ok(css.includes('[data-callout="mixed"]'));
		assert.ok(css.includes('[data-callout="עברית"]'));
	});

	it("leaves no unterminated string behind", () => {
		const f = fake();
		for (const id of HOSTILE) f.registry.add(definition({ id }));

		const css = buildSnippetCss(f.plugin);
		// A trailing backslash that escaped the selector's own closing quote
		// would swallow every rule generated after it.
		const quotes = (css.match(/(?<!\\)"/g) ?? []).length;
		assert.strictEqual(quotes % 2, 0, "quotes should be balanced");
		assert.ok(parseRules(css).length > HOSTILE.length);
	});
});

/* --- The Appearance pane --------------------------------------------------- */

describe("reading whether the snippet is switched on", () => {
	it("sees an enabled snippet", () => {
		assert.strictEqual(isSnippetEnabled(fake({ snippetEnabled: true }).app), true);
	});

	it("sees a disabled one", () => {
		assert.strictEqual(isSnippetEnabled(fake().app), false);
	});

	it("says no when app.customCss is not there at all", () => {
		// Undocumented internal: a future Obsidian may simply not have it, and
		// the only cost of guessing wrong is a warning nobody sees.
		assert.strictEqual(isSnippetEnabled(fake({ customCss: false }).app), false);
	});
});
