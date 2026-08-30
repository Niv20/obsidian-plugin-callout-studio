/**
 * manager/CSSInjector.ts — Generates and injects dynamic CSS for all callouts.
 *
 * Reads every CalloutDefinition from the registry and writes a single
 * `<style>` element into the document head with per-callout CSS custom
 * properties (colors, icon offsets, sizes). A re-entrancy latch keeps the
 * `css-change` this emits from starting a second pass through the plugin's own
 * listener.
 *
 * Deliberately touches no webfont. A Material icon reaches a rendered callout
 * as a `mask-image` over the SVG the pack store cached, never as a glyph, so
 * the Material Symbols families are the icon *picker's* business — `PackPanel`
 * asks for one when the user opens that source, which is the explicit action
 * the network policy requires. An injector that warmed a family per pass would
 * fetch from fonts.gstatic.com on every startup for artwork it does not draw.
 */
import { setIcon } from "obsidian";
import type { App } from "obsidian";
import type {
	CalloutDefinition,
	CalloutRenderRole,
} from "../types";
import { CALLOUT_RENDER_ROLES } from "../types";
import { isDefaultIconAdjust, resolveIconAdjust } from "../utils/iconAdjust";
import { renderIconInto } from "../icons/renderIcon";
import { createIconResolver } from "../icons/resolver";
import type { IconResolver } from "../icons/types";
import {
	bgGradientCss,
	DEFAULT_TEXT_COLOR_DARK,
	DEFAULT_TEXT_COLOR_LIGHT,
} from "../utils/colorUtils";
import {
	accentDeclarations,
	ownAccentDeclarations,
	needsDarkBlock,
} from "./accentDeclarations";
import { resolveBgAlpha } from "../utils/bgTintAlpha";
import { OBSIDIAN_CALLOUT_VAR } from "../constants";
import {
	applyTitleGradient,
	clearGradientChars,
} from "../reading/gradientTitleText";
import {
	CSS_CM_WIDGET,
	CSS_FOLD_ARROW,
	CSS_HEADING_LINE,
	CSS_HEADING_TITLE,
	CSS_HEADING_TOKEN,
	CSS_CALLOUT_LEAD,
	CSS_INLINE_TOKEN,
	CSS_REF_TOKEN,
	CSS_TOKEN_ICON,
	CSS_TOKEN_NAME,
	paintRoleIcon,
	resolveCalloutDef,
	shouldRenderToken,
} from "../editor/renderShared";
import { refreshAllCalloutEditors } from "../editor/livepreview/refresh";
import { obsidianCalloutAttrId } from "../utils/calloutId";
import { coreIconValue, importCoreIconSvg } from "./css/coreIcon";
import { StudioWeightCache } from "./theme/StudioWeightCache";
import type { ThemeCalloutStore } from "./theme/ThemeCalloutStore";
import { generateFallbackCSS } from "./css/fallbackCSS";
import { bgImageFor, bgProps, type BgLayer } from "./css/backgroundProps";
import { themeSurfaceCSS } from "./css/themeSurfaceCSS";
import { calloutIconProp } from "./css/calloutIconProp";
import { emojiOverrideCSS, iconOverrideCSS } from "./css/iconOverrides";
import { transparentBorderProps } from "./css/transparentBorder";
import {
	calloutSelAt,
	calloutSelDeferring,
	tokenAttrSel,
} from "../utils/calloutSelector";
import { coreAccentShimCSS } from "./css/coreAccentShim";
import { coreAccentDialect } from "../utils/calloutColorFormat";
import type { CalloutRegistry } from "./CalloutRegistry";
import { StartupStyleCache } from "./StartupStyleCache";

const STYLE_SHEET_REGISTRY_KEY = "__calloutStudioStyleSheet";
type RegistryWindow = Window & {
	[STYLE_SHEET_REGISTRY_KEY]?: CSSStyleSheet;
};

const STYLE_EL_ID = "callout-studio-dynamic-css";

export class CSSInjector {
	private styleSheet: CSSStyleSheet | null = null;
	private styleDoc: Document | null = null;
	private styleEl: HTMLStyleElement | null = null;
	/**
	 * The CSS text currently installed in BOTH targets, or null when that is
	 * unknown (nothing written yet, or a target was just rebound and may hold
	 * someone else's text).
	 *
	 * Injects are far more frequent than actual CSS changes: an icon download
	 * landing, a prune pass that removed nothing, another plugin's css-change,
	 * and every step of a multi-callout import all arrive here with output
	 * identical to what is already installed. Ending such a pass in
	 * `workspace.trigger("css-change")` is not free — core answers it by
	 * running `cm.dispatch(clearCache)` + `editor.refresh()` in EVERY open
	 * editor and re-rendering reading views, which on mobile is a whole-note
	 * relayout and the reason the view visibly jumps. Comparing first keeps
	 * that cost tied to real changes.
	 *
	 * Must be nulled whenever a style target is (re)bound — see ensureStyleEl.
	 */
	private lastCssText: string | null = null;

	/**
	 * How many times `.callout` is repeated in the selectors emitted for the
	 * callout currently being written — the derived studio weight while a
	 * studio callout is being written, 1 otherwise.
	 *
	 * Ambient rather than a parameter because the selector is built in a dozen
	 * helpers below (`iconHiddenCSS`, the three icon overrides, the transform,
	 * the title sweep, the fold arrow, `printGradientCSS`), and threading a
	 * number through all of them would cost more than the feature buys. Safe
	 * because `generateCalloutCSS` is synchronous and one callout finishes
	 * before the next begins; it sets this on entry and puts it back before
	 * returning.
	 */
	private emitWeight = 1;

	/**
	 * The `!important` suffix the callout currently being written carries —
	 * `" !important"` in studio mode, `""` otherwise. Ambient for exactly the
	 * same reason as {@link emitWeight}, and set and cleared beside it.
	 */
	private emitImportant = "";

	/**
	 * The per-callout selector base, at whatever weight is currently in force.
	 * Every emitter goes through this rather than `calloutSelAt` directly.
	 */
	private sel(id: string, themePrefix = ""): string {
		return calloutSelAt(id, this.emitWeight, themePrefix);
	}
	private injecting = false;
	private registry: CalloutRegistry;
	private app: App;
	private startupCache: StartupStyleCache;
	/** Artwork lookup for both the CSS masks and the DOM export copies. */
	private icons: IconResolver;

	constructor(app: App, registry: CalloutRegistry) {
		this.app = app;
		this.registry = registry;
		this.icons = createIconResolver(registry);
		this.startupCache = new StartupStyleCache(app);
		this.studioWeights = new StudioWeightCache(app);
	}
	private readonly studioWeights: StudioWeightCache;

	/**
	 * The one theme scan: studio mode's selector weight, and the settings tab's
	 * list of the callout types the theme adds. Shared rather than rebuilt, so
	 * what the list shows and what the CSS was emitted against cannot disagree.
	 */
	themeCallouts(): ThemeCalloutStore {
		return this.studioWeights.themeCallouts();
	}

	initialize(): void {
		this.ensureStyleSheet();
		this.inject();
	}

	/**
	 * Startup fast path: synchronously re-apply the CSS snapshot cached by the
	 * previous session (see StartupStyleCache). Called as the very first step
	 * of plugin onload, BEFORE `loadData()` is awaited, so styling lands
	 * without waiting on disk IO or CSS generation. The registry is still
	 * empty at this point — no css-change is emitted and no icons are painted;
	 * the real inject() replaces this snapshot moments later.
	 */
	injectFromCache(): void {
		const cached = this.startupCache.loadCachedCss();
		if (!cached) return;
		this.ensureStyleSheet();
		if (this.styleSheet) this.styleSheet.replaceSync(cached);
		this.ensureStyleEl();
		if (this.styleEl) this.styleEl.textContent = cached;
	}

	private ensureStyleSheet(): void {
		if (this.styleSheet) return;
		if (!("adoptedStyleSheets" in activeDocument)) return;

		const registryWindow = window as RegistryWindow;
		const existing = registryWindow[STYLE_SHEET_REGISTRY_KEY];
		if (existing) {
			this.styleSheet = existing;
			// Adopted from another instance: its contents are not ours to
			// assume, so the next inject must write unconditionally.
			this.lastCssText = null;
			return;
		}

		const doc = activeDocument;
		// Construct the sheet using the target document's window realm.
		// Using the global CSSStyleSheet constructor when activeDocument belongs
		// to a pop-out window (a different realm) causes a
		// "Sharing constructed stylesheets in multiple documents" error in older
		// Electron builds where cross-realm sheet adoption is not permitted.
		const win = doc.defaultView ?? window;
		const sheet = new win.CSSStyleSheet();

		try {
			doc.adoptedStyleSheets = [...doc.adoptedStyleSheets, sheet];
		} catch {
			// Fallback: existing sheets in adoptedStyleSheets may have been
			// adopted by a different document (e.g. orphaned from a closed
			// pop-out). Replace the array with only our sheet.
			doc.adoptedStyleSheets = [sheet];
		}

		registryWindow[STYLE_SHEET_REGISTRY_KEY] = sheet;
		this.styleSheet = sheet;
		this.styleDoc = doc;
		// Brand new and empty — nothing installed to compare against.
		this.lastCssText = null;
	}

