/**
 * manager/theme/themeReportChecks.ts — turning the facts about a theme into
 * things to actually try.
 *
 * A decision tree, not a judgement. Every line it emits is entailed by a
 * column of `ThemeReport`, which is the only reason 257 generated rows are
 * worth reading: a tester who spots one wrong instruction stops trusting all
 * of them, so nothing here may guess. Where the honest answer is "a static
 * scan cannot tell you" — Style Settings, layout, cascade outcomes — it says
 * that instead of inventing an expectation.
 *
 * Split from `themeReport.ts` because the two change for unrelated reasons:
 * a new fact is a parsing problem, a new instruction is a wording one.
 */
import type { ThemeReport } from "./themeReport";

/**
 * Turn the facts into instructions. A decision tree, not a judgement: every
 * line below is entailed by a column, which is what keeps 257 generated rows
 * trustworthy.
 */
export function buildChecks(report: ThemeReport): string[] {
	const checks: string[] = [];

	if (report.involvement === "none") {
		checks.push(
			"Theme has no callout CSS — every callout should look exactly as it does with no theme, and nothing should appear under Callouts from your theme.",
		);
		return checks;
	}

	if (report.addedIds.length > 0) {
		// One id is quoted through the rest of this branch so the tester has
		// something to type rather than a rule to apply.
		const first = report.addedIds[0] ?? "";
		checks.push(
			`Expect ${String(report.addedIds.length)} type(s) under Callouts from your theme: ${report.addedIds.join(", ")}. Write \`> [!${first}]\` in a note and confirm the theme draws it.`,
		);
		checks.push(
			`Open ${first} with the pencil: expect the read-only preview naming the theme, not the editor — there is no Customize, and no colour or icon on that row is editable. Creating a callout of your own with the ID ${first} should be refused, and say the theme supplies it.`,
		);
		checks.push(
			`Write \`## [!${first}]\` and \`text [!${first}] text\`: both should stay literal text. A theme callout is Block only, so the [! popup should not offer ${first} in either position and the command builder should offer it Block only.`,
		);
		checks.push(
			`Switch to another theme that does not declare these ids and confirm the ${String(report.addedIds.length)} row(s) disappear, your notes are untouched, and re-opening a note that still says \`> [!${first}]\` does not bring the row back. Re-scan vault should.`,
		);
	} else if (report.involvement === "per-id") {
		checks.push(
			"Theme names callout ids but adds none of its own — Callouts from your theme should stay hidden.",
		);
	} else {
		checks.push(
			"Theme styles .callout generically — the built-ins follow it, and Callouts from your theme should stay hidden.",
		);
	}

	if (report.builtInsRestyled > 0) {
		checks.push(
			`Repaints ${String(report.builtInsRestyled)} built-in id(s): expect them under Callouts from your theme rather than Built-in callouts, drawn in the theme's colours. Switch away and confirm each returns wearing whatever you had saved on it.`,
		);
	}
	for (const pattern of report.fuzzy) {
		checks.push(
			`Matches [data-callout${pattern}], so a callout of your own whose id fits that pattern will be captured by the theme. Not listed as a theme type, by design.`,
		);
	}
	if (report.icons === "mask") {
		checks.push(
			"Paints the icon with a CSS mask. The settings rows should reproduce that stencil rather than a placeholder or core's default drawing — compare a row against the callout in a note.",
		);
	}
	if (report.icons === "hidden") {
		checks.push(
			"Hides the callout icon outright. The settings rows should show an empty icon slot, not the dashed placeholder that means the appearance could not be read.",
		);
	}
	if (report.layout.length > 0) {
		checks.push(
			`Changes callout layout (${report.layout.join(", ")}). Callout Studio does not undo layout, so expect the theme's shape to survive.`,
		);
	}
	if (report.contentSensitive) {
		// The one finding that no id-based column can carry: these rules fire
		// on what the callout *contains*, so a tester who writes an empty
		// example callout will not reproduce what their real note does.
		checks.push(
			"Uses :has() on callouts, so the same callout type renders differently depending on what you write inside it. Test with real content, not an empty example.",
		);
	}
	if (report.importantCount > 0) {
		checks.push(
			`Uses !important on ${String(report.importantCount)} callout declaration(s) — make a callout of your own, with an ID this theme does not name, and confirm Callout Studio still wins every property it sets.`,
		);
	}
	if (report.maxClasses >= 6) {
		checks.push(
			`Heaviest callout selector is ${String(report.maxClasses)} class units — the escalation ceiling is 14, so check a callout of your own is not left half-styled.`,
		);
	}
	if (report.styleSettings.length > 0) {
		checks.push(
			`Callout look depends on Style Settings (${report.styleSettings.join(", ")}). Record your setting before judging this row; a static scan cannot see it.`,
		);
	}
	return checks;
}
