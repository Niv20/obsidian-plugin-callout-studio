/**
 * settings/iconpicker/PackPanel.ts — One source's toolbar and grid.
 *
 * Entirely driven by the IconPack it is handed: which controls to show, what to
 * search, how to draw a cell, whether a download is needed first. Adding a
 * source therefore changes nothing in this file.
 *
 * Downloadable sources open on a prompt rather than a grid, and no request is
 * made until the user presses Download. That is a deliberate, visible property:
 * opening the icon picker never touches the network.
 */
import { setIcon } from "obsidian";
import type {
	CalloutIcon,
	IconPackId,
	IconSourceId,
	MaterialIconStyle,
} from "../../types";
import type {
	IconEntry,
	IconIndex,
	IconPack,
	IconVariantState,
} from "../../icons/types";
import { filterIcons } from "../../icons/search";
import { renderIconInto } from "../../icons/renderIcon";
import { getSource, packFor } from "../../icons/registry";
import { canonicalIconValue } from "../../icons/lucideId";
import { MATERIAL_DEFAULT_STYLE, materialPack } from "../../icons/packs/material";
import {
	ensureMaterialFontLoaded,
	isMaterialFontReady,
	materialFontFamily,
} from "../../icons/packs/materialFont";
import type { PackDataStore } from "../../icons/PackDataStore";
import { isAllSources } from "./allSources";
import { IconGrid } from "./IconGrid";
import { PackToolbarFilters } from "./PackToolbarFilters";
import { t } from "../../i18n";

/**
 * Draws grid cells straight from pack data, bypassing the `data.json` cache.
 *
 * The picker is showing icons the user has not chosen yet, so none of them are
 * in that cache — asking it would return nothing for every cell.
 */
const previewResolver = {
	resolveSvg: (icon: CalloutIcon, role: "regular" | "heading" | "inline") =>
		packFor(icon)?.buildSvg?.(icon, role) ?? null,
	hasFailed: () => false,
};

export interface PackPanelHost {
	packs: PackDataStore;
	/** Persisted picker state (last category per source, last skin tone). */
	variantsFor(sourceId: IconSourceId): IconVariantState;
	saveVariants(sourceId: IconSourceId, variants: IconVariantState): void;
	lastCategoryFor(sourceId: IconSourceId): string;
	saveCategory(sourceId: IconSourceId, category: string): void;
	onSelect(icon: CalloutIcon, entry: IconEntry): void;
	/** The icon the picker opened on, so its cell starts highlighted. */
	selectedIcon(): CalloutIcon | null;
}

export class PackPanel {
	private readonly toolbarEl: HTMLElement;
	private readonly bodyEl: HTMLElement;
	private grid: IconGrid | null = null;
	private index: IconIndex | null = null;
	private query = "";
	private category = "";
	private variants: IconVariantState;
	private searchInput: HTMLInputElement | null = null;
	private filters: PackToolbarFilters | null = null;
	/** Rebuilt on every variant change — Font Awesome's applies to Brands only. */
	private noticeEl: HTMLElement | null = null;
	/**
	 * Shown only when Material's webfont could not be loaded, which is the one
	 * failure the grid cannot draw around: its cells *are* ligature names, so
	 * without the font they read as text. Separate from `noticeEl` because that
	 * one is driven by the pack's static `pickerNotice` key and holds no button.
	 */
	private fontNoticeEl: HTMLElement | null = null;
	/**
	 * The entry behind the current selection, so a later variant change (weight,
	 * style, skin tone) can redraw it from the same name instead of leaving the
	 * host holding the icon as it looked before the toolbar changed.
	 */
	private selectedEntry: IconEntry | null = null;
	/** How many of the current results each source contributed; pooled list only. */
	private groupCounts = new Map<IconSourceId, number>();
	/** Guards against a slow load painting into a panel the user has left. */
	private disposed = false;

	constructor(
		private readonly container: HTMLElement,
		private readonly pack: IconPack,
		private readonly host: PackPanelHost,
	) {
		this.variants = { ...host.variantsFor(pack.id) };
		this.category = host.lastCategoryFor(pack.id);
		this.toolbarEl = container.createDiv("icon-picker-toolbar");
		this.bodyEl = container.createDiv("icon-picker-body");
	}

	dispose(): void {
		this.disposed = true;
		this.filters?.destroy();
		this.container.empty();
	}

