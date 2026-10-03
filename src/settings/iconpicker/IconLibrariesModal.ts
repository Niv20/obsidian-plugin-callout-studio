/**
 * settings/iconpicker/IconLibrariesModal.ts — the **Manage icon libraries**
 * window.
 *
 * Opened from the button beside Pick an icon's library menu. One list, in two
 * bands (ui/bandedSortList.ts, the list behind Customize menu items): above the
 * line, the libraries the picker offers, in the order it offers them, and
 * dragging there reorders the menu; below it, the libraries it does not, in
 * catalog order and with no handle.
 *
 * The bands carry the headings of the Choose source menu. **Available
 * libraries** heads the first band, and the reset arrow sits on that heading's
 * row; **Libraries to download** heads the libraries this device lacks (the
 * menu lists those too, so a library can be fetched from there as well). A
 * third caption, **Hidden libraries**, names the built-in libraries the person
 * took out of the picker — the menu does not list those at all, and calling
 * them "to download" would be wrong, since there is nothing to fetch.
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
 * The window scrolls in exactly one case: a library whose button was pressed
 * changes band — it drops below the line when it is deleted or hidden, rises
 * above it once its download has finished or it is shown — and lands out of
 * view. Then the list scrolls with the row, just far enough to show where it
 * went. Every other change — a drag, a key, the reset arrow, a download still
 * running, a press that was refused or declined — leaves the scroll alone.
 *
 * The reset arrow puts everything back the way the plugin came: the catalog
 * order, nothing hidden, and no downloaded library — those are deleted, after
 * one question naming them, since only a download brings them back.
 */
import { Modal, Notice, Setting, setIcon } from "obsidian";
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
import { ConfirmModal } from "../../utils/ConfirmModal";
import { attachBandedSortList, type BandedSortList } from "../../ui/bandedSortList";
import { explainIfBlocked, paintBlocked } from "../../ui/blockedButton";
import { blockedWhilePaused } from "../pausedGuard";
import { addFieldResetButton } from "../editor/fieldResetButton";
import { applyModalChrome, removeModalChrome } from "../modalChrome";
import { formatIconCount } from "./sourceMenuPresentation";

/** What the window needs from the plugin; the icon picker hands it over. */
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
	/** How many icons a library offers, once the picker has counted. */
	countFor(id: IconSourceId): number | undefined;
	/**
	 * The callout the picker is choosing an icon for, whose icon the editor
	 * holds unsaved. The registry cannot know it, yet deleting a library it
	 * uses has to ask, and its drawings have to be kept, like any saved
	 * callout's. Absent when the picker is not opened for a callout.
	 */
	editing?: EditedCallout;
}

/** One row: a library, and whether it sits above the line. */
interface LibraryRow {
	id: IconSourceId;
	shown: boolean;
}

/** Which group of the window a row is in. */
type LibraryGroup = "available" | "download" | "hidden";

/** The caption over each group below the line; the first group's is the fixed heading. */
const GROUP_CAPTION: Record<Exclude<LibraryGroup, "available">, LocaleKey> = {
	download: "iconPicker.librariesToDownload",
	hidden: "iconLibraries.librariesHidden",
};

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

/** Names listed in the delete dialog before the rest are summed up as "and N more". */
const MAX_LISTED_CALLOUTS = 10;

/** The pointer events that end a drag in ui/DragSortList.ts. */
const DRAG_END_EVENTS = ["pointerup", "pointercancel", "lostpointercapture"] as const;

