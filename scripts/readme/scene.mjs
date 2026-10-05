/** A syntax reference and compact example rendered by production Reading view code. */
import { installDomHelpers } from "obsidian";
import { setLocale } from "../../src/i18n/index.ts";
import { getAllColorPalettes } from "../../src/utils/colorPalettes.ts";
import { makeHost, renderMarkdown, seedExample } from "../user-guide/fixture-host.mjs";

export const syntaxRows = [
	["Heading", "## [!note]", "## [!note] A custom heading title"],
	["Inline", "[!note]", "[!note]{A custom inline title}"],
	["Block", "> [!note]", "> [!note] A custom block title"],
];

export const markdown = [
	"## [!idea] Heading callout",
	"",
	"Use an [!idea]{Inline callout} right",
	"inside a sentence.",
	"",
	"> [!idea] Block callout",
	"> Give your ideas room to grow. Keep",
	"> the same icon and colors.",
].join("\n");

const icon = {
	preview: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg>',
	markdown: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="m8 5-6 7 6 7m8-14 6 7-6 7m-2-16-4 20"/></svg>',
};

function panel(parent, label, kind) {
	const card = parent.createDiv({ cls: `readme-card readme-${kind}` });
	const header = card.createDiv({ cls: "readme-card-header" });
	const glyph = header.createSpan({ cls: "readme-header-icon" });
	glyph.innerHTML = icon[kind];
	header.createSpan({ text: label });
	return card;
}

function sourceLine(parent, value) {
	const line = parent.createDiv({ cls: "readme-source-line" });
	// Keep every character of the sample; color only Markdown punctuation/tokens.
	for (const part of value.split(/(\[!(?:idea|note)\]|[{}]|^##|^>)/g)) {
		if (!part) continue;
		line.createSpan({ text: part, cls: /^\[!/.test(part) ? "source-token" : /^(?:##|>|[{}])$/.test(part) ? "source-mark" : "" });
	}
}

function syntaxReference(parent) {
	const card = parent.createDiv({ cls: "readme-card readme-reference" });
	const table = card.createEl("table", { cls: "readme-syntax-table" });
	const header = table.createEl("thead").createEl("tr");
	for (const text of ["Type", "Default content", "Custom content"]) header.createEl("th", { text, attr: { scope: "col" } });
	const body = table.createEl("tbody");
	for (const [type, defaultContent, customContent] of syntaxRows) {
		const row = body.createEl("tr");
		row.createEl("th", { text: type, attr: { scope: "row" } });
		sourceLine(row.createEl("td"), defaultContent);
		sourceLine(row.createEl("td"), customContent);
	}
}

export async function mount() {
	installDomHelpers();
	setLocale("en");
	const plugin = makeHost();
	const palette = getAllColorPalettes().find(item => item.id === "violet");
	if (!palette) throw new Error("The Violet palette is missing");
	seedExample(plugin, {
		id: "idea", displayName: "Idea", icon: { type: "lucide", value: "lightbulb" },
		paletteId: palette.id, colorLight: palette.colorLight, colorDark: palette.colorDark,
		bgColorLight: palette.bgColorLight, bgColorDark: palette.bgColorDark,
	});
	const scene = document.body.createDiv({ attr: { id: "readme-scene" } });
	syntaxReference(scene);
	const example = scene.createDiv({ cls: "readme-example" });
	const preview = panel(example, "Preview", "preview");
	const note = preview.createDiv({ cls: "readme-note markdown-rendered" });
	await renderMarkdown(plugin, note, markdown);
	const source = panel(example, "Markdown", "markdown");
	const rows = [note.querySelector("h2"), note.querySelector(":scope > p"), note.querySelector(".callout")];
	if (rows.some(row => !row)) throw new Error("All three callout formats must render");
	const groups = markdown.split("\n\n");
	let previousGroup;
	for (let index = 0; index < groups.length; index++) {
		const group = source.createDiv({ cls: "readme-source-group" });
		const top = rows[index].getBoundingClientRect().top - preview.getBoundingClientRect().top;
		// Preserve the sample's blank lines even when its rendered paragraph is shorter.
		const blankLine = parseFloat(getComputedStyle(group).lineHeight);
		const minimumTop = previousGroup ? parseFloat(previousGroup.style.top) + previousGroup.getBoundingClientRect().height + blankLine : 0;
		group.style.top = `${Math.max(top + (index === 0 ? 8 : 0), minimumTop)}px`;
		for (const line of groups[index].split("\n")) sourceLine(group, line);
		previousGroup = group;
	}
	await document.fonts.ready;
	await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
	const blocks = [...source.querySelectorAll(".readme-source-group")].map(group => group.innerText);
	if (blocks.join("\n\n") !== markdown) throw new Error("The displayed source differs from the rendered Markdown");
	const reference = [...scene.querySelectorAll("tbody tr")].map(row => [...row.children].map(cell => cell.textContent));
	if (JSON.stringify(reference) !== JSON.stringify(syntaxRows)) throw new Error("The syntax reference differs from its exact snippets");
	if (note.querySelectorAll("h2.cs-heading-callout").length !== 1 || !note.querySelector(".cs-inline-callout") || !note.querySelector('.callout[data-callout="idea"]')) {
		throw new Error("Production callout rendering is missing");
	}
	return {
		selector: "#readme-scene", title: "One callout, three forms",
		description: "A Note syntax reference compares default and custom content for heading, inline, and block callouts. Below, an Idea callout appears in all three forms beside its exact Markdown. Transparent background.",
	};
}
