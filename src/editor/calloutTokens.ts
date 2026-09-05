/**
 * editor/calloutTokens.ts — Single source of truth for callout token syntax.
 *
 * A `[!name]` token can play one of three render roles depending on where it
 * sits on the line (see CalloutRenderRole in types.ts):
 *
 * - block: `> [!name]` — block callout header (rendered natively by
 *   Obsidian; this plugin only restyles it via CSS).
 * - heading: `## [!name]` — `[!` is the first content after the `#` marks.
 * - inline:  any other `[!name]` mid-line — rendered as a small inline callout.
 *
 * The classifier here is shared by the vault scanner (discovery/statistics),
 * the Live Preview decoration builder, the reading-view post-processor, and
 * the autocomplete trigger, so all consumers agree on one grammar.
 *
 * Escapes: `\[!name]` is never a token. Markdown links (`[!name](url)`) and
 * anything inside a wikilink (`[[#[!name] Title]]` — a heading reference, not
 * a callout) are also never tokens; wikilink heading references get their own
 * display cleanup via findWikilinkCalloutRefs / parseHeadingRefDisplayText.
 *
 * Metadata: everything after the first `|` inside the brackets is Obsidian's
 * `data-callout-metadata`, not part of the id (see splitCalloutMetadata). Every
 * token type below therefore carries `rawId` (the type alone) and `metadata`
 * separately, while `from`/`to` keep spanning the whole `[!…]` — offsets are
 * what the vault rewriters and Live Preview decorations are built from.
 */
import type { CalloutRenderRole } from "../types";
import { splitCalloutMetadata, type CalloutIdParts } from "../utils/calloutId";
import { blankInlineMath, matchInlineContent } from "./inlineContent";

/**
 * Heading callout header: 1–6 hashes, at least one space/tab, then the token
 * as the first content. Captures: 1=hashes, 2=raw id, 3=title.
 * Lines with 7+ hashes or no space after the hashes are not headings in
 * markdown, so they fall through to the inline scan.
 *
 * Exactly ONE space/tab after `]` is the separator; everything from there on is
 * title, further whitespace included. That mirrors an Obsidian heading, which
 * shows the spaces you write instead of swallowing them.
 */
export const HEADING_CALLOUT_RE =
	/^(#{1,6})[ \t]+\[!([^\]\n\r]+)\][ \t]?(.*)$/;

/**
 * Native block callout header prefix (any nesting depth). Lines matching
 * this belong to Obsidian's own callout rendering — the heading/inline logic
 * must leave them alone. Captures: 1=quote prefix.
 */
export const BLOCKQUOTE_CALLOUT_PREFIX_RE = /^(\s*(?:>[ \t]?)+)\[!/;

/**
 * Full block callout header including the id.
 * Captures: 1=quote prefix, 2=raw id.
 */
export const BLOCKQUOTE_CALLOUT_HEADER_RE =
	/^(\s*(?:>[ \t]?)+)\[!([^\]\n\r]+)\]/;

/**
 * Matches the token at the start of a reading-view heading's rendered text
 * (`# [!id] title` renders as an hN whose text starts with `[!id] `). Consumes
 * the one separating space/tab, per HEADING_CALLOUT_RE. Captures: 1=raw id.
 */
export const RENDERED_HEADING_TOKEN_RE = /^\[!([^\]\n\r]+)\][ \t]?/;

/**
 * Bracketed callout token opening an Outline-pane item's displayed text.
 * Only the raw heading text still carries the brackets (the pane itself strips
 * them — see the bracketless form below). Captures: 1=raw id.
 */
const OUTLINE_BRACKETED_TOKEN_RE = /^\[!([^\]\n\r]+)\]/;

/**
 * Bracketless fallback: `!id` delimited by whitespace or end-of-text. Used only
 * when the id could not be resolved against the file's own ids, so an unknown
 * id still parses the way it renders elsewhere. Captures: 1=raw id.
 */
const OUTLINE_BARE_TOKEN_RE = /^!(\S+)(?:[ \t]|$)/;

/** Longest bracketless id the outline resolver will consider, in words. */
const OUTLINE_ID_MAX_WORDS = 6;