	/** Build the panel and show whatever state the source is in. */
	async render(): Promise<void> {
		this.buildToolbar();
		this.renderFontNotice();
		this.grid = new IconGrid(this.bodyEl, {
			renderCell: (cell, entry) => this.renderCell(cell, entry),
			isSelected: (entry) => this.isSelected(entry),
			onSelect: (entry) => this.select(entry),
			labelFor: (entry) => this.labelFor(entry),
			cellClass: (entry) => this.cellClass(entry),
			groupLabelFor: (entry, previous) =>
				this.groupLabelFor(entry, previous),
			emptyText: t("iconPicker.noResults"),
			loadMoreText: t("iconPicker.loadMore"),
		});
		this.renderAttribution();

		// Indexes are bundled, so this touches no network — and having it before
		// the download check is what lets the prompt quote a real icon count.
		this.index = await this.pack.loadIndex();
		if (this.disposed) return;

		if (this.needsDownload()) {
			this.showDownloadPrompt();
			return;
		}
		await this.loadAndShow();
	}

	// ── Toolbar ─────────────────────────────────────────────────────────

	private buildToolbar(): void {
		this.searchInput = this.toolbarEl.createEl("input", {
			type: "text",
			cls: "icon-picker-search-input cs-text-control",
			placeholder: t(this.pack.searchPlaceholderKey),
			value: this.query,
		});
		this.searchInput.addEventListener("input", () => {
			this.query = this.searchInput?.value ?? "";
			this.applyFilter();
		});
		this.filters = new PackToolbarFilters(
			this.toolbarEl, this.pack, this.variants, this.category, {
				onCategory: (category) => {
					this.category = category;
					this.host.saveCategory(this.pack.id, category);
					this.applyFilter();
				},
				onVariant: (variants, kind) => {
					this.variants = variants;
					this.host.saveVariants(this.pack.id, variants);
					if (kind === "skin-tone") {
						this.syncSelectionToVariants();
						// Tone changes only the glyphs; keep scroll and loaded pages.
						this.grid?.repaintVisible();
					} else void this.onVariantChanged();
				},
			},
		);
	}

	/**
	 * Searching, filtering or restyling all mean nothing while a source still
	 * has to be downloaded, and acting on one would paint over the prompt that
	 * offers the download. The controls are locked rather than hidden so the
	 * toolbar keeps its height and the source still looks like itself.
	 */
	private setToolbarEnabled(enabled: boolean): void {
		if (this.searchInput) this.searchInput.disabled = !enabled;
		this.filters?.setEnabled(enabled);
		this.toolbarEl.toggleClass("is-disabled", !enabled);
	}

	/**
	 * A variant change can alter the artwork itself — and for Font Awesome which
	 * icons exist at all — so the grid is rebuilt. Material additionally has to
	 * wait for the webfont of the newly chosen style before its ligatures
	 * resolve into glyphs.
	 */
	private async onVariantChanged(): Promise<void> {
		if (this.pack.kind === "perIconRemote") {
			await this.syncMaterialFont();
			if (this.disposed) return;
		}
		this.syncSelectionToVariants();
		this.updateNotice();
		this.applyFilter();
		this.grid?.revealSelected();
	}

	/**
	 * Re-derive the current selection under the toolbar's new variant state.
	 *
	 * A style or weight change redraws every cell in the grid, but without this
	 * the host still holds the `CalloutIcon` built at the moment of the original
	 * click — so Confirm would save the icon as it looked before the toolbar
	 * changed, and the only way to pick up the new weight/style was to click the
	 * already-selected cell again.
	 */
	private syncSelectionToVariants(): void {
		const selected = this.host.selectedIcon();
		if (!selected) return;
		// Only this panel's own source: a variant change here has nothing to say
		// about an icon selected from another one.
		if (packFor(selected)?.id !== this.pack.id) return;
		// A toned emoji's stored value is one of `entry.variants`, not
		// `entry.name` — matching name alone misses every entry re-opened with a
		// skin tone already applied, which is exactly the case a tone change
		// needs to resync.
		const entry =
			this.selectedEntry ??
			this.index?.entries.find(
				(e) =>
					e.name === selected.value ||
					e.variants?.includes(selected.value),
			);
		if (!entry) return;
		this.selectedEntry = entry;
		this.host.onSelect(this.pack.makeIcon(entry, this.variants), entry);
	}

	// ── Loading ─────────────────────────────────────────────────────────

	/** The pack files this source draws from; empty for sources with none. */
	private dataPacks(): readonly IconPackId[] {
		if (this.pack.kind !== "bundledRemote") return [];
		return this.pack.dataPacks ?? [];
	}

