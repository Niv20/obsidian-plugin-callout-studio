/**
 * settings/paletteCombobox.ts — the Color row's picker.
 *
 * The palette dropdown was the plugin's *best* picker in one way — it drew real
 * swatches, grouped and named — and its worst in another: it was a button, so
 * the only way to reach a palette was to scroll to it. This is the same list on
 * the shared {@link ListboxPopup}, so it can be typed into like every other
 * callout picker, and it lives here rather than inline in `CalloutEditor.ts`
 * because that file is at its size ceiling.
 *
 * ## What stays behind in the editor, and why
 *
 * Only the *control* moved. The editor keeps everything that decides what the
 * control should say: which palette the form's colours resolve to, the
 * "Deleted color" state when they resolve to none, reviving that palette, and
 * the save-state baseline that the resolution feeds. Those all read and write
 * editor state, and pulling them here would have meant handing this module the
 * editor — which is not an extraction, only a longer argument list.
 *
 * So the editor drives this through {@link PaletteCombobox.setLabel} and
 * {@link PaletteCombobox.renderLead} and is told about choices through the
 * callbacks. It never has to know the popup exists.
 */
import { t } from "../i18n";
import { renderColorCircles, resolveCurrentModeColors } from "../ui/ColorCircles";
import { ListboxPopup } from "../ui/listboxPopup";
import type { ColorPalette } from "../utils/colorPalettes";

export interface PaletteEntry {
	id: string;
	name: string;
	group: ColorPalette["group"];
	palette: ColorPalette;
}

export interface PaletteComboboxOptions {
	/**
	 * Rebuilt on every open, so a palette saved mid-session appears without the
	 * editor having to notice that it did.
	 */
	entries(): readonly PaletteEntry[];
	/**
	 * The highlight moved. Previews the colour on the callout without
	 * committing it — `null` puts the preview back.
	 */
	onPreview(palette: ColorPalette | null): void;
	onCommit(entry: PaletteEntry): void;
	/** "+ New color…" — opens the palette editor. */
	onNewColor(name: string): void;
}

const GROUP_LABEL_KEYS: Record<ColorPalette["group"], string> = {
	custom: "editor.paletteGroupCustom",
	obsidian: "editor.paletteGroupObsidian",
	preset: "editor.paletteGroupPresets",
};

export class PaletteCombobox {
	private readonly popup: ListboxPopup<PaletteEntry>;
	private readonly options: PaletteComboboxOptions;

	constructor(parent: HTMLElement, options: PaletteComboboxOptions) {
		this.options = options;

		this.popup = new ListboxPopup<PaletteEntry>(parent, {
			ariaLabel: t("editor.colors"),
			placeholder: t("editor.paletteSearchPlaceholder"),
			emptyText: (query) => t("editor.paletteNoMatches", { query }),
			itemsFor: (query) => this.matching(query),
			renderRow: (rowEl, entry) => {
				// The row's layout — flex, centred, gapped — lives on
				// `cs-palette-menu-item`, and it has to be added here: the popup
				// gives every row only `cs-combobox-option`, which carries state
				// colours and no layout. Without this the swatch and the name
				// stack as two blocks and the label's `flex: 1` floats free of
				// any flex parent, which is what made this menu look smeared.
				rowEl.addClass("cs-palette-menu-item");
				renderColorCircles(rowEl, resolveCurrentModeColors(entry.palette), {
					size: 16,
				});
				rowEl.createSpan({
					cls: "cs-palette-menu-item-label",
					text: entry.name,
				});
			},
			// Custom palettes are user-named and listed A→Z; the preset groups
			// keep their curated order. `entries()` already returns them so.
			groupOf: (entry) => ({
				key: entry.group,
				label: t(GROUP_LABEL_KEYS[entry.group] ?? ""),
			}),
			labelOf: (entry) => entry.name,
			keyOf: (entry) => entry.id,
			onCommit: (entry) => options.onCommit(entry),
			onHighlight: (entry) => options.onPreview(entry?.palette ?? null),
			emptyAction: {
			label: (query) => t("autocomplete.createNew", { name: query.trim() }),
				onSelect: (query) => options.onNewColor(query.trim()),
			},
		});
		this.popup.el.addClass("cs-palette-combobox");
	}

	/**
	 * The palettes whose name contains `query`, in `entries()` order.
	 *
	 * Name only: a palette has no ids or aliases to search, and matching on the
	 * hex would answer a question nobody types.
	 */
	private matching(query: string): PaletteEntry[] {
		const all = [...this.options.entries()];
		const q = query.trim().toLowerCase();
		if (q === "") return all;
		return all.filter((entry) => entry.name.toLowerCase().includes(q));
	}

	/**
	 * Point the picker at `id` and put `label` in the field.
	 *
	 * The two are given together because they can legitimately disagree: an
	 * orphaned callout resolves to no palette at all and still has to read
	 * "Deleted color" rather than empty. The editor is the only thing that
	 * knows which case it is in, so it says both.
	 */
	setSelection(id: string, label: string): void {
		this.popup.setSelected(id);
		this.popup.inputEl.value = label;
	}

	/** Draw the swatch left of the field, from the form's own colours. */
	renderLead(colors: Parameters<typeof renderColorCircles>[1]): void {
		this.popup.leadEl.empty();
		renderColorCircles(this.popup.leadEl, colors, { size: 16 });
	}

	/**
	 * Shut the list without choosing — for the editor's own reasons: another
	 * popup is opening, or a modal is about to take over the screen.
	 */
	close(): void {
		this.popup.close();
	}

	/** Must be called — see {@link ListboxPopup.destroy}. */
	destroy(): void {
		this.popup.destroy();
	}
}
