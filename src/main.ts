/**
 * main.ts — Plugin entry point.
 *
 * Bootstraps the entire plugin during Obsidian's `onload` lifecycle:
 * creates the CalloutRegistry, wires up CSSInjector, IconService,
 * and CalloutDiscovery, registers all commands, the settings tab, the
 * autocomplete provider, and the context menu.
 * Keep this file focused on lifecycle only — all feature logic lives in
 * the sub-modules under manager/, editor/, settings/, etc.
 */
import { MarkdownView, Notice, Platform, Plugin } from "obsidian";
import type {
	CalloutIcon,
	CalloutRenderRole,
	PluginData,
	PluginSettings,
} from "./types";
import { CalloutRegistry } from "./manager/CalloutRegistry";
import { CSSInjector } from "./manager/CSSInjector";
import { IconService } from "./icons/IconService";
import {
	clearMaterialFontStore,
	setMaterialFontStore,
} from "./icons/materialFontStore";
import { CalloutDiscovery } from "./manager/CalloutDiscovery";
import { removeLegacyStartupSnippet } from "./manager/legacyStartupSnippet";
import { runFirstRunDiscovery } from "./manager/firstRunDiscovery";
import { CalloutStudioSettingsTab } from "./settings/SettingsTab";
import { WelcomeModal } from "./settings/WelcomeModal";
import { CalloutEditor } from "./settings/CalloutEditor";
import { QuickInsertModal } from "./settings/QuickInsertModal";
import { CalloutAutoComplete } from "./editor/AutoComplete";
import { LinkSuggestDecorator } from "./editor/LinkSuggestDecorator";
import { registerContextMenu } from "./editor/contextmenu";
import { createCalloutViewPlugin } from "./editor/livepreview/calloutViewPlugin";
import { clearContentPillCache } from "./editor/livepreview/contentPillRender";
import { createHeadingGapField } from "./editor/livepreview/headingGapField";
import { beginStartupEntranceWindow } from "./editor/renderShared";
import { refreshAllCalloutEditors } from "./editor/livepreview/refresh";
import { OutlineDecorator } from "./outline/OutlineDecorator";
import { createCalloutReadingPostProcessor } from "./reading/calloutPostProcessor";
import {
	refreshFixedCommandNames,
	registerCalloutCommands,
	setFixedCommandEnabled as applyFixedCommandToggle,
	type FixedCommandDeps,
	type FixedCommandId,
} from "./editor/commands";
import { CustomCommandManager } from "./editor/CustomCommandManager";
import { CalloutStudioAPI } from "./api/PluginAPI";
import { PLUGIN_ICON_ID } from "./constants";
import { getLocale, setLocale, t } from "./i18n";
import { LocaleStore } from "./i18n/LocaleStore";

/**
 * How long the startup entrance animation window stays open. Long enough to
 * cover the initial FOUC render (and a beat of early scrolling) on a slow
 * mobile launch, short enough that ordinary interaction never animates.
 */
const STARTUP_ENTRANCE_MS = 3000;

export default class CalloutStudioPlugin extends Plugin {
	registry!: CalloutRegistry;
	cssInjector!: CSSInjector;
	api!: CalloutStudioAPI;
	autoComplete!: CalloutAutoComplete;
	customCommands!: CustomCommandManager;
	outlineDecorator!: OutlineDecorator;
	icons!: IconService;
	locales!: LocaleStore;
	private settingsTab!: CalloutStudioSettingsTab;
	private discovery!: CalloutDiscovery;
	private linkSuggestDecorator!: LinkSuggestDecorator;

	get settings(): PluginSettings {
		return this.registry.settings;
	}

	/** Backwards-compatible accessor used by SettingsTab/CalloutEditor. */
	get pruneSuspended(): boolean {
		return this.discovery.pruneSuspended;
	}
	set pruneSuspended(value: boolean) {
		this.discovery.pruneSuspended = value;
	}

