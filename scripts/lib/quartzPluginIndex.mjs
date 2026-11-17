/**
 * scripts/lib/quartzPluginIndex.mjs — the Quartz plugin's `dist/index.js`,
 * joined from bundles already built. See `quartzPlugin.mjs` for what the
 * plugin is.
 *
 * Apart from `quartzPlugin.mjs` because that one builds the bundles with
 * esbuild, and the tests join the plugin from the bundles `npm test` already
 * has: importing esbuild into a test bundle is not something to do lightly.
 */
/**
 * The plugin's entry point: a header, Node's three modules, the two bundles,
 * and the line joining them. `coreJs`/`hostJs` are the core and static
 * bundles' text, and `coreGlobal`/`hostGlobal` the globals each assigns
 * (`WEB_BUNDLES` in `webAssets.mjs`).
 *
 * An ES module, as Quartz 5 imports a plugin and as Quartz 4's configuration
 * imports a package. The bundles are scripts that each assign one `var`,
 * which in a module stays the module's own: a site gains no global of ours.
 * The imports are `node:` ones, which Quartz 5 accepts from a plugin without
 * asking it to bundle them.
 */
export function quartzPluginIndex({ coreJs, coreGlobal, hostJs, hostGlobal, version }) {
	const header = [
		"/*",
		` * Callout Studio for Quartz ${version}`,
		" *",
		" * Draws the heading and inline callouts of the Callout Studio Obsidian",
		" * plugin while a Quartz site is built. It holds no callouts: it reads",
		" * them from the note Callout Studio writes in the vault,",
		" * callout-studio-quartz.md, in the content folder, and keeps that note",
		" * off the site.",
		" *",
		" * Reads the content folder's notes only, to find that one. Writes",
		" * nothing, and makes no network requests.",
		" *",
		" * Built from https://github.com/Niv20/obsidian-plugin-callout-studio",
		" * (src/web/). Do not edit: it is replaced on every update.",
		" */",
	].join("\n");
	const imports = ['import fs from "node:fs";', 'import path from "node:path";', 'import crypto from "node:crypto";'];
	const join =
		`export const CalloutStudio = ${hostGlobal}.quartz(${coreGlobal}, { fs, path, crypto });\n` +
		"export default CalloutStudio;\n";
	return `${header}\n${imports.join("\n")}\n${coreJs.trimEnd()}\n${hostJs.trimEnd()}\n${join}`;
}
