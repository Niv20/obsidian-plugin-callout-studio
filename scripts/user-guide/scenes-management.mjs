/** Management illustrations: production components, synthetic offline data. */
import { Menu } from "obsidian";
import { CalloutEditor } from "../../src/settings/CalloutEditor.ts";
import { ReplaceCalloutModal } from "../../src/utils/ReplaceCalloutModal.ts";
import { MenuCustomizationModal } from "../../src/settings/MenuCustomizationModal.ts";
import { CommandBuilderModal } from "../../src/settings/CommandBuilderModal.ts";
import { CommandEditorModal } from "../../src/settings/CommandEditorModal.ts";
import { CustomCommandManager } from "../../src/editor/CustomCommandManager.ts";
import { ImportSourceModal } from "../../src/settings/ImportSourceModal.ts";
import { ExportFormatModal } from "../../src/settings/ExportFormatModal.ts";
import { addItems } from "../../src/editor/contextmenu/items.ts";
import { renderLanguageSection } from "../../src/settings/sections/LanguageSection.ts";
import { createCalloutListsController } from "../../src/settings/sections/CalloutListsSection.ts";
import { renderCalloutRow } from "../../src/settings/sections/CalloutRowRenderer.ts";
import { freshPaging } from "../../src/settings/sections/calloutListsSignature.ts";
import { registerLocale, setLocale, t } from "../../src/i18n/index.ts";
import { es } from "../../src/i18n/es.ts";
import { openModal, mountNote, mountSettings, sceneMeta } from "./fixture-host.mjs";

function sectionContext(plugin) {
	return { app: plugin.app, plugin, display() {}, registerDisposer() {} };
}

function ensureProjectNote(plugin) {
	if (!plugin.registry.has("project note")) {
		plugin.registry.add({
			...plugin.registry.getReal("note"),
			id: "project note", displayName: "Project note", aliases: ["project"],
			icon: { type: "lucide", value: "bookmark" },
			colorLight: "#267b70", colorDark: "#57c4b2", builtIn: false, source: "user",
		});
		plugin.cssInjector.inject(false);
	}
	return plugin.registry.getReal("project note");
}

function editCallout(plugin) {
	plugin.registry.update("note", {
		icon: { type: "lucide", value: "bookmark" },
		colorLight: "#08b94e", colorDark: "#44cf6e", paletteId: "green",
	});
	plugin.cssInjector.inject(false);
	return openModal(new CalloutEditor(plugin, plugin.registry.getReal("note")), {
		title: "Edit a customized built-in callout",
		description: "The production CalloutEditor opens the saved Note definition with its modified bookmark icon and green accent. Its real field-reset arrows and Reading view preview show the built-in customization state in a bounded dark-mode window.",
	});
}

function replaceCallout(plugin) {
	const source = ensureProjectNote(plugin);
	const modal = new ReplaceCalloutModal(plugin.app, {
		mode: "replace",
		message: t("vault.replacePromptInUse", { name: source.displayName, count: "8", files: "3" }),
		availableCallouts: plugin.registry.getAll().filter(def => def.id !== source.id),
		registry: plugin.registry,
	});
	const metadata = openModal(modal, {
		title: "Choose a replacement callout",
		description: "The real ReplaceCalloutModal displays an illustrative Project note usage count from synthetic data. Choosing Tip activates the production Replace button; the scene never confirms replacement or edits a note.",
	});
	const input = modal.modalEl.querySelector(".callout-studio-replace-search");
	input.value = "tip";
	input.dispatchEvent(new Event("input", { bubbles: true }));
	const tip = [...modal.modalEl.querySelectorAll(".callout-studio-replace-item")]
		.find(row => row.querySelector(".callout-studio-replace-item-id")?.textContent === "tip");
	if (!tip) throw new Error("Replacement scene needs the real Tip row");
	tip.click();
	return metadata;
}

async function contextMenu(plugin) {
	ensureProjectNote(plugin);
	const markdown = "> [!project note]+ Project note\n> Keep the decisions, next steps, and useful links together.";
	const metadata = await mountNote(plugin, markdown, {
		title: "Right-click a block callout",
		description: "The production reading processor and CSS render Project note. Its context actions are assembled by the plugin's actual addItems function for a regular, initially expanded callout; Obsidian's menu shell positions them beside the rendered note.",
	});
	const panel = document.querySelector(metadata.selector);
	const targetEl = panel.querySelector('.callout[data-callout="project-note"]');
	if (!targetEl) throw new Error("Context menu scene requires a rendered Project note block");
	const editor = { getLine: () => markdown.split("\n")[0], lineCount: () => 2 };
	const menu = new Menu();
	addItems(plugin, menu, {
		id: "project note", role: "regular", editor, view: null, surface: "reading", targetEl,
		callout: { id: "project note", headerLine: 0, prefix: "> ", quoteDepth: 1 },
	});
	const rect = targetEl.getBoundingClientRect();
	menu.showAtPosition({ x: rect.left + rect.width * 0.49, y: rect.top + 46 });
	const menuEl = document.querySelector(".menu");
	if (!menuEl) throw new Error("Documentation Obsidian adapter must provide the native menu DOM");
	// Position the real menu inside the exported note panel, keeping its CSS.
	panel.style.position = "relative";
	panel.appendChild(menuEl);
	menuEl.style.position = "absolute";
	menuEl.style.left = "380px";
	menuEl.style.top = "125px";
	// Balance the frame against the rendered callout instead of reserving an
	// unrelated fixed-height strip beneath the menu.
	const panelRect = panel.getBoundingClientRect();
	const topGap = targetEl.getBoundingClientRect().top - panelRect.top;
	panel.style.boxSizing = "border-box";
	panel.style.height = `${menuEl.getBoundingClientRect().bottom - panelRect.top + topGap}px`;
	return metadata;
}

