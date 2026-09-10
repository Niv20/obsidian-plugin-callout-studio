/**
 * settings/calloutCombobox.ts — "which callout?", asked the same way everywhere.
 *
 * A thin binding of {@link ListboxPopup} to the three pieces that already
 * answer this question elsewhere: `filterCalloutList` for what matches (id,
 * display name *and* aliases, substring rather than fuzzy), the popover's own
 * row renderer for what a match looks like, and `paintCalloutListIcon` for the
 * icon and accent of whatever is currently chosen.
 *
 * Which callouts are on offer is never decided here. The fallback row excludes
 * theme overlay rows because its value is synced; the command editor adds back
 * the callout an existing command is pinned to even when the registry has since
 * stopped offering it. Those are the call sites' rules, and they stay there.
 */
import { t } from "../i18n";
import { getLocale } from "../i18n";
import { paintCalloutListIcon } from "../manager/theme/calloutListIcon";
import type { CalloutRegistry } from "../manager/CalloutRegistry";
import type { CalloutDefinition } from "../types";
import { filterCalloutList } from "../utils/calloutSearch";
import { ListboxPopup } from "../ui/listboxPopup";
import { renderCalloutComboboxRow } from "./calloutComboboxRow";

export interface CalloutComboboxOptions {
	registry: CalloutRegistry;
	/**
	 * The callouts on offer — a function, not an array, so the list is re-read
	 * every time it is shown. That is what lets a callout created through
	 * {@link CalloutComboboxOptions.onCreate} appear without anyone having to
	 * remember to push it in. Already filtered by the call site — see the header.
	 */
	choices: () => readonly CalloutDefinition[];
	/** Selected id, or "" for none. An id absent from `choices` reads as none. */
	value: string;
	/** `aria-label` for the input; the call site owns the wording. */
	ariaLabel: string;
	/**
	 * Awaited by the caller's own `async` arrow where it needs to be, so a
	 * save-then-refresh order survives.
	 */
	onChange: (id: string) => void | Promise<void>;
	/**
	 * Make a callout named `query`, or return null if the user backed out.
	 *
	 * When present, a search that matches nothing offers to create it instead of
	 * reporting a dead end — the same offer the `[!` popover makes. The call site
	 * owns this because opening the callout editor needs the whole plugin, which
	 * a picker has no business holding.
	 */
	onCreate?: (query: string) => Promise<CalloutDefinition | null>;
	disabled?: boolean;
}

export class CalloutCombobox {
	private readonly popup: ListboxPopup<CalloutDefinition>;
	private readonly options: CalloutComboboxOptions;
	private choices: () => readonly CalloutDefinition[];
	private explicitlyDisabled: boolean;

	constructor(parent: HTMLElement, options: CalloutComboboxOptions) {
		this.options = options;
		this.choices = options.choices;
		this.explicitlyDisabled = options.disabled ?? false;

		this.popup = new ListboxPopup<CalloutDefinition>(parent, {
			ariaLabel: options.ariaLabel,
			placeholder: t("calloutPicker.placeholder"),
			emptyText: (query) => t("calloutPicker.noMatches", { query }),
			itemsFor: (query) =>
				filterCalloutList(this.choices(), {
					query,
					filter: "all",
					locale: getLocale(),
				}),
			renderRow: (rowEl, def, query) =>
				renderCalloutComboboxRow(rowEl, def, options.registry, {
					isDark: isDarkTheme(),
					query,
				}),
			labelOf: (def) => def.displayName,
			keyOf: (def) => def.id,
			onCommit: (def) => {
				this.paintLead(def);
				void options.onChange(def.id);
			},
			emptyAction: options.onCreate
				? {
						label: (query) => t("autocomplete.createNew", { name: query }),
						onSelect: (query) => void this.createAndAdopt(query),
					}
				: undefined,
		});

		this.setValue(options.value);
		this.syncDisabled();
	}

	get value(): string {
		return this.popup.value?.id ?? "";
	}

	/** Move the selection without firing `onChange`. */
	setValue(id: string): void {
		this.popup.setSelected(id);
		this.paintLead(this.popup.value);
	}

	setChoices(choices: () => readonly CalloutDefinition[]): void {
		this.choices = choices;
		this.popup.setItems();
		this.syncDisabled();
	}

	/**
	 * Make the callout the user was searching for, then take it.
	 *
	 * The editor is a modal and can sit open for minutes, so nothing captured
	 * before the await may be trusted afterwards — which is why the new value is
	 * re-read through `setValue` rather than assumed. `choices` is a function, so
	 * the row that was just saved is already in the list by the time we look.
	 */
	private async createAndAdopt(query: string): Promise<void> {
		const created = await this.options.onCreate?.(query);
		if (!created) return;
		this.syncDisabled();
		this.setValue(created.id);
		if (this.popup.value?.id !== created.id) {
			this.paintLead(created);
			this.popup.inputEl.value = created.displayName;
			this.popup.el.toggleClass("is-empty", false);
		}
		void this.options.onChange(created.id);
	}

	setDisabled(disabled: boolean): void {
		this.explicitlyDisabled = disabled;
		this.syncDisabled();
	}

	/**
	 * A picker with nothing to offer is inert whether or not the caller said so,
	 * so emptiness disables on its own account rather than leaving every call
	 * site to remember. The caller's own flag covers what only it can see — the
	 * command editor greys the row out while it explains the emptiness above.
	 */
	private syncDisabled(): void {
		this.popup.setDisabled(
			this.explicitlyDisabled || this.choices().length === 0,
		);
	}

	/** Must be called — see {@link ListboxPopup.destroy}. */
	destroy(): void {
		this.popup.destroy();
	}

	/**
	 * Draw the *committed* callout beside the input.
	 *
	 * Committed, not highlighted: arrowing down the list has not chosen
	 * anything, so the field must go on showing what it will still hold if the
	 * user walks away.
	 */
	private paintLead(def: CalloutDefinition | undefined): void {
		const lead = this.popup.leadEl;
		lead.empty();
		// No colour to clear: `is-empty` hides the slot, and the next callout
		// painted into it sets its own.
		if (!def) return;
		lead.style.color = paintCalloutListIcon(
			lead,
			def,
			this.options.registry,
			isDarkTheme(),
		);
	}
}

/**
 * Read at paint time rather than cached: a picker can be open across a theme
 * switch, and the accent it shows has to be the one on the page.
 */
function isDarkTheme(): boolean {
	return activeDocument.body.classList.contains("theme-dark");
}
