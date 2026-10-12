/**
 * utils/calloutMetadata.ts — reading the `|metadata` half of a callout token.
 *
 * `calloutId.ts` splits `[!type|metadata]` at the first pipe and hands the
 * right half on verbatim. This module is what *reads* that half: it cuts it
 * into words and decides which of them name a colour, so `> [!mark|pink]` can
 * paint that one callout pink while every other `mark` keeps its own colour.
 *
 * ## Words, and what separates them
 *
 * Two conventions are in the wild and both must work:
 *
 * - **Spaces** — ITS Theme and the themes built on it match metadata with
 *   `[data-callout-metadata~=word]`, a whitespace-separated word list:
 *   `[!note|c-red wide]`.
 * - **Pipes** — the Callout Metadata plugin splits on `|` only:
 *   `[!note|50|orange|center]`.
 *
 * So any run of whitespace and/or pipes separates two words, and
 * `pink right`, `pink|right` and ` pink | right ` are the same two words.
 * A comma is NOT a separator: `pink,` is one word that names nothing.
 *
 * ## Which words are colours
 *
 * Three sources, all spelled as stable lowercase words that do not change
 * with the interface language (the *names* are translated; the words are not):
 *
 * 1. The built-in colours, by preset id — `blue`, `teal`, `bubblegum`, …
 *    ({@link getObsidianPalettes}, {@link getExtraPalettes}).
 * 2. Four aliases for Obsidian's own colour names that have no preset of that
 *    name — see {@link METADATA_COLOR_ALIASES}.
 * 3. The user's saved palettes, by {@link paletteMetadataKey} of their name.
 *
 * Every other word is left alone. It is not ours: it may be a theme's
 * (`wide`, `c-red`), another plugin's (`50`, `shadow`), or a typo, and in each
 * case the right thing for this plugin to do with it is nothing.
 *
 * ## Two colours in one callout
 *
 * The CSS that paints these colours reads the attribute directly — it has to,
 * so the feature also works in an exported snippet where none of our code
 * runs — and CSS cannot tell which of two words came first. So precedence is
 * a fixed order instead of "last written": {@link metadataColorEntries}
 * returns the entries weakest first, the stylesheet emits them in that order
 * at equal specificity, and {@link resolveMetadataColor} (used by the PDF
 * export's baked colours) walks the same list from the strong end. A saved
 * palette beats a built-in Obsidian colour, which beats an extra preset. The
 * autocomplete swaps a colour rather than adding a second one, so this only
 * ever decides a pair somebody typed by hand.
 */
import type { CalloutDefinition, CustomPalette, PluginSettings } from "../types";
import {
	bakePaletteColors,
	customPaletteToColorPalette,
	getExtraPalettes,
	getObsidianPalettes,
	type ColorPalette,
} from "./colorPalettes";

/** One word of a metadata string, with its span inside that string. */
export interface MetadataWord {
	text: string;
	/** Offset of the first character, relative to the metadata string. */
	from: number;
	/** Offset just past the last character. */
	to: number;
}

/** A word is a run of anything that is neither whitespace nor a pipe. */
const WORD_RE = /[^\s|]+/g;

/** True for the characters that separate two metadata words. */
export const isMetadataSeparator = (ch: string): boolean =>
	ch === "|" || /^\s$/.test(ch);

/**
 * The words of a metadata string, in order, with their offsets — the offsets
 * are what the autocomplete replaces when it swaps one word for another.
 */
export function metadataWords(metadata: string): MetadataWord[] {
	const words: MetadataWord[] = [];
	for (const match of metadata.matchAll(WORD_RE)) {
		const from = match.index ?? 0;
		words.push({ text: match[0], from, to: from + match[0].length });
	}
	return words;
}

/**
 * Lowercase ASCII letters only. Comparison has to agree with the stylesheet,
 * whose `[attr~="v" i]` flag folds ASCII case and nothing else — a JS
 * `toLowerCase()` here would let the PDF export colour a callout that the
 * screen leaves alone.
 */
export const foldMetadataCase = (word: string): string =>
	word.replace(/[A-Z]/g, (c) => c.toLowerCase());

/**
 * Obsidian's own colour names that have no Callout Studio preset of the same
 * name, mapped to the preset that stands in for them. `purple` is exact —
 * Violet carries Obsidian's purple hexes — and the other three are the
 * nearest preset. Accepted when typed; the autocomplete writes the preset's
 * own id, so a note written through the menu never depends on an alias.
 */
export const METADATA_COLOR_ALIASES: Readonly<Record<string, string>> = {
	purple: "violet",
	pink: "bubblegum",
	yellow: "amber",
	grey: "gray",
};

