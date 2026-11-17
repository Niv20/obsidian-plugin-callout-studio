/**
 * tests/webQuartzConfig.test.ts — reading a Quartz configuration file
 * (`src/manager/web/quartzConfig.ts`).
 *
 * The Publish to the web panel says in its "install the Quartz plugin" step
 * what it found, where the file is in the vault. A "loads Callout Studio" the
 * user reads is one they stop checking, so what it must not do is say it
 * about a file that does not load the plugin:
 *
 * - **A line that was commented out does not count**, in either generation.
 * - **Quartz 4 needs both halves**: the `import` and the call. Each half
 *   alone is named, so the panel can say which is missing.
 * - **Quartz 4, in the wrong place, is its own state.** After
 *   `Plugin.Description()` the build succeeds and search and RSS show the
 *   text as typed: nothing else would tell the user.
 * - **Quartz 5 with `enabled: false` is switched off**, and only its own
 *   entry's `enabled` is read, never a neighbour's.
 * - **It is the plugin from its repository**, under any of the names a source
 *   may give it, and not a plugin whose name merely ends like it, nor the
 *   folder Callout Studio wrote into the vault until 2026-11-17.
 *
 * The lines used here are the ones the panel shows (`webPanel/webPanelCopy.ts`)
 * and, for Quartz 5, the entry `npx quartz plugin add` writes (seen in Quartz
 * 5.1.0), so a file the user filled in by following the panel reads as done.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { QUARTZ_CONFIG_FILE, checkQuartzConfig } from "../src/manager/web/quartzConfig";
import { QUARTZ_PLUGIN_PACKAGE, QUARTZ_PLUGIN_REPO_URL, QUARTZ_PLUGIN_SOURCE } from "../src/manager/web/targets";

const IMPORT = `import { CalloutStudio } from "${QUARTZ_PLUGIN_PACKAGE}"`;

/** A `quartz.config.ts` as Quartz 4 ships it, with `extra` lines at the top and `transformers` as given. */
const config4 = (extra: string, transformers: string[]): string =>
	[
		'import { QuartzConfig } from "./quartz/cfg"',
		'import * as Plugin from "./quartz/plugins"',
		extra,
		"",
		"const config: QuartzConfig = {",
		"  configuration: {",
		'    pageTitle: "Notes",',
		'    baseUrl: "https://example.com/notes", // the site',
		'    ignorePatterns: ["private", "templates", ".obsidian"],',
		"  },",
		"  plugins: {",
		"    transformers: [",
		...transformers.map((line) => `      ${line}`),
		"    ],",
		"    filters: [Plugin.RemoveDrafts()],",
		"  },",
		"}",
		"export default config",
	].join("\n");

const LINKS = 'Plugin.CrawlLinks({ markdownLinkResolution: "shortest" }),';
const DESCRIPTION = "Plugin.Description(),";

describe("Quartz 4: quartz.config.ts", () => {
	it("names the file", () => {
		assert.equal(QUARTZ_CONFIG_FILE[4], "quartz.config.ts");
	});

	it("is done with the import and the call before Plugin.Description()", () => {
		assert.equal(checkQuartzConfig(config4(IMPORT, [LINKS, "CalloutStudio(),", DESCRIPTION]), 4), "ok");
	});

	it("finds nothing in a configuration as Quartz ships it", () => {
		assert.equal(checkQuartzConfig(config4("", [LINKS, DESCRIPTION]), 4), "none");
	});

	it("says which half is missing", () => {
		assert.equal(checkQuartzConfig(config4(IMPORT, [LINKS, DESCRIPTION]), 4), "noUse");
		assert.equal(checkQuartzConfig(config4("", [LINKS, "CalloutStudio(),", DESCRIPTION]), 4), "noImport");
	});

	it("says the call is in the wrong place after Plugin.Description()", () => {
		assert.equal(checkQuartzConfig(config4(IMPORT, [LINKS, DESCRIPTION, "CalloutStudio(),"]), 4), "misplaced");
	});

	it("does not count a line that was commented out", () => {
		assert.equal(
			checkQuartzConfig(config4(`// ${IMPORT}`, [LINKS, "// CalloutStudio(),", DESCRIPTION]), 4),
			"none",
		);
		assert.equal(checkQuartzConfig(config4(IMPORT, [LINKS, "/* CalloutStudio(), */", DESCRIPTION]), 4), "noUse");
	});

	it("keeps an address in a string, whose // is not a comment", () => {
		// The baseUrl line above holds one; a reading that cut it would lose the rest of that line only,
		// and this one puts the call on the same line as an address to prove the call survives.
		const text = config4(IMPORT, ['Plugin.Custom("https://example.com"), CalloutStudio(),', DESCRIPTION]);
		assert.equal(checkQuartzConfig(text, 4), "ok");
	});

	it("reads an import written over several lines, with either quote", () => {
		const spread = `import {\n  CalloutStudio,\n} from '${QUARTZ_PLUGIN_PACKAGE}'`;
		assert.equal(checkQuartzConfig(config4(spread, ["CalloutStudio(),", DESCRIPTION]), 4), "ok");
	});

	it("is done where there is no Plugin.Description() to come before", () => {
		assert.equal(checkQuartzConfig(config4(IMPORT, [LINKS, "CalloutStudio(),"]), 4), "ok");
	});

	it("does not take another package's import, or the folder the vault once held, for the plugin's", () => {
		const call = [LINKS, "CalloutStudio(),", DESCRIPTION];
		for (const other of [
			'import { CalloutStudio } from "./content/callout-studio-quartz/index.js"',
			`import { CalloutStudio } from "my-${QUARTZ_PLUGIN_PACKAGE}"`,
			`import { CalloutStudio } from "${QUARTZ_PLUGIN_PACKAGE}-fork"`,
		]) {
			assert.equal(checkQuartzConfig(config4(other, call), 4), "noImport", other);
		}
	});
});

