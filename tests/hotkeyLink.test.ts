/**
 * tests/hotkeyLink.test.ts — reading every shortcut bound to a command, and
 * jumping to the pane that edits it.
 *
 * `hotkeysForCommand` exists because Obsidian's own `printHotkeyForCommand`
 * reports only the first binding, which means this plugin has to read the key
 * tables itself and re-implement the formatting. Both halves of that are silent
 * failure modes: a wrong resolution rule shows shortcuts that do not work, and
 * drifted formatting has the same chord read two ways in two windows. Neither
 * announces itself at runtime, so they are pinned here.
 *
 * `openHotkeySettings` is the other half of the file and goes through internals
 * just as deep. Its failure mode is quieter still: a deep link that finds
 * nothing must *say* so, because a settings window that opens on the wrong tab
 * with no explanation reads as the button being broken.
 *
 * The `obsidian` stub reports `Platform.isMacOS === false` by default, so the
 * expected output throughout is the spelled-out Windows/Linux form. The macOS
 * glyph stack is in `hotkeyLinkMac.test.ts` — `hotkeyLink` reads the platform
 * once at module scope, so the two answers cannot both be true in one process.
 */
import { fakeDom, type FakeElement } from "./support/fakeDom";
import assert from "node:assert";
import { describe, it } from "node:test";
import { Platform, type App } from "obsidian";
import { t } from "../src/i18n";
import {
	fullCommandId,
	hotkeysForCommand,
	openHotkeySettings,
	printHotkeyForCommand,
} from "../src/settings/hotkeyLink";
import type { ObsidianSettingTab, StoredHotkey } from "../src/types";

/** Just enough `App` for the reader: the two key tables and nothing else. */
function fakeApp(tables: {
	custom?: Record<string, StoredHotkey[]>;
	defaults?: Record<string, StoredHotkey[]>;
	throws?: boolean;
	/** Omit the table readers entirely, as an older build would. */
	legacy?: string;
}): App {
	const manager = tables.legacy
		? { printHotkeyForCommand: (): string => tables.legacy as string }
		: {
				getHotkeys: (id: string): StoredHotkey[] | undefined => {
					if (tables.throws) throw new Error("boom");
					return tables.custom?.[id];
				},
				getDefaultHotkeys: (id: string): StoredHotkey[] | undefined =>
					tables.defaults?.[id],
			};
	return { hotkeyManager: manager } as unknown as App;
}

describe("hotkeysForCommand — which table wins", () => {
	it("reads the defaults when the user has never customized the command", () => {
		const app = fakeApp({
			defaults: { "cs:wrap": [{ modifiers: ["Mod"], key: "K" }] },
		});
		assert.deepStrictEqual(hotkeysForCommand(app, "cs:wrap"), ["Ctrl + K"]);
	});

	it("lets a custom binding REPLACE the default rather than join it", () => {
		const app = fakeApp({
			custom: { "cs:wrap": [{ modifiers: ["Alt"], key: "J" }] },
			defaults: { "cs:wrap": [{ modifiers: ["Mod"], key: "K" }] },
		});
		assert.deepStrictEqual(hotkeysForCommand(app, "cs:wrap"), ["Alt + J"]);
	});

	// The reason the implementation uses `??` and not `||`. An empty custom list
	// is the user having deleted every shortcut; falling through to the defaults
	// would advertise a binding that no longer fires.
	it("treats an empty custom list as unassigned, not as absent", () => {
		const app = fakeApp({
			custom: { "cs:wrap": [] },
			defaults: { "cs:wrap": [{ modifiers: ["Mod"], key: "K" }] },
		});
		assert.deepStrictEqual(hotkeysForCommand(app, "cs:wrap"), []);
	});

	it("returns every binding, not just the first", () => {
		const app = fakeApp({
			custom: {
				"cs:wrap": [
					{ modifiers: ["Mod"], key: "K" },
					{ modifiers: ["Mod", "Shift"], key: "K" },
					{ modifiers: [], key: "F6" },
				],
			},
		});
		assert.deepStrictEqual(hotkeysForCommand(app, "cs:wrap"), [
			"Ctrl + K",
			"Ctrl + Shift + K",
			"F6",
		]);
	});

	it("reads as unassigned rather than throwing when the tables misbehave", () => {
		assert.deepStrictEqual(hotkeysForCommand(fakeApp({ throws: true }), "x"), []);
		assert.deepStrictEqual(hotkeysForCommand({} as App, "x"), []);
	});

	it("falls back to the one-shortcut helper on a build without the tables", () => {
		const app = fakeApp({ legacy: "Ctrl + K" });
		assert.deepStrictEqual(hotkeysForCommand(app, "cs:wrap"), ["Ctrl + K"]);
	});
});

