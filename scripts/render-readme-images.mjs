/** README-only SVGs. Leaves the store artwork and production plugin unchanged. */
import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { loadObsidianAssets } from "./user-guide/obsidian-assets.mjs";
import { exportSvg } from "./user-guide/vector-exporter.mjs";
import { guideRuntimeOptions } from "./user-guide/guideRuntime.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const { appCss, icons, version } = loadObsidianAssets();
const output = path.join(root, "assets/readme");
mkdirSync(output, { recursive: true });
const { outputFiles } = await build({
	entryPoints: [path.join(root, "scripts/readme/scene.mjs")], bundle: true,
	write: false, format: "iife", globalName: "readmeScene",
	...guideRuntimeOptions(root),
});
const layout = `
body { margin:0; background:transparent; }
*, *::before, *::after { animation:none!important; transition:none!important; caret-color:transparent!important; }
#readme-scene { display:flex; flex-direction:column; gap:24px; width:1080px; padding:8px; box-sizing:border-box; background:transparent; }
.readme-example { display:flex; gap:24px; }
.readme-card { position:relative; flex:1; height:384px; min-width:0; overflow:hidden; border:1px solid #40384e; border-radius:16px; background:#1e1e1e; }
.readme-reference { flex:none; height:242px; }
.readme-syntax-table { width:100%; table-layout:fixed; border-spacing:0; border-collapse:separate; color:#d8d4df; font-family:Arial,Helvetica,sans-serif; }
.readme-syntax-table th, .readme-syntax-table td { height:60px; padding:0 26px; text-align:left; vertical-align:middle; border:0; }
.readme-syntax-table thead th { border-bottom:1px solid #40384e; background:#242129; color:#dad4e5; font-size:19px; font-weight:600; }
.readme-syntax-table thead th:first-child { width:18%; }
.readme-syntax-table thead th:nth-child(2) { width:26%; }
.readme-syntax-table tbody th { color:#dad4e5; font-size:20px; font-weight:600; }
.readme-syntax-table tbody tr + tr > * { border-top:1px solid #343039; }
.readme-syntax-table .readme-source-line { font:20px/32px Menlo,Consolas,monospace; }
.readme-card-header { height:62px; padding:0 26px; display:flex; align-items:center; gap:11px; border-bottom:1px solid #343039; color:#dad4e5; font:600 19px/1.4 Arial,Helvetica,sans-serif; }
.readme-header-icon { display:flex; color:#a57bff; }
.readme-note { display:flex; flex-direction:column; gap:28px; padding:30px 26px 26px; font-size:20px; line-height:1.6; }
.readme-note > * { margin:0!important; }
.readme-note h2 { font-size:28px; }
.readme-note .callout { margin:0; }
.readme-note .callout-content p { margin:12px 0 0; line-height:1.6; }
.readme-source-group { position:absolute; left:26px; right:26px; color:#d8d4df; font:18px/32px Menlo,Consolas,monospace; }
.readme-source-line { white-space:pre; }
.source-token { color:#b795ff; }
.source-mark { color:#858092; }
`;

