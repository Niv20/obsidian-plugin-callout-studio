/**
 * manager/web/writeTarget.ts — writes one website target into the vault.
 *
 * `targets.ts` says what a service's files contain; this decides, file by
 * file, what to do about whatever is already at each path. The rules are the
 * CSS snippet's (`cssSnippetExport.ts`), applied to several files and to two
 * ways of being asked:
 *
 * - **By hand** (the Publish to the web panel's button). A missing file is created. A file
 *   — or, in `publish.js` and `publish.css`, a block — that we wrote and nobody
 *   touched is replaced silently. Anything else costs one confirmation that
 *   names every such file, and declining writes nothing at all: a target half
 *   written is worse than one not written.
 * - **Automatically** (`autoUpdate.ts`, after a callout changed). Only what is
 *   already there, *still ours* and *as this device left it* is refreshed.
 *   Nothing is created, nothing the user edited is replaced, nobody is asked.
 *   Deleting a file is how one opts a file out. And while an icon's artwork is
 *   still on its way to this device, nothing is written at all
 *   (`webData.pendingIcons`): the refresh runs again when it arrives. Every
 *   target is asked this way after every change, and most vaults have none of
 *   them, so a target with no file in the vault is answered before anything
 *   is built.
 *
 * **"As this device left it" is what keeps two devices from undoing each
 * other.** The files sync, and a device with other callouts, with settings
 * that have not arrived yet or with another build would write other bytes. So
 * each device remembers what it wrote or found identical to its own
 * (`fileMemory.ts`), and an automatic refresh replaces only that: a file in
 * any other state is another device's version and is left to it ({@link
 * refreshVerdict}). A write by hand replaces it and makes this device the one
 * that answers for the file.
 *
 * Either way a file whose bytes would not change is not written — every write
 * to a vault is a sync event — and nothing throws: each failure comes back as
 * an outcome.
 *
 * **A note — the Digital Garden one, or the Quartz one — is the one exception
 * to "never replace an edit".** Its body is nothing but the user's callouts,
 * encoded, under a warning that says so (`web/static/webNote.ts`): an edit to
 * it holds nothing worth keeping and stops the site reading it. So once the
 * note is ours — it has its property (`callout-studio-web`,
 * `callout-studio-quartz`) — its body is rewritten by hand and automatically
 * alike, edited or not, without asking — automatically by a device that has
 * answered for the note before, since a device that never has cannot know its
 * callouts are the site's. Its properties are the user's and are kept byte
 * for byte. A note *without* the property at the usual path is somebody
 * else's, and is treated like any foreign file.
 */
import { normalizePath } from "obsidian";
import type { App } from "obsidian";
import { buildNoteBody, noteFormat, readNoteBody, splitFrontmatter } from "../../web/static/webNote";
import { sha256 } from "../cssSnippetFile";
import { claimsOf, type WebFileClaims } from "./fileMemory";
import { buildBlock, findBlock, spliceBlock } from "./managedBlock";
import {
	newNotePath,
	noteKindOf,
	targetFiles,
	targetPaths,
	type TargetFile,
	type TargetOptions,
	type WebTargetId,
} from "./targets";
import { locateWebNote, webNoteCopies } from "./webNoteLocation";
import { buildWebBundleData, pendingIcons, type WebExportPlugin } from "./webData";

export type FileResult = "created" | "updated" | "unchanged" | "skipped";

/** What one export did. */
export type WebExportOutcome =
	| { status: "written"; files: Array<{ path: string; result: FileResult }> }
	/** An automatic refresh found an icon still on its way here, and wrote nothing. */
	| { status: "waiting" }
	| { status: "cancelled" }
	| { status: "failed" };

export interface WebExportOptions extends TargetOptions {
	/**
	 * Asked once, with the paths that hold something we did not write. Passed in
	 * rather than reached for, which is what lets the tests drive that branch
	 * without a modal. Left out for an automatic refresh, which never replaces.
	 */
	confirmOverwrite?: (paths: string[]) => Promise<boolean>;
	/** An automatic refresh: touch only what exists, is still ours and is as this device left it. */
	auto?: boolean;
}

/** One file, decided: what would be written, and whether it needs a yes first. */
interface Planned {
	path: string;
	/** The file's full new text. `null` when nothing is to be written. */
	text: string | null;
	result: FileResult;
	/** Something is there that we did not write. */
	foreign: boolean;
	/** The file's name in this device's memory (`TargetFile.slot`). */
	slot: string;
	/** Our part of the file as it would be written: all of it, our block, or a note's body. */
	ours: string;
	/** Our part as it is on disk, or `null` where nothing there is ours to compare with. */
	was: string | null;
	/**
	 * A note's data, by fingerprint: what would be written, and what the note
	 * holds now — `null` when it holds none its own fingerprint vouches for.
	 */
	data?: { next: string; was: string | null };
	/** The words around a note's data are not this device's and stay: only the data is agreed with. */
	dataOnly?: true;
}

