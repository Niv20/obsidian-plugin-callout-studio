/**
 * settings/quickInsertMessages.ts — the quick-insert window's empty and
 * unavailable states.
 *
 * Split from `QuickInsertModal` on the same line `quickInsertRow` and
 * `quickInsertToolbar` are: the window owns the state and the decisions, and
 * this owns the wording that depends on state, which is the part most likely to
 * be edited on its own — and the part a test wants to read without constructing
 * a `Modal`.
 *
 * **Two tables over the same three problems**, because the two are said at
 * different moments and are doing different jobs. The *hint* sits in the window
 * from the moment it opens and states the situation. The *notice* answers a
 * press of Insert and names the way out of it — "then try again" is an
 * instruction, and there is nothing to try again before the button is pressed.
 *
 * `Record`s of {@link TargetEditorProblem} rather than a `switch` with a
 * default, so a fourth problem is a compile error here instead of silently
 * falling through to the message about opening a note. Read through `t()` at
 * call time, never cached: the locale can land after the window is built.
 */
import type { TargetEditorProblem } from "../editor/targetMarkdownEditor";
import { t } from "../i18n";
import type { CalloutSourceFilter } from "../utils/calloutSearch";

/** Stated in the window itself, from the moment it opens. */
const HINT_KEY: Record<TargetEditorProblem, string> = {
	"no-note": "quickInsert.noEditorHint",
	"reading-view": "quickInsert.readingViewHint",
	"no-cursor": "quickInsert.noCursorHint",
	"target-moved": "quickInsert.targetMovedHint",
};

/** Raised in answer to a press of Insert that had nowhere to go. */
const NOTICE_KEY: Record<TargetEditorProblem, string> = {
	"no-note": "quickInsert.noEditor",
	"reading-view": "quickInsert.readingView",
	"no-cursor": "quickInsert.noCursor",
	"target-moved": "quickInsert.targetMoved",
};

/** The standing line in the window: why nothing can be inserted right now. */
export function quickInsertHint(problem: TargetEditorProblem): string {
	return t(HINT_KEY[problem]);
}

/** The notice for a press of Insert: what to do about it. */
export function quickInsertNotice(problem: TargetEditorProblem): string {
	return t(NOTICE_KEY[problem]);
}

/**
 * What an empty list means. A non-blank query always wins: an empty category is
 * useful guidance, while a search inside any category is simply a failed match.
 */
export function quickInsertEmptyMessage(
	filter: CalloutSourceFilter,
	query: string,
	hasUserCallouts = false,
): string {
	if (query.trim() !== "") return t("quickInsert.noResults");
	if (filter === "builtin") return t("quickInsert.noBuiltInCallouts");
	if (filter === "theme") return t("quickInsert.noThemeCallouts");
	if (filter === "user") {
		return t(
			hasUserCallouts
				? "quickInsert.noAvailableUserCallouts"
				: "quickInsert.noUserCallouts",
		);
	}
	return t("quickInsert.noResults");
}
