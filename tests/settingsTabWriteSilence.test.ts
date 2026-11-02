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
 * doubling is what the last case here pins.
 */
import assert from "node:assert";
import { describe, it } from "node:test";
import type { App, EventRef } from "obsidian";
import { CalloutRegistry } from "../src/manager/CalloutRegistry";
import { subscribeSettingsTab } from "../src/settings/sections/tabSubscriptions";
import type { SettingsTabPlugin } from "../src/settings/sections/types";
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
