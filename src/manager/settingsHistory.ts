/**
 * manager/settingsHistory.ts — this device's recent settings, kept where no sync
 * service can reach them.
 *
 * The recovery checkpoint (`settingsCheckpoint.ts`) is one snapshot: the state
 * this device last accepted. Vault backups sync, and uninstalling the plugin
 * deletes them with the plugin folder. Neither answers "what did my setup look
 * like before last Tuesday". This does, from IndexedDB, which survives both.
 *
 * It is a separate database on purpose. Builds 2.13.1–2.14.1 open
 * `CalloutStudioRecovery` at version 1 and create only its `settings` store;
 * adding a store there means a version 2, and an older build opening a newer
 * version fails, which it reports as unreadable recovery storage and freezes
 * saving in every vault on the device.
 *
 * Every accepted state is recorded: each verified write of `data.json` and
 * each file adopted from disk. Recording is best effort and never delays or
 * fails a save. States are stored as content, deduplicated by hash, and kept
 * by {@link historyToKeep}.
 *
 * Each state also carries why it was recorded, which Version history shows as
 * its name. This is an extra field on the stored entry rather than a new
 * store, for the reason above; a build that predates it reads past it.
 */
import type { App, PluginManifest } from "obsidian";
import { canonical, content } from "./syncTree";
import { hash64 } from "./syncFingerprint";

/**
 * What this device had just done when it recorded a state. Stored as written:
 * a later build may add reasons, and an earlier one shows those under its
 * general name.
 */
export type HistoryReason =
	/** A change made here was saved. */
	| "edit"
	/** The settings file was read: at startup, or after it changed on disk. */
	| "load"
	/** A version was restored from Version history. */
	| "restore"
	/** A missing or unreadable settings file was replaced. */
	| "repair";

/** The most recent distinct states, whatever their age. */
const KEEP_RECENT = 10;
/** Beyond this many bytes, older states go first; the newest always stays. */
const BUDGET_BYTES = 24 * 1024 * 1024;

const DATABASE = "CalloutStudioHistory";
const STORE = "snapshots";

export interface SettingsHistoryEntry {
	hash: string;
	savedAt: number;
	bytes: number;
	data: Record<string, unknown>;
	/** Why it was recorded; absent on a state an earlier build recorded. */
	reason?: string;
}

export interface SettingsHistoryStore {
	/** Remember `data` as a state this device accepted. Never rejects. */
	record(data: unknown, reason?: HistoryReason): Promise<void>;
	/** Every kept state, newest first. */
	list(): Promise<SettingsHistoryEntry[]>;
	/** Forget one kept state. Unlike `record`, a failure is reported to the caller. */
	delete(hash: string): Promise<void>;
	/** Apply current limits to existing states without recording one. Never rejects. */
	prune?(): Promise<void>;
}

/** At most the ten newest distinct states, within the size budget. */
export function historyToKeep(entries: readonly Pick<SettingsHistoryEntry, "hash" | "savedAt" | "bytes">[]): Set<string> {
	const keep = new Set<string>();
	const newest = [...entries].sort((a, b) => b.savedAt - a.savedAt).slice(0, KEEP_RECENT);
	let bytes = 0;
	for (const entry of newest) {
		bytes += entry.bytes;
		if (bytes <= BUDGET_BYTES || entry === newest[0]) keep.add(entry.hash);
	}
	return keep;
}

interface StoredEntry extends SettingsHistoryEntry {
	scope: string;
}

/** IndexedDB-backed history for one vault, configuration folder and plugin. */
export class SettingsHistory implements SettingsHistoryStore {
	private queue: Promise<void> = Promise.resolve();

	constructor(
		private readonly app: App, private readonly manifest: PluginManifest,
		private readonly timeoutMs = 10000, private readonly now = () => Date.now(),
	) {}

	/** The same scope as the recovery checkpoint's key. Read late: a host may be partial. */
	private get scope(): string {
		const appId = (this.app as App & { appId?: string }).appId ?? this.app.vault.getName();
		return JSON.stringify([appId, this.app.vault.configDir, this.manifest.id]);
	}

	record(data: unknown, reason: HistoryReason = "edit"): Promise<void> {
		// Nothing to keep it in; not worth a log line per save.
		if (typeof indexedDB === "undefined") return Promise.resolve();
		let entry: StoredEntry;
		try {
			// Captured now: the caller's object can change while this waits its turn.
			const body = content(data);
			const text = canonical(body);
			entry = { scope: this.scope, hash: hash64(text), savedAt: this.now(), bytes: text.length * 2, data: body, reason };
		} catch (error) {
			console.debug("[callout-studio] could not record settings history", error);
			return Promise.resolve();
		}
		this.queue = this.queue.then(() => this.put(entry)).catch((error: unknown) => {
			console.debug("[callout-studio] could not record settings history", error);
		});
		return this.queue;
	}

	/** Upgrade existing history even when startup cannot accept a settings file. */
	prune(): Promise<void> {
		if (typeof indexedDB === "undefined") return Promise.resolve();
		this.queue = this.queue.then(() => this.transact("readwrite", store =>
			this.all(store, entries => this.dropExcess(store, entries)),
		)).then(() => undefined).catch((error: unknown) => {
			console.debug("[callout-studio] could not prune settings history", error);
		});
		return this.queue;
	}

