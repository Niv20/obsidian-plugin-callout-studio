/** Read-only guide fixtures. Production components own every control and preview. */
import { MarkdownView } from "obsidian";
import { t } from "../../src/i18n/index.ts";
import { CalloutCombobox } from "../../src/settings/calloutCombobox.ts";
import { createOccurrencesFrame } from "../../src/usage/occurrencesViewFrame.ts";
import { OccurrenceResults } from "../../src/usage/occurrenceResults.ts";
import { OccurrenceTypeChoices, occurrencePickerChoices, ALL_TYPES_ID } from "../../src/usage/occurrenceTypeChoices.ts";
import { scanCalloutOccurrences } from "../../src/usage/scanCalloutOccurrences.ts";
import { SettingsRecoveryModal } from "../../src/settings/SettingsRecoveryModal.ts";
import { SettingsRecoveryDetailsModal } from "../../src/settings/SettingsRecoveryDetailsModal.ts";
import { mergeVersions } from "../../src/manager/setupVersions.ts";
import { setupDetails } from "../../src/manager/setupDetails.ts";
import { differingEntries } from "../../src/manager/setupDifference.ts";
import { renderSaveStatusBanner } from "../../src/settings/saveStatusBanner.ts";
import { renderBackupSection, renderResetSection } from "../../src/settings/sections/DataManagementSection.ts";
import { createPortableConversionFrame, updatePortableSelection } from "../../src/portable/portableConversionFrame.ts";
import { portableConversionRows, renderPortableConversionRows } from "../../src/portable/portableConversionRows.ts";
import { preparePortableCalloutConversion } from "../../src/utils/portableCalloutVault.ts";
import { PortableConversionHelpModal } from "../../src/portable/PortableConversionHelpModal.ts";
import { QuickInsertModal } from "../../src/settings/QuickInsertModal.ts";
import { openModal } from "./fixture-host.mjs";

const copy = value => JSON.parse(JSON.stringify(value));
const waitFor = async predicate => {
	for (let count = 0; count < 60; count++) {
		if (predicate()) return;
		await new Promise(resolve => setTimeout(resolve, 20));
	}
	throw new Error("The production guide component did not finish rendering");
};
const metadata = (title, description) => ({ selector: "#guide-scene", title, description });

function seedCallouts(plugin) {
	const base = plugin.registry.getReal("note");
	for (const row of [
		{ id: "project", displayName: "Project note", icon: { type: "lucide", value: "folder-kanban" }, colorDark: "#a78bfa", colorLight: "#7c3aed" },
		{ id: "meeting", displayName: "Meeting", icon: { type: "lucide", value: "users" }, colorDark: "#60a5fa", colorLight: "#2563eb" },
		{ id: "decision", displayName: "Decision", icon: { type: "lucide", value: "check-check" }, colorDark: "#34d399", colorLight: "#059669" },
	]) if (!plugin.registry.has(row.id)) plugin.registry.add({ ...copy(base), ...row, builtIn: false, source: "user" });
	plugin.cssInjector.inject(false);
}

function panel(cls, width = 780) {
	const el = document.body.createDiv({ cls, attr: { id: "guide-scene" } });
	el.style.width = `${width}px`;
	return el;
}

function clearFileHeadingBackgrounds(root) {
	// These static illustrations keep file labels on the surrounding surface.
	for (const heading of root.querySelectorAll(".cs-sidebar-file-heading")) heading.style.background = "transparent";
}

const noteSources = {
	"Projects/Launch plan.md": "# [!project] Launch plan\n\n> [!project] Scope\n> Ship the first milestone this month.\n\nChoose [!decision]{the smaller release} before expanding the scope.\n\n> [!note] Next steps\n> Invite the design team to review.\n",
	"Meetings/Design review.md": "# [!meeting] Design review\n\n> [!meeting] Agenda\n> Review the prototype and open questions.\n\nMark the approved layout as [!decision]{ready for implementation}.\n\n> [!project] Follow-up\n> Add the revised icons to the next milestone.\n",
	"Inbox/Ideas.md": "> [!idea] Try a smaller pilot\n> Gather feedback from two teams first.\n\n> [!project] Pilot checklist\n> Keep the scope small and measurable.\n",
};

