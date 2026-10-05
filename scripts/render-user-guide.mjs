/**
 * Render user-guide scenes from source as portable vector SVGs, entirely offline.
 * Requires an existing Playwright installation and locally installed Obsidian.
 * See docs/internals-docs/20-build-test-release.md, User-guide SVG renders.
 */
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { exportSvg } from "./user-guide/vector-exporter.mjs";
import { outlineLanguageText } from "./user-guide/outline-language-text.mjs";
import { loadObsidianAssets } from "./user-guide/obsidian-assets.mjs";
import { verifyScene, verifySvg } from "./user-guide/verify-scene.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const { appCss, icons, version } = loadObsidianAssets();
if (!version) throw new Error("Set OBSIDIAN_VERSION when supplying extracted Obsidian assets");
const pluginCss = readFileSync(path.join(root, "styles.css"), "utf8");
const themePath = process.env.GUIDE_THEME_CSS || path.resolve(root, "../../themes/AnuPpuccin/theme.css");
const themeCss = existsSync(themePath) ? readFileSync(themePath, "utf8").replace(/@import[^;]+;/g, "").replace(/@font-face\s*\{[^}]*\}/g, "") : null;
const layoutCss = `
body { margin:0; padding:32px; overflow:hidden; background:var(--background-primary); }
*, *::before, *::after { animation:none!important; transition:none!important; caret-color:transparent!important; }
.guide-settings { width:850px; padding:32px; background:var(--background-secondary); border-radius:12px; max-height:704px; overflow:auto; }
.modal-container { position:static; padding:0; height:auto; min-height:0; }
.modal-bg { display:none; }
.modal { position:relative; margin:0; max-height:704px!important; }
.modal-content { min-height:0; }
.guide-note { width:800px; height:auto; padding:32px; background:var(--background-primary); border:1px solid var(--background-modifier-border); border-radius:12px; max-height:704px; overflow:auto; }
.guide-note .markdown-rendered { padding:0; }
.guide-outline { width:280px; padding:20px; align-self:flex-start; background:var(--background-secondary); border-radius:8px; }
.guide-outline .tree-item-inner { min-height:24px; }
.guide-language-panels, .guide-saving-panels { width:850px; display:grid; gap:24px; background:var(--background-primary); }
.guide-language-panels > .guide-settings, .guide-saving-panels > .guide-settings { border:1px solid var(--background-modifier-border); }
.guide-saving-panels > .guide-settings { width:100%; }
.guide-saving-panels .cs-readonly-banner { margin:0; }
.guide-autocomplete { width:720px; padding:32px; border:1px solid var(--background-modifier-border); border-radius:12px; background:var(--background-primary); }
.guide-autocomplete .cm-editor { font-family:var(--font-monospace); font-size:20px; background:transparent; }
.guide-autocomplete .cm-content { padding:12px 0; }
.guide-autocomplete .cm-line { padding:0; }
.guide-autocomplete .suggestion-container { position:static; width:390px; margin:8px 0 16px 24px; }
`;
const { outputFiles } = await build({
	entryPoints: [path.join(root, "scripts/user-guide/scenes.mjs")],
	bundle: true, write: false, format: "iife", globalName: "userGuideScenes",
	alias: { obsidian: path.join(root, "scripts/user-guide/obsidian-runtime.ts") },
});
const browser = await chromium.launch({ headless: true, executablePath: process.env.BROWSER_EXECUTABLE });
const output = path.join(root, "assets/user-guide");
mkdirSync(output, { recursive: true });
const requested = process.argv.slice(2), failures = [];
try {
	// Read the exported registry in the browser; it imports production DOM code.
	const index = await browser.newPage();
	await index.addScriptTag({ content: outputFiles[0].text });
	const available = await index.evaluate(() => userGuideScenes.sceneNames);
	await index.close();
	const selected = requested.length ? requested.includes("--all") ? available : requested : available.filter(name => !name.startsWith("create-"));
	for (const name of selected) {
		assert.ok(available.includes(name), `Unknown scene: ${name}`);
		const page = await browser.newPage({ viewport: { width: 1200, height: 820 }, colorScheme: "dark" });
		try {
		const requests = [], errors = [];
		await page.route("**/*", route => { requests.push(route.request().url()); return route.abort(); });
		page.on("pageerror", error => errors.push(error.message));
		await page.setContent('<!doctype html><html><head></head><body class="theme-dark is-desktop"></body></html>');
		await page.addStyleTag({ content: appCss });
		if (name.startsWith("theme-")) {
			assert.ok(themeCss, "AnuPpuccin CSS is required for theme scenes; set GUIDE_THEME_CSS");
			await page.addStyleTag({ content: themeCss });
			await page.evaluate(css => { globalThis.__CS_GUIDE_THEME_CSS__ = css; }, themeCss);
		}
		await page.addStyleTag({ content: pluginCss });
		await page.addStyleTag({ content: layoutCss });
		await page.evaluate(({ artwork, version }) => {
			globalThis.__CS_GUIDE_ICONS__ = artwork;
			globalThis.__CS_GUIDE_OBSIDIAN_VERSION__ = version;
		}, { artwork: icons, version });
		await page.addScriptTag({ content: outputFiles[0].text });
		const metadata = await page.evaluate(scene => userGuideScenes.mountScene(scene), name);
		await page.evaluate(selector => {
			const root = document.querySelector(selector);
			if (root.getBoundingClientRect().height > 704) {
				root.style.maxHeight = "704px"; root.style.overflow = "auto";
			}
		}, metadata.selector);
		await verifyScene(page, name, metadata.selector);
		let svg = await exportSvg(page, metadata.selector, { ...metadata, padding: 24 });
		// Keep non-Latin language names readable in viewers that do not have the
		// system UI fonts used by the browser fixture. rsvg-convert turns only
		// those labels into ordinary local SVG paths; all other text stays live.
		if (name === "language-selector") svg = await outlineLanguageText(page, svg);
		assert.ok(!/<(?:foreignObject|script|image)\b|https?:\/\/(?!www\.w3\.org\/2000\/svg)/i.test(svg), `${name}: SVG must be standalone vector artwork`);
		await verifySvg(page, svg, name);
		assert.deepEqual(errors, [], `${name}: browser errors`);
		assert.deepEqual(requests, [], `${name}: attempted network access`);
		writeFileSync(path.join(output, `${name}.svg`), svg);
		console.log(`Rendered ${name}.svg from plugin source (${Math.round(Buffer.byteLength(svg) / 1024)} KiB)`);
		} catch (error) { failures.push(name); console.error(`${name}: ${error.message}`); }
		await page.close();
	}
} finally {
	await browser.close();
}
assert.deepEqual(failures, [], "Some user-guide scenes failed");
