/**
 * settings/targetHighlighter.ts — take the reader to one row of the settings
 * page and show them which one.
 *
 * Smoothly scrolls the row to the middle of the page, waits until most of it
 * is on screen, then plays a short accent pulse that settles back to the row's
 * own paint. Two notices under the settings title point somewhere far below
 * them, and both use this so the journey feels the same: the first-install
 * import prompt (→ the Import row) and the saving banner's **Go to backups**
 * (→ Backup › Earlier setups).
 *
 * Keyboard focus goes to the row too, so a keyboard or screen-reader user
 * arrives where a sighted mouse user looks, rather than being left on a button
 * that has scrolled out of view. With reduced motion requested, the page jumps
 * instead of gliding; the pulse, which only fades a colour, stays.
 *
 * The row gets `cs-scroll-target` as soon as a highlighter exists for it; the
 * pulse is `cs-scroll-target-highlight` on top of that (see styles.css).
 */
import { prefersReducedMotion } from "../ui/flip";

export interface TargetHighlighter {
	/**
	 * Scroll to the row, focus it, then pulse it once it is in view. Safe to
	 * repeat. `fromKeyboard` shows the focus ring, as a key press would.
	 */
	run: (fromKeyboard?: boolean) => void;
	/** Stop waiting, cancel the pulse and remove its class. */
	dispose: () => void;
}

/** Chromium honours `focusVisible`; TypeScript's DOM types do not list it yet. */
type FocusWithVisibility = FocusOptions & { focusVisible?: boolean };

/** What can take focus inside a row, the way Obsidian's own settings look for it. */
const CONTROLS = "button, a[href], input, select, textarea, [tabindex]";

/**
 * Where keyboard focus lands. Obsidian 1.13 makes every settings row focusable
 * (`tabindex="-1"`) and moves between rows itself — the arrow keys go row to
 * row, Enter reaches the row's button — so the row is the place to arrive, and
 * a screen reader reads its name and description. Older Obsidian rows cannot
 * take focus; there the row's first usable control does instead.
 */
function focusTarget(row: HTMLElement): HTMLElement | null {
	if (row.hasAttribute("tabindex")) return row;
	const controls = row.querySelector(".setting-item-control") ?? row;
	return Array.from(controls.querySelectorAll<HTMLElement>(CONTROLS)).find((control) =>
		!control.hasAttribute("disabled") && control.getAttribute("tabindex") !== "-1") ?? null;
}

export function createTargetHighlighter(target: HTMLElement): TargetHighlighter {
	let observer: IntersectionObserver | null = null;
	let fallbackTimer: number | null = null;
	let classTimer: number | null = null;

	target.classList.add("cs-scroll-target");

	const stopWaiting = (): void => {
		observer?.disconnect();
		observer = null;
		if (fallbackTimer !== null) window.clearTimeout(fallbackTimer);
		fallbackTimer = null;
	};

	const highlight = (): void => {
		stopWaiting();
		target.classList.remove("cs-scroll-target-highlight");
		// Animate back to the row's real resting paint rather than to
		// `transparent`. Some themes give setting rows an opaque grey background;
		// ending on transparency and then removing the class made that grey appear
		// as a separate, abrupt final step.
		const restingStyle = window.getComputedStyle(target);
		target.style.setProperty(
			"--cs-scroll-target-rest-bg",
			restingStyle.backgroundColor,
		);
		target.style.setProperty(
			"--cs-scroll-target-rest-shadow",
			restingStyle.boxShadow,
		);
		// Restart the animation when the action is clicked more than once.
		void target.offsetWidth;
		target.classList.add("cs-scroll-target-highlight");
		if (classTimer !== null) window.clearTimeout(classTimer);
		classTimer = window.setTimeout(() => {
			target.classList.remove("cs-scroll-target-highlight");
			classTimer = null;
		}, 1600);
	};

	/**
	 * Before the scroll starts, and without scrolling itself (`preventScroll`),
	 * so the glide is not cut short and a screen reader announces the row at
	 * once. A row that is inert (Import, while saving is paused) cannot take
	 * focus, so it is left alone.
	 */
	const focus = (fromKeyboard: boolean): void => {
		const control = focusTarget(target);
		if (!control || control.closest("[inert]")) return;
		const options: FocusWithVisibility = { preventScroll: true, focusVisible: fromKeyboard };
		control.focus(options);
	};

	return {
		run: (fromKeyboard = false) => {
			stopWaiting();
			if (typeof IntersectionObserver !== "undefined") {
				observer = new IntersectionObserver((entries) => {
					if (entries.some((entry) => entry.isIntersecting && entry.intersectionRatio >= 0.8)) {
						highlight();
					}
				}, { threshold: [0.8] });
				observer.observe(target);
			}
			// Older Obsidian/Electron builds get a conservative fallback after the
			// smooth scroll has had time to settle.
			fallbackTimer = window.setTimeout(highlight, 1000);
			focus(fromKeyboard);
			target.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "center" });
		},
		dispose: () => {
			stopWaiting();
			if (classTimer !== null) window.clearTimeout(classTimer);
			classTimer = null;
			target.classList.remove("cs-scroll-target-highlight");
		},
	};
}
