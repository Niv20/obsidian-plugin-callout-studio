/**
 * Runs note-scene.mjs in Chromium and hands back the garden note it wrote.
 * The page is served by a route, never fetched: every other request fails.
 */
import { build } from "esbuild";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { guideRuntimeOptions } from "../../../scripts/user-guide/guideRuntime.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));

/** localhost is a secure context, so `crypto.subtle` exists there; about:blank has none. */
const ORIGIN = "http://localhost/";

export async function writeGardenNote(browser, root, { icons, glyphs, version }) {
	const { outputFiles } = await build({
		entryPoints: [path.join(here, "note-scene.mjs")],
		bundle: true,
		write: false,
		format: "iife",
		globalName: "gardenNoteScene",
		logLevel: "warning",
		...guideRuntimeOptions(root),
	});
	const page = await browser.newPage();
	const network = [];
	try {
		await page.route("**/*", (route) => {
			const url = route.request().url();
			if (url === ORIGIN) {
				return route.fulfill({ contentType: "text/html", body: '<!doctype html><html><head></head><body class="theme-light"></body></html>' });
			}
			network.push(url);
			return route.abort();
		});
		await page.goto(ORIGIN);
		await page.evaluate(
			({ icons, glyphs, version }) => {
				globalThis.__CS_GUIDE_ICONS__ = icons;
				globalThis.__CS_GUIDE_GLYPHS__ = glyphs;
				globalThis.__CS_GUIDE_OBSIDIAN_VERSION__ = version;
			},
			{ icons, glyphs, version },
		);
		await page.addScriptTag({ content: outputFiles[0].text });
		const note = await page.evaluate(() => gardenNoteScene.writeGardenNote());
		if (network.length > 0) throw new Error(`The note scene reached for the network: ${network.join(", ")}`);
		return note;
	} finally {
		await page.close();
	}
}
