/**
 * settings/iconpicker/IconPickerModal.ts — The icon selection modal.
 *
 * The source menu fits a growing catalog on mobile and in RTL. The modal owns
 * source choice, preview and Confirm; each source panel owns its own controls.
 *
 * Requests start only on Download or confirmation of uncached artwork.
 */
import { Modal, setIcon } from "obsidian";
import type { App } from "obsidian";
import type {
	CalloutDefinition,
	CalloutIcon,
	IconSourceId,
	PluginSettings,
	UserImageIcon,
} from "../../types";
import type { IconVariantState } from "../../icons/types";
import { ICON_SOURCE_IDS, getSource, packFor } from "../../icons/registry";
import type { IconService } from "../../icons/IconService";
import {
	isDownloaded,
	libraryBytes,
	menuLibraries,
	pickerSources,
	type EditedCallout,
	type MenuLibraries,
} from "../../icons/iconLibraries";
import type { DeviceLocalStore } from "../../manager/DeviceLocalStore";
import type { SettingsWriter } from "../../manager/SettingsWriter";
import {
	MATERIAL_DEFAULT_STYLE,
	MATERIAL_DEFAULT_WEIGHT,
} from "../../icons/packs/material";
import { FA_DEFAULT_STYLE, faStyleOf } from "../../icons/packs/fontAwesome";
import { TABLER_DEFAULT_STYLE, tablerStyleOf } from "../../icons/packs/tabler";
import { describeIcon } from "../../icons/describeIcon";
import {
	ALL_SOURCES,
	createAllSourcesPack,
	type PickerSourceId,
} from "./allSources";
import { PackPanel } from "./PackPanel";
import { ImagePanel } from "./ImagePanel";
import { IconLibrariesModal } from "./IconLibrariesModal";
import {
	alignIconPickerRows,
	mountIconSourcePicker,
	showIconSource,
} from "./sourcePicker";
import { explainIfBlocked, paintBlocked } from "../../ui/blockedButton";
import type { ListboxPopup } from "../../ui/listboxPopup";
import { applyModalChrome, removeModalChrome } from "../modalChrome";
import { t } from "../../i18n";

/**
 * Both PackPanel and the writable ImagePanel implement this surface.
 */
interface PickerPanel {
	readonly searchQuery: string;
	render(): Promise<void>;
	dispose(): void;
}

/**
 * Unicode skin-tone modifiers, light → dark (U+1F3FB…U+1F3FF). Reading the tone
 * off the glyph is exact and needs no dataset lookup, so re-opening the picker
 * highlights the toned glyph the callout actually uses.
 */
const SKIN_TONE_MODIFIERS = [
	"\u{1F3FB}",
	"\u{1F3FC}",
	"\u{1F3FD}",
	"\u{1F3FE}",
	"\u{1F3FF}",
];

function emojiToneOf(glyph: string): number {
	const index = SKIN_TONE_MODIFIERS.findIndex((m) => glyph.includes(m));
	return index >= 0 ? index + 1 : 0;
}

export interface IconPickerPlugin {
	app: App;
	settings: PluginSettings;
	saveSettings(): Promise<void>;
	/**
	 * Where the picker was left, remembered on this device rather than in the
	 * synced settings. The synced fields still seed a device that has none.
	 */
	localState?: Pick<DeviceLocalStore, "iconCategory" | "setIconCategory" | "emojiSkinTone" | "setEmojiSkinTone">;
	ensureIconArtwork(icon: CalloutIcon): Promise<void>;
	/** Pack files for the panels; deleting a whole library for the Icon libraries window. */
	icons: Pick<IconService, "packs" | "deleteLibrary">;
	/** The Icon libraries window refuses to delete an in-use library while saving is paused. */
	settingsWriter: Pick<SettingsWriter, "isFrozen">;
	/**
	 * The slice of the registry the "Custom Icons" panel needs: the picture list
	 * and its one writer, plus the callouts, so deleting a picture can say how
	 * many callouts are about to lose their icon. `getCommitted` is the same
	 * question for a whole icon library, without the callout editor's draft.
	 */
	registry: {
		getUserImages(): readonly UserImageIcon[];
		setUserImages(images: readonly UserImageIcon[]): void;
		getAll(): CalloutDefinition[];
		getCommitted(): CalloutDefinition[];
	};
}

export class IconPicker extends Modal {
	private resolve: ((icon: CalloutIcon | null) => void) | null = null;
	private readonly currentIcon: CalloutIcon | null;
	private selectedIcon: CalloutIcon | null;
	private activeSource: PickerSourceId;
	private panel: PickerPanel | null = null;

