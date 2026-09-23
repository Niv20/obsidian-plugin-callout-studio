/**
 * ui/TagInput.ts — Reusable tag-input component for callout IDs and aliases.
 *
 * Renders a text input where pressing Enter (or clicking the + button) commits
 * the typed value as a pill/tag. Spaces are allowed inside a tag, so they no
 * longer commit it. Tags appear in a row below the input with an × remove
 * button. Supports validation callbacks, readonly tags (built-in IDs cannot
 * be removed), a pinned tag (the name-linked primary ID: always rendered
 * first, not removable, replaced in place via setPinnedTag), and configurable
 * max length / max count from constants.ts.
 * Used by CalloutEditor for the unified IDs + aliases field.
 */
import { Notice, setIcon } from "obsidian";
import { MAX_TAGS_COUNT } from "../constants";
import { sanitizeCalloutIdInput } from "../utils/calloutId";
import { t } from "../i18n";

/**
 * A tag-input component: type text, press Enter or click + to add a tag.
 * Tags are displayed in a separate row below the input field.
 * Each tag has an × button to remove it.
 */
export class TagInput {
	private wrapperEl: HTMLElement;
	private inputEl: HTMLInputElement;
	/** Overlay at the field's trailing edge; hosts the + and its text fade. */
	private addSlotEl: HTMLElement;
	private addBtnEl: HTMLButtonElement;
	private errorEl: HTMLElement;
	private tagsRowEl: HTMLElement;
	private tags: string[] = [];
	/** The name-linked primary ID: always first in `tags`, never removable. */
	private pinnedTag: string | null = null;
	private onChange: (tags: string[]) => void;
	private onTagAdded?: (tag: string) => void;
	private onInput?: (value: string) => void;
	private validate?: (tag: string) => string | null;
	/** Optional per-tag character cap. When undefined, IDs are unlimited. */
	private maxLength: number | undefined;
	private maxTags: number;
	private errorTimeout: number | null = null;
	private placeholder: string;
	private readonlyTags: Set<string>;

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
			/** Return an error string if invalid, or null if ok */
			validate?: (tag: string) => string | null;
			/** Max characters per tag */
			maxLength?: number;
			/** Max number of tags */
			maxTags?: number;
			/** External error element (placed by caller, e.g. in the description column) */
			errorEl?: HTMLElement;
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