/** Parsed callout token from an Outline pane item's displayed text. */
export interface OutlineHeadingToken {
	/** Callout type as written, metadata removed (normalizeCalloutId to match). */
	rawId: string;
	/** Raw `|metadata`, verbatim; "" when the token carried none. */
	metadata: string;
	/**
	 * True when the token body contained a `|`. Together with `metadata` this
	 * makes the body reconstructible character for character, which the outline
	 * decorator needs to match a token against the text the pane displays.
	 */
	hasMetadata: boolean;
	/** Text following the token, verbatim — the separating space included. */
	rest: string;
	/** Displayed title: `rest` minus its one separating space/tab. */
	title: string;
	/**
	 * True when the token was written `[!id]`. False means it was matched in
	 * the bracketless outline form, which only `[!id]` headings *and* headings
	 * literally starting with `!id` can produce — callers must verify such a
	 * token against the file's raw heading text before decorating it.
	 */
	bracketed: boolean;
}

function makeOutlineToken(
	parts: CalloutIdParts,
	rest: string,
	bracketed: boolean,
): OutlineHeadingToken {
	return {
		rawId: parts.id,
		metadata: parts.metadata,
		hasMetadata: parts.hasMetadata,
		rest,
		title: rest.replace(/^[ \t]/, ""),
		bracketed,
	};
}

/**
 * Resolve where the id ends in the bracketless form `!id…`, whose only
 * delimiter is the set of ids the file itself uses. Candidate prefixes are
 * tried longest first, so `multi word id` wins over a shorter id that merely
 * prefixes it, and `note- Title` yields `note` with `- Title` left as title.
 *
 * Candidates ending in whitespace or `-` are skipped: normalizeCalloutId trims
 * exactly those, so such a candidate would match a *shorter* id and swallow
 * characters that really belong to the title.
 */
function resolveBareOutlineId(
	body: string,
	isKnownId: (rawId: string) => boolean,
): string | null {
	let limit = body.length;
	let words = 1;
	for (let i = 0; i < body.length; i++) {
		const ch = body[i];
		if (ch !== " " && ch !== "\t") continue;
		if (++words > OUTLINE_ID_MAX_WORDS) {
			limit = i;
			break;
		}
	}
	for (let end = limit; end > 0; end--) {
		const last = body[end - 1];
		if (last === " " || last === "\t" || last === "-") continue;
		const candidate = body.slice(0, end);
		if (isKnownId(candidate)) return candidate;
	}
	return null;
}

/**
 * Resolve the bracketless form when the text carries a `|`, which the greedy
 * scan above cannot: every candidate starting `note|…` normalizes to `note`, so
 * longest-first would match the whole line and swallow the title.
 *
 * The outline pane strips the brackets, so nothing delimits the metadata the way
 * `]` does in the source. The rule here is that the id ends at the first `|` and
 * the metadata runs to the next whitespace — bare-form metadata containing a
 * space cannot be recognised, which no other surface is limited by.
 *
 * Returns null when the text before the pipe is not an id this file actually
 * uses, so an ordinary heading that merely contains a pipe falls through to the
 * whitespace-delimited parse.
 */
function resolveBareOutlineMetadata(
	body: string,
	isKnownId: (rawId: string) => boolean,
): { parts: CalloutIdParts; consumed: number } | null {
	const pipe = body.indexOf("|");
	if (pipe === -1) return null;
	const id = body.slice(0, pipe);
	if (!id.trim() || !isKnownId(id)) return null;
	let end = pipe + 1;
	while (end < body.length && body[end] !== " " && body[end] !== "\t") end++;
	return {
		parts: {
			id,
			metadata: body.slice(pipe + 1, end),
			hasMetadata: true,
		},
		consumed: end,
	};
}

/**
 * Parses the displayed text of an Outline pane item. Returns null when the
 * text does not start with a callout token — callers must then leave the
 * item untouched.
 *
 * The outline renders HeadingCache.heading with the brackets stripped, so both
 * `[!id] Title` (raw heading text) and `!id Title` (what the pane shows) must
 * parse. The bracketless form is inherently ambiguous: `!bug Title` is what the
 * outline shows for `# [!bug] Title`, but it is *also* what a heading literally
 * written `# !bug Title` shows. A returned token is therefore not proof that
 * the user wrote a callout: check `token.bracketed` and, when it is false,
 * confirm the id against the file's raw heading text before rendering anything.
 */
