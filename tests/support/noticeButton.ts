/**
 * tests/support/noticeButton.ts — reach the action button of a notice built by
 * ui/noticeAction.ts: Obsidian's `div.notice-button-container > div.notice-cta`
 * in the notice's `containerEl`, after its message.
 */
import assert from "node:assert/strict";
import type { Notice } from "./obsidianStub";
import type { FakeElement } from "./fakeDom";

/** The notice's action button; fails the test when it has none. */
export function noticeButton(notice: Notice | null): FakeElement {
	assert.ok(notice, "no notice was shown");
	const button = (notice.containerEl as unknown as FakeElement).querySelector(".notice-cta");
	assert.ok(button, "the notice offers no action");
	return button;
}
