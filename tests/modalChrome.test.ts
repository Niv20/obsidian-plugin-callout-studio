/**
 * tests/modalChrome.test.ts — the one shell every Callout Studio window wears:
 * Obsidian's own shell for long dialogs (`mod-scrollable-content` and a
 * `modal-button-container` bar).
 *
 * Obsidian hands a plugin a few boxes and no opinion about what to do with
 * them, so each window here had grown its own answer until `applyModalChrome`
 * became the only way to dress one. Two halves are worth pinning, and they fail
 * differently.
 *
 * **The behaviour.** `modalEl` and `containerEl` are reused across open/close,
 * so every class this hangs has to be idempotent and every class it hangs
 * *conditionally* has to come back off: a window reopened over nothing that
 * kept `cs-modal-stacked` is a layout bug with no error attached to it. The
 * button bar is the sharper case — it is a sibling of `.modal-content`, so it
 * survives the `contentEl.empty()` every `onOpen` starts with, and a reopened
 * window would grow a second button bar per open if it were not detached
 * first.
 *
 * **The invariant.** Every `Modal` in the project must wear the chrome and must
 * name itself. There is deliberately no opt-out, because the option that used
 * to hide the header band is exactly what let two unlabelled windows ship
 * unnoticed. A source scan is the only way to state that as a rule rather than
 * as a habit — a per-modal test would only cover the modals somebody
 * remembered to write one for, which is the same failure again.
 *
 * The band geometry is CSS, not JavaScript: this module only hangs classes. The
 * few rules the classes exist to trigger are checked against `styles.css` at
 * the bottom, alongside the surface-colour invariant in `modalSurfaces.test.ts`.
 */
import { fakeDom, type FakeElement } from "./support/fakeDom";
import assert from "node:assert";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import type { Modal } from "obsidian";
import { TestKeymap, TestScope } from "./support/fakeKeymap";
import {
	addCancelButton,
	applyModalChrome,
	removeModalChrome,
	scrollBodyOnly,
} from "../src/settings/modalChrome";

/**
 * A window as Obsidian builds it: `containerEl.modal-container > modalEl.modal`,
 * both attached, because `applyModalChrome` counts `.modal-container` elements
 * in the document to decide whether it is stacked.
 */
function fakeModal(): {
	modal: Modal;
	modalEl: FakeElement;
	containerEl: FakeElement;
	contentEl: FakeElement;
} {
	const containerEl = fakeDom.document.body.createDiv({
		cls: "modal-container",
	});
	const modalEl = containerEl.createDiv({ cls: "modal" });
	modalEl.createDiv({ cls: "modal-close-button" });
	modalEl.createDiv({ cls: "modal-header" }).createDiv({ cls: "modal-title" });
	const contentEl = modalEl.createDiv({ cls: "modal-content" });
	return {
		modal: { modalEl, containerEl, contentEl, scope: new TestScope(), app: { keymap: new TestKeymap() } } as unknown as Modal,
		modalEl,
		containerEl,
		contentEl,
	};
}

/**
 * Clear the screen, then build one window on it.
 *
 * The stacked-window mark is counted off every `.modal-container` in the
 * document, so a case that opened a second window would otherwise leak that
 * count into the next one. Every case starts here and calls the plain
 * {@link fakeModal} for any further layer it wants — which is what lets this
 * suite go without setup hooks, like the rest of `tests/`.
 */
function freshModal(): ReturnType<typeof fakeModal> {
	clearScreen();
	return fakeModal();
}

function clearScreen(): void {
	fakeDom.document.body.empty();
}

/** The window's own button bars (direct children of `.modal`). */
const footersIn = (modalEl: FakeElement): FakeElement[] =>
	modalEl.findAll(":scope > .modal-button-container");

/* -------------------------------------------------------------------------- */
/* 129 — applyModalChrome                                                     */
/* -------------------------------------------------------------------------- */

