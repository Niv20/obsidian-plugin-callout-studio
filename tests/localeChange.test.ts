/**
 * tests/localeChange.test.ts — what happens when a translation arrives late.
 *
 * Because only English is bundled, "late" is the normal case: on the launch
 * that first selects a language, the UI paints in English, the file downloads,
 * and the locale flips over some hundreds of milliseconds later. Most of the
 * plugin does not care — it calls `t()` as it draws, so the next paint is
 * already translated. Three surfaces do care, because each one *snapshots*
 * translated text at a moment that has already passed:
 *
 * - the **settings tab**, which is a DOM tree built once and left on screen;
 * - the **fold chevron's tooltip**, baked into a CodeMirror widget when the
 *   decoration was built (`refreshRenderModes`);
 * - a **command's name**, which Obsidian copies out of the object handed to
 *   `addCommand` and never reads again — true of the six fixed commands and of
 *   the user's own alike, since `describeCommand` renders those through `t()`
 *   too, which is why the manager's sweep is on the list.
 *
 * `applyLocaleChange()` is the one place that re-renders all of them, and this
 * file is about it. Two things are easy to get wrong and both are covered:
 * re-registering a command must reuse its **id**, or the user's hotkey is
 * silently unbound — and `ensureLocale()` must only call it when the locale
 * *really* changed, or a failed download at startup rebuilds the whole UI for
 * nothing.
 *
 * `applyLocaleChange` and `refreshRenderModes` are invoked through
 * `CalloutStudioPlugin.prototype` against a hand-built `this`. Constructing a
 * real plugin would mean constructing Obsidian; calling the prototype method
 * runs the shipping code and supplies only the handful of members it touches.
 *
 * `registeredNames` inside `editor/commands.ts` is module state shared by this
 * whole file, exactly as it is shared by a running plugin — a fresh `host()`
 * does not reset it. Every test below therefore registers its **own** locale
 * with its own name prefix, so "the rendered name changed" is true regardless
 * of what any earlier test left behind, and no test inherits another's.
 */
import assert from "node:assert";
import { describe, it } from "node:test";
import { MarkdownView } from "obsidian";
import type { Command, WorkspaceLeaf } from "obsidian";
import CalloutStudioPlugin from "../src/main";
import {
	FIXED_COMMAND_IDS,
	FIXED_COMMAND_NAME_KEYS,
} from "../src/editor/commands";
import { DEFAULT_SETTINGS } from "../src/constants";
import { en } from "../src/i18n/en";
import { getLocale, registerLocale, setLocale, t } from "../src/i18n";
import type { PluginSettings } from "../src/types";

/**
 * The three methods under test, each run against a hand-built `this`.
 *
 * Wrapped rather than pulled off the prototype into a bare const so the call
 * is what the linter sees: an unbound method reference is worth flagging in
 * shipping code, and `.call()` at the point of use is the whole technique here.
 */
const applyLocaleChange = (self: CalloutStudioPlugin): void =>
	CalloutStudioPlugin.prototype.applyLocaleChange.call(self);

const ensureLocale = (self: CalloutStudioPlugin): Promise<boolean> =>
	CalloutStudioPlugin.prototype.ensureLocale.call(self);

const refreshRenderModes = (self: CalloutStudioPlugin): void =>
	CalloutStudioPlugin.prototype.refreshRenderModes.call(self);

/* -------------------------------------------------------------------------- */
/* Harness                                                                    */
/* -------------------------------------------------------------------------- */

interface Host {
	self: CalloutStudioPlugin;
	/** Every `addCommand` payload, in order. */
	added: Command[];
	/** How many times the settings tab was re-rendered. */
	displays: () => number;
	/** How many times the two preview modes were rebuilt. */
	renders: () => number;
	/** How many times the user's own commands were swept. */
	sweeps: () => number;
	settings: PluginSettings;
	/** Detach the settings tab, as Obsidian does when the pane is closed. */
	closeSettings: () => void;
	/** Drop the settings tab entirely, as at startup before it is built. */
	dropSettings: () => void;
}

