/**
 * webPanel/webPanelCopy.ts — the words of the Publish to the web panel: each
 * service's name, and what each row of its checklist says.
 *
 * Who calls it. `WebPanelView.ts`, for every row it draws; and the settings'
 * website offer (`settings/declarative/bannerRows.ts`), for the names.
 *
 * The main idea. `manager/web/webChecklist.ts` decides how a row stands; this
 * says it. A row is a name and a few parts under it, in order: a sentence, a
 * line of configuration to copy, a button, smaller steps done in order.
 * Keeping the words apart from the drawing keeps the three services'
 * differences in one place, where they can be read side by side.
 *
 * - **One thing per sentence, one action per step.** Until 2026-11-16 a row
 *   was a paragraph ("Open the command palette and run …. Go to …. If …,
 *   turn on …"). Now what is done in order is smaller steps
 *   (`{ kind: "steps" }`), each short and on a line of its own, and what is
 *   only good to know is a quiet line after them.
 * - **A button where there can be one** (`{ kind: "action" }`, run by
 *   `siteActions.ts`): open Digital Garden's plugins or its Publication
 *   Center, open Publish changes, show a file in Finder, open the note, open
 *   a help page. Which of them work here is in `WordsContext.actions`; where
 *   one does not, its step says the same in words.
 * - **A step says the same before and after it is done.** Only its button
 *   changes: Create note becomes Open note, Create files becomes Reveal in
 *   Finder. What is added is only ever something wrong (out of date, changed
 *   by hand). Until 2026-11-16 night a done step dropped its instructions and
 *   said what was found instead ("Saved as …", "You ticked this on …"), which
 *   the user found read as a different step; later that night the ticks went
 *   too, and with them the line that said the callouts changed since the
 *   user ticked "I published it".
 * - **Short.** The address to paste under Install from GitHub, the line about
 *   community plugins, and the line that said why the vault points at a
 *   service were dropped on 2026-11-16 night: the button opens the right
 *   place, and the list already opens on the likeliest service.
 * - **A note's first step has its sentence under its buttons** (Digital
 *   Garden, Quartz), on a line of its own after a hairline, not above them:
 *   the note is the one file the user is asked to open and read (it starts
 *   with READ THIS), so the button comes first and the sentence says why it
 *   is needed. Until 2026-11-16 night it was a sentence above the button
 *   ("Your garden reads your callouts from this note."). Obsidian Publish's
 *   kept its sentence above the button until 2026-11-17, when the user asked
 *   for the same order there: button, hairline, then the sentence saying the
 *   files are code files that Obsidian's file list does not show.
 * - **Publish's custom domain is one sentence and a "?"** (2026-11-17, the
 *   user): "To use inline or heading callouts, you must set up a custom
 *   domain." and, when the "?" is pointed at, why. The line that said to
 *   reload the site and clear the browser's cache after publishing was
 *   dropped: Quartz and Digital Garden have no such line.
 * - **Quartz installs its plugin, as a garden does** (2026-11-17, asked for by
 *   the user: "the plugin is in the air"). The Callout Studio Quartz plugin
 *   is in a repository of its own, so the step is one command to copy, run in
 *   the site's folder, and the files to commit after it. Until then Callout
 *   Studio wrote the plugin into the vault as a folder, and the step was lines
 *   to paste into Quartz's configuration and a line for `ignorePatterns` to
 *   keep the folder off the site.
 * - **Quartz's callouts travel in a note**, like the garden's (2026-11-17,
 *   the user: "make it work through a note, no JSON"). Its steps are the
 *   garden's, minus the one to publish: the note reaches the build with the
 *   vault. Where a plugin publishes the user's notes (`notePublisher.ts`),
 *   that step comes back, in that plugin's terms; where none was found, the
 *   first step says in a line what to do with one.
 * - **The commit step is the only word about what reaches the site**
 *   (2026-11-17). A host builds from what was pushed, so a plugin installed in
 *   a terminal and never pushed works on localhost and not on the site, and
 *   that build says nothing: the `[Callout Studio]` lines come from the plugin
 *   itself. A line under the steps saying so was tried and dropped as one
 *   sentence too many beside the step; the user guide's *When the callouts
 *   don't show* carries the explanation.
 * - **The site's folder gets a button where Obsidian can lead to it**
 *   (`quartzTerminalStep`): the configuration file itself where it is in the
 *   vault, and the vault's own folder where the vault is named `content`,
 *   since the site is then the folder that holds it. Anywhere else (a vault
 *   that Quartz reaches through a link, or Quartz Syncer) nothing in the vault
 *   says where the site is, and the step is words.
 *
 * The file and folder names, and the lines of configuration, are fixed
 * literals in every language: they are what a build reads. Only the words
 * around them go through `t()`.
 */
