/**
 * settings/recommendedBadge.ts — the grey "Recommended" pill.
 *
 * Replaces a "(recommended)" that used to be written into a title. A pill sits
 * on the option's title line, outside the title's own text, so the title stays
 * the name of the thing and the recommendation can come and go on its own —
 * the plugin import window shows it only once the other plugin's data is found.
 */
import { setIcon } from "obsidian";
import { t } from "../i18n";

export function renderRecommendedBadge(parent: HTMLElement): HTMLElement {
	const badge = parent.createSpan({ cls: "cs-recommended-badge" });
	setIcon(badge.createSpan({ cls: "cs-recommended-badge-icon" }), "thumbs-up");
	badge.createSpan({ cls: "cs-recommended-badge-text", text: t("settings.recommended") });
	return badge;
}
