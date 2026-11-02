/**
 * settings/declarative/declarativeSettings.ts — what connects the settings tab
 * to the tree Obsidian draws.
 *
 * Who calls it. The settings tab (SettingsTab.ts): its
 * `getSettingDefinitions()` asks {@link DeclarativeSettings.definitions}, and
 * its `hide()` calls {@link DeclarativeSettings.hide}.
 *
 * The main idea. It holds, for the plugin's whole life:
 * - **the context** every part of the tree is built with (types.ts): the
 *   plugin, the row registry, the parts store, and the ways to draw again and
 *   to jump to a row;
 * - **the updater** (treeUpdater.ts), which asks Obsidian for `update()` at
 *   most once a frame, only when something on the pages has changed (the
 *   signature), and not while the user is in the middle of something;
 * - **the signals** that ask it: the registry and the theme (the four in
 *   sections/tabSubscriptions.ts), the saving status, and the language's
 *   download.
 *   They are wired the first time Obsidian asks for the tree, which
 *   `addSettingTab` does while the plugin loads, and undone when it unloads;
 * - **the visit**: Obsidian has no "the tab opened" hook, so a row with
 *   nothing on screen, drawn on every opening of the main page, starts one
 *   (one version in the history per visit, the theme's styles switch in the
 *   settings window, Escape for the plugin's own pickers, the brush mascot of
 *   an empty list). `hide()` ends it.
 */
import type { App } from "obsidian";
import { getLocale } from "../../i18n";
import { registerMenuScopeHost } from "../../ui/menuEscape";
import { watchEmptyListMascots } from "../../ui/mascot/mascotPlaces";
import { competitorsToOffer } from "../competitorImportBanner";
import { isRowMenuActive } from "../sections/calloutRowMenu";
import { calloutListsSignature } from "../sections/calloutListsSignature";
import { languageDownloading } from "../sections/languagePicker";
import { scanRunning } from "../sections/manualScan";
import { activeThemeLabel, partitionCallouts } from "../sections/rowOwnership";
import { subscribeSettingsTab } from "../sections/tabSubscriptions";
import type { SettingsTabPlugin } from "../sections/types";
import { revealCalloutRow } from "./calloutPages";
import { jumpToRow } from "./jumpToRow";
import { PersistentParts } from "./persistentParts";
import { RowRegistry } from "./rowRegistry";
import { buildTreeSafely, treeAfterFailure } from "./safeTree";
import { settingsTree } from "./settingsTree";
import { interactionInProgress, nextFrameOrSoon, TreeUpdater } from "./treeUpdater";
import { toObsidianItems, type CsRender, type TreeContext } from "./types";
import type { SettingDefinitionItem } from "obsidian";

/** What it needs from the settings tab. */
export interface DeclarativeTabHost {
	app: App;
	plugin: SettingsTabPlugin;
	/** The tab's main page; sub-pages are drawn beside it. */
	containerEl: HTMLElement;
	/** Obsidian's `update()`: build the tree again and draw the open page. */
	update(): void;
}

export class DeclarativeSettings {
	private readonly ctx: TreeContext;
	private readonly updater: TreeUpdater;
	private readonly rows = new RowRegistry();
	private readonly parts = new PersistentParts();
	/** Undoes the signals; null until they are wired. */
	private stopListening: (() => void) | null = null;
	/** What ends the visit under way; null while the tab is not open. */
	private endVisit: (() => void) | null = null;
	/** Undone when the visit ends: what the tree's parts registered. */
	private visitDisposers: (() => void)[] = [];

	constructor(private readonly host: DeclarativeTabHost) {
		this.updater = new TreeUpdater({
			signature: () => this.signature(),
			update: () => this.host.update(),
			isBusy: () => interactionInProgress(this.host.containerEl.ownerDocument) || isRowMenuActive(this.host.app),
			schedule: nextFrameOrSoon(() => this.host.containerEl),
		});
		const schedule = nextFrameOrSoon(() => this.host.containerEl);
		this.ctx = {
			app: host.app,
			plugin: host.plugin,
			// "Draw the settings again": the parts call it after a change, which
			// the signature may not see (a scan starting), so it is forced.
			redraw: () => this.updater.request(true),
			revealCallout: (def) => {
				this.updater.request(true);
				revealCalloutRow(this.ctx, def);
			},
			registerDisposer: (dispose) => this.visitDisposers.push(dispose),
			rows: this.rows,
			parts: this.parts,
			jumpTo: (rowId, fromKeyboard, pagePath = []) => {
				jumpToRow(
					{ app: host.app, tabId: host.plugin.manifest.id, rows: this.rows, schedule },
					rowId,
					pagePath,
					fromKeyboard,
				);
			},
		};
	}

