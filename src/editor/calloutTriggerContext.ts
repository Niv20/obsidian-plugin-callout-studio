/**
 * editor/calloutTriggerContext.ts — which `[!…]` token the cursor is in, and
 * what role it is being typed in.
 *
 * Two suggests read the same token and must never disagree about it: the id
 * dropdown (`AutoComplete.ts`), which owns the cursor while it is still inside
 * the type, and the metadata dropdown (`CalloutMetadataSuggest.ts`), which owns
 * it once it passes the first `|`. One reader, so the role, the escape rules
 * and the code check are decided once.
 */
import type { Editor, EditorPosition } from "obsidian";
import type { CalloutRenderRole, PluginSettings } from "../types";
import { splitCalloutMetadata } from "../utils/calloutId";
import { isCalloutTokenInCode } from "./calloutCodeContext";

/** Heading hashes + whitespace and nothing else before the `[!` trigger. */
const HEADING_TRIGGER_PREFIX_REGEX = /^#{1,6}[ \t]+$/;

/** The token around the cursor, read off the live line. */
export interface CalloutTrigger {
	role: CalloutRenderRole;
	/** The whole line. */
	line: string;
	/** `ch` of the `[` that opens `[!`. */
	triggerCh: number;
	/** `ch` of the `]` that closes the token, or -1 while it is unclosed. */
	closeCh: number;
	/** The type as written — everything before the first `|`. */
	id: string;
	/** `ch` of the first `|`, or -1 when the token carries no metadata. */
	pipeCh: number;
	/** `ch` just past the type: where Tab parks the cursor in a bare token. */
	idEndCh: number;
	/** `ch` where the token body ends — the `]`, or the end of the line. */
	bodyEndCh: number;
}

/**
 * Read the token whose `[!` is the last one before the cursor, or null when
 * there is none or it cannot be a callout: an escaped `\[!`, a wikilink's
 * `[[!`, or a role the settings switched off. Says nothing about where in the
 * token the cursor is — each suggest draws its own line there.
 */
export function readCalloutTrigger(
	line: string,
	cursorCh: number,
	settings: Pick<PluginSettings, "headingCallouts" | "inlineCallouts">,
): CalloutTrigger | null {
	// Scan backward from the cursor: the `[!`'s place on the line decides the
	// render role being typed.
	const textBefore = line.slice(0, cursorCh);
	const triggerCh = textBefore.lastIndexOf("[!");
	if (triggerCh === -1) return null;

	// Never trigger for escaped tokens (`\[!`) or wikilinks (`[[!`).
	const charBefore = triggerCh > 0 ? textBefore[triggerCh - 1] : "";
	if (charBefore === "\\" || charBefore === "[") return null;

	const rawPrefix = textBefore.slice(0, triggerCh);
	const trimmedPrefix = rawPrefix.trimStart();
	const { headingCallouts, inlineCallouts } = settings;
	let role: CalloutRenderRole;
	if (/^>[\s>]*$/.test(trimmedPrefix)) {
		// "> [!", ">> [!", … — a native block callout header.
		role = "regular";
	} else if (HEADING_TRIGGER_PREFIX_REGEX.test(rawPrefix)) {
		// "## [!" — heading callout; no popup while the role is off.
		if (!headingCallouts.enabled) return null;
		role = "heading";
	} else if (trimmedPrefix === "") {
		// Bare "[!" at line start: an inline callout when the role is on;
		// otherwise keep the legacy block-callout behavior.
		role = inlineCallouts.enabled ? "inline" : "regular";
	} else {
		// Any other text before the token — inline callout mid-line.
		if (!inlineCallouts.enabled) return null;
		role = "inline";
	}

	// The full token body (from `[!` to the next `]`, or end of line),
	// independent of where the cursor sits within it.
	const bodyStart = triggerCh + 2;
	const close = line.indexOf("]", bodyStart);
	const bodyEndCh = close === -1 ? line.length : close;
	const parts = splitCalloutMetadata(line.slice(bodyStart, bodyEndCh));
	return {
		role,
		line,
		triggerCh,
		closeCh: close,
		id: parts.id,
		pipeCh: parts.hasMetadata ? bodyStart + parts.id.length : -1,
		idEndCh: bodyStart + parts.id.length,
		bodyEndCh,
	};
}

/**
 * True when the token is code — a `[!` in a code span or fence is code, as
 * every other reader of this syntax has it. Kept apart from the reader because
 * it is the only check that looks past the line, so a suggest asks it last,
 * once the cursor is known to sit where that suggest cares.
 */
export function triggerInCode(
	editor: Editor,
	cursor: EditorPosition,
	trigger: CalloutTrigger,
): boolean {
	return isCalloutTokenInCode({
		line: trigger.line,
		tokenIndex: trigger.triggerCh,
		lineIndex: cursor.line,
		lineCount: editor.lineCount(),
		lineAt: (index) => editor.getLine(index),
	});
}
