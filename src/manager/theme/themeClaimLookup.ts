/**
 * manager/theme/themeClaimLookup.ts — does this stylesheet style the callout I
 * already have?
 *
 * The other half of the seam `themeCalloutScan.ts` opens. That module answers
 * *enumeration* — "which callouts does this theme define?" — and to keep from
 * inventing types nobody has, it may only read the operators that name exactly
 * one id (`=`, `~=`). This module answers the opposite question, and the
 * asymmetry is deliberate.
 *
 * A lookup is only ever handed an id the registry already holds, so there is
 * nothing left to invent — and `[data-callout*=note]` factually does match
 * `data-callout="note"`. Ignoring the fuzzy operators here would be a false
 * *negative*, and a measured one: Notation 2 styles all 26 built-ins through
 * `*=` exclusively, and a lookup restricted to exact matches reported it as
 * having no opinion about callouts at all.
 *
 * So this consults every operator, and the claims it reaches by pattern carry
 * {@link ThemeClaim.certain} `false` — which is what lets a caller say "may
 * also style" rather than either overstating or staying silent.
 */
import { compareSpecificity } from "../../utils/cssSpecificity";
import type { PatternOp, ThemeClaim, ThemeScan } from "./themeCalloutScan";

/** Whether a pattern operator's value matches a concrete attribute id. */
export function patternMatches(
	op: PatternOp,
	value: string,
	attrId: string,
): boolean {
	switch (op) {
		case "^":
			return attrId.startsWith(value);
		case "*":
			return attrId.includes(value);
		case "$":
			return attrId.endsWith(value);
		case "~":
			// Whitespace-separated word list. A callout id never contains a
			// space by the time it reaches the attribute (Obsidian dasherizes
			// it), so in practice this is equality — which is exactly why the
			// scanner is allowed to enumerate `~=` and not the others.
			return attrId.split(/\s+/).includes(value);
		case "|":
			return attrId === value || attrId.startsWith(`${value}-`);
	}
}

/**
 * The claim a stylesheet makes about one registry id — the exact match first,
 * then the heaviest pattern that matches. `undefined` when the sheet says
 * nothing about it.
 *
 * `attrId` must already be the dasherized attribute form — the one Obsidian
 * actually writes — because that is what a theme's selector is written against.
 */
export function claimForId(
	scan: ThemeScan,
	attrId: string,
): ThemeClaim | undefined {
	const exact = scan.byId.get(attrId);
	if (exact) return exact;
	let best: ThemeClaim | undefined;
	for (const { op, value, claim } of scan.patterns) {
		if (!patternMatches(op, value, attrId)) continue;
		if (!best || compareSpecificity(claim.weight, best.weight) > 0) {
			best = claim;
		}
	}
	return best;
}
