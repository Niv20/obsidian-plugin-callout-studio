import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Component, type App } from "obsidian";
import { DEFAULT_CALLOUTS } from "../src/defaultCallouts";
import { getLocale, registerLocale, setLocale, t } from "../src/i18n";
import { CalloutRegistry } from "../src/manager/CalloutRegistry";
import type { RecoverySource, SettingsRecoveryService } from "../src/manager/settingsRecoveryService";
import { setupDetails, type SetupDetails } from "../src/manager/setupDetails";
import { mergeVersions, type SetupVersion } from "../src/manager/setupVersions";
import { SettingsRecoveryDetailsModal } from "../src/settings/SettingsRecoveryDetailsModal";
import { SettingsRecoveryModal } from "../src/settings/SettingsRecoveryModal";
import { recoveryFieldLabel } from "../src/settings/recoveryDetailFields";
import { recoverySourceTime, renderRecoveryDetails } from "../src/settings/recoveryDetailsView";
import { formatNumber } from "../src/settings/recoveryValues";
import type { CustomPalette, PluginData } from "../src/types";
import { definition } from "./support/discoveryHarness";
import { fakeDom, type FakeElement } from "./support/fakeDom";
import { TestKeymap, TestScope } from "./support/fakeKeymap";

function savedSetup(): PluginData {
	const registry = new CalloutRegistry(); registry.load(null);
	return registry.toSaveData();
}

/** `current` is what runs now; `earlier` is the saved version restoring would bring back. */
function compare(current: Partial<PluginData>, earlier: Partial<PluginData> | null): SetupDetails {
	return setupDetails({ kind: "history", time: 123, path: null, historyHash: null, origin: "this-device", data: earlier }, current);
}

/** Drive the fake timers the batched render yields on, until `done` says it finished. */
async function settle(done: () => boolean): Promise<void> {
	for (let turn = 0; turn < 500 && !done(); turn++) {
		fakeDom.window.flushTimers();
		await new Promise(resolve => setImmediate(resolve));
	}
}

async function render(details: SetupDetails, locale = "en", isCurrent?: () => boolean) {
	fakeDom.light();
	const previousLocale = getLocale();
	setLocale(locale);
	const root = fakeDom.document.body.createDiv();
	const component = new Component(); component.load();
	let finished = false;
	const rendering = renderRecoveryDetails(root as unknown as HTMLElement, details, component, isCurrent)
		.then(() => { finished = true; });
	await settle(() => finished);
	await rendering;
	return { root, component, destroy: () => { component.unload(); root.remove(); setLocale(previousLocale); } };
}

const text = (element: FakeElement | null | undefined): string => element?.textContent ?? "";
const sections = (root: FakeElement): (string | null)[] =>
	root.querySelectorAll("[data-recovery-section]").map(section => section.getAttribute("data-recovery-section"));
const item = (root: FakeElement, key: string): FakeElement => {
	const found = root.querySelector(`[data-recovery-item="${key}"]`);
	assert.ok(found, key);
	return found;
};
const labels = (group: FakeElement): string[] => group.querySelectorAll(".cs-recovery-field-label").map(label => label.textContent);

function palette(over: Partial<CustomPalette> = {}): CustomPalette {
	return { id: "cp-sea", name: "Sea", colorLight: "#111111", colorDark: "#222222", bgColorLight: "#333333",
		bgColorDark: "#444444", textColorLight: "#555555", textColorDark: "#666666", ...over };
}

/** A difference in every section that has one, so order and numbering can be checked together. */
function everySection(): SetupDetails {
	const current = savedSetup(), earlier = savedSetup();
	earlier.callouts = [definition({ id: "mine" })];
	current.callouts = [{ ...DEFAULT_CALLOUTS.find(row => row.id === "note")!, colorLight: "#123456" }];
	earlier.settings.iconSources.materialWeightDefault = 700;
	earlier.settings.fallbackCalloutId = "tip";
	earlier.settings.customPalettes = [palette()];
	earlier.settings.globalStyle.borderRadius = 19;
	earlier.settings.contextMenu.enabled = false;
	earlier.settings.disabledFixedCommands = ["open-settings"];
	earlier.settings.language = "he";
	Object.assign(earlier.settings, { futureSetting: "from a newer version" });
	return compare(current, earlier);
}

