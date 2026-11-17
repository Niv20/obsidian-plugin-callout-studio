/**
 * manager/web/autoUpdate.ts — keeps the website files in step with the
 * callouts, once they exist.
 *
 * A website export is a snapshot, and a snapshot goes stale the moment a
 * colour changes. For two of the services that is all that stands between a
 * change and the site: Quartz reads its plugin out of the vault on every
 * build, and Obsidian Publish lists `publish.js` under *Publish changes* like
 * any note. So once the file is current, the rest is what the user already
 * does. This module makes the file current.
 *
 * **Always, for every target, and for nothing that is not there.** Writing a
 * target by hand on the Publish to the web panel
 * (`webPanel/WebPanelView.ts`) is what asks for it; from then on its
 * files are rewritten when the callouts change. It was a switch per target
 * until 2026-11-15, off by default — a file that had to be remembered was a
 * site that fell behind, and the switch was one more thing to explain on a
 * page that has enough. Nothing here ever creates a file or replaces one the
 * user edited: `exportWebTarget` is called with `auto`, which refreshes only
 * what exists and is still ours. Deleting a file is how one stops it.
 *
 * No setting says which targets are kept current: what is in the vault is the
 * answer, so a device that never opened the page keeps the files it was synced
 * as current as the one that wrote them. A note is found by its property
 * wherever it is, and the usual place of Quartz's is looked at in both places
 * it can be, for the moment the metadata cache lags a write. A device that was not running when a callout
 * changed catches up with {@link WebAutoUpdate.catchUp}, once the workspace is
 * ready, and one that was running is told when the settings another device
 * saved are adopted here (`main.ts`).
 *
 * **Every device that has the files, and only over its own version of them.**
 * A device with other callouts, with settings that have not arrived yet or
 * with another build would write other bytes, and two such devices would put
 * each other's files back at every start. So a refresh replaces a file only
 * where this device left it as it is (`fileMemory.ts`), and it does not run
 * at all while the settings on this device are not known to be the user's
 * ({@link WebAutoUpdateOptions.held}).
 *
 * Writes are debounced well past a burst of edits — dragging a colour slider
 * is dozens of registry changes, and each write is a sync event.
 */
import type { App } from "obsidian";
import type { TargetOptions, WebTargetId } from "./targets";
import type { WebExportPlugin } from "./webData";
import { exportWebTarget, summarize } from "./writeTarget";

/** How long the callouts must sit still before the files are rewritten. */
export const WEB_AUTO_UPDATE_DELAY_MS = 2000;

/** Every place a target's files can be. A new Quartz note goes in one of two. */
const REFRESHES: ReadonlyArray<readonly [WebTargetId, TargetOptions]> = [
	["publish", {}],
	["quartz", {}],
	["quartz", { quartzInVault: true }],
	["garden", {}],
];

export interface WebAutoUpdateOptions {
	/**
	 * Whether the callouts in memory are not the user's settings right now: the
	 * settings file is missing, unreadable or a later build's, and the registry
	 * holds defaults or a recovery copy (`SettingsWriter.isFrozen`). The plugin
	 * writes no settings then, and no website files either — they would carry
	 * to every device what this one could not read. Asked when a refresh runs,
	 * not when it is scheduled; the adoption that ends the state schedules one.
	 */
	held?: () => boolean;
}

export class WebAutoUpdate {
	private timer: number | null = null;
	private destroyed = false;
	private readonly listeners = new Set<() => void>();

	constructor(
		private readonly app: App,
		private readonly plugin: WebExportPlugin,
		private readonly options: WebAutoUpdateOptions = {},
	) {}

	/** A callout or a setting changed: refresh, once things have settled. */
	schedule(): void {
		if (this.destroyed) return;
		if (this.timer !== null) window.clearTimeout(this.timer);
		this.timer = window.setTimeout(() => {
			this.timer = null;
			void this.run();
		}, WEB_AUTO_UPDATE_DELAY_MS);
	}

	/** Refresh now — what a device does on start, having missed the changes. */
	catchUp(): Promise<void> {
		return this.run();
	}

	/**
	 * Be told after a refresh that rewrote something, so a page that shows the
	 * files' state does not go on calling them out of date. Returns the way to
	 * stop being told.
	 */
	onDidWrite(listener: () => void): () => void {
		this.listeners.add(listener);
		return () => this.listeners.delete(listener);
	}

	private async run(): Promise<void> {
		let wrote = false;
		for (const [target, options] of REFRESHES) {
			if (this.destroyed || this.options.held?.()) return;
			// Never throws, and never asks: see `exportWebTarget`'s `auto`.
			const outcome = await exportWebTarget(this.app, this.plugin, target, { ...options, auto: true });
			if (summarize(outcome) === "updated") wrote = true;
		}
		if (!wrote || this.destroyed) return;
		for (const listener of [...this.listeners]) listener();
	}

	destroy(): void {
		this.destroyed = true;
		this.listeners.clear();
		if (this.timer !== null) window.clearTimeout(this.timer);
		this.timer = null;
	}
}
