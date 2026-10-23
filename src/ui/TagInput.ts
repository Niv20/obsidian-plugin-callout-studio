/**
 * ui/TagInput.ts — Reusable tag-input component for callout IDs and aliases.
 *
 * Renders a text input where pressing Enter (or clicking the + button) commits
 * the typed value as a tag. Spaces are allowed inside a tag, so they no
 * longer commit it. Tags appear in a row below the input as Obsidian's own
 * pills — the `multi-select-pill` the Properties panel draws for a list value:
 * an outline with round ends and a small x (finding S5-11). Like Obsidian's,
 * a pill can be reached with Tab and removed with Backspace. Supports
 * validation callbacks, readonly tags (built-in IDs cannot be removed), a
 * pinned tag (the name-linked primary ID: always rendered first, not
 * removable, replaced in place via setPinnedTag), and configurable max length
 * / max count from constants.ts.
 * Used by CalloutEditor for the unified IDs + aliases field.
 *
 * A refused tag stays in the field, so it can be corrected — or acted on: a
 * refusal may carry a way forward (the editor's "move it here" for an id
 * another callout has), drawn as a {@link TagMessage} renderer instead of a
 * plain string.
 *
 * Where messages appear (finding S5-V1). Errors go UNDER THE FIELD, where
 * Obsidian shows a rejected value (`Setting.setErrorMessage`, in its warning
 * colour, with no animation): the refusal of what is typed — which stays until
 * the typed text changes — and the lasting errors the editor sets ("At least
 * one ID is required"). Notes, which are not problems ("On save, "test"
 * moves here…"), go UNDER THE LABEL in the muted colour, as more description.
 */
import { Notice, setIcon } from "obsidian";
import { MAX_TAGS_COUNT } from "../constants";
import { sanitizeCalloutIdInput } from "../utils/calloutId";
import { t } from "../i18n";

/**
 * What a message line shows: plain words, or a renderer that fills the line
 * itself — for a sentence with a control in it.
 *
 * (A TypeScript "union": a value of this type is either a string or a
 * function, and code checks `typeof message === "string"` to tell which.)
 */
export type TagMessage = string | ((el: HTMLElement) => void);

/**
 * A tag-input component: type text, press Enter or click + to add a tag.
 * Tags are displayed in a separate row below the input field, each as an
 * Obsidian pill with an x to remove it (or a lock, for the pinned tag).
 */
export class TagInput {
	private wrapperEl: HTMLElement;
	private inputEl: HTMLInputElement;
	/** Overlay at the field's trailing edge; hosts the + and its text fade. */
	private addSlotEl: HTMLElement;
	private addBtnEl: HTMLButtonElement;
	/** Under the label: where a lasting note is drawn. */
	private noteEl: HTMLElement;
	/** Under the field: draws an error there, or clears it (`null`). */
	private showFieldError: (message: TagMessage | null) => void;
	/** What `showFieldError` last drew, so an unchanged message is not redrawn. */
	private shownFieldMessage: TagMessage | null = null;
	private tagsRowEl: HTMLElement;
	private tags: string[] = [];
	/** The name-linked primary ID: always first in `tags`, never removable. */
	private pinnedTag: string | null = null;
	private onChange: (tags: string[]) => void;
	private onTagAdded?: (tag: string) => void;
	private onInput?: (value: string) => void;
	private validate?: (tag: string) => TagMessage | null;
	/** Optional per-tag character cap. When undefined, IDs are unlimited. */
	private maxLength: number | undefined;
	private maxTags: number;
	private placeholder: string;
	private readonlyTags: Set<string>;
	/** The lasting message, and whether it is a note rather than an error. */
	private lasting: { message: TagMessage; note: boolean } | null = null;
	/** Why the typed text was refused, in plain words; gone when the text changes. */
	private typedError: string | null = null;
	/** A refusal with a way forward, shown over `lasting` until the input changes. */
	private offer: TagMessage | null = null;
	/** The tag the offer is about. */
	private offerFor: string | null = null;