	private panelHostEl!: HTMLElement;
	private previewEl!: HTMLElement;
	private confirmBtn!: HTMLButtonElement;
	private sourcePicker: ListboxPopup<PickerSourceId> | null = null;
	private sourceLayoutDisposer: (() => void) | null = null;
	/** Invalidates async startup and counts when this modal closes or reopens. */
	private openGeneration = 0;
	private packStatesLoaded = false;
	private packStateDisposer: (() => void) | null = null;
	/** How many icons each source offers; filled in the background on open. */
	private sourceCounts = new Map<IconSourceId, number>();

	/**
	 * `editing` names the callout the icon is being chosen for. Its icon is the
	 * one the picker opens on (`currentIcon`), which the editor holds unsaved —
	 * so the registry does not know it — and the Icon libraries window needs
	 * both to count it as a user of the library it is asked to delete.
	 */
	constructor(
		private readonly plugin: IconPickerPlugin,
		currentIcon?: CalloutIcon,
		private readonly editing?: { id: string | null; name: string },
	) {
		super(plugin.app);
		this.currentIcon = currentIcon ?? null;
		this.selectedIcon = currentIcon ? { ...currentIcon } : null;
		// Re-open on the icon's source; an unknown imported source falls back.
		this.activeSource = (currentIcon && packFor(currentIcon)?.id) ?? ALL_SOURCES;
	}

	openAndWait(): Promise<CalloutIcon | null> {
		return new Promise<CalloutIcon | null>((resolve) => {
			this.resolve = resolve;
			super.open();
		});
	}

	onOpen(): void {
		const generation = ++this.openGeneration;
		this.packStatesLoaded = false;
		this.modalEl.addClass("callout-studio-icon-picker");
		const footer = applyModalChrome(this, { footer: true });
		footer.addClass("icon-picker-footer");
		this.titleEl.setText(t("iconPicker.pickIcon"));

		const container = this.contentEl.createDiv("icon-picker-container");
		this.buildSourcePicker(container);
		this.packStateDisposer = this.plugin.icons.packs.onChange(() => {
			if (this.packStatesLoaded) this.sourcePicker?.setItems();
		});
		this.panelHostEl = container.createDiv("icon-picker-content");
		this.sourceLayoutDisposer = alignIconPickerRows(container, this.panelHostEl);
		// Bundled indexes make counting offline and normally finish before first open.
		void this.loadSourceCounts(generation);

		this.previewEl = footer.createDiv("icon-picker-preview");
		this.updatePreview();

		const cancelBtn = footer.createEl("button", {
			text: t("iconPicker.cancel"),
		});
		cancelBtn.addEventListener("click", () => this.cancel());

		this.confirmBtn = footer.createEl("button", {
			text: t("iconPicker.confirm"),
			cls: "mod-cta",
		});
		this.confirmBtn.addEventListener("click", () => void this.confirm());
		// The preview above was drawn before this button existed.
		paintBlocked(this.confirmBtn, this.confirmBlockedReason());

		void this.openInitialPanel(generation);
	}

	/**
	 * Warms pack state from disk before the first render, so a source
	 * downloaded in an earlier session but not yet assigned to a callout
	 * still shows as downloaded instead of prompting again.
	 */
	private async openInitialPanel(generation: number): Promise<void> {
		await this.plugin.icons.packs.loadAllFromDisk();
		if (generation !== this.openGeneration) return;
		this.packStatesLoaded = true;
		// The menu lists only what is on the device, so it is redrawn as soon as
		// that is known — not after the panel, which can wait on Material's font.
		this.sourcePicker?.setItems();
		await this.showPanel();
	}

	onClose(): void {
		this.openGeneration++;
		this.sourcePicker?.destroy();
		this.sourcePicker = null;
		this.sourceLayoutDisposer?.();
		this.sourceLayoutDisposer = null;
		this.panel?.dispose();
		this.panel = null;
		this.contentEl.empty();
		this.packStateDisposer?.();
		this.packStateDisposer = null;
		// The bar is a sibling of contentEl, so it outlives the usual teardown.
		removeModalChrome(this);
		if (this.resolve) {
			this.resolve(null);
			this.resolve = null;
		}
	}

	// ── Source selection ────────────────────────────────────────────────

	/** Rich library rows in the same listbox used by the toolbar filters. */
	private buildSourcePicker(container: HTMLElement): void {
		this.sourcePicker = mountIconSourcePicker(container, {
			value: this.activeSource,
			sources: () => this.menuLibraries(),
			countFor: (id) => this.countFor(id),
			onPick: (id) => this.selectSource(id),
			onManage: () => void this.openLibraries(),
		});
	}

