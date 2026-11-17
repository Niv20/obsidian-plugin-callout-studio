/**
 * manager/web/quartzConfig.ts — whether a Quartz configuration file loads the
 * Callout Studio Quartz plugin, read from the file's text.
 *
 * Who calls it. `siteFacts.ts`, for the Publish to the web panel
 * (`webPanel/`), which says in its "install the Quartz plugin" step what it
 * found, where it can see the file.
 *
 * The main idea. A Quartz site is told about the plugin in one file. Where
 * the vault is the Quartz repository itself, that file is in the vault, so the
 * panel need not leave it to the user: it reads the file and says what is
 * there. Where the vault is only the `content` folder, the file is one level
 * above anything this plugin may read, and the panel says nothing about it.
 *
 * - **Quartz 4** is `quartz.config.ts`: an `import` from the plugin's package
 *   (`quartz-plugin-callout-studio`, which `npm install` put in the site),
 *   and a `CalloutStudio()` call in `transformers`, before
 *   `Plugin.Description()`. After it, the callouts are still drawn on the
 *   page, but the description, search and RSS are cut from the text before
 *   it was turned, so they show `[!tip]`. That is a state of its own here,
 *   since it is a mistake a build does not stop for.
 * - **Quartz 5** is `quartz.config.yaml`: an entry under `plugins` whose
 *   `source` names the plugin's repository — what `npx quartz plugin add`
 *   writes — or whose `repo` does, in the longer form a source may take. The
 *   repository is named with its owner (`Callout-Studio/quartz`): its name
 *   alone could be anyone's Quartz. An entry with `enabled: false` is there
 *   and switched off. Its place among the transformers comes from the
 *   plugin's own manifest, so there is no "misplaced" here.
 *
 * Until 2026-11-17 the plugin was a folder Callout Studio wrote into the vault,
 * and this also checked that the configuration pointed at that folder and kept
 * it off the site (`ignorePatterns`). The vault now holds only the plugin's
 * data, in a note the plugin keeps off the site itself
 * (`web/static/quartzNote.ts`).
 *
 * It is a reading, not a parse. Comments are taken out first, so a line that
 * was commented out does not count; past that, the text is searched for the
 * plugin's name. A file written some other way that still works (the plugin
 * imported under another name, say) reads as "not there", and the panel then
 * shows a step to do that is already done. That is the cheap mistake: the
 * lines are on the screen to compare with. So is a site that added the plugin
 * under its first address (`Niv20/quartz-plugin-callout-studio`, before
 * 2026-11-17): GitHub still forwards it, and the step shows the current one.
 *
 * Pure: text in, a state out.
 */
import { QUARTZ_PLUGIN_PACKAGE, QUARTZ_PLUGIN_REPO_URL } from "./targets";

/** What a configuration file says about the plugin. */
export type QuartzConfigState =
	/** The plugin is loaded, in the right place. */
	| "ok"
	/** Nothing of the plugin's is in the file. */
	| "none"
	/** Quartz 4: `CalloutStudio()` is used, with no `import` for it. */
	| "noImport"
	/** Quartz 4: the `import` is there, and `CalloutStudio()` is not used. */
	| "noUse"
	/** Quartz 4: `CalloutStudio()` comes after `Plugin.Description()`. */
	| "misplaced"
	/** Quartz 5: the entry is there, with `enabled: false`. */
	| "off";

/** The Quartz generations this plugin writes for. */
export type QuartzVersion = 4 | 5;

/** The configuration file each generation reads, at the top of the repository. */
export const QUARTZ_CONFIG_FILE: Record<QuartzVersion, string> = {
	4: "quartz.config.ts",
	5: "quartz.config.yaml",
};

/**
 * TypeScript without its comments. A `//` counts as one only at the start of
 * a line or after a space, so the `//` of an address in a string stays.
 */
function withoutTsComments(text: string): string {
	return text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|\s)\/\/[^\n]*/g, "$1");
}

/** One line of YAML without its comment: a `#` at the start, or after a space. */
function withoutYamlComment(line: string): string {
	return line.replace(/(^|\s)#.*$/, "$1");
}

const escape = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const PACKAGE = escape(QUARTZ_PLUGIN_PACKAGE);
/** The repository as `owner/name`: `Callout-Studio/quartz`. */
const REPO = escape(new URL(QUARTZ_PLUGIN_REPO_URL).pathname.slice(1));

/** An `import … from "quartz-plugin-callout-studio"`, on one line or over several. */
const IMPORT_RE = new RegExp(`\\bfrom\\s*["']${PACKAGE}(?:/[^"'\\n]*)?["']`);
const USE_RE = /\bCalloutStudio\s*\(/;
const DESCRIPTION_RE = /\bPlugin\s*\.\s*Description\s*\(/;

function checkQuartz4(text: string): QuartzConfigState {
	const code = withoutTsComments(text);
	const imported = IMPORT_RE.test(code);
	const use = USE_RE.exec(code);
	if (!imported && !use) return "none";
	if (!imported) return "noImport";
	if (!use) return "noUse";
	const description = DESCRIPTION_RE.exec(code);
	return description && use.index > description.index ? "misplaced" : "ok";
}

/** How far a line is set in, or -1 for a line with nothing on it. */
const indentOf = (line: string): number => (line.trim() === "" ? -1 : line.length - line.trimStart().length);

/**
 * The line that names the plugin: `source: github:Callout-Studio/quartz`, the
 * bare `Callout-Studio/quartz` Quartz also takes, or, in a source written as an
 * object, its `repo:`. The owner is part of the name: `github:someone/quartz`
 * is another plugin, and so is `my-Callout-Studio/quartz`. GitHub reads an
 * address in any case, so this does too.
 */
const SOURCE_RE = new RegExp(
	`^\\s*(?:-\\s+)?(?:source|repo)\\s*:\\s*["']?(?:[^"'\\s]*[/:])?${REPO}(?:\\.git)?(?:#[^"'\\s]*)?["']?\\s*$`,
	"i",
);

function checkQuartz5(text: string): QuartzConfigState {
	const lines = text.split(/\r?\n/).map(withoutYamlComment);
	const at = lines.findIndex((line) => SOURCE_RE.test(line));
	if (at < 0) return "none";
	// The entry runs from its dash to the next line set in no further than it.
	let first = at;
	while (first > 0 && !/^\s*-\s/.test(lines[first]!)) first--;
	const dash = indentOf(lines[first]!);
	let last = at;
	for (let i = first + 1; i < lines.length; i++) {
		const indent = indentOf(lines[i]!);
		if (indent >= 0 && indent <= dash) break;
		last = i;
	}
	const off = lines.slice(first, last + 1).some((line) => /^\s*(?:-\s+)?enabled\s*:\s*["']?false\b/i.test(line));
	return off ? "off" : "ok";
}

/** What `text`, the configuration file of that Quartz generation, says about the plugin. */
export function checkQuartzConfig(text: string, version: QuartzVersion): QuartzConfigState {
	return version === 5 ? checkQuartz5(text) : checkQuartz4(text);
}
