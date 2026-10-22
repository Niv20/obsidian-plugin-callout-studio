/**
 * settings/sections/calloutListsScaffold.ts — the boxes the three lists go in.
 *
 * Building the sections and filling them are two jobs with two lifetimes: this
 * runs once per `display()`, while `CalloutListsSection`'s painting runs again
 * on every registry change, theme switch and icon landing. Splitting them is
 * what lets the painter be read as "what goes in the boxes" without the eighty
 * lines of "which boxes, in what order, wearing which classes" in front of it.
 *
 * Every element handed back is one the painter empties and refills, or toggles
 * a class on. Nothing here is re-read afterwards: the two `Setting` objects are
 * used to hang a class and a button and then dropped, and the folds are handed
 * over because a heading's "(N)" is rewritten on every repaint.
 *
 * The order of the three is deliberate and is explained inline, as is why each
 * class lands on the wrapper rather than on the heading — `styles.css` depends
 * on all of it, and a sticky heading that carries its own divider freezes a
 * rule against the top edge of the pane.
 */
import { Setting, type ToggleComponent } from "obsidian";
import { t } from "../../i18n";
import type { SectionDisclosure } from "./sectionDisclosure";
import { attachPersistedFold } from "./calloutListsFold";
import { createStickySection } from "./stickySection";
import { WelcomeModal } from "../WelcomeModal";
import { addManualDiscoveryButton } from "./manualDiscoveryButton";
import { followScanPlacement } from "./scanPlacement";
import type { SettingsSectionContext } from "./types";

/** Everything the painter needs to keep hold of after the build. */
export type CalloutListsScaffold = {
	/**
	 * Empty div directly under the "Callout Studio" title row, for the
	 * saving-status banner. The banner used to open the page above the title,
	 * which read as a message about Obsidian rather than about this plugin's
	 * settings; under the title it is still the first thing in the page's own
	 * content. @see SettingsTab.display
	 */
	bannerSlotEl: HTMLElement;
	themeSectionEl: HTMLElement;
	themeDescEl: HTMLElement;
	themeListEl: HTMLElement;
	themeFold: SectionDisclosure;
	/** *Use your theme's callout styles* — see {@link addThemeStylesSwitch}. */
	themeSwitch: ThemeStylesSwitch;
	/** "My callout types"' wrapper — it carries the conditional divider. */
	subSectionEl: HTMLElement;
	userListEl: HTMLElement;
	/** Scan's place under the list, inside `userListEl` and outliving its repaints. */
	discoverFooterEl: HTMLElement;
	/** Ask again whether Scan fits on the heading — after its "(N)" changes. */
	placeScan: () => void;
	userFold: SectionDisclosure;
	builtInListEl: HTMLElement;
	builtInFold: SectionDisclosure;
};

