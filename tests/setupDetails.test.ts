import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DEFAULT_CALLOUTS } from "../src/defaultCallouts";
import { listUserImages, setUserImages } from "../src/icons/packs/userImages";
import { CalloutRegistry } from "../src/manager/CalloutRegistry";
import { SettingsRecoveryService, type RecoverySource } from "../src/manager/settingsRecoveryService";
import { setupDetails, setupFieldChanges } from "../src/manager/setupDetails";
import { differingEntries } from "../src/manager/setupDifference";
import type { PluginData, UserImageIcon } from "../src/types";
import { definition } from "./support/discoveryHarness";
import { recoveryActionHarness } from "./support/recoveryActionHarness";

function data(): PluginData {
	const registry = new CalloutRegistry(); registry.load(null);
	return registry.toSaveData();
}

function source(saved: Partial<PluginData> | null): RecoverySource {
	return { kind: "history", time: 123, path: null, historyHash: null, origin: "this-device", data: saved };
}

describe("earlier setup details", () => {
	it("shows the additions, removals and changes restoring would make", () => {
		const current = data(), earlier = data();
		current.callouts = [definition({ id: "removed" }), definition({ id: "shared", displayName: "Now" })];
		earlier.callouts = [definition({ id: "added" }), definition({ id: "shared", displayName: "Earlier" })];
		earlier.settings.globalStyle.borderRadius = 19;
		const report = setupDetails(source(earlier), current);
		assert.deepEqual(report.changes.map(change => [change.key, change.kind]), [
			["row:removed", "removed"], ["row:shared", "changed"], ["row:added", "added"], ["settings:globalStyle", "changed"],
		]);
		assert.deepEqual(report.changes[0]!.before, current.callouts[0]);
		assert.equal(report.changes[0]!.after, undefined);
		assert.deepEqual(report.changes[1]!.before, current.callouts[1]);
		assert.deepEqual(report.changes[1]!.after, earlier.callouts[1]);
		assert.equal(report.changes[2]!.before, undefined);
		assert.deepEqual(report.changes[2]!.after, earlier.callouts[0]);
		assert.deepEqual(report.changes[3]!.before, current.settings.globalStyle);
		assert.deepEqual(report.changes[3]!.after, earlier.settings.globalStyle);
		assert.deepEqual(new Set(report.changes.map(change => change.key)), differingEntries(current, earlier));
		assert.deepEqual(report.changes[0]!.fields, [{ path: [], before: current.callouts[0], after: undefined }]);
		assert.deepEqual(report.changes[1]!.fields, [{ path: ["displayName"], before: "Now", after: "Earlier" }]);
		assert.deepEqual(report.changes[2]!.fields, [{ path: [], before: undefined, after: earlier.callouts[0] }]);
		assert.deepEqual(report.changes[3]!.fields, [{ path: ["borderRadius"], before: current.settings.globalStyle.borderRadius, after: 19 }]);
	});

	it("keeps complete data while excluding incidental state and metadata from changes", () => {
		const current = data(), earlier = data();
		earlier.settings.welcomeSeen = !current.settings.welcomeSeen;
		earlier.settings.competitorImportBannerHandled = !current.settings.competitorImportBannerHandled;
		earlier.settings.iconSources.lastCategory = { emoji: "People" };
		earlier.settings.iconSources.lastEmojiSkinTone = 5;
		earlier.settings.quickInsertSource = "custom";
		earlier.iconSvgCache = [{ pack: "lucide", name: "star", variant: "", svg: "<svg />" }];
		const saved = { ...earlier, calloutStudioSync: { version: 2, privateDetails: "retained" }, extra: ["unknown", "fields"] };
		const entry = source(saved);
		const report = setupDetails(entry, current);
		assert.deepEqual(report.changes, []);
		assert.deepEqual(report.source.data, saved);
	});

	it("omits incidental values inside a settings group with a real change", () => {
		const current = data(), earlier = data();
		earlier.settings.iconSources.materialWeightDefault = current.settings.iconSources.materialWeightDefault === 200 ? 300 : 200;
		earlier.settings.iconSources.lastCategory = { emoji: "People" };
		earlier.settings.iconSources.lastEmojiSkinTone = 5;
		const changes = setupDetails(source(earlier), current).changes;
		assert.equal(changes.length, 1);
		assert.equal(changes[0]!.key, "settings:iconSources");
		assert.deepEqual(changes[0]!.fields, [{ path: ["materialWeightDefault"],
			before: current.settings.iconSources.materialWeightDefault, after: earlier.settings.iconSources.materialWeightDefault }]);
		assert.deepEqual(changes[0]!.after, earlier.settings.iconSources, "the full snapshot still retains picker memory");
	});

	it("isolates the snapshot from both inputs and from later reports", () => {
		const current = data(), earlier = data();
		current.callouts = [definition({ id: "same", displayName: "Now" })];
		earlier.callouts = [definition({ id: "same", displayName: "Earlier" })];
		const entry = source(earlier);
		const report = setupDetails(entry, current), captured = JSON.stringify(report);
		current.callouts[0]!.displayName = "A later edit";
		earlier.callouts[0]!.displayName = "Source edited later";
		entry.path = "changed";
		assert.equal(JSON.stringify(report), captured);
		const next = setupDetails(entry, current), capturedNext = JSON.stringify(next);
		report.current.callouts![0]!.displayName = "Mutated report";
		report.source.data!.callouts![0]!.displayName = "Mutated source snapshot";
		(report.changes[0]!.after as { displayName: string }).displayName = "Mutated change";
		assert.equal(current.callouts[0]!.displayName, "A later edit");
		assert.equal(earlier.callouts[0]!.displayName, "Source edited later");
		assert.equal(JSON.stringify(next), capturedNext);
	});

	it("provides no comparison for a saved setup that cannot be read", () => {
		const report = setupDetails(source(null), data());
		assert.equal(report.source.data, null);
		assert.deepEqual(report.changes, []);
		assert.deepEqual(report.callouts, []);
	});

	it("captures the displayed state at each click without reading or writing storage", async () => {
		const h = recoveryActionHarness(); await h.boot();
		try {
			const service = new SettingsRecoveryService(h.host), entry = source(h.host.registry.toSaveData());
			const disk = h.state.disk, checkpoint = structuredClone(h.state.checkpoint), files = [...h.files];
			const writes = h.state.writes;
			h.host.app.vault.adapter.read = async () => { throw new Error("Details must not read"); };
			h.host.app.vault.adapter.write = async () => { throw new Error("Details must not write"); };
			h.host.registry.add(definition({ id: "just-added" }));
			const report = service.details(entry);
			assert.deepEqual(report.changes.map(change => [change.key, change.kind]), [["row:just-added", "removed"]]);
			h.host.registry.update("just-added", { displayName: "Edited after opening" });
			assert.notEqual(report.current.callouts?.find(row => row.id === "just-added")?.displayName, "Edited after opening");
			assert.equal(service.details(entry).current.callouts?.find(row => row.id === "just-added")?.displayName, "Edited after opening");
			assert.equal(h.state.disk, disk);
			assert.equal(h.state.writes, writes);
			assert.deepEqual(h.state.checkpoint, checkpoint);
			assert.deepEqual([...h.files], files);
		} finally { h.host.settingsWriter.destroy(); }
	});
});