	private missingPacks(): IconPackId[] {
		return this.dataPacks().filter(
			(id) => this.host.packs.state(id) !== "ready",
		);
	}

	private needsDownload(): boolean {
		return this.missingPacks().length > 0;
	}

	private async loadAndShow(): Promise<void> {
		this.setToolbarEnabled(true);
		// Material previews its grid with the webfont rather than SVGs, since
		// its artwork is fetched one icon at a time and none of it is local
		// yet. The pooled list contains Material cells too, so it waits as well.
		await this.syncMaterialFont();
		if (this.disposed) return;

		this.index = await this.pack.loadIndex();
		if (this.disposed) return;

		this.populateCategories();
		this.applyFilter();
		this.grid?.revealSelected();
		this.searchInput?.focus();
	}

	private populateCategories(): void {
		this.category = this.filters?.setCategories(this.index?.categories ?? []) ?? "";
	}

	private applyFilter(): void {
		if (!this.index) return;
		// The grid is holding the download prompt, not icons. Filtering would
		// replace it with cells there is no artwork for.
		if (this.needsDownload()) return;
		const entries = filterIcons(this.index, this.query, this.category);
		// A pack may also rule entries out by variant — Font Awesome's style
		// picks which icons exist, not just how they are drawn.
		const matches = this.pack.entryMatches?.bind(this.pack);
		const shown = matches
			? entries.filter((entry) => matches(entry, this.variants))
			: entries;
		this.countGroups(shown);
		this.grid?.setEntries(shown);
	}

	/**
	 * Tally the results per source, so each heading can say how many it stands
	 * for. Done once here rather than per heading, which would otherwise walk the
	 * whole result list again every time a page is added.
	 */
	private countGroups(entries: readonly IconEntry[]): void {
		this.groupCounts = new Map();
		if (!isAllSources(this.pack)) return;
		for (const entry of entries) {
			if (!entry.pack) continue;
			this.groupCounts.set(
				entry.pack,
				(this.groupCounts.get(entry.pack) ?? 0) + 1,
			);
		}
	}

	/**
	 * The heading that opens each source's run of results in the pooled list.
	 *
	 * Pooling preserves the run — the pooled index concatenates its members and
	 * `filterIcons` ranks within a source, not across the list — so a source
	 * change is exactly a group boundary, and no sorting is needed to find one.
	 */
	private groupLabelFor(
		entry: IconEntry,
		previous: IconEntry | undefined,
	): string | undefined {
		if (!isAllSources(this.pack) || !entry.pack) return undefined;
		if (previous && previous.pack === entry.pack) return undefined;
		return t("iconPicker.sourceGroup", {
			name: t(this.packOf(entry).labelKey),
			count: String(this.groupCounts.get(entry.pack) ?? 0),
		});
	}

	// ── Download states ─────────────────────────────────────────────────

	/**
	 * One prompt for the source, however many files it is made of. The size is
	 * of what is actually missing, so someone who already has Font Awesome Solid
	 * is quoted the two remaining files rather than all three.
	 */
	private showDownloadPrompt(): void {
		this.setToolbarEnabled(false);
		const missing = this.missingPacks();
		const failed = missing.some(
			(id) => this.host.packs.state(id) === "failed",
		);
		const bytes = missing.reduce(
			(total, id) => total + (this.host.packs.info(id)?.bytes ?? 0),
			0,
		);
		// The index's own length, not the manifest's: one Font Awesome name
		// drawn in two styles is one icon to choose from, not two.
		const count = this.index?.entries.length ?? 0;

		this.grid?.showMessage((host) => {
			host.createDiv("icon-picker-notice-title").setText(
				failed
					? t("iconPack.downloadFailed", {
							name: this.pack.attribution.title,
						})
					: t("iconPack.downloadTitle", {
							name: this.pack.attribution.title,
						}),
			);
			if (count > 0 && bytes > 0) {
				host.createDiv("icon-picker-notice-detail").setText(
					t("iconPack.downloadDetail", {
						count: String(count),
						size: formatBytes(bytes),
					}),
				);
			}

			const btn = host.createEl("button", {
				text: failed ? t("iconPack.retry") : t("iconPack.download"),
				cls: "mod-cta",
			});
			btn.addEventListener("click", () => void this.startDownload());
		});
	}