	constructor(
		parentEl: HTMLElement,
		opts: {
			initialTags?: string[];
			/** Tag pinned to the first slot (the name-linked primary ID). */
			initialPinnedTag?: string;
			placeholder?: string;
			onChange: (tags: string[]) => void;
			/** Fired after the user commits a new tag (not on programmatic changes). */
			onTagAdded?: (tag: string) => void;
			/** Fired on every keystroke in the input field, with the raw value. */
			onInput?: (value: string) => void;
			/**
			 * Null if ok. A string is an error that fades; a renderer is an offer
			 * that stays until the typed text changes — see {@link TagMessage}.
			 */
			validate?: (tag: string) => TagMessage | null;
			/** Max characters per tag */
			maxLength?: number;
			/** Max number of tags */
			maxTags?: number;
			/**
			 * Where lasting notes go — the caller places it, e.g. in the setting's
			 * description, under the label. Without one, the field makes its own.
			 */
			noteEl?: HTMLElement;
			/**
			 * Draws an error under the field, or clears it on `null`. The editor
			 * passes its row's `setErrorMessage` (see `ui/settingError.ts`).
			 * Without one, the field draws Obsidian's error line itself, under
			 * the pills.
			 */
			showFieldError?: (message: TagMessage | null) => void;
			/** Tags that cannot be removed (no × button rendered) */
			readonlyTags?: string[];
		},
	) {
		this.tags = [...(opts.initialTags ?? [])];
		this.pinnedTag = opts.initialPinnedTag ?? null;
		if (this.pinnedTag) {
			// Keep the pinned tag present and first regardless of input order.
			this.tags = [
				this.pinnedTag,
				...this.tags.filter((t) => t !== this.pinnedTag),
			];
		}
		this.onChange = opts.onChange;
		this.onTagAdded = opts.onTagAdded;
		this.onInput = opts.onInput;
		this.validate = opts.validate;
		this.maxLength = opts.maxLength;
		this.maxTags = opts.maxTags ?? MAX_TAGS_COUNT;
		this.placeholder = opts.placeholder ?? "";
		this.readonlyTags = new Set(opts.readonlyTags ?? []);

		// Wrapper: input row → tags row
		this.wrapperEl = parentEl.createDiv({ cls: "cs-tag-wrapper" });

		// Input row: text field + explicit Add button (Space no longer commits,
		// so the button gives a discoverable way to add a tag besides Enter).
		const inputRow = this.wrapperEl.createDiv({ cls: "cs-tag-input-row" });

		// Input field
		this.inputEl = inputRow.createEl("input", {
			type: "text",
			cls: "cs-tag-input-field cs-text-control",
			placeholder: this.placeholder,
			attr:
				this.maxLength !== undefined
					? { maxlength: String(this.maxLength) }
					: {},
		});

		// Add button. It does not sit beside the field taking a slice of the
		// row's width — it overlays the field's trailing edge and only appears
		// once there is something to commit, so an empty field is the full
		// width of the row. The slot is the piece that overlays; the field
		// reserves matching trailing padding so text never runs under it
		// (see styles.css).
		this.addSlotEl = inputRow.createDiv({ cls: "cs-tag-add-slot" });
		this.addBtnEl = this.addSlotEl.createEl("button", {
			cls: "cs-tag-add-btn",
			attr: { type: "button", "aria-label": t("editor.addId") },
		});
		setIcon(this.addBtnEl, "plus");
		// Keep focus in the field on click. Without this the mousedown blurs the
		// input, `blur` commits the tag and empties the value, and syncAddButton
		// pulls the button out from under the pointer before the click lands —
		// so the click handler's focus-restore never runs.
		this.addBtnEl.addEventListener("mousedown", (e) => {
			e.preventDefault();
		});
		this.addBtnEl.addEventListener("click", (e) => {
			e.preventDefault();
			this.commitInput();
			this.inputEl.focus();
		});

		// Tags row (below input)
		this.tagsRowEl = this.wrapperEl.createDiv({ cls: "cs-tag-row" });

		// The two message places (see the module comment).
		this.noteEl = opts.noteEl ?? this.wrapperEl.createDiv();
		this.noteEl.addClass("cs-tag-note");
		this.showFieldError =
			opts.showFieldError ?? this.ownFieldErrorLine(this.wrapperEl);

		// Render existing tags
		for (const tag of this.tags) {
			this.renderTag(tag);
		}

		// Update disabled state based on initial tags
		this.updateInputState();

		this.inputEl.addEventListener("keydown", (e) => {
			// Space is intentionally NOT a commit key — IDs may contain spaces.
			if (e.key === "Enter" || e.key === ",") {
				e.preventDefault();
				this.commitInput();
			} else if (
				e.key === "Backspace" &&
				this.inputEl.value === "" &&
				this.tags.length > 0
			) {
				// Backspace in an empty field steps onto the last pill, as in
				// Obsidian's multi-select; a second Backspace removes it.
				e.preventDefault();
				this.focusPill(this.tags.length - 1);
			}
		});

		this.inputEl.addEventListener("input", () => {
			// A refusal — an offer or plain words — was about the text that was
			// typed; that text is gone.
			this.offer = null;
			this.offerFor = null;
			this.typedError = null;
			this.syncAddButton();
			this.onInput?.(this.inputEl.value);
			// Say so at once when the typing reaches the cap (if one is set).
			const cap = this.maxLength;
			if (cap !== undefined && this.inputEl.value.length >= cap) {
				this.typedError = t("editor.idTooLong", { max: cap });
			}
			this.paintMessages();
		});

		this.inputEl.addEventListener("blur", () => {
			this.commitInput();
		});

		// Handle paste with multiple comma/newline separated values. Spaces are
		// kept (IDs may contain them) — only commas and line breaks split tags.
		this.inputEl.addEventListener("paste", (e) => {
			e.preventDefault();
			const text = e.clipboardData?.getData("text") ?? "";
			const parts = text
				.split(/[,\n\r]+/)
				.map((p) => p.trim())
				.filter(Boolean);
			for (const part of parts) {
				this.addTag(part);
			}
		});
	}

