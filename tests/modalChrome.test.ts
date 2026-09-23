/**
 * tests/modalChrome.test.ts — the one shell every Callout Studio window wears.
 *
 * Obsidian hands a plugin a few boxes and no opinion about what to do with
 * them, so each window here had grown its own answer until `applyModalChrome`
 * became the only way to dress one. Two halves are worth pinning, and they fail
 * differently.
 *
 * **The behaviour.** `modalEl` and `containerEl` are reused across open/close,
 * so every class this hangs has to be idempotent and every class it hangs
 * *conditionally* has to come back off: a wide window reopened narrow that kept
 * `cs-modal-wide`, or a window reopened over nothing that kept
 * `cs-modal-stacked`, is a layout bug with no error attached to it. The footer
 * is the sharper case — it is a sibling of `.modal-content`, so it survives the
 * `contentEl.empty()` every `onOpen` starts with, and a reopened window would
 * grow a second button bar per open if it were not detached first.
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
	applyModalChrome,
	removeModalChrome,
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

const footersIn = (modalEl: FakeElement): FakeElement[] =>
	modalEl.findAll(":scope > .cs-modal-footer");

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

	it("widens the window only when asked", () => {
		const { modal, modalEl } = freshModal();
		applyModalChrome(modal, { wide: true });
		assert.ok(modalEl.hasClass("cs-modal-wide"));
	});

	it("takes the wide class back off when a reopened window is not wide", () => {
		// `modalEl` is reused across open/close, so this is a real sequence: the
		// same element, dressed twice.
		const { modal, modalEl } = freshModal();
		applyModalChrome(modal, { wide: true });
		applyModalChrome(modal);
		assert.strictEqual(modalEl.hasClass("cs-modal-wide"), false);
	});

	it("treats `wide` as exactly `true`, not merely truthy", () => {
		const { modal, modalEl } = freshModal();
		applyModalChrome(modal, { wide: 1 as unknown as boolean });
		assert.strictEqual(modalEl.hasClass("cs-modal-wide"), false);
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
		assert.ok(footer.hasClass("cs-modal-footer"));
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

	it("leaves a nested footer alone — only its own child is its own", () => {
		// `:scope >` in the detach selector: a window that renders something
		// carrying the class deeper in its body must not have it torn out.
		const { modal, modalEl, contentEl } = freshModal();
		const nested = contentEl.createDiv({ cls: "cs-modal-footer" });
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

describe("removeModalChrome", () => {
	it("undoes every class and takes the footer with it", () => {
		const { modal, modalEl, containerEl } = freshModal();
		fakeModal(); // a second window, so the stacked mark is really set
		applyModalChrome(modal, { footer: true, wide: true });
		removeModalChrome(modal);

		for (const cls of ["cs-modal", "cs-modal-wide"]) {
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
		"cs-modal-wide",
		"cs-modal-footer",
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

describe("the 16px inset moves from the window onto the bands", () => {
	// The geometry is why it lives in one place rather than in each window:
	// `.modal` gives up its own padding so a rule can reach the window's sides,
	// and every band re-applies that distance itself.
	it("`.modal.cs-modal` gives its own padding up and names the inset", () => {
		const body = ruleBody(".modal.cs-modal");
		assert.match(body, /--cs-modal-inset:\s*var\(--size-4-4\)/);
		assert.match(body, /padding:\s*0/);
	});

	it("stops the window being a second scroll container", () => {
		assert.match(ruleBody(".modal.cs-modal"), /overflow:\s*hidden/);
	});

	it("the wide window widens the inset rather than re-adding padding", () => {
		assert.match(ruleBody(".modal.cs-modal-wide"), /--cs-modal-inset:/);
	});

	for (const band of [
		".cs-modal > .modal-header,\n.cs-modal > .modal-title",
		".cs-modal > .modal-content",
		".cs-modal > .cs-modal-footer",
	]) {
		it(`${band.split("\n")[0]} re-applies it`, () => {
			assert.match(ruleBody(band), /padding:[^;]*var\(--cs-modal-inset\)/);
		});
	}

	it("the header and footer each draw one edge-to-edge rule", () => {
		assert.match(
			ruleBody(".cs-modal > .modal-header,\n.cs-modal > .modal-title"),
			/border-bottom:\s*1px solid/,
		);
		assert.match(
			ruleBody(".cs-modal > .cs-modal-footer"),
			/border-top:\s*1px solid/,
		);
	});

	it("the body is the one scroll container", () => {
		const body = ruleBody(".cs-modal > .modal-content");
		assert.match(body, /overflow-y:\s*auto/);
		// Without this the flex item's automatic minimum size pushes the footer
		// off the bottom once the window hits `--dialog-max-height`.
		assert.match(body, /min-height:\s*0/);
	});

	it("has no headerless variant left to opt into", () => {
		// The class that used to hide the band is what let two unlabelled
		// windows ship. Don't bring it back — the stylesheet may still name it
		// in a comment saying exactly that, which is why this reads the rules.
		assert.strictEqual(cssRules.includes("cs-modal-no-title"), false);
	});
});
