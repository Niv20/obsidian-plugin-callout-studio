/**
 * utils/vaultCalloutScanner.ts — Scans vault markdown files for callout usage.
 *
 * Provides async functions for reading every markdown file in the vault:
 * discovering unknown callout IDs, counting usages, bulk-replacing callout IDs
 * or titles, converting callouts to plain text, and normalizing fold markers.
 * Used by CalloutDiscovery (auto-discovery), DataManagementSection (re-scan),
 * and CalloutRowActions (pre-delete counts). The user-facing usage report lives
 * next door in vaultCalloutStats.ts.
 *
 * Both the read-only scanners (unknown discovery, usage counting) and the write
 * operations (bulk id/title replacement, plain-text conversion) go through the
 * shared tokenizer in editor/calloutTokens, so they all see the
 * same three render roles — block (`> [!id]`), heading (`## [!id]`), and
 * inline (`[!id]` mid-line) — and all agree on which occurrences are real:
 * escapes, markdown links, wikilink contents, inline code, fenced code blocks
 * and YAML frontmatter are excluded once, in one place. Keeping the writers on
 * the same grammar as the counters is what stops the menu from promising "3
 * uses in 2 files" and the rewrite from reporting 0.
 *
 * The one exception is fold-marker normalization; see the note on it below.
 */
import type { App, TFile } from "obsidian";
import { calloutIdentity, mergeDashSpaceVariants, normalizeCalloutId } from "./calloutId";
import { rewriteVaultFiles } from "./vaultRewrite";
import type { LineCalloutToken } from "../editor/calloutTokens";
import {
	createDocumentLineFilter,
	forEachCalloutToken,
	nestedInlineTokens,
	scanLineForCalloutTokens,
	tokenEnd,
} from "../editor/calloutTokens";
import { splitFoldMark } from "../editor/calloutWriter";

function escapeRegex(str: string): string {
	return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * End offset of a token's `[!…]` bracket span — the whole of it, `|metadata`
 * included. Kept as its own helper rather than inlining `token.to` so the two
 * readings of "where the token ends" stay named apart; an id swap replaces this
 * span and rebuilds the metadata itself (see replaceCalloutIdsInVault).
 *
 * Must NOT be derived from `token.rawId.length`: that is the type alone, so on
 * `[!note|purple]` it would cut the bracket short by the metadata's width.
 */
function tokenBracketEnd(token: LineCalloutToken): number {
	return token.to;
}

/** The `|metadata` suffix to re-emit for a token, or "" when it had none. */
function metadataSuffix(token: LineCalloutToken): string {
	return token.hasMetadata ? `|${token.metadata}` : "";
}

/**
 * Splits what follows a token into its fold mark and its title text.
 *
 * A block callout header may carry a `+`/`-` fold marker right after `]`; that
 * is syntax, not title, and has to survive any rewrite. A heading callout has no
 * fold syntax — its folding is driven by the two chevrons — so everything after
 * `]` there is plain title text, which is why `## [!id]- Old Title` is titled
 * `- Old Title` and correctly fails to match a rename of `Old Title`.
 *
 * Shared by the two writers that reason about a title: the rename
 * ({@link replaceCalloutTitlesInVault}) and the type swap
 * ({@link replaceCalloutIdsInVault}). They must agree on where the title starts
 * or a replace would eat a fold mark the rename preserves — which is also why
 * the rule itself lives in `calloutWriter.splitFoldMark`, next to the writer
 * that emits the mark, rather than being spelled out once per caller.
 */
function splitFoldAndTitle(
	line: string,
	token: LineCalloutToken,
): { foldMark: string; title: string } {
	return splitFoldMark(line.slice(token.to), token.role);
}

/**
 * Applies per-token edits to one line. Tokens are spliced right-to-left so
 * offsets computed against the original line stay valid throughout — a heading
 * line can carry inline tokens inside its title text.
 *
 * `replace` returns the text to put in place of `[token.from, end)`, or null to
 * leave that token alone. It may widen the replaced span via `end` (used to
 * swallow the whitespace after a heading token).
 */
function rewriteTokensOnLine(
	line: string,
	tokens: LineCalloutToken[],
	replace: (token: LineCalloutToken) => { text: string; end: number } | null,
): { line: string; count: number } {
	let out = line;
	let count = 0;
	for (const token of [...tokens].sort((a, b) => b.from - a.from)) {
		const edit = replace(token);
		if (!edit) continue;
		out = out.slice(0, token.from) + edit.text + out.slice(edit.end);
		count++;
	}
	return { line: out, count };
}

/**
 * Walks a document's content lines (frontmatter and fenced code skipped) and
 * hands each line's callout tokens to `rewriteLine`, which returns the new line
 * and how many tokens it changed. Returns null when nothing changed, so callers
 * can skip the vault write.
 */
function rewriteCalloutLines(
	content: string,
	rewriteLine: (
		line: string,
		tokens: LineCalloutToken[],
	) => { line: string; count: number },
): { content: string; count: number } | null {
	if (content.indexOf("[!") === -1) return null;

	const lines = content.split("\n");
	const isContentLine = createDocumentLineFilter();
	let total = 0;

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i] ?? "";
		if (!isContentLine(line, i)) continue;
		if (line.indexOf("[!") === -1) continue;
		const tokens = scanLineForCalloutTokens(line);
		if (tokens.length === 0) continue;
		const result = rewriteLine(line, tokens);
		if (result.count === 0) continue;
		lines[i] = result.line;
		total += result.count;
	}

	return total > 0 ? { content: lines.join("\n"), count: total } : null;
}

