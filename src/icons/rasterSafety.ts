/** Inspect raster headers before a browser allocates decoded pixel buffers. */
export const MAX_RASTER_PIXELS = 16 * 1024 * 1024;
const MAX_RASTER_SIDE = 16_384;
export interface RasterDimensions {
	width: number;
	height: number;
	format: "png" | "jpeg" | "webp" | "gif";
	/** Full composited canvases, including every animation frame. */
	decodedPixels?: number;
}

export function safeRasterSize(width: number, height: number): boolean {
	return Number.isInteger(width) && Number.isInteger(height) && width > 0 && height > 0 &&
		width <= MAX_RASTER_SIDE && height <= MAX_RASTER_SIDE && width * height <= MAX_RASTER_PIXELS;
}

function matches(bytes: Uint8Array, offset: number, text: string): boolean {
	return Array.from(text).every((char, i) => bytes[offset + i] === char.charCodeAt(0));
}

/** Header recognition only, not a replacement for the browser's decoder. */
export function rasterDimensions(bytes: Uint8Array): RasterDimensions | null {
	const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
	if (bytes.length >= 8 && bytes[0] === 0x89 && matches(bytes, 1, "PNG\r\n\x1a\n")) {
		return pngDimensions(bytes, view);
	}
	if (bytes.length >= 10 && (matches(bytes, 0, "GIF87a") || matches(bytes, 0, "GIF89a"))) {
		return gifDimensions(bytes, view);
	}
	if (bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8) {
		let at = 2;
		while (at + 1 < bytes.length) {
			if (bytes[at++] !== 0xff) return null;
			while (bytes[at] === 0xff) at++;
			const marker = bytes[at++];
			if (marker === undefined || marker === 0xda || marker === 0xd9) return null;
			if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd8)) continue;
			if (at + 2 > bytes.length) return null;
			const length = view.getUint16(at);
			if (length < 2 || at + length > bytes.length) return null;
			if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
				if (length < 8) return null;
				return { format: "jpeg", height: view.getUint16(at + 3), width: view.getUint16(at + 5) };
			}
			at += length;
		}
	}
	if (bytes.length >= 20 && matches(bytes, 0, "RIFF") && matches(bytes, 8, "WEBP")) {
		return webpDimensions(bytes, view);
	}
	return null;
}

/** PNG/APNG chunk structure; CRCs and compressed bytes remain the decoder's job. */
function pngDimensions(bytes: Uint8Array, view: DataView): RasterDimensions | null {
	if (bytes.length < 33 || view.getUint32(8) !== 13 || !matches(bytes, 12, "IHDR")) return null;
	const width = view.getUint32(16); const height = view.getUint32(20);
	if (!safeRasterSize(width, height)) return null;
	const canvasPixels = width * height;
	let at = 33;
	let declaredFrames = 0; let frames = 0; let sequence = 0;
	let defaultIncluded = false; let defaultData = false;
	let idatSeen = false; let idatClosed = false;
	let frameData = false; let frameUsesDefault = false;
	while (at + 12 <= bytes.length) {
		const length = view.getUint32(at); const body = at + 8; const end = body + length + 4;
		if (length > 0x7fffffff || end > bytes.length) return null;
		const isIdat = matches(bytes, at + 4, "IDAT");
		if (matches(bytes, at + 4, "IHDR")) return null;
		if (matches(bytes, at + 4, "acTL")) {
			if (length !== 8 || declaredFrames || idatSeen) return null;
			declaredFrames = view.getUint32(body);
			if (!declaredFrames || canvasPixels * declaredFrames > MAX_RASTER_PIXELS) return null;
		} else if (matches(bytes, at + 4, "fcTL")) {
			if (length !== 26 || !declaredFrames || (frames > 0 && !frameData) || view.getUint32(body) !== sequence++) return null;
			const w = view.getUint32(body + 4); const h = view.getUint32(body + 8);
			const x = view.getUint32(body + 12); const y = view.getUint32(body + 16);
			if (!safeRasterSize(w, h) || x + w > width || y + h > height || bytes[body + 24]! > 2 || bytes[body + 25]! > 1) return null;
			frameUsesDefault = !idatSeen;
			if (frameUsesDefault) {
				if (frames || x || y || w !== width || h !== height) return null;
				defaultIncluded = true;
			}
			frames++; frameData = false;
			if (frames > declaredFrames || canvasPixels * (frames + (defaultIncluded ? 0 : 1)) > MAX_RASTER_PIXELS) return null;
		} else if (matches(bytes, at + 4, "fdAT")) {
			if (length < 4 || !declaredFrames || !frames || !idatSeen || frameUsesDefault || view.getUint32(body) !== sequence++) return null;
			if (length > 4) frameData = true;
		} else if (isIdat) {
			if (idatClosed || (frames > 0 && !frameUsesDefault)) return null;
			idatSeen = true;
			if (length > 0) { defaultData = true; if (frameUsesDefault) frameData = true; }
		} else if (matches(bytes, at + 4, "IEND")) {
			if (length !== 0 || end !== bytes.length || !defaultData ||
				(declaredFrames && (frames !== declaredFrames || !frameData))) return null;
			return { format: "png", width, height,
				...(declaredFrames ? { decodedPixels: canvasPixels * (frames + (defaultIncluded ? 0 : 1)) } : {}) };
		}
		if (idatSeen && !isIdat) idatClosed = true;
		at = end;
	}
	return null;
}

