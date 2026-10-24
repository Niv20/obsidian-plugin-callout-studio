/**
 * settings/declarative/stylePages.ts — Heading callout, Inline callout and
 * Block callout: each role's vault-wide style as a settings page, in place of
 * the per-role style windows (GlobalStyleModal.ts).
 *
 * Who calls it. The settings tab, for the main page's Callout style box
 * ({@link calloutStyleGroup}).
 *
 * The main idea. A page is a column of Obsidian's boxes:
 * - the live preview (stylePreview.ts), kept through redraws as a part
 *   (persistentParts.ts) and pinned under the page's title bar while the page
 *   scrolls (not on a phone), so each control can be watched as it moves;
 * - a box without a heading for the controls that stand alone (corner
 *   rounding, and Align content, Show fold arrow or the inline text size);
 * - Borders: Obsidian's four switches, and Border thickness while a side has
 *   a border;
 * - Font scale (block) or Title spacing (heading).
 * A box with more than one control has ↺ in its heading, which resets the
 * box; every slider has its own ↺. Both are dimmed while there is nothing
 * to reset.
 *
 * The switches are Obsidian's control rows, saved by the tab
 * (controlBinding.ts). The sliders are render rows: a drag repaints every
 * frame (styleControls.ts's `wireStyleSlider`) and the release saves through
 * the registry's change round, as a switch does. The settings search finds
 * every control by its name and a few more words ("radius", "border",
 * "title size"). While saving is paused, every control is greyed.
 */
import type { SettingGroup } from "obsidian";
import { DEFAULT_SETTINGS } from "../../constants";
import { t, type LocaleKey } from "../../i18n";
import type { BorderSidesSettings, CalloutRenderRole, PluginSettings } from "../../types";
import { explainIfBlocked } from "../../ui/blockedButton";
import { settingGroupEl } from "../../ui/settingGroupEl";
import { specFromDef, wireStyleSlider, type StyleSliderSpec } from "../styleControls";
import { StylePreview } from "../stylePreview";
import {
	borderWidthSlider,
	CONTENT_SCALE_SLIDER,
	cornerRoundingSlider,
	HEADING_GAP_SLIDER,
	HEADING_PADDING_SLIDER,
	INLINE_TEXT_SCALE_SLIDER,
	roleFrame,
	roleFramePath,
	sliderDefault,
	TITLE_SCALE_SLIDER,
	type StyleSliderDef,
} from "../styleSpecs";
import { palettesPage } from "./palettesPage";
import { disabledWhilePaused } from "./pausedGuards";
import type { PersistentPart } from "./persistentParts";
import { pausedReason } from "./rowParts";
import { guardRender } from "./safeTree";
import type { CsControl, CsGroup, CsPage, CsRender, TreeContext } from "./types";

/** The ids of the main page's box and of the three pages (they name them in a page path). */
export const STYLE_PAGES = {
	box: "callout-style",
	heading: "style-heading",
	inline: "style-inline",
	regular: "style-block",
} as const;

/** Each role's name on the main page, and the sentence under it. */
const ROLE_TEXT: Record<CalloutRenderRole, { name: LocaleKey; desc: LocaleKey }> = {
	heading: { name: "settings.calloutTypeHeading", desc: "settings.globalSettingsHeadingDesc" },
	inline: { name: "settings.calloutTypeInline", desc: "settings.globalSettingsInlineDesc" },
	regular: { name: "settings.calloutTypeRegular", desc: "settings.globalSettingsRegularDesc" },
};

/** The four sides a border can be on. */
const SIDES: (keyof BorderSidesSettings)[] = ["top", "right", "bottom", "left"];

/** The main page's Callout style box: the three style pages, then the saved palettes. */
export function calloutStyleGroup(ctx: TreeContext): CsGroup {
	return {
		type: "group",
		id: STYLE_PAGES.box,
		heading: t("settings.calloutStyle"),
		items: [stylePage(ctx, "heading"), stylePage(ctx, "inline"), stylePage(ctx, "regular"), palettesPage(ctx)],
	};
}

/** The row that opens `role`'s style page, and the page. */
function stylePage(ctx: TreeContext, role: CalloutRenderRole): CsPage {
	return {
		type: "page",
		id: STYLE_PAGES[role],
		name: t(ROLE_TEXT[role].name),
		desc: t(ROLE_TEXT[role].desc),
		items: [previewBox(ctx, role), ...controlBoxes(ctx, role)],
	};
}

