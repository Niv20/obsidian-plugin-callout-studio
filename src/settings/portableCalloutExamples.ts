import { t } from "../i18n";

type Example = readonly [before: string, after: string];

/** One comparison table; examples stay literal text rather than rendered Markdown. */
export function renderPortableRules(container: HTMLElement): void {
	const word = t("portable.word"), type = t("portable.type"), text = t("portable.text");
	const title = t("portable.headingText");
	const examples: readonly Example[] = [
		[`# [!${type}]`, `# ${type}`],
		[`# [!${type}] ${title}`, `# ${title}`],
		[`${word} [!${type}] ${word}`, `${word} ${type} ${word}`],
		[`${word} [!${type}]{${text}} ${word}`, `${word} ${text} ${word}`],
	];
	const section = container.createDiv({ cls: "cs-portable-rules" });
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
