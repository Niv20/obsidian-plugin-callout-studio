/**
 * settings/SettingsTab.ts — Main plugin settings tab (Obsidian Settings pane).
 *
 * Composes all settings sections into a single scrollable tab:
 * callout lists (user + built-in), callout type cards (with the per-role
 * global style popups), editor features, fallback, hotkeys, data management
 * (import/export/reset), and the footer. Delegates each section to its own
 * module under sections/.
 * Holds a CalloutListsController for efficient list refresh without full
 * re-renders.
 */
import { MarkdownView, PluginSettingTab } from "obsidian";
import type { App, EventRef } from "obsidian";
import { CalloutEditor } from "./CalloutEditor";
import { openCalloutEditorFor } from "./openCalloutEditor";
import { scanStringForUnknownCallouts } from "../utils/vaultCalloutScanner";
import { renderHotkeySection } from "./sections/HotkeySection";
import { renderCreditsSection } from "./sections/CreditsSection";
import { renderFooterSection } from "./sections/FooterSection";
import {
	renderImportExportSection,
	renderResetSection,
} from "./sections/DataManagementSection";
import {
	renderAutocompleteSettingsSection,
	renderContextMenuSettingsSection,
} from "./sections/EditorFeaturesSection";
import { renderFallbackSection } from "./sections/FallbackSection";
import { renderThemeCoexistenceSection } from "./sections/ThemeCoexistenceSection";
import { renderLanguageSection } from "./sections/LanguageSection";
import { renderCustomPalettesSection } from "./sections/CustomPalettesSection";
import { renderGlobalSettingsSection } from "./sections/GlobalSettingsSection";
import {
	createCalloutListsController,
	type CalloutListsController,
} from "./sections/CalloutListsSection";
import { renderCalloutRow as renderCalloutRowSection } from "./sections/CalloutRowRenderer";
import { openBuiltInRowMenu, openRowMenu } from "./sections/CalloutRowActions";
import type {
	SettingsSectionContext,
	SettingsTabPlugin,
} from "./sections/types";

export class CalloutStudioSettingsTab extends PluginSettingTab {
	plugin: SettingsTabPlugin;
	private registrySubscription: (() => void) | null = null;
	private previewSubscription: (() => void) | null = null;
	private iconCacheUnsubscribe: (() => void) | null = null;
	private cssChangeRef: EventRef | null = null;
	private refreshFrame: number | null = null;
	private calloutLists: CalloutListsController | null = null;
	private sectionDisposers: (() => void)[] = [];