import { t } from "../i18n";
import { QUARTZ_CONFIG_FILE, type QuartzVersion } from "../manager/web/quartzConfig";
import type { NotePublisher, NotePublisherId } from "../manager/web/notePublisher";
import type { QuartzConfigFacts } from "../manager/web/siteFacts";
import {
	GARDEN_PLUGIN_REPO_URL,
	PUBLISH_JS,
	QUARTZ_PLUGIN_PACKAGE,
	QUARTZ_PLUGIN_SOURCE,
	type WebTargetId,
} from "../manager/web/targets";
import type { ChecklistRow, Verdict } from "../manager/web/webChecklist";
import type { WebTargetStatus } from "../manager/web/writeTarget";
import { VAULT_FOLDER, type ActionsHere, type PanelAction } from "./siteActions";

/** Obsidian's help page on giving a Publish site a domain of its own. */
const PUBLISH_DOMAIN_URL = "https://obsidian.md/help/publish/domains";

/** One thing under a row's name. */
export type RowPart =
	/** A sentence. `warning` is something to act on. `help` is a "?" after it that says more when pointed at. */
	| { kind: "text"; text: string; tone?: "warning"; help?: string }
	/** A line to paste into the site's configuration, with its Copy button. */
	| { kind: "code"; code: string }
	/** A button that leads somewhere else: Obsidian, another plugin, the browser. */
	| { kind: "action"; text: string; action: PanelAction }
	/** The button that writes the service's files: the one thing on the panel that changes the vault. */
	| { kind: "write"; text: string }
	/** Smaller steps, done in order: each one a line of its own in the step's box, each its own parts. */
	| { kind: "steps"; steps: RowPart[][] };

export interface RowWords {
	title: string;
	parts: RowPart[];
}

/** What the words of a service's rows are made from, beside the rows. */
export interface WordsContext {
	id: WebTargetId;
	quartzVersion: QuartzVersion;
	/** Quartz's configuration as found in the vault, or `null` where it is not there. */
	quartzConfig: QuartzConfigFacts | null;
	/** The vault is the Quartz repository itself, so a new Quartz note goes under `content/`. */
	quartzInVault: boolean;
	/** The vault is named `content`, so the Quartz site is the folder that holds the vault. */
	quartzBesideVault: boolean;
	/** Where the service's note is, or would be written. */
	notePath: string;
	/** The property that marks the service's note. */
	noteKey: string;
	/** Other notes that claim to be the service's. */
	noteOthers: readonly string[];
	/** Quartz: the plugin that publishes the user's notes, where one is on. */
	publisher: NotePublisher | null;
	/** Which buttons can do their work here (`siteActions.actionsHere`). */
	actions: ActionsHere;
}

export const serviceName = (id: WebTargetId): string =>
	({
		publish: t("web.servicePublish"),
		quartz: t("web.serviceQuartz"),
		garden: t("web.serviceGarden"),
	})[id];

/**
 * Each service's icon, in the list at the top of the panel. Publish's is the
 * one Obsidian gives its own Publish changes; the other two are Lucide's,
 * as Obsidian ships it: a sprout for a garden, a gem for Quartz.
 */
export const SERVICE_ICON: Readonly<Record<WebTargetId, string>> = {
	publish: "send",
	quartz: "gem",
	garden: "sprout",
};

/**
 * How a service stands, in a few words, where there are any to say: not set
 * up. A service on its way says nothing: its steps say it. Until 2026-11-16
 * night this also counted the steps left ("1 step left"), and said All done
 * once every step was ticked; the panel has no ticks now.
 */
export function summaryText(verdict: Verdict): string | null {
	return verdict === "none" ? t("web.summaryNone") : null;
}

/** The words on the button that writes a service's files: the first time, and after. */
export function writeButtonText(id: WebTargetId, status: WebTargetStatus): string {
	if (status !== "missing") return t("web.update");
	return id === "publish" ? t("web.write") : t("web.writeNote");
}

/** Obsidian's own page for the Digital Garden plugin, in Community plugins: Install, then Enable. */
const GARDEN_PLUGIN_PAGE = "obsidian://show-plugin?id=digitalgarden";