	/**
	 * Ensure a real `<style>` element exists in the MAIN window's <head>.
	 *
	 * This is the critical part for PDF export: Obsidian's "Export to PDF"
	 * renders in a context that honors `<style>`/snippet CSS in <head> but
	 * IGNORES `adoptedStyleSheets` (constructed stylesheets). So writing the same
	 * CSS into a `<style>` element is what makes callout colors and material/emoji
	 * icons actually appear in exported PDFs.
	 */
	private ensureStyleEl(): void {
		if (this.styleEl && this.styleEl.isConnected) return;
		// Past this point the element is being (re)bound — a fresh one is empty
		// and an adopted one holds text we did not write, so either way the
		// no-op guard in injectNow must not trust its cached copy.
		this.lastCssText = null;
		// Use the main renderer document (where Export to PDF operates), not
		// activeDocument (which may transiently be a pop-out window). The
		// workspace container always lives in the main window, so its
		// ownerDocument is the main renderer document.
		const doc = this.app.workspace.containerEl.ownerDocument;
		const existing = doc.getElementById(STYLE_EL_ID);
		if (existing instanceof HTMLStyleElement) {
			this.styleEl = existing;
			return;
		}
		// Runtime-generated per-callout CSS in a real <style> tag: PDF export needs it
		// because adoptedStyleSheets isn't printed (see class doc above), so it can't
		// live in styles.css. The bare global createEl is deliberate — document.createElement
		// trips obsidianmd/prefer-create-el, and a member `doc.createEl("style")` trips
		// obsidianmd/no-forbidden-elements; the global helper trips neither.
		const el = createEl("style");
		el.id = STYLE_EL_ID;
		doc.head.appendChild(el);
		this.styleEl = el;
	}

	/**
	 * Regenerate and apply all callout CSS.
	 *
	 * The `injecting` latch makes this re-entrancy-safe: emitting `css-change`
	 * below lands back here through the plugin's own listener, and that nested
	 * call must be a no-op rather than a second full pass. `finally` is
	 * load-bearing — a throw anywhere in the pass (a malformed colour, an
	 * export realm without `setIcon`) would otherwise leave the latch stuck on
	 * and silently drop every later inject for the rest of the session.
	 */
	inject(emitCssChange = true): void {
		if (this.injecting) return;
		this.injecting = true;
		try {
			this.injectNow(emitCssChange);
		} finally {
			this.injecting = false;
		}
	}

	private injectNow(emitCssChange: boolean): void {
		this.ensureStyleSheet();
		this.studioWeights.beginPass();

		const callouts = this.registry.getAll();
		const rules: string[] = [
			"/* Auto-generated by Callout Studio — do not edit manually */",
		];

		// Global callout style rules
		rules.push(this.generateGlobalStyleCSS());

		// The DOM inline-SVG/emoji copies that paintIcons bakes in are the icons
		// shown in PDF export (print). Hide them on screen (live view uses the
		// ::after icon above); `@media screen` means they reveal themselves in
		// print, where they render far more reliably than a CSS mask.
		rules.push(
			"@media screen {\n" +
				".callout > .callout-title > .callout-icon > .cs-export-icon { display: none; }\n" +
				"}\n" +
				// Size the baked emoji copy via a class instead of an inline style;
				// this rule ships in the same <style> element Obsidian honors when
				// exporting to PDF (see bakeEmojiExportIcon).
				".callout > .callout-title > .callout-icon > span.cs-export-icon { font-size: var(--icon-size, 1.2em); line-height: 1; }",
		);

		for (const def of callouts) {
			rules.push(this.generateCalloutCSS(def));
		}

		// Fallback rule: style unrecognized callout IDs with the fallback callout
		rules.push(this.generateFallbackCSS(callouts));

		const cssText = rules.join("\n\n");
		// Write the CSS to BOTH targets:
		//  1. adoptedStyleSheets — fast path for live Reading view / Live Preview
		//     (and pop-out windows).
		//  2. a real <style> in <head> — the ONLY one Obsidian's PDF export
		//     honors (it ignores adoptedStyleSheets), so this is what makes
		//     colors + material/emoji icons render correctly in exported PDFs.
		// Everything below the generation step is conditional on the text having
		// actually moved (see lastCssText): a full stylesheet swap forces a
		// global style recalc, the localStorage write is synchronous, and the
		// css-change at the end makes core rebuild every open editor. Most
		// injects reach here with byte-identical output and deserve none of it.
		this.ensureStyleEl();
		const cssChanged = cssText !== this.lastCssText;
		if (cssChanged) {
			if (this.styleSheet) this.styleSheet.replaceSync(cssText);
			if (this.styleEl) this.styleEl.textContent = cssText;
			this.lastCssText = cssText;

			// Snapshot the same text for next launch's startup fast path (see
			// StartupStyleCache). Skipped while a transient live-preview
			// definition is registered: that CSS describes an unsaved draft,
			// which toSaveData() already goes out of its way to keep off disk,
			// and hovering a colour in the editor's palette menu would otherwise
			// cost a synchronous localStorage write each time. Clearing the
			// preview re-injects, which persists the real CSS again.
			if (!this.registry.hasPreviewDefinition()) {
				this.startupCache.persist(cssText);
			}
		}

		// Re-paint DOM icons: keeps Lucide icons in sync after edits, and bakes
		// the hidden material/emoji export fallback nodes (see paintIcon).
		this.paintIcons();

		// The one surface that sweep deliberately skips is CodeMirror's widget
		// DOM, so ask CodeMirror to rebuild it the supported way. Not optional:
		// several inject() callers reach us with no other refresh of their own
		// (pack artwork read on startup, a Material download landing,
		// registry.onChange from the API or from discovery), and without this
		// their Live Preview pills would keep drawing the pencil placeholder
		// until the next edit. A widget whose renderKey is unchanged is reused
		// as-is, so a rebuild that changes nothing costs no DOM work.
		refreshAllCalloutEditors();

		// Trigger Obsidian to re-render callouts with updated styles — but only
		// when *we* are the source of the change, and only when there IS a
		// change. When reacting to an external css-change (theme/snippet, or
		// another plugin), re-emitting would create a feedback loop with other
		// css-change listeners that also re-emit (e.g. Style Settings), causing
		// its settings UI to flicker endlessly. And core answers this event by
		// wiping every editor's widget cache and forcing a re-measure, so
		// emitting it for CSS that did not move buys a whole-note relayout —
		// the mobile "screen jumps" — for nothing. paintIcons and the editor
		// refresh above still run either way: artwork can land while the
		// generated CSS stays identical.
		if (emitCssChange && cssChanged) {
			this.app.workspace.trigger("css-change");
		}
	}

	/**
	 * The accent declarations for one theme mode, for any surface that carries
	 * a callout's colors — see `manager/accentDeclarations.ts` for which
	 * variables those are and why.
	 */
	private accentProps(
		def: CalloutDefinition,
		mode: "light" | "dark",
		important = false,
		imposed = false,
	): string[] {
		return accentDeclarations(
			mode === "dark" ? def.colorDark : def.colorLight,
			this.themeAccentVar(def),
			important ? " !important" : "",
			imposed,
			this.studioWeights.dialect(),
			mode,
		);
	}

	/**
	 * The Obsidian variable this def should defer to, or undefined when it
	 * carries its own color. Only an unmodified built-in defers — the moment the
	 * user edits one it becomes their color, theme or no theme.
	 */
	private themeAccentVar(def: CalloutDefinition): string | undefined {
		if (!this.registry.isUnmodifiedBuiltIn(def)) return undefined;
		return OBSIDIAN_CALLOUT_VAR[def.id];
	}

	/**
	 * The core declarations to restate for one def, or `""` when core and the
	 * active styling agree on the spelling and nothing is broken.
	 */
	private coreAccentShim(def: CalloutDefinition): string {
		const ids = [def.id, ...(def.aliases ?? [])];
		const claimed = new Set<string>(this.studioWeights.dialect().unguarded);
		for (const id of ids) {
			for (const prop of this.studioWeights
				.themeCallouts()
				.claimedProps(obsidianCalloutAttrId(id))) {
				claimed.add(prop);
			}
		}
		const sels = ids.map((id) => calloutSelDeferring(id));
		return coreAccentShimCSS({
			selectors: sels.join(",\n"),
			titleSelectors: sels.map((s) => `${s} > .callout-title`).join(",\n"),
			dialect: this.studioWeights.dialect(),
			core: coreAccentDialect(),
			ownsAccentVariable: this.themeAccentVar(def) === undefined,
			ownsBackground:
				def.transparentBg === true ||
				def.bgGradient !== undefined ||
				def.bgColorLight !== undefined ||
				def.bgColorDark !== undefined,
			claims: (prop) => claimed.has(prop),
		});
	}

	/**
	 * The subset this plugin owns, without Obsidian's `--callout-color`. Used on
	 * the heading-bar / inline-pill / ref token DOM, which is ours and where
	 * core's variable would go unread.
	 */
	ownAccentProps(
		def: CalloutDefinition,
		mode: "light" | "dark",
		important = false,
	): string[] {
		return ownAccentDeclarations(
			mode === "dark" ? def.colorDark : def.colorLight,
			this.themeAccentVar(def),
			important ? " !important" : "",
			this.studioWeights.dialect(),
			mode,
		);
	}

	/**
	 * The alpha this def's background is painted at in one mode, or null when it
	 * is painted opaque — see `resolveBgAlpha` (utils/bgTintAlpha.ts), which owns
	 * the solve and the cap that keeps a nested stack inside this callout's own
	 * accent. Its own module per `tests/repoSourceRules.test.ts`, this file being
	 * one of the oversized ones that ratchet asks to shrink rather than grow.
	 */
	private bgAlphaFor(
		def: CalloutDefinition,
		mode: "light" | "dark",
	): number | null {
		return resolveBgAlpha(def, mode);
	}

	/**
	 * Background declarations for one theme mode, and the gradient layer that
	 * rides on top of them. Both moved to `manager/css/backgroundProps.ts`, which
	 * owns the tint solve and the `transparentBg` short-circuit; these stay as
	 * one-line delegations because `FallbackCssContext` and the CSS suites reach
	 * them through the injector.
	 */
	private bgProps(
		def: CalloutDefinition,
		mode: "light" | "dark",
		important = false,
	): string[] {
		return bgProps(def, mode, important);
	}