describe("applyModalChrome — the classes it hangs", () => {
	it("marks the window and its backdrop", () => {
		const { modal, modalEl, containerEl } = freshModal();
		applyModalChrome(modal);
		assert.ok(modalEl.hasClass("cs-modal"));
		assert.ok(containerEl.hasClass("cs-modal-container"));
	});

	it("keeps Obsidian's own classes rather than replacing them", () => {
		const { modal, modalEl, containerEl } = freshModal();
		applyModalChrome(modal);
		assert.ok(modalEl.hasClass("modal"));
		assert.ok(containerEl.hasClass("modal-container"));
	});

	it("asks for Obsidian's long-dialog shell", () => {
		// `mod-scrollable-content` is Obsidian's class: its stylesheet makes the
		// body the one scroller and pins the button bar under it (the line it
		// draws over the bar is taken off again in styles.css).
		const { modal, modalEl } = freshModal();
		applyModalChrome(modal);
		assert.ok(modalEl.hasClass("mod-scrollable-content"));
	});

	it("hangs the same classes however often a reopened window is dressed", () => {
		// `modalEl` is reused across open/close, so this is a real sequence: the
		// same element, dressed twice.
		const { modal, modalEl } = freshModal();
		applyModalChrome(modal, { footer: true });
		applyModalChrome(modal);
		assert.ok(modalEl.hasClass("cs-modal"));
		assert.ok(modalEl.hasClass("mod-scrollable-content"));
	});
});

describe("scrollBodyOnly — the long yes/no question", () => {
	it("asks for the long-dialog shell and the mark that drops the line over its bar", () => {
		const { modal, modalEl } = freshModal();
		scrollBodyOnly(modal);
		assert.ok(modalEl.hasClass("mod-scrollable-content"));
		assert.ok(modalEl.hasClass("cs-scroll-body"));
		assert.ok(!modalEl.hasClass("cs-modal"), "the full shell's surfaces are not wanted here");
	});
});

describe("applyModalChrome — the footer", () => {
	it("returns null and builds nothing for a window with no actions", () => {
		const { modal, modalEl } = freshModal();
		assert.strictEqual(applyModalChrome(modal), null);
		assert.deepStrictEqual(footersIn(modalEl), []);
	});

	it("returns the bar it built, as a child of the window", () => {
		// A sibling of `.modal-content`, NOT inside it — that is what pins it
		// while the body scrolls.
		const { modal, modalEl, contentEl } = freshModal();
		const footer = applyModalChrome(modal, { footer: true });
		assert.ok(footer.hasClass("modal-button-container"), "Obsidian's own button bar");
		assert.strictEqual(footer.parentElement, modalEl);
		assert.strictEqual(contentEl.children.length, 0);
	});

	it("puts the bar after the body, so it lands at the bottom", () => {
		const { modal, modalEl } = freshModal();
		const footer = applyModalChrome(modal, { footer: true });
		assert.strictEqual(modalEl.children.at(-1), footer);
	});

	it("clears the old bar instead of growing a second one", () => {
		// The bar survives the `contentEl.empty()` every `onOpen` starts with,
		// so without this a reopened window gains a button row per open.
		const { modal, modalEl } = freshModal();
		const first = applyModalChrome(modal, { footer: true });
		first.createEl("button", { text: "Save" });
		const second = applyModalChrome(modal, { footer: true });

		assert.deepStrictEqual(footersIn(modalEl), [second]);
		assert.notStrictEqual(second, first);
		assert.strictEqual(second.children.length, 0);
	});

	it("clears the old bar even when the window is reopened without one", () => {
		const { modal, modalEl } = freshModal();
		applyModalChrome(modal, { footer: true });
		assert.strictEqual(applyModalChrome(modal), null);
		assert.deepStrictEqual(footersIn(modalEl), []);
	});

	it("leaves a nested bar alone — only its own child is its own", () => {
		// `:scope >` in the detach selector: a window that renders something
		// carrying the class deeper in its body must not have it torn out.
		const { modal, modalEl, contentEl } = freshModal();
		const nested = contentEl.createDiv({ cls: "modal-button-container" });
		applyModalChrome(modal, { footer: true });
		assert.strictEqual(nested.parentElement, contentEl);
		assert.strictEqual(footersIn(modalEl).length, 1);
	});
});