export function buildCalloutListsScaffold(
	ctx: SettingsSectionContext,
	containerEl: HTMLElement,
	onAddNewCallout: () => Promise<void>,
): CalloutListsScaffold {
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

		// Immediately after the title, before any section — see `bannerSlotEl`.
		const bannerSlotEl = containerEl.createDiv();

		// First, because it is the group the user has the least idea exists.
		// The description is left to `renderThemeList`, which is on both the
		// build and the refresh path, so the theme's name has exactly one
		// place it is written from.
		const theme = createStickySection(
			containerEl,
			t("settings.themeCalloutsHeading"),
		);
		const themeSetting = theme.setting;
		themeSetting.settingEl.addClass("cs-subheader-row");
		// The wrapper, not the heading. The section disappears whole when the
		// theme styles nothing (see `renderThemeList`), and hiding the wrapper
		// takes the heading and its rows with it in one toggle — which is also
		// what keeps `cs-hidden` and the fold's `is-collapsed` off the same
		// element, so neither can undo the other.
		const themeSectionEl = theme.wrapEl;
		// A plain row, not part of the sticky heading above it, so naming the
		// active theme scrolls off like any other row instead of pinning with it.
		const themeDescEl = theme.wrapEl.createEl("p", {
			cls: "setting-item-description cs-theme-desc",
		});
		const themeListEl = theme.wrapEl.createDiv();
		const themeFold = attachPersistedFold(themeSetting, themeListEl, "theme", ctx.plugin);
		// The section's first row, above its callouts, and the one child of the
		// body the painter does not rebuild — the rows are appended after it.
		// Inside the body, so it folds with the section and the section's
		// trailing gap still falls under whatever comes last.
		const themeSwitch = addThemeStylesSwitch(ctx, themeListEl);

		const my = createStickySection(
			containerEl,
			t("settings.myCalloutTypes"),
		);
		const mySetting = my.setting;
		mySetting.settingEl.addClass("cs-subheader-row", "cs-callout-list-heading");
		// Same divider the "Built-in callouts" section gets below, so the
		// theme-owned group above reads as visually separate from this one
		// when that group is on screen. `renderThemeList` toggles it in step
		// with the theme section's own visibility. On the wrapper rather than
		// the heading — styles.css says why a heading that pins cannot carry
		// its own divider.
		const subSectionEl = my.wrapEl;
		// Discovery first in the DOM, the CTA last, so the CTA lands on the row's
		// outer edge — its right end under LTR, its left under RTL, both times the
		// far side of the row, which is where every other section in this tab puts
		// its primary button and where the reading eye and the thumb arrive last.
		addManualDiscoveryButton(ctx, mySetting.controlEl);
		mySetting.addButton((btn) =>
			btn
				.setButtonText(t("settings.addNewCallout"))
				.setCta()
				.onClick(() => {
					void onAddNewCallout();
				}),
		);

		const userListEl = my.wrapEl.createDiv();
		const userFold = attachPersistedFold(mySetting, userListEl, "user", ctx.plugin);

		// Scan's second copy, for when the heading's line has no room for it: the
		// last thing in the body — under the list, and so under Load more, which
		// is the list's own last child. Inside the body rather than after it,
		// because the body owns the section's whole trailing gap and folds with
		// it (`tests/sectionTrailingGap.test.ts`). It is the one child of the
		// body the painter does not rebuild — a button rebuilt while it has focus
		// makes the pane's scroller clamp and jump, and a scan is followed by
		// exactly that repaint — see `CalloutListsSection`.
		//
		// Which of the two shows is measured, on every device — see
		// `scanPlacement.ts`. Both share one progress state — see
		// `addManualDiscoveryButton`.
		const discoverFooterEl = userListEl.createDiv({ cls: "cs-discover-footer" });
		addManualDiscoveryButton(ctx, discoverFooterEl);
		const scanPlacement = followScanPlacement(
			ctx,
			subSectionEl,
			mySetting.settingEl,
			headerSetting.settingEl,
		);

		// No `cs-subheader-row` here on purpose: this heading is a size larger
		// than the two above it, and that class is what sets their smaller
		// type. The chevron layout rides on `cs-collapsible-heading` instead,
		// which all three headings get from `attachSectionDisclosure`.
		const builtIn = createStickySection(
			containerEl,
			t("settings.builtInCallouts"),
		);
		// Its divider is unconditional — set here because the generic heading
		// rule that used to supply it no longer reaches a wrapped heading. And
		// it is the last one: the gap under a section is kept inside it so the
		// heading stays pinned across it, and this one has nothing to hand over
		// to, so it lets go with its own last row instead.
		builtIn.wrapEl.addClass("cs-section-divider", "cs-sticky-section-last");
		const builtInListEl = builtIn.wrapEl.createDiv();
		const builtInFold = attachPersistedFold(builtIn.setting, builtInListEl, "builtin", ctx.plugin);

	return {
		bannerSlotEl,
		themeSectionEl,
		themeDescEl,
		themeListEl,
		themeFold,
		themeSwitch,
		subSectionEl,
		userListEl,
		discoverFooterEl,
		placeScan: scanPlacement.request,
		userFold,
		builtInListEl,
		builtInFold,
	};
}

/** The switch row, held across repaints. */
export type ThemeStylesSwitch = {
	settingEl: HTMLElement;
	/** Show the saved value — it can change under an open tab (sync, Reset). */
	sync: () => void;
};

/**
 * *Use your theme's callout styles* (`manager/theme/themeCalloutsOff.ts`),
 * under the heading of the section it empties. Off, the theme lists nothing,
 * so the painter keeps the section on screen for the switch's sake alone —
 * see `renderThemeList`.
 */
function addThemeStylesSwitch(
	ctx: SettingsSectionContext,
	bodyEl: HTMLElement,
): ThemeStylesSwitch {
	const styles = () => ctx.plugin.registry.settings.themeCalloutStyles;
	let toggle: ToggleComponent | null = null;
	const setting = new Setting(bodyEl)
		.setName(t("settings.themeCalloutStyles"))
		.setDesc(
			// One short sentence per line.
			createFragment((frag) => {
				t("settings.themeCalloutStylesDesc").split("\n").forEach((line, i) => {
					if (i > 0) frag.createEl("br");
					frag.appendText(line);
				});
			}),
		)
		.addToggle((tg) => {
			toggle = tg.setValue(styles().enabled).onChange((enabled) => {
				if (enabled === styles().enabled) return;
				styles().enabled = enabled;
				ctx.plugin.registry.settingsChanged();
			});
		});
	return {
		settingEl: setting.settingEl,
		sync: () => {
			if (toggle && toggle.getValue() !== styles().enabled) toggle.setValue(styles().enabled);
		},
	};
}
