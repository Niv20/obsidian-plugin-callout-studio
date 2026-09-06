/** A device-local durable copy, independent of the synchronized vault file. */
import type { App, PluginManifest } from "obsidian";
import { hasSafeSettingsFileShape } from "./settingsFileShape";

export interface SettingsCheckpointStore {
	read(): Promise<unknown>;
	write(data: unknown): Promise<void>;
}

export class SettingsCheckpoint implements SettingsCheckpointStore {
	private readonly key: string;
	constructor(app: App, manifest: PluginManifest) {
		const appId = (app as App & { appId?: string }).appId ?? app.vault.getName();
		this.key = JSON.stringify([appId, app.vault.configDir, manifest.id]);
	}

	private open(): Promise<IDBDatabase> {
		return new Promise((resolve, reject) => {
			if (typeof indexedDB === "undefined") { reject(new Error("Settings recovery storage is unavailable")); return; }
			let blocked = false;
			const request = indexedDB.open("CalloutStudioRecovery", 1);
			request.onupgradeneeded = () => { request.result.createObjectStore("settings"); };
			request.onsuccess = () => {
				if (blocked) request.result.close();
				else resolve(request.result);
			};
			request.onerror = () => { reject(request.error ?? new Error("Cannot open settings recovery storage")); };
			request.onblocked = () => { blocked = true; reject(new Error("Settings recovery storage is blocked")); };
		});
	}

	private async transact(mode: IDBTransactionMode, data?: unknown): Promise<unknown> {
		const db = await this.open();
		try {
			return await new Promise((resolve, reject) => {
				const transaction = db.transaction("settings", mode, { durability: "strict" }), store = transaction.objectStore("settings");
				const request = mode === "readonly" ? store.get(this.key) : store.put(data, this.key);
				let result: unknown;
				request.onsuccess = () => { result = request.result as unknown; };
				// A successful put request is not a durable transaction. Wait for
				// completion; quota failure/abort can still follow request success.
				transaction.oncomplete = () => { resolve(result); };
				transaction.onabort = transaction.onerror = () => {
					reject(transaction.error ?? new Error("Settings recovery transaction failed"));
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
