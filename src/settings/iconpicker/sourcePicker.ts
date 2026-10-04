/** The icon source list uses the same field and popup as the other filters. */
import { setIcon } from "obsidian";
import { getLocale, t } from "../../i18n";
import { getSource } from "../../icons/registry";
import { isDownloadable, type MenuLibraries } from "../../icons/iconLibraries";
import { ListboxPopup } from "../../ui/listboxPopup";
import { ALL_SOURCES, ALL_SOURCES_META, type PickerSourceId } from "./allSources";
import { createSourceMenuTitle } from "./sourceMenuPresentation";

interface SourcePickerOptions {
	value: PickerSourceId;
	/**
	 * What the menu lists besides All sources, and what its closing line
	 * counts. Asked afresh every time the menu is built, because downloading or
	 * deleting a library changes it while the picker is open.
	 */
	sources(): MenuLibraries;
	countFor(id: PickerSourceId): number | undefined;
	onPick(id: PickerSourceId): void;
	/** Opens Manage icon libraries; the row gets its button when set. */
	onManage?(): void;
}

function sourceMeta(id: PickerSourceId) {
	return id === ALL_SOURCES ? ALL_SOURCES_META : getSource(id);
}

/**
 * The menu's sticky headings. All sources is not a library, so it has a
 * heading of its own above the libraries; the edited icon's library, when the
 * picker does not offer it, has one above both.
 */
function groupOf(id: PickerSourceId, listed: MenuLibraries): { key: string; label: string } {
	if (id === ALL_SOURCES) return { key: "search", label: t("iconPicker.groupSearch") };
	if (id === listed.current) {
		return {
			key: "current",
			label: t(isDownloadable(id) ? "iconPicker.groupDeleted" : "iconPicker.groupCurrent"),
		};
	}
	return { key: "libraries", label: t("iconPicker.groupLibraries") };
}

/** "3 more libraries available for download", or nothing when there are none. */
function moreToDownload(count: number): string {
	if (count === 0) return "";
	return count === 1
		? t("iconPicker.moreToDownloadOne")
		: t("iconPicker.moreToDownload", { count });
}

/** Align the fixed source row with the toolbar inside the scrollable grid. */
export function alignIconPickerRows(container: HTMLElement, scrollHost: HTMLElement): () => void {
	const sync = (): void => {
		const scrollbar = Math.max(0, scrollHost.offsetWidth - scrollHost.clientWidth);
		container.style.setProperty("--cs-icon-grid-scrollbar", `${scrollbar}px`);
	};
	const view = scrollHost.ownerDocument.defaultView;
	const observer = view && typeof view.ResizeObserver === "function"
		? new view.ResizeObserver(sync) : undefined;
	observer?.observe(scrollHost);
	sync();
	return () => {
		observer?.disconnect();
		container.style.removeProperty("--cs-icon-grid-scrollbar");
	};
}

export function mountIconSourcePicker(
	parent: HTMLElement,
	options: SourcePickerOptions,
): ListboxPopup<PickerSourceId> {
	const row = parent.createDiv("icon-picker-source-row");
	row.createEl("label", {
		text: t("iconPicker.chooseSource"),
		cls: "icon-picker-source-label",
		attr: { for: "cs-icon-source" },
	});
	/** The menu as last built — `groupOf` and the closing line read it. */
	let listed: MenuLibraries = { current: null, libraries: [], toDownload: [] };
	const popup: ListboxPopup<PickerSourceId> = new ListboxPopup<PickerSourceId>(row, {
		ariaLabel: t("iconPicker.chooseSource"),
		placeholder: "",
		searchable: false,
		// Only libraries that can be drawn from here and now, so no row needs a
		// download status. The edited icon's own library is the exception, first
		// and under its own heading; see `menuLibraries`.
		itemsFor: () => {
			listed = options.sources();
			return [
				...(listed.current === null ? [] : [listed.current]),
				ALL_SOURCES,
				...listed.libraries,
			];
		},
		groupOf: (id) => groupOf(id, listed),
		keyOf: (id) => id,
		labelOf: (id) => t(sourceMeta(id).labelKey),
		emptyText: () => "",
		renderRow: (item, id) => {
			const meta = sourceMeta(id);
			item.addClass("icon-picker-source-menu-item");
			const emblem = item.createSpan({ cls: "icon-picker-source-menu-item-emblem" });
			setIcon(emblem, meta.emblemIcon);
			item.appendChild(createSourceMenuTitle({
				label: t(meta.labelKey),
				description: t(meta.descriptionKey),
				count: options.countFor(id),
				locale: getLocale(),
				exactCount: id === "image",
				// The popup's own record of what is chosen, so a library shown
				// by showIconSource is the one that carries the check.
				selected: id === popup.value,
			}));
		},
		// What is left to download is said, not offered: the libraries are got
		// in Manage icon libraries, beside the menu.
		footerNote: () => moreToDownload(listed.toDownload.length),
		onCommit: (id) => {
			paintLead(popup, id);
			options.onPick(id);
		},
	});
	popup.el.addClass("icon-picker-source-dropdown");
	popup.inputEl.id = "cs-icon-source";
	showIconSource(popup, options.value);

	if (options.onManage) {
		// Words rather than a gear: the button is where libraries are downloaded
		// now, which an icon left people to guess. The visible label names it,
		// so it carries no aria-label (Obsidian would show that as a tooltip).
		const manage = row.createEl("button", {
			cls: "icon-picker-manage-libraries",
			text: t("iconPicker.manageLibraries"),
			attr: { type: "button" },
		});
		manage.addEventListener("click", () => options.onManage?.());
	}
	return popup;
}

/**
 * Show `id` as the chosen library without anyone picking it, and without
 * `onPick` firing — for when the library shown has just left the menu.
 */
export function showIconSource(popup: ListboxPopup<PickerSourceId>, id: PickerSourceId): void {
	popup.setSelected(id);
	paintLead(popup, id);
}

function paintLead(popup: ListboxPopup<PickerSourceId>, id: PickerSourceId): void {
	popup.leadEl.empty();
	setIcon(popup.leadEl, sourceMeta(id).emblemIcon);
}
