/** SVG-only phone artwork for images 01–04. Desktop and 4B stay untouched. */
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { exportSvg } from "./user-guide/vector-exporter.mjs";
import { loadObsidianAssets } from "./user-guide/obsidian-assets.mjs";
import { captions } from "./store-screenshots/composition.mjs";
import { composeMobile } from "./store-screenshots/composition-mobile.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const { appCss, icons, version } = loadObsidianAssets();
const { outputFiles } = await build({
	entryPoints: [path.join(root, "scripts/store-screenshots/scenes.mjs")], bundle: true,
	write: false, format: "iife", globalName: "storeScenes",
	alias: { obsidian: path.join(root, "scripts/user-guide/obsidian-runtime.ts") },
});
// Host-window geometry only; controls keep their production phone CSS.
const layout = `
body { margin:0; padding:0; overflow:hidden; background:var(--background-primary); }
*, *::before, *::after { animation:none!important; transition:none!important; caret-color:transparent!important; }
.guide-settings { width:430px; height:684px; padding:16px; background:var(--settings-background); overflow:auto; }
.modal-container { position:static; padding:0; height:auto; min-height:0; }
.modal-bg { display:none; }
.is-phone .modal { position:relative; top:auto; margin:0; max-height:684px; min-height:0; }
.modal-content { min-height:0; }
.guide-note { width:430px; height:684px; min-height:0; padding:20px; background:var(--background-primary); }
.guide-note .markdown-rendered { padding:0; }
`;
const output = path.join(root, "assets/store-screenshots/mobile");
mkdirSync(path.join(output, "svg"), { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: process.env.BROWSER_EXECUTABLE });
try {
	const names = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(captions);
	for (const name of names) {
		assert.ok(name in captions, `Unknown scene: ${name}`);
		const page = await browser.newPage({ viewport: { width: 430, height: 684 }, colorScheme: "dark", isMobile: true, hasTouch: true });
		const network = [], errors = [];
		await page.route("**/*", route => { network.push(route.request().url()); return route.abort(); });
		page.on("pageerror", error => errors.push(error.message));
		await page.setContent('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body class="theme-dark is-mobile is-phone"></body></html>');
		await page.addStyleTag({ content: appCss });
		await page.addStyleTag({ content: readFileSync(path.join(root, "styles.css"), "utf8") });
		await page.addStyleTag({ content: layout });
		await page.evaluate(({ icons, version }) => {
			globalThis.__CS_GUIDE_ICONS__ = icons;
			globalThis.__CS_GUIDE_OBSIDIAN_VERSION__ = version;
		}, { icons, version });
		await page.addScriptTag({ content: outputFiles[0].text });
		const metadata = await page.evaluate(name => storeScenes.mountScene(name, { mobile: true }), name);
		if (name === "03-create") await page.evaluate(() => {
			// Show the beginning of the form; the preview continues below the viewport.
			document.querySelector(".modal-content").scrollTop = 0;
		});
		if (name === "04-icons") await page.evaluate(() => {
			// Scroll to a complete grid row below the native sticky search toolbar.
			const host = document.querySelector(".icon-picker-content");
			const toolbar = host.querySelector(".icon-picker-toolbar");
			const cells = [...host.querySelectorAll(".icon-picker-cell")];
			const edge = toolbar.getBoundingClientRect().bottom;
			const row = cells.find(cell => cell.getBoundingClientRect().top >= edge);
			if (row) host.scrollTop += row.getBoundingClientRect().top - edge;
		});
		const geometry = await page.evaluate(selector => {
			const node = document.querySelector(selector), r = node.getBoundingClientRect();
			return { width: r.width, height: r.height, scrollHeight: node.scrollHeight, scrollWidth: node.scrollWidth };
		}, metadata.selector);
		assert.ok(geometry.scrollWidth <= geometry.width + 1, `${name}: horizontal overflow`);
		if (name === "02-notes") assert.ok(geometry.scrollHeight > geometry.height, `${name}: note must continue below the screen`);
		const source = await exportSvg(page, metadata.selector, { ...metadata, padding: 0, background: "transparent" });
		const svg = composeMobile(name, source, { ...metadata, geometry });
		await page.evaluate(svg => {
			const doc = new DOMParser().parseFromString(svg, "image/svg+xml");
			if (doc.querySelector("parsererror")) throw new Error("Malformed SVG");
			if (doc.documentElement.getAttribute("viewBox") !== "0 0 900 1600") throw new Error("Wrong canvas size");
			if (doc.querySelector("image, foreignObject, script")) throw new Error("SVG must be vector only");
			const ids = [...doc.querySelectorAll("[id]")].map(el => el.id);
			if (new Set(ids).size !== ids.length) throw new Error("Duplicate SVG IDs");
			for (const match of svg.matchAll(/url\(#([^)]+)\)/g)) if (!ids.includes(match[1])) throw new Error(`Missing local definition: ${match[1]}`);
			for (const element of doc.querySelectorAll("*")) for (const attr of element.attributes) {
				if (/^on/i.test(attr.name) || /href$/i.test(attr.name) && !attr.value.startsWith("#") || /url\(\s*["']?(?!#)/i.test(attr.value)) throw new Error("Active or external content");
			}
			if (/\b(?:NaN|Infinity)\b/.test(svg)) throw new Error("Invalid geometry");
		}, svg);
		assert.deepEqual(network, [], `${name}: attempted network request`);
		assert.deepEqual(errors, [], `${name}: browser errors`);
		writeFileSync(path.join(output, "svg", `${name}.svg`), svg);
		console.log(`${name}: ${Math.round(Buffer.byteLength(svg) / 1024)} KiB; phone UI ${geometry.width} × ${geometry.height}; scroll ${geometry.scrollHeight}`);
		await page.close();
	}
} finally { await browser.close(); }