		// Error element — use external one if provided, otherwise create inline
		if (opts.errorEl) {
			this.errorEl = opts.errorEl;
			this.errorEl.addClass("cs-tag-error");
		} else {
			this.errorEl = this.wrapperEl.createDiv({ cls: "cs-tag-error" });
		}

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
			}
		});

		// Show error when user tries to type past maxLength (if a cap is set)
		this.inputEl.addEventListener("input", () => {
			this.syncAddButton();
			this.onInput?.(this.inputEl.value);
			const cap = this.maxLength;
			if (cap !== undefined && this.inputEl.value.length >= cap) {
				this.showError(`ID must be ${cap} characters or less`);
			}
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
			this.showPersistentError(
				`Maximum ${this.maxTags} IDs. Delete one to add another.`,
			);
		} else {
			this.inputEl.disabled = false;
			this.addBtnEl.disabled = false;
			this.inputEl.placeholder = this.placeholder;
			this.clearPersistentError();
		}
		this.syncAddButton();
	}

	private showPersistentError(msg: string): void {
		if (this.errorTimeout) {
			window.clearTimeout(this.errorTimeout);
			this.errorTimeout = null;
		}
		this.errorEl.textContent = msg;
		this.errorEl.addClass("is-visible");
		this.errorEl.addClass("is-persistent");
	}

	private clearPersistentError(): void {
		if (this.errorEl.hasClass("is-persistent")) {
			this.errorEl.removeClass("is-visible");
			this.errorEl.removeClass("is-persistent");
			// Clear text after CSS fade-out transition completes
			window.setTimeout(() => {
				if (!this.errorEl.hasClass("is-visible")) {
					this.errorEl.textContent = "";
				}
			}, 300);
		}
	}

	private commitInput(): void {
		const raw = this.inputEl.value.trim();
		if (!raw) return;
		this.addTag(raw);
		this.inputEl.value = "";
		this.syncAddButton();
	}

	private showError(msg: string): void {
		if (this.errorEl.hasClass("is-persistent")) return;
		if (this.errorTimeout) window.clearTimeout(this.errorTimeout);
		this.errorEl.textContent = msg;
		this.errorEl.addClass("is-visible");
		this.errorTimeout = window.setTimeout(() => {
			this.errorEl.removeClass("is-visible");
			this.errorTimeout = null;
		}, 2500);
	}

	private addTag(raw: string): void {
		if (this.tags.length >= this.maxTags) return;

		const tag = sanitizeCalloutIdInput(raw);
		if (!tag) return;

		// Check max length (only when a cap is configured)
		if (this.maxLength !== undefined && tag.length > this.maxLength) {
			this.showError(`ID must be ${this.maxLength} characters or less`);
			return;
		}

		// Check duplicate within current tags
		if (this.tags.includes(tag)) {
			this.showError("This ID already exists");
			return;
		}

		// External validation (e.g. check registry)
		if (this.validate) {
			const err = this.validate(tag);
			if (err) {
				this.showError(err);
				return;
			}
		}
		this.tags.push(tag);
		this.renderTag(tag);
		this.onChange([...this.tags]);
		this.updateInputState();
		this.onTagAdded?.(tag);
	}

	private removeTag(tag: string): void {
		if (this.readonlyTags.has(tag)) return;
		if (tag === this.pinnedTag) return;
		const idx = this.tags.indexOf(tag);
		if (idx === -1) return;
		this.tags.splice(idx, 1);
		const tagEl = this.tagsRowEl.querySelector(
			`[data-tag="${CSS.escape(tag)}"]`,
		);
		tagEl?.remove();
		// Update input state first (clears max-tags error), then notify parent
		// so parent's external errors (e.g. "at least one ID") survive.
		this.updateInputState();
		this.onChange([...this.tags]);
	}

	private renderTag(tag: string): void {
		const tagEl = this.tagsRowEl.createDiv({ cls: "cs-tag-chip" });
		tagEl.setAttribute("data-tag", tag);

		const isPinned = tag === this.pinnedTag;
		if (isPinned) {
			// The name-linked primary: identical chip to any other, but the ×
			// affordance is replaced by a lock sitting in the same slot. Clicking
			// it explains why the ID can't be removed.
			tagEl.addClass("is-pinned");
			tagEl.setAttribute("aria-label", t("editor.idLinkedToName"));
			tagEl.createSpan({ cls: "cs-tag-chip-text", text: tag });
			const lockEl = tagEl.createSpan({
				cls: "cs-tag-chip-remove cs-tag-chip-lock",
			});
			setIcon(lockEl, "lock");
			lockEl.addEventListener("click", (e) => {
				e.stopPropagation();
				new Notice(t("editor.idCannotDelete"));
			});
			return;
		}

		// Long IDs are truncated with an ellipsis in CSS; the full value is
		// shown on hover. As an aria-label, never a `title` — that draws the OS
		// tooltip, which stacks with Obsidian's and is inherited by the × inside.
		tagEl.setAttribute("aria-label", tag);

		const isReadonly = this.readonlyTags.has(tag);
		if (isReadonly) tagEl.addClass("is-readonly");

		tagEl.createSpan({ cls: "cs-tag-chip-text", text: tag });

		if (isReadonly) return;

		const removeBtn = tagEl.createSpan({ cls: "cs-tag-chip-remove" });
		removeBtn.textContent = "×";
		removeBtn.addEventListener("click", (e) => {
			e.stopPropagation();
			this.removeTag(tag);
		});
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
	showExternalError(msg: string): void {
		this.showPersistentError(msg);
	}

	/** Clear an externally-set error */
	clearExternalError(): void {
		if (this.errorEl.hasClass("is-persistent")) {
			this.errorEl.removeClass("is-visible");
			this.errorEl.removeClass("is-persistent");
			this.errorEl.textContent = "";
			// Re-check input state (max tags might need its own persistent error)
			this.updateInputState();
		}
	}
}
