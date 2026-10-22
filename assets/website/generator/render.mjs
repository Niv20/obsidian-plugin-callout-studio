/** Export each website scene as vector SVG parts, using the repo's own exporter. */
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { partsDir } from "./paths.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(here, "../../..");
const repoRequire = createRequire(path.join(REPO, "package.json"));
const { build } = repoRequire("esbuild");
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || "playwright");
const { exportSvg } = await import(path.join(REPO, "scripts/user-guide/vector-exporter.mjs"));
const { loadObsidianAssets } = await import(path.join(REPO, "scripts/user-guide/obsidian-assets.mjs"));
const { appCss, icons, version } = loadObsidianAssets();
const pluginCss = readFileSync(path.join(REPO, "styles.css"), "utf8");

const layoutCss = `
body { margin:0; padding:24px; overflow:hidden; background:var(--background-primary); }
*, *::before, *::after { animation:none!important; transition:none!important; caret-color:transparent!important; }
.modal-container { position:static; padding:0; height:auto; min-height:0; }
.modal-bg { display:none; }
.modal { position:relative; margin:0; max-height:704px!important; }
body[data-store-scene="03-create"] .modal { max-height:780px!important; }
.modal-content { min-height:0; }
.site-note { height:auto!important; min-height:0; overflow:visible; padding:30px 40px 34px; background:var(--background-primary); box-sizing:border-box; }
.site-note .markdown-rendered { padding:0; }
.site-note .inline-title { margin:0 0 0.6em; }
.site-cm .cm-editor { font-family:var(--font-text); font-size:var(--font-text-size); background:transparent; color:var(--text-normal); }
.site-cm .cm-editor.cm-focused { outline:none; }
.site-cm .cm-scroller { overflow:visible; font-family:inherit; line-height:var(--line-height-normal); }
.site-cm .cm-content { padding:0; }
.site-cm .cm-line { padding:0; }
.site-cm .cm-selectionBackground, .site-cm .cm-focused .cm-selectionBackground { background:var(--text-selection)!important; }
.site-cm .cm-cursor { border-left:2px solid var(--text-accent); margin-left:0; }
.site-popover.suggestion-container { position:static; width:320px; max-height:none; margin:8px 0 0 18px; }
.site-note > .site-cm { margin-top:0.9em; }
.site-note > .site-cm.site-table { margin-top:0.6em; }
.site-cover { position:absolute; inset:0; z-index:1; background-color:var(--background-modifier-cover); }
.site-prompt { position:absolute; left:40px; top:20px; width:520px; max-width:none; max-height:none; z-index:2; }
.site-prompt .site-prefix::after { content:none!important; }
body[data-store-scene="03-create"] .modal { width:var(--site-editor-width, 640px); }
.site-workspace { display:flex; width:var(--site-workspace-width, 720px); background:var(--background-primary); overflow:hidden; }
.site-main { flex:1; min-width:0; overflow:hidden; }
.site-main .site-note { width:auto; padding:26px 32px; }
.site-side { flex:none; display:flex; flex-direction:column; background:var(--background-secondary); border-inline-start:1px solid var(--divider-color); }
.site-side-tabs { display:flex; gap:2px; align-items:center; height:40px; padding:0 8px; border-bottom:1px solid var(--divider-color); flex:none; }
.site-side-tabs .clickable-icon { padding:6px; }
.site-side-body { flex:1; min-height:0; overflow:hidden; }
.site-side-body .cs-occurrences-view { height:100%; }
.site-outline { padding:10px 8px; }
`;

const { outputFiles } = await build({
	entryPoints: [path.join(here, "scenes.mjs")], bundle: true, write: false, format: "iife", globalName: "siteScenes",
	alias: { obsidian: path.join(REPO, "scripts/user-guide/obsidian-runtime.ts") },
	nodePaths: [path.join(REPO, "node_modules")], logLevel: "warning",
});
const out = partsDir();
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: process.env.BROWSER_EXECUTABLE });
const failures = [];
try {
	const probe = await browser.newPage();
	await probe.addScriptTag({ content: outputFiles[0].text });
	const available = await probe.evaluate(() => siteScenes.sceneNames);
	await probe.close();
	const names = process.argv.slice(2).length ? process.argv.slice(2) : available;
	for (const name of names) {
		const page = await browser.newPage({ viewport: { width: 1300, height: 1000 }, colorScheme: "dark" });
		try {
			const network = [], errors = [];
			await page.route("**/*", route => { network.push(route.request().url()); return route.abort(); });
			page.on("pageerror", error => errors.push(error.message));
			await page.setContent('<!doctype html><html><head></head><body class="theme-dark is-desktop"></body></html>');
			await page.addStyleTag({ content: appCss });
			await page.addStyleTag({ content: pluginCss });
			await page.addStyleTag({ content: layoutCss });
			await page.evaluate(({ icons, version }) => {
				globalThis.__CS_GUIDE_ICONS__ = icons;
				globalThis.__CS_GUIDE_OBSIDIAN_VERSION__ = version;
			}, { icons, version });
			if (name === "history") await page.clock.setFixedTime(new Date("2026-10-04T10:30:00"));
			await page.addScriptTag({ content: outputFiles[0].text });
			const metadata = await page.evaluate(name => siteScenes.mountScene(name), name);
			// Boxes of interesting parts, relative to the exported root.
			const geometry = await page.evaluate(selector => {
				const root = document.querySelector(selector), b = root.getBoundingClientRect();
				const box = el => { const r = el.getBoundingClientRect(); return [r.x - b.x, r.y - b.y, r.width, r.height].map(v => Math.round(v * 100) / 100); };
				const pick = sel => [...root.querySelectorAll(sel)].map(box);
				return {
					width: b.width, height: b.height, scrollHeight: root.scrollHeight,
					menu: pick(".menu"), callout: pick(".callout"), headings: pick("h1,h2,h3"), prompt: pick(".prompt"),
					popover: pick(".suggestion-container"), modalContent: pick(".modal-content"), title: pick(".inline-title"),
					text: root.innerText.slice(0, 400),
				};
			}, metadata.selector);
			const svg = await exportSvg(page, metadata.selector, { ...metadata, padding: 0, background: "transparent" });
			assert.ok(!/<(?:foreignObject|script|image)\b/i.test(svg), `${name}: vector only`);
			assert.deepEqual(errors, [], `${name}: browser errors`);
			assert.deepEqual(network, [], `${name}: network access`);
			writeFileSync(path.join(out, `${name}.svg`), svg);
			writeFileSync(path.join(out, `${name}.json`), JSON.stringify({ ...metadata, geometry }, null, 1));
			console.log(`${name}: ${Math.round(geometry.width)} × ${Math.round(geometry.height)} (${Math.round(Buffer.byteLength(svg) / 1024)} KiB)`);
		} catch (error) { failures.push(name); console.error(`${name}: ${error.stack || error.message}`); }
		await page.close();
	}
} finally { await browser.close(); }
if (failures.length) { console.error("Failed:", failures.join(", ")); process.exit(1); }
