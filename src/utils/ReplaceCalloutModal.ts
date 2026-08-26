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
import { t } from "../i18n";
import { applyModalChrome } from "../settings/modalChrome";

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

		// Scrollable list of callouts
		const listEl = contentEl.createDiv({
			cls: "callout-studio-replace-list",
		});

		for (const def of this.availableCallouts) {
			const item = this.renderCalloutItem(listEl, def);
			this.itemEls.set(def.id, item);
			if (def.id === this.selectedId) {
				item.addClass("is-selected");
			}
			item.addEventListener("click", () => this.selectItem(def.id));
		}

		// "Delete without replacing" option
		if (!this.disallowDeleteWithoutReplace) {
			const noReplaceItem = listEl.createDiv({
				cls: "callout-studio-replace-item callout-studio-replace-no-replace",
			});
			noReplaceItem.createDiv({
				cls: "callout-studio-replace-item-name callout-studio-replace-no-replace-name",
				text: `${t("vault.deleteWithout")} ${t("replaceModal.deleteWithoutReplaceSuffix")}`,
			});
			this.itemEls.set(null, noReplaceItem);
			noReplaceItem.addEventListener("click", () =>
				this.selectItem(null),
			);
		}

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