function syntheticVault(plugin, sources = noteSources) {
	const files = Object.entries(sources).map(([path, text]) => ({ path, basename: path.split("/").at(-1).replace(/\.md$/, ""), extension: "md", stat: { mtime: 1791090000000, size: text.length } }));
	const byPath = new Map(files.map(file => [file.path, file]));
	Object.assign(plugin.app.vault, {
		getMarkdownFiles: () => files,
		getAbstractFileByPath: path => byPath.get(path) ?? null,
		read: async file => sources[file.path],
		cachedRead: async file => sources[file.path],
		process: async () => { throw new Error("Guide fixtures never change notes"); },
		on: () => ({}), offref() {},
	});
	plugin.app.metadataCache ??= {};
	plugin.app.metadataCache.getFirstLinkpathDest = (path, sourcePath) => byPath.get(path) ?? byPath.get(`${path}.md`) ?? byPath.get(`${sourcePath.split("/").slice(0, -1).join("/")}/${path}.md`) ?? null;
	return files;
}

async function findScene(plugin, pickerOpen) {
	seedCallouts(plugin);
	const all = Object.entries(noteSources).flatMap(([path, text]) => scanCalloutOccurrences(path, text));
	const index = { dataRevision: 1, query: () => ({ occurrences: all, fileCount: Object.keys(noteSources).length }) };
	const types = new OccurrenceTypeChoices(plugin.registry, index);
	const root = panel("view-content cs-occurrences-view", 640);
	root.style.height = "650px";
	const frame = createOccurrencesFrame(root);
	let selected = pickerOpen ? ALL_TYPES_ID : "project";
	const picker = new CalloutCombobox(frame.pickerHost, {
		registry: plugin.registry, choices: () => occurrencePickerChoices(types, selected), value: selected,
		ariaLabel: t("vaultStats.columnType"), labelOf: def => def.id === ALL_TYPES_ID ? t("usage.allTypes") : def.id,
		iconlessOptionId: ALL_TYPES_ID, hideSingleGroup: true, showSingleGroupKey: "browse",
		groupOf: def => def.id === ALL_TYPES_ID ? { key: "browse", label: t("usage.browse"), order: -1 }
			: types.isRegistered(def) ? { key: "registered", label: t("usage.registeredCallouts"), order: 0 }
			: { key: "unregistered", label: t("usage.unregisteredCallouts"), order: 1 },
		onChange: id => { selected = id; picker.setValue(id); },
	});
	const shown = pickerOpen ? all : all.filter(row => row.rawId === "project");
	frame.summary.setText(t("usage.summary", { count: shown.length, files: new Set(shown.map(row => row.path)).size }));
	new OccurrenceResults(100).render(frame.results, shown, 100, true, () => {}, () => {});
	clearFileHeadingBackgrounds(frame.results);
	if (pickerOpen) {
		const input = frame.pickerHost.querySelector("input");
		input.click();
		// A real search makes registered and note-only choices visible together.
		input.value = "de";
		input.dispatchEvent(new Event("input", { bubbles: true }));
		await waitFor(() => input.getAttribute("aria-expanded") === "true");
	}
	return metadata(pickerOpen ? "Find callouts: searchable type picker" : "Find callouts: Project note occurrences",
		pickerOpen ? "The production CalloutCombobox searches registered types and the unregistered idea type derived by the real source scanner from synthetic notes."
			: "The production occurrences sidebar frame and cards show source references to project across three synthetic notes, with block and heading formats counted separately.");
}

