/**
 * Optional real-browser regression for recovery table clipping and sticky heads.
 * Supply OBSIDIAN_APP_CSS and an installed PLAYWRIGHT_MODULE. Optional:
 * BROWSER_EXECUTABLE, RECOVERY_BASELINE_CSS, RECOVERY_CANDIDATE_CSS, RECOVERY_SCREENSHOTS.
 * The comparison baseline is external to the repo; no old clipping CSS is shipped.
 */
import assert from "node:assert/strict";
import { readFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
if (!process.env.OBSIDIAN_APP_CSS) throw new Error("Set OBSIDIAN_APP_CSS to a local Obsidian app.css.");
const appCss = readFileSync(process.env.OBSIDIAN_APP_CSS, "utf8");
const candidate = readFileSync(process.env.RECOVERY_CANDIDATE_CSS || path.join(root, "styles.css"), "utf8");
const baseline = process.env.RECOVERY_BASELINE_CSS && readFileSync(process.env.RECOVERY_BASELINE_CSS, "utf8");
if (baseline === candidate) throw new Error("Baseline and candidate CSS are identical; choose the original stylesheet or omit the baseline.");
const screenshots = process.env.RECOVERY_SCREENSHOTS;
if (screenshots) mkdirSync(screenshots, { recursive: true });
const { outputFiles } = await build({
	entryPoints: [path.join(root, "tests/browser/recoveryTableCorners.ts")],
	tsconfig: path.join(root, "scripts/tsconfig.json"),
	bundle: true, write: false, format: "iife", globalName: "recoveryTableTests",
	alias: { obsidian: path.join(root, "tests/support/obsidianStub.ts") },
});
const browser = await chromium.launch({ headless: true, executablePath: process.env.BROWSER_EXECUTABLE });
let states = 0;
let cornerChanges = 0;
try {
	for (const width of [1000, 390]) for (const direction of ["ltr", "rtl"]) for (const mode of ["light", "dark"]) {
		const context = await browser.newContext({ viewport: { width, height: 720 }, hasTouch: width < 600 });
		const page = await context.newPage();
		await context.route("**/*", route => route.abort());
		const revisions = baseline ? [["baseline", baseline], ["candidate", candidate]] : [["candidate", candidate]];
		const results = [];
		for (const [revision, css] of revisions) {
			await page.setContent(`<!doctype html><html dir="${direction}"><head></head><body class="theme-${mode} ${direction === "rtl" ? "mod-rtl" : ""} ${width < 600 ? "is-mobile is-phone" : "is-desktop"}"></body></html>`);
			await page.addStyleTag({ content: appCss });
			await page.addStyleTag({ content: css });
			await page.addStyleTag({ content: ".modal.cs-recovery-details-modal{width:calc(100vw - 48px);height:600px;max-height:calc(100vh - 48px)}*,*::before,*::after{animation:none!important;transition:none!important}" });
			await page.addScriptTag({ content: outputFiles[0].text });
			await page.evaluate(() => recoveryTableTests.mountRecoveryTableFixture());
			const observations = [];
			const snapshot = section => page.evaluate(section => recoveryTableTests.recoveryTableSnapshot(section), section);
			const capture = async (section, state) => {
				const value = await snapshot(section);
				observations.push(value);
				if (screenshots) await page.screenshot({ path: path.join(screenshots, `${width}-${direction}-${mode}-${section}-${state}-${revision}.png`) });
				states++;
				return value;
			};
			for (const section of ["summary", "fields", "title-only"]) {
				for (const position of ["top", "middle", "bottom", "end"]) {
					await page.evaluate(({ section, position }) => recoveryTableTests.scrollRecoveryTable(section, position), { section, position });
					await page.evaluate(() => new Promise(requestAnimationFrame));
					const value = await capture(section, position);
					if (position === "middle") {
						assert.ok(Math.abs(value.head[1] - value.scroller[1]) <= 1, `${width}/${direction}/${mode}: header stopped sticking`);
						assert.equal(value.center.toggle, true, "Pinned section toggle cannot be clicked");
					}
					if (position === "end") assert.ok(value.head[1] < value.scroller[1] - 1, "Header never releases at the table end");
				}
				await page.evaluate(section => recoveryTableTests.scrollRecoveryTable(section, "middle"), section);
				const toggle = page.locator(`[data-recovery-section="${section}"] .cs-recovery-section-toggle`);
				await toggle.click();
				const collapsed = await capture(section, "collapsed");
				assert.equal(collapsed.expanded, "false");
				assert.ok(collapsed.table[3] < 100, "Collapsed table still reserves its rows");
				await toggle.focus();
				await page.keyboard.press("Space");
				const reopened = await capture(section, "keyboard-reopened");
				assert.equal(reopened.expanded, "true");
				assert.equal(reopened.focus, true);
				assert.equal(reopened.outline, "solid", "Keyboard outline disappeared");
				const preview = page.locator(`[data-recovery-section="${section}"] .cs-recovery-preview-fold`).first();
				await preview.click();
				assert.equal(await preview.getAttribute("aria-expanded"), "false", "Contained preview cannot fold");
				await preview.click();
				assert.equal(await preview.getAttribute("aria-expanded"), "true", "Contained preview cannot reopen");
			}
			results.push(observations);
		}
		if (baseline) {
			// A paint mask can retain the rectangular hit area in transparent
			// corner pixels. Report that separately from lost controls or layout.
			for (let index = 0; index < results[0].length; index++) {
				const { corners: oldCorners, ...oldLayout } = results[0][index];
				const { corners: newCorners, ...newLayout } = results[1][index];
				if (JSON.stringify(newCorners) !== JSON.stringify(oldCorners)) cornerChanges++;
				assert.deepEqual(newLayout, oldLayout, `${width}/${direction}/${mode}, state ${index}: baseline layout or control coverage changed`);
			}
		}
		await context.close();
	}
	console.log(`Recovery table browser regression: ${states} states passed, including sticky release, pointer/keyboard folding and preview controls.`);
	if (baseline) console.log(`Transparent header-corner hit testing differs in ${cornerChanges} compared states; core control hit targets are unchanged.`);
} finally {
	await browser.close();
}