	/**
	 * Show the + only when it has something to do: text typed, and room left
	 * for another tag. Both halves matter — a visible-but-disabled button would
	 * still paint its opaque end-cap over the field for no reason.
	 */
	private syncAddButton(): void {
		const canAdd =
			this.inputEl.value.trim() !== "" && !this.addBtnEl.disabled;
		this.addSlotEl.toggleClass("is-visible", canAdd);
	}

	private updateInputState(): void {
		if (this.tags.length >= this.maxTags) {
			this.inputEl.disabled = true;
			this.addBtnEl.disabled = true;
			this.inputEl.placeholder = "";
			this.showPersistentError(t("editor.maxIds", { max: this.maxTags }));
		} else {
			this.inputEl.disabled = false;
			this.addBtnEl.disabled = false;
			this.inputEl.placeholder = this.placeholder;
			this.clearPersistentError();
		}
		this.syncAddButton();
	}

	/**
	 * The default for `showFieldError`: Obsidian's own error line
	 * (`div.setting-item-error`, which app.css paints in the warning colour),
	 * made inside `parent` and shown only while it has something to say.
	 */
	private ownFieldErrorLine(parent: HTMLElement): (message: TagMessage | null) => void {
		const lineEl = parent.createDiv({ cls: "setting-item-error" });
		return (message) => {
			lineEl.empty();
			if (typeof message === "string") lineEl.setText(message);
			else if (message) message(lineEl);
		};
	}

	/**
	 * Draw both message places from the current state. Every change to a
	 * message ends here, so the two places can never disagree with the state.
	 *
	 * Under the field, one message, in this order: an offer (a refusal with a
	 * way forward), a lasting error, then the plain refusal of what is typed.
	 * Under the label, the lasting note, if any.
	 */
	private paintMessages(): void {
		const lastingError = this.lasting && !this.lasting.note ? this.lasting.message : null;
		const fieldMessage = this.offer ?? lastingError ?? this.typedError;
		// Redrawing an unchanged offer would swap its button for a new one
		// under a tap that is still landing, so only a change is drawn.
		if (fieldMessage !== this.shownFieldMessage) {
			this.shownFieldMessage = fieldMessage;
			this.showFieldError(fieldMessage);
		}

		const note = this.lasting?.note ? this.lasting.message : null;
		this.noteEl.empty();
		if (typeof note === "string") this.noteEl.setText(note);
		else if (note) note(this.noteEl);
	}