describe("hotkeysForCommand — formatting", () => {
	const one = (hotkey: StoredHotkey): string => {
		const app = fakeApp({ custom: { id: [hotkey] } });
		return hotkeysForCommand(app, "id")[0] ?? "";
	};

	it("emits modifiers in Obsidian's order, not the stored order", () => {
		assert.strictEqual(
			one({ modifiers: ["Shift", "Alt", "Mod"], key: "K" }),
			"Ctrl + Alt + Shift + K",
		);
	});

	it("prefers the physical code and strips its Key prefix", () => {
		assert.strictEqual(one({ modifiers: ["Mod"], code: "KeyJ" }), "Ctrl + J");
		// Only a four-character "Key…" is a letter code. Anything longer keeps
		// every character, or a hypothetical "Keyboard" code would shorten to "b".
		assert.strictEqual(one({ modifiers: [], code: "Keyboard" }), "Keyboard");
		assert.strictEqual(one({ modifiers: [], code: "Numpad0" }), "Numpad0");
	});

	it("draws the arrow keys and Space as the pane draws them", () => {
		assert.strictEqual(one({ modifiers: [], key: "ArrowUp" }), "↑");
		assert.strictEqual(one({ modifiers: [], key: " " }), "Space");
	});

	it("splits a camel-cased key name and capitalizes a bare letter", () => {
		assert.strictEqual(one({ modifiers: [], key: "PageUp" }), "Page Up");
		assert.strictEqual(one({ modifiers: [], key: "a" }), "A");
	});

	it("drops a binding with no key at all", () => {
		assert.deepStrictEqual(
			hotkeysForCommand(fakeApp({ custom: { id: [{ modifiers: ["Mod"] }] } }), "id"),
			[],
		);
	});
});

describe("hotkeysForCommand — the modifiers, off a Mac", () => {
	const one = (hotkey: StoredHotkey): string =>
		hotkeysForCommand(fakeApp({ custom: { id: [hotkey] } }), "id")[0] ?? "";

	// `Mod` is the whole reason the table is platform-dependent: it means ⌘ on a
	// Mac and Ctrl everywhere else. Here it collapses onto Ctrl, which is also
	// what a literal `Ctrl` prints — so the two are indistinguishable in the
	// output, and only their macOS spellings tell them apart.
	it("prints Mod and Ctrl alike", () => {
		assert.strictEqual(one({ modifiers: ["Mod"], key: "K" }), "Ctrl + K");
		assert.strictEqual(one({ modifiers: ["Ctrl"], key: "K" }), "Ctrl + K");
	});

	it("prints Meta as the Windows key", () => {
		assert.strictEqual(one({ modifiers: ["Meta"], key: "K" }), "Win + K");
	});

	it("spells the chord out with ` + ` rather than stacking glyphs", () => {
		assert.strictEqual(
			one({ modifiers: ["Mod", "Alt", "Shift"], key: "K" }),
			"Ctrl + Alt + Shift + K",
		);
	});

	it("keeps every modifier, including the pair that print the same", () => {
		// Order is the table's, and `Mod` precedes `Ctrl` in it.
		assert.strictEqual(
			one({ modifiers: ["Ctrl", "Mod"], key: "K" }),
			"Ctrl + Ctrl + K",
		);
	});

	it("prints a bare key with no separator to leave dangling", () => {
		assert.strictEqual(one({ modifiers: [], key: "F6" }), "F6");
	});

	it("ignores a modifier Obsidian's table does not know", () => {
		assert.strictEqual(
			one({
				modifiers: ["Hyper" as unknown as "Mod", "Alt"],
				key: "K",
			}),
			"Alt + K",
		);
	});
});

