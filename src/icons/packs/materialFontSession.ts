/** One plugin lifetime; delayed font work must retain and check this session. */
export class MaterialFontSession {
	private live = true;
	private readonly cleanups = new Set<() => void>();
	private cancel!: (result: "failed") => void;
	readonly cancelled = new Promise<"failed">(resolve => { this.cancel = resolve; });

	get active(): boolean { return this.live; }

	/** Retain ownership after successful loads so unload removes their resources. */
	own(cleanup: () => void): () => void {
		if (!this.live) { cleanup(); return () => {}; }
		this.cleanups.add(cleanup);
		return () => { this.cleanups.delete(cleanup); };
	}

	destroy(): void {
		if (!this.live) return;
		this.live = false;
		this.cancel("failed");
		for (const cleanup of this.cleanups) {
			try { cleanup(); } catch { /* A closed pop-out must not prevent other cleanup. */ }
		}
		this.cleanups.clear();
	}
}
