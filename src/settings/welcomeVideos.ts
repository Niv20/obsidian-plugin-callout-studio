import type { en } from "../i18n/en";

export interface WelcomeVideo {
	readonly url: string;
	readonly titleKey: keyof typeof en;
	readonly descriptionKey: keyof typeof en;
	readonly guideUrl: string;
}

const USER_GUIDE_URL = "https://github.com/Niv20/obsidian-plugin-callout-studio/blob/master/docs/user-guide";

/**
 * The 17 topics follow the tutorial scripts and user-guide chapter order.
 * Replace the temporary sample URLs with the published tutorial URLs. Finished
 * titles and descriptions live in en.ts for translation with the interface.
 */
export const WELCOME_VIDEOS: readonly WelcomeVideo[] = [
	{ url: "https://youtu.be/xMHJGd3wwZk?si=P00-sZbJHBHELObF", titleKey: "welcome.video.threeTypes", descriptionKey: "welcome.video.threeTypesDesc", guideUrl: `${USER_GUIDE_URL}/01-the-three-callout-types.md` },
	{ url: "https://youtu.be/xMHJGd3wwZk?si=P00-sZbJHBHELObF", titleKey: "welcome.video.create", descriptionKey: "welcome.video.createDesc", guideUrl: `${USER_GUIDE_URL}/02-create-your-first-callout.md` },
	{ url: "https://youtu.be/xMHJGd3wwZk?si=P00-sZbJHBHELObF", titleKey: "welcome.video.palettes", descriptionKey: "welcome.video.palettesDesc", guideUrl: `${USER_GUIDE_URL}/03-custom-color-palettes.md` },
	{ url: "https://youtu.be/xMHJGd3wwZk?si=P00-sZbJHBHELObF", titleKey: "welcome.video.icons", descriptionKey: "welcome.video.iconsDesc", guideUrl: `${USER_GUIDE_URL}/04-custom-icons-and-emojis.md` },
	{ url: "https://youtu.be/xMHJGd3wwZk?si=P00-sZbJHBHELObF", titleKey: "welcome.video.fallback", descriptionKey: "welcome.video.fallbackDesc", guideUrl: `${USER_GUIDE_URL}/05-fallback-styles-and-discovery.md` },
	{ url: "https://youtu.be/xMHJGd3wwZk?si=P00-sZbJHBHELObF", titleKey: "welcome.video.manage", descriptionKey: "welcome.video.manageDesc", guideUrl: `${USER_GUIDE_URL}/06-editing-replacing-and-deleting.md` },
	{ url: "https://youtu.be/xMHJGd3wwZk?si=P00-sZbJHBHELObF", titleKey: "welcome.video.styles", descriptionKey: "welcome.video.stylesDesc", guideUrl: `${USER_GUIDE_URL}/07-global-styling.md` },
	{ url: "https://youtu.be/xMHJGd3wwZk?si=P00-sZbJHBHELObF", titleKey: "welcome.video.menus", descriptionKey: "welcome.video.menusDesc", guideUrl: `${USER_GUIDE_URL}/08-the-right-click-menu.md` },
	{ url: "https://youtu.be/xMHJGd3wwZk?si=P00-sZbJHBHELObF", titleKey: "welcome.video.hotkeys", descriptionKey: "welcome.video.hotkeysDesc", guideUrl: `${USER_GUIDE_URL}/09-commands-and-hotkeys.md` },
	{ url: "https://youtu.be/xMHJGd3wwZk?si=P00-sZbJHBHELObF", titleKey: "welcome.video.import", descriptionKey: "welcome.video.importDesc", guideUrl: `${USER_GUIDE_URL}/10-import-export-and-sharing.md` },
	{ url: "https://youtu.be/xMHJGd3wwZk?si=P00-sZbJHBHELObF", titleKey: "welcome.video.languages", descriptionKey: "welcome.video.languagesDesc", guideUrl: `${USER_GUIDE_URL}/11-languages.md` },
	{ url: "https://youtu.be/xMHJGd3wwZk?si=P00-sZbJHBHELObF", titleKey: "welcome.video.find", descriptionKey: "welcome.video.findDesc", guideUrl: `${USER_GUIDE_URL}/12-find-callouts.md` },
	{ url: "https://youtu.be/xMHJGd3wwZk?si=P00-sZbJHBHELObF", titleKey: "welcome.video.backups", descriptionKey: "welcome.video.backupsDesc", guideUrl: `${USER_GUIDE_URL}/13-syncing-and-backups.md` },
	{ url: "https://youtu.be/xMHJGd3wwZk?si=P00-sZbJHBHELObF", titleKey: "welcome.video.dangerZone", descriptionKey: "welcome.video.dangerZoneDesc", guideUrl: `${USER_GUIDE_URL}/14-danger-zone.md` },
	{ url: "https://youtu.be/xMHJGd3wwZk?si=P00-sZbJHBHELObF", titleKey: "welcome.video.insert", descriptionKey: "welcome.video.insertDesc", guideUrl: `${USER_GUIDE_URL}/15-quick-insert.md` },
	{ url: "https://youtu.be/xMHJGd3wwZk?si=P00-sZbJHBHELObF", titleKey: "welcome.video.heading", descriptionKey: "welcome.video.headingDesc", guideUrl: `${USER_GUIDE_URL}/16-advanced-heading-callouts.md` },
	{ url: "https://youtu.be/xMHJGd3wwZk?si=P00-sZbJHBHELObF", titleKey: "welcome.video.themes", descriptionKey: "welcome.video.themesDesc", guideUrl: `${USER_GUIDE_URL}/17-theme-integration.md` },
];