export function parseOutlineHeadingText(
	text: string,
	isKnownId?: (rawId: string) => boolean,
): OutlineHeadingToken | null {
	const bracketed = OUTLINE_BRACKETED_TOKEN_RE.exec(text);
	if (bracketed) {
		const parts = splitCalloutMetadata(bracketed[1] ?? "");
		if (!parts.id.trim()) return null;
		return makeOutlineToken(parts, text.slice(bracketed[0].length), true);
	}

	if (!text.startsWith("!")) return null;
	const body = text.slice(1);
	// Piped form first: the greedy scan below cannot delimit it (see
	// resolveBareOutlineMetadata).
	const piped = isKnownId ? resolveBareOutlineMetadata(body, isKnownId) : null;
	if (piped) {
		return makeOutlineToken(piped.parts, body.slice(piped.consumed), false);
	}
	const resolved = isKnownId ? resolveBareOutlineId(body, isKnownId) : null;
	if (resolved !== null) {
		const parts = splitCalloutMetadata(resolved);
		if (!parts.id.trim()) return null;
		return makeOutlineToken(parts, body.slice(resolved.length), false);
	}

	const bare = OUTLINE_BARE_TOKEN_RE.exec(text);
	const rawId = bare?.[1] ?? "";
	if (!rawId) return null;
	const parts = splitCalloutMetadata(rawId);
	if (!parts.id.trim()) return null;
	return makeOutlineToken(parts, body.slice(rawId.length), false);
}

/**
 * The `{…}` payload of an inline callout (`[!warning]{important text}`).
 * See editor/inlineContent.ts for the grammar.
 */
export interface InlineCalloutContent {
	/** Offset of `{` within the line. Always equal to the token's `to`. */
	from: number;
	/** Offset just past the matching `}`. */
	to: number;
	/**
	 * Text between the braces, sliced from the ORIGINAL line — not from the
	 * blanked copy the braces were matched on, which would come back with
	 * inline code, wikilinks and math replaced by runs of spaces.
	 */
	text: string;
}

/** One `[!name]` token found on a line, with its role and exact position. */
export interface LineCalloutToken {
	role: CalloutRenderRole;
	/** Callout type as written, metadata removed (normalizeCalloutId to match). */
	rawId: string;
	/**
	 * Raw `|metadata`, verbatim; "" when the token carried none. `hasMetadata`
	 * is what distinguishes `[!x|]` from `[!x]`, since both yield "".
	 */
	metadata: string;
	/** True when the token body contained a `|`. */
	hasMetadata: boolean;
	/** Offset of `[` within the line. Spans the WHOLE token, metadata included. */
	from: number;
	/** Offset just past `]`. Spans the WHOLE token, metadata included. */
	to: number;
	/** Heading tokens only: true when custom title text follows the token. */
	hasTitle: boolean;
	/** Heading level 1–6 for heading tokens, 0 otherwise. */
	headingLevel: number;
	/**
	 * Inline tokens only: the balanced `{…}` payload immediately after `]`.
	 * Absent when the token carried none.
	 *
	 * `from`/`to` above deliberately keep spanning ONLY the `[!…]` bracket. Every
	 * vault rewriter and offset consumer predates this field, so leaving them
	 * alone is what makes an id rename rewrite the id and leave `{content}`
	 * untouched, for free. Renderers that need the whole span use `tokenEnd()`.
	 */
	content?: InlineCalloutContent;
	/**
	 * Inline tokens only: a `{` followed `]` but never closed on this line.
	 *
	 * RENDERERS must skip such a token — that is a payload mid-typing, and
	 * flashing a pill in front of it would be noise. Everything that COUNTS
	 * tokens must still see it: the reading-view escape pairing matches rendered
	 * candidates to source `[!` occurrences by ordinal position and desyncs if
	 * either side drops one, vault statistics would silently change ("N uses in
	 * M files"), and discovery would stop creating a row for an id typed with a
	 * trailing brace. So the parser reports, and the renderers decide — the same
	 * split `shouldRenderToken` already uses.
	 */
	contentOpen?: boolean;
}