/** The plugins that publish a Quartz site's notes, by the names they go by on the screen. */
const PUBLISHER_NAME: Readonly<Record<NotePublisherId, string>> = {
	quartzSyncer: "Quartz Syncer",
	enveloppe: "Enveloppe",
};

/** A note's name as Obsidian lists it: its file name without `.md`. */
const noteName = (path: string): string => (path.split("/").pop() ?? path).replace(/\.md$/, "");

const text = (words: string, tone?: "warning"): RowPart =>
	tone ? { kind: "text", text: words, tone } : { kind: "text", text: words };

/** A sentence with a "?" after it, which says `help` when pointed at. */
const textWithHelp = (words: string, help: string): RowPart => ({ kind: "text", text: words, help });

const action = (words: string, what: PanelAction): RowPart => ({ kind: "action", text: words, action: what });

/** "Reveal in Finder" on a Mac, as Obsidian's own menu says it; nothing where no file can be shown. */
function revealPart(ctx: WordsContext, path: string): RowPart[] {
	const { reveal } = ctx.actions;
	if (!reveal) return [];
	return [
		action(reveal === "finder" ? t("web.actionRevealFinder") : t("web.actionReveal"), { kind: "reveal", path }),
	];
}

/** Why the files need the button, where the button alone does not say. */
const statusReason = (status: WebTargetStatus | undefined): string | null =>
	status === "stale"
		? t("web.statusStale")
		: status === "edited"
			? t("web.statusEdited")
			: status === "elsewhere"
				? t("web.statusElsewhere")
				: null;

/** The button that shows the files once there are any: the note itself, or Publish's files in Finder. */
function filesOpen(row: ChecklistRow, ctx: WordsContext): RowPart[] {
	if (row.status === undefined || row.status === "missing") return [];
	if (ctx.id === "publish") return revealPart(ctx, PUBLISH_JS);
	return [action(t("web.actionOpenNote"), { kind: "openNote", path: ctx.notePath })];
}

/** What is wrong with where the note is, or how it is marked, for the plugin that publishes it. */
function publisherWarnings(row: ChecklistRow, ctx: WordsContext): RowPart[] {
	const { publisher } = ctx;
	if (!publisher) return [];
	const name = PUBLISHER_NAME[publisher.id];
	if (row.switchedOff && publisher.key !== null) {
		return [text(t("web.noteNotMarked", { key: publisher.key, publisher: name }), "warning")];
	}
	if (!row.outside) return [];
	return publisher.folder && !ctx.notePath.startsWith(`${publisher.folder}/`)
		? [text(t("web.noteOutsideFolder", { publisher: name, folder: publisher.folder }), "warning")]
		: [text(t("web.noteExcludedFolder", { publisher: name }), "warning")];
}

function filesWords(row: ChecklistRow, ctx: WordsContext): RowWords {
	const { id } = ctx;
	const title = id === "publish" ? t("web.rowFiles") : t("web.rowNote");
	const parts: RowPart[] = [];
	// The sentence is a line under the buttons, after a hairline, on every service.
	const reason = statusReason(row.status);
	if (reason) parts.push(text(reason, "warning"));
	if (id === "garden" && row.switchedOff) parts.push(text(t("web.noteSwitchedOff"), "warning"));
	if (id === "quartz") parts.push(...publisherWarnings(row, ctx));
	if (id !== "publish" && ctx.noteOthers.length > 0) {
		const files = ctx.noteOthers.join(", ");
		parts.push(text(t("web.statusDuplicates", { key: ctx.noteKey, files }), "warning"));
	}
	const status = row.status ?? "missing";
	// Pressed first, so it comes before what only shows the files.
	if (status !== "current") parts.push({ kind: "write", text: writeButtonText(id, status) });
	parts.push(...filesOpen(row, ctx));
	const lines: RowPart[][] = [parts, [text(id === "publish" ? t("web.filesPublish") : t("web.filesNote"))]];
	// A Quartz site may be fed by a plugin this one does not know.
	if (id === "quartz" && !ctx.publisher) lines.push([text(t("web.noteChooseToo"))]);
	return { title, parts: [{ kind: "steps", steps: lines }] };
}

/**
 * The button that shows the site's folder, where Obsidian can lead there. It
 * stands on a line of its own, above the steps, so the first step's words
 * come after it, under a hairline (until 2026-11-17 it stood under those
 * words, on their line). Nothing outside the vault is read for it, or can
 * be: Obsidian refuses a path that leaves the vault.
 */
