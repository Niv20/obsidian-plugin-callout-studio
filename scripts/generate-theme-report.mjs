/**
 * scripts/generate-theme-report.mjs — write the theme-compatibility worksheet
 * into the vault.
 *
 * `npm run themes:report`. Reads every installed theme's `theme.css`, runs it
 * through the plugin's own callout scanner, and writes one Markdown note the
 * user can open in Obsidian and tick through.
 *
 * All the logic lives in `src/manager/theme/themeReport.ts` and its renderer,
 * imported here through `jiti` — the same arrangement
 * `generate-icon-packs.mjs` uses to reach `icons/data/codec.ts`. This file is
 * only I/O: find the vault, read the themes, write the note.
 *
 * Unlike `icons:generate` and `i18n:generate` this is **not** wired into the
 * build. Its output goes into the user's vault, not the repo, and it depends
 * on which themes happen to be installed — so it is a thing you run when you
 * are about to test, not a build artifact.
 */
import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL(".", import.meta.url)), "..");

/**
 * The repo lives at `<vault>/.obsidian/plugins/<id>`, so the vault is three
 * levels up. Overridable by argument for a checkout that is not inside a
 * vault — which is every CI run, and the reason this script is not a gate.
 */
const vault = resolve(process.argv[2] ?? join(root, "..", "..", ".."));
const configDir = join(vault, ".obsidian");
const themesDir = join(configDir, "themes");
const outFile = join(vault, "Callout Studio — theme compatibility.md");

function readJson(path) {
	try {
		return JSON.parse(readFileSync(path, "utf8"));
	} catch {
		return null;
	}
}

function readThemes() {
	let entries;
	try {
		entries = readdirSync(themesDir);
	} catch {
		throw new Error(
			`No themes directory at ${themesDir}. Pass the vault path as an argument.`,
		);
	}
	const themes = [];
	for (const entry of entries) {
		const dir = join(themesDir, entry);
		if (!statSync(dir).isDirectory()) continue;
		let css;
		try {
			css = readFileSync(join(dir, "theme.css"), "utf8");
		} catch {
			// A theme folder with no stylesheet is a broken install, not a
			// theme with no callout CSS. Skipping it keeps the counts honest.
			console.warn(`  skipped ${entry}: no theme.css`);
			continue;
		}
		const manifest = readJson(join(dir, "manifest.json")) ?? {};
		themes.push({
			// The folder name is what Obsidian keys on, and in practice the two
			// always agree; the manifest is preferred because it is the field
			// Obsidian actually shows.
			name: typeof manifest.name === "string" ? manifest.name : entry,
			version: typeof manifest.version === "string" ? manifest.version : "",
			author: typeof manifest.author === "string" ? manifest.author : "",
			minAppVersion:
				typeof manifest.minAppVersion === "string"
					? manifest.minAppVersion
					: "",
			css,
		});
	}
	return themes;
}

async function main() {
	const { createJiti } = await import("jiti");
	const jiti = createJiti(import.meta.url);
	const { analyzeTheme } = await jiti.import(
		join(root, "src/manager/theme/themeReport.ts"),
	);
	const { renderThemeReport } = await jiti.import(
		join(root, "src/manager/theme/themeReportMarkdown.ts"),
	);

	const themes = readThemes();
	if (themes.length === 0) throw new Error(`No themes found in ${themesDir}`);

	const appearance = readJson(join(configDir, "appearance.json")) ?? {};
	const activeTheme =
		typeof appearance.cssTheme === "string" && appearance.cssTheme.length > 0
			? appearance.cssTheme
			: null;

	const reports = themes.map((theme) => analyzeTheme(theme));
	const markdown = renderThemeReport(reports, {
		activeTheme,
		themesPath: themesDir,
	});
	writeFileSync(outFile, markdown, "utf8");

	const touching = reports.filter((r) => r.involvement !== "none").length;
	const adding = reports.filter((r) => r.addedIds.length > 0).length;
	console.log(
		`Wrote ${outFile}\n  ${themes.length} themes · ${touching} touch callouts · ${adding} add callout types`,
	);
}

main().catch((error) => {
	console.error(error instanceof Error ? error.message : error);
	process.exit(1);
});
