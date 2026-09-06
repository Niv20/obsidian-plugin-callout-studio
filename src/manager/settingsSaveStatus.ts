/** Saving failures remain visible until a successful retry or adoption. */
export type SettingsSaveReason = "missing" | "unreadable" | "newer-version" |
	"recovery-read" | "recovery-write" | "backup" | "write" | "write-permission" | "write-space" | "changed" | "sync-conflict";

export class SettingsPersistenceError extends Error {
	constructor(readonly reason: SettingsSaveReason, readonly original: unknown) {
		super(original instanceof Error ? original.message : String(original));
		this.name = "SettingsPersistenceError";
	}
}

export class SettingsSaveStatus {
	frozenReason: SettingsSaveReason | null = null;
	failure: SettingsSaveReason | null = null;
	private listeners = new Set<() => void>();
	get reason(): SettingsSaveReason | null { return this.failure ?? this.frozenReason; }
	freeze(reason: SettingsSaveReason): void { this.frozenReason = reason; this.failure = null; this.notify(); }
	thaw(): void { this.frozenReason = null; this.clear(); }
	fail(reason: SettingsSaveReason): void { this.failure = reason; this.notify(); }
	clear(): void { this.failure = null; this.notify(); }
	subscribe(listener: () => void): () => void {
		this.listeners.add(listener);
		return () => { this.listeners.delete(listener); };
	}
	destroy(): void { this.listeners.clear(); }
	private notify(): void {
		for (const listener of this.listeners) {
			try { listener(); }
			catch (error) { console.error("[callout-studio] saving status could not be displayed", error); }
		}
	}
}

/** Classify known storage codes; never expose adapter text or file paths. */
export function settingsWriteReason(error: unknown): SettingsSaveReason {
	const failure = error as { code?: unknown; name?: unknown } | null;
	if (["ENOSPC", "EDQUOT"].includes(String(failure?.code)) || failure?.name === "QuotaExceededError") return "write-space";
	if (["EACCES", "EPERM", "EROFS"].includes(String(failure?.code)) || ["NotAllowedError", "SecurityError", "NoModificationAllowedError"].includes(String(failure?.name))) return "write-permission";
	return "write";
}
