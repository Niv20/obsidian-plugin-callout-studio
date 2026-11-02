/**
 * tests/support/iconLibrariesDoors.ts — stand-ins for what the two doors of the
 * Manage icon libraries window reach: the window itself, and the icon indexes
 * the counts are made from.
 *
 * Who uses it. The suites of the two doors (declarativeIconLibrariesRow.test.ts)
 * and of the opener they share (openIconLibraries.test.ts).
 */
import { ICON_SOURCE_IDS, getSource } from "../../src/icons/registry";
import type { IconIndex } from "../../src/icons/types";
import { IconLibrariesModal, type IconLibrariesHost } from "../../src/settings/iconpicker/IconLibrariesModal";
import type { IconSourceId } from "../../src/types";

/**
 * Replace the window's `openAndWait`: `onOpen` is told the host the window was
 * given, and its answer is the window's ("whether anything changed").
 *
 * @returns Puts the real one back; call it in a `finally`.
 */
export function standInForLibrariesWindow(
	onOpen: (host: IconLibrariesHost) => boolean | Promise<boolean>,
): () => void {
	const original = Object.getOwnPropertyDescriptor(IconLibrariesModal.prototype, "openAndWait")!;
	IconLibrariesModal.prototype.openAndWait = function (this: IconLibrariesModal) {
		const host = (this as unknown as { host: IconLibrariesHost }).host;
		return Promise.resolve(onOpen(host));
	};
	return () => { Object.defineProperty(IconLibrariesModal.prototype, "openAndWait", original); };
}

/**
 * Replace every library's `loadIndex`: `outcome` says how many icons the
 * library offers, or an error for one whose index cannot be read.
 *
 * @returns Puts the real ones back; call it in a `finally`.
 */
export function stubSourceIndexes(outcome: (id: IconSourceId) => number | Error): () => void {
	const originals = ICON_SOURCE_IDS.map((id) => {
		const pack = getSource(id);
		const descriptor = Object.getOwnPropertyDescriptor(pack, "loadIndex")!;
		pack.loadIndex = () => {
			const result = outcome(id);
			if (result instanceof Error) return Promise.reject(result);
			const index: IconIndex = { entries: Array.from({ length: result }, () => ({}) as never), categories: [] };
			return Promise.resolve(index);
		};
		return { pack, descriptor };
	});
	return () => {
		for (const { pack, descriptor } of originals) Object.defineProperty(pack, "loadIndex", descriptor);
	};
}
