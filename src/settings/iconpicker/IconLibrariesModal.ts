/**
 * settings/iconpicker/IconLibrariesModal.ts — the **Manage icon libraries**
 * window.
 *
 * One window with two doors, both opened through openIconLibraries.ts: the
 * **Manage libraries** button beside Pick an icon's library menu, and the
 * **Icon libraries** row of the settings (Colors and icons box,
 * declarative/iconLibrariesRow.ts). It is a window, never a page, so the two
 * doors cannot show two copies of one list. (A page of the settings was tried;
 * it could only be reached from the picker, whose window covers the settings,
 * and closing that window would lose the icon being chosen.)
 *
 * Three Obsidian setting groups (`SettingGroup`: a heading over one rounded
 * box of rows, thin lines between the rows, 24px between the groups;
 * finding S4-13), the way Obsidian's own settings show a list:
 *
 * - **Available libraries** — the libraries the picker offers, in the order it
 *   offers them. Dragging a row's handle (or ↑/↓ on it) reorders the menu, and
 *   the reset arrow sits at the end of the heading.
 * - **Libraries to download** — the ones this device lacks, in catalog order
 *   (the menu only counts those, so this is where a library is fetched).
 * - **Hidden libraries** — the built-in libraries the person took out of the
 *   picker. The menu does not list those at all, and calling them "to
 *   download" would be wrong, since there is nothing to fetch. The group shows
 *   only while it has a row, like Libraries to download.
 *
 * The first two headings are the Choose source menu's, from the same keys.
 *
 * Each row carries one button, and which one says what kind of library it is:
 *
 * - A downloadable library is offered exactly when its files are on this
 *   device, so above the line its button deletes them (trash) and below it
 *   downloads them. Nothing about it is "hidden".
 * - Lucide, Material, Emoji and Custom Icons ship with the plugin and cannot be
 *   deleted, so their button hides them instead (eye-off), and shows them again
 *   from below the line (eye).
 *
 * Every change is saved at once, like the menu customization — no OK/Cancel.
 * Deleting a library that callouts use asks first, naming them and saying that
 * they keep their icons (IconService.deleteLibrary keeps a copy of every
 * drawing they need). The last library left in the picker cannot be taken out.
 *
 * A row that changes group moves there at once, as a row does between two of
 * Obsidian's lists; the rows left behind in Available libraries slide together.
 * The window scrolls by itself in exactly one case: a library whose button was
 * pressed changes group — it leaves Available libraries when it is deleted or
 * hidden, joins it once its download has finished or it is shown — and lands
 * out of view. Then the window scrolls just far enough to show where it went.
 * Every other change — a drag, a key, the reset arrow, a download still
 * running, a press that was refused or declined — leaves the scroll alone.
 * (A drag scrolls the window too, when the row is held near its edge: that is
 * the drag's own doing, see ui/DragSortList.ts.)
 *
 * The reset arrow puts everything back the way the plugin came: the catalog
 * order, nothing hidden, and no downloaded library — those are deleted, after
 * one question naming them, since only a download brings them back.
 */
import { Modal, Setting, SettingGroup, setIcon } from "obsidian";
import type { App } from "obsidian";
import type {
	CalloutDefinition,
	CalloutIcon,
	IconSourceId,
	PluginSettings,
	UserImageIcon,
} from "../../types";
import type { IconService } from "../../icons/IconService";
import { ICON_SOURCE_IDS, getSource } from "../../icons/registry";
import {
	calloutNamesUsingLibrary,
	editedUsingLibrary,
	formatBytes,
	isDownloadable,
	isInPicker,
	isInstalled,
	libraryBytes,
	libraryFiles,
	libraryOrder,
	reorderShown,
	savedLibraryOrder,
	type EditedCallout,
} from "../../icons/iconLibraries";
import type { SettingsWriter } from "../../manager/SettingsWriter";
import { getLocale, t, type LocaleKey } from "../../i18n";
import { makeDragSortable } from "../../ui/DragSortList";
import { animateReorder } from "../../ui/flip";
import { paintResetIdle } from "../../ui/resetArrow";
import { scrollToReveal } from "../../ui/scrollToReveal";
import { settingGroupEl } from "../../ui/settingGroupEl";
import { appendLines } from "../../ui/textLines";
import { explainIfBlocked, paintBlocked } from "../../ui/blockedButton";
import { blockedWhilePaused } from "../pausedGuard";
import { applyModalChrome, removeModalChrome } from "../modalChrome";
import { formatIconCount } from "./sourceMenuPresentation";
import { askDeleteLibrary, askResetLibraries } from "./iconLibraryQuestions";
import { showNotice } from "../../ui/mascot/mascotNotices";

