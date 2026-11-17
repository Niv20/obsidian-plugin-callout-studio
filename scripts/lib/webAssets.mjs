/**
 * scripts/lib/webAssets.mjs — the things a website export is made of that are
 * not in `src/`'s main bundle: the web renderer and its hosts, each compiled on
 * its own, and the slice of `styles.css` that styles heading bars and inline
 * pills.
 *
 * They reach the plugin through one virtual module,
 * `virtual:callout-studio-web-assets`, which `manager/web/` imports like any
 * other. It is resolved here rather than generated into a checked-in file
 * because a generated copy can go stale: the renderer shares its grammar with
 * the editor (`editor/calloutTokens.ts`), so an edit there has to reach the
 * exported files without anyone remembering to regenerate anything.
 * `esbuild.config.mjs` and `run-tests.mjs` both install this plugin, so the
 * build and the suites see the same bytes.
 *
 * Four bundles, not one, and the split is what keeps `main.js` inside its
 * budget and a reader's download small:
 *
 * - **core** (`src/web/core.ts`) — the renderer and the grammar it imports;
 * - **browser** (`src/web/browser.ts`) — the host for a visitor's browser;
 * - **static** (`src/web/static/index.ts`) — the host for a Quartz build, with
 *   the small DOM it runs the renderer on. Only the Callout Studio Quartz
 *   plugin is made of it (`quartzPlugin.mjs`);
 * - **garden** (`src/web/static/gardenPlugin.ts`) — the Digital Garden hooks.
 *   Only the Callout Studio garden plugin is made of it (`gardenPlugin.mjs`).
 *
 * `main.js` imports nothing of the last two, so the build tree-shakes them
 * away: the tests and the two plugins' builds are what read them.
 *
 * A host imports the core for its types only and receives it as an argument,
 * so the exporter can join `core + browser` for one target and
 * `core + static` for another without the plugin carrying the grammar twice.
 * {@link buildWebBundle} fails the build if a host bundle pulls in anything
 * outside its own sources — that is how a copy would get in.
 *
 * None of them may need `obsidian`, or `require()` at all: a browser has
 * neither, and a site's build must not depend on what happens to be installed
 * beside it. Reaching one is a build failure here, not a runtime error on
 * someone's site.
 */
import { build } from "esbuild";
import { readFileSync } from "node:fs";
import path from "node:path";

/** The specifier `src/` imports. */
export const WEB_ASSETS_MODULE = "virtual:callout-studio-web-assets";

/**
 * The bundles: where each starts, the global its IIFE assigns, and — for a
 * host — the only sources it may be built from.
 */
export const WEB_BUNDLES = {
	core: { entry: "src/web/core.ts", global: "CalloutStudioCore" },
	browser: { entry: "src/web/browser.ts", global: "CalloutStudioBrowser", only: ["src/web/browser.ts"] },
	static: { entry: "src/web/static/index.ts", global: "CalloutStudioStatic", only: ["src/web/static/"] },
	garden: { entry: "src/web/static/gardenPlugin.ts", global: "CalloutStudioGarden", only: ["src/web/static/"] },
};

const START_MARKER = "/* @cs-web:start */";
const END_MARKER = "/* @cs-web:end */";

/**
 * The rules between the two markers in `styles.css`, comments and blank lines
 * removed. The comments there explain Obsidian's cascade to the next person to
 * edit that file; on a published page they are only bytes.
 */
export function extractWebCss(stylesCss) {
	const start = stylesCss.indexOf(START_MARKER);
	const end = stylesCss.indexOf(END_MARKER);
	if (start < 0 || end < 0 || end < start) {
		throw new Error(
			`styles.css must contain "${START_MARKER}" followed by "${END_MARKER}" around the heading and inline callout rules`,
		);
	}
	return stylesCss
		.slice(start + START_MARKER.length, end)
		.replace(/\/\*[\s\S]*?\*\//g, "")
		.split("\n")
		.map((line) => line.replace(/\s+$/, ""))
		.filter((line) => line.trim() !== "")
		.join("\n");
}

/**
 * Compile one of {@link WEB_BUNDLES} to a self-contained script. Returns its
 * text and the files it was built from, so a watcher can rebuild when one of
 * them changes.
 */
export async function buildWebBundle(root, name, { minify = true } = {}) {
	const spec = WEB_BUNDLES[name];
	const result = await build({
		absWorkingDir: root,
		entryPoints: [spec.entry],
		tsconfig: path.join(root, "scripts/tsconfig.json"),
		bundle: true,
		write: false,
		metafile: true,
		format: "iife",
		globalName: spec.global,
		platform: "neutral",
		target: "es2018",
		minify,
		charset: "utf8",
		legalComments: "none",
		logLevel: "warning",
	});
	const text = result.outputFiles[0].text;
	if (/\brequire\s*\(/.test(text)) {
		throw new Error(
			`${spec.entry} pulled in a module that needs require() — it runs in a browser or a site's build and may import only pure modules`,
		);
	}
	const inputs = Object.keys(result.metafile.inputs);
	if (spec.only) {
		const stray = inputs.filter((input) => !spec.only.some((prefix) => input.startsWith(prefix)));
		if (stray.length > 0) {
			throw new Error(
				`${spec.entry} bundles ${stray.join(", ")} — a host receives the core as an argument and may import it for types only`,
			);
		}
	}
	return { text, inputs: inputs.map((input) => path.resolve(root, input)) };
}

/** The esbuild plugin that answers {@link WEB_ASSETS_MODULE}. */
export function webAssetsPlugin(root, options = {}) {
	return {
		name: "callout-studio-web-assets",
		setup(pluginBuild) {
			pluginBuild.onResolve({ filter: /^virtual:callout-studio-web-assets$/ }, (args) => ({
				path: args.path,
				namespace: "callout-studio-web-assets",
			}));
			pluginBuild.onLoad({ filter: /.*/, namespace: "callout-studio-web-assets" }, async () => {
				const stylesPath = path.join(root, "styles.css");
				const names = Object.keys(WEB_BUNDLES);
				const bundles = await Promise.all(names.map((name) => buildWebBundle(root, name, options)));
				const css = extractWebCss(readFileSync(stylesPath, "utf8"));
				const constant = (name) => `WEB_${name.toUpperCase()}`;
				return {
					contents:
						names
							.map(
								(name, i) =>
									`export const ${constant(name)}_JS = ${JSON.stringify(bundles[i].text)};\n` +
									`export const ${constant(name)}_GLOBAL = ${JSON.stringify(WEB_BUNDLES[name].global)};\n`,
							)
							.join("") + `export const WEB_STRUCTURAL_CSS = ${JSON.stringify(css)};\n`,
					loader: "js",
					watchFiles: [stylesPath, ...bundles.flatMap((bundle) => bundle.inputs)],
				};
			});
		},
	};
}
