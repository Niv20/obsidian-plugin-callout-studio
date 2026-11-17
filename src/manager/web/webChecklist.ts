/**
 * manager/web/webChecklist.ts — the steps of one service on the Publish to
 * the web panel (`webPanel/`), and what the vault says about each.
 *
 * Who calls it. The panel, each time it has read the vault again.
 *
 * The main idea. Getting callouts onto a site is a few steps, done once, in
 * order: the files in the vault, then whatever tells the site about them (the
 * Quartz plugin, the garden plugin, a custom domain), then publishing. After
 * that, the files are rewritten without being asked when a callout changes
 * (`autoUpdate.ts`), and on Quartz the next build reads them.
 * Every step is on the panel at once, numbered in that order, and the list
 * ends with a step of its own (`done`) that says what happens from then on.
 *
 * The panel no longer says which steps are done, and holds none back. Until
 * 2026-11-16 night each step carried a sign: a tick where the plugin saw it
 * done, a tick the user set by hand with a box ("I installed it", "I
 * published it") where it could not, and a "published" tick that cleared
 * itself when the files changed; and a step whose time had not come was
 * dimmed, with its Copy buttons off. The user found the signs and the boxes
 * more to read than the steps themselves, asked for plain numbers, and then
 * for nothing to be locked. What a step's state still decides:
 *
 * - **Warning** is something wrong the plugin can see (files changed by hand,
 *   a configuration that loads the plugin in the wrong place, the note
 *   switched off for publishing). It says so in the step's box, and the
 *   service's name in the list at the top wears a triangle.
 * - The rest (`seen`, `clear`, `todo`) are drawn alike. They are kept apart
 *   for the words, and for the tests.
 *
 * Until 2026-11-17 Quartz's configuration step also cautioned that its lines,
 * pasted before Callout Studio wrote its plugin folder, would stop the site's
 * build, and its first step warned when the folder was deleted while the
 * configuration still loaded it. The Quartz plugin is installed from its own
 * repository now, and builds a site without the vault's note as it did
 * without the plugin, so the steps can be done in any order.
 *
 * Quartz has a step for publishing only where a plugin publishes the user's
 * notes (Quartz Syncer, Enveloppe: `notePublisher.ts`). Everywhere else the
 * note reaches the build with the vault, and the last step says so.
 *
 * Pure: facts in, rows out. The words for each row are `webPanel/`'s.
 */
import type { QuartzConfigState } from "./quartzConfig";
import type { WebTargetId } from "./targets";
import type { WebTargetStatus } from "./writeTarget";

/** How a row stands, as far as the vault says. */
export type RowMark =
	/** Done, and the plugin saw it for itself. */
	| "seen"
	/** Nothing to do here at all. */
	| "clear"
	/** To do now, or done where the plugin cannot see it. */
	| "todo"
	/** Something is wrong and needs the user. */
	| "warning";

/** `gardenInstall` is never in a checklist: it is the unnumbered box before the steps (`webPanel/`). */
export type RowKind = "gardenInstall" | "files" | "quartzPlugin" | "gardenPlugin" | "publishDomain" | "site" | "done";

export interface ChecklistRow {
	kind: RowKind;
	mark: RowMark;
	/** `files`: the state of the files. */
	status?: WebTargetStatus;
	/** `files`: the note is switched off for publishing (Digital Garden's `dg-publish`, a Quartz publisher's property). */
	switchedOff?: boolean;
	/** `files`, Quartz: the note is where the plugin that publishes the notes does not publish from. */
	outside?: boolean;
	/** `quartzPlugin`: what Quartz's configuration says, or `null` where it is not in the vault. */
	config?: QuartzConfigState | null;
	/** `publishDomain`: no custom domain is needed. */
	notNeeded?: boolean;
}

export interface ChecklistInput {
	id: WebTargetId;
	files: WebTargetStatus;
	/** What Quartz's configuration says; `null` where the file is not in the vault. */
	quartzConfig: QuartzConfigState | null;
	/** The note is switched on for publishing (`siteFacts.notePublishes`). */
	notePublishes: boolean;
	/** Quartz: the note is where the plugin that publishes the notes does not publish from. */
	noteOutside?: boolean;
	/** Quartz: a plugin publishes the user's notes, so the note is published by hand too. */
	publisher?: boolean;
	/** Heading or inline callouts are on, which is what needs `publish.js`, and so a custom domain. */
	needsDomain: boolean;
}

/**
 * How a service stands as a whole: for the service's name in the list, and
 * what a screen reader hears. There is no "done": most steps happen outside
 * the vault, where the plugin cannot see them.
 */
export type Verdict =
	/** Nothing of it is in the vault. */
	| "none"
	/** Some row needs the user because something is wrong. */
	| "attention"
	/** Its files are in the vault, and nothing the plugin can see is wrong. */
	| "ok";

export interface Checklist {
	rows: ChecklistRow[];
	verdict: Verdict;
}

function filesRow(input: ChecklistInput): ChecklistRow {
	const { id, files } = input;
	const row: ChecklistRow = { kind: "files", mark: "warning", status: files };
	if (files === "missing") return { ...row, mark: "todo" };
	if (id !== "publish" && !input.notePublishes) return { ...row, switchedOff: true };
	if (id === "quartz" && input.noteOutside) return { ...row, outside: true };
	return files === "current" ? { ...row, mark: "seen" } : row;
}

function quartzPluginRow(input: ChecklistInput): ChecklistRow {
	const config = input.quartzConfig;
	const row: ChecklistRow = { kind: "quartzPlugin", mark: "todo", config };
	if (config === "ok") return { ...row, mark: "seen" };
	if (config === "misplaced" || config === "off") return { ...row, mark: "warning" };
	return row;
}

/** The step that publishes, on Digital Garden, Obsidian Publish and a Quartz site a plugin publishes to: the user's, and never held back. */
const SITE_ROW: ChecklistRow = { kind: "site", mark: "todo" };

function rowsFor(input: ChecklistInput): ChecklistRow[] {
	const files = filesRow(input);
	switch (input.id) {
		case "quartz":
			// Where the note reaches the build with the vault, nothing is
			// published by hand: the last row (`done`) says so.
			return input.publisher ? [files, quartzPluginRow(input), { ...SITE_ROW }] : [files, quartzPluginRow(input)];
		case "garden":
			return [files, { kind: "gardenPlugin", mark: "todo" }, { ...SITE_ROW }];
		case "publish": {
			const domain: ChecklistRow = input.needsDomain
				? { kind: "publishDomain", mark: "todo" }
				: { kind: "publishDomain", mark: "clear", notNeeded: true };
			return [files, domain, { ...SITE_ROW }];
		}
	}
}

/**
 * The rows of one service, and how it stands as a whole. The last row is
 * `done`, which says what happens from then on: it has nothing to do.
 */
export function checklistFor(input: ChecklistInput): Checklist {
	const steps = rowsFor(input);
	let verdict: Verdict = "ok";
	if (steps[0]?.mark === "todo") verdict = "none";
	else if (steps.some((row) => row.mark === "warning")) verdict = "attention";
	return { rows: [...steps, { kind: "done", mark: "clear" }], verdict };
}
