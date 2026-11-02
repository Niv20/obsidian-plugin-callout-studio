/**
 * utils/metadataWordInput.ts — the user's own metadata words
 * (Settings → Editor → Metadata → Your words): what one word may be, and how a
 * saved list is cleaned when it is loaded.
 *
 * A word is what may stand between two separators in `[!type|…]`, so it can
 * hold no whitespace and no `|` (see `calloutMetadata.ts`, which reads the
 * metadata the same way). A `[` or `]` is taken out too: the `]` would end the
 * callout's token, and a `[` beside it only confuses the next reader. Case is
 * kept as typed — a theme's `[data-callout-metadata~=Wide]` does not match
 * `wide`, so the user's spelling is the one that is written.
 */
import { MAX_METADATA_WORD_LENGTH, MAX_METADATA_WORDS } from "../constants";

/** What parts typed or pasted text into words: whitespace, `|` and commas. */
export const METADATA_WORD_SEPARATORS = /[\s|,]+/;

/** One typed word, cleaned: no brackets, no whitespace at either end. `""` when nothing is left. */
export function sanitizeMetadataWordInput(raw: string): string {
	return raw.replace(/[[\]]/g, "").trim();
}

/**
 * A saved list of words, as this version can use it: only strings, each split
 * and cleaned as typing would, none longer than the cap, no word twice, and no
 * more than {@link MAX_METADATA_WORDS}. Anything else — a hand-edited
 * `data.json`, a file from another build — gives an empty list.
 */
export function sanitizeMetadataWords(value: unknown): string[] {
	if (!Array.isArray(value)) return [];
	const words: string[] = [];
	for (const entry of value) {
		if (typeof entry !== "string") continue;
		for (const part of entry.split(METADATA_WORD_SEPARATORS)) {
			const word = sanitizeMetadataWordInput(part);
			if (word === "" || word.length > MAX_METADATA_WORD_LENGTH) continue;
			if (words.includes(word)) continue;
			words.push(word);
		}
	}
	return words.slice(0, MAX_METADATA_WORDS);
}
