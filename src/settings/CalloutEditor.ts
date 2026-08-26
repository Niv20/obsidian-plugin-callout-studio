/**
 * settings/CalloutEditor.ts — Modal dialog for creating and editing callouts.
 *
 * The main user-facing form: lets the user set a display name, ID/aliases,
 * icon, accent color, background color, text color, fold behavior, and icon
 * positioning. Opens the IconPicker for icon selection and renders an editable,
 * real-Obsidian live preview via LiveCalloutPreview. Save logic is delegated to
 * CalloutEditorSave; validation to CalloutEditorValidation.
 */
import { Modal, Notice, Setting, setIcon } from "obsidian";
import type {
	ExtraButtonComponent,
	TextComponent,
	ToggleComponent,
} from "obsidian";
import type {
	BgGradient,
	CalloutDefinition,
	CalloutIcon,
	CalloutRenderRole,
	CustomPalette,
} from "../types";
import {
	buildIconAdjust,
	resolveIconAdjust,
	type ResolvedIconAdjust,
} from "../utils/iconAdjust";
import { IconPicker } from "./iconpicker";
import { LiveCalloutPreview } from "./LiveCalloutPreview";
import { PREVIEW_PLACEHOLDER_ID } from "../constants";
import {
	bgGradientsEqual,
	bgTintFor,
	DEFAULT_TEXT_COLOR_LIGHT,
	DEFAULT_TEXT_COLOR_DARK,
} from "../utils/colorUtils";
import {
	getObsidianPalettes,
	getExtraPalettes,
	bakePaletteColors,
	customPaletteToColorPalette,
	findPaletteWithSameColors,
	generatePaletteId,
	getDefaultNewCalloutPalette,
	DEFAULT_NEW_CALLOUT_PALETTE_ID,
	type ColorPalette,
} from "../utils/colorPalettes";
import { t } from "../i18n";
import { sanitizeCalloutIdInput } from "../utils/calloutId";
import { TagInput } from "../ui/TagInput";
import { renderInlineLinkHint } from "../ui/inlineLinkHint";
import {
	renderColorCircles,
	resolveCurrentModeColors,
} from "../ui/ColorCircles";
import { PaletteEditorModal } from "./PaletteEditorModal";
import type { CalloutEditorPlugin } from "./editor/types";
import {
	buildStateSnapshot,
	canUseCalloutId,
	findAttrIdCollision,
	hasStateChanges,
	isOverwritingAutoFallbackRow,
	isStateValid,
	shouldSaveNewAutocompleteCalloutAsFallback,
} from "./editor/CalloutEditorValidation";
import { renderCalloutEditorIconPreview } from "./editor/CalloutEditorIconRenderer";
import { performCalloutEditorSave } from "./editor/CalloutEditorSave";
import {
	hasAuthoredBackground,
	hasAuthoredIconAdjust,
	hasAuthoredTextColors,
} from "./editor/authoredStyle";
import { findUserImage } from "../icons/packs/userImages";
import { describeIcon } from "../icons/describeIcon";
import { iconsEqual } from "../icons/lucideId";
import { createControlGroup } from "./styleControls";
import { renderIconAdjustGroup } from "./editor/iconAdjustGroup";
import { applyModalChrome, removeModalChrome } from "./modalChrome";
import { refreshAllCalloutEditors } from "../editor/livepreview/refresh";
import { activeThemeName } from "../manager/theme/customCssApi";
import { patternMatches } from "../manager/theme/themeClaimLookup";
import type { PatternOp } from "../manager/theme/themeCalloutScan";
import { obsidianCalloutAttrId } from "../utils/calloutId";

// Derive a callout ID from the display name. Spaces are preserved (the ID may
// be a human-readable, multi-word label like "multi word callout"); the shared
// sanitizer just lowercases, restricts the charset, and collapses/trims runs.
function generateId(displayName: string): string {
	return sanitizeCalloutIdInput(displayName);
}

/**
 * Header for each icon-adjustment box: what is being adjusted, then which
 * callout's icon it belongs to — "Icon adjustment — Heading callout". The role
 * name alone read as a section about the whole heading callout rather than
 * about its icon, which is all these three sliders touch.
 *
 * Composed from the two strings that already say each half in all 32 locales
 * (the role names are the ones the Global settings section heads its three rows
 * with, so the two panels name the same three things identically) rather than
 * from a new per-role phrase, which would need translating 32 times to say
 * something both halves already say.
 *
 * A thunk rather than a plain string map: `t()` must run after the locale is
 * resolved, not at module load.
 */
const ICON_ADJUST_ROLE_LABEL: Record<CalloutRenderRole, () => string> = {
	regular: () => t("settings.calloutTypeRegular"),
	heading: () => t("settings.calloutTypeHeading"),
	inline: () => t("settings.calloutTypeInline"),
};

function iconAdjustHeader(role: CalloutRenderRole): string {
	return `${t("editor.iconAdjustment")} — ${ICON_ADJUST_ROLE_LABEL[role]()}`;
}

/**
 * The order the three boxes are stacked in — display order only, deliberately
 * not `CALLOUT_RENDER_ROLES`: that constant is what the CSS, cache and import
 * sweeps iterate, and reordering it to suit this panel would move behaviour to
 * serve a layout.
 *
 * Block callout closes the group rather than opening it. Its icon is the one that
 * already sits right by default, so it is the least likely of the three to be
 * touched, while the two token roles — which share a baseline-aligned icon and
 * so are the ones a nudge is usually for — lead.
 */
const ICON_ADJUST_ORDER: readonly CalloutRenderRole[] = [
	"heading",
	"inline",
	"regular",
];

// Derive a display name from a user-typed ID: sentence-case the first letter
// and keep everything else (spaces, dashes) intact so generateId() on the
// result round-trips to the same ID. Caseless scripts (e.g. Hebrew) pass
// through unchanged.
function deriveDisplayNameFromId(id: string): string {
	return id.replace(/^\p{L}/u, (c) => c.toUpperCase());
}

/**
 * The colour half of the form state — exactly the fields a palette writes.
 * Used both for the committed values and for the transient hover preview
 * (see {@link CalloutEditor.previewColorOverride}).
 */
type EditorColorState = {
	colorLight: string;
	colorDark: string;
	bgColorLight: string;
	bgColorDark: string;
	bgGradient: BgGradient | undefined;
	/**
	 * Paint no background — a separate axis from the two colours above, which
	 * stay concrete hexes throughout the form even while this is on. The form
	 * must always hold a real colour (a swatch has to show something, and
	 * `matchesPalette` compares the strings), so the now-unused hex is simply
	 * not persisted; see `performCalloutEditorSave`.
	 */
	transparentBg: boolean;
	textColorLight: string;
	textColorDark: string;
};

/**
 * The colour state a built-in's shipped definition would produce in the form —
 * not just its raw fields. `constants.ts` only ever sets `colorLight`/`colorDark`
 * on a built-in; the background tint and text colours are derived on the fly
 * (same formulas the constructor uses at lines ~179-196). Comparing against the
 * raw definition would treat every untouched built-in as "changed" the moment
 * the modal opens, since the constructor always fills those fields with a
 * concrete derived value.
 */
function defaultColorStateFor(def: CalloutDefinition): EditorColorState {
	// Key order here must match `readColorState()` exactly: the two are compared
	// as JSON strings (see `colorMatchesDefault`), which is order-sensitive, so a
	// field added to one at a different position silently breaks the comparison
	// even when every value agrees.
	return {
		colorLight: def.colorLight,
		colorDark: def.colorDark,
		bgColorLight: def.bgColorLight ?? bgTintFor(def.colorLight, false),
		bgColorDark: def.bgColorDark ?? bgTintFor(def.colorDark, true),
		bgGradient: def.bgGradient ? { ...def.bgGradient } : undefined,
		transparentBg: def.transparentBg === true,
		textColorLight: def.textColorLight ?? DEFAULT_TEXT_COLOR_LIGHT,
		textColorDark: def.textColorDark ?? DEFAULT_TEXT_COLOR_DARK,
	};
}

/**
 * The form's current colours as a palette seed — everything a `CustomPalette`
 * needs except the identity the user is about to give it.
 *
 * Safe under `transparentBg`, which is why it maps the two axes separately: the
 * form always holds concrete background hexes beside the flag (see
 * {@link EditorColorState}), and `CustomPalette` wants exactly that — all six
 * colours valid, with transparency as its own field. It is also what
 * `sanitizeCustomPalettes` requires, and what a switch back to Solid inside the
 * palette editor restores.
 *
 * `transparentBg` is spread conditionally rather than assigned: the field is
 * typed `true`, not `boolean`, because writers omit the key instead of writing
 * `false`.
 *
 * `colorMode: "advanced"` is deliberate. These six colours are a real callout's
 * current appearance, and nothing guarantees they are derivable from one base
 * colour — a callout may carry a hand-picked background or text colour that the
 * single Base swatch simply cannot express. The advanced grid shows them as
 * they are, and it is also the mode that keeps them: the Intensity slider
 * beside the simple control re-derives all six from the base colour on a single
 * drag. The grid's "prefer a single base color" link is the way back.
 */
function paletteSeedFromColorState(
	state: EditorColorState,
): Omit<CustomPalette, "id" | "name"> {
	return {
		colorLight: state.colorLight,
		colorDark: state.colorDark,
		bgColorLight: state.bgColorLight,
		bgColorDark: state.bgColorDark,
		textColorLight: state.textColorLight,
		textColorDark: state.textColorDark,
		bgGradient: state.bgGradient ? { ...state.bgGradient } : undefined,
		...(state.transparentBg ? { transparentBg: true as const } : {}),
		colorMode: "advanced",
	};
}

export class CalloutEditor extends Modal {
	private plugin: CalloutEditorPlugin;
	private existingId: string | null;
	private isBuiltIn: boolean;
	/**
	 * Governs how the result is SAVED, not how the form is seeded — every
	 * create-new flow seeds from the fallback callout alike (see the
	 * constructor). What this still decides: whether an untouched new callout
	 * saves as `source: "fallback"`, whether it may overwrite a discovery-created
	 * row of the same id, and whether a display name is required.
	 */
	private createFromAutocomplete: boolean;
	/**
	 * The definition the form fields below were seeded from — the callout being
	 * edited, or the fallback callout for a new one; undefined only if the
	 * registry held no fallback at all. Kept so `buildPreviewDefinition()` can
	 * tell a value the user chose from one the constructor inherited or invented
	 * — the form fields themselves cannot answer that, since both look like a
	 * concrete colour.
	 */
	private readonly baselineDef: CalloutDefinition | undefined;
	private resolve: ((result: CalloutDefinition | null) => void) | null = null;

