import { Component, Modal } from "obsidian";
import { t } from "../i18n";
import { applyModalChrome, removeModalChrome } from "./modalChrome";
import type { SettingsTabPlugin } from "./sections/types";
import { WELCOME_VIDEOS, type WelcomeVideo } from "./welcomeVideos";
import { youtubeEmbedUrl, youtubeThumbnailUrl, youtubeVideoId } from "./youtubeVideo";
import { formatVideoDuration, youtubeDurationSeconds } from "./youtubeDuration";
import { observeWelcomeDescriptions } from "./welcomeDescriptionLayout";

interface VideoRow {
	video: WelcomeVideo;
	button: HTMLButtonElement;
	image: HTMLImageElement;
	duration: HTMLElement;
}

let welcomeSequence = 0;

/** Tutorial browser. Every opening requests autoplay of the first lesson. */
export class WelcomeModal extends Modal {
	private readonly labelId = `cs-welcome-${welcomeSequence++}`;
	private lifetime: Component | null = null;
	private rows: VideoRow[] = [];
	private player: HTMLIFrameElement | null = null;
	private stage: HTMLElement | null = null;
	private videoTitle: HTMLElement | null = null;
	private videoDescription: HTMLElement | null = null;
	private videoReading: HTMLElement | null = null;
	private thumbnailsLoaded = false;
	private pendingPrompt: Promise<void> | null = null;
	private resolvePrompt: (() => void) | null = null;

	constructor(private readonly plugin: SettingsTabPlugin) {
		super(plugin.app);
	}

	onOpen(): void {
		if (this.lifetime) return;
		this.contentEl.empty();
		this.modalEl.addClass("cs-welcome-modal");
		applyModalChrome(this);
		this.setTitle(t("welcome.title"));
		const lifetime = this.lifetime = new Component();
		this.plugin.addChild(lifetime);
		lifetime.register(() => {
			// Plugin unload also closes the player; normal close clears this first.
			if (this.lifetime === lifetime) this.close();
		});

		const layout = this.contentEl.createDiv({ cls: "cs-welcome-layout" });
		const sidebar = layout.createDiv({ cls: "cs-welcome-sidebar", attr: { dir: "auto" } });
		sidebar.createEl("p", { cls: "cs-welcome-intro", text: t("welcome.intro") });
		sidebar.createEl("h2", { cls: "cs-welcome-list-heading", text: t("welcome.tutorialCount", { count: WELCOME_VIDEOS.length }), attr: { id: `${this.labelId}-list` } });
		// Obsidian turns aria-label on an ancestor into a hover tooltip for every row.
		const list = sidebar.createEl("ol", { cls: "cs-welcome-list", attr: { "aria-labelledby": `${this.labelId}-list` } });
		for (const [index, video] of WELCOME_VIDEOS.entries()) {
			const item = list.createEl("li");
			const button = item.createEl("button", { cls: "cs-welcome-video", attr: { type: "button", "aria-current": "false" } });
			const thumbnail = button.createSpan({ cls: "cs-welcome-thumbnail" });
			thumbnail.createSpan({ cls: "cs-welcome-number", text: String(index + 1).padStart(2, "0"), attr: { "aria-hidden": "true" } });
			const image = thumbnail.createEl("img", { attr: { alt: "", loading: "lazy", decoding: "async", referrerpolicy: "no-referrer" } });
			const duration = thumbnail.createSpan({ cls: "cs-welcome-duration", attr: { hidden: "", dir: "ltr" } });
			lifetime.registerDomEvent(image, "load", () => image.addClass("is-loaded"));
			lifetime.registerDomEvent(image, "error", () => image.removeClass("is-loaded"));
			const copy = button.createSpan({ cls: "cs-welcome-video-copy" });
			copy.createSpan({ cls: "cs-welcome-video-title", text: t(video.titleKey) });
			copy.createSpan({ cls: "cs-welcome-video-description", text: t(video.descriptionKey) });
			this.rows.push({ video, button, image, duration });
			lifetime.registerDomEvent(button, "click", () => this.playVideo(video));
		}
		lifetime.register(observeWelcomeDescriptions(list, this.labelId));

		const viewer = layout.createDiv({ cls: "cs-welcome-viewer", attr: { dir: "auto" } });
		this.stage = viewer.createDiv({ cls: "cs-welcome-stage" });
		const details = viewer.createDiv({ cls: "cs-welcome-details", attr: { "aria-live": "polite" } });
		this.videoTitle = details.createEl("h2", { attr: { id: `${this.labelId}-video` } });
		this.videoDescription = details.createEl("p");
		this.videoReading = details.createEl("p");
		this.loadThumbnails();
		const first = WELCOME_VIDEOS[0];
		if (first) this.playVideo(first);
		void this.loadDurations(lifetime);
	}

