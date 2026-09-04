/**
 * settings/QuickInsertModal.ts — the ribbon's quick-insert window.
 *
 * One list of every block callout the user could write today, searchable,
 * filterable by source, each row offering exactly two things: edit it, or drop
 * it into the note.
 *
 * **Block callouts only, and the title says so.** The same definition also
 * renders as a heading callout and an inline one, so a window that just said
 * "insert callout" would be ambiguous in a way the user only discovers after
 * pressing the button. Heading and inline stay where they already are — the
 * `[!` popover and the user's own commands.
 *
 * Every row is the callout **as Obsidian renders it** (`quickInsertPreview.ts`),
 * so this window has no idea what a callout looks like — the point of it.
 *
 * It writes nothing itself. {@link wrapSelectionInCallout} is the one function
 * that turns a definition into block markdown, shared with the `Wrap in
 * callout` command and every user-built wrap command, so all three cannot
 * disagree about what a selection, a paragraph or a blank line becomes.
 */
import { Modal, Notice } from "obsidian";
import { wrapSelectionInCallout } from "../editor/CalloutBlockTools";
import {
	currentTargetEditor,
	resolveTargetEditor,
	type TargetEditorResult,
} from "../editor/targetMarkdownEditor";
import { getLocale, t } from "../i18n";
import type { CalloutDefinition } from "../types";
import {
	filterCalloutList,
	isCalloutSourceFilter,
	type CalloutSourceFilter,
} from "../utils/calloutSearch";
import { committedDefinitions, filterUsableCallouts } from "../utils/usableCallouts";
import { applyModalChrome, removeModalChrome } from "./modalChrome";
import { autofocusOnOpen } from "./modalAutofocus";
import { openCalloutEditorFor } from "./openCalloutEditor";
import { quickInsertHint, quickInsertNotice } from "./quickInsertMessages";
import { QuickInsertPreviews } from "./quickInsertPreview";
import { buildQuickInsertToolbar } from "./quickInsertToolbar";
import { renderQuickInsertRow } from "./quickInsertRow";
import type { SettingsTabPlugin } from "./sections/types";

export class QuickInsertModal extends Modal {
	private query = "";
	private filter: CalloutSourceFilter;

	/**
	 * The editor this window was opened beside, resolved once, before any modal
	 * has taken focus. Re-checked rather than trusted at insert time.
	 *
	 * Kept as the whole result rather than just the editor: when there isn't
	 * one, *which* of the three reasons it is is what the hint at the top of the
	 * window has to say.
	 */
	private readonly captured: TargetEditorResult;

	private listEl: HTMLElement | null = null;
	private searchEl: HTMLInputElement | null = null;
	/** Rows currently on screen, in view order — what the arrow keys walk. */
	private rows: { def: CalloutDefinition; el: HTMLElement }[] = [];
	private activeIndex = -1;

	private previews: QuickInsertPreviews | null = null;

	private readonly onRegistryChange = (): void => {
		void this.refresh();
	};
	private disposeIconListener: (() => void) | null = null;
	/** Releases the search field's autofocus scroll hold (modalAutofocus). */
	private releaseAutofocus: (() => void) | null = null;

	constructor(private readonly plugin: SettingsTabPlugin) {
		super(plugin.app);
		this.filter = isCalloutSourceFilter(plugin.settings.quickInsertSource)
			? plugin.settings.quickInsertSource
			: "all";
		this.captured = resolveTargetEditor(plugin.app);
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		// On `modalEl`: `--dialog-width` is read by `.modal` itself.
		this.modalEl.addClass("cs-quick-insert");
		// No footer — every row carries its own actions, like the import and
		// export choosers.
		applyModalChrome(this);
		this.titleEl.setText(t("quickInsert.title"));
		contentEl.createEl("p", {
			text: t("quickInsert.desc"),
			cls: "setting-item-description",
		});

		this.buildToolbar(contentEl);
		if (!this.captured.ok) {
			contentEl.createDiv({
				cls: "cs-quick-insert-hint",
				text: quickInsertHint(this.captured.problem),
			});
		}

		this.listEl = contentEl.createDiv({ cls: "callout-studio-callout-list" });
		this.previews = new QuickInsertPreviews(this.plugin.app);
		void this.refresh();

		this.plugin.registry.onChange(this.onRegistryChange);
		// Artwork that lands after the window is up must repaint the rows it
		// belongs to; without this a freshly picked icon stays a spinner.
		this.disposeIconListener = this.plugin.onIconCacheChange(() => {
			void this.refresh();
		});

		// No create/edit gate here — this window exists to be typed into, so it
		// always takes the cursor. It goes through the shared helper for the
		// other half of the rule: a phone keyboard must not drag the list up.
		this.releaseAutofocus = autofocusOnOpen(this.contentEl, this.searchEl);
	}

	onClose(): void {
		this.plugin.registry.offChange(this.onRegistryChange);
		this.disposeIconListener?.();
		this.disposeIconListener = null;
		this.releaseAutofocus?.();
		this.releaseAutofocus = null;
		this.previews?.destroy();
		this.previews = null;
		this.contentEl.empty();
		removeModalChrome(this);
		this.modalEl.removeClass("cs-quick-insert");
	}

	// ── Toolbar ─────────────────────────────────────────────────────────

	private buildToolbar(parent: HTMLElement): void {
		this.searchEl = buildQuickInsertToolbar(parent, {
			filter: this.filter,
			onQuery: (query) => {
				this.query = query;
				this.renderList();
			},
			onFilter: (filter) => {
				this.filter = filter;
				this.plugin.settings.quickInsertSource = filter;
				void this.plugin.saveSettings();
				this.renderList();
			},
			onKey: (ev) => this.onSearchKey(ev),
		});
	}

