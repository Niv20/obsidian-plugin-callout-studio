/**
 * settings/MenuCustomizationModal.ts — Customize the right-click menu.
 *
 * Presents three stacked sections (one per render role). Each lists that
 * role's menu items with an enable/disable toggle and a drag handle for
 * reordering. Dragging uses Pointer Events (see ui/DragSortList.ts) so it works
 * with mouse and touch — the plugin also runs on mobile (isDesktopOnly: false).
 * The handle is keyboard-operable too (ArrowUp / ArrowDown). Toggling an item
 * off drops it to the bottom of its list; toggling it on floats it back up as
 * the last enabled item. Every change is saved immediately (matching the
 * plugin's save-on-change convention) — there is no OK/Cancel.
 */
import { Modal, Setting, ToggleComponent, setIcon } from "obsidian";
import type { App } from "obsidian";
import { t } from "../i18n";
import { makeDragSortable } from "../ui/DragSortList";
import { animateReorder } from "../ui/flip";
import { applyModalChrome } from "./modalChrome";
import type {
	CalloutRenderRole,
	ContextMenuItemConfig,
	ContextMenuItemId,
	PluginSettings,
} from "../types";

/** Narrow structural host — the plugin instance satisfies this. */
export interface MenuCustomizationHost {
	settings: PluginSettings;
	saveSettings(): Promise<void>;
}

const ROLE_ORDER: CalloutRenderRole[] = ["heading", "inline", "regular"];

/** i18n key for each role's section heading. */
const ROLE_TITLE_KEY: Record<CalloutRenderRole, string> = {
	regular: "menuCustomize.regular",
	heading: "menuCustomize.heading",
	inline: "menuCustomize.inline",
};

/** i18n key for each menu item's label. */
const ITEM_LABEL_KEY: Record<ContextMenuItemId, string> = {
	edit: "menuItem.edit",
	openSettings: "menuItem.openSettings",
	copyMarkdown: "menuItem.copyMarkdown",
	foldDefaults: "menuItem.foldDefaults",
	cutSection: "menuItem.cutSection",
	copySection: "menuItem.copySection",
	deleteSection: "menuItem.deleteSection",
};

export class MenuCustomizationModal extends Modal {
	/** Detach functions for the per-role drag listeners, run on close. */
	private dragCleanups: Array<() => void> = [];

	constructor(
		app: App,
		private readonly host: MenuCustomizationHost,
	) {
		super(app);
	}

	onOpen(): void {
		this.contentEl.addClass("cs-menu-customize");
		// No footer: the toggles and the drag order save themselves.
		applyModalChrome(this);
		this.titleEl.setText(t("menuCustomize.title"));
		this.contentEl.createEl("p", {
			text: t("menuCustomize.desc"),
			cls: "setting-item-description",
		});
		for (const role of ROLE_ORDER) this.renderRole(role);
	}

	onClose(): void {
		for (const cleanup of this.dragCleanups) cleanup();
		this.dragCleanups = [];
		this.contentEl.empty();
	}

	private renderRole(role: CalloutRenderRole): void {
		new Setting(this.contentEl).setName(t(ROLE_TITLE_KEY[role])).setHeading();
		const listEl = this.contentEl.createDiv({
			cls: "cs-menu-customize-list",
		});
		this.renderRoleList(role, listEl);

		// Attach drag once to the persistent list container; rows re-render into
		// it in place, so the listener survives every rerender().
		this.dragCleanups.push(
			makeDragSortable(listEl, {
				rowSelector: ".cs-menu-row",
				handleSelector: ".cs-drag-handle",
				// Keep enabled and disabled items in separate bands: a drag can
				// reorder within a band but never cross the divider. Only the
				// toggle moves an item between bands.
				groupOf: (row) => row.hasClass("is-disabled"),
				onReorder: (from, to) => {
					const items = this.host.settings.contextMenu.items[role];
					moveItem(items, from, to);
					void this.host.saveSettings();
					// DragSortList already moved the live rows. Keeping them preserves
					// the next gesture's target while the previous drop settles.
				},
			}),
		);
	}

