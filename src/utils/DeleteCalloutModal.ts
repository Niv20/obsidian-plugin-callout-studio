/**
 * utils/DeleteCalloutModal.ts — Confirmation modal for deleting a callout.
 *
 * Shown when the user clicks the trash icon on a callout row. If the callout is
 * used in vault files, it warns about the conversion to plain text and offers a
 * "Replace instead..." option. If unused, it shows a simpler delete-only
 * prompt. Returns a DeleteCalloutAction ('cancel' | 'delete' | 'replace') to
 * the caller in calloutVaultActions.
 *
 * ## `keepsRow` — saying what actually happens
 *
 * Some callouts cannot be deleted at all: one of Obsidian's thirteen built-ins
 * is re-seeded on every load, and a type the active theme declares is re-minted
 * by the next theme sweep. The action that runs for those clears the vault
 * usages and leaves the type in place — which is what it has always done, while
 * this window said "Delete" and nothing else, leaving the user to discover the
 * row was still there afterwards.
 *
 * `keepsRow` makes the window say it up front, and for a theme-supplied type it
 * also says the thing a user has every right to worry about: that nothing
 * belonging to the theme was read, changed or removed. Callout Studio never
 * writes outside the vault, and a button labelled Delete sitting on a row
 * headed *Callouts from your theme* has to be explicit about that.
 */
import { Modal } from "obsidian";
import type { App } from "obsidian";
import type { CalloutDefinition } from "../types";
import { t } from "../i18n";
import { applyModalChrome } from "../settings/modalChrome";

export type DeleteCalloutAction = "cancel" | "delete" | "replace";

export interface DeleteCalloutModalOptions {
	def: CalloutDefinition;
	/** Vault usage stats for the callout (and its aliases). `fileCount === 0`
	 * triggers the "no usage, custom callout" copy variant. */
	usage: { fileCount: number; totalCount: number };
	/**
	 * The definition survives — only its usages are cleared. Set for built-ins
	 * and for types the active theme declares; see the note above.
	 */
	keepsRow?: boolean;
	/** The active theme's name, when it is the reason the row survives. */
	themeName?: string | null;
}

/**
 * Confirmation popup for the trash button on the "My callout types" list.
 *
 * - When the callout is used in the vault: warns about the conversion to plain
 *   text, offers a "Replace instead…" pivot, and a red "Delete" button.
 * - When the callout has no usages (a sticky customized row): explains that
 *   nothing references it and offers a red "Delete" button only.
 *
 * The modal returns a {@link DeleteCalloutAction}. Closing the modal without
 * choosing an action resolves to `"cancel"`.
 */
export class DeleteCalloutModal extends Modal {
	private resolved = false;
	private resolve: (value: DeleteCalloutAction) => void = () => {};

	constructor(
		app: App,
		private options: DeleteCalloutModalOptions,
	) {
		super(app);
	}

	onOpen(): void {
		const { contentEl } = this;
		this.modalEl.addClass("callout-studio-delete-modal");

		const { def, usage, keepsRow, themeName } = this.options;
		const inUse = usage.fileCount > 0;

		this.setTitle(
			keepsRow === true
				? t("deleteModal.titleKeep", { name: def.displayName })
				: t("deleteModal.title", { name: def.displayName }),
		);

		if (inUse) {
			contentEl.createEl("p", {
				text: t("deleteModal.bodyInUse", {
					name: def.displayName,
					count: String(usage.totalCount),
					files: String(usage.fileCount),
				}),
			});
			contentEl.createEl("p", {
				text: t("deleteModal.bodyInUseExplain"),
				cls: "callout-studio-delete-modal-warning",
			});
			contentEl.createEl("p", {
				text: t("deleteModal.replaceHint"),
				cls: "callout-studio-delete-modal-hint",
			});
		} else if (keepsRow !== true) {
			contentEl.createEl("p", {
				text: t("deleteModal.bodyUnused", { name: def.displayName }),
			});
		}

		if (keepsRow === true) {
			contentEl.createEl("p", {
				text:
					themeName != null && themeName.length > 0
						? t("deleteModal.keepsRowTheme", { theme: themeName })
						: t("deleteModal.keepsRowBuiltIn"),
				cls: "callout-studio-delete-modal-hint",
			});
		}

		const btnContainer = applyModalChrome(this, { footer: true });

		const cancelBtn = btnContainer.createEl("button", {
			text: t("confirm.cancel"),
		});
		cancelBtn.addEventListener("click", () => {
			this.resolveWith("cancel");
		});

		if (inUse) {
			const replaceBtn = btnContainer.createEl("button", {
				text: t("deleteModal.replaceInstead"),
			});
			replaceBtn.addEventListener("click", () => {
				this.resolveWith("replace");
			});
		}

		const deleteBtn = btnContainer.createEl("button", {
			text: keepsRow === true
				? t("deleteModal.clearUsages")
				: inUse
					? t("deleteModal.deleteInUse")
					: t("deleteModal.deleteUnused"),
			cls: "mod-warning",
		});
		deleteBtn.addEventListener("click", () => {
			this.resolveWith("delete");
		});
	}

	private resolveWith(action: DeleteCalloutAction): void {
		if (this.resolved) return;
		this.resolved = true;
		this.resolve(action);
		this.close();
	}

	onClose(): void {
		if (!this.resolved) {
			this.resolved = true;
			this.resolve("cancel");
		}
		this.contentEl.empty();
	}

	prompt(): Promise<DeleteCalloutAction> {
		return new Promise<DeleteCalloutAction>((resolve) => {
			this.resolve = resolve;
			this.open();
		});
	}
}
