/** Outline, links, and theme integration use the real plugin decorators. */
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { OutlineDecorator } from "../../src/outline/OutlineDecorator.ts";
import { LinkSuggestDecorator } from "../../src/editor/LinkSuggestDecorator.ts";
import { ThemeAppearanceProbe } from "../../src/manager/theme/ThemeAppearanceProbe.ts";
import { syncThemeOverlayRows } from "../../src/manager/theme/themeOverlayRows.ts";
import { CalloutEditor } from "../../src/settings/CalloutEditor.ts";
import { getAllColorPalettes } from "../../src/utils/colorPalettes.ts";
import { mountNote, mountSettings, renderMarkdown, seedExample, openModal } from "./fixture-host.mjs";

const example = "# Launch plan\n\n## [!tip] Start with a small pilot\n\nKeep the first milestone manageable.\n\n## [!warning] Check the dependencies\n\nReview the remaining risks before expanding the scope.";

async function outline(plugin) {
	const file = plugin.seedNote("Projects/Launch plan.md", example);
	const metadata = await mountNote(plugin, example, {
		title: "Heading callouts in Obsidian's Outline",
		description: "The production reading processor renders Tip and Warning as real headings. OutlineDecorator reads synthetic heading metadata and cleans the native Outline shell, preserving each callout's actual icon and accent. No user note is opened.",
	});
	const panel = document.querySelector(metadata.selector);
	panel.style.width = "1050px"; panel.style.display = "flex"; panel.style.gap = "28px";
	panel.firstElementChild.style.flex = "1";
	const sidebar = panel.createDiv({ cls: "guide-outline outline" });
	sidebar.style.flex = "0 0 280px";
	sidebar.style.alignSelf = "center";
	sidebar.createDiv({ cls: "view-header-title", text: "Outline" });
	const tree = sidebar.createDiv({ cls: "tree-item-children" });
	for (const heading of plugin.app.metadataCache.getFileCache(file).headings) {
		const item = tree.createDiv({ cls: "tree-item" });
		item.style.paddingLeft = `${(heading.level - 1) * 16}px`;
		item.createDiv({ cls: "tree-item-self" }).createDiv({ cls: "tree-item-inner", text: heading.heading.replace(/\[([^\]]+)\]/g, "$1") });
	}
	plugin.app.workspace.getLeavesOfType = type => type === "outline" ? [{ view: { containerEl: sidebar, file } }] : [];
	new OutlineDecorator(plugin).attachAll();
	await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
	if (sidebar.textContent.includes("!tip") || sidebar.textContent.includes("!warning")) throw new Error("Outline decorator did not clean the heading titles");
	return metadata;
}

async function headingLinks(plugin) {
	const panel = document.body.createDiv({ cls: "guide-autocomplete", attr: { id: "guide-scene" } });
	new EditorView({ state: EditorState.create({ doc: "[[#", selection: { anchor: 3 } }), parent: panel });
	const coreSuggest = { renderSuggestion(value, element) {
		const content = element.createDiv({ cls: "suggestion-content" });
		content.createDiv({ cls: "suggestion-title", text: value.heading });
		content.createDiv({ cls: "suggestion-note", text: "Launch plan" });
	} };
	plugin.app.workspace.editorSuggest = { suggests: [coreSuggest] };
	new LinkSuggestDecorator(plugin).install([]);
	const list = panel.createDiv({ cls: "suggestion-container" }).createDiv({ cls: "suggestion" });
	for (const [index, heading] of ["[!tip] Start with a small pilot", "[!warning] Check the dependencies"].entries()) {
		coreSuggest.renderSuggestion({ type: "heading", heading }, list.createDiv({ cls: `suggestion-item${index === 0 ? " is-selected" : ""}` }));
	}
	const content = panel.createDiv({ cls: "markdown-preview-view" }).createDiv({ cls: "markdown-rendered" });
	await renderMarkdown(plugin, content, "## Links in Reading view\n\n[[#[!tip] Start with a small pilot]]\n\n[[#[!warning] Check the dependencies]]");
	if (content.textContent.includes("[!")) throw new Error("Heading references were not processed");
	return { selector: "#guide-scene", title: "Clean heading suggestions and internal links", description: "The production LinkSuggestDecorator wraps a native heading-suggestion shell. Below it, the actual reading processor transforms internal heading links while retaining their original targets. A real CodeMirror editor supplies the typed wikilink prefix." };
}

