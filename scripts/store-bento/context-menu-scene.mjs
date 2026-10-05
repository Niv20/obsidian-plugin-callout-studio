/** The production block-callout context menu over the storefront's saved Idea. */
import { installDomHelpers, Menu } from "obsidian";
import { addItems } from "../../src/editor/contextmenu/items.ts";
import { setLocale } from "../../src/i18n/index.ts";
import { getAllColorPalettes } from "../../src/utils/colorPalettes.ts";
import { makeHost, mountNote, seedExample } from "../user-guide/fixture-host.mjs";

export async function mountContextMenu() {
	installDomHelpers();
	setLocale("en");
	document.body.className = "theme-dark is-desktop";
	const plugin = makeHost();
	const palette = getAllColorPalettes().find(item => item.id === "violet");
	if (!palette) throw new Error("Missing storefront Idea's Violet palette");
	seedExample(plugin, {
		id: "idea", displayName: "Idea", aliases: ["spark"],
		icon: { type: "lucide", value: "lightbulb" }, paletteId: palette.id,
		colorLight: palette.colorLight, colorDark: palette.colorDark,
		bgColorLight: palette.bgColorLight, bgColorDark: palette.bgColorDark,
	});
	const markdown = "> [!idea]+ Idea\n> Give your ideas room to grow. Keep the next steps together.";
	const metadata = await mountNote(plugin, markdown, {
		title: "Right-click an Idea block callout",
		description: "The production reading processor and CSS render the same saved Violet Idea with lightbulb icon used throughout the store screenshots. The real addItems function assembles five actions for its initially expanded block callout. Installed Obsidian CSS supplies the native menu shell, captured entirely offline with synthetic content.",
	});
	const panel = document.querySelector(metadata.selector);
	const targetEl = panel.querySelector('.callout[data-callout="idea"]');
	if (!targetEl) throw new Error("Context menu scene requires a rendered Idea block");
	const editor = { getLine: () => markdown.split("\n")[0], lineCount: () => 2 };
	const menu = new Menu();
	addItems(plugin, menu, {
		id: "idea", role: "regular", editor, view: null, surface: "reading", targetEl,
		callout: { id: "idea", headerLine: 0, prefix: "> ", quoteDepth: 1 },
	});
	const rect = targetEl.getBoundingClientRect();
	menu.showAtPosition({ x: rect.left + rect.width * 0.49, y: rect.top + 46 });
	const menuEl = document.querySelector(".menu");
	if (!menuEl) throw new Error("Documentation host must provide the native menu DOM");
	panel.style.position = "relative";
	panel.appendChild(menuEl);
	menuEl.style.position = "absolute";
	menuEl.style.left = "380px";
	menuEl.style.top = "125px";
	const panelRect = panel.getBoundingClientRect();
	const topGap = targetEl.getBoundingClientRect().top - panelRect.top;
	panel.style.boxSizing = "border-box";
	panel.style.height = `${menuEl.getBoundingClientRect().bottom - panelRect.top + topGap}px`;
	await document.fonts.ready;
	await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
	return metadata;
}
