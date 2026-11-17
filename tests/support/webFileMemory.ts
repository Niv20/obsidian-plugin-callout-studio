/**
 * tests/support/webFileMemory.ts — one device's memory of the website files
 * it wrote, for the suites that stand a device up without a `DeviceLocalStore`.
 *
 * Not a `*.test.ts`, so `scripts/run-tests.mjs` never treats it as an entry
 * point; it is bundled into each suite that imports it.
 *
 * A device refreshes a file by itself only where it left it as it is
 * (`src/manager/web/fileMemory.ts`), so "written by hand, then refreshed
 * automatically" is a claim about one device, and a suite that makes it needs
 * the two calls to share a memory. A plugin stand-in *without* one is a device
 * that answers for nothing — which is what a second device is, the first time
 * it meets another's files.
 */
import type { WebFileMemory } from "../../src/manager/web/fileMemory";

export interface FakeWebFileMemory extends WebFileMemory {
	/** What is held, by name. */
	held: Map<string, string>;
}

export function webFileMemory(): FakeWebFileMemory {
	const held = new Map<string, string>();
	return {
		held,
		webFile: (name) => held.get(name),
		setWebFile: (name, hash) => void held.set(name, hash),
	};
}
