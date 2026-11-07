/**
 * settings/PaletteEditorModal.ts — Create/edit a custom color palette.
 *
 * Modal opened from the "Saved color palettes" settings section. Two-column
 * body: a sticky live preview on the left, and on the right two Obsidian
 * setting groups (`SettingGroup`: a heading, one rounded box, inset lines
 * between the rows; finding S7-05) — a fixed "Palette" group (name +
 * background style) above a "Colors" group whose rows are rebuilt for
 * whatever the style dropdown is set to. Default (simple)
 * mode: the user picks ONE
 * base color and the full palette — light/dark accents, backgrounds, text —
 * is auto-derived with contrast correction (see derivePaletteFromColor). The
 * background style is a 2-way choice: solid or a two-stop linear gradient
 * (preset directions). For the gradient, the user picks one "second color"
 * whose light/dark tints are derived like the background's, and an
 * off-by-default toggle extends the sweep through the title text of all three
 * render roles. Under Solid, a button in the Colors heading swaps the base
 * color for separate Accent/Background/Text colors, which light and dark mode
 * each keep their own of; the sun/moon button beside it shows all of Obsidian
 * in the other mode while the editor is open (paletteModeButton.ts). Resolves
 * the palette (without id) on save, or null on cancel/close.
 */
import { Modal, Setting, SettingGroup } from "obsidian";
import type { App, EventRef } from "obsidian";
import type { BgGradient, CalloutDefinition, CustomPalette } from "../types";
import {
	bgTintFor,
	contrastRatio,
	DEFAULT_BG_INTENSITY_GRADIENT,
	DEFAULT_BG_INTENSITY_SOLID,
	derivePaletteFromColor,
	MAX_BG_COLOR_AMOUNT,
	MIN_BG_COLOR_AMOUNT,
	rotateHue,
	type DerivedPalette,
} from "../utils/colorUtils";
import { createColorSwatchInput } from "../ui/ColorSwatchInput";
import { explainIfBlocked, paintBlocked } from "../ui/blockedButton";
import { renderInlineLinkHint } from "../ui/inlineLinkHint";
import { addColorViewButton, type ColorView } from "./paletteColorViewButton";
import { addModeButton, showMode } from "./paletteModeButton";
import { contrastBadgeIn, contrastLineAfter } from "./paletteContrastLine";
import { linesFragment } from "../ui/textLines";
import type { SelectDropdown } from "../ui/selectDropdown";
import { buildPaletteBgStyleRow, type BgStyle } from "./paletteBgStyleRow";
import { renderBaseColorRow, seedBaseColor, unclaimedBaseColor } from "./paletteBaseColorRow";
import { renderDirectionPicker } from "./paletteDirectionPicker";
import { LiveCalloutPreview } from "./LiveCalloutPreview";
import { dedupeColorName, normalizeName, suggestColorName } from "../utils/colorNames";
import { paletteMetadataKey } from "../utils/calloutMetadata";
import {
	customPaletteToColorPalette,
	getAllColorPalettes,
	palettesVisuallyEqual,
	type ColorPalette,
} from "../utils/colorPalettes";
import { t } from "../i18n";
import type { CalloutRegistry, PreviewDraft } from "../manager/CalloutRegistry";
import type { CSSInjector } from "../manager/CSSInjector";
import { addCancelButton, applyModalChrome, removeModalChrome } from "./modalChrome";
import { autofocusOnDesktop } from "./modalAutofocus";
import { setSliderDisplay } from "./styleControls";

export type PaletteEditorResult = Omit<CustomPalette, "id">;

/**
 * Whether Save may go ahead with `draft`. `stillOpen` turns false once the
 * editor has closed, so a question that takes a moment to prepare is not put
 * to a save nobody is waiting for.
 */
export type PaletteBeforeSave = (draft: PaletteEditorResult, stillOpen: () => boolean) => Promise<boolean>;

/** Minimal plugin surface the palette editor needs to drive the live preview. */
interface PaletteEditorPlugin {
	app: App;
	registry: CalloutRegistry;
	cssInjector: CSSInjector;
}

/**
 * Reserved id for the stand-in callout this modal previews the palette on, in
 * the same spirit as the style pages' `STYLE_DEMO_ID` (stylePreview.ts).
 * Registered only while the modal is open; if a user callout ever occupies the
 * same id, the preview slot shadows and later restores it.
 *
 * Deliberately NOT `PREVIEW_PLACEHOLDER_ID`: the registry's preview slot feeds
 * `getAll()`, which is what CSSInjector generates from, and it never consults
 * the `isDemo` flag (that only keeps the row out of the settings lists). So
 * whatever id this demo takes gets globally restyled for as long as the modal
 * is open — and that placeholder is `example`, a shipped built-in present in
 * every vault, so every real `[!example]` in the vault used to flicker through
 * each intermediate palette as the sliders moved.
 */
const PALETTE_DEMO_ID = "palette-demo";

const DEFAULT_BASE_COLOR = "#448aff";
/** Keeps the name readable in the dropdown/list rows, which truncate past this. */
const MAX_NAME_LENGTH = 30;

/** Top-left → bottom-right, the classic presentation-software default. */
const DEFAULT_GRADIENT_ANGLE = 135;
/** Hue offset for the auto-suggested gradient second color. */
const GRADIENT_HUE_SHIFT = 45;

