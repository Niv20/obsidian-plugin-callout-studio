/**
 * tests/settingsTabWriteSilence.test.ts — opening the settings tab is not a
 * settings change.
 *
 * Three modules the settings tab reaches on its way onto the screen each carry
 * the same promise in a comment and nothing else: they may look at the vault,
 * at the registry and at this device's own state, but none of them may write
 * `data.json`. That promise is issue #41's first property stated at the UI
 * layer — a device that writes nothing gives the sync client nothing to
 * reconcile — and until this file existed all three were held up by prose.
 *
 * - `openEditorDiscovery.ts` reads the notes already on screen and mints rows
 *   for ids the registry has never seen. Discovery's own rule applies: a row
 *   nobody has claimed is an observation this machine made, not configuration,
 *   so it stays in memory and in `DeviceLocalStore`. The module says "No
 *   saveSettings() — see the note above"; nothing checked.
 * - `calloutListsFold.ts` persists a folded section to the device-local store
 *   *instead of* the settings file. Its host type still carries `saveSettings`,
 *   which is exactly the shape a regression would reach for, and every existing
 *   fold test stubs that method out as `() => Promise.resolve()` — a call would
 *   have been invisible to all of them.
 * - `tabSubscriptions.ts` is subscribed once per **visit**, not per render,
 *   because `display()` re-runs for a synced settings file and for a locale
 *   download. Re-subscribing on each would stack listeners for the life of the
 *   session, and every stacked listener multiplies the repaint that the scroll
 *   anchor then has to hide. The doubling is what the last case here pins.
 *
 * What this file deliberately does not reach for is `SettingsTab` itself: the
 * class renders fifteen sections to say one thing about two lines of `display()`.
 * The units below are where the promises live.
 */
import assert from "node:assert";
import { describe, it } from "node:test";
import { MarkdownView, Setting } from "obsidian";
import type { App, EventRef, WorkspaceLeaf } from "obsidian";
import { CalloutRegistry } from "../src/manager/CalloutRegistry";
import { scanOpenEditorsForUnknownCallouts } from "../src/settings/sections/openEditorDiscovery";
import { attachPersistedFold } from "../src/settings/sections/calloutListsFold";
import { subscribeSettingsTab } from "../src/settings/sections/tabSubscriptions";
import type { SettingsTabPlugin } from "../src/settings/sections/types";
import type { CalloutListsFoldState } from "../src/types";
import { installFakeDom } from "./support/fakeDom";

installFakeDom();

/** A registry holding the shipped built-ins and nothing else. */
function builtInsOnly(): CalloutRegistry {
	const registry = new CalloutRegistry();
	registry.load(null);
	return registry;
}

/* -------------------------------------------------------------------------- */
/* The open-editor sweep                                                      */
/* -------------------------------------------------------------------------- */

/** A workspace leaf showing a markdown note with `content` in its editor. */
function markdownLeaf(content: string) {
	return {
		view: Object.assign(new MarkdownView(undefined as unknown as WorkspaceLeaf), {
			editor: { getValue: () => content },
		}),
	};
}

/** A leaf reporting as markdown while showing something that is not. */
function foreignLeaf(content: string) {
	return { view: { editor: { getValue: () => content } } };
}

function sweep(
	leaves: unknown[],
	options: { autoDiscover?: boolean; registry?: CalloutRegistry } = {},
) {
	const registry = options.registry ?? builtInsOnly();
	const seen = { saves: 0, refreshes: 0 };
	const added: string[] = [];

	const app = {
		workspace: { getLeavesOfType: () => leaves },
	} as unknown as App;

	const plugin = {
		registry,
		settings: { autoDiscoverCallouts: options.autoDiscover ?? true },
		addUnknownCalloutsAsFallback: (ids: string[]): number => {
			added.push(...ids);
			return ids.length;
		},
		refreshCallouts: (): void => {
			seen.refreshes += 1;
		},
		saveSettings: (): Promise<void> => {
			seen.saves += 1;
			return Promise.resolve();
		},
	} as unknown as SettingsTabPlugin;

	scanOpenEditorsForUnknownCallouts(app, plugin);
	return { added, ...seen };
}

