/**
 * editor/metadataSuggestions.ts — what the `[!type|…]` dropdown offers, and
 * what picking each row does to the metadata text.
 *
 * Pure: text and lists in, rows and an edited string out. The `EditorSuggest`
 * around it (`CalloutMetadataSuggest.ts`) only reads the line and writes the
 * result back, so every rule here is testable without an editor.
 *
 * ## The rows
 *
 * - **Colours** — the user's palettes, Obsidian's colours and the extra
 *   presets, together. None for a callout the theme owns, which no metadata
 *   colour reaches.
 * - **The styling's own words** — what the active theme and enabled snippets
 *   react to (`themeMetadataScan.ts`), minus any that could not work where
 *   the cursor is: an `alone` word next to other words, a `first` word
 *   anywhere but first, a word tied to another callout.
 *
 * Each group — the colours, each theme or snippet — is sorted on its own:
 * prefix matches before matches inside a word, then A→Z by the word written.
 * - **Done** — on an empty word after a separator, at the top, so Enter there
 *   finishes the header instead of breaking the line inside `[!…]`.
 * - **Use "…"** — when the typed word matches no row exactly, so Enter can keep
 *   a word of the user's own (another plugin's `50`, say). At the bottom while
 *   some row starts with what was typed; on top when none does, since Enter
 *   takes the top row and a match inside a longer word is no completion.
 *
 * The styling's words are grouped by the theme or snippet they come from, so
 * the dropdown can put each group under one heading (`metadataRowHeadings`).
 * Matching forgives the joints of a name: `comicr`, and `comic re` typed with
 * a space where the dash goes, both find `comic-red`.
 *
 * Colours lead until the metadata already names one; after that the styling's
 * words lead, and every colour row *replaces* the colour already there instead
 * of adding a second — two colours resolve by a fixed order nobody should
 * have to learn (see `utils/calloutMetadata.ts`).
 */
import {
	entryWords,
	foldMetadataCase,
	isMetadataSeparator,
	metadataWords,
	type MetadataColorEntry,
	type MetadataWord,
} from "../utils/calloutMetadata";
import {
	wordAppliesTo,
	type ThemeMetadataWord,
} from "../manager/theme/themeMetadataScan";
import type { MetadataWordSource } from "../manager/theme/ThemeMetadataCatalog";
import { textComparator } from "../utils/sorting";

/** The word under the cursor, inside one token's metadata. */
export interface MetadataSlot {
	/** The metadata: from just past the first `|` to the `]` or end of line. */
	metadata: string;
	/** Where the word under the cursor starts, relative to `metadata`. */
	wordFrom: number;
	/** Where it ends — the whole word, not just up to the cursor. */
	wordTo: number;
	/** The word up to the cursor: what the rows are filtered by. */
	query: string;
}

export type MetadataSuggestion =
	| { kind: "finish" }
	| { kind: "typed"; text: string }
	| {
			kind: "color";
			entry: MetadataColorEntry;
			/** The alias the query matched, when it was not the canonical word. */
			viaAlias: string | null;
			/** The colour word already in the metadata that this one replaces. */
			replaces: MetadataWord | null;
			/** The active styling reacts to this word too. */
			themeAlso: boolean;
			/** As on a theme row, below. */
			joinedFrom?: number;
	  }
	| {
			kind: "theme";
			word: ThemeMetadataWord;
			source: string;
			/**
			 * Where a name typed with spaces for its dashes starts (`comic re`
			 * for `comic-red`): the pick replaces from here, not only the word
			 * under the cursor.
			 */
			joinedFrom?: number;
	  };

/** The word under `cursor` (relative to `metadata`), and the query up to it. */
export function slotAt(metadata: string, cursor: number): MetadataSlot {
	let wordFrom = cursor;
	while (wordFrom > 0 && !isMetadataSeparator(metadata[wordFrom - 1] ?? "")) wordFrom--;
	let wordTo = cursor;
	while (wordTo < metadata.length && !isMetadataSeparator(metadata[wordTo] ?? "")) wordTo++;
	return { metadata, wordFrom, wordTo, query: metadata.slice(wordFrom, cursor) };
}

export interface SuggestionInput {
	slot: MetadataSlot;
	/** The callout's type as written, for words tied to one callout. */
	calloutId: string;
	/** The theme owns this callout: no metadata colour reaches it. */
	themeOwned: boolean;
	/** Every colour, weakest first (`metadataColorEntries`). */
	colors: readonly MetadataColorEntry[];
	sources: readonly MetadataWordSource[];
	/** For sorting each group A→Z. */
	locale: string;
}

