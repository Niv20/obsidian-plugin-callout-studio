/**
 * scripts/user-guide/guideRuntime.mjs — the esbuild options that bundle a
 * scene against the guide's offline Obsidian.
 *
 * Who calls it. The scripts that render the user guide's and the store's
 * pictures (render-*.mjs).
 *
 * The main idea. Every `import … from "obsidian"` becomes
 * scripts/user-guide/obsidian-runtime.ts, which draws Obsidian's real DOM. One
 * file needs more than the alias: the test renderer
 * (tests/support/declarativeRenderer.ts), which the settings scenes use,
 * imports the test stub by its path, `./obsidianStub`. Its import is pointed
 * at the runtime too, or the settings would be drawn by the stub's simpler
 * stand-ins (no slider, no icons).
 *
 * It also installs scripts/lib/webAssets.mjs, as the plugin's own build and
 * the test runner do: any bundle that reaches the Export chooser imports
 * `virtual:callout-studio-web-assets`, and nothing else can resolve it.
 */
import path from "node:path";
import { webAssetsPlugin } from "../lib/webAssets.mjs";

export function guideRuntimeOptions(root) {
	const runtime = path.join(root, "scripts/user-guide/obsidian-runtime.ts");
	const renderer = path.join(root, "tests/support/declarativeRenderer.ts");
	return {
		alias: { obsidian: runtime },
		plugins: [{
			name: "test-renderer-on-guide-runtime",
			setup(build) {
				build.onResolve({ filter: /^\.\/obsidianStub$/ }, (args) => (args.importer === renderer ? { path: runtime } : undefined));
			},
		},
		// The settings scenes bundle the Export chooser, which imports the
		// website export's assets through a virtual module only this answers.
		webAssetsPlugin(root)],
	};
}
