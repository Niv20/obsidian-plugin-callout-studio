/** The icon source list uses the same field and popup as the other filters. */
import { setIcon } from "obsidian";
import { getLocale, t } from "../../i18n";
import { getSource, ICON_SOURCE_IDS } from "../../icons/registry";
import type { IconSourceId } from "../../types";
import { ListboxPopup } from "../../ui/listboxPopup";
import { ALL_SOURCES, ALL_SOURCES_META, type PickerSourceId } from "./allSources";
import { createSourceMenuTitle } from "./sourceMenuPresentation";

interface SourcePickerOptions {
	value: PickerSourceId;
	countFor(id: PickerSourceId): number | undefined;
	isMissing(id: IconSourceId): boolean;
	onPick(id: PickerSourceId): void;
}

function sourceMeta(id: PickerSourceId) {
	return id === ALL_SOURCES ? ALL_SOURCES_META : getSource(id);
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
	let selected = options.value;
	const popup = new ListboxPopup<PickerSourceId>(row, {
		ariaLabel: t("iconPicker.chooseSource"),
		placeholder: "",
		searchable: false,
		itemsFor: () => [ALL_SOURCES, ...ICON_SOURCE_IDS],
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
				notDownloaded: id !== ALL_SOURCES && options.isMissing(id),
				notDownloadedLabel: t("iconPicker.notDownloaded"),
				selected: id === selected,
			}));
		},
		onCommit: (id) => {
			selected = id;
			paintLead(id);
			options.onPick(id);
		},
	});
	function paintLead(id: PickerSourceId): void {
		popup.leadEl.empty();
		setIcon(popup.leadEl, sourceMeta(id).emblemIcon);
	}
	popup.el.addClass("icon-picker-source-dropdown");
	popup.inputEl.id = "cs-icon-source";
	popup.setSelected(selected);
	paintLead(selected);
	return popup;
}
