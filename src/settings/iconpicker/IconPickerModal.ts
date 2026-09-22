/**
 * settings/iconpicker/IconPickerModal.ts — The icon selection modal.
 *
 * A source menu rather than a tab row: there are more sources than a tab strip
 * fits, on mobile or in RTL, and the list keeps growing. The modal owns only
 * the source choice, the preview and Confirm; everything about a given source
 * lives in PackPanel.
 *
 * Nothing here reaches the network. Choosing a source shows either its grid or
 * a download prompt; only pressing Download, or confirming an icon whose
 * artwork is not local yet, causes a request.
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
import type { PackDataStore } from "../../icons/PackDataStore";
import {
	MATERIAL_DEFAULT_STYLE,
	MATERIAL_DEFAULT_WEIGHT,
} from "../../icons/packs/material";
import { FA_DEFAULT_STYLE, faStyleOf } from "../../icons/packs/fontAwesome";
import { TABLER_DEFAULT_STYLE, tablerStyleOf } from "../../icons/packs/tabler";
import { describeIcon } from "../../icons/describeIcon";
import {
	ALL_SOURCES,
	ALL_SOURCES_META,
	availableSources,
	createAllSourcesPack,
	missingSources,
	type PickerSourceId,
} from "./allSources";
import { PackPanel } from "./PackPanel";
import { ImagePanel } from "./ImagePanel";
import { createSourceMenuTitle } from "./sourceMenuPresentation";
import { clearListboxMenuHeightCap, syncListboxMenuHeightCap } from "../../ui/listboxPopupLayout";
import { applyModalChrome, removeModalChrome } from "../modalChrome";
import { getLocale, t } from "../../i18n";
import type { LocaleKey } from "../../i18n";

/**
 * What the modal needs of whichever panel is on screen. Every source but one is
 * a PackPanel; "Custom Icons" is an ImagePanel, because it is the only library
 * the user can write to (see ImagePanel's header).
 */
interface PickerPanel {
	render(): Promise<void>;
	dispose(): void;
}