/**
 * What the window needs from the plugin; its two doors hand it over
 * (openIconLibraries.ts).
 */
export interface IconLibrariesHost {
	app: App;
	settings: PluginSettings;
	saveSettings(): Promise<void>;
	/** Deleting a library callouts use is refused while saving is paused. */
	settingsWriter: Pick<SettingsWriter, "isFrozen">;
	registry: {
		/** Committed callouts only — never the callout editor's draft. */
		getCommitted(): CalloutDefinition[];
		getUserImages(): readonly UserImageIcon[];
	};
	icons: Pick<IconService, "packs" | "deleteLibrary">;
	/** How many icons a library offers, once they have been counted (sourceCounts.ts). */
	countFor(id: IconSourceId): number | undefined;
	/**
	 * The callout the picker is choosing an icon for, whose icon the editor
	 * holds unsaved. The registry cannot know it, yet deleting a library it
	 * uses has to ask, and its drawings have to be kept, like any saved
	 * callout's. Absent when the picker is not opened for a callout, and when
	 * the window is opened from the settings, whose row refuses while an editor
	 * is open (declarative/iconLibrariesRow.ts).
	 */
	editing?: EditedCallout;
}

/** One row: a library, and whether the picker offers it. */
interface LibraryRow {
	id: IconSourceId;
	shown: boolean;
}

/** Which group of the window a row is in. */
type LibraryGroup = "available" | "download" | "hidden";

/** The groups, top to bottom. */
const GROUP_ORDER: readonly LibraryGroup[] = ["available", "download", "hidden"];

/** Each group's heading. */
const GROUP_HEADING: Record<LibraryGroup, LocaleKey> = {
	available: "iconPicker.librariesAvailable",
	download: "iconPicker.librariesToDownload",
	hidden: "iconLibraries.librariesHidden",
};

/** One group as the window keeps it: its outer element, and its box of rows. */
interface GroupBox {
	groupEl: HTMLElement;
	listEl: HTMLElement;
}

/** A row's FLIP identity (ui/flip.ts): its library, which a rebuild keeps. */
const ROW_KEY = (el: HTMLElement): unknown => el.dataset.csItemId;

/** The one button a row carries. */
type LibraryAction = "delete" | "download" | "hide" | "show";

const ACTION_ICON: Record<LibraryAction, string> = {
	delete: "trash-2",
	download: "download",
	hide: "eye-off",
	show: "eye",
};

const ACTION_LABEL: Record<LibraryAction, string> = {
	delete: "iconLibraries.delete",
	download: "iconLibraries.download",
	hide: "iconLibraries.hide",
	show: "iconLibraries.show",
};

/** The pointer events that end a drag in ui/DragSortList.ts. */
const DRAG_END_EVENTS = ["pointerup", "pointercancel", "lostpointercapture"] as const;

/**
 * A library the picker does not offer is either still to download or, when it
 * ships with the plugin, hidden: there is nothing to download for those.
 */
function groupOf({ id, shown }: LibraryRow): LibraryGroup {
	if (shown) return "available";
	return isDownloadable(id) ? "download" : "hidden";
}

function actionFor({ id, shown }: LibraryRow): LibraryAction {
	if (isDownloadable(id)) return shown ? "delete" : "download";
	return shown ? "hide" : "show";
}

