export interface StaleWriteHost {

	readCurrent?(): Promise<string | null>;

	onStaleWrite?(): void;
}

export interface WriteBaseline {
	matches(json: string): boolean;
	hasBaseline?: boolean;
}

export class StaleWriteGuard {

	private reported = false;
	private timer: number | null = null;
	private destroyed = false;

	constructor(private readonly host: StaleWriteHost) {}

	get enabled(): boolean {
		return this.host.readCurrent !== undefined;
	}

	async blocks(baseline: WriteBaseline): Promise<boolean> {
		if (!this.host.readCurrent) return false;
		let onDisk: string | null;
		try {
			onDisk = await this.host.readCurrent();
		} catch {
			this.report();
			return true;
		}
		if (onDisk === null && !baseline.hasBaseline) return false;
		if (onDisk !== null && baseline.matches(onDisk)) return false;
		this.report();
		return true;
	}

	clear(): void {
		this.reported = false;
	}

	destroy(): void {
		this.destroyed = true;
		if (this.timer !== null) window.clearTimeout(this.timer);
		this.timer = null;
	}

	private report(): void {
		if (!this.host.onStaleWrite || this.reported || this.destroyed) return;
		this.reported = true;
		this.timer = window.setTimeout(() => {
			this.timer = null;
			if (!this.destroyed) this.host.onStaleWrite?.();
		}, 0);
	}
}