	// Form state
	private displayName: string;
	private calloutId: string;
	private icon: CalloutIcon;
	/**
	 * Draw this callout with no icon. `icon` above is left holding whatever was
	 * last picked, so the tile's ⓧ is undoable: re-opening the picker lands on
	 * that exact drawing, already highlighted.
	 */
	private hideIcon: boolean;
	private colorLight: string;
	private colorDark: string;
	private bgColorLight: string;
	private bgColorDark: string;
	/** Background gradient baked from the applied palette, if any. */
	private bgGradient: BgGradient | undefined;
	/** Paint no background at all — see `EditorColorState.transparentBg`. */
	private transparentBg: boolean;
	private textColorLight: string;
	private textColorDark: string;
	private foldable: boolean;
	private defaultFolded: boolean;
	/**
	 * Icon size and offsets, resolved into one independent triple per render
	 * role at open. Resolving up front (rather than leaving roles implicitly
	 * sharing the legacy value) is what keeps the three groups independent:
	 * dragging Block callout never drags Heading along behind it.
	 */
	private iconAdjust: Record<CalloutRenderRole, ResolvedIconAdjust>;
	private aliases: string[];
	/** Id of the palette (custom or preset) currently applied, if any. */
	private paletteId: string | undefined;
	private preview: LiveCalloutPreview | null = null;
	private noteRefreshFrame: number | null = null;
	private updatePreviewFrame: number | null = null;
	private recolorToggle: ToggleComponent | null = null;
	/**
	 * Re-reads the Picture section from the current icon: whether it applies at
	 * all, and what it should show. Assigned when the section is built, because
	 * that is the only place its elements exist; the icon picker is the one thing
	 * that can invalidate it afterwards.
	 */
	private syncPictureBox: () => void = () => undefined;
	/**
	 * Shows or hides the three per-role icon-adjustment boxes. Size and offset
	 * describe an icon, so with `hideIcon` on there is nothing for nine sliders
	 * to move — and their stored values are kept, not reset, so turning the icon
	 * back on restores the nudges with it.
	 */
	private syncIconAdjust: () => void = () => undefined;
	/**
	 * Colours the live preview shows *instead of* the committed ones while the
	 * user hovers a palette that was never clicked. Deliberately kept out of
	 * the form fields above: those feed `stateSnapshot()` and `save()`, so a
	 * mere hover must not light up "Save changes", must not repaint the
	 * settings-list swatches, and above all must not be what gets saved.
	 * Cleared on commit, on menu close and before saving.
	 */
	private previewColorOverride: EditorColorState | null = null;
	private previewFoldCollapsed = false;
	private idsTagInput: TagInput | null = null;
	private nameTextInput: TextComponent | null = null;
	/** The last display name auto-filled live from ID-field typing (reverse link). */
	private idDrivenName = "";
	private hasHadCalloutId = false;
	private saveBtn: HTMLButtonElement | null = null;
	private isSaveActionEnabled = false;
	private initialSnapshot: string = "";
	private initialStyleSnapshot: string = "";
	private removePopupOutsideClickListener: (() => void) | null = null;

	constructor(
		plugin: CalloutEditorPlugin,
		existing?: CalloutDefinition,
		options?: {
			seedDisplayName?: string;
			createFromAutocomplete?: boolean;
		},
	) {
		super(plugin.app);
		this.plugin = plugin;
		this.existingId = existing?.id ?? null;
		this.isBuiltIn = existing?.builtIn ?? false;
		this.createFromAutocomplete = options?.createFromAutocomplete === true;
		// EVERY create-new flow seeds from the fallback callout, not just the
		// autocomplete one. That callout is what the user picked under "Default
		// fallback callout", whose own description promises unrecognized types
		// inherit its style — so a callout being created deliberately should open
		// looking the same, no matter which button opened this editor (settings'
		// add button, the command palette, or autocomplete's "Create new").
		const fallbackBase = existing ? undefined : this.getFallbackBase();
		// The one definition every field below reads through. Also the baseline
		// the `hasAuthored…` gates measure against, so a value merely inherited
		// from the fallback is omitted from the save rather than baked on.
		const seed = existing ?? fallbackBase;
		this.baselineDef = seed;
		// Last resort for the accents, only reachable if the registry somehow holds
		// neither the configured fallback nor `note`. It must be a real palette:
		// colours matching none open the dropdown reading "Deleted color".
		// Accents ONLY — the backgrounds below stay derived from whatever accent
		// won, or a non-blue fallback would open wearing blue's tint.
		const defaultPalette = getDefaultNewCalloutPalette();

		this.displayName =
			existing?.displayName ?? options?.seedDisplayName ?? "";
		this.calloutId =
			existing?.id ?? generateId(options?.seedDisplayName ?? "");
		this.icon = seed?.icon
			? { ...seed.icon }
			: { type: "lucide", value: "lucide-pencil" };
		this.hideIcon = seed?.hideIcon === true;
		this.colorLight = seed?.colorLight ?? defaultPalette.colorLight;
		this.colorDark = seed?.colorDark ?? defaultPalette.colorDark;
		this.bgColorLight =
			seed?.bgColorLight ?? bgTintFor(this.colorLight, false);
		this.bgColorDark = seed?.bgColorDark ?? bgTintFor(this.colorDark, true);
		const baseGradient = seed?.bgGradient;
		this.bgGradient = baseGradient ? { ...baseGradient } : undefined;
		// The bg hexes above stay as derived: a transparent def carries none, so
		// they fall back to the accent tint and sit unused until the user picks a
		// colour again, exactly as the form expects.
		this.transparentBg = seed?.transparentBg === true;
		this.textColorLight = seed?.textColorLight ?? DEFAULT_TEXT_COLOR_LIGHT;
		this.textColorDark = seed?.textColorDark ?? DEFAULT_TEXT_COLOR_DARK;
		this.foldable = seed?.foldable ?? false;
		this.defaultFolded = seed?.defaultFolded ?? false;
		// resolveIconAdjust already falls a role back to the legacy flat trio and
		// clamps, so data written before per-role adjustment opens with all three
		// groups showing that shared value — exactly what it renders as today.
		this.iconAdjust = {
			regular: resolveIconAdjust(seed, "regular"),
			heading: resolveIconAdjust(seed, "heading"),
			inline: resolveIconAdjust(seed, "inline"),
		};
		this.aliases = [...(existing?.aliases ?? [])];
		// Keyed off whether there is a seed at all, NOT `seed?.paletteId ?? blue`:
		// a fallback saved before paletteId existed carries none, and defaulting it
		// to blue would label the dropdown "Blue" over that callout's real hexes.
		// With no seed, the colours above ARE the blue preset, so the id fits.
		this.paletteId = seed
			? seed.paletteId
			: DEFAULT_NEW_CALLOUT_PALETTE_ID;
		this.previewFoldCollapsed = this.foldable && this.defaultFolded;
		this.hasHadCalloutId =
			this.calloutId.trim().length > 0 || this.aliases.length > 0;
	}