	private bgImageFor(
		def: CalloutDefinition,
		mode: "light" | "dark",
	): BgLayer | null {
		return bgImageFor(def, mode);
	}

	/**
	 * The text sweep for one mode, or null when the def has no gradient, its
	 * text sweep is off, or the accent-strength end color is missing.
	 *
	 * Runs from the mode's ACCENT color to `textToColor*` — deliberately not
	 * the background's own stops, which are pale tints designed to sit behind
	 * text and would be all but invisible painted through the glyphs.
	 */
	private textGradientCss(
		def: CalloutDefinition,
		mode: "light" | "dark",
	): string | null {
		const g = def.bgGradient;
		if (!g?.textGradient) return null;
		const to = mode === "dark" ? g.textToColorDark : g.textToColorLight;
		if (!to) return null;
		const from = mode === "dark" ? def.colorDark : def.colorLight;
		return bgGradientCss(from, to, g);
	}

	/**
	 * Declarations that paint `image` through an element's own glyphs while
	 * keeping what it already had behind them — two background layers: the
	 * sweep clipped to the text, over `under` clipped normally.
	 *
	 * The trailing `border-box` is load-bearing: `background-clip` governs
	 * `background-color` too (via the LAST layer's value), so a lone
	 * `background-clip: text` would clip an element's solid background to its
	 * text as well — erasing the heading callout and the inline callout. Keeping a
	 * final `none` layer gives the color a `border-box` clip to use.
	 *
	 * One sweep is declared per element, never per child, so it runs across
	 * the whole title in one pass instead of restarting on every glyph.
	 * `-webkit-text-fill-color` is what hides the flat text under the sweep;
	 * `color` is left alone so icons keep tracking it through `currentColor`.
	 */
	private textSweepProps(
		image: string,
		under: string | null,
		imp = "",
	): string[] {
		return [
			`  background-image: ${image}, ${under ?? "none"}${imp};`,
			`  -webkit-background-clip: text, border-box${imp};`,
			`  background-clip: text, border-box${imp};`,
			`  -webkit-text-fill-color: transparent${imp};`,
			`  -webkit-print-color-adjust: exact${imp};`,
			`  print-color-adjust: exact${imp};`,
		];
	}

	/**
	 * The text-sweep rules for one render role, light + dark. Mirrors the
	 * background rules' explicit-undefined cascade: the light rule is left
	 * unscoped so it keeps applying in dark mode when the def has no
	 * dark-specific colors, and an identical dark rule is skipped as a no-op.
	 *
	 * `ownsBackground` must say whether the swept element is the one carrying
	 * the callout's background layer — the pill root does, a title span nested
	 * inside a painted bar does not. Re-declaring the layer under an element
	 * that never had it would squeeze a second copy of the gradient into that
	 * element's own (much narrower) box, on top of the real one.
	 */
	private textSweepRules(
		def: CalloutDefinition,
		selectorsFor: (themePrefix: string) => string,
		ownsBackground: boolean,
		imp = "",
	): string[] {
		const light = this.textGradientCss(def, "light");
		if (!light) return [];
		const under = (mode: "light" | "dark"): string | null =>
			ownsBackground ? (this.bgImageFor(def, mode)?.image ?? null) : null;
		const lightProps = this.textSweepProps(light, under("light"), imp);
		const rules = [`${selectorsFor("")} {\n${lightProps.join("\n")}\n}`];
		const dark = this.textGradientCss(def, "dark");
		if (dark) {
			const darkProps = this.textSweepProps(dark, under("dark"), imp);
			if (darkProps.join("") !== lightProps.join("")) {
				rules.push(
					`${selectorsFor(".theme-dark ")} {\n${darkProps.join("\n")}\n}`,
				);
			}
		}
		// PDF export: Chromium's print engine does not support
		// `background-clip: text` — in print the sweep paints as an unclipped
		// block over the title instead of through the glyphs, and the
		// transparent text fill leaves garbage. There is no way to make the
		// technique itself print, so print drops the sweep entirely and the
		// per-grapheme solid colors take over (spans painted by
		// gradientTitleText.ts + the `.cs-grad-ch` print rule in styles.css).
		// The pill's own background gradient is restored by its print-only
		// ::before (see pillPrintGradientCSS), never by this element again.
		// Both theme prefixes are grouped so this later rule outranks the
		// screen rules above in either mode by source order / specificity.
		//
		// It carries the SAME importance as the screen rules it cancels, and
		// must: these two blocks have identical specificity and are resolved on
		// source order, so an `!important` sweep above an ordinary reset here
		// would win in print too — leaving the unclipped block over the title
		// and the transparent fill this reset exists to undo.
		rules.push(
			`@media print {\n${selectorsFor("")},\n${selectorsFor(".theme-dark ")} {\n` +
				`  background-image: none${imp};\n` +
				`  -webkit-background-clip: border-box${imp};\n` +
				`  background-clip: border-box${imp};\n` +
				`  -webkit-text-fill-color: currentColor${imp};\n` +
				`}\n}`,
		);
		return rules;
	}

	/** See `accentDeclarations.needsDarkBlock`, which owns the rule. */
	private needsDarkBlock(def: CalloutDefinition): boolean {
		const d = this.studioWeights.dialect();
		return needsDarkBlock(def, this.themeAccentVar(def), d);
	}

