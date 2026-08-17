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
	CalloutIcon,
	CalloutRenderRole,
	UserImageIcon,
} from "../types";
import { CALLOUT_RENDER_ROLES } from "../types";
import { isDefaultIconAdjust, resolveIconAdjust } from "../utils/iconAdjust";
import { renderIconInto } from "../icons/renderIcon";
import { followsCalloutColor, userImageFor } from "../icons/packs/userImages";
import { createIconResolver } from "../icons/resolver";
import { packFor } from "../icons/registry";
import type { IconResolver } from "../icons/types";
import {
	bgGradientCss,
	tintColorAt,
	tintCss,
} from "../utils/colorUtils";
import {
	accentDeclarations,
	ownAccentDeclarations,
} from "./accentDeclarations";
import { resolveBgAlpha } from "../utils/bgTintAlpha";
import { OBSIDIAN_CALLOUT_VAR } from "../constants";
import { svgToDataUri } from "../icons/svg";
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
import { emitWeightFor, styleModeOf } from "./styleMode";
import { generateFallbackCSS } from "./css/fallbackCSS";
import { iconBoxWidth } from "./css/iconBox";
import { calloutSelAt, tokenAttrSel } from "../utils/calloutSelector";
import type { CalloutRegistry } from "./CalloutRegistry";
import { StartupStyleCache } from "./StartupStyleCache";

const STYLE_SHEET_REGISTRY_KEY = "__calloutStudioStyleSheet";
type RegistryWindow = Window & {
	[STYLE_SHEET_REGISTRY_KEY]?: CSSStyleSheet;
};

const STYLE_EL_ID = "callout-studio-dynamic-css";