describe("the open-editor sweep reads the vault and writes nothing", () => {
	it("mints a row for an id only an open note knows about", () => {
		const result = sweep([markdownLeaf("> [!zeta] hello\n> body")]);

		assert.deepStrictEqual(result.added, ["zeta"]);
		assert.strictEqual(
			result.refreshes,
			1,
			"a row it added has to reach the stylesheet",
		);
	});

	it("does not save the row it just minted", () => {
		const result = sweep([markdownLeaf("> [!zeta] hello")]);

		assert.strictEqual(
			result.saves,
			0,
			"opening a settings tab must not write data.json — issue #41",
		);
	});

	it("stays silent on the file however many rows it adds", () => {
		const result = sweep([
			markdownLeaf("> [!zeta] one"),
			markdownLeaf("> [!eta] two"),
			markdownLeaf("> [!theta] three"),
		]);

		assert.strictEqual(result.added.length, 3);
		assert.strictEqual(result.saves, 0);
	});

	it("does nothing at all when automatic discovery is switched off", () => {
		const result = sweep([markdownLeaf("> [!zeta] hello")], {
			autoDiscover: false,
		});

		assert.deepStrictEqual(result.added, []);
		assert.strictEqual(result.refreshes, 0);
		assert.strictEqual(result.saves, 0);
	});

	it("folds the two spellings of one id across leaves into a single row", () => {
		// Obsidian renders `[!my note]` and `[!my-note]` as the same
		// `data-callout`, so two open notes describe one callout, not two.
		const result = sweep([
			markdownLeaf("> [!my note] spaced"),
			markdownLeaf("> [!my-note] dashed"),
		]);

		assert.deepStrictEqual(
			result.added,
			["my note"],
			"the spaced spelling is the one the editor's ID field produces",
		);
	});

	it("skips a leaf that is not showing a markdown view", () => {
		const result = sweep([foreignLeaf("> [!zeta] hello")]);

		assert.deepStrictEqual(result.added, []);
		assert.strictEqual(result.refreshes, 0);
		assert.strictEqual(result.saves, 0);
	});

	it("neither refreshes nor writes when every open note is already known", () => {
		const result = sweep([markdownLeaf("> [!note] a built-in\n> body")]);

		assert.deepStrictEqual(result.added, []);
		assert.strictEqual(result.refreshes, 0);
		assert.strictEqual(result.saves, 0);
	});

	it("reads an empty editor without reaching the registry", () => {
		const result = sweep([markdownLeaf("")]);

		assert.deepStrictEqual(result.added, []);
		assert.strictEqual(result.saves, 0);
	});
});

/* -------------------------------------------------------------------------- */
/* A folded section                                                           */
/* -------------------------------------------------------------------------- */

const click = (el: HTMLElement): void => {
	el.dispatchEvent({ type: "click" } as unknown as Event);
};

function foldRow(initiallyExpanded = true) {
	const host: HTMLElement = createDiv();
	const setting = new Setting(host);
	setting.setName("My callout types");
	const body: HTMLElement = host.createDiv();

	const state: CalloutListsFoldState = {
		theme: true,
		user: initiallyExpanded,
		builtin: true,
		palettes: true,
	};
	const seen = { saves: 0, localWrites: 0 };

	const plugin = {
		localState: {
			isExpanded: (kind: keyof CalloutListsFoldState): boolean =>
				state[kind],
			setExpanded: (
				kind: keyof CalloutListsFoldState,
				expanded: boolean,
			): void => {
				state[kind] = expanded;
				seen.localWrites += 1;
			},
		},
		saveSettings: (): Promise<void> => {
			seen.saves += 1;
			return Promise.resolve();
		},
	};

	const fold = attachPersistedFold(setting, body, "user", plugin);
	return { setting, body, state, seen, fold };
}

describe("a section's fold is device state, not settings", () => {
	it("opens from whatever this device last left behind", () => {
		const collapsed = foldRow(false);
		assert.strictEqual(collapsed.fold.isExpanded(), false);

		const open = foldRow(true);
		assert.strictEqual(open.fold.isExpanded(), true);
	});

	it("writes a hand-folded section to the device store", () => {
		const row = foldRow();

		click(row.setting.nameEl);

		assert.strictEqual(row.state.user, false);
		assert.strictEqual(row.seen.localWrites, 1);
	});

	it("never saves the settings file, in either direction", () => {
		const row = foldRow();

		click(row.setting.nameEl);
		click(row.setting.nameEl);

		assert.strictEqual(row.state.user, true, "back where it started");
		assert.strictEqual(
			row.seen.saves,
			0,
			"folding a section used to rewrite the synced file — issue #41",
		);
	});

	it("leaves the other three sections alone", () => {
		const row = foldRow();

		click(row.setting.nameEl);

		assert.strictEqual(row.state.theme, true);
		assert.strictEqual(row.state.builtin, true);
		assert.strictEqual(row.state.palettes, true);
	});

	it("records nothing for a fold a caller drove itself", () => {
		const row = foldRow();

		row.fold.setExpanded(false);

		assert.strictEqual(row.fold.isExpanded(), false, "the DOM still folds");
		assert.strictEqual(
			row.seen.localWrites,
			0,
			"only the user's own choice is remembered",
		);
		assert.strictEqual(row.seen.saves, 0);
	});
});