/** GIF frame rectangles may be larger than the logical screen header. */
function gifDimensions(bytes: Uint8Array, view: DataView): RasterDimensions | null {
	if (bytes.length < 13) return null;
	const width = view.getUint16(6, true); const height = view.getUint16(8, true);
	if (!safeRasterSize(width, height)) return null;
	let at = 13 + ((bytes[10]! & 0x80) ? 3 * (2 ** ((bytes[10]! & 7) + 1)) : 0);
	let frames = 0;
	const skipBlocks = (): boolean => {
		while (at < bytes.length) {
			const length = bytes[at++]!;
			if (!length) return true;
			at += length;
		}
		return false;
	};
	while (at < bytes.length) {
		const kind = bytes[at++];
		if (kind === 0x3b) return frames > 0 ? { format: "gif", width, height,
			...(frames > 1 ? { decodedPixels: width * height * frames } : {}) } : null;
		if (kind === 0x21) { at++; if (!skipBlocks()) return null; continue; }
		if (kind !== 0x2c || at + 9 > bytes.length) return null;
		const x = view.getUint16(at, true); const y = view.getUint16(at + 2, true);
		const w = view.getUint16(at + 4, true); const h = view.getUint16(at + 6, true);
		frames++;
		if (!safeRasterSize(w, h) || x + w > width || y + h > height || width * height * frames > MAX_RASTER_PIXELS) return null;
		const flags = bytes[at + 8]!;
		at += 9 + ((flags & 0x80) ? 3 * (2 ** ((flags & 7) + 1)) : 0);
		at++; // LZW minimum code size, then length-prefixed compressed blocks.
		if (!skipBlocks()) return null;
	}
	return null;
}

/** Validate WebP canvas, frame and bitstream dimensions, not only VP8X. */
function webpDimensions(bytes: Uint8Array, view: DataView): RasterDimensions | null {
	const le24 = (at: number): number => bytes[at]! + (bytes[at + 1]! << 8) + (bytes[at + 2]! << 16);
	let canvas: { width: number; height: number } | undefined;
	let images = 0;
	const chunks = (start: number, end: number, frame?: { width: number; height: number }): boolean => {
		let at = start;
		while (at + 8 <= end) {
			const length = view.getUint32(at + 4, true); const body = at + 8;
			if (body + length > end) return false;
			let size: { width: number; height: number } | undefined;
			if (matches(bytes, at, "VP8X")) {
				if (length < 10 || canvas || frame) return false;
				canvas = { width: le24(body + 4) + 1, height: le24(body + 7) + 1 };
				if (!safeRasterSize(canvas.width, canvas.height)) return false;
			} else if (matches(bytes, at, "ANMF")) {
				if (length < 16 || !canvas || frame) return false;
				const rect = { width: le24(body + 6) + 1, height: le24(body + 9) + 1 };
				const before = images;
				if (!safeRasterSize(rect.width, rect.height) || le24(body) * 2 + rect.width > canvas.width ||
					le24(body + 3) * 2 + rect.height > canvas.height || !chunks(body + 16, body + length, rect) || images !== before + 1) return false;
			} else if (matches(bytes, at, "VP8 ") && length >= 10 && matches(bytes, body + 3, "\x9d\x01\x2a")) {
				size = { width: view.getUint16(body + 6, true) & 0x3fff, height: view.getUint16(body + 8, true) & 0x3fff };
			} else if (matches(bytes, at, "VP8L") && length >= 5 && bytes[body] === 0x2f) {
				const bits = view.getUint32(body + 1, true);
				size = { width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1 };
			}
			if (size) {
				const expected = frame ?? canvas;
				if (!safeRasterSize(size.width, size.height) ||
					(expected && (expected.width !== size.width || expected.height !== size.height))) return false;
				canvas ??= size;
				images++;
				if (canvas.width * canvas.height * images > MAX_RASTER_PIXELS) return false;
			}
			at = body + length + (length & 1);
		}
		return at === end || at === end + 1;
	};
	return chunks(12, bytes.length) && canvas && images > 0 ? { ...canvas, format: "webp",
		...(images > 1 ? { decodedPixels: canvas.width * canvas.height * images } : {}) } : null;
}

/** Only a bounded raster whose bytes match its MIME type may survive in SVG. */
export function embeddedRasterSize(uri: string): RasterDimensions | null {
	const match = /^data:image\/(png|jpe?g|gif|webp);base64,([A-Za-z0-9+/=\s]+)$/i.exec(uri);
	if (!match) return null;
	try {
		const decoded = atob(match[2]!.replace(/\s/g, ""));
		const bytes = Uint8Array.from(decoded, char => char.charCodeAt(0));
		const size = rasterDimensions(bytes);
		const format = match[1]!.toLowerCase().replace("jpg", "jpeg");
		return size && size.format === format && safeRasterSize(size.width, size.height) ? size : null;
	} catch { return null; }
}