function host(): Host {
	const added: Command[] = [];
	let displays = 0;
	let renders = 0;
	let sweeps = 0;
	const settings = structuredClone(DEFAULT_SETTINGS);

	const self = {
		settings,
		settingsTab: {
			containerEl: { isConnected: true },
			display: () => {
				displays++;
			},
		},
		addCommand: (command: Command) => {
			added.push(command);
			return command;
		},
		refreshRenderModes: () => {
			renders++;
		},
		// The user's own command names are rendered through `t()` too, so the
		// manager's sweep is the fourth surface a locale change has to reach.
		// Counted rather than exercised: what it does is customCommandSync's.
		customCommands: {
			syncAll: () => {
				sweeps++;
			},
		},
		// The windows the fixed commands open. Both throw: re-registering a
		// command must never construct one — `addCommand` only ever stores the
		// callback.
		commandDeps: () => ({
			openEditor: () => {
				throw new Error("no window may be opened by a name refresh");
			},
			openQuickInsert: () => {
				throw new Error("no window may be opened by a name refresh");
			},
		}),
	};

	return {
		self: self as unknown as CalloutStudioPlugin,
		added,
		displays: () => displays,
		renders: () => renders,
		sweeps: () => sweeps,
		settings,
		closeSettings: () => {
			self.settingsTab.containerEl.isConnected = false;
		},
		dropSettings: () => {
			(self as { settingsTab?: unknown }).settingsTab = undefined;
		},
	};
}

/**
 * Register and activate a translation covering only the fixed command names,
 * under an invented code, so nothing here depends on a real language's wording
 * — and so every name differs from whatever the last test registered.
 */
function useCommandLocale(code: string): void {
	const strings: Record<string, string> = {};
	for (const id of FIXED_COMMAND_IDS) {
		strings[FIXED_COMMAND_NAME_KEYS[id]] = `${code}:${id}`;
	}
	registerLocale(code, strings);
	setLocale(code);
}

/** The names `t()` would render for them, right now. */
const currentNames = (): string[] =>
	FIXED_COMMAND_IDS.map((id) => t(FIXED_COMMAND_NAME_KEYS[id]));

/* -------------------------------------------------------------------------- */
/* The surfaces                                                               */
/* -------------------------------------------------------------------------- */

describe("applyLocaleChange re-renders what snapshots translated text", () => {
	it("re-renders all of them in one call", () => {
		useCommandLocale("surface");
		const h = host();

		applyLocaleChange(h.self);

		assert.strictEqual(h.displays(), 1, "the settings tab was not re-rendered");
		assert.strictEqual(h.renders(), 1, "the preview modes were not rebuilt");
		assert.strictEqual(h.sweeps(), 1, "the user's own commands were not swept");
		assert.deepStrictEqual(
			h.added.map((c) => c.name),
			currentNames(),
			"the commands kept their old names",
		);
	});

	it("sweeps the user's own commands once per call", () => {
		// Their names come from `t()` by way of `describeCommand`, so a
		// translation landing mid-session has to reach them too — otherwise a
		// user-built command sits in the palette in the old language until the
		// next restart. The sweep is idempotent and keyed on the rendered name,
		// so calling it here costs nothing when nothing moved.
		const h = host();

		applyLocaleChange(h.self);
		applyLocaleChange(h.self);

		assert.strictEqual(h.sweeps(), 2);
	});

	it("names commands through t(), so English is what an untranslated build shows", () => {
		setLocale("en");
		assert.deepStrictEqual(
			currentNames(),
			FIXED_COMMAND_IDS.map((id) => en[FIXED_COMMAND_NAME_KEYS[id]]),
		);
	});

	it("leaves a detached settings tab alone", () => {
		// Re-rendering a container no one is looking at throws away work, and
		// the path where the *user* picked the language re-renders the picker
		// itself anyway.
		const h = host();
		h.closeSettings();

		applyLocaleChange(h.self);

		assert.strictEqual(h.displays(), 0);
		assert.strictEqual(h.renders(), 1, "the other surfaces still run");
		assert.strictEqual(h.sweeps(), 1, "the other surfaces still run");
	});

	it("survives being called before the settings tab exists", () => {
		// The startup ordering: the background locale pass can land before
		// `onLayoutReady` has built the tab.
		const h = host();
		h.dropSettings();

		assert.doesNotThrow(() => {
			applyLocaleChange(h.self);
		});
		assert.strictEqual(h.renders(), 1);
		assert.strictEqual(h.sweeps(), 1);
	});

	it("rebuilds the preview modes every time, translated text or not", () => {
		// The fold chevron's tooltip is baked into a CodeMirror widget, so
		// there is nothing to diff against — it is rebuilt unconditionally.
		const h = host();
		applyLocaleChange(h.self);
		applyLocaleChange(h.self);
		applyLocaleChange(h.self);
		assert.strictEqual(h.renders(), 3);
	});
});

