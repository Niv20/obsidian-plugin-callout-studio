import assert from "node:assert";
import { describe, it } from "node:test";
import { FakeElement, FakeText } from "./support/fakeDom";
import { registerCalloutContextClickGuard } from "../src/editor/livepreview/contextClick";
import {
	CSS_CM_WIDGET,
	CSS_HEADING_HIDE_MARKS,
	CSS_HEADING_LINE,
	CSS_HEADING_TOKEN,
	CSS_INLINE_HAS_CONTENT,
	CSS_INLINE_TOKEN,
} from "../src/editor/renderShared";

function element(classes: string[], parent?: FakeElement): FakeElement {
	const node = new FakeElement("div");
	node.classList.add(...classes);
	parent?.appendChild(node);
	return node;
}

function harness() {
	const root = element(["cm-editor"]);
	const heading = element(
		["cm-line", CSS_HEADING_LINE, CSS_HEADING_HIDE_MARKS],
		root,
	);
	const title = element(["cs-heading-title"], heading);
	const token = element([CSS_HEADING_TOKEN, CSS_CM_WIDGET], heading);
	const inline = element([CSS_INLINE_TOKEN, CSS_CM_WIDGET], root);
	const ordinary = element(["cm-line"], root);
	const registrations = new Map<string, boolean>();
	const add = root.addEventListener.bind(root);
	root.addEventListener = (
		type: string,
		listener: (event: unknown) => void,
		options?: boolean | AddEventListenerOptions,
	) => {
		registrations.set(type, options === true || !!(options && options.capture));
		add(type, listener);
	};
	const dispose = registerCalloutContextClickGuard(root as unknown as HTMLElement);
	const fire = (type: string, target: unknown = heading, button = 2): Event => {
		const event = new Event(type, { bubbles: true, cancelable: true });
		Object.defineProperties(event, {
			target: { value: target },
			button: { value: button },
		});
		root.fire(type, event);
		return event;
	};
	return { root, heading, title, token, inline, ordinary, registrations, dispose, fire };
}

describe("callout context-click selection guard", () => {
	it("captures right presses on heading titles, tokens, and the empty row tail", () => {
		const h = harness();
		for (const target of [h.heading, h.title, h.token]) {
			assert.ok(h.fire("mousedown", target).defaultPrevented);
			assert.ok(h.fire("selectstart", target).defaultPrevented);
		}
		assert.strictEqual(h.registrations.get("mousedown"), true);
		assert.strictEqual(h.registrations.get("selectstart"), true);
	});

	it("recognizes text nodes and elements from another window, including SVG icons", () => {
		const h = harness();
		const text = new FakeText("Title");
		h.title.appendChild(text);
		const icon = element([], h.token);
		// Deliberately not an HTMLElement instance in this window.
		const svg = {
			nodeType: 1,
			parentElement: h.token,
			closest: icon.closest.bind(icon),
		};
		for (const target of [text, svg]) {
			assert.ok(h.fire("mousedown", target).defaultPrevented);
			assert.ok(h.fire("selectstart", target).defaultPrevented);
		}
	});

	it("protects plain inline pills and payload links without consuming their menus", () => {
		const h = harness();
		const content = element(
			[CSS_INLINE_TOKEN, CSS_CM_WIDGET, CSS_INLINE_HAS_CONTENT],
			h.root,
		);
		const link = new FakeElement("a");
		content.appendChild(link);
		for (const target of [h.inline, content, link, h.title]) {
			assert.ok(h.fire("mousedown", target).defaultPrevented);
			const menu = new Event("contextmenu", { bubbles: true, cancelable: true });
			Object.defineProperty(menu, "target", { value: target });
			menu.stopPropagation = menu.stopImmediatePropagation = () => {
				assert.fail("The context menu must reach Obsidian's handlers");
			};
			h.root.fire("contextmenu", menu);
			assert.strictEqual(menu.defaultPrevented, false);
			assert.ok(h.fire("selectstart", target).defaultPrevented);
		}
	});

	it("blocks the browser's late selection even after mouseup or on adjacent text", () => {
		const h = harness();
		h.fire("mousedown");
		h.fire("mouseup");
		h.fire("contextmenu");
		// Chromium can choose nearby editable text when the press hit empty space.
		assert.ok(h.fire("selectstart", h.ordinary).defaultPrevented);
	});

	it("preserves an existing selection instead of clearing or replacing it", () => {
		const h = harness();
		const doc = h.root.ownerDocument as unknown as {
			getSelection?: () => unknown;
		};
		const previous = doc.getSelection;
		let selectionReads = 0;
		doc.getSelection = () => {
			selectionReads++;
			throw new Error("The guard must not change the existing native selection");
		};
		try {
			h.fire("mousedown");
			h.fire("contextmenu");
			assert.ok(h.fire("selectstart").defaultPrevented);
			assert.strictEqual(selectionReads, 0);
		} finally {
			if (previous) doc.getSelection = previous;
			else delete doc.getSelection;
		}
	});

	it("leaves left editing, middle clicks, keyboard selection, and touch selection available", () => {
		for (const [type, button] of [
			["mousedown", 0],
			["mousedown", 1],
			["keydown", 0],
			["touchstart", 0],
		] as const) {
			const h = harness();
			h.fire("mousedown");
			assert.strictEqual(h.fire(type, h.title, button).defaultPrevented, false);
			assert.strictEqual(h.fire("selectstart").defaultPrevented, false);
		}
	});

	it("does not guard ordinary, revealed, reading-view, or nested-editor content", () => {
		const h = harness();
		const revealed = element(["cm-line", CSS_HEADING_LINE], h.root);
		const readingPill = element([CSS_INLINE_TOKEN], h.root);
		const nested = element(["cm-editor"], h.root);
		const nestedPill = element([CSS_INLINE_TOKEN, CSS_CM_WIDGET], nested);
		const outside = element([CSS_INLINE_TOKEN, CSS_CM_WIDGET]);
		for (const target of [h.ordinary, revealed, readingPill, nestedPill, outside, null]) {
			h.fire("mousedown");
			assert.strictEqual(h.fire("mousedown", target).defaultPrevented, false);
			assert.strictEqual(h.fire("selectstart", target).defaultPrevented, false);
		}
	});

	it("removes every listener when the editor is destroyed", () => {
		const h = harness();
		h.fire("mousedown");
		h.dispose();
		assert.strictEqual(h.fire("selectstart").defaultPrevented, false);
		assert.strictEqual(h.fire("mousedown").defaultPrevented, false);
		assert.doesNotThrow(h.dispose);
	});
});