	async onload() {
		// Was the UI already on screen when we loaded? True on mobile every
		// launch (plugins load after the note paints) and on desktop only for a
		// mid-session enable/reload or a lazy-loader — exactly the cases where
		// our DOM transforms arrive late and should animate in (see the startup
		// entrance window opened at the end of onload). Read before any await.
		const uiWasVisible = this.app.workspace.layoutReady;

		this.registry = new CalloutRegistry();

		// Startup fast path — synchronously re-apply last session's CSS from
		// localStorage BEFORE the first await, so on slow startups (mobile,
		// where the note renders before plugins finish loading) custom callout
		// styling lands as early as this plugin possibly can. See
		// StartupStyleCache for the full picture.
		this.cssInjector = new CSSInjector(this.app, this.registry);
		this.cssInjector.injectFromCache();

		// Load persisted data
		const savedData = (await this.loadData()) as Partial<PluginData> | null;
		this.registry.load(savedData);
		// A load-time migration that rewrote definitions is flushed right away,
		// so the cleaned-up list survives the next reload rather than waiting on
		// whatever incidental save happens to come first.
		if (this.registry.needsSaveAfterLoad()) {
			await this.saveSettings();
		}

		// Distinguish a brand-new install (no data.json yet) from an existing
		// user updating into this version. This drives WHERE the welcome screen
		// appears — see maybeShowWelcomeOnLaunch(). Computed once, cheaply, from
		// the data we already loaded.
		const isFreshInstall =
			savedData == null || Object.keys(savedData).length === 0;

		// UI locale follows the user's saved preference; "auto" (the default)
		// tracks Obsidian's interface language.
		//
		// Only English is bundled, so a translated UI first has to come off disk.
		// This is the one locale step that blocks: it is a single ~50 KB read,
		// it never touches the network, and it has to finish before the first
		// translated string below. It sits after injectFromCache() above, so the
		// startup CSS fast path is unaffected. Anything missing or outdated is
		// fetched later, in the background — see ensureLocale() at the end of
		// onload.
		this.locales = new LocaleStore(this.app, this.manifest);
		await this.locales.prepare(this.settings.language);
		setLocale(this.settings.language);

		// After setLocale, since this is the first user-facing string of the
		// session. Saved palettes that turned out to hold identical colors were
		// folded together during load — the callouts using them kept both their
		// appearance and their link, but one palette's NAME is gone, and that is
		// worth saying out loud rather than letting the user find a color
		// missing from the list later.
		const paletteMerges = this.registry.takePaletteMerges();
		if (paletteMerges.length > 0) {
			new Notice(
				t("notice.palettesMerged", {
					count: paletteMerges.length,
					names: paletteMerges.map((m) => m.from).join(", "),
				}),
				10000,
			);
		}

		// Full CSS inject now that the registry holds real definitions
		// (replaces the startup snapshot applied above).
		this.cssInjector.initialize();

		// Paint callout icons (Lucide/Material/emoji) directly into the DOM for
		// every rendered note. Material and emoji glyphs are baked into the DOM
		// here rather than drawn via CSS so they survive Obsidian's PDF export,
		// which clones the rendered DOM but drops our adopted stylesheet.
		this.registerMarkdownPostProcessor((el) => {
			this.cssInjector.paintIcons(el);
		});

		// Reading-view rendering for heading callouts and inline callouts.
		this.registerMarkdownPostProcessor(
			createCalloutReadingPostProcessor(this),
		);

		// Live Preview rendering for heading callouts and inline callouts.
		this.registerEditorExtension(createCalloutViewPlugin(this));

		// The heading "gap above the bar" spacer. A separate StateField because
		// block decorations can't come from a view plugin (see headingGapField).
		this.registerEditorExtension(createHeadingGapField(this));

		// Open the startup entrance window if the UI was already visible, so the
		// heading callouts, inline callouts, icons and fold chevrons that these render surfaces
		// are about to build animate in gently instead of snapping over the raw
		// text the user briefly saw. Done here — synchronously, before the first
		// render pass — so `body.cs-anim-window` and the flag are set in time.
		if (Platform.isMobile || uiWasVisible) {
			const closeEntrance = beginStartupEntranceWindow(activeDocument);
			const timer = window.setTimeout(closeEntrance, STARTUP_ENTRANCE_MS);
			this.register(() => {
				window.clearTimeout(timer);
				closeEntrance();
			});
		}

		// The picker's Material grid is drawn from a webfont; this lets it be
		// read back from the plugin folder instead of Google on every launch.
		setMaterialFontStore(this.app, this.manifest);

		// Sub-managers (composition keeps main.ts focused on lifecycle).
		this.icons = new IconService({
			app: this.app,
			manifest: this.manifest,
			registry: this.registry,
			cssInjector: this.cssInjector,
			saveSettings: () => this.saveSettings(),
		});
		this.discovery = new CalloutDiscovery({
			app: this.app,
			registry: this.registry,
			settings: this.settings,
			saveSettings: () => this.saveSettings(),
			refreshCallouts: () => this.refreshCallouts(),
			registerEvent: (ref) => this.registerEvent(ref),
		});

		// Remove the startup CSS snippet versions up to 2.5.0 left in the vault.
		// Deferred to layout-ready so its one `exists()` stat never sits on the
		// startup path. Delete this together with legacyStartupSnippet.ts in 3.0.0.
		this.app.workspace.onLayoutReady(() => {
			void removeLegacyStartupSnippet(this.app);
		});

		// Clean heading-callout titles in the Outline pane.
		this.outlineDecorator = new OutlineDecorator(this);
		this.app.workspace.onLayoutReady(() => this.outlineDecorator.attachAll());
		this.registerEvent(
			this.app.workspace.on("layout-change", () =>
				this.outlineDecorator.attachAll(),
			),
		);
		this.register(() => this.outlineDecorator.destroy());

		// The user's own commands, on top of the six fixed ones. Registering
		// them during onload is what makes them survive a restart or a
		// disable/enable — Obsidian tears every plugin command down on unload
		// by itself. The sweep re-derives the whole set from the registry, so
		// it doubles as the startup pass that drops commands whose callout is
		// gone.
		//
		// Subscribed BEFORE the save listener below, and that order is load
		// bearing: deleting a callout invalidates the commands that used it,
		// and both listeners then call saveSettings(). Each call snapshots the
		// settings as they stand at that moment, so if the save ran first it
		// would snapshot the list *including* the commands about to be pruned,
		// and two concurrent writes of different content would leave the file
		// to whichever finished last. Pruning first makes both snapshots
		// identical, so there is nothing to race over.
		this.customCommands = new CustomCommandManager(this);
		this.registry.onChange(() => this.customCommands.syncAll());
		this.customCommands.syncAll();

		// Re-inject CSS when registry changes. One call does both jobs:
		// inject() emits "css-change" itself, and only once the new CSS is
		// actually in place. (Scheduling a debounced inject *and* triggering
		// css-change separately ran the whole pass twice per mutation — the
		// trigger landed in our own css-change listener, which injects
		// immediately, and the debounced timer then repeated it 300ms later.)
		this.registry.onChange(() => {
			this.cssInjector.inject();
			// Icon/color/display-name edits must repaint outline items too.
			this.outlineDecorator.refreshAll();
			void this.saveSettings();
		});

		// Re-inject on theme/snippet change. Pass `false` so we don't re-emit
		// css-change in response to css-change — that would loop with other
		// plugins that also listen and re-emit (e.g. Style Settings). The
		// external css-change already re-renders open notes, so re-emitting is
		// both redundant and harmful here.
		this.registerEvent(
			this.app.workspace.on("css-change", () => {
				this.cssInjector.inject(false);
			}),
		);

		// Settings tab. Held onto so a locale arriving mid-session can re-render
		// it (see applyLocaleChange).
		this.settingsTab = new CalloutStudioSettingsTab(this.app, this);
		this.addSettingTab(this.settingsTab);

		// Dev/test convenience: from a terminal, `open "obsidian://callout-studio-welcome"`
		// re-opens the welcome modal on demand (bypasses the welcomeSeen flag).
		this.registerObsidianProtocolHandler("callout-studio-welcome", () => {
			void this.openWelcome();
		});

		// Commands
		registerCalloutCommands(this, this.commandDeps());

		// The ribbon is a second door to the same window, not a second
		// implementation: hiding the command leaves this one standing, and
		// hiding the ribbon leaves the command bindable.
		this.addRibbonIcon(PLUGIN_ICON_ID, t("quickInsert.title"), () => {
			this.openQuickInsert();
		});

		// Editor autocomplete on [! trigger
		this.autoComplete = new CalloutAutoComplete(this);
		this.registerEditorSuggest(this.autoComplete);

		// Clean heading-callout titles in the [[# link suggestion popup.
		// Installed on layout-ready so the core link suggester exists; our own
		// autocomplete is skipped (it renders callout suggestions itself).
		this.linkSuggestDecorator = new LinkSuggestDecorator(this);
		this.app.workspace.onLayoutReady(() =>
			this.linkSuggestDecorator.install([this.autoComplete]),
		);
		this.register(() => this.linkSuggestDecorator.uninstall());

		// Right-click context menu for callout blocks
		registerContextMenu(this);

		// Public API for other plugins
		this.api = new CalloutStudioAPI(this);

		// Load the icon packs this vault uses from disk, then fill in any
		// missing per-icon artwork. Background: neither blocks first paint,
		// and neither reaches the network unless artwork is genuinely absent.
		void this.icons.initialize();

		// Fetch the user's language if it is missing or older than this build.
		// Background, and a no-op on the ordinary launch: the file is normally
		// already on disk and already current, in which case nothing is
		// requested. Failure is silent by design — English is a working UI, and
		// the next launch tries again.
		void this.ensureLocale();

		// First-run vault discovery.
		//
		// Decoupled from initial render so onload stays fast. The flag is
		// only flipped *after* the chosen path completes, so an interrupted
		// startup (crash / reload mid-scan) safely re-runs next launch.
		//
		// - Small vaults: silent auto-scan in the background.
		// - Large vaults (>= HEAVY_VAULT_FILE_THRESHOLD): one-time modal
		//   asks the user before doing anything.
		//
		// On subsequent loads (firstRunCompleted=true) we just opportunistically
		// prune stale auto-created rows accumulated while typing in a previous
		// session.
		this.app.workspace.onLayoutReady(async () => {
			try {
				// Welcome first, so it never stacks on top of the first-run
				// scan modal (which only appears for large vaults).
				await this.maybeShowWelcomeOnLaunch(isFreshInstall);
				if (!this.settings.firstRunCompleted) {
					await runFirstRunDiscovery(this);
				} else {
					this.discovery.schedulePrune(2000);
				}
			} finally {
				this.discovery.registerIncrementalWatchers();
			}
		});
	}