export class PaletteEditorModal extends Modal {
	private existing: CustomPalette | null;
	/**
	 * Normalized names of every other palette (custom AND built-in presets),
	 * less a preset name this palette was already saved under.
	 */
	private takenNames: Set<string>;
	/**
	 * The metadata words of the other SAVED palettes — `[!type|comic-red]`.
	 * Two names can differ and still kebab-case alike ("Blue 2", "blue-2"),
	 * and only one palette can answer to a word. The built-in colours are not
	 * here: a palette may take a built-in's word, and wins it (see
	 * `metadataColorEntries`).
	 */
	private takenMetadataKeys: Set<string>;
	private metadataKeyEl: HTMLElement | null = null;
	/**
	 * Every other palette (custom AND built-in presets) this one may not
	 * duplicate, less a preset whose colours this palette was already saved with.
	 */
	private takenColors: ColorPalette[];
	/** The palette the current colors duplicate, if any; blocks Save while set. */
	private colorClash: ColorPalette | null = null;
	private onUseExisting: ((paletteId: string, name: string) => void) | null;
	private beforeSave: PaletteBeforeSave | null;
	/** Save was pressed and `beforeSave` has not answered yet. */
	private confirming = false;
	private name: string;
	private baseColor: string;
	private colors: DerivedPalette;
	private bgStyle: BgStyle;
	/** How strongly the background color shows; steers all bg-tint derivation. */
	private bgIntensity: number;
	/** Once the user drags the slider, style toggles stop overwriting it with a per-style default. */
	private bgIntensityTouched: boolean;
	/**
	 * Whether the color section shows the advanced per-color grid instead of
	 * the single Base color control. Only takes effect while `bgStyle` is
	 * "solid" (see renderColorSection).
	 *
	 * The two directions are deliberately not symmetric. Turning it ON is a
	 * pure view switch — the grid opens on the six colors Base color already
	 * derived, so there is nothing to convert. Turning it OFF is the "Revert"
	 * link, and reverting to a single base color means the palette really does
	 * go back to that color's derivation (see buildAdvancedColorRows); leaving
	 * the hand-edited channels in place would show the base color in the row
	 * while painting something else.
	 */
	private advancedColors: boolean;
	/**
	 * The "Colors" group's box of rows (`SettingGroup.listEl`). Its heading
	 * stays put; renderColorSection() rebuilds the rows in it.
	 */
	private colorCardEl: HTMLElement | null = null;
	/**
	 * The "Colors" group itself, whose heading names the mode while the
	 * separate colors are showing (see renderColorSection()).
	 */
	private colorGroup: SettingGroup | null = null;
	/**
	 * Every row renderColorSection() has put in the box, so the next pass can
	 * take them out again. They are direct children of the box, which is what
	 * lets Obsidian's own divider rule draw the lines between them (a row's
	 * `::before`, left off the box's first child).
	 */
	private colorCardRows: HTMLElement[] = [];
	/** Repaints the button in the "Colors" heading for the view on show. */
	private paintColorViewButton: ((view: ColorView) => void) | null = null;
	/**
	 * Whether Obsidian is showing dark mode — the mode whose colors the
	 * separate Accent/Background/Text rows edit. The mode button at the end of
	 * the "Colors" heading switches it (see paletteModeButton.ts); set from the
	 * app when the editor opens.
	 */
	private shownDark = false;
	/** The mode Obsidian was in before the button switched it; put back on close. */
	private appDark = false;
	/** Repaints the mode button for the mode on show. */
	private paintModeButton: ((dark: boolean) => void) | null = null;
	/** Obsidian's `css-change`, while the editor is open. */
	private cssChangeRef: EventRef | null = null;
	// Gradient state. The end (stop-2) colors are tints of gradientToBase,
	// derived exactly like the six colors are derived from the base color.
	private angleDeg: number;
	private gradientToBase: string;
	/** Once the user picks a second color it stops auto-following the base. */
	private gradientToTouched: boolean;
	private toColorLight = "";
	private toColorDark = "";
	/** Opt-in: paint the gradient through the title text of all three roles. */
	private textGradient: boolean;
	// Accent-strength counterparts of toColor*, for the text sweep.
	private textToColorLight = "";
	private textToColorDark = "";
	private resolve: ((result: PaletteEditorResult | null) => void) | null = null;

