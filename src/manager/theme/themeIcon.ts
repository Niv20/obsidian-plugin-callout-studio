/**
 * manager/theme/themeIcon.ts — deciding how a theme's callout icon reaches the
 * screen, so it can be reproduced somewhere else.
 *
 * Split out of `themeAppearance.ts`, which keeps the colours and the assembly:
 * this half is a five-rung ladder with its own derivation, its own consumer
 * (`renderThemeIcon.ts`, which reproduces whatever rung was chosen) and its own
 * failure mode. Pure, like its sibling — readout in, decision out.
 *
 * ## The ladder
 *
 * Measured over the installed themes that touch callouts, artwork reaches the
 * screen five ways, and the ladder is ordered by how definitive the evidence is
 * rather than by how common the mechanism is:
 *
 * | Rung | Evidence |
 * |---|---|
 * | `hidden` | computed `display: none` on `.callout-icon` |
 * | `mask` (slot) | computed `mask-image` on `.callout-icon` **itself** — a stencil that clips everything inside it |
 * | `svg`    | the element has real child markup **that is itself displayed** (core injected it, from its own default or the theme's `--callout-icon`) |
 * | `mask` (pseudo) | computed `mask-image` on `.callout-icon::before` — a stencil beside the drawing rather than over it |
 * | `glyph`  | a `::before` with `content` — a pseudo-element cannot be cloned, so its content and font are copied instead |
 * | `unknown`| nothing legible; callers draw a neutral placeholder |
 *
 * `hidden` is first because a theme that hides the icon may still leave the
 * markup in place, so testing for markup first would reproduce an icon the
 * reader cannot see.
 *
 * ## Why the two masks sit on opposite sides of `svg`
 *
 * They are not one rung, because CSS does not treat them as one thing. A mask
 * on `.callout-icon` **itself** clips the element *and every descendant*, so
 * core's `<svg>` is inside the stencil and cannot be what the reader sees —
 * the mask is the drawing, whatever is left in the slot. A mask on the
 * `::before` paints a separate box, which leaves a displayed child alongside
 * it; there the child is the drawing and the pseudo is decoration.
 *
 * Reading them as one rung ranked below `svg` is what made **Sanctum** and
 * **Sanctum reborn** draw core's default `lucide-pencil` on every row of the
 * settings tab. Both write the stencil idiom on the slot —
 * `background-color: currentColor` plus a `mask-image`, Sanctum in the
 * `-webkit-` spelling and Sanctum reborn unprefixed — and neither hides the
 * child, because the mask already disposes of it. The `svg` rung then fired on
 * markup the stencil had clipped away.
 *
 * Measured over the 66 installed themes that name a callout id (1,278
 * rendered rows): 94 rows carry a mask on the slot and 60 carry one only on
 * the `::before`. Moving the slot mask above `svg` changes the rung for those
 * 94 and for **no row in any other theme**.
 *
 * ## Why `svg` asks whether the child is displayed
 *
 * 21 of the 257 installed themes hide **the drawing** rather than the slot —
 * `.callout-icon > svg { display: none }`, or the descendant form — and draw
 * their own artwork on `.callout-icon::before` instead. Testing `display` on
 * `.callout-icon` alone looks exactly one level too shallow for those, so the
 * rung fired on markup nobody can see and reproduced **the very icon the theme
 * had switched off** — core's default Lucide glyph, on every row of the
 * settings tab. It is the same failure the `hidden`-outranks-`svg` ordering
 * above exists to prevent, one node deeper, so it is answered the same way: by
 * asking the cascade what is actually on screen.
 *
 * A `::before` is also why `mask` consults two nodes. The stencil can be
 * declared on `.callout-icon` itself or on its pseudo-element, and a theme that
 * hid the child SVG has almost always put it on the pseudo.
 */
import type { ProbeReadout } from "./themeAppearance";

/** How to reproduce the icon the theme actually drew. */
export type ThemeIcon =
	| { kind: "svg"; markup: string }
	| { kind: "mask"; image: string }
	| { kind: "glyph"; text: string; fontFamily: string }
	| { kind: "hidden" }
	| { kind: "unknown" };

