/**
 * utils/calloutId.ts — Canonical callout-ID normalization helpers.
 *
 * Callout IDs may contain spaces (e.g. "multi word callout"). To keep stored
 * IDs, vault-scanned IDs, and CSS selectors in agreement, every producer and
 * consumer routes IDs through one of these helpers:
 *
 * - splitCalloutMetadata — separates `[!type|metadata]` into its two halves.
 *   The one place the pipe rule is spelled out.
 * - normalizeCalloutId — permissive; used when *reading* an ID out of markdown
 *   or matching against the registry. Drops metadata, then normalizes
 *   whitespace and case; all other characters are preserved.
 * - sanitizeCalloutIdInput — restrictive; used when the user *creates* an ID in
 *   the editor. Restricts the allowed character set. Does NOT split metadata:
 *   its input is a display name, not a token body.
 * - obsidianCalloutAttrId — the form Obsidian itself writes into a block
 *   callout's `data-callout` attribute. Used *only* for `.callout[…]` selectors
 *   and when reading that attribute back.
 * - calloutIdentity — the one answer to "are these two IDs the same callout?".
 *   The only thing anything may compare identity by.
 *
 * mergeDashSpaceVariants builds on those to fold IDs that only a vault scan can
 * turn up in two spellings at once.
 */

/** The two halves of a `[!type|metadata]` token body. See splitCalloutMetadata. */
export interface CalloutIdParts {
	/** Callout type exactly as written, metadata removed. NOT normalized. */
	id: string;
	/**
	 * Raw text after the first `|`, verbatim — Obsidian does not trim it, and it
	 * may itself contain further pipes. "" when there was no pipe.
	 *
	 * Unrelated to `CalloutDefinition.metadata`, which is a definition's own
	 * key/value bag; this is Obsidian's `data-callout-metadata`.
	 */
	metadata: string;
	/** True when a `|` was present, so `[!x|]` stays distinguishable from `[!x]`. */
	hasMetadata: boolean;
}

/**
 * Split a callout token body at the pipe, exactly as Obsidian does.
 *
 * Its blockquote tokenizer runs `i = e.indexOf("|")` on the bracket body and
 * takes everything before the FIRST pipe as the type and everything after it as
 * `data`, which the renderer emits as `data-callout-metadata` (verified in the
 * bundled parser). So `> [!note|purple]` is the `note` callout carrying the
 * metadata `purple`, not a callout named `note|purple` — and a plugin that reads
 * the body whole would see one type per metadata value.
 *
 * Metadata is returned verbatim: Obsidian neither trims nor lowercases it, and a
 * second pipe belongs to the metadata rather than starting a third field.
 */
export const splitCalloutMetadata = (raw: string): CalloutIdParts => {
	const pipe = raw.indexOf("|");
	if (pipe === -1) return { id: raw, metadata: "", hasMetadata: false };
	return {
		id: raw.slice(0, pipe),
		metadata: raw.slice(pipe + 1),
		hasMetadata: true,
	};
};

/**
 * Canonicalize an ID read from markdown (or any external source) for matching:
 * drop any `|metadata`, collapse internal whitespace runs to a single space,
 * trim, lowercase. All other characters are preserved so unusual existing IDs
 * still resolve.
 *
 * Dropping the metadata here rather than at each call site is what makes it
 * structurally impossible for `note|purple` to reach the registry as its own
 * callout: every consumer that turns raw markdown into an ID — discovery, the
 * vault scanners, resolveCalloutDef, the context menu, the outline pane, the
 * link-suggest popup — already funnels through this one function.
 */
export const normalizeCalloutId = (raw: string): string =>
	splitCalloutMetadata(raw)
		.id.replace(/\s+/g, " ")
		.trim()
		.toLowerCase();

/**
 * Sanitize raw text typed into the editor's ID field into a valid callout ID.
 * Lowercases, keeps only letters/numbers/space/dash, and folds dash runs into
 * the same single-space word separator as whitespace, trimming the result. May
 * return "" when the input has no usable characters (callers reject empty IDs).
 *
 * Deliberately does NOT split on `|`, unlike normalizeCalloutId: nothing that
 * reaches here is a `[!…]` token body. Its callers are the editor deriving an
 * ID from a *display name* (CalloutEditor.generateId) and alias entry
 * (TagInput) — in both, a pipe is a character the user typed in a name, not a
 * metadata separator, so splitting would silently throw away the second half of
 * it (`Q|A` → `q` rather than `qa`). The pipe still falls out below as a
 * disallowed character, which is all the ID field ever needed.
 *
 * Dashes are folded rather than preserved because Obsidian itself can never
 * tell the two apart: its own default callout title generation runs
 * `type.replace(/-/g, " ")` before capitalizing (verified in its bundled
 * renderer), so a literal hyphen typed here could never survive rendering as
 * a "real" character anyway. Treating it as a word separator from the start
 * avoids ever creating a dash/space pair that collides once Obsidian
 * dasherizes both spellings to the same `data-callout` attribute — see
 * obsidianCalloutAttrId below.
 */
export const sanitizeCalloutIdInput = (raw: string): string =>
	raw
		.toLowerCase()
		.replace(/[^\p{L}\p{N}\s-]/gu, "")
		.replace(/[\s-]+/g, " ")
		.trim();

