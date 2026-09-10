/**
 * utils/ReplaceCalloutModal.ts — Pick-a-replacement callout modal.
 *
 * Shown in two scenarios: (1) during deletion when the callout is used in the
 * vault and the user chose "Replace instead...", and (2) via a direct "Replace"
 * action. Renders a scrollable list of available callouts with icons and color
 * swatches for easy scanning. Returns a DeleteAction to the caller so the
 * caller can execute the vault-wide replacement.
 */
import { Modal } from "obsidian";
import type { App } from "obsidian";
import type { CalloutDefinition } from "../types";
import type { CalloutRegistry } from "../manager/CalloutRegistry";
import { paintCalloutListIcon } from "../manager/theme/calloutListIcon";
import { getLocale, t } from "../i18n";
import { filterCalloutList } from "./calloutSearch";
import { applyModalChrome } from "../settings/modalChrome";
import { autofocusOnOpen } from "../settings/modalAutofocus";

export type DeleteAction =
	| { action: "replace"; replaceWith: string }
	| { action: "delete" }
	| { action: "cancel" };

export interface ReplaceCalloutModalOptions {
	/** "delete" preserves legacy behavior used by the trash flow (allows
	 * "delete without replacing" + warning copy). "replace" presents a pure
	 * replacement picker with no delete option. */
	mode?: "delete" | "replace";
	/** Window heading. Defaults to the one that matches `mode`, which is what
	 * every current caller wants; an override is here for a caller whose
	 * wording needs to be more specific than "delete" or "replace". */
	title?: string;
	/** Heading paragraph above the picker. */
	message: string;
	/** Optional override for the confirm-button label. */
	confirmLabel?: string;
	/** Selectable callouts (the source callout should already be filtered out). */
	availableCallouts: CalloutDefinition[];
	registry: CalloutRegistry;
	/** Force-disable the "delete without replacing" row. Ignored in `replace`
	 * mode (which never shows that row). */
	disallowDeleteWithoutReplace?: boolean;
}

/**
 * Modal shown when deleting or replacing a callout. Renders a scrollable
 * list of callouts (with icons + colors) for the user to choose from.
 * Closing without confirming cancels the operation.
 */
export class ReplaceCalloutModal extends Modal {
	private resolved = false;
	private resolve: (value: DeleteAction) => void = () => {};
	private selectedId: string | null | undefined = undefined;
	private itemEls = new Map<string | null, HTMLElement>();
	private confirmBtn: HTMLButtonElement | null = null;
	private listEl?: HTMLElement;

	private mode: "delete" | "replace";
	private title: string;
	private message: string;
	private confirmLabel?: string;
	private availableCallouts: CalloutDefinition[];
	private registry: CalloutRegistry;
	private disallowDeleteWithoutReplace: boolean;

	constructor(app: App, options: ReplaceCalloutModalOptions) {
		super(app);
		this.mode = options.mode ?? "delete";
		this.title =
			options.title ??
			t(
				this.mode === "replace"
					? "replaceModal.titleReplace"
					: "replaceModal.titleDelete",
			);
		this.message = options.message;
		this.confirmLabel = options.confirmLabel;
		this.availableCallouts = options.availableCallouts;
		this.registry = options.registry;
		this.disallowDeleteWithoutReplace =
			this.mode === "replace"
				? true
				: (options.disallowDeleteWithoutReplace ?? false);
	}

	onOpen(): void {
		const { contentEl } = this;
		this.modalEl.addClass("callout-studio-replace-modal");
		this.setTitle(this.title);

		contentEl.createEl("p", { text: this.message });

		contentEl.createEl("p", {
			text: t("vault.replaceWith"),
			cls: "callout-studio-replace-label",
		});

		// A vault with a few dozen callouts makes this list longer than the
		// window, and the user arrived here knowing which callout they want.
		// Matches ids and aliases as well as names, like every other callout
		// search in the plugin.
		const search = contentEl.createEl("input", {
			type: "text",
			cls: "callout-studio-replace-search",
			placeholder: t("replaceModal.searchPlaceholder"),
		});
		search.addEventListener("input", () => this.renderList(search.value));
		// Bound to the field, so typing and arrowing are one gesture — the same
		// arrangement the quick-insert window uses.
		search.addEventListener("keydown", (ev) => this.onSearchKey(ev));

		this.listEl = contentEl.createDiv({
			cls: "callout-studio-replace-list",
		});
		this.renderList("");
		// Typed into like the quick-insert window, and focused on the same terms:
		// every device, phone included. See modalAutofocus.
		autofocusOnOpen(search);

		// Single confirm button
		const btnContainer = applyModalChrome(this, { footer: true });
		const confirmText =
			this.confirmLabel ??
			(this.mode === "replace"
				? t("vault.confirmReplace")
				: t("vault.confirmDelete"));
		this.confirmBtn = btnContainer.createEl("button", {
			text: confirmText,
			cls: this.mode === "replace" ? "mod-cta" : "mod-warning",
		});
		this.confirmBtn.disabled = true;
		this.confirmBtn.addEventListener("click", () => {
			if (this.selectedId === undefined) return;
			this.resolved = true;
			if (this.selectedId) {
				this.resolve({
					action: "replace",
					replaceWith: this.selectedId,
				});
			} else {
				this.resolve({ action: "delete" });
			}
			this.close();
		});
	}

