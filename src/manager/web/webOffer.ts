/**
 * manager/web/webOffer.ts — which services the settings page offers to set
 * up, for a vault that looks published.
 *
 * Who calls it. The settings tab, once each time it opens
 * ({@link refreshWebOffer}); the offer's row
 * (`settings/declarative/bannerRows.ts`); and the Publish to the web panel
 * (`webPanel/WebPanelView.ts`), which ends the offer when it is opened.
 *
 * The main idea.
 * - The offer names every service the vault points at (`detectService.ts`),
 *   hints included: a wrong guess costs one press on ✕, and the commonest
 *   Quartz layout leaves nothing but a hint.
 * - **The offer only shows the way.** Its button scrolls to the Publish to the
 *   web row and flashes it, as the import offer does with the Import row, so
 *   the reader learns where the page is and not only that it exists.
 * - **Each service is offered once.** It stops being offered when the offer is
 *   dismissed, when the Publish to the web panel is opened (it shows every
 *   service the vault points at, tagged), or when its files are already in the
 *   vault — written on another device, or before the offer existed. A service
 *   that turns up later (a site started a year after the plugin was installed)
 *   is new, and is offered then.
 * - What was offered is remembered per device, with the rest of the website
 *   export's memory (`DeviceLocalStore`): a backup restored into another vault
 *   says nothing about how *that* vault is published.
 * - Looking at the vault takes file reads, and a row's `visible` cannot wait
 *   for them. So the look is done when the tab opens and kept for the session,
 *   and the page is drawn again only if the answer changed.
 */
import type { App } from "obsidian";
import type { DeviceLocalStore } from "../DeviceLocalStore";
import { detectServices } from "./detectService";
import { GARDEN_NOTE, newNotePath, PUBLISH_JS, QUARTZ_NOTE, type WebTargetId } from "./targets";
import { locateWebNote } from "./webNoteLocation";

/** The plugin, as far as the offer is concerned. */
export interface WebOfferHost {
	localState: Pick<DeviceLocalStore, "webExport" | "setWebExport">;
}

/** What the last look at the vault found, per plugin. Kept for the session. */
const found = new WeakMap<WebOfferHost, WebTargetId[]>();

const handled = (host: WebOfferHost): readonly string[] => host.localState.webExport.offered ?? [];

/** The services to name in the offer now, most convincing first. */
export function webServicesToOffer(host: WebOfferHost): WebTargetId[] {
	const detected = found.get(host);
	// Before the first look, and in a vault that points nowhere: nothing, and
	// the device's memory is not even read.
	if (!detected?.length) return [];
	const done = handled(host);
	return detected.filter((id) => !done.includes(id));
}

/** Stop offering `ids`. Returns whether that changed anything. */
export function markWebOfferHandled(host: WebOfferHost, ids: readonly WebTargetId[]): boolean {
	const memory = host.localState.webExport;
	const done = memory.offered ?? [];
	const added = ids.filter((id) => !done.includes(id));
	if (added.length === 0) return false;
	host.localState.setWebExport({ ...memory, offered: [...done, ...added] });
	return true;
}

/** Whether a service's files are in the vault already. Cheap: no snapshot is built. */
async function isSetUp(app: App, id: WebTargetId): Promise<boolean> {
	const { adapter } = app.vault;
	try {
		if (id === "quartz") {
			return (
				(await locateWebNote(app, QUARTZ_NOTE, newNotePath("quartz"))).found ||
				(await locateWebNote(app, QUARTZ_NOTE, newNotePath("quartz", { quartzInVault: true }))).found
			);
		}
		if (id === "garden") return (await locateWebNote(app, GARDEN_NOTE, newNotePath("garden"))).found;
		if (id === "publish") {
			return (
				(await adapter.exists(PUBLISH_JS)) && (await adapter.read(PUBLISH_JS)).includes("callout-studio:start")
			);
		}
	} catch {
		// Unreadable is not "set up": the offer is the smaller mistake.
	}
	return false;
}

/**
 * Look at the vault again. Resolves to whether the services to offer changed,
 * which is when the settings page needs drawing again. Never rejects.
 */
export async function refreshWebOffer(app: App, host: WebOfferHost): Promise<boolean> {
	try {
		const done = handled(host);
		const before = webServicesToOffer(host).join();
		const detected = (await detectServices(app)).map((detection) => detection.id);
		const setUp: WebTargetId[] = [];
		for (const id of detected) {
			if (!done.includes(id) && (await isSetUp(app, id))) setUp.push(id);
		}
		markWebOfferHandled(host, setUp);
		found.set(host, detected);
		return webServicesToOffer(host).join() !== before;
	} catch {
		return false;
	}
}
