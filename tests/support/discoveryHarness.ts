/**
 * tests/support/discoveryHarness.ts — shared scaffolding for the
 * CalloutDiscovery suites.
 *
 * Not a `*.test.ts`, so `scripts/run-tests.mjs` never treats it as an entry
 * point; it is bundled into each suite that imports it.
 *
 * CalloutDiscovery is the one manager whose behaviour is largely *timing*: a
 * debounced per-file scan, a debounced whole-vault prune, and a rediscovery
 * suppression window measured in wall-clock milliseconds. None of that can be
 * pinned down against real timers without either sleeping for seconds or
 * accepting a flaky suite, so this file installs one virtual clock driving both
 * halves of the manager's sense of time:
 *
 * - `window.setTimeout` / `window.clearTimeout`, which is what it schedules
 *   through. Node has no `window` at all, so nothing is being *replaced* here —
 *   the stub is the only timer API the code under test ever sees.
 * - `Date.now`, which is what the suppression window is measured with.
 *
 * Both are installed at module scope. `node --test` runs each test *file* in
 * its own process, so the patch cannot leak between suites; the queue is still
 * cleared per {@link discoveryHarness} call so one test's orphaned timer can
 * never fire inside the next test's `advance`.
 *
 * {@link settle} is the other half of the deal. A timer callback fires
 * synchronously, but what it starts (`void this.pruneUnused()`) is async, and
 * the fake vault answers every read with an already-resolved promise — so one
 * turn of the macrotask queue drains the entire chain, including the
 * `saveSettings()` at the end of it.
 *
 * The fake vault is deliberately the same *shape* as the one in
 * vaultCalloutScanner.test.ts (list markdown files, read one, resolve a path)
 * plus the two things only discovery touches: a mutable file set, so a test can
 * edit a note between scans, and `getAbstractFileByPath`, which is how
 * `scanFileNow` notices the file it was queued for has since been renamed away.
 */
import { TFile } from "obsidian";
import type { App, EventRef } from "obsidian";
import { CalloutDiscovery } from "../../src/manager/CalloutDiscovery";
import { CalloutRegistry } from "../../src/manager/CalloutRegistry";
import type { CalloutDefinition, PluginSettings } from "../../src/types";

/* -------------------------------------------------------------------------- */
/* Virtual clock                                                              */
/* -------------------------------------------------------------------------- */

interface PendingTimer {
	at: number;
	fn: () => void;
}

/** A plausible wall-clock start, so nothing that treats `0` as falsy misfires. */
const CLOCK_START = 1_700_000_000_000;

const timers = new Map<number, PendingTimer>();
let timerSeq = 1;
let virtualNow = CLOCK_START;

/** The controls a suite gets over the virtual clock. */
export interface Clock {
	/** The value `Date.now()` currently returns. */
	now(): number;
	/**
	 * Move time forward by `ms`, firing every timer that comes due along the
	 * way in due order — including timers scheduled *by* those callbacks, which
	 * is exactly what a scan scheduling a prune does.
	 */
	advance(ms: number): void;
	/** How many timers are still queued. */
	pending(): number;
	/** Drop every queued timer without firing it. */
	reset(): void;
}

const clock: Clock = {
	now: () => virtualNow,
	advance(ms: number): void {
		const target = virtualNow + ms;
		for (;;) {
			let dueId: number | undefined;
			let due: PendingTimer | undefined;
			for (const [id, timer] of timers) {
				if (timer.at > target) continue;
				if (due === undefined || timer.at < due.at) {
					due = timer;
					dueId = id;
				}
			}
			if (due === undefined || dueId === undefined) break;
			timers.delete(dueId);
			virtualNow = due.at;
			due.fn();
		}
		virtualNow = target;
	},
	pending: () => timers.size,
	reset(): void {
		timers.clear();
	},
};

(
	globalThis as unknown as {
		window: {
			setTimeout(fn: () => void, ms?: number): number;
			clearTimeout(id?: number): void;
		};
	}
).window = {
	setTimeout(fn: () => void, ms = 0): number {
		const id = timerSeq++;
		timers.set(id, { at: virtualNow + ms, fn });
		return id;
	},
	clearTimeout(id?: number): void {
		if (id !== undefined) timers.delete(id);
	},
};

Date.now = () => virtualNow;