describe("all effective callouts in an earlier setup", () => {
	it("includes every untouched built-in even when neither file stores its definition", () => {
		const report = setupDetails(source({ callouts: [] }), { callouts: [] });
		assert.equal(report.callouts.length, DEFAULT_CALLOUTS.length);
		assert.deepEqual(report.callouts.map(row => row.id).sort(), DEFAULT_CALLOUTS.map(row => row.id).sort());
		for (const row of report.callouts) {
			assert.equal(row.kind, "unchanged");
			assert.deepEqual(row.before, DEFAULT_CALLOUTS.find(original => original.id === row.id));
			assert.deepEqual(row.after, row.before);
			assert.deepEqual(row.fields, []);
		}
	});

	it("treats restoring a built-in override to its default as a change, never a deletion", () => {
		const original = DEFAULT_CALLOUTS.find(row => row.id === "note")!;
		const current = { callouts: [{ ...original, colorLight: "#123456" }] };
		const report = setupDetails(source({ callouts: [] }), current);
		const note = report.callouts.find(row => row.id === "note")!;
		assert.equal(note.kind, "changed");
		assert.equal(note.before?.colorLight, "#123456");
		assert.deepEqual(note.after, original);
		assert.deepEqual(note.fields, [{ path: ["colorLight"], before: "#123456", after: original.colorLight }]);
		assert.equal(report.callouts[0]!.id, "note", "changed built-ins appear before unchanged definitions");
		assert.equal(report.changes[0]!.kind, "removed", "the separate persisted-row count retains its original semantics");
	});

	it("includes unchanged custom types and explicit additions and removals before unchanged rows", () => {
		const stable = definition({ id: "stable" });
		const current = { callouts: [stable, definition({ id: "gone" }), definition({ id: "changed", displayName: "Now" })] };
		const earlier = { callouts: [stable, definition({ id: "new" }), definition({ id: "changed", displayName: "Saved" })] };
		const report = setupDetails(source(earlier), current);
		assert.equal(report.callouts.length, DEFAULT_CALLOUTS.length + 4);
		assert.deepEqual(report.callouts.slice(0, 3).map(row => [row.id, row.kind]), [["changed", "changed"], ["gone", "removed"], ["new", "added"]]);
		assert.equal(report.callouts.find(row => row.id === "stable")?.kind, "unchanged");
		assert.equal(report.callouts.find(row => row.id === "gone")?.after, undefined);
		assert.equal(report.callouts.find(row => row.id === "new")?.before, undefined);
	});

	it("reports a style-only change once, in settings, without marking every callout", () => {
		const current = data(), earlier = data();
		earlier.settings.globalStyle.borderRadius = 19;
		const report = setupDetails(source(earlier), current);
		assert.deepEqual(report.changes.map(change => change.key), ["settings:globalStyle"]);
		assert.equal(report.callouts.length, DEFAULT_CALLOUTS.length);
		assert.ok(report.callouts.every(row => row.kind === "unchanged"));
		assert.ok(report.callouts.every(row => !row.artworkChanged), "global style is shown in its own section, not per callout");
	});

	it("detects only the artwork referenced by each visible saved icon", () => {
		const current = data(), earlier = data();
		const pictured = definition({ id: "pictured", icon: { type: "image", value: "used" } });
		const cached = definition({ id: "cached", icon: { type: "material", value: "star", style: "outlined", weight: 400 } });
		const hidden = definition({ ...pictured, id: "hidden", hideIcon: true });
		current.callouts = [pictured, cached, hidden]; earlier.callouts = structuredClone(current.callouts);
		const image: UserImageIcon = { id: "used", name: "Picture", format: "svg", svg: "<svg>old</svg>",
			width: 24, height: 24, monochrome: false, rev: 1, addedAt: 0 };
		current.settings.userImages = [image];
		earlier.settings.userImages = [{ ...image, svg: "<svg>new</svg>" }];
		current.iconSvgCache = [{ pack: "material", name: "star", variant: "outlined|400", svg: "old-artwork" }];
		earlier.iconSvgCache = [{ pack: "material", name: "star", variant: "outlined|400", svg: "new-artwork" }];
		const report = setupDetails(source(earlier), current);
		assert.deepEqual(report.callouts.filter(row => row.artworkChanged).map(row => row.id), ["cached", "pictured"]);
		assert.ok(report.callouts.every(row => row.kind === "unchanged"));
		assert.ok(report.callouts.every(row => row.fields.length === 0));
		earlier.settings.userImages = [{ ...image, name: "Renamed only", rev: 9, addedAt: 100 }, { ...image, id: "unused", svg: "unrelated" }];
		earlier.iconSvgCache = [...current.iconSvgCache, { pack: "material", name: "star", variant: "filled|400", svg: "unused variant" }];
		assert.ok(setupDetails(source(earlier), current).callouts.every(row => !row.artworkChanged));
	});

	it("does not reconstruct transient theme rows or change the live image pack", () => {
		const previousImages = listUserImages();
		const image: UserImageIcon = { id: "live-image", name: "Live image", format: "svg", svg: "<svg />",
			width: 24, height: 24, monochrome: false, rev: 1, addedAt: 0 };
		setUserImages([image]);
		try {
			const current = { callouts: [definition({ id: "theme-only", source: "theme" })] };
			const report = setupDetails(source({ callouts: [] }), current);
			assert.ok(!report.callouts.some(row => row.id === "theme-only"));
			assert.deepEqual(listUserImages(), [image]);
		} finally { setUserImages(previousImages); }
	});

	it("owns default and custom definitions without mutating constants or source snapshots", () => {
		const defaults = JSON.stringify(DEFAULT_CALLOUTS), current = { callouts: [definition({ id: "custom", displayName: "Current" })] };
		const earlier = { callouts: [definition({ id: "custom", displayName: "Saved" })] };
		const report = setupDetails(source(earlier), current);
		report.callouts.find(row => row.id === "note")!.before!.displayName = "Edited default snapshot";
		report.callouts.find(row => row.id === "custom")!.after!.displayName = "Edited custom snapshot";
		assert.equal(JSON.stringify(DEFAULT_CALLOUTS), defaults);
		assert.equal(earlier.callouts[0]!.displayName, "Saved");
		assert.equal(report.source.data!.callouts![0]!.displayName, "Saved");
		current.callouts[0]!.displayName = "Edited live input";
		assert.equal(report.callouts.find(row => row.id === "custom")!.before!.displayName, "Current");
	});
});