	private previewEl: HTMLElement | null = null;
	private preview: LiveCalloutPreview | null = null;
	/** Preview the caller had registered before this modal took the slot. */
	private outerPreview: CalloutDefinition | null = null;
	private outerPreviewIsDemo = false;
	/** Whose draft the captured preview was — see `CalloutRegistry.PreviewDraft`. */
	private outerPreviewDraft: PreviewDraft | null = null;
	private nameInputEl: HTMLInputElement | null = null;
	/**
	 * The Name row. A taken name is said under its field, through Obsidian's
	 * `setErrorMessage` (finding S7-06).
	 */
	private nameSetting: Setting | null = null;
	/**
	 * The duplicate-colour message. Made once and kept out of the DOM while
	 * there is no clash; while there is one, it is the first line inside the
	 * Colors box (see renderColorError).
	 */
	private colorErrorEl: HTMLElement | null = null;
	/** Identity of the clash the error line currently shows; "" when clear. */
	private renderedClashKey = "";
	private saveBtnEl: HTMLButtonElement | null = null;
	/** The second-color swatch, for programmatic sync. Null whenever the row is not built. */
	private gradToInput: HTMLInputElement | null = null;
	constructor(
		private plugin: PaletteEditorPlugin,
		options: {
			existing?: CustomPalette;
			seedName?: string;
			/**
			 * Pre-fill every colour field but stay a NEW palette: the name comes
			 * up empty and the title still reads "New color palette". Used to
			 * rebuild a palette that was deleted out from under a callout, so the
			 * user only has to type a name.
			 */
			seed?: Omit<CustomPalette, "id" | "name">;
			takenNames?: string[];
			/**
			 * The other saved palettes this one may not duplicate the colors of.
			 * Callers pass their custom palettes minus the one being edited; the
			 * built-in presets are merged in here, exactly as `takenNames` does.
			 */
			takenColors?: CustomPalette[];
			/**
			 * Offered as an inline "use it instead" action on the duplicate-color
			 * error. Only worth passing from a caller that can act on an existing
			 * palette (the callout editor applies it); the settings list, which is
			 * only managing the collection, leaves it off and shows the bare error.
			 */
			onUseExisting?: (paletteId: string, name: string) => void;
			/**
			 * Asked when Save is pressed, before the window closes: false keeps
			 * it open with nothing saved. The settings list asks "Update your
			 * notes?" here, so that window's Cancel comes back to this one.
			 */
			beforeSave?: PaletteBeforeSave;
		} = {},
	) {
		super(plugin.app);
		this.existing = options.existing ?? null;
		this.onUseExisting = options.onUseExisting ?? null;
		this.beforeSave = options.beforeSave ?? null;
		// Everything the form *seeds from*. `this.existing` stays reserved for
		// the two things that decide whether this is an edit at all — the name
		// (line below) and the title in onOpen — so a seed fills the colours
		// without the modal claiming to be editing a palette that no longer
		// exists.
		const base: Omit<CustomPalette, "id" | "name"> | null = options.existing ?? options.seed ?? null;
		// A preset only blocks what the user changes a palette TO. A saved
		// palette may already wear a preset's name or colours — it was saved
		// before that preset existed under them (Purple, Pink and Yellow came
		// after plenty of palettes had those names), or named under another
		// interface language — and holding those against it would lock the user
		// out of editing their own palette until they renamed it.
		const own = this.existing ? customPaletteToColorPalette(this.existing) : null;
		const presets = getAllColorPalettes();
		// Callers pass the other CUSTOM palette names; the fixed preset names
		// are merged here so a custom palette can't shadow "Blue" etc. Read via
		// the getters (not a cached const) so the comparison is against the
		// names in the user's current display language.
		this.takenNames = new Set(
			[
				...(options.takenNames ?? []),
				...presets.map((p) => p.name).filter((name) => !own || normalizeName(name) !== normalizeName(own.name)),
			].map(normalizeName),
		);
		this.takenMetadataKeys = new Set((options.takenNames ?? []).map(paletteMetadataKey).filter((k) => k !== ""));
		// Same shape as takenNames, one axis over: the presets are pooled in so a
		// custom palette can't be an unnamed copy of "Blue" either.
		this.takenColors = [
			...(options.takenColors ?? []).map(customPaletteToColorPalette),
			...presets.filter((p) => !own || !palettesVisuallyEqual(p, own)),
		];
		this.name = this.existing?.name ?? options.seedName?.trim() ?? "";
		// Prefers the user's stored pick over the derivation's own output; see
		// seedBaseColor for why that ordering is load-bearing.
		this.baseColor = seedBaseColor(base, DEFAULT_BASE_COLOR);
		const g = base?.bgGradient;
		// Transparency is checked first: a palette can carry a stale gradient
		// beside the flag (nothing clears it when the style switches, so a
		// switch back to Gradient finds it intact), and the flag is what
		// actually gets painted.
		this.bgStyle = base?.transparentBg ? "none" : g ? "gradient" : "solid";
		// Set before any derivation below: deriveGradientEnd() and the new-palette
		// branch both read this to decide how strong the background reads. A
		// fresh palette seeds from the per-style default (gradients default
		// higher — a two-stop sweep reads fainter than a solid fill at the same
		// amount); a saved value is the user's own choice and always wins.
		// A seed counts as touched even though it carries no intensity: its six
		// colours are authoritative (they are a real callout's current
		// appearance), and an untouched flag lets the Background-style dropdown
		// re-derive all six from the base colour on the first Solid↔Gradient
		// flip — silently discarding the very colours the seed exists to
		// preserve. The cost is that a seeded palette switched to Gradient keeps
		// the solid default intensity instead of the higher gradient one, which
		// the slider is right there to change.
		this.bgIntensityTouched = base?.bgIntensity !== undefined || options.seed !== undefined;
		this.bgIntensity =
			base?.bgIntensity ??
			(this.bgStyle === "gradient" ? DEFAULT_BG_INTENSITY_GRADIENT : DEFAULT_BG_INTENSITY_SOLID);
		// A brand-new palette must not open already clashing with one the user
		// has: see unclaimedBaseColor. A seed or an existing palette keeps its
		// own colors — they are authoritative, not a default to move off.
		if (!base) {
			this.baseColor = unclaimedBaseColor(this.baseColor, this.bgIntensity, this.takenColors);
		}
		this.colors = base
			? {
					colorLight: base.colorLight,
					colorDark: base.colorDark,
					bgColorLight: base.bgColorLight,
					bgColorDark: base.bgColorDark,
					textColorLight: base.textColorLight,
					textColorDark: base.textColorDark,
				}
			: derivePaletteFromColor(this.baseColor, this.bgIntensity);
		this.advancedColors = base?.colorMode === "advanced";
		this.angleDeg = g?.angleDeg ?? DEFAULT_GRADIENT_ANGLE;
		// A saved gradient's end colors are authoritative (derivation is not
		// invertible); a fresh gradient starts from a hue-shifted base color
		// so toggling it on is immediately visible.
		this.gradientToTouched = !!g;
		this.gradientToBase = g?.toColorLight ?? rotateHue(this.baseColor, GRADIENT_HUE_SHIFT);
		this.textGradient = g?.textGradient ?? false;
		// Derive first, then let a saved gradient's own colors win: derivation
		// is not invertible, so the stored values are authoritative wherever
		// they exist. Gradients saved before the text sweep existed carry no
		// text ends, and gradientToBase is then the pale toColorLight — the
		// derivation only darkens that tint to a readable strength instead of
		// recovering the original second color, which is enough to make the
		// toggle usable until the second color picker is touched.
		this.deriveGradientEnd();
		if (g) {
			this.toColorLight = g.toColorLight;
			this.toColorDark = g.toColorDark;
			this.textToColorLight = g.textToColorLight ?? this.textToColorLight;
			this.textToColorDark = g.textToColorDark ?? this.textToColorDark;
		}
	}

	openAndWait(): Promise<PaletteEditorResult | null> {
		return new Promise<PaletteEditorResult | null>((resolve) => {
			this.resolve = resolve;
			this.open();
		});
	}

