/**
 * settings/recommendedBadge.ts — the grey "Recommended" tag.
 *
 * Replaces a "(recommended)" that used to be written into a title. The tag sits
 * on the option's title line, outside the title's own text, so the title stays
 * the name of the thing and the recommendation can come and go on its own —
 * the plugin import window shows it only once the other plugin's data is found.
 *
 * It is Obsidian's own flat flair (`.flair.mod-flat`), the tag Obsidian prints
 * after "Regex" and the one callout rows print for "Default". Grey, not core's
 * green onboarding variant: nothing in these windows is green.
 */
import { t } from "../i18n";

export function renderRecommendedBadge(parent: HTMLElement): HTMLElement {
	return parent.createSpan({ cls: "flair mod-flat cs-recommended-badge", text: t("settings.recommended") });
}
