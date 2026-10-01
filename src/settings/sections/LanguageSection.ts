/**
 * settings/sections/LanguageSection.ts — UI display language selector.
 *
 * Renders a dropdown that lets the user pick the plugin's display language.
 * It lists languages and nothing else, each under its own native name (e.g.
 * "עברית", not "Hebrew"). There is no "Automatic" row: following Obsidian is
 * what the picker does until told otherwise, so it simply shows the language
 * Obsidian is in, and the reset arrow appears once the language shown differs
 * from it. The choice is persisted in PluginSettings and re-rendering the tab
 * refreshes every label in the new language.
 *
 * The saved value kept its old shape when the row went: `"auto"` (the default)
 * follows Obsidian, a locale code pins one. An upgrade reads every saved value
 * as before and rewrites none. "The same as Obsidian" is decided on screen and
 * never written back, because Obsidian's language belongs to the device while
 * data.json syncs: a code pinned on one device can match Obsidian there and
 * differ from it on the next.
 *
 * Only English is bundled, so picking a language may have to fetch it first
 * (see i18n/LocaleStore.ts). Every language is offered whether or not it is
 * downloaded: choosing one is what triggers the download, and the list would be
 * useless if it only showed what the user already had. When the fetch cannot
 * happen — offline, or a blocked CDN — the choice is still kept and the UI
 * stays English until it succeeds, which is the honest outcome. Silently
 * reverting the dropdown would look like the click had not registered.
 */
import { Setting } from "obsidian";
import { DEFAULT_SETTINGS } from "../../constants";
import { getSelectableLocales, resolveLocaleFile, setLocale, t } from "../../i18n";
import { ListboxPopup } from "../../ui/listboxPopup";
import { addFieldResetButton } from "../editor/fieldResetButton";
import type { SettingsSectionContext } from "./types";

type LanguageChoice = {
	code: string;
	name: string;
};

/** The saved preference that follows Obsidian's interface language. */
const FOLLOW_OBSIDIAN = DEFAULT_SETTINGS.language;

/** The row for everything English covers: no file, nothing to download. */
const ENGLISH = "en";

export function renderLanguageSection(
	ctx: SettingsSectionContext,
	containerEl: HTMLElement,
): void {
	new Setting(containerEl).setName(t("settings.language")).setHeading();

	const setting = new Setting(containerEl)
		.setName(t("settings.language"))
		.setClass("cs-language-setting")
		.setClass("cs-reset-setting")
		.setDesc(t("settings.languageDesc"));

	const picker = new ListboxPopup<LanguageChoice>(setting.controlEl, {
		ariaLabel: t("settings.language"),
		placeholder: t("settings.language"),
		emptyText: () => "",
		itemsFor: (query) => filterLanguageChoices(query),
		renderRow: renderLanguageRow,
		labelOf: (choice) => choice.name,
		keyOf: (choice) => choice.code,
		searchable: false,
		onCommit: (choice) => {
			const current = ctx.plugin.settings.language;
			const next = preferenceFor(current, choice.code);
			// Nothing changed and nothing is missing: no save, no redraw. A
			// language still waiting for its download goes through again,
			// which makes re-picking it a retry.
			if (next === current && ctx.plugin.locales.isReady(next)) return;
			void setLanguage(ctx, setting, picker, next);
			syncReset();
		},
	});
	picker.setSelected(shownLanguage(ctx.plugin.settings.language));
	const syncReset = addFieldResetButton(
		setting,
		`${t("settings.resetAction")}: ${t("settings.language")}`,
		() => showsObsidianLanguage(ctx.plugin.settings.language),
		() => {
			picker.setSelected(shownLanguage(FOLLOW_OBSIDIAN));
			void setLanguage(ctx, setting, picker, FOLLOW_OBSIDIAN);
		},
	);
	renderLanguageWidthSizer(picker.el, setting.controlEl, getSelectableLocales());
	observeLanguageSettingLayout(ctx, setting);
	ctx.registerDisposer(() => picker.destroy());

	renderUnavailableWarning(ctx, containerEl);
}

/**
 * Follow Obsidian's actual setting-row layout instead of copying its current
 * breakpoint. Core and themes are free to change that breakpoint; the picker
 * only needs to know whether its own row has already stacked.
 */
function observeLanguageSettingLayout(
	ctx: SettingsSectionContext,
	setting: Setting,
): void {
	const sync = (): void => {
		setting.settingEl.toggleClass(
			"cs-language-setting-stacked",
			getComputedStyle(setting.settingEl).flexDirection === "column",
		);
	};

	sync();
	const observer = new ResizeObserver(sync);
	observer.observe(setting.settingEl);
	ctx.registerDisposer(() => observer.disconnect());
}

/**
 * Size the control column from the widest translated option.
 *
 * The popup is absolutely positioned and exactly as wide as the picker, so its
 * rows cannot contribute to the column's width. These overlapping, hidden
 * labels can: each is measured at its own width, without us guessing at glyph
 * widths in proportional fonts. The column also keeps room for the reset arrow
 * whether or not it shows, so the arrow never takes that room from the labels.
 */
function renderLanguageWidthSizer(
	containerEl: HTMLElement,
	controlEl: HTMLElement,
	choices: readonly LanguageChoice[],
): void {
	const sizerEl = containerEl.createDiv({
		cls: "cs-language-width-sizer",
		attr: { "aria-hidden": "true" },
	});
	for (const choice of choices) sizerEl.createSpan({ text: choice.name });

	// Fractional widths, rounded up once at the end: `scrollWidth` rounds to
	// the nearest pixel, which could leave a label half a pixel short.
	const widestLabel = Math.max(
		...Array.from(sizerEl.children, (labelEl) => labelEl.getBoundingClientRect().width),
	);
	if (widestLabel > 0) {
		controlEl.style.setProperty(
			"--cs-language-control-width",
			`${Math.ceil(widestLabel + resetSlotWidth(controlEl))}px`,
		);
	}
}