/**
 * Scan a single Markdown file (cheap; reads from cache) and return the set of
 * callout IDs referenced in any role (block / heading / inline) that are
 * NOT in `knownIds`. Used for incremental tracking on file save / create.
 */
export async function scanFileForUnknownCallouts(
	app: App,
	file: TFile,
	knownIds: Set<string>,
): Promise<string[]> {
	const content = await app.vault.cachedRead(file);
	return scanStringForUnknownCallouts(content, knownIds);
}

/**
 * Synchronously scan an in-memory string (e.g. an open editor's current
 * buffer that may be unsaved) and return unknown callout IDs from any role.
 *
 * Dash/space spellings merge into one — {@link mergeDashSpaceVariants}.
 */
export function scanStringForUnknownCallouts(
	content: string,
	knownIds: Set<string>,
): string[] {
	const found = new Set<string>();
	forEachCalloutToken(content, (rawId) => {
		const id = normalizeCalloutId(rawId);
		if (!id) return;
		// Symmetric: `knownIds` holds both spellings, so test both spellings.
		if (!knownIds.has(id) && !knownIds.has(calloutIdentity(id))) found.add(id);
	});
	return mergeDashSpaceVariants(Array.from(found));
}

/**
 * Count how many markdown files reference any of the given callout IDs.
 * Uses `cachedRead` for speed.
 */
export async function countCalloutUsages(
	app: App,
	ids: string[],
): Promise<{ fileCount: number; totalCount: number }> {
	if (ids.length === 0) return { fileCount: 0, totalCount: 0 };

	const idSet = new Set(ids.map((id) => calloutIdentity(id)));
	const files = app.vault.getMarkdownFiles();
	let fileCount = 0;
	let totalCount = 0;

	for (const file of files) {
		const content = await app.vault.cachedRead(file);
		let countInFile = 0;
		forEachCalloutToken(content, (rawId) => {
			if (idSet.has(calloutIdentity(rawId))) countInFile++;
		});
		if (countInFile > 0) {
			fileCount++;
			totalCount += countInFile;
		}
	}

	return { fileCount, totalCount };
}

/**
 * Count how many markdown files reference each of the given callout IDs in a
 * single vault pass. Returns a Map keyed by {@link calloutIdentity}. Zero-usage
 * IDs are still present with `{ fileCount: 0, totalCount: 0 }`.
 */
export async function countCalloutUsagesMap(
	app: App,
	ids: string[],
): Promise<Map<string, { fileCount: number; totalCount: number }>> {
	const result = new Map<string, { fileCount: number; totalCount: number }>();
	for (const id of ids) {
		result.set(calloutIdentity(id), { fileCount: 0, totalCount: 0 });
	}
	if (ids.length === 0) return result;

	const files = app.vault.getMarkdownFiles();
	for (const file of files) {
		const content = await app.vault.cachedRead(file);
		const seenInFile = new Set<string>();
		forEachCalloutToken(content, (rawId) => {
			const id = calloutIdentity(rawId);
			if (!id) return;
			const entry = result.get(id);
			if (!entry) return;
			entry.totalCount++;
			seenInFile.add(id);
		});
		for (const id of seenInFile) {
			result.get(id)!.fileCount++;
		}
	}
	return result;
}

