import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { SettingsSync, validSyncMetadata } from "../src/manager/settingsSync";
import { content, canonical, flatten, inflate } from "../src/manager/syncTree";

const seed = { version: 11, callouts: [{ id: "one", displayName: "One", icon: { type: "lucide", value: "star" }, colorLight: "red", colorDark: "black" }],
	settings: { language: "en", customPalettes: [], customCommands: [], userImages: [] } };
function branch(actor: string, initial: unknown = seed) {
	const sync = new SettingsSync(actor); sync.adopt(initial);
	let data = structuredClone(initial);
	return { sync, get data() { return data; },
		save(value: unknown) { data = sync.prepare(value); sync.adopt(data); return data; },
		receive(value: unknown) { data = sync.merge(value, data); sync.adopt(data); return data; },
	};
}

describe("causal settings merge", () => {
	it("round-trips ID lists, atomic arrays, empty containers and hostile property names", () => {
		const data = JSON.parse('{"callouts":[{"id":"__proto__","displayName":"a"}],"settings":{"__proto__":{"value":1},"aliases":["b","a"]}}') as unknown;
		assert.equal(canonical(inflate(flatten(data))), canonical(data));
	});
	it("merges separate fields on one callout and additions from offline devices", () => {
		const a = branch("a"), b = branch("b");
		const x = structuredClone(seed), y = structuredClone(seed);
		x.callouts[0]!.colorLight = "blue"; y.callouts[0]!.colorDark = "white";
		x.callouts.push({ ...x.callouts[0]!, id: "left" }); y.callouts.push({ ...y.callouts[0]!, id: "right" });
		const left = a.save(x), right = b.save(y);
		a.receive(right); b.receive(left);
		assert.equal(canonical(a.data), canonical(b.data));
		const rows = content(a.data).callouts as typeof seed.callouts;
		assert.equal(rows.length, 3); assert.equal(rows[0]!.colorLight, "blue"); assert.equal(rows[0]!.colorDark, "white");
	});
	it("converges on a same-field conflict without relying on wall clocks", () => {
		const a = branch("a"), b = branch("b");
		const left = a.save({ ...seed, settings: { ...seed.settings, language: "he" } });
		const right = b.save({ ...seed, settings: { ...seed.settings, language: "fr" } });
		a.receive(right); b.receive(left);
		assert.equal(canonical(a.data), canonical(b.data));
		assert.equal((content(a.data).settings as { language: string }).language, "fr");
		// An edit after observing the winner has a later logical clock.
		const latest = a.save({ ...content(a.data), settings: { ...seed.settings, language: "he" } });
		b.receive(latest); assert.equal(canonical(a.data), canonical(b.data));
	});
	it("keeps tombstones through restarts and delayed stale delivery", () => {
		const initial = branch("initial"); const saved = initial.save({ ...seed, settings: { ...seed.settings, language: "he" } });
		const a = branch("a", saved), b = branch("b", saved);
		const removed = a.save({ ...content(saved), callouts: [] });
		const stale = b.save({ ...content(saved), settings: { ...seed.settings, language: "de" } });
		const restarted = branch("restart", removed); restarted.receive(stale);
		assert.deepEqual(content(restarted.data).callouts, []);
		b.receive(restarted.data); assert.equal(canonical(b.data), canonical(restarted.data));
		restarted.receive(saved); assert.deepEqual(content(restarted.data).callouts, []);
		restarted.receive(seed); assert.deepEqual(content(restarted.data).callouts, []);
	});
	it("deletion wins against a concurrent edit of a deleted row, and a later explicit recreation works", () => {
		const a = branch("a"), b = branch("b");
		const deleted = a.save({ ...seed, callouts: [] });
		const edit = structuredClone(seed); edit.callouts[0]!.displayName = "Edited";
		const edited = b.save(edit); a.receive(edited); b.receive(deleted);
		assert.equal(canonical(a.data), canonical(b.data)); assert.deepEqual(content(a.data).callouts, []);
		const recreated = a.save(seed); b.receive(recreated);
		assert.equal(canonical(a.data), canonical(b.data)); assert.equal((content(b.data).callouts as unknown[]).length, 1);
	});
	it("retains independent palettes, commands and image additions", () => {
		for (const key of ["customPalettes", "customCommands", "userImages"]) {
			const a = branch("a"), b = branch("b");
			const left = a.save({ ...seed, settings: { ...seed.settings, [key]: [{ id: "left", name: "A" }] } });
			const right = b.save({ ...seed, settings: { ...seed.settings, [key]: [{ id: "right", name: "B" }] } });
			a.receive(right); b.receive(left);
			assert.equal(canonical(a.data), canonical(b.data));
			assert.equal(((content(a.data).settings as Record<string, unknown[]>)[key]!).length, 2);
		}
	});
	it("does not turn a legacy read or unchanged save into a metadata write", () => {
		const a = branch("a"); assert.equal(canonical(a.save(seed)), canonical(seed));
		const incoming = { ...seed, settings: { ...seed.settings, language: "he" } };
		assert.deepEqual(a.receive(incoming), incoming);
	});
	it("converges for all delivery orders across three offline branches", () => {
		const permutations = [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]];
		for (let scenario = 0; scenario < 40; scenario++) {
			const snapshots = ["a", "b", "c"].map((actor, i) => {
				const replica = branch(actor), value = structuredClone(seed);
				if ((scenario + i) % 5 === 0) value.callouts = [];
				else value.callouts[0]!.colorLight = `color-${i}`;
				value.callouts.push({ ...seed.callouts[0]!, id: `added-${i}` });
				if ((scenario + i) % 2 === 0) value.callouts.reverse();
				value.settings.language = `language-${i}`;
				return replica.save(value);
			});
			const results = permutations.map(order => {
				const replica = branch("observer");
				for (const index of order) replica.receive(snapshots[index]);
				for (const index of [...order].reverse()) replica.receive(snapshots[index]);
				return canonical(replica.data);
			});
			assert.equal(new Set(results).size, 1, `delivery order changed scenario ${scenario}`);
		}
	});

	it("rejects unsupported or malformed metadata", () => {
		for (const meta of [null, [], { version: 2, stamps: {} }, { version: 1, stamps: { x: [1, "a"] } },
			{ version: 1, stamps: { "[]": [-1, "a"] } }]) assert.equal(validSyncMetadata(meta), false);
	});
	it("keeps an icon pack and value together during simultaneous icon changes", () => {
		const a = branch("a"), b = branch("b"), left = structuredClone(seed), right = structuredClone(seed);
		left.callouts[0]!.icon = { type: "emoji", value: "❤" };
		right.callouts[0]!.icon = { type: "lucide", value: "circle" };
		const x = a.save(left), y = b.save(right); a.receive(y); b.receive(x);
		assert.equal(canonical(a.data), canonical(b.data));
		const icon = (content(a.data).callouts as typeof seed.callouts)[0]!.icon;
		assert.ok([canonical(left.callouts[0]!.icon), canonical(right.callouts[0]!.icon)].includes(canonical(icon)));
	});
	it("carries the newest legacy icon subfield stamp into the complete icon identity", () => {
		const legacy = { ...seed, calloutStudioSync: { version: 1, stamps: { '["callouts","one","icon","value"]': [10, "legacy"] } } };
		const a = branch("a", legacy), b = branch("b");
		const next = structuredClone(seed); next.callouts[0]!.icon = { type: "emoji", value: "❤" };
		a.receive(b.save(next)); assert.deepEqual((content(a.data).callouts as typeof seed.callouts)[0]!.icon, seed.callouts[0]!.icon);
	});

});
