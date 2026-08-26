/**
 * settings/editor/authoredStyle.ts — Did the user author this style field, or is
 * the form merely showing a default it invented?
 *
 * The editor's form state is always concrete: a colour swatch has to show
 * something, so the constructor fills `bgColorLight`/`bgColorDark` from the
 * accent tint, the text colours from `DEFAULT_TEXT_COLOR_*` and the icon
 * adjustment from `DEFAULT_ICON_ADJUST` whenever the definition it opened on
 * carried none. A `CalloutDefinition` is not: leaving those fields absent is
 * meaningful — no background means Obsidian's own translucent fill keeps
 * painting (which is what lets nested callouts step), and no text colour means
 * the theme's `--text-normal` keeps winning.
 *
 * So every path that turns form state back into a definition has to ask which
 * of those concrete values the user actually chose. The predicates live here,
 * in one place, because two paths ask it — the save and the live preview — and
 * when only the save had them, opening the editor restyled every callout of
 * that type in the vault behind the modal: the preview definition it registered
 * carried an 18% background where the real one had none (so Obsidian's 10% fill
 * was replaced by a stronger tint), and the extra fields also flipped
 * `isUnmodifiedBuiltIn`, dropping the built-in's deference to the theme's
 * `--callout-*` variables.
 */
import type { CalloutDefinition } from "../../types";
import {
	DEFAULT_TEXT_COLOR_DARK,
	DEFAULT_TEXT_COLOR_LIGHT,
	derivedBgAmount,
} from "../../utils/colorUtils";
import { isDefaultIconAdjust } from "../../utils/iconAdjust";
import type { ResolvedIconAdjust } from "../../utils/iconAdjust";

/**
 * The colour half of the form state these predicates read. `bgGradient` is
 * spelled optional so both callers fit: the save state leaves the key off, the
 * editor's `EditorColorState` always carries it (as `undefined` when unset).
 */
export type AuthoredBackgroundState = {
	colorLight: string;
	colorDark: string;
	bgColorLight: string;
	bgColorDark: string;
	bgGradient?: CalloutDefinition["bgGradient"];
	transparentBg: boolean;
};

/**
 * True when the background is the user's own colour rather than the accent
 * tinted.
 *
 * Solved rather than compared against `bgTintFor(accent, mode)` at the default
 * strength: the palette editor's intensity slider produces tints at any
 * strength, so a fixed-amount comparison would only recognise the ones that
 * happened to use 18%. A colour the user actually picked no longer solves and
 * is kept. See {@link derivedBgAmount}.
 *
 * Transparency short-circuits: the flag *is* the background, so the hexes the
 * form is still holding beside it describe nothing.
 */
export function hasAuthoredBackground(state: AuthoredBackgroundState): boolean {
	return (
		!state.transparentBg &&
		(state.bgGradient !== undefined ||
			derivedBgAmount(state.colorLight, state.bgColorLight, false) ===
				null ||
			derivedBgAmount(state.colorDark, state.bgColorDark, true) === null)
	);
}

/**
 * True when the text colours are the user's own.
 *
 * Unlike the background there is nothing to solve — the invented value is a
 * constant — so the question is answered in two halves: a definition that
 * already carried a text colour keeps it whatever it says (a user is entitled
 * to pick the default colour deliberately), and one that carried none has only
 * authored something once the form no longer holds the default.
 */
export function hasAuthoredTextColors(
	baseline: CalloutDefinition | undefined,
	textColorLight: string,
	textColorDark: string,
): boolean {
	if (
		baseline?.textColorLight !== undefined ||
		baseline?.textColorDark !== undefined
	) {
		return true;
	}
	return (
		textColorLight !== DEFAULT_TEXT_COLOR_LIGHT ||
		textColorDark !== DEFAULT_TEXT_COLOR_DARK
	);
}

/**
 * True when the icon adjustment is the user's own — same two halves as
 * {@link hasAuthoredTextColors}, over both storage layers (the per-role
 * `iconAdjust` map and the flat legacy trio, either of which counts as the
 * definition having carried an adjustment).
 */
export function hasAuthoredIconAdjust(
	baseline: CalloutDefinition | undefined,
	regular: ResolvedIconAdjust,
): boolean {
	if (
		baseline?.iconAdjust !== undefined ||
		baseline?.iconOffsetX !== undefined ||
		baseline?.iconOffsetY !== undefined ||
		baseline?.iconSize !== undefined
	) {
		return true;
	}
	return !isDefaultIconAdjust(regular);
}

/**
 * The `externalStyle` field a save should carry, given whether the user
 * authored anything in this pass.
 *
 * Authoring a style is an answer to "who paints this callout": picking a colour
 * or an icon while the row still says *External CSS* would collect settings
 * that never reach the screen. So a real style change clears the flag, and the
 * label disappearing from the row is the feedback that it did. Gated on the
 * same `hasStyleChanges` the live preview uses, so renaming a callout or giving
 * it an alias is not a claim on its appearance and leaves the flag alone.
 *
 * It says nothing about the *theme*, and cannot: theme ownership is derived
 * from the theme's stylesheet, not stored, so there is no field here to clear.
 * A theme-owned callout does not reach this code at all — `openCalloutEditor`
 * sends it to the preview window instead.
 *
 * Spelled `undefined` rather than deleted for the same reason `transparentBg`
 * is: `registry.update()` merges this onto the existing row, so a key left out
 * would clear nothing, while `JSON.stringify` drops an explicit `undefined` on
 * save and `isCalloutModified` compares `value ?? null`.
 */
export function authoredStyleMode(hasStyleChanges: boolean): {
	externalStyle?: undefined;
} {
	return hasStyleChanges ? { externalStyle: undefined } : {};
}

/**
 * The `customized` flag a save should carry — "the user adopted this row".
 *
 * Lives beside {@link authoredStyleMode} because it answers the same question
 * from the other end: that one records who *styles* the callout, this one
 * records whether it is the user's to keep. Both turn on authorship, and
 * keeping them apart is how they drifted before.
 *
 * `undefined` for a built-in: they are never auto-prunable, so the flag would
 * mean nothing, and writing it would make an untouched one read as edited.
 */
export function authoredCustomizedFlag(
	isBuiltIn: boolean,
	isNew: boolean,
	wasCustomized: boolean,
	hasStyleChanges: boolean,
	saveAsFallback: boolean,
): boolean | undefined {
	if (isBuiltIn) return undefined;
	if (isNew) return !saveAsFallback;
	return wasCustomized || hasStyleChanges;
}
