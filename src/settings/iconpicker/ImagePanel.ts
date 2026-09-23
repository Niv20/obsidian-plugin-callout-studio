/**
 * settings/iconpicker/ImagePanel.ts — The "Custom Icons" source's panel.
 *
 * Every other source is a fixed library, so one PackPanel driven by the IconPack
 * covers them all. This one is a library the user writes to, and that needs
 * affordances the pack contract deliberately has no room for: adding files and
 * deleting them. Bending PackPanel to carry those for a single source would put
 * a branch in the file whose whole point is not having any, so this is a
 * separate panel that reuses IconGrid — the part that genuinely is shared.
 */
import { Notice, setIcon } from "obsidian";
import type { App } from "obsidian";
import type { CalloutDefinition, CalloutIcon, UserImageIcon } from "../../types";
import type { IconEntry } from "../../icons/types";
import { renderIconInto } from "../../icons/renderIcon";
import { userImagesPack } from "../../icons/packs/userImages";
import {
	USER_IMAGE_ACCEPT,
	importImageFile,
} from "../../icons/userImageImport";
import {
	normalizeUserImageName,
	takenUserImageNames,
	userImageNameFromFilename,
} from "../../utils/userImages";
import { ConfirmModal } from "../../utils/ConfirmModal";
import { IconGrid } from "./IconGrid";
import { t } from "../../i18n";

/**
 * Draws cells straight from the pack, like PackPanel's own preview resolver:
 * the grid shows pictures the user has not chosen yet, so the `data.json`
 * artwork cache has nothing to say about any of them.
 */
const previewResolver = {
	resolveSvg: (icon: CalloutIcon, role: "regular" | "heading" | "inline") =>
		userImagesPack.buildSvg?.(icon, role) ?? null,
	hasFailed: () => false,
};

export interface ImagePanelHost {
	app: App;
	/** Every callout, for warning that a picture about to go is in use. */
	allCallouts(): CalloutDefinition[];
	images(): readonly UserImageIcon[];
	/** The single writer — it re-syncs the pack and repaints open notes. */
	saveImages(images: readonly UserImageIcon[]): void;
	onSelect(icon: CalloutIcon, entry: IconEntry): void;
	selectedIcon(): CalloutIcon | null;
}

export class ImagePanel {
	private readonly toolbarEl: HTMLElement;
	private readonly bodyEl: HTMLElement;
	private grid: IconGrid | null = null;
	private query = "";
	private fileInput: HTMLInputElement | null = null;
	private deleteBtn: HTMLButtonElement | null = null;
	/** Which picture Delete acts on; null when nothing is selected. */
	private activeId: string | null = null;
	private disposed = false;

	constructor(
		private readonly container: HTMLElement,
		private readonly host: ImagePanelHost,
	) {
		const selected = host.selectedIcon();
		this.activeId = selected?.type === "image" ? selected.value : null;
		// PackPanel builds a toolbar and a body under the same class names, so
		// anything this panel styles on its own needs a marker to hang off.
		container.addClass("icon-picker-image-panel");
		this.toolbarEl = container.createDiv("icon-picker-toolbar");
		this.bodyEl = container.createDiv("icon-picker-body");
	}

	dispose(): void {
		this.disposed = true;
		this.container.empty();
	}

	render(): Promise<void> {
		this.buildToolbar();
		this.grid = new IconGrid(this.bodyEl, {
			renderCell: (cell, entry) => this.renderCell(cell, entry),
			isSelected: (entry) => this.isSelected(entry),
			onSelect: (entry) => this.select(entry),
			labelFor: (entry) => entry.label ?? entry.name,
			cellClass: () => "icon-picker-image-cell",
			// Only ever seen when the collection itself is empty; a search that
			// matches nothing is handled in refresh(), which knows the query.
			emptyText: t("iconPicker.customEmpty"),
			loadMoreText: t("iconPicker.loadMore"),
		});
		this.enableDrop();
		this.refresh();
		this.grid.revealSelected();
		return Promise.resolve();
	}

	// ── Toolbar ─────────────────────────────────────────────────────────

