/**
 * manager/web/targets.ts — what each kind of site gets.
 *
 * Heading and inline callouts are elements this plugin builds, so showing them
 * on a published site takes something that runs. *Where* it can run is the
 * biggest difference between the services, and it decides everything a reader
 * without JavaScript, a feed and a search index get to see:
 *
 * | target    | runs                         | files                                         |
 * | --------- | ---------------------------- | --------------------------------------------- |
 * | `quartz`  | in the Quartz build          | a note, which reaches the build like any other |
 * | `garden`  | in the Digital Garden build  | a note, published like any other              |
 * | `publish` | in the reader's browser      | a block in `publish.js` + `publish.css`       |
 *
 * Every target is the same three ingredients — the renderer
 * (`web/core.ts`), a host for where it runs (`web/browser.ts`,
 * `web/static/`), and the user's snapshot (`webData.ts`) — joined differently.
 * Quartz and Digital Garden split them: the renderer and its host are a
 * plugin of the site's, installed once from a repository of its own (the
 * Callout Studio Quartz plugin, `scripts/lib/quartzPlugin.mjs`, and garden
 * plugin, `scripts/lib/gardenPlugin.mjs`), and only the snapshot is written
 * here, as a note (`web/static/webNote.ts`): a note is the one thing the
 * Digital Garden plugin carries from a vault to a garden
 * (`web/static/gardenNote.ts`), and the one thing every way of getting notes
 * to a Quartz build carries (`web/static/quartzNote.ts`). Until 2026-11-17
 * Quartz got the renderer too, as a plugin folder written into the vault,
 * `callout-studio-quartz/`, which the site's configuration had to point at
 * and keep off the site; then, for a day, the snapshot alone, as
 * `.callout-studio/quartz.json`, which only a build from the vault itself
 * could see.
 * This file is only the joining: which host, which module format, where the
 * stylesheet travels, and what each file says about itself to whoever opens
 * it. Nothing here touches the vault; `writeTarget.ts` does.
 *
 * A block callout is the other difference, and it needs nothing that runs:
 * the site builds that element itself, and the snapshot's stylesheet ends
 * with rules for it in that site's own terms (`manager/css/webBlockCSS.ts`).
 * So a snapshot is built for a target (`buildWebBundleData(plugin, id)`), and
 * the stylesheet reaches the site as it always did.
 *
 * Adding a service is a new entry in {@link targetFiles} and, if it runs
 * somewhere new, a host. The renderer does not change. A fourth target, one
 * script for any other site, was here until 2026-11-16;
 * `docs/internals-docs/web-target-another-site.md` keeps how it worked.
 */
import { WEB_BROWSER_GLOBAL, WEB_BROWSER_JS, WEB_CORE_GLOBAL, WEB_CORE_JS } from "virtual:callout-studio-web-assets";
import { GARDEN_NOTE, GARDEN_NOTE_KEY, GARDEN_NOTE_PATH, newGardenNoteFrontmatter } from "../../web/static/gardenNote";
import { QUARTZ_NOTE, QUARTZ_NOTE_KEY, QUARTZ_NOTE_NAME, newQuartzNoteFrontmatter } from "../../web/static/quartzNote";
import type { WebNoteKind } from "../../web/static/webNote";
import type { WebBundleData } from "../../web/webBundleData";
import { serializeWebData, type WebExportData } from "./webData";

export type WebTargetId = "publish" | "quartz" | "garden";

/** In the order the Publish to the web panel lists them when nothing was detected. */
export const WEB_TARGET_IDS: readonly WebTargetId[] = ["publish", "quartz", "garden"];

export const isWebTargetId = (value: unknown): value is WebTargetId =>
	typeof value === "string" && (WEB_TARGET_IDS as readonly string[]).includes(value);

