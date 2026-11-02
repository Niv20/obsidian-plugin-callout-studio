/**
 * ui/noticeDuration.ts — how long a notice stays on screen, worked out from
 * its words.
 *
 * Who uses it. {@link showNotice} (ui/mascot/mascotNotices.ts) for every
 * notice whose caller names no duration, and {@link showActionNotice}
 * (ui/noticeAction.ts) for a notice with a button.
 *
 * The main idea. Obsidian shows every notice for four seconds, whatever it
 * says. That is too short for a long sentence, and the plugin used to answer it
 * with hand-picked 10, 12 and 15 second values that were far too long for a
 * short one. A notice now stays about as long as it takes to read: a moment to
 * notice it, plus a little for each word, and never less than Obsidian's four
 * seconds nor more than ten. A reader who needs longer can rest the pointer on
 * the notice, which Obsidian keeps up while the pointer is on it.
 *
 * Cheap on purpose. It splits one sentence once, when the notice is created;
 * nothing is measured or timed while the notice is up. The words are counted in
 * the sentence the user will read (already translated), so a language with
 * longer sentences gets longer notices without a table per language.
 *
 * A notice that can be overridden. Where the reading time is the wrong answer,
 * the caller passes its own number of milliseconds (0 keeps the notice up until
 * it is clicked). The only built-in exception is a notice with a button, which
 * has something to do besides read, see {@link ACTION_NOTICE_MS}.
 */

/** Never shorter than Obsidian's own default, so a short notice feels as it always did. */
export const MIN_NOTICE_MS = 4000;

/** Never longer than this, however long the sentence: the pointer can hold it open. */
export const MAX_NOTICE_MS = 10000;

/**
 * How long a notice with a button stays (Undo, Retry). The reader has to read,
 * decide, and reach for the button, so it does not follow the sentence's length.
 */
export const ACTION_NOTICE_MS = 10000;

/** The moment it takes to see that a notice appeared, before reading starts. */
const LEAD_MS = 1500;

/** About 200 words a minute, a comfortable speed for a sentence in a window corner. */
const MS_PER_WORD = 300;

/**
 * Japanese, Chinese and Thai put no spaces between words, so a whole sentence
 * would count as one word. An average "word" this long means the text is
 * written that way.
 */
const UNSPACED_WORD_CHARS = 12;

/** How many characters of unspaced text read like one word of spaced text. */
const UNSPACED_CHARS_PER_WORD = 2.5;

/** How many words the text holds, counting unspaced scripts by their characters. */
export function wordCount(text: string): number {
	const trimmed = text.trim();
	if (trimmed === "") return 0;
	const words = trimmed.split(/\s+/).length;
	return trimmed.length / words >= UNSPACED_WORD_CHARS ? trimmed.length / UNSPACED_CHARS_PER_WORD : words;
}

/** The milliseconds a notice saying `message` stays up, between {@link MIN_NOTICE_MS} and {@link MAX_NOTICE_MS}. */
export function noticeDuration(message: string): number {
	const reading = LEAD_MS + wordCount(message) * MS_PER_WORD;
	return Math.round(Math.min(MAX_NOTICE_MS, Math.max(MIN_NOTICE_MS, reading)));
}
