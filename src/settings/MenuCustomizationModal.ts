/**
 * settings/MenuCustomizationModal.ts — Customize the right-click menu.
 *
 * Presents three stacked sections (one per render role). Each lists that
 * role's menu items with an enable/disable toggle and a drag handle for
 * reordering — a two-band list from ui/bandedSortList.ts, enabled items above
 * the line and disabled ones below. Dragging uses Pointer Events, so it works
 * with mouse and touch — the plugin also runs on mobile (isDesktopOnly: false).
 * The handle is keyboard-operable too (ArrowUp / ArrowDown). Toggling an item
 * off drops it to the bottom of its list; toggling it on floats it back up as
 * the last enabled item (menuItems.ts, shared with the declarative page).
 * Every change is saved immediately (matching the plugin's save-on-change
 * convention) — there is no OK/Cancel.
 */
import { Modal, Setting, ToggleComponent } from "obsidian";
import type { App } from "obsidian";
import { t } from "../i18n";
import { attachBandedSortList, type BandedSortList } from "../ui/bandedSortList";
import { applyModalChrome } from "./modalChrome";
import { addFieldResetButton } from "./editor/fieldResetButton";
import { defaultMenuItems, isMenuRoleDefault, ITEM_LABEL_KEY, setMenuItemEnabled } from "./menuItems";
import type {
	CalloutRenderRole,
	ContextMenuItemConfig,
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

export class MenuCustomizationModal extends Modal {
	/** One banded list per role; their drag listeners are detached on close. */
	private lists: Partial<Record<CalloutRenderRole, BandedSortList>> = {};
	private roleResetSyncs: Partial<Record<CalloutRenderRole, () => void>> = {};

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
		for (const list of Object.values(this.lists)) list.destroy();
		this.lists = {};
		this.roleResetSyncs = {};
		this.contentEl.empty();
	}

	private renderRole(role: CalloutRenderRole): void {
		const heading = new Setting(this.contentEl)
			.setName(t(ROLE_TITLE_KEY[role]))
			.setHeading();
		heading.settingEl.addClass("cs-reset-heading");
		const listEl = this.contentEl.createDiv({
			cls: "cs-menu-customize-list",
		});
		// Attached once to the persistent list container; rows re-render into it
		// in place, so the drag listener survives every rebuild. The array is
		// looked up on each call because the reset below replaces it.
		const list = attachBandedSortList<ContextMenuItemConfig>(listEl, {
			items: () => this.host.settings.contextMenu.items[role],
			keyOf: (item) => item.id,
			// Disabled items sit below the line; only the toggle moves an item
			// between the bands.
			inLowerBand: (item) => !item.enabled,
			handleLabel: t("menuCustomize.dragHandle"),
			renderRow: (row, item) => this.renderRow(role, row, item),
			onReorder: () => {
				this.roleResetSyncs[role]?.();
				void this.host.saveSettings();
			},
		});
		this.lists[role] = list;
		this.roleResetSyncs[role] = addFieldResetButton(
			heading,
			t("settings.resetAction"),
			() => isMenuRoleDefault(this.host.settings.contextMenu.items[role], role),
			() => {
				this.host.settings.contextMenu.items[role] = defaultMenuItems(role);
				list.render();
				void this.host.saveSettings();
			},
		);
		list.render();
	}

	/** One menu item's label and toggle; the shared list draws its handle. */
	private renderRow(
		role: CalloutRenderRole,
		row: HTMLElement,
		item: ContextMenuItemConfig,
	): void {
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
				const items = this.host.settings.contextMenu.items[role];
				this.lists[role]?.animate(() => setMenuItemEnabled(items, item, v));
				this.roleResetSyncs[role]?.();
				await this.host.saveSettings();
			});
	}
}
