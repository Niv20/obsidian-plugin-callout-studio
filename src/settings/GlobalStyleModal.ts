/**
 * settings/GlobalStyleModal.ts — Per-role "Global callout style" popup.
 *
 * Opened from the Global settings section's per-role buttons in the settings
 * tab, one modal per render role. Two-column layout: a live preview (left) of a
 * neutral demo callout (stylePreview.ts) and the role's style control groups
 * (right):
 *   - regular: borders, font scale, shape, align
 *   - heading: borders, shape, vertical text spacing, outline/link options
 *   - inline:  borders, shape
 *
 * The sliders are the shared definitions of styleSpecs.ts, which the
 * declarative style pages use too.
 */
import { Modal } from "obsidian";
import { t } from "../i18n";
import type { CalloutRenderRole } from "../types";
import {
	createResettableControlGroup,
	renderBordersGroup,
	specFromDef,
	styleFieldsReset,
} from "./styleControls";
import {
	CONTENT_SCALE_SLIDER,
	cornerRoundingSlider,
	HEADING_GAP_SLIDER,
	HEADING_PADDING_SLIDER,
	INLINE_TEXT_SCALE_SLIDER,
	sliderDefault,
	TITLE_SCALE_SLIDER,
} from "./styleSpecs";
import { StylePreview } from "./stylePreview";
import type { SettingsTabPlugin } from "./sections/types";
import { refreshAllCalloutEditors } from "../editor/livepreview/refresh";
import { applyModalChrome } from "./modalChrome";
import { DEFAULT_SETTINGS } from "../constants";

export class GlobalStyleModal extends Modal {
	private preview: StylePreview | null = null;

	constructor(
		private readonly plugin: SettingsTabPlugin,
		private readonly role: CalloutRenderRole,
	) {
		super(plugin.app);
	}

	onOpen(): void {
		this.modalEl.addClass("cs-role-style-modal");
		// No footer: every control here applies live, so there is nothing to
		// confirm. Same width as the two editors, hence `wide`.
		applyModalChrome(this);
		this.titleEl.setText(t(this.titleKey()));

		const panel = this.contentEl.createDiv({
			cls: "callout-studio-preview-panel",
		});
		this.preview = new StylePreview(this.plugin, this.role, panel);

		const controlsCol = panel.createDiv({
			cls: "callout-studio-adjust-col",
		});
		switch (this.role) {
			case "regular":
				this.renderRegularControls(controlsCol);
				break;
			case "heading":
				this.renderHeadingControls(controlsCol);
				break;
			case "inline":
				this.renderInlineControls(controlsCol);
				break;
		}
	}

	onClose(): void {
		this.preview?.destroy();
		this.preview = null;
		this.contentEl.empty();
	}

	// ── Per-role control columns ────────────────────────────────────

	private renderRegularControls(col: HTMLElement): void {
		const { globalStyle } = this.plugin.settings;
		const defaults = DEFAULT_SETTINGS.globalStyle;
		renderBordersGroup(this.plugin, col, "regular");

		const fontGroup = createResettableControlGroup(
			this.plugin, col, t("settings.fontScaleGroup"),
			styleFieldsReset(globalStyle, defaults, ["titleScale", "contentScale"]),
		);
		fontGroup.addSlider(specFromDef(this.plugin, TITLE_SCALE_SLIDER));
		fontGroup.addSlider(specFromDef(this.plugin, CONTENT_SCALE_SLIDER));

		this.renderShapeGroup(col, "regular");

		const alignGroup = createResettableControlGroup(
			this.plugin,
			col,
			t("settings.alignGroup"),
			styleFieldsReset(globalStyle, defaults, ["alignContentWithTitle"]),
			"cs-layout-group",
		);
		alignGroup.addToggle(t("settings.alignContent"),
			() => globalStyle.alignContentWithTitle,
			(value) => { globalStyle.alignContentWithTitle = value; });
	}