export class IconLibrariesModal extends Modal {
	private resolve: ((changed: boolean) => void) | null = null;
	/** Whether anything was changed, so the picker knows to rebuild. */
	private changed = false;
	/** Invalidates the disk load when the window closes or reopens. */
	private generation = 0;
	/** Every library, in display order: Available, then To download, then Hidden. */
	private rows: LibraryRow[] = [];
	/** The three groups, while the window is open. */
	private boxes: Record<LibraryGroup, GroupBox> | null = null;
	/** Takes the drag listeners off the Available box. */
	private detachDrag: (() => void) | null = null;
	private syncReset: (() => void) | null = null;
	private stopWatchingPacks: (() => void) | null = null;
	/** Libraries whose Delete is running, so their button shows progress. */
	private readonly deleting = new Set<IconSourceId>();
	/** A pack changed mid-drag; the rows are rebuilt once the drag ends. */
	private refreshAfterDrag = false;
	/**
	 * Libraries whose button is being pressed through to its end, and that have
	 * not changed band yet: the window scrolls to each when it does. Only a row's
	 * own button adds to it — never the reset arrow, a drag, or a download that
	 * started anywhere else — so nothing else makes the list move.
	 */
	private readonly following = new Set<IconSourceId>();
	/** The reset is deleting libraries, so a second press must not start another. */
	private resetting = false;
	/**
	 * Deletions under way. Closing the window waits for them: the picker reads
	 * the pack files when it hears back, and a library still half deleted would
	 * look as if it were there.
	 */
	private readonly deletions = new Set<Promise<void>>();

	constructor(private readonly host: IconLibrariesHost) {
		super(host.app);
	}

	/** Open the window; resolves with whether anything changed once it closes. */
	openAndWait(): Promise<boolean> {
		return new Promise<boolean>((resolve) => {
			this.resolve = resolve;
			this.open();
		});
	}

	onOpen(): void {
		const generation = ++this.generation;
		this.changed = false;
		// No footer: every button and every drag saves itself.
		applyModalChrome(this);
		this.contentEl.addClass("cs-icon-libraries");
		// The same words as the button that opens the window, so the two agree.
		this.titleEl.setText(t("iconLibraries.manage"));

		// A plain description paragraph, as Commands and shortcuts has, so the
		// heading under it is spaced from it the same way in every layout.
		const intro = this.contentEl.createEl("p", { cls: "setting-item-description" });
		appendLines(intro, t("iconLibraries.desc"));

		// The three groups, in one wrapper that sets them off from the
		// description above. `mod-list` is Obsidian's list layout: rows a little
		// tighter, and kept on one line on a phone.
		const wrapper = this.contentEl.createDiv({ cls: "cs-icon-library-list" });
		const makeGroup = (group: LibraryGroup): { settingGroup: SettingGroup; box: GroupBox } => {
			const settingGroup = new SettingGroup(wrapper)
				.setHeading(t(GROUP_HEADING[group]))
				.addClass("mod-list", "cs-icon-library-group");
			const groupEl = settingGroupEl(settingGroup);
			// Which group this is, for tests and the screenshot scripts.
			groupEl.dataset.csGroup = group;
			return { settingGroup, box: { groupEl, listEl: settingGroup.listEl } };
		};
		const available = makeGroup("available");
		// The one group a drag happens in (styles.css lays its placeholder out).
		available.box.groupEl.addClass("cs-icon-library-available");

		// The reset arrow, at the end of the Available heading, as Obsidian puts
		// a group's extra button. It is built once with the group, and only the
		// rows are rebuilt, so `syncReset` always holds the arrow on screen.
		// Invisible (`cs-reset-idle`) while there is nothing to reset.
		let resetEl: HTMLElement | null = null;
		available.settingGroup.addExtraButton((button) => {
			button
				.setIcon("rotate-ccw")
				.setTooltip(t("iconLibraries.reset"))
				.onClick(() => void this.reset());
			resetEl = button.extraSettingsEl;
			resetEl.addClass("cs-icon-library-reset");
		});
		this.syncReset = () => {
			if (resetEl) paintResetIdle(resetEl, this.isDefault());
		};

		this.boxes = {
			available: available.box,
			download: makeGroup("download").box,
			hidden: makeGroup("hidden").box,
		};
		// Only Available libraries is in an order of the person's; the other
		// two follow the catalog, and moving a row there would change nothing.
		this.detachDrag = makeDragSortable(available.box.listEl, {
			rowSelector: ".cs-icon-library-row",
			handleSelector: ".cs-drag-handle",
			// The body of the window is its one scroll container (modalChrome.ts):
			// a row held near its edge scrolls it (finding S4-12).
			scroller: () => this.contentEl,
			onReorder: (from, to) => this.moveAvailable(from, to),
		});
		this.refresh(false);
		void this.watchPacks(generation);
	}