	/**
	 * What the source menu lists: the libraries Pick an icon offers on this
	 * device, in the user's order, and — under a heading of its own — the
	 * library of the icon being edited when it is not one of them, so that
	 * re-editing the icon can show where it lives. See `menuLibraries`.
	 *
	 * The count of libraries left to download waits for the pack files to be
	 * read back: until then a library downloaded in an earlier session reads as
	 * missing, and the menu would quote a number about to drop.
	 */
	private menuLibraries(): MenuLibraries {
		const current = this.currentIcon ? packFor(this.currentIcon)?.id : undefined;
		const menu = menuLibraries(
			this.plugin.settings.iconLibraries,
			this.plugin.icons.packs,
			current,
		);
		return this.packStatesLoaded ? menu : { ...menu, toDownload: [] };
	}

	/** The callout being edited, with the icon the picker opened on; absent outside the editor. */
	private editedCallout(): EditedCallout | undefined {
		return this.editing && this.currentIcon
			? { ...this.editing, icon: this.currentIcon }
			: undefined;
	}

	/** What the pooled list holds: the offered libraries, in the user's order. */
	private pooledSources(): IconSourceId[] {
		return pickerSources(this.plugin.settings.iconLibraries, this.plugin.icons.packs);
	}

	/** Distinct icon names; style and weight variants do not inflate the count. */
	private countFor(id: PickerSourceId): number | undefined {
		if (id !== ALL_SOURCES) return this.sourceCount(id);
		if (this.sourceCounts.size === 0) return undefined;
		// Only what the pool actually contains, which changes as libraries are
		// downloaded, deleted or hidden.
		return this.pooledSources().reduce(
			(total, source) => total + (this.sourceCount(source) ?? 0),
			0,
		);
	}

	/** Fixed catalog counts are cached; user-owned Custom Icons are counted live. */
	private sourceCount(id: IconSourceId): number | undefined {
		if (id === "image") return this.plugin.registry.getUserImages().length;
		return this.sourceCounts.get(id);
	}

	private async loadSourceCounts(generation: number): Promise<void> {
		for (const id of ICON_SOURCE_IDS) {
			try {
				const index = await getSource(id).loadIndex();
				if (generation !== this.openGeneration) return;
				this.sourceCounts.set(id, index.entries.length);
			} catch (e) {
				if (generation !== this.openGeneration) return;
				// A source that cannot describe itself simply shows no count.
				console.warn(`[CalloutStudio] could not count icons in "${id}"`, e);
			}
		}
		this.sourcePicker?.setItems();
	}

	/**
	 * Open Manage icon libraries over the picker, and take in whatever it
	 * changed when it closes: the menu is rebuilt, a library that was offered
	 * and no longer is gives way to All sources, and an icon picked from such a
	 * library stops being the selection — confirming it would otherwise download
	 * that library again.
	 *
	 * The edited icon's own library is the exception, as in the menu: it stays
	 * on screen (under its own heading in the menu, with the download prompt if
	 * its files are gone), and the icon keeps its drawings, which are already
	 * saved with the callout.
	 */
	private async openLibraries(): Promise<void> {
		const generation = this.openGeneration;
		// A library downloaded in an earlier session reads as missing until its
		// file has been read back, which the picker does as it opens. Pressing
		// Manage libraries first would list a library the person already has
		// under "to download" — so wait for the same read, free once done.
		await this.plugin.icons.packs.loadAllFromDisk();
		if (generation !== this.openGeneration) return;
		const offeredBefore = new Set(this.pooledSources());
		const shownBefore = this.panelContents();
		const changed = await new IconLibrariesModal({
			app: this.plugin.app,
			settings: this.plugin.settings,
			saveSettings: () => this.plugin.saveSettings(),
			settingsWriter: this.plugin.settingsWriter,
			registry: this.plugin.registry,
			icons: this.plugin.icons,
			countFor: (id) => this.sourceCount(id),
			editing: this.editedCallout(),
		}).openAndWait();
		if (!changed || generation !== this.openGeneration) return;

		const offered = new Set(this.pooledSources());
		const current = this.currentIcon && packFor(this.currentIcon)?.id;
		const gone = (id: IconSourceId): boolean =>
			offeredBefore.has(id) && !offered.has(id) && id !== current;
		const selectedSource = this.selectedIcon && packFor(this.selectedIcon)?.id;
		if (selectedSource && gone(selectedSource)) {
			this.selectedIcon = null;
			this.updatePreview();
		}
		if (this.activeSource !== ALL_SOURCES && gone(this.activeSource)) {
			this.activeSource = ALL_SOURCES;
		}
		if (this.sourcePicker) showIconSource(this.sourcePicker, this.activeSource);
		// Rebuilding the panel sends its grid back to the selected icon, or to
		// the top: a jump nobody asked for when the change was about some other
		// library. So only when what the panel shows has changed, retaining the
		// search even if the active library gave way to All sources.
		if (this.panelContents() !== shownBefore) await this.showPanel(this.panel?.searchQuery);
	}

