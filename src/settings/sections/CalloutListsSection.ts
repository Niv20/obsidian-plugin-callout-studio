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
 */
import { Setting } from "obsidian";
import { getLocale, t } from "../../i18n";
import { sortCalloutsByDisplayName } from "../../utils/sorting";
import { activeThemeName } from "../../manager/theme/customCssApi";
import { partitionByStyleOwner, styleOwnerFacts } from "./rowOwnership";
import type { RowKind } from "./rowOwnership";
import { ensureThemeRowUsage } from "./themeRowUsage";
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
	let mySetting: Setting | null = null;
	let subSectionEl: HTMLElement | null = null;
	let userListEl: HTMLElement | null = null;
	let builtInSetting: Setting | null = null;
	let builtInListEl: HTMLElement | null = null;

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
		const listEl = host.createDiv({ cls: "callout-studio-callout-list" });
		for (const def of sortCalloutsByDisplayName(defs, getLocale())) {
			options.renderRow(listEl, def, kind);
		}
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
		themeSetting?.setName(
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
		mySetting?.setName(
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
		builtInSetting?.setName(
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

			builtInSetting = new Setting(containerEl)
				.setName(t("settings.builtInCallouts"))
				.setHeading();
			builtInListEl = containerEl.createDiv();

			renderAll();
		},
		refresh: renderAll,
	};
}
