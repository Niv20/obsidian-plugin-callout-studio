/**
 * icons/iconLibraries.ts — which icon libraries Pick an icon offers, and in
 * what order.
 *
 * The one reader of `settings.iconLibraries` (the order the user arranged, and
 * the built-in libraries they hid), combined with what this device has
 * downloaded. Kept pure — the pack store comes in as the two questions it is
 * asked — so the picker's menu, its "All sources" pool, the Icon libraries
 * window and the tests all answer "is this library offered here?" the same way.
 *
 * The rule, in one line: a downloadable library is offered exactly when its
 * files are on this device; a library that ships with the plugin is offered
 * unless the user hid it. Being offered is therefore partly per device (what
 * was downloaded where) and partly synced (the order, and what was hidden).
 */
import type {
	CalloutDefinition,
	CalloutIcon,
	IconLibrarySettings,
	IconPackId,
	IconSourceId,
} from "../types";
import type { PackDataStore } from "./PackDataStore";
import { ICON_SOURCE_IDS, getSource } from "./registry";

/** The two things these helpers ask of the pack store. */
export type PackStates = Pick<PackDataStore, "state" | "info">;

/**
 * Offered when nothing else would be. Settings synced from another device can
 * hide every built-in library on one that has downloaded nothing, and a picker
 * with no library at all would be a dead end. Lucide ships inside Obsidian, so
 * it draws offline and can never fail to.
 */
export const FALLBACK_LIBRARY: IconSourceId = "lucide";

function isKnownLibrary(id: string): id is IconSourceId {
	return (ICON_SOURCE_IDS as readonly string[]).includes(id);
}

/**
 * Whether a library arrives as files to download. Such a library leaves the
 * picker by having its files deleted, so it is never "hidden"; every other
 * library ships with the plugin, cannot be deleted, and is hidden instead.
 */
export function isDownloadable(id: IconSourceId): boolean {
	return getSource(id).kind === "bundledRemote";
}

/** The pack files a library is made of; empty for one that ships with the plugin. */
export function libraryFiles(id: IconSourceId): readonly IconPackId[] {
	const pack = getSource(id);
	return pack.kind === "bundledRemote" ? (pack.dataPacks ?? []) : [];
}

/**
 * Whether every file of a downloadable library is loaded on this device.
 *
 * Every file, not any: Font Awesome is three, and with only Brands on disk the
 * Solid and Regular names would be blank cells — the same reason the picker's
 * download prompt asks for the missing files rather than declaring it ready.
 */
export function isDownloaded(id: IconSourceId, packs: PackStates): boolean {
	const files = libraryFiles(id);
	return files.length > 0 && files.every((file) => packs.state(file) === "ready");
}

/**
 * Whether any file of a downloadable library is on this device.
 *
 * Looser than `isDownloaded` on purpose: a library with only some of its files
 * is not offered, but it still takes up space, and Delete and the window's
 * reset arrow have to be able to take it away.
 */
export function isInstalled(id: IconSourceId, packs: PackStates): boolean {
	return libraryFiles(id).some((file) => packs.state(file) === "ready");
}

/** Whether Pick an icon offers this library on this device. */
export function isInPicker(
	id: IconSourceId,
	prefs: IconLibrarySettings,
	packs: PackStates,
): boolean {
	return isDownloadable(id) ? isDownloaded(id, packs) : !prefs.hidden.includes(id);
}

/**
 * Every library, in the user's order.
 *
 * Ids this build does not know (a newer build's) are skipped. A library the
 * saved list lacks — the list is still empty, or a later release added the
 * library — goes in right after the library that comes before it in the
 * catalog, wherever the user moved that one: a new library turns up beside its
 * catalog neighbour rather than at either end of an arranged list.
 */
export function libraryOrder(prefs: IconLibrarySettings): IconSourceId[] {
	const order = [...new Set(prefs.order.filter(isKnownLibrary))];
	ICON_SOURCE_IDS.forEach((id, index) => {
		if (order.includes(id)) return;
		let at = 0;
		for (let previous = index - 1; previous >= 0; previous--) {
			const found = order.indexOf(ICON_SOURCE_IDS[previous]!);
			if (found !== -1) {
				at = found + 1;
				break;
			}
		}
		order.splice(at, 0, id);
	});
	return order;
}

/** The libraries Pick an icon offers here, in the user's order. Never empty. */
export function pickerSources(
	prefs: IconLibrarySettings,
	packs: PackStates,
): IconSourceId[] {
	const offered = libraryOrder(prefs).filter((id) => isInPicker(id, prefs, packs));
	return offered.length > 0 ? offered : [FALLBACK_LIBRARY];
}

/** What the picker's library menu holds. */
export interface MenuLibraries {
	/**
	 * The library of the icon being edited, when Pick an icon does not offer it:
	 * deleted from this device, downloaded only on another one, only partly
	 * downloaded, or a built-in library the user hid. Null when it is offered —
	 * it is then among `libraries` like any other — or when nothing is edited.
	 */
	readonly current: IconSourceId | null;
	/** What Pick an icon offers here, in the user's order — the All sources pool too. */
	readonly libraries: readonly IconSourceId[];
	/**
	 * Every downloadable library this device lacks, in catalog order, including
	 * `current` when it still needs downloading. The menu's closing line counts
	 * these libraries independently of which icon is being edited.
	 */
	readonly toDownload: readonly IconSourceId[];
}

