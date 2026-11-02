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
 * **The list is drawn a page at a time.** With hundreds of callouts, building
 * every row (and rendering every preview) before the first paint froze the
 * window, and again on every keystroke. Now a page of rows is drawn, the list
 * ends in an empty marker, and the next page is drawn as the marker nears
 * (`ui/loadOnScroll.ts`) — or when the arrow keys run past the last row. A
 * search or a source change starts over from the first page.
 *
 * **A row is the spelling the search found.** A callout is found by its id, its
 * name or any alias, so typing `tldr` lists the `abstract` row. That row is then
 * drawn as `> [!tldr] Tldr` and Insert writes the same line — the `[!` popover's
 * rule, from the same {@link matchedCalloutId}. An empty search, or a row only
 * its name matched, stays on the primary id.
 *
 * It writes nothing itself. {@link wrapSelectionInCallout} turns a definition
 * into block markdown for this window, `Wrap in callout`, and user-built wrap
 * commands, so they cannot disagree about what the selected text becomes.
 */
import { Modal, type EventRef } from "obsidian";
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
	matchedCalloutId,
	type CalloutSourceFilter,
} from "../utils/calloutSearch";
import { committedDefinitions } from "../utils/usableCallouts";
import { applyModalChrome, removeModalChrome } from "./modalChrome";
import { autofocusOnDesktop } from "./modalAutofocus";
import { openCalloutEditorFor } from "./openCalloutEditor";
import {
	quickInsertEmptyMessage,
	quickInsertHint,
	quickInsertNotice,
} from "./quickInsertMessages";
import { QuickInsertPreviews } from "./quickInsertPreview";
import {
	buildQuickInsertToolbar,
	quickInsertSearchKey,
	syncQuickInsertThemeOption,
	type QuickInsertToolbar,
} from "./quickInsertToolbar";
import { renderQuickInsertRow } from "./quickInsertRow";
import { SearchMascot } from "../ui/mascot/mascotPlaces";
import { canLoadOnScroll, LOAD_MORE_SENTINEL, LoadOnScroll } from "../ui/loadOnScroll";
import type { SettingsTabPlugin } from "./sections/types";
import { showNotice } from "../ui/mascot/mascotNotices";

/**
 * Rows drawn at a time. A little more than a window shows, so the first page
 * fills it and the marker is already within reach of the next.
 */
const PAGE_SIZE = 30;

export class QuickInsertModal extends Modal {
	private query = "";
	/** Starts on All once, then follows the user's last source choice. */
	private filter: CalloutSourceFilter = "all";
	/** How many rows the list may draw; a page more each time its end is reached. */
	private limit = PAGE_SIZE;
	/** Every callout the search and source leave, in order. Rows are drawn from its front. */
	private visible: CalloutDefinition[] = [];
	/** The empty marker the list ends in while there is more to draw. */
	private sentinel: HTMLElement | null = null;
	private readonly loadOnScroll = new LoadOnScroll(() => this.contentEl, () => this.drawMore());
	private refreshQueued = false;

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
	/**
	 * The brush mascot over "No callouts found", kept while the list is drawn
	 * again on every key. Made the first time a search finds nothing.
	 */
	private noMatchMascot: SearchMascot | null = null;
	private toolbar?: QuickInsertToolbar;
	private searchEl: HTMLInputElement | null = null;
	/** Rows currently on screen, in view order — what the arrow keys walk. */
	private rows: { def: CalloutDefinition; el: HTMLElement }[] = [];
	private activeIndex = -1;
	private pointerActive = false;
	private previews: QuickInsertPreviews | null = null;
	private cssChangeRef!: EventRef;
	private readonly onRegistryChange = (): void => this.queueRefresh();
	private disposeIconListener: (() => void) | null = null;

	constructor(private readonly plugin: SettingsTabPlugin) {
		super(plugin.app);
		// Remembered on this device; the synced field seeds a device that has none.
		const remembered = plugin.localState.quickInsertSource ?? plugin.settings.quickInsertSource;
		if (isCalloutSourceFilter(remembered)) this.filter = remembered;
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
		this.previews = new QuickInsertPreviews(this.plugin.app, () => this.fillPreviews());
		this.renderList();

		this.plugin.registry.onChange(this.onRegistryChange);
		this.cssChangeRef = this.plugin.app.workspace.on("css-change", this.onRegistryChange);
		// Artwork that lands after the window is up must repaint the rows it
		// belongs to; without this a freshly picked icon stays a spinner.
		this.disposeIconListener = this.plugin.onIconCacheChange(this.onRegistryChange);

		// Keep search ready on desktop without raising the mobile keyboard on open.
		autofocusOnDesktop(this.searchEl);
	}

