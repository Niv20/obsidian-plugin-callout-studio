/**
 * settings/SettingsTab.ts — Main plugin settings tab (Obsidian Settings pane).
 *
 * The tab is a tree Obsidian draws (Obsidian 1.13's declarative settings):
 * `getSettingDefinitions()` hands it over, built by
 * declarative/declarativeSettings.ts, and Obsidian draws its pages and indexes
 * every row for its settings search. A non-empty tree means Obsidian never
 * calls `display()`.
 *
 * `display()` below, the page drawn section by section (sections/), stays for
 * now only as the fallback: a part of the tree that fails to build makes the
 * tree empty, and Obsidian then draws this page instead. The Clean Sweep
 * removes it.
 */
import { PluginSettingTab } from "obsidian";
import type { App, SettingDefinitionItem } from "obsidian";
import { PLUGIN_ICON_ID } from "../constants";
import { readSettingAt, writeControlValue } from "./declarative/controlBinding";
import { DeclarativeSettings } from "./declarative/declarativeSettings";
import { registerMenuScopeHost } from "../ui/menuEscape";
import { CalloutEditor } from "./CalloutEditor";
import { openCalloutEditorFor } from "./openCalloutEditor";
import { renderHotkeySection } from "./sections/HotkeySection";
import { renderFooterSection } from "./sections/FooterSection";
import {
	renderBackupSection,
	renderImportExportSection,
	renderResetSection,
} from "./sections/DataManagementSection";
import { renderContextMenuSettingsSection } from "./sections/EditorFeaturesSection";
import { renderFallbackSection } from "./sections/FallbackSection";
import { renderReadOnlyBanner } from "./sections/ReadOnlyBanner";
import { makePausedReadOnly } from "./sections/pausedReadOnly";
import { renderCompetitorImportBanner } from "./competitorImportBanner";
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
import { cancelFrame, requestFrameFor, type FrameHandle } from "../utils/elementFrame";
import type { PagingState } from "./sections/listPaging";
import type { RowKind } from "./sections/rowOwnership";
import { renderCalloutRow as renderCalloutRowSection } from "./sections/CalloutRowRenderer";
import { openBuiltInRowMenu, openRowMenu } from "./sections/CalloutRowActions";
import type {
	SettingsSectionContext,
	SettingsTabPlugin,
} from "./sections/types";

export class CalloutStudioSettingsTab extends PluginSettingTab {
	plugin: SettingsTabPlugin;
	/**
	 * Drawn beside "Callout Studio" in Obsidian's settings search results, as
	 * every core tab's is. The sidebar list does not show it: Obsidian hides
	 * every community plugin's tab icon there.
	 */
	icon = PLUGIN_ICON_ID;
	/** Undoes all four change subscriptions — see `subscribeSettingsTab`. */
	private unsubscribe: (() => void) | null = null;
	private refreshFrame: FrameHandle | null = null;
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
	/**
	 * Ends this visit's version in device history. Every edit saved between
	 * opening the tab and leaving it is one version there, the way the paging
	 * above is one visit's.
	 */
	private endVisit: (() => void) | null = null;
	/** The tree's side of the tab; made the first time Obsidian asks for the tree. */
	private declarative: DeclarativeSettings | null = null;

