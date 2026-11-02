/**
 * settings/aboutLinks.ts — where to find out more about Callout Studio, and how
 * to get in touch: the addresses and the words for the footer's tiles.
 *
 * Who calls it. The footer of the settings' main page (declarative/footerGroup.ts)
 * and the License window (LicenseModal.ts), which links to the plugin's license.
 *
 * The main idea. The footer is a row of tiles, each a Lucide icon and a name,
 * so each link here is both. The name is shown beside the icon and is the
 * tile's name for a screen reader. The tiles' order is this list's.
 */
import { t } from "../i18n";

/** The plugin's home on GitHub. */
export const REPOSITORY_URL = "https://github.com/Niv20/obsidian-plugin-callout-studio";

/** The plugin's license, on GitHub. */
export const LICENSE_URL = `${REPOSITORY_URL}/blob/master/LICENSE`;

/** Where a bug report or an idea goes. */
const ISSUE_URL = `${REPOSITORY_URL}/issues/new/choose`;

/** One link to the project: its icon, its name and its address. */
export interface ProjectLink {
	/** A Lucide icon id. */
	icon: string;
	label: string;
	href: string;
}

/** The project's pages: a bug report or an idea on GitHub, and the source code. */
export function projectLinks(): ProjectLink[] {
	return [
		{ icon: "bug", label: t("footer.openIssue"), href: ISSUE_URL },
		{ icon: "github", label: t("footer.sourceCode"), href: REPOSITORY_URL },
	];
}

/** The release notes of `version`. */
export function releaseNotesUrl(version: string): string {
	return `${REPOSITORY_URL}/releases/tag/${encodeURIComponent(version)}`;
}
