/**
 * ui/textLines.ts — help text written one short sentence per line.
 *
 * Who calls it. Every description or explanation drawn from a translated
 * string that holds more than one line: settings rows, window texts, questions.
 *
 * The main idea. The plugin writes its help as short sentences, each on a line
 * of its own, and keeps them in one translated string separated by `\n`, so a
 * translator sees the whole text at once. HTML shows a `\n` in text as a
 * space, so each one becomes a `<br>` here.
 */

/** Append `text` to `parent`, every `\n` in it starting a new line. */
export function appendLines(parent: HTMLElement | DocumentFragment, text: string): void {
	text.split("\n").forEach((line, index) => {
		if (index > 0) parent.createEl("br");
		parent.appendText(line);
	});
}

/** `text` as a fragment, one line per `\n`: what a `Setting`'s description takes. */
export function linesFragment(text: string): DocumentFragment {
	return createFragment((fragment) => appendLines(fragment, text));
}
