import assert from "node:assert/strict";
import { setImmediate as nextTurn } from "node:timers/promises";
import { describe, it } from "node:test";
import { discoveryHarness, definition } from "./support/discoveryHarness";

function gate() {
	let release!: () => void;
	const promise = new Promise<void>((resolve) => { release = resolve; });
	return { promise, release };
}

describe("manual discovery validates its whole input before saving", () => {
	for (const marker of ["```", "~~~"]) {
		it(`does not treat a ${marker} line with trailing text as a closing code fence`, async () => {
			const h = discoveryHarness({ "a.md": `${marker}markdown\n> [!code-before]\n${marker}typescript\n> [!code-after]\n${marker}\n> [!real]` });
			assert.equal(await h.discovery.run(), 1);
			assert.deepEqual(h.registry.getUserDefined().map((row) => row.id), ["real"]);
		});
	}
	for (const when of ["note read", "settings freshness read"] as const) {
		for (const change of ["added", "edited", "deleted", "renamed", "replaced", "theme changed"] as const) {
			it(`cancels when ${change} during the ${when}`, async () => {
				const h = discoveryHarness({ "a.md": "> [!new]" });
				const before = structuredClone(h.state.disk);
				const mutate = () => {
					if (change === "added") h.vault.write("b.md", "> [!arrived]");
					if (change === "edited") h.vault.write("a.md", "> [!changed]");
					if (change === "deleted") h.vault.remove("a.md");
					if (change === "renamed") h.vault.file("a.md").path = "b.md";
					if (change === "replaced") { h.vault.remove("a.md"); h.vault.write("a.md", "> [!new]"); }
					if (change === "theme changed") h.state.themes.add("new-theme-id");
				};
				if (when === "note read") h.state.duringRead = mutate;
				else h.state.duringSettingsRead = mutate;
				await assert.rejects(h.discovery.run());
				assert.equal(h.state.writes, 0);
				assert.equal(h.registry.getUserDefined().length, 0);
				assert.deepEqual(h.state.disk, before);
			});
		}
	}
	it("ignores theme values that cannot name a Markdown callout", async () => {
		const h = discoveryHarness();
		for (const id of ["", "   ", "bad|metadata", "bad]name", "[bad", "bad\\escape", "bad\nline", "bad\rline", "bad\0name"]) h.state.themes.add(id);
		h.state.themes.add("VALID"); h.state.themes.add("valid"); h.state.themes.add("סוג");
		assert.equal(await h.discovery.run(), 2);
		assert.deepEqual(h.registry.getUserDefined().map((row) => row.id).sort(), ["valid", "סוג"]);
	});
});

describe("manual discovery reconciles local changes during the write", () => {
	it("publishes the latest fallback appearance, which survives the queued save and restart", async () => {
		const h = discoveryHarness({ "a.md": "> [!found]" }); const g = gate();
		h.state.duringWrite = () => g.promise;
		h.registry.onChange(() => { void h.writer.save(); });
		const scan = h.discovery.run(); await nextTurn();
		h.registry.update("note", { colorLight: "#fedcba", icon: { type: "lucide", value: "star" } });
		g.release(); assert.equal(await scan, 1); await h.writer.save();
		assert.equal(h.registry.get("found")?.colorLight, "#fedcba");
		assert.equal(h.registry.get("found")?.icon.value, "star");
		h.registry.load(h.state.disk);
		assert.equal(h.registry.get("found")?.colorLight, "#fedcba");
		assert.equal(h.registry.get("found")?.icon.value, "star");
	});
	it("honors a different selected fallback during the write", async () => {
		const h = discoveryHarness({ "a.md": "> [!found]" }); const g = gate();
		h.state.duringWrite = () => g.promise;
		h.registry.onChange(() => { void h.writer.save(); });
		const scan = h.discovery.run(); await nextTurn();
		h.registry.settings.fallbackCalloutId = "warning";
		const warning = h.registry.get("warning")!;
		g.release(); assert.equal(await scan, 1); await h.writer.save();
		assert.equal(h.registry.get("found")?.colorLight, warning.colorLight);
		assert.deepEqual(h.registry.get("found")?.icon, warning.icon);
	});
	it("keeps a locally created same-id definition and counts only actual additions", async () => {
		const h = discoveryHarness({ "a.md": "> [!found]" }); const g = gate();
		h.state.duringWrite = () => g.promise;
		h.registry.onChange(() => { void h.writer.save(); });
		const scan = h.discovery.run(); await nextTurn();
		const authored = definition({ id: "found", displayName: "Authored while saving" });
		h.registry.add(authored);
		g.release(); assert.equal(await scan, 0); await h.writer.save();
		assert.deepEqual(h.registry.get("found"), authored);
		assert.equal(h.state.disk?.callouts.find((row) => row.id === "found")?.displayName, authored.displayName);
	});
});