type Read = { ok: true; text: string | null } | { ok: false };

async function readFile(app: App, path: string): Promise<Read> {
	const adapter = app.vault.adapter;
	try {
		if (!(await adapter.exists(path))) return { ok: true, text: null };
		return { ok: true, text: await adapter.read(path) };
	} catch (e) {
		// Unreadable is not the same as absent: something is there.
		console.warn(`[CalloutStudio] could not read "${path}"`, e);
		return { ok: false };
	}
}

/** `planned` with nothing left to write. */
const settled = (planned: Planned, result: FileResult = "unchanged"): Planned => ({
	...planned,
	text: null,
	result,
	foreign: false,
});

async function planBlock(file: TargetFile, path: string, read: Read): Promise<Planned | null> {
	// The rest of the file is the user's. Without reading it there is no way to
	// keep it, so an unreadable file is a failure, not a question.
	if (!read.ok) return null;
	const block = await buildBlock(file.prose, file.body);
	const planned: Planned = {
		path,
		text: block,
		result: "created",
		foreign: false,
		slot: file.slot,
		ours: block,
		was: null,
	};
	if (read.text === null) return planned;
	const state = await findBlock(read.text);
	if (state.kind === "broken") {
		console.warn(`[CalloutStudio] "${path}" has a callout-studio:start marker with no end marker; not touching it`);
		return null;
	}
	if (state.kind === "ours" && state.text === block) return settled({ ...planned, was: block });
	return {
		...planned,
		text: spliceBlock(read.text, state, block),
		result: "updated",
		foreign: state.kind === "edited",
		// With no block in it the file was never set up, and with an edited one
		// there is nothing of ours left to compare with.
		was: state.kind === "ours" ? state.text : null,
	};
}

async function planNote(file: TargetFile, path: string, read: Read): Promise<Planned | null> {
	const { note } = file;
	if (!note) return null;
	const fingerprint = await sha256(file.body);
	const body = buildNoteBody(note.kind, fingerprint, file.body);
	const fresh: Planned = {
		path,
		text: note.frontmatter + body,
		result: "updated",
		foreign: false,
		slot: file.slot,
		ours: body,
		was: null,
		data: { next: fingerprint, was: null },
	};
	if (!read.ok) return { ...fresh, foreign: true };
	if (read.text === null) return { ...fresh, result: "created" };
	const { frontmatter, body: was } = splitFrontmatter(read.text);
	// Without the property this is a note of the user's that happens to have
	// the name: it is not replaced without a yes.
	if (noteFormat(note.kind, frontmatter) === null) return { ...fresh, foreign: true };
	const text = `${frontmatter ?? ""}${body}`;
	if (text === read.text) return settled({ ...fresh, was: body, data: { next: fingerprint, was: fingerprint } });
	return { ...fresh, text, was, data: { next: fingerprint, was: await noteData(note.kind.key, was) } };
}

/** The fingerprint of the data a note's body carries, or `null` when it carries none its own fingerprint vouches for. */
async function noteData(key: string, body: string): Promise<string | null> {
	const block = readNoteBody(key, body);
	return block !== null && (await sha256(block.json)) === block.fingerprint ? block.fingerprint : null;
}

/** Decide one file — `null` when it must not be touched at all. */
function planFile(file: TargetFile, path: string, read: Read): Promise<Planned | null> {
	switch (file.kind) {
		case "block":
			return planBlock(file, path, read);
		case "note":
			return planNote(file, path, read);
	}
}

/** Whether a file at a target's path is one of that target's at all. */
const isPresent = (file: TargetFile, text: string): boolean => {
	if (file.kind === "block") return text.includes("callout-studio:start");
	if (file.kind === "note")
		return file.note ? noteFormat(file.note.kind, splitFrontmatter(text).frontmatter) !== null : false;
	return true;
};

/**
 * The options with the note's places filled in, for a service that has one:
 * the note, and the copies of it a sync service left beside it
 * (`webNoteLocation.ts`).
 */
