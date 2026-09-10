/**
 * tests/modalAutofocus.test.ts — where the cursor lands when a window opens.
 *
 * Four separate promises, and each fails in a way the user reads as the plugin
 * being broken rather than as a preference:
 *
 * - **a create window takes the cursor — on the desktop.** "New callout" and
 *   "New color palette" both open on an empty name that has to be filled in
 *   before anything can be saved, so the first keystroke should be a letter,
 *   not a click on the name field.
 * - **a create window on a phone or tablet does not.** Deliberately inconsistent
 *   with the desktop: the soft keyboard shrinks the viewport out from under the
 *   form as it opens and the window jumps. See `modalAutofocus`, which also
 *   records the ~400ms scroll-hold workaround that used to paper over this and
 *   has since been removed — there are no tests for it here because there is no
 *   longer anything holding the body still.
 * - **an edit window does not, on any device.** The form is already filled in
 *   and the user came to change some other part of it. This is the half that was
 *   wrong once: the callout editor focused the name on every *custom* callout,
 *   edit included, because it asked `!isBuiltIn` — a question about whether the
 *   field is editable, not about whether the window is creating anything.
 * - **a search window takes the cursor everywhere.** Quick-insert and
 *   replace-callout exist to be typed into and have no edit mode to hold back
 *   for, so they keep the phone keyboard the create windows now decline.
 *
 * The focus itself is refused a scroll outright via `preventScroll` in both
 * cases — the one kind of focus scroll that can be turned off at the call.
 *
 * The create/edit gate is a one-line conditional inside a modal this suite has
 * no way to construct — the editors want a plugin, a registry, an app and an
 * embedded CodeMirror. So it is pinned as a source rule at the bottom instead,
 * against the same expression each window's *title* already asks.
 */
import assert from "node:assert";
import { describe, it } from "node:test";
import { Platform } from "obsidian";
import { installFakeDom } from "./support/fakeDom";
import {
	autofocusOnDesktop,
	autofocusOnOpen,
} from "../src/settings/modalAutofocus";
import { blankLiterals, readRepoFile, report } from "./support/sourceScan";

const fakeDom = installFakeDom();

/* -------------------------------------------------------------------------- */
/* A window, reduced to the one element the helper touches                     */
/* -------------------------------------------------------------------------- */

interface Harness {
	/** Stands in for the name or search field. */
	input: HTMLInputElement;
	/** What the last `focus()` was passed, or undefined if it took no options. */
	focusOptions(): { preventScroll?: boolean } | undefined;
	focusCount(): number;
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
		input: input as unknown as HTMLInputElement,
		focusOptions: () => probe.lastFocusOptions,
		focusCount: () => probe.focusCount,
	};
}

/**
 * Run `body` as though the vault were open on the given kind of device.
 *
 * `Platform.isMobile` is read at *call* time by the helper under test, not at
 * module scope, which is what lets both devices be exercised from one file —
 * unlike `Platform.isMacOS`, which needs the import-order seam in
 * `support/macPlatform.ts`.
 */
function onDevice(isMobile: boolean, body: () => void): void {
	const was = Platform.isMobile;
	Platform.isMobile = isMobile;
	try {
		body();
	} finally {
		Platform.isMobile = was;
	}
}

/* -------------------------------------------------------------------------- */
/* 100 — a search window: the cursor, on every device                          */
/* -------------------------------------------------------------------------- */

describe("the field a search window opens on", () => {
	it("takes the cursor when it is handed one", () => {
		const win = openWindow();
		autofocusOnOpen(win.input);
		assert.strictEqual(win.focusCount(), 1);
		assert.strictEqual(fakeDom.document.activeElement, win.input as unknown);
	});

	it("asks for the focus WITHOUT a scroll", () => {
		// A bare `focus()` here is the bug: the DOM scrolls the field into view
		// on its own, which is the half of the jump that CAN be refused.
		const win = openWindow();
		autofocusOnOpen(win.input);
		assert.deepStrictEqual(win.focusOptions(), { preventScroll: true });
	});

	it("still takes the cursor on a phone", () => {
		// The deliberate difference from a create window. These windows do
		// nothing at all until a query is typed, so the keyboard is the point.
		const win = openWindow();
		onDevice(true, () => autofocusOnOpen(win.input));
		assert.strictEqual(win.focusCount(), 1);
	});

	it("focuses nothing when handed no field — the edit case", () => {
		const win = openWindow();
		autofocusOnOpen(null);
		assert.strictEqual(win.focusCount(), 0);
		assert.strictEqual(fakeDom.document.activeElement, null);
	});

	it("treats an absent field the same as a null one", () => {
		// Call sites reach through an optional (`this.nameTextInput?.inputEl`),
		// so `undefined` arrives here as readily as `null`.
		const win = openWindow();
		autofocusOnOpen(undefined);
		assert.strictEqual(win.focusCount(), 0);
	});
});

/* -------------------------------------------------------------------------- */
/* 110 — a create window: the desktop only                                     */
/* -------------------------------------------------------------------------- */