/**
 * Let every already-resolved promise chain run to completion.
 *
 * `advance()` only fires timer callbacks; the work they kick off (`void
 * this.pruneUnused()`, the `await saveSettings()` at its end) lands on the
 * microtask queue. A single real macrotask hop drains all of it, because
 * nothing in the fake vault ever waits on real I/O.
 */
export const settle = (): Promise<void> =>
	new Promise((resolve) => setImmediate(resolve));

/* -------------------------------------------------------------------------- */
/* Fake vault                                                                 */
/* -------------------------------------------------------------------------- */

/** A mutable stand-in for the markdown files discovery scans. */
export interface FakeVault {
	/** Create or overwrite a note. A new path gets a new handle. */
	write(path: string, content: string): void;
	/** Delete a note, so `getAbstractFileByPath` stops resolving its path. */
	remove(path: string): void;
	/** The stable handle for `path` — the identity `scanFileNow` compares. */
	file(path: string): TFile;
	/**
	 * Detach `path`'s handle from the vault while keeping the handle valid, the
	 * way a rename does: the queued scan still holds the old object, but the
	 * path no longer resolves to it.
	 */
	detach(path: string): void;
	/** Make every `cachedRead` of `path` reject. */
	breakRead(path: string): void;
	/** How many `cachedRead` calls the vault has answered (or rejected). */
	reads(): number;
}

function makeFile(path: string): TFile {
	const file = new TFile();
	return Object.assign(file, {
		path,
		extension: "md",
		basename: path.replace(/\.md$/, ""),
		name: path,
	});
}

/* -------------------------------------------------------------------------- */
/* Fake active editor                                                         */
/* -------------------------------------------------------------------------- */

/** Drives `app.workspace.activeEditor`, which is what "is the user mid-type?" reads. */
export interface FakeEditor {
	/**
	 * Put the cursor on a line reading `line`, in the note at `path`. The line
	 * stands for the *live CodeMirror buffer*, which is deliberately allowed to
	 * differ from what the vault has on disk — that difference is the whole
	 * point of the typing filter.
	 */
	typing(path: string, line: string): void;
	/** An editor open on `path` whose cursor is on an empty line. */
	idle(path: string): void;
	/** No active editor at all (e.g. focus is in a canvas or the graph view). */
	none(): void;
}

/* -------------------------------------------------------------------------- */
/* Private surface                                                            */
/* -------------------------------------------------------------------------- */

/**
 * The private members the suites drive directly.
 *
 * Same reasoning as `cssInjectorHarness.ts`'s `InjectorInternals`: these are
 * internal to one pass rather than API, so the cast lives here, once, and the
 * production signatures stay honest. Reaching them is what lets a test name the
 * exact unit an item is about — `getActiveTypingCalloutIds` has three distinct
 * "not applicable" answers, and only two of them are observable through
 * `scanFileNow`.
 */
export interface DiscoveryInternals {
	/** The two reasons discovery is held back, now one object — see
	 *  `manager/rediscoveryHold.ts`. */
	hold: { holds(id: string): boolean };
	scheduleFileScan(file: TFile): void;
	scanFileNow(file: TFile): Promise<void>;
	getActiveTypingCalloutIds(file: TFile): Set<string> | null;
}

/* -------------------------------------------------------------------------- */
/* Harness                                                                    */
/* -------------------------------------------------------------------------- */

export interface DiscoveryHarness {
	discovery: CalloutDiscovery;
	internals: DiscoveryInternals;
	registry: CalloutRegistry;
	/**
	 * The live settings object. Identical to `registry.settings` on purpose:
	 * main.ts hands discovery `this.settings`, which is a getter returning
	 * `registry.settings`, so the two halves of `runVaultScan` (`host.settings`
	 * for the fallback id, `host.registry.settings` for `firstRunCompleted`)
	 * really are one object in production.
	 */
	settings: PluginSettings;
	app: App;
	vault: FakeVault;
	editor: FakeEditor;
	clock: Clock;
	/** How many times `saveSettings()` was called. */
	saves(): number;
	/** How many times `refreshCallouts()` was called. */
	refreshes(): number;
	/** How many `registry.onChange` notifications fired. */
	changes(): number;
	/** How many event refs were handed to `registerEvent`. */
	registrations(): number;
}