	onClose(): void {
		this.plugin.registry.offChange(this.onRegistryChange);
		this.plugin.app.workspace.offref(this.cssChangeRef);
		this.disposeIconListener?.();
		this.disposeIconListener = null;
		this.loadOnScroll.stop();
		this.toolbar?.destroy();
		this.previews?.destroy();
		this.previews = null;
		this.noMatchMascot?.hide();
		this.contentEl.empty();
		removeModalChrome(this);
		this.modalEl.removeClass("cs-quick-insert");
	}

	// ── Toolbar ─────────────────────────────────────────────────────────
	private buildToolbar(parent: HTMLElement): void {
		this.toolbar?.destroy();
		this.toolbar = buildQuickInsertToolbar(parent, {
			filter: this.filter,
			themeLabel:
				activeThemeName(this.plugin.app) ?? t("quickInsert.sourceTheme"),
			onQuery: (query) => {
				this.query = query;
				this.restartList();
			},
			onFilter: (filter) => {
				this.filter = filter;
				// Memory, not a setting: a synced write here made every other
				// device adopt a new settings file for a glance at a filter.
				this.plugin.localState.setQuickInsertSource(filter);
				this.restartList();
			},
			onKey: (ev) => this.onSearchKey(ev),
		});
		this.searchEl = this.toolbar.search;
	}

	/**
	 * The id `def` is drawn and written with under the current search: the id or
	 * alias the user typed towards, else its primary id. Recomputed rather than
	 * stored, which is safe because a changed query redraws every row.
	 */
	private matchedIdFor(def: CalloutDefinition): string {
		return matchedCalloutId(def, this.query.trim().toLowerCase());
	}

