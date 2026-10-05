const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;
const YOUTUBE_HOSTS = new Set(["youtube.com", "www.youtube.com", "m.youtube.com", "music.youtube.com"]);

/** Accept video URLs only; arbitrary hosts, playlists and malformed IDs stay local. */
export function youtubeVideoId(value: string): string | null {
	try {
		const url = new URL(value);
		if (!["https:", "http:"].includes(url.protocol) || url.username || url.password || url.port) return null;
		let id: string | null = null;
		if (url.hostname === "youtu.be") {
			id = url.pathname.slice(1);
		} else if (YOUTUBE_HOSTS.has(url.hostname)) {
			if (url.pathname === "/watch") id = url.searchParams.get("v");
			else id = /^\/(?:embed|shorts|live)\/([^/]+)\/?$/.exec(url.pathname)?.[1] ?? null;
		} else if (url.hostname === "www.youtube-nocookie.com" || url.hostname === "youtube-nocookie.com") {
			id = /^\/embed\/([^/]+)\/?$/.exec(url.pathname)?.[1] ?? null;
		}
		return id && VIDEO_ID.test(id) ? id : null;
	} catch { return null; }
}

/** YouTube's public image CDN needs only a video ID, not a Data API key. */
export function youtubeThumbnailUrl(value: string): string | null {
	const id = youtubeVideoId(value);
	return id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : null;
}

export function youtubeEmbedUrl(value: string): string | null {
	const id = youtubeVideoId(value);
	if (!id) return null;
	const url = new URL(`https://www.youtube-nocookie.com/embed/${id}`);
	url.searchParams.set("autoplay", "1");
	url.searchParams.set("mute", "0");
	url.searchParams.set("playsinline", "1");
	url.searchParams.set("rel", "0");
	return url.href;
}