	generateCalloutCSS(def: CalloutDefinition, standalone = false): string {
		// The theme, or a CSS snippet, owns this one. Guarding the whole
		// function rather than its one call site means every block below goes
		// quiet together: accent variables, --callout-icon, background and
		// gradient, content colour, the ::after icon override that hides core's
		// own <svg>, icon transforms, title sweeps, the fold arrow, the print
		// ::before — and the alias copies of all of them.
		//
		// There is no exception, and there used to be one: `hideIcon` still
		// emitted its `display: none`. Under an absolute rule that is an
		// override like any other. The flag is preserved on the row and applies
		// again the moment this plugin is painting the callout.
		const theme = this.registry.standsDown(def);
		// Both axes are set before the early return, so a leftover value cannot
		// reach the next callout even if something below throws. See
		// manager/theme/studioWeight.ts for why it takes both.
		this.emitWeight = theme ? 1 : this.studioWeights.resolve();
		this.emitImportant = theme ? "" : " !important";
		// Nothing at all, and that is now literal: the `.cs-*` token rules used
		// to be emitted here so a theme-owned callout could still render as a
		// heading and a pill. Those two formats are gone for a theme callout
		// (see `renderShared.shouldRenderToken`), so there is no DOM left to
		// paint and no exception left to make.
		if (theme) return "";
		const hidesIcon = def.hideIcon === true;
		const imp = this.emitImportant;

		// Emitting `--callout-icon` for a hidden icon would be harmless (the box
		// it lands in is display:none) but it would also keep Obsidian resolving
		// artwork nobody sees, so the whole icon half of this function goes quiet
		// together — the property, both ::after overrides and the transform.
		const iconCSS = hidesIcon ? "" : calloutIconProp(def);

		const parts: string[] = [];
		if (hidesIcon) parts.push(this.iconHiddenCSS(def));

		// Light mode (default). See accentProps for what the three color
		// variables are and why an untouched built-in gets only two of them.
		const lightProps: string[] = [...this.accentProps(def, "light", true)];
		if (iconCSS) lightProps.push(`  --callout-icon: ${iconCSS}${imp};`);
		lightProps.push(...this.bgProps(def, "light", true));
		// Only in the light rule, which is unscoped and so matches both themes:
		// the frame's colour is the same in either one, and the dark block below
		// exists purely for the values that differ.
		if (def.transparentBg) {
			lightProps.push(
				...transparentBorderProps(
					this.registry.settings.globalStyle.borderSides,
					true,
				),
			);
		}
		parts.push(`${this.sel(def.id)} {\n${lightProps.join("\n")}\n}`);

		// What core stops painting when the theme's spelling is not core's. Its
		// own rule at weight 1, deliberately below everything above it — see
		// manager/css/coreAccentShim.ts for the specificity arithmetic and why
		// building it from `this.sel` instead would make the bug worse.
		const shim = this.coreAccentShim(def);
		if (shim) parts.push(shim);

		// Dark mode override
		if (this.needsDarkBlock(def)) {
			const darkProps: string[] = [...this.accentProps(def, "dark", true)];
			darkProps.push(...this.bgProps(def, "dark", true));
			parts.push(
				`${this.sel(def.id, ".theme-dark ")} {\n${darkProps.join("\n")}\n}`,
			);
		}

		// Content text color overrides
		if (def.textColorLight) {
			parts.push(
				`${this.sel(def.id)} > .callout-content {\n` +
					`  color: ${def.textColorLight}${imp};\n` +
					`}`,
			);
		}
		if (def.textColorDark && def.textColorDark !== def.textColorLight) {
			parts.push(
				`${this.sel(def.id, ".theme-dark ")} > .callout-content {\n` +
					`  color: ${def.textColorDark}${imp};\n` +
					`}`,
			);
		}

		// Pack icon override (mask-image over the artwork's data URI). This
		// drives the *live* (Reading view / Live Preview) rendering. A hidden
		// DOM copy is also baked in by paintIcons for PDF export, where this
		// adopted stylesheet is dropped. Always the "regular" role: the
		// selector is Obsidian's blockquote DOM, which no other role produces.
		const iconSvg = hidesIcon
			? null
			: this.icons.resolveSvg(def.icon, "regular");
		if (iconSvg) {
			parts.push(
				iconOverrideCSS(this.sel(def.id), def.icon, iconSvg, imp),
			);
		}

		// Emoji icon override (renders the glyph via ::after) for live view.
		// An emoji is the one icon kind `--callout-icon` cannot carry — it takes
		// a Lucide id and nothing else — so this ::after is not a preference,
		// it is the only channel there is.
		if (!hidesIcon && def.icon.type === "emoji") {
			parts.push(emojiOverrideCSS(this.sel(def.id), def.icon.value, imp));
		}

		// Icon position/size transform
		const iconTransform = hidesIcon ? "" : this.getIconTransformCSS(def);
		if (iconTransform) {
			parts.push(iconTransform);
		}

		// Gradient title text, when the palette opted in. Scoped to
		// .callout-title-inner (which hugs the title) rather than the
		// full-width .callout-title, so the sweep spans the words themselves;
		// the sibling .callout-icon is outside it and stays solid. The
		// callout's background lives on the .callout root, not here.
		parts.push(
			...this.textSweepRules(
				def,
				(themePrefix) =>
					[def.id, ...(def.aliases ?? [])]
						.map(
							(id) =>
								`${this.sel(id, themePrefix)} > ` +
								`.callout-title > .callout-title-inner`,
						)
						.join(",\n"),
				false,
				imp,
			),
		);

		// Heading-bar / inline-pill colors: our own DOM — see cssSnippetExport.
		// Deliberately outside the `!important` regime: no theme selector can
		// match `.cs-heading-callout` or `.cs-inline-callout`, so there is
		// nothing to beat, and leaving these ordinary is what keeps a user's own
		// snippet able to restyle them.
		if (!standalone) parts.push(this.generateTokenColorCSS(def));

		// Fold chevron in the palette's second color (gradients only).
		const foldCSS = this.generateFoldArrowCSS(def);
		if (foldCSS) parts.push(foldCSS);

		// PDF-export repaint of the background gradient (covers aliases too):
		// Preview/CoreGraphics truncates the vector shading Chromium prints,
		// so print rasterizes the sweep on a ::before — see printGradientCSS.
		const calloutPrint = this.printGradientCSS(
			def,
			(themePrefix, suffix) =>
				[def.id, ...(def.aliases ?? [])]
					.map((id) => `${this.sel(id, themePrefix)}${suffix}`)
					.join(",\n"),
			false,
			imp,
		);
		if (calloutPrint) parts.push(calloutPrint);

		// Generate alias selectors that reference the same styles
		if (def.aliases && def.aliases.length > 0) {
			for (const alias of def.aliases) {
				parts.push(
					`/* alias: ${alias} → ${def.id} */\n` +
						`${this.sel(alias)} {\n${lightProps.join("\n")}\n}`,
				);
				if (this.needsDarkBlock(def)) {
					const aliasDarkProps: string[] = [
						...this.accentProps(def, "dark", true),
						...this.bgProps(def, "dark", true),
					];
					parts.push(
						`${this.sel(alias, ".theme-dark ")} {\n${aliasDarkProps.join("\n")}\n}`,
					);
				}
				if (def.textColorLight) {
					parts.push(
						`${this.sel(alias)} > .callout-content {\n  color: ${def.textColorLight}${imp};\n}`,
					);
				}
				if (
					def.textColorDark &&
					def.textColorDark !== def.textColorLight
				) {
					parts.push(
						`${this.sel(alias, ".theme-dark ")} > .callout-content {\n  color: ${def.textColorDark}${imp};\n}`,
					);
				}
				if (iconSvg) {
					parts.push(
						iconOverrideCSS(this.sel(alias), def.icon, iconSvg, imp),
					);
				}
				if (!hidesIcon && def.icon.type === "emoji") {
					parts.push(
						emojiOverrideCSS(this.sel(alias), def.icon.value, imp),
					);
				}
				const aliasTransform = hidesIcon
					? ""
					: this.getIconTransformCSS({ ...def, id: alias });
				if (aliasTransform) {
					parts.push(aliasTransform);
				}
			}
		}

		// Last, so it also wins on source order: what the active styling says
		// about the surface of a callout it does not name. Empty for 241 of the
		// 257 installed themes — see manager/css/themeSurfaceCSS.ts.
		// Never in a standalone export: the guard is a class belonging to the
		// theme that happens to be active now, and `body:not(.pt-…)` is true in
		// every OTHER vault too — so a snippet carrying it would blank backgrounds
		// under every theme, for good. See cssSnippetExport's `standalone` note.
		const surface = standalone
			? ""
			: this.themeSurface(def, (guard, weight) =>
					[def.id, ...(def.aliases ?? [])]
						.map((id) => calloutSelAt(id, weight, guard))
						.join(",\n"),
				);
		if (surface) parts.push(surface);

		this.emitWeight = 1;
		this.emitImportant = "";
		return parts.join("\n\n");
	}

	/**
	 * The theme-surface block for one def, or `""` when the active styling
	 * claims nothing.
	 *
	 * Takes a selector builder rather than an id, because `generateFallbackCSS`
	 * asks the same question about a `:not()` chain that names no callout at all.
	 * `weight + 2` is the cancel weight — see `themeSurfaceCSS.ts` for why the
	 * dark-mode block is what it has to clear.
	 *
	 * The content-colour cancel is gated on the value being the plugin's own
	 * invented default rather than on the field being set: a text colour the user
	 * actually picked survives every theme. Same line `hasAuthoredTextColors`
	 * draws in settings/editor/authoredStyle.ts.
	 */
	private themeSurface(
		def: CalloutDefinition,
		selectorsAt: (guard: string, weight: number) => string,
	): string {
		const surface = this.studioWeights.surface();
		if (
			surface.neutralBackground.length === 0 &&
			surface.colorlessFrame.length === 0
		) {
			return "";
		}
		const weight = this.emitWeight + 2;
		return themeSurfaceCSS({
			selectorsFor: (guard) => selectorsAt(guard, weight),
			surface,
			paintsBackground:
				def.transparentBg !== true &&
				(this.bgProps(def, "light").length > 0 ||
					this.bgProps(def, "dark").length > 0),
			cancelsContentColor:
				def.textColorLight === DEFAULT_TEXT_COLOR_LIGHT ||
				def.textColorDark === DEFAULT_TEXT_COLOR_DARK,
			transparentBg: def.transparentBg === true,
		});
	}

	/**
	 * Fold-chevron color for gradient palettes, across both foldable roles: the
	 * block callout's disclosure arrow and the heading callout's chevron (the
	 * Live Preview widget and, in reading view, Obsidian's own collapse
	 * indicator). All three default to the accent color — where the palette's
	 * sweep STARTS — so they take the second color instead and the arrow closes
	 * the sweep the title opens.
	 *
	 * Gated on the `textGradient` (Gradient title text) option: the recoloring
	 * exists to echo the title's own sweep, so with that option off there is no
	 * title sweep to close and the arrow keeps the default accent color. This
	 * matches where the title sweep itself is honored (`textGradientCss`,
	 * `applyTitleGradient`), both of which also require `textGradient`.
	 *
	 * Uses the accent-strength second color (`textToColor*`), never the pale
	 * `toColor*` tints: those are the background's own end stop, and an arrow
	 * painted in one would disappear into the corner it sits on. Gradients
	 * carrying no accent-strength pair (pre-text-sweep or imported data) keep the
	 * accent-colored arrow rather than risking an invisible one.
	 *
	 * Empty when the def has no gradient or the title sweep is off — the
	 * styles.css defaults then stand.
	 */
	private generateFoldArrowCSS(def: CalloutDefinition): string {
		const g = def.bgGradient;
		if (!g?.textGradient) return "";
		const light = g.textToColorLight;
		if (!light) return "";
		const dark = g.textToColorDark ?? light;
		const ids = [def.id, ...(def.aliases ?? [])];

		const selectorsFor = (themePrefix: string): string =>
			ids
				.map(
					(id) =>
						// Obsidian's own DOM → dasherized attr (calloutSel).
						// Our heading-bar DOM → space-form attr (the two below).
						// The two conventions are deliberate — do not unify them.
						`${this.sel(id, themePrefix)} > ` +
						`.callout-title > .callout-fold, ` +
						`${themePrefix}.${CSS_HEADING_LINE}${tokenAttrSel(id)} ` +
						`.${CSS_FOLD_ARROW}, ` +
						`${themePrefix}.${CSS_HEADING_LINE}${tokenAttrSel(id)} ` +
						`.heading-collapse-indicator`,
				)
				.join(",\n");

		// The chevrons are `currentColor` SVGs, so `color` alone repaints them.
		// Same explicit-undefined cascade as the background rules: the light rule
		// is left unscoped so it keeps applying in dark mode when the gradient has
		// no dark-specific end, and an identical dark rule is skipped as a no-op.
		const imp = this.emitImportant;
		const parts = [`${selectorsFor("")} {\n  color: ${light}${imp};\n}`];
		if (dark !== light) {
			parts.push(
				`${selectorsFor(".theme-dark ")} {\n  color: ${dark}${imp};\n}`,
			);
		}
		return parts.join("\n\n");
	}

