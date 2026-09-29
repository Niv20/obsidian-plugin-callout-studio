/**
 * settings/sections/LanguageSection.ts — UI display language selector.
 *
 * Renders a dropdown that lets the user pick the plugin's display language.
 * The default ("auto") follows Obsidian's interface language; any other value
 * forces a specific locale. Each language is listed under its own native name
 * (e.g. "עברית", not "Hebrew"). The choice is persisted in PluginSettings and
 * re-rendering the tab refreshes every label in the new language.
 *
 * Only English is bundled, so picking a language may have to fetch it first
 * (see i18n/LocaleStore.ts). Every language is offered whether or not it is
 * downloaded: choosing one is what triggers the download, and the list would be
 * useless if it only showed what the user already had. When the fetch cannot
 * happen — offline, or a blocked CDN — the choice is still kept and the UI
 * stays English until it succeeds, which is the honest outcome. Silently
 * reverting the dropdown would look like the click had not registered.
 */
import { Setting, setIcon } from "obsidian";
import { DEFAULT_SETTINGS } from "../../constants";
import { getSelectableLocales, resolveLocaleFile, setLocale, t } from "../../i18n";
import { ListboxPopup } from "../../ui/listboxPopup";
import { addFieldResetButton } from "../editor/fieldResetButton";
import type { SettingsSectionContext } from "./types";

type LanguageChoice = {
	code: string;
	name: string;
};

/** The choice that follows Obsidian's interface language instead of naming one. */
const AUTO_LANGUAGE = "auto";

/**
 * Marks the Automatic row as a mode rather than a language. A globe because it
 * is symmetric: a right-to-left interface mirrors every icon, and this one
 * reads the same either way.
 */
const AUTO_LANGUAGE_ICON = "globe";

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
			void setLanguage(ctx, setting, picker, choice.code);
			syncReset();
		},
	});
	picker.setSelected(ctx.plugin.settings.language);
	const syncReset = addFieldResetButton(
		setting,
		`${t("settings.resetAction")}: ${t("settings.language")}`,
		() => ctx.plugin.settings.language === DEFAULT_SETTINGS.language,
		() => {
			picker.setSelected(DEFAULT_SETTINGS.language);
			void setLanguage(ctx, setting, picker, DEFAULT_SETTINGS.language);
		},
	);
	renderLanguageWidthSizer(picker.el, setting.controlEl, languageChoices());
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
	for (const choice of choices) {
		const labelEl = sizerEl.createSpan({ text: choice.name });
		// Its menu row also carries the icon, so it needs more room than its text.
		if (choice.code === AUTO_LANGUAGE) labelEl.addClass("cs-language-width-sizer-auto");
	}

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
 * It is hidden (`display: none`, so no box) while Automatic is selected, and it
 * appears as soon as another language is committed, before the tab redraws.
 * Showing it for this one synchronous read paints nothing in between.
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

function languageChoices(): LanguageChoice[] {
	return [
		{ code: AUTO_LANGUAGE, name: t("settings.languageAuto") },
		...getSelectableLocales(),
	];
}

function filterLanguageChoices(query: string): LanguageChoice[] {
	const q = query.trim().toLocaleLowerCase();
	const choices = languageChoices();
	if (!q) return choices;
	return choices.filter(
		(choice) =>
			choice.name.toLocaleLowerCase().includes(q) ||
			choice.code.toLocaleLowerCase().includes(q),
	);
}

/**
 * Automatic is a mode, not a language, so its row gets an icon and a rule
 * below it. Every other row is just the language's own name.
 */
function renderLanguageRow(rowEl: HTMLElement, choice: LanguageChoice): void {
	if (choice.code === AUTO_LANGUAGE) {
		rowEl.addClass("cs-language-option-auto");
		setIcon(rowEl.createSpan({ cls: "cs-language-option-icon" }), AUTO_LANGUAGE_ICON);
	}
	rowEl.createDiv({ cls: "cs-language-option-label", text: choice.name });
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

	// Name the language that is missing, including under Automatic ("עברית is
	// not downloaded yet", not "Automatic is…"). Matched by file, since codes
	// such as `zh-hk` and `no` are served by another code's file.
	const name =
		getSelectableLocales().find(({ code }) => resolveLocaleFile(code) === file)?.name ??
		t("settings.languageAuto");

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