describe("the name field a create window opens on", () => {
	it("takes the cursor on the desktop", () => {
		const win = openWindow();
		onDevice(false, () => autofocusOnDesktop(win.input));
		assert.strictEqual(win.focusCount(), 1);
		assert.strictEqual(fakeDom.document.activeElement, win.input as unknown);
	});

	it("asks for the focus WITHOUT a scroll, like every other window", () => {
		const win = openWindow();
		onDevice(false, () => autofocusOnDesktop(win.input));
		assert.deepStrictEqual(win.focusOptions(), { preventScroll: true });
	});

	it("takes nothing on a phone or tablet", () => {
		// `Platform.isMobile` covers both. The keyboard would shrink the
		// viewport out from under a form the user has not read yet.
		const win = openWindow();
		onDevice(true, () => autofocusOnDesktop(win.input));
		assert.strictEqual(
			win.focusCount(),
			0,
			"a create window grabbed the name field on a phone",
		);
		assert.strictEqual(fakeDom.document.activeElement, null);
	});

	it("focuses nothing when handed no field, on either device", () => {
		for (const isMobile of [false, true]) {
			const win = openWindow();
			onDevice(isMobile, () => {
				autofocusOnDesktop(null);
				autofocusOnDesktop(undefined);
			});
			assert.strictEqual(win.focusCount(), 0);
		}
	});
});

/* -------------------------------------------------------------------------- */
/* 120 — which window calls which, as a source rule                            */
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
 * The windows with no edit mode to hold back for — they exist to be typed into,
 * so they take the cursor on every device and go through the unconditional
 * entry point.
 */
const SEARCH_WINDOWS: string[] = [
	"src/settings/QuickInsertModal.ts",
	"src/utils/ReplaceCalloutModal.ts",
];

/** Every window that takes the cursor at all. */
const AUTOFOCUSED: string[] = [
	...CREATE_ONLY.map((w) => w.file),
	...SEARCH_WINDOWS,
];

/** How many times `code` calls `name(`, ignoring the import that names it. */
function callCount(code: string, name: string): number {
	return [...code.matchAll(new RegExp(`\\b${name}\\s*\\(`, "g"))].length;
}

describe("only a create window takes the cursor", () => {
	for (const { file, guard, newTitleKey } of CREATE_ONLY) {
		it(`${file} focuses its name field only behind \`${guard}\``, () => {
			const text = readRepoFile(file);
			const code = blankLiterals(text);
			const calls = [...code.matchAll(/\bautofocusOnDesktop\s*\(/g)];
			assert.strictEqual(
				calls.length,
				1,
				`expected exactly one autofocusOnDesktop call in ${file}`,
			);
			const before = code.slice(0, calls[0]?.index ?? 0);
			assert.ok(
				before.includes(guard),
				`${file} calls autofocusOnDesktop outside \`${guard}\` — an edit ` +
					`window would take the cursor too`,
			);
			// …and the call is still INSIDE that block. Any `}` in between would
			// have closed it (a nested block would have to close too), which is
			// how a guard silently stops covering the line it was written for.
			const after = before.slice(before.lastIndexOf(guard) + guard.length);
			assert.ok(
				!after.includes("}"),
				`${file} closes the \`${guard}\` block before it reaches ` +
					`autofocusOnDesktop, so the guard no longer covers it`,
			);
			// And the same expression still names the window.
			assert.ok(
				text.includes(newTitleKey),
				`${file} no longer uses ${newTitleKey}; re-check that the guard ` +
					`above still means "this window is creating something"`,
			);
		});
	}

	it("no create window reaches for the unconditional entry point", () => {
		// The regression this guards is a quiet one: `autofocusOnOpen` focuses
		// on every device, so swapping it back in here restores exactly the
		// phone behaviour that was removed — with nothing on screen to say so.
		const bad = CREATE_ONLY.map((w) => w.file).filter(
			(file) => callCount(blankLiterals(readRepoFile(file)), "autofocusOnOpen") > 0,
		);
		assert.deepStrictEqual(
			bad,
			[],
			report(
				"These create windows call autofocusOnOpen, which would grab the " +
					"name field on a phone again. Use autofocusOnDesktop:",
				bad,
			),
		);
	});

	for (const file of SEARCH_WINDOWS) {
		it(`${file} focuses its search field on every device`, () => {
			const code = blankLiterals(readRepoFile(file));
			assert.strictEqual(
				callCount(code, "autofocusOnOpen"),
				1,
				`expected exactly one autofocusOnOpen call in ${file}`,
			);
			assert.strictEqual(
				callCount(code, "autofocusOnDesktop"),
				0,
				`${file} exists to be typed into — it should not hold the cursor ` +
					`back on a phone`,
			);
		});
	}

	it("no window focuses a text field directly", () => {
		// The regression this replaces was a bare `text.inputEl.focus()` in the
		// callout editor. Any new one reintroduces every part of the rule at
		// once: no create/edit gate, no platform gate, and no `preventScroll`.
		//
		// The receivers are DERIVED, not guessed: every field each window
		// declares as an `HTMLInputElement`, plus `.inputEl` for the windows
		// that reach through a `TextComponent`. Naming them by hand is what let
		// the first draft of this rule miss `searchEl.focus()` — a field whose
		// name says nothing about being an input.
		//
		// It stays deliberately blind to `focus()` on anything else: all four
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
					"modalAutofocus so it refuses to scroll (and, on a window " +
					"that also creates, is gated on create and on the desktop):",
				bad,
			),
		);
	});

	it("the removed keyboard-settle hack has not crept back", () => {
		// The workaround this replaces held the scroller's scrollTop for ~400ms
		// after focusing, so the soft keyboard could not drag the window. It was
		// removed because it read as a delayed lurch rather than as no jump at
		// all. Anything timer-shaped here is that idea coming back.
		const code = blankLiterals(readRepoFile("src/settings/modalAutofocus.ts"));
		const relapses = ["setTimeout", "addEventListener", "scrollTop"].filter(
			(token) => code.includes(token),
		);
		assert.deepStrictEqual(
			relapses,
			[],
			report(
				"modalAutofocus is meant to be a focus call and a platform gate. " +
					"These are the removed scroll-hold workaround returning:",
				relapses,
			),
		);
	});
});
