/**
 * manager/theme/themeRowSync.ts — when the theme's callout rows are re-derived,
 * and in what order.
 *
 * The scheduling half of `themeProvidedRows.ts`, which owns the sweep itself.
 * The same split as `themeCalloutScan` / `ThemeCalloutStore` and
 * `themeAppearance` / `ThemeAppearanceProbe`, and for the same reason: the
 * sweep is a function of a registry and a store, and everything about *when* to
 * run it — the signature memo, the probe's lifetime, the order the two passes
 * and the re-inject go in — is a separate question with its own failure modes.
 *
 * Both halves live here rather than in `main.ts` because the ORDER is the
 * interesting part, and `main.ts` is lifecycle and wiring, not the place to
 * keep a rule about which of two theme-dependent passes goes first.
 *
 * ## Why it keeps its own signature memo
 *
 * `StudioWeightCache.resolve()` asks the store for `maxImportantClasses()`
 * during every inject, and asking the store *anything* advances its
 * `stylingSignature` memo. Since the inject runs before this sweep on the
 * `css-change` path, reading the store's memo here would report "nothing
 * changed" forever and the sweep would never fire. So the signature this
 * compares against is its own.
 *
 * ## Why the chain terminates
 *
 * Round 1 — the theme really changed: the signature differs, rows are minted or
 * pruned inside one `registry.batch()`, one `onChange` fires, `inject()`
 * produces different text, swaps it in and triggers `css-change`.
 * Round 2 — the listener re-injects with `emitCssChange = false`, the text is
 * byte-identical so `injectNow` returns before the swap, and the sweep finds an
 * unchanged signature and writes nothing. Two rounds, then quiet.
 *
 * The probe lands after both and announces its readings, which is a third
 * `onChange` — and it still cannot cycle, on two counts. Nothing that generates
 * CSS reads an appearance, so the `inject()` that `onChange` provokes produces
 * byte-identical text and never reaches the `css-change` trigger; and
 * `ThemeFacts.setAppearances` stays silent unless the readings actually moved,
 * so a pass that re-measures the same colours announces nothing at all — which
 * is also what keeps the deliberate clear below from becoming a loop.
 */
import type { App, EventRef } from "obsidian";
import type { CalloutDefinition } from "../../types";
import { stylingSignature, themeCss } from "./customCssApi";
import type { ThemeCalloutStore } from "./ThemeCalloutStore";
import { ThemeAppearanceProbe } from "./ThemeAppearanceProbe";
import type { ThemeAppearance } from "./themeAppearance";
import {
	syncThemeProvidedRows,
	type ThemeRowRegistry,
} from "./themeProvidedRows";

/** What {@link registerThemeRowSync} needs from the plugin. */
export interface ThemeSyncHost {
	app: App;
	registry: ThemeRowRegistry & {
		getAll(): CalloutDefinition[];
		vaultIdFormsFor(def: CalloutDefinition): string[];
		setThemeAppearances(
			map: ReadonlyMap<string, ThemeAppearance>,
		): boolean;
		themeOwns(def: CalloutDefinition): boolean;
	};
	cssInjector: {
		themeCallouts(): ThemeCalloutStore;
		inject(emitCssChange?: boolean): void;
	};
	registerEvent(ref: EventRef): void;
	/** Obsidian's `Component.register`, for the probe's teardown. */
	register(cb: () => void): void;
}

/**
 * Own everything that has to happen when the active styling changes: re-derive
 * the theme's callout rows, then re-inject.
 *
 * Both halves live here rather than in `main.ts` because the ORDER is the
 * interesting part — the sweep has to land before the inject that reads its
 * rows — and because `main.ts` is lifecycle and wiring, not the place to keep
 * a rule about which of two theme-dependent passes goes first.
 *
 * The re-inject passes `emitCssChange = false` so we do not re-emit
 * `css-change` in response to `css-change`: that would loop with other plugins
 * which also listen and re-emit (Style Settings, for one). The external
 * `css-change` already re-renders open notes, so re-emitting is both redundant
 * and harmful.
 */