	/**
	 * Per-callout accent color for the heading-bar and inline-pill DOM.
	 * The structural rules (layout, radius, background alpha) are static in
	 * styles.css; only `--cs-color-rgb` is per-callout. Covers the main id
	 * and every alias in one selector list.
	 */
	private generateTokenColorCSS(def: CalloutDefinition): string {
		const ids = [def.id, ...(def.aliases ?? [])];

		const selectorsFor = (themePrefix: string): string =>
			ids
				.map(
					(id) =>
						`${themePrefix}.${CSS_INLINE_TOKEN}${tokenAttrSel(id)}, ` +
						`${themePrefix}.${CSS_HEADING_LINE}${tokenAttrSel(id)}, ` +
						`${themePrefix}.${CSS_REF_TOKEN}${tokenAttrSel(id)}`,
				)
				.join(",\n");

		const lightOwn = this.ownAccentProps(def, "light");
		const darkOwn = this.ownAccentProps(def, "dark");
		const parts: string[] = [
			`${selectorsFor("")} {\n${lightOwn.join("\n")}\n}`,
		];
		// Compared rather than keyed off `colorLight !== colorDark`: an unmodified
		// built-in has one colour for both modes and still needs this rule when the
		// theme variable it defers to is SPELLED differently in the two — see
		// `ModeSpelling` in manager/theme/accentDialect.ts.
		if (darkOwn.join("") !== lightOwn.join("")) {
			parts.push(`${selectorsFor(".theme-dark ")} {\n${darkOwn.join("\n")}\n}`);
		}

		// The callout's background — solid color OR gradient — is applied to
		// heading callouts and inline callouts too, so all three render roles share the
		// exact same background. bgProps emits nothing when the def has no custom
		// bg, leaving those roles on the static accent tint from styles.css as
		// their default; ref tokens are bare icons with no surface to paint. The
		// [data-callout] attribute outranks the styles.css tint rule (2 selectors
		// vs 1), so no !important is needed.
		const bgSelectorsFor = (themePrefix: string): string =>
			ids
				.map(
					(id) =>
						`${themePrefix}.${CSS_INLINE_TOKEN}${tokenAttrSel(id)}, ` +
						`${themePrefix}.${CSS_HEADING_LINE}${tokenAttrSel(id)}`,
				)
				.join(",\n");
		const lightBg = this.bgProps(def, "light");
		if (lightBg.length > 0) {
			parts.push(`${bgSelectorsFor("")} {\n${lightBg.join("\n")}\n}`);
		}
		const darkBg = this.bgProps(def, "dark");
		// Same explicit-undefined cascade as block callouts: no dark bg set →
		// the light rule (unscoped, so it matches both themes) keeps applying in
		// dark mode; identical dark values → skip the no-op.
		if (darkBg.length > 0 && darkBg.join("") !== lightBg.join("")) {
			parts.push(
				`${bgSelectorsFor(".theme-dark ")} {\n${darkBg.join("\n")}\n}`,
			);
		}
		// Only gradient backgrounds need the PDF-export ::before repaint; the
		// method returns "" for solid backgrounds. The pill also hides its own
		// gradient in print (inline boxes print in the end color), the heading
		// bar keeps its as a fragmentation fallback — see printGradientCSS.
		const pillPrint = this.printGradientCSS(
			def,
			(themePrefix, suffix) =>
				ids
					.map(
						(id) =>
							`${themePrefix}.${CSS_INLINE_TOKEN}${tokenAttrSel(id)}${suffix}`,
					)
					.join(",\n"),
			true,
		);
		if (pillPrint) parts.push(pillPrint);
		const headingPrint = this.printGradientCSS(
			def,
			(themePrefix, suffix) =>
				ids
					.map(
						(id) =>
							`${themePrefix}.${CSS_HEADING_LINE}${tokenAttrSel(id)}${suffix}`,
					)
					.join(",\n"),
			false,
		);
		if (headingPrint) parts.push(headingPrint);

		// Gradient title text for the inline callout: ONE sweep on the callout root,
		// which hugs its own content, so the gradient runs edge to edge across
		// the pill. It carries the background layer, so that layer is restated
		// underneath. The class is repeated to reach 3 selectors, outranking
		// the bg rules above (2). Ref tokens are bare icons — nothing to sweep.
		parts.push(
			...this.textSweepRules(
				def,
				(themePrefix) =>
					ids
						.map(
							(id) =>
								`${themePrefix}.${CSS_INLINE_TOKEN}.${CSS_INLINE_TOKEN}${tokenAttrSel(id)}`,
						)
						.join(",\n"),
				true,
			),
		);

		// Gradient title text for the heading callout. The callout is a full-width
		// block, so sweeping it directly would stretch the gradient across the
		// whole line and leave the text showing only its opening slice —
		// instead each of the two text runs a bar can hold is swept on its own
		// hugging inline box, and the gradient lands its end color on the last
		// letter. The two are mutually exclusive: the token drops its name as
		// soon as the heading has a title of its own (`showName: !hasTitle`),
		// so only ever one of these rules paints, and the sweep never restarts
		// mid-bar. Neither element carries the bar's background.
		const headingTextSelectors = (themePrefix: string): string =>
			ids
				.map(
					(id) =>
						`${themePrefix}.${CSS_HEADING_LINE}${tokenAttrSel(id)} .${CSS_HEADING_TITLE},\n` +
						`${themePrefix}.${CSS_HEADING_TOKEN}${tokenAttrSel(id)} > .${CSS_TOKEN_NAME}`,
				)
				.join(",\n");
		parts.push(...this.textSweepRules(def, headingTextSelectors, false));

		return parts.join("\n\n");
	}

	/**
	 * PDF-export repaint of a background gradient, for every render role.
	 *
	 * Two print-pipeline problems force this, both invisible on screen:
	 *
	 * 1. Chromium resolves a degenerate gradient box for a gradient
	 *    `background-image` on an inline-level box (the pill is
	 *    `inline-flex`) and paints the whole pill in the gradient's END
	 *    color. Moving the gradient to an absolutely-positioned `::before` —
	 *    a block box with well-defined geometry — sidesteps that.
	 * 2. On ANY box, Chromium writes the gradient into the PDF as a vector
	 *    axial shading, which macOS CoreGraphics (Preview, Quick Look)
	 *    renders truncated: only about the first half of the ramp shows, so
	 *    pale sweeps collapse into a near-uniform start color. The
	 *    `filter: opacity(0.999)` is the fix — a filter cannot be expressed
	 *    in PDF vector operators, so Chromium rasterizes the `::before` and
	 *    the bitmap renders identically in every viewer. The value is not a
	 *    no-op, so the filter can't be optimized away, yet the alpha change
	 *    is invisible; text is above the `::before` and stays vector.
	 *
	 * `hideElementGradient` drops the element's own `background-image` in
	 * print: required for the pill (problem 1 paints it in the end color
	 * otherwise); left off for block roles (block callout, heading callout) so
	 * a callout fragmented across pages keeps at least the vector gradient
	 * where the `::before` doesn't reach. The `background-color` (first
	 * stop) always stays on the element as the fallback. Empty when the mode
	 * has no bg color (then there is no gradient on screen either).
	 */
	private printGradientCSS(
		def: CalloutDefinition,
		selFor: (themePrefix: string, suffix: string) => string,
		hideElementGradient: boolean,
		imp = "",
	): string {
		const light = this.bgImageFor(def, "light");
		if (!light) return "";
		const beforeProps = (image: string): string =>
			`  content: ""${imp};\n` +
			`  position: absolute${imp};\n` +
			`  inset: 0${imp};\n` +
			`  z-index: -1${imp};\n` +
			`  border-radius: inherit${imp};\n` +
			`  background-image: ${image}${imp};\n` +
			`  filter: opacity(0.999)${imp};\n` +
			`  -webkit-print-color-adjust: exact${imp};\n` +
			`  print-color-adjust: exact${imp};`;
		// z-index: 0 scopes the ::before's -1 to the element's own stacking
		// context, so it sits above the background-color but under text and
		// icon. Both theme prefixes are grouped so this later rule wins over
		// the screen bg rules in either mode; the ::before then follows the
		// usual explicit-undefined cascade (unscoped light rule, dark
		// override only when the gradient differs).
		const hostProps = [
			// Cancels the screen gradient at the SAME importance that declared
			// it — these two rules tie on specificity and are resolved on source
			// order, so an ordinary reset under an `!important` screen rule
			// would leave both gradients painting in print.
			...(hideElementGradient ? [`  background-image: none${imp};`] : []),
			`  position: relative${imp};`,
			`  z-index: 0${imp};`,
		].join("\n");
		const rules = [
			`${selFor("", "")},\n${selFor(".theme-dark ", "")} {\n${hostProps}\n}`,
			`${selFor("", "::before")} {\n${beforeProps(light.image)}\n}`,
		];
		const dark = this.bgImageFor(def, "dark");
		if (dark && dark.image !== light.image) {
			rules.push(
				`${selFor(".theme-dark ", "::before")} {\n${beforeProps(dark.image)}\n}`,
			);
		}
		return `@media print {\n${rules.join("\n\n")}\n}`;
	}

	/**
	 * The selector carrying one role's icon adjustment.
	 *
	 * Ref tokens in the outline and in links are deliberately absent: they are
	 * too small for pixel offsets to mean anything, so they keep the shared
	 * sizing from styles.css whatever the user does here.
	 */
	private iconTransformSelector(id: string, role: CalloutRenderRole): string {
		switch (role) {
			case "regular":
				// Obsidian's own DOM → dasherized attr; the two tokens are ours.
				return `${this.sel(id)} > .callout-title > .callout-icon`;
			case "heading":
				return `.${CSS_HEADING_TOKEN}${tokenAttrSel(id)} > .${CSS_TOKEN_ICON}`;
			case "inline":
				// Two depths, spelled out rather than collapsed to a descendant
				// combinator. A plain pill holds its icon directly; a content
				// pill (`[!id]{…}`) holds it inside the lead that stands in for
				// `[!id]{`, and without the second selector the user's inline
				// icon adjustment silently skipped every content pill. A
				// descendant combinator would cover both — and would also reach
				// the icon of a pill NESTED in another pill's payload, applying
				// the outer callout's offset to the inner callout's icon.
				//
				// Both land on .cs-callout-icon, never on the lead itself. The
				// lead is the pill's first flex item and is what the pill's own
				// `align-items: center` positions (see .cs-callout-lead in
				// styles.css); a transform written onto it would fight that,
				// while on the icon inside it it composes cleanly.
				return (
					`.${CSS_INLINE_TOKEN}${tokenAttrSel(id)} > .${CSS_TOKEN_ICON}, ` +
					`.${CSS_INLINE_TOKEN}${tokenAttrSel(id)} > .${CSS_CALLOUT_LEAD} > .${CSS_TOKEN_ICON}`
				);
		}
	}

