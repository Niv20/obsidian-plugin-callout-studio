/**
 * utils/calloutColorFormat.ts — which spelling of `--callout-*` the running
 * Obsidian expects.
 *
 * Obsidian 1.13 changed its own callout accent variables from a bare RGB
 * triplet (`8, 109, 221`, only meaningful once Obsidian wraps it in `rgb()`) to
 * a full CSS colour (`#086ddd`, used directly). One release has to serve both,
 * so every value this plugin writes into `--callout-color`, and every read of
 * core's `--callout-info` &c, goes through here.
 *
 * Its own module rather than three more functions in `colorUtils.ts`: those are
 * pure maths on colours, while these three are a version check with a cache,
 * and they are the only reason that file would need to import from `obsidian`.
 */
import { requireApiVersion } from "obsidian";
import { hexToRgbString } from "./colorUtils";

/**
 * Cached version check. `null` until first computed; avoids calling
 * `requireApiVersion` for every callout on every CSS inject.
 */
let calloutColorIsRaw: boolean | null = null;

/**
 * True when the running Obsidian keeps `--callout-*` as bare RGB triplets, i.e.
 * ≤1.12.
 *
 * Exposed because one caller has to branch on the *format* rather than just
 * emit it: the fallback block hands core's own variable straight back to core,
 * so on ≤1.12 it must stay a raw triplet, while on 1.13+ it can go through the
 * `<color>`-typed `--cs-accent-theme` and pick up its validation.
 */
export function calloutColorUsesRawTriplet(): boolean {
	if (calloutColorIsRaw === null) {
		calloutColorIsRaw = !requireApiVersion("1.13.0");
	}
	return calloutColorIsRaw;
}

/**
 * Returns the value to assign to Obsidian's `--callout-color` variable for the
 * current Obsidian version.
 */
export function calloutColorValue(hex: string): string {
	return calloutColorUsesRawTriplet() ? hexToRgbString(hex) : hex;
}

/**
 * Read one of Obsidian's own `--callout-*` variables as a real CSS colour.
 *
 * The same split from the other side: on 1.13+ `--callout-info` already holds a
 * colour and can be used as-is, while on ≤1.12 it holds a bare triplet that
 * only means anything inside `rgb()`. This is what lets an untouched built-in
 * leave `--callout-color` alone — so core's own rule, and any theme that
 * overrides it, decides the accent — while `--cs-accent` still resolves to
 * something the plugin's `color-mix()` calls can consume.
 */
export function calloutAccentVarRef(cssVar: string): string {
	return calloutColorUsesRawTriplet()
		? `rgb(var(${cssVar}))`
		: `var(${cssVar})`;
}