function recoveryFixture(plugin) {
	seedCallouts(plugin);
	const current = copy(plugin.registry.toSaveData());
	const previous = copy(current);
	previous.callouts.find(row => row.id === "project").colorDark = "#fbbf24";
	previous.callouts.find(row => row.id === "project").colorLight = "#d97706";
	previous.callouts.find(row => row.id === "project").icon = { type: "lucide", value: "lightbulb" };
	previous.callouts = previous.callouts.filter(row => row.id !== "decision");
	const oldest = copy(previous);
	oldest.callouts = oldest.callouts.filter(row => row.id !== "meeting");
	const source = (data, kind, time, reason) => ({ kind, time, reason, data, origin: "this-device", path: kind === "backup" ? ".obsidian/plugins/callout-studio/backups/example.json" : null, historyHash: kind === "history" ? `fixture-${time}` : null });
	const sources = [
		source(current, "history", 1791093600000, "edit"),
		source(previous, "backup", 1791089400000, "before-import"),
		source(oldest, "backup", 1791003000000, "before-reset"),
		source(oldest, "history", 1791002400000, "edit"),
	];
	const versions = mergeVersions(sources);
	plugin.recovery = {
		listVersions: async () => versions,
		difference: data => ({ callouts: data.callouts?.length ?? 0, changed: differingEntries(current, data).size }),
		details: (source, version) => ({ ...setupDetails(source, current), version }),
		restore: async () => { throw new Error("Guide fixtures never restore settings"); },
		removeVersion: async () => { throw new Error("Guide fixtures never delete backups"); },
	};
	return { current, previous, versions };
}

async function historyScene(plugin) {
	recoveryFixture(plugin);
	const modal = new SettingsRecoveryModal(plugin.app, plugin);
	const result = openModal(modal, { title: "Version history", description: "The actual version-history timeline compares synthetic saved setups with the current setup. The entries and timestamps are documentation fixtures." });
	await waitFor(() => modal.contentEl.querySelector(".cs-recovery-row"));
	return result;
}

async function detailsScene(plugin) {
	const { versions } = recoveryFixture(plugin);
	const version = versions.find(row => row.reason.reason === "before-import");
	const modal = new SettingsRecoveryDetailsModal(plugin.app, plugin.recovery.details(version.copies[0], version));
	const result = openModal(modal, { title: "Compare an earlier version", description: "The production version-details modal computes the differences from synthetic saved setups and renders the actual comparison tables and callout previews." });
	await waitFor(() => modal.contentEl.getAttribute("aria-busy") === "false");
	return result;
}

async function pausedScene(plugin) {
	recoveryFixture(plugin);
	Object.assign(plugin.settingsWriter, {
		isFrozen: true, hasRecoveryState: true,
		status: { reason: "missing", frozenReason: "missing", subscribe: () => () => {} },
	});
	const root = panel("guide-saving-panels", 780);
	const savingPanel = root.createDiv({ cls: "callout-studio-settings cs-settings-paused guide-settings" });
	// The real settings pane removes its top inset; this standalone crop needs it.
	savingPanel.style.setProperty("padding", "32px", "important");
	renderSaveStatusBanner(plugin, savingPanel, { retry: async () => false, startFresh: async () => false, showBackup() {}, pausedNote: true });
	const historyPanel = root.createDiv({ cls: "callout-studio-settings cs-settings-paused guide-settings" });
	historyPanel.style.setProperty("padding", "32px", "important");
	renderBackupSection({ app: plugin.app, plugin, display() {}, registerDisposer() {} }, historyPanel);
	// A standalone section needs no divider or gap above its first heading.
	const historyHeading = historyPanel.querySelector(".setting-item-heading");
	historyHeading.style.setProperty("margin-top", "0");
	historyHeading.style.setProperty("padding-top", "0");
	historyHeading.style.setProperty("border-top", "none");
	return metadata("Saving paused: missing settings file", "Two separately framed settings crops show the actual Saving is paused banner above the production Version history section, with a visible gap between them. No settings file is read or written.");
}

