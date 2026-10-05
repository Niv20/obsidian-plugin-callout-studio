import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Component, type App } from "obsidian";
import { getLocale, registerLocale, setLocale, t } from "../src/i18n";
import { WelcomeModal } from "../src/settings/WelcomeModal";
import type { SettingsTabPlugin } from "../src/settings/sections/types";
import { WELCOME_VIDEOS } from "../src/settings/welcomeVideos";
import { youtubeEmbedUrl, youtubeThumbnailUrl } from "../src/settings/youtubeVideo";
import { fakeDom, type FakeElement } from "./support/fakeDom";
import { TestKeymap, TestScope } from "./support/fakeKeymap";

/** Fake DOM does not mirror image/iframe properties into HTML attributes. */
function sourceOf(element: FakeElement): string | undefined {
	return (element as unknown as { src?: string }).src ?? element.getAttribute("src") ?? undefined;
}

function harness() {
	fakeDom.light();
	const children = new Set<Component>();
	const calls = { opens: 0, closes: 0, removes: 0 };
	const app = { keymap: new TestKeymap(), scope: new TestScope() } as unknown as App;
	const plugin = {
		app,
		addChild: (component: Component) => { children.add(component); component.load(); return component; },
		removeChild: (component: Component) => { calls.removes++; children.delete(component); component.unload(); return component; },
	} as unknown as SettingsTabPlugin;
	const modal = new WelcomeModal(plugin);
	const containerEl = fakeDom.document.body.createDiv({ cls: "modal-container" });
	const modalEl = containerEl.createDiv({ cls: "modal" });
	const titleEl = modalEl.createDiv({ cls: "modal-title" });
	const contentEl = modalEl.createDiv({ cls: "modal-content" });
	Object.assign(modal, {
		containerEl, modalEl, titleEl, contentEl, app, scope: app.scope,
		setTitle: (title: string) => { titleEl.setText(title); return modal; },
		open: () => { calls.opens++; modal.onOpen(); },
		close: () => { calls.closes++; modal.onClose(); },
	});
	return {
		modal, modalEl, titleEl, contentEl, calls, children,
		rows: () => contentEl.querySelectorAll(".cs-welcome-video"),
		images: () => contentEl.querySelectorAll("img"),
		unload: () => { for (const component of [...children]) component.unload(); },
		destroy: () => { modal.onClose(); containerEl.remove(); },
	};
}