	onOpen(): void {
		this.setTitle(this.existing ? t("palette.editTitle") : t("palette.newTitle"));
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass("callout-studio-palette-editor");
		// Same shell and width as the callout editor: Obsidian's long-dialog
		// shell (the sticky preview column relies on its one scrolling body),
		// the editors' wider width, and `mod-lg`, Obsidian's large-form mark,
		// which opens it as a full-height sheet on a phone.
		this.modalEl.addClass("callout-studio-editor-modal", "mod-lg");
		const footer = applyModalChrome(this, { footer: true });

		// Two-column body in the same order as the per-role style popups: the
		// sticky live preview on the left, the control cards on the right.
		const panel = contentEl.createDiv({
			cls: "callout-studio-preview-panel",
		});
		const previewCol = panel.createDiv({
			cls: "callout-studio-preview-col",
		});
		const adjustCol = panel.createDiv({ cls: "callout-studio-adjust-col" });

		// The fixed group. It holds the two rows nothing else can change — the
		// name, and the style dropdown that drives the group below it. Keeping
		// the dropdown out here is what lets its own `change` handler rebuild
		// that group without tearing the dropdown out from under the pointer.
		// Both groups are Obsidian's own (`SettingGroup`), with the callout
		// editor's 16px row inset (`cs-editor-group`).
		const paletteGroup = new SettingGroup(adjustCol)
			.setHeading(t("palette.groupPalette"))
			.addClass("cs-editor-group");
		const paletteCard = paletteGroup.listEl;

		const nameSetting = new Setting(paletteCard)
			.setName(t("palette.name"))
			// Shares one control width with the Style row directly below it, so
			// the field and the dropdown end on the same edge instead of each
			// taking whatever its own content asks for (see styles.css).
			.setClass("cs-palette-name-setting")
			.addText((text) => {
				this.nameInputEl = text.inputEl;
				text.inputEl.maxLength = MAX_NAME_LENGTH;
				text.inputEl.addClass("cs-text-control");
				text.setPlaceholder(t("palette.namePlaceholder"))
					.setValue(this.name)
					.onChange((v) => {
						this.name = v;
						this.updateValidity();
					});
			});
		// Empty — so collapsed — unless the word this name gives the palette in
		// a callout's metadata is one another saved palette already has.
		this.metadataKeyEl = nameSetting.descEl.createDiv({ cls: "cs-palette-metadata-key" });
		this.nameSetting = nameSetting;

		this.buildBgStyleRow(paletteCard);

		// The duplicate-colour message is made here but not placed:
		// renderColorError() puts it at the top of the Colors box while there is
		// a clash. It is not one of the rebuilt rows, so it survives
		// renderColorSection() tearing those down on every switch.
		this.colorErrorEl = createDiv({ cls: "cs-palette-color-error" });

		const colorGroup = new SettingGroup(adjustCol)
			// The same string the advanced grid used to head itself with — the
			// group wears it now, so that inner heading is gone.
			.setHeading(t("palette.advancedColors"))
			.addClass("cs-editor-group");
		this.colorCardEl = colorGroup.listEl;
		this.colorGroup = colorGroup;
		// The separate colors start on the mode Obsidian is showing.
		this.appDark = this.shownDark = this.plugin.app.isDarkMode();
		// Both before the first renderColorSection(), which paints them. The mode
		// button goes last, so it keeps its place at the very end while the view
		// button beside it comes and goes with the style.
		this.paintColorViewButton = addColorViewButton(colorGroup, () => this.switchColorView());
		this.paintModeButton = addModeButton(colorGroup, () => this.switchMode());
		this.renderColorSection();
		// Obsidian can change the mode itself while the editor is open (its
		// light/dark command, or a theme set to follow the system). The rows then
		// follow it, and it is the mode to go back to on close. Every inject of
		// this plugin fires css-change too; those leave the mode as it was, and
		// the check below makes them cost nothing.
		this.cssChangeRef = this.plugin.app.workspace.on("css-change", () => {
			const dark = this.plugin.app.isDarkMode();
			if (dark === this.shownDark) return;
			this.appDark = this.shownDark = dark;
			this.renderColorSection();
		});

		this.previewEl = previewCol.createDiv({
			cls: "cs-palette-live-preview",
		});
		// Capture any preview the caller already registered (e.g. the callout
		// editor's, when this modal is opened over it) so it can be restored on
		// close instead of clearing the registry's single preview slot to null.
		this.outerPreview = this.plugin.registry.getPreviewDefinition();
		this.outerPreviewIsDemo = this.plugin.registry.isPreviewDemo();
		this.outerPreviewDraft = this.plugin.registry.getPreviewDraft();
		this.preview = new LiveCalloutPreview(this.plugin.app, this.previewEl, {
			title: t("editor.livePreview"),
			initialText: this.buildSampleText(),
			// Push the derived palette into the registry under the reserved
			// preview ID and re-inject CSS so the callout renders live.
			beforeRender: () => {
				// A demo placeholder: the palette editor previews a derived
				// palette on a stand-in callout, it never edits a real one.
				this.plugin.registry.setPreviewDefinition(this.buildPreviewDefinition(), true);
				// Not a full `inject`: this runs on every step of a colour drag,
				// and a step only changes the stand-in's own rules. The injector
				// keeps those in a small sheet of their own and rewrites just
				// that (see CSSInjector.repaintPreview).
				this.plugin.cssInjector.repaintPreview();
				// The one funnel every color change already passes through, so
				// the duplicate-color block cannot drift out of step with the
				// form. It also runs once before the footer exists, which is
				// why updateValidity guards the button it cannot reach yet.
				this.updateValidity();
			},
			onDestroy: () => {
				this.plugin.registry.setPreviewDefinition(
					this.outerPreview,
					this.outerPreviewIsDemo,
					true,
					this.outerPreviewDraft,
				);
				this.plugin.cssInjector.inject(false);
			},
		});

		const buttons = footer;
		addCancelButton(buttons, t("editor.cancel"), () => this.finish(false));
		this.saveBtnEl = buttons.createEl("button", {
			text: t("palette.save"),
			cls: "mod-cta",
		});
		this.saveBtnEl.addEventListener("click", () => {
			if (explainIfBlocked(this.saveBlockedReason())) return;
			this.finish(true);
		});
		this.updateValidity();

		// Creating only, and last, on the finished window — `existing` is the
		// same thing the title asks above, so the `seed` rebuild counts as a
		// create and gets the cursor it exists to ask for. Desktop only: a
		// phone or tablet is left alone to be tapped. See modalAutofocus.
		if (!this.existing) {
			autofocusOnDesktop(this.nameInputEl);
		}
	}

	/** True when the typed name collides with another palette or a preset. */
	private isNameTaken(): boolean {
		return this.takenNames.has(normalizeName(this.name));
	}

	/** The typed name's metadata word, when another saved palette has it. */
	private sharedMetadataKey(): string | null {
		const key = paletteMetadataKey(this.name);
		return key !== "" && this.takenMetadataKeys.has(key) ? key : null;
	}

	/**
	 * The typed name's word when it is another palette's AND blocks saving —
	 * which is only when the user is giving this palette that word now. A
	 * palette saved under it already shares it from before words existed
	 * ("Note dark" beside "Note (dark)" kebab-case alike), and holding that
	 * against it would lock the user out of editing their own palette, even
	 * its colours; that pair is warned about instead (`metadataKeyEl`).
	 */
	private takenMetadataKey(): string | null {
		const key = this.sharedMetadataKey();
		if (key === null) return null;
		return this.existing && paletteMetadataKey(this.existing.name) === key ? null : key;
	}

	/** The current form colors as a palette, for comparison and preview alike. */
	private currentColorPalette(): ColorPalette {
		const gradient = this.currentGradient();
		return {
			id: this.existing?.id ?? "",
			name: this.name,
			group: "custom",
			...this.colors,
			bgGradient: gradient ?? undefined,
			...(this.bgStyle === "none" ? { transparentBg: true as const } : {}),
		};
	}

	/** The saved palette or preset these colors already duplicate, if any. */
	private findColorClash(): ColorPalette | null {
		const current = this.currentColorPalette();
		return this.takenColors.find((p) => palettesVisuallyEqual(p, current)) ?? null;
	}