	openAndWait(): Promise<CalloutDefinition | null> {
		return new Promise<CalloutDefinition | null>((resolve) => {
			this.resolve = resolve;
			super.open();
		});
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass("callout-studio-editor");
		// Standard window shell; the extra class carries only this editor's
		// width and the panel measurements taken against it.
		this.modalEl.addClass("callout-studio-editor-modal");
		const footerEl = applyModalChrome(this, { footer: true, wide: true });

		// Suspend automatic prune passes while the user is editing so a
		// fallback row currently being customized cannot be auto-removed
		// out from under the modal.
		this.plugin.pruneSuspended = true;

		// Enforce the name↔ID invariant (the primary ID mirrors the display
		// name) before snapshotting, so legacy rows normalize without creating
		// phantom "unsaved changes".
		if (!this.isBuiltIn) this.normalizeNameIdLink();

		// Snapshot initial state for dirty-checking
		this.initialSnapshot = this.stateSnapshot();
		this.initialStyleSnapshot = this.styleSnapshot();

		const editorTitle = this.existingId
			? t("editor.editCallout")
			: t("editor.newCallout");
		this.setTitle(editorTitle);

		// Display Name
		new Setting(contentEl)
			.setName(t("editor.displayName"))
			.setDesc(
				this.isBuiltIn
					? t("editor.displayNameBuiltIn")
					: t("editor.displayNameDesc"),
			)
			.addText((text) => {
				this.nameTextInput = text;
				text.setPlaceholder(
					t("editor.displayNamePlaceholder"),
				).setValue(this.displayName);
				if (this.isBuiltIn) {
					text.setDisabled(true);
				} else {
					text.onChange((value) => {
						this.displayName = value;
						// The pinned primary ID mirrors the name; only that
						// slot is replaced — other IDs are never touched.
						const newPinned = generateId(value);
						if (newPinned) {
							this.calloutId = newPinned;
							this.hasHadCalloutId = true;
							this.idsTagInput?.setPinnedTag(newPinned);
						} else if (!value.trim()) {
							// Name fully cleared: drop the pinned slot
							// (aliases stay).
							this.calloutId = "";
							this.idsTagInput?.setPinnedTag(null);
						}
						// else: the name holds only characters the ID
						// sanitizer strips (e.g. emoji) — keep the current
						// pinned primary rather than orphaning the row.
						if (this.idsTagInput) {
							const pinned = this.idsTagInput.getPinnedTag();
							this.aliases = this.idsTagInput
								.getTags()
								.filter((tag) => tag !== pinned);
						}
						this.updateIdWarning();
						this.updatePreview();
						this.updateSaveState();
					});
				}
				if (!this.isBuiltIn) text.inputEl.focus();
			});

		// Callout IDs (primary + aliases) — unified tag input
		const initialIds = [this.calloutId, ...this.aliases].filter(Boolean);
		const idsSetting = new Setting(contentEl)
			.setName(t("editor.calloutIds"))
			.setClass("cs-callout-ids-setting")
			.setDesc(
				createFragment((frag) => {
					// Render each newline-separated line of the description on
					// its own row (e.g. the "Press Enter…" hint sits below).
					t("editor.calloutIdsDesc")
						.split("\n")
						.forEach((line, i) => {
							if (i > 0) frag.createEl("br");
							frag.appendText(line);
						});
				}),
			);

		// Error element lives in the left description area
		const idsErrorEl = idsSetting.descEl.createDiv();

		this.idsTagInput = new TagInput(idsSetting.controlEl, {
			initialTags: initialIds,
			initialPinnedTag:
				!this.isBuiltIn && this.calloutId ? this.calloutId : undefined,
			placeholder: t("editor.calloutIdsPlaceholder"),
			errorEl: idsErrorEl,
			readonlyTags: this.isBuiltIn ? initialIds : undefined,
			onChange: (tags) => {
				if (tags.length > 0) this.hasHadCalloutId = true;
				const pinned = this.idsTagInput?.getPinnedTag() ?? null;
				if (pinned !== null || !this.isBuiltIn) {
					// The pinned tag is the primary; everything else is an
					// alias. With no pinned tag (name cleared) there is no
					// primary and saving stays blocked.
					this.calloutId = pinned ?? "";
					this.aliases = tags.filter((tag) => tag !== pinned);
				} else {
					// Built-ins have no pinned tag; the readonly first tag is
					// the primary.
					this.calloutId = tags[0] ?? "";
					this.aliases = tags.slice(1);
				}
				this.updateIdWarning();
				this.updatePreview();
				this.updateSaveState();
			},
			onTagAdded: (tag) => {
				// Reverse sync: while there is no pinned primary, the first ID
				// the user adds becomes it — and fills in the display name
				// when that is still empty.
				if (this.isBuiltIn) return;
				if (this.idsTagInput?.getPinnedTag() != null) return;
				if (!this.displayName.trim()) {
					this.displayName = deriveDisplayNameFromId(tag);
					this.nameTextInput?.setValue(this.displayName);
				}
				this.idsTagInput?.setPinnedTag(tag);
				this.calloutId = tag;
				this.aliases =
					this.idsTagInput
						?.getTags()
						.filter((other) => other !== tag) ?? [];
				this.updateIdWarning();
				this.updatePreview();
				this.updateSaveState();
			},
			onInput: (value) => this.syncNameFromIdInput(value),
			validate: (tag) => {
				// A tag added while no pinned primary exists will be promoted
				// to primary by the reverse sync above.
				const willBePinned =
					!this.isBuiltIn &&
					this.idsTagInput?.getPinnedTag() == null;
				const role = willBePinned ? "primary" : "alias";
				if (!this.canUseCalloutId(tag, role)) {
					return t("editor.idConflict");
				}
				const clash = this.findAttrIdCollision(tag);
				if (clash) {
					return t("editor.idDashConflict", { other: clash });
				}
				return null;
			},
		});

		// Sync initial warning state without showing an empty-ID warning before interaction.
		this.updateIdWarning();

		// The pristine shipped definition, only for a built-in being edited. Its
		// mere presence is the single gate for the icon/colour revert buttons —
		// a new callout or a user/fallback/theme/plugin row never gets one.
		const originalDef =
			this.isBuiltIn && this.existingId
				? this.plugin.registry.getBuiltInDefault(this.existingId)
				: undefined;

		// ── Color row ───────────────────────────────────────────────
		// Standard setting row (matching Display name / Callout IDs / Icon).
		// The palette dropdown is built further down — after the live preview
		// exists, since selecting a palette refreshes it — and lands here.
		// The class is what lets styles.css pin this row's control column to the
		// form's shared control width, so the revert button below shortens the
		// dropdown instead of pushing it left off the shared right edge.
		const colorSetting = new Setting(contentEl)
			.setName(t("editor.colors"))
			.setClass("cs-color-setting")
			.setDesc(t("editor.colorsDesc"));

		// Icon
		// `cs-row-inline` keeps the tile beside the label on the phone instead
		// of on a full-width row of its own — the tile is a fixed 44px box, so
		// the row below it would be mostly empty. See the class in styles.css.
		const iconSetting = new Setting(contentEl)
			.setName(t("editor.icon"))
			.setClass("cs-row-inline")
			.setDesc(this.getIconLabel());

		// The tile *is* the picker. A preview square beside a "Pick icon" button
		// is two things pointing at one action; the drawing the user is about to
		// replace is the most direct target that action has, so it is the button.
		// The swap arrow is what says so — the icon fades out under it on hover
		// and focus, which is also why it can share the box instead of overlaying
		// it. (An arrow rather than a pencil since the ⓧ moved in beside it: a
		// pencil next to a delete badge reads as two flavours of "edit this".)
		//
		// A wrapper, not the tile itself, because the ⓧ is a second button and a
		// <button> inside a <button> is not parseable HTML — the parser closes the
		// outer one and re-parents the inner. Two siblings also give the two
		// actions two real focus stops and two labels.
		const iconTileWrap = iconSetting.controlEl.createDiv("cs-icon-tile-wrap");
		const iconTile = iconTileWrap.createEl("button", {
			cls: "cs-icon-tile",
			attr: { type: "button" },
		});
		const iconPreviewEl = iconTile.createDiv("callout-studio-icon-preview");
		const iconGlyphEl = iconTile.createDiv("cs-icon-tile-edit");
		const iconClearBtn = iconTileWrap.createEl("button", {
			cls: "cs-icon-tile-clear",
			attr: { type: "button", "aria-label": t("editor.removeIcon") },
		});
		setIcon(iconClearBtn, "x");

		// Reverts the icon alone to the built-in's shipped value; only shown once
		// it has actually diverged from that default. `iconsEqual` rather than a
		// string diff because `constants.ts` spells a built-in's icon bare
		// (`pencil`) and the picker spells the same drawing `lucide-pencil` — on
		// a raw compare every built-in offered this button the moment its editor
		// opened, having changed nothing.
		let iconRevertBtn: ExtraButtonComponent | null = null;
		const iconMatchesDefault = (): boolean =>
			!originalDef ||
			(iconsEqual(this.icon, originalDef.icon) &&
				this.hideIcon === (originalDef.hideIcon === true));
		const syncIconRevert = (): void => {
			iconRevertBtn?.extraSettingsEl.toggleClass(
				"cs-hidden",
				iconMatchesDefault(),
			);
		};

		// Everything the icon row shows, in one place: three call sites used to
		// repeat four of these lines each and the fifth kept being forgotten.
		const syncIconTile = (): void => {
			iconTileWrap.toggleClass("is-empty", this.hideIcon);
			iconPreviewEl.empty();
			iconGlyphEl.empty();
			if (this.hideIcon) {
				setIcon(iconGlyphEl, "plus");
				iconTile.setAttribute("aria-label", t("editor.pickIcon"));
			} else {
				this.renderIconPreview(iconPreviewEl);
				setIcon(iconGlyphEl, "arrow-left-right");
				iconTile.setAttribute("aria-label", t("editor.replaceIcon"));
			}
			// The ⓧ itself needs no toggle here: `is-empty` on the wrapper above
			// is the one fact, and styles.css takes the badge out of the layout
			// (and so out of the tab order) from that alone.
			iconSetting.setDesc(this.getIconLabel());
			syncIconRevert();
			// The only thing that can turn the Picture section on or off.
			this.syncPictureBox();
			this.syncIconAdjust();
		};

		const openIconPicker = async (): Promise<void> => {
			// `this.icon` even while hidden: the picker seeds its source, style
			// controls and category from the current icon and highlights it in the
			// grid, so an accidental ⓧ is two clicks from undone.
			const picker = new IconPicker(this.plugin, this.icon);
			const result = await picker.openAndWait();
			if (!result) return;
			this.icon = result;
			// Picking a drawing is how you say you want one.
			this.hideIcon = false;
			// Material icons are already cached by the IconPicker
			// before it closes, so the preview can render immediately.
			syncIconTile();
			this.updatePreview();
		};
		iconTile.addEventListener("click", () => {
			void openIconPicker();
		});

		iconClearBtn.addEventListener("click", () => {
			this.hideIcon = true;
			syncIconTile();
			this.updatePreview();
		});

		iconSetting.addExtraButton((btn) => {
			iconRevertBtn = btn;
			btn.setIcon("rotate-ccw")
				.setTooltip(t("editor.resetIcon"))
				.onClick(() => {
					if (!originalDef) return;
					this.icon = { ...originalDef.icon };
					this.hideIcon = originalDef.hideIcon === true;
					syncIconTile();
					this.updatePreview();
				});
		});
		// First paint. `syncPictureBox`/`syncIconAdjust` are still their no-op
		// defaults here — the boxes they hide do not exist yet — so both are
		// called again at the bottom of their own sections.
		syncIconTile();

		// ── Preview + Adjustments Panel (two-column) ────────────────
		const previewPanel = contentEl.createDiv({
			cls: "callout-studio-preview-panel",
		});

		// Left column: single, real-Obsidian rendered preview.
		const previewCol = previewPanel.createDiv({
			cls: "callout-studio-preview-col",
		});
		this.preview = new LiveCalloutPreview(this.app, previewCol, {
			title: t("editor.livePreview"),
			initialText: this.buildSampleText(),
			// Push the in-progress edit into the registry under the reserved
			// preview ID and re-inject CSS so colours/icons render live.
			beforeRender: () => {
				// A brand-new callout has no real row yet, so its preview is a
				// demo (kept out of the settings lists — otherwise the reserved
				// placeholder id it renders under would leak a phantom row).
				// Editing an existing callout previews the real row live.
				this.plugin.registry.setPreviewDefinition(
					this.buildPreviewDefinition(),
					this.existingId === null,
					// A hover preview stays out of the settings lists' refresh:
					// the row swatches must keep showing the colour the user
					// actually picked until a new one is clicked. Every other
					// edit (icon, name, sliders, a committed palette) still
					// repaints them in the next frame.
					this.previewColorOverride === null,
				);
				this.plugin.cssInjector.inject(false);
				this.scheduleNoteDecorationRefresh();
			},
			onDestroy: () => {
				this.plugin.registry.setPreviewDefinition(null);
				this.plugin.cssInjector.inject(false);
				// Synchronous, unlike the scheduled call above: this is the
				// teardown that reverts open notes to their committed state, and
				// onClose cancels any frame still pending by the time it runs.
				refreshAllCalloutEditors();
			},
		});

		// Right column: Adjustments
		const adjustCol = previewPanel.createDiv({
			cls: "callout-studio-adjust-col",
		});

		// ── Icon adjustment: one box per render role ──
		// Stacked rather than tabbed so all nine values stay on screen at once
		// with no mode to remember; the preview column is sticky (styles.css),
		// so it stays in view while this column scrolls.
		const adjustBoxes = ICON_ADJUST_ORDER.map((role) =>
			this.renderIconAdjustGroup(adjustCol, role),
		);
		this.syncIconAdjust = () => {
			for (const box of adjustBoxes) {
				box.toggleClass("cs-hidden", this.hideIcon);
			}
		};
		this.syncIconAdjust();

		// ── Picture section ──
		// Only a picture has anything to say here, so the box hides itself for
		// every other icon rather than showing a switch that does nothing.
		// Same group chrome as the Align box in the global style popup, so the
		// toggle row gets the same padding instead of Obsidian's modal default
		// (which zeroes it and pins the label to the box edge).
		const pictureBox = createControlGroup(
			adjustCol,
			t("editor.picture"),
			"cs-layout-group",
		);
		new Setting(pictureBox)
			.setName(t("iconPicker.imageRecolor"))
			.addToggle((toggle) => {
				this.recolorToggle = toggle;
				toggle.onChange((value: boolean) => {
					// Straight onto the icon, which the save flow and the dirty
					// check already carry — so this stages like every other field
					// here, and Cancel puts it back.
					this.icon = { ...this.icon, recolor: value };
					syncIconRevert();
					this.updatePreview();
				});
			});
		this.syncPictureBox = () => {
			const picture =
				!this.hideIcon && this.icon.type === "image"
					? findUserImage(this.icon.value)
					: undefined;
			// A mask is a stencil, so only a flat drawing can follow the callout;
			// a photo would come out a silhouette. Rather than showing the switch
			// disabled beside a line of prose explaining why, the box just stays
			// out of the way for a raster picture.
			const canFollow = picture?.format === "svg";
			pictureBox.toggleClass("cs-hidden", !canFollow);
			if (!canFollow) return;
			this.recolorToggle?.setValue(this.icon.recolor === true);
		};
		this.syncPictureBox();

		// ── Palette dropdown (fills the Color row created above the preview) ──
		// Build rich palette dropdown (custom widget with circles + names).
		// Rebuilt on every menu open so palettes saved mid-session appear.
		type PaletteEntry = {
			id: string;
			name: string;
			group: ColorPalette["group"];
			palette: ColorPalette;
		};
		const paletteEntries: PaletteEntry[] = [];
		const rebuildPaletteEntries = (): void => {
			paletteEntries.length = 0;
			paletteEntries.push(
				// Custom palettes are user-named, so list them A→Z; the preset
				// groups below keep their curated (non-alphabetical) order.
				...[...this.plugin.settings.customPalettes]
					.sort((a, b) => a.name.localeCompare(b.name))
					.map((p) => {
						const palette = customPaletteToColorPalette(p);
						return {
							id: palette.id,
							name: palette.name,
							group: "custom" as const,
							palette,
						};
					}),
				...getObsidianPalettes().map((p) => ({
					id: p.id,
					name: p.name,
					group: "obsidian" as const,
					palette: p,
				})),
				...getExtraPalettes().map((p) => ({
					id: p.id,
					name: p.name,
					group: "preset" as const,
					palette: p,
				})),
			);
		};
		rebuildPaletteEntries();

		const dropdown = colorSetting.controlEl.createDiv({
			cls: "cs-palette-dropdown",
		});
		const trigger = dropdown.createEl("button", {
			cls: "cs-palette-trigger",
			attr: {
				type: "button",
				"aria-haspopup": "listbox",
				"aria-expanded": "false",
			},
		});
		const triggerCircles = trigger.createDiv({
			cls: "cs-palette-trigger-circles",
		});
		// Fallback label for colors that match no palette — typically a custom
		// palette that was deleted after being applied (colors are baked in).
		const triggerLabel = trigger.createSpan({
			cls: "cs-palette-trigger-label",
			text: t("editor.paletteDeleted"),
		});
		// The same Lucide chevron the icon picker's source button uses, rather
		// than a "▾" glyph: a text caret is sized and baselined by the UI font,
		// so it never quite lines up with the real chevrons elsewhere in the
		// plugin.
		const triggerCaret = trigger.createSpan({
			cls: "cs-palette-trigger-caret",
		});
		setIcon(triggerCaret, "chevron-down");

		// Opens downward: the colors section now sits near the top of the
		// modal, so an upward menu would clip against the modal edge.
		const menu = dropdown.createDiv({
			cls: "cs-palette-menu cs-palette-menu-hidden",
			attr: { role: "listbox", tabindex: "-1" },
		});

		let activeIndex = -1;
		let selectedId = "";
		let menuOpen = false;
		const itemEls: HTMLElement[] = [];
		const readColorState = (): EditorColorState => this.colorState();
		// Reverts colours (and background/text) to the built-in's shipped
		// values; only shown once they have actually diverged from that
		// default. Mirrors `iconMatchesDefault`/`syncIconRevert` above.
		let colorRevertBtn: ExtraButtonComponent | null = null;
		const colorMatchesDefault = (): boolean =>
			!originalDef ||
			JSON.stringify(readColorState()) ===
				JSON.stringify(defaultColorStateFor(originalDef));
		const syncColorRevert = (): void => {
			colorRevertBtn?.extraSettingsEl.toggleClass(
				"cs-hidden",
				colorMatchesDefault(),
			);
		};

		/**
		 * Commit colours to the form state — the only path that may mark the
		 * form dirty. Hovering goes through `previewColorsTransient()` instead.
		 */
		const applyColorState = (state: EditorColorState): void => {
			this.colorLight = state.colorLight;
			this.colorDark = state.colorDark;
			this.bgColorLight = state.bgColorLight;
			this.bgColorDark = state.bgColorDark;
			this.bgGradient = state.bgGradient
				? { ...state.bgGradient }
				: undefined;
			this.transparentBg = state.transparentBg;
			this.textColorLight = state.textColorLight;
			this.textColorDark = state.textColorDark;
			// A real selection supersedes whatever was being hovered.
			this.previewColorOverride = null;
			syncColorRevert();
			this.updatePreview();
		};

		// The trigger swatch mirrors the row swatches: accent + background for
		// the current theme mode. Drawn from the FORM rather than from the
		// matched palette so the "Deleted color" case — where there is no
		// palette to read — needs no branch of its own.
		const renderTriggerCircles = (): void => {
			triggerCircles.empty();
			renderColorCircles(
				triggerCircles,
				resolveCurrentModeColors(readColorState()),
				{ size: 16 },
			);
		};
		const matchesPalette = (palette: ColorPalette): boolean =>
			// Transparency is compared first and alone, and it decides whether
			// the background comparisons below are even the right question. A
			// "None" palette keeps the hexes (and any gradient) that a switch
			// back to Solid would restore, while a transparent callout persists
			// none of them — so under transparency the accent is all there is to
			// match on, and comparing what the form merely derived would push
			// every such callout onto the "Deleted color" branch.
			(palette.transparentBg === true) === this.transparentBg &&
			palette.colorLight.toLowerCase() ===
				this.colorLight.toLowerCase() &&
			palette.colorDark.toLowerCase() === this.colorDark.toLowerCase() &&
			(this.transparentBg ||
				((palette.bgColorLight?.toLowerCase() ?? "") ===
					this.bgColorLight.toLowerCase() &&
					(palette.bgColorDark?.toLowerCase() ?? "") ===
						this.bgColorDark.toLowerCase() &&
					bgGradientsEqual(palette.bgGradient, this.bgGradient)));

		// ── "Deleted color" state ──
		// The row resolves to no palette at all: the one it was saved under was
		// deleted from Settings. Reading "Deleted color" and stopping there is a
		// dead end, so the Color row's description turns into an explanation
		// plus the one action that gets out of it (see updateColorDesc).
		let isOrphanColor = false;
		/** Stale id of the deleted palette, when the orphan still carries one. */
		let orphanPaletteId: string | undefined;

		/**
		 * Swaps the Color row's description between its normal sentence and the
		 * "your saved color was deleted" notice.
		 *
		 * `setDesc` replaces `descEl` wholesale, which is safe *here* only
		 * because this row's description holds nothing else — unlike the callout
		 * IDs row, which appends its own error element into `descEl`.
		 *
		 * The sibling count comes from the registry rather than from anything
		 * the editor holds, so the number the user is promised is measured
		 * against the same map the relink will walk.
		 */
		const updateColorDesc = (): void => {
			if (!isOrphanColor) {
				colorSetting.setDesc(t("editor.colorsDesc"));
				return;
			}
			const others = orphanPaletteId
				? this.plugin.registry.countPaletteLinks(
						orphanPaletteId,
						this.existingId,
					)
				: 0;
			const textKey =
				others === 0 ? "editor.colorsDescDeleted"
				: others === 1 ? "editor.colorsDescDeletedOther"
				: "editor.colorsDescDeletedOthers";
			colorSetting.setDesc("");
			renderInlineLinkHint(colorSetting.descEl, {
				textKey,
				linkKey: "editor.colorsDescDeletedLink",
				vars: { count: others },
				onClick: () => void reviveDeletedPalette(),
			});
		};

		/**
		 * Leave the deleted-colour state. For the paths that set the trigger
		 * label themselves and so never re-run `refreshTriggerFromCurrentColors`
		 * — picking a palette from the menu, or creating one through
		 * "+ New color…".
		 */
		const clearOrphanState = (): void => {
			if (!isOrphanColor) return;
			isOrphanColor = false;
			orphanPaletteId = undefined;
			updateColorDesc();
		};

		/**
		 * Re-resolves the trigger's label/swatch from whatever the form's
		 * colours currently are. Prefers the stable paletteId link (survives a
		 * palette's colors being edited); a paletteId saved under a preset's
		 * old (pre-rename) id still resolves via legacyIds; falls back to hex
		 * matching for definitions saved before paletteId existed at all.
		 * Either way, remembers the resolved id going forward. Called once at
		 * setup and again after a colour revert, so (unlike the one-shot setup
		 * this replaced) the "no match" branch must explicitly reset the label
		 * — it may already be showing a previously selected palette's name.
		 *
		 * The no-match branch deliberately KEEPS `this.paletteId`. It is the
		 * only thing identifying which deleted palette this callout belonged to,
		 * and every callout orphaned by that deletion carries the same one — so
		 * it is what lets reviving the palette from any one of them regroup the
		 * rest. Clearing it here (as this once did) meant merely opening and
		 * saving an orphaned callout silently dissolved its group, since
		 * `performCalloutEditorSave` persists whatever this holds.
		 */
		const refreshTriggerFromCurrentColors = (): void => {
			const matched =
				(this.paletteId
					? paletteEntries.find(
							(e) =>
								e.id === this.paletteId ||
								e.palette.legacyIds?.includes(
									this.paletteId as string,
								),
						)
					: undefined) ??
				paletteEntries.find(({ palette }) => matchesPalette(palette));
			if (matched) {
				selectedId = matched.id;
				this.paletteId = matched.id;
				triggerLabel.setText(matched.name);
				isOrphanColor = false;
				orphanPaletteId = undefined;
			} else {
				triggerLabel.setText(t("editor.paletteDeleted"));
				isOrphanColor = true;
				orphanPaletteId = this.paletteId;
			}
			renderTriggerCircles();
			updateColorDesc();
			// This function writes `this.paletteId`, which is part of the dirty
			// snapshot, so it owns re-deciding the Save button too. The colour
			// revert is why: it clears the link, then calls `applyColorState`
			// (whose `updatePreview` computes the save state) and only then lands
			// here to re-resolve the link — so the last word on Save was spoken
			// while the id was still momentarily cleared, leaving the button lit
			// over a form that had just returned to its baseline.
			// A no-op during setup, where `updateSaveState` returns early because
			// the button does not exist yet.
			this.updateSaveState();
		};
		refreshTriggerFromCurrentColors();
		// Re-baseline for the same reason `normalizeNameIdLink()` runs before
		// the snapshot above: this first pass RESOLVES the link rather than
		// changing it — a row saved before `paletteId` existed adopts the id its
		// colours hex-match here — and `paletteId` is part of the snapshot now,
		// so without this every such callout would open already claiming
		// unsaved changes.
		this.initialSnapshot = this.stateSnapshot();

		colorSetting.addExtraButton((btn) => {
			colorRevertBtn = btn;
			btn.setIcon("rotate-ccw")
				.setTooltip(t("editor.resetColors"))
				.onClick(() => {
					if (!originalDef) return;
					// Otherwise refreshTriggerFromCurrentColors resolves the stale
					// id first and keeps showing whatever palette was last picked,
					// even though the colors underneath just reverted.
					this.paletteId = originalDef.paletteId;
					applyColorState(defaultColorStateFor(originalDef));
					refreshTriggerFromCurrentColors();
				});
		});
		syncColorRevert();

		/**
		 * The colours a palette would produce, resolved against the current
		 * state. Backgrounds are taken over only where the palette defines
		 * them (an explicit-undefined leaves the current tint alone), while the
		 * gradient is replaced unconditionally — switching to another
		 * background style must clear a previously applied gradient, not leave
		 * it behind. Custom palettes carry their own text colors; presets fall
		 * back to the defaults.
		 */
		const paletteToColorState = (
			palette: ColorPalette,
		): EditorColorState => ({
			...readColorState(),
			colorLight: palette.colorLight,
			colorDark: palette.colorDark,
			...(palette.bgColorLight !== undefined
				? { bgColorLight: palette.bgColorLight }
				: {}),
			...(palette.bgColorDark !== undefined
				? { bgColorDark: palette.bgColorDark }
				: {}),
			bgGradient: palette.bgGradient
				? { ...palette.bgGradient }
				: undefined,
			transparentBg: palette.transparentBg === true,
			textColorLight: palette.textColorLight ?? DEFAULT_TEXT_COLOR_LIGHT,
			textColorDark: palette.textColorDark ?? DEFAULT_TEXT_COLOR_DARK,
		});

		/**
		 * Apply a palette for real. Only ever reached from an explicit
		 * selection — hovering previews the very same state transiently, so an
		 * uncommitted colour can never reach the snapshot or the save.
		 */
		const applyPaletteColors = (palette: ColorPalette): void => {
			applyColorState(paletteToColorState(palette));
		};

		const closeMenu = (): void => {
			if (!menuOpen) return;
			menuOpen = false;
			menu.addClass("cs-palette-menu-hidden");
			trigger.removeClass("is-open");
			trigger.setAttribute("aria-expanded", "false");
			// Drop any hover preview: nothing was committed, so the preview
			// simply returns to the form's own colours.
			this.previewColorsTransient(null);
		};

		const clearActive = (): void => {
			const prev = itemEls[activeIndex];
			if (activeIndex >= 0 && prev) {
				prev.removeClass("is-active");
			}
			activeIndex = -1;
		};

		const setActive = (
			index: number,
			opts?: { preview?: boolean },
		): void => {
			if (index < 0 || index >= itemEls.length) return;
			clearActive();
			activeIndex = index;
			const el = itemEls[index];
			if (!el) return;
			el.addClass("is-active");
			el.scrollIntoView({ block: "nearest" });
			// Live preview the hovered preset without committing it: the form
			// state, the save button, the trigger label and the settings-list
			// swatches all stay on the current colour until it is clicked.
			if (opts?.preview === false) return;
			const entry = paletteEntries[index];
			if (entry) {
				this.previewColorsTransient(paletteToColorState(entry.palette));
			}
		};

		const commitSelection = (index: number): void => {
			if (index < 0 || index >= paletteEntries.length) return;
			const entry = paletteEntries[index];
			if (!entry) return;
			selectedId = entry.id;
			this.paletteId = entry.id;
			applyPaletteColors(entry.palette);
			triggerLabel.setText(entry.name);
			renderTriggerCircles();
			clearOrphanState();
			this.updateSaveState();
			closeMenu();
		};

		const buildMenu = (): void => {
			menu.empty();
			itemEls.length = 0;

			const groupSpec: {
				key: ColorPalette["group"];
				label: string;
			}[] = [
				{ key: "custom", label: t("editor.paletteGroupCustom") },
				{ key: "obsidian", label: t("editor.paletteGroupObsidian") },
				{ key: "preset", label: t("editor.paletteGroupPresets") },
			];

			for (const grp of groupSpec) {
				const groupEntries = paletteEntries
					.map((e, i) => ({ e, i }))
					.filter(({ e }) => e.group === grp.key);
				if (groupEntries.length === 0) continue;

				menu.createDiv({
					cls: "cs-palette-menu-group-label",
					text: grp.label,
				});

				for (const { e, i } of groupEntries) {
					const item = menu.createDiv({
						cls: "cs-palette-menu-item",
						attr: { role: "option", "data-index": String(i) },
					});
					renderColorCircles(item, resolveCurrentModeColors(e.palette), {
						size: 16,
					});
					item.createSpan({
						cls: "cs-palette-menu-item-label",
						text: e.name,
					});
					item.addEventListener("mouseenter", () => setActive(i));
					item.addEventListener("click", () => commitSelection(i));
					itemEls[i] = item;
					if (e.id === selectedId) item.addClass("is-selected");
				}
			}

			// "+ New color…" — opens the palette editor to create a named
			// custom palette, which is then applied to this callout. Kept out
			// of itemEls so arrow-key navigation stays within real palettes.
			const newColorItem = menu.createDiv({
				cls: "cs-palette-menu-item cs-palette-menu-new-color",
				attr: { role: "option" },
			});
			const newColorIcon = newColorItem.createSpan({
				cls: "cs-palette-new-color-icon",
			});
			setIcon(newColorIcon, "plus");
			newColorItem.createSpan({
				cls: "cs-palette-menu-item-label",
				text: t("editor.paletteNewColor"),
			});
			newColorItem.addEventListener("mouseenter", () => {
				// Leaving the palette rows also ends their hover preview.
				clearActive();
				this.previewColorsTransient(null);
			});
			newColorItem.addEventListener(
				"click",
				() => void pickNewPaletteColor(),
			);
		};

		/**
		 * Select a palette that already exists, optionally taking a group of
		 * orphaned siblings along with it.
		 *
		 * The escape hatch behind the palette editor's duplicate-color block: a
		 * user who lands on colors another palette already has is offered that
		 * palette instead of a Save button that will not move.
		 */
		const adoptExistingPalette = (
			paletteId: string,
			orphanId: string | null | undefined,
		): void => {
			rebuildPaletteEntries();
			const index = paletteEntries.findIndex((e) => e.id === paletteId);
			const entry = paletteEntries[index];
			if (!entry) return;
			// Same two-step as a revive, and for the same reason: re-point the
			// siblings, then repaint them through the ordinary cascade. This
			// callout is excluded from both — the editor owns its own row until
			// Save, and commitSelection below is what moves it.
			if (orphanId) {
				this.plugin.registry.relinkPalette(
					orphanId,
					paletteId,
					this.existingId,
				);
				this.plugin.registry.applyPaletteColors(
					paletteId,
					bakePaletteColors(entry.palette),
				);
				void this.plugin.saveSettings();
			}
			commitSelection(index);
		};

		// ── "+ New color…" flow ──
		// Opens the same palette editor the settings section uses; saving the
		// new palette immediately selects and applies it to this callout.
		const pickNewPaletteColor = async (): Promise<void> => {
			// Drop any uncommitted hover-preview colors before the modal opens.
			this.previewColorsTransient(null);
			closeMenu();
			const result = await new PaletteEditorModal(this.plugin, {
				takenNames: this.plugin.settings.customPalettes.map(
					(p) => p.name,
				),
				takenColors: this.plugin.settings.customPalettes,
				onUseExisting: (paletteId) =>
					adoptExistingPalette(paletteId, null),
			}).openAndWait();
			if (!result) return;
			const palette: CustomPalette = {
				id: generatePaletteId(),
				...result,
			};
			this.plugin.settings.customPalettes.push(palette);
			await this.plugin.saveSettings();
			rebuildPaletteEntries();
			selectedId = palette.id;
			this.paletteId = palette.id;
			applyPaletteColors(customPaletteToColorPalette(palette));
			triggerLabel.setText(palette.name);
			renderTriggerCircles();
			clearOrphanState();
			this.updateSaveState();
		};

		// ── "Deleted color" → save it again ──
		// Same palette editor as "+ New color…", but seeded with this callout's
		// own colours, so reviving a deleted palette is only a matter of naming
		// it. Every other callout orphaned by the same deletion is re-pointed at
		// the result, which is what puts the group back together.
		const reviveDeletedPalette = async (): Promise<void> => {
			// Read before the modal runs: the callbacks below reset it.
			const orphanId = orphanPaletteId;
			// Drop any uncommitted hover-preview colors before the modal opens.
			this.previewColorsTransient(null);
			closeMenu();
			const seed = paletteSeedFromColorState(readColorState());
			// A saved palette may already carry exactly these colors — the user
			// recreated it from the settings list, or another group was revived
			// onto them first. Rebuilding it is then impossible: no vault may
			// hold two palettes with identical colors, so the editor would open
			// on a seed it refuses to save. Link the group to what exists, which
			// is what reviving was asking for in the first place.
			const twin = findPaletteWithSameColors(
				{ id: "", name: "", group: "custom", ...seed },
				this.plugin.settings.customPalettes,
			);
			if (twin) {
				adoptExistingPalette(twin.id, orphanId);
				return;
			}
			const result = await new PaletteEditorModal(this.plugin, {
				seed,
				takenNames: this.plugin.settings.customPalettes.map(
					(p) => p.name,
				),
				takenColors: this.plugin.settings.customPalettes,
				onUseExisting: (paletteId) =>
					adoptExistingPalette(paletteId, orphanId),
			}).openAndWait();
			if (!result) return;
			const palette: CustomPalette = {
				id: generatePaletteId(),
				...result,
			};
			this.plugin.settings.customPalettes.push(palette);
			// Regroup the siblings, then repaint them through the ordinary
			// cascade so they match the palette even if its colours were tweaked
			// in the modal. This callout is excluded from both: the editor owns
			// its own row until Save, and it takes the new colours through the
			// form below instead.
			if (orphanId) {
				this.plugin.registry.relinkPalette(
					orphanId,
					palette.id,
					this.existingId,
				);
				this.plugin.registry.applyPaletteColors(
					palette.id,
					bakePaletteColors(customPaletteToColorPalette(palette)),
				);
			}
			// After the registry work, not before: one write then covers the new
			// palette AND the re-pointed siblings. (`applyPaletteColors` also
			// notifies, and `onChange` saves — but only when it actually
			// repainted a row, so this is what makes the save unconditional.)
			await this.plugin.saveSettings();
			rebuildPaletteEntries();
			selectedId = palette.id;
			this.paletteId = palette.id;
			applyPaletteColors(customPaletteToColorPalette(palette));
			triggerLabel.setText(palette.name);
			renderTriggerCircles();
			clearOrphanState();
			this.updateSaveState();
		};

		const openMenu = (): void => {
			if (menuOpen) return;
			closeFoldMenu();
			menuOpen = true;
			rebuildPaletteEntries();
			buildMenu();
			menu.removeClass("cs-palette-menu-hidden");
			trigger.addClass("is-open");
			trigger.setAttribute("aria-expanded", "true");
			// Focus selected, else first — highlight only. Opening the menu is
			// not a choice, so it must not repaint the preview (with no palette
			// matched it would otherwise jump to the first entry's colours).
			const startIdx = paletteEntries.findIndex(
				(e) => e.id === selectedId,
			);
			activeIndex = -1;
			setActive(startIdx >= 0 ? startIdx : 0, { preview: false });
			menu.focus();
		};

		trigger.addEventListener("click", () => {
			if (menuOpen) closeMenu();
			else openMenu();
		});

		menu.addEventListener("keydown", (ev) => {
			if (ev.key === "ArrowDown") {
				ev.preventDefault();
				setActive(Math.min(activeIndex + 1, itemEls.length - 1));
			} else if (ev.key === "ArrowUp") {
				ev.preventDefault();
				setActive(Math.max(activeIndex - 1, 0));
			} else if (ev.key === "Enter") {
				ev.preventDefault();
				commitSelection(activeIndex);
			} else if (ev.key === "Escape") {
				ev.preventDefault();
				closeMenu();
			}
		});

		// Foldable — dropdown in the same adjustment column.
		// NOTE: The foldable option is currently hidden from the Edit callout
		// UI. All the code below is intentionally left intact so the feature
		// can be re-enabled by removing the `foldSection.hide()` call.
		const foldSection = adjustCol.createDiv({
			cls: "callout-studio-adjust-section callout-studio-fold-section",
		});
		foldSection.hide();
		foldSection.createDiv({
			cls: "callout-studio-adjust-header",
			text: t("editor.foldable"),
		});
		foldSection.createDiv({
			cls: "callout-studio-fold-desc",
			text: t("editor.foldableDesc"),
		});
		const foldControl = foldSection.createDiv({
			cls: "callout-studio-fold-control",
		});
		const foldDropdown = foldControl.createDiv({
			cls: "cs-palette-dropdown cs-fold-dropdown",
		});
		const foldTrigger = foldDropdown.createEl("button", {
			cls: "cs-palette-trigger cs-fold-trigger",
			attr: { type: "button", "aria-haspopup": "listbox" },
		});
		const foldTriggerLabel = foldTrigger.createSpan({
			cls: "cs-palette-trigger-label",
		});
		foldTrigger.createSpan({
			cls: "cs-palette-trigger-caret",
			text: "▾",
		});
		const foldMenu = foldDropdown.createDiv({
			cls: "cs-palette-menu cs-palette-menu-up cs-fold-menu cs-palette-menu-hidden",
			attr: { role: "listbox", tabindex: "-1" },
		});
		const foldOptions: {
			value: "off" | "open" | "closed";
			label: string;
		}[] = [
			{ value: "off", label: t("editor.foldOff") },
			{ value: "open", label: t("editor.foldOpen") },
			{ value: "closed", label: t("editor.foldClosed") },
		];
		const currentFoldState = (): "off" | "open" | "closed" =>
			!this.foldable ? "off" : this.defaultFolded ? "closed" : "open";
		const getFoldLabel = (): string =>
			foldOptions.find((opt) => opt.value === currentFoldState())
				?.label ?? t("editor.foldOff");
		foldTriggerLabel.setText(getFoldLabel());

		let foldMenuOpen = false;
		const readFoldState = () => ({
			foldable: this.foldable,
			defaultFolded: this.defaultFolded,
			previewFoldCollapsed: this.previewFoldCollapsed,
		});
		let foldStateBeforeMenu: ReturnType<typeof readFoldState> | null = null;
		const applyFoldState = (
			value: "off" | "open" | "closed",
			persist: boolean,
		): void => {
			if (value === "off") {
				this.foldable = false;
				this.defaultFolded = false;
				this.previewFoldCollapsed = false;
			} else {
				this.foldable = true;
				this.defaultFolded = value === "closed";
				this.previewFoldCollapsed = value === "closed";
			}
			this.updatePreview();
			if (persist) foldStateBeforeMenu = null;
		};
		const restoreFoldPreview = (): void => {
			if (!foldStateBeforeMenu) return;
			this.foldable = foldStateBeforeMenu.foldable;
			this.defaultFolded = foldStateBeforeMenu.defaultFolded;
			this.previewFoldCollapsed =
				foldStateBeforeMenu.previewFoldCollapsed;
			foldStateBeforeMenu = null;
			this.updatePreview();
		};
		const closeFoldMenu = (): void => {
			if (!foldMenuOpen) return;
			foldMenuOpen = false;
			foldMenu.addClass("cs-palette-menu-hidden");
			foldTrigger.removeClass("is-open");
			restoreFoldPreview();
		};
		const selectFoldState = (value: "off" | "open" | "closed"): void => {
			const opt = foldOptions.find((item) => item.value === value);
			if (!opt) return;

			applyFoldState(opt.value, true);
			foldTriggerLabel.setText(opt.label);
			this.updateSaveState();
			closeFoldMenu();
		};
		const buildFoldMenu = (): void => {
			foldMenu.empty();
			for (const opt of foldOptions) {
				const item = foldMenu.createDiv({
					cls: `cs-palette-menu-item${
						currentFoldState() === opt.value ? " is-selected" : ""
					}`,
					attr: { role: "option" },
				});
				item.createSpan({
					cls: "cs-palette-menu-item-label",
					text: opt.label,
				});
				item.addEventListener("mouseenter", () => {
					applyFoldState(opt.value, false);
				});
				item.addEventListener("click", () =>
					selectFoldState(opt.value),
				);
			}
		};
		const openFoldMenu = (): void => {
			if (foldMenuOpen) return;
			closeMenu();
			foldMenuOpen = true;
			foldStateBeforeMenu = readFoldState();
			buildFoldMenu();
			foldMenu.removeClass("cs-palette-menu-hidden");
			foldTrigger.addClass("is-open");
			foldMenu.focus();
		};
		foldTrigger.addEventListener("click", () => {
			if (foldMenuOpen) closeFoldMenu();
			else openFoldMenu();
		});
		foldMenu.addEventListener("keydown", (ev) => {
			if (ev.key === "Escape") {
				ev.preventDefault();
				closeFoldMenu();
			}
		});
		// Close any popup when clicking outside both popup containers.
		const popupOutsideClick = (ev: MouseEvent): void => {
			const target = ev.target as Node | null;
			if (!target) return;
			if (dropdown.contains(target) || foldDropdown.contains(target))
				return;
			closeMenu();
			closeFoldMenu();
		};
		this.removePopupOutsideClickListener?.();
		activeDocument.addEventListener("click", popupOutsideClick);
		this.removePopupOutsideClickListener = () => {
			activeDocument.removeEventListener("click", popupOutsideClick);
		};
		// Action buttons — the chrome's pinned bottom bar
		const buttonContainer = footerEl;

		const cancelBtn = buttonContainer.createEl("button", {
			text: t("editor.cancel"),
		});
		cancelBtn.addEventListener("click", () => {
			this.close();
		});

		const saveBtn = buttonContainer.createEl("button", {
			text: this.existingId
				? t("editor.saveChanges")
				: t("editor.createCallout"),
			cls: "mod-cta",
		});
		this.saveBtn = saveBtn;
		saveBtn.addEventListener("click", () => {
			if (!this.isSaveActionEnabled) {
				this.showSaveBlockedNotice();
				return;
			}
			void this.save();
		});

		// Set initial save button state
		this.updateSaveState();
	}