	/**
	 * The tree, for `getSettingDefinitions()`. Never throws: if a part does,
	 * Obsidian gets a tree of one row that says the settings could not be drawn.
	 */
	definitions(): SettingDefinitionItem[] {
		this.listen();
		const tree = toObsidianItems(buildTreeSafely(() => settingsTree(this.ctx, this.visitRow()), treeAfterFailure()));
		// What Obsidian draws next is this tree: later requests compare with it.
		this.updater.markDrawn();
		return tree;
	}

	/** The tab was left (or the settings closed): end the visit. */
	hide(): void {
		this.endVisit?.();
		this.endVisit = null;
		for (const dispose of this.visitDisposers.splice(0)) {
			try { dispose(); } catch { /* one failing cleanup must not stop the rest */ }
		}
		this.parts.disposeAll();
	}

	/** Wire the signals, once, and undo them when the plugin unloads. */
	private listen(): void {
		if (this.stopListening) return;
		const { app, plugin } = this.host;
		const request = (force: boolean): void => this.updater.request(force);
		const stops = [
			subscribeSettingsTab(app, plugin, request),
			plugin.settingsWriter.status?.subscribe(() => request(false)),
			plugin.locales.onChange(() => request(false)),
		];
		this.stopListening = () => {
			for (const stop of stops) stop?.();
			this.updater.dispose();
		};
		plugin.register(() => {
			this.stopListening?.();
			this.hide();
		});
	}

	/**
	 * A row with nothing on screen, in the main page's first box: Obsidian
	 * draws it whenever it draws the main page, which it does on every opening
	 * of the tab (a search result on a sub-page too), so drawing it starts the
	 * visit. Starting is done once per visit.
	 */
	private visitRow(): CsRender {
		return {
			id: "settings-visit",
			name: "",
			searchable: false,
			visible: false,
			render: () => this.beginVisit(),
		};
	}

	/** Start a visit: what has to happen once each time the tab opens. */
	private beginVisit(): void {
		if (this.endVisit) return;
		const { app, plugin, containerEl } = this.host;
		// Every edit until the tab is left is one version in the history.
		const endHistoryVisit = plugin.settingsWriter.openVisit?.() ?? null;
		// Obsidian 1.14 opens the settings in a window of their own, with its
		// own copy of the theme: its previews must not show what the switch took away.
		plugin.themeCalloutsOff?.ensure(containerEl.ownerDocument);
		// Escape closes the plugin's own pickers first, not the settings. On the
		// content area, not the main page: sub-pages are drawn beside it.
		const releaseEscape = registerMenuScopeHost(containerEl.parentElement ?? containerEl, app);
		// An empty list's row carries a place for the brush mascot; bring each
		// one to life as it is drawn, here or on a sub-page (ui/mascot/mascotPlaces.ts).
		const stopMascots = watchEmptyListMascots(containerEl.parentElement ?? containerEl);
		this.endVisit = () => {
			endHistoryVisit?.();
			releaseEscape();
			stopMascots();
		};
	}

	/**
	 * Everything the pages show, as one string. It reads the whole settings
	 * object, not a list of the fields the pages read today, so a field added
	 * later cannot be missed; the uploaded pictures are left out (they can be
	 * large, and the rows draw them through the callouts and the icon signal).
	 */
	private signature(): string {
		const { app, plugin } = this.host;
		const { fromTheme, own, builtIn } = partitionCallouts(this.ctx);
		return JSON.stringify([
			calloutListsSignature(this.ctx, activeThemeLabel(app), getLocale(), {
				theme: fromTheme,
				user: own,
				builtin: builtIn,
			}),
			plugin.settings,
			plugin.settingsWriter.isFrozen,
			plugin.settingsWriter.status?.reason ?? null,
			languageDownloading(plugin),
			scanRunning(plugin),
			competitorsToOffer(app, plugin).map((competitor) => competitor.id),
		], (key, value: unknown) => (key === "userImages" ? undefined : value));
	}
}
