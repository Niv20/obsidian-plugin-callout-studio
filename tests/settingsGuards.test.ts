/**
 * tests/settingsGuards.test.ts — the values a settings file is allowed to carry:
 * the range check on its numbers, and the type check on its language.
 *
 * `globalStyle` is merged with a plain spread, which is right for its shape and
 * blind to its values, and every one of those values is interpolated straight
 * into a stylesheet by `CSSInjector` (`border-radius: ${gs.borderRadius}px`).
 * Both inputs are untrusted — an import file, and a `data.json` that syncs
 * between devices and can be hand-edited — so three things had to become true,
 * and each is a suite below:
 *
 * - **An absurd number is pulled back to the nearest limit.** `titleScale: 0`
 *   erases every callout title with nothing on screen to explain why, and no
 *   slider can undo a value it cannot represent.
 * - **A non-number is not clamped but replaced.** `"0px; } * { display: none }
 *   .x {"` is neither too large nor too small; it is a CSS payload that closes
 *   the declaration and opens rules of its own, and the only safe reading of it
 *   is "the file did not say".
 * - **Nothing a person could have meant is touched.** Limits are guards wider
 *   than the sliders. The inline radius slider reaches 25px, but saved values
 *   up to 64px remain valid.
 *
 * The generated suite is the one that keeps this honest over time. It walks the
 * numeric leaves of `DEFAULT_SETTINGS.globalStyle` and demands each be guarded,
 * so a style number added later cannot quietly arrive unchecked.
 */
import assert from "node:assert";
import { describe, it } from "node:test";
import {
	clampGlobalStyle,
	localePreference,
} from "../src/utils/settingsGuards";
import { DEFAULT_SETTINGS } from "../src/constants";
import type { GlobalStyleSettings } from "../src/types";

const DEFAULTS = DEFAULT_SETTINGS.globalStyle;

/** `DEFAULTS` with one dotted path overwritten by `value`. */
function withValue(path: readonly string[], value: unknown): GlobalStyleSettings {
	const clone = structuredClone(DEFAULTS) as unknown as Record<string, unknown>;
	let cursor = clone;
	for (const key of path.slice(0, -1)) {
		cursor = cursor[key] as Record<string, unknown>;
	}
	cursor[path[path.length - 1] as string] = value;
	return clone as unknown as GlobalStyleSettings;
}

/** Follow a dotted path into a clamped style. */
function read(style: GlobalStyleSettings, path: readonly string[]): unknown {
	let cursor: unknown = style;
	for (const key of path) cursor = (cursor as Record<string, unknown>)[key];
	return cursor;
}

/** Every numeric leaf of the global style, as a dotted path. */
function numericLeaves(node: unknown, path: string[] = []): string[][] {
	const out: string[][] = [];
	for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
		if (typeof value === "number") out.push([...path, key]);
		else if (value !== null && typeof value === "object") {
			out.push(...numericLeaves(value, [...path, key]));
		}
	}
	return out;
}

const NUMERIC = numericLeaves(DEFAULTS);

describe("clampGlobalStyle — the settings a slider can produce", () => {
	it("leaves the shipped defaults exactly as they are", () => {
		// Including `inline.borderRadius: 16`, the default pill's radius.
		assert.deepStrictEqual(clampGlobalStyle(structuredClone(DEFAULTS)), DEFAULTS);
	});

	it("leaves an ordinary edited value untouched", () => {
		const edited = {
			...structuredClone(DEFAULTS),
			borderWidth: 3.5,
			borderRadius: 24,
			titleScale: 1.35,
			contentScale: 0.5,
		};
		assert.deepStrictEqual(clampGlobalStyle(edited), edited);
	});

	it("preserves an existing inline radius above the current slider range", () => {
		const saved = withValue(["inline", "borderRadius"], 40);
		assert.equal(clampGlobalStyle(saved).inline.borderRadius, 40);
	});

	it("is idempotent — it runs over its own output on every load", () => {
		const once = clampGlobalStyle(withValue(["borderRadius"], 1e6));
		assert.deepStrictEqual(clampGlobalStyle(once), once);
	});

	it("passes through everything that is not a number", () => {
		const styled = withValue(["borderSides"], {
			top: true,
			right: false,
			bottom: true,
			left: false,
		});
		const clamped = clampGlobalStyle(withValue(["alignContentWithTitle"], true));
		assert.equal(clamped.alignContentWithTitle, true);
		assert.deepStrictEqual(clampGlobalStyle(styled).borderSides, styled.borderSides);
	});

	it("keeps a field a newer version added that this one knows nothing about", () => {
		// A value check must not double as a shape check: dropping unknown keys
		// is `mergeSavedSettings`' job, and doing it twice in two places is how
		// the two drift apart.
		const future = { ...structuredClone(DEFAULTS), somethingNew: 7 };
		assert.equal(
			(clampGlobalStyle(future) as unknown as { somethingNew: number })
				.somethingNew,
			7,
		);
	});
});

