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
import { Setting } from "obsidian";
import { getSelectableLocales, resolveLocaleFile, setLocale, t } from "../../i18n";
import { ListboxPopup } from "../../ui/listboxPopup";
import type { SettingsSectionContext } from "./types";

type LanguageChoice = {
	code: string;
	name: string;
};

export function renderLanguageSection(
	ctx: SettingsSectionContext,
	containerEl: HTMLElement,
): void {
	new Setting(containerEl).setName(t("settings.language")).setHeading();

	const setting = new Setting(containerEl)
		.setName(t("settings.language"))
		.setClass("cs-language-setting")
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
		},
	});
	picker.setSelected(ctx.plugin.settings.language);
	renderLanguageWidthSizer(picker.el, languageChoices());
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
 * Let CSS size the closed picker from the widest translated option.
 *
 * The popup is absolutely positioned, so its rows cannot contribute to the
 * combobox's intrinsic width. These overlapping, hidden labels can: CSS takes
 * the widest one without us guessing at glyph widths in proportional fonts.
 */
function renderLanguageWidthSizer(
	containerEl: HTMLElement,
	choices: readonly LanguageChoice[],
): void {
	const sizerEl = containerEl.createDiv({
		cls: "cs-language-width-sizer",
		attr: { "aria-hidden": "true" },
	});
	for (const choice of choices) {
		sizerEl.createSpan({ text: choice.name });
	}

	const widestLabel = Math.max(
		...Array.from(sizerEl.children, (labelEl) =>
			Math.ceil((labelEl as HTMLElement).scrollWidth),
		),
	);
	if (widestLabel > 0) {
		containerEl.style.setProperty(
			"--cs-language-picker-width",
			`${widestLabel}px`,
		);
	}
}

function languageChoices(): LanguageChoice[] {
	return [
		{ code: "auto", name: t("settings.languageAuto") },
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

function renderLanguageRow(rowEl: HTMLElement, choice: LanguageChoice): void {
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
	if (!resolveLocaleFile(pref) || ctx.plugin.locales.isReady(pref)) return;

	const name =
		getSelectableLocales().find(({ code }) => code === pref)?.name ??
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