/** A name with its dashes, underscores and spaces gone: `Comic Red` → `comicred`. */
const loose = (text: string): string => text.toLowerCase().replace(/[-_\s]+/g, "");

/**
 * 0 for a prefix match, 1 for a match elsewhere, null for none.
 *
 * Forgiving about the joints of a name: `comicr`, `comic_r` and `comic-r` all
 * find `comic-red`, since the dash is the one part of a palette's word the user
 * never typed in its name.
 */
function rankOf(candidates: readonly string[], query: string): number | null {
	if (query === "") return 0;
	const q = query.toLowerCase();
	const lq = loose(query);
	let best: number | null = null;
	for (const c of candidates) {
		const text = c.toLowerCase();
		const lc = loose(c);
		if (text.startsWith(q) || (lq !== "" && lc.startsWith(lq))) return 0;
		if (text.includes(q) || (lq !== "" && lc.includes(lq))) best = 1;
	}
	return best;
}

/** Whether the styling would also react to `word` written as a whole word. */
function stylingReactsTo(
	word: string,
	words: readonly ThemeMetadataWord[],
): boolean {
	return words.some((w) =>
		w.placement === "anywhere" ? word.includes(w.word) : word === w.word,
	);
}

/** The most words a name typed with spaces for its dashes may run across. */
const MAX_JOINED_WORDS = 4;

/**
 * One way to read what is being typed. The plain reading is the word under the
 * cursor. A *joined* one also takes in the words just before it, when only
 * spaces part them: `comic re` is the start of `comic-red` typed the way its
 * palette is named, even though a space ends a word everywhere else here. A
 * `|` is a separator the user chose, so it is never read across.
 */
interface Reading {
	/** Where the word being typed starts, relative to the metadata. */
	from: number;
	query: string;
	/** Every word outside the one being typed. */
	others: MetadataWord[];
	joined: boolean;
}

function readingsOf(slot: MetadataSlot): Reading[] {
	const words = metadataWords(slot.metadata);
	const outside = (from: number) =>
		words.filter((w) => w.to <= from || w.from >= slot.wordTo);
	const readings: Reading[] = [
		{ from: slot.wordFrom, query: slot.query, others: outside(slot.wordFrom), joined: false },
	];
	if (slot.query === "") return readings;
	const cursor = slot.wordFrom + slot.query.length;
	const before = words.filter((w) => w.to <= slot.wordFrom).reverse();
	let from = slot.wordFrom;
	for (const w of before.slice(0, MAX_JOINED_WORDS - 1)) {
		if (!/^\s+$/.test(slot.metadata.slice(w.to, from))) break;
		from = w.from;
		readings.push({
			from,
			query: slot.metadata.slice(from, cursor).replace(/\s+/g, "-"),
			others: outside(from),
			joined: true,
		});
	}
	return readings;
}

/** The colour a reading's other words already name — the strongest, as the stylesheet has it. */
function namedColor(
	reading: Reading,
	colors: readonly MetadataColorEntry[],
): { entry: MetadataColorEntry; word: MetadataWord } | null {
	for (const entry of [...colors].reverse()) {
		const word = reading.others.find((w) => entryWords(entry).includes(foldMetadataCase(w.text)));
		if (word) return { entry, word };
	}
	return null;
}

/**
 * The best reading a row matches by: the longest joined one that the row
 * *starts* with (ranked ahead of everything, as the user typed more of it),
 * else the plain one.
 */
function bestReading<T>(
	readings: readonly Reading[],
	match: (reading: Reading) => (T & { rank: number }) | null,
): { reading: Reading; hit: T & { rank: number } } | null {
	for (let i = readings.length - 1; i > 0; i--) {
		const reading = readings[i];
		const hit = reading ? match(reading) : null;
		if (reading && hit && hit.rank === 0) return { reading, hit: { ...hit, rank: -1 } };
	}
	const plain = readings[0];
	const hit = plain ? match(plain) : null;
	return plain && hit ? { reading: plain, hit } : null;
}

