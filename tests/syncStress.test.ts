import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { SettingsSync } from "../src/manager/settingsSync";
import { canonical, content } from "../src/manager/syncTree";

type Body = { version: number; callouts: { id: string; displayName: string; icon: { type: string; value: string }; colorLight: string }[]; settings: { language: string; customPalettes: { id: string; name: string }[] } };
const initial: Body = { version: 5, callouts: [], settings: { language: "auto", customPalettes: [] } };
function replica(actor: string, data: unknown) {
	let sync = new SettingsSync(actor), value = data; sync.adopt(data);
	return { get value() { return value; },
		edit(fn: (body: Body) => void) { const body = content(value) as unknown as Body; fn(body); value = sync.prepare(body); sync.adopt(value); },
		receive(incoming: unknown) { value = sync.merge(incoming, value); sync.adopt(value); },
		restart() { sync = new SettingsSync(`${actor}-restart`); sync.adopt(value); },
	};
}
function random(seed: number) { let n = seed; return (max: number) => { n = (Math.imul(n, 1664525) + 1013904223) >>> 0; return n % max; }; }

describe("seeded asynchronous sync stress", () => {
	it("converges after offline edits, deletes, recreations, restarts, reorderings and duplicate messages", () => {
		for (let seed = 1; seed <= 300; seed++) {
			const pick = random(seed), devices = Array.from({ length: 4 }, (_, i) => replica(`device-${i}`, initial));
			const messages: unknown[] = [];
			for (let event = 0; event < 70; event++) {
				const d = devices[pick(4)]!, action = pick(7), id = `row-${pick(5)}`;
				if (action < 4) {
					d.edit(body => {
						if (action === 0) body.callouts = body.callouts.filter(row => row.id !== id);
						else if (action === 1) {
							const row = body.callouts.find(row => row.id === id);
							if (row) row.colorLight = `color-${event}`;
							else body.callouts.push({ id, displayName: id, icon: { type: "lucide", value: "star" }, colorLight: `color-${event}` });
						} else if (action === 2) body.callouts.reverse();
						else body.settings.language = `lang-${event}`;
					});
					messages.push(structuredClone(d.value));
				} else if (action === 4) d.restart();
				else if (messages.length) d.receive(messages[pick(messages.length)]);
			}
			// Every extant branch is eventually delivered; old duplicate messages
			// may arrive even after a replica has restarted or deleted a row.
			for (const d of devices) for (const message of messages) d.receive(message);
			for (let round = 0; round < 5; round++) {
				const snapshots = devices.map(d => structuredClone(d.value));
				for (const d of devices) for (const snapshot of snapshots) d.receive(snapshot);
			}
			assert.equal(new Set(devices.map(d => canonical(d.value))).size, 1, `seed ${seed}`);
			const result = canonical(devices[0]!.value);
			for (const d of devices) { d.edit(() => {}); assert.equal(canonical(d.value), result, `no-op changed seed ${seed}`); }
		}
	});
	it("preserves separate edits in a large Unicode settings payload", () => {
		const large = structuredClone(initial);
		large.callouts = Array.from({ length: 1200 }, (_, i) => ({ id: `קריאה-${i}-⭐`, displayName: `בדיקה ${i}`, icon: { type: "lucide", value: "star" }, colorLight: "#123456" }));
		const payload = { ...large, artwork: "a".repeat(1_000_000) };
		const a = replica("a", payload), b = replica("b", payload);
		a.edit(body => { body.callouts[0]!.displayName = "עריכה ראשונה"; });
		b.edit(body => { body.callouts[1199]!.colorLight = "#abcdef"; });
		const left = structuredClone(a.value), right = structuredClone(b.value); a.receive(right); b.receive(left);
		assert.equal(canonical(a.value), canonical(b.value));
		const merged = content(a.value) as unknown as Body & { artwork: string };
		assert.equal(merged.callouts[0]!.displayName, "עריכה ראשונה"); assert.equal(merged.callouts[1199]!.colorLight, "#abcdef");
		assert.equal(merged.artwork.length, 1_000_000);
	});

});