	constructor(app: App, plugin: SettingsTabPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	/**
	 * Obsidian 1.13+ declarative-settings hook (powers the settings-search
	 * index). Intentionally returns an empty array so **every** Obsidian
	 * version renders this tab through display() below:
	 *
	 * - On < 1.13 the method is unknown to Obsidian and never called — display()
	 *   runs as it always has, so older users are completely unaffected.
	 * - On 1.13+ an empty result falls back to display() (a *non-empty* result
	 *   would disable display() entirely and render only from the definitions),
	 *   so the full custom UI stays identical on new installs too.
	 *
	 * Defining the method (even empty) is the sanctioned way to satisfy
	 * obsidianmd/settings-tab/prefer-setting-definitions. Populating real
	 * per-setting search entries would mean reproducing all 11 sections
	 * declaratively — a migration that replaces display() and must be verified
	 * on a real 1.13 build, so it is deliberately deferred.
	 */
	getSettingDefinitions(): unknown[] {
		return [];
	}

	display(): void {
		const { containerEl } = this;
		// Tear down any resources from a previous render before rebuilding.
		this.runSectionDisposers();
		containerEl.empty();
		containerEl.addClass("callout-studio-settings");

		this.scanOpenEditorsForUnknownCallouts();
		this.plugin.schedulePruneUnusedFallbacks(0);

		if (!this.registrySubscription) {
			const sub = () => this.scheduleListRefresh();
			this.plugin.registry.onChange(sub);
			this.registrySubscription = sub;
		}

		// The callout editor's live preview registers its in-progress definition
		// transiently, without a registry mutation (no save, no note re-render
		// — see setPreviewDefinition). This is the only signal that reaches us,
		// and it is what keeps the row swatches in step with the modal's colour
		// picker instead of trailing it by a beat.
		if (!this.previewSubscription) {
			const sub = () => this.scheduleListRefresh();
			this.plugin.registry.onPreviewChange(sub);
			this.previewSubscription = sub;
		}

		if (!this.iconCacheUnsubscribe) {
			this.iconCacheUnsubscribe = this.plugin.onIconCacheChange(() =>
				this.scheduleListRefresh(),
			);
		}

		// Row swatches show the CURRENT theme mode's accent/background, so a
		// live theme flip must re-render them. Refresh only (never a full
		// display()): CSSInjector fires "css-change" after every inject.
		if (!this.cssChangeRef) {
			this.cssChangeRef = this.app.workspace.on("css-change", () =>
				this.scheduleListRefresh(),
			);
		}

		const sectionCtx = this.getSectionContext();
		this.calloutLists = createCalloutListsController(sectionCtx, {
			onAddNewCallout: async () => {
				const editor = new CalloutEditor(this.plugin);
				await editor.openAndWait();
				this.display();
			},
			renderRow: (rowContainerEl, def, isBuiltIn) => {
				renderCalloutRowSection(
					sectionCtx,
					rowContainerEl,
					def,
					isBuiltIn,
					{
						onEdit: (targetDef, targetIsBuiltIn) => {
							void this.handleRowEdit(
								targetDef.id,
								targetIsBuiltIn,
							);
						},
						onOpenBuiltInMenu: (event, targetDef) => {
							void openBuiltInRowMenu(
								sectionCtx,
								event,
								targetDef,
							);
						},
						onOpenUserMenu: (event, targetDef) => {
							void openRowMenu(sectionCtx, event, targetDef);
						},
					},
				);
			},
		});
		this.calloutLists.render(containerEl);

		renderThemeCoexistenceSection(sectionCtx, containerEl);
		renderFallbackSection(sectionCtx, containerEl);
		renderCustomPalettesSection(sectionCtx, containerEl);
		renderGlobalSettingsSection(sectionCtx, containerEl);
		renderAutocompleteSettingsSection(sectionCtx, containerEl);
		renderContextMenuSettingsSection(sectionCtx, containerEl);
		renderHotkeySection(sectionCtx, containerEl);
		renderImportExportSection(sectionCtx, containerEl);
		renderLanguageSection(sectionCtx, containerEl);
		renderResetSection(sectionCtx, containerEl);
		renderCreditsSection(sectionCtx, containerEl);
		renderFooterSection(sectionCtx, containerEl);
	}

	private getSectionContext(): SettingsSectionContext {
		return {
			app: this.app,
			plugin: this.plugin,
			display: () => this.display(),
			registerDisposer: (dispose) => this.sectionDisposers.push(dispose),
		};
	}

	private runSectionDisposers(): void {
		for (const dispose of this.sectionDisposers) {
			try {
				dispose();
			} catch {
				/* ignore disposer failures */
			}
		}
		this.sectionDisposers = [];
	}

	hide(): void {
		this.runSectionDisposers();
		if (this.registrySubscription) {
			this.plugin.registry.offChange(this.registrySubscription);
			this.registrySubscription = null;
		}
		if (this.previewSubscription) {
			this.plugin.registry.offPreviewChange(this.previewSubscription);
			this.previewSubscription = null;
		}
		if (this.iconCacheUnsubscribe) {
			this.iconCacheUnsubscribe();
			this.iconCacheUnsubscribe = null;
		}
		if (this.cssChangeRef) {
			this.app.workspace.offref(this.cssChangeRef);
			this.cssChangeRef = null;
		}
		if (this.refreshFrame !== null) {
			window.cancelAnimationFrame(this.refreshFrame);
			this.refreshFrame = null;
		}
		this.calloutLists = null;
		super.hide();
	}

	private async handleRowEdit(id: string, isBuiltIn: boolean): Promise<void> {
		const def = this.plugin.registry.get(id);
		if (!def) return;

		if (isBuiltIn) {
			const result = await openCalloutEditorFor(this.plugin, def);
			if (result) {
				this.plugin.registry.update(def.id, {
					displayName: result.displayName,
					icon: result.icon,
					colorLight: result.colorLight,
					colorDark: result.colorDark,
					bgColorLight: result.bgColorLight,
					bgColorDark: result.bgColorDark,
					textColorLight: result.textColorLight,
					textColorDark: result.textColorDark,
					foldable: result.foldable,
					defaultFolded: result.defaultFolded,
					iconAdjust: result.iconAdjust,
					iconOffsetX: result.iconOffsetX,
					iconOffsetY: result.iconOffsetY,
					iconSize: result.iconSize,
					aliases: result.aliases,
				});
			}
		} else {
			await openCalloutEditorFor(this.plugin, def);
		}
		this.display();
	}

	private refreshLists(): void {
		this.calloutLists?.refresh();
	}

	/**
	 * Coalesced list refresh shared by all change subscriptions.
	 *
	 * Coalescing on the next animation frame rather than a timer means a burst
	 * (a registry mutation that also emits css-change, or a colour dragged
	 * across the editor's palette menu) still costs exactly one re-render — but
	 * that render lands in the very next paint instead of a beat afterwards.
	 */
	private scheduleListRefresh(): void {
		if (!this.containerEl.isConnected) return;
		if (this.refreshFrame !== null) return;
		this.refreshFrame = window.requestAnimationFrame(() => {
			this.refreshFrame = null;
			if (this.containerEl.isConnected) this.refreshLists();
		});
	}

	private scanOpenEditorsForUnknownCallouts(): void {
		const known = new Set<string>();
		for (const def of this.plugin.registry.getAll()) {
			known.add(def.id.toLowerCase());
			for (const a of def.aliases ?? []) known.add(a.toLowerCase());
		}
		const seen = new Set<string>();
		const leaves = this.app.workspace.getLeavesOfType("markdown");
		for (const leaf of leaves) {
			const view = leaf.view;
			if (!(view instanceof MarkdownView)) continue;
			const content = view.editor.getValue();
			if (!content) continue;
			for (const id of scanStringForUnknownCallouts(content, known)) {
				seen.add(id);
			}
		}
		if (seen.size === 0) return;
		const added = this.plugin.addUnknownCalloutsAsFallback(
			Array.from(seen),
		);
		if (added > 0) {
			void this.plugin.saveSettings();
			this.plugin.refreshCallouts();
		}
	}
}
