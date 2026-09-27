/**
 * The safety steps a destructive settings action now takes, answered in memory.
 *
 * Import and Reset ask for confirmation, write a verified backup before they
 * change anything, refuse while saving is paused, and announce success only
 * once the settings file holds the result. A suite exercising those flows needs
 * each step answered; these are the answers.
 */
import type { App } from "obsidian";
import { ConfirmModal } from "../../src/utils/ConfirmModal";

/**
 * Answer every confirmation with `answer`, recording each dialog's title and
 * confirm label. A function answers as the dialog closes, so a suite can change
 * the world while it was open.
 */
export function stubConfirm(answer: boolean | (() => boolean) = true): {
	asked: string[];
	labels: (string | undefined)[];
	restore(): void;
} {
	const saved = Object.getOwnPropertyDescriptor(ConfirmModal.prototype, "confirm");
	if (!saved) throw new Error("ConfirmModal.confirm is missing");
	const asked: string[] = [];
	const labels: (string | undefined)[] = [];
	Object.defineProperty(ConfirmModal.prototype, "confirm", {
		configurable: true,
		writable: true,
		value(this: ConfirmModal) {
			const dialog = this as unknown as { title: string; confirmLabel?: string };
			asked.push(dialog.title);
			labels.push(dialog.confirmLabel);
			return Promise.resolve(typeof answer === "function" ? answer() : answer);
		},
	});
	return { asked, labels, restore: () => Object.defineProperty(ConfirmModal.prototype, "confirm", saved) };
}

/** A vault whose adapter keeps files, backups included, in memory. */
export function memoryVault(): { files: Map<string, string>; app: App } {
	const files = new Map<string, string>();
	const under = (path: string) => [...files.keys()].filter((file) => file.startsWith(`${path}/`));
	const app = { vault: { configDir: ".obsidian", adapter: {
		exists: (path: string) => Promise.resolve(files.has(path) || under(path).length > 0),
		mkdir: () => Promise.resolve(),
		write: (path: string, data: string) => { files.set(path, data); return Promise.resolve(); },
		read: (path: string) => Promise.resolve(files.get(path) ?? ""),
		list: (path: string) => Promise.resolve({ files: under(path), folders: [] }),
		remove: (path: string) => { files.delete(path); return Promise.resolve(); },
	} } } as unknown as App;
	return { files, app };
}

/** A writer that is saving normally and holds every change it was asked to save. */
export function savingWriter(): { isFrozen: boolean; isDestroyed: boolean; persists: () => boolean } {
	return { isFrozen: false, isDestroyed: false, persists: () => true };
}

/** Make every write through `app`'s adapter fail, as a full disk would. */
export function failWrites(app: App): void {
	Object.assign(app.vault.adapter, { write: () => Promise.reject(new Error("ENOSPC")) });
}

/** Where the plugin keeps its files, for backups written through a fake plugin. */
export const PLUGIN_MANIFEST = { id: "callout-studio", dir: ".obsidian/plugins/callout-studio" };
