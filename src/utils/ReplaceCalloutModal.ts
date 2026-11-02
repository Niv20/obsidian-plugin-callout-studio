/**
 * utils/ReplaceCalloutModal.ts — Pick-a-replacement callout modal.
 *
 * Shown by a callout row's **Replace in vault…**. A search field over a list of
 * the other callouts, each drawn as one of the rows of the settings' *Built-in
 * callouts* list (icon, name, `[!id]` spellings, colour circles), and returns
 * the one chosen so the caller can run the vault-wide replacement. Delete never
 * comes here: it removes the definition and leaves the notes alone (see
 * settings/sections/calloutVaultActions.ts).
 */
import { Modal, Setting, SettingGroup, setIcon } from "obsidian";
import type { App } from "obsidian";
import type { CalloutDefinition } from "../types";
import type { CalloutRegistry } from "../manager/CalloutRegistry";
import { paintCalloutListIcon } from "../manager/theme/calloutListIcon";
import { renderColorCircles, resolveCurrentModeColors, type SwatchColors } from "../ui/ColorCircles";
import { renderIdLine } from "../settings/sections/CalloutRowRenderer";
import { fitIdsLine } from "../settings/sections/idsLineFit";
import { getLocale, t } from "../i18n";
import { explainIfBlocked, paintBlocked } from "../ui/blockedButton";
import { DESTRUCTIVE_BUTTON_CLASSES } from "../ui/destructiveButton";
import { filterCalloutList } from "./calloutSearch";
import { applyModalChrome } from "../settings/modalChrome";
import { autofocusOnDesktop } from "../settings/modalAutofocus";
import { createSearchField } from "../ui/searchField";
import { SearchMascot } from "../ui/mascot/mascotPlaces";

export type ReplaceChoice = { action: "replace"; replaceWith: string } | { action: "cancel" };

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
	/** What stops each drawn row's ids line following its width; run on every redraw. */
	private stopFitting: Array<() => void> = [];
	/** The brush over "No callouts match", as in the other searches. */
	private readonly noMatchMascot = new SearchMascot();
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

		// A vault with a few dozen callouts makes this list longer than the
		// window, and the user arrived here knowing which callout they want.
		// Matches ids and aliases as well as names, like every other callout
		// search in the plugin.
		// Obsidian's search field (magnifier, ×; finding S6-15). Its × filters
		// too: `onChange` hears it, an `input` listener would not.
		const { inputEl: search } = createSearchField(contentEl, {
			placeholder: t("replaceModal.searchPlaceholder"),
			fieldCls: "callout-studio-replace-search-field",
			inputCls: "callout-studio-replace-search",
			onChange: (query) => {
				this.renderList(query);
				// After the redraw, so the mascot is already where it belongs.
				this.noMatchMascot.typed();
			},
		});
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
			cls: DESTRUCTIVE_BUTTON_CLASSES,
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
		this.stopFittingIds();
		listEl.empty();
		this.itemEls.clear();

		const matches = filterCalloutList(this.availableCallouts, {
			query,
			filter: "all",
			locale: getLocale(),
		});

		if (matches.length === 0) {
			const emptyEl = listEl.createDiv({
				cls: "callout-studio-empty-state",
				text: t("calloutPicker.noMatches", { query }),
			});
			// A search that found nothing, as in Quick insert and the settings'
			// lists: the mascot looks around, then is sad while it stays so.
			if (query.trim() !== "") this.noMatchMascot.showEmpty(emptyEl);
			else this.noMatchMascot.hide();
			return;
		}
		this.noMatchMascot.hide();

		// Obsidian's list box, as the settings' lists draw it: rounded, rows a
		// little tighter.
		const group = new SettingGroup(listEl).addClass("mod-list");
		for (const def of matches) {
			const item = this.renderCalloutItem(group, def);
			this.itemEls.set(def.id, item);
			if (def.id === this.selectedId) {
				item.addClass("is-selected");
			}
			item.addEventListener("click", () => this.selectItem(def.id));
		}
	}

	private stopFittingIds(): void {
		for (const stop of this.stopFitting) stop();
		this.stopFitting = [];
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

	/**
	 * One callout as a setting row, filled the way the settings' lists fill
	 * theirs (`drawCalloutRow`, CalloutRowRenderer.ts): the icon at the start,
	 * the name over the callout's `[!id]` spellings, the colour circles at the
	 * end. The row's CSS is theirs too (`cs-callout-row`, styles.css); what this
	 * window adds is the chosen row's tint and the check beside it.
	 */
	private renderCalloutItem(group: SettingGroup, def: CalloutDefinition): HTMLElement {
		const setting = new Setting(group.listEl);
		// `tappable`: Obsidian marks a touched element of that class
		// `.mobile-tap`, so a phone shows the row's press (finding S10-V2).
		setting.setClass("cs-callout-row").setClass("callout-studio-replace-item").setClass("tappable");
		const rowEl = setting.settingEl;
		// Which callout the row stands for, for tests and the screenshot scripts.
		rowEl.setAttribute("data-callout-id", def.id);

		// Icon and accent both come from whoever actually paints this callout —
		// the theme's own measured pair when the theme owns the id. This list is
		// how a user picks a replacement, so showing a colour the replacement
		// will not have is a bad answer to the only question being asked.
		const iconEl = rowEl.createDiv({ cls: "callout-studio-row-icon" });
		rowEl.insertBefore(iconEl, rowEl.firstChild);
		const isDark = activeDocument.body.classList.contains("theme-dark");
		const accent = paintCalloutListIcon(iconEl, def, this.registry, isDark);

		// The name's words are a span of their own so that it can end in "…".
		const nameWords = createFragment((fragment) =>
			fragment.createSpan({ cls: "cs-row-name", text: def.displayName }),
		);
		setting.setName(nameWords);
		renderIdLine(setting.descEl, def);
		this.stopFitting.push(fitIdsLine(setting.descEl));

		// On a phone the icon and the name wear the colours, as in the settings.
		const colors = this.colorsOf(def, accent);
		rowEl.style.setProperty("--cs-row-accent", accent);
		if (colors && !colors.transparent) rowEl.style.setProperty("--cs-row-bg", colors.bg);
		if (colors) {
			renderColorCircles(setting.controlEl.createDiv({ cls: "callout-studio-row-colors" }), colors, {
				size: 18,
				ariaLabel: t("settings.colorSwatchAria", { accent: colors.accent, bg: colors.bg }),
			});
		}

		// The check Obsidian's menus put beside the current value. Every row has
		// one and `.is-selected` shows it, so moving the choice is a class change.
		const check = setting.controlEl.createDiv({
			cls: "callout-studio-replace-item-check",
			attr: { "aria-hidden": "true" },
		});
		setIcon(check, "check");

		return rowEl;
	}

	/** The circles a row shows: the theme's measured pair when it paints the callout. */
	private colorsOf(def: CalloutDefinition, accent: string): SwatchColors | null {
		if (!this.registry.themeOwns(def)) return resolveCurrentModeColors(def);
		const measured = this.registry.themeAppearanceOf(def);
		return measured.accent ? { accent, bg: measured.background ?? accent } : null;
	}

	onClose(): void {
		if (!this.resolved) {
			this.resolve({ action: "cancel" });
		}
		this.stopFittingIds();
		// Its timers belong to the window.
		this.noMatchMascot.hide();
		this.contentEl.empty();
	}

	prompt(): Promise<ReplaceChoice> {
		return new Promise<ReplaceChoice>((resolve) => {
			this.resolve = resolve;
			this.open();
		});
	}
}