	/**
	 * One role's icon-adjustment box. The controls themselves live in
	 * `editor/iconAdjustGroup.ts`, shared with the theme callout preview, which
	 * offers this trio and nothing else.
	 *
	 * Returns the box so the caller can hide it when the callout draws no icon.
	 */
	private renderIconAdjustGroup(
		parent: HTMLElement,
		role: CalloutRenderRole,
	): HTMLElement {
		return renderIconAdjustGroup(
			parent,
			iconAdjustHeader(role),
			this.iconAdjust[role],
			() => {
				this.scheduleUpdatePreview();
			},
		);
	}

	/**
	 * The icon-adjustment half of the form state, in the shape a
	 * `CalloutDefinition` stores it — the single place the two storage layers are
	 * written, so the snapshots, the live preview and the save flow cannot drift.
	 *
	 * `regular` is mirrored into the flat legacy trio on the way out. That is
	 * what an older build reads (applying it to all three roles, as it always
	 * did), what the import validator's existing range checks see, and what
	 * `resolveIconAdjust` falls back to for a role left at its defaults — so the
	 * mirror is load-bearing, not just a courtesy to old versions.
	 */
	private iconAdjustState(): {
		// Spelled out rather than Pick<CalloutDefinition, …>: the flat trio is
		// optional on a stored definition but always written here, and the
		// snapshot/save types require it.
		iconAdjust: CalloutDefinition["iconAdjust"];
		iconOffsetX: number;
		iconOffsetY: number;
		iconSize: number;
	} {
		const regular = this.iconAdjust.regular;
		return {
			iconAdjust: buildIconAdjust(this.iconAdjust),
			iconOffsetX: regular.offsetX,
			iconOffsetY: regular.offsetY,
			iconSize: regular.size,
		};
	}

