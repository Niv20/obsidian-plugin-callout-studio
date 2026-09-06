import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { SaveGuard } from "../src/utils/saveGuard";
import { stableKeyOrder } from "../src/utils/stableJson";
import { collectForeignFields, isFromNewerBuild } from "../src/manager/foreignFields";
import { CURRENT_DATA_VERSION } from "../src/constants";
import { CalloutRegistry } from "../src/manager/CalloutRegistry";
import { hasSafeSettingsFileShape } from "../src/manager/settingsFileShape";
import { validateImportPayload } from "../src/utils/importValidator";
import { definition } from "./support/discoveryHarness";
import type { PluginData } from "../src/types";

describe("settings dictionaries preserve literal property names", () => {
	it("canonicalizes __proto__ as data without changing any prototype", () => {
		const raw = JSON.parse(
			'{"nested":{"__proto__":{"injected":true},"constructor":"author","prototype":"note"}}',
		) as Record<string, unknown>;
		const ordered = stableKeyOrder(raw);
		const nested = ordered.nested as Record<string, unknown>;
		assert.equal(Object.getPrototypeOf(nested), Object.prototype);
		assert.equal(Object.hasOwn(nested, "__proto__"), true);
		assert.equal(nested.injected, undefined);
		assert.equal(Object.hasOwn(Object.prototype, "injected"), false);
		assert.deepEqual(JSON.parse(JSON.stringify(ordered)), raw);
	});

	it("detects a remote change that differs only in a literal __proto__ field", () => {
		const guard = new SaveGuard();
		guard.adopt('{"future":{"__proto__":{"choice":"before"}}}');
		const changed = '{"future":{"__proto__":{"choice":"after"}}}';
		assert.equal(guard.matches(changed), false);
		assert.notEqual(guard.prepare(JSON.parse(changed)), null);
		assert.equal(guard.matches('{"future":{}}'), false);
	});

	it("preserves future fields through load, edit, save and another load", () => {
		const registry = new CalloutRegistry();
		registry.load(null);
		const extra = JSON.parse('{"__proto__":{"injected":true},"constructor":{"name":"future"},"prototype":[1,2]}') as Record<string, unknown>;
		const base = registry.toSaveData();
		const raw = { ...base, ...extra, settings: { ...base.settings, ...extra } };
		const foreign = collectForeignFields(raw);
		for (const map of [foreign.data, foreign.settings]) {
			assert.equal(Object.getPrototypeOf(map), Object.prototype);
			assert.equal(Object.hasOwn(map, "__proto__"), true);
			assert.equal(map.injected, undefined);
		}
		registry.load(raw);
		registry.update("note", { colorLight: "#123456" });
		const serialized = JSON.stringify(registry.toSaveData());
		const saved = JSON.parse(serialized) as Record<string, unknown>;
		for (const map of [saved, saved.settings as Record<string, unknown>]) {
			for (const key of Object.keys(extra)) assert.deepEqual(map[key], extra[key]);
			assert.equal(Object.getPrototypeOf(map), Object.prototype);
		}
		registry.load(JSON.parse(serialized) as PluginData);
		assert.equal(registry.get("note")?.colorLight, "#123456");
		assert.deepEqual(JSON.parse(JSON.stringify(registry.toSaveData())), saved);
	});

	it("imports all string metadata names without dropping __proto__", async () => {
		const metadata = JSON.parse(
			'{"__proto__":"literal","constructor":"author","prototype":"draft"}',
		) as Record<string, unknown>;
		const registry = new CalloutRegistry();
		registry.load(null);
		const result = await validateImportPayload([{ ...definition(), metadata }], registry);
		assert.equal(result.validDefs.length, 1, JSON.stringify(result.issues));
		const clean = result.validDefs[0]!.metadata!;
		assert.equal(Object.getPrototypeOf(clean), Object.prototype);
		assert.equal(Object.hasOwn(clean, "__proto__"), true);
		assert.deepEqual(clean, JSON.parse('{"__proto__":"literal","constructor":"author","prototype":"draft"}'));
	});
});

describe("settings payloads cannot silently discard rows or crash gradient rendering", () => {
	for (const angleDeg of [undefined, null, "90", {}, { toString: null, valueOf: null }, Number.NaN, Infinity]) {
		it(`rejects an invalid gradient angle: ${String(JSON.stringify(angleDeg))}`, () => {
			const raw = { callouts: [{ ...definition(), bgGradient: {
				angleDeg, toColorLight: "#ffffff", toColorDark: "#000000",
			} }] };
			assert.equal(hasSafeSettingsFileShape(raw), false);
		});
	}

	it("retains finite legacy angles and future gradient metadata", () => {
		const raw = { callouts: [{ ...definition(), bgGradient: {
			angleDeg: -450, toColorLight: "#ffffff", toColorDark: "#000000", type: "radial",
		} }] };
		assert.equal(hasSafeSettingsFileShape(raw), true);
	});

	it("rejects duplicate exact IDs before the registry can replace one row", () => {
		const first = definition({ id: "same", displayName: "First" });
		const second = definition({ id: "same", displayName: "Second" });
		assert.equal(hasSafeSettingsFileShape({ callouts: [first, second] }), false);
	});

	it("continues allowing distinct legacy spellings for the existing migration", () => {
		assert.equal(hasSafeSettingsFileShape({ callouts: [
			definition({ id: "two words" }), definition({ id: "two-words" }),
		] }), true);
	});
});

describe("settings versions are safe before migrations run", () => {
	for (const [label, version] of [
		["null", null], ["string", "4"], ["boolean", true], ["object", {}],
		["uncoercible object", { toString: null, valueOf: null }],
		["NaN", Number.NaN], ["infinity", Infinity],
	] as const) {
		it(`rejects a ${label} version before registry rebuilding`, () => {
			assert.equal(hasSafeSettingsFileShape({ settings: {}, version }), false);
		});
	}

	it("continues accepting absent legacy versions and finite supported versions", () => {
		assert.equal(hasSafeSettingsFileShape({ settings: {} }), true);
		for (const version of [1, CURRENT_DATA_VERSION]) {
			assert.equal(hasSafeSettingsFileShape({ settings: {}, version }), true);
		}
	});

	it("passes a newer numeric version to the existing read-only protection", () => {
		const data = { settings: {}, version: CURRENT_DATA_VERSION + 1 };
		assert.equal(hasSafeSettingsFileShape(data), true);
		assert.equal(isFromNewerBuild(data as Partial<PluginData>), true);
	});
});