/* -------------------------------------------------------------------------- */
/* The four signals                                                           */
/* -------------------------------------------------------------------------- */

function subscribed() {
	const registry = builtInsOnly();
	const forced: boolean[] = [];
	const dropped = { icon: 0, offref: 0 };

	// Both stubs really unregister, because the assertion below is that a
	// disposed tab stops repainting — a stub that only counted the disposal
	// would pass while the listener was still live, which is the leak itself.
	const iconCallbacks = new Set<() => void>();
	const cssHandlers = new Map<EventRef, () => void>();

	const app = {
		workspace: {
			on: (_name: string, cb: () => void): EventRef => {
				const ref = {} as EventRef;
				cssHandlers.set(ref, cb);
				return ref;
			},
			offref: (ref: EventRef): void => {
				dropped.offref += 1;
				cssHandlers.delete(ref);
			},
		},
	} as unknown as App;

	const plugin = {
		registry,
		onIconCacheChange: (cb: () => void): (() => void) => {
			iconCallbacks.add(cb);
			return () => {
				dropped.icon += 1;
				iconCallbacks.delete(cb);
			};
		},
	} as unknown as SettingsTabPlugin;

	const subscribe = () =>
		subscribeSettingsTab(app, plugin, (force) => forced.push(force));

	return {
		registry,
		forced,
		dropped,
		subscribe,
		dispose: subscribe(),
		mutate: (id: string) => {
			registry.add({
				id,
				displayName: id,
				icon: { type: "lucide", value: "info" },
				colorLight: "#336699",
				colorDark: "#88bbee",
				foldable: false,
				defaultFolded: false,
				builtIn: false,
				source: "user",
			});
		},
		fireIcons: () => {
			for (const cb of iconCallbacks) cb();
		},
		fireCss: () => {
			for (const handler of cssHandlers.values()) handler();
		},
	};
}

describe("the settings tab's four signals", () => {
	it("repaints unforced for a registry mutation the signature can read", () => {
		const tab = subscribed();

		tab.mutate("alpha");

		assert.deepStrictEqual(tab.forced, [false]);
	});

	it("forces the repaint for a live preview, which moves no registry state", () => {
		const tab = subscribed();

		tab.registry.setPreviewDefinition({
			id: "in-progress",
			displayName: "In progress",
			icon: { type: "lucide", value: "info" },
			colorLight: "#336699",
			colorDark: "#88bbee",
			foldable: false,
			defaultFolded: false,
			builtIn: false,
			source: "user",
		});

		assert.deepStrictEqual(tab.forced, [true]);
	});

	it("forces it for artwork, which is byte-identical before and after", () => {
		const tab = subscribed();

		tab.fireIcons();

		assert.deepStrictEqual(tab.forced, [true]);
	});

	it("repaints unforced for a theme flip, which the signature reads", () => {
		const tab = subscribed();

		tab.fireCss();

		assert.deepStrictEqual(tab.forced, [false]);
	});

	it("hands back one call that undoes all four", () => {
		const tab = subscribed();

		tab.dispose();
		tab.mutate("alpha");
		tab.fireIcons();
		tab.fireCss();

		assert.deepStrictEqual(tab.forced, [], "a dropped tab still repainting");
		assert.strictEqual(tab.dropped.icon, 1);
		assert.strictEqual(tab.dropped.offref, 1);
	});

	it("doubles every repaint when subscribed twice, which is why display() subscribes once", () => {
		// `display()` re-runs for a synced settings file and for a locale
		// download. It guards with `this.unsubscribe ??=`; this is the cost of
		// dropping that guard, stated so a regression has something to fail.
		const tab = subscribed();

		tab.subscribe();
		tab.mutate("alpha");

		assert.deepStrictEqual(tab.forced, [false, false]);
	});
});