	onClose(): void {
		this.generation++;
		this.detachDrag?.();
		this.detachDrag = null;
		this.boxes = null;
		this.stopWatchingPacks?.();
		this.stopWatchingPacks = null;
		this.syncReset = null;
		this.contentEl.empty();
		removeModalChrome(this);
		const { resolve, changed } = this;
		this.resolve = null;
		if (this.deletions.size === 0) resolve?.(changed);
		else void Promise.allSettled([...this.deletions]).then(() => resolve?.(changed));
	}

	/**
	 * Read what is on disk, then follow every download and deletion — including
	 * one started from the picker's own download prompt — so a row always sits
	 * in the band its files put it in. The picker has normally read the disk
	 * already; this only matters when the window opens first.
	 */
	private async watchPacks(generation: number): Promise<void> {
		const packs = this.host.icons.packs;
		await packs.loadAllFromDisk();
		if (generation !== this.generation) return;
		this.stopWatchingPacks = packs.onChange(() => this.refresh());
		this.refresh(false);
	}

	// ── Rows ────────────────────────────────────────────────────────────

	/**
	 * The libraries the picker offers, in the user's order; then, in catalog
	 * order, those still to download (the order of the menu's own group); then
	 * the hidden ones, likewise. The Available rows therefore come first, and a
	 * drag's indexes in that box are indexes in this list too.
	 */
	private computeRows(): LibraryRow[] {
		const prefs = this.host.settings.iconLibraries;
		const packs = this.host.icons.packs;
		const shown = libraryOrder(prefs).filter((id) => isInPicker(id, prefs, packs));
		const rest = ICON_SOURCE_IDS.filter((id) => !shown.includes(id));
		return [
			...shown.map((id) => ({ id, shown: true })),
			...[...rest.filter(isDownloadable), ...rest.filter((id) => !isDownloadable(id))]
				.map((id) => ({ id, shown: false })),
		];
	}

	/**
	 * Recompute which group every library is in, and redraw. `animated` slides
	 * the Available rows that moved, and scrolls to a pressed library that
	 * changed group; the first draw, and the one after reading the disk, are
	 * not anyone's move and do neither.
	 */
	private refresh(animated = true): void {
		const boxes = this.boxes;
		if (!boxes) return;
		// Rebuilding under the pointer would leave the dragged row detached.
		const dragBox = boxes.available.listEl;
		if (dragBox.hasClass("cs-dragging")) {
			this.refreshWhenDragEnds(dragBox);
			return;
		}
		let followed: IconSourceId | undefined;
		const recompute = (): void => {
			const before = this.rows;
			this.rows = this.computeRows();
			if (animated) followed = this.takeMovedFollowed(before, this.rows);
		};
		if (animated) this.animateAvailable(recompute, () => followed);
		else {
			recompute();
			this.render();
		}
		this.syncReset?.();
	}

	/**
	 * Run `change`, redraw, and slide the Available rows that changed place.
	 * Only that box slides: a row that changes group moves there at once, as a
	 * row does between two of Obsidian's lists.
	 *
	 * `follow`, asked once the redraw is done, names a library to keep in view:
	 * if its row landed outside the window's view, the window scrolls just far
	 * enough to show it — before the slide is measured, so the rows slide from
	 * where they were on screen to where they are now.
	 */
	private animateAvailable(change: () => void, follow?: () => IconSourceId | undefined): void {
		const boxes = this.boxes;
		if (!boxes) return;
		animateReorder(
			boxes.available.listEl,
			() => {
				change();
				this.render();
				const id = follow?.();
				if (id !== undefined) this.reveal(id);
			},
			{ keyOf: ROW_KEY },
		);
	}