/** One file of a target, before it is given its header and written. */
export interface TargetFile {
	/** Vault-relative. */
	path: string;
	/**
	 * - `block` — the file is the user's and we own a marked section of it
	 *   (`managedBlock.ts`);
	 * - `note` — the Digital Garden or the Quartz note. Its properties are the
	 *   user's and its body is ours (`web/static/webNote.ts`); `body` is the
	 *   snapshot as JSON, which the writer encodes and fingerprints, and
	 *   {@link note} says which note it is.
	 *
	 * Two other kinds went on 2026-11-17: `whole` (a file of ours under a
	 * header comment) with Quartz's plugin folder, and `json` with Quartz's
	 * `.callout-studio/quartz.json`.
	 */
	kind: "block" | "note";
	/**
	 * The file's name in a device's memory of what it wrote (`fileMemory.ts`).
	 * Not its path: a note is the same note wherever the user moved it.
	 */
	slot: string;
	/** A block's header comment, one line each; an empty string is a blank line. A note says it in its body. */
	prose: readonly string[];
	body: string;
	/**
	 * A second note that carries the property and our data: what a sync service
	 * leaves behind when two devices wrote the note at once. Kept current like
	 * the first, so whichever of them a garden reads is right; never created,
	 * and never asked about.
	 */
	copy?: true;
	/** A note's kind, and the properties it is created with (kept as they are after that). */
	note?: { kind: WebNoteKind; frontmatter: string };
}

/** What a target needs to know about the vault it is written into. */
export interface TargetOptions {
	/**
	 * The vault is a Quartz repository itself rather than its `content` folder,
	 * so a new Quartz note goes one level down, where Quartz looks for content.
	 */
	quartzInVault?: boolean;
	/**
	 * Quartz: the folder a new note goes in, from the top of the vault — the
	 * one a plugin that publishes the user's notes publishes from
	 * (`notePublisher.ts`). Before {@link quartzInVault}.
	 */
	noteFolder?: string;
	/** Quartz: the properties a new note is created with set to `true`, for the plugin that publishes it. */
	noteMarkers?: readonly string[];
	/**
	 * Where the service's note is (`webNoteLocation.ts`). Found by its
	 * property, so it may be anywhere; the usual path when left out.
	 */
	notePath?: string;
	/** Other notes that carry our data (`webNoteLocation.webNoteCopies`). */
	noteCopies?: readonly string[];
}

/** Folder and file names, shared with the Publish to the web panel and the user guide. */
export const PUBLISH_JS = "publish.js";
export const PUBLISH_CSS = "publish.css";
export { GARDEN_NOTE, GARDEN_NOTE_KEY, GARDEN_NOTE_PATH, QUARTZ_NOTE, QUARTZ_NOTE_KEY, QUARTZ_NOTE_NAME };

/**
 * The Callout Studio Quartz plugin's own repository. It has to be one of its
 * own: Quartz 5's `plugin add` and npm both take the whole repository they are
 * given. Quartz 5 names the plugin after the repository's name (`quartz`): its
 * folder in `.quartz/plugins/`, its line in `quartz.lock.json`, and what
 * `npx quartz plugin install --latest` is given to update it.
 */
export const QUARTZ_PLUGIN_REPO_URL = "https://github.com/Callout-Studio/quartz";

/**
 * How a site names the Quartz plugin to install it: what `npx quartz plugin
 * add` (Quartz 5) and `npm install` (Quartz 4) are given, and what Quartz 5
 * writes as the plugin's `source` in `quartz.config.yaml`.
 */
export const QUARTZ_PLUGIN_SOURCE = "github:Callout-Studio/quartz";

/**
 * The plugin's package name (its `package.json`): what npm installs it as, and
 * so what Quartz 4's configuration imports it from. Not the repository's name,
 * which is too generic to import from.
 */
export const QUARTZ_PLUGIN_PACKAGE = "quartz-plugin-callout-studio";

/**
 * The Callout Studio garden plugin's own repository — what the Digital Garden
 * plugin's **Install from GitHub** is given, for as long as the plugin is not
 * in that plugin's community list, and what the list itself points at once it
 * is. It has to be a repository of its own: the installer copies every file
 * in the one it is pointed at.
 */
export const GARDEN_PLUGIN_REPO_URL = "https://github.com/Callout-Studio/digital-garden";

/**
 * The garden plugin's id in its `garden-plugin.json`, which is how Digital
 * Garden's community list names it: the Publish to the web panel asks Digital
 * Garden to open its list with this one selected (`webPanel/siteActions.ts`).
 */
export const GARDEN_PLUGIN_ID = "callout-studio";

/** The Digital Garden note's name in a device's memory; see `TargetFile.slot`. */
export const GARDEN_NOTE_SLOT = "garden";