async function conversionScene(plugin) {
	const conversionSources = {
		"Projects/Launch plan.md": "# [!project] Launch plan\n\nShip [!decision]{the first milestone} this month.\n\n> [!note] Next steps\n> Invite the design team to review.\n",
		"Meetings/Design review.md": "# [!meeting] Design review\n\nChoose [!tip]{a smaller pilot} before expanding the scope.\n\nMark the approved layout as [!decision]{ready}.\n",
	};
	syntheticVault(plugin, conversionSources);
	const plan = await preparePortableCalloutConversion(plugin.app);
	const root = panel("view-content cs-portable-view", 640);
	root.style.height = "670px";
	const frame = createPortableConversionFrame(root);
	frame.retry.hidden = true;
	updatePortableSelection(frame, plan, true);
	renderPortableConversionRows(frame.results, plan, portableConversionRows(plan), 100, false, undefined, () => {});
	clearFileHeadingBackgrounds(frame.results);
	return metadata("Review conversion before changing notes", "The actual conversion planner reads only synthetic Markdown. Its proposed heading and inline replacements are rendered by the production sidebar frame, selection summary, and before/after cards.");
}

async function resetScene(plugin) {
	seedCallouts(plugin);
	syntheticVault(plugin);
	const root = panel("callout-studio-settings guide-settings");
	renderResetSection({ app: plugin.app, plugin, display() {}, registerDisposer() {} }, root);
	root.querySelector("button.mod-warning").click();
	await waitFor(() => document.querySelector(".cs-confirm-acknowledge"));
	root.removeAttribute("id");
	root.style.display = "none";
	const modal = document.querySelector(".modal-container:last-of-type .modal");
	modal.id = "guide-scene";
	return metadata("Reset everything confirmation", "The real Danger zone action computes the inventory and note-reference count from synthetic callouts and notes, then opens its actual confirmation. The acknowledgement stays unticked; no reset is performed.");
}

function attachSyntheticEditor(plugin) {
	const view = new MarkdownView();
	const file = { path: "Projects/Launch plan.md", basename: "Launch plan" };
	const leaf = { view };
	Object.assign(view, { file, leaf, editor: { getCursor: () => ({ line: 0, ch: 0 }), getValue: () => "" }, getMode: () => "source" });
	plugin.app.workspace.getActiveViewOfType = type => view instanceof type ? view : null;
	plugin.app.workspace.getLeavesOfType = type => type === "markdown" ? [leaf] : [];
	plugin.app.workspace.getMostRecentLeaf = () => leaf;
	plugin.onIconCacheChange ??= () => () => {};
	plugin.localState.setQuickInsertSource ??= filter => { plugin.localState.quickInsertSource = filter; };
}

async function quickInsertScene(plugin, filtered) {
	seedCallouts(plugin);
	attachSyntheticEditor(plugin);
	plugin.localState.quickInsertSource = filtered ? "user" : "all";
	const modal = new QuickInsertModal(plugin);
	const result = openModal(modal, { title: filtered ? "Quick insert: My callouts" : "Quick insert block callout", description: filtered ? "The actual Quick insert modal filters to synthetic user-defined callouts and renders their real block previews. The source dropdown is opened through its production control."
		: "The actual Quick insert modal builds its previews with the plugin's generated CSS and reading processor. A synthetic writable note supplies the insertion target; nothing is inserted." });
	await waitFor(() => modal.contentEl.querySelector(".cs-qi-preview .callout"));
	if (filtered) {
		modal.contentEl.querySelector(".cs-quick-insert-filter input").click();
		await waitFor(() => modal.contentEl.querySelector(".cs-quick-insert-filter input").getAttribute("aria-expanded") === "true");
	}
	return result;
}

export const scenes = {
	"find-results": plugin => findScene(plugin, false),
	"find-picker": plugin => findScene(plugin, true),
	"version-history": historyScene,
	"version-details": detailsScene,
	"saving-paused": pausedScene,
	"conversion-review": conversionScene,
	"conversion-help": plugin => openModal(new PortableConversionHelpModal(plugin.app), { title: "About conversion", description: "The actual conversion-help modal shows the production Before/After examples and backup guidance." }),
	"reset-confirmation": resetScene,
	"quick-insert": plugin => quickInsertScene(plugin, false),
	"quick-insert-filter": plugin => quickInsertScene(plugin, true),
};