/** Each `\n` of a translated description starts a new line of it. */
function writeLines(el: HTMLElement, text: string): void {
	text.split("\n").forEach((line, i) => {
		if (i > 0) el.createEl("br");
		el.appendText(line);
	});
}

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
	private rows: LibraryRow[] = [];
	private listEl: HTMLElement | null = null;
	private list: BandedSortList | null = null;
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
		writeLines(intro, t("iconLibraries.desc"));

		// The heading of the first group, with the reset arrow level with it. It
		// is a row of its own above the list — not inside it — because the list
		// is rebuilt on every change, and a button rebuilt with it would leave
		// `syncReset` holding a detached one.
		const heading = new Setting(this.contentEl).setName(t("iconPicker.librariesAvailable"));
		heading.settingEl.addClass("cs-icon-library-heading");
		this.syncReset = addFieldResetButton(
			heading,
			t("iconLibraries.reset"),
			() => this.isDefault(),
			() => void this.reset(),
		);

		this.listEl = this.contentEl.createDiv({
			cls: "cs-menu-customize-list cs-icon-library-list",
		});
		this.list = attachBandedSortList<LibraryRow>(this.listEl, {
			items: () => this.rows,
			keyOf: (row) => row.id,
			inLowerBand: (row) => !row.shown,
			captionOf: (row, previous) => {
				const group = groupOf(row);
				if (group === "available" || (previous && groupOf(previous) === group)) return null;
				return t(GROUP_CAPTION[group]);
			},
			// The body of the window is its one scroll container (modalChrome.ts).
			scroller: () => this.contentEl,
			// Below the line the order is the catalog's, and moving a row there
			// would change nothing anywhere.
			canMove: (row) => row.shown,
			handleLabel: t("menuCustomize.dragHandle"),
			renderRow: (el, row) => this.renderRow(el, row),
			onReorder: () => this.saveOrder(),
		});
		this.refresh(false);
		void this.watchPacks(generation);
	}

	onClose(): void {
		this.generation++;
		this.list?.destroy();
		this.list = null;
		this.listEl = null;
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
	 * the hidden ones, likewise.
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

	/** Recompute both bands and redraw, sliding every row that moved. */
	private refresh(animated = true): void {
		const list = this.list;
		const listEl = this.listEl;
		if (!list || !listEl) return;
		// Rebuilding under the pointer would leave the dragged row detached.
		if (listEl.hasClass("cs-dragging")) {
			this.refreshWhenDragEnds(listEl);
			return;
		}
		let followed: IconSourceId | undefined;
		const recompute = (): void => {
			const before = this.rows;
			this.rows = this.computeRows();
			// Only a redraw that slides the rows can scroll to one: the first
			// draw, and the one after reading the disk, are not anyone's move.
			if (animated) followed = this.takeMovedFollowed(before, this.rows);
		};
		if (animated) list.animate(recompute, () => followed);
		else {
			recompute();
			list.render();
		}
		this.syncReset?.();
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

	private renderRow(rowEl: HTMLElement, row: LibraryRow): void {
		const pack = getSource(row.id);
		rowEl.addClass("cs-icon-library-row");
		const emblem = rowEl.createSpan({ cls: "cs-icon-library-emblem" });
		setIcon(emblem, pack.emblemIcon);
		const info = rowEl.createDiv({ cls: "callout-studio-row-info" });
		info.createSpan({ cls: "callout-studio-row-name", text: t(pack.labelKey) });
		info.createSpan({ cls: "cs-icon-library-meta", text: this.metaFor(row) });
		this.renderAction(rowEl, row);
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

	private renderAction(rowEl: HTMLElement, row: LibraryRow): void {
		const button = rowEl.createEl("button", {
			cls: "cs-icon-library-action clickable-icon",
			attr: { type: "button" },
		});
		if (this.isBusy(row.id)) {
			// Busy, not blocked: the spinner and the line beside it already say
			// why, so pressing it would teach nothing.
			button.disabled = true;
			button.setAttribute("aria-label", this.metaFor(row));
			const spinner = button.createSpan({ cls: "callout-studio-spinner" });
			setIcon(spinner, "loader-2");
			return;
		}
		const action = actionFor(row);
		setIcon(button, ACTION_ICON[action]);
		button.setAttribute("aria-label", t(ACTION_LABEL[action], { name: t(getSource(row.id).labelKey) }));
		if (action === "delete") button.addClass("cs-icon-library-delete");
		const blocked = (): string | null =>
			action === "delete" || action === "hide" ? this.keepOneReason() : null;
		paintBlocked(button, blocked());
		button.addEventListener("click", () => {
			if (explainIfBlocked(blocked())) return;
			void this.run(action, row.id);
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
				new Notice(t("iconPack.downloadFailed", { name: getSource(id).attribution.title }));
				return;
			}
		}
	}

	private async delete(id: IconSourceId): Promise<void> {
		const users = this.usersOf(id);
		if (users.length > 0) {
			// The copy of their icons has to reach the disk before the files go.
			if (blockedWhilePaused(this.host.settingsWriter)) return;
			if (!(await this.confirmDelete(id, users))) return;
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
			if (!removed) new Notice(t("iconLibraries.deleteFailed", { name: t(getSource(id).labelKey) }));
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

	/**
	 * Say who uses the library before it goes, and what happens to them:
	 * nothing — they keep their icons. Only picking *new* icons from it needs
	 * the library downloaded again.
	 */
	private confirmDelete(id: IconSourceId, users: readonly string[]): Promise<boolean> {
		const name = t(getSource(id).labelKey);
		const message = createFragment();
		message.createEl("p", {
			text: users.length === 1
				? t("iconLibraries.inUseOne", { name })
				: t("iconLibraries.inUse", { name, count: String(users.length) }),
		});
		const list = message.createEl("ul", { cls: "cs-icon-library-users" });
		for (const callout of users.slice(0, MAX_LISTED_CALLOUTS)) {
			list.createEl("li", { text: callout });
		}
		if (users.length > MAX_LISTED_CALLOUTS) {
			list.createEl("li", {
				text: t("iconLibraries.inUseMore", { count: String(users.length - MAX_LISTED_CALLOUTS) }),
			});
		}
		message.createEl("p", { text: t("iconLibraries.inUseKeeps", { name }) });
		return new ConfirmModal(this.host.app, t("confirm.titleDeleteLibrary"), message).confirm();
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
			if (!(await this.confirmReset(doomed))) return;
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

	/**
	 * Name the libraries a reset deletes, and say what it leaves alone: the
	 * callouts using them keep their icons.
	 */
	private confirmReset(doomed: readonly IconSourceId[]): Promise<boolean> {
		const message = createFragment();
		message.createEl("p", { text: t("iconLibraries.resetConfirm") });
		const list = message.createEl("ul", { cls: "cs-icon-library-users" });
		for (const id of doomed) list.createEl("li", { text: t(getSource(id).labelKey) });
		message.createEl("p", { text: t("iconLibraries.resetKeeps") });
		return new ConfirmModal(
			this.host.app,
			t("confirm.titleResetLibraries"),
			message,
			t("iconLibraries.resetButton"),
		).confirm();
	}
}