/** Strip the quoting a computed `content` value keeps. */
function unquoteContent(value: string): string {
	const raw = value.trim();
	if (raw.length < 2) return "";
	const first = raw[0];
	if ((first === '"' || first === "'") && raw.endsWith(first)) {
		return raw
			.slice(1, -1)
			.replace(/\\(['"\\])/g, "$1")
			.replace(/\\([0-9a-f]{1,6})\s?/gi, (_m, hex: string) =>
				String.fromCodePoint(Number.parseInt(hex, 16)),
			);
	}
	return "";
}

/** Computed `content` values that mean "there is no pseudo-element here". */
function hasPseudoContent(value: string): boolean {
	const v = value.trim().toLowerCase();
	return v.length > 0 && v !== "none" && v !== "normal";
}

/** Computed `mask-image` values that mean "no mask". */
export function hasMask(value: string): boolean {
	const v = value.trim().toLowerCase();
	return v.length > 0 && v !== "none";
}

/**
 * Is the artwork inside `.callout-icon` on screen?
 *
 * `""` — no child, or a reader that cannot answer — is deliberately *not*
 * treated as hidden: the evidence for switching a rung off has to be positive,
 * and the caller has already established there is markup to draw.
 */
function childIsDrawn(readout: ProbeReadout): boolean {
	return readout.iconChildDisplay.trim().toLowerCase() !== "none";
}

/** The icon rung this readout lands on. See the module comment for the order. */
export function readThemeIcon(readout: ProbeReadout): ThemeIcon {
	const display = readout.iconDisplay.trim().toLowerCase();
	if (display === "none") return { kind: "hidden" };

	// The slot's own stencil, above `svg`: a mask here clips every descendant,
	// so core's markup is inside the stencil rather than under it. The
	// `::before`'s stencil is asked further down, after the child, because that
	// one paints its own box and leaves a displayed child intact.
	if (hasMask(readout.iconMask)) {
		return { kind: "mask", image: readout.iconMask.trim() };
	}

	const markup = readout.iconMarkup?.trim() ?? "";
	if (markup.length > 0 && childIsDrawn(readout)) {
		return { kind: "svg", markup };
	}

	if (hasMask(readout.iconPseudoMask)) {
		return { kind: "mask", image: readout.iconPseudoMask.trim() };
	}

	if (hasPseudoContent(readout.iconPseudoContent)) {
		const text = unquoteContent(readout.iconPseudoContent);
		if (text.length > 0) {
			return { kind: "glyph", text, fontFamily: readout.iconPseudoFont };
		}
	}

	return { kind: "unknown" };
}

/**
 * A stable string identity for one icon, so two of them can be compared
 * without a `switch` at every call site.
 *
 * Every rung's payload is included, not just the kind: two themes both reaching
 * the `mask` rung draw different pictures, and a caller comparing kinds alone
 * would call that "unchanged" and keep the outgoing theme's artwork.
 */
export function iconKey(icon: ThemeIcon): string {
	switch (icon.kind) {
		case "svg":
			return `svg:${icon.markup}`;
		case "mask":
			return `mask:${icon.image}`;
		case "glyph":
			return `glyph:${icon.fontFamily}:${icon.text}`;
		default:
			return icon.kind;
	}
}

/**
 * Does the theme paint the icon *itself*, on a pseudo-element it declared?
 *
 * Only true when the `::before` is the node that won the rung — a mask on
 * `.callout-icon` itself does not count, because that node carries core's
 * inherited colour and so says nothing new. Lives here rather than beside the
 * accent ladder because it is a question about which rung fired, and this file
 * is the only place that knows.
 */
export function drawnByPseudo(readout: ProbeReadout, icon: ThemeIcon): boolean {
	if (icon.kind === "glyph") return true;
	return (
		icon.kind === "mask" &&
		!hasMask(readout.iconMask) &&
		hasMask(readout.iconPseudoMask)
	);
}
