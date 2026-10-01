/**
 * tests/defaultThemeClass.test.ts — `cs-default-theme`, the one fact the light
 * palette's gate needs and CSS cannot ask for itself.
 *
 * The palette (see `styles.css`, "The light palette") applies only while
 * Obsidian's Default theme is in use, so that a community theme always wins.
 * Obsidian never marks the community theme on `<body>`: it is a name inside
 * `app.customCss` and a `<style>` element. `registerDefaultThemeClass` mirrors
 * the name as a class, and what these tests pin is the *direction of failure*:
 *
 * - The class is the positive statement — "the Default theme is known to be in
 *   use". Anything short of that, including Obsidian renaming `customCss`, leaves
 *   it off, which keeps every window exactly as it looked before the palette.
 *   The opposite design (a class meaning "a theme is active") would turn that
 *   same failure into the plugin painting over a theme it could not see.
 * - It follows the theme live, off `css-change`, which Obsidian triggers only
 *   after it has written `customCss.theme`.
 * - It is registered like every other listener, and taken off again on unload.
 */
import assert from "node:assert";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { App, EventRef } from "obsidian";
import { fakeDom } from "./support/fakeDom";
import { usesDefaultTheme } from "../src/manager/theme/customCssApi";
import {
	DEFAULT_THEME_CLASS,
	registerDefaultThemeClass,
} from "../src/manager/theme/defaultThemeClass";

interface Harness {
	/** Change the theme the way Obsidian does: the name first, then the event. */
	setTheme(name: string): void;
	/** What `host.registerEvent` was handed. */
	registered: EventRef[];
	/** What `host.register` was handed — run on unload. */
	unloads: Array<() => void>;
	/** The refs `workspace.on("css-change")` returned, in order. */
	issued: EventRef[];
	body: typeof fakeDom.document.body;
}

/** `theme` undefined means Obsidian exposes no `customCss` at all. */
function harness(theme: string | undefined): Harness {
	const body = fakeDom.document.body;
	body.removeClass(DEFAULT_THEME_CLASS);
	const customCss: { theme: string } | undefined =
		theme === undefined ? undefined : { theme };
	const listeners: Array<() => void> = [];
	const issued: EventRef[] = [];
	const registered: EventRef[] = [];
	const unloads: Array<() => void> = [];
	const app = {
		customCss,
		workspace: {
			containerEl: { ownerDocument: fakeDom.document },
			on(name: string, callback: () => void): EventRef {
				assert.strictEqual(name, "css-change", "only the theme-change event is of interest");
				listeners.push(callback);
				const ref = { name } as unknown as EventRef;
				issued.push(ref);
				return ref;
			},
		},
	} as unknown as App;

	registerDefaultThemeClass({
		app,
		registerEvent: (ref) => registered.push(ref),
		register: (cb) => unloads.push(cb),
	});

	return {
		setTheme(name) {
			assert.ok(customCss, "this harness has no customCss to change");
			customCss.theme = name;
			for (const listener of listeners) listener();
		},
		registered,
		unloads,
		issued,
		body,
	};
}

const appWith = (customCss: unknown): App => ({ customCss }) as unknown as App;

describe("usesDefaultTheme", () => {
	it("is true only for the empty string Obsidian uses for its Default theme", () => {
		assert.strictEqual(usesDefaultTheme(appWith({ theme: "" })), true);
	});

	it("is false for any named community theme", () => {
		assert.strictEqual(usesDefaultTheme(appWith({ theme: "Minimal" })), false);
		assert.strictEqual(usesDefaultTheme(appWith({ theme: " " })), false);
	});

	it("is false whenever it cannot tell, which is the direction that leaves a theme in charge", () => {
		// A renamed or removed `customCss`, and a field that is not a string. Both
		// read as "no theme" through `activeThemeName`, which is the wrong answer
		// to give anything that decides whether to paint over one.
		assert.strictEqual(usesDefaultTheme(appWith(undefined)), false);
		assert.strictEqual(usesDefaultTheme(appWith({})), false);
		assert.strictEqual(usesDefaultTheme(appWith({ theme: null })), false);
		assert.strictEqual(usesDefaultTheme(appWith({ theme: 0 })), false);
	});
});

describe("the cs-default-theme class on <body>", () => {
	it("is set at once when the Default theme is in use", () => {
		const h = harness("");
		assert.ok(h.body.classList.contains(DEFAULT_THEME_CLASS));
	});

	it("is left off under a community theme", () => {
		const h = harness("Minimal");
		assert.ok(!h.body.classList.contains(DEFAULT_THEME_CLASS));
	});

	it("is left off when Obsidian exposes no customCss — the failure that must not paint over a theme", () => {
		const h = harness(undefined);
		assert.ok(!h.body.classList.contains(DEFAULT_THEME_CLASS));
	});

	it("follows a theme switch in both directions, from the css-change event", () => {
		const h = harness("");
		h.setTheme("AnuPpuccin");
		assert.ok(!h.body.classList.contains(DEFAULT_THEME_CLASS), "a theme was chosen");
		h.setTheme("");
		assert.ok(h.body.classList.contains(DEFAULT_THEME_CLASS), "back to Default");
		h.setTheme("");
		assert.ok(h.body.classList.contains(DEFAULT_THEME_CLASS), "a repeat event is harmless");
	});

	it("does not touch the scheme classes, which are Obsidian's", () => {
		const h = harness("");
		h.body.addClass("theme-light");
		h.setTheme("Minimal");
		assert.ok(h.body.classList.contains("theme-light"));
		assert.ok(!h.body.classList.contains("theme-dark"));
	});

	it("is registered through the plugin, so the listener is released on unload", () => {
		const h = harness("");
		assert.deepStrictEqual(h.registered, h.issued, "the workspace listener must go through registerEvent");
		assert.strictEqual(h.issued.length, 1);
	});

	it("is taken off again when the plugin unloads", () => {
		const h = harness("");
		assert.ok(h.body.classList.contains(DEFAULT_THEME_CLASS));
		assert.strictEqual(h.unloads.length, 1);
		h.unloads[0]!();
		assert.ok(!h.body.classList.contains(DEFAULT_THEME_CLASS), "a disabled plugin must not leave its class on the page");
	});
});

describe("the plugin sets the class", () => {
	// The failure this file is built around is a quiet one: with the class off the
	// palette simply never appears and every window looks as it did before, so
	// nothing would ever report the call being dropped from `onload`.
	const main = readFileSync(join(process.cwd(), "src/main.ts"), "utf8");
	const onload = main.indexOf("async onload()");

	it("registers it from onload, before the first await, so no window opens ahead of the gate", () => {
		assert.ok(onload > 0, "async onload() not found in src/main.ts");
		const call = main.indexOf("registerDefaultThemeClass(this)", onload);
		const firstAwait = main.indexOf("await ", onload);
		assert.ok(call > onload, "src/main.ts no longer calls registerDefaultThemeClass(this) from onload");
		assert.ok(call < firstAwait, "the call must come before onload's first await");
	});

	it("imports it from the module that owns the class", () => {
		assert.match(main, /import \{ registerDefaultThemeClass \} from "\.\/manager\/theme\/defaultThemeClass";/);
	});
});