	async list(): Promise<SettingsHistoryEntry[]> {
		if (typeof indexedDB === "undefined") return [];
		const entries = await this.transact("readonly", store => this.all(store));
		return entries.sort((a, b) => b.savedAt - a.savedAt)
			.map(({ hash, savedAt, bytes, data, reason }) => ({
				hash, savedAt, bytes, data,
				...typeof reason === "string" ? { reason } : {},
			}));
	}

	/**
	 * The user asked for this one to be gone, so — unlike `record`, which is
	 * opportunistic bookkeeping that must never fail a save — a failure here is
	 * not swallowed. It is still run behind `this.queue`, so it cannot race a
	 * `record()`/`prune()`/`delete()` for the same hash, but the chain itself is forked:
	 * `this.queue` always resolves, so one failed delete cannot poison every
	 * later history write, while the caller's own promise still rejects.
	 */
	delete(hash: string): Promise<void> {
		if (typeof indexedDB === "undefined") return Promise.resolve();
		const attempt = this.queue.then(() => this.transact("readwrite", store => {
			store.delete(this.key(hash));
			return Promise.resolve();
		}));
		this.queue = attempt.catch(() => undefined);
		return attempt;
	}

	private key(hash: string): string {
		return `${this.scope}\u0001${hash}`;
	}

	/** This scope's entries; `then` runs inside the success callback, while the transaction is live. */
	private all(store: IDBObjectStore, then: (entries: StoredEntry[]) => void = () => {}): Promise<StoredEntry[]> {
		return new Promise((resolve, reject) => {
			const request = store.getAll(IDBKeyRange.bound(`${this.scope}\u0001`, `${this.scope}\u0002`, false, true));
			request.onsuccess = () => {
				const entries = (request.result as StoredEntry[]).filter(entry => entry.scope === this.scope);
				try { then(entries); } catch (error) { reject(error instanceof Error ? error : new Error(String(error))); return; }
				resolve(entries);
			};
			request.onerror = () => reject(request.error ?? new Error("Settings history could not be read"));
		});
	}

	/**
	 * One transaction: add or refresh `entry`, then drop what retention no
	 * longer keeps. The writes are issued from the read's success callback
	 * rather than after an `await`: a transaction with no request pending when
	 * its callbacks return commits, and older WebKit did so before promise
	 * continuations ran.
	 */
	private put(entry: StoredEntry): Promise<void> {
		return this.transact("readwrite", store => this.all(store, existing => {
			const stored: StoredEntry = { ...entry };
			const previous = existing.find(other => other.hash === entry.hash);
			if (previous) {
				// Reading a state this device already had — every startup does —
				// says nothing new about how it came about, so it keeps its reason.
				if (entry.reason === "load") {
					if (previous.reason === undefined) delete stored.reason;
					else stored.reason = previous.reason;
				}
			}
			const entries = existing.filter(other => other.hash !== entry.hash);
			entries.push(stored);
			store.put(stored, this.key(entry.hash));
			this.dropExcess(store, entries);
		})).then(() => undefined);
	}

	/** Called from a read's success callback while its transaction is still live. */
	private dropExcess(store: IDBObjectStore, entries: StoredEntry[]): void {
		const keep = historyToKeep(entries);
		for (const entry of entries) {
			if (!keep.has(entry.hash)) store.delete(this.key(entry.hash));
		}
	}

	private open(): Promise<IDBDatabase> {
		return new Promise((resolve, reject) => {
			if (typeof indexedDB === "undefined") { reject(new Error("Settings history storage is unavailable")); return; }
			let finished = false;
			const request = indexedDB.open(DATABASE, 1);
			const fail = (error: Error) => {
				if (finished) return;
				finished = true; window.clearTimeout(timer); reject(error);
			};
			const timer = window.setTimeout(() => fail(new Error("Settings history storage did not respond")), this.timeoutMs);
			request.onupgradeneeded = () => {
				if (finished) { request.transaction?.abort(); return; }
				request.result.createObjectStore(STORE);
			};
			request.onsuccess = () => {
				if (finished) { request.result.close(); return; }
				finished = true; window.clearTimeout(timer);
				request.result.onversionchange = () => { request.result.close(); };
				resolve(request.result);
			};
			request.onerror = () => { fail(request.error ?? new Error("Cannot open settings history storage")); };
			request.onblocked = () => { fail(new Error("Settings history storage is blocked")); };
		});
	}

	/** Run `body` in one transaction and resolve with its result once the transaction commits. */
	private async transact<T>(mode: IDBTransactionMode, body: (store: IDBObjectStore) => Promise<T>): Promise<T> {
		const db = await this.open();
		try {
			return await new Promise<T>((resolve, reject) => {
				const transaction = db.transaction(STORE, mode);
				let finished = false, result: T | undefined;
				const fail = (error: unknown) => {
					if (finished) return;
					finished = true; window.clearTimeout(timer);
					try { transaction.abort(); } catch { /* It may already have aborted. */ }
					reject(error instanceof Error ? error : new Error(String(error)));
				};
				const timer = window.setTimeout(() => fail(new Error("Settings history did not respond")), this.timeoutMs);
				transaction.oncomplete = () => {
					if (finished) return;
					finished = true; window.clearTimeout(timer); resolve(result as T);
				};
				transaction.onabort = transaction.onerror = () => { fail(transaction.error ?? new Error("Settings history transaction failed")); };
				body(transaction.objectStore(STORE)).then(value => { result = value; }, fail);
			});
		} finally { db.close(); }
	}
}