function quartzRevealPart(ctx: WordsContext): RowPart[] {
	// In the vault: the file itself, selected in the system's file manager.
	if (ctx.quartzConfig) return revealPart(ctx, QUARTZ_CONFIG_FILE[ctx.quartzVersion]);
	// The vault is Quartz's content folder: showing the vault's own folder
	// opens the folder that holds it, which is the site.
	if (ctx.quartzBesideVault) return revealPart(ctx, VAULT_FOLDER);
	return [];
}

/** The first of Quartz's smaller steps: a terminal in the site's folder, the one with the configuration file. */
function quartzTerminalStep(ctx: WordsContext): RowPart[] {
	const file = QUARTZ_CONFIG_FILE[ctx.quartzVersion];
	return [text(t("web.stepQuartzTerminal", { file }))];
}

/**
 * The steps that install the Quartz plugin, for each generation: a command
 * that fetches it from its repository, what Quartz 4 needs in its
 * configuration on top, and the files to commit so the site's own build
 * installs it too. Quartz 5's build installs every Git plugin
 * `quartz.config.yaml` lists, even where the host skips `plugin install`,
 * and `quartz.lock.json` pins its commit; Quartz 4's host installs it from
 * `package-lock.json` (`npm ci`).
 */
function quartzSteps(ctx: WordsContext): RowPart[][] {
	const terminal = quartzTerminalStep(ctx);
	if (ctx.quartzVersion === 5) {
		return [
			terminal,
			[text(t("web.stepQuartzRun")), { kind: "code", code: `npx quartz plugin add ${QUARTZ_PLUGIN_SOURCE}` }],
			[text(t("web.stepQuartz5Commit"))],
		];
	}
	return [
		terminal,
		[text(t("web.stepQuartzRun")), { kind: "code", code: `npm install ${QUARTZ_PLUGIN_SOURCE}` }],
		[
			text(t("web.stepQuartz4Import")),
			{ kind: "code", code: `import { CalloutStudio } from "${QUARTZ_PLUGIN_PACKAGE}"` },
		],
		[text(t("web.stepQuartz4Use")), { kind: "code", code: "CalloutStudio()," }],
		[text(t("web.stepQuartz4Commit"))],
	];
}

/** What was found in the configuration file, in a sentence. */
function quartzFound(facts: QuartzConfigFacts): RowPart {
	const { file } = facts;
	switch (facts.state) {
		case "ok":
			return text(t("web.quartzOk", { file }));
		case "none":
			return text(t("web.quartzNone", { file }));
		case "noImport":
			return text(t("web.quartzNoImport", { file }));
		case "noUse":
			return text(t("web.quartzNoUse", { file }));
		case "misplaced":
			return text(t("web.quartzMisplaced", { file }), "warning");
		case "off":
			return text(t("web.quartzOff", { file }), "warning");
	}
}

function quartzPluginWords(ctx: WordsContext): RowWords {
	const facts = ctx.quartzConfig;
	const parts: RowPart[] = [];
	if (facts) parts.push(quartzFound(facts));
	parts.push(...quartzRevealPart(ctx));
	parts.push({ kind: "steps", steps: quartzSteps(ctx) });
	return { title: t("web.rowQuartzPlugin"), parts };
}

/** The first step on Digital Garden's side: its list of garden plugins, by a button where there is one. */
function gardenPluginsStep(ctx: WordsContext): RowPart[] {
	const { actions } = ctx;
	if (actions.gardenPlugins) return [action(t("web.actionGardenPlugins"), { kind: "gardenPlugins" })];
	// An older Digital Garden opens its Publication Center, but not on its plugins.
	if (actions.gardenNotes) {
		return [action(t("web.actionPublicationCenter"), { kind: "gardenNotes" }), text(t("web.stepGardenGoPlugins"))];
	}
	return [text(t("web.stepGardenOpenPlugins"))];
}

function gardenPluginWords(ctx: WordsContext): RowWords {
	return {
		title: t("web.rowGardenPlugin"),
		parts: [
			{ kind: "steps", steps: [gardenPluginsStep(ctx), [text(t("web.stepGardenSearch"))]] },
			// Until the garden plugin is in Digital Garden's list, it is installed from its address.
			// Not a numbered step: a line of its own under the hairline.
			text(t("web.gardenNotListed")),
			{ kind: "code", code: GARDEN_PLUGIN_REPO_URL },
		],
	};
}