async function useTheme(plugin) {
	const css = globalThis.__CS_GUIDE_THEME_CSS__;
	if (!css) throw new Error("Theme scene requires the locally installed AnuPpuccin stylesheet");
	document.body.classList.add("ctp-mocha", "anp-callout-sleek");
	const styleEl = [...document.querySelectorAll("style")].find(element => element.textContent === css);
	Object.assign(plugin.app.customCss, { theme: "AnuPpuccin", themes: { AnuPpuccin: { name: "AnuPpuccin", version: "local" } }, styleEl });
	plugin.cssInjector.themeCallouts().invalidate();
	syncThemeOverlayRows(plugin.registry, plugin.cssInjector.themeCallouts().themeDefinedIds());
	const probe = new ThemeAppearanceProbe(plugin.app);
	await probe.ensure(plugin.registry.getAll().filter(def => plugin.registry.themeOwns(def)).flatMap(def => plugin.registry.vaultIdFormsFor(def)), () => {});
	plugin.registry.setThemeAppearances(probe.results());
	plugin.cssInjector.inject(false);
	if (!plugin.registry.getAll().some(def => plugin.registry.themeOwns(def))) throw new Error("The source theme scan found no callout types");
}

async function themeList(plugin) {
	await useTheme(plugin);
	plugin.localState.isExpanded = kind => kind === "theme";
	return mountSettings(plugin, { title: "Callouts from the AnuPpuccin theme", description: "The locally installed AnuPpuccin CSS is loaded in its dark Mocha mode. The plugin's real theme scanner, overlay reconciliation, and appearance probe derive the read-only theme rows; the actual settings controller renders their measured colors and icons." });
}

async function themeLayout(plugin) {
	await useTheme(plugin);
	seedExample(plugin, { id: "project", displayName: "Project", bgColorLight: "rgba(124, 58, 237, 0.16)", bgColorDark: "rgba(167, 139, 250, 0.16)" });
	return mountNote(plugin, "> [!project] Project note\n> Your custom callout follows AnuPpuccin's Sleek layout.\n> The accent and background appear on the title bar.\n\n> [!tip] A theme-controlled Tip\n> The theme keeps control of its own callout colors and layout.", {
		title: "Custom callouts in AnuPpuccin's Sleek layout",
		description: "The real locally installed theme stylesheet supplies Mocha colors and the Sleek callout surface. The production CSSInjector detects that title-bar surface and styles the custom Project callout accordingly; the theme-owned Tip remains under the theme's cascade.",
	});
}

async function themeEditor(plugin) {
	await useTheme(plugin);
	const palette = getAllColorPalettes().find(palette => palette.id === "grape");
	if (!palette) throw new Error("Theme editor scene needs the actual Grape preset");
	seedExample(plugin, { colorLight: palette.colorLight, colorDark: palette.colorDark, bgColorLight: palette.bgColorLight, bgColorDark: palette.bgColorDark, paletteId: palette.id });
	return openModal(new CalloutEditor(plugin, plugin.registry.getReal("project")), { title: "Callout editor with the AnuPpuccin theme", description: "The actual CalloutEditor follows the community theme's controls in dark Mocha mode. Its three live previews use the production reading pipeline and the active theme stylesheet within a bounded scrolling window." });
}

export const scenes = { "heading-outline": outline, "heading-links": headingLinks, "theme-callouts": themeList, "theme-layout": themeLayout, "theme-editor": themeEditor };
