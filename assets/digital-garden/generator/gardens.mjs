/**
 * Builds the same page twice from a Digital Garden template: once as Digital
 * Garden draws it on its own, once with the Callout Studio garden plugin (built
 * from this repository, as `npm run garden:build` builds it) and the note the
 * plugin's export wrote. Each build is a copy of the template in the work
 * folder; the template itself is only read.
 */
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readFileSync, symlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import { buildGardenPlugin } from "../../../scripts/lib/gardenPlugin.mjs";

/** Not copied: packages are linked instead, and an installed Callout Studio would spoil "without". */
const SKIPPED = ["node_modules", ".git", "dist", "src/plugins/callout-studio"];

const NEEDED = [".eleventy.js", "src/helpers/pluginLoader.js", "src/site/notes", "node_modules/.bin/eleventy", "node_modules/.bin/sass"];

export function checkTemplate(template) {
	const missing = NEEDED.filter((name) => !existsSync(path.join(template, name)));
	if (missing.length > 0) {
		throw new Error(
			`${template} is not a Digital Garden template with its packages installed (missing: ${missing.join(", ")}). See assets/digital-garden/README.md.`,
		);
	}
}

/**
 * The note as the Digital Garden plugin publishes it: its properties folded
 * into one line of JSON, the note's own ones under `dg-note-properties`.
 */
function published(note) {
	const end = note.text.indexOf("\n---\n", 4);
	if (!note.text.startsWith("---\n") || end < 0) throw new Error("The garden note has no properties");
	const front = {
		"dg-publish": true,
		permalink: `/${note.path.replace(/\.md$/, "")}/`,
		"dg-note-properties": { "callout-studio-web": 1 },
	};
	return `---\n${JSON.stringify(front)}\n---\n${note.text.slice(end + 5)}`;
}

function run(cwd, bin, args) {
	const result = spawnSync(path.join(cwd, "node_modules/.bin", bin), args, {
		cwd,
		encoding: "utf8",
		env: { ...process.env, ELEVENTY_ENV: "prod", BASE_THEME: "light" },
	});
	const log = `${result.stdout ?? ""}${result.stderr ?? ""}`;
	if (result.status !== 0) throw new Error(`${bin} failed in ${cwd}:\n${result.error ?? ""}${log}`);
	return log;
}

/** Builds both sites in `work` and returns their `dist` folders by name. */
export async function buildGardens({ template, root, page, note, work }) {
	const plugin = await buildGardenPlugin(root);
	const dists = {};
	for (const variant of ["without", "with"]) {
		const site = path.join(work, variant);
		cpSync(template, site, {
			recursive: true,
			filter: (source) => {
				const relative = path.relative(template, source).split(path.sep).join("/");
				return !SKIPPED.some((skip) => relative === skip || relative.startsWith(`${skip}/`));
			},
		});
		symlinkSync(path.join(template, "node_modules"), path.join(site, "node_modules"), "dir");
		const notes = path.join(site, "src/site/notes");
		writeFileSync(path.join(notes, "the-three-callout-types.md"), page);
		if (variant === "with") {
			const folder = path.join(site, "src/plugins/callout-studio");
			mkdirSync(folder, { recursive: true });
			for (const [name, text] of Object.entries(plugin)) writeFileSync(path.join(folder, name), text, "utf8");
			writeFileSync(path.join(notes, note.path), published(note));
		}

		const log = run(site, "eleventy", []) + run(site, "sass", ["src/site/styles:dist/styles", "--style", "compressed"]);
		// The garden plugin never fails a build; it says what went wrong in its log line instead.
		const complaints = log.split("\n").filter((line) => line.includes("[Callout Studio]") || (line.includes("[plugins]") && line.includes("callout-studio")));
		if (complaints.length > 0) throw new Error(`The "${variant}" garden build reported:\n${complaints.join("\n")}`);

		const html = readFileSync(path.join(site, "dist/index.html"), "utf8");
		const drawn = html.includes("cs-heading-callout");
		if (drawn !== (variant === "with")) throw new Error(`The "${variant}" page ${drawn ? "has" : "lacks"} Callout Studio's heading callouts`);
		dists[variant] = path.join(site, "dist");
	}
	return dists;
}
