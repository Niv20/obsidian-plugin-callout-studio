/**
 * scripts/lib/quartzPlugin.mjs — the Callout Studio Quartz plugin, assembled.
 *
 * One plugin for every Quartz site, published from its own repository so a
 * site installs and updates it with Quartz's own tools: `npx quartz plugin
 * add github:…` on Quartz 5, `npm install github:…` on Quartz 4. Both copy the
 * whole repository they are pointed at, which rules out installing from this
 * one. It holds no callouts: those reach a site in the note Callout Studio
 * writes in the vault (`src/web/static/quartzNote.ts`), and the transformer
 * reads that note while the site is built (`src/web/static/quartz.ts`).
 *
 * The plugin is the files in `web-plugins/quartz/` — `package.json` (with the
 * `quartz` manifest Quartz 5 reads), README, `index.d.ts` — plus
 * `dist/index.js`, made here from two of `webAssets.mjs`'s bundles: the
 * renderer (the same one every export carries), then the Quartz host, then
 * one line that hands the host Node. Quartz 5 uses a plugin's `dist/` as it
 * is when the repository has one, and builds nothing.
 *
 * Unminified, because a site owner may want to read a plugin before they let
 * it run in their build.
 *
 * `scripts/build-quartz-plugin.mjs` writes the result to `dist/quartz-plugin/`,
 * and `tests/webQuartzPlugin.test.ts` imports `dist/index.js` — joined by the
 * same `quartzPluginIndex.mjs` — on a pretend site.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { quartzPluginIndex } from "./quartzPluginIndex.mjs";
import { WEB_BUNDLES, buildWebBundle } from "./webAssets.mjs";

/** The folder in this repository the plugin's hand-written files live in. */
export const QUARTZ_PLUGIN_DIR = "web-plugins/quartz";

/** The files copied as they are, by their path in the plugin's repository and their name here. */
export const QUARTZ_PLUGIN_STATIC_FILES = {
	"package.json": "package.json",
	"README.md": "README.md",
	"dist/index.d.ts": "index.d.ts",
};

/** Every file of the plugin, by its path inside the plugin's repository. */
export async function buildQuartzPlugin(root) {
	const source = (name) => readFileSync(path.join(root, QUARTZ_PLUGIN_DIR, name), "utf8");
	const { version } = JSON.parse(source("package.json"));
	const [core, host] = await Promise.all([
		buildWebBundle(root, "core", { minify: false }),
		buildWebBundle(root, "static", { minify: false }),
	]);
	const files = Object.fromEntries(
		Object.entries(QUARTZ_PLUGIN_STATIC_FILES).map(([published, name]) => [published, source(name)]),
	);
	files["dist/index.js"] = quartzPluginIndex({
		coreJs: core.text,
		coreGlobal: WEB_BUNDLES.core.global,
		hostJs: host.text,
		hostGlobal: WEB_BUNDLES.static.global,
		version,
	});
	files.LICENSE = readFileSync(path.join(root, "LICENSE"), "utf8");
	return files;
}