	/**
	 * Per-role icon offset/scale rules for one callout.
	 *
	 * Each role gets its own rule and is skipped entirely while it sits at the
	 * defaults, so nudging the heading token cannot shift the blockquote icon —
	 * that shared-value coupling is exactly what the per-role model replaced.
	 *
	 * The heading rule re-bakes the static optical nudge from styles.css
	 * (--cs-heading-icon-offset): this selector outranks that default and would
	 * otherwise silently cancel it the moment a heading slider is touched. Its
	 * fallback must stay in step with the one in styles.css — they disagreed
	 * (0.06em here, 0.1em there) until this rewrite, which made any slider move
	 * lift the heading icon by the 0.04em difference.
	 */
	private getIconTransformCSS(def: CalloutDefinition): string {
		const parts: string[] = [];

		for (const role of CALLOUT_RENDER_ROLES) {
			const adjust = resolveIconAdjust(def, role);
			// The heading keeps its static nudge from styles.css when untouched.
			if (isDefaultIconAdjust(adjust)) continue;

			const extraY =
				role === "heading"
					? "var(--cs-heading-icon-offset, 0.1em)"
					: "";
			const transforms: string[] = [];
			if (adjust.offsetX !== 0 || adjust.offsetY !== 0 || extraY) {
				const y = extraY
					? `calc(${adjust.offsetY}px + ${extraY})`
					: `${adjust.offsetY}px`;
				transforms.push(`translate(${adjust.offsetX}px, ${y})`);
			}
			if (adjust.size !== 1) transforms.push(`scale(${adjust.size})`);

			const imp = this.emitImportant;
			parts.push(
				`${this.iconTransformSelector(def.id, role)} {\n` +
					`  transform: ${transforms.join(" ")}${imp};\n` +
					`  transform-origin: center${imp};\n` +
					`}`,
			);
		}

		return parts.join("\n\n");
	}

	/**
	 * Everything a callout the user asked to draw with no icon needs, for its own
	 * id and every alias.
	 *
	 * `display: none` rather than `visibility` or a zero size, because the point
	 * is to take the icon *out of the layout*: `.callout-icon` is a flex item of
	 * `.callout-title`, so removing it collapses core's own `gap` between icon and
	 * title along with the `margin-inline-end` this plugin adds in
	 * {@link generateGlobalStyleCSS}. Anything that merely hid the artwork would
	 * leave the title floating a glyph-width in from the padding edge.
	 *
	 * Deliberately **not** wrapped in `@media screen`, unlike the three ::after
	 * overrides. Those are screen-only so the DOM copy {@link paintIcon} bakes can
	 * take over in print; here there is nothing to take over, and the icon has to
	 * be just as absent in a PDF as it is on screen.
	 *
	 * The second rule undoes the global "Align content with title" indent, which
	 * is a fixed `calc(--icon-size + gap)` on `.callout-content` and knows nothing
	 * about whether this callout has an icon to align past. Left standing it would
	 * indent the body under empty space. One class-unit more specific than the
	 * global rule (whose `:where()` exclusion suffix contributes zero), so it
	 * beats it on weight alone.
	 *
	 * This is the one thing theme mode still emits, and there it stays ordinary:
	 * the whole promise of theme mode is that nothing of ours competes, and a
	 * theme that positions `.callout-icon` itself has to keep being able to.
	 * Under studio mode it takes the same `!important` as everything else.
	 */
	private iconHiddenCSS(def: CalloutDefinition): string {
		const aligned =
			this.registry.settings.globalStyle.alignContentWithTitle;
		const imp = this.emitImportant;
		const parts: string[] = [];
		for (const id of [def.id, ...(def.aliases ?? [])]) {
			parts.push(
				`${this.sel(id)} > .callout-title > .callout-icon {\n` +
					`  display: none${imp};\n` +
					`}`,
			);
			if (aligned) {
				parts.push(
					`${this.sel(id)} > .callout-content {\n` +
						`  padding-inline-start: 0${imp};\n` +
						`}`,
				);
			}
		}
		return parts.join("\n\n");
	}



	/**
	 * Walk rendered callouts and (re)apply DOM-level icon work.
	 *
	 * For Lucide this keeps the visible SVG in sync after edits. For material and
	 * emoji it bakes a *hidden* self-contained copy of the icon (see paintIcon)
	 * that only appears in Obsidian's PDF export clone, where our adopted
	 * stylesheet — and thus the CSS that draws the live icon — is dropped.
	 *
	 * `root` may be the document (full sweep, on inject), a rendered container
	 * (from a markdown post-processor), or a single callout element. Omitting it
	 * sweeps EVERY open window rather than just `activeDocument`: with a pop-out
	 * focused that variable is the pop-out's document, so the default used to
	 * silently skip the main window (and the other way round).
	 */
	paintIcons(root?: ParentNode): void {
		if (root === undefined) {
			for (const doc of this.openDocuments()) this.paintIcons(doc);
			return;
		}
		const calloutEls: HTMLElement[] = [];
		// A post-processor can hand us the callout element itself.
		if (
			(root as Element).nodeType === 1 &&
			(root as Element).matches(".callout[data-callout]")
		) {
			calloutEls.push(root as HTMLElement);
		}
		calloutEls.push(
			...Array.from(
				root.querySelectorAll<HTMLElement>(".callout[data-callout]"),
			),
		);

		for (const calloutEl of calloutEls) {
			const id = calloutEl.getAttribute("data-callout");
			if (!id) continue;
			const def = this.resolveDef(id);
			const iconEl = calloutEl.querySelector<HTMLElement>(
				".callout-title .callout-icon",
			);
			// Per-grapheme print colors for a gradient title (PDF export
			// support — see gradientTitleText.ts).
			const titleInner = calloutEl.querySelector<HTMLElement>(
				".callout-title .callout-title-inner",
			);
			if (!def) {
				// Handed to the theme (see resolveDef). Skipping this callout is
				// not enough, because an earlier pass may already have painted
				// it and nothing else will ever take that back — see
				// restoreCoreIcon.
				if (iconEl) this.restoreCoreIcon(calloutEl, iconEl);
				if (titleInner) clearGradientChars(titleInner);
				continue;
			}
			if (iconEl) this.paintIcon(iconEl, def);
			if (titleInner) this.syncTitleGradient(titleInner, def);
		}

		// Heading-bar title spans: reading view wraps the heading's own
		// title in .cs-heading-title (see calloutPostProcessor), the element
		// the title sweep runs on. Live Preview heading callouts are CodeMirror's
		// own .cm-line DOM — its text nodes must never be rewrapped (CM owns
		// them, and Live Preview never reaches PDF export anyway). Unknown
		// ids get no sweep CSS, so they must not get print colors either.
		const headingEls = root.querySelectorAll<HTMLElement>(
			`.${CSS_HEADING_LINE}[data-callout]`,
		);
		for (const headingEl of Array.from(headingEls)) {
			if (headingEl.classList.contains("cm-line")) continue;
			const id = headingEl.getAttribute("data-callout");
			if (!id) continue;
			const resolved = resolveCalloutDef(this.registry, id);
			if (!shouldRenderToken(resolved)) continue;
			const { def, unknown } = resolved;
			if (!def || unknown) continue;
			const titleEl = headingEl.querySelector<HTMLElement>(
				`.${CSS_HEADING_TITLE}`,
			);
			if (titleEl) this.syncTitleGradient(titleEl, def);
		}

		// Heading/inline token DOM (Live Preview widgets and reading-view
		// pills share these classes; see renderShared.buildCalloutTokenDom).
		// Keeps icons and display names in sync after definition edits and
		// after Material SVG downloads complete.
		const tokenEls = root.querySelectorAll<HTMLElement>(
			`.${CSS_INLINE_TOKEN}[data-callout], .${CSS_HEADING_TOKEN}[data-callout]`,
		);
		for (const tokenEl of Array.from(tokenEls)) {
			// CodeMirror's own widget DOM is CM's to rebuild, and this sweep
			// runs from arbitrary continuations (a pack read off disk, a
			// Material download landing, a slider drag's rAF) with no way to
			// wrap the work in view.observer.ignore(). CM re-renders those
			// widgets itself the moment the decoration set changes, so inject()
			// dispatches the refresh effect instead (see injectNow) and the
			// sweep leaves them alone, exactly as the heading sweep above does.
			//
			// Every other token — reading view, and post-processor output
			// embedded IN the editor (a `![[note]]` transclusion) — is ours,
			// and no decoration rebuild will ever reach it, so it stays in the
			// sweep. The two are told apart by the marker the widget stamps on
			// itself, never by where the node sits: a transclusion renders
			// under the editor's own `.cm-content`, and an editable table cell
			// nests a `.cm-content` under a rendered container, so no ancestry
			// test gets both right (see CSS_CM_WIDGET).
			if (tokenEl.classList.contains(CSS_CM_WIDGET)) continue;
			this.paintTokenEl(tokenEl);
		}
	}

	/**
	 * Every document the workspace currently draws into: the main renderer
	 * window plus one per pop-out. `activeDocument` alone is not enough — it
	 * follows focus, so a full sweep driven by it repaints one window and
	 * leaves the others stale.
	 */
	private openDocuments(): Document[] {
		const docs = new Set<Document>();
		docs.add(this.app.workspace.containerEl.ownerDocument);
		docs.add(activeDocument);
		this.app.workspace.iterateAllLeaves((leaf) => {
			const doc = leaf.view.containerEl?.ownerDocument;
			if (doc) docs.add(doc);
		});
		return Array.from(docs);
	}

