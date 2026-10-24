/**
 * utils/ConfirmModal.ts — the plugin's yes/no question.
 *
 * Who calls it. Every place that asks before doing something: deleting a
 * library or a palette, a vault-wide replacement, restoring a version, Reset
 * everything, and so on. A caller makes one, calls `confirm()`, and gets a
 * Promise<boolean>: true for yes, false for Cancel, Escape or the window
 * being closed.
 *
 * The main idea. It is Obsidian's own `ConfirmationModal` (1.13, finding
 * S9-06), the dialog Obsidian asks "Delete file?" with: a plain title, the
 * message, then Cancel and the confirm button at the end of the button bar.
 * With a keyboard, the confirm button has the focus when it opens, so Enter
 * confirms and Escape cancels. On a phone it rises as a sheet from the bottom
 * with the buttons stacked full-width. It used to be a window of the plugin's
 * own shell, with nothing focused and, on an iPhone, a centred card.
 *
 * `title` is required rather than optional on purpose. This window is generic —
 * only the caller knows what is being confirmed — so a default heading would be
 * vague ("Confirm") on every one of them, and an optional one would quietly let
 * the next caller ship a headerless dialog. Making it a parameter the compiler
 * insists on is what keeps "every window carries a title" true going forward.
 *
 * `confirmKind` is what the yes does. `"destructive"`, the default, is the red
 * a destructive action reads as (ui/destructiveButton.ts); `"cta"` is the
 * accent, for a yes that loses nothing.
 *
 * `acknowledgement` is for the few confirmations that cannot be taken back. It
 * puts a checkbox with that label in the button bar, where Obsidian puts
 * "Don't ask again" (finding S9-07), and keeps the confirm button locked until
 * it is ticked. Pressing the locked button shakes and reddens the label (see
 * `.cs-nudge`) and leaves the dialog open.
 */
import { ConfirmationModal } from "obsidian";
import type { App } from "obsidian";
import { t } from "../i18n";
import { markStackedWindow, scrollBodyOnly } from "../settings/modalChrome";

export type ConfirmKind = "destructive" | "cta";

export class ConfirmModal extends ConfirmationModal {
	/** True once a button has given the answer, so closing does not answer again. */
	private resolved = false;
	private resolve: (value: boolean) => void = () => {};
	/** The confirm button, once the bar is built. */
	private confirmEl: HTMLButtonElement | null = null;
	/** The acknowledgement's label in the bar, when there is one. */
	private acknowledgeEl: HTMLElement | null = null;
	/** Whether the acknowledgement is ticked (always true when none is asked). */
	private acknowledged = true;

	constructor(
		app: App,
		private title: string,
		private message: string | DocumentFragment,
		private confirmLabel?: string,
		private cancelLabel?: string,
		private confirmKind: ConfirmKind = "destructive",
		private acknowledgement?: string,
	) {
		super(app);
	}

	/** Ask, and resolve with the answer once the dialog closes. */
	confirm(): Promise<boolean> {
		return new Promise<boolean>((resolve) => {
			this.resolve = resolve;
			// Built before `open()`: Obsidian picks the button to focus as it opens.
			this.build();
			this.open();
		});
	}

	/** The title, the message, and the button bar. */
	private build(): void {
		this.setTitle(this.title);
		if (typeof this.message === "string") {
			// Each line of a plain message is a paragraph of its own.
			for (const line of this.message.split(/\n+/)) {
				this.contentEl.createEl("p", { text: line });
			}
		} else {
			this.contentEl.appendChild(this.message);
		}

		// The tick goes in first, so it sits at the start of the bar, before the
		// buttons, as Obsidian's "Don't ask again" does.
		if (this.acknowledgement) this.addAcknowledgement(this.acknowledgement);

		// Obsidian's Cancel just closes the dialog; closing answers false.
		this.addCancelButton(this.cancelLabel ?? t("confirm.cancel"));
		this.addButton((button) => {
			this.confirmEl = button.buttonEl;
			button.setButtonText(this.confirmLabel ?? t("confirm.ok")).setInitialFocus();
			if (this.confirmKind === "cta") button.setCta();
			else button.setDestructive().setCta();
			button.onClick(() => {
				// Returning true keeps the dialog open: Obsidian closes it after a
				// press only when the handler returns nothing (or false).
				if (!this.acknowledged) {
					this.nudge();
					return true;
				}
				this.resolved = true;
				this.resolve(true);
				return false;
			});
		});
		this.lock(!this.acknowledged);
	}

	/**
	 * Add the "I have read and understood" tick to the button bar, unticked;
	 * the confirm button stays locked until it is ticked.
	 */
	private addAcknowledgement(text: string): void {
		this.acknowledged = false;
		this.addCheckbox(text, (checked) => {
			this.acknowledged = checked;
			this.lock(!checked);
			this.acknowledgeEl?.removeClass("cs-nudge");
		});
		this.acknowledgeEl = this.buttonContainerEl.querySelector<HTMLElement>("label.mod-checkbox");
		this.acknowledgeEl?.addClass("cs-confirm-acknowledge");
		// Obsidian's tick is an optional preference, so it leaves the box out of
		// the Tab order; this one is a required gate, so Tab has to reach it.
		this.acknowledgeEl?.querySelector("input")?.setAttribute("tabindex", "0");
	}

	/**
	 * Lock or unlock the confirm button. `aria-disabled` rather than
	 * `disabled`: a disabled button swallows the press, and the press is what
	 * makes the label flash. Obsidian dims an aria-disabled button itself.
	 */
	private lock(locked: boolean): void {
		this.confirmEl?.setAttribute("aria-disabled", String(locked));
	}

	/** Flash the acknowledgement: the locked button was pressed. */
	private nudge(): void {
		const label = this.acknowledgeEl;
		if (!label) return;
		// Restart the animation if it is already running.
		label.removeClass("cs-nudge");
		void label.offsetWidth;
		label.addClass("cs-nudge");
	}

	onOpen(): void {
		// The dim behind a dialog asked over another window, on mobile.
		markStackedWindow(this);
		// A long message (Reset everything lists what goes) scrolls on its own,
		// under a title and a button bar that stay put.
		if (this.acknowledgement) scrollBodyOnly(this);
	}

	onClose(): void {
		// Obsidian's own clean-up for the dialog first.
		super.onClose();
		if (!this.resolved) this.resolve(false);
		this.contentEl.empty();
	}
}
