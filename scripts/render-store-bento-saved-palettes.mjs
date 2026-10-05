/** Capture image 05's native saved-palette rows; no network or vault writes. */
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
	entryPoints: [path.join(root, "scripts/store-bento/saved-palettes-scene.mjs")],
	bundle: true, write: false, format: "iife", globalName: "bentoSavedPalettes",
	alias: { obsidian: path.join(root, "scripts/user-guide/obsidian-runtime.ts") },
});
const layout = `
body { margin:0; padding:20px; overflow:hidden; background:transparent; }
*, *::before, *::after { animation:none!important; transition:none!important; }
#bento-saved-palettes { width:233px; height:166px; background:transparent; font-size:14px; }
#bento-saved-palettes .cs-sticky-heading { display:none; }
#bento-saved-palettes .cs-palettes-section { margin:0; padding:0; border:0; }
#bento-saved-palettes .callout-studio-callout-list { gap:8px; margin:0; padding:0; }
#bento-saved-palettes .cs-palette-list-row { height:50px; padding:8px 10px; gap:10px; }
#bento-saved-palettes .callout-studio-row-buttons { gap:2px; }
#bento-saved-palettes .callout-studio-row-buttons button { width:24px; height:28px; }
`;
const browser = await chromium.launch({ headless: true, executablePath: process.env.BROWSER_EXECUTABLE });
try {
	const page = await browser.newPage({ viewport: { width: 400, height: 240 }, colorScheme: "dark", deviceScaleFactor: 2 });
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
	const metadata = await page.evaluate(() => bentoSavedPalettes.mountSavedPalettes());
	assert.deepEqual(await page.locator(".cs-palette-list-name").allTextContents(), ["Coral", "Mint glass", "Twilight"]);
	assert.deepEqual(await page.locator(".cs-palette-list-row").evaluateAll(rows => rows.map(row => row.querySelectorAll(".cs-color-circle").length)), [2, 2, 3]);
	assert.equal(await page.locator(".is-transparent svg rect").count(), 16);
	assert.equal(await page.locator(".callout-studio-row-buttons button svg").count(), 6);
	const geometry = await page.locator(metadata.selector).boundingBox();
	assert.equal(geometry.width, 233);
	assert.equal(geometry.height, 166);
	const rowsFit = await page.locator(metadata.selector).evaluate(panel => {
		const bounds = panel.getBoundingClientRect();
		return [...panel.querySelectorAll(".cs-palette-list-row")].every(row => {
			const r = row.getBoundingClientRect(), name = row.querySelector(".cs-palette-list-name");
			return r.left >= bounds.left && r.right <= bounds.right && r.bottom <= bounds.bottom
				&& name.scrollWidth <= name.clientWidth;
		});
	});
	assert.ok(rowsFit, "All saved-palette rows and names must fit the tile");
	const svg = await exportSvg(page, metadata.selector, { ...metadata, padding: 0, background: "transparent" });
	assert.ok(!/<(?:image|script|foreignObject)\b/.test(svg), "Vector-only component required");
	await page.evaluate(svg => {
		const document = new DOMParser().parseFromString(svg, "image/svg+xml");
		if (document.querySelector("parsererror")) throw new Error("Malformed exported SVG");
		if (document.documentElement.getAttribute("viewBox") !== "0 0 233 166") throw new Error("Unexpected SVG geometry");
	}, svg);
	const output = path.join(root, "assets/store-screenshots/desktop/components");
	mkdirSync(output, { recursive: true });
	writeFileSync(path.join(output, "05-saved-palettes.svg"), svg);
	await page.setContent(`<!doctype html><html><style>body{margin:0;background:#1c1c1c}svg{display:block}</style><body>${svg}</body></html>`);
	await page.locator("body > svg").screenshot({ path: "/private/tmp/bento-saved-palettes-review.png" });
	assert.deepEqual(network, [], "The capture attempted a network request");
	assert.deepEqual(errors, [], "Browser errors during component capture");
	console.log(JSON.stringify({ output: "05-saved-palettes.svg", width: geometry.width, height: geometry.height, preview: "/private/tmp/bento-saved-palettes-review.png" }));
} finally {
	await browser.close();
}
