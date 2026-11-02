/**
 * tests/openIconLibraries.test.ts — the one way into the Manage icon libraries
 * window (settings/iconpicker/openIconLibraries.ts) and the icon counts it is
 * given (settings/iconpicker/sourceCounts.ts).
 *
 * Pick an icon's Manage libraries button and the settings' Icon libraries row
 * both come through the opener, so what is held to it is what neither door may
 * get wrong: the pack files are read back before anything else (a library
 * downloaded in an earlier session reads as missing until then, and the window
 * would list it under "to download"); the door can still say no once they have
 * been read; what a door knows (the counts, the callout being edited) reaches
 * the window, and a door that knows nothing hands it nothing; and the window's
 * answer comes back. The counts are made library by library, and one whose
 * index cannot be read has none rather than a wrong one.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DEFAULT_SETTINGS } from "../src/constants";
import { ICON_SOURCE_IDS } from "../src/icons/registry";
import type { EditedCallout } from "../src/icons/iconLibraries";
import type { IconLibrariesHost } from "../src/settings/iconpicker/IconLibrariesModal";
import { openIconLibraries, type IconLibrariesPlugin } from "../src/settings/iconpicker/openIconLibraries";
import { loadSourceCounts } from "../src/settings/iconpicker/sourceCounts";
import type { IconSourceId } from "../src/types";
import { installFakeDom } from "./support/fakeDom";
import { standInForLibrariesWindow, stubSourceIndexes } from "./support/iconLibrariesDoors";

installFakeDom();

/** A plugin with what the window is given, and a log of what happened to it. */
function setup() {
	const steps: string[] = [];
	const plugin = {
		app: { name: "app" },
		settings: structuredClone(DEFAULT_SETTINGS),
		saves: 0,
		saveSettings(): Promise<void> {
			plugin.saves++;
			return Promise.resolve();
		},
		settingsWriter: { isFrozen: false },
		registry: { getCommitted: () => [], getUserImages: () => [] },
		icons: {
			packs: {
				loadAllFromDisk: () => {
					steps.push("read");
					return Promise.resolve();
				},
			},
			deleteLibrary: () => Promise.resolve(false),
		},
	};
	return { plugin, steps, asPlugin: plugin as unknown as IconLibrariesPlugin };
}

describe("opening the Manage icon libraries window", () => {
	it("reads the pack files before the door is asked, and the door is asked before the window opens", async () => {
		const { steps, asPlugin } = setup();
		const restore = standInForLibrariesWindow(() => {
			steps.push("open");
			return false;
		});
		try {
			await openIconLibraries(asPlugin, {
				beforeOpen: () => {
					steps.push("beforeOpen");
					return true;
				},
			});
			assert.deepEqual(steps, ["read", "beforeOpen", "open"]);
		} finally {
			restore();
		}
	});

	it("opens nothing when the door says no once the files have been read, and answers that nothing changed", async () => {
		const { steps, asPlugin } = setup();
		const restore = standInForLibrariesWindow(() => {
			steps.push("open");
			return true;
		});
		try {
			const changed = await openIconLibraries(asPlugin, { beforeOpen: () => false });
			assert.deepEqual(steps, ["read"], "the files were read, the window was not opened");
			assert.equal(changed, false);
		} finally {
			restore();
		}
	});

	it("gives the window the plugin's own settings, writer, registry, packs and app", async () => {
		const { plugin, asPlugin } = setup();
		let seen: IconLibrariesHost | undefined;
		const restore = standInForLibrariesWindow((host) => {
			seen = host;
			return false;
		});
		try {
			await openIconLibraries(asPlugin);
			assert.ok(seen);
			assert.equal(seen.settings, plugin.settings);
			assert.equal(seen.settingsWriter, plugin.settingsWriter);
			assert.equal(seen.registry, plugin.registry);
			assert.equal(seen.icons, plugin.icons);
			assert.equal(seen.app, plugin.app);
		} finally {
			restore();
		}
	});

	it("saves through the plugin, as the plugin", async () => {
		const { plugin, asPlugin } = setup();
		const restore = standInForLibrariesWindow(async (host) => {
			await host.saveSettings();
			return true;
		});
		try {
			await openIconLibraries(asPlugin);
			assert.equal(plugin.saves, 1);
		} finally {
			restore();
		}
	});

	it("hands over what the door knows: the counts and the callout being edited", async () => {
		const { asPlugin } = setup();
		const editing: EditedCallout = { id: "note", name: "Note", icon: { type: "lucide", value: "star" } };
		let seen: IconLibrariesHost | undefined;
		const restore = standInForLibrariesWindow((host) => {
			seen = host;
			return false;
		});
		try {
			await openIconLibraries(asPlugin, { editing, countFor: (id) => (id === "lucide" ? 1700 : undefined) });
			assert.equal(seen?.editing, editing);
			assert.equal(seen?.countFor("lucide"), 1700);
			assert.equal(seen?.countFor("tabler"), undefined);
		} finally {
			restore();
		}
	});

	it("hands over nothing for what the door does not know", async () => {
		// The settings know no callout being edited and have made no counts of the
		// picker's; the window then shows no count and asks about no draft.
		const { asPlugin } = setup();
		let seen: IconLibrariesHost | undefined;
		const restore = standInForLibrariesWindow((host) => {
			seen = host;
			return false;
		});
		try {
			await openIconLibraries(asPlugin);
			assert.equal(seen?.editing, undefined);
			for (const id of ICON_SOURCE_IDS) assert.equal(seen?.countFor(id), undefined, id);
		} finally {
			restore();
		}
	});

	it("answers with what the window answers", async () => {
		const { asPlugin } = setup();
		for (const answer of [true, false]) {
			const restore = standInForLibrariesWindow(() => answer);
			try {
				assert.equal(await openIconLibraries(asPlugin), answer);
			} finally {
				restore();
			}
		}
	});
});