	/**
	 * Duplicate names AND duplicate colors are both hard-blocked: the offending
	 * control is marked, an error shows beside it, and Save stays dimmed until
	 * the palette is unique on both axes — pressing it meanwhile says which.
	 *
	 * The color half runs from the live preview's `beforeRender`, which is the
	 * one funnel every color change already goes through — hooking the
	 * individual swatches, the intensity slider, the gradient rows and the
	 * background-style toggle separately would leave the block one forgotten
	 * call site away from being wrong.
	 */
	private updateValidity(): void {
		const nameTaken = this.isNameTaken();
		const keyTaken = nameTaken ? null : this.takenMetadataKey();
		// Under the field, where Obsidian shows a rejected value: its warning
		// colour, end-aligned, and nothing drawn on the field itself.
		this.nameSetting?.setErrorMessage(
			nameTaken ? t("palette.nameExists") : keyTaken ? t("palette.metadataNameExists", { key: keyTaken }) : null,
		);
		if (this.metadataKeyEl) {
			const key = paletteMetadataKey(this.name);
			const sharedFromBefore = !nameTaken && keyTaken === null && this.sharedMetadataKey() !== null;
			this.metadataKeyEl.setText(key && sharedFromBefore ? t("palette.metadataNameShared", { key }) : "");
		}
		this.colorClash = this.findColorClash();
		this.renderColorError();
		if (this.saveBtnEl) paintBlocked(this.saveBtnEl, this.saveBlockedReason(this.colorClash));
	}

	/**
	 * Why Save cannot act, or null. The name comes first, as its error does on
	 * screen. `clash` is passed by the caller that has just worked it out, so
	 * the preview's per-frame pass does not compare every palette twice.
	 */
	private saveBlockedReason(clash: ColorPalette | null = this.findColorClash()): string | null {
		if (this.isNameTaken()) return t("palette.saveBlockedName");
		const key = this.takenMetadataKey();
		if (key) return t("palette.metadataNameExists", { key });
		return clash ? t("palette.colorExists", { name: clash.name }) : null;
	}

	/**
	 * The duplicate-color message. Unlike a duplicate name — which the user
	 * fixes by typing — a duplicate color can only be fixed by changing the
	 * design or by going to find the other palette, so the message names the
	 * palette and, where the caller can act on one, offers to use it instead.
	 */
	private renderColorError(): void {
		const el = this.colorErrorEl;
		if (!el) return;
		const clash = this.colorClash;
		// Rebuilt only when the clash itself changes. This runs on every preview
		// frame, and re-creating the message mid-drag would tear the "use the
		// existing one" button out from under the pointer on its way past.
		const key = clash ? `${clash.id} ${clash.name}` : "";
		if (key === this.renderedClashKey) return;
		this.renderedClashKey = key;
		el.empty();
		// Out of the box while there is nothing to say, rather than hidden in
		// it: Obsidian leaves the divider off the box's FIRST child only, so a
		// hidden first line would hand a stray divider to the first row on
		// screen. While there is a clash, it is that first line.
		if (!clash) {
			el.detach();
			return;
		}
		const box = this.colorCardEl;
		if (box) box.insertBefore(el, box.firstChild);
		if (!this.onUseExisting) {
			el.setText(t("palette.colorExists", { name: clash.name }));
			return;
		}
		renderInlineLinkHint(el, {
			textKey: "palette.colorExistsUse",
			linkKey: "palette.colorExistsUseLink",
			vars: { name: clash.name },
			onClick: () => {
				const use = this.onUseExisting;
				// Resolve as a cancel: the caller is applying an existing palette,
				// so there is no new palette for it to save.
				this.finish(false);
				use?.(clash.id, clash.name);
			},
		});
	}

	/** Re-derives all six colors from the base color and refreshes the UI. */
	private applyDerived(): void {
		this.colors = derivePaletteFromColor(this.baseColor, this.bgIntensity);
		// The gradient end follows the base color until the user picks their
		// own second color; its tints are then re-derived either way (same
		// "re-derive overwrites manual tweaks" contract as the six colors).
		if (!this.gradientToTouched) {
			this.gradientToBase = rotateHue(this.baseColor, GRADIENT_HUE_SHIFT);
		}
		this.deriveGradientEnd();
		this.syncGradientInputs();
		this.preview?.refresh();
	}

	/**
	 * Recomputes both end-color pairs from the second base color: the pale
	 * tints the background sweep ends on, and their accent-strength
	 * counterparts for the text sweep — derived exactly the way the palette's
	 * own accent is derived from its base color, so the two stops of a
	 * gradient title are as readable as any other accent in the palette.
	 */
	private deriveGradientEnd(): void {
		this.toColorLight = bgTintFor(this.gradientToBase, false, this.bgIntensity);
		this.toColorDark = bgTintFor(this.gradientToBase, true, this.bgIntensity);
		const accents = derivePaletteFromColor(this.gradientToBase);
		this.textToColorLight = accents.colorLight;
		this.textToColorDark = accents.colorDark;
	}

	/** The gradient to preview/persist, or null unless Gradient is selected. */
	private currentGradient(): BgGradient | null {
		if (this.bgStyle !== "gradient") return null;
		const gradient: BgGradient = {
			angleDeg: this.angleDeg,
			toColorLight: this.toColorLight,
			toColorDark: this.toColorDark,
			// Persisted even while the sweep is off, so turning it on later
			// paints with the user's real second color instead of a lossy
			// re-derivation from the pale tints above.
			textToColorLight: this.textToColorLight,
			textToColorDark: this.textToColorDark,
		};
		if (this.textGradient) gradient.textGradient = true;
		return gradient;
	}