/**
 * The reset arrow's width plus its gap, measured whether or not it is showing.
 *
 * It is hidden (`display: none`, so no box) while the picker shows Obsidian's
 * language, and it appears as soon as another language is committed, before
 * the tab redraws. Showing it for this one synchronous read paints nothing in
 * between.
 */
function resetSlotWidth(controlEl: HTMLElement): number {
	const resetEl = controlEl.querySelector<HTMLElement>(".clickable-icon");
	if (!resetEl) return 0;
	const hidden = resetEl.hasClass("cs-hidden");
	resetEl.removeClass("cs-hidden");
	const width = resetEl.getBoundingClientRect().width;
	resetEl.toggleClass("cs-hidden", hidden);
	if (width <= 0) return 0;
	const gap = parseFloat(getComputedStyle(controlEl).columnGap);
	return width + (Number.isFinite(gap) ? gap : 0);
}

function filterLanguageChoices(query: string): LanguageChoice[] {
	const q = query.trim().toLocaleLowerCase();
	const choices = getSelectableLocales();
	if (!q) return choices;
	return choices.filter(
		(choice) =>
			choice.name.toLocaleLowerCase().includes(q) ||
			choice.code.toLocaleLowerCase().includes(q),
	);
}

/** Every row is just the language's own name. */
function renderLanguageRow(rowEl: HTMLElement, choice: LanguageChoice): void {
	rowEl.createDiv({ cls: "cs-language-option-label", text: choice.name });
}

/**
 * The row a saved preference shows as: the language it renders in.
 *
 * Matched by locale file, so `"auto"`, aliases such as `no` and `zh-hk`, and a
 * code no row offers all land on a real row instead of an empty picker. That
 * last one is a value written by a newer or older version on another device,
 * or by hand. Whatever English covers shows as English, since that is what
 * the user is reading.
 */
function shownLanguage(pref: string): string {
	const file = resolveLocaleFile(pref);
	if (file === null) return ENGLISH;
	return getSelectableLocales().find(({ code }) => resolveLocaleFile(code) === file)?.code ?? ENGLISH;
}

/**
 * Does this preference show the language Obsidian is in? Then, as far as
 * this device can tell, it is the default, and there is nothing to reset.
 *
 * A pinned code can pass. That is an upgrade from the Automatic row, where
 * someone pinned the very language Obsidian uses. Their arrow stays hidden
 * while the two agree and comes back if Obsidian's language moves, on this
 * device or on another one.
 */
function showsObsidianLanguage(pref: string): boolean {
	return resolveLocaleFile(pref) === resolveLocaleFile(FOLLOW_OBSIDIAN);
}

/**
 * What picking the row `code` saves, given the preference saved now.
 *
 * - The row already shown keeps the preference as it is. Re-picking it must
 *   not turn a pinned language into "follow Obsidian" behind the user's back:
 *   the two look the same here, but a synced device whose Obsidian speaks
 *   another language would see the difference.
 * - Obsidian's own language follows Obsidian again, exactly as the reset
 *   arrow would.
 * - Any other row pins that language.
 */
function preferenceFor(current: string, code: string): string {
	if (code === shownLanguage(current)) return current;
	return showsObsidianLanguage(code) ? FOLLOW_OBSIDIAN : code;
}

function languageName(code: string): string {
	return getSelectableLocales().find((choice) => choice.code === code)?.name ?? code;
}

async function setLanguage(
	ctx: SettingsSectionContext,
	setting: Setting,
	picker: ListboxPopup<LanguageChoice>,
	val: string,
): Promise<void> {
	ctx.plugin.settings.language = val;
	await ctx.plugin.saveSettings();

	// Nothing to fetch for English, or for a language already on disk —
	// the common case, and it must not flicker a spinner.
	if (ctx.plugin.locales.isReady(val)) {
		setLocale(val);
		ctx.display();
		ctx.plugin.applyLocaleChange();
		return;
	}

	picker.setDisabled(true);
	setting.setDesc(t("locale.downloading"));
	// ensureLocale applies the new language itself, including the
	// command names and the rendered notes, so there is nothing to do
	// here but redraw: on success every label has changed language, and
	// on failure the warning below has to replace the "Downloading…"
	// text this row is still showing.
	await ctx.plugin.ensureLocale();
	ctx.display();
}

/**
 * Explain a language that is selected but not downloaded, and offer a retry.
 *
 * Drawn from settings rather than from the download's failure path, so it is
 * still there after the tab is closed and reopened — the state it describes
 * outlives the click that produced it.
 */
function renderUnavailableWarning(
	ctx: SettingsSectionContext,
	containerEl: HTMLElement,
): void {
	const pref = ctx.plugin.settings.language;
	const file = resolveLocaleFile(pref);
	if (!file || ctx.plugin.locales.isReady(pref)) return;

	// Name the language that is missing, also while following Obsidian
	// ("עברית is not downloaded yet"). Named after the row the picker shows,
	// since codes such as `zh-hk` and `no` are served by another code's file.
	const name = languageName(shownLanguage(pref));

	new Setting(containerEl)
		.setClass("callout-studio-locale-warning")
		.setName(t("locale.notDownloaded", { name }))
		.setDesc(t("locale.notDownloadedDesc"))
		.addButton((btn) =>
			btn
				.setButtonText(t("locale.retry"))
				.setCta()
				.onClick(async () => {
					btn.setDisabled(true);
					btn.setButtonText(t("locale.downloading"));
					await ctx.plugin.ensureLocale();
					ctx.display();
				}),
		);
}