describe("printHotkeyForCommand — the single-binding helper", () => {
	it("hands back what Obsidian's own helper says", () => {
		const app = fakeApp({ legacy: "Ctrl + K" });
		assert.strictEqual(printHotkeyForCommand(app, "cs:wrap"), "Ctrl + K");
	});

	it("is empty rather than throwing when the helper is missing or angry", () => {
		assert.strictEqual(printHotkeyForCommand({} as App, "x"), "");
		const angry = {
			hotkeyManager: {
				printHotkeyForCommand: (): string => {
					throw new Error("boom");
				},
			},
		} as unknown as App;
		assert.strictEqual(printHotkeyForCommand(angry, "x"), "");
	});

	it("normalizes a falsy answer to the empty string", () => {
		const app = {
			hotkeyManager: {
				printHotkeyForCommand: () => undefined as unknown as string,
			},
		} as unknown as App;
		assert.strictEqual(printHotkeyForCommand(app, "x"), "");
	});
});

/* -------------------------------------------------------------------------- */
/* fullCommandId                                                              */
/* -------------------------------------------------------------------------- */

describe("fullCommandId", () => {
	// This is how Obsidian keys a plugin command, and the key the user's hotkey
	// hangs off — which is why command ids are stable API and must never be
	// renamed after release.
	it("joins the plugin id and the short id with a colon", () => {
		assert.strictEqual(
			fullCommandId("callout-studio", "wrap-selection"),
			"callout-studio:wrap-selection",
		);
	});

	it("does not sanitize, trim or lowercase either half", () => {
		// Nothing here may "fix" an id: the string has to match what
		// `addCommand` registered, character for character, or the lookup misses
		// and the shortcut chip goes blank.
		assert.strictEqual(fullCommandId("A b", " c "), "A b: c ");
	});

	it("survives a short id that itself contains a colon", () => {
		assert.strictEqual(fullCommandId("p", "a:b"), "p:a:b");
	});
});

/* -------------------------------------------------------------------------- */
/* openHotkeySettings                                                         */
/* -------------------------------------------------------------------------- */

/** A settings pane, with a record of everything asked of it. */
function fakePane(options: {
	/** Omit `setting` entirely, as a build without the internal would. */
	absent?: boolean;
	/** Omit `openTabById`, the one method the guard actually tests for. */
	noOpener?: boolean;
	/** Return a tab with no `setQuery`, forcing the DOM fallback. */
	tabWithoutSetQuery?: boolean;
	/** Return no tab at all, forcing the DOM fallback. */
	noTab?: boolean;
	throws?: boolean;
}): { app: App; log: string[] } {
	const log: string[] = [];
	if (options.absent) return { app: {} as App, log };

	const setting = {
		open: () => log.push("open"),
		openTabById: (id: string): ObsidianSettingTab | null => {
			log.push(`openTabById:${id}`);
			if (options.throws) throw new Error("boom");
			if (options.noTab) return null;
			if (options.tabWithoutSetQuery) return {};
			return {
				setQuery: (query: string) => log.push(`setQuery:${query}`),
			};
		},
	};
	if (options.noOpener) {
		delete (setting as Partial<typeof setting>).openTabById;
	}
	return { app: { setting } as unknown as App, log };
}

/** Every `new Notice(...)` raised since the last reset. */
const notices: string[] = [];
(globalThis as unknown as { __CS_NOTICES__?: string[] }).__CS_NOTICES__ =
	notices;

/**
 * Fresh screen, fresh notice log, no timer left over.
 *
 * Called first by every `openHotkeySettings` case, which is what lets this
 * suite go without setup hooks like the rest of `tests/`. Timers come first
 * deliberately: several cases below end with a retry still pending, and letting
 * one fire into the next case would start it with a stray notice and a search
 * of a DOM that no longer exists.
 */
function reset(): void {
	fakeDom.window.clearTimers();
	fakeDom.document.body.empty();
	notices.length = 0;
}

/** The settings window's outer element, as Obsidian classes it. */
function buildModal(): FakeElement {
	return fakeDom.document.body.createDiv({ cls: "modal mod-settings" });
}

/**
 * That window with one search box inside its tab content container — the shape
 * `applyHotkeySearchFilter` is written to find. `flat` drops the container, so
 * the modal itself is the search root.
 */
function mountSettingsModal(options: { flat?: boolean } = {}): {
	modal: FakeElement;
	input: FakeElement;
} {
	const modal = buildModal();
	const root = options.flat
		? modal
		: modal.createDiv({ cls: "vertical-tab-content-container" });
	return { modal, input: root.createEl("input", { type: "search" }) };
}

