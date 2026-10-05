import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { en } from "../src/i18n/en";
import { WELCOME_VIDEOS } from "../src/settings/welcomeVideos";
import { youtubeEmbedUrl, youtubeThumbnailUrl, youtubeVideoId } from "../src/settings/youtubeVideo";

const SAMPLE_ID = "xMHJGd3wwZk";

describe("YouTube tutorial URLs", () => {
	it("extracts an ID from supported watch, short, live and embed URLs", () => {
		for (const url of [
			`https://www.youtube.com/watch?v=${SAMPLE_ID}&list=playlist&t=12`,
			`http://youtube.com/watch?v=${SAMPLE_ID}`,
			`https://m.youtube.com/watch?v=${SAMPLE_ID}`,
			`https://music.youtube.com/watch?v=${SAMPLE_ID}`,
			`https://youtu.be/${SAMPLE_ID}?si=share-token`,
			`https://www.youtube.com/shorts/${SAMPLE_ID}`,
			`https://www.youtube.com/live/${SAMPLE_ID}/`,
			`https://youtube.com/embed/${SAMPLE_ID}`,
			`https://www.youtube-nocookie.com/embed/${SAMPLE_ID}`,
			`https://youtube-nocookie.com/embed/${SAMPLE_ID}/`,
		]) assert.equal(youtubeVideoId(url), SAMPLE_ID, url);
	});

	it("rejects arbitrary hosts, credentials, malformed protocols and invalid IDs", () => {
		for (const url of [
			"", SAMPLE_ID, `//youtube.com/watch?v=${SAMPLE_ID}`,
			`https//youtube.com/watch?v=${SAMPLE_ID}`,
			`ftp://youtube.com/watch?v=${SAMPLE_ID}`,
			`javascript:https://youtube.com/watch?v=${SAMPLE_ID}`,
			`https://example.com/watch?v=${SAMPLE_ID}`,
			`https://youtube.com.example.com/watch?v=${SAMPLE_ID}`,
			`https://notyoutube.com/watch?v=${SAMPLE_ID}`,
			`https://user:password@youtube.com/watch?v=${SAMPLE_ID}`,
			`https://youtube.com:8080/watch?v=${SAMPLE_ID}`,
			`https://youtu.be/${SAMPLE_ID}/extra`,
			`https://www.youtube.com/embed/${SAMPLE_ID}/extra`,
			`https://www.youtube.com/watch?v=${SAMPLE_ID}x`,
			`https://www.youtube.com/watch?v=${SAMPLE_ID.slice(1)}`,
			"https://www.youtube.com/watch?v=invalid!id!",
			"https://www.youtube.com/watch?v=__________%2F",
			"https://www.youtube.com/watch",
			"https://www.youtube.com/playlist?list=playlist",
			`https://www.youtube-nocookie.com/watch?v=${SAMPLE_ID}`,
		]) {
			assert.equal(youtubeVideoId(url), null, url);
			assert.equal(youtubeThumbnailUrl(url), null, url);
			assert.equal(youtubeEmbedUrl(url), null, url);
		}
	});

	it("builds a thumbnail without an API key and requests inline autoplay with sound in the privacy-enhanced player", () => {
		const original = `https://youtu.be/${SAMPLE_ID}?autoplay=0&mute=1&origin=https://example.com`;
		assert.equal(youtubeThumbnailUrl(original), `https://i.ytimg.com/vi/${SAMPLE_ID}/hqdefault.jpg`);
		const embed = new URL(youtubeEmbedUrl(original)!);
		assert.equal(embed.origin, "https://www.youtube-nocookie.com");
		assert.equal(embed.pathname, `/embed/${SAMPLE_ID}`);
		assert.equal(embed.searchParams.get("autoplay"), "1");
		assert.equal(embed.searchParams.get("playsinline"), "1");
		assert.equal(embed.searchParams.get("rel"), "0");
		assert.equal(embed.searchParams.has("origin"), false);
		assert.equal(embed.searchParams.get("mute"), "0");
	});
});

describe("welcome tutorial catalogue", () => {
	it("provides 17 tutorial topics with English copy and valid YouTube URLs", () => {
		assert.equal(WELCOME_VIDEOS.length, 17);
		assert.equal(new Set(WELCOME_VIDEOS.map(video => video.titleKey)).size, 17);
		for (const video of WELCOME_VIDEOS) {
			assert.equal(video.url, "https://youtu.be/xMHJGd3wwZk?si=P00-sZbJHBHELObF");
			assert.equal(youtubeVideoId(video.url), SAMPLE_ID, video.url);
			for (const key of [video.titleKey, video.descriptionKey]) {
				assert.ok(Object.hasOwn(en, key), key);
				const value = en[key];
				assert.ok(value, key);
				assert.ok(value.trim().length > 0, key);
				assert.notEqual(value, key);
			}
		}
	});

	it("links each tutorial to its matching published user-guide chapter", () => {
		const chapters = [
			"01-the-three-callout-types.md", "02-create-your-first-callout.md",
			"03-custom-color-palettes.md", "04-custom-icons-and-emojis.md",
			"05-fallback-styles-and-discovery.md", "06-editing-replacing-and-deleting.md",
			"07-global-styling.md", "08-the-right-click-menu.md", "09-commands-and-hotkeys.md",
			"10-import-export-and-sharing.md", "11-languages.md", "12-find-callouts.md",
			"13-syncing-and-backups.md", "14-danger-zone.md", "15-quick-insert.md",
			"16-advanced-heading-callouts.md", "17-theme-integration.md",
		];
		assert.equal(WELCOME_VIDEOS.length, chapters.length);
		for (const [index, video] of WELCOME_VIDEOS.entries()) {
			const chapter = chapters[index]!;
			assert.equal(video.guideUrl, `https://github.com/Niv20/obsidian-plugin-callout-studio/blob/master/docs/user-guide/${chapter}`);
			assert.ok(existsSync(join(process.cwd(), "docs", "user-guide", chapter)), chapter);
		}
	});
});
