/** Capture image 05's production-registered ribbon icon, entirely offline. */
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { loadObsidianAssets } from "./user-guide/obsidian-assets.mjs";
import { exportSvg } from "./user-guide/vector-exporter.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const { appCss, icons, version } = loadObsidianAssets();
const runtime = path.join(root, "scripts/user-guide/obsidian-runtime.ts");
const { outputFiles } = await build({
	entryPoints: [path.join(root, "scripts/store-bento/ribbon-scene.mjs")],
	bundle: true, write: false, format: "iife", globalName: "bentoRibbon",
	plugins: [{ name: "ribbon-icon-registration", setup(builder) {
		builder.onResolve({ filter: /^obsidian$/ }, () => ({ path: "obsidian", namespace: "ribbon-host" }));
		// The standard guide host uses static Lucide icons only. This scoped
		// bridge also retains production addIcon registrations, like Obsidian.
		builder.onLoad({ filter: /.*/, namespace: "ribbon-host" }, () => ({
			resolveDir: root,
			contents: `export * from ${JSON.stringify(runtime)};
import { setIcon as nativeIcon } from ${JSON.stringify(runtime)};
const registered = new Map();
export function addIcon(id, content) { registered.set(id, content); }
export function removeIcon(id) { registered.delete(id); }
export function setIcon(parent, id) {
  if (!registered.has(id)) return nativeIcon(parent, id);
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  for (const [key, value] of Object.entries({ xmlns: "http://www.w3.org/2000/svg", viewBox: "0 0 100 100", width: "24", height: "24", class: "svg-icon" })) svg.setAttribute(key, value);
  svg.innerHTML = registered.get(id);
  parent.replaceChildren(svg);
}`,
		}));
	} }],
});
const layout = `
body { margin:0; padding:20px; overflow:hidden; background:transparent; }
*, *::before, *::after { animation:none!important; transition:none!important; }
#bento-ribbon { position:relative; width:233px; height:180px; background:transparent; }
#bento-ribbon .workspace-ribbon { position:absolute; left:3px; top:2px; border-radius:8px 0 0 8px; }
/* Complete the square right edge in the vector export as well. */
#bento-ribbon .workspace-ribbon::before { content:""; position:absolute; right:0; top:0; width:8px; height:100%; background:var(--ribbon-background); border-radius:0; }
#bento-ribbon .bento-files { position:absolute; left:63px; top:9px; width:165px; opacity:.52; }
#bento-ribbon .bento-file { display:flex; align-items:center; height:31px; color:var(--text-faint); }
#bento-ribbon .bento-file-name { display:block; height:6px; border-radius:3px; background:var(--text-faint); }

#bento-ribbon .tooltip { position:absolute; left:50px; top:90px; width:174px; max-width:174px; }
#bento-ribbon .tooltip.mod-right .tooltip-arrow { left:-6px; top:calc(50% - 6px); margin-left:0; width:6px; height:12px; border:0; }
`;
const browser = await chromium.launch({ headless: true, executablePath: process.env.BROWSER_EXECUTABLE });
try {
	const page = await browser.newPage({ viewport: { width: 320, height: 260 }, colorScheme: "dark", deviceScaleFactor: 2 });
	const network = [], errors = [];
	await page.route("**/*", route => { network.push(route.request().url()); return route.abort(); });
	page.on("pageerror", error => errors.push(error.message));
	await page.setContent('<!doctype html><html><head></head><body class="theme-dark is-desktop show-ribbon"></body></html>');
	await page.addStyleTag({ content: appCss });
	await page.addStyleTag({ content: layout });
	await page.evaluate(({ icons, version }) => {
		globalThis.__CS_GUIDE_ICONS__ = icons;
		globalThis.__CS_GUIDE_OBSIDIAN_VERSION__ = version;
	}, { icons, version });
	await page.addScriptTag({ content: outputFiles[0].text });
	const metadata = await page.evaluate(() => bentoRibbon.mountRibbon());
	const state = await page.evaluate(() => globalThis.__BENTO_RIBBON_VERIFY__());
	assert.deepEqual(state, { fileCount: 5, fileText: "", expandedFolders: 0, corners: ["8px", "0px", "0px", "8px"], opened: true, count: 5, selectedIndex: 2, tooltip: "Quick insert block callout" });
	const svg = await exportSvg(page, metadata.selector, { ...metadata, padding: 0, background: "transparent" });
	assert.ok(!/<(?:image|script|foreignObject)\b/.test(svg));
	assert.ok(svg.includes("Quick insert block"));
	assert.ok(svg.includes('<polygon points="6,0 0,6 6,12"'), "The tooltip needs a left-pointing triangle");
	assert.ok(await page.evaluate(() => {
		const arrow = document.querySelector("#bento-ribbon .tooltip-arrow").getBoundingClientRect();
		const divider = document.querySelector("#bento-ribbon .workspace-ribbon").getBoundingClientRect().right;
		return arrow.left < divider && arrow.right > divider;
	}), "The tooltip triangle must overlap the ribbon divider");
	await page.evaluate(svg => {
		const document = new DOMParser().parseFromString(svg, "image/svg+xml");
		if (document.querySelector("parsererror")) throw new Error("Malformed exported SVG");
		if (document.documentElement.getAttribute("viewBox") !== "0 0 233 180") throw new Error("Unexpected SVG geometry");
	}, svg);
	const output = path.join(root, "assets/store-screenshots/desktop/components");
	mkdirSync(output, { recursive: true });
	writeFileSync(path.join(output, "05-ribbon.svg"), svg);
	await page.setContent(`<!doctype html><html><style>body{margin:0;background:#1c1c1c}svg{display:block}</style><body>${svg}</body></html>`);
	await page.locator("body > svg").screenshot({ path: "/private/tmp/bento-ribbon-review.png" });
	assert.deepEqual(network, [], "The capture attempted a network request");
	assert.deepEqual(errors, [], "Browser errors during component capture");
	console.log(JSON.stringify({ output: "05-ribbon.svg", width: 233, height: 180, ...state, preview: "/private/tmp/bento-ribbon-review.png" }));
} finally {
	await browser.close();
}
