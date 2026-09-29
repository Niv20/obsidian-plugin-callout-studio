/**
 * settings/recoveryRolePreview.ts — a heading callout and an inline callout as
 * one saved setup would draw them, for the Global style rows of the setup
 * comparison.
 *
 * Same isolation rules as the block preview in recoveryPreview.ts: the frame,
 * spacing and scale come from that setup's own global style, the colors from
 * its own definition (revalidated), the icon from its own saved artwork. No
 * live callout selector, theme rule or stylesheet is involved, so the two sides
 * of a row can never borrow from each other or from what is running now.
 */
import { setIcon } from "obsidian";
import { t } from "../i18n";
import { bgProps } from "../manager/css/backgroundProps";
import type { CalloutDefinition, PluginData, RoleFrameStyleSettings } from "../types";
import { mergeGlobalStyle } from "../utils/globalStyleMerge";
import { clampGlobalStyle } from "../utils/settingsGuards";
import { previewDefinition, renderRecoveryIcon } from "./recoveryPreview";

/** Frame and color variables shared by both role previews. */
function paintFrame(el: HTMLElement, def: CalloutDefinition, frame: RoleFrameStyleSettings): void {
	const mode = el.closest(".theme-dark") ? "dark" : "light";
	const accent = mode === "dark" ? def.colorDark : def.colorLight;
	// Declarations from the same pure generator real callouts use; every color
	// in `def` was revalidated by previewDefinition.
	el.setAttribute("style", bgProps(def, mode).join("\n"));
	el.setCssProps({
		"--cs-recovery-accent": accent,
		"--cs-recovery-radius": `${frame.borderRadius}px`,
		"--cs-recovery-border-color": def.transparentBg ? "transparent" : `color-mix(in srgb, ${accent} 25%, transparent)`,
		"--cs-recovery-border-width": (["top", "right", "bottom", "left"] as const)
			.map(side => `${frame.borderSides[side] ? frame.borderWidth : 0}px`).join(" "),
	});
}

function roleOff(parent: HTMLElement): void {
	parent.createSpan({ cls: "cs-recovery-muted", text: t("recovery.details.value.roleOff") });
}

/** A heading callout bar: its frame, inner spacing, icon, title and fold arrow. */
export function renderRecoveryHeadingPreview(parent: HTMLElement, data: Partial<PluginData>, definition: CalloutDefinition): void {
	if (data.settings?.headingCallouts?.enabled === false) { roleOff(parent); return; }
	const def = previewDefinition(definition);
	const style = clampGlobalStyle(mergeGlobalStyle(data.settings?.globalStyle)).heading;
	const bar = parent.createDiv({ cls: "cs-recovery-heading-preview" });
	paintFrame(bar, def, style);
	bar.setCssProps({
		"--cs-recovery-pad-top": `${style.paddingTop}em`,
		"--cs-recovery-pad-bottom": `${style.paddingBottom}em`,
	});
	if (def.hideIcon !== true) renderRecoveryIcon(bar, data, def.icon);
	bar.createSpan({ cls: "cs-recovery-role-title", text: def.displayName || def.id });
	if (data.settings?.headingCallouts?.showFoldArrow !== false) {
		setIcon(bar.createSpan({ cls: "cs-recovery-heading-fold", attr: { "aria-hidden": "true" } }), "chevron-down");
	}
}

/** An inline callout pill: its frame, scale, icon and label. */
export function renderRecoveryInlinePreview(parent: HTMLElement, data: Partial<PluginData>, definition: CalloutDefinition): void {
	if (data.settings?.inlineCallouts?.enabled === false) { roleOff(parent); return; }
	const def = previewDefinition(definition);
	const style = clampGlobalStyle(mergeGlobalStyle(data.settings?.globalStyle)).inline;
	const pill = parent.createSpan({ cls: "cs-recovery-inline-preview" });
	paintFrame(pill, def, style);
	pill.setCssProps({ "--cs-recovery-font-scale": String(style.fontScale) });
	if (def.hideIcon !== true) renderRecoveryIcon(pill, data, def.icon);
	pill.createSpan({ cls: "cs-recovery-role-title", text: def.displayName || def.id });
}
