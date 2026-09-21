/**
 * settings/sections/FooterSection.ts — Settings tab footer.
 *
 * Keeps support and project links easy to reach without letting licensing
 * details take over the bottom of the settings page.
 */
import { t } from "../../i18n";
import { IconCreditsModal } from "../IconCreditsModal";
import type { SettingsSectionContext } from "./types";

const REPOSITORY_URL =
	"https://github.com/Niv20/obsidian-plugin-callout-studio";
const CONTACT_LINK_TOKEN = /(\{\{issue\}\}|\{\{email\}\})/g;

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
	renderContactSentence(contact);

	const meta = footer.createDiv({
		cls: "callout-studio-footer-meta",
	});
	createMetaLink(meta, t("footer.sourceCode"), REPOSITORY_URL);
	createMetaSeparator(meta);
	createMetaLink(
		meta,
		t("footer.contribute"),
		`${REPOSITORY_URL}/blob/master/CONTRIBUTING.md`,
	);
	createMetaSeparator(meta);
	createMetaLink(
		meta,
		t("footer.license"),
		`${REPOSITORY_URL}/blob/master/LICENSE`,
	);
	createMetaSeparator(meta);

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
		href: `${REPOSITORY_URL}/releases/tag/${encodeURIComponent(ctx.plugin.manifest.version)}`,
		cls: "callout-studio-footer-meta-link callout-studio-footer-version",
		attr: { target: "_blank", rel: "noopener noreferrer" },
	});
}

function renderContactSentence(parent: HTMLElement): void {
	const template = t("footer.prompt");
	const breakAt = template.indexOf("{{break}}");
	if (breakAt < 0) {
		renderContactLinks(parent, template);
		return;
	}

	parent.appendText(template.slice(0, breakAt));
	const linksLine = parent.createSpan({
		cls: "callout-studio-footer-contact-links",
	});
	renderContactLinks(linksLine, template.slice(breakAt + "{{break}}".length));
}

function renderContactLinks(parent: HTMLElement, template: string): void {
	for (const part of template.split(CONTACT_LINK_TOKEN)) {
		if (part === "{{issue}}") {
			createContactLink(
				parent,
				t("footer.openIssue"),
				`${REPOSITORY_URL}/issues/new`,
				true,
			);
		} else if (part === "{{email}}") {
			createContactLink(
				parent,
				t("footer.sendEmail"),
				"mailto:anivbniv@gmail.com",
				false,
			);
		} else if (part) {
			parent.appendText(part);
		}
	}
}

function createContactLink(
	parent: HTMLElement,
	label: string,
	href: string,
	openInNewTab: boolean,
): void {
	parent.createEl("a", {
		text: label,
		cls: "callout-studio-footer-contact-link",
		href,
		attr: openInNewTab
			? { target: "_blank", rel: "noopener noreferrer" }
			: undefined,
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