	private stateSnapshot(): string {
		return buildStateSnapshot({
			displayName: this.displayName,
			calloutId: this.calloutId,
			icon: this.icon,
			hideIcon: this.hideIcon,
			colorLight: this.colorLight,
			colorDark: this.colorDark,
			bgColorLight: this.bgColorLight,
			bgColorDark: this.bgColorDark,
			bgGradient: this.bgGradient,
			transparentBg: this.transparentBg,
			textColorLight: this.textColorLight,
			textColorDark: this.textColorDark,
			foldable: this.foldable,
			defaultFolded: this.defaultFolded,
			...this.iconAdjustState(),
			aliases: this.aliases,
			paletteId: this.paletteId,
		});
	}

	private styleSnapshot(): string {
		return buildStateSnapshot({
			displayName: "",
			calloutId: "",
			icon: this.icon,
			hideIcon: this.hideIcon,
			colorLight: this.colorLight,
			colorDark: this.colorDark,
			bgColorLight: this.bgColorLight,
			bgColorDark: this.bgColorDark,
			bgGradient: this.bgGradient,
			transparentBg: this.transparentBg,
			textColorLight: this.textColorLight,
			textColorDark: this.textColorDark,
			foldable: this.foldable,
			defaultFolded: this.defaultFolded,
			...this.iconAdjustState(),
			aliases: [],
		});
	}