function publishDomainWords(row: ChecklistRow): RowWords {
	const title = t("web.rowPublishDomain");
	if (row.notNeeded) return { title, parts: [text(t("web.domainNotNeeded"))] };
	return {
		title,
		parts: [
			textWithHelp(t("web.stepPublishDomain"), t("web.stepPublishDomainWhy")),
			action(t("web.stepPublishDomainLink"), { kind: "openPage", href: PUBLISH_DOMAIN_URL }),
		],
	};
}

/** The two steps of publishing the garden note: open the Publication Center, publish the note. */
function gardenPublishSteps(ctx: WordsContext): RowPart[][] {
	const open = ctx.actions.gardenNotes
		? action(t("web.actionPublicationCenter"), { kind: "gardenNotes" })
		: text(t("web.stepGardenOpenCenter"));
	return [[open], [text(t("web.stepGardenPublish", { note: noteName(ctx.notePath) }))]];
}

/** The two steps of publishing Obsidian Publish's files: open Publish changes, publish the two. */
function publishSteps(ctx: WordsContext): RowPart[][] {
	const open = ctx.actions.publishChanges
		? action(t("web.actionPublishChanges"), { kind: "publishChanges" })
		: text(t("web.stepPublishOpen"));
	return [[open], [text(t("web.stepPublishSelect"))]];
}

/** The steps of publishing the Quartz note with the plugin that publishes the user's notes. */
function quartzPublishSteps(ctx: WordsContext): RowPart[][] {
	const note = noteName(ctx.notePath);
	if (ctx.publisher?.id === "enveloppe") {
		return [
			[action(t("web.actionOpenNote"), { kind: "openNote", path: ctx.notePath })],
			[text(t("web.stepEnveloppeUpload"))],
		];
	}
	const open = ctx.actions.syncerCenter
		? action(t("web.actionPublicationCenter"), { kind: "syncerCenter" })
		: text(t("web.stepSyncerOpenCenter"));
	return [[open], [text(t("web.stepSyncerPublish", { note }))]];
}

/**
 * Publishing, on Digital Garden, Obsidian Publish, and a Quartz site a plugin
 * publishes the notes of. It always says the same. Publishing again after the
 * callouts change is said by the last step.
 */
function siteWords(ctx: WordsContext): RowWords {
	if (ctx.id === "garden") {
		return { title: t("web.siteNote"), parts: [{ kind: "steps", steps: gardenPublishSteps(ctx) }] };
	}
	if (ctx.id === "quartz") {
		return { title: t("web.siteNote"), parts: [{ kind: "steps", steps: quartzPublishSteps(ctx) }] };
	}
	return {
		title: t("web.siteFiles"),
		parts: [{ kind: "steps", steps: publishSteps(ctx) }],
	};
}

/** The last step: all done, and what happens from now on. */
function doneWords(ctx: WordsContext): RowWords {
	const quartz = ctx.publisher ? t("web.doneNote") : t("web.doneQuartz");
	const words = { garden: t("web.doneNote"), publish: t("web.donePublish"), quartz }[ctx.id];
	return { title: t("web.rowDone"), parts: [text(words)] };
}

/**
 * What must be true before step 1, where it is not: Digital Garden is not
 * installed. It is no numbered step, so the steps keep their numbers whether
 * or not the plugin is there (installing it from the panel's side would
 * otherwise renumber every step under the user's hands).
 */
export function prerequisiteWords(ctx: WordsContext): RowWords | null {
	if (ctx.id !== "garden" || ctx.actions.gardenInstalled) return null;
	return {
		title: t("web.prereqTitle"),
		parts: [action(t("web.prereqGarden"), { kind: "openPage", href: GARDEN_PLUGIN_PAGE })],
	};
}

/** What `row` says, for the service and the vault in `ctx`. */
export function rowWords(row: ChecklistRow, ctx: WordsContext): RowWords {
	switch (row.kind) {
		case "files":
			return filesWords(row, ctx);
		case "quartzPlugin":
			return quartzPluginWords(ctx);
		case "gardenPlugin":
			return gardenPluginWords(ctx);
		case "publishDomain":
			return publishDomainWords(row);
		case "site":
			return siteWords(ctx);
		case "gardenInstall":
			return prerequisiteWords(ctx) ?? { title: "", parts: [] };
		case "done":
			return doneWords(ctx);
	}
}