export function buildMetadataSuggestions(input: SuggestionInput): MetadataSuggestion[] {
	const { slot, colors } = input;
	const readings = readingsOf(slot);
	const plain = readings[0] as Reading;
	const query = slot.query;
	const joinedFrom = (reading: Reading) => (reading.joined ? { joinedFrom: reading.from } : {});

	// The styling's words that could work where `reading` puts the word.
	const usableIn = (reading: Reading) => {
		const isFirst = !reading.others.some((w) => w.to <= reading.from);
		const usable: Array<{ word: ThemeMetadataWord; source: string }> = [];
		const seen = new Set<string>();
		for (const source of input.sources) {
			for (const word of source.words) {
				if (seen.has(word.word)) continue;
				seen.add(word.word);
				if (!wordAppliesTo(word, input.calloutId)) continue;
				if (word.placement === "alone" && reading.others.length > 0) continue;
				if (word.placement === "first" && !isFirst) continue;
				usable.push({ word, source: source.label });
			}
		}
		return usable;
	};
	const stylingWords = usableIn(plain).map((u) => u.word);

	/** `word` is what the row writes and shows — what A→Z goes by. */
	type Ranked<T> = { rank: number; group: number; word: string; row: T };
	const colorRows: Array<Ranked<MetadataSuggestion>> = [];
	if (!input.themeOwned) {
		const named = readings.map((r) => namedColor(r, colors));
		for (const entry of colors) {
			const best = bestReading(readings, (reading) => {
				if (named[readings.indexOf(reading)]?.entry === entry) return null;
				const rank = rankOf([entry.key, entry.palette.name], reading.query);
				const aliasRank = rankOf(entry.aliases, reading.query);
				if (rank === null && aliasRank === null) return null;
				const viaAlias =
					rank === null || (aliasRank !== null && aliasRank < rank)
						? (entry.aliases.find((a) => rankOf([a], reading.query) !== null) ?? null)
						: null;
				return { rank: Math.min(rank ?? 2, aliasRank ?? 2), viaAlias };
			});
			if (!best) continue;
			colorRows.push({
				rank: best.hit.rank,
				group: 0,
				word: entry.key,
				row: {
					kind: "color",
					entry,
					viaAlias: best.hit.viaAlias,
					replaces: named[readings.indexOf(best.reading)]?.word ?? null,
					themeAlso: stylingReactsTo(entry.key, stylingWords),
					...joinedFrom(best.reading),
				},
			});
		}
	}
	const colorWords = new Set(
		colorRows.flatMap((r) => (r.row.kind === "color" ? [r.row.entry.key] : [])),
	);

	const themeRows: Array<Ranked<MetadataSuggestion>> = [];
	const sourceOrder = input.sources.map((s) => s.label);
	const usableByReading = readings.map((r) => usableIn(r));
	const candidates = [
		...new Map(usableByReading.flat().map((u) => [u.word, u] as const)).values(),
	];
	for (const { word, source } of candidates) {
		// The colour row for the same word already says the theme reacts too.
		if (colorWords.has(word.word)) continue;
		const best = bestReading(readings, (reading) => {
			const i = readings.indexOf(reading);
			if (!usableByReading[i]?.some((u) => u.word === word)) return null;
			if (reading.others.some((w) => w.text === word.word)) return null;
			const rank = rankOf([word.word], reading.query);
			return rank === null ? null : { rank };
		});
		if (!best) continue;
		themeRows.push({
			rank: best.hit.rank,
			// Grouped by where the word comes from, so each source sits under one heading.
			group: sourceOrder.indexOf(source),
			word: word.word,
			row: { kind: "theme", word, source, ...joinedFrom(best.reading) },
		});
	}

	// Each group A→Z on its own, after how well the row matched: typing `re`
	// keeps `red` above `green`.
	const compare = textComparator(input.locale);
	const byRank = <T>(rows: Array<Ranked<T>>): T[] =>
		rows
			.map((r, i) => ({ ...r, i }))
			.sort(
				(a, b) =>
					a.group - b.group ||
					a.rank - b.rank ||
					compare(a.word, b.word) ||
					a.i - b.i,
			)
			.map((r) => r.row);
	const groups = namedColor(plain, colors)
		? [...byRank(themeRows), ...byRank(colorRows)]
		: [...byRank(colorRows), ...byRank(themeRows)];

	const rows: MetadataSuggestion[] = [];
	if (query === "" && plain.others.length > 0) rows.push({ kind: "finish" });
	rows.push(...groups);
	if (query !== "") {
		const folded = foldMetadataCase(query);
		const exact =
			rows.some(
				(r) =>
					(r.kind === "color" && entryWords(r.entry).includes(folded)) ||
					(r.kind === "theme" && r.word.word === query),
			) || plain.others.some((w) => foldMetadataCase(w.text) === folded);
		if (!exact) {
			// Enter takes the top row. When no row even starts with what was
			// typed — it only turns up inside longer words — the user's own word
			// goes on top, so Enter keeps `50` instead of writing `width-50`.
			const startsSomeRow = [...colorRows, ...themeRows].some((r) => r.rank <= 0);
			const typed: MetadataSuggestion = { kind: "typed", text: query };
			if (startsSomeRow) rows.push(typed);
			else rows.unshift(typed);
		}
	}
	return rows;
}

