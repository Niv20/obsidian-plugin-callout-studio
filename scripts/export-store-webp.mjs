/**
 * Re-export the store images' lossless WebP files from their SVGs: a Chromium
 * screenshot of each SVG at its own size and a device scale of 1, encoded with
 * `cwebp -lossless -z 9`. Only images that already have a `webp/` file are
 * exported; pass names such as `desktop/01-settings` to export a few.
 * See docs/internals-docs/20-build-test-release.md, Store screenshots.
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const store = path.join(root, "assets/store-screenshots");
const requested = process.argv.slice(2);
const targets = ["desktop", "mobile"].flatMap(set => {
	const folder = path.join(store, set, "webp");
	return existsSync(folder) ? readdirSync(folder).filter(file => file.endsWith(".webp")).map(file => `${set}/${file.replace(/\.webp$/, "")}`) : [];
}).filter(name => !requested.length || requested.includes(name));
assert.ok(targets.length, "No store image has a WebP export to refresh");

const scratch = mkdtempSync(path.join(os.tmpdir(), "store-webp-"));
const browser = await chromium.launch({ headless: true, executablePath: process.env.BROWSER_EXECUTABLE });
try {
	for (const name of targets) {
		const [set, image] = name.split("/");
		const svgPath = path.join(store, set, "svg", `${image}.svg`);
		const [, width, height] = /<svg\b[^>]*\bwidth="([\d.]+)"[^>]*\bheight="([\d.]+)"/.exec(readFileSync(svgPath, "utf8")) ?? [];
		assert.ok(width && height, `${name}: the SVG has no width and height`);
		const page = await browser.newPage({ viewport: { width: Number(width), height: Number(height) }, deviceScaleFactor: 1 });
		const requests = [];
		page.on("request", request => { if (!request.url().startsWith("file:")) requests.push(request.url()); });
		await page.goto(pathToFileURL(svgPath).href);
		const png = path.join(scratch, `${set}-${image}.png`);
		await page.screenshot({ path: png });
		await page.close();
		assert.deepEqual(requests, [], `${name}: the SVG attempted network access`);
		const webp = path.join(store, set, "webp", `${image}.webp`);
		execFileSync(process.env.CWEBP || "cwebp", ["-quiet", "-lossless", "-z", "9", png, "-o", webp]);
		const size = statSync(webp).size;
		assert.ok(size < 5 * 1024 * 1024, `${name}: the WebP is over 5 MB`);
		console.log(`${name}.webp: ${width} × ${height}, ${(size / 1024).toFixed(1)} KiB`);
	}
} finally {
	await browser.close();
	rmSync(scratch, { recursive: true, force: true });
}
