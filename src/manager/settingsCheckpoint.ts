/** A device-local durable copy, independent of the synchronized vault file. */
import type { App, PluginManifest } from "obsidian";
import { hasSafeSettingsFileShape } from "./settingsFileShape";

export interface SettingsCheckpointStore {
	read(): Promise<unknown>;
	write(data: unknown): Promise<void>;
}

export class SettingsCheckpoint implements SettingsCheckpointStore {
	private readonly key: string;
	constructor(app: App, manifest: PluginManifest, private readonly openTimeoutMs = 5000, private readonly transactionTimeoutMs = 10000) {
		const appId = (app as App & { appId?: string }).appId ?? app.vault.getName();
		this.key = JSON.stringify([appId, app.vault.configDir, manifest.id]);
	}

	private open(): Promise<IDBDatabase> {
		return new Promise((resolve, reject) => {
			if (typeof indexedDB === "undefined") { reject(new Error("Settings recovery storage is unavailable")); return; }
			let finished = false;
			const request = indexedDB.open("CalloutStudioRecovery", 1);
			const fail = (error: Error) => {
				if (finished) return;
				finished = true; window.clearTimeout(timer); reject(error);
			};
			const timer = window.setTimeout(() => fail(new Error("Settings recovery storage did not respond; retry recovery")), this.openTimeoutMs);
			request.onupgradeneeded = () => {
				if (finished) { request.transaction?.abort(); return; }
				request.result.createObjectStore("settings");
			};
			request.onsuccess = () => {
				if (finished) { request.result.close(); return; }
				finished = true; window.clearTimeout(timer);
				request.result.onversionchange = () => { request.result.close(); };
				resolve(request.result);
			};
			request.onerror = () => { fail(request.error ?? new Error("Cannot open settings recovery storage")); };
			request.onblocked = () => { fail(new Error("Settings recovery storage is blocked; close other Obsidian windows and retry")); };
		});
	}

	private async transact(mode: IDBTransactionMode, data?: unknown): Promise<unknown> {
		const db = await this.open();
		try {
			return await new Promise((resolve, reject) => {
				let transaction: IDBTransaction;
				try { transaction = db.transaction("settings", mode, { durability: "strict" }); }
				catch (error) {
					// Older embedded browsers may not accept transaction options.
					// Storage/permission failures must still propagate unchanged.
					if (!(error instanceof TypeError)) throw error;
					transaction = db.transaction("settings", mode);
				}
				let finished = false;
				const fail = (error: unknown) => {
					if (finished) return;
					finished = true;
					window.clearTimeout(timer);
					try { transaction.abort(); } catch { /* It may already have aborted. */ }
					reject(error instanceof Error ? error : new Error(String(error)));
				};
				const timer = window.setTimeout(() => fail(new Error("Settings recovery transaction did not respond; retry recovery")), this.transactionTimeoutMs);
				let request: IDBRequest;
				try {
					const store = transaction.objectStore("settings");
					request = mode === "readonly" ? store.get(this.key) : store.put(data, this.key);
				} catch (error) { fail(error); return; }
				let result: unknown;
				request.onsuccess = () => { result = request.result as unknown; };
				// A successful put request is not a durable transaction. Wait for
				// completion; quota failure/abort can still follow request success.
				transaction.oncomplete = () => {
					if (finished) return;
					finished = true; window.clearTimeout(timer); resolve(result);
				};
				transaction.onabort = transaction.onerror = () => {
					fail(transaction.error ?? new Error("Settings recovery transaction failed"));
				};
			});
		} finally { db.close(); }
	}

	async read(): Promise<unknown> {
		const saved = await this.transact("readonly");
		if (saved === undefined) return null;
		if (!saved || typeof saved !== "object" || Array.isArray(saved) ||
			!hasSafeSettingsFileShape(saved as Record<string, unknown>)) throw new Error("Settings recovery copy is invalid");
		return saved;
	}

	async write(data: unknown): Promise<void> { await this.transact("readwrite", structuredClone(data)); }
}
