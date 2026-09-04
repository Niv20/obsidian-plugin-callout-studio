/**
 * tests/modalAutofocus.test.ts — where the cursor lands when a window opens,
 * and what the view does about it.
 *
 * Three separate promises, and each fails in a way the user reads as the plugin
 * being broken rather than as a preference:
 *
 * - **a create window takes the cursor.** "New callout" and "New color palette"
 *   both open on an empty name that has to be filled in before anything can be
 *   saved, so the first tap should be a letter, not the name field.
 * - **an edit window does not.** The form is already filled in and the user came
 *   to change some other part of it. This is the half that was wrong: the
 *   callout editor focused the name on every *custom* callout, edit included,
 *   because it asked `!isBuiltIn` — a question about whether the field is
 *   editable, not about whether the window is creating anything.
 * - **neither one scrolls.** The focus itself is refused a scroll outright via
 *   `preventScroll`, and the soft keyboard's scroll — which arrives later, from
 *   the WebView, and which `preventScroll` has no say over — is undone for as
 *   long as it takes the keyboard to finish opening.
 *
 * The hold is the part with a real failure mode of its own, so it is pinned from
 * both sides: it must put back a scroll that lands while the keyboard is
 * arriving, and it must get out of the way the moment the user touches the
 * window or the keyboard has settled. A hold that never lets go is a window
 * whose scrolling is dead for the first half-second, which is worse than the bug
 * it fixes.
 *
 * The gate itself (create vs. edit) is a one-line conditional inside a modal
 * this suite has no way to construct — the editors want a plugin, a registry, an
 * app and an embedded CodeMirror. So it is pinned as a source rule at the bottom
 * instead, against the same expression each window's *title* already asks.
 */
import assert from "node:assert";
import { describe, it } from "node:test";
import { installFakeDom } from "./support/fakeDom";
import { autofocusOnOpen } from "../src/settings/modalAutofocus";
import { blankLiterals, readRepoFile, report } from "./support/sourceScan";

const fakeDom = installFakeDom();

/* -------------------------------------------------------------------------- */
/* A window, reduced to the two elements the helper touches                    */
/* -------------------------------------------------------------------------- */

interface Harness {
	/** Stands in for `Modal.contentEl` — the window's one scroll container. */
	scroller: HTMLElement;
	/** Stands in for the name field. */
	input: HTMLInputElement;
	/** What the last `focus()` was passed, or undefined if it took no options. */
	focusOptions(): { preventScroll?: boolean } | undefined;
	focusCount(): number;
	/** The WebView scrolling the body out from under us, as the keyboard opens. */
	keyboardScrollsTo(top: number): void;
	/** A gesture on the window. */
	gesture(type: string): void;
}

function openWindow(): Harness {
	// One document serves every test in the file, so the previous window's
	// cursor is still in it — and "focused nothing" is an assertion about
	// `activeElement` being empty, which a leak would satisfy by accident.
	fakeDom.document.activeElement = null;
	const scroller = fakeDom.document.body.createDiv({ cls: "modal-content" });
	const input = scroller.createEl("input");
	// Cast once, here: the fake DOM is structurally a DOM but is not typed as
	// one, and every assertion below reads its recording fields back off it.
	const probe = input as unknown as {
		focusCount: number;
		lastFocusOptions: { preventScroll?: boolean } | undefined;
	};
	return {
		scroller: scroller as unknown as HTMLElement,
		input: input as unknown as HTMLInputElement,
		focusOptions: () => probe.lastFocusOptions,
		focusCount: () => probe.focusCount,
		keyboardScrollsTo(top: number): void {
			(scroller as unknown as { scrollTop: number }).scrollTop = top;
			scroller.dispatchEvent({ type: "scroll" });
		},
		gesture(type: string): void {
			scroller.dispatchEvent({ type });
		},
	};
}

/** Where the body has ended up. */
function scrollTop(win: Harness): number {
	return (win.scroller as unknown as { scrollTop: number }).scrollTop;
}

/* -------------------------------------------------------------------------- */
/* 100 — the focus itself                                                     */
/* -------------------------------------------------------------------------- */