/**
 * End offset of everything a token owns on the line: the `[!…]` bracket plus its
 * `{…}` payload when it has one.
 *
 * The counterpart to reading `token.to` directly, which is the bracket alone.
 * Rendering and the plain-text rewriter want this one; id rewriting wants `to`.
 */
export function tokenEnd(token: LineCalloutToken): number {
	return token.content ? token.content.to : token.to;
}

/**
 * Offset of a content pill's payload — the first character the author wrote
 * inside `{…}`.
 *
 * Stated as arithmetic over the token's own width rather than as
 * `token.content.from + 1`, because the one caller that needs it does not have
 * the token: Live Preview's content-pill widget resolves a click back to a
 * document position from the width of the span it replaced. Shared so the
 * formula has exactly one definition, and a test.
 *
 * Deriving `tokenLen` from the id instead is the mistake this guards: `rawId` is
 * the callout type alone, so on `[!note|purple]{…}` an id-derived width is short
 * by the metadata and every offset past it lands early. The trailing `- 1` is
 * the closing `}`, which `tokenLen` includes and the payload does not.
 */
export function contentPayloadStart(
	/** Offset of the token's `[`. */
	tokenFrom: number,
	/** Full width of `[!…]{…}` — see {@link tokenEnd}. */
	tokenLen: number,
	/** Length of the payload text, braces excluded. */
	payloadLen: number,
): number {
	return tokenFrom + tokenLen - payloadLen - 1;
}

/**
 * The tokens that sit inside another token's `{…}` payload.
 *
 * Nesting (`[!a]{outer [!b]{inner}}`) is not a supported syntax, but the scanner
 * still reports the inner token — it has to, or Live Preview and reading view
 * would work from different token lists and the reading-view escape pairing
 * (which matches DOM candidates to source occurrences by ordinal) would desync.
 * So the render surfaces filter with this instead, and the inner `[!b]{inner}`
 * stays part of the outer pill's text.
 */
export function nestedInlineTokens(
	tokens: readonly LineCalloutToken[],
): Set<LineCalloutToken> {
	const nested = new Set<LineCalloutToken>();
	for (const outer of tokens) {
		if (!outer.content) continue;
		for (const inner of tokens) {
			if (inner === outer) continue;
			if (inner.from >= outer.content.from && inner.to <= outer.content.to) {
				nested.add(inner);
			}
		}
	}
	return nested;
}

/**
 * Blanks out `inline code` spans with spaces, preserving string length so
 * token offsets computed on the result are valid in the original line.
 */
