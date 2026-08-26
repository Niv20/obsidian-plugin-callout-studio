/**
 * settings/sections/CalloutListsSection.ts — Renders the three callout lists.
 *
 * Creates a controller object with render() and refresh() methods used by
 * SettingsTab to display, in order: the callouts the active theme styles, the
 * user's own callouts, and Obsidian's built-ins. Each row is rendered via
 * CalloutRowRenderer; row-level actions are handled by CalloutRowActions.
 *
 * ## The three groups answer one question: who paints this?
 *
 * Grouping used to be by *origin* — where a callout came from — which meant a
 * row also had to carry a `Theme` / `Studio` pill to say who was painting it.
 * Two facts on one row, and the second one only existed because the first was
 * answering the wrong question.
 *
 * Now the group *is* the answer (see `rowOwnership.isThemeStyled`), so no row
 * is labelled. Nothing moves a row between the lists but the theme itself:
 * switch to one that names an id and that row rises into the theme's section,
 * switch away and it drops back. Every row appears exactly once because the
 * split is one pass over one combined list, not three filters that have to
 * agree with each other.
 *
 * Both lists that can empty say so in words rather than vanishing silently,
 * and the built-in one has to: with a callout-styling theme and a fresh
 * install, every built-in starts out the theme's, and an unexplained empty
 * heading reads as a bug.
 *
 * ## Three sections, three folds, three cursors
 *
 * Each heading folds its own list (`sectionDisclosure`) and each list pages
 * its own overflow (`listPaging`). Both states live in this closure, which is
 * what makes them independent and what makes them survive a repaint: `refresh`
 * rebuilds every row on a registry change or a theme switch, and a list the
 * user had expanded must not quietly fold back up under them.
 *
 * The fold is also written through to `settings.calloutListsExpanded`
 * (`calloutListsFold.ts`) on every user-driven toggle, so it survives past
 * this closure too — a settings-tab reopen or a plugin reload starts each
 * section from whatever the user last left it, not from expanded. The paging
 * cursor is deliberately not: it is session-only, reset by the same reopen.
 *
 * The count in a heading is always the *partitioned* length, never the visible
 * slice — folding a section or leaving 20 of 34 rows on screen changes what is
 * drawn, not how many the user has.
 */
import { Setting } from "obsidian";
import { getLocale, t } from "../../i18n";
import { sortCalloutsByDisplayName } from "../../utils/sorting";
import { activeThemeName } from "../../manager/theme/customCssApi";
import { partitionByStyleOwner, styleOwnerFacts } from "./rowOwnership";
import type { RowKind } from "./rowOwnership";
import { ensureThemeRowUsage } from "./themeRowUsage";
import type { SectionDisclosure } from "./sectionDisclosure";
import { LIST_PAGE_SIZE, renderPagedList } from "./listPaging";
import type { PagingState } from "./listPaging";
import { attachPersistedFold } from "./calloutListsFold";
import { WelcomeModal } from "../WelcomeModal";
import type { CalloutDefinition } from "../../types";
import type { SettingsSectionContext } from "./types";

export type CalloutListsController = {
	render: (containerEl: HTMLElement) => void;
	refresh: () => void;
};

type CreateCalloutListsControllerOptions = {
	onAddNewCallout: () => Promise<void>;
	renderRow: (
		containerEl: HTMLElement,
		def: CalloutDefinition,
		kind: RowKind,
	) => void;
};

