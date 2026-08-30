/**
 * manager/theme/StudioWeightCache.ts — how hard studio mode has to push, in
 * this vault, right now.
 *
 * Studio mode wins on two axes at once: `!important`, which beats a theme's
 * ordinary declarations outright, and selector weight, which is what decides
 * between two declarations that are *both* `!important`. Only the second has to
 * be measured, and only against the theme's own `!important` callout rules —
 * see `studioWeightFor`. Most themes have none, and those vaults get weight 1.
 *
 * ## Two levels of caching, and both are load-bearing
 *
 * The scan reads the whole theme — ~850 KB for ITS Theme, up to 24 ms measured
 * across the installed set — so:
 *
 * - **Across passes**, `ThemeCalloutStore` keys on `stylingSignature()`, a
 *   short string, so an inject on an unchanged theme costs one comparison.
 * - **Within a pass**, {@link resolve} memoises, so a vault with forty studio
 *   callouts scans once rather than forty times.
 *
 * Unlike the opt-in rung this replaced, studio is the common case, so the
 * within-pass memo is now what does the real work; the store is still built
 * lazily, but in practice it is always built.
 *
 * ## Why this cannot loop
 *
 * Switching theme fires `css-change`, which re-injects. The signature has
 * moved, so the scan re-runs, the weight may change, and the emitted CSS
 * differs and is applied — which fires this plugin's *own* `css-change` and
 * re-injects once more. That second pass finds an unchanged signature, produces
 * byte-identical text, and stops before the stylesheet swap and before the
 * trigger. It terminates in one round *only* because of that byte-identical
 * short-circuit in `CSSInjector.injectNow`, so do not "simplify" that away.
 *
 * Note for anyone adding a second consumer of the store: `resolve()` advances
 * `ThemeCalloutStore`'s signature as a side effect of asking it anything. A
 * caller that wants to know "did the theme change since I last looked?" must
 * keep its own memo rather than reading the store's — see
 * `themeRowSync.ts`, which does exactly that.
 */
import type { App } from "obsidian";
import { studioWeightFor } from "./studioWeight";
import { ThemeCalloutStore } from "./ThemeCalloutStore";
import type { AccentDialect } from "./accentDialect";
import type { CalloutSurface } from "./calloutSurface";
import { coreAccentDialect } from "../../utils/calloutColorFormat";

export class StudioWeightCache {
	private store: ThemeCalloutStore | null = null;
	private weight: number | null = null;
	private accent: AccentDialect | null = null;
	private surfaceClaim: CalloutSurface | null = null;

	constructor(private readonly app: App) {}

	/**
	 * The theme scanner, built on first use.
	 *
	 * Shared with the settings tab rather than letting it build a second one:
	 * one scan, one cache, one signature check — and no way for the list on
	 * screen to disagree with the CSS that was actually emitted.
	 */
	themeCallouts(): ThemeCalloutStore {
		this.store ??= new ThemeCalloutStore(this.app);
		return this.store;
	}

	/**
	 * Drop the within-pass memo. Called at the *start* of an inject rather than
	 * the end, so a throw mid-pass cannot leave the next one reusing a weight
	 * derived from a theme that is no longer active.
	 */
	beginPass(): void {
		this.weight = null;
		this.accent = null;
		this.surfaceClaim = null;
	}

	/** The `.callout` repeat count studio mode should emit at. */
	resolve(): number {
		this.weight ??= studioWeightFor(this.themeCallouts().maxImportantClasses());
		return this.weight;
	}

	/**
	 * Which spelling of `--callout-*` the active styling expects.
	 *
	 * Memoised here, beside {@link resolve}, rather than in `accentDialect.ts`
	 * itself — and that placement is the whole point. This class never asks the
	 * store "has anything changed?"; it asks for data and lets {@link beginPass}
	 * decide freshness. A signature-keyed memo inside the dialect module would
	 * walk straight into the hazard in this file's header: `resolve()` has
	 * already advanced the store's signature by the time such a memo looked.
	 *
	 * Lazy rather than filled in `beginPass`, because `cssSnippetExport` reads
	 * the accent declarations outside any inject pass.
	 */
	dialect(): AccentDialect {
		this.accent ??= this.themeCallouts().accentDialect(coreAccentDialect());
		return this.accent;
	}

	/**
	 * What the active styling says about the surface of a callout it does not
	 * name — see `calloutSurface.ts`.
	 *
	 * Memoised here for the same reason {@link dialect} is, and it is the same
	 * hazard: this class asks the store for data and lets {@link beginPass} decide
	 * freshness, because `resolve()` has already advanced the store's signature by
	 * the time any memo of its own could look. Lazy rather than filled in
	 * `beginPass`, because `cssSnippetExport` emits outside any inject pass.
	 */
	surface(): CalloutSurface {
		this.surfaceClaim ??= this.themeCallouts().calloutSurface();
		return this.surfaceClaim;
	}
}
