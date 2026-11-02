/**
 * tests/hotkeyLinkMac.test.ts — the same chords, on a Mac.
 *
 * `hotkeyLink` reproduces Obsidian's own formatting tables rather than
 * delegating to them, because the helper that owns them stringifies
 * `hotkeys[0]` and stops — a command bound to two shortcuts can only ever
 * report one through it. Duplicating them means they can drift, and the drift
 * is invisible on the machine the developer happens to be using: the whole
 * platform half of the table only ever runs on the other one.
 *
 * Two differences carry the file, and both are what a Mac user reads as the
 * shortcut being written wrong:
 *
 * - `Mod` means ⌘ here and Ctrl everywhere else. That is the entire point of
 *   the token, and it is the one place `Mod` and a literal `Ctrl` stop being
 *   indistinguishable in the output (see the Windows suite, where both print
 *   "Ctrl").
 * - macOS **stacks** the parts with a space, where every other platform spells
 *   the chord out with " + ". A `⌘ + ⇧ + K` is not how any Mac writes it.
 *
 * The joiner sits between *every* part, the key included, so a single-modifier
 * chord reads `⌘ K` rather than `⌘K` — pinned below because it is the kind of
 * detail a "tidy-up" would change without noticing it is the whole difference
 * between the two platforms' output.
 *
 * The tables are built once, at module scope, from `Platform.isMacOS` — right
 * for a plugin, since the platform cannot change under a running app, and the
 * reason this is a file of its own: the seam has to be set before `obsidian` is
 * even loaded, which only an import ordered ahead of everything can do, and
 * `node --test` gives each test file the process that makes that possible.
 */
import "./support/macPlatform";
import assert from "node:assert";
import { describe, it } from "node:test";
import { Platform } from "obsidian";
import type { App } from "obsidian";
import { hotkeysForCommand } from "../src/settings/hotkeyLink";
import type { StoredHotkey } from "../src/types";

/** Just enough `App` for the reader: one custom binding list, and nothing else. */
function macApp(hotkeys: StoredHotkey[]): App {
	return {
		hotkeyManager: { getHotkeys: () => hotkeys },
	} as unknown as App;
}

const one = (hotkey: StoredHotkey): string => hotkeysForCommand(macApp([hotkey]), "id")[0] ?? "";

describe("the seam itself", () => {
	it("really did put the module in macOS mode", () => {
		// Guards the whole file: if the import order ever stops taking effect,
		// every assertion below would quietly re-test the Windows table.
		assert.strictEqual(Platform.isMacOS, true);
	});
});

describe("hotkeysForCommand on macOS — the glyphs", () => {
	it("draws Mod as ⌘, not as Ctrl", () => {
		assert.strictEqual(one({ modifiers: ["Mod"], key: "K" }), "⌘ K");
	});

	it("draws a literal Ctrl as ⌃, which Mod is NOT", () => {
		// The one platform where the two tokens are distinguishable in the
		// output. A binding stored as `Ctrl` really does mean the Control key
		// here, and printing it as ⌘ would advertise a chord that does nothing.
		assert.strictEqual(one({ modifiers: ["Ctrl"], key: "K" }), "⌃ K");
	});

	it("draws Meta as ⌘ as well — the same physical key", () => {
		assert.strictEqual(one({ modifiers: ["Meta"], key: "K" }), "⌘ K");
	});

	it("draws Alt as ⌥ and Shift as ⇧", () => {
		assert.strictEqual(one({ modifiers: ["Alt"], key: "K" }), "⌥ K");
		assert.strictEqual(one({ modifiers: ["Shift"], key: "K" }), "⇧ K");
	});
});

describe("hotkeysForCommand on macOS — the joiner", () => {
	it("stacks the glyphs with a space rather than spelling the chord out", () => {
		assert.strictEqual(one({ modifiers: ["Mod", "Shift"], key: "K" }), "⌘ ⇧ K");
	});

	it("emits them in Obsidian's order, not the order they were stored in", () => {
		// ⌘⇧K must never render as ⇧⌘K on one surface and ⌘⇧K on another.
		assert.strictEqual(one({ modifiers: ["Shift", "Alt", "Mod"], key: "K" }), "⌘ ⌥ ⇧ K");
	});

	it("leaves a bare key with no joiner to dangle off", () => {
		assert.strictEqual(one({ modifiers: [], key: "F6" }), "F6");
	});
});

describe("hotkeysForCommand on macOS — the parts that do NOT change", () => {
	// Everything below the modifier table is platform-independent, and stating
	// so here is what keeps a future edit from moving a key label into the
	// platform branch by accident.
	it("labels the arrow keys and Space the same way", () => {
		assert.strictEqual(one({ modifiers: [], key: "ArrowDown" }), "↓");
		assert.strictEqual(one({ modifiers: [], key: " " }), "Space");
	});

	it("still prefers the physical code and strips its Key prefix", () => {
		assert.strictEqual(one({ modifiers: ["Mod"], code: "KeyJ" }), "⌘ J");
	});

	it("still splits a camel-cased key name and capitalizes a bare letter", () => {
		assert.strictEqual(one({ modifiers: [], key: "PageUp" }), "Page Up");
		assert.strictEqual(one({ modifiers: [], key: "a" }), "A");
	});

	it("still drops a binding with no key at all", () => {
		assert.deepStrictEqual(hotkeysForCommand(macApp([{ modifiers: ["Mod"] }]), "id"), []);
	});

	it("still returns every binding, not just the first", () => {
		assert.deepStrictEqual(
			hotkeysForCommand(
				macApp([
					{ modifiers: ["Mod"], key: "K" },
					{ modifiers: ["Mod", "Alt"], key: "K" },
				]),
				"id",
			),
			["⌘ K", "⌘ ⌥ K"],
		);
	});
});