	/** Scroll the window to the row of `id`, if it is out of view. */
	private reveal(id: IconSourceId): void {
		const rowEl = this.rowEl(id);
		if (rowEl) scrollToReveal(this.contentEl, rowEl);
	}

	/** The row element of `id`, in whichever group it is. */
	private rowEl(id: IconSourceId): HTMLElement | undefined {
		return Array.from(this.contentEl.querySelectorAll<HTMLElement>(".cs-icon-library-row"))
			.find((el) => el.dataset.csItemId === id);
	}

	/**
	 * Draw every group from `this.rows`. Each box is built apart and swapped in
	 * whole (`replaceChildren`), never emptied and then filled: the row whose
	 * button was just pressed has focus, a browser taking focus off a node
	 * being removed lays the page out on the spot, and with the box's rows
	 * already gone the window would clamp its scroll and throw the list to the
	 * top. Removing and inserting in one step keeps the full list in that layout.
	 */
	private render(): void {
		const boxes = this.boxes;
		if (!boxes) return;
		for (const group of GROUP_ORDER) {
			const { groupEl, listEl } = boxes[group];
			const members = this.rows.filter((row) => groupOf(row) === group);
			const fresh = createDiv();
			for (const row of members) this.renderRow(fresh, row);
			listEl.replaceChildren(...Array.from(fresh.childNodes));
			// An empty group is not shown at all — except Available, whose heading
			// holds the reset arrow (and which never empties: the last library
			// cannot leave the picker).
			groupEl.toggleClass("cs-hidden", members.length === 0 && group !== "available");
		}
	}

	/**
	 * The library the person pressed that has just changed band — it stops being
	 * followed, its move is the one the list scrolls to show. Undefined when none
	 * has, which is nearly every refresh: a download still under way only changes
	 * the row's spinner, and the band flips once, when its last file arrives.
	 */
	private takeMovedFollowed(
		before: readonly LibraryRow[],
		after: readonly LibraryRow[],
	): IconSourceId | undefined {
		for (const row of after) {
			if (!this.following.has(row.id)) continue;
			const was = before.find((earlier) => earlier.id === row.id);
			if (was === undefined || was.shown === row.shown) continue;
			this.following.delete(row.id);
			return row.id;
		}
		return undefined;
	}

	/**
	 * Rebuild once the drag in progress ends. The listeners are added after
	 * DragSortList's own, so they run after it has finished the drop.
	 */
	private refreshWhenDragEnds(listEl: HTMLElement): void {
		if (this.refreshAfterDrag) return;
		this.refreshAfterDrag = true;
		const flush = (): void => {
			for (const type of DRAG_END_EVENTS) listEl.removeEventListener(type, flush);
			this.refreshAfterDrag = false;
			this.refresh();
		};
		for (const type of DRAG_END_EVENTS) listEl.addEventListener(type, flush);
	}

	/**
	 * One library as an Obsidian setting row: its emblem, its name, the line
	 * of facts under it, then its one button and — in Available libraries only
	 * — the drag handle at the very end, as Obsidian's reorderable lists have it.
	 */
	private renderRow(parent: HTMLElement, row: LibraryRow): void {
		const pack = getSource(row.id);
		const setting = new Setting(parent)
			.setName(t(pack.labelKey))
			.setDesc(this.metaFor(row));
		const rowEl = setting.settingEl;
		rowEl.addClass("cs-icon-library-row");
		rowEl.dataset.csItemId = row.id;
		// The emblem in front, in Obsidian's `setting-item-icon` (what
		// `Setting.setIcon` builds; that method is not in Obsidian's typings).
		const iconEl = createDiv({ cls: "setting-item-icon" });
		setIcon(iconEl, pack.emblemIcon);
		rowEl.insertBefore(iconEl, rowEl.firstChild);
		this.renderAction(setting, row);
		if (row.shown) this.addHandle(rowEl, row);
	}

