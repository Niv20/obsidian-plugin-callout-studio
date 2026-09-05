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
import { PluginSettingTab } from "obsidian";
import type { App } from "obsidian";
import { CalloutEditor } from "./CalloutEditor";
import { openCalloutEditorFor } from "./openCalloutEditor";
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
import { renderReadOnlyBanner } from "./sections/ReadOnlyBanner";
import { captureScroll } from "./sections/scrollRestore";
import { renderLanguageSection } from "./sections/LanguageSection";
import { renderCustomPalettesSection } from "./sections/CustomPalettesSection";
import { renderGlobalSettingsSection } from "./sections/GlobalSettingsSection";
import {
	createCalloutListsController,
	type CalloutListsController,
} from "./sections/CalloutListsSection";
import { freshPaging } from "./sections/calloutListsSignature";
import { keepScrollAnchored } from "./sections/foldAnchor";
import { subscribeSettingsTab } from "./sections/tabSubscriptions";
import type { PagingState } from "./sections/listPaging";
import type { RowKind } from "./sections/rowOwnership";
import { renderCalloutRow as renderCalloutRowSection } from "./sections/CalloutRowRenderer";
import { openBuiltInRowMenu, openRowMenu } from "./sections/CalloutRowActions";
import { invalidateThemeRowUsage } from "./sections/themeRowUsage";
import type {
	SettingsSectionContext,
	SettingsTabPlugin,
} from "./sections/types";

export class CalloutStudioSettingsTab extends PluginSettingTab {
	plugin: SettingsTabPlugin;
	/** Undoes all four change subscriptions — see `subscribeSettingsTab`. */
	private unsubscribe: (() => void) | null = null;
	private refreshFrame: number | null = null;
	/**
	 * Whether the refresh already queued for the next frame must redraw even if
	 * nothing in the registry moved. Sticky on purpose: a frame that coalesces a
	 * forcing signal with a non-forcing one has to honour the forcing one.
	 */
	private refreshForced = false;
	private calloutLists: CalloutListsController | null = null;
	private sectionDisposers: (() => void)[] = [];
	/**
	 * How far the reader has paged into each of the three lists.
	 *
	 * Held here rather than inside the controller because a controller lives
	 * exactly one `display()`, and `display()` is re-run by things the reader
	 * never asked for — another device's settings file arriving
	 * (`adoptExternalSettings`), a locale finishing its download. Both used to
	 * fold an expanded list back to its first 20 rows mid-scroll. A *visit* is
	 * the right lifetime, and this class is what has one: `hide()` clears it,
	 * which keeps the cursor session-only exactly as it has always been.
	 */
	private paging: Record<RowKind, PagingState> = freshPaging();

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
		// Where the reader was, before `empty()` takes the page out from under
		// them — and why once is not enough. @see sections/scrollRestore.ts
		const restoreScroll = captureScroll(containerEl);

		// Tear down any resources from a previous render before rebuilding.
		this.runSectionDisposers();
		containerEl.empty();
		containerEl.addClass("callout-studio-settings");

		this.unsubscribe ??= subscribeSettingsTab(
			this.app,
			this.plugin,
			(force) => this.scheduleListRefresh(force),
		);

		const sectionCtx = this.getSectionContext();
		// First on the page, because it is the reason nothing below it will be
		// saved. @see sections/ReadOnlyBanner.ts
		renderReadOnlyBanner(sectionCtx, containerEl);
		this.calloutLists = createCalloutListsController(sectionCtx, {
			paging: this.paging,
			onAddNewCallout: async () => {
				const editor = new CalloutEditor(this.plugin);
				await editor.openAndWait();
				this.display();
			},
			renderRow: (rowContainerEl, def, kind) => {
				renderCalloutRowSection(
					sectionCtx,
					rowContainerEl,
					def,
					kind,
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

		restoreScroll();
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
		this.unsubscribe?.();
		this.unsubscribe = null;
		if (this.refreshFrame !== null) {
			window.cancelAnimationFrame(this.refreshFrame);
			this.refreshFrame = null;
		}
		this.refreshForced = false;
		this.calloutLists = null;
		// The cursor is session-only and this is what makes that true: leaving
		// the tab is the reopen it has always been reset by. What it is no
		// longer reset by is a repaint the reader did not ask for.
		this.paging = freshPaging();
		// One whole-vault usage pass per visit to this tab, not per repaint.
		invalidateThemeRowUsage();
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

	/**
	 * Redraw the three lists without moving the page under the reader.
	 *
	 * The lists sit above eleven other sections, so a reader parked anywhere
	 * below them has all of this happening off-screen and above: rows appear and
	 * vanish, the whole theme section comes and goes with `cs-hidden`, and a row
	 * grows when the appearance probe finally lands it a swatch. Every one of
	 * those shifts everything below by its own height, and where the page ends
	 * up shorter than the offset they were at, the browser clamps it and they
	 * lose their place outright rather than merely sliding.
	 */
	private refreshLists(force: boolean): void {
		keepScrollAnchored(this.containerEl, () => {
			this.calloutLists?.refresh(force);
		});
	}

	/**
	 * Coalesced list refresh shared by all change subscriptions.
	 *
	 * Coalescing on the next animation frame rather than a timer means a burst
	 * (a registry mutation that also emits css-change, or a colour dragged
	 * across the editor's palette menu) still costs exactly one re-render — but
	 * that render lands in the very next paint instead of a beat afterwards.
	 *
	 * `force` rides along rather than being re-decided in the frame, and it
	 * accumulates: a frame that coalesced an icon landing with an unrelated
	 * `css-change` still has to honour the icon.
	 */
	private scheduleListRefresh(force = false): void {
		if (!this.containerEl.isConnected) return;
		this.refreshForced ||= force;
		if (this.refreshFrame !== null) return;
		this.refreshFrame = window.requestAnimationFrame(() => {
			this.refreshFrame = null;
			const forced = this.refreshForced;
			this.refreshForced = false;
			if (this.containerEl.isConnected) this.refreshLists(forced);
		});
	}

}