	/**
	 * What the active panel draws from the library settings, as one string —
	 * the pooled list is its members in order, a downloadable library is how
	 * much of it is still to download — so the panel is rebuilt exactly when
	 * this changes.
	 */
	private panelContents(): string {
		const source = this.activeSource;
		if (source === ALL_SOURCES) return `${source}:${this.pooledSources().join(",")}`;
		const packs = this.plugin.icons.packs;
		return `${source}:${isDownloaded(source, packs)}:${libraryBytes(source, packs, true)}`;
	}

	private selectSource(id: PickerSourceId): void {
		if (id === this.activeSource) return;
		this.activeSource = id;
		// Switching source clears the selection: an icon id only means anything
		// within the source it came from.
		this.selectedIcon = null;
		this.updatePreview();
		void this.showPanel();
	}

	private async showPanel(query = ""): Promise<void> {
		this.panel?.dispose();
		this.panelHostEl.empty();
		const host = this.panelHostEl.createDiv("icon-picker-panel");

		// The one source the user writes to needs its own panel; see ImagePanel.
		if (this.activeSource === "image") {
			this.panel = new ImagePanel(host, {
				app: this.plugin.app,
				allCallouts: () => this.plugin.registry.getAll(),
				images: () => this.plugin.registry.getUserImages(),
				saveImages: (images) => {
					this.plugin.registry.setUserImages(images);
					void this.plugin.saveSettings();
				},
				selectedIcon: () => this.selectedIcon,
				onSelect: (icon) => {
					this.selectedIcon = icon;
					this.updatePreview();
				},
				onDelete: (id) => {
					if (this.selectedIcon?.type !== "image" || this.selectedIcon.value !== id) return;
					this.selectedIcon = null;
					this.updatePreview();
				},
			}, query);
			await this.panel.render();
			return;
		}

		this.panel = new PackPanel(
			host,
			this.activePack(),
			{
				packs: this.plugin.icons.packs,
				variantsFor: (id) => this.variantsFor(id),
				saveVariants: (id, v) => this.saveVariants(id, v),
				lastCategoryFor: (id) => this.lastCategoryFor(id),
				saveCategory: (id, c) => this.saveCategory(id, c),
				selectedIcon: () => this.selectedIcon,
				onSelect: (icon) => {
					this.selectedIcon = icon;
					this.updatePreview();
				},
			},
			query,
		);
		await this.panel.render();
	}

	private activePack() {
		if (this.activeSource !== ALL_SOURCES) return getSource(this.activeSource);
		// Rebuilt each time, because downloading, deleting or hiding a library
		// mid-session should change the pooled list without reopening the picker.
		return createAllSourcesPack(this.pooledSources().map(getSource));
	}

	// ── Persisted picker state ──────────────────────────────────────────

	/**
	 * The toolbar values a source opens with. When re-opening on an existing
	 * icon they come from that icon, not from the saved defaults — otherwise
	 * its cell would be drawn in a different style and the highlight would be
	 * lost on the very icon the user is editing.
	 */
	private variantsFor(id: IconSourceId): IconVariantState {
		const sources = this.plugin.settings.iconSources;
		if (id === "fa") {
			// The style is the icon's own type, so an icon being re-edited opens
			// the grid it actually lives in.
			return {
				faStyle:
					(this.currentIcon ? faStyleOf(this.currentIcon) : undefined) ??
					sources.faStyleDefault ??
					FA_DEFAULT_STYLE,
			};
		}
		if (id === "tabler") {
			// Same reasoning as Font Awesome above: the style is the icon's own
			// type, so re-editing an icon opens the grid it actually lives in.
			return {
				tablerStyle:
					(this.currentIcon ? tablerStyleOf(this.currentIcon) : undefined) ??
					sources.tablerStyleDefault ??
					TABLER_DEFAULT_STYLE,
			};
		}
		if (id === "material") {
			const current =
				this.currentIcon?.type === "material" ? this.currentIcon : null;
			return {
				style:
					current?.style ??
					sources.materialStyleDefault ??
					MATERIAL_DEFAULT_STYLE,
				weight:
					current?.weight ??
					sources.materialWeightDefault ??
					MATERIAL_DEFAULT_WEIGHT,
			};
		}
		if (id === "emoji") {
			return {
				emojiSkinTone:
					this.currentIcon?.type === "emoji"
						? emojiToneOf(this.currentIcon.value)
						: (this.plugin.localState?.emojiSkinTone ?? sources.lastEmojiSkinTone ?? 0),
			};
		}
		return {};
	}