describe("earlier setup detail reports", () => {
	it("starts with the titled change panel, without source information or filenames", async () => {
		const current = savedSetup(), earlier = savedSetup();
		earlier.callouts = [definition({ id: "mine" })];
		const source: RecoverySource = { kind: "history", time: 3000, path: null, historyHash: "history", origin: "this-device", data: earlier, reason: "edit" };
		const backup: RecoverySource = { ...source, kind: "backup", time: 2000, path: "backups/saved.json", historyHash: null, reason: "before-import" };
		const copy: RecoverySource = { ...source, kind: "copy", time: null, path: "plugins/callout-studio/data conflicted copy.json", historyHash: null, reason: undefined };
		const anotherCopy: RecoverySource = { ...copy, time: 1000, path: "plugins/callout-studio/data עותק.json" };
		const version = mergeVersions([source, backup, copy, anotherCopy])[0]!;
		const h = await render({ ...setupDetails(source, current), version });
		try {
			assert.equal(h.root.querySelector(".cs-version-category"), null);
			assert.equal(h.root.querySelector(".cs-version-badge"), null);
			assert.equal(h.root.querySelector(".cs-version-places"), null);
			assert.equal(h.root.querySelectorAll(".cs-version-place").length, 0);
			assert.equal(h.root.querySelector(".cs-version-detail-name"), null);
			assert.equal(h.root.querySelector(".cs-recovery-detail-source"), null);
			assert.equal(h.root.querySelector(".cs-recovery-detail-saved"), null);
			assert.equal(h.root.querySelectorAll(".cs-version-detail-card").length, 0);
			const outcome = h.root.querySelector(".cs-recovery-detail-outcome");
			assert.ok(outcome);
			assert.equal(h.root.querySelector(".cs-recovery-detail-summary")?.children[0], outcome);
			assert.equal(outcome.children[0], outcome.querySelector(".cs-recovery-change-title"));
			assert.equal(text(outcome.querySelector(".cs-recovery-change-title")), t("recovery.details.changesTitle"));
			const divider = outcome.querySelector(".cs-recovery-change-divider");
			assert.equal(text(divider?.querySelector(".cs-recovery-count-total")), t("versions.details.difference", { count: 1 }));
			const counts = outcome.querySelector(".cs-recovery-change-counts");
			assert.equal(text(counts?.querySelector(".cs-recovery-state.is-added")), t("recovery.details.count.added", { count: 1 }));
			assert.equal(counts?.querySelector(".cs-recovery-count-total"), null, "the divider owns the total, separate from the kind badges");
			assert.equal(outcome.querySelector(".cs-recovery-detail-prose"), null);
			assert.equal(h.root.querySelectorAll(".cs-version-place-reason").length, 0);
			assert.equal(h.root.querySelectorAll(".cs-version-place-when").length, 0);
			assert.equal(h.root.querySelectorAll(".cs-version-copy-file").length, 0);
			for (const filename of ["saved.json", "data עותק.json", "data conflicted copy.json"]) {
				assert.ok(!h.root.textContent.includes(filename), "internal filenames are not user-facing");
			}
		} finally { h.destroy(); }
	});

	it("shows the comparison outcome for identical and unreadable versions, even with no known date", async () => {
		for (const data of [savedSetup(), null]) {
			const source: RecoverySource = { kind: "copy", time: null, path: "data copy.json", historyHash: null, origin: null, data };
			const version = mergeVersions([source])[0]!;
			const h = await render({ ...setupDetails(source, savedSetup()), version });
			try {
				assert.equal(h.root.querySelectorAll(".cs-version-category").length, 0);
				assert.equal(h.root.querySelector(".cs-recovery-detail-saved"), null);
				assert.equal(h.root.querySelector(".cs-version-copy-file"), null);
				assert.equal(text(h.root.querySelector(".cs-recovery-change-divider")), t(data ? "recovery.same" : "versions.details.comparisonUnavailable"));
				assert.equal(h.root.querySelector(".cs-recovery-change-counts"), null);
				if (!data) assert.equal(text(h.root.querySelector(".cs-recovery-detail-prose")), t("recovery.details.unreadable"));
				assert.equal(h.root.querySelectorAll("table").length, 0);
			} finally { h.destroy(); }
		}
	});

	it("splits the report into the settings page's sections, in its order, each a four-column table", async () => {
		const h = await render(everySection());
		try {
			assert.deepEqual(sections(h.root),
				["user", "builtin", "iconSources", "fallback", "palettes", "style", "contextMenu", "commands", "language", "other"]);
			for (const section of h.root.querySelectorAll("[data-recovery-section]")) {
				assert.equal(section.tagName.toLowerCase(), "table");
				const toggle = section.querySelector("thead .cs-recovery-section-toggle");
				assert.ok(toggle, "the title row folds the section");
				// The shared heading count, beside the title rather than inside
				// it, so a title cut short still shows how many changes it holds.
				const count = toggle.children.find(child => child.hasClass("cs-heading-count"));
				assert.equal(text(count), ` (${section.querySelectorAll("tbody").length})`);
				assert.deepEqual(section.querySelectorAll(".cs-recovery-column-row th").map(th => th.textContent), [
					t("recovery.details.column.number"), t("recovery.details.column.item"),
					t("recovery.details.current"), t("recovery.details.restored"),
				]);
			}
		} finally { h.destroy(); }
	});

	it("numbers every change once, continuously across sections, over all of its rows", async () => {
		const h = await render(everySection());
		try {
			const numbers = h.root.querySelectorAll(".cs-recovery-number");
			assert.deepEqual(numbers.map(cell => cell.textContent), numbers.map((_, index) => String(index + 1)));
			for (const cell of numbers) {
				assert.equal(cell.getAttribute("rowspan"), String(cell.closest("tbody")!.querySelectorAll("tr").length));
			}
			assert.equal(text(h.root.querySelector(".cs-recovery-count-total")), t("versions.details.differences", { count: numbers.length }));
		} finally { h.destroy(); }
	});

	it("keeps every change to one callout in one row group, one line per field, never in boxes", async () => {
		const current = savedSetup(), earlier = savedSetup();
		current.callouts = [definition({ id: "wow", icon: { type: "lucide", value: "star" }, colorLight: "#111111", foldable: false })];
		earlier.callouts = [definition({ id: "wow", icon: { type: "emoji", value: "🚀" }, colorLight: "#222222", foldable: true })];
		const h = await render(compare(current, earlier));
		try {
			assert.equal(h.root.querySelectorAll('[data-recovery-item="callout:wow"]').length, 1);
			const group = item(h.root, "callout:wow");
			assert.deepEqual(labels(group), ["icon", "colorLight", "foldable"].map(recoveryFieldLabel));
			const [now, restored] = group.querySelectorAll(".cs-recovery-field-row")[1]!.querySelectorAll("td");
			assert.ok(text(now).includes("#111111"));
			assert.ok(text(restored).includes("#222222"));
			assert.ok(text(group.querySelectorAll(".cs-recovery-field-row")[0]).includes("🚀"), "the emoji itself is drawn");
			assert.equal(h.root.querySelectorAll("details").length, 0);
			assert.equal(h.root.querySelectorAll(".cs-recovery-change-field").length, 0);
		} finally { h.destroy(); }
	});

	it("shows a long value as an excerpt with its length, never behind a disclosure", async () => {
		const long = `start ${"payload ".repeat(400)}END-OF-VALUE`;
		const current = savedSetup(), earlier = savedSetup();
		current.callouts = [definition({ id: "long" })];
		earlier.callouts = [definition({ id: "long", metadata: { note: long } })];
		const h = await render(compare(current, earlier));
		try {
			assert.equal(h.root.querySelectorAll("details").length, 0);
			assert.ok(!text(h.root).includes("END-OF-VALUE"));
			assert.ok(text(h.root).includes(t("recovery.details.value.longText", { count: formatNumber(long.length) })));
		} finally { h.destroy(); }
	});

	it("renders hostile saved text and keys literally without creating active content", async () => {
		const hostile = '<img src="https://example.invalid/track" onerror="alert(1)"><script>dangerous()</script>';
		const current = savedSetup();
		const earlier = { ...savedSetup(), callouts: [definition({ id: "literal", displayName: hostile, metadata: { note: hostile } })] };
		Object.assign(earlier.settings, JSON.parse('{"<iframe src=remote>":"literal unknown key"}') as Record<string, unknown>);
		const h = await render(compare(current, earlier));
		try {
			assert.ok(text(h.root).includes(hostile));
			assert.ok(text(h.root).includes("<iframe src=remote>"));
			for (const tag of ["img", "script", "iframe", "a"]) assert.equal(h.root.querySelectorAll(tag).length, 0, tag);
		} finally { h.destroy(); }
	});

	it("shows a global style change once, in the style section, and no callout rows for it", async () => {
		const current = savedSetup(), earlier = savedSetup();
		earlier.settings.globalStyle.borderRadius = 19;
		const h = await render(compare(current, earlier));
		try {
			assert.deepEqual(sections(h.root), ["style"]);
			const rows = item(h.root, "style:regular").querySelectorAll(".cs-recovery-field-row");
			assert.equal(rows.length, 1);
			assert.equal(text(rows[0]!.querySelector(".cs-recovery-field-label")), recoveryFieldLabel("borderRadius"));
			assert.deepEqual(rows[0]!.querySelectorAll("td").map(cell => cell.textContent),
				[t("recovery.details.value.px", { value: "4" }), t("recovery.details.value.px", { value: "19" })]);
		} finally { h.destroy(); }
	});

	it("folds a section down to its title row and back", async () => {
		const current = savedSetup(), earlier = savedSetup();
		earlier.settings.globalStyle.borderRadius = 19;
		const h = await render(compare(current, earlier));
		try {
			const table = h.root.querySelector('[data-recovery-section="style"]')!;
			const toggle = table.querySelector(".cs-recovery-section-toggle")!;
			assert.equal(toggle.tagName.toLowerCase(), "button");
			assert.equal(toggle.getAttribute("aria-expanded"), "true");
			toggle.fire("click");
			assert.ok(table.hasClass("is-collapsed"));
			assert.ok(table.querySelector(".cs-recovery-section-heading")!.hasClass("is-collapsed"), "the chevron turns");
			assert.equal(toggle.getAttribute("aria-expanded"), "false");
			toggle.fire("click");
			assert.ok(!table.hasClass("is-collapsed"));
			h.component.unload();
			toggle.fire("click");
			assert.ok(!table.hasClass("is-collapsed"), "the listener goes with the window's component");
		} finally { h.destroy(); }
	});

	it("matches palettes by id, so a rename is one changed row with its fields", async () => {
		const current = savedSetup(), earlier = savedSetup();
		current.settings.customPalettes = [palette()];
		earlier.settings.customPalettes = [palette({ name: "Ocean", colorLight: "#abcdef" }), palette({ id: "cp-new", name: "New" })];
		const h = await render(compare(current, earlier));
		try {
			assert.deepEqual(labels(item(h.root, "palette:cp-sea")), ["name", "colorLight"].map(recoveryFieldLabel));
			const added = item(h.root, "palette:cp-new");
			assert.ok(added.hasClass("is-added"));
			assert.ok(text(added).includes(t("recovery.details.onlySaved")));
		} finally { h.destroy(); }
	});

	it("names each context-menu entry that is shown or hidden, and lists a changed order", async () => {
		const current = savedSetup(), earlier = savedSetup();
		const regular = structuredClone(current.settings.contextMenu.items.regular).reverse();
		regular[0]!.enabled = !regular[0]!.enabled;
		earlier.settings.contextMenu.items.regular = regular;
		const h = await render(compare(current, earlier));
		try {
			const group = item(h.root, "menu:regular");
			assert.equal(labels(group).at(-1), t("recovery.details.order"));
			assert.equal(group.querySelectorAll("ol").length, 2);
			assert.ok(labels(group).length >= 2, "a visibility row and the order row");
		} finally { h.destroy(); }
	});

	it("names each library shown or hidden in Pick an icon, and lists a changed library order", async () => {
		const current = savedSetup(), earlier = savedSetup();
		earlier.settings.iconLibraries = {
			order: ["image", "lucide", "tabler", "material", "emoji", "octicons", "fa", "rpg-awesome", "simple-icons"],
			hidden: ["emoji"],
		};
		const h = await render(compare(current, earlier));
		try {
			assert.deepEqual(sections(h.root), ["iconSources"]);
			const group = item(h.root, "iconLibraries");
			assert.deepEqual(labels(group), [t("iconPicker.emoji"), t("recovery.details.order")]);
			assert.equal(group.querySelectorAll("ol").length, 2, "the order as it is, and as it would be");
			assert.ok(text(group).includes(t("iconPicker.custom")), "libraries are named as the picker names them");
		} finally { h.destroy(); }
	});

	it("reads an order written out in the catalog's own sequence as no difference", async () => {
		const current = savedSetup(), earlier = savedSetup();
		earlier.settings.iconLibraries = {
			order: ["lucide", "tabler", "material", "emoji", "octicons", "fa", "rpg-awesome", "simple-icons", "image"],
			hidden: [],
		};
		const h = await render(compare(current, earlier));
		try {
			assert.deepEqual(sections(h.root), []);
		} finally { h.destroy(); }
	});

	it("shows custom commands by their setup and built-in commands as on or off", async () => {
		const current = savedSetup(), earlier = savedSetup();
		earlier.settings.customCommands = [{ id: "cc-one", calloutId: "note", role: "heading", headingLevel: 3 }];
		earlier.settings.disabledFixedCommands = ["open-settings"];
		const h = await render(compare(current, earlier));
		try {
			const command = item(h.root, "command:cc-one");
			assert.ok(command.hasClass("is-added"));
			assert.ok(text(command).includes("[!note]"));
			assert.ok(text(command).includes(t("recovery.details.value.headingLevel", { value: 3 })));
			assert.deepEqual(item(h.root, "fixed:open-settings").querySelectorAll("td").map(cell => cell.textContent),
				[t("recovery.details.value.on"), t("recovery.details.value.off")]);
		} finally { h.destroy(); }
	});

	it("labels settings this version does not know by their saved keys", async () => {
		const current = savedSetup(), earlier = savedSetup();
		Object.assign(earlier.settings, { futureSetting: { futurePreference: "future-value" } });
		const h = await render(compare(current, earlier));
		try {
			assert.deepEqual(sections(h.root), ["other"]);
			const group = item(h.root, "other:futureSetting");
			for (const literal of ["futureSetting", "futurePreference", "future-value"]) assert.ok(text(group).includes(literal), literal);
		} finally { h.destroy(); }
	});

	it("localizes the difference labels while identifiers stay literal", async () => {
		registerLocale("fr", {
			"recovery.details.field.colorLight": "Couleur traduite",
			"recovery.details.changesTitle": "Modifications traduites",
			"versions.details.difference": "{{count}} différence traduite",
		});
		const current = savedSetup(), earlier = savedSetup();
		current.callouts = [definition({ id: "fixed-callout-id" })];
		earlier.callouts = [definition({ id: "fixed-callout-id", colorLight: "#abcdef" })];
		const details = compare(current, earlier);
		const h = await render({ ...details, version: mergeVersions([details.source])[0]! }, "fr");
		try {
			assert.equal(text(h.root.querySelector(".cs-recovery-change-title")), "Modifications traduites");
			assert.equal(text(h.root.querySelector(".cs-recovery-count-total")), "1 différence traduite");
			assert.deepEqual(labels(item(h.root, "callout:fixed-callout-id")), ["Couleur traduite"]);
			assert.ok(text(h.root).includes("[!fixed-callout-id]"));
		} finally { h.destroy(); }
	});

	it("stops drawing as soon as the window has moved on", async () => {
		const current = savedSetup(), earlier = savedSetup();
		earlier.callouts = Array.from({ length: 20 }, (_, index) => definition({ id: `extra-${index}` }));
		// The window is asked after each batch; answering "moved on" ends the render there.
		const h = await render(compare(current, earlier), "en", () => false);
		try {
			const drawn = h.root.querySelectorAll(".cs-recovery-item").length;
			assert.ok(drawn > 0 && drawn < 20, `drew ${drawn} of 20`);
		} finally { h.destroy(); }
	});

	it("says so when there is nothing to compare or nothing differs", async () => {
		const unreadable = await render(compare(savedSetup(), null));
		const same = await render(compare(savedSetup(), savedSetup()));
		try {
			assert.ok(text(unreadable.root).includes(t("recovery.details.unreadable")));
			assert.ok(text(same.root).includes(t("recovery.same")));
			assert.equal(same.root.querySelectorAll("table").length, 0);
		} finally { unreadable.destroy(); same.destroy(); }
	});
});

