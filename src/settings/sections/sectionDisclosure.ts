/**
 * settings/sections/sectionDisclosure.ts — a heading you can fold away.
 *
 * The "Icon licences and credits" block has had a chevron and a fold since it
 * shipped, and it gets both for free: it is a native `<details>`/`<summary>`,
 * so the browser owns the state, the toggle and the accessibility mapping.
 *
 * The three callout lists cannot be. Their headings are Obsidian `Setting`
 * rows — "My callout types" carries the **Add new callout** CTA in its control
 * slot — and a `<summary>` wrapping a button is a button that folds the
 * section every time it is pressed. So this is the same affordance built by
 * hand: same `chevron-right`, same 120ms rotate (`.cs-disclosure-chevron`,
 * shared with credits), with the state, the keyboard and the aria mapping
 * written out because nothing else supplies them.
 *
 * Two consequences worth knowing before changing this file:
 *
 * **The control is the heading's name, not its row.** `nameEl` spans the
 * title line and excludes `.setting-item-control`, which is what keeps the CTA
 * pressable. It also keeps the accessible name to "My callout types (4)"
 * rather than the whole row including a paragraph of description.
 *
 * **`setName` is wrapped, not called directly.** Every list rewrites its
 * heading on every refresh to update the "(N)", and Obsidian's `setName`
 * replaces `nameEl`'s children — which is where the chevron lives. Attributes
 * survive that; child elements do not.
 *
 * The user-driven toggle is also wrapped in `foldAnchor.keepHeadingInPlace`, so
 * folding a heading that is currently pinned does not shoot it off the top of
 * the pane. It is a no-op for a heading that was not pinned, which is why it can
 * sit on the shared path rather than only on the three sticky ones.
 */
import { setIcon } from "obsidian";
import type { Setting } from "obsidian";
import { keepHeadingInPlace } from "./foldAnchor";

export type SectionDisclosure = {
	/** `setName`, then the chevron put back — see the note above. */
	setName: (text: string) => void;
	setExpanded: (expanded: boolean) => void;
	isExpanded: () => boolean;
};

/** Only ever read back through `aria-controls`; uniqueness is all it needs. */
let bodyIdSeq = 0;

export function attachSectionDisclosure(
	setting: Setting,
	bodyEl: HTMLElement,
	initiallyExpanded = true,
	/**
	 * Fired only when the user folds or unfolds the section by hand (click or
	 * keyboard) — not when a caller drives `setExpanded` programmatically —
	 * which is what lets a caller persist just the user's own choice.
	 */
	onToggle?: (expanded: boolean) => void,
): SectionDisclosure {
	const headingEl = setting.settingEl;
	const nameEl = setting.nameEl;
	let expanded = initiallyExpanded;

	headingEl.addClass("cs-collapsible-heading");
	bodyEl.addClass("cs-section-body");
	// Through the attribute rather than the `id` property, so the id is a real
	// attribute in the test DOM too and `aria-controls` can be checked against it.
	const bodyId =
		bodyEl.getAttribute("id") ?? `cs-section-body-${++bodyIdSeq}`;
	bodyEl.setAttribute("id", bodyId);

	nameEl.setAttribute("role", "button");
	nameEl.setAttribute("tabindex", "0");
	nameEl.setAttribute("aria-controls", bodyId);

	const paint = (): void => {
		nameEl.setAttribute("aria-expanded", String(expanded));
		headingEl.toggleClass("is-collapsed", !expanded);
		bodyEl.toggleClass("is-collapsed", !expanded);
	};

	const setExpanded = (next: boolean): void => {
		expanded = next;
		paint();
	};

	/**
	 * The chevron is decorative — `aria-expanded` above says the same thing.
	 *
	 * First child, and it costs the title nothing: `styles.css` pulls the whole
	 * name line start-ward by exactly this chevron's footprint, so the chevron
	 * lands in the space *beside* the title rather than pushing it along, and
	 * the heading text and its `(N)` stay on the x they had before there was
	 * anything to fold. Which is why the two live together — move the chevron
	 * out of `nameEl` and that offset becomes a hole.
	 */
	const mountChevron = (): void => {
		const chevron = createSpan({ cls: "cs-disclosure-chevron" });
		chevron.setAttribute("aria-hidden", "true");
		setIcon(chevron, "chevron-right");
		nameEl.insertBefore(chevron, nameEl.firstChild);
	};

	const toggle = (): void => {
		keepHeadingInPlace(headingEl, () => setExpanded(!expanded));
		onToggle?.(expanded);
	};

	nameEl.addEventListener("click", toggle);
	nameEl.addEventListener("keydown", (evt: KeyboardEvent) => {
		if (evt.key !== "Enter" && evt.key !== " ") return;
		// Space scrolls the settings pane otherwise, and Enter on a role=button
		// is expected to activate rather than do whatever the pane would.
		evt.preventDefault();
		toggle();
	});

	mountChevron();
	paint();

	return {
		setName: (text: string) => {
			setting.setName(text);
			mountChevron();
		},
		setExpanded,
		isExpanded: () => expanded,
	};
}