	/** Repaint one heading/inline token's icon (and name, for known ids). */
	private paintTokenEl(tokenEl: HTMLElement): void {
		const id = tokenEl.getAttribute("data-callout");
		if (!id) return;
		const resolved = resolveCalloutDef(this.registry, id);
		// A token whose callout was handed to the theme should not exist —
		// the render sites stopped building them. One can still be on screen
		// for the moment between the flag flipping and the re-render, and
		// repainting it then would be the plugin styling a callout it just
		// promised to leave alone.
		if (!shouldRenderToken(resolved)) return;
		const { def, unknown } = resolved;
		if (!def) return;
		const iconEl = tokenEl.querySelector<HTMLElement>(`.${CSS_TOKEN_ICON}`);
		if (iconEl) {
			// Heading tokens draw at heading size, inline callouts at callout size;
			// packs with per-size artwork pick their drawing from that.
			const role = tokenEl.classList.contains(CSS_HEADING_TOKEN)
				? "heading"
				: "inline";
			paintRoleIcon(iconEl, def, this.registry, role);
		}
		const nameEl = tokenEl.querySelector<HTMLElement>(`.${CSS_TOKEN_NAME}`);
		if (!nameEl) return;
		// Unknown tokens keep showing the raw id the user typed. (The
		// comparison reads through any char spans — textContent concatenates
		// descendants — while a real rename rewrites the node and strips
		// them, which is why the gradient sync below runs after it.)
		if (!unknown && nameEl.textContent !== def.displayName) {
			nameEl.textContent = def.displayName;
		}
		// Per-grapheme print colors for the swept name (PDF export — see
		// gradientTitleText.ts). The pill root carries the sweep but its name
		// holds the text; the heading token sweeps its name directly. Unknown
		// ids get no sweep CSS, so they must not get print colors either.
		if (unknown) {
			clearGradientChars(nameEl);
		} else {
			this.syncTitleGradient(nameEl, def);
		}
	}

	/** Per-grapheme PDF-export colors for one swept title (see
	 * gradientTitleText.applyTitleGradient, shared with the reading
	 * post-processor). */
	private syncTitleGradient(el: HTMLElement, def: CalloutDefinition): void {
		applyTitleGradient(el, def);
	}

	/**
	 * Resolve an ID read off Obsidian's OWN `data-callout` attribute — the dash
	 * form (see obsidianCalloutAttrId) — to its definition, falling back to the
	 * configured fallback callout so unknown IDs paint the fallback icon (the
	 * DOM equivalent of generateFallbackCSS).
	 *
	 * Returns undefined for a theme-styled callout, which is the one case where
	 * a *recognized* ID resolves to nothing: the caller's job is to paint, and
	 * there is nothing of ours to paint there.
	 *
	 * Only for `.callout[data-callout]` elements. Heading-bar and inline-pill
	 * DOM is ours and carries the space-form ID; those go through
	 * renderShared.resolveCalloutDef instead, which tries the exact ID and alias
	 * first and only then the attribute form, so unknown IDs still earn their
	 * `.cs-unknown` class.
	 */
	private resolveDef(attrId: string): CalloutDefinition | undefined {
		const direct = this.registry.findByAttrId(attrId);
		// A theme-styled callout resolves to nothing, sending paintIcons down its
		// restore path: `renderIconInto` REPLACES whatever <svg> is in the slot,
		// and swapping core's own icon for one of ours is exactly what theme
		// mode exists not to do.
		if (direct) return this.registry.standsDown(direct) ? undefined : direct;
		return this.registry.get(this.registry.settings.fallbackCalloutId);
	}

	/**
	 * Prepare a `.callout-icon` for PDF export.
	 *
	 * Live view (Reading view / Live Preview = screen media) renders pack icons
	 * and emoji via CSS `::after` (see css/iconOverrides.ts), which we wrap in
	 * `@media screen`. Here we bake a
	 * self-contained, concretely coloured copy of the icon into the DOM. The hide
	 * rules are screen-only, so in PDF export (print media) those CSS icons
	 * disappear and this DOM copy becomes the visible icon — an inline SVG / text
	 * node renders far more reliably in Chromium's print pipeline than a CSS
	 * mask, and carries its own colour.
	 *
	 * The colour is baked as an **inline style with `!important`** on the root and
	 * every shape: a presentation `fill` attribute would lose to core/theme CSS
	 * (which colours the icon via `currentColor` → `--callout-color`, defaulting
	 * to blue in an export that lacks our stylesheet), whereas an inline
	 * `!important` declaration outranks any selector rule.
	 *
	 * Lucide icons are visible DOM SVGs that already survive export, so they are
	 * painted normally. Artwork that is not cached yet leaves Obsidian's pencil
	 * placeholder alone; the download later triggers a re-inject which repaints.
	 *
	 * A picture that keeps its own colours has none of this applied to it, but
	 * that is renderIcon's call to make and not this one's — the colour is handed
	 * over the same way for every icon, and the painter drops it for the one
	 * artwork the callout does not own.
	 */
	private paintIcon(iconEl: HTMLElement, def: CalloutDefinition): void {
		// Nothing to bake for print when the icon is off: iconHiddenCSS takes the
		// whole box out of the layout in every medium, so a DOM copy here would
		// only be an invisible child of a display:none parent.
		if (def.hideIcon === true) return;
		const doc = iconEl.ownerDocument;
		const isDark = doc.body?.classList.contains("theme-dark") ?? false;
		renderIconInto(iconEl, def.icon, createIconResolver(this.registry), {
			role: "regular",
			fill: { literal: isDark ? def.colorDark : def.colorLight },
			missing: { kind: "leave" },
			className: "cs-export-icon",
			rootStyle:
				"width:var(--icon-size, 1.2em);height:var(--icon-size, 1.2em)",
		});
	}

	/**
	 * Put a `.callout-icon` back the way Obsidian drew it.
	 *
	 * Obsidian resolves that element once and never again: its callout
	 * post-processor returns early on an icon element that already has a child,
	 * so `--callout-icon` is read exactly once per rendered callout and no
	 * amount of `css-change` makes it look a second time. Everything else about
	 * handing a callout to the theme is CSS and lands on the next frame; this
	 * one node would keep our artwork until the user edited the block into a
	 * re-render — and in fact would show *nothing*, since `renderIconInto`
	 * replaced Obsidian's `<svg>` and the `@media screen` rule that reveals the
	 * replacement went away with the rest of the callout's block.
	 *
	 * So the resolution is re-run here the way core runs it (see
	 * {@link coreIconValue}). Re-read rather than stashed at paint time, so a
	 * theme swapped in between is picked up; safe to read now because
	 * `injectNow` paints only once the new stylesheet is in place, which means
	 * the property already resolves to whatever the theme, a snippet or
	 * Obsidian itself says rather than to the block we just stopped emitting.
	 *
	 * Unconditional — no "did we paint this one" flag gating it. Reading view's
	 * block callouts get a fresh element from `previewMode.rerender(true)`
	 * (see `refreshRenderModes`) where core resolves the icon itself and this
	 * is a no-op either way, but Live Preview's native callout widget has no
	 * equivalent forced rebuild this plugin can reach: the very element the
	 * user is looking at when they flip the toggle is the one this has to fix,
	 * and there is no reliable signal for "has *this* element been corrected
	 * since the last flip" cheaper than just re-deriving and comparing. Runs on
	 * every inject for every externally-styled callout as a result — the same
	 * price {@link paintIcon} already pays, unconditionally, for every callout
	 * this plugin *does* still style.
	 */
	private restoreCoreIcon(calloutEl: HTMLElement, iconEl: HTMLElement): void {
		iconEl.empty();
		const value = coreIconValue(calloutEl);
		if (!value) return;
		if (value.startsWith("<svg")) {
			const svg = importCoreIconSvg(value, iconEl.ownerDocument);
			if (svg) iconEl.appendChild(svg);
			return;
		}
		setIcon(iconEl, value);
	}

	/**
	 * Selector suffix that lifts every theme-styled callout out of a rule keyed
	 * on nothing but `.callout` — `""` when the theme owns none of them.
	 *
	 * This is what makes the global frame settings (border, radius, text scale)
	 * part of what "Callout Studio style" *means*: a callout handed to the theme
	 * is handed over whole, geometry included.
	 *
	 * The `:where()` is the whole point. `:not()` normally takes the specificity
	 * of its argument, so a plain `:not([data-callout="a"]):not([data-callout="b"])`
	 * chain would add one class-unit per excluded callout and make these global
	 * rules progressively *harder* for the very theme the user is handing them
	 * to. `:where()` contributes zero, so the rules keep the exact weight they
	 * have today no matter how many rows carry the flag.
	 *
	 * (`generateFallbackCSS` builds a chain that deliberately does the opposite —
	 * there the inflation is what lets the catch-all outrank per-callout rules.)
	 */
	private externalExclusion(): string {
		const attrIds = new Set<string>();
		for (const def of this.registry.getAll()) {
			if (!this.registry.standsDown(def)) continue;
			attrIds.add(obsidianCalloutAttrId(def.id));
			for (const alias of def.aliases ?? []) {
				attrIds.add(obsidianCalloutAttrId(alias));
			}
		}
		if (attrIds.size === 0) return "";
		const list = Array.from(attrIds)
			.map((id) => tokenAttrSel(id))
			.join(",");
		return `:not(:where(${list}))`;
	}

