/**
 * manager/web/fileMemory.ts — which website files this device answers for.
 *
 * The files are in the vault, so a sync service carries them to every device,
 * and every device that has them keeps them current (`autoUpdate.ts`). That is
 * only safe between devices that would write the same bytes. A device whose
 * callouts are other callouts — the plugin installed there with its own
 * settings, which is how Obsidian Sync leaves a community plugin unless asked
 * otherwise; settings that have not arrived yet; a build that writes other
 * bytes — would put its own version over the site's at every start, and the
 * first device would put its own back at the next one. Nothing in a file says
 * which of two versions is the newer, so the question asked instead is one a
 * device can answer for itself:
 *
 * **A device refreshes a file by itself only when what is on disk is what it
 * left there.** It remembers, per file, a hash of what it last wrote or last
 * found there identical to what it would write. A file that still carries
 * that hash has not been touched by anyone else since, so a difference from
 * what this device would write now is this device's own news, and it writes.
 * Any other content was put there by a device that knew something this one
 * does not, and is left alone until this device agrees with it or the user
 * writes from here by hand (`writeTarget.ts`).
 *
 * Nobody has to be told about it. Two devices with the same callouts and the
 * same build find each other's files identical to their own, and from then on
 * both answer for them: whichever sees a change first writes it, and the
 * other finds it already there.
 *
 * The memory is this device's, never the vault's: in `DeviceLocalStore`,
 * beside the rest of what a device knows that no other should adopt.
 */

/** The part of `DeviceLocalStore` this reads and writes. */
export interface WebFileMemory {
	webFile(name: string): string | undefined;
	setWebFile(name: string, hash: string): void;
}

/**
 * What a device would have written the last time it left another device's
 * file alone, per memory. Kept for the session only, and for one case: the
 * settings arrived here before the file did. The file that then arrives is
 * exactly what this device would have written, and nothing runs when a file
 * arrives — so without this, the next change made here would find a file it
 * never agreed with and leave it alone for good.
 */
const passedOver = new WeakMap<WebFileMemory, Map<string, string>>();

/** What this device may say about a website file. */
export interface WebFileClaims {
	/** This device has answered for `name` before. */
	holds(name: string): boolean;
	/** `hash` is what this device left in `name`, or would have. */
	recognises(name: string, hash: string): boolean;
	/** `hash` is in `name` now and is what this device writes: it answers for the file. */
	agreed(name: string, hash: string): void;
	/** This device would have written `hash` to `name`, and left another device's content there. */
	passed(name: string, hash: string): void;
}

/**
 * The claims of one device. With no memory — a stand-in for the plugin that
 * has none — a device recognises nothing, so an automatic refresh replaces
 * nothing: the safe answer, and never the one that puts a site's files back.
 */
export function claimsOf(memory: WebFileMemory | undefined): WebFileClaims {
	if (!memory) return { holds: () => false, recognises: () => false, agreed: () => {}, passed: () => {} };
	const passed = (): Map<string, string> => {
		let map = passedOver.get(memory);
		if (!map) {
			map = new Map<string, string>();
			passedOver.set(memory, map);
		}
		return map;
	};
	return {
		holds: (name) => memory.webFile(name) !== undefined,
		recognises: (name, hash) => memory.webFile(name) === hash || passedOver.get(memory)?.get(name) === hash,
		agreed(name, hash) {
			passedOver.get(memory)?.delete(name);
			memory.setWebFile(name, hash);
		},
		passed: (name, hash) => void passed().set(name, hash),
	};
}