/** What the source menu needs to draw a row, pooled list included. */
interface SourceMeta {
	labelKey: LocaleKey;
	descriptionKey: LocaleKey;
	emblemIcon: string;
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
	ensureIconArtwork(icon: CalloutIcon): Promise<void>;
	icons: { packs: PackDataStore };
	/**
	 * The slice of the registry the "Custom Icons" panel needs: the picture list
	 * and its one writer, plus the callouts, so deleting a picture can say how
	 * many callouts are about to lose their icon.
	 */
	registry: {
		getUserImages(): readonly UserImageIcon[];
		setUserImages(images: readonly UserImageIcon[]): void;
		getAll(): CalloutDefinition[];
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
	private sourceButtonEl!: HTMLButtonElement;
	private sourceDropdownEl!: HTMLElement;
	private sourceMenuEl!: HTMLElement;
	private sourceMenuOpen = false;
	private sourceMenuItems: { id: PickerSourceId; el: HTMLElement }[] = [];
	private activeSourceMenuIndex = -1;
	private sourceMenuPointerActive = false;
	private sourceMenuResizeDisposer?: () => void;
	private packStatesLoaded = false;
	private packStateDisposer: (() => void) | null = null;
	/** Removed by hand in onClose because Modal has no auto-cleanup. */
	private sourceMenuOutsideClick: ((ev: MouseEvent) => void) | null = null;
	/** How many icons each source offers; filled in the background on open. */
	private sourceCounts = new Map<IconSourceId, number>();

	constructor(
		private readonly plugin: IconPickerPlugin,
		currentIcon?: CalloutIcon,
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
		this.modalEl.addClass("callout-studio-icon-picker");
		const footer = applyModalChrome(this, { footer: true });
		footer.addClass("icon-picker-footer");
		this.titleEl.setText(t("iconPicker.pickIcon"));

		const container = this.contentEl.createDiv("icon-picker-container");
		this.buildSourcePicker(container);
		this.packStateDisposer = this.plugin.icons.packs.onChange(() => {
			if (this.packStatesLoaded && this.sourceMenuOpen) {
				this.closeSourceMenu();
				this.sourceButtonEl.focus();
			}
		});
		this.panelHostEl = container.createDiv("icon-picker-content");
		// Bundled indexes make counting offline and normally finish before first open.
		void this.loadSourceCounts();

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

		void this.openInitialPanel();
	}

	/**
	 * Warms pack state from disk before the first render, so a source
	 * downloaded in an earlier session but not yet assigned to a callout
	 * still shows as downloaded instead of prompting again.
	 */
	private async openInitialPanel(): Promise<void> {
		await this.plugin.icons.packs.loadAllFromDisk();
		this.packStatesLoaded = true;
		await this.showPanel();
		if (this.sourceMenuOpen) this.openSourceMenu();
	}

	onClose(): void {
		this.closeSourceMenu();
		this.panel?.dispose();
		this.panel = null;
		this.packStateDisposer?.();
		this.packStateDisposer = null;
		// The bar is a sibling of contentEl, so it outlives the usual teardown.
		removeModalChrome(this);
		if (this.sourceMenuOutsideClick) {
			activeDocument.removeEventListener(
				"click",
				this.sourceMenuOutsideClick,
			);
			this.sourceMenuOutsideClick = null;
		}
		if (this.resolve) {
			this.resolve(null);
			this.resolve = null;
		}
	}

	// ── Source selection ────────────────────────────────────────────────

	/** A button-anchored listbox with library descriptions and selection marks. */
	private buildSourcePicker(container: HTMLElement): void {
		const row = container.createDiv("icon-picker-source-row");
		row.createEl("label", {
			text: t("iconPicker.chooseSource"),
			cls: "icon-picker-source-label",
			attr: { for: "cs-icon-source", id: "icon-picker-source-label" },
		});
		this.sourceDropdownEl = row.createDiv("icon-picker-source-dropdown");
		this.sourceButtonEl = this.sourceDropdownEl.createEl("button", {
			cls: "icon-picker-source-button",
			attr: {
				id: "cs-icon-source",
				type: "button",
				"aria-haspopup": "listbox",
				"aria-expanded": "false",
			},
		});
		this.paintSourceButton();
		this.sourceMenuEl = this.sourceDropdownEl.createDiv({
			cls: "icon-picker-source-menu icon-picker-source-menu-hidden",
			attr: { role: "listbox", tabindex: "-1", "aria-labelledby": "icon-picker-source-label" },
		});
		this.sourceDropdownEl.addEventListener("focusout", (ev) => {
			const next = ev.relatedTarget as Node | null;
			if (!next || !this.sourceDropdownEl.contains(next)) this.closeSourceMenu();
		});

		this.sourceButtonEl.addEventListener("click", () => {
			if (this.sourceMenuOpen) this.closeSourceMenu();
			else this.openSourceMenu();
		});
		this.sourceMenuEl.addEventListener("keydown", (ev) =>
			this.onSourceMenuKeydown(ev),
		);
		this.sourceMenuEl.addEventListener("mouseleave", () => {
			if (this.sourceMenuPointerActive) this.setActiveSourceMenuItem(-1);
		});
		// Nothing closes a plain div for us the way a real Menu would.
		this.sourceMenuOutsideClick = (ev) => {
			if (!this.sourceMenuOpen) return;
			const target = ev.target as Node | null;
			if (target && this.sourceDropdownEl.contains(target)) return;
			this.closeSourceMenu();
		};
		activeDocument.addEventListener("click", this.sourceMenuOutsideClick);
	}

	/** Metadata for one row of the source menu; the pooled list has no pack. */
	private sourceMeta(id: PickerSourceId): SourceMeta {
		return id === ALL_SOURCES ? ALL_SOURCES_META : getSource(id);
	}

	private paintSourceButton(): void {
		const meta = this.sourceMeta(this.activeSource);
		this.sourceButtonEl.empty();
		const emblem = this.sourceButtonEl.createSpan({
			cls: "icon-picker-source-emblem",
		});
		setIcon(emblem, meta.emblemIcon);
		this.sourceButtonEl.createSpan({
			cls: "icon-picker-source-current",
			text: t(meta.labelKey),
		});
		const chevron = this.sourceButtonEl.createSpan({
			cls: "icon-picker-source-chevron",
		});
		setIcon(chevron, "chevron-down");
	}

	/** Rebuilt on every open so counts and download state are never stale. */
	private buildSourceMenuItems(): void {
		this.sourceMenuEl.empty();
		this.sourceMenuItems = [];
		const missing = new Set(
			this.packStatesLoaded
				? missingSources(this.plugin.icons.packs).map((pack) => pack.id)
				: [],
		);
		// Searching everything is first: knowing which library has "swords" is hard.
		const ids: PickerSourceId[] = [ALL_SOURCES, ...ICON_SOURCE_IDS];
		for (const id of ids) {
			const meta = this.sourceMeta(id);
			const item = this.sourceMenuEl.createDiv({
				cls: "icon-picker-source-menu-item",
				attr: { id: `cs-icon-source-option-${id}`, role: "option",
					"aria-selected": String(id === this.activeSource) },
			});
			const emblem = item.createSpan({
				cls: "icon-picker-source-menu-item-emblem",
			});
			// Lucide emblems draw even when the source itself is not downloaded.
			setIcon(emblem, meta.emblemIcon);
			item.appendChild(
				createSourceMenuTitle({
					label: t(meta.labelKey),
					description: t(meta.descriptionKey),
					count: this.countFor(id),
					locale: getLocale(),
					exactCount: id === "image",
					notDownloaded: id !== ALL_SOURCES && missing.has(id),
					notDownloadedLabel: t("iconPicker.notDownloaded"),
					selected: id === this.activeSource,
				}),
			);
			item.toggleClass("is-selected", id === this.activeSource);
			item.addEventListener("mouseenter", () =>
				this.setActiveSourceMenuItem(
					this.sourceMenuItems.findIndex((i) => i.id === id),
					{ pointer: true },
				),
			);
			item.addEventListener("mouseleave", () => {
				if (this.sourceMenuPointerActive) this.setActiveSourceMenuItem(-1);
			});
			item.addEventListener("click", () => {
				this.selectSource(id);
				this.closeSourceMenu();
			});
			this.sourceMenuItems.push({ id, el: item });
		}
	}

	/** Open below the trigger, capped to the visible modal body. */
	private openSourceMenu(): void {
		this.buildSourceMenuItems();
		this.sourceMenuOpen = true;
		this.sourceMenuEl.removeClass("icon-picker-source-menu-hidden");
		this.sourceButtonEl.addClass("is-open");
		this.sourceButtonEl.setAttribute("aria-expanded", "true");
		this.applySourceMenuHeightCap();
		const startIdx = this.sourceMenuItems.findIndex(
			(i) => i.id === this.activeSource,
		);
		this.setActiveSourceMenuItem(startIdx >= 0 ? startIdx : 0);
		this.sourceMenuEl.focus();
	}

	private applySourceMenuHeightCap(): void {
		this.sourceMenuResizeDisposer = syncListboxMenuHeightCap(this.sourceButtonEl,
			this.sourceMenuEl, this.sourceMenuResizeDisposer,
			() => this.applySourceMenuHeightCap(), this.contentEl);
	}

	private closeSourceMenu(): void {
		if (!this.sourceMenuOpen) return;
		this.sourceMenuOpen = false;
		this.sourceMenuEl.addClass("icon-picker-source-menu-hidden");
		this.sourceButtonEl.removeClass("is-open");
		this.sourceButtonEl.setAttribute("aria-expanded", "false");
		this.setActiveSourceMenuItem(-1);
		this.sourceMenuResizeDisposer?.();
		this.sourceMenuResizeDisposer = undefined;
		clearListboxMenuHeightCap(this.sourceMenuEl);
	}

	private setActiveSourceMenuItem(
		index: number,
		opts?: { pointer?: boolean },
	): void {
		this.sourceMenuPointerActive = opts?.pointer ?? false;
		const prev = this.sourceMenuItems[this.activeSourceMenuIndex];
		prev?.el.removeClass("is-active");
		if (index < 0 || index >= this.sourceMenuItems.length) {
			this.activeSourceMenuIndex = -1;
			this.sourceMenuEl.removeAttribute("aria-activedescendant");
			return;
		}
		const entry = this.sourceMenuItems[index];
		if (!entry) {
			this.activeSourceMenuIndex = -1;
			return;
		}
		this.activeSourceMenuIndex = index;
		entry.el.addClass("is-active");
		this.sourceMenuEl.setAttribute("aria-activedescendant", entry.el.id);
		if (!opts?.pointer) entry.el.scrollIntoView({ block: "nearest" });
	}

	private onSourceMenuKeydown(ev: KeyboardEvent): void {
		if (ev.key === "ArrowDown") {
			ev.preventDefault();
			this.setActiveSourceMenuItem(
				Math.min(
					this.activeSourceMenuIndex + 1,
					this.sourceMenuItems.length - 1,
				),
			);
		} else if (ev.key === "ArrowUp") {
			ev.preventDefault();
			this.setActiveSourceMenuItem(Math.max(this.activeSourceMenuIndex - 1, 0));
		} else if (ev.key === "Enter") {
			ev.preventDefault();
			const entry = this.sourceMenuItems[this.activeSourceMenuIndex];
			if (entry) {
				this.selectSource(entry.id);
				this.closeSourceMenu();
				this.sourceButtonEl.focus();
			}
		} else if (ev.key === "Escape") {
			ev.preventDefault();
			this.closeSourceMenu();
			this.sourceButtonEl.focus();
		}
	}

	/** Distinct icon names; style and weight variants do not inflate the count. */
	private countFor(id: PickerSourceId): number | undefined {
		if (id !== ALL_SOURCES) return this.sourceCount(id);
		if (this.sourceCounts.size === 0) return undefined;
		// Only what the pool actually contains, which grows as sources download.
		return availableSources(this.plugin.icons.packs).reduce(
			(total, pack) => total + (this.sourceCount(pack.id) ?? 0),
			0,
		);
	}

	/** Fixed catalog counts are cached; user-owned Custom Icons are counted live. */
	private sourceCount(id: IconSourceId): number | undefined {
		if (id === "image") return this.plugin.registry.getUserImages().length;
		return this.sourceCounts.get(id);
	}

	private async loadSourceCounts(): Promise<void> {
		for (const id of ICON_SOURCE_IDS) {
			try {
				const index = await getSource(id).loadIndex();
				this.sourceCounts.set(id, index.entries.length);
			} catch (e) {
				// A source that cannot describe itself simply shows no count.
				console.warn(`[CalloutStudio] could not count icons in "${id}"`, e);
			}
		}
	}

	private selectSource(id: PickerSourceId): void {
		if (id === this.activeSource) return;
		this.activeSource = id;
		// Switching source clears the selection: an icon id only means anything
		// within the source it came from.
		this.selectedIcon = null;
		this.paintSourceButton();
		this.updatePreview();
		void this.showPanel();
	}

	private async showPanel(): Promise<void> {
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
			});
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
		);
		await this.panel.render();
		if (this.activeSource === ALL_SOURCES) this.renderMissingSourcesHint();
	}

	private activePack() {
		if (this.activeSource !== ALL_SOURCES) return getSource(this.activeSource);
		// Rebuilt each time, because downloading a source mid-session should
		// fold it into the pooled list without reopening the picker.
		return createAllSourcesPack(availableSources(this.plugin.icons.packs));
	}

	/**
	 * Say which sources the pooled list is missing, rather than letting them
	 * silently not be in the results.
	 */
	private renderMissingSourcesHint(): void {
		const missing = missingSources(this.plugin.icons.packs);
		if (missing.length === 0) return;
		const hint = this.panelHostEl.createDiv("icon-picker-missing-sources");
		hint.setText(
			t("iconPicker.sourcesNotDownloaded", {
				names: missing.map((p) => t(p.labelKey)).join(", "),
			}),
		);
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
						: (sources.lastEmojiSkinTone ?? 0),
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
		} else if (id === "emoji" && variants.emojiSkinTone !== undefined) {
			sources.lastEmojiSkinTone = variants.emojiSkinTone;
		}
		void this.plugin.saveSettings();
	}

	private lastCategoryFor(id: IconSourceId): string {
		// Re-opening on an existing icon shows all categories, so the icon can
		// never be filtered out of its own grid. In-memory only — the saved
		// category is left alone.
		const current = this.currentIcon ? packFor(this.currentIcon) : undefined;
		if (current?.id === id) return "";
		return this.plugin.settings.iconSources.lastCategory?.[id] ?? "";
	}

	private saveCategory(id: IconSourceId, category: string): void {
		const sources = this.plugin.settings.iconSources;
		sources.lastCategory = { ...sources.lastCategory, [id]: category };
		void this.plugin.saveSettings();
	}

	// ── Preview & confirm ───────────────────────────────────────────────

	private updatePreview(): void {
		this.previewEl.empty();
		if (!this.selectedIcon) {
			this.previewEl.setText(t("iconPicker.noIconSelected"));
			this.confirmBtn?.toggleClass("is-disabled", true);
			return;
		}
		this.confirmBtn?.toggleClass("is-disabled", false);
		this.previewEl
			.createDiv("icon-picker-preview-label")
			.setText(describeIcon(this.selectedIcon, this.plugin.registry.getUserImages()));
	}

	/**
	 * Fetch the artwork before handing the icon back, so any wait happens here —
	 * where the icon is on screen — rather than in the editor behind the modal.
	 * Sources whose artwork is already local return immediately.
	 */
	private async confirm(): Promise<void> {
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
