/**
 * scripts/lib/gardenPlugin.mjs — the Callout Studio garden plugin, assembled.
 *
 * One plugin for every Digital Garden, published from its own repository so
 * the Digital Garden plugin can install and update it (its installer copies
 * every file in a repository, which rules out installing from this one). It
 * holds no callouts: those reach a garden in the note Callout Studio writes
 * (`src/web/static/gardenNote.ts`), and the hooks read that note while the
 * garden is built (`src/web/static/garden.ts`).
 *
 * The plugin is the files in `web-plugins/digital-garden/` — manifest, head
 * template, README — plus `index.js`, made here from two of `webAssets.mjs`'s
 * bundles:
 * the renderer (the same one every export carries), then the garden hooks,
 * then one line that hands the hooks Node. That line is outside both
 * bundles on purpose, because they may not `require()` anything and the
 * hooks must: `fs` to read the notes, `crypto` to check the fingerprint.
 *
 * Unminified, because a garden owner is told to read a plugin before they let
 * it run in their build.
 *
 * `scripts/build-garden-plugin.mjs` writes the result to `dist/garden-plugin/`,
 * and `tests/webGarden.test.ts` runs `index.js` — joined by the same
 * `gardenPluginIndex.mjs` — on a pretend garden.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { gardenPluginIndex } from "./gardenPluginIndex.mjs";
import { WEB_BUNDLES, buildWebBundle } from "./webAssets.mjs";

/** The folder in this repository the plugin's hand-written files live in. */
export const GARDEN_PLUGIN_DIR = "web-plugins/digital-garden";

/** The files copied as they are, beside the generated `index.js`. */
export const GARDEN_PLUGIN_STATIC_FILES = ["garden-plugin.json", "head.njk", "README.md"];

/** Every file of the plugin, by its path inside the plugin's repository. */
export async function buildGardenPlugin(root) {
	const source = (name) => readFileSync(path.join(root, GARDEN_PLUGIN_DIR, name), "utf8");
	const { version } = JSON.parse(source("garden-plugin.json"));
	const [core, host] = await Promise.all([
		buildWebBundle(root, "core", { minify: false }),
		buildWebBundle(root, "garden", { minify: false }),
	]);
	const files = Object.fromEntries(GARDEN_PLUGIN_STATIC_FILES.map((name) => [name, source(name)]));
	files["index.js"] = gardenPluginIndex({
		coreJs: core.text,
		coreGlobal: WEB_BUNDLES.core.global,
		hostJs: host.text,
		hostGlobal: WEB_BUNDLES.garden.global,
		version,
	});
	files.LICENSE = readFileSync(path.join(root, "LICENSE"), "utf8");
	return files;
}
