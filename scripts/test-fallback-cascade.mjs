/** Real browser cascade regression; use an existing Playwright installation. */
import { build } from "esbuild";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const { outputFiles } = await build({
	entryPoints: [path.join(root, "tests/browser/fallbackCascade.ts")],
	bundle: true, write: false, format: "iife", globalName: "fallbackCascadeTests",
	alias: { obsidian: path.join(root, "tests/support/obsidianStub.ts") },
});
const browser = await chromium.launch({ headless: true });
try {
	const page = await browser.newPage();
	const requests = [];
	await page.route("**/*", route => { requests.push(route.request().url()); return route.abort(); });
	await page.setContent("<!doctype html><html><head></head><body></body></html>");
	await page.addScriptTag({ content: outputFiles[0].text });
	const count = await page.evaluate(() => fallbackCascadeTests.runFallbackCascadeTests());
	if (requests.length) throw new Error(`Unexpected requests: ${requests.join(", ")}`);
	console.log(`Fallback browser cascade: ${count} checks passed; no network requests.`);
} finally {
	await browser.close();
}