/**
 * The form Obsidian itself writes into a block callout's `data-callout`
 * attribute. Obsidian parses `> [!My Multi Word]` as
 * `t.trim().toLowerCase().replace(/\s+/g, "-")` in BOTH its reading-view block
 * parser and its Live Preview CodeMirror mode, so the rendered DOM is always
 * `<div class="callout" data-callout="my-multi-word">` — dashes, never spaces.
 *
 * Use this ONLY for `.callout[data-callout=…]` selectors and when reading that
 * attribute back. The heading-callout / inline-callout / ref-token DOM is stamped by
 * US (buildCalloutTokenDom, calloutPostProcessor, calloutViewPlugin) with the
 * space-preserving `normalizeCalloutId` form — those must NOT go through here.
 *
 * Identity for any ID without whitespace, so IDs containing literal dashes are
 * untouched. Idempotent.
 *
 * Deliberately does NOT strip `|metadata`, unlike normalizeCalloutId: Obsidian
 * has already removed it before this attribute exists, so every value that
 * legitimately reaches here is metadata-free anyway. Stripping would only affect
 * a stray piped ID that slipped into storage — and would then collapse it onto a
 * real callout's selector, silently hijacking that callout's CSS rule.
 */
export const obsidianCalloutAttrId = (raw: string): string =>
	raw
		.trim()
		.toLowerCase()
		.replace(/\s+/g, "-");

/**
 * The canonical identity of a callout ID: the one function every comparison,
 * lookup, insertion, persistence check, discovery pass and import goes through.
 *
 * Two IDs name the SAME callout exactly when this returns the same string for
 * both, because this is Obsidian's own rule. Its blockquote tokenizer reduces a
 * `[!…]` body to `type.trim().toLowerCase().replace(/\s+/g, "-")` (after
 * splitting the metadata off at the first `|`), and that single value is what
 * lands in `data-callout`. So `[!banner icon]`, `[!banner   icon]`,
 * `[!Banner Icon]` and `[!banner-icon]` are four spellings of one callout on
 * screen, and anything that treats them as more than one row produces two
 * definitions fighting over a single CSS rule.
 *
 * It is a third helper rather than a replacement for either of the two it
 * composes, because those two answer different questions and both are right:
 *
 * - `normalizeCalloutId` is the *raw-text reader*, and space-preserving on
 *   purpose: the heading/inline/ref DOM this plugin stamps itself carries that
 *   form (see obsidianCalloutAttrId), so dasherizing there would break
 *   `tokenAttrSel`.
 * - `obsidianCalloutAttrId` is the *selector* form, and deliberately does not
 *   strip `|metadata`: Obsidian removed it before the attribute existed, so
 *   stripping could only take a stray stored ID and collapse it onto a real
 *   callout's rule.
 * - Identity is the third question, and it needs both halves — a stored ID that
 *   somehow carries a pipe must fold onto its base rather than live beside it.
 *
 * Idempotent, and identity-equal to `obsidianCalloutAttrId` for every ID without
 * a pipe or a whitespace run — which is every ID the editor can produce.
 */
export const calloutIdentity = (raw: string): string =>
	obsidianCalloutAttrId(normalizeCalloutId(raw));

/**
 * The title Obsidian shows for a block callout that carries no explicit
 * title text: `type.trim().replace(/-/g, " ").toLowerCase()`, first letter
 * capitalized (verified in its bundled renderer — see obsidianCalloutAttrId's
 * doc). Used when we generate a display name ourselves (auto-discovered
 * fallback rows) so it reads the same as what the regular role would show for
 * the identical raw text.
 */
export const obsidianDefaultTitle = (raw: string): string => {
	const lower = raw.trim().replace(/-/g, " ").toLowerCase();
	return lower.charAt(0).toUpperCase() + lower.slice(1);
};

/**
 * Collapse IDs that differ only by dash-versus-space to one representative
 * each, keeping the original array order.
 *
 * A vault where someone wrote both `[!a b]` and `[!a-b]` describes ONE callout
 * — Obsidian renders both as `data-callout="a-b"` — so discovery must offer one
 * row for the pair, not two rows that then fight over a single CSS rule. Folding
 * is by {@link calloutIdentity}, so `[!a   b]` and `[!A B]` come along with them.
 *
 * The spaced spelling wins when both were actually seen, because that is the
 * form the editor's ID field and display-name derivation produce. A spelling
 * seen only with dashes is kept verbatim: inventing a space for `a-b` would
 * quietly rename a callout its author deliberately hyphenated.
 */
export const mergeDashSpaceVariants = (ids: string[]): string[] => {
	// Map keeps first-insertion order, and re-setting a key does not move it,
	// so preferring a later spelling never reorders the result.
	const chosen = new Map<string, string>();
	for (const id of ids) {
		const attrForm = calloutIdentity(id);
		if (!attrForm) continue;
		const current = chosen.get(attrForm);
		if (current === undefined) {
			chosen.set(attrForm, id);
		} else if (!current.includes(" ") && id.includes(" ")) {
			chosen.set(attrForm, id);
		}
	}
	return Array.from(chosen.values());
};