	private renderHeadingControls(col: HTMLElement): void {
		const heading = this.plugin.settings.globalStyle.heading;
		const defaults = DEFAULT_SETTINGS.globalStyle.heading;
		renderBordersGroup(this.plugin, col, "heading");

		this.renderShapeGroup(col, "heading");

		// Vertical spacing of the text inside the bar, and the gap above each
		// heading callout.
		const refreshSpacing = (): void => {
			this.preview?.hideGapDemo();
			this.preview?.setGapDemoValue(heading.marginTop);
			this.preview?.refresh();
			refreshAllCalloutEditors();
		};
		const spacingGroup = createResettableControlGroup(
			this.plugin,
			col,
			t("settings.headingSpacingGroup"),
			{
				...styleFieldsReset(heading, defaults, ["paddingTop", "paddingBottom", "marginTop"]),
				afterReset: refreshSpacing,
			},
		);
		spacingGroup.addSlider(specFromDef(this.plugin, HEADING_PADDING_SLIDER));
		spacingGroup.addSlider(specFromDef(this.plugin, HEADING_GAP_SLIDER, {
			// Drive the demo straight off the slider value so it tracks
			// exactly — including a hard 0. Relying on the injected
			// `--cs-heading-gap-top` instead would leave the demo showing a
			// stale gap at 0, since the injector omits the variable at 0 and
			// the drag-time inject is RAF-coalesced (the reported "bars still
			// far apart at 0" bug).
			afterSet: (value) => this.preview?.setGapDemoValue(value),
			// The gap comes from a static CSS margin (reading view) and a CM6
			// block widget (Live Preview) — neither of which the modal's own
			// live editor preview shows moving in real time (the widget only
			// rebuilds on an explicit refresh, not on cssInjector's cheap
			// drag-time inject) — so swap in the stacked reading-view demo for
			// the duration of the drag.
			onDragStart: () => this.preview?.showGapDemo(),
			onDragEnd: () => {
				this.preview?.hideGapDemo();
				// Rebuild every open note's Live Preview so the new gap widget
				// appears without needing to reopen the note. The preview call
				// stays for the STATIC fallback render, which is no editor at
				// all and so is reached by no dispatch.
				this.preview?.refresh();
				refreshAllCalloutEditors();
			},
		}));

		// Our own trailing chevron only — Obsidian's native indicator before
		// the title (and the one reading view uses) is a separate element we
		// never draw, so it keeps folding regardless of this switch.
		const refreshFold = (): void => {
			this.preview?.syncDemoChevrons();
			this.preview?.refresh();
			refreshAllCalloutEditors();
		};
		const foldGroup = createResettableControlGroup(
			this.plugin,
			col,
			t("settings.headingFoldGroup"),
			{
				...styleFieldsReset(this.plugin.settings.headingCallouts,
					DEFAULT_SETTINGS.headingCallouts, ["showFoldArrow"]),
				afterReset: refreshFold,
			},
			"cs-layout-group",
		);
		foldGroup.addToggle(t("settings.headingFoldArrow"),
			() => this.plugin.settings.headingCallouts.showFoldArrow,
			(value) => { this.plugin.settings.headingCallouts.showFoldArrow = value; },
			refreshFold);
	}

	private renderInlineControls(col: HTMLElement): void {
		const inline = this.plugin.settings.globalStyle.inline;
		const defaults = DEFAULT_SETTINGS.globalStyle.inline;
		renderBordersGroup(this.plugin, col, "inline");

		const fontGroup = createResettableControlGroup(
			this.plugin, col, t("settings.fontScaleGroup"),
			styleFieldsReset(inline, defaults, ["fontScale"]),
		);
		fontGroup.addSlider(specFromDef(this.plugin, INLINE_TEXT_SCALE_SLIDER));

		this.renderShapeGroup(col, "inline");
	}

	/** The Shape group: `role`'s corner rounding, with ↺ back to its default. */
	private renderShapeGroup(col: HTMLElement, role: CalloutRenderRole): void {
		const rounding = cornerRoundingSlider(role);
		const shapeGroup = createResettableControlGroup(this.plugin, col, t("settings.shapeGroup"), {
			isModified: () => rounding.get(this.plugin.settings) !== sliderDefault(rounding),
			reset: () => rounding.set(this.plugin.settings, sliderDefault(rounding)),
		});
		shapeGroup.addSlider(specFromDef(this.plugin, rounding));
	}

	private titleKey(): string {
		return {
			regular: "settings.globalStyleRegularTitle",
			heading: "settings.globalStyleHeadingTitle",
			inline: "settings.globalStyleInlineTitle",
		}[this.role];
	}
}
