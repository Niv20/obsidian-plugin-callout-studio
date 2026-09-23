import { ListboxPopup } from "./listboxPopup";

export interface SelectOption { value: string; label: string; }

/** A finite choice using the same popup, keyboard support and theme as pickers. */
export class SelectDropdown {
	readonly el: HTMLElement;
	readonly inputEl: HTMLInputElement;
	private readonly popup: ListboxPopup<SelectOption>;
	private readonly widthSizer: HTMLElement;
	private options: SelectOption[] = [];
	private value = "";
	private change?: (value: string) => void;

	constructor(parent: HTMLElement, ariaLabel: string) {
		this.popup = new ListboxPopup(parent, {
			ariaLabel, placeholder: "", searchable: false,
			itemsFor: () => this.options,
			keyOf: (option) => option.value,
			labelOf: (option) => option.label,
			emptyText: () => "",
			renderRow: (row, option) => {
				row.createSpan({ cls: "cs-dropdown-option-label", text: option.label });
			},
			onCommit: (option) => {
				if (option.value === this.value) return;
				this.value = option.value;
				this.change?.(option.value);
			},
		});
		this.el = this.popup.el;
		this.el.addClass("cs-select-dropdown");
		this.inputEl = this.popup.inputEl;
		this.widthSizer = this.el.createDiv({
			cls: "cs-dropdown-width-sizer", attr: { "aria-hidden": "true" },
		});
	}

	addOption(value: string, label: string): this {
		const options = this.options.filter((option) => option.value !== value);
		return this.setOptions([...options, { value, label }]);
	}

	addOptions(options: Readonly<Record<string, string>>): this {
		for (const [value, label] of Object.entries(options)) this.addOption(value, label);
		return this;
	}

	/** Replace live choices, keeping a valid value or selecting the first one. */
	setOptions(options: readonly SelectOption[]): this {
		this.options = options.map((option) => ({ ...option }));
		this.widthSizer.empty();
		for (const option of this.options) this.widthSizer.createSpan({ text: option.label });
		this.setValue(this.options.some((option) => option.value === this.value)
			? this.value : this.options[0]?.value ?? "");
		this.popup.setItems();
		return this;
	}

	setValue(value: string): this {
		this.value = this.options.some((option) => option.value === value) ? value : "";
		this.popup.setSelected(this.value);
		return this;
	}
	getValue(): string { return this.value; }
	setDisabled(disabled: boolean): this { this.popup.setDisabled(disabled); return this; }
	onChange(callback: (value: string) => void): this { this.change = callback; return this; }
	close(): void { this.popup.close(); }
	destroy(): void { this.popup.destroy(); }
}