	private hasStateChanges(): boolean {
		return hasStateChanges(this.initialSnapshot, this.stateSnapshot());
	}

	private hasStyleChanges(): boolean {
		return hasStateChanges(this.initialStyleSnapshot, this.styleSnapshot());
	}

	private getFallbackBase(): CalloutDefinition | undefined {
		const fallbackId = this.plugin.settings.fallbackCalloutId || "note";
		return (
			this.plugin.registry.get(fallbackId) ??
			this.plugin.registry.get("note")
		);
	}

	private shouldSaveNewAutocompleteCalloutAsFallback(): boolean {
		return shouldSaveNewAutocompleteCalloutAsFallback({
			createFromAutocomplete: this.createFromAutocomplete,
			existingId: this.existingId,
			hasStyleChanges: this.hasStyleChanges(),
			getById: (id) => this.plugin.registry.get(id),
			findByAlias: (id) => this.plugin.registry.findByAlias(id),
		});
	}

	/**
	 * When creating a callout from the autocomplete "Create new" entry, the
	 * background vault scan may have already auto-added an uncustomized
	 * `source: "fallback"` row for the same ID. That row is a placeholder
	 * mirroring the fallback style, not a real conflict, so allow the create
	 * flow to overwrite it instead of refusing the save.
	 */
	private isOverwritingAutoFallbackRow(id: string = this.calloutId): boolean {
		return isOverwritingAutoFallbackRow({
			createFromAutocomplete: this.createFromAutocomplete,
			existingId: this.existingId,
			id,
			getById: (targetId) => this.plugin.registry.getReal(targetId),
			findByAlias: (targetId) =>
				this.plugin.registry.findByAlias(targetId),
		});
	}