	/** Set the lasting message (an error, or a note) and redraw. */
	private showPersistentError(msg: TagMessage, note = false): void {
		this.lasting = { message: msg, note };
		this.paintMessages();
	}

	/** Clear the lasting message and redraw. */
	private clearPersistentError(): void {
		this.lasting = null;
		this.paintMessages();
	}

	/**
	 * Show `message` as the offer about `tag`. The same tag committed again —
	 * a blur does that — keeps the offer already drawn: redrawing it would swap
	 * its button for a new one under a tap that is still landing.
	 */
	private showOffer(tag: string, message: TagMessage): void {
		if (this.offer && this.offerFor === tag) return;
		this.offer = message;
		this.offerFor = tag;
		this.typedError = null;
		this.paintMessages();
	}

	/**
	 * Refuse the typed text with `message`, in plain words. It stays under the
	 * field until the text changes — the text stays too, so it can be fixed.
	 */
	private refuseTyped(message: string): void {
		this.offer = null;
		this.offerFor = null;
		this.typedError = message;
		this.paintMessages();
	}

	/** Forget any refusal of the typed text (it was accepted, or replaced). */
	private clearRefusal(): void {
		this.offer = null;
		this.offerFor = null;
		this.typedError = null;
	}

	private commitInput(): void {
		const raw = this.inputEl.value.trim();
		if (!raw) return;
		// A refused id stays where it was typed, so it can be corrected — or
		// moved here — rather than typed again from memory.
		if (this.addTag(raw) === "refused") return;
		this.inputEl.value = "";
		this.syncAddButton();
	}

	/**
	 * `"refused"` when the user is told why, so the typed text is kept;
	 * `"ignored"` when there was nothing to add (no room, or nothing left once
	 * sanitized).
	 */
	private addTag(raw: string): "added" | "refused" | "ignored" {
		if (this.tags.length >= this.maxTags) return "ignored";

		const tag = sanitizeCalloutIdInput(raw);
		if (!tag) return "ignored";

		// Check max length (only when a cap is configured)
		if (this.maxLength !== undefined && tag.length > this.maxLength) {
			this.refuseTyped(t("editor.idTooLong", { max: this.maxLength }));
			return "refused";
		}

		// Check duplicate within current tags
		if (this.tags.includes(tag)) {
			this.refuseTyped(t("editor.idAlreadyHere"));
			return "refused";
		}

		// External validation (e.g. check registry)
		const refusal = this.validate?.(tag) ?? null;
		if (refusal !== null) {
			if (typeof refusal === "string") this.refuseTyped(refusal);
			else this.showOffer(tag, refusal);
			return "refused";
		}
		// Accepted: whatever was said about earlier typing no longer applies.
		this.clearRefusal();
		this.insertTag(tag);
		return "added";
	}

	private insertTag(tag: string): void {
		this.tags.push(tag);
		this.renderTag(tag);
		// Input state first — it clears a lasting message below the cap — and
		// only then the parent, so a message the parent sets in onChange (the
		// editor's "On save, … moves here") survives. removeTag does the same.
		this.updateInputState();
		this.onChange([...this.tags]);
		this.onTagAdded?.(tag);
	}

	/**
	 * Add `tag` without asking `validate` — the caller has already decided,
	 * as the editor does when the user chooses to move an id here. The typed
	 * text and any offer about it are cleared, as after an ordinary add.
	 */
	addTagUnchecked(tag: string): void {
		if (this.tags.length >= this.maxTags || this.tags.includes(tag)) return;
		this.inputEl.value = "";
		this.syncAddButton();
		this.clearRefusal();
		this.insertTag(tag);
	}