/* -------------------------------------------------------------------------- */
/* Command names                                                              */
/* -------------------------------------------------------------------------- */

describe("a command's name follows the locale without losing its hotkey", () => {
	it("re-registers at the same id when the rendered name changed", () => {
		// Obsidian keys the user's hotkey by command id, and `removeCommand`
		// clears only `defaultKeys` — so re-adding at the same id is exactly
		// what makes a late translation free rather than destructive.
		useCommandLocale("before");
		const h = host();
		applyLocaleChange(h.self);
		const first = h.added.splice(0);
		assert.deepStrictEqual(first.map((c) => c.id), [...FIXED_COMMAND_IDS]);

		useCommandLocale("after");
		applyLocaleChange(h.self);

		assert.deepStrictEqual(
			h.added.map((c) => c.id),
			first.map((c) => c.id),
			"a command changed id, which unbinds the user's hotkey",
		);
		assert.deepStrictEqual(
			h.added.map((c) => c.name),
			FIXED_COMMAND_IDS.map((id) => `after:${id}`),
		);
	});

	it("registers nothing when the locale changed but the names did not", () => {
		// `addCommand` mutates its argument and appends an unload callback, so
		// a needless call accumulates both. A locale that has not translated
		// the command names must therefore be free, not merely harmless.
		// Two genuinely different locales that happen to render the five
		// command names identically — a real case for languages that leave
		// short imperatives in English, and the general case for any edit that
		// is not to a command name.
		const sameNames = (extra: string): Record<string, string> => {
			const strings: Record<string, string> = { "settings.language": extra };
			for (const id of FIXED_COMMAND_IDS) {
				strings[FIXED_COMMAND_NAME_KEYS[id]] = `shared:${id}`;
			}
			return strings;
		};
		registerLocale("twin-a", sameNames("A"));
		registerLocale("twin-b", sameNames("B"));

		setLocale("twin-a");
		const h = host();
		applyLocaleChange(h.self);
		const registered = h.added.length;
		assert.strictEqual(registered, FIXED_COMMAND_IDS.length);

		setLocale("twin-b");
		assert.strictEqual(getLocale(), "twin-b", "the locale really did change");
		applyLocaleChange(h.self);

		assert.strictEqual(h.added.length, registered, "addCommand ran again");
		assert.strictEqual(t("settings.language"), "B");
	});

	it("re-registers only the commands whose name really moved", () => {
		useCommandLocale("moved");
		const h = host();
		applyLocaleChange(h.self);
		h.added.splice(0);

		// One key retranslated, the other four identical to "moved".
		const strings: Record<string, string> = {};
		for (const id of FIXED_COMMAND_IDS) {
			strings[FIXED_COMMAND_NAME_KEYS[id]] = `moved:${id}`;
		}
		strings[FIXED_COMMAND_NAME_KEYS["callout-wrap"]] = "only:wrap";
		registerLocale("one-changed", strings);
		setLocale("one-changed");
		applyLocaleChange(h.self);

		assert.deepStrictEqual(h.added.map((c) => c.id), ["callout-wrap"]);
		assert.strictEqual(h.added[0]?.name, "only:wrap");
	});

	it("skips a fixed command the user switched off", () => {
		// A disabled command is torn down with `removeCommand`, so re-adding it
		// on a locale change would put it back in the palette and the hotkeys
		// pane the moment a translation landed.
		useCommandLocale("disabled-case");
		const h = host();
		h.settings.disabledFixedCommands = ["callout-wrap", "open-settings"];

		applyLocaleChange(h.self);

		assert.deepStrictEqual(
			h.added.map((c) => c.id),
			FIXED_COMMAND_IDS.filter(
				(id) => id !== "callout-wrap" && id !== "open-settings",
			),
		);
	});

	it("hands addCommand a fresh object each time", () => {
		useCommandLocale("fresh-one");
		const h = host();
		applyLocaleChange(h.self);
		const first = h.added.splice(0);

		useCommandLocale("fresh-two");
		applyLocaleChange(h.self);

		for (const command of h.added) {
			assert.ok(
				!first.includes(command),
				"the same object was handed over twice",
			);
		}
	});
});

/* -------------------------------------------------------------------------- */
/* When it fires                                                              */
/* -------------------------------------------------------------------------- */

