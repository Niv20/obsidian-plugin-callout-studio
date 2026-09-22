/**
 * Block callout icon spacing and optional title/content alignment.
 *
 * The caller supplies only Studio-owned selectors. These strong geometry rules
 * must not reach unknown ids or callouts handed to the active theme.
 */

interface BlockAlignmentRules {
	/** Registrations, root lengths, and the icon's own box and trailing margin. */
	iconRules: string[];
	/** Title gap and matching content indent, placed after content scaling. */
	contentRules: string[];
}

export function blockAlignmentCSS(
	calloutSelectors: readonly string[],
	alignContentWithTitle: boolean,
): BlockAlignmentRules {
	const iconRules: string[] = [];
	const contentRules: string[] = [];
	if (calloutSelectors.length === 0) return { iconRules, contentRules };

	const imp = " !important";
	const selectorsFor = (tail: string): string =>
		calloutSelectors.map((selector) => `${selector}${tail}`).join(",\n");

	// Obsidian's title row has a 4px gap. Its regular icon is larger than the
	// plugin's heading and inline icons, so a trailing margin tops up that gap
	// without changing the separate gap before the fold chevron. This rule is
	// emitted even with alignment off and can be tuned by a CSS snippet.
	if (alignContentWithTitle) {
		// Registered inherited lengths resolve em values on the callout root,
		// before a separately scaled .callout-content receives them. Emit these
		// with the rules so standalone snippet exports have the registrations too.
		for (const name of [
			"--cs-align-icon-inline-size",
			"--cs-align-icon-gap",
			"--cs-align-title-gap",
		]) {
			iconRules.push(
				`@property ${name} {\n` +
					`  syntax: "<length>";\n` +
					`  inherits: true;\n` +
					`  initial-value: 0px;\n` +
					`}`,
			);
		}
		iconRules.push(
			`${selectorsFor("")} {\n` +
				`  --cs-align-icon-inline-size: var(--icon-size, 1.2em)${imp};\n` +
				`  --cs-align-icon-gap: var(--cs-regular-icon-gap, 0.15em)${imp};\n` +
				`  --cs-align-title-gap: var(--size-4-1, 4px)${imp};\n` +
				`}`,
		);
	}

	iconRules.push(
		`${selectorsFor(" > .callout-title > .callout-icon")} {\n` +
			`  margin-inline-end: ${alignContentWithTitle ? "var(--cs-align-icon-gap)" : "var(--cs-regular-icon-gap, 0.15em)"}${imp};\n` +
			(alignContentWithTitle
				? `  inline-size: var(--cs-align-icon-inline-size)${imp};\n`
				: "") +
			`}`,
	);

	if (alignContentWithTitle) {
		// The title text starts after the icon box, its logical trailing margin,
		// and the flex gap. Use those same lengths for the content's inline-start
		// padding. Explicit column-gap keeps a theme's direct gap override from
		// moving the title without moving the content; logical sides cover RTL.
		contentRules.push(
			`${selectorsFor(" > .callout-title")} {\n` +
				`  column-gap: var(--cs-align-title-gap)${imp};\n` +
				`}`,
			`${selectorsFor(" > .callout-content")} {\n` +
				`  padding-inline-start: calc(var(--cs-align-icon-inline-size) + var(--cs-align-icon-gap) + var(--cs-align-title-gap))${imp};\n` +
				`}`,
		);
	}

	return { iconRules, contentRules };
}
