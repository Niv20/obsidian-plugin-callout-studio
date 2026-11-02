/**
 * editor/inlineContent.ts — The `{…}` content grammar for inline callouts.
 *
 * An inline callout may carry a payload immediately after its closing bracket:
 *
 *     This is [!warning]{important text} inside a paragraph.
 *
 * The rules are deliberately narrow, because this syntax claims a character
 * (`{`) that ordinary prose uses freely, and a false positive would eat the
 * user's text:
 *
 * - The `{` must follow `]` with NO whitespace between them. `[!warning] {x}`
 *   is a plain pill followed by the literal text ` {x}`.
 * - Braces nest by depth, so `{a {b} c}` is one payload. The first `}` that
 *   returns the depth to zero closes it; anything after that is ordinary text.
 * - A `{` that never closes on the line is reported separately (`open`) rather
 *   than treated as "no content": the caller must still know a payload was
 *   started, so it can decline to render a pill while the user is mid-typing
 *   without changing what the token *counts* as (see LineCalloutToken.contentOpen).
 *
 * **There is no backslash escape.** `\{` and `\}` look like the obvious answer
 * and are actively wrong here: Markdown consumes the backslash before the
 * reading-view post-processor ever sees the text, so Live Preview (which reads
 * raw source) and reading view (which reads rendered text) would disagree about
 * where a payload ends. That divergence has no cheap fix — `getSectionInfo` is
 * null in embeds and during PDF export — so the escape hatch is inline code
 * instead: a brace inside backticks is blanked on BOTH surfaces by construction.
 */

/** Result of looking for a `{…}` payload at a given offset. */
export type InlineContentMatch = { kind: "none" } | { kind: "open" } | { kind: "content"; from: number; to: number };

/**
 * Blanks out `$inline math$` spans with spaces, preserving string length so
 * offsets computed on the result stay valid in the original line.
 *
 * Used ONLY by the content matcher, never by the token scan. LaTeX is full of
 * braces (`$x_{1}$`), and reading view renders math into a `.math` element whose
 * text the DOM-side walk skips — so a brace inside math must not count on the
 * Live Preview side either, or the two surfaces would close a payload at
 * different places. Deliberately not folded into `stripInlineCode`: widening
 * what the *token* scan ignores would change which `[!id]` tokens exist, and
 * that is settled behavior.
 *
 * Conservative by design: only single-`$` spans on one line, no `$` adjacent to
 * a digit (so "$5 and $10" is left alone), and an unclosed `$` matches nothing.
 */
export function blankInlineMath(line: string): string {
	if (!line.includes("$")) return line;
	return line.replace(/\$(?![\s$])(?:[^$\n]*[^\s$])?\$(?!\d)/g, (m) => " ".repeat(m.length));
}

/**
 * Looks for a balanced `{…}` payload starting exactly at `openIdx`.
 *
 * `line` must already have inline code, wikilinks and math blanked (see
 * `scanLineForCalloutTokens`), so braces hidden inside those constructs cannot
 * close a payload. Offsets in the result are valid in the original line, since
 * every blanking pass preserves length.
 *
 * Returns `from` = the `{` offset and `to` = one past the matching `}`, so
 * `line.slice(from + 1, to - 1)` is the payload text.
 */
export function matchInlineContent(line: string, openIdx: number): InlineContentMatch {
	if (line[openIdx] !== "{") return { kind: "none" };

	let depth = 0;
	for (let i = openIdx; i < line.length; i++) {
		const ch = line[i];
		if (ch === "{") {
			depth++;
		} else if (ch === "}") {
			depth--;
			if (depth === 0) return { kind: "content", from: openIdx, to: i + 1 };
		}
	}
	// Ran off the end of the line with the payload still open.
	return { kind: "open" };
}

/**
 * One segment of rendered content, as the reading-view walk sees it.
 *
 * By the time the reading-view post-processor runs, `[!warning]{a **b** c}` is
 * already three DOM siblings, so the payload's closing brace is not in the node
 * it opened in. `matchContentParts` below counts across the sequence; this is
 * how each segment says what its braces mean.
 */
export interface ContentPart {
	text: string;
	/**
	 * Braces here don't count at all — inline code, math, wikilinks, embeds.
	 * The parity contract with Live Preview, which blanks exactly those before
	 * matching (see the reading-view CONTENT_OPAQUE_SELECTOR).
	 */
	opaque?: boolean;
	/** Ends the search outright: a `<br>` or a block-level element. */
	stop?: boolean;
	/**
	 * Text inside a NESTED element (bold, italic, an external link). Its braces
	 * still count — Live Preview counts them — but a payload that would *close*
	 * here is interleaved markup (`**[!a]{bold** text}`) that cannot be wrapped
	 * without tearing the document apart, so the whole match is refused.
	 */
	nested?: boolean;
}

/** Where a payload closed: which part, and the offset of `}` within it. */
export interface ContentPartsMatch {
	part: number;
	offset: number;
}

/**
 * Depth-count a `{…}` payload across a sequence of rendered segments.
 *
 * Split out from the DOM walk so the rules above are testable on their own —
 * they are the parity contract with Live Preview, and getting one wrong makes
 * the two surfaces close a payload in different places, which is exactly the
 * kind of divergence that shows up as a bug report and not as a crash.
 *
 * Returns null when the payload never closes, closes inside a nested element,
 * or hits a stop segment first. Callers must then leave the text alone.
 */
export function matchContentParts(
	parts: readonly ContentPart[],
	startPart: number,
	startOffset: number,
): ContentPartsMatch | null {
	let depth = 0;
	for (let p = startPart; p < parts.length; p++) {
		const part = parts[p];
		if (!part) continue;
		if (part.stop) return null;
		if (part.opaque) continue;
		const from = p === startPart ? startOffset : 0;
		for (let i = from; i < part.text.length; i++) {
			const ch = part.text[i];
			if (ch === "{") {
				depth++;
			} else if (ch === "}" && --depth === 0) {
				return part.nested ? null : { part: p, offset: i };
			}
		}
	}
	return null;
}