describe("counting the icons of every library", () => {
	/** Console warnings during `body`, which a library that cannot be counted writes. */
	async function warnings(body: () => Promise<void>): Promise<string[]> {
		const original = console.warn;
		const told: string[] = [];
		console.warn = (...args: unknown[]) => {
			told.push(String(args[0]));
		};
		try {
			await body();
		} finally {
			console.warn = original;
		}
		return told;
	}

	it("counts each library from its index", async () => {
		const restore = stubSourceIndexes((id) => ICON_SOURCE_IDS.indexOf(id) + 1);
		try {
			const counts = new Map<IconSourceId, number>();
			assert.equal(await loadSourceCounts(counts), true);
			assert.deepEqual(
				ICON_SOURCE_IDS.map((id) => counts.get(id)),
				ICON_SOURCE_IDS.map((_id, index) => index + 1),
			);
		} finally {
			restore();
		}
	});

	it("leaves out a library whose index cannot be read, says so, and counts the rest", async () => {
		const restore = stubSourceIndexes((id) => (id === "tabler" ? new Error("no index") : 5));
		try {
			const counts = new Map<IconSourceId, number>();
			let finished = false;
			const told = await warnings(async () => {
				finished = await loadSourceCounts(counts);
			});
			assert.equal(finished, true);
			assert.equal(counts.has("tabler"), false, "no count rather than a wrong one");
			assert.equal(counts.size, ICON_SOURCE_IDS.length - 1);
			assert.equal(told.length, 1);
			assert.ok(told[0]!.includes("tabler"));
		} finally {
			restore();
		}
	});

	it("stops as soon as it is told it is out of date, and says it did not finish", async () => {
		const restore = stubSourceIndexes(() => 3);
		try {
			const counts = new Map<IconSourceId, number>();
			let asked = 0;
			const finished = await loadSourceCounts(counts, () => ++asked <= 2);
			assert.equal(finished, false);
			assert.equal(counts.size, 2, "the two counted while it was current, and no more");
		} finally {
			restore();
		}
	});

	it("stops the same way while a library that cannot be counted is being reported", async () => {
		const restore = stubSourceIndexes(() => new Error("no index"));
		try {
			let finished = true;
			const told = await warnings(async () => {
				finished = await loadSourceCounts(new Map(), () => false);
			});
			assert.equal(finished, false);
			assert.deepEqual(told, [], "an out-of-date count is not worth a warning");
		} finally {
			restore();
		}
	});
});