export function stripInlineCode(line: string): string {
	if (!line.includes("`")) return line;
	return line.replace(/`[^`\n]*`/g, (m) => " ".repeat(m.length));
}

/**
 * Wikilink span, lazily matched. The lookahead rejects a `]]` that is
 * followed by another `]`: in `[[#[!22]]]` the first two `]` belong to the
 * token's close + link close only under a mis-parse — the real link close is
 * the LAST `]]` of the run (matching how a title-less heading reference is
 * written). Shared by stripWikilinks and findWikilinkCalloutRefs so both
 * agree on one link grammar.
 */
const WIKILINK_RE = /\[\[([^\n]*?)\]\](?!\])/g;

/**
 * Blanks out wikilink spans (`[[...]]`, including embeds) with spaces,
 * preserving string length. A trailing `[[` that never closes is blanked to
 * the end of the line too: that is a link mid-typing, and suppressing tokens
 * there prevents a pill from flashing while the user types the closing `]]`.
 */
export function stripWikilinks(line: string): string {
	if (!line.includes("[[")) return line;
	let out = line.replace(WIKILINK_RE, (m) => " ".repeat(m.length));
	const open = out.indexOf("[[");
	if (open !== -1) {
		out = out.slice(0, open) + " ".repeat(out.length - open);
	}
	return out;
}

/** Options for {@link scanLineForCalloutTokens}. */
export interface ScanLineOptions {
	/**
	 * Parse the `{…}` payload of an inline callout (default true).
	 *
	 * Pass `settings.inlineCallouts.allowContent` from the render surfaces and
	 * the vault rewriters — the two places where the answer changes what the
	 * user sees or what gets written to disk. Everything else (discovery,
	 * statistics, the context menu) reads only `rawId`, which is identical
	 * either way, so it keeps the default.
	 */
	inlineContent?: boolean;
}

/**
 * Scans one raw markdown line and returns every callout token on it, already
 * classified by role. Cheap for the common case: bails immediately when the
 * line contains no `[!`. Inline-code spans are ignored. Does NOT know about
 * multi-line context (fenced code blocks, frontmatter, math) — callers that
 * scan whole documents must skip those lines themselves.
 */
export function scanLineForCalloutTokens(
	rawLine: string,
	options: ScanLineOptions = {},
): LineCalloutToken[] {
	if (rawLine.indexOf("[!") === -1) return [];
	const line = stripWikilinks(stripInlineCode(rawLine));
	const parseContent = options.inlineContent !== false;
	/**
	 * The line the `{…}` matcher runs on. Math is blanked here and ONLY here:
	 * reading view renders `$…$` into a `.math` element whose text the DOM walk
	 * skips, so a brace inside math must not count on this side either. Widening
	 * the token scan itself would change which `[!id]` tokens exist, which is
	 * settled behavior. Built lazily — most lines have no `{` at all.
	 */
	let contentLine: string | null = null;
	const contentScanLine = (): string => {
		contentLine ??= blankInlineMath(line);
		return contentLine;
	};

	// Native block callout header → single block token; the rest of the
	// line is the callout's title, which Obsidian renders — no pills inside it.
	const quoteHeader = line.match(BLOCKQUOTE_CALLOUT_HEADER_RE);
	if (quoteHeader) {
		const prefix = quoteHeader[1] ?? "";
		const body = quoteHeader[2] ?? "";
		const parts = splitCalloutMetadata(body);
		// A blank type (`[!|purple]`) names no callout; Obsidian renders it with
		// an empty `data-callout`, and there is nothing here for us to resolve.
		if (!parts.id.trim()) return [];
		return [
			{
				role: "regular",
				rawId: parts.id,
				metadata: parts.metadata,
				hasMetadata: parts.hasMetadata,
				from: prefix.length,
				to: prefix.length + 2 + body.length + 1,
				hasTitle: false,
				headingLevel: 0,
			},
		];
	}

	const tokens: LineCalloutToken[] = [];

	// Heading callout header → heading token; the trailing title text may
	// still contain inline tokens, so keep scanning after it.
	let inlineScanFrom = 0;
	const heading = line.match(HEADING_CALLOUT_RE);
	if (heading) {
		const body = heading[2] ?? "";
		const parts = splitCalloutMetadata(body);
		const from = line.indexOf("[!");
		const to = from + 2 + body.length + 1;
		// `# [!text](url)` is a markdown link at heading start, not a callout.
		const isLink = line[to] === "(";
		if (parts.id.trim() && !isLink) {
			tokens.push({
				role: "heading",
				rawId: parts.id,
				metadata: parts.metadata,
				hasMetadata: parts.hasMetadata,
				from,
				to,
				hasTitle: (heading[3] ?? "").trim().length > 0,
				headingLevel: (heading[1] ?? "").length,
			});
			inlineScanFrom = to;
		}
	}

	// Inline tokens: manual indexOf scan (no regex) so adjacent tokens,
	// escapes, and link syntax are handled exactly and cheaply.
	let searchFrom = inlineScanFrom;
	for (;;) {
		const idx = line.indexOf("[!", searchFrom);
		if (idx === -1) break;
		searchFrom = idx + 2;
		const before = idx > 0 ? line[idx - 1] : "";
		if (before === "\\") continue; // escaped: \[!name]
		if (before === "[") continue; // defensive; stripWikilinks blanks [[!name]]
		const close = line.indexOf("]", idx + 2);
		if (close === -1) break; // unclosed — nothing further can close either
		const body = line.slice(idx + 2, close);
		const parts = splitCalloutMetadata(body);
		// The \n guard matters when scanning rendered multi-line text nodes
		// (reading view); raw markdown lines never contain newlines.
		if (!parts.id.trim() || body.includes("[") || body.includes("\n"))
			continue;
		if (line[close + 1] === "(") {
			// Markdown link whose text starts with `!`: [!name](url)
			searchFrom = close + 1;
			continue;
		}
		const token: LineCalloutToken = {
			role: "inline",
			rawId: parts.id,
			metadata: parts.metadata,
			hasMetadata: parts.hasMetadata,
			from: idx,
			to: close + 1,
			hasTitle: false,
			headingLevel: 0,
		};
		// `{…}` payload, when the role allows it. A `{` must sit directly on the
		// `]` — `[!warning] {x}` is a plain pill and literal text, because prose
		// uses braces freely and a looser rule would eat them.
		if (parseContent) {
			const match = matchInlineContent(contentScanLine(), close + 1);
			if (match.kind === "content") {
				token.content = {
					from: match.from,
					to: match.to,
					// From rawLine, not the blanked copy: the payload's own
					// inline code / wikilinks / math are real text.
					text: rawLine.slice(match.from + 1, match.to - 1),
				};
			} else if (match.kind === "open") {
				token.contentOpen = true;
			}
		}
		tokens.push(token);
		// Deliberately NOT `tokenEnd(token)`: a token inside another's payload
		// must still be found here, or the reading-view escape pairing (which
		// matches DOM candidates to source `[!` occurrences by ordinal) would
		// see a different list than this one. Nesting is refused by the
		// renderers instead.
		searchFrom = close + 1;
	}

	return tokens;
}

/** Fence opener/closer: marker run, optionally inside a blockquote. */
const FENCE_OPEN_RE = /^(?:\s*>\s*)*\s*(`{3,}|~{3,})/;

/**
 * Creates a stateful, single-use line filter for whole-document scans: feed it
 * every line of one document **in order** and it answers whether that line's
 * `[!name]` tokens count. It hides YAML frontmatter and fenced code blocks
 * (``` / ~~~, including fences nested in blockquotes), so a note that merely
 * *documents* callout syntax is never mistaken for one that uses it.
 *
 * Every whole-document consumer shares this one filter — the read-only
 * scanners below and the vault rewriters in utils/vaultCalloutScanner. That is
 * what keeps "3 uses in 2 files" and "3 references updated" in agreement.
 *
 * Lines must be passed with their real index and none may be skipped, or the
 * fence/frontmatter state desyncs. Callers that consume extra lines of their
 * own (e.g. a blockquote body) must still feed them through and discard the
 * answer.
 */
export function createDocumentLineFilter(): (
	line: string,
	index: number,
) => boolean {
	// null once the frontmatter block (if any) has been passed.
	let inFrontmatter: boolean | null = null;
	// Marker char + minimum length required to close the open fence.
	let fenceMarker: string | null = null;

	return (line: string, index: number): boolean => {
		// Frontmatter only counts when the opening --- is the very first line.
		if (inFrontmatter === null) {
			inFrontmatter = index === 0 && line.trimEnd() === "---";
		}
		if (inFrontmatter) {
			const t = line.trimEnd();
			// The delimiter line itself is not content either.
			if (index > 0 && (t === "---" || t === "...")) inFrontmatter = false;
			return false;
		}

		const fence = line.match(FENCE_OPEN_RE);
		if (fenceMarker) {
			// Inside a fence: only a matching closer gets us out.
			if (
				fence &&
				fence[1] &&
				fence[1][0] === fenceMarker[0] &&
				fence[1].length >= fenceMarker.length && line.slice(fence[0].length).trim() === ""
			) {
				fenceMarker = null;
			}
			return false;
		}
		if (fence && fence[1]) {
			fenceMarker = fence[1];
			return false;
		}

		return true;
	};
}

/**
 * Iterates every callout token in a full markdown document, skipping YAML
 * frontmatter and fenced code blocks. Used by the vault scanners so discovery,
 * statistics, and prune-counting all see heading and inline usages, not just
 * blockquotes.
 */
export function forEachCalloutToken(
	content: string,
	cb: (rawId: string, role: CalloutRenderRole, lineIndex: number) => void,
): void {
	if (content.indexOf("[!") === -1) return;

	const lines = content.split("\n");
	const isContentLine = createDocumentLineFilter();

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i] ?? "";
		if (!isContentLine(line, i)) continue;
		if (line.indexOf("[!") === -1) continue;
		for (const token of scanLineForCalloutTokens(line)) {
			cb(token.rawId, token.role, i);
		}
	}
}

