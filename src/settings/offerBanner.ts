/**
 * settings/offerBanner.ts — an offer at the top of the settings page: the
 * brush, one sentence, one button, and ✕.
 *
 * Who calls it. declarative/bannerRows.ts, for the offer to import from
 * another callout plugin and the offer to set up the website export.
 *
 * The box is every banner's (settings/bannerBox.ts), in the accent. The class
 * names inside it say "competitor import" because that offer was the only one
 * until 2026-11-14; styles.css and the suites key on them.
 */
import { setIcon } from "obsidian";
import { getLocale, t } from "../i18n";
import { addMascot } from "../ui/mascot/mascotPlaces";
import { createBanner } from "./bannerBox";

/** What an offer's two buttons do. */
export interface OfferHandlers {
	/** The button: take the offer up. `fromKeyboard`: pressed with a key. */
	onAction(fromKeyboard: boolean): void;
	/** ✕: stop offering. */
	onDismiss(): void;
}

/** Names as one list in the reader's language: "A", "A and B", "A, B, and C". */
export const nameList = (names: readonly string[]): string =>
	new Intl.ListFormat(getLocale(), { style: "long", type: "conjunction" }).format(names);

/**
 * Build an offer into `parent`: the brush (where it can be drawn) saying hello
 * once, `message`, a button that says `action`, and ✕. The brush is happy while
 * the pointer is on the button and cries while it is on ✕. The settings page
 * shows it as a row (declarative/bannerRows.ts).
 */
export function buildOfferBanner(
	parent: HTMLElement,
	message: string,
	action: string,
	handlers: OfferHandlers,
): HTMLElement {
	const banner = createBanner(parent, "accent", "cs-competitor-import-banner");
	// Says hello, is glad (a little jump) and goes back to being the icon,
	// which the pointer can play with: the offer can stay up for days.
	const mascot = addMascot(banner, "notice", "start");
	if (mascot) {
		banner.addClass("has-mascot");
		void mascot.play("greet");
	}
	banner.createDiv({ cls: "cs-competitor-import-banner-message", text: message });

	const actionButton = banner.createEl("button", {
		cls: "mod-cta cs-competitor-import-banner-action",
		text: action,
	});
	// A click from Enter or Space carries no pointer detail; it shows the ring.
	actionButton.addEventListener("click", (event) => {
		handlers.onAction(event.detail === 0);
	});

	const dismissButton = banner.createEl("button", {
		cls: "clickable-icon cs-competitor-import-banner-dismiss",
		attr: { "aria-label": t("importBanner.dismiss") },
	});
	setIcon(dismissButton, "x");
	dismissButton.addEventListener("click", () => handlers.onDismiss());

	// Glad while the pointer is on the button, sad to see it go while it is on
	// ✕, as a confirmation's mascot answers its buttons. Unlike a
	// confirmation's it holds no mood of its own underneath: the offer can stay
	// up for days, so between visits it is the still icon again. The buttons
	// and their listeners leave with the banner.
	if (mascot) {
		mascot.hover(actionButton, "happy");
		mascot.hover(dismissButton, "cry");
	}
	return banner;
}
