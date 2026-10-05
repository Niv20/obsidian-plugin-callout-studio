/** Capture image 05's Idea block and production context actions, entirely offline. */
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
	entryPoints: [path.join(root, "scripts/store-bento/context-menu-scene.mjs")],
	bundle: true, write: false, format: "iife", globalName: "bentoContextMenu",
	alias: { obsidian: path.join(root, "scripts/user-guide/obsidian-runtime.ts") },
});
const layout = `
body { margin:0; padding:32px; overflow:hidden; background:var(--background-primary); }
*, *::before, *::after { animation:none!important; transition:none!important; caret-color:transparent!important; }
.guide-note { width:800px; height:auto; padding:32px; background:var(--background-primary); border:1px solid var(--background-modifier-border); border-radius:12px; max-height:704px; overflow:auto; }
.guide-note .markdown-rendered { padding:0; }
`;
const browser = await chromium.launch({ headless: true, executablePath: process.env.BROWSER_EXECUTABLE });
try {
	const page = await browser.newPage({ viewport: { width: 1200, height: 820 }, colorScheme: "dark", deviceScaleFactor: 2 });
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
	const metadata = await page.evaluate(() => bentoContextMenu.mountContextMenu());
	const geometry = await page.evaluate(selector => {
		const panel = document.querySelector(selector), bounds = panel.getBoundingClientRect();
		const box = element => {
			const rect = element.getBoundingClientRect();
			return [rect.x - bounds.x + 24, rect.y - bounds.y + 24, rect.width, rect.height].map(value => Math.round(value * 100) / 100);
		};
		const callout = panel.querySelector('.callout[data-callout="idea"]');
		return {
			callout: box(callout), menu: box(panel.querySelector(".menu")),
			title: callout.querySelector(".callout-title-inner").textContent,
			iconPaths: callout.querySelectorAll(".callout-icon svg path").length,
			items: [...panel.querySelectorAll(".menu-item-title")].map(item => item.textContent),
		};
	}, metadata.selector);
	assert.equal(geometry.title, "Idea");
	assert.deepEqual(geometry.items, ["Copy callout Markdown", "Set callout closed (-)", "Make callout non-collapsible", "Edit callout settings", "Open Callout Studio settings"]);
	assert.deepEqual(geometry.callout.slice(0, 2), [57, 57]);
	assert.deepEqual(geometry.menu.slice(0, 2), [405, 150]);
	assert.ok(geometry.iconPaths > 0, "Idea must retain its rendered lightbulb icon");
	const svg = await exportSvg(page, metadata.selector, { ...metadata, padding: 24 });
	assert.ok(!/<(?:image|script|foreignObject)\b/.test(svg));
	assert.ok(svg.includes(">Idea</text>"));
	await page.evaluate(svg => {
		const document = new DOMParser().parseFromString(svg, "image/svg+xml");
		if (document.querySelector("parsererror")) throw new Error("Malformed exported SVG");
	}, svg);
	const output = path.join(root, "assets/store-screenshots/desktop/components");
	mkdirSync(output, { recursive: true });
	writeFileSync(path.join(output, "05-context-menu.svg"), svg);
	await page.setContent(`<!doctype html><html><style>body{margin:0;background:#1c1c1c}svg{display:block}</style><body>${svg}</body></html>`);
	await page.locator("body > svg").screenshot({ path: "/private/tmp/bento-context-menu-review.png" });
	assert.deepEqual(network, [], "The capture attempted a network request");
	assert.deepEqual(errors, [], "Browser errors during component capture");
	console.log(JSON.stringify({ output: "05-context-menu.svg", ...geometry, preview: "/private/tmp/bento-context-menu-review.png" }));
} finally {
	await browser.close();
}
