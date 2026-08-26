/**
 * manager/theme/themeReportMarkdown.ts — the theme matrix as a note.
 *
 * Rendering only; every fact comes from `themeReport.ts`. Kept apart from the
 * analysis because the two change for unrelated reasons — a new column is a
 * layout decision, a new fact is a parsing one — and because the analysis is
 * the half worth unit-testing hardest.
 *
 * ## Shaped for testing, not for browsing
 *
 * The table leads with *Callout CSS*, because that column is what lets a
 * tester dismiss most of the corpus in one pass: over half the themes in a
 * typical vault never mention callouts, and those rows need a glance, not a
 * session. The rows that do need work are then ordered left to right roughly
 * by how much: what the theme adds, what it repaints, how it draws icons,
 * whether it moves boxes around, and how hard it pushes.
 *
 * *What to test* is last of the generated columns because it is the longest,
 * and *Result* and *Notes* ship empty — the document is a worksheet, and a
 * regenerate must not overwrite what a tester wrote. That is the one real
 * hazard of a generated worksheet, so the header says it in the first line
 * a reader meets.
 */
import type { ThemeReport } from "./themeReport";
import { sortThemeReports } from "./themeReport";

/** Longest id list shown inline; the rest go to the detail section below. */
const INLINE_IDS = 4;

/** A cell that cannot break the table, whatever the theme author wrote. */
function cell(text: string): string {
	return text.replace(/\|/g, "\\|").replace(/\n+/g, " ").trim();
}

function code(text: string): string {
	return `\`${text}\``;
}

const INVOLVEMENT_LABEL: Record<ThemeReport["involvement"], string> = {
	none: "None",
	generic: "Generic",
	"per-id": "Per-id",
};

const ICON_LABEL: Record<ThemeReport["icons"], string> = {
	none: "—",
	var: "var",
	mask: "mask",
	hidden: "hidden",
};

function idsCell(report: ThemeReport): string {
	if (report.addedIds.length === 0) return "—";
	const shown = report.addedIds.slice(0, INLINE_IDS).map(code).join(", ");
	const rest = report.addedIds.length - INLINE_IDS;
	return rest > 0 ? `${shown} +${String(rest)} more` : shown;
}

function row(report: ThemeReport): string {
	return [
		report.name,
		INVOLVEMENT_LABEL[report.involvement],
		idsCell(report),
		report.builtInsRestyled === 0 ? "—" : String(report.builtInsRestyled),
		ICON_LABEL[report.icons],
		report.layout.length > 0 ? "yes" : "—",
		report.importantCount === 0 ? "—" : String(report.importantCount),
		report.maxClasses === 0 ? "—" : String(report.maxClasses),
		report.styleSettings.length > 0
			? report.styleSettings.map(code).join(" ")
			: "—",
		report.checks.join(" "),
		"",
		"",
	]
		.map(cell)
		.join(" | ");
}

const HEADERS = [
	"Theme",
	"Callout CSS",
	"Callout types it adds",
	"Built-ins restyled",
	"Icons",
	"Layout",
	"`!important`",
	"Max classes",
	"Style Settings",
	"What to test",
	"Result",
	"Notes",
];

function detailBlock(report: ThemeReport): string {
	const lines = [`### ${report.name}`, ""];
	lines.push(
		`- **Adds:** ${report.addedIds.map(code).join(", ")}`,
		`- **What Callout Studio will list:** the same ${String(report.addedIds.length)} type(s), under *Callouts from your theme*.`,
	);
	if (report.fuzzy.length > 0) {
		lines.push(
			`- **Also matches (not listed, by design):** ${report.fuzzy.map((f) => code(`[data-callout${f}]`)).join(", ")}`,
		);
	}
	if (report.layout.length > 0) {
		lines.push(`- **Layout it sets:** ${report.layout.map(code).join(", ")}`);
	}
	lines.push("", ...report.checks.map((c) => `- [ ] ${c}`), "");
	return lines.join("\n");
}

export interface ThemeReportContext {
	/** The theme active while the report was generated, or null for none. */
	activeTheme: string | null;
	/** Where the themes were read from, for the reader's orientation. */
	themesPath: string;
}

/** Render the whole worksheet. */
export function renderThemeReport(
	reports: ThemeReport[],
	context: ThemeReportContext,
): string {
	const sorted = sortThemeReports(reports);
	const withIds = sorted.filter((r) => r.addedIds.length > 0);
	const touching = sorted.filter((r) => r.involvement !== "none");

	const out: string[] = [];
	out.push(
		"# Callout Studio — theme compatibility",
		"",
		"> [!warning] Generated file",
		"> Regenerate with `npm run themes:report`. Everything except the **Result**",
		"> and **Notes** columns is overwritten each time, so keep long findings in",
		"> the per-theme checklists at the bottom, or in a note of your own.",
		"",
		`Themes read from \`${context.themesPath}\`. Active theme while generating: ${
			context.activeTheme != null && context.activeTheme.length > 0
				? `**${context.activeTheme}**`
				: "_none (Obsidian default)_"
		}.`,
		"",
		`**${String(sorted.length)}** themes installed. **${String(touching.length)}** touch callouts at all; **${String(withIds.length)}** add callout types of their own. The other **${String(sorted.length - touching.length)}** need only a glance.`,
		"",
		"## How the columns are derived",
		"",
		"Every column is read from each theme's real `theme.css`, using the same scanner the plugin itself uses — so **Callout types it adds** is literally the list the settings tab will show, `:not()` exclusions dropped and CSS comments stripped.",
		"",
		"- **Callout CSS** — `None`, `Generic` (styles `.callout` but names no ids), or `Per-id`.",
		"- **Callout types it adds** — ids the theme names that Obsidian does not ship. Matched through `=` and `~=` only; `*=`, `^=` and `$=` describe families, not types, and are listed per theme below instead.",
		"- **Icons** — `var` (`--callout-icon`), `mask` (a CSS mask over the icon, which survives an icon Callout Studio sets), `hidden` (the theme removes it).",
		"- **Layout** — the theme sets `display: grid/flex`, `float`, `position`, a width or a transform on callouts. Callout Studio never undoes layout.",
		"- **`!important` / Max classes** — how hard the theme pushes. Callout Studio escalates its own selector weight up to 14 class units when a theme uses `!important`.",
		"- **Style Settings** — the theme's callout look is decided at runtime, so a static scan cannot predict it. Note your setting before judging the row.",
		"",
		"Three things this file deliberately does not answer: whether an override actually wins (that needs a live cascade), what a Style Settings theme finally looks like, and any theme that builds ids dynamically — `flexcyon` sets `--callout-icon: attr(data-callout)`, so its id space has no end.",
		"",
		"## All themes",
		"",
		`| ${HEADERS.join(" | ")} |`,
		`|${HEADERS.map(() => "---").join("|")}|`,
	);
	for (const report of sorted) out.push(`| ${row(report)} |`);

	out.push(
		"",
		"## Themes that add callout types",
		"",
		"The rows worth a real session, with their full id lists and a tick-box per check.",
		"",
	);
	for (const report of withIds) out.push(detailBlock(report));

	return `${out.join("\n").trimEnd()}\n`;
}
