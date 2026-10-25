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
 */
import path from "node:path";

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
		}],
	};
}