/**
 * The window mid-mount: on screen, with its tab container in place but no
 * search box in it yet. Returns that container, so a test can finish the mount
 * where the real one would rather than beside it.
 */
function mountEmptySettingsModal(): FakeElement {
	return buildModal().createDiv({ cls: "vertical-tab-content-container" });
}

describe("openHotkeySettings — the exact path", () => {
	it("opens the pane, switches to the hotkeys tab and fills its search box", () => {
		reset();
		const { app, log } = fakePane({});
		openHotkeySettings(app, "callout-studio:");
		assert.deepStrictEqual(log, [
			"open",
			"openTabById:hotkeys",
			"setQuery:callout-studio:",
		]);
		assert.deepStrictEqual(notices, []);
	});

	it("does not touch the DOM when the pane answered", () => {
		// `setQuery` is exact and runs synchronously with the tab switch; the
		// DOM search below it exists only for builds without it.
		reset();
		const { input } = mountSettingsModal();
		const { app } = fakePane({});
		openHotkeySettings(app, "q");
		assert.strictEqual(input.value, "");
		assert.strictEqual(fakeDom.window.pendingTimers(), 0);
	});
});

describe("openHotkeySettings — when there is no pane to open", () => {
	it("tells the user rather than doing nothing, with no settings object", () => {
		reset();
		const { app } = fakePane({ absent: true });
		openHotkeySettings(app, "q");
		assert.deepStrictEqual(notices, [t("notice.openHotkeysFailed")]);
	});

	it("tells the user when the pane cannot switch tabs", () => {
		reset();
		const { app } = fakePane({ noOpener: true });
		openHotkeySettings(app, "q");
		assert.deepStrictEqual(notices, [t("notice.openHotkeysFailed")]);
	});

	it("tells the user when opening the tab throws", () => {
		reset();
		const { app } = fakePane({ throws: true });
		openHotkeySettings(app, "q");
		assert.deepStrictEqual(notices, [t("notice.openHotkeysFailed")]);
	});
});

describe("openHotkeySettings — the DOM fallback", () => {
	it("fills the search box itself on a build without setQuery", () => {
		reset();
		const { input } = mountSettingsModal();
		const { app } = fakePane({ tabWithoutSetQuery: true });
		openHotkeySettings(app, "callout-studio:");
		assert.strictEqual(input.value, "callout-studio:");
	});

	it("takes the same path when no tab comes back at all", () => {
		reset();
		const { input } = mountSettingsModal();
		const { app } = fakePane({ noTab: true });
		openHotkeySettings(app, "q");
		assert.strictEqual(input.value, "q");
	});

	it("focuses the box and selects what it typed", () => {
		// Both matter to the user: the caret has to land in the field, and the
		// text has to be replaceable without clearing it first.
		reset();
		const { input } = mountSettingsModal();
		openHotkeySettings(fakePane({ noTab: true }).app, "q");
		assert.strictEqual(input.focusCount, 1);
		assert.strictEqual(input.selectCount, 1);
		assert.strictEqual(fakeDom.document.activeElement, input);
	});

	it("fills the search without opening the mobile keyboard", () => {
		reset();
		const { input } = mountSettingsModal();
		const wasMobile = Platform.isMobile;
		try {
			Platform.isMobile = true;
			fakeDom.document.activeElement = null;
			openHotkeySettings(fakePane({ noTab: true }).app, "callout-studio:");
			assert.strictEqual(input.value, "callout-studio:");
			assert.strictEqual(input.focusCount, 0);
			assert.strictEqual(input.selectCount, 0);
			assert.strictEqual(fakeDom.document.activeElement, null);
		} finally { Platform.isMobile = wasMobile; }
	});

	it("announces the change the way a real keystroke would", () => {
		// The pane filters off its own listeners; writing `value` alone changes
		// what is on screen and nothing else.
		reset();
		const { input } = mountSettingsModal();
		const seen: string[] = [];
		for (const type of ["input", "change"]) {
			input.addEventListener(type, () => seen.push(type));
		}
		openHotkeySettings(fakePane({ noTab: true }).app, "q");
		assert.deepStrictEqual(seen, ["input", "change"]);
	});

	it("lets those events bubble, since the listener may be delegated", () => {
		reset();
		const { modal, input } = mountSettingsModal();
		const seen: string[] = [];
		modal.addEventListener("input", () => seen.push("input"));
		openHotkeySettings(fakePane({ noTab: true }).app, "q");
		assert.deepStrictEqual(seen, ["input"]);
		assert.ok(input.value);
	});

	it("searches the modal itself when there is no tab container", () => {
		reset();
		const { input } = mountSettingsModal({ flat: true });
		openHotkeySettings(fakePane({ noTab: true }).app, "q");
		assert.strictEqual(input.value, "q");
	});
});

