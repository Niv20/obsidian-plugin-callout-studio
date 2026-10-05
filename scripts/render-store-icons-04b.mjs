/** Render the alternate desktop icons composition without replacing 04-icons.svg. */
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { exportSvg } from "./user-guide/vector-exporter.mjs";
import { loadObsidianAssets } from "./user-guide/obsidian-assets.mjs";
import { compose04B } from "./store-screenshots/composition-04b.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const { appCss, icons, version } = loadObsidianAssets();
const { outputFiles } = await build({
	entryPoints: [path.join(root, "scripts/store-screenshots/scenes-04b.mjs")],
	bundle: true, write: false, format: "iife", globalName: "storeIcons04B",
	alias: { obsidian: path.join(root, "scripts/user-guide/obsidian-runtime.ts") },
});
const layout = `
body { margin:0; padding:24px; overflow:hidden; background:var(--background-primary); }
*, *::before, *::after { animation:none!important; transition:none!important; caret-color:transparent!important; }
.modal-container { position:static; padding:0; height:auto; min-height:0; }
.modal-bg { display:none; }
.modal { position:relative; margin:0; max-height:640px!important; }
#guide-picker.modal { height:650px!important; max-height:none!important; }
#guide-picker.modal > .modal-content { max-height:none; }
#guide-libraries.modal { width:470px!important; max-width:470px!important; height:720px!important; max-height:none!important; }
.modal-content { min-height:0; }
`;
const browser = await chromium.launch({ headless: true, executablePath: process.env.BROWSER_EXECUTABLE });
try {
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
	const selectors = await page.evaluate(() => storeIcons04B.mountScene());
	const geometry = await page.evaluate(selectors => {
		const measure = selector => {
			const node = document.querySelector(selector), rect = node.getBoundingClientRect();
			return { width: rect.width, height: rect.height, scrollHeight: node.querySelector(".modal-content").scrollHeight,
				clientHeight: node.querySelector(".modal-content").clientHeight };
		};
		const rows = [...document.querySelectorAll("#guide-libraries .cs-icon-library-row")].map(node => ({
			name: node.querySelector(".callout-studio-row-name")?.textContent,
			meta: node.querySelector(".cs-icon-library-meta")?.textContent,
		}));
		return { picker: measure(selectors.picker), libraries: measure(selectors.libraries), rows };
	}, selectors);
	assert.deepEqual(geometry.rows.map(row => row.name), [
		"Lucide", "Material", "Emoji", "Custom Icons", "Tabler Icons",
		"Font Awesome", "RPG Awesome", "Octicons", "Simple Icons",
	]);
	assert.ok(geometry.libraries.scrollHeight <= geometry.libraries.clientHeight,
		`The library list is clipped: ${geometry.libraries.scrollHeight} > ${geometry.libraries.clientHeight}`);
	const picker = await exportSvg(page, selectors.picker, { padding: 0, background: "transparent" });
	const libraries = await exportSvg(page, selectors.libraries, { padding: 0, background: "transparent" });
	const svg = compose04B(picker, libraries);
	await page.evaluate(svg => {
		const doc = new DOMParser().parseFromString(svg, "image/svg+xml");
		if (doc.querySelector("parsererror")) throw new Error("Malformed SVG");
		if (doc.documentElement.getAttribute("viewBox") !== "0 0 1200 800") throw new Error("Wrong canvas size");
		if (doc.querySelector("image, foreignObject, script")) throw new Error("SVG must be vector only");
		const ids = [...doc.querySelectorAll("[id]")].map(el => el.id);
		if (new Set(ids).size !== ids.length) throw new Error("Duplicate SVG IDs");
		for (const element of doc.querySelectorAll("*")) for (const attr of element.attributes) {
			if (/^on/i.test(attr.name) || /href$/i.test(attr.name) && !attr.value.startsWith("#") ||
				/url\(\s*["']?(?!#)/i.test(attr.value)) throw new Error("Active or external content");
		}
	}, svg);
	assert.deepEqual(network, [], "04B: attempted network request");
	assert.deepEqual(errors, [], "04B: browser errors");
	const output = path.join(root, "assets/store-screenshots/desktop/svg/04B-icons.svg");
	writeFileSync(output, svg);
	console.log(`04B-icons: ${Math.round(Buffer.byteLength(svg) / 1024)} KiB; ` +
		`picker ${geometry.picker.width} × ${geometry.picker.height}; ` +
		`libraries ${geometry.libraries.width} × ${geometry.libraries.height}`);
	console.log(geometry.rows.map(row => `${row.name}: ${row.meta}`).join("\n"));
	await page.close();
} finally { await browser.close(); }