/**
 * A `[!id]` token inside a wikilink's heading reference, e.g. the token in
 * `[[#[!tip] Title]]` or `[[Note#[!tip] Title]]`. These are never callouts
 * (scanLineForCalloutTokens excludes wikilink content); Live Preview instead
 * hides the token — optionally behind the callout's icon — so the displayed
 * link reads `#Title`.
 */
export interface WikilinkCalloutRef {
	/**
	 * Callout type as written, metadata removed (normalizeCalloutId to match).
	 * A `|` inside a wikilink is its alias separator, so a token here can only
	 * ever carry metadata in the alias half — the split is defensive.
	 */
	rawId: string;
	/** Offset of `[` of the token within the line. */
	from: number;
	/** Offset past `]` and the one space/tab separating the title. */
	to: number;
	/** Offset of the opening `[[` within the line. */
	linkFrom: number;
	/** Offset just past the closing `]]`. */
	linkTo: number;
	/** True when the link carries a `|alias` (Obsidian displays only that). */
	hasAlias: boolean;
	/** True when the token sits in the alias (display) text, not the target. */
	inAlias: boolean;
	/** True when title text follows the token inside its subpath segment. */
	hasTitle: boolean;
}

/**
 * Finds every `[!id]` token inside the wikilinks of one raw markdown line.
 * In the target, only tokens directly after a `#` count — those sit in a
 * heading reference; a token elsewhere is part of a file name and stays
 * untouched. In the alias, only a token opening the alias of a link whose
 * target has a `#` counts (TOC plugins alias heading links with the bare
 * heading text) — mirroring what `parseHeadingRefDisplayText` accepts.
 * Inline-code spans are ignored; unclosed links (mid-typing) yield nothing.
 */
