/**
 * web/static/quartzNote.ts — the note that carries a user's callouts to a
 * Quartz site: its name, its property, its words and its properties.
 *
 * Quartz builds a site from its content folder, and notes get there in more
 * ways than one: the vault *is* that folder (a terminal, Git, Obsidian Git),
 * a plugin copies only the notes the user chose (Quartz Syncer, Enveloppe and
 * others), or a sync service brings the vault to a server that builds it
 * (Obsidian Sync, Obsidian Headless). A note is the one thing all of them
 * carry — a file in a folder whose name starts with a period is not: the
 * plugins publish notes only, and Obsidian Sync skips such folders. So the
 * callouts travel as a note, shaped like the Digital Garden one
 * (`webNote.ts`). Callout Studio writes it (`manager/web/writeTarget.ts`), and
 * the Callout Studio Quartz plugin (`quartz.ts`) finds it while the site is
 * built, draws the callouts with it, and keeps it off the site. Until
 * 2026-11-17 this was `.callout-studio/quartz.json`, which reached a build
 * only on the first of those ways.
 *
 * **How the site finds it.** By its code block, whose info string is the
 * property's name: a plugin that copies notes may drop properties it does not
 * know (Quartz Syncer keeps a short list), and a code block is left alone by
 * all of them. The name is only the quick way: the Quartz plugin looks for a
 * file of that name first, and for the code block in every note only when
 * there is none.
 *
 * **How it stays off the site.** Three ways, so that no one of them has to
 * hold alone:
 *
 * - `draft: true` among its properties. Quartz 4 and 5 publish no draft by
 *   default, so this holds before the Quartz plugin is installed, and Quartz
 *   Syncer passes `draft` through.
 * - The Quartz plugin marks it a draft, and not for publishing, while the site
 *   is built — for a tool that dropped the property (Pressroom keeps only
 *   title, tags, date and description), and for a Quartz 4 site that
 *   publishes only notes with `publish: true`, which Quartz Syncer's own
 *   property would otherwise satisfy.
 * - On Quartz 5, the plugin is a filter too, which drops the note even on a
 *   site that publishes its drafts on purpose.
 *
 * Pure, like everything in `web/static/`: the Quartz plugin is built from
 * this folder.
 */
import type { WebNoteKind } from "./webNote";

/** The property that marks the note in the vault, and the info string of its code block. */
export const QUARTZ_NOTE_KEY = "callout-studio-quartz";

/** What this version writes as the property's value, and the newest it reads. */
export const QUARTZ_NOTE_FORMAT = 1;

/** The note's name, and where it is written the first time, from the top of its folder. */
export const QUARTZ_NOTE_NAME = `${QUARTZ_NOTE_KEY}.md`;

/**
 * What the note says to whoever opens it, as the Digital Garden note does
 * (`gardenNote.ts`): a heading that asks to be read, then what it is, what not
 * to do with it, and what one may do. Fixed, and English in every language,
 * for the same reason: the same callouts must always write the same note.
 */
export const QUARTZ_NOTE_INTRO: readonly string[] = [
	"# READ THIS",
	"",
	"> [!question] What does this file contain?",
	"> This file holds all the settings and styles for your callouts so the Callout Studio Quartz plugin can display them properly on your site.",
	">",
	"> It updates automatically whenever you add, edit, or delete a callout. Your next build picks it up. If a plugin such as Quartz Syncer publishes your notes, publish this note again after a change. You might need to do a hard refresh in your browser.",
	"",
	"> [!failure] What not to do",
	"> - **Don't remove `draft: true` from Properties.** It keeps this page off your site. Don't worry - visitors won't see it.",
	"> - **Don't delete or change `callout-studio-quartz` in Properties**, and don't use it in any other files.",
	"> - **Don't edit this file directly.** There's no point, as Callout Studio overwrites everything here the next time Obsidian starts or you change a callout.",
	"",
	"> [!success] What you can do",
	"> - Rename this file to whatever you like.",
	"> - Move it to any folder that is published to your site.",
];

/** Quartz's kind of note (`webNote.ts`). */
export const QUARTZ_NOTE: WebNoteKind = {
	key: QUARTZ_NOTE_KEY,
	format: QUARTZ_NOTE_FORMAT,
	intro: QUARTZ_NOTE_INTRO,
};

/**
 * The properties of a note Callout Studio creates; kept as they are after
 * that. `markers` are the properties a publishing plugin publishes a note by
 * (Quartz Syncer's `publish`, Enveloppe's `share`), set to `true` so the note
 * goes with the user's other notes without a click in Properties.
 */
export function newQuartzNoteFrontmatter(markers: readonly string[] = []): string {
	const extra = [...new Set(markers)].filter((key) => key && key !== "draft" && key !== QUARTZ_NOTE_KEY);
	const lines = [
		"draft: true",
		...extra.map((key) => `${yamlKey(key)}: true`),
		`${QUARTZ_NOTE_KEY}: ${QUARTZ_NOTE_FORMAT}`,
	];
	return `---\n${lines.join("\n")}\n---\n`;
}

/** A property name as YAML takes it: bare where it can be, quoted where it must. */
const yamlKey = (key: string): string => (/^[A-Za-z_][\w-]*$/.test(key) ? key : JSON.stringify(key));