/** A `quartz.config.yaml` with `entries` under `plugins`. */
const config5 = (entries: string[]): string =>
	[
		"configuration:",
		"  pageTitle: Notes",
		"  ignorePatterns:",
		"    - private",
		"    - .obsidian",
		"plugins:",
		"  - source: github:quartz-community/explorer",
		"    enabled: true",
		"    order: 50",
		...entries,
		"  - source: github:quartz-community/search",
		"    enabled: false",
		"layout:",
		"  byPageType: {}",
	].join("\n");

/** The entry `npx quartz plugin add` writes, as Quartz 5.1.0 wrote it. */
const ENTRY = [`  - source: ${QUARTZ_PLUGIN_SOURCE}`, "    enabled: true", "    options: {}", "    order: 65"];

describe("Quartz 5: quartz.config.yaml", () => {
	it("names the file", () => {
		assert.equal(QUARTZ_CONFIG_FILE[5], "quartz.config.yaml");
	});

	it("is done with the entry the panel's command writes", () => {
		assert.equal(checkQuartzConfig(config5(ENTRY), 5), "ok");
	});

	it("finds nothing where the entry is not there", () => {
		assert.equal(checkQuartzConfig(config5([]), 5), "none");
	});

	it("says the entry is switched off, and reads only its own enabled", () => {
		const off = [ENTRY[0]!, "    enabled: false", "    options: {}", "    order: 65"];
		assert.equal(checkQuartzConfig(config5(off), 5), "off");
		// The neighbour after it is off; ours is on.
		assert.equal(checkQuartzConfig(config5(ENTRY), 5), "ok");
	});

	it("reads an entry whose source is not its first line, or is quoted", () => {
		const reordered = ["  - enabled: false", `    source: "${QUARTZ_PLUGIN_SOURCE}"`, "    order: 65"];
		assert.equal(checkQuartzConfig(config5(reordered), 5), "off");
		const quoted = [`  - source: '${QUARTZ_PLUGIN_SOURCE}'`, "    enabled: true"];
		assert.equal(checkQuartzConfig(config5(quoted), 5), "ok");
	});

	it("does not count an entry that was commented out", () => {
		const commented = ENTRY.map((line) => `#${line}`);
		assert.equal(checkQuartzConfig(config5(commented), 5), "none");
	});

	it("reads a file with Windows line endings", () => {
		assert.equal(checkQuartzConfig(config5(ENTRY).replace(/\n/g, "\r\n"), 5), "ok");
	});
});

describe("Quartz 5: the plugin's source, under every name it may have", () => {
	const loads = (source: string[]): string => checkQuartzConfig(config5(source), 5);

	it("is the plugin from its repository, however the source spells it", () => {
		const repo = new URL(QUARTZ_PLUGIN_REPO_URL).pathname.slice(1);
		for (const spelling of [
			QUARTZ_PLUGIN_SOURCE,
			`${QUARTZ_PLUGIN_SOURCE}#main`,
			repo,
			`${QUARTZ_PLUGIN_REPO_URL}.git`,
			`git+${QUARTZ_PLUGIN_REPO_URL}.git#v1.0.0`,
			// GitHub reads an address in any case.
			QUARTZ_PLUGIN_SOURCE.toLowerCase(),
		]) {
			assert.equal(loads([`  - source: ${spelling}`, "    enabled: true"]), "ok", spelling);
		}
	});

	it("is the plugin in a source written as an object, and that entry's enabled is read", () => {
		const object = [
			"  - source:",
			`      repo: "${QUARTZ_PLUGIN_REPO_URL}.git"`,
			"      ref: main",
			"    enabled: false",
		];
		assert.equal(loads(object), "off");
		assert.equal(loads(object.map((line) => line.replace("false", "true"))), "ok");
	});

	it("is not a plugin whose name merely ends like it, nor the folder the vault once held", () => {
		const [owner, name] = new URL(QUARTZ_PLUGIN_REPO_URL).pathname.slice(1).split("/");
		for (const other of [
			// Its name alone is any Quartz: the owner is part of it.
			`github:someone/${name}`,
			`https://github.com/someone/${name}.git`,
			`github:my-${owner}/${name}`,
			`github:${owner}/${name}-fork`,
			`github:${owner}/my-${name}`,
			// What npm installs it as is not a repository.
			QUARTZ_PLUGIN_PACKAGE,
			"./content/callout-studio-quartz",
		]) {
			assert.equal(loads([`  - source: ${other}`, "    enabled: true"]), "none", other);
		}
	});
});