/**
 * A discovery wired to a fresh registry (all 13 built-ins seeded, exactly as a
 * first run seeds them) over a fake vault holding `files`.
 */
export function discoveryHarness(
	files: Record<string, string> = {},
): DiscoveryHarness {
	clock.reset();

	const store = new Map(Object.entries(files));
	const handles = new Map<string, TFile>();
	for (const path of store.keys()) handles.set(path, makeFile(path));
	const broken = new Set<string>();
	let reads = 0;

	const cachedRead = (file: { path: string }): Promise<string> => {
		reads++;
		if (broken.has(file.path)) {
			return Promise.reject(new Error(`unreadable: ${file.path}`));
		}
		return Promise.resolve(store.get(file.path) ?? "");
	};

	let activeEditor: unknown = null;

	const app = {
		vault: {
			getMarkdownFiles: () => Array.from(handles.values()),
			read: cachedRead,
			cachedRead,
			getAbstractFileByPath: (path: string) => handles.get(path) ?? null,
			modify: (file: { path: string }, data: string) => {
				store.set(file.path, data);
				return Promise.resolve();
			},
			on: () => ({}) as EventRef,
		},
		metadataCache: {
			on: () => ({}) as EventRef,
		},
		workspace: {
			get activeEditor() {
				return activeEditor;
			},
		},
	} as unknown as App;

	const vault: FakeVault = {
		write(path, content) {
			store.set(path, content);
			if (!handles.has(path)) handles.set(path, makeFile(path));
		},
		remove(path) {
			store.delete(path);
			handles.delete(path);
		},
		file(path) {
			const existing = handles.get(path);
			if (existing) return existing;
			const created = makeFile(path);
			handles.set(path, created);
			return created;
		},
		detach(path) {
			handles.delete(path);
		},
		breakRead(path) {
			broken.add(path);
		},
		reads: () => reads,
	};

	const editorAt = (path: string, line: string): void => {
		activeEditor = {
			file: vault.file(path),
			editor: {
				getLine: () => line,
				getCursor: () => ({ line: 0, ch: 0 }),
			},
		};
	};

	const editor: FakeEditor = {
		typing: (path, line) => editorAt(path, line),
		idle: (path) => editorAt(path, ""),
		none: () => {
			activeEditor = null;
		},
	};

	const registry = new CalloutRegistry();
	// `load(null)` rather than the bare constructor: it is `load` that seeds the
	// live map with the 13 shipped callouts and stocks `settings` from
	// DEFAULT_SETTINGS, which is what a first run does.
	registry.load(null);

	let saves = 0;
	let refreshes = 0;
	let registrations = 0;
	let changes = 0;
	registry.onChange(() => changes++);

	const discovery = new CalloutDiscovery({
		app,
		registry,
		settings: registry.settings,
		saveSettings: () => {
			saves++;
			return Promise.resolve();
		},
		refreshCallouts: () => {
			refreshes++;
		},
		registerEvent: () => {
			registrations++;
		},
	});

	return {
		discovery,
		internals: discovery as unknown as DiscoveryInternals,
		registry,
		settings: registry.settings,
		app,
		vault,
		editor,
		clock,
		saves: () => saves,
		refreshes: () => refreshes,
		changes: () => changes,
		registrations: () => registrations,
	};
}

/* -------------------------------------------------------------------------- */
/* Definition helpers                                                         */
/* -------------------------------------------------------------------------- */

/** One neutral user callout to vary from. */
export function definition(
	over: Partial<CalloutDefinition> = {},
): CalloutDefinition {
	return {
		id: "quiet",
		displayName: "Quiet",
		icon: { type: "lucide", value: "lucide-pencil" },
		colorLight: "#336699",
		colorDark: "#88bbee",
		foldable: true,
		defaultFolded: false,
		builtIn: false,
		source: "user",
		...over,
	};
}

/**
 * An auto-created row exactly as `addUnknownCalloutsAsFallback` leaves one:
 * `source: "fallback"`, never customized, no external style. This is the only
 * shape `pruneUnused` considers a candidate, so every prune test starts here
 * and changes one field at a time.
 */
export function discovered(
	id: string,
	over: Partial<CalloutDefinition> = {},
): CalloutDefinition {
	return definition({
		id,
		displayName: id,
		source: "fallback",
		...over,
	});
}
