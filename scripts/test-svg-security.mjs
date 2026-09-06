/** Real DOM/CSS regression tests; use an existing Playwright installation. */
import { build } from "esbuild";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const { outputFiles } = await build({
	entryPoints: [path.join(root, "tests/browser/svgSecurity.ts")],
	bundle: true, write: false, format: "iife", globalName: "svgSecurityTests",
	alias: { obsidian: path.join(root, "tests/support/obsidianStub.ts") },
});
const browser = await chromium.launch({ headless: true });
try {
	const page = await browser.newPage();
	const requests = [];
	await page.route("**/*", route => { requests.push(route.request().url()); return route.abort(); });
	await page.setContent("<!doctype html><html><body></body></html>");
	await page.addScriptTag({ content: outputFiles[0].text });
	const count = await page.evaluate(() => svgSecurityTests.runSvgSecurityTests());
	await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
	if (requests.length) throw new Error(`Unexpected network requests: ${requests.join(", ")}`);
	console.log(`SVG browser security: ${count} checks passed; no network requests.`);
} finally {
	await browser.close();
}
