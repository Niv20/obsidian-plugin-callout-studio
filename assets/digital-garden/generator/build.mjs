/**
 * Renders assets/digital-garden/screenshot.png, the picture Digital Garden's
 * list of community garden plugins shows for Callout Studio. Run by hand only:
 * no build, test, hook or CI step calls it. See ../README.md.
 *
 *   GARDEN_TEMPLATE=<clone of oleeskild/digitalgarden> PLAYWRIGHT_MODULE=<…/playwright-core> \
 *   node assets/digital-garden/generator/build.mjs
 */
import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadObsidianAssets } from "../../../scripts/user-guide/obsidian-assets.mjs";
import { capturePanels } from "./capture.mjs";
import { frame } from "./frame.mjs";
import { buildGardens, checkTemplate } from "./gardens.mjs";
import { writeGardenNote } from "./note.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../../..");

if (!process.env.GARDEN_TEMPLATE) {
	console.error("Set GARDEN_TEMPLATE to a clone of github.com/oleeskild/digitalgarden with its packages installed. See assets/digital-garden/README.md.");
	process.exit(1);
}
const template = path.resolve(process.env.GARDEN_TEMPLATE);
checkTemplate(template);
const out = path.resolve(process.env.OUT || path.join(here, "..", "screenshot.png"));

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const { icons, glyphs, version } = loadObsidianAssets();
const page = readFileSync(path.join(here, "page.md"), "utf8");
const title = /^title:\s*(.+)$/m.exec(page)?.[1].trim();
if (!title) throw new Error("page.md has no title property");

const work = mkdtempSync(path.join(os.tmpdir(), "cs-garden-screenshot-"));
const browser = await chromium.launch({ headless: true, executablePath: process.env.BROWSER_EXECUTABLE });
try {
	const note = await writeGardenNote(browser, root, { icons, glyphs, version });
	console.log(`Garden note written by the plugin's export: ${note.path} (${Math.round(note.text.length / 1024)} KB, Obsidian ${version} icons)`);
	const dists = await buildGardens({ template, root, page, note, work });
	console.log("Built the page twice: without and with the garden plugin");
	const shot = await capturePanels(browser, dists, { title, icons });
	console.log(`Captured both pages offline (${shot.blocked.length} CDN requests of the template answered with nothing)`);
	// Full colour on purpose: reducing to 256 colours turned Digital Garden's teal block callout grey.
	writeFileSync(out, await frame(browser, shot));
	const shown = out.startsWith(`${root}${path.sep}`) ? path.relative(root, out) : out;
	console.log(`${shown}: ${Math.round(statSync(out).size / 1024)} KB`);
} finally {
	await browser.close();
	if (process.env.KEEP_WORK) console.log(`Work folder kept: ${work}`);
	else rmSync(work, { recursive: true, force: true });
}