/** What a row is listed under: the colours, or the theme or snippet a word comes from. */
export type MetadataRowHeading = { kind: "colors" } | { kind: "source"; label: string };

/**
 * The heading to draw above each row — only on the first row of a group, and
 * only when the rows come from two groups or more: a lone heading names
 * nothing the rows don't already say. **Done** and **Use "…"** belong to none.
 */
export function metadataRowHeadings(
	rows: readonly MetadataSuggestion[],
): Array<MetadataRowHeading | null> {
	const keyOf = (row: MetadataSuggestion): string | null =>
		row.kind === "color" ? "colors" : row.kind === "theme" ? `source:${row.source}` : null;
	const keys = rows.map(keyOf);
	if (new Set(keys.filter((k) => k !== null)).size < 2) return rows.map(() => null);
	let last: string | null = null;
	return rows.map((row, i) => {
		const key = keys[i] ?? null;
		if (key === null || key === last) return null;
		last = key;
		return row.kind === "theme" ? { kind: "source", label: row.source } : { kind: "colors" };
	});
}

/** The metadata after a pick, and where in it the cursor goes. */
export interface MetadataEdit {
	metadata: string;
	/** Just past the word the pick wrote (or kept), relative to `metadata`. */
	cursor: number;
}

const isSep = (ch: string | undefined): boolean =>
	ch !== undefined && isMetadataSeparator(ch);

/**
 * What picking `row` does to the slot's metadata.
 *
 * - **Done** drops the separator the user just typed when nothing follows it,
 *   so `[!mark|pink ]` finishes as `[!mark|pink]`.
 * - **Use "…"** changes nothing.
 * - **A styling word** replaces the word under the cursor — or, for a name
 *   typed with spaces for its dashes, every word of it (`joinedFrom`). A `spaced` word —
 *   one the stylesheet matches with `~=` — also turns a `|` touching it into
 *   a space, since that operator never sees across a pipe. The first `|`, the
 *   one after the type, is not in the metadata and is never touched.
 * - **A colour** replaces the word under the cursor, or — when the metadata
 *   already names a colour — takes that colour's place instead, and the word
 *   under the cursor goes, with the separator before it.
 */
export function applyMetadataPick(
	slot: MetadataSlot,
	row: MetadataSuggestion,
): MetadataEdit {
	const m = slot.metadata;
	const to = slot.wordTo;
	const from =
		(row.kind === "color" || row.kind === "theme") && row.joinedFrom !== undefined
			? row.joinedFrom
			: slot.wordFrom;

	if (row.kind === "finish") {
		// A word still follows the cursor: the metadata is finished as it stands.
		if (/[^\s|]/.test(m.slice(from))) return { metadata: m, cursor: to };
		const kept = m.slice(0, from).replace(/[\s|]+$/, "");
		return { metadata: kept, cursor: kept.length };
	}
	if (row.kind === "typed") return { metadata: m, cursor: to };

	if (row.kind === "theme") {
		const text = row.word.word;
		let out = m.slice(0, from) + text + m.slice(to);
		const end = from + text.length;
		if (row.word.placement === "spaced") {
			if (out[from - 1] === "|") out = `${out.slice(0, from - 1)} ${out.slice(from)}`;
			if (out[end] === "|") out = `${out.slice(0, end)} ${out.slice(end + 1)}`;
		}
		return { metadata: out, cursor: end };
	}

	const text = row.entry.key;
	const old = row.replaces;
	if (!old) {
		return { metadata: m.slice(0, from) + text + m.slice(to), cursor: from + text.length };
	}
	// Two edits, applied right to left so neither shifts the other: the old
	// colour becomes the new one, and the word under the cursor leaves with
	// the separator run in front of it (or behind it, when it is the first).
	let cutFrom = from;
	while (cutFrom > 0 && isSep(m[cutFrom - 1])) cutFrom--;
	let cutTo = to;
	if (cutFrom === 0) {
		cutFrom = from;
		while (cutTo < m.length && isSep(m[cutTo])) cutTo++;
	}
	const edits = [
		{ from: old.from, to: old.to, text },
		{ from: cutFrom, to: cutTo, text: "" },
	].sort((a, b) => b.from - a.from);
	let out = m;
	for (const e of edits) out = out.slice(0, e.from) + e.text + out.slice(e.to);
	const shift = old.from > cutFrom ? cutTo - cutFrom : 0;
	return { metadata: out, cursor: old.from - shift + text.length };
}
