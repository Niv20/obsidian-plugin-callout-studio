/**
 * settings/PaletteEditorModal.ts — Create/edit a custom color palette.
 *
 * Modal opened from the "Saved color palettes" settings section. Two-column
 * body wearing the same shape as the per-role "Global callout style" popups: a
 * sticky live preview on the left, and on the right two titled control cards —
 * a fixed "Palette" card (name + background style) above a "Colors" card whose
 * rows are rebuilt for whatever the style dropdown is set to. Default (simple)
 * mode: the user picks ONE
 * base color and the full palette — light/dark accents, backgrounds, text —
 * is auto-derived with contrast correction (see derivePaletteFromColor). The
 * background style is a 2-way choice: solid or a two-stop linear gradient
 * (preset directions). For the gradient, the user picks one "second color"
 * whose light/dark tints are derived like the background's, and an
 * off-by-default toggle extends the sweep through the title text of all three
 * render roles. Resolves the palette (without id) on save, or null on
 * cancel/close.
 */
import { Modal, Setting } from "obsidian";
import type { App } from "obsidian";
import type { BgGradient, CalloutDefinition, CustomPalette } from "../types";
import {
	bgTintFor,
	contrastRatio,
	DEFAULT_BG_INTENSITY_GRADIENT,
	DEFAULT_BG_INTENSITY_SOLID,
	derivePaletteFromColor,
	inferOppositeModeColor,
	MAX_BG_COLOR_AMOUNT,
	MIN_BG_COLOR_AMOUNT,
	rotateHue,
	type DerivedPalette,
} from "../utils/colorUtils";
import {
	createColorSwatchInput,
	setContrastWarning,
} from "../ui/ColorSwatchInput";
import { renderInlineLinkHint } from "../ui/inlineLinkHint";
import { renderBaseColorRow, seedBaseColor } from "./paletteBaseColorRow";
import { renderDirectionPicker } from "./paletteDirectionPicker";
import { LiveCalloutPreview } from "./LiveCalloutPreview";
import {
	dedupeColorName,
	normalizeName,
	suggestColorName,
} from "../utils/colorNames";
import {
	customPaletteToColorPalette,
	getAllColorPalettes,
	getObsidianPalettes,
	getExtraPalettes,
	palettesVisuallyEqual,
	type ColorPalette,
} from "../utils/colorPalettes";
import { t } from "../i18n";
import type { CalloutRegistry } from "../manager/CalloutRegistry";
import type { CSSInjector } from "../manager/CSSInjector";
import { applyModalChrome, removeModalChrome } from "./modalChrome";
import { autofocusOnOpen } from "./modalAutofocus";
import {
	createControlGroup,
	createSliderRow,
	setSliderDisplay,
} from "./styleControls";

export type PaletteEditorResult = Omit<CustomPalette, "id">;

/** Minimal plugin surface the palette editor needs to drive the live preview. */
interface PaletteEditorPlugin {
	app: App;
	registry: CalloutRegistry;
	cssInjector: CSSInjector;
}

/**
 * Reserved id for the stand-in callout this modal previews the palette on, in
 * the same spirit as GlobalStyleModal's `STYLE_DEMO_ID`. Registered only while
 * the modal is open; if a user callout ever occupies the same id, the preview
 * slot shadows and later restores it.
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

/**
 * Whether the advanced per-color grid offers a hand-editable **Text color**
 * row (see buildAdvancedColorRows).
 *
 * Deliberately off: there is no need to hand-pick a callout's text color right
 * now, so the channel simply isn't offered. This gates the CONTROL only —
 * support for the channel is untouched everywhere else and is meant to stay
 * that way: a palette still carries `textColorLight`/`textColorDark`,
 * `derivePaletteFromColor` still derives them (contrast-corrected) from the
 * base color, and import/CSS still honour whatever an existing palette
 * already stores. So a palette saved with a hand-picked text color keeps
 * painting it; it just can no longer be changed from here.
 *
 * Flipping this back to `true` restores the row exactly as it was, contrast
 * warning included — that is the whole cost of bringing the feature back.
 * Annotated `boolean` rather than left as the literal `false` so both branches
 * stay type-checked while it is off.
 */