	private canUseCalloutId(id: string, role: "primary" | "alias"): boolean {
		return canUseCalloutId({
			createFromAutocomplete: this.createFromAutocomplete,
			existingId: this.existingId,
			id,
			role,
			getById: (targetId) => this.plugin.registry.getReal(targetId),
			findByAlias: (targetId) =>
				this.plugin.registry.findByAlias(targetId),
		});
	}

	/**
	 * The ID of another callout this one would collide with once Obsidian
	 * dasherizes it into `data-callout`, or null. Treated as a duplicate ID:
	 * it shows the inline warning AND blocks saving (via isStateValid), so the
	 * button state always agrees with the message under the ID field.
	 */
	private findAttrIdCollision(id: string): string | null {
		return findAttrIdCollision({
			existingId: this.existingId,
			id,
			findAttrIdConflict: (targetId) =>
				this.plugin.registry.findAttrIdConflict(
					targetId,
					this.existingId,
				),
		});
	}

	private isStateValid(): boolean {
		return isStateValid({
			createFromAutocomplete: this.createFromAutocomplete,
			existingId: this.existingId,
			isBuiltIn: this.isBuiltIn,
			displayName: this.displayName,
			calloutId: this.calloutId,
			aliases: this.aliases,
			getById: (targetId) => this.plugin.registry.getReal(targetId),
			findByAlias: (targetId) =>
				this.plugin.registry.findByAlias(targetId),
			findAttrIdConflict: (targetId) =>
				this.plugin.registry.findAttrIdConflict(
					targetId,
					this.existingId,
				),
		});
	}

	private updateSaveState(): void {
		if (!this.saveBtn) return;
		const hasChanges = this.hasStateChanges();
		const isValid = this.isStateValid();
		// For new callouts: enable if valid (no need for "changes" check)
		// For existing: enable if valid AND has changes
		const enabled = this.existingId ? hasChanges && isValid : isValid;
		this.isSaveActionEnabled = enabled;
		this.saveBtn.disabled = false;
		this.saveBtn.setAttribute("aria-disabled", enabled ? "false" : "true");
		this.saveBtn.toggleClass("cs-btn-disabled", !enabled);
	}

	private showSaveBlockedNotice(): void {
		const hasChanges = this.hasStateChanges();
		const requireDisplayName =
			!this.createFromAutocomplete || this.existingId !== null;

		if (
			!this.existingId &&
			requireDisplayName &&
			!this.displayName.trim()
		) {
			new Notice(t("editor.nameRequired"));
			return;
		}

		if (this.existingId && !hasChanges) {
			new Notice(t("editor.noChangesToSave"));
			return;
		}

		if (!this.calloutId) {
			new Notice(t("editor.idEmpty"));
			return;
		}

		if (!this.canUseCalloutId(this.calloutId, "primary")) {
			new Notice(t("editor.idConflict"));
			return;
		}
		const primaryClash = this.findAttrIdCollision(this.calloutId);
		if (primaryClash) {
			new Notice(t("editor.idDashConflict", { other: primaryClash }));
			return;
		}
		for (const alias of this.aliases) {
			if (!this.canUseCalloutId(alias, "alias")) {
				new Notice(t("editor.idConflict"));
				return;
			}
			const aliasClash = this.findAttrIdCollision(alias);
			if (aliasClash) {
				new Notice(t("editor.idDashConflict", { other: aliasClash }));
				return;
			}
		}
	}

	/**
	 * Enforce the name↔ID invariant on the loaded state: the ID derived from
	 * the display name is the primary (first, pinned). For legacy rows where
	 * it is missing, the old primary is demoted to the first alias; nothing is
	 * persisted until the user saves. When the name is empty but an ID exists
	 * (e.g. seeded from autocomplete), the name is derived from the ID instead.
	 */
	private normalizeNameIdLink(): void {
		const name = this.displayName.trim();
		if (!name) {
			if (this.calloutId) {
				this.displayName = deriveDisplayNameFromId(this.calloutId);
			}
			return;
		}
		// A name that sanitizes to nothing (e.g. "!!!") keeps the current
		// primary pinned instead.
		const pinned = generateId(name) || this.calloutId;
		if (!pinned || pinned === this.calloutId) return;
		const rest = [this.calloutId, ...this.aliases].filter(
			(id) => id && id !== pinned,
		);
		this.calloutId = pinned;
		this.aliases = [...new Set(rest)];
	}

	/**
	 * Live reverse-link: while the callout has no primary ID pinned and no
	 * display name of its own, mirror what the user types in the ID field into
	 * the display name, character by character (first letter capitalized, the
	 * same derivation used when a tag is committed). It stops the moment a
	 * primary ID is pinned or the user gives the name its own value.
	 */
	private syncNameFromIdInput(rawValue: string): void {
		if (this.isBuiltIn) return;
		// A primary ID already exists → the link is established the normal way.
		if (this.idsTagInput?.getPinnedTag() != null) return;
		// Only auto-fill while the name is empty or still exactly what we last
		// wrote — never clobber a name the user typed themselves.
		if (this.displayName !== "" && this.displayName !== this.idDrivenName) {
			return;
		}
		const derived = deriveDisplayNameFromId(generateId(rawValue));
		this.displayName = derived;
		this.idDrivenName = derived;
		this.nameTextInput?.setValue(derived);
		this.updatePreview();
		this.updateSaveState();
	}

	private updateIdWarning(): void {
		if (!this.idsTagInput) return;

		if (!this.calloutId) {
			if (this.hasHadCalloutId) {
				this.idsTagInput.showExternalError(t("editor.idEmpty"));
			} else {
				this.idsTagInput.clearExternalError();
			}
			return;
		}
		this.hasHadCalloutId = true;

		if (!this.canUseCalloutId(this.calloutId, "primary")) {
			// Naming the *cause* matters here, because the two causes have
			// completely different answers. An ordinary duplicate is the user's
			// own callout and they can go and edit it. An id the active theme
			// supplies is one this plugin will never style, whoever creates it:
			// the row would land under *Callouts from your theme*, read-only,
			// which looks like the editor silently discarding the work. Saying
			// "already exists" there sends the user looking for a callout of
			// their own that is not there.
			this.idsTagInput.showExternalError(
				this.themeSuppliesId(this.calloutId)
					? t("editor.idFromTheme", {
							theme:
								activeThemeName(this.plugin.app) ??
								t("settings.themeCalloutsDefaultTheme"),
						})
					: t("editor.idExists"),
			);
			return;
		}

		// A fuzzy claim is a warning, never a block. `[data-callout*="col"]`
		// says the theme styles a *family*, and whether this plugin wins the
		// callout depends on a cascade no static read can settle — so the user
		// is told and left to decide, which is the opposite of the exact case
		// above.
		const fuzzy = this.themeFuzzyClaim(this.calloutId);
		if (fuzzy) {
			this.idsTagInput.showExternalError(
				t("editor.idThemePattern", { pattern: fuzzy }),
			);
			return;
		}

		// Catches the paths that bypass the tag `validate` callback:
		// normalizeNameIdLink derives the primary ID straight from the display
		// name (typing "My note" pins the ID `my note` without an add event),
		// and aliases loaded from data.json were never validated at all. Both
		// disable saving, so the reason has to be visible.
		for (const id of [this.calloutId, ...this.aliases]) {
			const clash = this.findAttrIdCollision(id);
			if (clash) {
				this.idsTagInput.showExternalError(
					t("editor.idDashConflict", { other: clash }),
				);
				return;
			}
		}

		this.idsTagInput.clearExternalError();
	}

	/** Does the active theme name this exact id? See {@link updateIdWarning}. */
	private themeSuppliesId(id: string): boolean {
		return this.plugin.cssInjector
			.themeCallouts()
			.themeDefinedIds()
			.has(obsidianCalloutAttrId(id));
	}

	/**
	 * The theme's family selector that would also catch `id`, as a readable
	 * `*=col` string, or null.
	 */
	private themeFuzzyClaim(id: string): string | null {
		const scan = this.plugin.cssInjector.themeCallouts().patternClaims();
		for (const { op, value } of scan) {
			if (
				patternMatches(op as PatternOp, value, obsidianCalloutAttrId(id))
			) {
				return `${op}=${value}`;
			}
		}
		return null;
	}

	private getIconLabel(): string {
		if (this.hideIcon) return t("editor.noIcon");
		return describeIcon(this.icon, this.plugin.settings.userImages ?? []);
	}

	private renderIconPreview(container: HTMLElement): void {
		renderCalloutEditorIconPreview(this.plugin, this.icon, container);
	}

	/**
	 * Push the in-progress definition out to the notes themselves, not just to
	 * the modal's own live preview.
	 *
	 * Colours and geometry ride the injected CSS and need no help — that is why
	 * a block callout in the note restyles the instant the CSS does. Heading
	 * and inline callouts are different: their icon and display name are baked
	 * into Live Preview widget DOM, and a registry change never touches the
	 * document, so CodeMirror has no reason to rebuild them. Without this
	 * dispatch they keep the old icon until something unrelated rebuilds them —
	 * a click in the note, or closing the modal.
	 *
	 * Coalesced on the next frame because beforeRender runs on every slider tick
	 * and every keystroke, and one rebuild per burst is enough (the same reason
	 * SettingsTab batches its list refresh).
	 *
	 * Reading view is deliberately left out: re-running its post-processors
	 * means previewMode.rerender(), far too heavy to repeat per keystroke. It
	 * catches up on save, when inject() emits css-change.
	 */
	private scheduleNoteDecorationRefresh(): void {
		if (this.noteRefreshFrame !== null) return;
		this.noteRefreshFrame = window.requestAnimationFrame(() => {
			this.noteRefreshFrame = null;
			refreshAllCalloutEditors();
		});
	}