export function registerThemeRowSync(host: ThemeSyncHost): void {
	// Owned here rather than on the plugin: nothing outside this function needs
	// a handle on it, and its whole job — re-read the theme, then re-inject — is
	// the job this function already coordinates.
	const appearance = new ThemeAppearanceProbe(host.app);
	host.register(() => {
		appearance.destroy();
	});
	let signature: string | null = null;
	/**
	 * `stylingSignature` plus the size of the theme's own stylesheet.
	 *
	 * The signature alone is theme name, version and enabled snippets, and none
	 * of those move when a theme is **reloaded** after being edited in place —
	 * so a theme that gained a callout id that way never got a row, on any
	 * number of `css-change` events. The length catches it.
	 *
	 * Deliberately kept here rather than folded into `stylingSignature` itself:
	 * that function is asked on every inject, by `StudioWeightCache`, and
	 * reading `styleEl.textContent` allocates the whole stylesheet — some
	 * hundreds of kilobytes for exactly the callout-heavy themes this matters
	 * for. This runs once at startup and once per `css-change`, which is where
	 * that read is affordable.
	 */
	const fingerprint = (): string =>
		`${stylingSignature(host.app)}|${themeCss(host.app).length}`;
	const sweep = (force = false): void => {
		const next = fingerprint();
		if (!force && next === signature) return;
		signature = next;
		// The store keys on `stylingSignature` alone, so a reload that moved only
		// the CSS text leaves its scan stale unless it is told outright. Cheap:
		// the re-scan it forces is the one this sweep was about to need anyway.
		host.cssInjector.themeCallouts().invalidate();
		// Publishes ownership as its first act, so a row minted this round is
		// already known to be the theme's by the time anything renders it.
		syncThemeProvidedRows(host.registry, host.cssInjector.themeCallouts());
	};

	/**
	 * Measure how the theme paints the callouts it owns, then re-inject.
	 *
	 * Second pass rather than part of the first because the measurement needs a
	 * rendered callout, which is asynchronous, and the sheet cannot wait for it:
	 * the block callouts are the theme's either way, and the only thing waiting
	 * on the probe is the heading/inline colour and the settings-row artwork.
	 * The extra inject is free when nothing moved — `injectNow` returns before
	 * the stylesheet swap on byte-identical output.
	 *
	 * Being second is also why `setThemeAppearances` announces itself: by the
	 * time the readings arrive the settings tab has already painted its theme
	 * rows, from the sweep's own `onChange` one turn earlier. Without the
	 * announcement a row that came up unmeasured stayed unmeasured on screen —
	 * no swatch, a placeholder icon — until something unrelated repainted the
	 * list, because `inject(false)` deliberately withholds the other event the
	 * tab listens to.
	 */
	const probe = (): void => {
		const owned = host.registry.getAll().filter((def) =>
			host.registry.themeOwns(def),
		);
		void appearance.ensure(
			owned.flatMap((def) => host.registry.vaultIdFormsFor(def)),
			() => {
				host.registry.setThemeAppearances(appearance.results());
				host.cssInjector.inject(false);
			},
		);
	};

	sweep(true);
	probe();
	host.registerEvent(
		host.app.workspace.on("css-change", () => {
			// Both halves of the stale answer go first, and the published half is
			// the one that used to be missed. `appearance.invalidate()` clears the
			// *probe's* cache, but the settings tab reads `ThemeFacts`, which the
			// probe only writes when its next pass lands — and `sweep()` publishes
			// ownership, whose `onChange` repaints the tab one turn earlier. Every
			// row therefore came up wearing the **outgoing** theme's artwork, which
			// is what "the settings screen is stuck on the last theme" was.
			// Answering `UNKNOWN_APPEARANCE` for a moment is the contract every
			// caller is already written against — see `ThemeAppearanceProbe`.
			//
			// The two publications share one `batch()`, so this *removes* a repaint
			// rather than adding one: the clear and the sweep collapse into the
			// single `onChange` the sweep was going to fire anyway.
			appearance.invalidate();
			host.registry.batch(() => {
				host.registry.setThemeAppearances(new Map());
				sweep();
			});
			host.cssInjector.inject(false);
			probe();
		}),
	);
}
