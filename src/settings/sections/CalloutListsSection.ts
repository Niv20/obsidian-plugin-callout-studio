/**
 * settings/sections/CalloutListsSection.ts — Renders the three callout lists.
 *
 * Creates a controller object with render() and refresh() methods used by
 * SettingsTab to display, in order: the callouts the active theme styles, the
 * user's own callouts, and Obsidian's built-ins. Each row is rendered via
 * CalloutRowRenderer; row-level actions are handled by CalloutRowActions.
 *
 * ## The three groups answer one question: who paints this?
 *
 * Grouping used to be by *origin* — where a callout came from — which meant a
 * row also had to carry a `Theme` / `Studio` pill to say who was painting it.
 * Two facts on one row, and the second one only existed because the first was
 * answering the wrong question.
 *
 * Now the group *is* the answer (see `rowOwnership.isThemeStyled`), so no row
 * is labelled. Nothing moves a row between the lists but the theme itself:
 * switch to one that names an id and that row rises into the theme's section,
 * switch away and it drops back. Every row appears exactly once because the
 * split is one pass over one combined list, not three filters that have to
 * agree with each other.
 *
 * Both lists that can empty say so in words rather than vanishing silently,
 * and the built-in one has to: with a callout-styling theme and a fresh
 * install, every built-in starts out the theme's, and an unexplained empty
 * heading reads as a bug.
 *
 * ## Three sections, three folds, three cursors
 *
 * Each heading folds its own list (`sectionDisclosure`) and each list pages
 * its own overflow (`listPaging`). Both are per-section, which is what makes
 * them independent, and both have to survive a repaint: `refresh` rebuilds
 * every row on a registry change or a theme switch, and a list the user had
 * expanded must not quietly fold back up under them.
 *
 * The fold is written through to `settings.calloutListsExpanded`
 * (`calloutListsFold.ts`) on every user-driven toggle, so it survives a
 * settings-tab reopen or a plugin reload — each section starts from whatever
 * the user last left it, not from expanded.
 *
 * The paging cursor is deliberately not persisted: it is session-only, reset
 * by that same reopen. But it is *held by `SettingsTab`* rather than by this
 * closure, and the distinction is the bug it was: a controller lives one
 * `display()`, and `display()` re-runs for things nobody asked for — another
 * device's settings file arriving, a locale download — so a cursor kept in
 * here folded an expanded list back to 20 rows mid-scroll. A reopen still
 * resets it, because `hide()` is what clears it now. See `freshPaging`.
 *
 * The count in a heading is always the *partitioned* length, never the visible
 * slice — folding a section or leaving 20 of 34 rows on screen changes what is
 * drawn, not how many the user has.
 */
import { getLocale, t } from "../../i18n";
import { sortCalloutsByDisplayName } from "../../utils/sorting";
import { activeThemeName } from "../../manager/theme/customCssApi";
import { partitionByStyleOwner, styleOwnerFacts } from "./rowOwnership";
import type { RowKind } from "./rowOwnership";
import { ensureThemeRowUsage } from "./themeRowUsage";
import {
	focusFirstRevealed,
	headingWithCount,
	renderPagedList,
} from "./listPaging";
import type { PagingState } from "./listPaging";
import { calloutListsSignature } from "./calloutListsSignature";
import {
	buildCalloutListsScaffold,
	type CalloutListsScaffold,
} from "./calloutListsScaffold";
import type { CalloutDefinition } from "../../types";
import type { SettingsSectionContext } from "./types";

export type CalloutListsController = {
	render: (containerEl: HTMLElement) => void;
	/**
	 * Redraw the three lists — unless nothing they draw has moved.
	 *
	 * `force` is for the two signals whose effect the signature structurally
	 * cannot see; see `renderSignature` for which, and why.
	 */
	refresh: (force?: boolean) => void;
};

type CreateCalloutListsControllerOptions = {
	onAddNewCallout: () => Promise<void>;
	/**
	 * One cursor per section, owned by the caller rather than by this closure.
	 *
	 * It used to live in here, which quietly tied "how far the user has paged
	 * into a list" to the lifetime of a *controller* — and a controller is
	 * rebuilt by every `display()`, including the ones nobody asked for (another
	 * device's `data.json` landing, a locale download). A reader who pressed
	 * **Load more** and kept scrolling had the list fold back to 20 rows
	 * underneath them. The lifetime it should have been tied to all along is the
	 * *visit*, which is `SettingsTab`'s to hold and to clear in `hide()`.
	 */
	paging: Record<RowKind, PagingState>;
	renderRow: (
		containerEl: HTMLElement,
		def: CalloutDefinition,
		kind: RowKind,
	) => void;
};

