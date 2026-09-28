import { Component, type App } from "obsidian";
import { getCalloutOccurrenceIndex } from "./occurrenceService";

const MENU_WAIT_MS = 200;
const pendingMenus = new WeakMap<App, () => void>();

/** Ready counts open synchronously; cold counts get a short, cancellable head start. */
export function prepareUsageMenu(
	app: App,
	event: MouseEvent,
	registerDisposer: (dispose: () => void) => void,
): Promise<boolean> | undefined {
	pendingMenus.get(app)?.();
	const index = getCalloutOccurrenceIndex(app);
	if (index.status === "ready") return undefined;

	// currentTarget is cleared after the click handler returns, before any await.
	const anchor = event.currentTarget as HTMLElement | null;
	const ownerDoc = anchor?.ownerDocument ?? activeDocument;
	const ownerWin = ownerDoc.defaultView ?? activeWindow;
	const waiting = new Promise<boolean>((resolve) => {
		const lifetime = new Component();
		lifetime.load();
		let settled = false;
		const finish = (show: boolean): void => {
			if (settled) return;
			settled = true;
			lifetime.unload();
			if (pendingMenus.get(app) === cancel) pendingMenus.delete(app);
			resolve(show);
		};
		const cancel = (): void => finish(false);
		pendingMenus.set(app, cancel);
		registerDisposer(cancel);
		lifetime.registerDomEvent(ownerDoc, "pointerdown", cancel, true);
		lifetime.registerDomEvent(ownerDoc, "keydown", (keyEvent) => {
			if (keyEvent.key === "Escape" || keyEvent.key === "Tab") cancel();
		}, true);
		lifetime.registerDomEvent(ownerWin, "blur", cancel);
		lifetime.registerDomEvent(ownerWin, "pagehide", cancel);
		lifetime.register(index.subscribe(() => {
			if (index.status === "disposed") cancel();
			else if (index.status === "ready" || index.status === "partial") finish(true);
		}));
		const timer = ownerWin.setTimeout(() => finish(true), MENU_WAIT_MS);
		lifetime.register(() => ownerWin.clearTimeout(timer));
		// The item only observes this shared pass; even a partial pass is not retried here.
		void index.ensureFresh().catch(() => finish(true));
	});
	// A later index subscriber can dispose the plugin or redraw Settings in the
	// same notification. Recheck when the awaiting menu is about to resume.
	return waiting.then((show) => show && index.status !== "disposed" && (!anchor || anchor.isConnected));
}
