import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { CalloutRegistry } from "../src/manager/CalloutRegistry";
import { CalloutOccurrenceIndex } from "../src/usage/CalloutOccurrenceIndex";
import { OccurrenceTypeChoices } from "../src/usage/occurrenceTypeChoices";
import { calloutIdentity } from "../src/utils/calloutId";
import { occurrenceVault } from "./occurrenceIndexHarness";

const previousWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
before(() => { Object.defineProperty(globalThis, "window", { configurable: true, value: globalThis }); });
after(() => {
	if (previousWindow) Object.defineProperty(globalThis, "window", previousWindow);
	else Reflect.deleteProperty(globalThis, "window");
});

function harness(text: string) {
	const vault = occurrenceVault({ "a.md": text });
	const registry = new CalloutRegistry();
	registry.load({});
	const index = new CalloutOccurrenceIndex(vault.app);
	const choices = new OccurrenceTypeChoices(registry, index);
	return { ...vault, registry, index, choices };
}

describe("sidebar-only occurrence type choices", () => {
	it("uses the configured fallback artwork without borrowing its identity or registering observed types", async () => {
		const h = harness("[!mystery type] [!MYSTERY-TYPE] [!template]");
		h.registry.add({ ...h.registry.get("note")!, id: "template", displayName: "Template", builtIn: false,
			source: "user", aliases: ["template-alias"], icon: { type: "emoji", value: "⭐" },
			colorLight: "#123456", colorDark: "#abcdef", hideIcon: true });
		h.registry.settings.fallbackCalloutId = "template";
		const before = JSON.stringify(h.registry.toSaveData());
		await h.index.ensureFresh();
		const unknown = h.choices.definitions().find((def) => def.id === "mystery type")!;
		assert.equal(unknown.displayName, "mystery type");
		assert.deepEqual(unknown.icon, { type: "emoji", value: "⭐" });
		assert.notEqual(unknown.icon, h.registry.get("template")!.icon);
		assert.equal(unknown.hideIcon, true);
		assert.equal(unknown.colorLight, "#123456");
		assert.equal(unknown.colorDark, "#abcdef");
		assert.deepEqual(unknown.aliases, ["mystery-type"]);
		assert.equal(h.choices.isRegistered(unknown), false);
		assert.equal(h.index.query(h.choices.resolve([unknown.id]).ids).totalCount, 2);
		assert.equal(h.registry.get(unknown.id), undefined);
		assert.equal(JSON.stringify(h.registry.toSaveData()), before);
		h.index.dispose();
	});

	it("updates observed and retained choices after fallback changes without a new scan or a saved draft", async () => {
		const h = harness("[!unknown]");
		await h.index.ensureFresh();
		const reads = h.reads.length;
		const note = h.registry.getReal("note")!;
		assert.deepEqual(h.choices.definitions().find((def) => def.id === "unknown")!.icon, note.icon);
		assert.deepEqual(h.choices.definitions("absent").find((def) => def.id === "absent")!.icon, note.icon);
		h.registry.settings.fallbackCalloutId = "warning";
		for (const id of ["unknown", "absent"]) {
			assert.deepEqual(h.choices.definitions(id).find((def) => def.id === id)!.icon, h.registry.get("warning")!.icon);
		}
		h.registry.update("warning", { icon: { type: "emoji", value: "⚠️" } });
		h.registry.setPreviewDefinition({ ...h.registry.get("warning")!, icon: { type: "emoji", value: "🚧" } });
		for (const id of ["unknown", "absent"]) {
			assert.deepEqual(h.choices.definitions(id).find((def) => def.id === id)!.icon, { type: "emoji", value: "⚠️" });
		}
		h.registry.setPreviewDefinition(null);
		h.registry.settings.fallbackCalloutId = "missing-template";
		assert.deepEqual(h.choices.definitions().find((def) => def.id === "unknown")!.icon, note.icon);
		assert.equal(h.reads.length, reads);
		h.index.dispose();
	});

	it("deduplicates observed spellings and registered aliases without changing the registry", async () => {
		const h = harness("[!warning] [!Caution] [!ATTENTION|red] [!mystery-type] [!Mystery   Type|meta]\n```\n[!hidden]\n```");
		const before = JSON.stringify(h.registry.toSaveData());
		let changes = 0;
		h.registry.onChange(() => { changes++; });
		await h.index.ensureFresh();
		const definitions = h.choices.definitions();
		assert.equal(definitions.filter((def) => def.id === "warning").length, 1);
		assert.ok(!definitions.some((def) => ["caution", "attention", "hidden"].includes(def.id)));
		const unknown = definitions.filter((def) => calloutIdentity(def.id) === "mystery-type");
		assert.deepEqual(unknown.map((def) => def.id), ["mystery type"]);
		assert.equal(h.choices.isRegistered(definitions.find((def) => def.id === "warning")!), true);
		assert.equal(h.choices.isRegistered(unknown[0]!), false);
		assert.equal(h.index.query(h.choices.resolve(["MYSTERY-TYPE|red"]).ids).totalCount, 2);
		assert.equal(h.choices.resolve(["caution"]).id, "warning");
		assert.equal(h.index.query(h.choices.resolve(["caution"]).ids).totalCount, 3);
		assert.equal(h.registry.get("mystery type"), undefined);
		assert.equal(JSON.stringify(h.registry.toSaveData()), before);
		assert.equal(changes, 0);
		h.index.dispose();
	});

	it("includes a theme or preview-only identity only when Markdown actually contains it", async () => {
		const h = harness("[!note]");
		const base = h.registry.get("note")!;
		h.registry.add({ ...base, id: "theme-only", displayName: "Theme only", builtIn: false, source: "theme" });
		h.registry.setPreviewDefinition({ ...base, id: "draft-only", displayName: "Draft only", builtIn: false, source: "user" });
		const before = JSON.stringify(h.registry.toSaveData());
		await h.index.ensureFresh();
		assert.ok(!h.choices.definitions().some((def) => ["theme-only", "draft-only"].includes(def.id)));
		h.put("a.md", "[!theme-only] [!draft-only]");
		h.index.invalidate("a.md");
		await h.index.ensureFresh();
		for (const id of ["theme-only", "draft-only"]) {
			assert.equal(h.choices.definitions().filter((def) => def.id === id).length, 1);
			assert.equal(h.choices.isRegistered(h.choices.definitions().find((def) => def.id === id)!), false, "uncommitted and theme-only definitions belong to the observed group");
			assert.equal(h.index.query(h.choices.resolve([id]).ids).totalCount, 1);
		}
		assert.equal(JSON.stringify(h.registry.toSaveData()), before);
		h.registry.setPreviewDefinition(null);
		h.index.dispose();
	});

	it("removes vanished types from available choices while retaining an explicit zero-result filter", async () => {
		const h = harness("[!first-unknown] [!second-unknown]");
		await h.index.ensureFresh();
		assert.ok(h.choices.definitions().some((def) => def.id === "second-unknown"));
		h.put("a.md", "[!first-unknown]");
		h.index.invalidate("a.md");
		await h.index.ensureFresh();
		assert.ok(!h.choices.definitions().some((def) => def.id === "second-unknown"));
		assert.ok(h.choices.definitions("second-unknown").some((def) => def.id === "second-unknown"));
		assert.equal(h.choices.isRegistered(h.choices.definitions("second-unknown").find((def) => def.id === "second-unknown")!), false, "retained zero-result selections stay unregistered");
		assert.equal(h.choices.resolve(["second-unknown"]).id, "second-unknown");
		assert.ok(!h.choices.definitions("first-unknown").some((def) => def.id === "second-unknown"), "retained selection never enters the general options");
		assert.equal(h.index.query(["second-unknown"]).totalCount, 0);
		h.index.dispose();
	});

	it("adopts the registered owner when a formerly unknown type becomes its alias", async () => {
		const h = harness("[!mystery type] [!owner] [!other alias]");
		await h.index.ensureFresh();
		assert.equal(h.choices.resolve(["mystery-type"]).id, "mystery type");
		assert.equal(h.choices.isRegistered(h.choices.definitions().find((def) => def.id === "mystery type")!), false);
		h.registry.add({ ...h.registry.get("note")!, id: "owner", displayName: "Owner", builtIn: false, source: "user", aliases: ["mystery type", "other alias"] });
		h.choices.invalidate();
		const selected = h.choices.resolve(["mystery-type"]);
		assert.equal(selected.id, "owner");
		assert.equal(h.index.query(selected.ids).totalCount, 3);
		assert.ok(!h.choices.definitions().some((def) => ["mystery type", "other alias"].includes(def.id)));
		assert.equal(h.choices.isRegistered(h.choices.definitions().find((def) => def.id === "owner")!), true, "alias promotion moves the choice into the registered group");
		h.index.dispose();
	});

	it("reuses the observed-type snapshot while typing, without rescanning or requerying the vault", async () => {
		const h = harness("[!unknown]");
		await h.index.ensureFresh();
		h.choices.definitions();
		const reads = h.reads.length;
		const query = h.index.query.bind(h.index);
		let queries = 0;
		h.index.query = (...args) => { queries++; return query(...args); };
		for (let i = 0; i < 50; i++) {
			h.index.invalidateEditor("a.md");
			assert.ok(h.choices.definitions().some((def) => def.id === "unknown"));
			h.choices.resolve(["unknown"]);
		}
		assert.equal(queries, 0);
		assert.equal(h.reads.length, reads);
		h.index.dispose();
	});
});
