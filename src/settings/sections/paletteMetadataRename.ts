/**
 * settings/sections/paletteMetadataRename.ts — carrying a renamed palette's
 * notes along with it.
 *
 * A saved palette is named in callout metadata by its name in kebab-case
 * (`[!mark|comic-red]`, see `utils/calloutMetadata.paletteMetadataKey`), so a
 * rename changes the word — and every callout still written with the old one
 * silently goes back to its own colour. Renaming a callout type asks what
 * should happen to the notes that use it; this is the same question for a
 * palette, asked the same way — by the editor's Save, before anything is
 * saved, in the same window (../PaletteNotesModal.ts) — with the same Undo.
 * Leaving them is a real answer, not a failure: the old word simply stops
 * naming anything.
 *
 * Not offered for a word that means something else as well — a built-in
 * colour's (a palette called "Pink", from before that preset) or one the
 * theme or a snippet styles. Notes using such a word may well mean that other
 * thing, and a rewrite cannot tell which callouts meant the palette. Left
 * alone, they take the other meaning.
 *
 * Deleting a palette makes no such offer, by the rule every Delete here
 * follows: it removes a definition and never touches a note.
 */
import { Notice, type App } from "obsidian";
import { t } from "../../i18n";
import type { CustomPalette } from "../../types";
import { entryWords, foldMetadataCase, metadataColorEntries } from "../../utils/calloutMetadata";
import {
	countMetadataWordUsages,
	replaceMetadataWordInVault,
} from "../../utils/vaultCalloutScanner";
import { NoteRewriteJournal } from "../../utils/noteRewriteUndo";
import { noticeWithUndo } from "../rewriteUndoNotice";
import { PaletteNotesModal, type PaletteNotesModalInput } from "../PaletteNotesModal";
import type { MetadataWordSource } from "../../manager/theme/ThemeMetadataCatalog";

/**
 * The word a saved palette answers to in metadata right now — `""` when its
 * name yields none, when another palette holds the same word (the later one in
 * the list wins it), or when the user's own snippet styles it (`reserved`).
 */
export function ownedMetadataKey(
	palettes: readonly CustomPalette[],
	paletteId: string,
	reserved?: ReadonlySet<string>,
): string {
	return (
		metadataColorEntries(palettes, reserved).find(
			(e) => e.palette.group === "custom" && e.palette.id === paletteId,
		)?.key ?? ""
	);
}

/** Whether a built-in colour also answers to `word` — its own id, or an alias. */
export function isBuiltInColorWord(word: string): boolean {
	return metadataColorEntries([]).some((e) => entryWords(e).includes(word));
}

/** Whether the theme or a snippet reacts to `word` (ASCII case folded, as matched). */
export function isStylingWord(word: string, sources: readonly MetadataWordSource[]): boolean {
	return sources.some((s) => s.words.some((w) => foldMetadataCase(w.word) === word));
}

/**
 * The word a saved palette answers to in metadata now, and the one it would
 * answer to under `name` — read off the list as it would stand, since the
 * other palettes and the user's snippets decide which words are its.
 */
export function renamedMetadataWords(
	palettes: readonly CustomPalette[],
	paletteId: string,
	name: string,
	reserved?: ReadonlySet<string>,
): { from: string; to: string } {
	const renamed = palettes.map((p) => (p.id === paletteId ? { ...p, name } : p));
	return {
		from: ownedMetadataKey(palettes, paletteId, reserved),
		to: ownedMetadataKey(renamed, paletteId, reserved),
	};
}

/** The palette's notes, moved from the word it answered to onto its new one. */
export interface MetadataRename {
	from: string;
	to: string;
}

export interface AskMetadataRenameInput {
	app: App;
	/** The palette's name before the edit, and the one Save would give it. */
	name: { from: string; to: string };
	/** Its word in metadata before the edit, and after it (`renamedMetadataWords`). */
	word: { from: string; to: string };
	/** Whether a word also means something else — see the module note. */
	sharedWord: (word: string) => boolean;
	/**
	 * Asked once the notes are counted, before the window opens: false when
	 * the palette editor has closed meanwhile, and the question would be about
	 * a save nobody is waiting for any more.
	 */
	stillWanted: () => boolean;
	/** Opens the window; a test answers in its place. */
	open?: (input: PaletteNotesModalInput) => Promise<boolean | null>;
}

/**
 * Before a palette is saved under a new name: when notes still use the word it
 * answered to before, ask what should happen to them. Resolves to the answer —
 * `rewrite` null when the notes stay as they are — or to null for Cancel: back
 * to the editor, nothing saved.
 *
 * Nothing is asked, and the save goes ahead with the notes untouched, when the
 * word did not change, nothing uses it, the notes could not be counted, or the
 * word also means something else (`sharedWord`) — see the module note.
 */
export async function askMetadataRename(
	input: AskMetadataRenameInput,
): Promise<{ rewrite: MetadataRename | null } | null> {
	const { app, word } = input;
	const untouched = { rewrite: null };
	if (!word.from || !word.to || word.from === word.to || input.sharedWord(word.from)) return untouched;

	let usage: { fileCount: number; totalCount: number };
	try {
		usage = await countMetadataWordUsages(app, word.from);
	} catch (error) {
		// The scan already told the user which files it could not read.
		console.warn("[callout-studio] counting a palette's metadata uses was incomplete", error);
		return untouched;
	}
	if (usage.totalCount === 0) return untouched;
	if (!input.stillWanted()) return null;

	const modalInput: PaletteNotesModalInput = {
		name: input.name,
		word,
		reach: { callouts: usage.totalCount, notes: usage.fileCount },
	};
	const change = await (input.open ? input.open(modalInput) : new PaletteNotesModal(app, modalInput).ask());
	if (change === null) return null;
	return { rewrite: change ? { from: word.from, to: word.to } : null };
}

/** Once the palette is saved: rewrite its notes onto the new word, with Undo. */
export async function applyMetadataRename(app: App, rename: MetadataRename): Promise<void> {
	const journal = new NoteRewriteJournal();
	try {
		const updated = await replaceMetadataWordInVault(app, rename.from, rename.to, journal);
		noticeWithUndo(app, t("vault.filesUpdated", { count: String(updated) }), journal);
	} catch (error) {
		console.warn("[callout-studio] rewriting a palette's metadata uses was incomplete", error);
		new Notice(t("palette.renameNotesFailed"), 10000);
	}
}