	private async startDownload(): Promise<void> {
		this.setToolbarEnabled(false);
		this.grid?.showMessage((host) => {
			const row = host.createDiv("icon-picker-notice-loading");
			const spinner = row.createSpan({ cls: "callout-studio-spinner" });
			setIcon(spinner, "loader-2");
			row.createSpan({
				text: t("iconPack.downloading", {
					name: this.pack.attribution.title,
				}),
			});
		});

		// One at a time: three parallel requests to the same CDN gain nothing
		// and make a failure harder to attribute.
		for (const id of this.missingPacks()) {
			const ok = await this.host.packs.download(id);
			if (this.disposed) return;
			if (!ok) {
				this.showDownloadPrompt();
				return;
			}
		}
		await this.loadAndShow();
	}

	// ── Cells ───────────────────────────────────────────────────────────

	/** Grid tooltip; the pooled list names the source too. */
	private labelFor(entry: IconEntry): string {
		const base = entry.label ?? entry.name;
		if (!entry.pack) return base;
		return `${base} — ${t(this.packOf(entry).labelKey)}`;
	}

	/**
	 * Keyed on the entry's own source, not this panel's: in the pooled list a
	 * Material cell still needs the class that applies its webfont, and an emoji
	 * cell the one that sizes it. Without that, Material cells render their
	 * ligature name as plain text.
	 */
	private cellClass(entry: IconEntry): string | undefined {
		switch (this.packOf(entry).kind) {
			case "glyph":
				return "icon-picker-emoji-cell";
			case "perIconRemote":
				return "icon-picker-material-cell";
			case "local":
				// A picture keeps its own colours and its own proportions, so it
				// must not be sized or tinted like a monochrome glyph.
				return "icon-picker-image-cell";
			default:
				return undefined;
		}
	}

	/**
	 * The source an entry belongs to. Normally this panel's own, but the pooled
	 * "All sources" list carries entries from several, each of which knows how
	 * to draw and store its own icons.
	 */
	private packOf(entry: IconEntry): IconPack {
		if (!entry.pack) return this.pack;
		return getSource(entry.pack) ?? this.pack;
	}

	/**
	 * The Material style whose webfont this panel has to load.
	 *
	 * The pooled list has no style control of its own, so its own variant state
	 * is empty — its Material cells are drawn in Material's saved style, and it
	 * is that font, not the default one, that has to be fetched.
	 */
	private materialStyle(): MaterialIconStyle {
		const variants = isAllSources(this.pack)
			? this.host.variantsFor(materialPack.id)
			: this.variants;
		return variants.style ?? MATERIAL_DEFAULT_STYLE;
	}

	// ── Material's webfont ──────────────────────────────────────────────

	/**
	 * Whether this panel draws any cell from the Material webfont — its own
	 * source being Material, or the pooled list, which mixes Material cells in
	 * among everyone else's.
	 */
	private showsMaterialCells(): boolean {
		return this.pack.kind === "perIconRemote" || isAllSources(this.pack);
	}

	/**
	 * Load the webfont this panel's Material cells need, then say on screen how
	 * it went. A no-op for sources that draw no Material cells.
	 */
	private async syncMaterialFont(opts?: { force?: boolean }): Promise<void> {
		if (!this.showsMaterialCells()) return;
		await ensureMaterialFontLoaded(this.materialStyle(), {
			...opts,
			doc: this.bodyEl.ownerDocument,
		});
		if (this.disposed) return;
		this.refreshFontState();
	}

	/**
	 * Reflect whether Material's glyphs are drawable: a class the CSS uses to
	 * shrink the ligature names into something readable and clipped, and the
	 * notice offering a retry.
	 *
	 * Asks `document.fonts` rather than remembering what the last load returned.
	 * The font can arrive from another panel, another window, or the disk cache
	 * without this panel being told, and a remembered flag would then be stale
	 * in the one direction the user notices.
	 */
	private refreshFontState(): void {
		const ready =
			!this.showsMaterialCells() ||
			isMaterialFontReady(this.materialStyle(), this.bodyEl.ownerDocument);
		this.bodyEl.toggleClass("is-material-font-missing", !ready);
		this.fontNoticeEl?.toggleClass("is-hidden", ready);
	}

	/**
	 * The one notice the panel raises for itself rather than taking from the
	 * pack. Built up front and hidden, so the failure path never has to insert
	 * a node above a grid the user is already scrolling.
	 */
	private renderFontNotice(): void {
		if (!this.showsMaterialCells()) return;
		const el = this.bodyEl.createDiv("icon-picker-font-notice is-hidden");
		el.createSpan({ text: t("iconPicker.materialFontFailed") });
		const retry = el.createEl("button", {
			text: t("iconPicker.materialFontRetry"),
		});
		retry.addEventListener("click", () => {
			retry.disabled = true;
			// `force` skips the cooldown a failed family is otherwise held off
			// for: the press is the user saying the connection has changed.
			void this.syncMaterialFont({ force: true }).finally(() => {
				if (!this.disposed) retry.disabled = false;
			});
		});
		this.fontNoticeEl = el;
	}