	/**
	 * Solid|Gradient|None picker — sits above the base color.
	 *
	 * A dropdown keeps this narrow column usable with long translated labels,
	 * where the previous three-segment switch crowded out the setting name.
	 * `cs-palette-bgstyle-setting` pins the shared dropdown to the
	 * Name field's width above it (see styles.css).
	 */
	private bgStyleDropdown?: SelectDropdown;
	private buildBgStyleRow(parent: HTMLElement): void {
		this.bgStyleDropdown?.destroy();
		this.bgStyleDropdown = buildPaletteBgStyleRow(parent, this.bgStyle, (v) => {
			this.bgStyle = v;
			// Follow the per-style default until the user drags the
			// slider themselves; once touched, their chosen intensity
			// sticks across style changes instead of being overwritten.
			// "None" is skipped entirely: it paints no background, so it
			// has no strength of its own to default to, and re-seeding
			// here would silently rewrite the value a switch back to
			// Solid is meant to restore.
			const reseed = !this.bgIntensityTouched && v !== "none";
			if (reseed) {
				this.bgIntensity = v === "gradient" ? DEFAULT_BG_INTENSITY_GRADIENT : DEFAULT_BG_INTENSITY_SOLID;
			}
			// Rebuild BEFORE re-deriving. Which rows the card holds is
			// a function of the style (the advanced grid and Intensity
			// are Solid-only, the gradient rows Gradient-only), and
			// applyDerived() below pushes colours into the second-colour
			// swatch — which has to be the fresh one, or the new value
			// lands in a detached input. Colours and intensity are left
			// exactly as they were, ready to reappear on a switch back.
			this.renderColorSection();
			if (reseed) this.applyDerived();
			else this.preview?.refresh();
		});
	}

	/**
	 * Background-intensity slider: how strongly the color shows. Applies to
	 * BOTH solid and gradient backgrounds, so it sits right under Base color in
	 * Solid and under Second color in Gradient. Works in whole percent; the
	 * stored value is a 0..1 fraction. Re-deriving on change overwrites the six
	 * colors and gradient tints (the same contract as changing the base color).
	 *
	 * Built only where a strength is a real question — {@link renderColorSection}
	 * skips it under None (nothing is painted) and under the advanced per-color
	 * grid (whose rows write colors directly, bypassing the derivation this
	 * steers).
	 *
	 * A setting row that stacks (`cs-stacked-slider`, as the callout editor's
	 * icon adjustments do): the name on its own line, the value readout and a
	 * full-width track under it. The column is ~250px wide inside its padding,
	 * and a track sharing one line with its name would be squeezed to half.
	 */
	private buildBgIntensityRow(parent: HTMLElement): void {
		const setting = new Setting(parent)
			.setName(t("palette.bgIntensity"))
			.setClass("cs-stacked-slider")
			.addSlider((slider) => {
				setSliderDisplay(slider, (v) => `${v}%`);
				slider
					.setLimits(Math.round(MIN_BG_COLOR_AMOUNT * 100), Math.round(MAX_BG_COLOR_AMOUNT * 100), 1)
					.setValue(Math.round(this.bgIntensity * 100))
					.setInstant(true)
					.onChange((v) => {
						this.bgIntensity = v / 100;
						this.bgIntensityTouched = true;
						this.applyDerived();
					});
			});
		this.colorCardRows.push(setting.settingEl);
	}

	/**
	 * Rebuilds every row of the "Colors" card for the current state: the single
	 * Base color control or — only while Solid and opted in — the advanced
	 * per-color grid, followed by whichever of Second color / Intensity /
	 * Direction / Gradient title text that state calls for.
	 *
	 * Called on open and whenever advancedColors or bgStyle changes. It never
	 * touches a color value itself — every value it doesn't show is still in
	 * state, and the rows come back carrying it if the user switches back. Two
	 * callers re-derive right after it returns, for reasons of their own: the
	 * background-style dropdown (per-style default intensity) and the "Revert"
	 * link (dropping the per-channel edits it just hid).
	 *
	 * The rows are torn down and rebuilt rather than hidden in place. They are
	 * direct children of the group's box, where Obsidian draws a divider above
	 * every row but the box's first child, and that is structural: a row left
	 * in the DOM under `display: none` would still be the first child, so the
	 * first *visible* row would draw a stray line at the top of the box.
	 */
	private renderColorSection(): void {
		const card = this.colorCardEl;
		if (!card) return;
		for (const row of this.colorCardRows) row.detach();
		this.colorCardRows = [];
		// Only ever points at a row this method built, so it goes stale the
		// moment those are detached. syncGradientInputs() guards on it.
		this.gradToInput = null;

		const showAdvanced = this.advancedColors && this.bgStyle === "solid";
		// The separate colors belong to one mode, so the title says which; the
		// single Base color is shared by both and keeps the plain title.
		this.colorGroup?.setHeading(
			t(
				!showAdvanced
					? "palette.advancedColors"
					: this.shownDark
						? "palette.darkModeColors"
						: "palette.lightModeColors",
			),
		);
		if (showAdvanced) {
			this.buildAdvancedColorRows(card);
		} else {
			this.buildSimpleColorRow(card);
		}

		if (this.bgStyle === "gradient") this.buildGradientToRow(card);
		if (!showAdvanced && this.bgStyle !== "none") {
			this.buildBgIntensityRow(card);
		}
		if (this.bgStyle === "gradient") {
			this.buildGradientDirectionAndTextRows(card);
		}

		// Only Solid has separate colors to switch to; Gradient and Transparent
		// have no per-channel view, so the heading's button is not offered there.
		this.paintColorViewButton?.(this.bgStyle !== "solid" ? "none" : this.advancedColors ? "advanced" : "simple");
		// Offered under every style: with the separate colors it picks which
		// mode the rows edit, and everywhere else it is how to check the other
		// mode.
		this.paintModeButton?.(this.shownDark);
	}

	/**
	 * The mode button's press: show all of Obsidian in the other mode, and
	 * rebuild the rows for it. Nothing about the palette changes; the preview
	 * follows on its own, because it is the real CSS in the real mode.
	 */
	private switchMode(): void {
		this.shownDark = !this.shownDark;
		showMode(this.plugin.app, this.shownDark);
		this.keepScroll(() => this.renderColorSection());
	}

	/**
	 * Runs a rebuild without losing the reader's place. Detaching the rows
	 * shrinks the scrolling body for a moment, and the browser clamps its
	 * scroll position (to the top, when the rows are the tallest thing in it)
	 * and does not give it back once the new rows are in.
	 */
	private keepScroll(rebuild: () => void): void {
		const scrollers = [this.contentEl, this.modalEl];
		const saved = scrollers.map((el) => el.scrollTop);
		rebuild();
		scrollers.forEach((el, i) => {
			el.scrollTop = saved[i] ?? 0;
		});
	}

	/**
	 * The heading button's press: from the single Base color to the separate
	 * colors, or back.
	 *
	 * Going back is an undo, not just a view switch: the six colors return to
	 * what Base color derives, discarding whatever the rows above wrote. Without
	 * this the hand-edited channels stayed in state — the simple row showed the
	 * untouched base color while the preview, and then the saved palette, still
	 * painted the manual ones, so "revert" visibly did nothing. Rebuild first,
	 * then derive: applyDerived() pushes into swatches, which have to be the
	 * fresh ones (same order as the background-style dropdown).
	 */
	private switchColorView(): void {
		this.advancedColors = !this.advancedColors;
		this.renderColorSection();
		if (!this.advancedColors) this.applyDerived();
	}