describe("precise setup field changes", () => {
	it("keeps only differing leaves while retaining additions, removals and type changes", () => {
		const before = { unchanged: { stable: "same" }, nested: { color: "red", stable: 1 }, removed: { complete: [1, 2] }, typed: { old: true } };
		const after = { unchanged: { stable: "same" }, nested: { color: "blue", stable: 1 }, added: { complete: [3, 4] }, typed: false };
		assert.deepEqual(setupFieldChanges(before, after), [
			{ path: ["nested", "color"], before: "red", after: "blue" },
			{ path: ["removed"], before: { complete: [1, 2] }, after: undefined },
			{ path: ["typed"], before: { old: true }, after: false },
			{ path: ["added"], before: undefined, after: { complete: [3, 4] } },
		]);
		assert.deepEqual(setupFieldChanges({ a: 1, b: 2 }, { b: 2, a: 1 }), []);
	});

	it("matches each palette, image and command by ID, with complete added and removed rows", () => {
		const before = { customPalettes: [{ id: "cp:one", name: "Before", colorLight: "red" }, { id: "cp:gone", colorLight: "green" }],
			userImages: [{ id: "img:one", name: "Unchanged name", svg: "old-svg" }],
			customCommands: [{ id: "cmd:one", calloutId: "old-id", role: "regular" }] };
		const after = { customPalettes: [{ id: "cp:new", colorLight: "black" }, { id: "cp:one", name: "After", colorLight: "red" }],
			userImages: [{ id: "img:one", name: "Unchanged name", svg: "new-svg" }],
			customCommands: [{ id: "cmd:one", calloutId: "new-id", role: "regular" }] };
		assert.deepEqual(setupFieldChanges(before, after), [
			{ path: ["customPalettes", "cp:one", "name"], before: "Before", after: "After" },
			{ path: ["customPalettes", "cp:gone"], before: before.customPalettes[1], after: undefined },
			{ path: ["customPalettes", "cp:new"], before: undefined, after: after.customPalettes[0] },
			{ path: ["userImages", "img:one", "svg"], before: "old-svg", after: "new-svg" },
			{ path: ["customCommands", "cmd:one", "calloutId"], before: "old-id", after: "new-id" },
		]);
	});

	it("reports a real ordering change explicitly without claiming unchanged rows changed", () => {
		const first = { id: "a", name: "First" }, second = { id: "b", name: "Second" };
		assert.deepEqual(setupFieldChanges([first, second], [second, first]), [
			{ path: ["$order"], before: ["a", "b"], after: ["b", "a"] },
		]);
		assert.deepEqual(setupFieldChanges([first, second], [{ id: "new" }, first, second]), [
			{ path: ["new"], before: undefined, after: { id: "new" } },
		]);
		assert.deepEqual(setupFieldChanges([], [first]), [{ path: ["a"], before: undefined, after: first }]);
	});

	it("compares primitive or ambiguous arrays atomically without dropping data", () => {
		for (const [before, after] of [
			[["a", "b"], ["b", "a"]],
			[[{ id: "same", value: 1 }, { id: "same", value: 2 }], [{ id: "same", value: 3 }]],
			[[{ name: "one" }], [{ name: "two" }]],
		]) assert.deepEqual(setupFieldChanges(before, after), [{ path: [], before, after }]);
	});

	it("preserves exact technical keys, including names inherited by ordinary objects", () => {
		const after = JSON.parse('{"constructor":"ctor","__proto__":{"unknown":"complete"},"$order":"literal","a/b:c":"kept"}') as unknown;
		assert.deepEqual(setupFieldChanges({}, after), [
			{ path: ["constructor"], before: undefined, after: "ctor" },
			{ path: ["__proto__"], before: undefined, after: { unknown: "complete" } },
			{ path: ["$order"], before: undefined, after: "literal" },
			{ path: ["a/b:c"], before: undefined, after: "kept" },
		]);
	});

	it("retains the full changed SVG and owns every compared value", () => {
		const svg = `<svg>${"complete artwork ".repeat(5000)}</svg>`;
		const before = { svg: "<svg />", removed: { content: "initial" } };
		const after = { svg, added: { content: "initial" } };
		const fields = setupFieldChanges(before, after);
		assert.equal(fields[0]!.after, svg);
		before.removed.content = "mutated input";
		after.added.content = "mutated input";
		assert.deepEqual(fields[1]!.before, { content: "initial" });
		assert.deepEqual(fields[2]!.after, { content: "initial" });
		(fields[2]!.after as { content: string }).content = "mutated report";
		assert.equal(after.added.content, "mutated input");
	});
});