describe("the field a window opens on", () => {
	it("takes the cursor when it is handed one", () => {
		const win = openWindow();
		autofocusOnOpen(win.scroller, win.input);
		assert.strictEqual(win.focusCount(), 1);
		assert.strictEqual(
			fakeDom.document.activeElement,
			win.input as unknown,
		);
	});

	it("asks for the focus WITHOUT a scroll", () => {
		// The whole of the desktop half of the fix, and half of the mobile one:
		// a bare `focus()` here is the bug.
		const win = openWindow();
		autofocusOnOpen(win.scroller, win.input);
		assert.deepStrictEqual(win.focusOptions(), { preventScroll: true });
	});

	it("focuses nothing when handed no field — the edit case", () => {
		const win = openWindow();
		const release = autofocusOnOpen(win.scroller, null);
		assert.strictEqual(win.focusCount(), 0);
		assert.strictEqual(fakeDom.document.activeElement, null);
		// Still a disposer, so `onClose()` need not care which case it was.
		assert.strictEqual(typeof release, "function");
		release();
	});

	it("treats an absent field the same as a null one", () => {
		// Call sites reach through an optional (`this.nameTextInput?.inputEl`),
		// so `undefined` arrives here as readily as `null`.
		const win = openWindow();
		autofocusOnOpen(win.scroller, undefined);
		assert.strictEqual(win.focusCount(), 0);
	});
});

/* -------------------------------------------------------------------------- */
/* 110 — the keyboard's scroll                                                */
/* -------------------------------------------------------------------------- */

describe("the body while the keyboard opens", () => {
	it("puts back a scroll that lands while the keyboard is arriving", () => {
		const win = openWindow();
		autofocusOnOpen(win.scroller, win.input);
		win.keyboardScrollsTo(240);
		assert.strictEqual(
			scrollTop(win),
			0,
			"the keyboard scrolled the window down and it was allowed to stand",
		);
	});

	it("holds the body where it was, not at zero", () => {
		// A window reopened onto a scrolled body must come back to *that* place.
		// Pinning 0 would look right in every test above and wrong in use.
		const win = openWindow();
		(win.scroller as unknown as { scrollTop: number }).scrollTop = 80;
		autofocusOnOpen(win.scroller, win.input);
		win.keyboardScrollsTo(300);
		assert.strictEqual(scrollTop(win), 80);
	});

	it("lets go once the keyboard has settled", () => {
		const win = openWindow();
		autofocusOnOpen(win.scroller, win.input);
		fakeDom.window.flushTimers();
		win.keyboardScrollsTo(240);
		assert.strictEqual(
			scrollTop(win),
			240,
			"the hold outlived the keyboard and the window stopped scrolling",
		);
	});

	for (const gesture of ["pointerdown", "touchstart", "wheel"]) {
		it(`lets go the moment the user ${gesture}s on the window`, () => {
			const win = openWindow();
			autofocusOnOpen(win.scroller, win.input);
			win.gesture(gesture);
			win.keyboardScrollsTo(240);
			assert.strictEqual(
				scrollTop(win),
				240,
				"the user took hold of the window and it would not scroll",
			);
		});
	}

	it("does not let go when the user types into the focused field", () => {
		// The expected next event after focusing, and not a request to scroll
		// away — the keyboard is still on its way up at this point.
		const win = openWindow();
		autofocusOnOpen(win.scroller, win.input);
		win.gesture("keydown");
		win.keyboardScrollsTo(240);
		assert.strictEqual(scrollTop(win), 0);
	});

	it("lets go when the window closes", () => {
		// Obsidian reuses `contentEl` across open/close, so a hold left running
		// would be sitting on the NEXT window's body.
		const win = openWindow();
		const release = autofocusOnOpen(win.scroller, win.input);
		release();
		win.keyboardScrollsTo(240);
		assert.strictEqual(scrollTop(win), 240);
	});

	it("survives being released twice", () => {
		// `onClose()` runs the disposer, and the timer may already have run it.
		const win = openWindow();
		const release = autofocusOnOpen(win.scroller, win.input);
		release();
		assert.doesNotThrow(release);
		fakeDom.window.flushTimers();
	});
});

/* -------------------------------------------------------------------------- */
/* 120 — the create-only gate, as a source rule                               */
/* -------------------------------------------------------------------------- */

