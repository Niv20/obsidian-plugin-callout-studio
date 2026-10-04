/** Synthetic, offline Obsidian services shared by documentation scenes. */
import { MarkdownRenderer, Component, TFile } from "obsidian";
import { CalloutRegistry } from "../../src/manager/CalloutRegistry.ts";
import { CSSInjector } from "../../src/manager/CSSInjector.ts";
import { createCalloutReadingPostProcessor } from "../../src/reading/calloutPostProcessor.ts";
import { createCalloutListsController } from "../../src/settings/sections/CalloutListsSection.ts";
import { renderCalloutRow } from "../../src/settings/sections/CalloutRowRenderer.ts";
import { freshPaging } from "../../src/settings/sections/calloutListsSignature.ts";
import { CalloutEditor } from "../../src/settings/CalloutEditor.ts";
import { PACK_MANIFEST } from "../../src/icons/data/packManifest.ts";

export function makeHost() {
	const texts = new Map(), files = new Map(), caches = new Map();
	const app = {
		appId: "user-guide-fixture",
		customCss: { theme: "", snippets: [], enabledSnippets: new Set() },
		vault: {
			configDir: ".obsidian", getName: () => "Documentation", getMarkdownFiles: () => [...files.values()], getConfig: () => true,
			getAbstractFileByPath: path => files.get(path) ?? null,
			read: async file => texts.get(file.path) ?? "", cachedRead: async file => texts.get(file.path) ?? "",
			on: () => ({}), offref() {},
			adapter: {
				exists: async path => texts.has(path), stat: async () => null,
				read: async path => texts.get(path) ?? "", list: async () => ({ files: [], folders: [] }),
				write: async () => { throw new Error("Documentation scenes cannot write vault files"); },
			},
		},
		metadataCache: { getCache: path => caches.get(path) ?? null, getFileCache: file => caches.get(file.path) ?? null, on: () => ({}), offref() {} },
		workspace: {
			containerEl: document.body, trigger() {}, getLeavesOfType: () => [], iterateAllLeaves() {},
			getActiveViewOfType: () => null, getActiveFile: () => null, getMostRecentLeaf: () => null,
			on: () => ({}), offref() {}, onLayoutReady(callback) { callback(); },
		},
		commands: { commands: {}, listCommands: () => [], findCommand: () => null },
		hotkeyManager: { getHotkeys: () => [], getDefaultHotkeys: () => [] },
		keymap: { pushScope() {}, popScope() {} }, scope: { register() {}, unregister() {} },
	};
	const registry = new CalloutRegistry(); registry.load(null);
	const cssInjector = new CSSInjector(app, registry);
	const plugin = {
		app, registry, cssInjector, settings: registry.settings, settingsEditOpen: false,
		manifest: { id: "callout-studio", name: "Callout Studio", version: "2.16.0", dir: ".obsidian/plugins/callout-studio" },
		settingsWriter: { isFrozen: false, isDestroyed: false, matchesLastWrite: () => true },
		localState: {
			isExpanded: kind => kind !== "builtin", setExpanded() {}, iconCategory: () => "all", setIconCategory() {},
			emojiSkinTone: 0, setEmojiSkinTone() {}, quickInsertSource: "all", setQuickInsertSource() {},
		},
		icons: { packs: { state: () => "unavailable", info: id => PACK_MANIFEST[id], onChange: () => () => {}, loadAllFromDisk: async () => {} }, deleteLibrary: async () => {} },
		locales: { isReady: () => true }, ensureLocale: async () => true, applyLocaleChange() {},
		customCommands: { list: () => [], migrateCalloutId() {}, refresh() {} },
		saveSettings: async () => {}, ensureIconArtwork: async () => {}, ensureIconArtworkFor: async () => {},
		refreshCallouts() {}, refreshRenderModes() {}, hasIconFetchFailed: () => false,
		runVaultScan: async () => 0, onIconCacheChange: () => () => {}, register() {}, registerEvent() {}, registerDomEvent() {},
		restyleUncustomizedFallbackRows: () => registry.restyleUncustomizedFallbackRows(),
	};
	plugin.seedNote = (path, text) => {
		const file = Object.assign(new TFile(), { path, basename: path.replace(/.*\//, "").replace(/\.md$/, ""), extension: "md", stat: { mtime: 1, ctime: 1, size: text.length } });
		texts.set(path, text); files.set(path, file);
		const headings = text.split("\n").flatMap((line, number) => {
			const match = /^(#{1,6})\s+(.*)$/.exec(line);
			return match ? [{ heading: match[2], level: match[1].length, position: { start: { line: number, col: 0 }, end: { line: number, col: line.length } } }] : [];
		});
		caches.set(path, { headings });
		return file;
	};
	const processReading = createCalloutReadingPostProcessor(plugin);
	globalThis.__CS_GUIDE_POSTPROCESS__ = element => {
		processReading(element, { getSectionInfo: () => null });
		cssInjector.paintIcons(element);
	};
	cssInjector.inject(false);
	return plugin;
}

export function sceneMeta(title, description, selector = "#guide-scene") { return { selector, title, description }; }

export function openModal(modal, metadata = {}) {
	modal.open(); modal.modalEl.setAttribute("id", "guide-scene");
	return { selector: "#guide-scene", ...metadata };
}

export function settingsContext(plugin) {
	return { app: plugin.app, plugin, display() {}, registerDisposer() {} };
}

/** metadata.render(panel, context) can mount a focused production section. */
export function mountSettings(plugin, metadata = {}) {
	const panel = document.body.createDiv({ cls: "callout-studio-settings guide-settings", attr: { id: "guide-scene" } });
	const ctx = settingsContext(plugin);
	if (metadata.render) metadata.render(panel, ctx);
	else createCalloutListsController(ctx, {
		paging: freshPaging(), onAddNewCallout: async () => new CalloutEditor(plugin).open(),
		renderRow: (container, def, kind) => renderCalloutRow(ctx, container, def, kind, { onEdit() {}, onOpenBuiltInMenu() {}, onOpenUserMenu() {} }),
	}).render(panel);
	const { render, ...publicMetadata } = metadata;
	return { selector: "#guide-scene", ...publicMetadata };
}

export async function renderMarkdown(plugin, parent, markdown) {
	const component = new Component(); component.load();
	await MarkdownRenderer.render(plugin.app, markdown, parent, "Guide example.md", component);
	plugin.cssInjector.paintIcons(parent);
	return parent;
}

export async function mountNote(plugin, markdown, metadata = {}) {
	const panel = document.body.createDiv({ cls: "guide-note markdown-preview-view", attr: { id: "guide-scene" } });
	const content = panel.createDiv({ cls: "markdown-rendered" });
	await renderMarkdown(plugin, content, markdown);
	return { selector: "#guide-scene", ...metadata };
}

export function seedExample(plugin, overrides = {}) {
	const def = { id: "project", displayName: "Project", icon: { type: "lucide", value: "bookmark" }, colorLight: "#7c3aed", colorDark: "#a78bfa", foldable: true, defaultFolded: false, builtIn: false, source: "user", ...overrides };
	plugin.registry.add(def); plugin.cssInjector.inject(false);
	return def;
}
