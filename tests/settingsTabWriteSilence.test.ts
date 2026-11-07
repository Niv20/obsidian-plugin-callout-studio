/**
 * tests/settingsTabWriteSilence.test.ts — opening the settings tab is not a
 * settings change.
 *
 * What the tab listens to may ask for a redraw, never write `data.json`: that
 * promise is issue #41's first property stated at the UI layer (a device that
 * writes nothing gives the sync client nothing to reconcile).
 *
 * `tabSubscriptions.ts` is subscribed once, for the plugin's life
 * (declarative/declarativeSettings.ts). Subscribing again would stack
 * listeners, and every stacked listener doubles the redraw requests. The
 * doubling is what the last case of the signals pins.
 *
 * A preview standing over a row is not forced: the last suite shows the
 * signature it relies on instead sees a draft that changes a row, and ignores
 * one the lists leave out.
 */
import assert from "node:assert";
import { describe, it } from "node:test";
import type { App, EventRef } from "obsidian";
import { CalloutRegistry } from "../src/manager/CalloutRegistry";
import { subscribeSettingsTab } from "../src/settings/sections/tabSubscriptions";
import { calloutListsSignature } from "../src/settings/sections/calloutListsSignature";
import { partitionCallouts } from "../src/settings/sections/rowOwnership";
import type { SettingsContext, SettingsTabPlugin } from "../src/settings/sections/types";
import type { CalloutDefinition } from "../src/types";
import { installFakeDom } from "./support/fakeDom";

installFakeDom();

/** A registry holding the shipped built-ins and nothing else. */
function builtInsOnly(): CalloutRegistry {
	const registry = new CalloutRegistry();
	registry.load(null);
	return registry;
}

/* -------------------------------------------------------------------------- */
/* The four signals                                                           */
/* -------------------------------------------------------------------------- */

/** A draft of a callout of the user's own, in `accent`. */
function draft(accent: string): CalloutDefinition {
	return {
		id: "in-progress",
		displayName: "In progress",
		icon: { type: "lucide", value: "info" },
		colorLight: accent,
		colorDark: "#88bbee",
		foldable: false,
		defaultFolded: false,
		builtIn: false,
		source: "user",
	};
}

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

	const subscribe = () => subscribeSettingsTab(app, plugin, (force) => forced.push(force));

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

	it("repaints a live preview unforced", () => {
		// The signature reads the same registry views the rows are drawn from,
		// which show the draft, so a draft that changes a row changes the
		// signature (see the last suite).
		const tab = subscribed();

		tab.registry.setPreviewDefinition(draft("#336699"));

		assert.deepStrictEqual(tab.forced, [false]);
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
		tab.registry.setPreviewDefinition(draft("#446699"));

		assert.deepStrictEqual(tab.forced, [], "a dropped tab still repainting");
		assert.strictEqual(tab.dropped.icon, 1);
		assert.strictEqual(tab.dropped.offref, 1);
	});

	it("doubles every repaint when subscribed twice, which is why the tab subscribes once", () => {
		// `display()` re-runs for a synced settings file and for a locale
		// download. It guards with `this.unsubscribe ??=`; this is the cost of
		// dropping that guard, stated so a regression has something to fail.
		const tab = subscribed();

		tab.subscribe();
		tab.mutate("alpha");

		assert.deepStrictEqual(tab.forced, [false, false]);
	});
});

/* -------------------------------------------------------------------------- */
/* Why the preview's repaint need not be forced                               */
/* -------------------------------------------------------------------------- */

describe("the lists' signature and the callout editor's draft", () => {
	/** The signature the settings tab compares, built as the tab builds it. */
	function signatureOf(registry: CalloutRegistry): string {
		const ctx = { plugin: { registry, settings: registry.settings } } as unknown as SettingsContext;
		const { fromTheme, own, builtIn } = partitionCallouts(ctx);
		return calloutListsSignature(ctx, "Theme", "en", { theme: fromTheme, user: own, builtin: builtIn });
	}

	function withMine(): CalloutRegistry {
		const registry = builtInsOnly();
		registry.add({ ...draft("#336699"), id: "mine", displayName: "Mine" });
		return registry;
	}

	it("moves when a draft standing over a callout changes its row", () => {
		const registry = withMine();
		const before = signatureOf(registry);

		registry.setPreviewDefinition({ ...draft("#cc3300"), id: "mine", displayName: "Mine" });

		assert.notStrictEqual(signatureOf(registry), before, "a recoloured row would be skipped");
	});

	it("stays put while a name is retyped, whose draft the lists leave out", () => {
		const registry = withMine();
		registry.setPreviewDefinition({ ...draft("#336699"), id: "mine-a", displayName: "Mine a" });
		const typing = signatureOf(registry);

		registry.setPreviewDefinition({ ...draft("#336699"), id: "mine-ab", displayName: "Mine ab" });

		assert.strictEqual(signatureOf(registry), typing, "every letter would rebuild the lists");
	});
});