	/**
	 * The drag handle that ends an Available row: Obsidian's three-bar icon,
	 * reachable with Tab, and ↑/↓ on it moves the library one place (Alt+↑/↓,
	 * Obsidian's key for it, works the same, as no modifier is checked).
	 */
	private addHandle(rowEl: HTMLElement, row: LibraryRow): void {
		const handle = rowEl.createDiv({
			cls: "cs-drag-handle mod-drag-handle clickable-icon",
			attr: { role: "button", tabindex: "0", "aria-label": t("menuCustomize.dragHandle") },
		});
		setIcon(handle, "menu");
		handle.addEventListener("keydown", (e) => {
			const step = e.key === "ArrowUp" ? -1 : e.key === "ArrowDown" ? 1 : 0;
			if (step === 0) return;
			// Looked up afresh: the rows may have been recomputed since this
			// one was drawn.
			const index = this.rows.findIndex((entry) => entry.id === row.id);
			const item = this.rows[index];
			const neighbour = this.rows[index + step];
			// Only within Available libraries, as the drag is.
			if (item === undefined || neighbour === undefined || !neighbour.shown) return;
			e.preventDefault();
			this.animateAvailable(() => {
				this.rows[index] = neighbour;
				this.rows[index + step] = item;
			});
			this.saveOrder();
			this.rowEl(row.id)?.querySelector<HTMLElement>(".cs-drag-handle")?.focus();
		});
	}

	/**
	 * A drag moved the Available row at `from` to `to`. The drag has already
	 * moved the row on screen; this moves the library in `this.rows` to match
	 * (the Available rows come first there, so the indexes are the same) and
	 * saves the new order.
	 */
	private moveAvailable(from: number, to: number): void {
		const [moved] = this.rows.splice(from, 1);
		if (moved === undefined) return;
		this.rows.splice(to, 0, moved);
		this.saveOrder();
	}

	/**
	 * The line under a library's name: how many icons it has, and what having
	 * it costs — its size for a downloadable library (above the line, the space
	 * it takes; below, what a download would fetch), or how it is supplied.
	 */
	private metaFor(row: LibraryRow): string {
		const { id, shown } = row;
		if (this.isBusy(id)) {
			return t(this.deleting.has(id) ? "iconLibraries.deleting" : "iconLibraries.downloading");
		}
		if (!shown && !isDownloadable(id)) return t("iconLibraries.hidden");
		const parts: string[] = [];
		const count = id === "image"
			? this.host.registry.getUserImages().length
			: this.host.countFor(id);
		// Numbers are isolated (FSI…PDI), as in the source menu: in a
		// right-to-left interface "1.6K+" would otherwise come out "+1.6K".
		if (count !== undefined) {
			parts.push(t("iconLibraries.iconCount", {
				count: `\u2068${formatIconCount(count, getLocale(), id === "image")}\u2069`,
			}));
		}
		if (isDownloadable(id)) {
			// A no-break space too: a narrow phone row must not part "625" from "KB".
			const size = formatBytes(libraryBytes(id, this.host.icons.packs, !shown)).replace(" ", "\u00a0");
			parts.push(`\u2068${size}\u2069`);
		} else if (getSource(id).kind === "perIconRemote") {
			parts.push(t("iconLibraries.perIcon"));
		} else if (id !== "image") {
			parts.push(t("iconLibraries.noDownload"));
		}
		return parts.join(" · ");
	}