function contextCustomization(plugin) {
	const headingItems = plugin.settings.contextMenu.items.heading;
	const deletion = headingItems.find(item => item.id === "deleteSection");
	deletion.enabled = false;
	headingItems.splice(headingItems.indexOf(deletion), 1);
	headingItems.push(deletion);
	return openModal(new MenuCustomizationModal(plugin.app, plugin), {
		title: "Customize callout context menus",
		description: "The actual MenuCustomizationModal renders its production toggles and drag handles. Delete section is disabled in the synthetic heading-menu configuration, exposing the disabled band and the real category reset arrow. The dark-mode window scrolls within its height limit.",
	});
}

function commandManager(plugin) {
	ensureProjectNote(plugin);
	plugin.settings.customCommands = [
		{ id: "guide-project", calloutId: "project note", role: "regular", action: "wrap" },
		{ id: "guide-warning", calloutId: "warning", role: "regular", action: "insert", fold: "collapsed" },
	];
	plugin.customCommands = new CustomCommandManager(plugin);
	plugin.settings.disabledFixedCommands = ["callout-unwrap"];
	return openModal(new CommandBuilderModal(plugin.app, plugin), {
		title: "Manage commands and keyboard shortcuts",
		description: "The production CommandBuilderModal reads two example saved commands through the actual CustomCommandManager. Obsidian's fixture reports no assigned hotkeys, so the real shortcut chips read Blank; the built-in command list retains its production toggles and scrolling layout.",
	});
}

/** Commit choices through production control events rather than drawing values. */
function chooseField(modal, name, label) {
	const row = [...modal.modalEl.querySelectorAll(".setting-item")]
		.find(el => el.querySelector(".setting-item-name")?.textContent === name);
	if (!row) throw new Error(`Missing actual command field: ${name}`);
	row.querySelector(".cs-combobox-control").click();
	const option = [...row.querySelectorAll('[role="option"]')]
		.find(el => (el.querySelector(".callout-studio-suggestion-name")?.textContent ?? el.textContent) === label);
	if (!option) throw new Error(`Missing production command choice: ${label}`);
	option.click();
}

function commandEditor(plugin) {
	const modal = new CommandEditorModal(plugin.app, plugin);
	const metadata = openModal(modal, {
		title: "Create a collapsed Warning command",
		description: "The actual new-command editor is driven through its production callout, action, and fold-state dropdowns. It previews a command that wraps selected text in a collapsed Warning block; no command is saved.",
	});
	chooseField(modal, t("commandBuilder.callout"), plugin.registry.get("warning").displayName);
	chooseField(modal, t("commandBuilder.action"), t("commandBuilder.actionWrap"));
	chooseField(modal, t("commandBuilder.foldState"), t("commandBuilder.foldCollapsed"));
	return metadata;
}

function languageSelector(plugin) {
	return mountSettings(plugin, {
		title: "Choose the interface language",
		description: "The production LanguageSection opens its real ListboxPopup containing every supported language under its native name. Only the language settings section is shown; the shorter dark-mode panel crops the scrollable language list after its first options.",
		render(panel, ctx) {
			renderLanguageSection(ctx, panel);
			panel.style.height = "420px";
			panel.querySelector(".cs-language-setting .cs-combobox-control").click();
		},
	});
}

function languageLocalized(plugin) {
	registerLocale("es", es);
	plugin.settings.language = "es";
	setLocale("es");
	const root = document.body.createDiv({ cls: "guide-language-panels", attr: { id: "guide-scene" } });
	const ctx = sectionContext(plugin);
	// These sections live at different positions in the settings tab. Separate
	// frames make them two illustrative crops rather than one continuous page.
	const languagePanel = root.createDiv({ cls: "callout-studio-settings guide-settings" });
	renderLanguageSection(ctx, languagePanel);
	const calloutsPanel = root.createDiv({ cls: "callout-studio-settings guide-settings" });
	createCalloutListsController(ctx, {
		paging: freshPaging(), onAddNewCallout: async () => {},
		renderRow: (container, def, kind) => renderCalloutRow(ctx, container, def, kind, {
			onEdit() {}, onOpenBuiltInMenu() {}, onOpenUserMenu() {},
		}),
	}).render(calloutsPanel);
	return sceneMeta(
		"Callout Studio in Spanish",
		"Two separate settings crops are stacked with a visible gap: the saved Spanish language choice above and the translated callout-list section below. They are not adjacent sections of one settings page. Production components resolve their labels through the actual t() function and the repository's Spanish translation table, registered entirely offline. The real language-reset arrow shows the saved preference differs from the fixture's English Obsidian language.",
	);
}

export const scenes = {
	"edit-callout": editCallout,
	"replace-callout": replaceCallout,
	"context-menu": contextMenu,
	"context-customization": contextCustomization,
	"command-manager": commandManager,
	"command-editor": commandEditor,
	"import-source": plugin => openModal(new ImportSourceModal(sectionContext(plugin)), {
		title: "Choose an import source",
		description: "The actual ImportSourceModal renders Callout Studio's backup option followed by Callout Manager and Admonition under From another plugin. This chooser is displayed only; no file picker or import is activated.",
	}),
	"export-format": plugin => openModal(new ExportFormatModal(sectionContext(plugin)), {
		title: "Choose an export format",
		description: "The production ExportFormatModal displays its recommended JSON backup and CSS snippet choices with their actual labels and icons. The scene renders the chooser without downloading a file or writing a snippet.",
	}),
	"language-selector": languageSelector,
	"language-localized": languageLocalized,
};
