import { SettingsPersistenceError, type SettingsSaveReason } from "./settingsSaveStatus";
export interface StaleWriteHost {

	readCurrent?(): Promise<string | null>;

	onStaleWrite?(): void;
	onBlocked?(reason: SettingsSaveReason): void;
}

export interface WriteBaseline {
	matches(json: string): boolean;
	hasBaseline?: boolean;
}

export class StaleWriteGuard {

	private reported = false;
	private timer: number | null = null;
	private destroyed = false;
	private revision = 0;

	constructor(private readonly host: StaleWriteHost) {}

	get enabled(): boolean {
		return this.host.readCurrent !== undefined;
	}

	async blocks(baseline: WriteBaseline): Promise<boolean> {
		if (this.destroyed) return true;
		if (!this.host.readCurrent) return false;
		const revision = this.revision;
		let onDisk: string | null;
		try {
			onDisk = await this.host.readCurrent();
		} catch (error) {
			if (this.destroyed || revision !== this.revision) return true;
			this.host.onBlocked?.(error instanceof SettingsPersistenceError ? error.reason : "unreadable");
			this.report();
			return true;
		}
		if (this.destroyed || revision !== this.revision) return true;
		if (onDisk === null && !baseline.hasBaseline) return false;
		if (onDisk !== null && baseline.matches(onDisk)) return false;
		this.host.onBlocked?.(onDisk === null ? "missing" : "changed");
		this.report();
		return true;
	}

	clear(): void {
		this.revision++;
		this.reported = false;
		if (this.timer !== null) window.clearTimeout(this.timer);
		this.timer = null;
	}

	destroy(): void {
		this.destroyed = true;
		this.clear();
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