describe("applyModalChrome — the stacked-window mark", () => {
	it("is absent for the only window on screen", () => {
		const { modal, containerEl } = freshModal();
		applyModalChrome(modal);
		assert.strictEqual(containerEl.hasClass("cs-modal-stacked"), false);
	});

	it("is present when a window is already open underneath", () => {
		// The count is trustworthy at this point: `Modal.open()` appends
		// `containerEl` BEFORE calling `onOpen()`, so this window is already in
		// the tally and `> 1` means one was open under it.
		freshModal();
		const { modal, containerEl } = fakeModal();
		applyModalChrome(modal);
		assert.ok(containerEl.hasClass("cs-modal-stacked"));
	});

	it("comes back off when that window is reopened over nothing", () => {
		const under = freshModal();
		const { modal, containerEl } = fakeModal();
		applyModalChrome(modal);
		under.containerEl.detach();
		applyModalChrome(modal);
		assert.strictEqual(containerEl.hasClass("cs-modal-stacked"), false);
	});

	it("counts every `.modal-container`, not only the chromed ones", () => {
		// A core Obsidian window underneath is just as much a layer to dim.
		clearScreen();
		fakeDom.document.body.createDiv({ cls: "modal-container" });
		const { modal, containerEl } = fakeModal();
		applyModalChrome(modal);
		assert.ok(containerEl.hasClass("cs-modal-stacked"));
	});
});

describe("addCancelButton", () => {
	it("makes a Cancel that Obsidian's bar knows as Cancel", () => {
		// `mod-cancel` is what sends Cancel under the main action when the bar
		// stacks on a phone or tablet (Obsidian's own `setCancel` adds it).
		const { modal } = freshModal();
		const bar = applyModalChrome(modal, { footer: true });
		let pressed = 0;
		const cancel = addCancelButton(bar, "Cancel", () => pressed++);
		assert.ok(cancel.hasClass("mod-cancel"));
		assert.strictEqual(cancel.textContent, "Cancel");
		assert.strictEqual(cancel.parentElement, bar);
		(cancel as unknown as FakeElement).fire("click");
		assert.strictEqual(pressed, 1);
	});
});

describe("removeModalChrome", () => {
	it("undoes every class and takes the footer with it", () => {
		const { modal, modalEl, containerEl } = freshModal();
		fakeModal(); // a second window, so the stacked mark is really set
		applyModalChrome(modal, { footer: true });
		removeModalChrome(modal);

		for (const cls of ["cs-modal", "mod-scrollable-content"]) {
			assert.strictEqual(modalEl.hasClass(cls), false, cls);
		}
		for (const cls of ["cs-modal-container", "cs-modal-stacked"]) {
			assert.strictEqual(containerEl.hasClass(cls), false, cls);
		}
		assert.deepStrictEqual(footersIn(modalEl), []);
	});

	it("leaves Obsidian's own classes alone", () => {
		const { modal, modalEl, containerEl } = freshModal();
		applyModalChrome(modal, { footer: true });
		removeModalChrome(modal);
		assert.ok(modalEl.hasClass("modal"));
		assert.ok(containerEl.hasClass("modal-container"));
	});

	it("is safe on a window that was never dressed", () => {
		const { modal, modalEl } = freshModal();
		removeModalChrome(modal);
		assert.strictEqual(modalEl.hasClass("cs-modal"), false);
	});
});

/* -------------------------------------------------------------------------- */
/* 130 — every modal wears it, and every modal names itself                   */
/* -------------------------------------------------------------------------- */

const SRC = join(process.cwd(), "src");

function tsFilesUnder(dir: string): string[] {
	const out: string[] = [];
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		const path = join(dir, entry.name);
		if (entry.isDirectory()) out.push(...tsFilesUnder(path));
		else if (entry.name.endsWith(".ts")) out.push(path);
	}
	return out;
}

/** Every source file declaring a window, with its text. */
const modalFiles = tsFilesUnder(SRC)
	.map((path) => ({
		path,
		name: path.slice(SRC.length + 1),
		text: readFileSync(path, "utf8"),
	}))
	.filter((f) => /\bclass\s+\w+\s+extends\s+Modal\b/.test(f.text));