	/**
	 * Make sure the saved language is downloaded, and apply it if it arrives.
	 *
	 * Returns whether the language is now usable, so the settings picker can
	 * report a failure; the startup caller ignores the result.
	 */
	async ensureLocale(): Promise<boolean> {
		const before = getLocale();
		const ok = await this.locales.ensure(this.settings.language);
		setLocale(this.settings.language);
		if (getLocale() !== before) this.applyLocaleChange();
		return ok;
	}

	/**
	 * Re-render the surfaces that snapshot translated text.
	 *
	 * Most of the UI calls `t()` as it draws, so it picks up a new locale for
	 * free. These do not: the settings tab is already on screen, the heading
	 * fold chevron bakes its tooltip into a CodeMirror widget, and Obsidian
	 * keeps a command's name — the user's own too, rendered by `describeCommand`
	 * — from when it was added. Called when a language is picked or lands late.
	 */
	applyLocaleChange(): void {
		// Only while on screen: re-rendering a detached container wastes work,
		// and the picker re-renders itself when the user picked the language.
		if (this.settingsTab?.containerEl.isConnected) this.settingsTab.display();
		refreshFixedCommandNames(this, this.commandDeps());
		this.customCommands.syncAll();
		this.refreshRenderModes();
	}

	/**
	 * The windows the fixed commands open. Built fresh on each call because
	 * `CalloutEditor` is single-use, and kept here so the ribbon and the
	 * command open the very same window.
	 */
	private commandDeps(): FixedCommandDeps {
		return {
			openEditor: () => new CalloutEditor(this),
			openQuickInsert: () => this.openQuickInsert(),
		};
	}