export function findWikilinkCalloutRefs(rawLine: string): WikilinkCalloutRef[] {
	if (rawLine.indexOf("[[") === -1) return [];
	if (rawLine.indexOf("#[!") === -1 && rawLine.indexOf("|[!") === -1) {
		return [];
	}
	const line = stripInlineCode(rawLine);
	const refs: WikilinkCalloutRef[] = [];
	// Fresh regex per call: WIKILINK_RE is shared and /g exec mutates lastIndex.
	const linkRe = new RegExp(WIKILINK_RE.source, "g");
	let link: RegExpExecArray | null;
	while ((link = linkRe.exec(line)) !== null) {
		const inner = link[1] ?? "";
		const innerStart = link.index + 2;
		const pipeIdx = inner.indexOf("|");
		const target = pipeIdx === -1 ? inner : inner.slice(0, pipeIdx);
		let search = 0;
		for (;;) {
			const hashIdx = target.indexOf("#[!", search);
			if (hashIdx === -1) break;
			const tokenStart = hashIdx + 1;
			search = tokenStart + 2;
			const close = target.indexOf("]", tokenStart + 2);
			if (close === -1) break;
			const tokenBody = target.slice(tokenStart + 2, close);
			const rawId = splitCalloutMetadata(tokenBody).id;
			if (!rawId.trim() || tokenBody.includes("[")) continue;
			let to = close + 1;
			if (target[to] === " " || target[to] === "\t") to++;
			// Title runs to the next subpath separator (nested heading paths).
			const nextHash = target.indexOf("#", to);
			const segEnd = nextHash === -1 ? target.length : nextHash;
			refs.push({
				rawId,
				from: innerStart + tokenStart,
				to: innerStart + to,
				linkFrom: link.index,
				linkTo: link.index + link[0].length,
				hasAlias: pipeIdx !== -1,
				inAlias: false,
				hasTitle: target.slice(to, segEnd).trim().length > 0,
			});
			search = close + 1;
		}
		// Alias side: a token opening the alias of a heading link (the shape
		// TOC plugins generate — `[[#[!id]|[!id]]]`). Position 0 only and a
		// `#` in the target, matching parseHeadingRefDisplayText, so Live
		// Preview and reading view agree on what renders.
		if (pipeIdx === -1 || !target.includes("#")) continue;
		const alias = inner.slice(pipeIdx + 1);
		if (!alias.startsWith("[!")) continue;
		const aliasClose = alias.indexOf("]", 2);
		if (aliasClose === -1) continue;
		const aliasBody = alias.slice(2, aliasClose);
		const aliasId = splitCalloutMetadata(aliasBody).id;
		if (!aliasId.trim() || aliasBody.includes("[")) continue;
		let aliasTo = aliasClose + 1;
		if (alias[aliasTo] === " " || alias[aliasTo] === "\t") aliasTo++;
		const aliasStart = innerStart + pipeIdx + 1;
		refs.push({
			rawId: aliasId,
			from: aliasStart,
			to: aliasStart + aliasTo,
			linkFrom: link.index,
			linkTo: link.index + link[0].length,
			hasAlias: true,
			inAlias: true,
			// A `#` in an alias is literal text — the title runs to its end.
			hasTitle: alias.slice(aliasTo).trim().length > 0,
		});
	}
	return refs;
}

