/**
 * settings/sections/tabSubscriptions.ts — keeping the settings tab in step with
 * the rest of the plugin.
 *
 * Who calls it. The settings tab (declarative/declarativeSettings.ts), once,
 * for the plugin's whole life; and a Built-in or theme callouts page
 * (declarative/calloutListPage.ts) while it is open.
 *
 * Four signals can make the callout lists wrong, and all four converge on one
 * coalesced redraw. What each one is *for* is written beside it below; what
 * they have in common is worth stating once here. One `dispose` undoes all
 * four, so the pairing cannot come apart the way four separate fields and four
 * separate teardown blocks could.
 *
 * ## `force`, and why only two of them carry it
 *
 * The repaint compares a signature of everything it would draw and skips the
 * redraw when nothing moved (`calloutListsSignature`). Two of these four signals
 * describe changes that signature can see for itself; the other two describe
 * changes it structurally cannot, and those pass `force`.
 */
import type { App, EventRef } from "obsidian";
import type { SettingsTabPlugin } from "./types";

/**
 * Wire the four, and hand back the one call that undoes them.
 *
 * `refresh` is invoked with whether this signal must redraw regardless of the
 * signature.
 */
export function subscribeSettingsTab(
	app: App,
	plugin: SettingsTabPlugin,
	refresh: (force: boolean) => void,
): () => void {
	// A real mutation, and one the signature reads directly off the registry.
	const onRegistry = (): void => refresh(false);
	plugin.registry.onChange(onRegistry);

	// The callout editor's live preview registers its in-progress definition
	// transiently, without a registry mutation (no save, no note re-render — see
	// setPreviewDefinition). This is the only signal that reaches us, and it is
	// what keeps the row swatches in step with the modal's colour picker instead
	// of trailing it by a beat.
	//
	// Forced: registering *without* a registry mutation is the contract, so the
	// signature may not be able to see the change at all.
	const onPreview = (): void => refresh(true);
	plugin.registry.onPreviewChange(onPreview);

	// Forced for the reason above and then some: artwork lives in a download
	// cache keyed by icon name, so a definition naming a not-yet-downloaded icon
	// is byte-identical to the one naming it a second later. Guarding this one
	// would leave every row that came up on a spinner spinning for good.
	const dropIconCache = plugin.onIconCacheChange(() => refresh(true));

	// Row swatches show the CURRENT theme mode's accent/background, so a live
	// theme flip must redraw them. CSSInjector fires "css-change" after every
	// inject, so this is the busiest of the four. Not forced — the flip
	// moves the colour scheme and the theme's measured appearances, and the
	// signature reads both.
	const cssRef: EventRef = app.workspace.on("css-change", () => refresh(false));

	return () => {
		plugin.registry.offChange(onRegistry);
		plugin.registry.offPreviewChange(onPreview);
		dropIconCache();
		app.workspace.offref(cssRef);
	};
}
