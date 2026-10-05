/** Capture only image 05's Find component; no network or vault writes. */
import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
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
const { outputFiles } = await build({
	entryPoints: [path.join(root, "scripts/store-bento/find-scene.mjs")],
	bundle: true, write: false, format: "iife", globalName: "bentoFind",
	alias: { obsidian: path.join(root, "scripts/user-guide/obsidian-runtime.ts") },
});
const layout = `
body { margin:0; padding:20px; overflow:hidden; background:transparent; }
*, *::before, *::after { animation:none!important; transition:none!important; }
#bento-find { width:233px; height:414px; background:transparent; }
#bento-find .cs-sidebar-title, #bento-find .cs-sidebar-subtitle { display:none; }
#bento-find .cs-sidebar-toolbar { padding:0; gap:8px; }
#bento-find .cs-occurrences-controls { grid-template-columns:1fr 1.08fr; gap:8px; }
#bento-find .cs-combobox-control { padding-inline:8px; gap:4px; height:32px; min-height:32px; }
#bento-find .cs-combobox-control input[type="text"].cs-combobox-input { font-size:12.5px; }
#bento-find .cs-sidebar-summary { border-top:0; padding:2px 0 4px; font-size:12.5px; line-height:18px; }
#bento-find .cs-occurrences-scroll { padding:6px 0 0; overflow:hidden; }
#bento-find .cs-sidebar-file { padding-bottom:8px; }
#bento-find .cs-sidebar-file-heading { position:static; padding:6px 0 4px; font-size:12.5px; background:transparent; }
#bento-find .cs-sidebar-grid { gap:7px; }
#bento-find button.cs-sidebar-result { padding:8px 10px; gap:4px; }
#bento-find .cs-sidebar-location { font-size:11.5px; }
#bento-find .cs-occurrences-excerpt { font-size:12px; line-height:17px; }
`;
const browser = await chromium.launch({ headless: true, executablePath: process.env.BROWSER_EXECUTABLE });
try {
	const page = await browser.newPage({ viewport: { width: 400, height: 500 }, colorScheme: "dark", deviceScaleFactor: 2 });
	const network = [], errors = [];
	await page.route("**/*", route => { network.push(route.request().url()); return route.abort(); });
	page.on("pageerror", error => errors.push(error.message));
	await page.setContent('<!doctype html><html><head></head><body class="theme-dark is-desktop"></body></html>');
	await page.addStyleTag({ content: appCss });
	await page.addStyleTag({ content: readFileSync(path.join(root, "styles.css"), "utf8") });
	await page.addStyleTag({ content: layout });
	await page.evaluate(({ icons, version }) => {
		globalThis.__CS_GUIDE_ICONS__ = icons;
		globalThis.__CS_GUIDE_OBSIDIAN_VERSION__ = version;
	}, { icons, version });
	await page.addScriptTag({ content: outputFiles[0].text });
	const metadata = await page.evaluate(() => bentoFind.mountFind());
	assert.equal(metadata.count, 4);
	assert.equal(metadata.files, 3);
	assert.equal(metadata.summary, "4 occurrences in 3 files");
	assert.deepEqual(metadata.locations, ["Line 1 · Heading", "Line 9 · Block", "Line 3 · Heading", "Line 7 · Inline"]);
	assert.deepEqual(await page.locator("#bento-find input").evaluateAll(inputs => inputs.map(input => input.value)), ["All types", "All formats"]);
	const geometry = await page.locator(metadata.selector).boundingBox();
	assert.equal(geometry.width, 233);
	assert.equal(geometry.height, 414);
	const contentBounds = await page.evaluate(() => {
		const panel = document.querySelector("#bento-find").getBoundingClientRect();
		return [...document.querySelectorAll("#bento-find .cs-sidebar-result")].map(card => ({
			top: card.getBoundingClientRect().top - panel.top, bottom: card.getBoundingClientRect().bottom - panel.top,
		}));
	});
	await page.locator(metadata.selector).screenshot({ path: "/private/tmp/bento-find-layout.png" });
	assert.ok(contentBounds.every(card => card.bottom <= 414), `A source-reference card falls outside the tall component: ${JSON.stringify(contentBounds)}`);
	const svg = await exportSvg(page, metadata.selector, { ...metadata, padding: 0, background: "transparent" });
	assert.ok(!/<(?:image|script|foreignObject)\b/.test(svg));
	assert.ok(svg.includes("[!project] Launch plan") && svg.includes("[!info]{key decisions}"));
	await page.evaluate(svg => {
		const document = new DOMParser().parseFromString(svg, "image/svg+xml");
		if (document.querySelector("parsererror")) throw new Error("Malformed exported SVG");
		if (document.documentElement.getAttribute("viewBox") !== "0 0 233 414") throw new Error("Unexpected SVG geometry");
	}, svg);
	const output = path.join(root, "assets/store-screenshots/desktop/components");
	mkdirSync(output, { recursive: true });
	writeFileSync(path.join(output, "05-find.svg"), svg);
	await page.setContent(`<!doctype html><html><style>body{margin:0;background:#1c1c1c}svg{display:block}</style><body>${svg}</body></html>`);
	await page.locator("body > svg").screenshot({ path: "/private/tmp/bento-find-review.png" });
	assert.deepEqual(network, [], "The capture attempted a network request");
	assert.deepEqual(errors, [], "Browser errors during component capture");
	console.log(JSON.stringify({ output: "05-find.svg", width: geometry.width, height: geometry.height, summary: metadata.summary, preview: "/private/tmp/bento-find-review.png" }));
} finally {
	await browser.close();
}