const SHOW_TEXT_COLOR_CHANNEL: boolean = false;

/**
 * How the palette paints its background. `"none"` is not a third way of
 * colouring one — it is the absence of a background (`transparentBg`), which is
 * why it lives here rather than at the bottom of the Intensity slider: an
 * intensity near zero is still an OPAQUE fill in the page's own colour, so it
 * looks transparent while quietly flattening the nesting step of every callout
 * stacked inside it (see `CalloutDefinition.transparentBg`).
 */
type BgStyle = "solid" | "gradient" | "none";

export class PaletteEditorModal extends Modal {
	private existing: CustomPalette | null;
	/** Normalized names of every other palette (custom AND built-in presets). */
	private takenNames: Set<string>;
	/** Every other palette (custom AND built-in presets) this one may not duplicate. */
	private takenColors: ColorPalette[];
	/** The palette the current colors duplicate, if any; blocks Save while set. */
	private colorClash: ColorPalette | null = null;
	private onUseExisting: ((paletteId: string, name: string) => void) | null;
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
	/** The "Colors" card. Its header stays put; renderColorSection() rebuilds the rows under it. */
	private colorCardEl: HTMLElement | null = null;
	/**
	 * Every row renderColorSection() has put in the card, so the next pass can
	 * take them out again. They are direct children of the card rather than
	 * living in a wrapper div, which is what lets the card's own sibling
	 * separator rule draw the hairlines between them.
	 */
	private colorCardRows: HTMLElement[] = [];
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
	private resolve: ((result: PaletteEditorResult | null) => void) | null =
		null;

	private previewEl: HTMLElement | null = null;
	private preview: LiveCalloutPreview | null = null;
	/** Preview the caller had registered before this modal took the slot. */
	private outerPreview: CalloutDefinition | null = null;
	private outerPreviewIsDemo = false;
	private nameInputEl: HTMLInputElement | null = null;
	private nameErrorEl: HTMLElement | null = null;
	private colorErrorEl: HTMLElement | null = null;
	/** Identity of the clash the error line currently shows; "" when clear. */
	private renderedClashKey = "";
	private saveBtnEl: HTMLButtonElement | null = null;
	/** Releases the new-palette autofocus's scroll hold (modalAutofocus). */
	private releaseAutofocus: (() => void) | null = null;
	/** The second-color swatch, for programmatic sync. Null whenever the row is not built. */
	private gradToInput: HTMLInputElement | null = null;