	/**
	 * A row's one button — delete, download, hide or show — as an Obsidian
	 * extra button (a `div.clickable-icon` reachable with Tab), the same size
	 * as the handle beside it on every device. A `<button>` there would be
	 * padded by Obsidian's phone rule for buttons in a row's control and come
	 * out bigger than the handle.
	 */
	private renderAction(setting: Setting, row: LibraryRow): void {
		setting.addExtraButton((button) => {
			const el = button.extraSettingsEl;
			el.addClass("cs-icon-library-action");
			if (this.isBusy(row.id)) {
				// Busy, not blocked: the spinner and the line beside it already
				// say why, so pressing it would teach nothing.
				button.setDisabled(true);
				el.empty();
				el.setAttribute("aria-label", this.metaFor(row));
				const spinner = el.createSpan({ cls: "callout-studio-spinner" });
				setIcon(spinner, "loader-2");
				return;
			}
			const action = actionFor(row);
			const label = t(ACTION_LABEL[action], { name: t(getSource(row.id).labelKey) });
			button.setIcon(ACTION_ICON[action]).setTooltip(label);
			// `setTooltip` names the button for screen readers in Obsidian; said
			// here as well, so the name does not depend on what draws tooltips.
			el.setAttribute("aria-label", label);
			if (action === "delete") el.addClass("cs-icon-library-delete");
			const blocked = (): string | null =>
				action === "delete" || action === "hide" ? this.keepOneReason() : null;
			// Dimmed (Obsidian's `.clickable-icon[aria-disabled]`), yet pressable:
			// a press says why it cannot act.
			paintBlocked(el, blocked());
			button.onClick(() => {
				if (explainIfBlocked(blocked())) return;
				void this.run(action, row.id);
			});
		});
	}

	/** Why a library cannot leave the picker: it is the last one there. */
	private keepOneReason(): string | null {
		const staying = this.rows.filter((row) => row.shown && !this.deleting.has(row.id));
		return staying.length <= 1 ? t("iconLibraries.keepOne") : null;
	}

	/** A download or a deletion of this library is running. */
	private isBusy(id: IconSourceId): boolean {
		if (this.deleting.has(id)) return true;
		const packs = this.host.icons.packs;
		return libraryFiles(id).some((file) => packs.state(file) === "loading");
	}

	// ── Actions ─────────────────────────────────────────────────────────

	private async run(action: LibraryAction, id: IconSourceId): Promise<void> {
		// Followed until the press has run its course: a hide moves the row at
		// once, a download or a delete when its last file arrives or its first is
		// gone. A press that ends without the row moving — a failed download, a
		// declined question — must not leave the window waiting to scroll to a
		// move that someone else makes later.
		this.following.add(id);
		try {
			switch (action) {
				case "hide":
					this.setHidden(id, true);
					return;
				case "show":
					this.setHidden(id, false);
					return;
				case "download":
					await this.download(id);
					return;
				case "delete":
					await this.delete(id);
			}
		} finally {
			this.following.delete(id);
		}
	}

	private setHidden(id: IconSourceId, hidden: boolean): void {
		const prefs = this.host.settings.iconLibraries;
		prefs.hidden = hidden
			? [...new Set([...prefs.hidden, id])]
			: prefs.hidden.filter((entry) => entry !== id);
		this.changed = true;
		this.refresh();
		void this.host.saveSettings();
	}

	/**
	 * Download whatever this library still lacks. One file at a time, as the
	 * picker's own prompt does: parallel requests to one CDN gain nothing and
	 * make a failure harder to attribute. The row follows along through the
	 * store's change events — a spinner, then the slide up above the line —
	 * and the download goes on if the window is closed meanwhile.
	 */
	private async download(id: IconSourceId): Promise<void> {
		const packs = this.host.icons.packs;
		this.changed = true;
		for (const file of libraryFiles(id)) {
			if (packs.state(file) === "ready") continue;
			if (!(await packs.download(file))) {
				showNotice("problem", t("iconPack.downloadFailed", { name: getSource(id).attribution.title }));
				return;
			}
		}
	}

	private async delete(id: IconSourceId): Promise<void> {
		const users = this.usersOf(id);
		if (users.length > 0) {
			// The copy of their icons has to reach the disk before the files go.
			if (blockedWhilePaused(this.host.settingsWriter)) return;
			if (!(await askDeleteLibrary(this.host.app, id, users))) return;
		}
		await this.deleteFiles(id);
	}

