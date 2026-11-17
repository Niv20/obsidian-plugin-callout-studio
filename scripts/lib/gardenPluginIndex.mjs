/**
 * scripts/lib/gardenPluginIndex.mjs — the garden plugin's `index.js`, joined
 * from bundles already built. See `gardenPlugin.mjs` for what the plugin is.
 *
 * Apart from `gardenPlugin.mjs` because that one builds the bundles with
 * esbuild, and the tests join the plugin from the bundles `npm test` already
 * has: importing esbuild into a test bundle is not something to do lightly.
 */
/**
 * The hooks file: a header, the two bundles, and the line joining them.
 * `coreJs`/`hostJs` are the core and garden bundles' text, and
 * `coreGlobal`/`hostGlobal` the globals each assigns (`WEB_BUNDLES` in
 * `webAssets.mjs`).
 */
export function gardenPluginIndex({ coreJs, coreGlobal, hostJs, hostGlobal, version }) {
	const header = [
		"/*",
		` * Callout Studio garden plugin ${version}`,
		" *",
		" * Draws the heading and inline callouts of the Callout Studio Obsidian",
		" * plugin while a Digital Garden is built. It holds no callouts: it reads",
		" * them from the note with the callout-studio-web property, which Callout",
		" * Studio writes in the vault and the Digital Garden plugin publishes.",
		" *",
		" * Reads src/site/notes/ only. Writes nothing to the repository, and",
		" * makes no network requests.",
		" *",
		" * Built from https://github.com/Niv20/obsidian-plugin-callout-studio",
		" * (src/web/). Do not edit: it is replaced on every update.",
		" */",
	].join("\n");
	const join =
		`module.exports = ${hostGlobal}.garden(${coreGlobal}, {\n` +
		'\tfs: require("fs"),\n' +
		'\tpath: require("path"),\n' +
		'\tcrypto: require("crypto"),\n' +
		"\tcwd: function () {\n" +
		"\t\treturn process.cwd();\n" +
		"\t},\n" +
		"});\n";
	return `${header}\n${coreJs.trimEnd()}\n${hostJs.trimEnd()}\n${join}`;
}