export function createCalloutListsController(
	ctx: SettingsSectionContext,
	options: CreateCalloutListsControllerOptions,
): CalloutListsController {
	let themeSetting: Setting | null = null;
	let themeSectionEl: HTMLElement | null = null;
	let themeListEl: HTMLElement | null = null;
	let themeFold: SectionDisclosure | null = null;
	let mySetting: Setting | null = null;
	let subSectionEl: HTMLElement | null = null;
	let userListEl: HTMLElement | null = null;
	let userFold: SectionDisclosure | null = null;
	let builtInListEl: HTMLElement | null = null;
	let builtInFold: SectionDisclosure | null = null;

	/** One cursor per section — see the header note on why they live here. */
	const paging: Record<RowKind, PagingState> = {
		theme: { expanded: false },
		user: { expanded: false },
		builtin: { expanded: false },
	};

	const themeLabel = (): string =>
		activeThemeName(ctx.app) ?? t("settings.themeCalloutsDefaultTheme");

	// One space before the parenthesis, on every heading — the count is a
	// suffix on whatever `t()` returns, not a translated string of its own, so
	// it needs no entry in the other 31 locale files.
	const headingWithCount = (base: string, count: number): string =>
		`${base} (${count})`;

	/** See `isThemeStyled` for why membership is derived from the theme alone. */
	const partition = () =>
		partitionByStyleOwner(styleOwnerFacts(ctx), [
			...ctx.plugin.registry.getThemeProvided(),
			...ctx.plugin.registry.getUserDefined(),
			...ctx.plugin.registry.getBuiltIn(),
		]);

	const renderList = (
		host: HTMLElement,
		defs: CalloutDefinition[],
		kind: RowKind,
	): void => {
		renderPagedList(
			host,
			sortCalloutsByDisplayName(defs, getLocale()),
			paging[kind],
			(listEl, def) => options.renderRow(listEl, def, kind),
			() => {
				renderAll();
				focusFirstRevealed(host);
			},
		);
	};

	/**
	 * Load more removes the button it was pressed on, so focus would land back
	 * on the document body and the reader would lose their place entirely. Send
	 * it to the first row that just appeared instead — `tabindex="-1"` because
	 * the row is a target for this jump, not a stop on the way through the tab.
	 */
	const focusFirstRevealed = (host: HTMLElement): void => {
		const listEl = host.querySelector<HTMLElement>(
			".callout-studio-callout-list",
		);
		const row = listEl?.children[LIST_PAGE_SIZE];
		if (!(row instanceof HTMLElement)) return;
		row.setAttribute("tabindex", "-1");
		row.focus();
	};

	const emptyState = (host: HTMLElement, text: string): void => {
		host.createDiv({ cls: "callout-studio-empty-state", text });
	};

	const renderThemeList = (fromTheme: CalloutDefinition[]): void => {
		if (!themeSectionEl || !themeListEl) return;
		// The heading names the *active* theme, so it is re-read on every render
		// rather than once when the section is built. `renderAll` is the refresh
		// path — it is what the tab's `css-change` listener reaches — and without
		// this the heading went on naming the outgoing theme while the rows under
		// it already showed the incoming one. The built-in list's empty state
		// below does re-read it, so the two contradicted each other on one screen.
		themeSetting?.setDesc(
			t("settings.themeCalloutsDesc", { theme: themeLabel() }),
		);
		themeFold?.setName(
			headingWithCount(t("settings.themeCalloutsHeading"), fromTheme.length),
		);
		themeListEl.empty();
		// The whole section disappears with the last row rather than showing an
		// empty state: most themes style no callouts at all, and a permanent
		// "your theme styles none" heading would be noise in every one of those
		// vaults.
		const has = fromTheme.length > 0;
		themeSectionEl.toggleClass("cs-hidden", !has);
		themeListEl.toggleClass("cs-hidden", !has);
		// The divider above "My callout types" only earns its keep when the
		// theme section above it is actually on screen — otherwise it would be
		// the first thing under the plugin title, with nothing to separate it from.
		subSectionEl?.toggleClass("cs-section-divider", has);
		if (!has) return;
		renderList(themeListEl, fromTheme, "theme");
	};

	const renderUserList = (own: CalloutDefinition[]): void => {
		userFold?.setName(
			headingWithCount(t("settings.myCalloutTypes"), own.length),
		);
		if (!userListEl) return;
		userListEl.empty();
		if (own.length === 0) {
			emptyState(userListEl, t("settings.noCalloutsNow"));
			return;
		}
		renderList(userListEl, own, "user");
	};

	const renderBuiltInList = (builtIn: CalloutDefinition[]): void => {
		builtInFold?.setName(
			headingWithCount(t("settings.builtInCallouts"), builtIn.length),
		);
		if (!builtInListEl) return;
		builtInListEl.empty();
		if (builtIn.length === 0) {
			emptyState(
				builtInListEl,
				t("settings.builtInAllThemeStyled", { theme: themeLabel() }),
			);
			return;
		}
		renderList(builtInListEl, builtIn, "builtin");
	};

	const renderAll = (): void => {
		const { fromTheme, own, builtIn } = partition();
		renderThemeList(fromTheme);
		renderUserList(own);
		renderBuiltInList(builtIn);
		// Warmed here rather than when a menu opens, because a menu cannot wait
		// on a whole-vault read: `openThemeRowMenu` reads the answer
		// synchronously and offers Replace and Clear uses only once it has one.
		// Nothing on a row shows the count any more, so nothing is repainted when
		// it lands — the callback is what used to cause a visible reflow a second
		// after the tab opened. One pass per visit; `SettingsTab.hide()` drops it.
		ensureThemeRowUsage(
			ctx.app,
			fromTheme.flatMap((def) =>
				ctx.plugin.registry.vaultIdFormsFor(def),
			),
			() => {},
		);
	};

	return {
		render: (containerEl: HTMLElement) => {
			const headerSetting = new Setting(containerEl)
				.setName(t("settings.title"))
				.setHeading();
			headerSetting.settingEl.addClass("cs-header-row");
			// Info icon opposite the title — reopens the welcome/splash screen.
			headerSetting.addExtraButton((btn) =>
				btn
					.setIcon("info")
					.setTooltip(t("welcome.tooltip"))
					.onClick(() => new WelcomeModal(ctx.plugin).open()),
			);

			// First, because it is the group the user has the least idea exists.
			// The description is left to `renderThemeList`, which is on both the
			// build and the refresh path, so the theme's name has exactly one
			// place it is written from.
			themeSetting = new Setting(containerEl)
				.setName(t("settings.themeCalloutsHeading"))
				.setHeading();
			themeSetting.settingEl.addClass("cs-subheader-row");
			themeSectionEl = themeSetting.settingEl;
			themeListEl = containerEl.createDiv();
			themeFold = attachPersistedFold(themeSetting, themeListEl, "theme", ctx.plugin);

			mySetting = new Setting(containerEl)
				.setName(t("settings.myCalloutTypes"))
				.setHeading();
			mySetting.settingEl.addClass("cs-subheader-row");
			// Same divider the "Built-in callouts" heading gets below, so the
			// theme-owned group above reads as visually separate from this one
			// when that group is on screen. `renderThemeList` toggles it in step
			// with the theme section's own visibility.
			subSectionEl = mySetting.settingEl;
			mySetting.addButton((btn) =>
				btn
					.setButtonText(t("settings.addNewCallout"))
					.setCta()
					.onClick(() => {
						void options.onAddNewCallout();
					}),
			);

			userListEl = containerEl.createDiv();
			userFold = attachPersistedFold(mySetting, userListEl, "user", ctx.plugin);

			// No `cs-subheader-row` here on purpose: that class is what the
			// heading-divider rule in styles.css excludes, so adding it to reach
			// the fold styling would silently delete this section's divider. The
			// chevron layout rides on `cs-collapsible-heading` instead, which all
			// three headings get from `attachSectionDisclosure`.
			const builtInSetting = new Setting(containerEl)
				.setName(t("settings.builtInCallouts"))
				.setHeading();
			builtInListEl = containerEl.createDiv();
			builtInFold = attachPersistedFold(builtInSetting, builtInListEl, "builtin", ctx.plugin);

			renderAll();
		},
		refresh: renderAll,
	};
}