	private onSearchKey(ev: KeyboardEvent): void {
		if (ev.key === "ArrowDown") {
			ev.preventDefault();
			this.setActive(Math.min(this.activeIndex + 1, this.rows.length - 1));
		} else if (ev.key === "ArrowUp") {
			ev.preventDefault();
			this.setActive(Math.max(this.activeIndex - 1, 0));
		} else if (ev.key === "Enter") {
			ev.preventDefault();
			// With nothing arrowed to, Enter takes the top row — the one the
			// query is most plausibly about.
			const row = this.rows[this.activeIndex >= 0 ? this.activeIndex : 0];
			if (row) this.insert(row.def);
		}
	}

	private setActive(index: number): void {
		this.rows[this.activeIndex]?.el.removeClass("is-active");
		if (index < 0 || index >= this.rows.length) {
			this.activeIndex = -1;
			return;
		}
		this.activeIndex = index;
		const row = this.rows[index];
		row?.el.addClass("is-active");
		row?.el.scrollIntoView({ block: "nearest" });
	}

	// ── List ────────────────────────────────────────────────────────────

	/**
	 * Every callout the user could write right now, re-read from the registry.
	 *
	 * The same two steps `PluginAPI.usableDefinitions()` takes, for the same two
	 * reasons. The list views rather than `getAll()`, so the callout editor's
	 * transient live-preview *row* cannot appear here as a phantom entry; then
	 * `getReal()` on each, so its draft *values* cannot either — this window
	 * re-renders the moment that editor closes, which is exactly when a
	 * half-typed name would be on screen. And `filterUsableCallouts` last: the
	 * gate every callout-offering surface shares, so a row discovery
	 * auto-created for an id that has since left the vault is not offered back.
	 */
	private usableCallouts(): CalloutDefinition[] {
		const { registry } = this.plugin;
		const committed = committedDefinitions(registry).map(
			(def) => registry.getReal(def.id) ?? def,
		);
		return filterUsableCallouts(committed, (id) =>
			this.plugin.isKnownZeroUsageFallback(id),
		);
	}

	/**
	 * Re-render the callouts, then re-draw the rows around them. Drawn once
	 * before the render so the window is never blank while one is in flight, and
	 * again once it lands; every later filter and keystroke reads the cache and
	 * stays synchronous.
	 */
	private async refresh(): Promise<void> {
		const usable = this.usableCallouts();
		this.renderList(usable);
		await this.previews?.build(usable);
		if (!this.previews) return; // closed while rendering
		this.renderList(usable);
	}

	private renderList(usable = this.usableCallouts()): void {
		const listEl = this.listEl;
		if (!listEl) return;
		listEl.empty();
		this.rows = [];
		this.activeIndex = -1;

		const visible = filterCalloutList(usable, {
			query: this.query,
			filter: this.filter,
			locale: getLocale(),
		});

		if (visible.length === 0) {
			// Two different nothings: a query that found none, and a filter with
			// none to find. The second is not a failed search.
			const empty =
				this.query.trim() === "" && this.filter === "user"
					? t("quickInsert.noUserCallouts")
					: t("quickInsert.noResults");
			listEl.createDiv({ cls: "callout-studio-empty-state", text: empty });
			return;
		}

		for (const def of visible) {
			const el = renderQuickInsertRow(listEl, def, {
				canInsert: this.captured.ok,
				preview: (target) => this.previews?.get(target.id) ?? null,
				onEdit: (target) => void this.edit(target),
				onInsert: (target) => this.insert(target),
				onHover: (rowEl) =>
					this.setActive(this.rows.findIndex((r) => r.el === rowEl)),
			});
			this.rows.push({ def, el });
		}
	}

	// ── Actions ─────────────────────────────────────────────────────────

	/**
	 * Open the real callout editor above this window.
	 *
	 * The list stays open underneath and re-reads the registry when the editor
	 * closes, so a rename, a recolour or a delete is reflected without the user
	 * having to close this, go to Settings and come back.
	 */
	private async edit(def: CalloutDefinition): Promise<void> {
		await openCalloutEditorFor(this.plugin, def);
		await this.refresh();
	}

	/**
	 * Write the callout into the note and get out of the way.
	 *
	 * Resolved again here rather than trusting the capture: the note may have
	 * been closed, its leaf re-used, or flipped into Reading view since the
	 * window opened.
	 *
	 * A refusal carries the reason it was refused. "Nothing to insert into" is
	 * three situations and only one of them is fixed by opening a note, so the
	 * notice names the one the user is actually in — see
	 * {@link quickInsertNotice}.
	 */
	private insert(def: CalloutDefinition): void {
		const result = currentTargetEditor(
			this.plugin.app,
			this.captured.ok ? this.captured.target : null,
		);
		if (!result.ok) {
			// The window stays open on a refusal. It is a modal, so the note
			// behind it cannot be touched until it closes — but closing on the
			// user's behalf would discard the query and the filter they typed
			// to find this row, and the notice already says what to do next.
			// The same state is on screen before the button is ever pressed:
			// the hint at the top, and every Insert dimmed.
			new Notice(quickInsertNotice(result.problem));
			return;
		}
		const { target } = result;
		this.close();
		// Focus first, so the edit lands in a view that is already scrolled to
		// the cursor. The write itself is a single `replaceRange`, which is what
		// makes one Undo put everything back.
		target.editor.focus();
		wrapSelectionInCallout(target.editor, { def });
	}
}