/**
 * The word that names a saved palette in metadata: its name in kebab-case.
 *
 * NFKC first, so full-width and compatibility forms meet their plain
 * spelling; then whitespace, `_` and `|` become `-`, anything that is not a
 * letter, mark, digit or dash is dropped, and dash runs collapse. Letters of
 * every script survive, so "ורוד בהיר" names itself `ורוד-בהיר`. Returns ""
 * for a name with no usable character (all emoji, say) — that palette simply
 * has no metadata word.
 */
export function paletteMetadataKey(name: string): string {
	return name
		.normalize("NFKC")
		.toLowerCase()
		.replace(/[\s_|]+/g, "-")
		.replace(/[^\p{L}\p{M}\p{N}-]/gu, "")
		.replace(/-+/g, "-")
		.replace(/^-|-$/g, "");
}

/** One colour that metadata can name. */
export interface MetadataColorEntry {
	/** The canonical word — what the autocomplete writes. Lowercase. */
	key: string;
	/** Other words for the same colour (the built-in aliases). Lowercase. */
	aliases: string[];
	/** The colours this word paints. */
	palette: ColorPalette;
}

/**
 * Every colour metadata can name, **weakest first** — the order the
 * stylesheet emits them in, so a later entry wins a tie on source order.
 *
 * A word belongs to exactly one entry. When two claim it, the stronger keeps
 * it and the weaker loses that word; an entry left with no word at all is
 * dropped, since nothing could reach it. In practice that means a palette the
 * user named "Pink" takes `pink` from Bubblegum's alias, and one named "Blue"
 * (possible under a non-English interface, where the preset is not called
 * that) takes `blue` from the preset. Between two saved palettes the later one
 * in the list wins — the palette editor refuses to create such a pair, so
 * only older or imported data ever has one.
 */
export function metadataColorEntries(
	customPalettes: readonly CustomPalette[],
): MetadataColorEntry[] {
	const aliasesOf = (id: string): string[] =>
		Object.entries(METADATA_COLOR_ALIASES)
			.filter(([, target]) => target === id)
			.map(([alias]) => alias);
	const candidates: MetadataColorEntry[] = [
		...getExtraPalettes().map((palette) => ({
			key: palette.id,
			aliases: aliasesOf(palette.id),
			palette,
		})),
		...getObsidianPalettes().map((palette) => ({
			key: palette.id,
			aliases: aliasesOf(palette.id),
			palette,
		})),
		...customPalettes.map((p) => ({
			key: paletteMetadataKey(p.name),
			aliases: [],
			palette: customPaletteToColorPalette(p),
		})),
	];

	const claimed = new Set<string>();
	const kept: MetadataColorEntry[] = [];
	for (const candidate of [...candidates].reverse()) {
		const key = candidate.key && !claimed.has(candidate.key) ? candidate.key : "";
		const aliases = candidate.aliases.filter((a) => !claimed.has(a));
		// The canonical word lost: an alias cannot stand in for it, because the
		// menu would then write a word that paints something else.
		if (!key) continue;
		claimed.add(key);
		for (const alias of aliases) claimed.add(alias);
		kept.push({ ...candidate, key, aliases });
	}
	return kept.reverse();
}

/**
 * The entries in force for these settings — none at all while the hidden
 * `metadataColors` switch is off, which is what keeps every consumer (the
 * stylesheet, the export painters, the `|` suggestions) quiet together.
 */
export function activeMetadataColorEntries(
	settings: Pick<PluginSettings, "metadataColors" | "customPalettes">,
): MetadataColorEntry[] {
	return settings.metadataColors.enabled
		? metadataColorEntries(settings.customPalettes)
		: [];
}

/** Every word an entry answers to, canonical first. */
export const entryWords = (entry: MetadataColorEntry): string[] => [
	entry.key,
	...entry.aliases,
];

/**
 * The colour a metadata string names, or null — the strongest entry any of
 * its words matches, which is the one the stylesheet lets win.
 */
export function resolveMetadataColor(
	metadata: string | null | undefined,
	entries: readonly MetadataColorEntry[],
): MetadataColorEntry | null {
	if (!metadata) return null;
	const words = new Set(metadataWords(metadata).map((w) => foldMetadataCase(w.text)));
	if (words.size === 0) return null;
	for (const entry of [...entries].reverse()) {
		if (entryWords(entry).some((word) => words.has(word))) return entry;
	}
	return null;
}

/**
 * `def` as one rendered instance of it actually looks: the metadata's colour
 * baked over the definition's own, exactly as applying that palette in the
 * editor would. The definition itself when the metadata names no colour.
 *
 * For the few paths that bake a colour into the DOM instead of leaving it to
 * CSS — the PDF export's icon and per-letter title colours — which would
 * otherwise print the definition's colour under a callout the screen paints
 * in another.
 */
export function definitionWithMetadataColor(
	def: CalloutDefinition,
	metadata: string | null | undefined,
	entries: readonly MetadataColorEntry[],
): CalloutDefinition {
	const entry = resolveMetadataColor(metadata, entries);
	return entry ? { ...def, ...bakePaletteColors(entry.palette) } : def;
}
