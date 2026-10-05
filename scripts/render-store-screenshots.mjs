/** Desktop-only store SVGs. Reuses the offline production-component guide host. */
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { exportSvg } from "./user-guide/vector-exporter.mjs";
import { loadObsidianAssets } from "./user-guide/obsidian-assets.mjs";
import { compose, captions, reviewHtml } from "./store-screenshots/composition.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const { appCss, icons, version } = loadObsidianAssets();
const { outputFiles } = await build({
	entryPoints: [path.join(root, "scripts/store-screenshots/scenes.mjs")], bundle: true,
	write: false, format: "iife", globalName: "storeScenes",
	alias: { obsidian: path.join(root, "scripts/user-guide/obsidian-runtime.ts") },
});
const layout = `
body { margin:0; padding:24px; overflow:hidden; background:var(--background-primary); }
*, *::before, *::after { animation:none!important; transition:none!important; caret-color:transparent!important; }
.guide-settings { width:780px; height:650px; padding:24px; background:var(--settings-background); overflow:auto; }
.modal-container { position:static; padding:0; height:auto; min-height:0; }
.modal-bg { display:none; }
.modal { position:relative; margin:0; max-height:640px!important; }
body[data-store-scene="03-create"] .modal { max-height:780px!important; }
.modal-content { min-height:0; }
.guide-note { width:720px; height:auto; min-height:0; padding:12px 26px; background:var(--background-primary); }
.guide-note .markdown-rendered { padding:0; }
.guide-note .markdown-rendered h1 { font-size:30px; margin-top:0; }
`;
const output = path.join(root, "assets/store-screenshots/desktop");
mkdirSync(path.join(output, "svg"), { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: process.env.BROWSER_EXECUTABLE });
try {
	const names = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(captions);
	for (const name of names) {
		assert.ok(name in captions, `Unknown scene: ${name}`);
		const page = await browser.newPage({ viewport: { width: 1300, height: 1000 }, colorScheme: "dark" });
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
		const metadata = await page.evaluate(name => storeScenes.mountScene(name), name);
		const geometry = await page.evaluate(selector => {
			const node = document.querySelector(selector), r = node.getBoundingClientRect();
			return { width: r.width, height: r.height, scrollHeight: node.scrollHeight, labels: node.innerText.slice(0, 250) };
		}, metadata.selector);
		const source = await exportSvg(page, metadata.selector, { ...metadata, padding: 0, background: "transparent" });
		const svg = compose(name, source, { ...metadata, geometry });
		await page.evaluate(svg => {
			const doc = new DOMParser().parseFromString(svg, "image/svg+xml");
			if (doc.querySelector("parsererror")) throw new Error("Malformed SVG");
			if (doc.documentElement.getAttribute("viewBox") !== "0 0 1200 800") throw new Error("Wrong canvas size");
			if (doc.querySelector("image, foreignObject, script")) throw new Error("SVG must be vector only");
			const ids = [...doc.querySelectorAll("[id]")].map(el => el.id);
			if (new Set(ids).size !== ids.length) throw new Error("Duplicate SVG IDs");
			for (const element of doc.querySelectorAll("*")) {
				for (const attr of element.attributes) {
					if (/^on/i.test(attr.name) || /href$/i.test(attr.name) && !attr.value.startsWith("#") || /url\(\s*["']?(?!#)/i.test(attr.value)) throw new Error("Active or external content");
				}
			}
			if (/\b(?:NaN|Infinity)\b/.test(svg)) throw new Error("Invalid geometry");
		}, svg);
		assert.deepEqual(network, [], `${name}: attempted network request`);
		assert.deepEqual(errors, [], `${name}: browser errors`);
		writeFileSync(path.join(output, "svg", `${name}.svg`), svg);
		console.log(`${name}: ${Math.round(Buffer.byteLength(svg) / 1024)} KiB; source ${geometry.width} × ${geometry.height}; scroll ${geometry.scrollHeight}`);
		await page.close();
	}
	writeFileSync(path.join(output, "index.html"), reviewHtml());
} finally { await browser.close(); }
