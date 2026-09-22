/**
 * settings/QuickInsertModal.ts — the ribbon's quick-insert window.
 *
 * One list of every block callout the user could write today, searchable,
 * filterable by source, each row offering exactly two things: edit it, or drop
 * it into the note.
 *
 * **Block callouts only, and the title says so.** Definitions also render as
 * heading and inline callouts, so plain "insert callout" would be ambiguous.
 * Those two formats stay in the `[!` popover and the user's own commands.
 *
 * Every row is the callout **as Obsidian renders it** (`quickInsertPreview.ts`),
 * so this window has no idea what a callout looks like — the point of it.
 *
 * It writes nothing itself. {@link wrapSelectionInCallout} turns a definition
 * into block markdown for this window, `Wrap in callout`, and user-built wrap
 * commands, so they cannot disagree about what the selected text becomes.
 */
import { Modal, Notice, type EventRef } from "obsidian";
import { wrapSelectionInCallout } from "../editor/CalloutBlockTools";
import {
	currentTargetEditor,
	resolveTargetEditor,
	type TargetEditorResult,
} from "../editor/targetMarkdownEditor";
import { getLocale, t } from "../i18n";
import { activeThemeName } from "../manager/theme/customCssApi";
import type { CalloutDefinition } from "../types";
import {
	filterCalloutList,
	isCalloutSourceFilter,
	type CalloutSourceFilter,
} from "../utils/calloutSearch";
import { committedDefinitions } from "../utils/usableCallouts";
import { applyModalChrome, removeModalChrome } from "./modalChrome";
import { autofocusOnOpen } from "./modalAutofocus";
import { openCalloutEditorFor } from "./openCalloutEditor";
import {
	quickInsertEmptyMessage,
	quickInsertHint,
	quickInsertNotice,
} from "./quickInsertMessages";
import { QuickInsertPreviews } from "./quickInsertPreview";
import {
	buildQuickInsertToolbar,
	syncQuickInsertThemeOption,
} from "./quickInsertToolbar";
import { renderQuickInsertRow } from "./quickInsertRow";
import type { SettingsTabPlugin } from "./sections/types";

export class QuickInsertModal extends Modal {
	private query = "";
	/** Starts on All once, then follows the user's last source choice. */
	private filter: CalloutSourceFilter = "all";

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
	private pointerActive = false;
	private previews: QuickInsertPreviews | null = null;
	private cssChangeRef!: EventRef;
	private readonly onRegistryChange = (): void => {
		void this.refresh();
	};
	private disposeIconListener: (() => void) | null = null;

	constructor(private readonly plugin: SettingsTabPlugin) {
		super(plugin.app);
		if (isCalloutSourceFilter(plugin.settings.quickInsertSource)) this.filter = plugin.settings.quickInsertSource;
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
		this.cssChangeRef = this.plugin.app.workspace.on("css-change", this.onRegistryChange);
		// Artwork that lands after the window is up must repaint the rows it
		// belongs to; without this a freshly picked icon stays a spinner.
		this.disposeIconListener = this.plugin.onIconCacheChange(() => {
			void this.refresh();
		});

		// Quick Insert always focuses search, on mobile too: typing is its first action.
		autofocusOnOpen(this.searchEl);
	}

	onClose(): void {
		this.plugin.registry.offChange(this.onRegistryChange);
		this.plugin.app.workspace.offref(this.cssChangeRef);
		this.disposeIconListener?.();
		this.disposeIconListener = null;
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
			themeLabel:
				activeThemeName(this.plugin.app) ?? t("quickInsert.sourceTheme"),
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

	private setActive(index: number, pointer = false): void {
		this.pointerActive = pointer && index >= 0;
		this.rows[this.activeIndex]?.el.removeClass("is-active");
		if (index < 0 || index >= this.rows.length) {
			this.activeIndex = -1;
			return;
		}
		this.activeIndex = index;
		const row = this.rows[index];
		row?.el.addClass("is-active");
		if (!pointer) row?.el.scrollIntoView({ block: "nearest" });
	}

	// ── List ────────────────────────────────────────────────────────────
	private usableCallouts(): CalloutDefinition[] {
		const { registry } = this.plugin;
		const committed = committedDefinitions(registry).map(
			(def) => registry.getReal(def.id) ?? def,
		);
		return committed;
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
		this.renderList(); // Re-read after concurrent theme or registry changes.
	}

	private renderList(usable = this.usableCallouts()): void {
		const listEl = this.listEl;
		if (!listEl) return;
		const filter = syncQuickInsertThemeOption(
			this.contentEl,
			activeThemeName(this.plugin.app) ?? t("quickInsert.sourceTheme"),
			usable.some((def) => this.plugin.registry.themeOwns(def)),
			this.filter,
		);
		listEl.empty();
		this.rows = [];
		this.activeIndex = -1;
		this.pointerActive = false;

		const visible = filterCalloutList(usable, {
			query: this.query,
			filter,
			themeOwns: (def) => this.plugin.registry.themeOwns(def),
			locale: getLocale(),
		});

		if (visible.length === 0) {
			// Two different nothings: a query that found none, and a filter with
			// none to find. The second is not a failed search.
			const empty = quickInsertEmptyMessage(filter, this.query, this.plugin.registry.getUserDefined().length > 0);
			listEl.createDiv({ cls: "callout-studio-empty-state", text: empty });
			return;
		}

		for (const def of visible) {
			const el = renderQuickInsertRow(listEl, def, {
				canInsert: this.captured.ok,
				preview: (target) => this.previews?.get(target.id) ?? null,
				onEdit: (target) => void this.edit(target),
				onInsert: (target) => this.insert(target),
				onHover: (rowEl) => {
					if (rowEl || this.pointerActive) {
						this.setActive(this.rows.findIndex((r) => r.el === rowEl), true);
					}
				},
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