	generateGlobalStyleCSS(standalone = false): string {
		const gs = this.registry.settings.globalStyle;
		const parts: string[] = ["/* Global callout style */"];
		const excl = this.externalExclusion();

		// Space between the icon and the title text. Obsidian core sets
		// `.callout-title { gap: var(--size-4-1) }` — a fixed 4px — while this
		// plugin's own tokens use em-relative gaps (0.35em heading, 0.3em
		// inline), and the regular icon box is the largest of the three
		// (--icon-size, 1.2em, against 1em). The regular icon therefore reads as
		// the most cramped of the three roles, and grows tighter still as a
		// theme's base font size rises, because px does not scale. Top up the
		// icon's own trailing side so the three match optically.
		//
		// Deliberately on the icon rather than on the title's `gap`: the title
		// row's other flex gap — the one before the fold chevron — is left
		// exactly as the theme set it. Baked-in default, overridable via
		// --cs-regular-icon-gap in a CSS snippet, same as --cs-heading-icon-offset.
		//
		// Generated rather than shipped in styles.css, where it used to live: it
		// is the only rule the plugin puts on a real vault callout
		// unconditionally, and a static rule has no way to exclude one the user
		// handed to their theme. Emitted unconditionally here for the same reason
		// it was static before — it is a default, not a setting.
		//
		// Every declaration below carries `!important`, and for the same reason
		// the per-callout block does: these rules are keyed on `.callout` alone,
		// which is the weakest selector in the file, so a theme with any opinion
		// at all about callout geometry beat them outright. See
		// manager/styleMode.ts. They stay *below* the per-callout rules among
		// important declarations, because specificity is compared again there
		// and `(0,1,0)` loses to `(0,w+1,0)`.
		const imp = " !important";
		parts.push(
			`.callout${excl} > .callout-title > .callout-icon {\n` +
				`  margin-inline-end: var(--cs-regular-icon-gap, 0.15em)${imp};\n` +
				`}`,
		);

		const props: string[] = [];

		if (gs.borderRadius !== 4) {
			props.push(`  border-radius: ${gs.borderRadius}px${imp};`);
		}

		// Border sides
		const { top, right, bottom, left } = gs.borderSides;
		const allSides = top && right && bottom && left;
		const anySide = top || right || bottom || left;
		const bStyle =
			`${gs.borderWidth}px solid ` +
			`color-mix(in oklch, var(--cs-accent, currentColor) 45%, transparent)`;

		if (allSides) {
			props.push(`  border: ${bStyle}${imp};`);
		} else if (anySide) {
			// Reset any default border first
			props.push(`  border: none${imp};`);
			if (top) props.push(`  border-top: ${bStyle}${imp};`);
			if (right) props.push(`  border-right: ${bStyle}${imp};`);
			if (bottom) props.push(`  border-bottom: ${bStyle}${imp};`);
			if (left) props.push(`  border-left: ${bStyle}${imp};`);
		}

		// Every rule from here down is keyed on nothing but `.callout`, so each
		// carries the exclusion — a callout handed to the theme must not keep
		// the plugin's border, radius or text scale. The border especially:
		// it reads `var(--cs-accent, currentColor)`, so merely withholding the
		// accent would leave a border in the *wrong* colour rather than none.
		if (props.length > 0) {
			parts.push(`.callout${excl} {\n${props.join("\n")}\n}`);
		}

		// Title scale
		if (gs.titleScale !== 1) {
			parts.push(
				`.callout${excl} > .callout-title > .callout-title-inner {\n` +
					`  font-size: ${gs.titleScale}em${imp};\n` +
					`}`,
			);
		}

		// Content scale
		if (gs.contentScale !== 1) {
			parts.push(
				`.callout${excl} > .callout-content {\n` +
					`  font-size: ${gs.contentScale}em${imp};\n` +
					`}`,
			);
		}

		// Indent the body so it lines up under the title text (icon width +
		// title gap) instead of under the icon. Logical property keeps it
		// correct in RTL; written to both adoptedStyleSheets and the <style>
		// element so it applies in Reading view, Live Preview, and PDF export.
		// The --cs-regular-icon-gap term mirrors the icon's own trailing margin
		// from styles.css: without it this indent would fall short by exactly
		// that margin and the body would sit left of the title text.
		if (gs.alignContentWithTitle) {
			parts.push(
				`.callout${excl} > .callout-content {\n` +
					`  padding-inline-start: calc(var(--icon-size, 1.2em) + 0.2em + var(--cs-regular-icon-gap, 0.15em))${imp};\n` +
					`}`,
			);
		}

		// Heading-bar frame. Borders are drawn directly; radius and vertical
		// text spacing go through CSS variables consumed by the static
		// .cs-heading-callout rule in styles.css (whose fallbacks are the
		// defaults, so nothing is emitted while a value is untouched).
		const headingProps = this.roleBorderProps(gs.heading);
		if (gs.heading.borderRadius !== 4) {
			headingProps.push(
				`  --cs-heading-radius: ${gs.heading.borderRadius}px;`,
			);
		}
		if (gs.heading.paddingTop !== 0.25) {
			headingProps.push(
				`  --cs-heading-pad-top: ${gs.heading.paddingTop}em;`,
			);
		}
		if (gs.heading.paddingBottom !== 0.25) {
			headingProps.push(
				`  --cs-heading-pad-bottom: ${gs.heading.paddingBottom}em;`,
			);
		}
		// Gap above the bar (the outer margin, reading view only — see the
		// static .cs-heading-callout:not(.cm-line) rule in styles.css; Live
		// Preview gets the same visual effect from HeadingGapWidget, a real
		// block-level DOM node, since a margin can't safely reach .cm-line).
		// Rides this same variable-then-static-fallback rule as its siblings
		// above so the default (0) is an explicit, enforced value rather than
		// "whatever the theme's own heading margin happens to be".
		if (gs.heading.marginTop !== 0) {
			headingProps.push(
				`  --cs-heading-gap-top: ${gs.heading.marginTop}em;`,
			);
		}
		if (headingProps.length > 0 && !standalone) {
			parts.push(`.${CSS_HEADING_LINE} {\n${headingProps.join("\n")}\n}`);
		}

		// Inline-pill frame. Radius 16px ≈ the default 1em pill shape, so the
		// static rule's fallback keeps the classic pill until the user moves it.
		const inlineProps = this.roleBorderProps(gs.inline);
		if (gs.inline.borderRadius !== 16) {
			inlineProps.push(
				`  --cs-inline-radius: ${gs.inline.borderRadius}px;`,
			);
		}
		if (gs.inline.fontScale !== 1) {
			inlineProps.push(`  --cs-inline-scale: ${gs.inline.fontScale};`);
		}
		if (inlineProps.length > 0 && !standalone) {
			parts.push(`.${CSS_INLINE_TOKEN} {\n${inlineProps.join("\n")}\n}`);
		}

		return parts.join("\n\n");
	}

	/**
	 * Border declarations for a role frame (heading callout / inline callout),
	 * mirroring the regular-callout border logic: tinted by the element's own
	 * per-callout accent (--cs-color-rgb). Empty when no side is enabled.
	 */
	private roleBorderProps(frame: {
		borderSides: {
			top: boolean;
			right: boolean;
			bottom: boolean;
			left: boolean;
		};
		borderWidth: number;
	}): string[] {
		const { top, right, bottom, left } = frame.borderSides;
		const anySide = top || right || bottom || left;
		if (!anySide) return [];
		const bStyle =
			`${frame.borderWidth}px solid ` +
			`color-mix(in oklch, var(--cs-accent, currentColor) 45%, transparent)`;
		if (top && right && bottom && left) {
			return [`  border: ${bStyle};`];
		}
		const props: string[] = [`  border: none;`];
		if (top) props.push(`  border-top: ${bStyle};`);
		if (right) props.push(`  border-right: ${bStyle};`);
		if (bottom) props.push(`  border-bottom: ${bStyle};`);
		if (left) props.push(`  border-left: ${bStyle};`);
		return props;
	}

	/**
	 * The unknown-id catch-all. Lives in `./css/fallbackCSS.ts`; this hands it
	 * the nine emitters it used to reach through `this`.
	 */
	private generateFallbackCSS(callouts: CalloutDefinition[]): string {
		return generateFallbackCSS(callouts, {
			settings: this.registry.settings,
			standsDown: (def) => this.registry.standsDown(def),
			resolveSvg: (icon, role) => this.icons.resolveSvg(icon, role),
			getIconCSS: (def) => calloutIconProp(def),
			accentProps: (def, mode, important, imposed) =>
				this.accentProps(def, mode, important, imposed),
			ownAccentProps: (def, mode) => this.ownAccentProps(def, mode),
			bgProps: (def, mode, important) =>
				this.bgProps(def, mode, important),
			transparentBorderProps: (important) =>
				transparentBorderProps(
					this.registry.settings.globalStyle.borderSides,
					important,
				),
			needsDarkBlock: (def) => this.needsDarkBlock(def),
			themeSurface: (def, selectorsAt) =>
				this.themeSurface(def, selectorsAt),
			printGradientCSS: (def, selector, isPill) =>
				this.printGradientCSS(def, selector, isPill),
		});
	}

	destroy(): void {
		const doc = this.styleDoc ?? activeDocument;
		if (this.styleSheet && "adoptedStyleSheets" in doc) {
			doc.adoptedStyleSheets = doc.adoptedStyleSheets.filter(
				(sheet) => sheet !== this.styleSheet,
			);
			this.styleSheet = null;
			this.styleDoc = null;
		}
		const registryWindow = window as RegistryWindow;
		delete registryWindow[STYLE_SHEET_REGISTRY_KEY];

		this.styleEl?.remove();
		this.styleEl = null;
		// Both targets are gone; nothing is installed to compare against.
		this.lastCssText = null;
	}
}