	/** Remove `tag`, unless it is readonly or pinned. Returns whether it went. */
	private removeTag(tag: string): boolean {
		if (this.readonlyTags.has(tag)) return false;
		if (tag === this.pinnedTag) return false;
		const idx = this.tags.indexOf(tag);
		if (idx === -1) return false;
		this.tags.splice(idx, 1);
		const tagEl = this.tagsRowEl.querySelector(
			`[data-tag="${CSS.escape(tag)}"]`,
		);
		tagEl?.remove();
		// Update input state first (clears max-tags error), then notify parent
		// so parent's external errors (e.g. "at least one ID") survive.
		this.updateInputState();
		this.onChange([...this.tags]);
		return true;
	}

	/**
	 * Draw one tag as Obsidian's pill (`multi-select-pill`, the one Properties
	 * uses for a list value), in the DOM Obsidian builds for it:
	 *
	 *   div.multi-select-pill [tabindex=0]
	 *     div.multi-select-pill-content   (the ID)
	 *     div.multi-select-pill-remove-button   (x, or the pinned tag's lock)
	 *
	 * app.css then draws the outline, the round ends, the muted text, the x
	 * that turns accent on hover and the focus ring. The `cs-tag-chip*` classes
	 * stay on as hooks for tests and the screenshot scripts.
	 */
	private renderTag(tag: string): void {
		const isPinned = tag === this.pinnedTag;
		const isReadonly = !isPinned && this.readonlyTags.has(tag);

		const pillEl = this.tagsRowEl.createDiv({
			cls: "multi-select-pill cs-tag-chip",
			// tabindex 0: every pill is a Tab stop, as in Obsidian, so the
			// keyboard can reach it and remove it (see `onPillKeydown`).
			attr: { tabindex: "0", "data-tag": tag },
		});
		// Long IDs are truncated with an ellipsis in CSS; the full value is
		// shown on hover. As an aria-label, never a `title` — that draws the OS
		// tooltip, which stacks with Obsidian's and is inherited by the x inside.
		// The pinned pill says instead why it has a lock.
		pillEl.setAttribute(
			"aria-label",
			isPinned ? t("editor.idLinkedToName") : tag,
		);
		if (isPinned) pillEl.addClass("is-pinned");
		if (isReadonly) pillEl.addClass("is-readonly");

		pillEl
			.createDiv({ cls: "multi-select-pill-content" })
			.createSpan({ cls: "cs-tag-chip-text", text: tag });

		if (isPinned) {
			// The name-linked primary: the x is replaced by a lock in the same
			// slot. Clicking it explains why the ID can't be removed.
			const lockEl = pillEl.createDiv({
				cls: "multi-select-pill-remove-button cs-tag-chip-lock",
			});
			setIcon(lockEl, "lock");
			lockEl.addEventListener("click", (e) => {
				e.stopPropagation();
				this.explainPinned();
			});
		} else if (!isReadonly) {
			// A built-in's own IDs (readonly) get no x at all.
			const removeEl = pillEl.createDiv({
				cls: "multi-select-pill-remove-button cs-tag-chip-remove",
				attr: { "aria-hidden": "true" },
			});
			setIcon(removeEl, "x");
			// As in Obsidian: pressing the x must not move focus onto the pill
			// first — the pill is about to go, and focus would go with it.
			removeEl.addEventListener("mousedown", (e) => e.preventDefault());
			removeEl.addEventListener("click", (e) => {
				e.stopPropagation();
				this.removeTag(tag);
			});
		}

		pillEl.addEventListener("keydown", (e) => this.onPillKeydown(e, tag));
	}

	/** The Notice a press on the pinned pill's lock (or Backspace on it) shows. */
	private explainPinned(): void {
		new Notice(t("editor.idCannotDelete"));
	}