	private async loadDurations(lifetime: Component): Promise<void> {
		const groups = new Map<string, { url: string; badges: HTMLElement[] }>();
		for (const { video, duration } of this.rows) {
			const id = youtubeVideoId(video.url);
			if (!id) continue;
			const group = groups.get(id);
			if (group) group.badges.push(duration);
			else groups.set(id, { url: video.url, badges: [duration] });
		}
		const queue = [...groups.values()];
		let next = 0;
		const worker = async (): Promise<void> => {
			while (this.lifetime === lifetime && next < queue.length) {
				const group = queue[next++]!;
				const seconds = await youtubeDurationSeconds(group.url);
				if (this.lifetime !== lifetime) return;
				if (seconds === null) continue;
				for (const badge of group.badges) {
					badge.setText(formatVideoDuration(seconds));
					badge.removeAttribute("hidden");
				}
			}
		};
		await Promise.all(Array.from({ length: Math.min(3, queue.length) }, worker));
	}

	private loadThumbnails(): void {
		if (this.thumbnailsLoaded) return;
		this.thumbnailsLoaded = true;
		for (const { video, image } of this.rows) {
			const url = youtubeThumbnailUrl(video.url);
			if (url) image.src = url;
		}
	}

	private playVideo(video: WelcomeVideo): void {
		if (!this.lifetime || !this.stage) return;
		const url = youtubeEmbedUrl(video.url);
		if (!url) {
			this.stopPlayer();
			this.stage.empty();
			this.stage.addClass("is-idle");
			this.stage.createEl("p", { cls: "cs-welcome-empty", text: t("welcome.invalidVideo") });
			return;
		}
		this.loadThumbnails();
		for (const row of this.rows) row.button.setAttribute("aria-current", String(row.video === video));
		this.videoTitle?.setText(t(video.titleKey));
		this.videoDescription?.setText(t(video.descriptionKey));
		if (this.videoReading) {
			this.videoReading.empty();
			const [before, after] = t("welcome.readMore", { title: t(video.titleKey) }).split("{{link}}");
			if (before) this.videoReading.appendText(before);
			this.videoReading.createEl("a", {
				text: t("welcome.clickHere"),
				attr: { href: video.guideUrl, target: "_blank", rel: "noopener noreferrer" },
			});
			if (after) this.videoReading.appendText(after);
		}
		if (!this.player) {
			this.stage.empty();
			this.stage.removeClass("is-idle");
			this.player = this.stage.createEl("iframe", {
				cls: "cs-welcome-player",
				attr: {
					"aria-labelledby": `${this.labelId}-video`,
					allow: "autoplay; encrypted-media; picture-in-picture",
					allowfullscreen: "",
					referrerpolicy: "strict-origin-when-cross-origin",
				},
			});
		}
		// On narrow screens the player sits above the list. Reveal it before
		// requesting playback; scrolling the list must not leave it off screen.
		this.stage.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "instant" });
		// Request playback with sound on opening and row clicks. The host can
		// still require user activation; YouTube's native play control remains.
		// Reassign even for the same row so it also retries a failed video load.
		this.player.src = url;
	}

	private stopPlayer(): void {
		if (!this.player) return;
		this.player.src = "about:blank";
		this.player.remove();
		this.player = null;
	}

	onClose(): void {
		const lifetime = this.lifetime;
		this.lifetime = null;
		this.stopPlayer();
		if (lifetime) this.plugin.removeChild(lifetime);
		this.rows = [];
		this.thumbnailsLoaded = false;
		this.stage = this.videoTitle = this.videoDescription = this.videoReading = null;
		this.contentEl.empty();
		removeModalChrome(this);
		this.modalEl.removeClass("cs-welcome-modal");
		const resolve = this.resolvePrompt;
		this.resolvePrompt = this.pendingPrompt = null;
		resolve?.();
	}

	/** First-run routing waits for dismissal without writing synced settings. */
	prompt(): Promise<void> {
		if (this.pendingPrompt) return this.pendingPrompt;
		const promise = new Promise<void>((resolve) => { this.resolvePrompt = resolve; });
		this.pendingPrompt = promise;
		this.open();
		return promise;
	}
}
