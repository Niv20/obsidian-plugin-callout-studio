/** Read-only guide fixtures. Production components own every control and preview. */
import { MarkdownView } from "obsidian";
import { t } from "../../src/i18n/index.ts";
import { CalloutCombobox } from "../../src/settings/calloutCombobox.ts";
import { createOccurrencesFrame } from "../../src/usage/occurrencesViewFrame.ts";
import { OccurrenceResults } from "../../src/usage/occurrenceResults.ts";
import { OccurrenceTypeChoices, occurrencePickerChoices, ALL_TYPES_ID } from "../../src/usage/occurrenceTypeChoices.ts";
import { scanCalloutOccurrences } from "../../src/usage/scanCalloutOccurrences.ts";
import { VERSION_HISTORY_PAGE } from "../../src/settings/declarative/versionHistoryPage.ts";
import { SettingsRecoveryDetailsModal } from "../../src/settings/SettingsRecoveryDetailsModal.ts";
import { mergeVersions } from "../../src/manager/setupVersions.ts";
import { setupDetails } from "../../src/manager/setupDetails.ts";
import { differingEntries } from "../../src/manager/setupDifference.ts";
import { confirmAndResetEverything } from "../../src/settings/resetEverything.ts";
import { createPortableConversionFrame, updatePortableSelection } from "../../src/portable/portableConversionFrame.ts";
import { portableConversionRows, renderPortableConversionRows } from "../../src/portable/portableConversionRows.ts";
import { preparePortableCalloutConversion } from "../../src/utils/portableCalloutVault.ts";
import { PortableConversionHelpModal } from "../../src/portable/PortableConversionHelpModal.ts";
import { QuickInsertModal } from "../../src/settings/QuickInsertModal.ts";
import { mountSettings, openModal, settingsContext } from "./fixture-host.mjs";

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


/**
 * A sidebar view as Obsidian lays it out: the leaf's content, and in it the
 * view's content, which is returned. (The pane's icon button, help or filter,
 * is drawn by the pane's own frame, at the end of its first row.)
 */
function sidebarPanel(cls, width, height) {
	const leaf = document.body.createDiv({ cls: "workspace-leaf-content", attr: { id: "guide-scene" } });
	leaf.style.width = `${width}px`;
	leaf.style.height = `${height}px`;
	return leaf.createDiv({ cls: `view-content ${cls}` });
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
	const root = sidebarPanel("cs-occurrences-view", 640, 650);
	const frame = createOccurrencesFrame(root, () => {});
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
	if (pickerOpen) {
		// The field opens the list; its search box is inside the list.
		const field = frame.pickerHost.querySelector(".cs-combobox .cs-dropdown-field");
		field.click();
		await waitFor(() => field.getAttribute("aria-expanded") === "true");
		// A real search makes registered and note-only choices visible together.
		const input = frame.pickerHost.querySelector(".cs-combobox input");
		input.value = "de";
		input.dispatchEvent(new Event("input", { bubbles: true }));
	}
	return metadata(pickerOpen ? "Find callouts: searchable type picker" : "Find callouts: Project note occurrences",
		pickerOpen ? "The production CalloutCombobox searches registered types and the unregistered idea type derived by the real source scanner from synthetic notes."
			: "The production occurrences sidebar frame and cards show source references to project across three synthetic notes, with block and heading formats counted separately.");
}

/**
 * `older` adds one version beneath the three the guide shows: a window that
 * cuts the list off (the website's) needs a row for the rail to run into.
 */
function recoveryFixture(plugin, { older = false } = {}) {
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
	// Times on the day the guide is drawn and the day before, so the day
	// headings read "today" and "yesterday" whenever the pictures are made.
	// (The clock time is set, not added to midnight: on a daylight-saving day
	// the hours from midnight are not the time on the clock.)
	const at = (daysAgo, hours, minutes) => {
		const time = new Date();
		time.setDate(time.getDate() - daysAgo);
		time.setHours(hours, minutes, 0, 0);
		return time.getTime();
	};
	const sources = [
		source(current, "history", at(0, 9, 0), "edit"),
		source(previous, "backup", at(0, 7, 50), "before-import"),
		source(oldest, "backup", at(1, 7, 50), "before-reset"),
		source(oldest, "history", at(1, 7, 40), "edit"),
	];
	if (older) {
		// A colour of its own makes it a setup of its own: one setup kept in two
		// places is one row.
		const earliest = copy(oldest);
		earliest.callouts.find(row => row.id === "project").colorDark = "#f472b6";
		sources.push(source(earliest, "history", at(1, 7, 10), "edit"));
	}
	const versions = mergeVersions(sources);
	plugin.recovery = {
		listVersions: async () => versions,
		differences: () => data => ({ callouts: data.callouts?.length ?? 0, changed: differingEntries(current, data).size }),
		details: (source, version) => ({ ...setupDetails(source, current), version }),
		restore: async () => { throw new Error("Guide fixtures never restore settings"); },
		removeVersion: async () => { throw new Error("Guide fixtures never delete backups"); },
	};
	return { current, previous, versions };
}