/**
 * The picker's library menu.
 *
 * It lists only what Pick an icon offers (`libraries`), so every library in it
 * can be drawn from right now; a library is downloaded in the Manage icon
 * libraries window, and the menu just counts what is left there
 * (`toDownload`).
 *
 * The one exception is `current`, the library of the icon being edited. A
 * callout keeps its icon when its library is deleted, and a synced callout can
 * use a library this device never downloaded; editing such a callout opens the
 * picker on that library, so the menu has to show it — under its own heading,
 * since it is not one of the libraries on offer — and keep it there after the
 * person looks elsewhere, as the way back. Choosing it shows the download
 * prompt, or, for a hidden built-in library, its icons.
 */
export function menuLibraries(
	prefs: IconLibrarySettings,
	packs: PackStates,
	current?: IconSourceId,
): MenuLibraries {
	const libraries = pickerSources(prefs, packs);
	const edited = current !== undefined && !libraries.includes(current) ? current : null;
	return {
		current: edited,
		libraries,
		toDownload: ICON_SOURCE_IDS.filter(
			(id) => isDownloadable(id) && !isDownloaded(id, packs),
		),
	};
}

/**
 * `order` with the libraries of `shown` rearranged into the sequence given,
 * each one into a slot one of them already held. Every other library keeps its
 * place.
 *
 * This is how a drag among the libraries this device offers is saved without
 * disturbing where the others sit: a library downloaded only on another device
 * keeps the place it was given there.
 */
export function reorderShown(
	order: readonly IconSourceId[],
	shown: readonly IconSourceId[],
): IconSourceId[] {
	const moving = shown.filter((id) => order.includes(id));
	const slots = new Set(moving);
	let next = 0;
	return order.map((id) => (slots.has(id) ? moving[next++]! : id));
}

/**
 * The list to save once the user has arranged this build's libraries: those,
 * in their new order, then any id a newer build wrote that this one cannot
 * place. Kept at the end rather than dropped, so a device a release ahead does
 * not lose its library from the list over a reorder made here.
 *
 * Arranged back into the catalog order, the list is saved empty — which is
 * what an empty list means — so the reset arrow and Reset everything see an
 * untouched order as untouched.
 */
export function savedLibraryOrder(
	previous: readonly string[],
	arranged: readonly IconSourceId[],
): string[] {
	const unknown = previous.filter((id) => !isKnownLibrary(id));
	const isCatalogOrder = arranged.length === ICON_SOURCE_IDS.length &&
		arranged.every((id, index) => id === ICON_SOURCE_IDS[index]);
	return isCatalogOrder && unknown.length === 0 ? [] : [...arranged, ...unknown];
}

/**
 * The bytes a library's files take — all of them, or with `missingOnly` just
 * the ones this device still lacks, which is what a download would fetch.
 */
export function libraryBytes(
	id: IconSourceId,
	packs: PackStates,
	missingOnly = false,
): number {
	return libraryFiles(id)
		.filter((file) => !missingOnly || packs.state(file) !== "ready")
		.reduce((total, file) => total + (packs.info(file)?.bytes ?? 0), 0);
}

/** "625 KB", "1.6 MB" — 1024-based, as the picker's download prompt has always said them. */
export function formatBytes(bytes: number): string {
	const kb = bytes / 1024;
	return kb >= 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${Math.round(kb)} KB`;
}

/**
 * The callouts whose icon comes from this library: what has to keep drawing
 * once its files are gone. A callout with its icon turned off counts too — its
 * icon is still stored and comes back when the icon is turned on.
 *
 * Theme rows are left out. They are rebuilt from the theme's CSS on every load
 * and never saved, so there is nothing of theirs to keep.
 */
export function calloutsUsingLibrary(
	defs: readonly CalloutDefinition[],
	id: IconSourceId,
): CalloutDefinition[] {
	const files = new Set<string>(libraryFiles(id));
	return defs.filter((def) => def.source !== "theme" && files.has(def.icon.type));
}

/**
 * The callout Pick an icon is choosing an icon for, as the callout editor holds
 * it right now.
 *
 * The registry knows only saved callouts; the editor keeps the icon it was just
 * handed until Save. So download a library, pick one of its icons, and the only
 * user of that library is this edit — which is exactly when the person goes on
 * to delete the library, so it has to count as a user and have its drawings
 * kept like any saved callout's.
 */
export interface EditedCallout {
	/** Its id in the registry; null while the callout is new. */
	id: string | null;
	/** The name the editor shows for it. */
	name: string;
	/** The icon the editor holds for it now, saved or not. */
	icon: CalloutIcon;
}

/** The edit, when its icon comes from this library; otherwise null. */
export function editedUsingLibrary(
	edited: EditedCallout | null | undefined,
	id: IconSourceId,
): EditedCallout | null {
	return edited && libraryFiles(id).includes(edited.icon.type) ? edited : null;
}

/**
 * By name, everything that has to keep drawing once this library's files are
 * gone: the saved callouts using it, then the callout being edited when its
 * unsaved icon does. An empty list is what lets the library be deleted without
 * a question.
 *
 * A saved callout counts once, whether its saved icon, its edit or both come
 * from the library; and one whose saved icon does keeps counting after its edit
 * moves on, since until Save the saved icon is what every note draws.
 */
export function calloutNamesUsingLibrary(
	defs: readonly CalloutDefinition[],
	id: IconSourceId,
	edited?: EditedCallout | null,
): string[] {
	const saved = calloutsUsingLibrary(defs, id);
	const names = saved.map((def) => def.displayName || def.id);
	const unsaved = editedUsingLibrary(edited, id);
	if (unsaved && !(unsaved.id !== null && saved.some((def) => def.id === unsaved.id))) {
		names.push(unsaved.name);
	}
	return names;
}