/** One `background-image` layer: a gradient sweep. */
interface BgLayer {
	image: string;
}

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
	 * callout currently being written — 1 for everything except force mode.
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
	 * Background declarations for one theme mode: the color plus, when a
	 * gradient is set, the image layered on top. The `background-color`
	 * doubles as the fallback if a renderer drops the image;
	 * `print-color-adjust: exact` keeps the image from being stripped when
	 * exporting to PDF / printing. Empty when the mode has no background
	 * color (a gradient alone has no base to render on).
	 *
	 * The color is emitted as a TRANSLUCENT tint that renders as the authored
	 * hex on the theme's own background, not as the hex itself. That is what
	 * restores Obsidian's nesting: core gives nested callouts their stepped look
	 * purely by compositing translucent layers, and an opaque fill hides
	 * everything behind it — under `mix-blend-mode: darken` a colour over itself
	 * is `min(x, x) = x`, a step of exactly zero. The callout looks unchanged on
	 * its own; only what shows *through* it changes. There is no opt-out into an
	 * opaque fill: it would break nesting for every callout stacked inside it.
	 *
	 * `transparentBg` is the one way out and is checked FIRST, before the
	 * no-background return below — a transparent def carries no bg hex at all,
	 * so it would otherwise fall out here emitting nothing, and "nothing" is not
	 * transparent: it hands the callout back to core's own default tint. It is
	 * also not the opaque opt-out in disguise (see `CalloutDefinition`): zero
	 * alpha hides nothing, so a callout nested inside a transparent one still
	 * tints normally.
	 */
	private bgProps(
		def: CalloutDefinition,
		mode: "light" | "dark",
		important = false,
	): string[] {
		if (def.transparentBg) {
			const impT = important ? " !important" : "";
			// `background-image: none` is load-bearing, not belt-and-braces: a
			// theme can paint one, and it also stops a gradient left behind by
			// hand-edited data from showing through the cleared colour.
			return [
				`  background-color: transparent${impT};`,
				`  background-image: none${impT};`,
			];
		}
		const bg = mode === "dark" ? def.bgColorDark : def.bgColorLight;
		if (!bg) return [];
		const imp = important ? " !important" : "";
		const alpha = this.bgAlphaFor(def, mode);
		const color =
			alpha === null
				? bg
				: tintCss(tintColorAt(bg, mode === "dark", alpha), alpha);
		const props = [`  background-color: ${color}${imp};`];
		const layer = this.bgImageFor(def, mode);
		if (layer) {
			props.push(
				`  background-image: ${layer.image}${imp};`,
				`  -webkit-print-color-adjust: exact${imp};`,
				`  print-color-adjust: exact${imp};`,
			);
		}
		return props;
	}

	/**
	 * The outline half of `transparentBg` — emitted only for a def that clears
	 * its background, and only for the block-callout roles.
	 *
	 * Clearing the background alone still leaves the box outlined on any theme
	 * that gives callouts a frame. Core draws that frame itself:
	 *
	 *     .callout {
	 *       border-style: solid;
	 *       border-color: color-mix(in oklch, var(--callout-color)
	 *                     calc(var(--callout-border-opacity) * 100%), transparent);
	 *       border-width: var(--callout-border-width);   // 0px out of the box
	 *     }
	 *
	 * so a theme turns it on by doing nothing more than raising that width — and
	 * the colour it comes out in is `--callout-color`, which is *this plugin's*
	 * accent. The callout the user asked to disappear reads as an empty outline
	 * in their custom colour instead. Some themes draw the same frame — or an
	 * elevation ring — as an inset `box-shadow` keyed off the very same
	 * variable instead of (or in addition to) `border`, so both have to go.
	 *
	 * `border-color` rather than the `--callout-border-opacity` knob, even
	 * though the knob is what core's own rule reads: custom properties inherit,
	 * so zeroing it here would also silently reach every callout NESTED inside
	 * this one and strip the theme's frame off callouts nobody made transparent.
	 * The colour is per-element and can't leak. It also outranks the variable
	 * route anyway — core declares the border on `.callout` (0,1,0) while this
	 * lands on `.callout[data-callout="…"]` (0,2,0). `box-shadow: none` has no
	 * comparable variable to leak through in the first place — it fully
	 * replaces whatever the theme declared for this callout alone.
	 *
	 * The width is deliberately left alone: the frame keeps its box, so a
	 * transparent callout still lines up with its neighbours and nothing
	 * reflows — only the ink goes.
	 *
	 * `border-color` is empty when the user has switched the plugin's OWN
	 * global border on. That border is an explicit choice, drawn in the accent
	 * by `generateGlobalStyleCSS` at one class less than this rule, so clearing
	 * the colour here would quietly erase it. `box-shadow: none` carries no
	 * such conflict — the plugin never draws its own border that way — so it is
	 * unconditional.
	 */
	private transparentBorderProps(important = false): string[] {
		const imp = important ? " !important" : "";
		const { top, right, bottom, left } =
			this.registry.settings.globalStyle.borderSides;
		const props = [`  box-shadow: none${imp};`];
		if (!(top || right || bottom || left)) {
			props.push(`  border-color: transparent${imp};`);
		}
		return props;
	}

	/**
	 * The `background-image` layer for one mode: the gradient sweep, or null
	 * when the def has no gradient, or when the mode has no background color
	 * to sweep from.
	 *
	 * Both stops go through the same tint solve as the flat color above, at the
	 * one shared alpha from `bgAlphaFor`. They have to: an opaque gradient
	 * painted over a translucent `background-color` would put the opaque layer
	 * back on top and re-hide the backdrop the tint just exposed.
	 */
	private bgImageFor(
		def: CalloutDefinition,
		mode: "light" | "dark",
	): BgLayer | null {
		// A sweep is a background, so transparency wins over it. `bgProps`
		// already returns before reaching here; this guards the hand-edited case
		// where a gradient survived alongside the flag.
		if (def.transparentBg) return null;
		const bg = mode === "dark" ? def.bgColorDark : def.bgColorLight;
		if (!bg) return null;
		if (!def.bgGradient) return null;
		const isDark = mode === "dark";
		const to = isDark
			? def.bgGradient.toColorDark
			: def.bgGradient.toColorLight;
		const alpha = this.bgAlphaFor(def, mode);
		if (alpha === null) {
			return { image: bgGradientCss(bg, to, def.bgGradient) };
		}
		return {
			image: bgGradientCss(
				tintCss(tintColorAt(bg, isDark, alpha), alpha),
				tintCss(tintColorAt(to, isDark, alpha), alpha),
				def.bgGradient,
			),
		};
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
	private textSweepProps(image: string, under: string | null): string[] {
		return [
			`  background-image: ${image}, ${under ?? "none"};`,
			`  -webkit-background-clip: text, border-box;`,
			`  background-clip: text, border-box;`,
			`  -webkit-text-fill-color: transparent;`,
			`  -webkit-print-color-adjust: exact;`,
			`  print-color-adjust: exact;`,
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
	): string[] {
		const light = this.textGradientCss(def, "light");
		if (!light) return [];
		const under = (mode: "light" | "dark"): string | null =>
			ownsBackground ? (this.bgImageFor(def, mode)?.image ?? null) : null;
		const lightProps = this.textSweepProps(light, under("light"));
		const rules = [`${selectorsFor("")} {\n${lightProps.join("\n")}\n}`];
		const dark = this.textGradientCss(def, "dark");
		if (dark) {
			const darkProps = this.textSweepProps(dark, under("dark"));
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
		rules.push(
			`@media print {\n${selectorsFor("")},\n${selectorsFor(".theme-dark ")} {\n` +
				`  background-image: none;\n` +
				`  -webkit-background-clip: border-box;\n` +
				`  background-clip: border-box;\n` +
				`  -webkit-text-fill-color: currentColor;\n` +
				`}\n}`,
		);
		return rules;
	}

	/**
	 * True when the def needs a `.theme-dark` override block — any of its
	 * mode-dependent colors (accent, background, gradient end) differ.
	 */
	private needsDarkBlock(def: CalloutDefinition): boolean {
		return (
			def.colorLight !== def.colorDark ||
			def.bgColorLight !== def.bgColorDark ||
			(!!def.bgGradient &&
				def.bgGradient.toColorLight !== def.bgGradient.toColorDark)
		);
	}

	generateCalloutCSS(def: CalloutDefinition, standalone = false): string {
		// The theme (or a CSS snippet, or Obsidian itself) owns this one — see
		// CalloutDefinition.externalStyle. Guarding the whole function rather
		// than its one call site means every block below goes quiet together:
		// accent variables, --callout-icon, background and gradient, content
		// colour, the ::after icon override that hides core's own <svg>, icon
		// transforms, title sweeps, token colours, the fold arrow, the print
		// ::before — and the alias copies of all of them at the end.
		//
		// One deliberate exception, below: a callout the user asked to draw with
		// no icon at all. A theme cannot express that on the owner's behalf, and
		// the single `display: none` it takes cannot fight the theme over any of
		// the things this flag exists to protect.
		const hidesIcon = def.hideIcon === true;
		const mode = styleModeOf(def);
		// Force changes nothing about *what* is emitted, only how hard the
		// selectors push — so it is one number. Set unconditionally and before
		// the early return, so a leftover value can never reach the next
		// callout even if something below throws.
		this.emitWeight = emitWeightFor(mode);
		if (mode === "theme") {
			return hidesIcon ? this.iconHiddenCSS(def) : "";
		}

		// Emitting `--callout-icon` for a hidden icon would be harmless (the box
		// it lands in is display:none) but it would also keep Obsidian resolving
		// artwork nobody sees, so the whole icon half of this function goes quiet
		// together — the property, both ::after overrides and the transform.
		const iconCSS = hidesIcon ? "" : this.getIconCSS(def);

		const parts: string[] = [];
		if (hidesIcon) parts.push(this.iconHiddenCSS(def));

		// Light mode (default). See accentProps for what the three color
		// variables are and why an untouched built-in gets only two of them.
		const lightProps: string[] = [...this.accentProps(def, "light")];
		if (iconCSS) lightProps.push(`  --callout-icon: ${iconCSS};`);
		lightProps.push(...this.bgProps(def, "light"));
		// Only in the light rule, which is unscoped and so matches both themes:
		// the frame's colour is the same in either one, and the dark block below
		// exists purely for the values that differ.
		if (def.transparentBg) {
			lightProps.push(...this.transparentBorderProps());
		}
		parts.push(`${this.sel(def.id)} {\n${lightProps.join("\n")}\n}`);

		// Dark mode override
		if (this.needsDarkBlock(def)) {
			const darkProps: string[] = [...this.accentProps(def, "dark")];
			darkProps.push(...this.bgProps(def, "dark"));
			parts.push(
				`${this.sel(def.id, ".theme-dark ")} {\n${darkProps.join("\n")}\n}`,
			);
		}

		// Content text color overrides
		if (def.textColorLight) {
			parts.push(
				`${this.sel(def.id)} > .callout-content {\n` +
					`  color: ${def.textColorLight};\n` +
					`}`,
			);
		}
		if (def.textColorDark && def.textColorDark !== def.textColorLight) {
			parts.push(
				`${this.sel(def.id, ".theme-dark ")} > .callout-content {\n` +
					`  color: ${def.textColorDark};\n` +
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
			parts.push(this.generateIconOverride(def.id, def.icon, iconSvg));
		}

		// Emoji icon override (renders the glyph via ::after) for live view.
		if (!hidesIcon && def.icon.type === "emoji") {
			parts.push(this.generateEmojiOverride(def.id, def.icon.value));
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
			),
		);

		// Heading-bar / inline-pill colors: our own DOM — see cssSnippetExport.
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
						...this.accentProps(def, "dark"),
					];
					aliasDarkProps.push(...this.bgProps(def, "dark"));
					parts.push(
						`${this.sel(alias, ".theme-dark ")} {\n${aliasDarkProps.join("\n")}\n}`,
					);
				}
				if (def.textColorLight) {
					parts.push(
						`${this.sel(alias)} > .callout-content {\n  color: ${def.textColorLight};\n}`,
					);
				}
				if (
					def.textColorDark &&
					def.textColorDark !== def.textColorLight
				) {
					parts.push(
						`${this.sel(alias, ".theme-dark ")} > .callout-content {\n  color: ${def.textColorDark};\n}`,
					);
				}
				if (iconSvg) {
					parts.push(
						this.generateIconOverride(alias, def.icon, iconSvg),
					);
				}
				if (!hidesIcon && def.icon.type === "emoji") {
					parts.push(
						this.generateEmojiOverride(alias, def.icon.value),
					);
				}
				const aliasTransform = hidesIcon
					? ""
					: this.getIconTransformCSS({
							...def,
							id: alias,
						});
				if (aliasTransform) {
					parts.push(aliasTransform);
				}
			}
		}

		this.emitWeight = 1;
		return parts.join("\n\n");
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
		const parts = [`${selectorsFor("")} {\n  color: ${light};\n}`];
		if (dark !== light) {
			parts.push(
				`${selectorsFor(".theme-dark ")} {\n  color: ${dark};\n}`,
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

		const parts: string[] = [
			`${selectorsFor("")} {\n${this.ownAccentProps(def, "light").join("\n")}\n}`,
		];
		if (def.colorLight !== def.colorDark) {
			parts.push(
				`${selectorsFor(".theme-dark ")} {\n${this.ownAccentProps(def, "dark").join("\n")}\n}`,
			);
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
	): string {
		const light = this.bgImageFor(def, "light");
		if (!light) return "";
		const beforeProps = (image: string): string =>
			`  content: "";\n` +
			`  position: absolute;\n` +
			`  inset: 0;\n` +
			`  z-index: -1;\n` +
			`  border-radius: inherit;\n` +
			`  background-image: ${image};\n` +
			`  filter: opacity(0.999);\n` +
			`  -webkit-print-color-adjust: exact;\n` +
			`  print-color-adjust: exact;`;
		// z-index: 0 scopes the ::before's -1 to the element's own stacking
		// context, so it sits above the background-color but under text and
		// icon. Both theme prefixes are grouped so this later rule wins over
		// the screen bg rules in either mode; the ::before then follows the
		// usual explicit-undefined cascade (unscoped light rule, dark
		// override only when the gradient differs).
		const hostProps = [
			...(hideElementGradient ? ["  background-image: none;"] : []),
			"  position: relative;",
			"  z-index: 0;",
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

			parts.push(
				`${this.iconTransformSelector(def.id, role)} {\n` +
					`  transform: ${transforms.join(" ")};\n` +
					`  transform-origin: center;\n` +
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
	 * global rule (whose `:where()` exclusion suffix contributes zero), so it wins
	 * on weight alone and needs no `!important`.
	 */
	private iconHiddenCSS(def: CalloutDefinition): string {
		const aligned =
			this.registry.settings.globalStyle.alignContentWithTitle;
		const parts: string[] = [];
		for (const id of [def.id, ...(def.aliases ?? [])]) {
			parts.push(
				`${this.sel(id)} > .callout-title > .callout-icon {\n` +
					`  display: none;\n` +
					`}`,
			);
			if (aligned) {
				parts.push(
					`${this.sel(id)} > .callout-content {\n` +
						`  padding-inline-start: 0;\n` +
						`}`,
				);
			}
		}
		return parts.join("\n\n");
	}

	/**
	 * Emit the live-view icon rule for a callout.
	 *
	 * Every library icon is a monochrome glyph, so it is drawn as a mask tinted
	 * with the callout's colour. A picture the user supplied may be neither: a
	 * mask is a stencil, and running a logo or a photograph through one throws
	 * its colours away and leaves a silhouette. Those get a background image
	 * instead — the same reasoning that already keeps emoji out of the mask path.
	 */
	private generateIconOverride(
		calloutId: string,
		icon: CalloutIcon,
		svg: string,
	): string {
		const picture = userImageFor(icon);
		if (picture && !followsCalloutColor(icon, picture)) {
			return this.generateImageOverride(calloutId, svg, picture);
		}
		return this.generateIconMaskOverride(calloutId, svg, picture);
	}

	private getIconCSS(def: CalloutDefinition): string {
		const pack = packFor(def.icon);
		if (!pack) return "";
		// Lucide is Obsidian's own set, so the stored id is already the value
		// core CSS wants — emitted verbatim, and deliberately not put through
		// `resolveLucideId` first. That repair asks whether an id is core
		// Lucide, and this runs during plugin load, before a plugin that
		// registered its own ids with `addIcon()` has necessarily loaded; a
		// wrong answer here would be baked into the stylesheet *and* into the
		// localStorage startup snapshot. `load()`'s migration has already
		// repaired the stored value by this point, and the DOM pass
		// (`paintIcons` → `renderIconInto`) resolves again at render time.
		if (pack.kind === "builtin") return def.icon.value;
		// Everything else needs a valid Lucide id as a placeholder
		// --callout-icon so Obsidian renders *something* at first paint. The
		// real glyph is then painted into the DOM by paintIcons (which also
		// makes it survive PDF export).
		return "lucide-pencil";
	}

	/**
	 * Generates CSS that renders a pack icon via a mask-image ::after, for the
	 * live (Reading view / Live Preview) rendering. Wrapped in `@media screen`
	 * so it does NOT apply to PDF export (print media): there, the inline-SVG copy
	 * baked into the DOM by paintIcons is shown instead, which is far more
	 * reliable in Chromium's print pipeline than a CSS mask.
	 *
	 * The data URI is declared once into a custom property rather than repeated
	 * for the prefixed and unprefixed mask properties. The whole stylesheet is
	 * also written to localStorage on every inject (see StartupStyleCache), and
	 * an inlined SVG is by far the largest thing in it, so halving each
	 * occurrence is worth the indirection.
	 */
	private generateIconMaskOverride(
		calloutId: string,
		svg: string,
		picture?: UserImageIcon,
	): string {
		const dataUri = svgToDataUri(svg);
		const sel = this.sel(calloutId);
		return (
			`@media screen {\n` +
			`${sel} > .callout-title > .callout-icon > svg {\n` +
			`  display: none;\n` +
			`}\n` +
			`${sel} > .callout-title > .callout-icon::after {\n` +
			`  --cs-icon-mask: ${dataUri};\n` +
			`  content: "";\n` +
			`  display: inline-block;\n` +
			`  width: ${iconBoxWidth(picture)};\n` +
			`  height: var(--icon-size, 1.2em);\n` +
			`  -webkit-mask-image: var(--cs-icon-mask);\n` +
			`  mask-image: var(--cs-icon-mask);\n` +
			`  -webkit-mask-size: contain;\n` +
			`  mask-size: contain;\n` +
			`  -webkit-mask-repeat: no-repeat;\n` +
			`  mask-repeat: no-repeat;\n` +
			`  background-color: var(--cs-accent);\n` +
			`}\n` +
			`}`
		);
	}

	/**
	 * Generates CSS that renders a user's picture via the icon element's
	 * ::after, for live view — a background rather than a mask, so the picture
	 * arrives with its own colours instead of as a one-colour stencil.
	 *
	 * Wrapped in `@media screen` like the mask and emoji rules, so PDF export
	 * falls through to the DOM copy baked by paintIcons instead.
	 */
	private generateImageOverride(
		calloutId: string,
		svg: string,
		picture: UserImageIcon,
	): string {
		const dataUri = svgToDataUri(svg);
		const sel = this.sel(calloutId);
		return (
			`@media screen {\n` +
			`${sel} > .callout-title > .callout-icon > svg {\n` +
			`  display: none;\n` +
			`}\n` +
			`${sel} > .callout-title > .callout-icon::after {\n` +
			`  content: "";\n` +
			`  display: inline-block;\n` +
			`  width: ${iconBoxWidth(picture)};\n` +
			`  height: var(--icon-size, 1.2em);\n` +
			`  background-image: ${dataUri};\n` +
			`  background-size: contain;\n` +
			`  background-repeat: no-repeat;\n` +
			`  background-position: center;\n` +
			`}\n` +
			`}`
		);
	}

	/**
	 * Generates CSS that renders an emoji glyph via the icon element's ::after,
	 * for live view. Wrapped in `@media screen` so it does not apply to PDF export
	 * (print): there the DOM <span> baked by paintIcons is shown instead. Emojis
	 * keep their own colors, so no mask/background-color is applied.
	 */
	private generateEmojiOverride(calloutId: string, emoji: string): string {
		// Defensive escaping for the CSS string literal (emojis contain neither
		// backslashes nor quotes, but keep it safe against future data changes).
		const safe = emoji.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
		const sel = this.sel(calloutId);
		return (
			`@media screen {\n` +
			`${sel} > .callout-title > .callout-icon > svg {\n` +
			`  display: none;\n` +
			`}\n` +
			`${sel} > .callout-title > .callout-icon::after {\n` +
			`  content: "${safe}";\n` +
			`  display: inline-block;\n` +
			`  font-size: var(--icon-size, 1.2em);\n` +
			`  line-height: 1;\n` +
			`}\n` +
			`}`
		);
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
	 * Returns undefined for a callout marked `externalStyle`, which is the one
	 * case where a *recognized* ID resolves to nothing: the caller's job is to
	 * paint, and there is nothing of ours to paint there.
	 *
	 * Only for `.callout[data-callout]` elements. Heading-bar and inline-pill
	 * DOM is ours and carries the space-form ID; those go through
	 * renderShared.resolveCalloutDef instead, which tries the exact ID and alias
	 * first and only then the attribute form, so unknown IDs still earn their
	 * `.cs-unknown` class.
	 */
	private resolveDef(attrId: string): CalloutDefinition | undefined {
		const direct = this.registry.findByAttrId(attrId);
		// An externally styled callout resolves to nothing, which sends
		// paintIcons down its restore path instead of its paint path. This
		// matters even though no CSS is emitted for it: renderIconInto REPLACES
		// the <svg> Obsidian (or the theme, via --callout-icon) already
		// rendered, so continuing to paint would be the loudest possible way to
		// keep interfering. Returned rather than skipped at the call site so the
		// title-gradient sync goes quiet on the same check.
		if (direct) return direct.externalStyle === true ? undefined : direct;
		return this.registry.get(this.registry.settings.fallbackCalloutId);
	}

	/**
	 * Prepare a `.callout-icon` for PDF export.
	 *
	 * Live view (Reading view / Live Preview = screen media) renders pack icons
	 * and emoji via CSS `::after` (see generateIconMaskOverride /
	 * generateEmojiOverride), which we wrap in `@media screen`. Here we bake a
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
	 * Selector suffix that lifts every externally styled callout out of a rule
	 * keyed on nothing but `.callout` — `""` when the user has handed none to
	 * their theme.
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
			if (def.externalStyle !== true) continue;
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
		parts.push(
			`.callout${excl} > .callout-title > .callout-icon {\n` +
				`  margin-inline-end: var(--cs-regular-icon-gap, 0.15em);\n` +
				`}`,
		);

		const props: string[] = [];

		if (gs.borderRadius !== 4) {
			props.push(`  border-radius: ${gs.borderRadius}px;`);
		}

		// Border sides
		const { top, right, bottom, left } = gs.borderSides;
		const allSides = top && right && bottom && left;
		const anySide = top || right || bottom || left;
		const bStyle =
			`${gs.borderWidth}px solid ` +
			`color-mix(in oklch, var(--cs-accent, currentColor) 45%, transparent)`;

		if (allSides) {
			props.push(`  border: ${bStyle};`);
		} else if (anySide) {
			// Reset any default border first
			props.push(`  border: none;`);
			if (top) props.push(`  border-top: ${bStyle};`);
			if (right) props.push(`  border-right: ${bStyle};`);
			if (bottom) props.push(`  border-bottom: ${bStyle};`);
			if (left) props.push(`  border-left: ${bStyle};`);
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
					`  font-size: ${gs.titleScale}em;\n` +
					`}`,
			);
		}

		// Content scale
		if (gs.contentScale !== 1) {
			parts.push(
				`.callout${excl} > .callout-content {\n` +
					`  font-size: ${gs.contentScale}em;\n` +
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
					`  padding-inline-start: calc(var(--icon-size, 1.2em) + 0.2em + var(--cs-regular-icon-gap, 0.15em));\n` +
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
			resolveSvg: (icon, role) => this.icons.resolveSvg(icon, role),
			getIconCSS: (def) => this.getIconCSS(def),
			accentProps: (def, mode, important, imposed) =>
				this.accentProps(def, mode, important, imposed),
			ownAccentProps: (def, mode) => this.ownAccentProps(def, mode),
			bgProps: (def, mode, important) =>
				this.bgProps(def, mode, important),
			transparentBorderProps: (important) =>
				this.transparentBorderProps(important),
			needsDarkBlock: (def) => this.needsDarkBlock(def),
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