async function historyScene(plugin, options) {
	recoveryFixture(plugin, options);
	const result = mountSettings(plugin, { path: [VERSION_HISTORY_PAGE], title: "Version history", description: "The actual version-history page draws a timeline of synthetic saved setups, each compared with the current setup. The entries and timestamps are documentation fixtures." });
	await waitFor(() => document.querySelector("#guide-scene .cs-recovery-row"));
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
	Object.assign(plugin, { retrySettingsRecovery: async () => false, startFreshSettings: async () => false });
	return mountSettings(plugin, {
		boxes: ["banners", "version-history"],
		title: "Saving paused: missing settings file",
		description: "The settings' main page while saving is paused, showing only its first box, the actual Saving is paused notice, and the Version history box further down the page. No settings file is read or written.",
	});
}

async function conversionScene(plugin) {
	const conversionSources = {
		"Projects/Launch plan.md": "# [!project] Launch plan\n\nShip [!decision]{the first milestone} this month.\n\n> [!note] Next steps\n> Invite the design team to review.\n",
		"Meetings/Design review.md": "# [!meeting] Design review\n\nChoose [!tip]{a smaller pilot} before expanding the scope.\n\nMark the approved layout as [!decision]{ready}.\n",
	};
	syntheticVault(plugin, conversionSources);
	const plan = await preparePortableCalloutConversion(plugin.app);
	const root = sidebarPanel("cs-portable-view", 640, 670);
	const frame = createPortableConversionFrame(root, () => {});
	frame.retry.hidden = true;
	updatePortableSelection(frame, plan, true);
	renderPortableConversionRows(frame.results, plan, portableConversionRows(plan), 100, false, undefined, () => {});
	return metadata("Review conversion before changing notes", "The actual conversion planner reads only synthetic Markdown. Its proposed heading and inline replacements are rendered by the production sidebar frame, selection summary, and before/after cards.");
}

async function resetScene(plugin) {
	seedCallouts(plugin);
	syntheticVault(plugin);
	// The Danger zone's Reset everything runs this very flow.
	void confirmAndResetEverything(settingsContext(plugin));
	await waitFor(() => document.querySelector(".cs-confirm-acknowledge"));
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
	const result = openModal(modal, { title: filtered ? "Quick insert: My callouts" : "Quick insert block callout", description: filtered ? "The actual Quick insert modal filters to synthetic user-defined callouts and renders their real block previews. The source funnel opens its production menu."
		: "The actual Quick insert modal builds its previews with the plugin's generated CSS and reading processor. A synthetic writable note supplies the insertion target; nothing is inserted." });
	await waitFor(() => modal.contentEl.querySelector(".cs-qi-preview .callout"));
	if (filtered) {
		const field = modal.contentEl.querySelector(".cs-quick-insert-filter");
		field.click();
		await waitFor(() => field.getAttribute("aria-expanded") === "true");
		// Obsidian adds its menu to <body>. Keep the real menu inside the
		// exported window, just under its funnel.
		const menuEl = document.querySelector("body > .menu");
		if (!menuEl) throw new Error("The source funnel did not open Obsidian's menu");
		const modalRect = modal.modalEl.getBoundingClientRect();
		const fieldRect = field.getBoundingClientRect();
		modal.modalEl.appendChild(menuEl);
		menuEl.style.position = "absolute";
		// Obsidian moves a menu left rather than let it run off the window.
		const left = Math.min(fieldRect.left - modalRect.left, modalRect.width - menuEl.offsetWidth - 16);
		menuEl.style.left = `${left}px`;
		menuEl.style.top = `${fieldRect.bottom - modalRect.top + 2}px`;
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