describe("openHotkeySettings — choosing among several inputs", () => {
	it("skips a disabled, read-only or unrendered candidate", () => {
		reset();
		const modal = buildModal();
		const root = modal.createDiv({ cls: "vertical-tab-content-container" });
		const off = root.createEl("input", { type: "search" });
		off.disabled = true;
		const locked = root.createEl("input", { type: "search" });
		locked.readOnly = true;
		const hidden = root.createEl("input", { type: "search" });
		hidden.rects = 0;
		const good = root.createEl("input", { type: "search" });

		openHotkeySettings(fakePane({ noTab: true }).app, "q");
		assert.strictEqual(good.value, "q");
		for (const skipped of [off, locked, hidden]) {
			assert.strictEqual(skipped.value, "");
		}
	});

	it("prefers a real search input over a merely placeholdered one", () => {
		// The selector list is a precedence order, not a set: the hotkeys pane
		// has other text fields, and typing the query into one of those filters
		// nothing while looking as though it did.
		reset();
		const modal = buildModal();
		const root = modal.createDiv({ cls: "vertical-tab-content-container" });
		const other = root.createEl("input", { attr: { placeholder: "Name" } });
		const search = root.createEl("input", { type: "search" });

		openHotkeySettings(fakePane({ noTab: true }).app, "q");
		assert.strictEqual(search.value, "q");
		assert.strictEqual(other.value, "");
	});

	it("accepts a container-wrapped input when there is no search input", () => {
		reset();
		const modal = buildModal();
		const root = modal.createDiv({ cls: "vertical-tab-content-container" });
		const wrapped = root
			.createDiv({ cls: "search-input-container" })
			.createEl("input", {});

		openHotkeySettings(fakePane({ noTab: true }).app, "q");
		assert.strictEqual(wrapped.value, "q");
	});
});

describe("openHotkeySettings — retrying while the tab mounts", () => {
	it("does not give up on the first miss", () => {
		reset();
		mountEmptySettingsModal();
		openHotkeySettings(fakePane({ noTab: true }).app, "q");
		assert.deepStrictEqual(notices, []);
		assert.strictEqual(fakeDom.window.pendingTimers(), 1);
	});

	it("fills the box as soon as it appears", () => {
		reset();
		const container = mountEmptySettingsModal();
		openHotkeySettings(fakePane({ noTab: true }).app, "q");

		fakeDom.window.flushTimers();
		const input = container.createEl("input", { type: "search" });
		fakeDom.window.flushTimers();

		assert.strictEqual(input.value, "q");
		assert.strictEqual(fakeDom.window.pendingTimers(), 0);
		assert.deepStrictEqual(notices, []);
	});

	it("gives up after twelve attempts and says so", () => {
		// Silence would be the wrong failure: the settings window IS open by
		// then, on the right tab, showing every command in the vault.
		reset();
		mountEmptySettingsModal();
		openHotkeySettings(fakePane({ noTab: true }).app, "q");
		for (let i = 0; i < 11; i++) fakeDom.window.flushTimers();

		assert.deepStrictEqual(notices, [t("notice.filterHotkeysFailed")]);
		assert.strictEqual(fakeDom.window.pendingTimers(), 0);
	});

	it("keeps retrying quietly right up to that point", () => {
		reset();
		mountEmptySettingsModal();
		openHotkeySettings(fakePane({ noTab: true }).app, "q");
		for (let i = 0; i < 10; i++) fakeDom.window.flushTimers();
		assert.deepStrictEqual(notices, []);
		assert.strictEqual(fakeDom.window.pendingTimers(), 1);
	});

	it("retries when the settings window is not on screen at all", () => {
		// Nothing to search yet is the same state as a half-built tab.
		reset();
		openHotkeySettings(fakePane({ noTab: true }).app, "q");
		assert.strictEqual(fakeDom.window.pendingTimers(), 1);
		assert.deepStrictEqual(notices, []);
	});
});