	/**
	 * The default color control: one Base color swatch that derives all six
	 * colors (see applyDerived). The row itself lives in
	 * `paletteBaseColorRow.ts`.
	 */
	private buildSimpleColorRow(parent: HTMLElement): void {
		const settingEl = renderBaseColorRow(parent, {
			base: this.baseColor,
			onPick: (hex) => {
				this.baseColor = hex;
				this.applyDerived();
			},
		});
		this.colorCardRows.push(settingEl);
	}

	/**
	 * Advanced per-color grid: a note saying which mode is being edited (the
	 * way back to the single Base color is the button in the group's heading,
	 * see {@link switchColorView}), then Accent/Background/Text swatches for
	 * ONLY the mode on screen. Each mode keeps its own three colors: an edit
	 * here never touches the other mode, which the mode button beside the
	 * heading switches to (see {@link switchMode}). Both start from what Base
	 * color derived, so the mode not yet edited is still a sensible one.
	 * Deliberately per-channel: editing Accent never touches Background or
	 * Text. Contrast is a non-blocking warning line under the three colours,
	 * not an auto-fix, so an edit here never silently changes a value the user
	 * didn't touch.
	 *
	 * Each mode's colors used to be guessed from the other's by mirroring the
	 * lightness, and every edit overwrote the other mode with that guess. It
	 * turned a white background into a black one and a pale blue into near
	 * black, and two hand-picked modes could not both be kept.
	 */
	private buildAdvancedColorRows(parent: HTMLElement): void {
		const isDark = this.shownDark;

		// Description only, no name: the group's own heading already reads
		// "Colors", and a row repeating it would be a heading under a heading.
		const note = new Setting(parent).setClass("cs-palette-mode-note");
		this.colorCardRows.push(note.settingEl);
		note.setDesc(linesFragment(t(isDark ? "palette.modeColorsHintDark" : "palette.modeColorsHintLight")));

		const accentKey: "colorLight" | "colorDark" = isDark ? "colorDark" : "colorLight";
		const bgKey: "bgColorLight" | "bgColorDark" = isDark ? "bgColorDark" : "bgColorLight";
		const textKey: "textColorLight" | "textColorDark" = isDark ? "textColorDark" : "textColorLight";

		// One helper for the channel rows so each is registered for teardown
		// exactly once — the swatch call used to build its Setting inline, and
		// an inline Setting has no handle to push onto colorCardRows.
		const channelRow = (label: string): Setting => {
			const setting = new Setting(parent).setName(label).setClass("cs-row-inline");
			this.colorCardRows.push(setting.settingEl);
			return setting;
		};

		const accentRow = channelRow(t("palette.accentColor"));
		const accentBadge = contrastBadgeIn(accentRow);
		createColorSwatchInput(
			accentRow.controlEl,
			this.colors[accentKey],
			(hex) => {
				this.colors[accentKey] = hex;
				refreshBadges();
				this.preview?.refresh();
			},
			() => refreshLine(),
		);

		createColorSwatchInput(
			channelRow(t("palette.backgroundColorChannel")).controlEl,
			this.colors[bgKey],
			(hex) => {
				this.colors[bgKey] = hex;
				refreshBadges();
				this.preview?.refresh();
			},
			() => refreshLine(),
		);

		// The callout's body text. It is stored per mode like the other two and
		// painted by the CSS on the callout's content; a palette saved without a
		// hand-picked one carries the contrast-corrected color
		// derivePaletteFromColor gave it.
		const textRow = channelRow(t("palette.textColorChannel"));
		const textBadge = contrastBadgeIn(textRow);
		createColorSwatchInput(
			textRow.controlEl,
			this.colors[textKey],
			(hex) => {
				this.colors[textKey] = hex;
				refreshBadges();
				this.preview?.refresh();
			},
			() => refreshLine(),
		);

		// Checks the contrast-dependent colours (Accent >=3:1, Text >=4.5:1)
		// against the current mode's background — a non-blocking heads-up,
		// never a block on Save. It is said twice, because neither way is
		// enough alone (finding S6-12; see paletteContrastLine.ts): a triangle
		// beside each swatch that falls short, which says WHICH color, and one
		// line of words under the rows, which says why and reads on a phone,
		// where a tooltip has no hover. The sentence is the same whichever color
		// fails, so the line appears once, when either does.
		//
		// The triangles follow every move inside the picker: they take no room,
		// so nothing shifts while the user is still choosing. The line waits for
		// the settled pick (`change`) because it does take room: the modal is as
		// tall as its content and sits in the middle of the screen, so a line
		// that came and went mid-drag would move the whole window under the
		// cursor.
		const warnContrast = contrastLineAfter(textRow, this.colorCardRows);
		const failsAccent = (): boolean => contrastRatio(this.colors[accentKey], this.colors[bgKey]) < 3;
		const failsText = (): boolean => contrastRatio(this.colors[textKey], this.colors[bgKey]) < 4.5;
		const refreshBadges = (): void => {
			accentBadge(failsAccent());
			textBadge(failsText());
		};
		const refreshLine = (): void => warnContrast(failsAccent() || failsText());
		refreshBadges();
		refreshLine();
	}

	/**
	 * Gradient-only row for the second color. Built separately from the rest
	 * of the gradient controls so the Intensity row can sit directly below it
	 * (see the order renderColorSection builds them in).
	 */
	private buildGradientToRow(parent: HTMLElement): void {
		const toSetting = new Setting(parent).setName(t("palette.gradientTo")).setClass("cs-row-inline");
		this.colorCardRows.push(toSetting.settingEl);
		this.gradToInput = createColorSwatchInput(toSetting.controlEl, this.gradientToBase, (hex) => {
			this.gradientToBase = hex;
			this.gradientToTouched = true;
			this.deriveGradientEnd();
			this.syncGradientInputs();
			this.preview?.refresh();
		}).input;
	}

