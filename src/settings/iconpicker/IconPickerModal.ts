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
	availableSources,
	createAllSourcesPack,
	missingSources,
	type PickerSourceId,
} from "./allSources";
import { PackPanel } from "./PackPanel";
import { ImagePanel } from "./ImagePanel";
import { alignIconPickerRows, mountIconSourcePicker } from "./sourcePicker";
import type { ListboxPopup } from "../../ui/listboxPopup";
import { applyModalChrome, removeModalChrome } from "../modalChrome";
import { t } from "../../i18n";

/**
 * What the modal needs of whichever panel is on screen. Every source but one is
 * a PackPanel; "Custom Icons" is an ImagePanel, because it is the only library
 * the user can write to (see ImagePanel's header).
 */
interface PickerPanel {
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
	private sourcePicker: ListboxPopup<PickerSourceId> | null = null;
	private sourceLayoutDisposer: (() => void) | null = null;
	/** Invalidates async startup and counts when this modal closes or reopens. */
	private openGeneration = 0;
	private packStatesLoaded = false;
	private packStateDisposer: (() => void) | null = null;
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
		await this.showPanel();
		if (generation !== this.openGeneration) return;
		this.sourcePicker?.setItems();
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
			countFor: (id) => this.countFor(id),
			isMissing: (id) => this.packStatesLoaded &&
				missingSources(this.plugin.icons.packs).some((pack) => pack.id === id),
			onPick: (id) => this.selectSource(id),
		});
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

	private selectSource(id: PickerSourceId): void {
		if (id === this.activeSource) return;
		this.activeSource = id;
		// Switching source clears the selection: an icon id only means anything
		// within the source it came from.
		this.selectedIcon = null;
		this.updatePreview();
		void this.showPanel();
	}

	private async showPanel(): Promise<void> {
		const generation = this.openGeneration;
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
		const panel = this.panel;
		await panel.render();
		if (generation !== this.openGeneration || this.panel !== panel) return;
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