	constructor(
		private plugin: PaletteEditorPlugin,
		options: {
			existing?: CustomPalette;
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
		} = {},
	) {
		super(plugin.app);
		this.existing = options.existing ?? null;
		this.onUseExisting = options.onUseExisting ?? null;
		// Everything the form *seeds from*. `this.existing` stays reserved for
		// the two things that decide whether this is an edit at all — the name
		// (line below) and the title in onOpen — so a seed fills the colours
		// without the modal claiming to be editing a palette that no longer
		// exists.
		const base: Omit<CustomPalette, "id" | "name"> | null =
			options.existing ?? options.seed ?? null;
		// Callers pass the other CUSTOM palette names; the fixed preset names
		// are merged here so a custom palette can't shadow "Blue" etc. Read via
		// the getters (not a cached const) so the comparison is against the
		// names in the user's current display language.
		this.takenNames = new Set(
			[
				...(options.takenNames ?? []),
				...getObsidianPalettes().map((p) => p.name),
				...getExtraPalettes().map((p) => p.name),
			].map(normalizeName),
		);
		// Same shape as takenNames, one axis over: the presets are pooled in so a
		// custom palette can't be an unnamed copy of "Blue" either.
		this.takenColors = [
			...(options.takenColors ?? []).map(customPaletteToColorPalette),
			...getAllColorPalettes(),
		];
		this.name = this.existing?.name ?? "";
		// Prefers the user's stored pick over the derivation's own output; see
		// seedBaseColor for why that ordering is load-bearing.
		this.baseColor = seedBaseColor(base, DEFAULT_BASE_COLOR);
		const g = base?.bgGradient;
		// Transparency is checked first: a palette can carry a stale gradient
		// beside the flag (nothing clears it when the style switches, so a
		// switch back to Gradient finds it intact), and the flag is what
		// actually gets painted.
		this.bgStyle =
			base?.transparentBg ? "none"
			: g ? "gradient"
			: "solid";
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
		this.bgIntensityTouched =
			base?.bgIntensity !== undefined || options.seed !== undefined;
		this.bgIntensity =
			base?.bgIntensity ??
			(this.bgStyle === "gradient"
				? DEFAULT_BG_INTENSITY_GRADIENT
				: DEFAULT_BG_INTENSITY_SOLID);
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
		this.gradientToBase =
			g?.toColorLight ?? rotateHue(this.baseColor, GRADIENT_HUE_SHIFT);
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
		this.setTitle(
			this.existing ? t("palette.editTitle") : t("palette.newTitle"),
		);
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass("callout-studio-palette-editor");
		// Same shell and width as the callout editor: fixed title with a rule,
		// scrolling content (the sticky preview column relies on that scroll
		// container), and a fixed footer for the buttons.
		this.modalEl.addClass("callout-studio-editor-modal");
		const footer = applyModalChrome(this, { footer: true, wide: true });

		// Two-column body in the same order as the per-role style popups: the
		// sticky live preview on the left, the control cards on the right.
		const panel = contentEl.createDiv({
			cls: "callout-studio-preview-panel",
		});
		const previewCol = panel.createDiv({
			cls: "callout-studio-preview-col",
		});
		const adjustCol = panel.createDiv({ cls: "callout-studio-adjust-col" });

		// The fixed card. It holds the two rows nothing else can change — the
		// name, and the style dropdown that drives the card below it. Keeping
		// the dropdown out here is what lets its own `change` handler rebuild
		// that card without tearing the `<select>` out from under the pointer.
		// `cs-layout-group` is the modifier for a box of plain Setting rows
		// (the callout editor's Picture box, the style popups' Align box).
		const paletteCard = createControlGroup(
			adjustCol,
			t("palette.groupPalette"),
			"cs-layout-group",
		);

		const nameSetting = new Setting(paletteCard)
			.setName(t("palette.name"))
			// Shares one control width with the Style row directly below it, so
			// the field and the dropdown end on the same edge instead of each
			// taking whatever its own content asks for (see styles.css).
			.setClass("cs-palette-name-setting")
			.addText((text) => {
				this.nameInputEl = text.inputEl;
				text.inputEl.maxLength = MAX_NAME_LENGTH;
				text.setPlaceholder(t("palette.namePlaceholder"))
					.setValue(this.name)
					.onChange((v) => {
						this.name = v;
						this.updateValidity();
					});
			});
		// Error line in the info column, mirroring the callout IDs error.
		this.nameErrorEl = nameSetting.descEl.createDiv({ cls: "cs-tag-error" });

		this.buildBgStyleRow(paletteCard);

		// Between the two cards, and outside both: renderColorSection() tears
		// its rows down on every switch, and this message must survive that
		// (see renderColorError on why it is not rebuilt needlessly).
		this.colorErrorEl = adjustCol.createDiv({
			cls: "cs-tag-error cs-palette-color-error",
		});

		this.colorCardEl = createControlGroup(
			adjustCol,
			// The same string the advanced grid used to head itself with — the
			// card wears it now, so that inner heading is gone.
			t("palette.advancedColors"),
			"cs-layout-group",
		);
		this.renderColorSection();

		this.previewEl = previewCol.createDiv({
			cls: "cs-palette-live-preview",
		});
		// Capture any preview the caller already registered (e.g. the callout
		// editor's, when this modal is opened over it) so it can be restored on
		// close instead of clearing the registry's single preview slot to null.
		this.outerPreview = this.plugin.registry.getPreviewDefinition();
		this.outerPreviewIsDemo = this.plugin.registry.isPreviewDemo();
		this.preview = new LiveCalloutPreview(this.plugin.app, this.previewEl, {
			title: t("editor.livePreview"),
			initialText: this.buildSampleText(),
			// Push the derived palette into the registry under the reserved
			// preview ID and re-inject CSS so the callout renders live.
			beforeRender: () => {
				// A demo placeholder: the palette editor previews a derived
				// palette on a stand-in callout, it never edits a real one.
				this.plugin.registry.setPreviewDefinition(
					this.buildPreviewDefinition(),
					true,
				);
				this.plugin.cssInjector.inject(false);
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
				);
				this.plugin.cssInjector.inject(false);
			},
		});

