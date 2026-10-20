/**
 * settings/sections/scanPlacement.ts — whether **Scan for callouts** fits on
 * the heading's line, or goes to the foot of the list.
 *
 * "My callout types" puts its title and two buttons on one line. While all
 * three fit there, they stay. When they do not — a phone, an iPad in portrait,
 * a narrow settings window, a long translation, larger text — Scan moves to
 * `.cs-discover-footer` at the bottom of the list and **Add new callout** keeps
 * the title's line. One rule on every device, so it is measured rather than
 * keyed to `.is-phone` or to a width: the width it needs is the width of three
 * translated, font-dependent boxes, and only the layout knows that.
 *
 * ## Measured with both buttons, every time
 *
 * The question is put to the heading as it would be *with* Scan, never as it
 * is. Once Scan has gone, the line has room to spare by construction, and an
 * answer read off that state would bring Scan straight back. So the heading
 * gets `cs-scan-measure`, which the hiding rule skips, is read, and loses it
 * again, all in one synchronous turn before anything paints. The class is on
 * the heading and nothing below it: the footer keeps its own state while the
 * heading is read, so the body never shrinks for a moment, and the pane's
 * scroller has nothing to clamp.
 *
 * "Fits" is the control landing on the title's flex line. The title is
 * `flex: 1 1 auto` (styles.css), so the heading wraps exactly when the full
 * title and both full buttons stop fitting side by side.
 *
 * ## Asked again when the answer can change
 *
 * - The pane's width, through the tab's title row ("Callout Studio"), whose box
 *   follows the pane and nothing this does. Observing the heading itself would
 *   loop: moving Scan changes its height, and an observer whose target resizes
 *   inside its own callback ends in "ResizeObserver loop completed with
 *   undelivered notifications". The title row also grows with the text size.
 * - The title's count, when "(9)" becomes "(10)" — `request`, from the painter.
 * - The language, which rebuilds the whole tab and this with it.
 *
 * The label turning into "Scanning…" is not one of them. Moving the button
 * the user just pressed is worse than a line that is a word short for the
 * length of a scan.
 */
import type { SettingsSectionContext } from "./types";

/** On the section: Scan is at the foot of the list, not on the heading. */
const BELOW = "cs-scan-below";
/** On the heading, for the length of one reading: lay it out with Scan. */
const MEASURING = "cs-scan-measure";

export function followScanPlacement(
	ctx: SettingsSectionContext,
	sectionEl: HTMLElement,
	headingEl: HTMLElement,
	paneProbeEl: HTMLElement,
): { request: () => void } {
	const infoEl = headingEl.querySelector<HTMLElement>(".setting-item-info");
	const controlEl = headingEl.querySelector<HTMLElement>(".setting-item-control");
	let active = true;
	let queued = false;

	const place = (): void => {
		if (!active || !infoEl || !controlEl) return;
		headingEl.addClass(MEASURING);
		const title = infoEl.getBoundingClientRect();
		const actions = controlEl.getBoundingClientRect();
		headingEl.removeClass(MEASURING);
		// Nothing laid out — a tab on its way out, a window not shown yet. The
		// last answer stands until there is a layout to ask.
		if (title.height === 0 || actions.height === 0) return;
		sectionEl.toggleClass(BELOW, actions.top >= title.bottom - 0.5);
	};

	// A microtask, not a call. The painter runs inside `display()` too, before
	// the sections under this one exist, and reading a layout there flushes a
	// page cut short — the pane's scroller clamps to it and the reader loses
	// their place. A microtask runs once that build has returned, and still
	// before the frame paints.
	const request = (): void => {
		if (queued) return;
		queued = true;
		queueMicrotask(() => {
			queued = false;
			place();
		});
	};

	const view = headingEl.ownerDocument.defaultView;
	const observer = view && typeof view.ResizeObserver === "function"
		? new view.ResizeObserver(place) : undefined;
	observer?.observe(paneProbeEl);
	ctx.registerDisposer(() => {
		active = false;
		observer?.disconnect();
	});
	request();
	return { request };
}