	constructor(app: App, plugin: SettingsTabPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	/**
	 * The tab's tree (declarative/declarativeSettings.ts). Obsidian asks for it
	 * on every `update()`, the first time while the plugin loads.
	 */
	getSettingDefinitions(): SettingDefinitionItem[] {
		this.declarative ??= new DeclarativeSettings(this);
		return this.declarative.definitions();
	}

	/**
	 * A declarative control's current value. Obsidian's own reads
	 * `plugin.settings[key]`; here the keys are dotted paths into the nested
	 * settings, read live each time. @see declarative/controlBinding.ts
	 */
	getControlValue(key: string): unknown {
		return readSettingAt(this.plugin.settings, key);
	}

	/**
	 * Save a declarative control's change through the plugin's own save, never
	 * through Obsidian's default, which calls `saveData(plugin.settings)` and
	 * would overwrite data.json with the settings alone, losing every callout.
	 * The registry's change round repaints and saves. While saving is paused
	 * the change is refused and the page redrawn, which puts the control back.
	 * @see declarative/controlBinding.ts
	 */
	setControlValue(key: string, value: unknown): void {
		writeControlValue(this.plugin, key, value, {
			announce: () => this.plugin.registry.settingsChanged(),
			onRefused: () => this.update(),
		});
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
		// Obsidian 1.14 opens settings in a window of its own, with its own copy
		// of the theme — and its previews must not show what the switch took away.
		this.plugin.themeCalloutsOff?.ensure(containerEl.ownerDocument);
		this.sectionDisposers.push(registerMenuScopeHost(containerEl, this.app));

		this.endVisit ??= this.plugin.settingsWriter.openVisit?.() ?? null;
		this.unsubscribe ??= subscribeSettingsTab(
			this.app,
			this.plugin,
			(force) => this.scheduleListRefresh(force),
		);

		const sectionCtx = this.getSectionContext();
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
						onOpenBuiltInMenu: (trigger, targetDef) => {
							void openBuiltInRowMenu(
								sectionCtx,
								trigger,
								targetDef,
							);
						},
						onOpenUserMenu: (trigger, targetDef) => {
							void openRowMenu(sectionCtx, trigger, targetDef);
						},
					},
				);
			},
		});
		this.calloutLists.render(containerEl);
		const bannerSlot = this.calloutLists.bannerSlot() ?? containerEl;

		renderFallbackSection(sectionCtx, containerEl);
		renderCustomPalettesSection(sectionCtx, containerEl);
		renderGlobalSettingsSection(sectionCtx, containerEl);
		renderContextMenuSettingsSection(sectionCtx, containerEl);
		renderHotkeySection(sectionCtx, containerEl);
		const importTarget = renderImportExportSection(sectionCtx, containerEl);
		const backupTarget = renderBackupSection(sectionCtx, containerEl);
		renderLanguageSection(sectionCtx, containerEl);
		renderResetSection(sectionCtx, containerEl);
		renderFooterSection(sectionCtx, containerEl);

		// Both notices belong directly under the title. Rendering them after the
		// sections lets each hold the real row it scrolls to — Import for the
		// import prompt, Backup › Earlier setups for the saving banner — without
		// changing their DOM position inside the title's banner slot.
		renderCompetitorImportBanner(sectionCtx, bannerSlot, importTarget);
		renderReadOnlyBanner(sectionCtx, bannerSlot, backupTarget);

		// Nothing is saved while paused, so nothing is editable either; the page
		// is redrawn whenever that changes. @see sections/pausedReadOnly.ts
		const writer = this.plugin.settingsWriter;
		const paused = writer.isFrozen;
		if (paused) makePausedReadOnly(containerEl, [bannerSlot]);
		const status = writer.status;
		if (status) {
			this.sectionDisposers.push(status.subscribe(() => {
				if (!writer.isDestroyed && writer.isFrozen !== paused) this.display();
			}));
		}

		restoreScroll();
	}

	private getSectionContext(): SettingsSectionContext {
		return {
			app: this.app,
			plugin: this.plugin,
			display: () => this.display(),
			revealCallout: (def) => {
				const kind = this.plugin.registry.themeOwns(def) ? "theme" : "user";
				this.paging[kind].expanded = true;
				this.plugin.localState.setExpanded(kind, true);
				this.display();
			},
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
		this.declarative?.hide();
		this.runSectionDisposers();
		this.unsubscribe?.();
		this.unsubscribe = null;
		this.refreshFrame = cancelFrame(this.refreshFrame);
		this.refreshForced = false;
		this.calloutLists = null;
		// The cursor is session-only and this is what makes that true: leaving
		// the tab is the reopen it has always been reset by. What it is no
		// longer reset by is a repaint the reader did not ask for.
		this.paging = freshPaging();
		this.endVisit?.();
		this.endVisit = null;
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
	 * The lists sit above twelve other sections, so a reader parked anywhere
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
		// The tab's own window's frame: in Obsidian 1.14 the settings are a
		// window of their own, and one asked of the main window never arrives
		// while it is hidden behind them (utils/elementFrame.ts).
		this.refreshFrame = requestFrameFor(this.containerEl, () => {
			this.refreshFrame = null;
			const forced = this.refreshForced;
			this.refreshForced = false;
			if (this.containerEl.isConnected) this.refreshLists(forced);
		});
	}

}