describe("welcome video modal", () => {
	it("loads actual duration badges once for a shared video ID without blocking playback", async () => {
		const urls = WELCOME_VIDEOS.map(video => Object.getOwnPropertyDescriptor(video, "url")!);
		const globals = globalThis as unknown as { __CS_REQUEST_URL__?: (url: string) => Promise<{ text: string }> };
		const request = globals.__CS_REQUEST_URL__;
		let finish!: (response: { text: string }) => void;
		const response = new Promise<{ text: string }>(resolve => { finish = resolve; });
		const requests: string[] = [];
		globals.__CS_REQUEST_URL__ = url => { requests.push(url); return response; };
		for (const [index, video] of WELCOME_VIDEOS.entries()) {
			Object.defineProperty(video, "url", { ...urls[index], value: "https://youtu.be/duration001" });
		}
		const h = harness();
		try {
			h.modal.open();
			assert.equal(h.contentEl.querySelectorAll("iframe").length, 1);
			const badges = h.contentEl.querySelectorAll(".cs-welcome-duration");
			assert.equal(badges.length, 17);
			assert.ok(badges.every(badge => badge.hasAttribute("hidden")));
			assert.deepEqual(requests, ["https://www.youtube.com/watch?v=duration001"]);
			finish({ text: 'var ytInitialPlayerResponse = {"videoDetails":{"videoId":"duration001","lengthSeconds":"1344"}};' });
			await new Promise<void>(resolve => setImmediate(resolve));
			assert.ok(badges.every(badge => badge.textContent === "22:24" && !badge.hasAttribute("hidden")));
			assert.equal(h.contentEl.querySelector("[aria-label]"), null);
		} finally {
			h.destroy();
			for (const [index, video] of WELCOME_VIDEOS.entries()) Object.defineProperty(video, "url", urls[index]!);
			if (request) globals.__CS_REQUEST_URL__ = request;
			else delete globals.__CS_REQUEST_URL__;
		}
	});

	it("does not update detached duration badges when a metadata request finishes after close", async () => {
		const video = WELCOME_VIDEOS[0]!;
		const originalUrl = Object.getOwnPropertyDescriptor(video, "url")!;
		Object.defineProperty(video, "url", { ...originalUrl, value: "https://youtu.be/duration002" });
		const globals = globalThis as unknown as { __CS_REQUEST_URL__?: (url: string) => Promise<{ text: string }> };
		const request = globals.__CS_REQUEST_URL__;
		let finish!: (response: { text: string }) => void;
		const response = new Promise<{ text: string }>(resolve => { finish = resolve; });
		globals.__CS_REQUEST_URL__ = () => response;
		const h = harness();
		try {
			h.modal.open();
			const badge = h.rows()[0]!.querySelector(".cs-welcome-duration")!;
			h.modal.close();
			finish({ text: 'var ytInitialPlayerResponse = {"videoDetails":{"videoId":"duration002","lengthSeconds":"65"}};' });
			await new Promise<void>(resolve => setImmediate(resolve));
			assert.equal(badge.textContent, "");
			assert.equal(badge.hasAttribute("hidden"), true);
		} finally {
			h.destroy();
			Object.defineProperty(video, "url", originalUrl);
			if (request) globals.__CS_REQUEST_URL__ = request;
			else delete globals.__CS_REQUEST_URL__;
		}
	});

	it("opens with all 17 tutorials and immediately selects the first lesson with autoplay and sound", () => {
		const h = harness();
		try {
			h.modal.open();
			assert.equal(h.titleEl.textContent, t("welcome.title"));
			assert.equal(h.rows().length, 17);
			assert.equal(h.images().length, 17);
			assert.deepEqual(h.images().map(sourceOf), WELCOME_VIDEOS.map(video => youtubeThumbnailUrl(video.url)));
			const player = h.contentEl.querySelector("iframe")!;
			assert.equal(sourceOf(player), youtubeEmbedUrl(WELCOME_VIDEOS[0]!.url));
			assert.equal(new URL(sourceOf(player)!).searchParams.get("autoplay"), "1");
			assert.equal(new URL(sourceOf(player)!).searchParams.get("mute"), "0");
			assert.equal(h.contentEl.querySelector(".cs-welcome-playback-note"), null);
			assert.equal(h.contentEl.querySelector(".cs-welcome-stage")?.hasClass("is-idle"), false);
			assert.equal(h.modalEl.querySelector(".cs-modal-footer"), null);
			assert.equal(h.children.size, 1);
			for (const [index, row] of h.rows().entries()) {
				const video = WELCOME_VIDEOS[index]!;
				assert.equal(row.querySelector(".cs-welcome-video-title")?.textContent, t(video.titleKey));
				assert.equal(row.querySelector(".cs-welcome-video-description")?.textContent, t(video.descriptionKey));
				assert.equal(row.getAttribute("aria-current"), String(index === 0));
			}
		} finally { h.destroy(); }
	});

	it("names the tutorial list and player without attributes that produce hover tooltips", () => {
		const h = harness();
		try {
			h.modal.open();
			const list = h.contentEl.querySelector(".cs-welcome-list")!;
			const listHeading = h.contentEl.querySelector(".cs-welcome-list-heading")!;
			const player = h.contentEl.querySelector("iframe")!;
			const videoHeading = h.contentEl.querySelector(".cs-welcome-details h2")!;
			assert.ok(listHeading.id);
			assert.equal(list.getAttribute("aria-labelledby"), listHeading.id);
			assert.ok(videoHeading.id);
			assert.equal(player.getAttribute("aria-labelledby"), videoHeading.id);
			assert.equal(videoHeading.textContent, t(WELCOME_VIDEOS[0]!.titleKey));
			assert.equal(h.contentEl.querySelector("[aria-label]"), null);
			assert.equal(h.contentEl.querySelector("[title]"), null);
			assert.ok(h.images().every(image => image.getAttribute("referrerpolicy") === "no-referrer"));
		} finally { h.destroy(); }
	});

	it("keeps the numbered thumbnail fallback and tutorial text after an image fails to load", () => {
		const h = harness();
		try {
			h.modal.open();
			const image = h.images()[0]!, row = h.rows()[0]!;
			image.fire("load");
			assert.equal(image.hasClass("is-loaded"), true);
			image.fire("error");
			assert.equal(image.hasClass("is-loaded"), false);
			assert.equal(row.querySelector(".cs-welcome-number")?.textContent, "01");
			assert.equal(row.querySelector(".cs-welcome-video-title")?.textContent, t(WELCOME_VIDEOS[0]!.titleKey));
			assert.equal(h.rows().length, 17);
			assert.equal(sourceOf(h.contentEl.querySelector("iframe")!), youtubeEmbedUrl(WELCOME_VIDEOS[0]!.url));
		} finally { h.destroy(); }
	});

	it("selects and starts each video synchronously in the same iframe without opening a window", () => {
		const h = harness();
		const originalOpen = Object.getOwnPropertyDescriptor(window, "open");
		const secondVideo = WELCOME_VIDEOS[1]!;
		const originalUrl = Object.getOwnPropertyDescriptor(secondVideo, "url")!;
		// The current tutorial URLs share one sample. Exercise a distinct
		// tutorial URL as well, so a hard-coded iframe source cannot pass.
		Object.defineProperty(secondVideo, "url", { ...originalUrl, value: "https://youtu.be/aqz-KE-bpKQ" });
		Object.defineProperty(window, "open", { configurable: true, value: () => { assert.fail("selection must stay in the modal"); } });
		try {
			h.modal.open();
			const stage = h.contentEl.querySelector(".cs-welcome-stage")!;
			const scrolled: Array<{ options: ScrollIntoViewOptions; source: string | undefined }> = [];
			Object.assign(stage, { scrollIntoView: (options: ScrollIntoViewOptions) => {
				scrolled.push({ options, source: sourceOf(stage.querySelector("iframe")!) });
			} });
			assert.equal(stage.hasClass("is-idle"), false);
			const player = h.contentEl.querySelector("iframe")!;
			for (const [index, row] of h.rows().entries()) {
				const previousSource = sourceOf(player);
				row.fire("click");
				assert.equal(stage.hasClass("is-idle"), false);
				assert.equal(scrolled.length, index + 1);
				assert.deepEqual(scrolled[index], {
					options: { block: "nearest", inline: "nearest", behavior: "instant" },
					source: previousSource,
				}, "the player must be brought into view before the new source starts loading");
				const current = h.contentEl.querySelector("iframe")!;
				assert.ok(current);
				assert.equal(current, player);
				assert.equal(h.contentEl.querySelectorAll("iframe").length, 1);
				assert.equal(sourceOf(current), youtubeEmbedUrl(WELCOME_VIDEOS[index]!.url));
				assert.equal(current.getAttribute("aria-label"), null);
				assert.equal(current.getAttribute("title"), null);
				assert.ok(current.getAttribute("allow")?.split("; ").includes("autoplay"));
				assert.equal(current.getAttribute("referrerpolicy"), "strict-origin-when-cross-origin");
				assert.equal(current.getAttribute("allow")?.split("; ").includes("fullscreen"), false);
				assert.equal(current.hasAttribute("allowfullscreen"), true);
				assert.equal(h.rows().filter(button => button.getAttribute("aria-current") === "true").length, 1);
				assert.equal(row.getAttribute("aria-current"), "true");
				assert.equal(h.contentEl.querySelector(".cs-welcome-details h2")?.textContent, t(WELCOME_VIDEOS[index]!.titleKey));
				assert.equal(h.contentEl.querySelector(".cs-welcome-details p")?.textContent, t(WELCOME_VIDEOS[index]!.descriptionKey));
				const reading = h.contentEl.querySelectorAll(".cs-welcome-details p")[1]!;
				const guideLink = reading.querySelector("a")!;
				assert.equal(reading.textContent, t("welcome.readMore", {
					title: t(WELCOME_VIDEOS[index]!.titleKey), link: t("welcome.clickHere"),
				}));
				assert.equal(guideLink.textContent, t("welcome.clickHere"));
				assert.equal(guideLink.getAttribute("href"), WELCOME_VIDEOS[index]!.guideUrl);
				assert.equal(guideLink.getAttribute("target"), "_blank");
				assert.equal(guideLink.getAttribute("rel"), "noopener noreferrer");
			}
			assert.ok(h.images().every(image => sourceOf(image)?.startsWith("https://i.ytimg.com/")));
			assert.equal(h.contentEl.querySelectorAll("a").length, 1);
		} finally {
			Object.defineProperty(secondVideo, "url", originalUrl);
			if (originalOpen) Object.defineProperty(window, "open", originalOpen);
			else Reflect.deleteProperty(window, "open");
			h.destroy();
		}
	});

	it("keeps the reading link in the position chosen by the active translation", () => {
		const previousLocale = getLocale();
		registerLocale("welcome-link-first", {
			"welcome.readMore": "{{link}}: {{title}}.",
			"welcome.clickHere": "לקריאה נוספת",
			"welcome.video.threeTypes": "לימוד $&",
		});
		setLocale("welcome-link-first");
		const h = harness();
		try {
			h.modal.open();
			const reading = h.contentEl.querySelectorAll(".cs-welcome-details p")[1]!;
			assert.equal(reading.textContent, t("welcome.readMore", {
				title: t(WELCOME_VIDEOS[0]!.titleKey), link: t("welcome.clickHere"),
			}));
			assert.equal(reading.childNodes[0], reading.querySelector("a"));
			assert.equal(reading.querySelector("a")?.getAttribute("href"), WELCOME_VIDEOS[0]!.guideUrl);
		} finally { h.destroy(); setLocale(previousLocale); }
	});

	it("stops playback on close, resets to the first lesson on reopening, and ignores detached listeners", () => {
		const h = harness();
		try {
			h.modal.open();
			const oldRow = h.rows()[1]!, oldImage = h.images()[0]!;
			oldRow.fire("click");
			const player = h.contentEl.querySelector("iframe")!;
			oldImage.fire("load");
			assert.equal(oldImage.hasClass("is-loaded"), true);
			h.modal.close();
			assert.equal(sourceOf(player), "about:blank");
			assert.equal(player.parentElement, null);
			assert.equal(h.contentEl.children.length, 0);
			assert.equal(h.children.size, 0);
			assert.equal(h.calls.removes, 1);
			oldImage.fire("error");
			assert.equal(oldImage.hasClass("is-loaded"), true, "closed images must no longer react to events");
			h.modal.open();
			const reopenedPlayer = h.contentEl.querySelector("iframe")!;
			assert.notEqual(reopenedPlayer, player);
			assert.equal(sourceOf(reopenedPlayer), youtubeEmbedUrl(WELCOME_VIDEOS[0]!.url));
			assert.equal(h.rows()[0]!.getAttribute("aria-current"), "true");
			assert.equal(h.rows()[1]!.getAttribute("aria-current"), "false");
			oldRow.fire("click");
			assert.equal(sourceOf(reopenedPlayer), youtubeEmbedUrl(WELCOME_VIDEOS[0]!.url), "a detached row must not control a reopened player");
			assert.equal(h.rows()[0]!.getAttribute("aria-current"), "true");
			assert.deepEqual(h.images().map(sourceOf), WELCOME_VIDEOS.map(video => youtubeThumbnailUrl(video.url)));
			assert.equal(h.rows().length, 17);
		} finally { h.destroy(); }
	});

	it("closes and resolves the pending prompt when the plugin unloads", async () => {
		const h = harness();
		try {
			const dismissed = h.modal.prompt();
			h.rows()[0]!.fire("click");
			const player = h.contentEl.querySelector("iframe")!;
			h.unload();
			await dismissed;
			assert.equal(h.calls.closes, 1);
			assert.equal(h.children.size, 0);
			assert.equal(sourceOf(player), "about:blank");
			assert.equal(h.contentEl.children.length, 0);
		} finally { h.destroy(); }
	});

	it("shares one pending prompt and creates a new dismissal promise after reopening", async () => {
		const h = harness();
		try {
			const first = h.modal.prompt();
			assert.equal(h.modal.prompt(), first);
			assert.equal(h.calls.opens, 1);
			h.modal.close();
			await first;
			const second = h.modal.prompt();
			assert.notEqual(second, first);
			assert.equal(h.calls.opens, 2);
			assert.equal(h.rows().length, 17);
			h.modal.close();
			await second;
		} finally { h.destroy(); }
	});
});