		const buttons = footer;
		buttons
			.createEl("button", { text: t("editor.cancel") })
			.addEventListener("click", () => this.finish(false));
		this.saveBtnEl = buttons.createEl("button", {
			text: t("palette.save"),
			cls: "mod-cta",
		});
		this.saveBtnEl.addEventListener("click", () => this.finish(true));
		this.updateValidity();

		// Creating only, and last, on the finished window — `existing` is the
		// same thing the title asks above, so the `seed` rebuild counts as a
		// create and gets the cursor it exists to ask for. See modalAutofocus.
		if (!this.existing) {
			this.releaseAutofocus = autofocusOnOpen(this.contentEl, this.nameInputEl);
		}
	}

	/** True when the typed name collides with another palette or a preset. */
	private isNameTaken(): boolean {
		return this.takenNames.has(normalizeName(this.name));
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
		return (
			this.takenColors.find((p) => palettesVisuallyEqual(p, current)) ?? null
		);
	}

	/**
	 * Duplicate names AND duplicate colors are both hard-blocked: the offending
	 * control is marked, an error shows beside it, and Save stays disabled until
	 * the palette is unique on both axes.
	 *
	 * The color half runs from the live preview's `beforeRender`, which is the
	 * one funnel every color change already goes through — hooking the
	 * individual swatches, the intensity slider, the gradient rows and the
	 * background-style toggle separately would leave the block one forgotten
	 * call site away from being wrong.
	 */
	private updateValidity(): void {
		const nameTaken = this.isNameTaken();
		this.nameInputEl?.toggleClass("cs-input-invalid", nameTaken);
		if (this.nameErrorEl) {
			this.nameErrorEl.setText(nameTaken ? t("palette.nameExists") : "");
			this.nameErrorEl.toggleClass("is-visible", nameTaken);
		}
		this.colorClash = this.findColorClash();
		this.renderColorError();
		if (this.saveBtnEl) {
			this.saveBtnEl.disabled = nameTaken || this.colorClash !== null;
		}
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
		el.toggleClass("is-visible", clash !== null);
		if (!clash) return;
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
			this.gradientToBase = rotateHue(
				this.baseColor,
				GRADIENT_HUE_SHIFT,
			);
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
	 * A dropdown rather than the segmented switch this used to be: the options
	 * column is narrow, and three labelled buttons beside a name left the name
	 * itself ellipsised to "St…" in English and worse in every language with a
	 * longer word for "gradient". A `<select>` costs one fixed width no matter
	 * how many options it holds or how they translate. `cs-palette-bgstyle-setting`
	 * is what pins that width to the Name field's above it (see styles.css).
	 */
	private buildBgStyleRow(parent: HTMLElement): void {
		const bgStyleSetting = new Setting(parent)
			.setName(t("palette.bgStyle"))
			.setClass("cs-palette-bgstyle-setting");
		bgStyleSetting.addDropdown((dd) => {
			dd.addOption("solid", t("palette.bgSolid"))
				.addOption("gradient", t("palette.bgGradient"))
				.addOption("none", t("palette.bgTransparent"))
				.setValue(this.bgStyle)
				.onChange((raw) => {
					const v = raw as BgStyle;
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
						this.bgIntensity =
							v === "gradient"
								? DEFAULT_BG_INTENSITY_GRADIENT
								: DEFAULT_BG_INTENSITY_SOLID;
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
	 * A `callout-studio-slider-row`, not a plain Setting: the card is ~250px
	 * wide inside its padding, and a track sharing that line with its label
	 * would be squeezed to half of it. The row puts the label and Obsidian's
	 * value readout above a full-width track, exactly as the per-role style
	 * popups do. `setDynamicTooltip` stays for builds below 1.13, where
	 * `setDisplayFormat` is missing and there is no readout to read.
	 */
	private buildBgIntensityRow(parent: HTMLElement): void {
		const row = createSliderRow(parent, t("palette.bgIntensity"));
		new Setting(row).addSlider((slider) => {
			setSliderDisplay(slider, (v) => `${v}%`);
			slider
				.setLimits(
					Math.round(MIN_BG_COLOR_AMOUNT * 100),
					Math.round(MAX_BG_COLOR_AMOUNT * 100),
					1,
				)
				.setValue(Math.round(this.bgIntensity * 100))
				.setDynamicTooltip()
				.setInstant(true)
				.onChange((v) => {
					this.bgIntensity = v / 100;
					this.bgIntensityTouched = true;
					this.applyDerived();
				});
		});
		this.colorCardRows.push(row);
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
	 * direct children of the card so that its sibling-separator rule can draw
	 * the hairline between them, and `+` is structural: a row left in the DOM
	 * under `display: none` still counts as the previous sibling, so the first
	 * *visible* row would draw a stray line right under the card header.
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
	}

	/**
	 * The default color control: one Base color swatch that derives all six
	 * colors (see applyDerived). The row itself lives in
	 * `paletteBaseColorRow.ts`.
	 */
	private buildSimpleColorRow(parent: HTMLElement): void {
		const settingEl = renderBaseColorRow(parent, {
			base: this.baseColor,
			// Gradient has no advanced per-channel view for the link to reach.
			showHint: this.bgStyle === "solid",
			onPick: (hex) => {
				this.baseColor = hex;
				this.applyDerived();
			},
			onAdvanced: () => {
				this.advancedColors = true;
				this.renderColorSection();
			},
		});
		this.colorCardRows.push(settingEl);
	}

	/**
	 * Advanced per-color grid: a note saying which theme mode is being edited
	 * (with the "Revert" link back to the single Base color, which re-derives
	 * all six from it rather than keeping the edits below), then independent
	 * Accent/Background swatches for ONLY that mode — plus Text, which is
	 * gated off behind {@link SHOW_TEXT_COLOR_CHANNEL}. Editing one infers a
	 * matching value for the hidden mode via inferOppositeModeColor (mirror
	 * lightness, then contrast-correct for Accent/Text — see that
	 * function's doc). Deliberately per-channel: editing Accent never
	 * touches Background or Text. Contrast is enforced as a non-blocking
	 * warning badge, not an auto-fix, so an edit here never silently
	 * changes a value the user didn't touch.
	 */
	private buildAdvancedColorRows(parent: HTMLElement): void {
		const isDark = activeDocument.body.classList.contains("theme-dark");

		// Description only, no name: the card's own header already reads
		// "Colors", and a row repeating it would be a heading under a heading.
		const note = new Setting(parent).setClass("cs-palette-mode-note");
		this.colorCardRows.push(note.settingEl);
		note.setDesc(
			t("palette.advancedColorsHint", {
				mode: isDark ? t("palette.darkMode") : t("palette.lightMode"),
			}),
		);
		renderInlineLinkHint(note.descEl, {
			textKey: "palette.revertHint",
			linkKey: "palette.revertHintLink",
			// Reverting is an undo, not just a view switch: the six colors go
			// back to what Base color derives, discarding whatever the rows
			// above wrote. Without this the hand-edited channels stayed in
			// state — the simple row showed the untouched base color while the
			// preview, and then the saved palette, still painted the manual
			// ones, so "revert" visibly did nothing. Rebuild first, then
			// derive: applyDerived() pushes into swatches, which have to be the
			// fresh ones (same order as the background-style dropdown).
			onClick: () => {
				this.advancedColors = false;
				this.renderColorSection();
				this.applyDerived();
			},
		});

		const accentKey: "colorLight" | "colorDark" = isDark
			? "colorDark"
			: "colorLight";
		const accentOppositeKey: "colorLight" | "colorDark" = isDark
			? "colorLight"
			: "colorDark";
		const bgKey: "bgColorLight" | "bgColorDark" = isDark
			? "bgColorDark"
			: "bgColorLight";
		const bgOppositeKey: "bgColorLight" | "bgColorDark" = isDark
			? "bgColorLight"
			: "bgColorDark";
		const textKey: "textColorLight" | "textColorDark" = isDark
			? "textColorDark"
			: "textColorLight";
		const textOppositeKey: "textColorLight" | "textColorDark" = isDark
			? "textColorLight"
			: "textColorDark";

		// One helper for the channel rows so each is registered for teardown
		// exactly once — the swatch call used to build its Setting inline, and
		// an inline Setting has no handle to push onto colorCardRows. Called
		// only from a row that is actually built, so a gated-off channel adds
		// nothing to the card and nothing to tear down.
		const channelRow = (label: string): HTMLElement => {
			const setting = new Setting(parent)
				.setName(label)
				.setClass("cs-row-inline");
			this.colorCardRows.push(setting.settingEl);
			return setting.controlEl;
		};

		const accentSwatch = createColorSwatchInput(
			channelRow(t("palette.accentColor")),
			this.colors[accentKey],
			(hex) => {
				this.colors[accentKey] = hex;
				this.colors[accentOppositeKey] = inferOppositeModeColor(
					hex,
					isDark,
					this.colors[bgOppositeKey],
					3,
				);
				refreshWarnings();
				this.preview?.refresh();
			},
		);

		createColorSwatchInput(
			channelRow(t("palette.backgroundColorChannel")),
			this.colors[bgKey],
			(hex) => {
				this.colors[bgKey] = hex;
				this.colors[bgOppositeKey] = inferOppositeModeColor(
					hex,
					isDark,
					null,
					null,
				);
				refreshWarnings();
				this.preview?.refresh();
			},
		);

		// Kept whole, behind the flag, rather than deleted: the channel is still
		// a real part of a palette, so this stays ready to switch back on.
		const textSwatch = SHOW_TEXT_COLOR_CHANNEL
			? createColorSwatchInput(
					channelRow(t("palette.textColorChannel")),
					this.colors[textKey],
					(hex) => {
						this.colors[textKey] = hex;
						this.colors[textOppositeKey] = inferOppositeModeColor(
							hex,
							isDark,
							this.colors[bgOppositeKey],
							4.5,
						);
						refreshWarnings();
						this.preview?.refresh();
					},
				)
			: null;

		// Re-checks the contrast-dependent swatches (Accent >=3:1, Text
		// >=4.5:1) against the current mode's bg after any row changes — a
		// non-blocking heads-up, never a block on Save. The Text check needs
		// its swatch to have a badge to write to, so it follows the flag: with
		// the row gone the text color is whatever derivation produced, which is
		// already contrast-corrected, so there is nothing to warn about.
		const refreshWarnings = (): void => {
			const bg = this.colors[bgKey];
			setContrastWarning(
				accentSwatch.warnEl,
				contrastRatio(this.colors[accentKey], bg) < 3,
			);
			if (textSwatch) {
				setContrastWarning(
					textSwatch.warnEl,
					contrastRatio(this.colors[textKey], bg) < 4.5,
				);
			}
		};
		refreshWarnings();
	}

	/**
	 * Gradient-only row for the second color. Built separately from the rest
	 * of the gradient controls so the Intensity row can sit directly below it
	 * (see the order renderColorSection builds them in).
	 */
	private buildGradientToRow(parent: HTMLElement): void {
		const toSetting = new Setting(parent)
			.setName(t("palette.gradientTo"))
			.setClass("cs-row-inline");
		this.colorCardRows.push(toSetting.settingEl);
		this.gradToInput = createColorSwatchInput(
			toSetting.controlEl,
			this.gradientToBase,
			(hex) => {
				this.gradientToBase = hex;
				this.gradientToTouched = true;
				this.deriveGradientEnd();
				this.syncGradientInputs();
				this.preview?.refresh();
			},
		).input;
	}

	/**
	 * Gradient-only rows, shown while the Gradient style is selected: the
	 * direction picker and the title-text sweep toggle.
	 */
	private buildGradientDirectionAndTextRows(parent: HTMLElement): void {
		// Three 26px arrows on the phone (see the .is-mobile rule that pins that
		// size) — well under the width of a row, so `cs-row-inline` too.
		const dirSetting = new Setting(parent)
			.setName(t("palette.gradientDirection"))
			.setClass("cs-row-inline");
		this.colorCardRows.push(dirSetting.settingEl);
		renderDirectionPicker(dirSetting.controlEl, this.angleDeg, (deg) => {
			this.angleDeg = deg;
			this.preview?.refresh();
		});

		const textSetting = new Setting(parent)
			.setName(t("palette.gradientText"))
			.addToggle((toggle) => {
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
		const entries: [HTMLInputElement | null | undefined, string][] = [
			[this.gradToInput, this.gradientToBase],
		];
		for (const [input, value] of entries) {
			if (!input) continue;
			input.value = value;
			if (input.parentElement) {
				input.parentElement.style.backgroundColor = value;
			}
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
			t("editor.sampleInlineText").replace("{id}", id),
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
		// Save stays disabled on a duplicate name or duplicate colors, but
		// guard anyway.
		if (save && (this.isNameTaken() || this.findColorClash())) return;
		const resolve = this.resolve;
		this.resolve = null;
		let result: PaletteEditorResult | null = null;
		if (save) {
			const typed = this.name.trim();
			const name =
				typed ||
				dedupeColorName(
					suggestColorName(this.colors.colorLight),
					this.takenNames,
				);
			const gradient = this.currentGradient();
			result = {
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
				...(this.bgStyle === "none"
					? { transparentBg: true as const }
					: {}),
				// Saved regardless of the current bgStyle so a palette left in
				// advanced mode while Gradient was selected still reopens
				// advanced if the user switches back to Solid later.
				...(this.advancedColors ? { colorMode: "advanced" as const } : {}),
			};
		}
		this.close();
		resolve?.(result);
	}

	onClose(): void {
		// Destroys the embedded editor and, via onDestroy, restores the outer
		// preview registration (if any) and re-injects CSS.
		this.preview?.destroy();
		this.preview = null;
		this.contentEl.empty();
		// Detached with the content above, so drop the handles rather than
		// leave the card's rows reachable from a closed window.
		this.colorCardEl = null;
		this.colorCardRows = [];
		this.gradToInput = null;
		this.releaseAutofocus?.();
		this.releaseAutofocus = null;
		// The button bar is a sibling of contentEl, so emptying that misses it.
		removeModalChrome(this);
		if (this.resolve) {
			this.resolve(null);
			this.resolve = null;
		}
	}
}
