import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { observeWelcomeDescriptions } from "../src/settings/welcomeDescriptionLayout";
import { installFakeDom } from "./support/fakeDom";

describe("welcome descriptions follow their available space", () => {
	it("restores the full original text when space grows and shortens it again when space shrinks", () => {
		const dom = installFakeDom();
		let resize = (): void => {};
		const observed: Element[] = [];
		let disconnected = false;
		class Observer {
			constructor(callback: () => void) { resize = callback; }
			observe(element: Element): void { observed.push(element); }
			disconnect(): void { disconnected = true; }
		}
		Object.assign(dom.window, { ResizeObserver: Observer });
		try {
			const list = dom.document.body.createDiv();
			const button = list.createEl("button");
			const text = "Learn how to create callouts and customize their icons, colors, and styles.";
			const description = button.createSpan({ cls: "cs-welcome-video-description", text });
			let capacity = 35;
			// This artificial overflow signal tests resize/restoration behavior.
			// Real line wrapping and ellipsis placement require a browser check.
			Object.defineProperties(description, {
				clientHeight: { get: () => 45 },
				clientWidth: { get: () => 180 },
				scrollHeight: { get: () => description.textContent.length <= capacity ? 45 : 60 },
				scrollWidth: { get: () => 180 },
			});
			const stop = observeWelcomeDescriptions(list as unknown as HTMLElement, "welcome-test");
			const shortened = description.textContent;
			assert.notEqual(shortened, text);
			assert.match(shortened, /\S\u00a0…$/u, "the suffix has a nonbreaking space after visible text");
			assert.ok(text.startsWith(shortened.slice(0, -2)));
			assert.deepEqual(observed, [description]);
			capacity = text.length;
			resize();
			assert.equal(description.textContent, text, "resizing restores the captured source, not the shortened copy");
			capacity = 20;
			resize();
			assert.match(description.textContent, /\S\u00a0…$/u);
			assert.ok(description.textContent.length < shortened.length);
			stop();
			assert.equal(disconnected, true);
		} finally { dom.restore(); }
	});

	it("keeps the full accessible description without tooltip-producing attributes", () => {
		const dom = installFakeDom();
		class Observer {
			observe(): void {}
			disconnect(): void {}
		}
		Object.assign(dom.window, { ResizeObserver: Observer });
		try {
			const list = dom.document.body.createDiv();
			const button = list.createEl("button");
			button.createSpan({ cls: "cs-welcome-video-title", text: "Callout colors" });
			const text = "Choose colors that follow your theme and remain readable in nested callouts.";
			const description = button.createSpan({ cls: "cs-welcome-video-description", text });
			Object.defineProperties(description, {
				scrollHeight: { get: () => description.textContent.length > 25 ? 60 : 36 },
				scrollWidth: { get: () => 240 },
			});
			const stop = observeWelcomeDescriptions(list as unknown as HTMLElement, "welcome-accessible");
			const accessible = button.querySelector('[id="welcome-accessible-description-0"]');
			assert.ok(accessible);
			assert.equal(accessible.textContent, text);
			assert.equal(accessible.hasAttribute("hidden"), true);
			assert.equal(button.getAttribute("aria-describedby"), accessible.id);
			assert.equal(description.getAttribute("aria-hidden"), "true");
			assert.notEqual(description.textContent, text);
			assert.equal(list.querySelector("[aria-label]"), null);
			assert.equal(list.querySelector("[title]"), null);
			stop();
		} finally { dom.restore(); }
	});

	it("leaves the original description usable when ResizeObserver is unavailable", () => {
		const dom = installFakeDom();
		try {
			const list = dom.document.body.createDiv();
			const button = list.createEl("button");
			const text = "The complete description remains available to the ordinary CSS layout.";
			const description = button.createSpan({ cls: "cs-welcome-video-description", text });
			const stop = observeWelcomeDescriptions(list as unknown as HTMLElement, "welcome-fallback");
			assert.equal(description.textContent, text);
			assert.equal(description.hasAttribute("aria-hidden"), false);
			assert.equal(button.hasAttribute("aria-describedby"), false);
			assert.equal(button.querySelector("[hidden]"), null);
			assert.doesNotThrow(stop);
		} finally { dom.restore(); }
	});
});