	/** Open the quick-insert window. Shared by the ribbon and its command. */
	openQuickInsert(): void {
		new QuickInsertModal(this).open();
	}

	/**
	 * Open the welcome/splash screen on demand, ignoring the `welcomeSeen`
	 * flag. Handy for testing — call it from the DevTools console:
	 *   app.plugins.plugins["callout-studio"].openWelcome()
	 */
	openWelcome(): Promise<void> {
		return new WelcomeModal(this).prompt();
	}

	/**
	 * First-run welcome routing, evaluated once at launch. The screen greets
	 * a brand-new install immediately, right after layout is ready — and only
	 * a brand-new install. A user who merely updated into this version (they
	 * already have a `data.json`) never sees it. It appears exactly once per
	 * fresh install: once `welcomeSeen` is persisted it is never shown again.
	 */
	private async maybeShowWelcomeOnLaunch(
		isFreshInstall: boolean,
	): Promise<void> {
		if (this.settings.welcomeSeen || !isFreshInstall) return;
		await this.showWelcomeOnce();
	}

	/**
	 * Open the welcome screen once. The `welcomeSeen` flag is persisted
	 * *before* opening (synchronously, ahead of any await) so an interrupted
	 * startup won't re-show it.
	 */
	private async showWelcomeOnce(): Promise<void> {
		this.registry.settings.welcomeSeen = true;
		await this.saveSettings();
		await new WelcomeModal(this).prompt();
	}