	/** (Re)render a single role's item rows in place. */
	private renderRoleList(role: CalloutRenderRole, listEl: HTMLElement): void {
		listEl.empty();
		const items = this.host.settings.contextMenu.items[role];
		items.forEach((item, index) => {
			// Separator between the enabled group and the sunk-to-bottom disabled
			// group. It is its own sibling element (not a decoration on the first
			// disabled row) so lifting that row during a drag never carries the
			// divider along with it — the divider stays fixed at the band boundary.
			if (!item.enabled && index > 0 && items[index - 1]?.enabled) {
				listEl.createDiv({ cls: "cs-menu-band-divider" });
			}
			this.renderRow(role, listEl, item);
		});
	}

	private renderRow(
		role: CalloutRenderRole,
		listEl: HTMLElement,
		item: ContextMenuItemConfig,
	): void {
		const rerender = (): void => this.renderRoleList(role, listEl);
		const items = this.host.settings.contextMenu.items[role];

		const row = listEl.createDiv({ cls: "callout-studio-row cs-menu-row" });
		row.dataset.csItemId = item.id; // stable identity for FLIP reorder animation
		if (!item.enabled) row.addClass("is-disabled");

		// Drag handle (also keyboard-operable, replacing the old up/down arrows).
		const handle = row.createDiv({ cls: "cs-drag-handle" });
		handle.setAttribute("role", "button");
		handle.setAttribute("tabindex", "0");
		handle.setAttribute("aria-label", t("menuCustomize.dragHandle"));
		setIcon(handle, "grip-vertical");
		handle.addEventListener("keydown", (e) => {
			// Pointer reorders preserve these nodes; the render-time index is stale.
			const index = items.indexOf(item);
			if (index === -1) return;
			// Reorder only within this item's band: the neighbour must share its
			// enabled state, so a row never crosses the divider by keyboard —
			// exactly as the pointer drag is constrained (see groupOf above).
			if (
				e.key === "ArrowUp" &&
				index > 0 &&
				items[index - 1]?.enabled === item.enabled
			) {
				e.preventDefault();
				animateReorder(
					listEl,
					() => {
						swap(items, index, index - 1);
						rerender();
					},
					{ keyOf: ROW_KEY },
				);
				void this.host.saveSettings();
				focusHandleAt(listEl, index - 1);
			} else if (
				e.key === "ArrowDown" &&
				index < items.length - 1 &&
				items[index + 1]?.enabled === item.enabled
			) {
				e.preventDefault();
				animateReorder(
					listEl,
					() => {
						swap(items, index, index + 1);
						rerender();
					},
					{ keyOf: ROW_KEY },
				);
				void this.host.saveSettings();
				focusHandleAt(listEl, index + 1);
			}
		});

		// Label
		const info = row.createDiv({ cls: "callout-studio-row-info" });
		info.createSpan({
			cls: "callout-studio-row-name",
			text: t(ITEM_LABEL_KEY[item.id]),
		});

		// Enable/disable toggle — flips the item, then repositions it: off sinks
		// to the bottom, on floats up to just after the last enabled item.
		const toggleWrap = row.createDiv({ cls: "cs-menu-row-toggle" });
		new ToggleComponent(toggleWrap)
			.setValue(item.enabled)
			.onChange(async (v) => {
				item.enabled = v;
				animateReorder(
					listEl,
					() => {
						const from = items.indexOf(item);
						if (from !== -1) items.splice(from, 1);
						if (v) {
							let lastEnabled = -1;
							items.forEach((it, i) => {
								if (it.enabled) lastEnabled = i;
							});
							items.splice(lastEnabled + 1, 0, item);
						} else {
							items.push(item);
						}
						rerender();
					},
					{ keyOf: ROW_KEY },
				);
				await this.host.saveSettings();
			});
	}
}

/** FLIP identity for a row — matches an item across a full list rebuild. */
const ROW_KEY = (el: HTMLElement): unknown => el.dataset.csItemId;

/** Move an array element from one index to another, in place. */
function moveItem<T>(arr: T[], from: number, to: number): void {
	const item = arr[from];
	if (item === undefined) return;
	arr.splice(from, 1);
	arr.splice(to, 0, item);
}

function swap<T>(arr: T[], a: number, b: number): void {
	const tmp = arr[a]!;
	arr[a] = arr[b]!;
	arr[b] = tmp;
}

/** Return focus to the drag handle at a given row index after a rerender. */
function focusHandleAt(listEl: HTMLElement, index: number): void {
	const handles = Array.from(
		listEl.querySelectorAll<HTMLElement>(".cs-drag-handle"),
	);
	handles[index]?.focus();
}
