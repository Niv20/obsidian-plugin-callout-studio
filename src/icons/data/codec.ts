/**
 * icons/data/codec.ts — Decoder for the bundled icon search indexes.
 *
 * Icon metadata is by far the largest thing in `main.js`, and Obsidian only
 * ever downloads that one file, so the indexes ship in a packed textual form
 * rather than as object literals. Three things make the difference:
 *
 * - keywords are stored once in a dictionary and referenced by fixed-width
 *   base36 codes, instead of repeating every string on every icon that uses it
 * - the dictionary is front-coded, so each sorted entry only carries the part
 *   that differs from the one before it
 * - the whole index is a handful of string constants, which the JS engine keeps
 *   as inert bytes until something actually calls decodeIndex()
 *
 * The encoder lives in `scripts/lib/encodeIndex.mjs`, and the generator asserts
 * a lossless round-trip through this decoder on every run, so the two cannot
 * drift apart silently.
 */
import type { IconEntry, IconIndex } from "../types";

export interface EncodedIndex {
	/** "\n"-joined icon names. */
	n: string;
	/** "\n"-joined labels, positionally aligned with `n`. Omitted when every
	 *  label is just its name. */
	l?: string;
	/** Front-coded, "\n"-joined sorted keyword dictionary. */
	k: string;
	/** Width, in base36 characters, of one keyword reference. */
	kw: number;
	/** One line per icon; each line is that icon's refs, concatenated. */
	kr: string;
	/** "\n"-joined category names. Omitted for packs with no taxonomy. */
	c?: string;
	/** Width, in base36 characters, of one category reference. */
	cw?: number;
	/** One line per icon; each line is that icon's category refs, concatenated. */
	cr?: string;
}

/** Split a run of concatenated fixed-width base36 codes back into numbers. */
function unpackRefs(line: string, width: number): number[] {
	const out: number[] = [];
	for (let i = 0; i + width <= line.length; i += width) {
		out.push(parseInt(line.slice(i, i + width), 36));
	}
	return out;
}

/**
 * Rebuild a front-coded list: each line is a base36 digit giving how many
 * leading characters it shares with the previous entry, then the rest.
 */
export function decodeFrontCoded(blob: string): string[] {
	if (blob.length === 0) return [];
	const out: string[] = [];
	let prev = "";
	for (const line of blob.split("\n")) {
		const shared = parseInt(line.slice(0, 1), 36);
		const value = prev.slice(0, shared) + line.slice(1);
		out.push(value);
		prev = value;
	}
	return out;
}

/** Expand a packed index into the entry list the picker searches. */
export function decodeIndex(enc: EncodedIndex): IconIndex {
	const names = enc.n.length === 0 ? [] : enc.n.split("\n");
	const labels = enc.l ? enc.l.split("\n") : null;
	const keywords = decodeFrontCoded(enc.k);
	const categories = enc.c && enc.c.length > 0 ? enc.c.split("\n") : [];

	// One line per icon. An icon with no keywords contributes an empty line, so
	// the line count stays aligned with the name count.
	const keywordLines = enc.kr.length === 0 ? [] : enc.kr.split("\n");
	const categoryLines = enc.cr && enc.cr.length > 0 ? enc.cr.split("\n") : [];

	const entries: IconEntry[] = names.map((name, i) => {
		const kwLine = keywordLines[i] ?? "";
		const catLine = categoryLines[i] ?? "";
		const entry: IconEntry = {
			name,
			categories: enc.cw && catLine ? unpackRefs(catLine, enc.cw).map((r) => categories[r] ?? "") : [],
			keywords: kwLine ? unpackRefs(kwLine, enc.kw).map((r) => keywords[r] ?? "") : [],
		};
		const label = labels?.[i];
		if (label) entry.label = label;
		return entry;
	});

	return { entries, categories };
}

/**
 * Decode once and hand back the same object thereafter. Packs call this from
 * `loadIndex()`, so opening a source twice never re-parses it.
 */
export function memoizeIndex(build: () => IconIndex): () => Promise<IconIndex> {
	let cached: IconIndex | null = null;
	return () => {
		if (!cached) cached = build();
		return Promise.resolve(cached);
	};
}
