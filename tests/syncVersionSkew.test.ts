/**
 * tests/syncVersionSkew.test.ts — two devices, two plugin versions, one file.
 *
 * Every other sync suite here holds one build against itself. That is the case
 * this plugin is never actually in on a synced vault: a desktop updates itself
 * the day a release lands and a phone updates a week later, so for most of a
 * release cycle the two devices reading one `data.json` are running different
 * code.
 *
 * Left alone, that is a permanent write loop. `mergeSavedSettings` names every
 * field it understands and drops the rest — correct for an import file, fatal
 * for a shared one: the older build strips a setting the newer one added and
 * writes the file back without it, the newer build puts it back, and neither
 * ever stops. `SaveGuard` cannot suppress it because the difference is real.
 * That is what a reporter on a Syncthing vault saw as "file-sync tennis" after
 * upgrading one device and not the other (issue #41), and every release that
 * adds a settings field would have started it again.
 *
 * The current build stands in for the *older* one throughout, because that is
 * the side that has to behave: it is handed a file carrying a field it has
 * never heard of, and it must give the field back untouched and write nothing.
 */
import assert from "node:assert";
import { describe, it } from "node:test";
import { CalloutRegistry } from "../src/manager/CalloutRegistry";
import { SaveGuard } from "../src/utils/saveGuard";
import { CURRENT_DATA_VERSION } from "../src/constants";
import { isFromNewerBuild } from "../src/manager/foreignFields";
import type { PluginData } from "../src/types";

/**
 * A `data.json` as a build one release ahead of this one would write it.
 *
 * Built from *this* build's own output and then given one extra field, which
 * is exactly what the next release is: everything here, plus something new.
 * Writing the settings out by hand instead would make the file merely
 * incomplete, and an incomplete file provokes a legitimate convergence write
 * that has nothing to do with what these tests are about.
 */
function fromNewerBuild(over: Record<string, unknown> = {}): Partial<PluginData> {
	const base = new CalloutRegistry();
	base.load(null);
	const data = base.toSaveData();
	return {
		...data,
		settings: {
			...data.settings,
			// The field this build has never heard of.
			calloutShadows: { enabled: true, blur: 6 },
		},
		...over,
	} as unknown as Partial<PluginData>;
}

function loadedFrom(data: Partial<PluginData>): CalloutRegistry {
	const registry = new CalloutRegistry();
	registry.load(data);
	return registry;
}

describe("a settings field only the newer build knows", () => {
	it("survives a round trip through the older one", () => {
		const saved = loadedFrom(fromNewerBuild()).toSaveData();
		const settings = saved.settings as unknown as Record<string, unknown>;

		assert.deepStrictEqual(settings.calloutShadows, {
			enabled: true,
			blur: 6,
		});
	});

	it("never reaches the settings this build actually reads", () => {
		// Quarantined, not adopted. Nothing in this version may branch on it,
		// render it, or hand it to a merge that would then treat it as ours.
		const registry = loadedFrom(fromNewerBuild());

		assert.strictEqual(
			(registry.settings as unknown as Record<string, unknown>).calloutShadows,
			undefined,
		);
	});

	it("provokes no write at all — the whole point", () => {
		// The property the loop was made of. An older device that loads a newer
		// device's file and then saves must produce the identical file, or the
		// two rewrite each other forever.
		const data = fromNewerBuild();
		const guard = new SaveGuard();
		guard.adopt(JSON.stringify(data));

		const registry = loadedFrom(data);
		assert.strictEqual(guard.prepare(registry.toSaveData()), null);
	});

	it("is given back even when the older build changes something of its own", () => {
		const registry = loadedFrom(fromNewerBuild());
		registry.update("note", { colorLight: "#ff0000" });

		const settings = registry.toSaveData().settings as unknown as Record<
			string,
			unknown
		>;
		assert.deepStrictEqual(settings.calloutShadows, {
			enabled: true,
			blur: 6,
		});
	});

	it("goes away with everything else on a reset", () => {
		const registry = loadedFrom(fromNewerBuild());
		registry.resetAll();

		const settings = registry.toSaveData().settings as unknown as Record<
			string,
			unknown
		>;
		assert.strictEqual(settings.calloutShadows, undefined);
	});

	it("is not carried over from a previous load", () => {
		const registry = loadedFrom(fromNewerBuild());
		registry.load({
			version: CURRENT_DATA_VERSION,
			callouts: [],
			settings: {},
		} as unknown as Partial<PluginData>);

		const settings = registry.toSaveData().settings as unknown as Record<
			string,
			unknown
		>;
		assert.strictEqual(settings.calloutShadows, undefined);
	});
});