/** The boxes under the preview, in the order the page shows them. */
function controlBoxes(ctx: TreeContext, role: CalloutRenderRole): CsGroup[] {
	const rounding = sliderRow(ctx, cornerRoundingSlider(role));
	switch (role) {
		case "regular":
			return [
				standaloneBox(role, [
					rounding,
					toggleRow(ctx, "regular-align", "settings.alignContent", "globalStyle.alignContentWithTitle"),
				]),
				bordersBox(ctx, role),
				fontScaleBox(ctx),
			];
		case "heading":
			return [
				standaloneBox(role, [
					rounding,
					toggleRow(ctx, "heading-fold-arrow", "settings.headingFoldArrow", "headingCallouts.showFoldArrow", ["chevron"]),
				]),
				bordersBox(ctx, role),
				titleSpacingBox(ctx),
			];
		case "inline":
			return [
				standaloneBox(role, [
					rounding,
					// Alone in its box, so it is named for what it is, not "Text".
					sliderRow(ctx, INLINE_TEXT_SCALE_SLIDER, { name: "settings.fontScaleGroup" }),
				]),
				bordersBox(ctx, role),
			];
	}
}

/** A box without a heading, for the controls that need no group name. */
function standaloneBox(role: CalloutRenderRole, items: (CsRender | CsControl)[]): CsGroup {
	return { type: "group", id: `${STYLE_PAGES[role]}-shape`, items };
}

/* ---- The preview ---- */

/** The preview's kept part: its element, the preview itself, and how to take it down. */
interface PreviewPart extends PersistentPart {
	preview: StylePreview;
}

/** The name `role`'s preview is kept under. */
function previewPartId(role: CalloutRenderRole): string {
	return `${STYLE_PAGES[role]}-preview`;
}

/** The box that holds the preview: pinned under the page's title bar (styles.css). */
function previewBox(ctx: TreeContext, role: CalloutRenderRole): CsGroup {
	return {
		type: "group",
		id: previewPartId(role),
		cls: "cs-style-preview-group",
		items: [previewRow(ctx, role)],
	};
}

/** The row the preview sits in: no name, and not something to search for. */
function previewRow(ctx: TreeContext, role: CalloutRenderRole): CsRender {
	const id = previewPartId(role);
	return {
		id,
		name: "",
		searchable: false,
		render: guardRender("style preview", (setting) => {
			setting.setClass("cs-style-preview-row");
			ctx.parts.mount(id, setting.settingEl, (parent) => buildPreview(ctx, role, parent));
			return () => ctx.parts.releaseLater(id);
		}),
	};
}

/** Build the preview once, into its row; every draw leaves it where it is. */
function buildPreview(ctx: TreeContext, role: CalloutRenderRole, parent: HTMLElement): PreviewPart {
	const el = parent.createDiv({ cls: "cs-style-preview" });
	const preview = new StylePreview(ctx.plugin, role, el, false);
	const stopPinning = pinBelowTitlebar(parent);
	// The heading preview draws its own fold arrows and spacing, so it
	// follows the switch and the sliders itself.
	const follow = (): void => {
		preview.syncDemoChevrons();
		preview.refresh();
	};
	if (role === "heading") ctx.plugin.registry.onChange(follow);
	return {
		el,
		preview,
		dispose: () => {
			if (role === "heading") ctx.plugin.registry.offChange(follow);
			stopPinning();
			preview.destroy();
		},
	};
}

/**
 * Keep the preview's box just under the page's title bar, which is pinned to
 * the top itself: the box's `top` (`--cs-sticky-top`, styles.css) follows the
 * bar's height, which can change with the font size. Returns what stops it.
 */
function pinBelowTitlebar(rowEl: HTMLElement): () => void {
	const boxEl = rowEl.closest<HTMLElement>(".setting-group");
	const titlebar = rowEl.closest(".setting-page")?.querySelector<HTMLElement>(".setting-page-titlebar");
	if (!boxEl || !titlebar) return () => {};
	const observer = new ResizeObserver(() => {
		boxEl.style.setProperty("--cs-sticky-top", `${titlebar.getBoundingClientRect().height}px`);
	});
	observer.observe(titlebar);
	return () => observer.disconnect();
}

