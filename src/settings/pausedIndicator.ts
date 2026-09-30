/**
 * settings/pausedIndicator.ts — saving is paused, and it says so where it can
 * be seen.
 *
 * A paused session announced itself once, in a notice at launch that was often
 * gone before anyone looked; after that only the settings page said so, and
 * edits made in the meantime looked saved and vanished on restart. On desktop
 * a status bar item stays up while saving is paused. On mobile, which has no
 * status bar, a notice stays up until it is dismissed or saving resumes. Both
 * open Callout Studio settings, where the cause and the way out are. A new
 * install's provisional pause is not news and shows neither.
 *
 * When a pause someone could have seen ends, a short notice says saving is back
 * on: after a restore, a replaced file or a file that synced back in, the
 * banner used to just vanish, and a worried reader was left to guess whether
 * it had worked. A pause that ended within {@link RESUME_NOTICE_AFTER_MS} is
 * left unannounced: the automatic retries resolved it, and news of the end of
 * something nobody saw is only noise.
 */
import { Notice, Platform, setIcon } from "obsidian";
import type { Plugin } from "obsidian";
import { t } from "../i18n";
import { openPluginSettings } from "../manager/settingsNotices";
import type { SettingsWriter } from "../manager/SettingsWriter";

export interface PausedIndicatorHost extends Pick<Plugin, "app" | "manifest" | "addStatusBarItem" | "register"> {
	settingsWriter: Pick<SettingsWriter, "isVisiblyPaused" | "isDestroyed" | "status">;
}

/**
 * Longer than the reload queue's automatic retries (250 + 750 + 2000 ms; see
 * manager/reloadQueue.ts) and the settle reads around them.
 */
export const RESUME_NOTICE_AFTER_MS = 5_000;

export function registerPausedIndicator(host: PausedIndicatorHost, mobile: boolean = Platform.isMobile): void {
	const writer = host.settingsWriter;
	const open = () => { openPluginSettings(host.app, host.manifest.id); };
	let item: HTMLElement | null = null;
	let notice: Notice | null = null;
	// A missing file at launch already has a notice that stays; do not add a second.
	let announced = writer.isVisiblyPaused && writer.status.frozenReason === "missing";
	/** When the current visible pause began; kept through a thaw the same step undoes. */
	let pausedSince: number | null = null;
	let settling = false;
	/**
	 * Decided on a microtask, not at the thaw itself: an adoption can thaw and
	 * freeze again in one step (a rebuild that fails), and that is not a resume.
	 * A pause that comes straight back keeps its original start.
	 */
	const settleResume = () => {
		settling = true;
		queueMicrotask(() => {
			settling = false;
			if (writer.isDestroyed || writer.isVisiblyPaused || pausedSince === null) return;
			const noticeable = Date.now() - pausedSince >= RESUME_NOTICE_AFTER_MS;
			pausedSince = null;
			if (noticeable) new Notice(t("saveStatus.resumed"));
		});
	};
	const update = () => {
		const paused = writer.isVisiblyPaused && !writer.isDestroyed;
		if (paused) pausedSince ??= Date.now();
		else if (pausedSince !== null && !settling) settleResume();
		if (!mobile) {
			if (paused && !item) {
				item = host.addStatusBarItem();
				item.addClass("cs-paused-status", "mod-clickable");
				item.setAttribute("aria-label", t("statusBar.pausedTooltip"));
				item.setAttribute("data-tooltip-position", "top");
				setIcon(item.createSpan({ cls: "cs-paused-status-icon" }), "alert-triangle");
				item.createSpan({ text: t("statusBar.paused") });
				item.addEventListener("click", open);
			}
			if (paused) item?.show();
			else item?.hide();
			return;
		}
		if (!paused) {
			notice?.hide();
			notice = null;
			announced = false;
			return;
		}
		if (announced) return;
		announced = true;
		const frag = createFragment();
		frag.createEl("p", { text: t("statusBar.pausedNotice") });
		const link = frag.createEl("a", { text: t("saveStatus.openSettings"), cls: "cs-notice-action" });
		notice = new Notice(frag, 0);
		link.addEventListener("click", (event) => {
			event.preventDefault();
			if (openPluginSettings(host.app, host.manifest.id)) notice?.hide();
		});
	};
	host.register(writer.status.subscribe(update));
	host.register(() => { item?.remove(); notice?.hide(); });
	update();
}