describe("a top-level key only the newer build knows", () => {
	it("survives too, since a future release can add one of those as easily", () => {
		const saved = loadedFrom(
			fromNewerBuild({ themeProfiles: [{ name: "night" }] }),
		) as unknown as CalloutRegistry;
		const out = saved.toSaveData() as unknown as Record<string, unknown>;

		assert.deepStrictEqual(out.themeProfiles, [{ name: "night" }]);
	});

	it("cannot shadow a key this build owns", () => {
		const registry = loadedFrom(
			fromNewerBuild({ version: 99, callouts: [] }),
		);
		const out = registry.toSaveData();

		assert.strictEqual(out.version, CURRENT_DATA_VERSION);
	});
});

describe("fields this plugin retired on purpose", () => {
	it("stay retired rather than being mistaken for a newer build's", () => {
		// `firstRunCompleted` and `retiredThemeIds` moved to DeviceLocalStore in
		// 2.12.0 precisely because they are claims about a machine. A quarantine
		// that could not tell "removed on purpose" from "not learned yet" would
		// put both straight back into the synced file and undo that release.
		const registry = loadedFrom({
			version: CURRENT_DATA_VERSION,
			callouts: [],
			settings: {
				firstRunCompleted: true,
				retiredThemeIds: ["ayu-note"],
				popup: { enabled: false },
			},
		} as unknown as Partial<PluginData>);

		const settings = registry.toSaveData().settings as unknown as Record<
			string,
			unknown
		>;
		assert.strictEqual(settings.firstRunCompleted, undefined);
		assert.strictEqual(settings.retiredThemeIds, undefined);
		assert.strictEqual(settings.popup, undefined);
	});

	it("and so does the pre-2.4 Material cache", () => {
		const registry = loadedFrom({
			version: CURRENT_DATA_VERSION,
			callouts: [],
			settings: {},
			materialSvgCache: [],
		} as unknown as Partial<PluginData>);

		assert.strictEqual(
			(registry.toSaveData() as unknown as Record<string, unknown>)
				.materialSvgCache,
			undefined,
		);
	});
});

describe("a settings object that is not an object", () => {
	it("simply has no fields to quarantine", () => {
		// `data.json` is read before anything validates it.
		for (const settings of [null, 7, "nope", ["a"]] as unknown[]) {
			const registry = loadedFrom({
				version: CURRENT_DATA_VERSION,
				callouts: [],
				settings,
			} as unknown as Partial<PluginData>);
			assert.ok(registry.toSaveData().settings.language);
		}
	});
});

describe("a file from a build that changed what a field means", () => {
	/**
	 * The quarantine handles a *added* field without anybody noticing. `version`
	 * is for the case it cannot: a release that changes the meaning or the shape
	 * of something that already exists, where this build's reading is wrong
	 * rather than merely incomplete. `manager/settingsAdopt.ts` freezes the
	 * writer on this answer, so the session shows what it can and writes
	 * nothing.
	 */
	it("is recognised by its version alone", () => {
		assert.strictEqual(
			isFromNewerBuild({ version: CURRENT_DATA_VERSION + 1 } as Partial<PluginData>),
			true,
		);
	});

	it("does not mistake this build's own file, or an older one", () => {
		assert.strictEqual(
			isFromNewerBuild({ version: CURRENT_DATA_VERSION } as Partial<PluginData>),
			false,
		);
		assert.strictEqual(isFromNewerBuild({ version: 1 } as Partial<PluginData>), false);
	});

	it("does not read a missing or junk version as the future", () => {
		// Every file this plugin has written carries one, so a file without it
		// is far likelier to be old — or hand-edited — than to be ahead of us.
		assert.strictEqual(isFromNewerBuild(null), false);
		assert.strictEqual(isFromNewerBuild({} as Partial<PluginData>), false);
		assert.strictEqual(
			isFromNewerBuild({ version: "9" } as unknown as Partial<PluginData>),
			false,
		);
	});
});