describe("ensureLocale applies the change only when there is one", () => {
	interface EnsureHost {
		self: CalloutStudioPlugin;
		applied: () => number;
		destroy: () => void;
	}

	function ensureHost(language: string, ok: boolean): EnsureHost {
		let applied = 0;
		const self = {
			settings: { ...structuredClone(DEFAULT_SETTINGS), language },
			settingsWriter: { isDestroyed: false },
			locales: { ensure: () => Promise.resolve(ok) },
			applyLocaleChange: () => {
				applied++;
			},
		};
		return {
			self: self as unknown as CalloutStudioPlugin,
			applied: () => applied,
			destroy: () => { self.settingsWriter.isDestroyed = true; },
		};
	}

	it("re-renders once the table for the saved language is loaded", async () => {
		setLocale("en");
		registerLocale("arrived", { "settings.language": "ARRIVED" });
		const h = ensureHost("arrived", true);

		assert.strictEqual(await ensureLocale(h.self), true);
		assert.strictEqual(getLocale(), "arrived");
		assert.strictEqual(h.applied(), 1);
		assert.strictEqual(t("settings.language"), "ARRIVED");
	});

	it("does nothing when the language is already active", async () => {
		setLocale("en");
		registerLocale("stable", { "settings.language": "STABLE" });
		setLocale("stable");
		const h = ensureHost("stable", true);

		await ensureLocale(h.self);
		assert.strictEqual(h.applied(), 0);
	});

	it("does nothing when the download failed", async () => {
		// The important one. A user on a plane launches the plugin, the fetch
		// fails, `setLocale` resolves back to English — the locale never
		// changed, so nothing should be torn down and rebuilt.
		setLocale("en");
		const h = ensureHost("th", false);

		assert.strictEqual(await ensureLocale(h.self), false);
		assert.strictEqual(getLocale(), "en");
		assert.strictEqual(h.applied(), 0);
	});

	it("reports the store's verdict so the picker can show a failure", async () => {
		// The startup caller ignores this; the language picker uses it to tell
		// the user the download did not work.
		setLocale("en");
		const failed = ensureHost("vi", false);
		assert.strictEqual(await ensureLocale(failed.self), false);

		registerLocale("worked", { "settings.language": "WORKED" });
		const succeeded = ensureHost("worked", true);
		assert.strictEqual(await ensureLocale(succeeded.self), true);
	});
	it("does not repaint or change the active locale when download finishes after unload", async () => {
		setLocale("en");
		registerLocale("late", { "settings.language": "LATE" });
		const h = ensureHost("late", true);
		const pending = ensureLocale(h.self);
		h.destroy();
		assert.strictEqual(await pending, false);
		assert.strictEqual(getLocale(), "en");
		assert.strictEqual(h.applied(), 0);
	});
});

/* -------------------------------------------------------------------------- */
/* refreshRenderModes                                                         */
/* -------------------------------------------------------------------------- */

describe("refreshRenderModes rebuilds reading view as well as live preview", () => {
	it("re-renders every markdown leaf and ignores the rest", () => {
		// Unlike `refreshCallouts()`, this re-runs the reading-view
		// post-processors, which is what strips or adds already-baked inline
		// and heading callouts — and what re-reads the fold chevron's tooltip.
		const rerendered: boolean[] = [];
		const markdown = Object.assign(
			new MarkdownView(undefined as unknown as WorkspaceLeaf),
			{
				previewMode: {
					rerender: (full: boolean) => {
						rerendered.push(full);
					},
				} as unknown as MarkdownView["previewMode"],
			},
		);

		const self = {
			app: {
				workspace: {
					getLeavesOfType: (type: string) => {
						assert.strictEqual(type, "markdown");
						return [{ view: markdown }, { view: { previewMode: null } }];
					},
				},
			},
		} as unknown as CalloutStudioPlugin;

		refreshRenderModes(self);

		assert.deepStrictEqual(rerendered, [true], "expected one full re-render");
	});

	it("tolerates a markdown leaf with no preview mode yet", () => {
		const self = {
			app: {
				workspace: {
					getLeavesOfType: () => [
						{ view: new MarkdownView(undefined as unknown as WorkspaceLeaf) },
					],
				},
			},
		} as unknown as CalloutStudioPlugin;

		assert.doesNotThrow(() => {
			refreshRenderModes(self);
		});
	});
});
