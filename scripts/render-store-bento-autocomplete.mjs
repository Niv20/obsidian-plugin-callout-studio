/** Capture only image 05's autocomplete component; no network or vault writes. */
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
	entryPoints: [path.join(root, "scripts/store-bento/autocomplete-scene.mjs")],
	bundle: true, write: false, format: "iife", globalName: "bentoAutocomplete",
	alias: { obsidian: path.join(root, "scripts/user-guide/obsidian-runtime.ts") },
});
const layout = `
body { margin:0; padding:20px; overflow:hidden; background:transparent; }
*, *::before, *::after { animation:none!important; transition:none!important; }
#bento-autocomplete { width:233px; background:transparent; }
#bento-autocomplete .cm-editor { font-family:var(--font-monospace); font-size:21px; background:transparent; outline:none; }
#bento-autocomplete .cm-content { padding:12px 10px; }
#bento-autocomplete .cm-line { padding:0; }
#bento-autocomplete .cm-cursor { border-left-color:var(--text-accent); }
#bento-autocomplete .suggestion-container { position:static; width:233px; max-height:none; margin:8px 0 0; }
#bento-autocomplete .suggestion { overflow-y:auto; }
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
	const metadata = await page.evaluate(() => bentoAutocomplete.mountAutocomplete());
	assert.deepEqual(metadata.visibleNames, ["Failure", "Idea", "Info", "Meeting", "Question", "Quote", "Tip"]);
	const geometry = await page.locator(metadata.selector).boundingBox();
	assert.equal(geometry.width, 233);
	assert.ok(geometry.height <= 420, `Component is too tall: ${geometry.height}`);
	const svg = await exportSvg(page, metadata.selector, { ...metadata, padding: 0, background: "transparent" });
	assert.ok(!/<(?:image|script|foreignObject)\b/.test(svg));
	assert.ok(svg.includes("Idea") && svg.includes("Info") && svg.includes("Meeting"));
	await page.evaluate(svg => {
		const document = new DOMParser().parseFromString(svg, "image/svg+xml");
		if (document.querySelector("parsererror")) throw new Error("Malformed exported SVG");
		if (document.documentElement.getAttribute("viewBox") !== "0 0 233 406") throw new Error("Unexpected SVG geometry");
	}, svg);
	const output = path.join(root, "assets/store-screenshots/desktop/components");
	mkdirSync(output, { recursive: true });
	writeFileSync(path.join(output, "05-autocomplete.svg"), svg);
	const completed = await page.evaluate(() => globalThis.__BENTO_AUTOCOMPLETE_VERIFY__());
	assert.equal(completed.text, "> [!idea]+ Idea\n> ");
	assert.equal(completed.cursor, completed.text.length);
	await page.setContent(`<!doctype html><html><style>body{margin:0;background:transparent}svg{display:block}</style><body>${svg}</body></html>`);
	await page.locator("body > svg").screenshot({ path: "/private/tmp/bento-autocomplete-review.png", omitBackground: true });
	assert.deepEqual(network, [], "The capture attempted a network request");
	assert.deepEqual(errors, [], "Browser errors during component capture");
	console.log(JSON.stringify({ output: "05-autocomplete.svg", width: geometry.width, height: geometry.height, names: metadata.names, completed: completed.text, preview: "/private/tmp/bento-autocomplete-review.png" }));
} finally {
	await browser.close();
}