	private buildToolbar(): void {
		// Search first, as on every other source (see PackPanel) — otherwise the
		// search box changes sides on the way in and out of this panel.
		const search = this.toolbarEl.createEl("input", {
			type: "text",
			cls: "icon-picker-search-input cs-text-control",
			placeholder: t("iconPicker.searchCustom"),
			value: this.query,
		});
		search.addEventListener("input", () => {
			this.query = search.value;
			this.refresh();
		});

		// Delete sits between search and Add, acting on whatever is selected —
		// hanging a button off every cell would stop the grid being a grid, and
		// IconGrid has no per-cell affordance to hang one on anyway. Whether a
		// picture follows the callout's colour is deliberately not here: that is
		// the callout's choice, and lives in the callout editor beside the
		// icon's size and offsets.
		const deleteBtn = this.toolbarEl.createEl("button", {
			cls: "icon-picker-image-delete mod-warning",
			attr: { type: "button" },
		});
		setIcon(deleteBtn.createSpan("icon-picker-image-btn-icon"), "trash-2");
		deleteBtn.createSpan({ text: t("iconPicker.customDelete") });
		deleteBtn.addEventListener("click", () => {
			const active = this.activeImage();
			if (active) void this.confirmDelete(active);
		});
		this.deleteBtn = deleteBtn;
		this.syncDeleteButton();

		const addBtn = this.toolbarEl.createEl("button", {
			cls: "icon-picker-image-add mod-cta",
			attr: { type: "button" },
		});
		setIcon(addBtn.createSpan("icon-picker-image-btn-icon"), "image-plus");
		addBtn.createSpan({ text: t("iconPicker.customAdd") });
		addBtn.addEventListener("click", () => this.fileInput?.click());

		// The real input stays out of the layout; the styled button drives it.
		this.fileInput = this.toolbarEl.createEl("input", {
			cls: "icon-picker-image-input",
			type: "file",
			attr: { accept: USER_IMAGE_ACCEPT, multiple: "" },
		});
		this.fileInput.addEventListener("change", () => {
			const files = Array.from(this.fileInput?.files ?? []);
			// Clear first, so picking the same file twice in a row still fires.
			if (this.fileInput) this.fileInput.value = "";
			void this.addFiles(files);
		});
	}

	/**
	 * Accept pictures dropped anywhere on the panel.
	 *
	 * The grid area is stretched to the bottom of the picker in CSS precisely so
	 * that "anywhere" means the whole window and not just the rows that happen to
	 * hold a picture — a target you have to aim at is one you can miss.
	 *
	 * Listeners sit on the panel's own element, which `dispose` destroys, so they
	 * need no separate teardown — the same arrangement PackPanel uses.
	 */
	private enableDrop(): void {
		this.container.addEventListener("dragover", (ev) => {
			if (!ev.dataTransfer?.types.includes("Files")) return;
			ev.preventDefault();
			this.container.addClass("is-drop-target");
		});
		this.container.addEventListener("dragleave", (ev) => {
			// Moving between children fires dragleave on the parent; only a
			// pointer that has actually left the panel should clear the state.
			if (this.container.contains(ev.relatedTarget as Node | null)) return;
			this.container.removeClass("is-drop-target");
		});
		this.container.addEventListener("drop", (ev) => {
			const files = Array.from(ev.dataTransfer?.files ?? []);
			if (files.length === 0) return;
			ev.preventDefault();
			this.container.removeClass("is-drop-target");
			void this.addFiles(files);
		});
	}

	// ── Adding ──────────────────────────────────────────────────────────

	/**
	 * Read a batch of files, keeping whatever works.
	 *
	 * One bad file in a drop of ten must not cost the other nine, so each is
	 * reported on its own and the rest carry on.
	 *
	 * A filename already in the collection is turned away before the file is
	 * read: two cells with the same name are indistinguishable in the grid, and
	 * the second one is almost always a re-drop of the first rather than a
	 * different picture. The set grows as the batch goes, so dropping the same
	 * file twice in one go collides just as it would a week apart — nothing has
	 * been saved in between for the next check to see.
	 */
	private async addFiles(files: readonly File[]): Promise<void> {
		if (files.length === 0) return;
		const added: UserImageIcon[] = [];
		const taken = takenUserImageNames(this.host.images());
		for (const file of files) {
			const name = userImageNameFromFilename(file.name);
			if (taken.has(normalizeUserImageName(name))) {
				new Notice(t("iconPicker.customDuplicate", { name }));
				continue;
			}

			const result = await importImageFile(file);
			if (!result.ok) {
				new Notice(t(result.reason, { name: file.name }));
				continue;
			}

			taken.add(normalizeUserImageName(result.image.name));
			added.push(result.image);
		}
		if (this.disposed || added.length === 0) return;

		this.host.saveImages([...this.host.images(), ...added]);
		// Land on the first new picture, so it is previewed and confirmable
		// without hunting for it in the grid.
		const first = added[0];
		if (first) this.activeId = first.id;
		this.refresh();
		if (first) {
			const entry = this.entryFor(first);
			this.host.onSelect(userImagesPack.makeIcon(entry, {}), entry);
			this.grid?.revealSelected();
		}
	}

