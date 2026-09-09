/**
 * tests/syncThemeOverlay.test.ts — two devices, two themes, one settings file.
 *
 * The theme overlay is the one thing in the registry that is a fact about the
 * *machine* rather than about the vault: device A runs a theme that declares
 * `[!recite]`, device B does not, and the two must still write the same
 * `data.json`. If they do not, a file-level sync client cannot tell "the user
 * changed something" from "these two machines disagree", and it does the only
 * thing it can — keeps one and renames the other `data.json.sync-conflict-…`.
 * That is issue #41, and this file is the proof it cannot come back through the
 * overlay.
 *
 * The devices are the real thing: real files on disk, the production
 * `SettingsWriter`, the production `ReloadQueue` and the production adoption
 * path (`tests/support/syncReplicaHarness.ts`). Only the stylesheet is
 * simulated — `setTheme` hands the harness a set of declared ids and runs the
 * same sweep `registerThemeAppearance` runs on `css-change`, including through
 * the `refreshThemeAppearance` hook adoption calls once it has cleared the map.
 * That hook matters here: without it the overlay would look like something
 * adoption destroys, when in production it is rebuilt on the spot.
 *
 * Every assertion is on the settings **body** — `content()` drops the
 * `calloutStudioSync` envelope, whose Lamport stamps carry a per-device actor
 * id that is *supposed* to differ. What must not differ is everything a user
 * can see: `callouts`, `settings`, `iconSvgCache`, `version`.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { pair } from "./support/syncReplicaHarness";
import { canonical, content } from "../src/manager/syncTree";
import { definition, discovered } from "./support/discoveryHarness";
import { applyImportedCallout } from "../src/utils/importedCallout";

type Device = Parameters<Parameters<typeof pair>[0]>[0];

/**
 * A row whose icon id is already in its migrated form. `definition()` ships
 * `lucide-pencil`, which `load()` normalises to `pencil` and then rewrites —
 * so a row built the plain way is not a fixed point across a sync round trip
 * and would fail these comparisons for reasons that have nothing to do with
 * themes.
 */
const icon = { type: "lucide", value: "pencil" } as const;
const userRow = (id: string, over: Record<string, unknown> = {}) =>
	definition({ id, icon: { ...icon }, ...over });
const scannedRow = (id: string) => discovered(id, { icon: { ...icon } });

/** The settings body, envelope aside — what two devices must agree on. */
const body = async (dev: Device): Promise<string> =>
	canonical(content(await dev.read()));

/**
 * Put a theme on this device and let it try to save, which is the interesting
 * half: the sweep announces a change, so a save really is attempted, and the
 * writer's byte-identical early-out is what has to stop it.
 */
async function theme(dev: Device, ...ids: string[]): Promise<void> {
	dev.setTheme(...ids);
	await dev.host.saveSettings();
}

