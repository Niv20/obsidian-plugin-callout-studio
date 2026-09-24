/** The icon pack toolbar's selection-only filters. */
import type { IconPack, IconVariantSpec, IconVariantState } from "../../icons/types";
import { t } from "../../i18n";
import { ListboxPopup } from "../../ui/listboxPopup";
import { SelectDropdown } from "../../ui/selectDropdown";

type VariantSelectSpec = Extract<IconVariantSpec, { kind: "select" }>;
type VariantKind = "select" | "skin-tone";
interface ToolbarPicker {
	setDisabled(disabled: boolean): void;
	destroy(): void;
}

/** Raised hands show the effect of each emoji skin tone in both field and menu. */
const SKIN_TONE_SAMPLES = ["✋", "✋🏻", "✋🏼", "✋🏽", "✋🏾", "✋🏿"];

export interface PackToolbarFilterCallbacks {
	onCategory(category: string): void;
	onVariant(variants: IconVariantState, kind: VariantKind): void;
}

export class PackToolbarFilters {
	private readonly pickers: ToolbarPicker[] = [];
	private categoryPicker: SelectDropdown | null = null;
	private toneLead: HTMLElement | null = null;
	private variants: IconVariantState;
	private category: string;

	constructor(
		private readonly toolbarEl: HTMLElement,
		pack: IconPack,
		variants: IconVariantState,
		category: string,
		private readonly callbacks: PackToolbarFilterCallbacks,
	) {
		this.variants = { ...variants };
		this.category = category;
		for (const spec of pack.variants ?? []) {
			if (spec.kind === "select") this.buildVariant(spec);
			else this.buildSkinTone();
		}
		if (pack.hasCategories) this.buildCategory();
	}

	private buildVariant(spec: VariantSelectSpec): void {
		const choices = spec.options.map((value, index) => ({
			value,
			label: spec.optionLabelKeys?.[index]
				? t(spec.optionLabelKeys[index]) : String(value),
		}));
		const picker = new SelectDropdown(this.toolbarEl, t(spec.labelKey))
			.setOptions(choices.map((choice) => ({
				value: String(choice.value), label: choice.label,
			})));
		picker.onChange((raw) => {
			const choice = choices.find((option) => String(option.value) === raw);
			if (!choice) return;
			this.variants = { ...this.variants, [spec.key]: choice.value };
			this.callbacks.onVariant({ ...this.variants }, "select");
		});
		picker.el.addClass("icon-picker-filter", "icon-picker-variant-picker", `icon-picker-${spec.key}-select`);
		const current = this.variants[spec.key];
		if (choices.some((choice) => String(choice.value) === String(current))) picker.setValue(String(current));
		this.pickers.push(picker);
	}

	private buildCategory(): void {
		const picker = new SelectDropdown(this.toolbarEl, t("iconPicker.allCategories"))
			.addOption("", t("iconPicker.allCategories"));
		picker.onChange((value) => {
			this.category = value;
			this.callbacks.onCategory(value);
		});
		picker.el.addClass("icon-picker-filter", "icon-picker-category-picker");
		this.categoryPicker = picker;
		this.pickers.push(picker);
	}

	private buildSkinTone(): void {
		const choices = SKIN_TONE_SAMPLES.map((sample, tone) => ({
			value: tone,
			label: tone === 0 ? t("settings.fallbackTag")
				: `${t("iconPicker.skinTone")} ${tone}`,
			sample,
		}));
		const picker = new ListboxPopup(this.toolbarEl, {
			ariaLabel: t("iconPicker.skinTone"),
			placeholder: "",
			searchable: false,
			itemsFor: () => choices,
			keyOf: (choice) => String(choice.value),
			labelOf: (choice) => choice.label,
			renderRow: (row, choice) => {
				row.createSpan({ cls: "icon-picker-skin-tone-sample", text: choice.sample });
				row.createSpan({ cls: "icon-picker-skin-tone-label", text: choice.label });
			},
			emptyText: () => "",
			onCommit: (choice) => {
				this.variants = { ...this.variants, emojiSkinTone: choice.value };
				this.paintToneSample(choice.sample);
				this.callbacks.onVariant({ ...this.variants }, "skin-tone");
			},
		});
		picker.el.addClass("icon-picker-filter", "icon-picker-skin-tone-picker");
		const tone = this.variants.emojiSkinTone ?? 0;
		picker.setSelected(String(tone));
		this.toneLead = picker.leadEl;
		this.paintToneSample(SKIN_TONE_SAMPLES[tone] ?? "✋");
		this.pickers.push(picker);
	}

	private paintToneSample(sample: string): void {
		this.toneLead?.setText(sample);
	}

	/** Refresh after the bundled search index reveals this pack's categories. */
	setCategories(categories: readonly string[]): string {
		if (this.category && !categories.includes(this.category)) this.category = "";
		this.categoryPicker?.setOptions([
			{ value: "", label: t("iconPicker.allCategories") },
			...categories.map((value) => ({ value, label: t(`iconPicker.cat.${value}`) })),
		]).setValue(this.category);
		return this.category;
	}

	setEnabled(enabled: boolean): void {
		for (const picker of this.pickers) picker.setDisabled(!enabled);
	}

	destroy(): void {
		for (const picker of this.pickers) picker.destroy();
	}
}