	private onSearchKey(ev: KeyboardEvent): void {
		quickInsertSearchKey(ev,
			(delta) => {
				// Arrowing past the last drawn row draws the next page first, as
				// scrolling to the end of the list does.
				if (this.activeIndex + delta >= this.rows.length && this.rows.length < this.visible.length) this.drawMore();
				this.setActive(Math.max(0, Math.min(this.activeIndex + delta, this.rows.length - 1)));
			},
			() => { const row = this.rows[Math.max(0, this.activeIndex)]; if (row) this.insert(row.def, this.matchedIdFor(row.def)); },
		);
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
	 * One change reaches this window as several signals — the registry, then the
	 * stylesheet it injects, then any artwork it downloads — and each used to
	 * redraw everything. They are folded into one redraw, run after the signals
	 * that arrived together have all been heard.
	 */
	private queueRefresh(): void {
		if (this.refreshQueued) return;
		this.refreshQueued = true;
		void Promise.resolve().then(() => {
			this.refreshQueued = false;
			this.refresh();
		});
	}

	/**
	 * Something the previews depend on changed: render the rows on screen again.
	 * Drawn at once with the previews it has, so the window is never blank while
	 * a render is in flight; each render that lands swaps itself in
	 * ({@link fillPreviews}). Rows nobody has scrolled to are not touched.
	 */
	private refresh(): void {
		if (!this.previews) return; // closed since the signal was heard
		this.previews.invalidate();
		this.renderList();
	}

	/** The search or the source changed: show the new first page, from the top. */
	private restartList(): void {
		this.limit = PAGE_SIZE;
		this.contentEl.scrollTop = 0;
		this.renderList();
	}

	private renderList(usable = this.usableCallouts()): void {
		const listEl = this.listEl;
		if (!listEl) return;
		const filter = syncQuickInsertThemeOption(
			this.toolbar?.filter,
			activeThemeName(this.plugin.app) ?? t("quickInsert.sourceTheme"),
			usable.some((def) => this.plugin.registry.themeOwns(def)),
			this.filter,
		);
		listEl.empty();
		this.rows = [];
		this.activeIndex = -1;
		this.pointerActive = false;
		this.sentinel = null;

		this.visible = filterCalloutList(usable, {
			query: this.query,
			filter,
			themeOwns: (def) => this.plugin.registry.themeOwns(def),
			locale: getLocale(),
		});

		if (this.visible.length === 0) {
			this.loadOnScroll.watch(null);
			// Two different nothings: a query that found none, and a filter with
			// none to find. The second is not a failed search.
			const empty = quickInsertEmptyMessage(filter, this.query, this.plugin.registry.getUserDefined().length > 0);
			// Obsidian's own "nothing found" line under a search (`.suggestion-empty`:
			// muted, upright, centred), as its suggestion lists show it (S4-10).
			const emptyEl = listEl.createDiv({ cls: "suggestion-empty", text: empty });
			// A search that found nothing (not a category with nothing in it): the
			// mascot looks around twice, then is sad for as long as the search
			// stays that way.
			if (this.query.trim() !== "") {
				// `??=`: make it the first time only ("if null, make one").
				this.noMatchMascot ??= new SearchMascot();
				this.noMatchMascot.showEmpty(emptyEl);
			} else this.noMatchMascot?.hide();
			return;
		}
		this.noMatchMascot?.hide();
		this.drawRows();
	}

	/** The list's next page was asked for: by the marker coming into reach, or by the arrow keys. */
	private drawMore(): void {
		this.limit += PAGE_SIZE;
		this.drawRows();
	}

	/**
	 * Draw the rows the limit reaches that are not on screen yet, move the end
	 * marker below them, and ask for the previews they are waiting on.
	 */
	private drawRows(): void {
		const listEl = this.listEl;
		if (!listEl) return;
		this.sentinel?.remove();
		// Where the window cannot watch the marker (never in Obsidian; a test's
		// stand-in window), the whole list is drawn: there would be no way to
		// reach a second page.
		const end = canLoadOnScroll(listEl.ownerDocument)
			? Math.min(this.limit, this.visible.length)
			: this.visible.length;
		for (const def of this.visible.slice(this.rows.length, end)) {
			const matchedId = this.matchedIdFor(def);
			const el = renderQuickInsertRow(listEl, def, {
				canInsert: this.captured.ok,
				matchedId,
				preview: (target) => this.previews?.get(target.id, matchedId) ?? null,
				onEdit: (target) => void this.edit(target),
				onInsert: (target) => this.insert(target, matchedId),
				onHover: (rowEl) => {
					if (rowEl || this.pointerActive) {
						this.setActive(this.rows.findIndex((r) => r.el === rowEl), true);
					}
				},
			});
			this.rows.push({ def, el });
		}
		this.sentinel = end < this.visible.length
			? listEl.createDiv({ cls: LOAD_MORE_SENTINEL, attr: { "aria-hidden": "true" } })
			: null;
		this.loadOnScroll.watch(this.sentinel);
		void this.previews?.ensure(
			this.rows.map((row) => row.def),
			(def) => this.matchedIdFor(def),
		);
	}

	/**
	 * A render landed: put each new preview where its row is waiting with only the
	 * callout's name (or with an older preview of it). The rows are not redrawn,
	 * so the scroll position, the highlight and a pressed button all stay put.
	 */
	private fillPreviews(): void {
		for (const { def, el } of this.rows) {
			const preview = this.previews?.get(def.id, this.matchedIdFor(def));
			const slot = el.querySelector<HTMLElement>(".cs-qi-slot");
			if (!preview || !slot || slot.firstElementChild === preview) continue;
			slot.empty();
			slot.appendChild(preview);
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
		this.refresh();
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
	 *
	 * `matchedId` is the spelling the search found the callout by, so the line
	 * written is the line the row showed.
	 */
	private insert(def: CalloutDefinition, matchedId?: string): void {
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
			showNotice("blocked", quickInsertNotice(result.problem));
			return;
		}
		const { target } = result;
		this.close();
		// Focus first, so the edit lands in a view that is already scrolled to
		// the cursor. The write itself is a single `replaceRange`, which is what
		// makes one Undo put everything back.
		target.editor.focus();
		wrapSelectionInCallout(target.editor, { def, matchedId });
	}
}