async function validate(page, svg, dimensions) {
	await page.evaluate(({ svg, dimensions }) => {
		const doc = new DOMParser().parseFromString(svg, "image/svg+xml");
		if (doc.querySelector("parsererror")) throw new Error("Malformed SVG");
		const root = doc.documentElement;
		if (root.getAttribute("viewBox") !== `0 0 ${dimensions.join(" ")}`) throw new Error("Wrong canvas size");
		if (doc.querySelector("image,foreignObject,script")) throw new Error("Artwork must be vector only");
		const ids = [...doc.querySelectorAll("[id]")].map(element => element.id);
		if (new Set(ids).size !== ids.length) throw new Error("Duplicate SVG IDs");
		for (const element of doc.querySelectorAll("*")) {
			for (const attr of element.attributes) {
				if (/^on/i.test(attr.name) || /href$/i.test(attr.name) && !attr.value.startsWith("#") || /url\(\s*["']?(?!#)/i.test(attr.value)) throw new Error("External or active content");
				for (const match of attr.value.matchAll(/url\(#([^)]+)\)/g)) if (!doc.getElementById(match[1])) throw new Error("Missing paint reference");
			}
		}
		if (/\b(?:NaN|Infinity)\b/.test(svg)) throw new Error("Invalid geometry");
	}, { svg, dimensions });
}

const browser = await chromium.launch({ headless: true, executablePath: process.env.BROWSER_EXECUTABLE });
try {
	const page = await browser.newPage({ viewport: { width: 1200, height: 850 }, colorScheme: "dark" });
	const network = [], errors = [];
	await page.route("**/*", route => { network.push(route.request().url()); return route.abort(); });
	page.on("pageerror", error => errors.push(error.message));
	await page.setContent('<!doctype html><html><head></head><body class="theme-dark is-desktop"></body></html>');
	const settings = await page.evaluate(svg => {
		const doc = new DOMParser().parseFromString(svg, "image/svg+xml");
		const original = doc.documentElement;
		const frame = [...original.children].find(element => element.localName === "rect" && element.getAttribute("fill") === "#252329");
		if (!frame) throw new Error("The reference settings window is missing");
		const x = Number(frame.getAttribute("x")), y = Number(frame.getAttribute("y"));
		const width = Number(frame.getAttribute("width")), height = Number(frame.getAttribute("height"));
		const nodes = [...original.children].slice([...original.children].indexOf(frame));
		const content = nodes.map(element => new XMLSerializer().serializeToString(element)).join("");
		// The window keeps 8px of transparent margin on every side, and the
		// canvas is as tall as the window comes out.
		const scale = 944 / width, canvasHeight = Math.ceil(height * scale + 16);
		const artwork = `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="${canvasHeight}" viewBox="0 0 960 ${canvasHeight}" role="img" aria-labelledby="title description"><title id="title">Callout Studio settings</title><desc id="description">The My callout types settings page lists Idea, Meeting, and Research with their IDs, color swatches and editing controls. Transparent background; no surrounding workspace.</desc><g transform="translate(8 8) scale(${scale}) translate(${-x} ${-y})">${content}</g></svg>\n`;
		return { svg: artwork, canvasHeight };
	}, readFileSync(path.join(root, "assets/store-screenshots/desktop/svg/01-settings.svg"), "utf8"));
	await validate(page, settings.svg, [960, settings.canvasHeight]);
	writeFileSync(path.join(output, "01-settings.svg"), settings.svg);
	await page.addStyleTag({ content: appCss });
	await page.addStyleTag({ content: readFileSync(path.join(root, "styles.css"), "utf8") });
	await page.addStyleTag({ content: layout });
	await page.evaluate(({ icons, version }) => {
		globalThis.__CS_GUIDE_ICONS__ = icons;
		globalThis.__CS_GUIDE_OBSIDIAN_VERSION__ = version;
	}, { icons, version });
	await page.addScriptTag({ content: outputFiles[0].text });
	const metadata = await page.evaluate(() => readmeScene.mount());
	await page.evaluate(() => {
		for (const line of document.querySelectorAll(".readme-source-line")) {
			if (line.scrollWidth > line.clientWidth) throw new Error("Markdown text overflows its panel");
		}
		const card = document.querySelector(".readme-preview").getBoundingClientRect();
		const callout = document.querySelector(".readme-note .callout").getBoundingClientRect();
		if (callout.bottom > card.bottom - 16) throw new Error("The rendered sample overflows its panel");
	});
	const syntax = await exportSvg(page, metadata.selector, { ...metadata, padding: 0, background: "transparent" });
	await validate(page, syntax, [1080, 666]);
	assert.deepEqual(network, [], "README artwork attempted network access");
	assert.deepEqual(errors, [], "README artwork has browser errors");
	writeFileSync(path.join(output, "02-syntax.svg"), syntax);
	console.log(`README SVGs: settings 960 × ${settings.canvasHeight}; syntax 1080 × 666 (${Math.round(Buffer.byteLength(syntax) / 1024)} KiB)`);
} finally { await browser.close(); }