/**
 * The one window that opts out, and the only one allowed to. It is a splash: it
 * removes the title band outright and carries its name as a hero heading in its
 * own left column instead.
 */
const SPLASH = "settings/WelcomeModal.ts";

describe("every Modal in the project wears the chrome", () => {
	it("found the modals at all", () => {
		// Guards the scan itself: a broken pattern would make every assertion
		// below vacuously true.
		assert.ok(
			modalFiles.length >= 15,
			`only ${modalFiles.length} modal files found — has the scan drifted?`,
		);
		assert.ok(modalFiles.some((f) => f.name === SPLASH));
	});

	for (const file of modalFiles) {
		if (file.name === SPLASH) continue;

		it(`${file.name} calls applyModalChrome`, () => {
			assert.match(file.text, /\bapplyModalChrome\s*\(/);
		});

		it(`${file.name} gives the window a title`, () => {
			// Either spelling reaches the same band. Skipping it leaves
			// Obsidian's empty `.modal-title` behind — a padded band over
			// nothing — so the omission is visible the first time it opens.
			assert.match(file.text, /\.setTitle\(|titleEl\.setText\(/);
		});
	}

	it(`${SPLASH} opts out deliberately, and says so`, () => {
		// Pinned from the other side: were the splash to start wearing the
		// chrome, this rule would silently become one nothing exercises.
		const splash = modalFiles.find((f) => f.name === SPLASH);
		assert.ok(splash);
		assert.doesNotMatch(splash.text, /\bapplyModalChrome\b/);
		assert.match(splash.text, /titleEl\.remove\(\)/);
	});
});

describe("the chrome is the ONLY way to hang it", () => {
	// Each of these classes is a contract with `styles.css`; a window that hung
	// one itself would be re-implementing the shell, which is the state this
	// module exists to have ended.
	for (const cls of [
		"cs-modal",
		"mod-scrollable-content",
		"modal-button-container",
		"mod-cancel",
		"cs-modal-container",
		"cs-modal-stacked",
	]) {
		it(`only modalChrome.ts writes "${cls}"`, () => {
			const others = tsFilesUnder(SRC)
				.filter((p) => !p.endsWith(join("settings", "modalChrome.ts")))
				.filter((p) => readFileSync(p, "utf8").includes(`"${cls}"`))
				.map((p) => p.slice(SRC.length + 1));
			assert.deepStrictEqual(others, []);
		});
	}
});

describe("every Cancel goes through addCancelButton", () => {
	// A Cancel made by hand would miss `mod-cancel`, and on a phone it would
	// then stack above the main action instead of under it.
	it("no source file builds a Cancel button itself", () => {
		const handMade = tsFilesUnder(SRC)
			.filter((p) => !p.endsWith(join("settings", "modalChrome.ts")))
			.filter((p) => /createEl\(\s*"button"\s*,\s*\{[^}]*text:[^}]*[cC]ancel/.test(readFileSync(p, "utf8")))
			.map((p) => p.slice(SRC.length + 1));
		assert.deepStrictEqual(handMade, []);
	});
});

describe("ConfirmModal's title is compiler-enforced", () => {
	// The window is generic — only the caller knows what is being confirmed — so
	// a default heading would be vague on every one of them, and an optional one
	// would quietly let the next caller ship a headerless dialog. A required
	// parameter is what keeps the invariant above true going forward, and it is
	// the reason the rule needs no runtime check on this window.
	const text = readFileSync(join(SRC, "utils", "ConfirmModal.ts"), "utf8");
	const ctor = /constructor\(([\s\S]*?)\)\s*\{/.exec(text)?.[1] ?? "";

	it("takes a title in the constructor", () => {
		assert.match(ctor, /\btitle:\s*string\b/);
	});

	it("does not let it be omitted", () => {
		assert.doesNotMatch(ctor, /\btitle\?/);
		assert.doesNotMatch(ctor, /\btitle:\s*string\s*=/);
	});
});

/* -------------------------------------------------------------------------- */
/* The CSS the classes exist to trigger                                       */
/* -------------------------------------------------------------------------- */

const css = readFileSync(join(process.cwd(), "styles.css"), "utf8");

/**
 * The same stylesheet with its comments taken out. `styles.css` explains itself
 * at length — including by naming rules that were *deleted* — so any assertion
 * about a selector being absent has to read the code and not the prose.
 */
const cssRules = css.replace(/\/\*[\s\S]*?\*\//g, "");

/** The declaration block of the first rule whose selector matches exactly. */
function ruleBody(selector: string): string {
	const at = cssRules.indexOf(`\n${selector} {`);
	assert.notStrictEqual(at, -1, `no rule for \`${selector}\``);
	const open = cssRules.indexOf("{", at);
	return cssRules.slice(open + 1, cssRules.indexOf("}", open));
}

describe("the shell is Obsidian's, with only the gaps it leaves filled in", () => {
	it("`.modal.cs-modal` names the inset and the surfaces, and leaves the box to Obsidian", () => {
		const body = ruleBody(".modal.cs-modal");
		assert.match(body, /--cs-modal-inset:\s*var\(--size-4-4\)/);
		assert.match(body, /--cs-surface:/);
		assert.match(body, /--cs-surface-raised:/);
		// Padding, overflow and the column are `mod-scrollable-content`'s.
		for (const property of ["padding", "overflow", "display", "flex-direction"]) {
			assert.doesNotMatch(body, new RegExp(`(^|[;\\s])${property}:`), property);
		}
	});

	it("draws no line under the title and no band of its own", () => {
		for (const gone of [".cs-modal > .modal-header", ".cs-modal > .modal-title", ".modal.cs-modal-wide"]) {
			assert.strictEqual(cssRules.includes(`${gone} {`) || cssRules.includes(`${gone},`), false, gone);
		}
	});

	it("moves 4px of the title's margin into the body, for the first row's focus ring", () => {
		assert.match(
			ruleBody(".modal.cs-modal.mod-scrollable-content > .modal-header"),
			/margin-bottom:\s*calc\(0\.75em - var\(--size-2-2\)\)/,
		);
		const content = ruleBody(".modal.cs-modal.mod-scrollable-content > .modal-content");
		assert.match(content, /padding-top:\s*var\(--size-2-2\)/);
		assert.match(content, /padding-inline:\s*var\(--cs-modal-inset\)/);
	});

	it("leaves the button bar and its buttons to Obsidian, but for the line over the bar", () => {
		// No size, padding, outline or dim of the plugin's own on them: the 40%
		// dim and the purple outline are gone on purpose (S5-03, S6-01).
		for (const hook of ["cs-modal-footer", "button.cs-btn-disabled", "button.cs-is-locked"]) {
			assert.strictEqual(cssRules.includes(hook), false, hook);
		}
		// The one rule on the bar takes the line away, and nothing else: the
		// padding Obsidian gives it is the gap above the buttons.
		const barRules = [...cssRules.matchAll(/([^{}]*\.modal-button-container[^{}]*)\{([^}]*)\}/g)];
		assert.strictEqual(barRules.length, 1, "more than one rule on the button bar");
		const [, selector, body] = barRules[0]!;
		assert.match(selector!, /\.cs-modal\.mod-scrollable-content > \.modal-button-container/);
		assert.match(selector!, /\.cs-scroll-body\.mod-scrollable-content > \.modal-button-container/);
		assert.strictEqual(body!.replace(/\s+/g, ""), "border-top:none;");
	});

	it("takes the line off the bar of every window that has one, and of no one else's", () => {
		// Obsidian's own long dialogs (Publish) and other plugins' keep theirs:
		// both selectors lead with a class only this plugin writes.
		for (const selector of cssRules.matchAll(/([^{}]*\.modal-button-container[^{}]*)\{/g)) {
			for (const part of selector[1]!.split(",")) {
				assert.match(part, /\.(cs-modal|cs-scroll-body)\./, part.trim());
			}
		}
	});

	it("has no headerless variant left to opt into", () => {
		// The class that used to hide the band is what let two unlabelled
		// windows ship. Don't bring it back — the stylesheet may still name it
		// in a comment saying exactly that, which is why this reads the rules.
		assert.strictEqual(cssRules.includes("cs-modal-no-title"), false);
	});
});
