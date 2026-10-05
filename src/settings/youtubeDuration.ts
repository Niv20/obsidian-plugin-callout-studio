import { requestUrl } from "obsidian";
import { youtubeVideoId } from "./youtubeVideo";

const durations = new Map<string, number>();
const pending = new Map<string, Promise<number | null>>();

function record(value: unknown): Record<string, unknown> | null {
	return value !== null && typeof value === "object" && !Array.isArray(value)
		? value as Record<string, unknown>
		: null;
}

/** Extract one JSON object without evaluating the surrounding remote script. */
function jsonObjectAt(text: string, start: number): string | null {
	if (text[start] !== "{") return null;
	let depth = 0;
	let quoted = false;
	let escaped = false;
	for (let index = start; index < text.length; index++) {
		const character = text[index];
		if (quoted) {
			if (escaped) escaped = false;
			else if (character === "\\") escaped = true;
			else if (character === '"') quoted = false;
		} else if (character === '"') quoted = true;
		else if (character === "{") depth++;
		else if (character === "}" && --depth === 0) return text.slice(start, index + 1);
	}
	return null;
}

/**
 * Best-effort public watch-page metadata, not a stable YouTube API. Only accept
 * the requested video's own details; unrelated recommended-video data cannot
 * supply its duration. Consent, unavailable videos and changed markup fail shut.
 */
export function parseYoutubeDurationSeconds(html: string, videoId: string): number | null {
	const assignment = /(?:\bytInitialPlayerResponse|window\[\s*["']ytInitialPlayerResponse["']\s*\])\s*=\s*/g;
	while (assignment.exec(html)) {
		const json = jsonObjectAt(html, assignment.lastIndex);
		if (!json) continue;
		try {
			const player = record(JSON.parse(json) as unknown);
			const details = record(player?.videoDetails);
			if (details?.videoId !== videoId || details.isLive === true || details.isUpcoming === true) continue;
			const status = record(player?.playabilityStatus)?.status;
			if (typeof status === "string" && status !== "OK") continue;
			const length = details.lengthSeconds;
			if (typeof length !== "number" && (typeof length !== "string" || !/^\d+$/.test(length))) continue;
			const seconds = Number(length);
			if (Number.isSafeInteger(seconds) && seconds > 0) return seconds;
		} catch { /* JSON must remain data; JavaScript expressions are unavailable. */ }
	}
	return null;
}

async function fetchDuration(videoId: string): Promise<number | null> {
	try {
		const response = await requestUrl({ url: `https://www.youtube.com/watch?v=${videoId}` });
		return parseYoutubeDurationSeconds(response.text, videoId);
	} catch { return null; }
}

/** Fetch on demand, sharing requests and successful session results by video ID. */
export function youtubeDurationSeconds(value: string): Promise<number | null> {
	const videoId = youtubeVideoId(value);
	if (!videoId) return Promise.resolve(null);
	const cached = durations.get(videoId);
	if (cached !== undefined) return Promise.resolve(cached);
	const existing = pending.get(videoId);
	if (existing) return existing;
	const request = fetchDuration(videoId).then(seconds => {
		if (seconds !== null) durations.set(videoId, seconds);
		return seconds;
	}).finally(() => { pending.delete(videoId); });
	pending.set(videoId, request);
	return request;
}

export function formatVideoDuration(seconds: number): string {
	if (!Number.isFinite(seconds) || seconds < 0) return "";
	const total = Math.floor(seconds);
	if (!Number.isSafeInteger(total)) return "";
	const hours = Math.floor(total / 3600);
	const minutes = Math.floor(total / 60) % 60;
	const remainder = String(total % 60).padStart(2, "0");
	return hours ? `${hours}:${String(minutes).padStart(2, "0")}:${remainder}` : `${minutes}:${remainder}`;
}