	/**
	 * The keys of a focused pill, which are Obsidian's for its multi-select:
	 *
	 * - Backspace (or Delete) removes the pill and moves focus to the one
	 *   before it, or back to the field when none is left. The pinned pill
	 *   says why it can't go; a built-in's own IDs do nothing, as they have no x.
	 * - ← and → move to the neighbouring pill, in reading order: in a
	 *   right-to-left language → goes to the previous one. Past the last pill
	 *   focus returns to the field.
	 * - ↑ jumps to the first pill; ↓ and Escape return to the field.
	 */
	private onPillKeydown(event: KeyboardEvent, tag: string): void {
		const index = this.tags.indexOf(tag);
		if (index === -1) return;
		switch (event.key) {
			case "Backspace":
			case "Delete": {
				event.preventDefault();
				if (tag === this.pinnedTag) {
					this.explainPinned();
					return;
				}
				if (this.removeTag(tag)) this.focusPill(Math.max(0, index - 1));
				return;
			}
			case "ArrowLeft":
			case "ArrowRight": {
				event.preventDefault();
				// `getComputedStyle` is optional-chained because the test DOM may
				// not have it; a missing answer means left-to-right.
				const view = this.tagsRowEl.ownerDocument.defaultView;
				const rightToLeft =
					view?.getComputedStyle?.(this.tagsRowEl).direction === "rtl";
				const forward = (event.key === "ArrowRight") !== rightToLeft;
				this.focusPill(forward ? index + 1 : index - 1);
				return;
			}
			case "ArrowUp":
				event.preventDefault();
				this.focusPill(0);
				return;
			case "ArrowDown":
			case "Escape":
				event.preventDefault();
				this.inputEl.focus();
				return;
		}
	}

	/**
	 * Focus the pill at `index` (clamped at 0). An index past the last pill,
	 * or no pill at all, focuses the field instead — Obsidian's `focusElement`.
	 */
	private focusPill(index: number): void {
		const pills = this.tagsRowEl.querySelectorAll<HTMLElement>(".cs-tag-chip");
		const pill = pills[Math.max(0, index)];
		if (pill) pill.focus();
		else this.inputEl.focus();
	}

	getTags(): string[] {
		return [...this.tags];
	}

	getPinnedTag(): string | null {
		return this.pinnedTag;
	}

	/**
	 * Replace the pinned (name-linked) tag in place, leaving all other tags
	 * untouched. `null` removes the pinned slot only. If the new value already
	 * exists as a regular tag it is promoted (deduped) rather than duplicated.
	 * Does not fire onChange — mirrors the setTags contract.
	 */
	setPinnedTag(tag: string | null): void {
		if (tag === this.pinnedTag) return;
		const old = this.pinnedTag;
		this.pinnedTag = tag;
		const rest = this.tags.filter((t) => t !== old && t !== tag);
		this.tags = tag ? [tag, ...rest] : rest;
		this.rerenderTags();
		this.updateInputState();
	}

	setTags(tags: string[]): void {
		this.tags = [...tags];
		if (this.pinnedTag) {
			// Preserve the pinned-first invariant; a pinned tag absent from the
			// new list is no longer pinned.
			if (this.tags.includes(this.pinnedTag)) {
				this.tags = [
					this.pinnedTag,
					...this.tags.filter((t) => t !== this.pinnedTag),
				];
			} else {
				this.pinnedTag = null;
			}
		}
		this.rerenderTags();
		this.updateInputState();
	}

	private rerenderTags(): void {
		this.tagsRowEl
			.querySelectorAll(".cs-tag-chip")
			.forEach((el) => el.remove());
		for (const tag of this.tags) {
			this.renderTag(tag);
		}
	}

	/** Show an error from external code (e.g. "At least one ID is required") */
	showExternalError(msg: TagMessage): void {
		this.showPersistentError(msg);
	}

	/**
	 * Show a lasting note from external code — not a problem, something worth
	 * knowing ("On save, "test" moves here…"). Drawn in the muted colour.
	 */
	showExternalNote(msg: TagMessage): void {
		this.showPersistentError(msg, true);
	}

	/** Clear an externally-set error or note. */
	clearExternalError(): void {
		if (!this.lasting) return;
		this.lasting = null;
		// Re-check input state (max tags might need its own lasting error);
		// it redraws the messages either way.
		this.updateInputState();
	}
}