describe("clampGlobalStyle — what a hand-edited or hostile file says", () => {
	it("pulls a huge radius back to the guard limit", () => {
		assert.equal(clampGlobalStyle(withValue(["borderRadius"], 1e6)).borderRadius, 64);
	});

	it("raises a negative border width to zero", () => {
		assert.equal(clampGlobalStyle(withValue(["borderWidth"], -999)).borderWidth, 0);
	});

	it("refuses to let a scale reach zero, which would erase the text", () => {
		assert.equal(clampGlobalStyle(withValue(["titleScale"], 0)).titleScale, 0.1);
		assert.equal(clampGlobalStyle(withValue(["contentScale"], -5)).contentScale, 0.1);
		assert.equal(clampGlobalStyle(withValue(["inline", "fontScale"], 0)).inline.fontScale, 0.1);
	});

	it("replaces a CSS payload with the default rather than clamping it", () => {
		// The injected rule is `border-radius: ${gs.borderRadius}px;`. Kept as a
		// string, this closes it and opens a rule of its own.
		const hostile = withValue(
			["borderRadius"],
			"0px; } .callout { display: none } .x {",
		);
		assert.equal(clampGlobalStyle(hostile).borderRadius, DEFAULTS.borderRadius);
	});

	it("replaces the other ways a number can be absent", () => {
		for (const junk of [null, undefined, NaN, Infinity, -Infinity, "2", {}, []]) {
			assert.equal(
				clampGlobalStyle(withValue(["borderWidth"], junk)).borderWidth,
				DEFAULTS.borderWidth,
				`${JSON.stringify(junk) ?? "undefined"} should have fallen back`,
			);
		}
	});

	it("guards the nested role styles too, not just the block callout", () => {
		const clamped = clampGlobalStyle(
			withValue(["heading", "marginTop"], 1e9),
		);
		assert.equal(clamped.heading.marginTop, 10);
		assert.equal(
			clampGlobalStyle(withValue(["inline", "borderRadius"], -1)).inline
				.borderRadius,
			0,
		);
	});
});

describe("localePreference — the saved UI language", () => {
	it("keeps any string the file carries", () => {
		assert.equal(localePreference("he"), "he");
		assert.equal(localePreference("auto"), "auto");
		// An unrecognized string needs no guard here — `resolve()` in `i18n/`
		// already walks the language chain down to English — and rejecting one
		// would mean a locale added in a newer build reads as corrupt in an
		// older one.
		assert.equal(localePreference("kl-DK"), "kl-DK");
	});

	it("replaces anything that is not a string with the default", () => {
		// The reachable crash: `main.ts` hands this to `setLocale`, which
		// lowercases it during load. `5` is a `TypeError` before the plugin has
		// registered a thing, not a mislabelled button.
		for (const junk of [5, null, undefined, true, {}, ["he"], NaN]) {
			assert.equal(localePreference(junk), DEFAULT_SETTINGS.language);
		}
	});

	it("does not fold an empty string into the default", () => {
		// Empty is still a string, and `resolve("")` already resolves it to
		// English. Nothing here needs to second-guess that.
		assert.equal(localePreference(""), "");
	});
});

describe("clampGlobalStyle — every numeric setting is guarded", () => {
	it("the walk still finds every style number", () => {
		// A count rather than a list of names: the names are asserted one by one
		// below, and this is the check that the walk itself did not go blind.
		assert.equal(NUMERIC.length, 12, NUMERIC.map((p) => p.join(".")).join(", "));
	});

	for (const path of NUMERIC) {
		const name = path.join(".");

		it(`${name} — a huge value is pulled back`, () => {
			const value = read(clampGlobalStyle(withValue(path, 1e9)), path);
			assert.notEqual(value, 1e9, `${name} is unguarded`);
			assert.ok(typeof value === "number" && value < 1e9);
		});

		it(`${name} — a negative value is raised`, () => {
			const value = read(clampGlobalStyle(withValue(path, -1e9)), path);
			assert.notEqual(value, -1e9, `${name} is unguarded`);
			assert.ok(typeof value === "number" && value >= 0);
		});

		it(`${name} — a string falls back to the default`, () => {
			const value = read(clampGlobalStyle(withValue(path, "13")), path);
			assert.equal(value, read(DEFAULTS, path), `${name} accepted a string`);
		});
	}
});
