/**
 * settings/sections/FooterSection.ts — Settings tab footer.
 *
 * Keeps support and project links easy to reach without letting licensing
 * details take over the bottom of the settings page. The links themselves are
 * spelled out in ../aboutLinks.ts, which the declarative page's About group
 * shares.
 */
import { t } from "../../i18n";
import { IconCreditsModal } from "../IconCreditsModal";
import { appendContactSentence, projectLinks, releaseNotesUrl } from "../aboutLinks";
import type { SettingsSectionContext } from "./types";

export function renderFooterSection(
	ctx: SettingsSectionContext,
	containerEl: HTMLElement,
): void {
	const footer = containerEl.createDiv({
		cls: "callout-studio-footer",
	});
	const contact = footer.createEl("p", {
		cls: "callout-studio-footer-contact",
	});
	appendContactSentence(contact, "callout-studio-footer-contact-link", "callout-studio-footer-contact-links");

	const meta = footer.createDiv({
		cls: "callout-studio-footer-meta",
	});
	for (const link of projectLinks()) {
		createMetaLink(meta, link.label, link.href);
		createMetaSeparator(meta);
	}

	const creditsButton = meta.createEl("button", {
		text: t("footer.iconCredits"),
		cls: "callout-studio-footer-meta-link",
		attr: { type: "button" },
	});
	const openCredits = (): void => {
		new IconCreditsModal(ctx.app).open();
	};
	creditsButton.addEventListener("click", openCredits);
	ctx.registerDisposer(() => {
		creditsButton.removeEventListener("click", openCredits);
	});

	createMetaSeparator(meta);
	meta.createEl("a", {
		text: `v${ctx.plugin.manifest.version}`,
		href: releaseNotesUrl(ctx.plugin.manifest.version),
		cls: "callout-studio-footer-meta-link callout-studio-footer-version",
		attr: { target: "_blank", rel: "noopener noreferrer" },
	});
}

function createMetaLink(
	parent: HTMLElement,
	label: string,
	href: string,
): void {
	parent.createEl("a", {
		text: label,
		href,
		cls: "callout-studio-footer-meta-link",
		attr: { target: "_blank", rel: "noopener noreferrer" },
	});
}

function createMetaSeparator(parent: HTMLElement): void {
	const separator = parent.createSpan({
		text: "·",
		cls: "callout-studio-footer-meta-separator",
	});
	separator.setAttribute("aria-hidden", "true");
}