/**
 * Each window that can both create and edit, with the expression that decides
 * which it is doing. The expression is quoted from the window's own `setTitle`
 * call, which is the point: the field is focused on exactly the windows that
 * call themselves "New …", and a future change that splits the two apart has to
 * do it here as well.
 */
const CREATE_ONLY: Array<{
	file: string;
	guard: string;
	newTitleKey: string;
}> = [
	{
		file: "src/settings/CalloutEditor.ts",
		guard: "if (!this.existingId) {",
		newTitleKey: "editor.newCallout",
	},
	{
		file: "src/settings/PaletteEditorModal.ts",
		guard: "if (!this.existing) {",
		newTitleKey: "palette.newTitle",
	},
];

/**
 * Every window that takes the cursor as it opens. The two above plus the
 * quick-insert window, which has no edit mode to hold back for — it exists to
 * be typed into — but owes the same debt to the second rule: its search field
 * must not drag the list up when a phone keyboard opens under it.
 */
const AUTOFOCUSED: string[] = [
	...CREATE_ONLY.map((w) => w.file),
	"src/settings/QuickInsertModal.ts",
];

describe("only a create window takes the cursor", () => {
	for (const { file, guard, newTitleKey } of CREATE_ONLY) {
		it(`${file} focuses its name field only behind \`${guard}\``, () => {
			const text = readRepoFile(file);
			const code = blankLiterals(text);
			const calls = [...code.matchAll(/\bautofocusOnOpen\s*\(/g)];
			assert.strictEqual(
				calls.length,
				1,
				`expected exactly one autofocusOnOpen call in ${file}`,
			);
			const before = code.slice(0, calls[0]?.index ?? 0);
			assert.ok(
				before.includes(guard),
				`${file} calls autofocusOnOpen outside \`${guard}\` — an edit ` +
					`window would take the cursor too`,
			);
			// …and the call is still INSIDE that block. Any `}` in between would
			// have closed it (a nested block would have to close too), which is
			// how a guard silently stops covering the line it was written for.
			const after = before.slice(before.lastIndexOf(guard) + guard.length);
			assert.ok(
				!after.includes("}"),
				`${file} closes the \`${guard}\` block before it reaches ` +
					`autofocusOnOpen, so the guard no longer covers it`,
			);
			// And the same expression still names the window.
			assert.ok(
				text.includes(newTitleKey),
				`${file} no longer uses ${newTitleKey}; re-check that the guard ` +
					`above still means "this window is creating something"`,
			);
		});
	}

	it("no window focuses a text field directly", () => {
		// The regression this replaces was a bare `text.inputEl.focus()` in the
		// callout editor. Any new one reintroduces both halves of the bug: no
		// create/edit gate, and no `preventScroll`.
		//
		// The receivers are DERIVED, not guessed: every field each window
		// declares as an `HTMLInputElement`, plus `.inputEl` for the windows
		// that reach through a `TextComponent`. Naming them by hand is what let
		// the first draft of this rule miss `searchEl.focus()` — a field whose
		// name says nothing about being an input.
		//
		// It stays deliberately blind to `focus()` on anything else: all three
		// windows legitimately focus a popup menu or the note's own editor,
		// none of which is a text field or raises a keyboard.
		const bad: string[] = [];
		for (const file of AUTOFOCUSED) {
			const code = blankLiterals(readRepoFile(file));
			const fields = [
				...code.matchAll(/\b(\w+)\s*:\s*HTMLInputElement\b/g),
			].map((m) => m[1] ?? "");
			const receivers = [...new Set([...fields, "inputEl"])];
			for (const name of receivers) {
				const direct = new RegExp(`\\.?\\b${name}\\s*\\??\\.focus\\s*\\(`, "g");
				for (const m of code.matchAll(direct)) {
					bad.push(`${file}: ${(m[0] ?? "").trim()}`);
				}
			}
		}
		assert.deepStrictEqual(
			bad,
			[],
			report(
				"These focus a text field directly. Route it through " +
					"autofocusOnOpen so it refuses to scroll (and, on a window " +
					"that also edits, is gated on create):",
				bad,
			),
		);
	});
});
