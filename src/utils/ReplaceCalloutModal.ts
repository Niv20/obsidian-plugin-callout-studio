/**
 * utils/ReplaceCalloutModal.ts — Pick-a-replacement callout modal.
 *
 * Shown by a callout row's **Replace in vault…**. Renders a scrollable list of
 * the other callouts with icons and color swatches for easy scanning, and
 * returns the one chosen so the caller can run the vault-wide replacement.
 * Delete never comes here: it removes the definition and leaves the notes
 * alone (see settings/sections/calloutVaultActions.ts).
 */
import { Modal } from "obsidian";
import type { App } from "obsidian";
import type { CalloutDefinition } from "../types";
import type { CalloutRegistry } from "../manager/CalloutRegistry";
import { paintCalloutListIcon } from "../manager/theme/calloutListIcon";
import { getLocale, t } from "../i18n";
import { explainIfBlocked, paintBlocked } from "../ui/blockedButton";
import { filterCalloutList } from "./calloutSearch";
import { applyModalChrome } from "../settings/modalChrome";
import { autofocusOnDesktop } from "../settings/modalAutofocus";

export type ReplaceChoice =
	| { action: "replace"; replaceWith: string }
	| { action: "cancel" };

export interface ReplaceCalloutModalOptions {
	/** Window heading. Defaults to **Replace in vault**, which is what every
	 * current caller wants; an override is here for a caller whose wording
	 * needs to be more specific. */
	title?: string;
	/** Heading paragraph above the picker. */
	message: string;
	/** Optional override for the confirm-button label. */
	confirmLabel?: string;
	/** Selectable callouts (the source callout should already be filtered out). */
	availableCallouts: CalloutDefinition[];
	registry: CalloutRegistry;
}

/**
 * Modal shown when replacing a callout. Renders a scrollable list of
 * callouts (with icons + colors) for the user to choose from.
 * Closing without confirming cancels the operation.
 */
export class ReplaceCalloutModal extends Modal {
	private resolved = false;
	private resolve: (value: ReplaceChoice) => void = () => {};
	/** The callout chosen as the replacement; null until a row is picked. */
	private selectedId: string | null = null;
	private itemEls = new Map<string, HTMLElement>();
	private confirmBtn: HTMLButtonElement | null = null;
	private listEl?: HTMLElement;

	private title: string;
	private message: string;
	private confirmLabel?: string;
	private availableCallouts: CalloutDefinition[];
	private registry: CalloutRegistry;

	constructor(app: App, options: ReplaceCalloutModalOptions) {
		super(app);
		this.title = options.title ?? t("replaceModal.titleReplace");
		this.message = options.message;
		this.confirmLabel = options.confirmLabel;
		this.availableCallouts = options.availableCallouts;
		this.registry = options.registry;
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
			cls: "callout-studio-replace-search cs-text-control",
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
		// Keep search ready on desktop without raising the mobile keyboard on open.
		autofocusOnDesktop(search);

		// Single confirm button. It rewrites notes across the vault.
		const btnContainer = applyModalChrome(this, { footer: true });
		this.confirmBtn = btnContainer.createEl("button", {
			text: this.confirmLabel ?? t("vault.confirmReplace"),
			cls: "mod-warning",
		});
		// Dimmed until a row is chosen, but still pressable: pressing it says what to choose.
		paintBlocked(this.confirmBtn, this.confirmBlockedReason());
		this.confirmBtn.addEventListener("click", () => {
			if (explainIfBlocked(this.confirmBlockedReason()) || !this.selectedId) return;
			this.resolved = true;
			this.resolve({ action: "replace", replaceWith: this.selectedId });
			this.close();
		});
	}

	/**
	 * Draw the rows matching `query`.
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
	}

	/** Why confirming cannot act yet, or null: nothing is chosen until a row is picked. */
	private confirmBlockedReason(): string | null {
		return this.selectedId === null ? t("replaceModal.chooseFirstReplace") : null;
	}

	/** Arrow and Enter drive the list from the search field. */
	private onSearchKey(ev: KeyboardEvent): void {
		const ids = [...this.itemEls.keys()];
		if (ids.length === 0) return;
		const at = this.selectedId === null ? -1 : ids.indexOf(this.selectedId);
		const pick = (id: string | undefined): void => {
			if (id !== undefined) this.selectItem(id);
		};
		if (ev.key === "ArrowDown") {
			ev.preventDefault();
			pick(ids[Math.min(at + 1, ids.length - 1)]);
		} else if (ev.key === "ArrowUp") {
			ev.preventDefault();
			pick(ids[Math.max(at - 1, 0)]);
		} else if (ev.key === "Enter") {
			ev.preventDefault();
			// Enter chooses — the top row when nothing is chosen yet, the one
			// the query is most plausibly about — but never confirms. Confirming
			// rewrites every note that uses the callout (Undo is brief and in
			// memory only), so it takes the button itself, not a reflexive
			// keypress in a search field that opened focused.
			if (this.selectedId === null) pick(ids[0]);
		}
	}

	private selectItem(id: string): void {
		// Remove old selection
		for (const el of this.itemEls.values()) {
			el.removeClass("is-selected");
		}
		this.selectedId = id;
		const el = this.itemEls.get(id);
		if (el) el.addClass("is-selected");
		if (this.confirmBtn) paintBlocked(this.confirmBtn, this.confirmBlockedReason());

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

	prompt(): Promise<ReplaceChoice> {
		return new Promise<ReplaceChoice>((resolve) => {
			this.resolve = resolve;
			this.open();
		});
	}
}
