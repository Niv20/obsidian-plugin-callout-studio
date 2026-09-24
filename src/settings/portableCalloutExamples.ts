import { t } from "../i18n";

type Example = readonly [before: string, after: string];

/** Syntax is literal text; the tables never render note content as Markdown. */
function table(container: HTMLElement, title: string, examples: readonly Example[]): void {
	const section = container.createDiv({ cls: "cs-portable-rules" });
	section.createEl("h3", { text: title });
	const grid = section.createEl("table");
	const head = grid.createEl("thead").createEl("tr");
	head.createEl("th", { text: t("portable.before"), attr: { scope: "col" } });
	head.createEl("th", { text: t("portable.after"), attr: { scope: "col" } });
	const body = grid.createEl("tbody");
	for (const [before, after] of examples) {
		const row = body.createEl("tr");
		row.createEl("td").createEl("code", { text: before, attr: { dir: "ltr" } });
		row.createEl("td").createEl("code", { text: after, attr: { dir: "ltr" } });
	}
}

export function renderPortableRules(container: HTMLElement): void {
	const word = t("portable.word"), type = t("portable.type"), text = t("portable.text");
	const title = t("portable.headingText");
	table(container, t("portable.headingsTable"), [
		[`# [!${type}]`, `# ${type}`],
		[`# [!${type}] ${title}`, `# ${title}`],
	]);
	table(container, t("portable.inlineTable"), [
		[`${word} [!${type}] ${word}`, `${word} ${type} ${word}`],
		[`${word} [!${type}]{${text}} ${word}`, `${word} ${text} ${word}`],
	]);
}