	/**
	 * Gradient-only rows, shown while the Gradient style is selected: the
	 * direction picker and the title-text sweep toggle.
	 */
	private buildGradientDirectionAndTextRows(parent: HTMLElement): void {
		// Three icon buttons — well under the width of a row, so
		// `cs-row-inline` keeps them beside the label on a phone too.
		const dirSetting = new Setting(parent).setName(t("palette.gradientDirection")).setClass("cs-row-inline");
		this.colorCardRows.push(dirSetting.settingEl);
		renderDirectionPicker(dirSetting.controlEl, this.angleDeg, (deg) => {
			this.angleDeg = deg;
			this.preview?.refresh();
		});

		const textSetting = new Setting(parent).setName(t("palette.gradientText")).addToggle((toggle) => {
			toggle.setValue(this.textGradient).onChange((on) => {
				this.textGradient = on;
				this.preview?.refresh();
			});
		});
		this.colorCardRows.push(textSetting.settingEl);
	}

	/**
	 * Pushes gradient colors into their swatches after a programmatic change.
	 * A no-op while the second-color row isn't built — every other style leaves
	 * `gradToInput` null (see renderColorSection).
	 */
	private syncGradientInputs(): void {
		const entries: [HTMLInputElement | null | undefined, string][] = [[this.gradToInput, this.gradientToBase]];
		for (const [input, value] of entries) {
			// The input is the dot (app.css paints it from its value), so
			// setting the value is all there is to do.
			if (input) input.value = value;
		}
	}

	/**
	 * The sample markdown seeding the read-only preview: the same mini-document
	 * as the callout editor's preview — a titled heading callout, an inline pill,
	 * then the regular callout — all in the palette's colors, so a saved palette
	 * can be checked against every render role at once. The title is a fixed
	 * placeholder, deliberately not tied to the "Name" field above (that field
	 * names the *palette*, e.g. "Ocean", not this demo callout). The trailing
	 * blank line keeps the read-only caret parked outside the last block (see
	 * LiveCalloutPreview's focus policy).
	 */
	private buildSampleText(): string {
		const id = PALETTE_DEMO_ID;
		const name = t("editor.untitledCallout");
		return [
			`## [!${id}] ${name}`,
			"",
			t("editor.sampleInlineText").replace("{id}", id).replace("{title}", name),
			"",
			`> [!${id}] ${name}`,
			`> ${t("editor.loremIpsumShort")}`,
			"",
		].join("\n");
	}

	/** Snapshot the derived palette colors as a transient preview definition. */
	private buildPreviewDefinition(): CalloutDefinition {
		return {
			id: PALETTE_DEMO_ID,
			displayName: t("editor.untitledCallout"),
			icon: { type: "lucide", value: "palette" },
			colorLight: this.colors.colorLight,
			colorDark: this.colors.colorDark,
			bgColorLight: this.colors.bgColorLight,
			bgColorDark: this.colors.bgColorDark,
			bgGradient: this.currentGradient() ?? undefined,
			// The flag beats the two hexes above wherever both are present
			// (CSSInjector.bgProps returns before reading them), so the preview
			// shows what a saved None palette will actually paint without the
			// derivation having to be torn down and rebuilt on every toggle.
			...(this.bgStyle === "none" ? { transparentBg: true as const } : {}),
			textColorLight: this.colors.textColorLight,
			textColorDark: this.colors.textColorDark,
			foldable: false,
			defaultFolded: false,
			aliases: [],
			builtIn: false,
			source: "user",
		};
	}

	private finish(save: boolean): void {
		if (!save) {
			this.settle(null);
			return;
		}
		// Save stays dimmed on a duplicate name or duplicate colors and its press
		// is answered before it gets here, but guard anyway. A second press while
		// `beforeSave` is still asking is the same Save.
		if (this.isNameTaken() || this.findColorClash() || this.confirming) return;
		const result = this.buildResult();
		if (this.beforeSave) void this.confirmSave(this.beforeSave, result);
		else this.settle(result);
	}

	/** Save once `beforeSave` agrees; otherwise stay open with nothing saved. */
	private async confirmSave(beforeSave: PaletteBeforeSave, result: PaletteEditorResult): Promise<void> {
		this.confirming = true;
		let agreed = false;
		try {
			agreed = await beforeSave(result, () => this.resolve !== null);
		} finally {
			this.confirming = false;
		}
		// Closed while it was asked: closing already answered "nothing saved".
		if (agreed && this.resolve) this.settle(result);
	}

	private settle(result: PaletteEditorResult | null): void {
		const resolve = this.resolve;
		this.resolve = null;
		this.close();
		resolve?.(result);
	}

	/** The form as a palette to save. */
	private buildResult(): PaletteEditorResult {
		const typed = this.name.trim();
		const name = typed || dedupeColorName(suggestColorName(this.colors.colorLight), this.takenNames);
		const gradient = this.currentGradient();
		return {
			name,
			...this.colors,
			bgIntensity: this.bgIntensity,
			// The pick itself, so reopening this palette derives from what
			// the user chose rather than from what the contrast fix returned.
			// Saved in advanced mode too: the grid's hand-edited channels win
			// while they last, but "Revert" goes back to deriving from here.
			baseColor: this.baseColor,
			...(gradient ? { bgGradient: gradient } : {}),
			// The six colors above are saved unchanged under None: the
			// backgrounds among them are what a later switch back to Solid
			// restores, and `bakePaletteColors` is what keeps them from
			// reaching a callout meanwhile.
			...(this.bgStyle === "none" ? { transparentBg: true as const } : {}),
			// Saved regardless of the current bgStyle so a palette left in
			// advanced mode while Gradient was selected still reopens
			// advanced if the user switches back to Solid later.
			...(this.advancedColors ? { colorMode: "advanced" as const } : {}),
		};
	}

	onClose(): void {
		if (this.cssChangeRef) this.plugin.app.workspace.offref(this.cssChangeRef);
		this.cssChangeRef = null;
		// Put Obsidian back in the mode it was in, before the preview's
		// teardown below re-injects CSS. Every way out of the editor ends here,
		// closing the Settings window around it included.
		if (this.shownDark !== this.appDark) showMode(this.plugin.app, this.appDark);
		this.shownDark = this.appDark;
		this.bgStyleDropdown?.destroy();
		// Destroys the embedded editor and, via onDestroy, restores the outer
		// preview registration (if any) and re-injects CSS.
		this.preview?.destroy();
		this.preview = null;
		this.contentEl.empty();
		// Detached with the content above, so drop the handles rather than
		// leave the card's rows reachable from a closed window.
		this.colorCardEl = null;
		this.colorGroup = null;
		this.colorCardRows = [];
		this.gradToInput = null;
		// The button bar is a sibling of contentEl, so emptying that misses it.
		removeModalChrome(this);
		if (this.resolve) {
			this.resolve(null);
			this.resolve = null;
		}
	}
}
