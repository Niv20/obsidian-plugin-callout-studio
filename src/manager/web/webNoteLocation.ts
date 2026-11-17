/**
 * manager/web/webNoteLocation.ts — which note in the vault is the one that
 * carries the callouts to a site: the Digital Garden note, or the Quartz one.
 *
 * A note is recognised by its property (`callout-studio-web`,
 * `callout-studio-quartz`), not by its name (`web/static/webNote.ts`), so the
 * user may move or rename it and Callout Studio keeps writing that one. The
 * metadata cache answers "which notes have it" for the whole vault without
 * reading a single file. It lags a write by a moment, though, so the note at
 * the usual path is also read directly: a note written a second ago must not
 * look missing, or the next write would make a second one.
 *
 * When several notes have the property, the one at the usual path wins, then
 * the first by path — the same order the site's plugin reads them in
 * (`web/static/garden.ts`, `web/static/quartz.ts`), so both sides agree on
 * which one counts. The others are reported.
 *
 * **Which of the others are copies.** A sync service that meets two versions
 * of the note keeps both, one under a name of its own ("… (Conflicted copy
 * …)"), and that name can sort before the note's: for a note the user
 * renamed, the copy is then the one that counts here, and the site — which
 * sees only the notes that were published — may be reading the other. So a
 * note that carries the property *and* a data block of ours is kept current
 * too ({@link webNoteCopies}), and whichever the site reads is right. A note
 * that has the property and no data block is not one this plugin wrote; it
 * stays reported and never touched.
 */
import { normalizePath, type App } from "obsidian";
import { noteFormat, readNoteBody, splitFrontmatter, type WebNoteKind } from "../../web/static/webNote";

export interface WebNoteLocation {
	/** The note to write: the one found, or the usual path when there is none. */
	path: string;
	/** A note with the property is at {@link path}. */
	found: boolean;
	/** Other notes with the property. Left as they are. */
	others: string[];
}

/** The usual path first, then by path. */
const byPreference =
	(usual: string) =>
	(a: string, b: string): number =>
		a === usual ? -1 : b === usual ? 1 : a < b ? -1 : a > b ? 1 : 0;

/** Where `kind`'s note is, or would be written: `usual` when there is none. */
export async function locateWebNote(app: App, kind: WebNoteKind, usualPath: string): Promise<WebNoteLocation> {
	const usual = normalizePath(usualPath);
	const paths = new Set<string>();
	// Optional on purpose: a vault stand-in in a test may have neither.
	for (const file of app.vault.getMarkdownFiles?.() ?? []) {
		const frontmatter = app.metadataCache?.getFileCache(file)?.frontmatter;
		if (frontmatter && Object.prototype.hasOwnProperty.call(frontmatter, kind.key)) paths.add(file.path);
	}
	if (!paths.has(usual)) {
		try {
			if (await app.vault.adapter.exists(usual)) {
				const text = await app.vault.adapter.read(usual);
				if (noteFormat(kind, splitFrontmatter(text).frontmatter) !== null) paths.add(usual);
			}
		} catch {
			// Unreadable: not counted, and the write that follows will say so.
		}
	}
	const [first, ...others] = [...paths].sort(byPreference(usual));
	return first === undefined ? { path: usual, found: false, others: [] } : { path: first, found: true, others };
}

/**
 * Those of `paths` that are copies of `kind`'s note: the property, and a data
 * block as this plugin writes one. Its body is ours by the same rule as the
 * note's own — it says so itself, in the same words.
 */
export async function webNoteCopies(app: App, kind: WebNoteKind, paths: readonly string[]): Promise<string[]> {
	const copies: string[] = [];
	for (const path of paths) {
		try {
			const { frontmatter, body } = splitFrontmatter(await app.vault.adapter.read(normalizePath(path)));
			if (noteFormat(kind, frontmatter) !== null && readNoteBody(kind.key, body) !== null) copies.push(path);
		} catch {
			// Unreadable: not a copy this refresh can vouch for.
		}
	}
	return copies;
}