async function withNotes<T extends TargetOptions>(app: App, target: WebTargetId, options: T): Promise<T> {
	const kind = noteKindOf(target);
	if (!kind) return options;
	const location = await locateWebNote(app, kind, newNotePath(target, options));
	const path = options.notePath ?? location.path;
	const others = [location.path, ...location.others].filter((other) => other !== path);
	const copies = location.found ? await webNoteCopies(app, kind, others) : [];
	return { ...options, notePath: path, noteCopies: copies };
}

/** Whether anything is at one of `paths`. A path that cannot be asked about counts: something may be there. */
async function anyExists(app: App, paths: readonly string[]): Promise<boolean> {
	for (const path of paths) {
		try {
			if (await app.vault.adapter.exists(normalizePath(path))) return true;
		} catch {
			return true;
		}
	}
	return false;
}

/** A note's data has a name of its own in a device's memory, beside its body's. */
const dataSlot = (slot: string): string => `${slot}#data`;

/** What an automatic refresh may do about one planned file. */
type Refresh =
	/** Replace it: it is ours, and it is as this device left it. */
	| "write"
	/** Nothing to do: it already says what this device would. */
	| "same"
	/** Not an automatic refresh's to touch: missing, edited, never set up, or not ours. */
	| "leave"
	/** Ours, and another device's version of it: left to that device. */
	| "elsewhere";

/**
 * Whether an automatic refresh may replace what is on disk — see
 * `fileMemory.ts` for why "it is ours and it differs" is not enough.
 *
 * A block is compared whole. A note is compared by its data first, because
 * that is all a site reads and the words around it change hands more easily —
 * a formatter passes over the note, another build has another wording:
 *
 * - data its own fingerprint does not vouch for is nobody's version, so a
 *   device that has answered for the note puts its own back;
 * - other data is another device's callouts, unless it is what this device
 *   left there;
 * - the same data under other words is current. Only the device that wrote
 *   those words replaces them, or two builds would trade wordings for ever.
 */
async function refreshVerdict(planned: Planned, claims: WebFileClaims): Promise<Refresh> {
	if (planned.text === null) return "same";
	// A shared file with no block of ours in it was never set up: `was` is null.
	if (planned.foreign || planned.result === "created" || planned.was === null) return "leave";
	const { data, slot } = planned;
	if (data) {
		if (data.was === null) return claims.holds(dataSlot(slot)) ? "write" : "leave";
		if (data.was !== data.next) return claims.recognises(dataSlot(slot), data.was) ? "write" : "elsewhere";
		return claims.recognises(slot, await sha256(planned.was)) ? "write" : "same";
	}
	return claims.recognises(slot, await sha256(planned.was)) ? "write" : "elsewhere";
}

/** `planned` as an automatic refresh carries it out: written only on a `write`. */
async function refreshOnly(planned: Planned, claims: WebFileClaims): Promise<Planned> {
	switch (await refreshVerdict(planned, claims)) {
		case "write":
			return planned;
		case "same":
			return planned.text === null ? planned : { ...settled(planned), dataOnly: true };
		case "leave":
			return settled(planned, "skipped");
		case "elsewhere":
			if (planned.data) claims.passed(dataSlot(planned.slot), planned.data.next);
			claims.passed(planned.slot, await sha256(planned.ours));
			return settled(planned, "skipped");
	}
}

/** What `planned` leaves on disk is this device's: it answers for the file from now on. */
async function agree(planned: Planned, claims: WebFileClaims): Promise<void> {
	if (planned.data) claims.agreed(dataSlot(planned.slot), planned.data.next);
	if (!planned.dataOnly) claims.agreed(planned.slot, await sha256(planned.ours));
}

async function ensureFolder(app: App, path: string): Promise<void> {
	const slash = path.lastIndexOf("/");
	if (slash < 0) return;
	const folder = path.slice(0, slash);
	if (!(await app.vault.adapter.exists(folder))) await app.vault.adapter.mkdir(folder);
}

/** One export at a time, across every target: two must never race one file. */
let queue: Promise<unknown> = Promise.resolve();

/**
 * Write `target`, deciding deliberately what to do about whatever is already
 * at each path. Never throws.
 */
export function exportWebTarget(
	app: App,
	plugin: WebExportPlugin,
	target: WebTargetId,
	options: WebExportOptions = {},
): Promise<WebExportOutcome> {
	const run = queue.then(() => runExport(app, plugin, target, options));
	queue = run.catch(() => undefined);
	return run;
}