	onunload() {
		this.discovery?.destroy();
		this.cssInjector?.destroy();
		clearMaterialFontStore();
		clearContentPillCache();
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.registry.toSaveData());
	}

	/**
	 * Re-applies all callout styling and forces every open Markdown view to
	 * re-render. Use after any mutation that should be immediately visible.
	 */
	refreshCallouts(): void {
		// inject() emits "css-change" itself once the CSS is in place — a
		// second explicit trigger here would only re-enter our own listener
		// and run the whole pass again.
		this.cssInjector.inject();
		// A content pill's payload is rendered markdown and can itself hold a
		// callout token, so a registry edit can change what a cached payload
		// should look like. Dropped before the rebuild below re-renders them.
		clearContentPillCache();
		// Rebuild Live Preview heading/inline decorations: registry changes
		// don't touch the document, so CodeMirror won't rebuild them itself.
		refreshAllCalloutEditors();
	}

	/**
	 * Fully re-render both preview modes. Used when a render-role toggle
	 * flips: unlike refreshCallouts(), this also re-runs reading-view
	 * post-processors (via previewMode.rerender) so already-baked inline
	 * callouts and heading callouts are added or stripped immediately.
	 */
	refreshRenderModes(): void {
		refreshAllCalloutEditors();
		for (const leaf of this.app.workspace.getLeavesOfType("markdown")) {
			const view = leaf.view;
			if (view instanceof MarkdownView) view.previewMode?.rerender(true);
		}
	}

	// ── Forwarders that keep the public plugin surface stable ──

	restyleUncustomizedFallbackRows(): number {
		return this.discovery.restyleUncustomizedFallbackRows();
	}

	isKnownZeroUsageFallback(id: string): boolean {
		return this.discovery.isKnownZeroUsageFallback(id);
	}

	/**
	 * Turn one of the six fixed commands on or off, from the command
	 * builder. {@link registerCalloutCommands} only runs at startup, so this
	 * is what (un)registers the command with Obsidian immediately.
	 */
	async setFixedCommandEnabled(
		id: FixedCommandId,
		enabled: boolean,
	): Promise<void> {
		applyFixedCommandToggle(this, this.commandDeps(), id, enabled);
		await this.saveSettings();
	}

	addUnknownCalloutsAsFallback(unknownIds: string[]): number {
		return this.discovery.addUnknownCalloutsAsFallback(unknownIds);
	}

	suppressCalloutRediscovery(ids: string[]): void {
		this.discovery.suppressRediscovery(ids);
	}

	schedulePruneUnusedFallbacks(delayMs?: number): void {
		this.discovery.schedulePrune(delayMs);
	}

	async pruneUnusedFallbacks(): Promise<number> {
		return this.discovery.pruneUnused();
	}

	async runVaultScan(markFirstRun = false): Promise<number> {
		return this.discovery.runVaultScan(markFirstRun);
	}

	onIconCacheChange(cb: () => void): () => void {
		return this.icons.onChange(cb);
	}

	async ensureIconArtwork(icon: CalloutIcon): Promise<void> {
		return this.icons.ensureArtwork(icon);
	}

	async ensureIconArtworkFor(icons: readonly CalloutIcon[]): Promise<void> {
		return this.icons.ensureArtworkFor(icons);
	}

	hasIconFetchFailed(icon: CalloutIcon, role: CalloutRenderRole): boolean {
		return this.icons.hasFailed(icon, role);
	}
}