/** The Quartz note's name in a device's memory; see `TargetFile.slot`. */
export const QUARTZ_NOTE_SLOT = "quartz";

/**
 * What a generated file says to whoever opens it — the same three questions
 * the Digital Garden note answers (`web/static/gardenNote.ts`), as a comment:
 * what this is, what not to do with it, what one may do. English in every
 * language, like the note: a file that changed with the UI language would be
 * rewritten, and synced, every time it changed.
 *
 * `after` is what is left for the user to do once a callout changed, since the
 * rewriting is done for them (`autoUpdate.ts`).
 */
function fileProse(
	thing: string,
	contains: readonly string[],
	after: readonly string[],
	never: readonly string[],
	may: readonly string[],
): string[] {
	const indent = (lines: readonly string[]): string[] => lines.map((line) => (line ? `  ${line}` : ""));
	return [
		"",
		`What does this ${thing} contain?`,
		...indent(contains),
		"",
		...indent(["It updates automatically whenever you add, edit, or delete a callout.", ...after]),
		"",
		"What not to do",
		...indent(never),
		"",
		"What you can do",
		...indent(may),
	];
}

/** Why an edit to a file of ours is a bad idea: what `writeTarget.ts` does about one. */
const EDITED: readonly string[] = [
	"Once it is edited, Callout Studio stops updating it by itself, and",
	"writing it again from the settings replaces your edits.",
];

const HARD_REFRESH = "You might need to do a hard refresh in your browser.";

/** The note a service's snapshot travels in, where it has one. */
export const noteKindOf = (id: WebTargetId): WebNoteKind | null =>
	id === "garden" ? GARDEN_NOTE : id === "quartz" ? QUARTZ_NOTE : null;

/** Where a service's note is written the first time, from the top of the vault. */
export function newNotePath(id: WebTargetId, options: TargetOptions = {}): string {
	if (id !== "quartz") return GARDEN_NOTE_PATH;
	const folder = options.noteFolder ?? (options.quartzInVault ? "content" : "");
	return folder ? `${folder}/${QUARTZ_NOTE_NAME}` : QUARTZ_NOTE_NAME;
}

/**
 * Where a target's files are, without building any of them — enough to ask
 * whether one is there. The same paths, in the same order, as
 * {@link targetFiles} gives.
 */
export function targetPaths(id: WebTargetId, options: TargetOptions = {}): string[] {
	switch (id) {
		case "publish":
			return [PUBLISH_JS, PUBLISH_CSS];
		case "quartz":
		case "garden":
			return [options.notePath ?? newNotePath(id, options), ...(options.noteCopies ?? [])];
	}
}

/** The renderer started in a browser: the core, the browser host, one call. */
function browserScript(data: WebBundleData): string {
	// One function around all of it, so a site gains no global of ours.
	return (
		"(function () {\n" +
		`${WEB_CORE_JS.trimEnd()}\n` +
		`${WEB_BROWSER_JS.trimEnd()}\n` +
		`${WEB_BROWSER_GLOBAL}.init(${WEB_CORE_GLOBAL}, ${serializeWebData(data)});\n` +
		"})();\n"
	);
}

/** The snapshot for a target whose stylesheet travels in a file of its own. */
const withoutCss = (data: WebExportData): WebBundleData => {
	const rest: WebBundleData = { ...data };
	delete rest.css;
	return rest;
};

/**
 * The heading band's own rule, `.cs-heading-callout { … }`, weighed up for
 * Quartz. A Quartz 4 site themed the way Quartz Themes installs a theme there
 * (one `_index.scss`, converted from the Obsidian theme) styles every heading
 * in dark mode as `html[saved-theme="dark"] body h2` — one attribute and three
 * elements — which outweighs one class: the band lost its tint and its
 * corners in dark mode, and only there (seen 2026-11-17 with Minimal and
 * Tokyo Night). The colour, padding and title already sit in heavier rules.
 * Five elements and one class outweigh the theme's selector, and still weigh
 * less than every rule of a single callout (`[data-callout="…"]` is a second
 * class), so a callout's own colour or gradient keeps winning, as before.
 */
const QUARTZ_HEADING_BASE = "html body .cs-heading-callout:is(h1, h2, h3, h4, h5, h6):not(span):not(div)";