/** The heading page's preview, when it is on screen. */
function headingPreview(ctx: TreeContext): StylePreview | undefined {
	return ctx.parts.get<PreviewPart>(previewPartId("heading"))?.preview;
}

/* ---- Switches ---- */

/** One of Obsidian's switches, saved at `key` (a dotted path into the settings). */
function toggleRow(ctx: TreeContext, id: string, name: LocaleKey, key: string, aliases?: string[]): CsControl {
	return {
		id,
		name: t(name),
		aliases,
		control: { type: "toggle", key, disabled: disabledWhilePaused(ctx.plugin.settingsWriter) },
	};
}

/* ---- Sliders ---- */

/** What a slider row may be told besides its definition. */
interface SliderRowOptions {
	/** The row's name, when it is not the slider's own label. */
	name?: LocaleKey;
	/** The box whose heading ↺ this slider counts towards. */
	box?: ResetBox;
	/** Shown only while this is true. */
	visible?: () => boolean;
	/** Extra steps of a drag (the heading gap's demo). */
	hooks?: Pick<StyleSliderSpec, "onDragStart" | "onDragEnd"> & { afterSet?(value: number): void };
}

/** A slider as a settings row: its name, then ↺, the value and the track. */
function sliderRow(ctx: TreeContext, def: StyleSliderDef, options: SliderRowOptions = {}): CsRender {
	const name = t(options.name ?? def.label);
	const settings = (): PluginSettings => ctx.plugin.settings;
	return {
		id: def.id,
		name,
		aliases: def.aliases,
		visible: options.visible,
		disabled: disabledWhilePaused(ctx.plugin.settingsWriter),
		render: guardRender(def.id, (setting, group) => {
			setting.setClass("cs-style-slider-row");
			let resetEl: HTMLElement | null = null;
			/** Dim the ↺s that have nothing to reset. */
			const paintResets = (): void => {
				if (resetEl) paintIdle(resetEl, def.get(settings()) === sliderDefault(def));
				if (options.box) paintGroupReset(group, options.box.isModified(settings()));
			};
			let showSavedValue = (): void => {};
			setting.addExtraButton((button) => {
				resetEl = button.extraSettingsEl;
				button
					.setIcon("rotate-ccw")
					.setTooltip(`${t("settings.resetAction")}: ${name}`)
					.onClick(() => {
						if (def.get(settings()) === sliderDefault(def)) return;
						def.set(settings(), sliderDefault(def));
						showSavedValue();
						commitStyle(ctx);
						paintResets();
					});
			});
			setting.addSlider((slider) => {
				const spec = specFromDef(ctx.plugin, def, {
					...options.hooks,
					afterSet: (value) => {
						options.hooks?.afterSet?.(value);
						paintResets();
					},
				});
				showSavedValue = wireStyleSlider(ctx.plugin, slider, setting.settingEl, spec, () => commitStyle(ctx));
			});
			paintResets();
		}),
	};
}

/**
 * Save a style change the way every other settings change is saved: the
 * registry's change round repaints (the stylesheet, open notes, the outline)
 * and saves.
 */
function commitStyle(ctx: TreeContext): void {
	ctx.plugin.registry.settingsChanged();
}

/* ---- Boxes with ↺ in the heading ---- */

/** A box whose heading has ↺, and what that ↺ resets. */
interface ResetBox {
	id: string;
	heading: LocaleKey;
	/** Whether a field of the box differs from its default. */
	isModified(settings: PluginSettings): boolean;
	/** Put every field of the box back to its default. */
	reset(settings: PluginSettings): void;
}

/** The box of `items`, with ↺ in its heading. */
function resetBox(ctx: TreeContext, box: ResetBox, items: (CsRender | CsControl)[]): CsGroup {
	const heading = t(box.heading);
	return {
		type: "group",
		id: box.id,
		heading,
		// Made once, when the box is first drawn, so it reads everything anew
		// when pressed.
		extraButtons: [(button) => {
			button.extraSettingsEl.addClass("cs-group-reset");
			button
				.setIcon("rotate-ccw")
				.setTooltip(`${t("settings.resetAction")}: ${heading}`)
				.onClick(() => {
					if (explainIfBlocked(pausedReason(ctx.plugin.settingsWriter))) return;
					if (!box.isModified(ctx.plugin.settings)) return;
					box.reset(ctx.plugin.settings);
					commitStyle(ctx);
					// The box's rows show the defaults again.
					ctx.display();
				});
		}],
		items,
	};
}