	// ── Grid ────────────────────────────────────────────────────────────

	/** Rebuild the grid and the Delete button from the current picture list. */
	private refresh(): void {
		const images = this.matching();
		// "No pictures yet" and "nothing matches that search" are different
		// situations, and the grid's own empty text only knows the first.
		if (images.length === 0 && this.query.trim().length > 0) {
			this.grid?.showMessage((host) =>
				host.setText(t("iconPicker.noResults")),
			);
		} else {
			this.grid?.setEntries(images.map((image) => this.entryFor(image)));
		}
		this.syncDeleteButton();
	}

	private matching(): UserImageIcon[] {
		const images = [...this.host.images()].sort((a, b) => b.addedAt - a.addedAt);
		const query = this.query.trim().toLowerCase();
		if (!query) return images;
		return images.filter((image) => image.name.toLowerCase().includes(query));
	}

	private entryFor(image: UserImageIcon): IconEntry {
		return {
			name: image.id,
			label: image.name,
			categories: [],
			keywords: [image.name],
		};
	}

	private renderCell(cell: HTMLElement, entry: IconEntry): void {
		renderIconInto(
			cell,
			{ type: "image", value: entry.name },
			previewResolver,
			{
				role: "regular",
				// A picture keeps its own colours in the grid whatever its
				// recolour setting: the cell has no callout colour to follow.
				fill: "currentColor",
				followCalloutColor: false,
				missing: { kind: "placeholder", lucideId: "image-off" },
				errorText: "?",
			},
		);
	}

	private isSelected(entry: IconEntry): boolean {
		return entry.name === this.activeId;
	}

	private select(entry: IconEntry): void {
		this.activeId = entry.name;
		// Through the pack, so the pick arrives carrying the same "follow the
		// callout's colour" default a flat drawing gets everywhere else.
		this.host.onSelect(userImagesPack.makeIcon(entry, {}), entry);
		this.syncDeleteButton();
	}

	/**
	 * Delete is live only while it has something to act on — with no pictures at
	 * all, or none picked, it is disabled rather than hidden, so the toolbar
	 * keeps the same shape and the button stays where the eye last left it.
	 */
	private syncDeleteButton(): void {
		if (this.deleteBtn) this.deleteBtn.disabled = !this.activeImage();
	}

	private activeImage(): UserImageIcon | undefined {
		if (!this.activeId) return undefined;
		return this.host.images().find((image) => image.id === this.activeId);
	}

	// ── Mutations ───────────────────────────────────────────────────────

	/**
	 * Delete, saying first how many callouts are about to lose their icon.
	 *
	 * They are not repointed or blocked — a callout whose picture is gone falls
	 * back to a placeholder, which is recoverable, whereas silently rewriting
	 * someone's callouts is not.
	 */
	private async confirmDelete(image: UserImageIcon): Promise<void> {
		const inUse = this.host
			.allCallouts()
			.filter(
				(def) => def.icon.type === "image" && def.icon.value === image.id,
			).length;

		const message = createFragment();
		message.createEl("p", {
			text: t("iconPicker.customDeleteConfirm", { name: image.name }),
		});
		if (inUse > 0) {
			message.createEl("p", {
				text: t("iconPicker.customDeleteInUse", { count: String(inUse) }),
				cls: "cs-reset-warning",
			});
		}

		const confirmed = await new ConfirmModal(
			this.host.app,
			t("confirm.titleDeleteImage"),
			message,
		).confirm();
		if (!confirmed || this.disposed) return;

		this.host.saveImages(
			this.host.images().filter((entry) => entry.id !== image.id),
		);
		if (this.activeId === image.id) this.activeId = null;
		this.refresh();
	}
}
