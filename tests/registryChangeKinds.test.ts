/**
 * tests/registryChangeKinds.test.ts - which registry announcements may skip a
 * settings save.
 *
 * `main.ts` saves on every `onChange`, and a theme's claims and readings are
 * announced like any other change - so a font-size drag, which re-reads the
 * theme once per step, used to serialise and fingerprint the whole of
 * `data.json` twice per step (about 18 ms each for a 1.2 MB file, measured).
 * The two derived theme facts now announce `persists: false`. What this file
 * pins is the contract that makes that safe: the facts never reach
 * `toSaveData()`, a mutation always says it persists, and a batch that mixes
 * the two persists.
 */
import assert from "node:assert";
import { describe, it } from "node:test";
import { CalloutRegistry, type RegistryChange } from "../src/manager/CalloutRegistry";
import { definition } from "./support/discoveryHarness";
import { UNKNOWN_APPEARANCE } from "../src/manager/theme/themeAppearance";

function vault() {
	const registry = new CalloutRegistry();
	registry.load(null);
	const rounds: RegistryChange[] = [];
	registry.onChange((change) => rounds.push(change));
	return { registry, rounds };
}

const ids = (...names: string[]) => new Set(names);
const reading = (accent: string) => new Map([["recite", { ...UNKNOWN_APPEARANCE, accent }]]);

describe("what a registry round says about persistence", () => {
	it("says a row mutation persists", () => {
		const { registry, rounds } = vault();
		registry.add(definition({ id: "quiet", displayName: "Quiet" }));
		assert.deepStrictEqual(rounds, [{ persists: true }]);
	});

	it("says a move of the theme's claims does not", () => {
		const { registry, rounds } = vault();
		registry.setThemeOwnedIds(ids("recite"));
		assert.deepStrictEqual(rounds, [{ persists: false }]);
	});

	it("says a move of what the theme draws does not", () => {
		const { registry, rounds } = vault();
		registry.setThemeAppearances(reading("red"));
		assert.deepStrictEqual(rounds, [{ persists: false }]);
	});

	it("announces nothing for a publish that moved nothing", () => {
		const { registry, rounds } = vault();
		registry.setThemeOwnedIds(ids("recite"));
		registry.setThemeAppearances(reading("red"));
		rounds.length = 0;
		assert.strictEqual(registry.setThemeOwnedIds(ids("recite")), false);
		assert.strictEqual(registry.setThemeAppearances(reading("red")), false);
		assert.deepStrictEqual(rounds, []);
	});

	it("announces a preview as not persisting", () => {
		const { registry } = vault();
		const seen: RegistryChange[] = [];
		registry.onPreviewChange((change) => seen.push(change));
		registry.setPreviewDefinition(definition({ id: "new-callout-preview", displayName: "Draft" }));
		assert.ok(seen.length > 0, "a preview is announced to its own listeners");
		assert.ok(seen.every((change) => change.persists === false));
	});
});

describe("a batch holding theme facts", () => {
	it("is one round that does not persist when only facts moved", () => {
		const { registry, rounds } = vault();
		registry.batch(() => {
			registry.setThemeAppearances(new Map());
			registry.setThemeOwnedIds(ids("recite"));
			registry.setThemeAppearances(reading("red"));
		});
		assert.deepStrictEqual(rounds, [{ persists: false }]);
	});

	it("persists when a row changed beside them, in either order", () => {
		const first = vault();
		first.registry.batch(() => {
			first.registry.setThemeOwnedIds(ids("recite"));
			first.registry.add(definition({ id: "quiet", displayName: "Quiet" }));
		});
		assert.deepStrictEqual(first.rounds, [{ persists: true }]);

		const second = vault();
		second.registry.batch(() => {
			second.registry.add(definition({ id: "quiet", displayName: "Quiet" }));
			second.registry.setThemeOwnedIds(ids("recite"));
		});
		assert.deepStrictEqual(second.rounds, [{ persists: true }]);
	});

	it("does not carry a persisting round's verdict into the next batch", () => {
		const { registry, rounds } = vault();
		registry.batch(() => {
			registry.add(definition({ id: "quiet", displayName: "Quiet" }));
		});
		registry.batch(() => {
			registry.setThemeOwnedIds(ids("recite"));
		});
		assert.deepStrictEqual(rounds, [{ persists: true }, { persists: false }]);
	});
});

describe("why a theme fact can skip the save", () => {
	it("leaves toSaveData exactly as it was", () => {
		const { registry } = vault();
		registry.add(definition({ id: "quiet", displayName: "Quiet" }));
		const before = JSON.stringify(registry.toSaveData());
		registry.setThemeOwnedIds(ids("quiet", "recite", "note"));
		registry.setThemeAppearances(reading("red"));
		assert.strictEqual(JSON.stringify(registry.toSaveData()), before);
	});

	it("tells a listener that takes no argument nothing it did not ask for", () => {
		const { registry } = vault();
		let calls = 0;
		registry.onChange(() => {
			calls++;
		});
		registry.setThemeOwnedIds(ids("recite"));
		assert.strictEqual(calls, 1);
	});
});
