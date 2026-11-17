/**
 * settings/bannerBox.ts — the box every banner is drawn in.
 *
 * Who calls it. settings/saveStatusBanner.ts (the saving notice, on the
 * settings page and in the callout editor) and settings/offerBanner.ts (the
 * import and website offers). A new banner starts here too.
 *
 * The box's whole look is one rule, `.cs-banner` in styles.css: its corners
 * (an Obsidian settings box's), padding, margins and tint. A banner says only
 * which colour it is tinted with (`tone`) and how its insides are laid out
 * (its own class), so the box changes in one place for every banner.
 */

/** The colour a banner is tinted with: a problem's, or an offer's. */
export type BannerTone = "warning" | "accent";

/** Each tone's class, written out whole so the repo's class check can see it. */
const TONE_CLASS: Record<BannerTone, string> = {
	warning: "cs-banner-warning",
	accent: "cs-banner-accent",
};

/**
 * Create a banner box in `parent`, in `tone`, with `cls` for the layout of
 * what goes inside it. Announced as a status, as every banner is.
 */
export function createBanner(parent: HTMLElement, tone: BannerTone, cls: string): HTMLElement {
	return parent.createDiv({
		cls: `cs-banner ${TONE_CLASS[tone]} ${cls}`,
		attr: { role: "status" },
	});
}
