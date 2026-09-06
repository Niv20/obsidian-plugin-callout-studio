/** Owns cancellable waits; underlying Obsidian I/O may still finish silently. */
export class IconTaskScope {
	private readonly stops = new Set<() => void>();
	destroyed = false;

	destroy(): void {
		if (this.destroyed) return;
		this.destroyed = true;
		for (const stop of this.stops) stop();
		this.stops.clear();
	}

	async wait<T>(operation: Promise<T>): Promise<T> {
		let stop = (): void => {};
		const cancelled = new Promise<never>((_, reject) => {
			stop = () => reject(new Error("Icon work stopped"));
			this.stops.add(stop);
			if (this.destroyed) stop();
		});
		try {
			return await Promise.race([operation, cancelled]);
		} finally {
			this.stops.delete(stop);
		}
	}

	async pause(ms: number): Promise<void> {
		let timer = 0;
		try {
			await this.wait(new Promise<void>((resolve) => {
				timer = window.setTimeout(resolve, ms);
			}));
		} finally {
			window.clearTimeout(timer);
		}
	}
}
