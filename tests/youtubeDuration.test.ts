import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatVideoDuration, parseYoutubeDurationSeconds, youtubeDurationSeconds } from "../src/settings/youtubeDuration";

const seams = globalThis as unknown as {
	__CS_REQUEST_URL__?: (url: string) => Promise<{ text: string }>;
};
const SAMPLE_ID = "M7lc1UVf-VE";

function page(videoId: string, lengthSeconds: unknown, extra: Record<string, unknown> = {}): string {
	return `<script>var ytInitialPlayerResponse = ${JSON.stringify({
		videoDetails: { videoId, lengthSeconds, ...extra }, playabilityStatus: { status: "OK" },
	})};</script>`;
}

describe("public YouTube duration metadata", () => {
	it("reads the requested video's details while respecting braces and escaped quotes in JSON strings", () => {
		const html = page(SAMPLE_ID, "1344", {
			title: 'A { title }; with "quotes" and a trailing \\',
			description: 'Escaped \\" }; nested text',
			isLiveContent: true,
			nested: { values: [{ label: "} {" }] },
		});
		assert.equal(parseYoutubeDurationSeconds(html, SAMPLE_ID), 1344);
		assert.equal(parseYoutubeDurationSeconds(html, "aqz-KE-bpKQ"), null);
		assert.equal(parseYoutubeDurationSeconds(html.replace("var ytInitialPlayerResponse", 'window["ytInitialPlayerResponse"]'), SAMPLE_ID), 1344);
		assert.equal(parseYoutubeDurationSeconds(page(SAMPLE_ID, 635), SAMPLE_ID), 635);
	});

	it("ignores unrelated durations, missing player data and malformed or unsafe lengths", () => {
		for (const html of [
			'<script>var recommendations = {"lengthSeconds":"999"};</script>',
			"<html>Consent required</html>",
			`var ytInitialPlayerResponse = {"videoDetails":{"videoId":"${SAMPLE_ID}","lengthSeconds":"12"}`,
			`var ytInitialPlayerResponse = {videoDetails:{videoId:'${SAMPLE_ID}',lengthSeconds:'12'}};`,
			"var ytInitialPlayerResponse = null;",
			"var ytInitialPlayerResponse = [];",
			`var ytInitialPlayerResponse = ${JSON.stringify({ videoDetails: null })};`,
		]) assert.equal(parseYoutubeDurationSeconds(html, SAMPLE_ID), null, html);
		for (const seconds of [undefined, null, true, {}, [], "", "0", "-1", "3.5", "1e3", " 42 ", 0, -2, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
			assert.equal(parseYoutubeDurationSeconds(page(SAMPLE_ID, seconds), SAMPLE_ID), null, JSON.stringify(seconds));
		}
	});

	it("skips unavailable and active live or upcoming videos while allowing ended live recordings", () => {
		assert.equal(parseYoutubeDurationSeconds(page(SAMPLE_ID, "1344", { isLiveContent: true }), SAMPLE_ID), 1344);
		assert.equal(parseYoutubeDurationSeconds(page(SAMPLE_ID, "1344", { isLive: true }), SAMPLE_ID), null);
		assert.equal(parseYoutubeDurationSeconds(page(SAMPLE_ID, "1344", { isUpcoming: true }), SAMPLE_ID), null);
		assert.equal(parseYoutubeDurationSeconds(page(SAMPLE_ID, "1344").replace('"status":"OK"', '"status":"UNPLAYABLE"'), SAMPLE_ID), null);
	});

	it("continues past unrelated assignments and treats appended scripts only as text", () => {
		const html = page("aqz-KE-bpKQ", "635") + page(SAMPLE_ID, "1344") + "globalThis.mustNotExecute = true;";
		assert.equal(parseYoutubeDurationSeconds(html, SAMPLE_ID), 1344);
		const expression = `var ytInitialPlayerResponse = {"videoDetails":{"videoId":"${SAMPLE_ID}","lengthSeconds":(globalThis.mustNotExecute = true, 1344)}};`;
		assert.equal(parseYoutubeDurationSeconds(expression, SAMPLE_ID), null);
		assert.equal(Reflect.get(globalThis, "mustNotExecute"), undefined);
	});
});

describe("video duration formatting", () => {
	it("uses m:ss for short videos and h:mm:ss for longer recordings", () => {
		assert.equal(formatVideoDuration(0), "0:00");
		assert.equal(formatVideoDuration(9), "0:09");
		assert.equal(formatVideoDuration(60), "1:00");
		assert.equal(formatVideoDuration(635), "10:35");
		assert.equal(formatVideoDuration(1344), "22:24");
		assert.equal(formatVideoDuration(3599), "59:59");
		assert.equal(formatVideoDuration(3605), "1:00:05");
		assert.equal(formatVideoDuration(3661.9), "1:01:01");
		for (const value of [-1, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) assert.equal(formatVideoDuration(value), "");
	});
});

describe("YouTube duration requests", () => {
	it("deduplicates simultaneous aliases of one video and caches only that video's successful result", async () => {
		const original = seams.__CS_REQUEST_URL__;
		const requests: string[] = [];
		let resolve!: (value: { text: string }) => void;
		seams.__CS_REQUEST_URL__ = url => {
			requests.push(url);
			return new Promise(finish => { resolve = finish; });
		};
		try {
			const first = youtubeDurationSeconds(`https://youtu.be/${SAMPLE_ID}`);
			const second = youtubeDurationSeconds(`https://www.youtube.com/watch?v=${SAMPLE_ID}&t=12`);
			assert.equal(first, second);
			assert.deepEqual(requests, [`https://www.youtube.com/watch?v=${SAMPLE_ID}`]);
			resolve({ text: page(SAMPLE_ID, "1344") });
			assert.equal(await first, 1344);
			assert.equal(await second, 1344);
			assert.equal(await youtubeDurationSeconds(`https://youtube.com/shorts/${SAMPLE_ID}`), 1344);
			assert.equal(requests.length, 1);
			const nextId = "aqz-KE-bpKQ";
			const next = youtubeDurationSeconds(`https://youtu.be/${nextId}`);
			assert.equal(requests.length, 2, "changing the catalog ID must request that video's duration");
			resolve({ text: page(nextId, "635") });
			assert.equal(await next, 635);
		} finally { seams.__CS_REQUEST_URL__ = original; }
	});

	it("rejects arbitrary URLs without a request and allows failed or unavailable lookups to retry", async () => {
		const original = seams.__CS_REQUEST_URL__;
		const videoId = "retryVideo1";
		let requests = 0;
		seams.__CS_REQUEST_URL__ = async () => {
			requests++;
			if (requests === 1) throw new Error("offline");
			return { text: requests === 2 ? "Consent required" : page(videoId, "42") };
		};
		try {
			assert.equal(await youtubeDurationSeconds(`https://example.com/watch?v=${videoId}`), null);
			assert.equal(requests, 0);
			const url = `https://youtu.be/${videoId}`;
			assert.equal(await youtubeDurationSeconds(url), null);
			assert.equal(await youtubeDurationSeconds(url), null);
			assert.equal(await youtubeDurationSeconds(url), 42);
			assert.equal(await youtubeDurationSeconds(url), 42);
			assert.equal(requests, 3);
		} finally { seams.__CS_REQUEST_URL__ = original; }
	});

	it("keeps a pending native request shared until it settles, then allows a failed lookup to retry", async () => {
		const original = seams.__CS_REQUEST_URL__;
		const videoId = "hungVideo01";
		const url = `https://youtu.be/${videoId}`;
		let requests = 0;
		let reject!: (error: Error) => void;
		seams.__CS_REQUEST_URL__ = () => {
			requests++;
			return new Promise((_resolve, fail) => { reject = fail; });
		};
		try {
			const first = youtubeDurationSeconds(url);
			await Promise.resolve();
			assert.equal(youtubeDurationSeconds(url), first);
			assert.equal(requests, 1);
			reject(new Error("native request failed"));
			assert.equal(await first, null);
			seams.__CS_REQUEST_URL__ = async () => { requests++; return { text: page(videoId, "100") }; };
			assert.equal(await youtubeDurationSeconds(url), 100);
			assert.equal(requests, 2);
		} finally { seams.__CS_REQUEST_URL__ = original; }
	});
});
