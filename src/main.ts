/**
 * main.ts — Plugin entry point.
 *
 * Bootstraps the entire plugin during Obsidian's `onload` lifecycle:
 * creates the CalloutRegistry, wires up CSSInjector, IconService,
 * and manual discovery, registers all commands, the settings tab, the
 * autocomplete provider, and the context menu.
 * Keep this file focused on lifecycle only — all feature logic lives in
 * the sub-modules under manager/, editor/, settings/, etc.
 */
import { Notice, Platform, Plugin } from "obsidian";
import type { CalloutIcon, CalloutRenderRole, PluginSettings } from "./types";
import { CalloutRegistry } from "./manager/CalloutRegistry";
import { CSSInjector } from "./manager/CSSInjector";
import { IconService } from "./icons/IconService";
import {
	clearMaterialFontStore,
	setMaterialFontStore,
} from "./icons/materialFontStore";
import { ManualCalloutDiscovery } from "./manager/ManualCalloutDiscovery";
import type { SettingsWriter } from "./manager/SettingsWriter";
import { createSettingsWriter } from "./manager/settingsWriterHost";
import { saveSettingsWithFeedback } from "./manager/settingsSaveFeedback";
import { DeviceLocalStore } from "./manager/DeviceLocalStore";
import { reportLegacyDiscoveryMigration } from "./manager/legacyDiscoveryNotices";
import { loadSettingsInto } from "./manager/settingsBoot";
import { ReloadQueue } from "./manager/reloadQueue";
import { registerThemeAppearance } from "./manager/theme/themeAppearanceSync";
import { removeLegacyStartupSnippet } from "./manager/legacyStartupSnippet";
import { runLaunchSequence } from "./manager/launchSequence";
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
import {
	refreshCallouts,
	refreshRenderModes,
} from "./editor/renderRefresh";
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
	settingsTab!: CalloutStudioSettingsTab;
	discovery!: ManualCalloutDiscovery;
	settingsWriter!: SettingsWriter;
	/** Only local UI preferences and a prior-install marker. */
	localState!: DeviceLocalStore;
	/** Re-derives the theme's overlay rows — see registerThemeAppearance. */
	refreshThemeAppearance!: () => void;
	/** Adoption of another device's `data.json` — serialized, and retried when
	 * a modal hands the registry back. See manager/reloadQueue.ts. */
	private reloads!: ReloadQueue;
	private linkSuggestDecorator!: LinkSuggestDecorator;

	get settings(): PluginSettings {
		return this.registry.settings;
	}

	/** Backwards-compatible accessor used by SettingsTab/CalloutEditor. */
	private editingSettings = false;
	get settingsEditOpen(): boolean {
		return this.editingSettings;
	}
	set settingsEditOpen(value: boolean) {
		this.editingSettings = value;
		// One of two seams that hand the registry back; see manager/reloadQueue.ts.
		if (!value) this.reloads?.release();
	}

	/**
	 * `data.json` was rewritten by something other than us.
	 *
	 * Obsidian only calls this because the method exists — `Plugin.loadData`
	 * starts tracking the file's mtime only when it is defined. The work is in
	 * `manager/settingsBoot.ts`, including why a deferral is needed and what
	 * this hook cannot cover.
	 */
	async onExternalSettingsChange(): Promise<void> {
		await this.reloads.run();
	}

	async onload() {
		// Was the UI already on screen when we loaded? True on mobile every
		// launch (plugins load after the note paints) and on desktop only for a
		// mid-session enable/reload or a lazy-loader — exactly the cases where
		// our DOM transforms arrive late and should animate in (see the startup
		// entrance window opened at the end of onload). Read before any await.
		const uiWasVisible = this.app.workspace.layoutReady;

		this.registry = new CalloutRegistry();

		// Restore cached CSS before awaiting disk so mobile keeps its prior styles.
		this.cssInjector = new CSSInjector(this.app, this.registry);
		this.cssInjector.injectFromCache();

		// Every write to data.json goes through here — coalesced, and skipped
		// when the payload is byte-identical to the last one that landed. Built
		// before the first save below, which is the load-migration flush.
		this.settingsWriter = createSettingsWriter(this);

		// Load saved definitions and device-only UI preferences.
		this.localState = new DeviceLocalStore(this.app);
		this.reloads = new ReloadQueue(this);
		// The other seam. Cheap: a no-op unless a reload is actually waiting.
		this.registry.onPreviewChange(() => this.reloads.release());
		const legacyRecovery = await this.localState.archiveLegacyDiscovery(this.manifest);
		if (this.settingsWriter.isDestroyed) return;
		const boot = await loadSettingsInto(this);
		if (this.settingsWriter.isDestroyed) return;

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
		if (this.settingsWriter.isDestroyed) return;
		setLocale(this.settings.language);
		reportLegacyDiscoveryMigration(legacyRecovery);

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

		// Refresh ownership and artwork for existing types without adding rows.
		this.refreshThemeAppearance = registerThemeAppearance(this);

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
		this.discovery = new ManualCalloutDiscovery({
			app: this.app,
			registry: this.registry,
			settingsWriter: this.settingsWriter,
			themeIds: () => this.cssInjector.themeCallouts().themeDefinedIds(),
			canApply: () => !this.settingsEditOpen && !this.registry.hasPreviewDefinition(),
			onSettled: () => this.reloads.release(),
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

		// Register saved commands before the save listener. Missing targets stay
		// stored and paused until a manual discovery or settings load restores them.
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

		// Confirm the fresh install and greet the user —
		// decoupled from first render so onload stays fast. See
		// manager/launchSequence.ts for why those three are one function.
		this.app.workspace.onLayoutReady(() => {
			void runLaunchSequence(this, boot);
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
		if (this.settingsWriter.isDestroyed) return false;
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

	onunload() {
		this.discovery?.destroy();
		this.settingsWriter?.destroy();
		this.reloads?.destroy();
		this.cssInjector?.destroy();
		clearMaterialFontStore();
		clearContentPillCache();
	}

	saveSettings(): Promise<void> {
		return saveSettingsWithFeedback(this, () => this.reloads?.release());
	}

	/** @see editor/renderRefresh.ts */
	refreshCallouts(): void {
		refreshCallouts(this);
	}

	/** @see editor/renderRefresh.ts */
	refreshRenderModes(): void {
		refreshRenderModes(this.app);
	}

	// ── Forwarders that keep the public plugin surface stable ──

	restyleUncustomizedFallbackRows(): number {
		return this.registry.restyleUncustomizedFallbackRows();
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

	runVaultScan(): Promise<number> {
		return this.discovery.run();
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
