/**
 * manager/theme/themeClaimEffect.ts — does switching a theme's rules off
 * change anything a reader can see?
 *
 * The judgement half of `ThemeClaimCheck.ts`, which renders a callout, reads
 * its computed style with and without the theme's rules for it, and hands both
 * readings here. Pure data in, one boolean out.
 *
 * A theme naming a callout is not the same as a theme drawing it. Measured
 * over the 65 installed themes that name one, 451 of the 1,292 rows they put
 * under *Callouts from your theme* changed nothing on screen: a rule behind an
 * option that is off, a rule restating the icon core already draws
 * (Catppuccin, Sandstorm), a `rgb(var(--callout-color))` that stopped parsing
 * when Obsidian 1.13 made the variable a full colour (Origami, Vicious), a
 * border colour on a title that has no border (Brainhack).
 *
 * The rules below are the ones that measurement settled on, and every one of
 * them errs the same way: a difference that cannot be ruled out counts. Being
 * wrong in that direction leaves a callout with the theme, which is how every
 * callout was treated before this check existed.
 */

/**
 * One rendered callout's computed style, box by box. Read lazily on one side
 * of a comparison, so a callout the theme plainly draws costs a few reads, not
 * thousands.
 */
export interface CalloutStyle {
	/** `--callout-icon` on the callout: Obsidian draws the icon from it at render time. */
	icon(): string;
	/** The boxes this reading has, by name (`title`, `icon::before`, …). */
	boxes(): Iterable<string>;
	/** One computed value, or `undefined` when this reading has no such box. */
	value(box: string, prop: string): string | undefined;
}

/** A reading taken up front, as plain data. */
export function sampledStyle(
	icon: string,
	boxes: ReadonlyMap<string, ReadonlyMap<string, string>>,
): CalloutStyle {
	return {
		icon: () => icon,
		boxes: () => boxes.keys(),
		value: (box, prop) => {
			const values = boxes.get(box);
			return values ? (values.get(prop) ?? "") : undefined;
		},
	};
}

/**
 * Properties that never change what is drawn on their own: interaction,
 * timing, and colours of things that are not painted unless something else
 * says so (`caret-color`, `column-rule-color`). `--callout-color` would be here
 * too were it read: what it changes shows up in the properties that read it,
 * and on its own it can be a different spelling of the same colour (PLN writes
 * the triplet core already resolves to).
 */
const NEVER_DRAWN =
	/^(?:cursor|transition|animation-(?:delay|duration|iteration-count|direction|fill-mode|play-state|timing-function|composition|range|timeline)|will-change|pointer-events|user-select|-webkit-user-select|-webkit-user-modify|caret-color|column-rule-color|text-emphasis-color|-webkit-text-emphasis-color|lighting-color|flood-color|stop-color|accent-color|scrollbar-|-webkit-tap-highlight-color|contain$|-webkit-locale|-webkit-rtl-ordering|tab-size|orphans|widows|-webkit-highlight|transform-origin|perspective-origin|--)/;

const SIDE_COLOR = /^border-(top|right|bottom|left|block-start|block-end|inline-start|inline-end)-color$/;

/** True when `after` differs from `before` in a way that reaches the screen. */
export function changesVisibly(
	props: readonly string[],
	before: CalloutStyle,
	after: CalloutStyle,
): boolean {
	if (before.icon() !== after.icon()) return true;
	for (const box of before.boxes()) {
		const was = (prop: string): string => before.value(box, prop) ?? "";
		const now = (prop: string): string => after.value(box, prop) ?? "";
		if (after.value(box, "content") === undefined) continue;
		// A pseudo-element with no content is not drawn, whatever it inherits.
		if (box.includes("::") && !drawsContent(was("content")) && !drawsContent(now("content"))) {
			continue;
		}
		const hidden = was("display") === "none" && now("display") === "none";
		for (const prop of props) {
			if (hidden && prop !== "display") continue;
			if (was(prop) === now(prop)) continue;
			if (reachesScreen(box, prop, was, now)) return true;
		}
	}
	return false;
}

function drawsContent(content: string): boolean {
	return content !== "" && content !== "none" && content !== "normal";
}

function reachesScreen(
	box: string,
	prop: string,
	was: (prop: string) => string,
	now: (prop: string) => string,
): boolean {
	if (NEVER_DRAWN.test(prop)) return false;
	const side = SIDE_COLOR.exec(prop)?.[1];
	if (side) {
		const drawn = (read: (p: string) => string): boolean =>
			!["none", "hidden"].includes(read(`border-${side}-style`)) &&
			read(`border-${side}-width`) !== "0px";
		return drawn(was) || drawn(now);
	}
	if (prop === "outline-color") return was("outline-style") !== "none" || now("outline-style") !== "none";
	if (prop === "text-decoration-color") {
		return was("text-decoration-line") !== "none" || now("text-decoration-line") !== "none";
	}
	if (prop === "-webkit-text-stroke-color") {
		return was("-webkit-text-stroke-width") !== "0px" || now("-webkit-text-stroke-width") !== "0px";
	}
	// SVG paint only paints SVG.
	if (/^(?:fill|stroke|marker|paint-order)/.test(prop)) return box === "svg" || box === "svg path";
	if (/^(?:top|right|bottom|left|inset.*)$/.test(prop)) {
		return was("position") !== "static" || now("position") !== "static";
	}
	return true;
}