	/** The toolbar values that apply to an entry's own source. */
	private variantsOf(entry: IconEntry): IconVariantState {
		const owner = this.packOf(entry);
		return owner.id === this.pack.id
			? this.variants
			: this.host.variantsFor(owner.id);
	}

	private renderCell(cell: HTMLElement, entry: IconEntry): void {
		const owner = this.packOf(entry);
		const variants = this.variantsOf(entry);

		// Material's artwork is fetched per icon, so nothing is local to draw
		// from. Its webfont renders those cells instead, by ligature name.
		if (owner.kind === "perIconRemote") {
			const span = cell.createSpan({ cls: "icon-picker-material-icon" });
			span.setText(entry.name);
			const style = variants.style ?? MATERIAL_DEFAULT_STYLE;
			span.setCssProps({
				"--cs-material-font": `"${materialFontFamily(style)}"`,
				"--cs-material-weight": String(variants.weight ?? 400),
			});
			if (style === "filled")
				span.setCssProps({ "--cs-material-fill": "1" });
			return;
		}

		renderIconInto(cell, owner.makeIcon(entry, variants), previewResolver, {
			role: "regular",
			fill: "currentColor",
			missing: { kind: "placeholder", lucideId: "circle-dashed" },
			errorText: "?",
		});
	}

	/**
	 * Compared against the icon this entry would produce, rather than against
	 * the source it belongs to: one source can own several icon types (Font
	 * Awesome's three styles), and only the produced icon says which one this
	 * cell is currently offering.
	 *
	 * Through `canonicalIconValue` because a stored Lucide value may be spelled
	 * bare (`constants.ts`, the Callout Manager importer) while this grid always
	 * produces the `getIconIds()` spelling. Field by field rather than
	 * `iconsEqual` on purpose: Material's weight is a live toolbar setting, not
	 * part of which cell the user picked, and folding it in would leave the grid
	 * with nothing highlighted every time the weight slider moved.
	 */
	private isSelected(entry: IconEntry): boolean {
		const selected = this.host.selectedIcon();
		if (!selected) return false;
		const owner = this.packOf(entry);
		const candidate = owner.makeIcon(entry, this.variantsOf(entry));
		return (
			candidate.type === selected.type &&
			canonicalIconValue(candidate) === canonicalIconValue(selected) &&
			candidate.style === selected.style
		);
	}

	private select(entry: IconEntry): void {
		const owner = this.packOf(entry);
		this.selectedEntry = entry;
		this.host.onSelect(
			owner.makeIcon(entry, this.variantsOf(entry)),
			entry,
		);
	}

	// ── Attribution ─────────────────────────────────────────────────────

	/**
	 * The credit line for this source, and any standing notice it carries.
	 *
	 * Font Awesome's icons are CC BY 4.0, which requires attribution wherever
	 * the work is used — this is that surface, alongside the settings credits.
	 */
	private renderAttribution(): void {
		const { attribution } = this.pack;
		// The pooled source credits nothing itself; each icon's own source is
		// credited on its own panel and in the settings credits section.
		if (attribution.licenses.length === 0) return;
		this.noticeEl = this.bodyEl.createDiv("icon-picker-pack-notice");
		this.updateNotice();
		const line = this.bodyEl.createDiv("icon-picker-pack-credit");
		const licenses = attribution.licenses.map((l) => l.spdx).join(", ");
		line.setText(`${attribution.title} — ${licenses}`);
		line.createEl("a", {
			text: attribution.homepage.replace(/^https?:\/\//, ""),
			href: attribution.homepage,
			attr: { target: "_blank", rel: "noopener" },
		});
	}

	/**
	 * A pack that scopes its notice to certain toolbar states decides here;
	 * everything else shows its standing notice, or none.
	 */
	private updateNotice(): void {
		const el = this.noticeEl;
		if (!el) return;
		const key = this.pack.pickerNotice
			? this.pack.pickerNotice(this.variants)
			: this.pack.attribution.noticeKey;
		el.setText(key ? t(key) : "");
		el.toggleClass("is-hidden", !key);
	}
}

function formatBytes(bytes: number): string {
	const kb = bytes / 1024;
	return kb >= 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${Math.round(kb)} KB`;
}
