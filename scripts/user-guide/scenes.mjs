/** Offline documentation fixtures: the plugin owns every illustrated control. */
import { installDomHelpers } from "obsidian";
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { CalloutRegistry } from "../../src/manager/CalloutRegistry.ts";
import { CSSInjector } from "../../src/manager/CSSInjector.ts";
import { CalloutEditor } from "../../src/settings/CalloutEditor.ts";
import { CalloutAutoComplete } from "../../src/editor/AutoComplete.ts";
import { createCalloutListsController } from "../../src/settings/sections/CalloutListsSection.ts";
import { renderCalloutRow } from "../../src/settings/sections/CalloutRowRenderer.ts";
import { freshPaging } from "../../src/settings/sections/calloutListsSignature.ts";
import { createCalloutReadingPostProcessor } from "../../src/reading/calloutPostProcessor.ts";
import { setLocale } from "../../src/i18n/index.ts";
import { scenes as designScenes } from "./scenes-design.mjs";
import { scenes as managementScenes } from "./scenes-management.mjs";
import { scenes as sidebarScenes } from "./scenes-sidebars.mjs";
import { scenes as formatScenes } from "./scenes-formats.mjs";
import { scenes as integrationScenes } from "./scenes-integration.mjs";
import { makeHost as sharedHost } from "./fixture-host.mjs";

const mounts = { "create-settings": mountSettings, "create-editor": mountEditor, "create-autocomplete": mountAutocomplete, ...designScenes, ...managementScenes, ...sidebarScenes, ...formatScenes, ...integrationScenes };
export const sceneNames = Object.keys(mounts);

function makeHost() {
	const app = {
		appId: "user-guide-fixture",
		customCss: { theme: "", snippets: [], enabledSnippets: new Set() },
		vault: { getName: () => "Documentation", getMarkdownFiles: () => [], getConfig: () => true },
		workspace: {
			containerEl: document.body,
			trigger() {}, getLeavesOfType: () => [], iterateAllLeaves() {},
			getActiveViewOfType: () => null, on: () => ({}), offref() {},
		},
		keymap: { pushScope() {}, popScope() {} }, scope: { register() {}, unregister() {} },
	};
	const registry = new CalloutRegistry();
	registry.load(null);
	const cssInjector = new CSSInjector(app, registry);
	const plugin = {
		app, registry, cssInjector, settings: registry.settings, settingsEditOpen: false,
		settingsWriter: { isFrozen: false, isDestroyed: false, matchesLastWrite: () => true },
		localState: { isExpanded: kind => kind !== "builtin", setExpanded() {} },
		icons: { packs: {}, deleteLibrary: async () => {} },
		customCommands: { migrateCalloutId() {} },
		saveSettings: async () => {}, ensureIconArtwork: async () => {},
		refreshCallouts() {}, refreshRenderModes() {}, hasIconFetchFailed: () => false,
		runVaultScan: async () => 0,
	};
	const processReading = createCalloutReadingPostProcessor(plugin);
	globalThis.__CS_GUIDE_POSTPROCESS__ = (element) => {
		processReading(element, { getSectionInfo: () => null });
		cssInjector.paintIcons(element);
	};
	cssInjector.inject(false);
	return plugin;
}

function mountSettings(plugin) {
	const panel = document.body.createDiv({ cls: "callout-studio-settings guide-settings", attr: { id: "guide-scene" } });
	const ctx = { app: plugin.app, plugin, display() {}, registerDisposer() {} };
	const controller = createCalloutListsController(ctx, {
		paging: freshPaging(),
		onAddNewCallout: async () => new CalloutEditor(plugin).open(),
		renderRow: (container, def, kind) => renderCalloutRow(ctx, container, def, kind, {
			onEdit() {}, onOpenBuiltInMenu() {}, onOpenUserMenu() {},
		}),
	});
	controller.render(panel);
	return {
		selector: "#guide-scene", title: "Add a callout in settings",
		description: "Callout Studio's actual settings list, on a fresh setup in the default dark theme. Add new callout opens the editor.",
	};
}

function mountEditor(plugin) {
	const editor = new CalloutEditor(plugin, undefined, { seedDisplayName: "Project note" });
	editor.open();
	editor.modalEl.setAttribute("id", "guide-scene");
	return {
		selector: "#guide-scene", title: "Create a Project note callout",
		description: "The actual CalloutEditor form with Project note as the display name and project note as the primary ID. The plugin's Reading view fallback renders the three preview forms through its real postprocessor and generated CSS.",
	};
}

function mountAutocomplete(plugin) {
	const panel = document.body.createDiv({ cls: "guide-autocomplete", attr: { id: "guide-scene" } });
	const editor = new EditorView({
		state: EditorState.create({ doc: "> [!project", selection: { anchor: 11 } }),
		parent: panel,
	});
	const editorApi = { getLine: () => editor.state.doc.toString(), lineCount: () => 1 };
	const suggest = new CalloutAutoComplete(plugin);
	const trigger = suggest.onTrigger({ line: 0, ch: 11 }, editorApi, null);
	if (!trigger) throw new Error("The plugin did not recognize the unknown project token");
	const context = { ...trigger, editor: editorApi, file: null };
	suggest.context = context;
	const popover = panel.createDiv({ cls: "suggestion-container" });
	const list = popover.createDiv({ cls: "suggestion" });
	const items = suggest.getSuggestions(context);
	if (items.length !== 1 || items[0].query !== "project") throw new Error("Expected the real create suggestion for project");
	for (const item of items) suggest.renderSuggestion(item, list.createDiv({ cls: "suggestion-item is-selected" }));
	return {
		selector: "#guide-scene", title: "Create a callout while typing",
		description: "A real CodeMirror editor contains an unknown block-callout token. CalloutAutoComplete computes and renders its Create project suggestion; the documentation host positions the popover below the typed line.",
	};
}

export async function mountScene(name) {
	installDomHelpers();
	setLocale("en");
	document.body.className = "theme-dark is-desktop";
	const plugin = name.startsWith("create-") ? makeHost() : sharedHost();
	const mount = mounts[name];
	if (!mount) throw new Error(`Unknown user-guide scene: ${name}`);
	const metadata = await mount(plugin);
	await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
	await document.fonts.ready;
	return metadata;
}