describe("viewing details from Version history", () => {
	it("renders the report in the window and cleans it up when the window closes", async () => {
		const previous = getLocale(); setLocale("en");
		const app = { keymap: new TestKeymap(), scope: new TestScope() } as unknown as App;
		const earlier = savedSetup(); earlier.settings.globalStyle.borderRadius = 19;
		const details = compare(savedSetup(), earlier);
		const modal = new SettingsRecoveryDetailsModal(app, details);
		const containerEl = fakeDom.document.body.createDiv({ cls: "modal-container" });
		const modalEl = containerEl.createDiv({ cls: "modal" });
		const titleEl = modalEl.createDiv({ cls: "modal-header" }).createDiv({ cls: "modal-title" });
		const contentEl = modalEl.createDiv({ cls: "modal-content" });
		Object.assign(modal, { containerEl, modalEl, titleEl, contentEl, app, scope: app.scope,
			setTitle: (title: string) => { titleEl.setText(title); return modal; } });
		const ready = () => contentEl.getAttribute("aria-busy") === "false";
		try {
			modal.onOpen();
			await settle(ready);
			assert.ok(titleEl.textContent.startsWith(t("versions.details.title")));
			assert.equal(text(titleEl.querySelector(".cs-version-detail-date")), ` (${recoverySourceTime(details.source)})`);
			assert.ok(modalEl.hasClass("cs-modal-wide"));
			assert.deepEqual(sections(contentEl), ["style"]);
			modal.onOpen();
			await settle(ready);
			assert.equal(contentEl.querySelectorAll(".cs-recovery-detail-report").length, 1, "reopening replaces the report");
			assert.equal(titleEl.querySelectorAll(".cs-version-detail-date").length, 1, "reopening replaces the title date");
			modal.onClose();
			assert.equal(contentEl.children.length, 0);
			assert.ok(!modalEl.hasClass("cs-modal-wide"));
		} finally { modal.onClose(); containerEl.remove(); setLocale(previous); }
	});

	it("shows the unknown-time notice in the window title when the source has no date", async () => {
		const previous = getLocale(); setLocale("en");
		const app = { keymap: new TestKeymap(), scope: new TestScope() } as unknown as App;
		const data = savedSetup();
		const source: RecoverySource = { kind: "copy", time: null, path: "data copy.json", historyHash: null, origin: null, data };
		const modal = new SettingsRecoveryDetailsModal(app, setupDetails(source, data));
		const containerEl = fakeDom.document.body.createDiv({ cls: "modal-container" });
		const modalEl = containerEl.createDiv({ cls: "modal" });
		const titleEl = modalEl.createDiv({ cls: "modal-header" }).createDiv({ cls: "modal-title" });
		const contentEl = modalEl.createDiv({ cls: "modal-content" });
		Object.assign(modal, { containerEl, modalEl, titleEl, contentEl, app, scope: app.scope,
			setTitle: (title: string) => { titleEl.setText(title); return modal; } });
		try {
			modal.onOpen();
			await settle(() => contentEl.getAttribute("aria-busy") === "false");
			assert.equal(text(titleEl.querySelector(".cs-version-detail-date")), ` (${t("recovery.details.unknownTime")})`);
			assert.equal(contentEl.querySelector(".cs-recovery-detail-source"), null);
		} finally { modal.onClose(); containerEl.remove(); setLocale(previous); }
	});

	// Even a version identical to now has a comparison outcome to show.
	it("opens details for frozen, identical and unreadable rows, without restoring anything", () => {
		const previous = getLocale(); setLocale("en");
		const opened: SettingsRecoveryDetailsModal[] = [];
		const descriptor = Object.getOwnPropertyDescriptor(SettingsRecoveryDetailsModal.prototype, "open");
		Object.defineProperty(SettingsRecoveryDetailsModal.prototype, "open", { configurable: true, value: function (this: SettingsRecoveryDetailsModal) { opened.push(this); } });
		let restoreCalls = 0, detailsCalls = 0;
		const app = { keymap: new TestKeymap(), scope: new TestScope() } as unknown as App;
		try {
			for (const mode of ["frozen", "identical", "unreadable"] as const) {
				const source: RecoverySource = { kind: "copy", time: null, path: "data copy.json", historyHash: null, origin: null,
					data: mode === "unreadable" ? null : savedSetup() };
				const [version] = mergeVersions([source]);
				const recovery = {
					details: (selected: RecoverySource, of?: SetupVersion) => {
						detailsCalls++;
						assert.equal(selected, source);
						assert.equal(of, version, "the report classifies the complete version");
						return setupDetails(selected, savedSetup());
					},
					difference: () => ({ callouts: 1, changed: mode === "identical" ? 0 : 1 }),
					restore: () => { restoreCalls++; return Promise.resolve("restored" as const); },
					remove: () => Promise.resolve(true),
				} as unknown as SettingsRecoveryService;
				const modal = new SettingsRecoveryModal(app, { recovery, settingsWriter: { isFrozen: mode === "frozen" } });
				Object.assign(modal, { app });
				const root = fakeDom.document.body.createDiv();
				try {
					const renderer = modal as unknown as { renderRow(parent: HTMLElement, version: SetupVersion): void };
					renderer.renderRow(root as unknown as HTMLElement, version!);
					const view = root.querySelectorAll(".clickable-icon").find(element => element.dataset.csTooltip === t("recovery.details.view"));
					assert.ok(view, mode);
					assert.notEqual(view.getAttribute("aria-disabled"), "true");
					view.fire("click");
					assert.equal((opened.at(-1) as unknown as { details: SetupDetails }).details.source.data === null, mode === "unreadable");
					assert.equal(restoreCalls, 0);
				} finally { root.remove(); }
			}
			assert.equal(detailsCalls, 3);
			assert.equal(opened.length, 3);
		} finally {
			if (descriptor) Object.defineProperty(SettingsRecoveryDetailsModal.prototype, "open", descriptor);
			else Reflect.deleteProperty(SettingsRecoveryDetailsModal.prototype, "open");
			setLocale(previous);
		}
	});
});
