/**
 * web/static/gardenNote.ts — the note that carries a user's callouts to a
 * Digital Garden: its name, its property, its body, and how each is read back.
 *
 * A garden is built on a server from the garden's repository, never from the
 * vault, and the only thing that crosses from one to the other is what the
 * Digital Garden plugin publishes: notes marked `dg-publish`, and their
 * pictures. So the user's callouts travel as a note. Callout Studio writes it
 * (`manager/web/writeTarget.ts`); the user publishes it like any other note;
 * the Callout Studio garden plugin (`web/static/garden.ts`) reads it while the
 * garden is built, draws the callouts with it, and keeps it off the site.
 *
 * Both readers import this file, which is why it is in `web/static/`: the
 * garden plugin is built from this folder only, and Obsidian's side may import
 * anything. It must stay pure — no Obsidian, no Node, no `require()`. The
 * note's shape is shared with Quartz's (`webNote.ts`); what is the garden's is
 * here: its name, its property, its words, and `dg-publish`.
 *
 * **How the note is recognised.** By its `callout-studio-web` property, on
 * both sides. Obsidian finds it in the metadata cache wherever the user moved
 * it; the Digital Garden plugin publishes every property the user set, nested
 * under `dg-note-properties`, so the build finds the same key there. The value
 * is the format of the note, so a garden plugin can refuse one written by a
 * later Callout Studio rather than misread it.
 *
 * **Why the data is base64 in a code block.** Digital Garden rewrites a note on
 * its way to the repository — links, embeds, comments, block ids, highlights.
 * It leaves code blocks alone, and base64 has nothing any of those steps could
 * match even if one did not. A fingerprint of the data rides beside it, so a
 * note that was edited by hand — or damaged on the way — is recognised as such
 * on both sides instead of being drawn wrong.
 *
 * Every byte is fixed for a given set of callouts: no timestamp, no language.
 * Two devices with the same callouts write the same note, and a sync never
 * sees a change that is not one.
 */
import {
	buildNoteBody,
	noteFormat,
	readNoteBody,
	splitFrontmatter,
	type WebNoteKind,
	type WebNoteData,
} from "./webNote";

/** The property that marks the note, on both sides. */
export const GARDEN_NOTE_KEY = "callout-studio-web";

/** What this version writes as the property's value, and the newest it reads. */
export const GARDEN_NOTE_FORMAT = 1;

/** Where the note is written the first time, from the top of the vault. */
export const GARDEN_NOTE_PATH = `${GARDEN_NOTE_KEY}.md`;

/** Where the garden plugin serves the stylesheet the note carries. */
export const GARDEN_STYLESHEET_URL = "/plugins/callout-studio/callout-studio.css";

/**
 * What the note says to whoever opens it: a heading that asks to be read,
 * then what it is, what not to do with it, and what one may do — three
 * callouts, since `%%` comments do not survive Digital Garden and a callout is
 * what a note has for this. The other generated files answer the same three
 * questions in their header comment (`manager/web/targets.ts`).
 *
 * English in every language, like those headers: a note that changed with the
 * UI language would be rewritten, and synced, every time it changed.
 */
export const GARDEN_NOTE_INTRO: readonly string[] = [
	"# READ THIS",
	"",
	"> [!question] What does this file contain?",
	"> This file holds all the settings and styles for your callouts so they display properly on your site.",
	">",
	"> It updates automatically whenever you add, edit, or delete a callout. After making changes, republish this note through the **Publication Center** to see the updates on your site. You might need to do a hard refresh in your browser.",
	"",
	"> [!failure] What not to do",
	"> - **Don't uncheck `dg-publish` in Properties.** Don't worry - visitors won't actually see this page on your live site.",
	"> - **Don't delete or change `callout-studio-web` in Properties**, and don't use it in any other files.",
	"> - **Don't edit this file directly.** There's no point, as Callout Studio overwrites everything here the next time Obsidian starts or you change a callout.",
	"",
	"> [!success] What you can do",
	"> - Rename this file to whatever you like.",
	"> - Move it to any folder in your vault.",
];

/** The properties of a note Callout Studio creates. Kept as they are after that. */
export function newGardenNoteFrontmatter(): string {
	return `---\ndg-publish: true\n${GARDEN_NOTE_KEY}: ${GARDEN_NOTE_FORMAT}\n---\n`;
}

/** The garden's kind of note (`webNote.ts`): its property, its format, its words. */
export const GARDEN_NOTE: WebNoteKind = {
	key: GARDEN_NOTE_KEY,
	format: GARDEN_NOTE_FORMAT,
	intro: GARDEN_NOTE_INTRO,
};

/** What a note's code block says: the data as text, and the fingerprint it claims. */
export type GardenNoteData = WebNoteData;

export { splitFrontmatter };

/** The garden note's body: the three callouts, then the data (`webNote.buildNoteBody`). */
export const buildGardenNoteBody = (fingerprint: string, json: string): string =>
	buildNoteBody(GARDEN_NOTE, fingerprint, json);

/** The data block of a garden note's body, decoded, or `null` (`webNote.readNoteBody`). */
export const readGardenNoteBody = (body: string): GardenNoteData | null => readNoteBody(GARDEN_NOTE_KEY, body);

/**
 * The note's format, read off its properties block — `null` when the block
 * does not carry the property, which means the note is not ours
 * (`webNote.noteFormat`, which also reads Digital Garden's JSON spelling).
 */
export const gardenNoteFormat = (frontmatter: string | null): number | null => noteFormat(GARDEN_NOTE, frontmatter);
