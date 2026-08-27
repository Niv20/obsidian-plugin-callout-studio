/**
 * settings/sections/GlobalSettingsSection.ts — Vault-wide callout style entry points.
 *
 * A single callout definition can render as a block callout, a heading
 * callout, or an inline callout. Each role has its own vault-wide geometry
 * (borders, spacing, shape, …) edited in the per-role "Global callout style"
 * popup ({@link GlobalStyleModal}). This section is a heading, then one
 * {@link Setting} row per role — each with a description stating that it is
 * global and reaches every callout of that role, plus a "Customize" button
 * that opens that role's popup.
 *
 * Each role also has an `enabled` setting (block is always on; heading and
 * inline can each be disabled) that still gates rendering, but it is not
 * exposed here as a toggle.
 */
import { Setting } from "obsidian";
import { t } from "../../i18n";
import type { CalloutRenderRole } from "../../types";
import { GlobalStyleModal } from "../GlobalStyleModal";
import type { SettingsSectionContext } from "./types";

/** Renders `` `...` `` segments as inline <code> instead of showing the raw backticks. */
function renderDescWithCode(text: string): DocumentFragment {
	const frag = createFragment();
	for (const part of text.split(/(`[^`]+`)/g)) {
		if (part.startsWith("`") && part.endsWith("`")) {
			frag.createEl("code", {
				text: part.slice(1, -1),
				cls: "callout-studio-row-syntax",
			});
		} else if (part) {
			frag.appendText(part);
		}
	}
	return frag;
}

export function renderGlobalSettingsSection(
	ctx: SettingsSectionContext,
	containerEl: HTMLElement,
): void {
	new Setting(containerEl).setName(t("settings.globalSettings")).setHeading();

	const roles: { role: CalloutRenderRole; label: string; desc: string }[] = [
		{
			role: "heading",
			label: t("settings.calloutTypeHeading"),
			desc: t("settings.globalSettingsHeadingDesc"),
		},
		{
			role: "inline",
			label: t("settings.calloutTypeInline"),
			desc: t("settings.globalSettingsInlineDesc"),
		},
		{
			role: "regular",
			label: t("settings.calloutTypeRegular"),
			desc: t("settings.globalSettingsRegularDesc"),
		},
	];

	for (const { role, label, desc } of roles) {
		new Setting(containerEl)
			.setName(label)
			.setDesc(renderDescWithCode(desc))
			.addButton((btn) => {
				btn
					.setButtonText(t("settings.globalSettingsCustomize"))
					.onClick(() => new GlobalStyleModal(ctx.plugin, role).open());
				btn.buttonEl.addClass("cs-settings-neutral-btn");
			});
	}
}
