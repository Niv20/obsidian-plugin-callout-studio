/**
 * tests/support/apiHarness.ts — shared scaffolding for the public-API suites.
 *
 * Not a `*.test.ts`, so `scripts/run-tests.mjs` never treats it as an entry
 * point; it is bundled into each suite that imports it.
 *
 * `CalloutStudioAPI` reads exactly two things off the plugin — `registry` and
 * `isKnownZeroUsageFallback` — so the "plugin" here is those two and a cast,
 * the same bargain `cssInjectorHarness.ts` and `discoveryHarness.ts` strike for
 * their own private surfaces. Importing the real `src/main` would drag the
 * whole plugin lifecycle into a suite that is about five methods.
 *
 * The one global it also needs is `activeDocument`. `getCalloutsDetailed()`
 * resolves `color` for whichever theme is on screen by reading
 * `activeDocument.body.classList`, and Node has no such global at all — so the
 * stub below is not replacing anything, it *is* the only document the code
 * under test ever sees. It is installed at module scope (`node --test` runs
 * each file in its own process, so it cannot leak between suites) and reset to
 * light by every {@link apiHarness} call, because a suite that forgot which
 * theme the previous test left behind would read colours off the wrong field.
 */
import { CalloutStudioAPI } from "../../src/api/PluginAPI";
import { CalloutRegistry } from "../../src/manager/CalloutRegistry";
import type CalloutStudioPlugin from "../../src/main";
import type { CalloutDefinition } from "../../src/types";

/* -------------------------------------------------------------------------- */
/* Fake activeDocument                                                        */
/* -------------------------------------------------------------------------- */

const themeClasses = new Set<string>();

(
	globalThis as unknown as {
		activeDocument: { body: { classList: { contains(c: string): boolean } } };
	}
).activeDocument = {
	body: {
		classList: {
			contains: (cls: string) => themeClasses.has(cls),
		},
	},
};

/** Which theme `getCalloutsDetailed()` thinks is on screen. */
export interface Theme {
	/** Put `theme-dark` on the body, as Obsidian does in dark mode. */
	dark(): void;
	/** Take it off again. */
	light(): void;
}

const theme: Theme = {
	dark: () => void themeClasses.add("theme-dark"),
	light: () => void themeClasses.delete("theme-dark"),
};

/* -------------------------------------------------------------------------- */
/* Harness                                                                    */
/* -------------------------------------------------------------------------- */

export interface ApiHarness {
	api: CalloutStudioAPI;
	registry: CalloutRegistry;
	/**
	 * Ids a *completed* prune scan concluded are written nowhere. Mutate it
	 * directly; the API asks the plugin on every call, so there is nothing to
	 * invalidate.
	 */
	zeroUsage: Set<string>;
	/** Every id `isKnownZeroUsageFallback` was asked about, in order. */
	usageQueries: string[];
	theme: Theme;
}

/**
 * An API over a fresh registry — all 13 built-ins seeded, exactly as a first
 * run seeds them.
 *
 * `load(null)` rather than the bare constructor: the constructor only stocks
 * `builtInDefaults`, and it is `load` that seeds the live map and stocks
 * `settings` from DEFAULT_SETTINGS.
 */
export function apiHarness(): ApiHarness {
	theme.light();

	const registry = new CalloutRegistry();
	registry.load(null);

	const zeroUsage = new Set<string>();
	const usageQueries: string[] = [];

	const plugin = {
		registry,
		isKnownZeroUsageFallback: (id: string): boolean => {
			usageQueries.push(id);
			return zeroUsage.has(id);
		},
	} as unknown as CalloutStudioPlugin;

	return {
		api: new CalloutStudioAPI(plugin),
		registry,
		zeroUsage,
		usageQueries,
		theme,
	};
}

/* -------------------------------------------------------------------------- */
/* Definition helpers                                                         */
/* -------------------------------------------------------------------------- */

/**
 * One neutral user callout to vary from. Light and dark accents differ, because
 * that is the ordinary case and it is what makes `details.color` observable.
 */
export function definition(over: Partial<CalloutDefinition> = {}): CalloutDefinition {
	return {
		id: "quiet",
		displayName: "Quiet",
		icon: { type: "lucide", value: "pencil" },
		colorLight: "#336699",
		colorDark: "#88bbee",
		foldable: false,
		defaultFolded: false,
		builtIn: false,
		source: "user",
		...over,
	};
}

/**
 * An auto-created row exactly as `addUnknownCalloutsAsFallback` leaves one:
 * `source: "fallback"`, never customized. This is the only shape the usable
 * filter treats as a candidate for dropping, so every discovery test starts
 * here and changes one field at a time.
 */
export function discovered(id: string, over: Partial<CalloutDefinition> = {}): CalloutDefinition {
	return definition({
		id,
		displayName: id,
		source: "fallback",
		...over,
	});
}

/** The ids in a list of API results, in the order the API returned them. */
export const ids = (list: readonly { id: string }[]): string[] => list.map((c) => c.id);