/**
 * The stylesheet for Quartz. Everywhere else dark mode is a `.theme-dark`
 * ancestor, as in Obsidian; Quartz says it with an attribute on `<html>`. An
 * attribute selector weighs what a class does, so swapping the one for the
 * other moves no rule in the cascade — and dark mode then needs no script.
 * The heading band's own rule is weighed up ({@link QUARTZ_HEADING_BASE}).
 */
export const quartzCss = (css: string): string =>
	css
		.replace(/\.theme-dark(?![\w-])/g, '[saved-theme="dark"]')
		.replace(/(^|[\n}])(\s*)\.cs-heading-callout(\s*)\{/g, `$1$2${QUARTZ_HEADING_BASE}$3{`);

function publishFiles(data: WebExportData): TargetFile[] {
	const prose = (...what: string[]): string[] =>
		fileProse(
			"section",
			[
				...what,
				"Callout Studio wrote it, from Settings → Callout Studio → Publish to the",
				"web. Everything outside the two markers is yours and is left alone.",
			],
			["After making changes, publish this file again from Publish changes.", HARD_REFRESH],
			[
				"- Don't edit anything between the two markers.",
				...EDITED.map((line) => `  ${line}`),
				"- Don't delete or change the two marker lines.",
			],
			[
				"- Add your own code or styles anywhere outside the two markers.",
				"- Move the whole section, markers included, elsewhere in this file.",
				"- Delete the whole section, markers included, when you no longer need",
				"  it. Callout Studio does not add it again by itself.",
			],
		);
	return [
		{
			path: PUBLISH_JS,
			kind: "block",
			slot: PUBLISH_JS,
			prose: prose("Draws Callout Studio's heading and inline callouts on your Publish site."),
			body: browserScript(withoutCss(data)),
		},
		{
			path: PUBLISH_CSS,
			kind: "block",
			slot: PUBLISH_CSS,
			prose: prose(
				"Styles for Callout Studio's heading and inline callouts on your Publish site,",
				"and your colors and icons for its block callouts (> [!tip]).",
			),
			body: data.css,
		},
	];
}

/**
 * A service's note and the copies a sync service left of it: `body` is the
 * snapshot as JSON, plain — it is base64 in the note, never read as script.
 */
function noteFiles(
	path: string,
	copies: readonly string[],
	slot: string,
	note: NonNullable<TargetFile["note"]>,
	body: string,
): TargetFile[] {
	const file = (at: string): TargetFile => ({ path: at, kind: "note", slot, prose: [], body, note });
	return [file(path), ...copies.map((at): TargetFile => ({ ...file(at), copy: true }))];
}

/**
 * The note the Callout Studio Quartz plugin reads, stylesheet included: the
 * plugin puts the stylesheet in every page's head. Data only — the plugin
 * that draws with it is installed in the site (`web/static/quartz.ts`).
 */
function quartzFiles(data: WebExportData, options: TargetOptions): TargetFile[] {
	const quartzData: WebBundleData = { ...data, css: quartzCss(data.css) };
	return noteFiles(
		options.notePath ?? newNotePath("quartz", options),
		options.noteCopies ?? [],
		QUARTZ_NOTE_SLOT,
		{ kind: QUARTZ_NOTE, frontmatter: newQuartzNoteFrontmatter(options.noteMarkers) },
		JSON.stringify(quartzData),
	);
}

/** The note, stylesheet included: the garden plugin serves the stylesheet from it. */
function gardenFiles(data: WebExportData, options: TargetOptions): TargetFile[] {
	return noteFiles(
		options.notePath ?? GARDEN_NOTE_PATH,
		options.noteCopies ?? [],
		GARDEN_NOTE_SLOT,
		{ kind: GARDEN_NOTE, frontmatter: newGardenNoteFrontmatter() },
		JSON.stringify(data),
	);
}

/** The files of one target, for one snapshot. */
export function targetFiles(id: WebTargetId, data: WebExportData, options: TargetOptions = {}): TargetFile[] {
	switch (id) {
		case "publish":
			return publishFiles(data);
		case "quartz":
			return quartzFiles(data, options);
		case "garden":
			return gardenFiles(data, options);
	}
}