	/**
	 * By name, everything that has to keep drawing once this library is gone:
	 * the saved callouts using it and the one being edited, if its unsaved icon
	 * is from here. Read at the moment of the press — not when the window
	 * opened — so a library picked from a moment ago already counts.
	 */
	private usersOf(id: IconSourceId): string[] {
		return calloutNamesUsingLibrary(this.host.registry.getCommitted(), id, this.host.editing);
	}

	/** The editor's unsaved icon, when it is this library's: its drawings must outlive the files too. */
	private unsavedIconsOf(id: IconSourceId): CalloutIcon[] {
		const edited = editedUsingLibrary(this.host.editing, id);
		return edited ? [edited.icon] : [];
	}

	/**
	 * Delete one library's files while its row shows the work, and say so when
	 * they could not all be removed. The row leaves the picker's side of the
	 * line through the store's change events, as each file goes.
	 */
	private deleteFiles(id: IconSourceId): Promise<void> {
		return this.tracked((async () => {
			this.deleting.add(id);
			this.changed = true;
			this.refresh();
			const removed = await this.host.icons.deleteLibrary(id, this.unsavedIconsOf(id));
			this.deleting.delete(id);
			if (!removed) showNotice("problem", t("iconLibraries.deleteFailed", { name: t(getSource(id).labelKey) }));
			this.refresh();
		})());
	}

	/** Keep `work` on the list of deletions closing the window waits for. */
	private async tracked(work: Promise<void>): Promise<void> {
		this.deletions.add(work);
		try {
			await work;
		} finally {
			this.deletions.delete(work);
		}
	}

	// ── Order ───────────────────────────────────────────────────────────

	/** A drag or an arrow key reordered the libraries above the line. */
	private saveOrder(): void {
		const prefs = this.host.settings.iconLibraries;
		const shown = this.rows.filter((row) => row.shown).map((row) => row.id);
		prefs.order = savedLibraryOrder(prefs.order, reorderShown(libraryOrder(prefs), shown));
		this.changed = true;
		this.syncReset?.();
		void this.host.saveSettings();
	}

	/**
	 * What a fresh install has: the catalog order, nothing hidden, and none of
	 * the downloadable libraries on this device.
	 */
	private isDefault(): boolean {
		const prefs = this.host.settings.iconLibraries;
		const packs = this.host.icons.packs;
		const order = libraryOrder(prefs);
		return ICON_SOURCE_IDS.every((id, index) => order[index] === id) &&
			!ICON_SOURCE_IDS.some((id) =>
				isDownloadable(id) ? isInstalled(id, packs) : prefs.hidden.includes(id));
	}

	/** The libraries downloaded here that a reset deletes, in catalog order. */
	private installedLibraries(): IconSourceId[] {
		const packs = this.host.icons.packs;
		return ICON_SOURCE_IDS.filter((id) =>
			isDownloadable(id) && isInstalled(id, packs) && !this.deleting.has(id));
	}

	/**
	 * Back to how the plugin came: the catalog order, every library shown, and
	 * only the libraries that ship with the plugin on this device — whatever was
	 * downloaded is deleted. Callouts keep their icons, as with any delete.
	 *
	 * The order and the hidden list are put back at once, then the libraries go
	 * one by one, each row sliding below the line as its files are removed.
	 */
	private async reset(): Promise<void> {
		if (this.resetting) return;
		const doomed = this.installedLibraries();
		if (doomed.length > 0) {
			// The copy of their icons has to reach the disk before the files go.
			if (doomed.some((id) => this.usersOf(id).length > 0) &&
				blockedWhilePaused(this.host.settingsWriter)) return;
			if (!(await askResetLibraries(this.host.app, doomed))) return;
		}
		this.resetting = true;
		this.host.settings.iconLibraries = { order: [], hidden: [] };
		this.changed = true;
		// Every doomed row shows its spinner at once rather than one at a time.
		for (const id of doomed) this.deleting.add(id);
		this.refresh();
		void this.host.saveSettings();
		const removal = (async () => {
			for (const id of doomed) await this.deleteFiles(id);
		})();
		try {
			await this.tracked(removal);
		} finally {
			this.resetting = false;
		}
	}
}