	/**
	 * Draw the rows matching `query`, plus the pinned delete row.
	 *
	 * The selection is *not* cleared by filtering. A row typed out of view is
	 * still the answer the user gave, and the confirm button stays live on it —
	 * clearing it would mean a stray keystroke silently disarmed the window.
	 */
	private renderList(query: string): void {
		const listEl = this.listEl;
		if (!listEl) return;
		listEl.empty();
		this.itemEls.clear();

		const matches = filterCalloutList(this.availableCallouts, {
			query,
			filter: "all",
			locale: getLocale(),
		});

		for (const def of matches) {
			const item = this.renderCalloutItem(listEl, def);
			this.itemEls.set(def.id, item);
			if (def.id === this.selectedId) {
				item.addClass("is-selected");
			}
			item.addEventListener("click", () => this.selectItem(def.id));
		}

		if (matches.length === 0) {
			listEl.createDiv({
				cls: "callout-studio-empty-state",
				text: t("calloutPicker.noMatches", { query }),
			});
		}

		// "Delete without replacing" — pinned, and never filtered. It is an
		// action rather than a callout, so a query that matches no callout must
		// not also take away the other thing this window is for.
		if (!this.disallowDeleteWithoutReplace) {
			const noReplaceItem = listEl.createDiv({
				cls: "callout-studio-replace-item callout-studio-replace-no-replace",
			});
			noReplaceItem.createDiv({
				cls: "callout-studio-replace-item-name callout-studio-replace-no-replace-name",
				text: `${t("vault.deleteWithout")} ${t("replaceModal.deleteWithoutReplaceSuffix")}`,
			});
			if (this.selectedId === null) noReplaceItem.addClass("is-selected");
			this.itemEls.set(null, noReplaceItem);
			noReplaceItem.addEventListener("click", () => this.selectItem(null));
		}
	}

	/** Arrow and Enter drive the list from the search field. */
	private onSearchKey(ev: KeyboardEvent): void {
		const ids = [...this.itemEls.keys()];
		if (ids.length === 0) return;
		const at = ids.indexOf(this.selectedId ?? null);
		if (ev.key === "ArrowDown") {
			ev.preventDefault();
			this.selectItem(ids[Math.min(at + 1, ids.length - 1)] ?? null);
		} else if (ev.key === "ArrowUp") {
			ev.preventDefault();
			this.selectItem(ids[Math.max(at - 1, 0)] ?? null);
		} else if (ev.key === "Enter") {
			ev.preventDefault();
			// With nothing chosen yet, Enter takes the top row — the one the
			// query is most plausibly about.
			if (this.selectedId === undefined) this.selectItem(ids[0] ?? null);
			this.confirmBtn?.click();
		}
	}

	private selectItem(id: string | null): void {
		// Remove old selection
		for (const el of this.itemEls.values()) {
			el.removeClass("is-selected");
		}
		this.selectedId = id;
		const el = this.itemEls.get(id);
		if (el) el.addClass("is-selected");
		if (this.confirmBtn) this.confirmBtn.disabled = false;

		// Scroll selected item into view
		el?.scrollIntoView({ block: "nearest" });
	}

	private renderCalloutItem(
		container: HTMLElement,
		def: CalloutDefinition,
	): HTMLElement {
		const item = container.createDiv({
			cls: "callout-studio-replace-item",
		});

		const isDark = activeDocument.body.classList.contains("theme-dark");

		// Icon and accent both come from whoever actually paints this callout —
		// the theme's own measured pair when the theme owns the id. This list is
		// how a user picks a replacement, so showing a colour the replacement
		// will not have is a bad answer to the only question being asked.
		const iconEl = item.createDiv({
			cls: "callout-studio-replace-item-icon",
		});
		const color = paintCalloutListIcon(iconEl, def, this.registry, isDark);
		iconEl.style.color = color;

		// Text: name + id
		const textEl = item.createDiv({
			cls: "callout-studio-replace-item-text",
		});
		const nameEl = textEl.createDiv({
			cls: "callout-studio-replace-item-name",
			text: def.displayName,
		});
		nameEl.style.color = color;
		textEl.createDiv({
			cls: "callout-studio-replace-item-id",
			text: def.id,
		});

		return item;
	}

	onClose(): void {
		if (!this.resolved) {
			this.resolve({ action: "cancel" });
		}
		this.contentEl.empty();
	}

	prompt(): Promise<DeleteAction> {
		return new Promise<DeleteAction>((resolve) => {
			this.resolve = resolve;
			this.open();
		});
	}
}
