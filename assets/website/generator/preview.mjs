// Review helper: rasterize SVGs as <img> the way the website shows them.
// usage: [SCALE=2] node preview.mjs out.png in.svg [out2.png in2.svg ...]
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import fs from "node:fs";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const args = process.argv.slice(2);
const pairs = [];
const scale = Number(process.env.SCALE || 1);
for (let i = 0; i < args.length; i += 2) pairs.push([args[i], args[i + 1]]);
const browser = await chromium.launch({ executablePath: process.env.BROWSER_EXECUTABLE });
for (const [out, inp] of pairs) {
  const svg = fs.readFileSync(inp, "utf8");
  const m = svg.match(/<svg[^>]*?viewBox="([\d.\s-]+)"/);
  const [, , w, h] = m[1].trim().split(/\s+/).map(Number);
  const maxW = Number(process.env.MAXW || 0);
  const s = maxW && w * scale > maxW ? maxW / w : scale;
  const page = await browser.newPage({ viewport: { width: Math.ceil(w), height: Math.ceil(h) }, deviceScaleFactor: s });
  await page.setContent(`<!doctype html><html><body style="margin:0;background:#fff"><img src="data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}" style="display:block;width:${w}px;height:${h}px"></body></html>`);
  await page.waitForFunction(() => document.images[0]?.complete);
  await page.screenshot({ path: out, clip: { x: 0, y: 0, width: w, height: h } });
  await page.close();
}
await browser.close();