describe("a theme on one device never moves the synced file", () => {
	it("mints an overlay without writing anything at all", async () => {
		await pair(async (a, b) => {
			const before = await body(a);
			const writes = a.writes;
			await theme(a, "recite", "aside");

			assert.equal(a.registry.get("recite")?.source, "theme");
			assert.equal(a.writes, writes, "no write was performed");
			assert.equal(await body(a), before, "the file did not move");
			assert.equal(await body(a), await body(b), "the two devices agree");
		});
	});

	it("keeps the files identical when only one device has the theme", async () => {
		await pair(async (a, b) => {
			await theme(a, "recite");
			await theme(b);
			assert.equal(a.registry.get("recite")?.source, "theme");
			assert.equal(b.registry.get("recite"), undefined);
			assert.equal(await body(a), await body(b));
		});
	});

	it("carries an unrelated edit across while the overlay stands", async () => {
		await pair(async (a, b) => {
			await theme(a, "recite");
			a.registry.add(userRow("mine"));
			await a.host.saveSettings();
			await b.deliver(await a.read());

			assert.ok(b.registry.get("mine"), "the real edit arrived");
			assert.equal(b.registry.get("recite"), undefined, "the overlay did not");
			assert.equal(await body(a), await body(b));
		});
	});

	it("does not write back when the incoming file arrives under an overlay", async () => {
		// The #41 shape: B holds machine-local rows, adopts A's file, and its
		// own rows make the payload look changed — so it writes, and A adopts
		// and writes back, forever. B must stay silent here.
		await pair(async (a, b) => {
			await theme(b, "beta");
			a.registry.add(userRow("mine"));
			await a.host.saveSettings();

			const writes = b.writes;
			await b.deliver(await a.read());
			await b.host.saveSettings();

			assert.equal(b.writes, writes, "B answered A's file with silence");
			assert.equal(b.registry.get("beta")?.source, "theme", "overlay survived");
			assert.equal(await body(a), await body(b));
		});
	});

	it("stays identical when the two devices swap themes", async () => {
		await pair(async (a, b) => {
			await theme(a, "recite");
			const writes = a.writes + b.writes;

			await theme(a);
			await theme(b, "recite");

			assert.equal(a.registry.get("recite"), undefined);
			assert.equal(b.registry.get("recite")?.source, "theme");
			assert.equal(a.writes + b.writes, writes, "a theme swap writes nothing");
			assert.equal(await body(a), await body(b));
		});
	});

	it("survives Reset everything on the device that has the theme", async () => {
		await pair(async (a, b) => {
			await theme(a, "recite");
			a.registry.resetAll();
			await a.host.saveSettings();
			await b.deliver(await a.read());

			assert.equal(
				a.registry.get("recite")?.source,
				"theme",
				"Reset did not take the theme's callouts",
			);
			assert.equal(b.registry.get("recite"), undefined);
			assert.equal(await body(a), await body(b));
		});
	});
});

describe("the sanctioned routes from a theme id to saved configuration", () => {
	it("promotes an overlay id to a real row on a scan, and it syncs", async () => {
		await pair(async (a, b) => {
			await theme(a, "recite");
			// What ManualCalloutDiscovery's publish step does once the write
			// lands: retire the ephemeral row, then add the durable one.
			a.registry.remove("recite");
			a.registry.add(scannedRow("recite"));
			await a.host.saveSettings();
			await b.deliver(await a.read());

			assert.equal(a.registry.get("recite")?.source, "fallback");
			assert.equal(b.registry.get("recite")?.source, "fallback");
			assert.equal(await body(a), await body(b), "a scan is ordinary settings");
		});
	});

	it("imports the same row with and without the theme", async () => {
		await pair(async (a, b) => {
			await theme(a, "recite");
			const backup = userRow("recite", {
				displayName: "Recite",
				colorLight: "#123456",
			});
			applyImportedCallout(a.registry, { ...backup });
			applyImportedCallout(b.registry, { ...backup });

			assert.deepEqual(
				a.registry.toSaveData().callouts,
				b.registry.toSaveData().callouts,
				"the overlay did not become part of the imported row",
			);
			assert.equal(a.registry.get("recite")?.source, "user");
		});
	});

	it("mirrors a fallback change the same way on both devices", async () => {
		// `restyleUncustomizedFallbackRows` used to skip rows the local theme
		// owned, so one edit produced two different files.
		await pair(async (a, b) => {
			for (const dev of [a, b]) {
				dev.registry.add(userRow("base", { colorLight: "#ff0000" }));
				dev.registry.add(scannedRow("recite"));
			}
			await theme(a, "recite");

			for (const dev of [a, b]) {
				dev.registry.settings.fallbackCalloutId = "base";
				dev.registry.restyleUncustomizedFallbackRows();
			}

			assert.deepEqual(
				a.registry.toSaveData().callouts,
				b.registry.toSaveData().callouts,
			);
			assert.equal(a.registry.get("recite")?.colorLight, "#ff0000");
		});
	});
});