/**
 * Convert every usage of `ids` in the vault into plain text, per render role:
 *
 * - regular  `> [!id] Title` → the block is unwrapped: the header keeps only its
 *   title text and the body lines lose their leading `> `. Only outermost blocks
 *   (single `>`) are unwrapped — a nested `>> [!id] Title` keeps its blockquote
 *   depth, which belongs to the parent callout, and loses just the token:
 *   `>> Title`.
 * - heading   `### [!id] Title` → `### Title`, or `### [!id]` → `### <name>`
 *   when the heading has no title of its own to fall back on.
 * - inline    `[!id]` → `<name>`.
 *
 * Either way no `[!id]` survives anywhere, which is what lets a delete stick: a
 * live reference left behind is one discovery re-creates a row for.
 *
 * `displayName` is that fallback name — a heading or a pill carries no text
 * besides the token, so dropping the token outright would delete the line's
 * only content.
 *
 * Returns `{ files, blocks }`: how many files were modified and how many
 * usages were converted in total.
 */
export async function convertCalloutsToPlainTextInVault(
	app: App,
	ids: string[],
	displayName: string,
): Promise<{ files: number; blocks: number }> {
	if (ids.length === 0) return { files: 0, blocks: 0 };

	const idSet = new Set(ids.map((id) => calloutIdentity(id)));
	const headerRegex = /^(>+)\s*\[!([^\]\n\r]+)\][+-]?\s*(.*)$/i;
	const name = displayName.trim();

	// Pure function of one file's content — rewriteVaultFiles runs it to probe,
	// then again under the vault lock to commit.
	const transform = (content: string) => {
		const lines = content.split("\n");
		const isContentLine = createDocumentLineFilter();
		let blocksInFile = 0;
		let i = 0;

		while (i < lines.length) {
			const line = lines[i] ?? "";
			if (!isContentLine(line, i)) {
				i++;
				continue;
			}
			const headerMatch = line.match(headerRegex);
			if (headerMatch) {
				const markers = headerMatch[1] ?? ">";
				const id = calloutIdentity(headerMatch[2] ?? "");
				// Only unwrap outermost blocks (single `>`) whose id matches.
				if (markers.length === 1 && idSet.has(id)) {
					const title = (headerMatch[3] ?? "").trim();
					lines[i] = title;
					i++;
					// Strip leading `> ` from continuation lines until the
					// blockquote ends (a non-`>` line, including blank lines).
					while (i < lines.length) {
						const cont = lines[i] ?? "";
						if (!/^>/.test(cont)) break;
						// Still feed the filter every line we consume, or its
						// fence state desyncs on a fenced callout body.
						isContentLine(cont, i);
						lines[i] = cont.replace(/^>\s?/, "");
						i++;
					}
					blocksInFile++;
					continue;
				}
			}

			// Not a block callout header we own → heading and inline tokens.
			if (line.indexOf("[!") !== -1) {
				const lineTokens = scanLineForCalloutTokens(line);
				// A token inside another's `{…}` payload is rewritten by the
				// outer token's own edit. Letting it match too would splice the
				// same characters twice (rewriteTokensOnLine works
				// right-to-left over overlapping ranges).
				const nested = nestedInlineTokens(lineTokens);
				const result = rewriteTokensOnLine(
					line,
					lineTokens,
					(token) => {
						if (nested.has(token)) return null;
						if (!idSet.has(calloutIdentity(token.rawId))) {
							return null;
						}
						if (token.role === "inline") {
							// A content pill's payload is the user's own prose —
							// keep it, prefixed by the callout name so the note
							// still reads as "Warning: be careful" once the
							// plugin's syntax is gone. Widened past the braces so
							// no orphaned `{…}` is left behind.
							const content = token.content?.text.trim();
							return {
								text: content ? `${name}: ${content}` : name,
								end: tokenEnd(token),
							};
						}
						// Heading, or a *nested* block header. An outermost
						// `> [!id]` was unwrapped by the branch above, which
						// `continue`d past here, so a `regular` token reaching
						// this point sits inside another blockquote: there the
						// `>` prefix belongs to the parent callout, and
						// unwrapping it the way an outermost block is unwrapped
						// would break the parent. So only the token goes —
						// `>> [!id] Title` becomes `>> Title`. Leaving it would
						// keep a live reference to an id the caller is deleting,
						// which discovery then re-creates a row for.
						//
						// Either role: swallow the fold mark (block syntax) and
						// the whitespace after the token, and let the line's own
						// title stand — falling back to the name when the token
						// was all it had. Read that title back off the line
						// rather than from `token.hasTitle`, which the tokenizer
						// only computes for headings (a block token always
						// reports false, because Obsidian renders the whole rest
						// of the line as the title itself).
						const { foldMark, title } = splitFoldAndTitle(
							line,
							token,
						);
						const gap =
							title.length - title.replace(/^[ \t]+/, "").length;
						return {
							text: title.trim() ? "" : name,
							end: token.to + foldMark.length + gap,
						};
					},
				);
				if (result.count > 0) {
					lines[i] = result.line;
					blocksInFile += result.count;
				}
			}
			i++;
		}

		return blocksInFile > 0
			? { content: lines.join("\n"), count: blocksInFile }
			: null;
	};

	const { files, count } = await rewriteVaultFiles(app, transform);
	return { files, blocks: count };
}

