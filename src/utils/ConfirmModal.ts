/**
 * utils/ConfirmModal.ts — Generic yes/no confirmation dialog.
 *
 * A simple reusable modal that presents a message and two buttons (confirm /
 * cancel) and resolves a Promise<boolean>. Used throughout the settings
 * sections whenever a destructive action needs user confirmation before
 * proceeding (e.g. bulk vault edits, data reset).
 *
 * `title` is required rather than optional on purpose. This window is generic —
 * only the caller knows what is being confirmed — so a default heading would be
 * vague ("Confirm") on every one of them, and an optional one would quietly let
 * the next caller ship a headerless dialog. Making it a parameter the compiler
 * insists on is what keeps "every window carries a title" true going forward.
 *
 * `acknowledgement` is for the few confirmations that cannot be taken back: it
 * puts a checkbox carrying that label under the message and keeps the confirm
 * button disabled until it is ticked. Pressing the locked button shakes and
 * reddens the label (see `.cs-nudge`) and scrolls the body to its end, since a
 * long message pushes it off screen.
 */
import { Modal } from "obsidian";
import type { App } from "obsidian";
import { t } from "../i18n";
import { applyModalChrome } from "../settings/modalChrome";
import { prefersReducedMotion } from "../ui/flip";

export class ConfirmModal extends Modal {
	private resolved = false;
	private resolve: (value: boolean) => void = () => {};

	constructor(
		app: App,
		private title: string,
		private message: string | DocumentFragment,
		private confirmLabel?: string,
		private cancelLabel?: string,
		private confirmClass: string = "mod-warning",
		private acknowledgement?: string,
	) {
		super(app);
	}

	onOpen(): void {
		const { contentEl } = this;
		const btnContainer = applyModalChrome(this, { footer: true });
		this.setTitle(this.title);
		if (typeof this.message === "string") {
			const paragraphs = this.message.split(/\n+/);
			for (const p of paragraphs) {
				contentEl.createEl("p", { text: p });
			}
		} else {
			contentEl.appendChild(this.message);
		}

		btnContainer
			.createEl("button", {
				text: this.cancelLabel ?? t("confirm.cancel"),
			})
			.addEventListener("click", () => {
				this.resolved = true;
				this.resolve(false);
				this.close();
			});

		const confirmBtn = btnContainer.createEl("button", {
			text: this.confirmLabel ?? t("confirm.ok"),
			cls: this.confirmClass,
		});
		confirmBtn.addEventListener("click", () => {
			if (confirmBtn.getAttribute("aria-disabled") === "true") return;
			this.resolved = true;
			this.resolve(true);
			this.close();
		});

		if (this.acknowledgement) {
			const label = contentEl.createEl("label", { cls: "cs-confirm-acknowledge" });
			const checkbox = label.createEl("input", { type: "checkbox" });
			label.createSpan({ text: this.acknowledgement });
			// aria-disabled rather than `disabled`: a disabled button swallows
			// the click, and the click on it is what makes the label flash.
			const lock = (locked: boolean) => {
				confirmBtn.setAttribute("aria-disabled", String(locked));
				confirmBtn.toggleClass("cs-is-locked", locked);
			};
			lock(true);
			checkbox.addEventListener("change", () => {
				lock(!checkbox.checked);
				label.removeClass("cs-nudge");
			});
			confirmBtn.addEventListener("click", () => {
				if (checkbox.checked) return;
				// Restart the animation if it is already running.
				label.removeClass("cs-nudge");
				void label.offsetWidth;
				label.addClass("cs-nudge");
				// A long message scrolls, and the box is its last line: a flash
				// nobody can see explains nothing, so bring it into view. To the
				// very end of the body rather than `label.scrollIntoView()`, which
				// stops with the label's edge on the window's and leaves the body's
				// own bottom padding still to scroll.
				contentEl.scrollTo({
					top: contentEl.scrollHeight,
					behavior: prefersReducedMotion() ? "auto" : "smooth",
				});
			});
		}
	}

	onClose(): void {
		if (!this.resolved) {
			this.resolve(false);
		}
		this.contentEl.empty();
	}

	confirm(): Promise<boolean> {
		return new Promise<boolean>((resolve) => {
			this.resolve = resolve;
			this.open();
		});
	}
}