/** Parsed heading-callout token in a rendered link's display text. */
export interface HeadingRefDisplayToken {
	/** Display text before the token (`#`, `Note#`, or "") — kept verbatim. */
	prefix: string;
	/** Callout type as written, metadata removed (normalizeCalloutId to match). */
	rawId: string;
	/**
	 * The whole token body verbatim, `|metadata` included — what the raw link
	 * text actually spells. The href repair below rebuilds `[!<body>` to match
	 * an anchor Obsidian truncated, so it must not use the split `rawId`.
	 */
	rawContent: string;
	/** Display text after the token ("" when the heading has no title). */
	title: string;
	/**
	 * True when the token reached end-of-text without its closing `]`. That is
	 * how Obsidian renders a title-less reference: `[[#[!22]]]` parses as a
	 * link to `#[!22` (terminated at the FIRST `]]`) plus a stray `]` after
	 * the anchor — which the caller should strip.
	 */
	truncated: boolean;
}

/**
 * Token cut off by end-of-text before its `]`. Only a title-less reference
 * can produce this (the token's `]` must directly precede the link's `]]`),
 * so no title can follow.
 */
const TRUNCATED_HEADING_TOKEN_RE = /^\[!([^\]\n\r]+)$/;

/**
 * Parses the display text of a rendered internal link that references a
 * heading callout. Covers the forms link text actually takes: `[!id] Title`
 * at the start (TOC plugins alias links with the bare heading text; Obsidian
 * strips the `#` of same-file links), `#[!id] Title` / `Note#[!id] Title`
 * (raw link text, e.g. inside Live-Preview-rendered widgets), and
 * `Note > [!id] Title` (reading view renders the subpath `#` as ` > `).
 * A title-less reference arrives truncated — `#[!id` with no closing `]` —
 * and is reported with the `truncated` flag set.
 * Returns null when the text carries no such token — callers must then leave
 * the link untouched.
 */
export function parseHeadingRefDisplayText(
	text: string,
): HeadingRefDisplayToken | null {
	// First `[!` that opens a heading segment: at the start, after `#`, or
	// after the ` > ` separator.
	let idx = -1;
	let search = 0;
	for (;;) {
		const cand = text.indexOf("[!", search);
		if (cand === -1) return null;
		search = cand + 2;
		if (
			cand === 0 ||
			text[cand - 1] === "#" ||
			(cand >= 3 && text.slice(cand - 3, cand) === " > ")
		) {
			idx = cand;
			break;
		}
	}
	const rest = text.slice(idx);
	const m = RENDERED_HEADING_TOKEN_RE.exec(rest);
	if (m) {
		const rawContent = m[1] ?? "";
		const rawId = splitCalloutMetadata(rawContent).id;
		if (!rawId.trim()) return null;
		return {
			prefix: text.slice(0, idx),
			rawId,
			rawContent,
			title: text.slice(idx + m[0].length),
			truncated: false,
		};
	}
	// Title-less reference truncated by Obsidian's link parse (see the
	// HeadingRefDisplayToken.truncated doc).
	const cut = TRUNCATED_HEADING_TOKEN_RE.exec(rest);
	if (!cut) return null;
	const rawContent = cut[1] ?? "";
	const rawId = splitCalloutMetadata(rawContent).id;
	if (!rawId.trim()) return null;
	return {
		prefix: text.slice(0, idx),
		rawId,
		rawContent,
		title: "",
		truncated: true,
	};
}
