/**
 * utils/calloutColorFormat.ts — which spelling of `--callout-*` to write.
 *
 * Obsidian 1.13 changed its own callout accent variables from a bare RGB
 * triplet (`8, 109, 221`, only meaningful once Obsidian wraps it in `rgb()`) to
 * a full CSS colour (`#086ddd`, used directly). This file used to answer the
 * whole question from that version check alone, and that was only ever half of
 * it: **the variable is read by whoever wrote the rules that consume it, and
 * once a theme is active that is usually the theme.** A theme written before
 * 1.13 and never updated still writes `rgba(var(--callout-color), 0.1)`, which
 * a hex makes invalid at computed-value time — the declaration silently unsets
 * and the colour disappears.
 *
 * So what survives here is the *core* half: what the running Obsidian expects.
 * `manager/theme/accentDialect.ts` answers the theme half by reading the
 * theme's own text, and `StudioWeightCache.dialect()` is where the two meet.
 * Every function below now takes that answer as an argument rather than
 * consulting a module-level cache — a theme-dependent module cache would need
 * its own `css-change` invalidation, which is the staleness hazard
 * `StudioWeightCache` already documents, and it is also what made the old
 * behaviour impossible to test per theme.
 */
import { requireApiVersion } from "obsidian";
import type {
	AccentDialect,
	AccentSpelling,
} from "../manager/theme/accentDialect";
import { hexToRgbString } from "./colorUtils";

/**
 * Cached version check. `null` until first computed; avoids calling
 * `requireApiVersion` for every callout on every CSS inject.
 */
let calloutColorIsRaw: boolean | null = null;

/**
 * True when the running Obsidian keeps `--callout-*` as bare RGB triplets, i.e.
 * ≤1.12.
 */
export function calloutColorUsesRawTriplet(): boolean {
	if (calloutColorIsRaw === null) {
		calloutColorIsRaw = !requireApiVersion("1.13.0");
	}
	return calloutColorIsRaw;
}

/**
 * The spelling the running Obsidian itself uses.
 *
 * The fallback for every vault whose theme has no opinion — 196 of the 257 in
 * the dev vault — which is what keeps the dialect machinery invisible there.
 */
export function coreAccentDialect(): AccentSpelling {
	return calloutColorUsesRawTriplet() ? "triplet" : "color";
}

/**
 * The value to assign to Obsidian's `--callout-color`, in the spelling the
 * active styling's read sites expect.
 */
export function calloutColorValue(hex: string, dialect: AccentDialect): string {
	return dialect.read === "triplet" ? hexToRgbString(hex) : hex;
}

/**
 * Read one of Obsidian's own `--callout-*` variables as a real CSS colour.
 *
 * The same split from the other side, and here it is **per variable**, because
 * that is how themes actually behave: Composer declares `--callout-error` as a
 * triplet while reading `--callout-color` as a colour, and six themes declare
 * triplets they never read at all. A triplet handed to `--cs-accent-theme` —
 * registered `<color>` in `styles.css` — fails the type check and falls back to
 * its grey initial value, which is why getting this wrong greys every heading
 * bar and inline pill on an unmodified built-in rather than failing loudly.
 *
 * When the theme says nothing about the variable **in this mode**, core's own
 * spelling decides, which is what lets an untouched built-in leave
 * `--callout-color` alone — so core's rule, and any theme that overrides it,
 * keeps deciding the accent — while `--cs-accent` still resolves to something
 * `color-mix()` can consume.
 */
export function calloutAccentVarRef(
	cssVar: string,
	dialect: AccentDialect,
	mode: "light" | "dark",
): string {
	return accentVarSpelling(cssVar, dialect, mode) === "triplet"
		? `rgb(var(${cssVar}))`
		: `var(${cssVar})`;
}

/**
 * What `cssVar` actually holds in `mode`: the theme's word if it has one there,
 * else core's.
 *
 * Per mode, not just per variable, because ten installed themes declare an
 * accent variable under `.theme-dark` (or `.theme-light`) alone and leave the
 * other mode on core's value — see `ModeSpelling` in
 * `manager/theme/accentDialect.ts`.
 */
export function accentVarSpelling(
	cssVar: string,
	dialect: AccentDialect,
	mode: "light" | "dark",
): AccentSpelling {
	return dialect.declared.get(cssVar)?.[mode] ?? coreAccentDialect();
}
