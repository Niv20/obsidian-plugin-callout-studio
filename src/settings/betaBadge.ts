/**
 * settings/betaBadge.ts — the grey "Beta" tag.
 *
 * It sits after the name of a settings row whose feature is new enough that
 * it may still change or have rough edges: Publish to the web is the first.
 * Like the "Recommended" tag (`recommendedBadge.ts`) it is Obsidian's own flat
 * flair (`.flair.mod-flat`), the tag Obsidian prints after "Regex", so it
 * reads as a label on the name and not as a button or a state.
 */
import { t } from "../i18n";

export function renderBetaBadge(parent: HTMLElement, text = t("web.beta")): HTMLElement {
	return parent.createSpan({ cls: "flair mod-flat cs-beta-badge", text });
}