/**
 * The optional title rewrite that rides along with a type swap — see
 * {@link replaceCalloutIdsInVault}.
 */
export interface CalloutTitleSwap {
	/**
	 * Only a title that is exactly this (trimmed, case-insensitive) is
	 * swapped, so a title the user wrote themselves is never clobbered.
	 */
	from: string;
	to: string;
}

/**
 * Replace callout IDs in all markdown files. Every occurrence of `[!oldId]`
 * (for any oldId in `oldIds`) becomes `[!newId]`, in all three render roles —
 * a heading callout and an inline callout carry the id just as a block callout
 * does, and a rename that skipped them would leave a dead id behind that
 * renders as "unknown".
 *
 * Any heading fold mark is preserved: only the bracket span is swapped. So is
 * any `|metadata` — that belongs to the occurrence, not to the callout type, so
 * renaming `note` must turn `[!note|purple]` into `[!newId|purple]`.
 *
 * With `titleSwap`, the *name* travels with the type. A block header written by
 * this plugin carries the callout's display name as its title (see
 * `calloutWriter.buildBlockHeaderToken`), so swapping the token alone would
 * leave `> [!danger] Warning` on screen. The match rule is the same one
 * {@link replaceCalloutTitlesInVault} uses for a rename — whole title, exact,
 * case-insensitive — so `> [!warning] read this first` keeps its own words and
 * a title-less `> [!warning]` stays title-less, which is already right: Obsidian
 * renders the new callout's name for it.
 *
 * Returns the number of references replaced.
 */
export async function replaceCalloutIdsInVault(
	app: App,
	oldIds: string[],
	newId: string,
	titleSwap?: CalloutTitleSwap,
): Promise<number> {
	if (oldIds.length === 0) return 0;

	const idSet = new Set(oldIds.map((id) => calloutIdentity(id)));
	// An empty old title would match every title-less header and *add* a title
	// to it, which is never what a type swap means. Same guard, same reason, as
	// in replaceCalloutTitlesInVault.
	const wanted = titleSwap?.from.trim().toLowerCase() ?? "";

	const { count } = await rewriteVaultFiles(app, (content) =>
			rewriteCalloutLines(content, (line, tokens) =>
				rewriteTokensOnLine(line, tokens, (token) => {
					if (!idSet.has(calloutIdentity(token.rawId))) return null;
					const bracket = `[!${newId}${metadataSuffix(token)}]`;
					// A pill has no title text of its own, so there is nothing
					// to carry across for an inline token.
					if (titleSwap && wanted && token.role !== "inline") {
						const { foldMark, title } = splitFoldAndTitle(line, token);
						if (title.trim().toLowerCase() === wanted) {
							// Widening to end-of-line is safe here precisely
							// because the title matched: a title that is exactly
							// a plain display name holds no tokens of its own, so
							// rewriteTokensOnLine (which works right-to-left) has
							// not edited anything to the right of this token.
							return {
								text: `${bracket}${foldMark} ${titleSwap.to}`,
								end: line.length,
							};
						}
					}
					return { text: bracket, end: tokenBracketEnd(token) };
				}),
			),
	);

	return count;
}

