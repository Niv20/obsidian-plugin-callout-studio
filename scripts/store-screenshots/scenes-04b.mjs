/** Alternate desktop icons artwork: the production picker beside its library manager. */
import { installDomHelpers } from "obsidian";
import { setLocale } from "../../src/i18n/index.ts";
import { ICON_SOURCE_IDS, getSource } from "../../src/icons/registry.ts";
import { libraryFiles } from "../../src/icons/iconLibraries.ts";
import { IconPicker } from "../../src/settings/iconpicker/IconPickerModal.ts";
import { IconLibrariesModal } from "../../src/settings/iconpicker/IconLibrariesModal.ts";
import { makeHost } from "../user-guide/fixture-host.mjs";

const requestedOrder = [
	"lucide", "material", "emoji", "image", "tabler", "fa",
	"rpg-awesome", "octicons", "simple-icons",
];

// The window as someone who has used it sees it, so all three of its groups
// show: Emoji put away (a library that ships with the plugin is hidden, never
// "to download"), two small libraries not fetched yet, the rest on this device.
const hiddenLibraries = ["emoji"];
const librariesToDownload = ["rpg-awesome", "octicons"];

async function waitFor(predicate, label) {
	for (let frame = 0; frame < 180; frame++) {
		if (predicate()) return;
		await new Promise(resolve => requestAnimationFrame(resolve));
	}
	throw new Error(`Store scene did not finish rendering: ${label}`);
}

export async function mountScene() {
	installDomHelpers();
	setLocale("en");
	document.body.className = "theme-dark is-desktop";
	document.body.dataset.storeScene = "04B-icons";
	const plugin = makeHost();
	if (requestedOrder.length !== ICON_SOURCE_IDS.length ||
		requestedOrder.some(id => !ICON_SOURCE_IDS.includes(id))) {
		throw new Error("The 04B library order no longer matches the icon catalog");
	}
	plugin.settings.iconLibraries = { order: requestedOrder, hidden: hiddenLibraries };
	// The offline fixture has no vault files. Mark the downloadable packs as
	// present on this device, bar the two still to fetch, which the production
	// window then lists under Libraries to download.
	const ready = new Set(ICON_SOURCE_IDS.filter(id => !librariesToDownload.includes(id)).flatMap(libraryFiles));
	plugin.icons.packs.state = id => ready.has(id) ? "ready" : "unavailable";
	const counts = new Map(await Promise.all(ICON_SOURCE_IDS.map(async id => [
		id, id === "image" ? 0 : (await getSource(id).loadIndex()).entries.length,
	])));

	const picker = new IconPicker(plugin, { type: "lucide", value: "lightbulb" }, {
		id: "idea", name: "Idea",
	});
	picker.open();
	picker.modalEl.id = "guide-picker";
	await waitFor(() => picker.modalEl.querySelector(".icon-picker-grid .icon-picker-cell"), "Lucide icon grid");
	await waitFor(() => picker.modalEl.querySelector(".icon-picker-cell.is-selected"), "selected lightbulb");

	const libraries = new IconLibrariesModal({
		app: plugin.app,
		settings: plugin.settings,
		saveSettings: () => plugin.saveSettings(),
		settingsWriter: plugin.settingsWriter,
		registry: plugin.registry,
		icons: plugin.icons,
		countFor: id => counts.get(id),
	});
	libraries.open();
	libraries.modalEl.id = "guide-libraries";
	await waitFor(() => libraries.modalEl.querySelectorAll(".cs-icon-library-row").length === ICON_SOURCE_IDS.length,
		"all icon libraries");
	// The picker centres its selection, which leaves a clipped icon row at the
	// top of this particular artwork. Advance to the next full row while keeping
	// the selected lightbulb in view.
	const scroller = picker.modalEl.querySelector(".icon-picker-content");
	const edge = scroller.getBoundingClientRect().top;
	const nextRow = [...picker.modalEl.querySelectorAll(".icon-picker-cell")]
		.map(cell => cell.getBoundingClientRect())
		.filter(rect => rect.top >= edge + 4)
		.sort((a, b) => a.top - b.top)[0];
	if (!nextRow) throw new Error("No full icon row follows the selected lightbulb");
	scroller.scrollTop += Math.max(0, nextRow.top - edge - 10);
	await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
	await document.fonts.ready;
	return { picker: "#guide-picker", libraries: "#guide-libraries" };
}