/** What the ↺ of a box of sliders resets: each slider, to its default. */
function slidersReset(id: string, heading: LocaleKey, defs: StyleSliderDef[]): ResetBox {
	return {
		id,
		heading,
		isModified: (settings) => defs.some((def) => def.get(settings) !== sliderDefault(def)),
		reset: (settings) => { for (const def of defs) def.set(settings, sliderDefault(def)); },
	};
}

/** Font scale (block role): the title's and the content's. */
function fontScaleBox(ctx: TreeContext): CsGroup {
	const box = slidersReset("style-block-font-scale", "settings.fontScaleGroup", [TITLE_SCALE_SLIDER, CONTENT_SCALE_SLIDER]);
	return resetBox(ctx, box, [
		sliderRow(ctx, TITLE_SCALE_SLIDER, { box }),
		sliderRow(ctx, CONTENT_SCALE_SLIDER, { box }),
	]);
}

/** Title spacing (heading role): the space inside the bar, and the gap above it. */
function titleSpacingBox(ctx: TreeContext): CsGroup {
	const box = slidersReset("style-heading-title-spacing", "settings.headingSpacingGroup", [HEADING_PADDING_SLIDER, HEADING_GAP_SLIDER]);
	return resetBox(ctx, box, [
		sliderRow(ctx, HEADING_PADDING_SLIDER, { box }),
		sliderRow(ctx, HEADING_GAP_SLIDER, {
			box,
			// The live editor does not show the gap moving, so a stack of
			// headers takes the preview's place while the slider is held.
			hooks: {
				afterSet: (value) => headingPreview(ctx)?.setGapDemoValue(value),
				onDragStart: () => headingPreview(ctx)?.showGapDemo(),
				onDragEnd: () => {
					headingPreview(ctx)?.hideGapDemo();
					headingPreview(ctx)?.refresh();
				},
			},
		}),
	]);
}

/** Borders: a switch for each side, and Border thickness while a side has a border. */
function bordersBox(ctx: TreeContext, role: CalloutRenderRole): CsGroup {
	const box = bordersReset(role);
	const sideNames: Record<keyof BorderSidesSettings, LocaleKey> = {
		top: "settings.borderTop",
		right: "settings.borderRight",
		bottom: "settings.borderBottom",
		left: "settings.borderLeft",
	};
	const sides = SIDES.map((side) => toggleRow(
		ctx,
		`${role}-border-${side}`,
		sideNames[side],
		`${roleFramePath(role)}.borderSides.${side}`,
		["border", "outline"],
	));
	const width = sliderRow(ctx, borderWidthSlider(role), {
		box,
		visible: () => SIDES.some((side) => roleFrame(ctx.plugin.settings, role).borderSides[side]),
	});
	return resetBox(ctx, box, [...sides, width]);
}

/** What the Borders ↺ of `role` resets: every side, and the thickness. */
function bordersReset(role: CalloutRenderRole): ResetBox {
	const defaults = roleFrame(DEFAULT_SETTINGS, role);
	return {
		id: `${STYLE_PAGES[role]}-borders`,
		heading: "settings.border",
		isModified: (settings) => {
			const frame = roleFrame(settings, role);
			return frame.borderWidth !== defaults.borderWidth ||
				SIDES.some((side) => frame.borderSides[side] !== defaults.borderSides[side]);
		},
		reset: (settings) => {
			const frame = roleFrame(settings, role);
			Object.assign(frame.borderSides, defaults.borderSides);
			frame.borderWidth = defaults.borderWidth;
		},
	};
}

/* ---- Dimming the ↺s ---- */

/**
 * Dim a ↺ while there is nothing to reset. Obsidian draws an icon button
 * marked `aria-disabled` at 40%; a press then does nothing.
 */
function paintIdle(resetEl: HTMLElement, idle: boolean): void {
	resetEl.setAttribute("aria-disabled", String(idle));
}

/** Dim the ↺ in `group`'s heading while nothing in the box is changed. */
function paintGroupReset(group: SettingGroup, modified: boolean): void {
	const resetEl = settingGroupEl(group).querySelector<HTMLElement>(".cs-group-reset");
	if (resetEl) paintIdle(resetEl, !modified);
}