	private saveVariants(id: IconSourceId, variants: IconVariantState): void {
		const sources = this.plugin.settings.iconSources;
		if (id === "material") {
			if (variants.style) sources.materialStyleDefault = variants.style;
			if (variants.weight) sources.materialWeightDefault = variants.weight;
		} else if (id === "fa") {
			if (variants.faStyle) sources.faStyleDefault = variants.faStyle;
		} else if (id === "tabler") {
			if (variants.tablerStyle) {
				sources.tablerStyleDefault = variants.tablerStyle;
			}
		} else if (id === "emoji") {
			// Memory, not a setting: kept on this device and never saved.
			if (variants.emojiSkinTone !== undefined) this.plugin.localState?.setEmojiSkinTone(variants.emojiSkinTone);
			return;
		}
		void this.plugin.saveSettings();
	}

	private lastCategoryFor(id: IconSourceId): string {
		// Re-opening on an existing icon shows all categories, so the icon can
		// never be filtered out of its own grid. In-memory only — the saved
		// category is left alone.
		const current = this.currentIcon ? packFor(this.currentIcon) : undefined;
		if (current?.id === id) return "";
		return this.plugin.localState?.iconCategory(id) ?? this.plugin.settings.iconSources.lastCategory?.[id] ?? "";
	}

	private saveCategory(id: IconSourceId, category: string): void {
		this.plugin.localState?.setIconCategory(id, category);
	}

	// ── Preview & confirm ───────────────────────────────────────────────

	private updatePreview(): void {
		this.previewEl.empty();
		if (this.confirmBtn) paintBlocked(this.confirmBtn, this.confirmBlockedReason());
		if (!this.selectedIcon) {
			this.previewEl.setText(t("iconPicker.noIconSelected"));
			return;
		}
		this.previewEl
			.createDiv("icon-picker-preview-label")
			.setText(describeIcon(this.selectedIcon, this.plugin.registry.getUserImages()));
	}

	/**
	 * Why Confirm cannot act, or null: no icon is chosen — which is also what
	 * switching to another source does, since an icon only means something
	 * within the source it came from. Dimmed rather than disabled, so pressing
	 * it says so. (While the artwork downloads it is truly disabled: the
	 * spinner and "Downloading icon" in its label already say why.)
	 */
	private confirmBlockedReason(): string | null {
		return this.selectedIcon ? null : t("iconPicker.chooseFirst");
	}

	/**
	 * Fetch the artwork before handing the icon back, so any wait happens here —
	 * where the icon is on screen — rather than in the editor behind the modal.
	 * Sources whose artwork is already local return immediately.
	 */
	private async confirm(): Promise<void> {
		if (explainIfBlocked(this.confirmBlockedReason())) return;
		if (!this.selectedIcon || !this.resolve) {
			this.close();
			return;
		}

		const originalText = this.confirmBtn.textContent ?? "";
		this.confirmBtn.disabled = true;
		this.confirmBtn.toggleClass("is-disabled", true);
		this.confirmBtn.empty();
		this.confirmBtn.addClass("callout-studio-icon-picker-loading");
		const spinner = this.confirmBtn.createSpan({
			cls: "callout-studio-spinner",
		});
		setIcon(spinner, "loader-2");
		this.confirmBtn.createSpan({ text: t("editor.downloadingIcon") });
		try {
			await this.plugin.ensureIconArtwork(this.selectedIcon);
		} catch {
			// Failures surface through the icon's own error state; never trap
			// the user in the picker over one.
		} finally {
			this.confirmBtn.disabled = false;
			this.confirmBtn.removeClass("callout-studio-icon-picker-loading");
			this.confirmBtn.empty();
			this.confirmBtn.textContent = originalText;
		}
		// The user may have closed the modal while the fetch was in flight.
		if (!this.resolve) return;

		this.resolve(this.selectedIcon);
		this.resolve = null;
		this.close();
	}

	private cancel(): void {
		if (this.resolve) {
			this.resolve(null);
			this.resolve = null;
		}
		this.close();
	}
}