	/**
	 * {@link updatePreview}, coalesced to at most one run per animation frame —
	 * for the controls that fire continuously while a pointer is held.
	 *
	 * A slider tick is not cheap: `updatePreview` re-registers the draft
	 * definition and re-injects, which regenerates the CSS for every callout and
	 * then repaints every icon in the document. Running that several times
	 * between two frames only makes the last one visible, so the earlier passes
	 * buy nothing and cost the frame budget the live preview needs. One pass per
	 * frame still tracks the thumb at ~60fps — unlike a debounce, which would
	 * hold the preview still until the drag stopped.
	 *
	 * The same gate `addStyleSlider` puts around the global style sliders
	 * (settings/styleControls.ts), which is why those already drag smoothly.
	 */
	private scheduleUpdatePreview(): void {
		if (this.updatePreviewFrame !== null) return;
		this.updatePreviewFrame = window.requestAnimationFrame(() => {
			this.updatePreviewFrame = null;
			this.updatePreview();
		});
	}

	private updatePreview(): void {
		if (!this.preview) return;
		// Keep the sample's titles tracking the display-name field.
		this.preview.setText(this.buildSampleText());
		this.preview.refresh();
		this.updateSaveState();
	}

	/**
	 * Re-render the live preview with colours the user has not committed —
	 * a palette being hovered — or with `null` to drop such a preview and fall
	 * back to the form's own colours.
	 *
	 * Deliberately narrower than {@link updatePreview}: no sample-text rebuild
	 * (colours do not change the text) and, crucially, no `updateSaveState()`.
	 * Hovering is not an edit, so it must leave "Save changes" alone.
	 */
	private previewColorsTransient(state: EditorColorState | null): void {
		if (state === null && this.previewColorOverride === null) return;
		this.previewColorOverride = state;
		this.preview?.refresh();
	}

	/**
	 * The callout ID the live preview should render under: the real primary ID
	 * being edited, or the reserved placeholder while it is still empty (a
	 * brand-new callout before the user types a name).
	 */
	private currentPreviewId(): string {
		return this.calloutId.trim() || PREVIEW_PLACEHOLDER_ID;
	}

	/**
	 * The sample markdown seeding the preview: a mini-document exercising all
	 * three roles. A titled heading callout opens it, an inline callout sits in
	 * the paragraph below, then the block callout closes it. The trailing
	 * blank line keeps the read-only caret parked outside that last block (see
	 * LiveCalloutPreview's focus policy).
	 */
	private buildSampleText(): string {
		const id = this.currentPreviewId();
		const name = this.displayName.trim() || t("editor.untitledCallout");
		// Reflect the fold setting so a folded default previews collapsed. Only
		// the blockquote takes a marker — on a heading it would be title text.
		const mark = this.foldable ? (this.defaultFolded ? "-" : "+") : "";
		return [
			`## [!${id}] ${name}`,
			"",
			t("editor.sampleInlineText").replace("{id}", id),
			"",
			`> [!${id}]${mark} ${name}`,
			`> ${t("editor.loremIpsumShort")}`,
			"",
		].join("\n");
	}

	/**
	 * The colour half of the form state, as a plain value.
	 *
	 * Key order must match `defaultColorStateFor` — see the note there.
	 */
	private colorState(): EditorColorState {
		return {
			colorLight: this.colorLight,
			colorDark: this.colorDark,
			bgColorLight: this.bgColorLight,
			bgColorDark: this.bgColorDark,
			bgGradient: this.bgGradient ? { ...this.bgGradient } : undefined,
			transparentBg: this.transparentBg,
			textColorLight: this.textColorLight,
			textColorDark: this.textColorDark,
		};
	}

	/**
	 * Snapshot the current form state as a transient preview definition.
	 *
	 * The ownership fields below (`builtIn`, `source`, and the empty `aliases`)
	 * describe a brand-new draft, which is the only case where this snapshot
	 * shadows nothing. When it stands in for an existing callout, the registry
	 * re-stamps it with that callout's real identity on the way into the map
	 * (`withIdentityOf` in CalloutRegistry) — so don't try to derive them here:
	 * mid-edit the form's id may not match any real row at all.
	 *
	 * The three `hasAuthored…` gates are what keep this snapshot *faithful*, and
	 * they are not cosmetic. This definition goes into the real registry, and the
	 * CSS it generates is global — the live preview is a genuine embedded editor
	 * in the same document, so styling it means styling every callout of that
	 * type in the vault behind the modal. Emitting a field the committed
	 * definition does not carry therefore repaints those notes for as long as the
	 * modal is open: a derived background replaces Obsidian's own 10% fill with a
	 * stronger tint, and any extra field at all flips `isUnmodifiedBuiltIn`,
	 * dropping a built-in's deference to the theme's `--callout-*` variables.
	 */
	private buildPreviewDefinition(): CalloutDefinition {
		// A hovered-but-uncommitted palette replaces the colour half wholesale —
		// it is a complete EditorColorState, so there is nothing to merge field
		// by field — and reaches the CSS/preview pipeline without ever touching
		// the form state.
		const colors = this.previewColorOverride ?? this.colorState();
		const adjust = this.iconAdjustState();
		return {
			id: this.currentPreviewId(),
			displayName: this.displayName.trim() || t("editor.untitledCallout"),
			icon: { ...this.icon },
			// `true`-or-absent here too: the live preview is registered under a
			// real built-in's id, and a literal `false` would read as an edit and
			// drop that built-in's deference to the theme's `--callout-*` while
			// the modal is merely open. Same reasoning as the omitted background
			// above; see authoredStyle.ts.
			...(this.hideIcon ? { hideIcon: true as const } : {}),
			colorLight: colors.colorLight,
			colorDark: colors.colorDark,
			// Omitted rather than set to undefined, and for the same reason the
			// save path drops it: an absent background is what leaves Obsidian's
			// translucent fill in place, which is what lets nested callouts step.
			...(hasAuthoredBackground(colors)
				? {
						bgColorLight: colors.bgColorLight,
						bgColorDark: colors.bgColorDark,
					}
				: {}),
			bgGradient: colors.transparentBg ? undefined : colors.bgGradient,
			...(hasAuthoredTextColors(
				this.baselineDef,
				colors.textColorLight,
				colors.textColorDark,
			)
				? {
						textColorLight: colors.textColorLight,
						textColorDark: colors.textColorDark,
					}
				: {}),
			foldable: this.foldable,
			defaultFolded: this.defaultFolded,
			// The per-role map is never a mere default (`buildIconAdjust` returns
			// undefined once every role agrees), so only the flat trio below —
			// the Regular role's own values — needs the gate.
			iconAdjust: adjust.iconAdjust,
			...(hasAuthoredIconAdjust(this.baselineDef, this.iconAdjust.regular)
				? {
						iconOffsetX: adjust.iconOffsetX,
						iconOffsetY: adjust.iconOffsetY,
						iconSize: adjust.iconSize,
					}
				: {}),
			aliases: [],
			builtIn: false,
			source: "user",
			// A plain boolean in the form but `?: true` on a definition, where
			// "off" is an absent key and not `false`.
			...(colors.transparentBg ? { transparentBg: true as const } : {}),
		};
	}

	private async save(): Promise<void> {
		// A palette may still be hovered (the outside-click handler that ends a
		// hover preview only runs after this button's own handler). It was
		// never chosen, so it must not survive into the save — nor into the
		// re-registered preview if the save is rejected below.
		this.previewColorOverride = null;
		// Clear the transient preview registration first, restoring any real
		// callout it was shadowing, so the save flow mutates the real definition
		// (not the in-progress preview) and onClose can't later revert the save.
		this.plugin.registry.setPreviewDefinition(null);
		const def = await performCalloutEditorSave({
			app: this.app,
			plugin: this.plugin,
			existingId: this.existingId,
			isBuiltIn: this.isBuiltIn,
			// The same baseline the live preview's `hasAuthored…` gates read, so
			// the definition that gets saved matches the one being previewed.
			baselineDef: this.baselineDef,
			state: {
				displayName: this.displayName,
				calloutId: this.calloutId,
				icon: this.icon,
				hideIcon: this.hideIcon,
				colorLight: this.colorLight,
				colorDark: this.colorDark,
				bgColorLight: this.bgColorLight,
				bgColorDark: this.bgColorDark,
				bgGradient: this.bgGradient,
				transparentBg: this.transparentBg,
				textColorLight: this.textColorLight,
				textColorDark: this.textColorDark,
				foldable: this.foldable,
				defaultFolded: this.defaultFolded,
				...this.iconAdjustState(),
				aliases: this.aliases,
				paletteId: this.paletteId,
			},
			hasStyleChanges: this.hasStyleChanges(),
			saveAsFallback: this.shouldSaveNewAutocompleteCalloutAsFallback(),
			overwriteAutoFallback: this.isOverwritingAutoFallbackRow(),
			canUseCalloutId: (id, role) => this.canUseCalloutId(id, role),
			getFallbackBase: () => this.getFallbackBase(),
			onMaterialDownloadStart: () => {
				if (this.saveBtn) {
					this.isSaveActionEnabled = false;
					this.saveBtn.disabled = true;
					this.saveBtn.textContent = t("editor.downloadingIcon");
				}
			},
		});

		if (!def) {
			this.updateIdWarning();
			this.updateSaveState();
			// Save was rejected and the modal stays open — re-register the
			// transient preview definition (cleared above) so the live preview
			// keeps showing the in-progress style.
			this.updatePreview();
			return;
		}

		if (this.resolve) this.resolve(def);
		this.resolve = null;
		this.close();
	}

	onClose(): void {
		// Drop any coalesced refresh still queued from the last preview render.
		// Must happen BEFORE destroy(): that reverts the preview and refreshes
		// the notes synchronously, so a frame firing afterwards would only
		// repeat work — and one firing after the modal is gone is pure waste.
		if (this.noteRefreshFrame !== null) {
			window.cancelAnimationFrame(this.noteRefreshFrame);
			this.noteRefreshFrame = null;
		}
		// Same reasoning for the slider's coalesced preview pass, with one more
		// on top: it touches `this.preview`, which is about to be destroyed.
		if (this.updatePreviewFrame !== null) {
			window.cancelAnimationFrame(this.updatePreviewFrame);
			this.updatePreviewFrame = null;
		}
		this.preview?.destroy();
		this.preview = null;
		this.removePopupOutsideClickListener?.();
		this.removePopupOutsideClickListener = null;
		if (this.resolve) {
			this.resolve(null);
			this.resolve = null;
		}
		this.contentEl.empty();
		// The button bar is a sibling of contentEl, so emptying that misses it.
		removeModalChrome(this);
		this.modalEl.removeClass("callout-studio-editor-modal");
		// Re-enable automatic pruning and run one pass to clean up any
		// fallback rows the user touched but did not save.
		this.plugin.pruneSuspended = false;
		this.plugin.schedulePruneUnusedFallbacks(0);
	}
}