async function runExport(
	app: App,
	plugin: WebExportPlugin,
	target: WebTargetId,
	options: WebExportOptions,
): Promise<WebExportOutcome> {
	let files: TargetFile[];
	const claims = claimsOf(plugin.webFiles);
	try {
		const located = await withNotes(app, target, options);
		// Nothing of this target is in the vault, so there is nothing an
		// automatic refresh may touch: say so without building the snapshot.
		if (options.auto && !(await anyExists(app, targetPaths(target, located))))
			return { status: "written", files: [] };
		// Never empty: with heading and inline callouts both switched off the
		// renderer has nothing to turn, and the stylesheet still carries the
		// block callouts.
		const data = buildWebBundleData(plugin, target);
		if (options.auto && pendingIcons(plugin).length > 0) return { status: "waiting" };
		files = targetFiles(target, data, located);
	} catch (e) {
		console.warn("[CalloutStudio] could not build the website files", e);
		return { status: "failed" };
	}

	const plan: Planned[] = [];
	try {
		for (const file of files) {
			const path = normalizePath(file.path);
			const read = await readFile(app, path);
			const planned = await planFile(file, path, read);
			if (planned === null) return { status: "failed" };
			// A copy is refreshed where it is a note of ours; it is never made, and
			// one that stopped being ours is nothing to ask about.
			const mine =
				file.copy && (planned.foreign || planned.result === "created") ? settled(planned, "skipped") : planned;
			plan.push(options.auto ? await refreshOnly(mine, claims) : mine);
		}
	} catch (e) {
		console.warn("[CalloutStudio] could not prepare the website files", e);
		return { status: "failed" };
	}

	const foreign = plan.filter((file) => file.foreign).map((file) => file.path);
	if (foreign.length > 0 && !(await (options.confirmOverwrite?.(foreign) ?? Promise.resolve(false)))) {
		return { status: "cancelled" };
	}

	try {
		for (const file of plan) {
			if (file.text === null) continue;
			await ensureFolder(app, file.path);
			await app.vault.adapter.write(file.path, file.text);
		}
	} catch (e) {
		console.warn("[CalloutStudio] could not write the website files", e);
		return { status: "failed" };
	}
	// Everything on disk is now what this device writes, whether it wrote it
	// just now or found it so. Remembered last, and best effort: a device that
	// could not note it down only looks again at its next refresh.
	if (plugin.webFiles) {
		try {
			for (const file of plan) if (file.result !== "skipped") await agree(file, claims);
		} catch (e) {
			console.warn("[CalloutStudio] could not remember the website files", e);
		}
	}
	return { status: "written", files: plan.map(({ path, result }) => ({ path, result })) };
}

/** One word for a whole export: did anything change, and was any of it new? */
export function summarize(outcome: WebExportOutcome): "created" | "updated" | "unchanged" | null {
	if (outcome.status !== "written") return null;
	const results = outcome.files.map((file) => file.result);
	if (results.every((result) => result === "unchanged" || result === "skipped")) return "unchanged";
	return results.every((result) => result === "created") ? "created" : "updated";
}

export type WebTargetStatus = "missing" | "current" | "stale" | "edited" | "elsewhere";

/**
 * What is on disk for `target` right now, without writing anything: `missing`
 * when none of its files is there, `current` when an automatic refresh would
 * change nothing, `edited` when the service's note no longer holds data its
 * fingerprint vouches for — so the site cannot read it — `elsewhere`
 * when a file is another device's version, which this device leaves alone
 * until it is written from here by hand ({@link refreshVerdict}), and `stale`
 * otherwise. For the Publish to the web panel's rows.
 */
export async function webTargetStatus(
	app: App,
	plugin: WebExportPlugin,
	target: WebTargetId,
	options: TargetOptions = {},
): Promise<WebTargetStatus> {
	try {
		const data = buildWebBundleData(plugin, target);
		const claims = claimsOf(plugin.webFiles);
		let present = 0;
		let same = 0;
		let edited = false;
		let elsewhere = false;
		const files = targetFiles(target, data, await withNotes(app, target, options));
		for (const file of files) {
			const path = normalizePath(file.path);
			const read = await readFile(app, path);
			if (!read.ok || read.text === null || !isPresent(file, read.text)) continue;
			present++;
			const planned = await planFile(file, path, read);
			if (!planned) continue;
			if (planned.data && planned.data.was === null) edited = true;
			const verdict = await refreshVerdict(planned, claims);
			if (verdict === "same") same++;
			else if (verdict === "elsewhere") elsewhere = true;
		}
		if (present === 0) return "missing";
		if (edited) return "edited";
		if (same === files.length) return "current";
		// A stand-in with no memory recognises nothing, which says nothing about whose the files are.
		return elsewhere && plugin.webFiles ? "elsewhere" : "stale";
	} catch {
		return "missing";
	}
}
