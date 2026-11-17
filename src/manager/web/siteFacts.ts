/**
 * manager/web/siteFacts.ts — what the vault says about a service beyond the
 * state of its files: the facts the Publish to the web panel (`webPanel/`)
 * draws some of its steps from.
 *
 * Who calls it. The panel, each time it reads the vault again, beside
 * `writeTarget.webTargetStatus` (are the files there, and current).
 *
 * The main idea. All the panel may look at is the vault (a rule of this
 * project: nothing outside it is read, and no site is asked). So this reads
 * two things, each of which a step hangs on (`webChecklist.ts`):
 *
 * - **Quartz's configuration file**, where it is in the vault: whether it
 *   loads the Quartz plugin (`quartzConfig.ts`), and which generation of Quartz it
 *   is the file of, which the panel then need not ask. It is there only when
 *   the vault is the Quartz repository itself; where the vault is the
 *   `content` folder the answer is `null`, "cannot be seen".
 * - **Whether the note is switched on for publishing**: the Digital Garden
 *   note's `dg-publish: true`, and on Quartz, where a plugin publishes the
 *   user's notes (`notePublisher.ts`), that plugin's own property — and
 *   whether the note is somewhere that plugin publishes from. Neither
 *   publishes any other note, so with it off the rest of the steps lead
 *   nowhere. Read from the note's own text, not from the metadata cache, which
 *   is a moment behind a write.
 *
 * Whether the garden plugin is installed, whether a note was published and
 * whether a Publish site has a custom domain are not in the vault at all.
 * Digital Garden, for one, keeps its list of garden plugins in the site's
 * repository. Until 2026-11-16 night the user ticked those steps by hand,
 * and this also read a fingerprint of what there was to publish, which an
 * "I published it" tick was kept with; the panel has no ticks now.
 *
 * Nothing here writes, and nothing throws: what cannot be read counts as not
 * seen.
 */
import { normalizePath, type App } from "obsidian";
import { splitFrontmatter } from "../../web/static/webNote";
import { publishesFrom, readNotePublisher, type NotePublisher } from "./notePublisher";
import { QUARTZ_CONFIG_FILE, checkQuartzConfig, type QuartzConfigState, type QuartzVersion } from "./quartzConfig";
import type { WebTargetId } from "./targets";

/** Quartz's configuration file, as found in the vault. */
export interface QuartzConfigFacts {
	/** The file's name, as the panel says it. */
	file: string;
	/** The generation of Quartz the file belongs to. */
	version: QuartzVersion;
	state: QuartzConfigState;
}

export interface SiteFacts {
	/**
	 * The note is switched on for publishing: Digital Garden's `dg-publish`, or
	 * the property of the plugin that publishes a Quartz site's notes. True
	 * where there is no such switch, or no note yet.
	 */
	notePublishes: boolean;
	/** Quartz: the note is somewhere the plugin that publishes the notes does not publish from. */
	noteOutside: boolean;
	/** Quartz: the plugin that publishes the user's notes, where one is on. */
	publisher: NotePublisher | null;
	/** Quartz's configuration; `null` where the file is not in the vault. */
	quartzConfig: QuartzConfigFacts | null;
}

export interface SiteFactsOptions {
	/** Where the service's note is, where one was found (`webNoteLocation.ts`). */
	notePath?: string;
	/** Quartz: the plugin that publishes the notes, where the caller read it already; read here when left out. */
	publisher?: NotePublisher | null;
}

/** A file's text, or `null` when it is not there or cannot be read. */
async function readText(app: App, path: string): Promise<string | null> {
	try {
		const normal = normalizePath(path);
		return (await app.vault.adapter.exists(normal)) ? await app.vault.adapter.read(normal) : null;
	} catch {
		return null;
	}
}

/**
 * Read Quartz's configuration file off the top of the vault, where it is
 * there. Quartz 5's is looked for first: a site moved from 4 to 5 may still
 * have the old file beside the new one, and the new one is what is built.
 */
export async function readQuartzConfig(app: App): Promise<QuartzConfigFacts | null> {
	for (const version of [5, 4] as const) {
		const file = QUARTZ_CONFIG_FILE[version];
		const text = await readText(app, file);
		if (text === null) continue;
		return { file, version, state: checkQuartzConfig(text, version) };
	}
	return null;
}

const escapeRegExp = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Whether the note at `path` has the property `key` set to `true`. */
async function readNotePublishes(app: App, path: string, key: string): Promise<boolean> {
	const text = await readText(app, path);
	// No note is not a note that is switched off: the row for it says "missing".
	if (text === null) return true;
	const { frontmatter } = splitFrontmatter(text);
	const on = new RegExp(`^["']?${escapeRegExp(key)}["']?[ \\t]*:[ \\t]*["']?true["']?[ \\t]*$`, "im");
	return frontmatter !== null && on.test(frontmatter);
}

/** Quartz's facts: its configuration, and the plugin that publishes the notes, if one does. */
async function readQuartzFacts(app: App, options: SiteFactsOptions, nothing: SiteFacts): Promise<SiteFacts> {
	const [quartzConfig, publisher] = await Promise.all([
		readQuartzConfig(app),
		options.publisher !== undefined ? options.publisher : readNotePublisher(app),
	]);
	const facts: SiteFacts = { ...nothing, quartzConfig, publisher };
	const path = options.notePath;
	if (!publisher || !path) return facts;
	return {
		...facts,
		notePublishes: publisher.key === null || (await readNotePublishes(app, path, publisher.key)),
		noteOutside: !publishesFrom(publisher, path),
	};
}

/** Look at the vault for `id`. Never throws. */
export async function readSiteFacts(app: App, id: WebTargetId, options: SiteFactsOptions = {}): Promise<SiteFacts> {
	const nothing: SiteFacts = { notePublishes: true, noteOutside: false, publisher: null, quartzConfig: null };
	try {
		switch (id) {
			case "quartz":
				return await readQuartzFacts(app, options, nothing);
			case "garden":
				return options.notePath
					? { ...nothing, notePublishes: await readNotePublishes(app, options.notePath, "dg-publish") }
					: nothing;
			case "publish":
				return nothing;
		}
	} catch {
		return nothing;
	}
}