/**
 * Rewrite `+/-` fold markers on every `> [!id]` (or alias) line in the vault to
 * match `desiredMarker` ("" = none, "+" = open, "-" = closed). Changed files only.
 *
 * Blockquote-only, unlike the other writers here: `+/-` is fold syntax for a
 * block callout alone. A heading has none — its folding is the two chevrons —
 * so anything after `## [!id]` there is title text and must not be touched.
 *
 * Any *depth* of blockquote, though: a nested `>> [!note]` folds exactly as its
 * parent does, so the prefix matched is the tokenizer's own — and `[ \t]` not
 * `\s`, so the run cannot cross a newline onto a `[!note]` after a lone `>`.
 *
 * The optional `|…` before `]` matches occurrences carrying metadata, which an
 * id-only pattern would skip; the mark sits after the `]` and passes through.
 */
export async function normalizeFoldMarkersInVault(
	app: App,
	ids: string[],
	desiredMarker: "" | "+" | "-",
): Promise<number> {
	if (ids.length === 0) return 0;

	const pattern = ids.map(escapeRegex).join("|");
	const regex = new RegExp(
		`(^(?:>[ \\t]*)+\\[!(?:${pattern})(?:\\|[^\\]\\n\\r]*)?\\])([+-]?)`,
		"gim",
	);

	const { count: total } = await rewriteVaultFiles(app, (content) => {
			let count = 0;
			// `g`-flagged and shared across files, and this now runs twice per
			// changed file — so never inherit a `lastIndex` from the last pass.
			regex.lastIndex = 0;
			const newContent = content.replace(
				regex,
				(_match, prefix: string, current: string) => {
					if (current === desiredMarker) return _match;
					count++;
					return `${prefix}${desiredMarker}`;
				},
			);
			return count > 0 ? { content: newContent, count } : null;
	});

	return total;
}

/**
 * Scan every Markdown file once and return the set of callout IDs that are
 * referenced in any role (regular / heading / inline) but are NOT in the
 * supplied known set.
 *
 * Merges dash/space spellings again after aggregating: each file was merged on
 * its own, but `[!a b]` in one note and `[!a-b]` in another still arrive here
 * as two entries.
 */
export async function scanVaultForUnknownCallouts(
	app: App,
	knownIds: Set<string>,
): Promise<string[]> {
	const files = app.vault.getMarkdownFiles();
	const found = new Set<string>();
	for (const file of files) {
		const content = await app.vault.cachedRead(file);
		for (const id of scanStringForUnknownCallouts(content, knownIds)) {
			found.add(id);
		}
	}
	return mergeDashSpaceVariants(Array.from(found));
}

/**
 * Replace the display-name / title text of callouts that match the given IDs.
 * Matches `> [!id] Old Title`, `> [!id]+ Old Title` and the heading equivalent
 * `## [!id] Old Title`, replacing the title portion with `newTitle`. Inline
 * tokens are skipped — a pill has no title text of its own.
 *
 * Only replaces when the whole existing title matches `oldTitle`
 * (case-insensitive), so a title the user wrote themselves is never clobbered.
 */
export async function replaceCalloutTitlesInVault(
	app: App,
	ids: string[],
	oldTitle: string,
	newTitle: string,
): Promise<number> {
	if (ids.length === 0) return 0;

	const idSet = new Set(ids.map((id) => calloutIdentity(id)));
	const wanted = oldTitle.trim().toLowerCase();
	// An empty old title would match every title-less header and *add* a title
	// to it, which is never what a rename means.
	if (!wanted) return 0;

	const { count } = await rewriteVaultFiles(app, (content) =>
			rewriteCalloutLines(content, (line, tokens) =>
				rewriteTokensOnLine(line, tokens, (token) => {
					if (token.role === "inline") return null;
					if (!idSet.has(calloutIdentity(token.rawId))) return null;
					const { foldMark, title } = splitFoldAndTitle(line, token);
					if (title.trim().toLowerCase() !== wanted) return null;
					return {
						text: `${line.slice(token.from, token.to)}${foldMark} ${newTitle}`,
						end: line.length,
					};
				}),
			),
	);

	return count;
}
