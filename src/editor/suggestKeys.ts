/**
 * editor/suggestKeys.ts — extra keys that accept the highlighted suggestion.
 *
 * Obsidian's `EditorSuggest` accepts with Enter and nothing else. Its own link
 * suggest adds more, and this is the same arrangement, copied from it (verified
 * in the bundled `app.js`): a binding on the popover's `scope` that hands the
 * key event to the internal suggestion list's `useSelectedItem`, which calls
 * `selectSuggestion(item, evt)` with the highlighted row — so `evt.key` tells
 * `selectSuggestion` which key it was.
 *
 * `suggestions` is not in `obsidian.d.ts`. It has been the field behind every
 * suggest since before 1.0, but it is still somebody else's private field, so
 * it is read optionally: if it is ever missing the binding declines, the key
 * does what it would have done anyway, and the popover still takes Enter.
 */
import type { EditorSuggest, Modifier } from "obsidian";

/** The one method of Obsidian's internal suggestion list used here. */
interface SuggestionList {
	useSelectedItem(evt: KeyboardEvent): boolean;
}

/**
 * Make `key` accept the highlighted row, as Enter does. `modifiers` follows
 * `Scope.register`: `null` accepts the key under any modifiers, which is what a
 * character like `|` needs — it is Shift+\ on most layouts, Option+7 on a
 * German Mac and AltGr (reported as Ctrl+Alt) on a German PC.
 *
 * A character typed with Cmd, or with Ctrl but no Alt, is a hotkey rather than
 * typing, though, and passes through untouched.
 */
export function acceptOnKey<T>(
	suggest: EditorSuggest<T>,
	modifiers: Modifier[] | null,
	key: string,
): void {
	suggest.scope.register(modifiers, key, (evt: KeyboardEvent) => {
		// Mid-composition the key belongs to the input method, not to us.
		if (evt.isComposing) return true;
		if (key.length === 1 && (evt.metaKey || (evt.ctrlKey && !evt.altKey))) return true;
		const list = (suggest as unknown as { suggestions?: SuggestionList })
			.suggestions;
		// `false` consumes the key; anything else lets it do what it would have.
		return list?.useSelectedItem(evt) ? false : true;
	});
}

/** How a row was accepted, read off the event `selectSuggestion` receives. */
export type PickKey = "enter" | "tab" | "pipe";

export function pickKeyOf(evt: MouseEvent | KeyboardEvent): PickKey {
	if (!(evt instanceof KeyboardEvent)) return "enter";
	if (evt.key === "Tab") return "tab";
	if (evt.key === "|") return "pipe";
	return "enter";
}
