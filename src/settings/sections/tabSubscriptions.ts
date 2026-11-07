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
 * ## `force`, and why only one of them carries it
 *
 * The repaint compares a signature of everything it would draw and skips the
 * redraw when nothing moved (`calloutListsSignature`). Three of these four
 * signals describe changes that signature can see for itself; the icon
 * download describes one it structurally cannot, and passes `force`.
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

	// A preview standing over a real callout's row, registered transiently and
	// without a registry mutation (no save, no note re-render — see
	// setPreviewDefinition). The registry fires this only for a preview that is
	// not a demo; the callout editor's draft is a demo, which the lists never
	// show, so it does not reach here at all.
	//
	// Not forced: the signature is built from the same registry views the rows
	// are drawn from (`partitionCallouts`), and those show the preview in place
	// of the callout it stands over, so a preview that changes a row changes
	// the signature, and one that changes nothing on screen is skipped instead
	// of rebuilding every row.
	const onPreview = (): void => refresh(false);
	plugin.registry.onPreviewChange(onPreview);

	// Forced: artwork lives in a download cache keyed by icon name, so a
	// definition naming a not-yet-downloaded icon is byte-identical to the one
	// naming it a second later. Guarding this one would leave every row that
	// came up on a spinner spinning for good.
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