export function createCalloutListsController(
	ctx: SettingsSectionContext,
	options: CreateCalloutListsControllerOptions,
): CalloutListsController {
	/** Null until `render` has built them — see `calloutListsScaffold`. */
	let els: CalloutListsScaffold | null = null;

	/** One cursor per section — see `CreateCalloutListsControllerOptions`. */
	const paging = options.paging;

	/** What the last completed render drew. `null` until there has been one. */
	let lastSignature: string | null = null;

	const themeLabel = (): string =>
		activeThemeName(ctx.app) ?? t("settings.themeCalloutsDefaultTheme");

	/** See `isThemeStyled` for why membership is derived from the theme alone. */
	const partition = () =>
		partitionByStyleOwner(styleOwnerFacts(ctx), [
			...ctx.plugin.registry.getThemeProvided(),
			...ctx.plugin.registry.getUserDefined(),
			...ctx.plugin.registry.getBuiltIn(),
		]);

	const renderList = (
		host: HTMLElement,
		defs: CalloutDefinition[],
		kind: RowKind,
	): void => {
		renderPagedList(
			host,
			sortCalloutsByDisplayName(defs, getLocale()),
			paging[kind],
			(listEl, def) => options.renderRow(listEl, def, kind),
			() => {
				renderAll();
				focusFirstRevealed(host);
			},
		);
	};

	const emptyState = (host: HTMLElement, text: string): void => {
		host.createDiv({ cls: "callout-studio-empty-state", text });
	};

	const renderThemeList = (fromTheme: CalloutDefinition[]): void => {
		if (!els) return;
		const { themeSectionEl, themeDescEl, themeFold, themeListEl } = els;
		// The heading names the *active* theme, so it is re-read on every render
		// rather than once when the section is built. `renderAll` is the refresh
		// path — it is what the tab's `css-change` listener reaches — and without
		// this the heading went on naming the outgoing theme while the rows under
		// it already showed the incoming one. The built-in list's empty state
		// below does re-read it, so the two contradicted each other on one screen.
		themeDescEl.setText(
			t("settings.themeCalloutsDesc", { theme: themeLabel() }),
		);
		themeFold.setName(
			headingWithCount(t("settings.themeCalloutsHeading"), fromTheme.length),
		);
		themeListEl.empty();
		// The whole section disappears with the last row rather than showing an
		// empty state: most themes style no callouts at all, and a permanent
		// "your theme styles none" heading would be noise in every one of those
		// vaults.
		// One toggle, on the section wrapper: it holds the heading and the rows,
		// so hiding it hides both, and neither has to carry `cs-hidden` beside
		// the `is-collapsed` the fold puts there.
		const has = fromTheme.length > 0;
		themeSectionEl.toggleClass("cs-hidden", !has);
		// The divider above "My callout types" only earns its keep when the
		// theme section above it is actually on screen — otherwise it would be
		// the first thing under the plugin title, with nothing to separate it from.
		els.subSectionEl.toggleClass("cs-section-divider", has);
		if (!has) return;
		renderList(themeListEl, fromTheme, "theme");
	};

	const renderUserList = (own: CalloutDefinition[]): void => {
		if (!els) return;
		const { userFold, userListEl } = els;
		userFold.setName(
			headingWithCount(t("settings.myCalloutTypes"), own.length),
		);
		userListEl.empty();
		if (own.length === 0) {
			emptyState(userListEl, t("settings.noCalloutsNow"));
			return;
		}
		renderList(userListEl, own, "user");
	};

	const renderBuiltInList = (builtIn: CalloutDefinition[]): void => {
		if (!els) return;
		const { builtInFold, builtInListEl } = els;
		builtInFold.setName(
			headingWithCount(t("settings.builtInCallouts"), builtIn.length),
		);
		builtInListEl.empty();
		if (builtIn.length === 0) {
			emptyState(
				builtInListEl,
				t("settings.builtInAllThemeStyled", { theme: themeLabel() }),
			);
			return;
		}
		renderList(builtInListEl, builtIn, "builtin");
	};

	const renderAll = (force = false): void => {
		const { fromTheme, own, builtIn } = partition();

		// Nothing that would be drawn has moved, so drawing it again would only
		// cost the reader their place. `force` is the escape for the two signals
		// this cannot see — see `calloutListsSignature`.
		const signature = calloutListsSignature(
			ctx,
			paging,
			themeLabel(),
			getLocale(),
			{ theme: fromTheme, user: own, builtin: builtIn },
		);
		if (!force && signature === lastSignature) return;
		lastSignature = signature;

		renderThemeList(fromTheme);
		renderUserList(own);
		renderBuiltInList(builtIn);
		// Warmed here rather than when a menu opens, because a menu cannot wait
		// on a whole-vault read: `openThemeRowMenu` reads the answer
		// synchronously and offers Replace and Clear uses only once it has one.
		// Nothing on a row shows the count any more, so nothing is repainted when
		// it lands — the callback is what used to cause a visible reflow a second
		// after the tab opened. One pass per visit; `SettingsTab.hide()` drops it.
		ensureThemeRowUsage(
			ctx.app,
			fromTheme.flatMap((def) =>
				ctx.plugin.registry.vaultIdFormsFor(def),
			),
			() => {},
		);
	};

	return {
		render: (containerEl: HTMLElement) => {
			els = buildCalloutListsScaffold(
				ctx,
				containerEl,
				options.onAddNewCallout,
			);
			renderAll();
		},
		refresh: renderAll,
	};
}
