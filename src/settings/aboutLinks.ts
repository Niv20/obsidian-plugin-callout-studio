/**
 * settings/aboutLinks.ts — where to find out more about Callout Studio, and how
 * to get in touch: the project's links and the contact sentence.
 *
 * Who calls it. The settings footer (sections/FooterSection.ts) and the About
 * group of the declarative settings page (declarative/mainPageGroups.ts), so
 * the links are spelled out once.
 */
import { t } from "../i18n";

/** The plugin's home on GitHub. */
export const REPOSITORY_URL = "https://github.com/Niv20/obsidian-plugin-callout-studio";

/** Where the contact sentence's two links go. */
const ISSUE_URL = `${REPOSITORY_URL}/issues/new/choose`;
const EMAIL_URL = "mailto:anivbniv@gmail.com";

/** The `{{issue}}` and `{{email}}` placeholders in the contact sentence. */
const CONTACT_LINK_TOKEN = /(\{\{issue\}\}|\{\{email\}\})/g;

/** One link to the project: its label and address. */
export interface ProjectLink {
	label: string;
	href: string;
}

/** The project's pages: its source code, how to contribute, and its license. */
export function projectLinks(): ProjectLink[] {
	return [
		{ label: t("footer.sourceCode"), href: REPOSITORY_URL },
		{ label: t("footer.contribute"), href: `${REPOSITORY_URL}/blob/master/docs/CONTRIBUTING.md` },
		{ label: t("footer.license"), href: `${REPOSITORY_URL}/blob/master/LICENSE` },
	];
}

/** The release notes of `version`. */
export function releaseNotesUrl(version: string): string {
	return `${REPOSITORY_URL}/releases/tag/${encodeURIComponent(version)}`;
}

/**
 * Write the contact sentence ("Questions, bugs, or ideas? … Open a GitHub
 * issue or send me an email.") into `parent`, with its two links.
 *
 * @param linkCls A class for each link, if the page styles them itself.
 * @param breakCls When given, the part after the sentence's `{{break}}` goes
 *   into a span with this class (the footer starts it on a line of its own);
 *   without it, the break is just a space.
 */
export function appendContactSentence(parent: HTMLElement | DocumentFragment, linkCls?: string, breakCls?: string): void {
	const template = t("footer.prompt");
	const breakAt = template.indexOf("{{break}}");
	if (breakAt < 0) {
		appendContactLinks(parent, template, linkCls);
		return;
	}
	parent.appendText(template.slice(0, breakAt));
	const rest = template.slice(breakAt + "{{break}}".length);
	const target = breakCls ? parent.createSpan({ cls: breakCls }) : parent;
	appendContactLinks(target, rest, linkCls);
}

/** The words of the sentence, with its placeholders turned into links. */
function appendContactLinks(parent: HTMLElement | DocumentFragment, template: string, linkCls: string | undefined): void {
	for (const part of template.split(CONTACT_LINK_TOKEN)) {
		if (part === "{{issue}}") {
			parent.createEl("a", {
				text: t("footer.openIssue"),
				cls: linkCls,
				href: ISSUE_URL,
				attr: { target: "_blank", rel: "noopener noreferrer" },
			});
		} else if (part === "{{email}}") {
			parent.createEl("a", { text: t("footer.sendEmail"), cls: linkCls, href: EMAIL_URL });
		} else if (part) {
			parent.appendText(part);
		}
	}
}
