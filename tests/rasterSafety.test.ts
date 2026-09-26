import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { embeddedRasterSize, rasterDimensions, safeRasterSize, MAX_RASTER_PIXELS } from "../src/icons/rasterSafety";
import { importImageFile } from "../src/icons/userImageImport";

function join(...parts: Uint8Array[]): Uint8Array {
	const bytes = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
	let at = 0;
	for (const part of parts) { bytes.set(part, at); at += part.length; }
	return bytes;
}
/** Header fixtures: the inspector intentionally leaves CRC/zlib validation to the decoder. */
function pngChunk(type: string, data = new Uint8Array(0)): Uint8Array {
	const bytes = new Uint8Array(data.length + 12);
	new DataView(bytes.buffer).setUint32(0, data.length);
	bytes.set(Buffer.from(type), 4); bytes.set(data, 8);
	return bytes;
}
function pngHeader(width: number, height: number): Uint8Array {
	const header = new Uint8Array(13); const view = new DataView(header.buffer);
	view.setUint32(0, width); view.setUint32(4, height); header[8] = 8; header[9] = 6;
	return join(Uint8Array.from([0x89, 80, 78, 71, 13, 10, 26, 10]), pngChunk("IHDR", header));
}
function png(width: number, height: number): Uint8Array {
	return join(pngHeader(width, height), pngChunk("IDAT", Uint8Array.of(0)), pngChunk("IEND"));
}
function animationControl(frames: number): Uint8Array {
	const data = new Uint8Array(8); new DataView(data.buffer).setUint32(0, frames);
	return pngChunk("acTL", data);
}
function frameControl(sequence: number, width: number, height: number, x = 0, y = 0): Uint8Array {
	const data = new Uint8Array(26); const view = new DataView(data.buffer);
	for (const [i, value] of [sequence, width, height, x, y].entries()) view.setUint32(i * 4, value);
	return pngChunk("fcTL", data);
}
function frameData(sequence: number): Uint8Array {
	const data = new Uint8Array(5); new DataView(data.buffer).setUint32(0, sequence);
	return pngChunk("fdAT", data);
}
function apng(width: number, height: number, includeDefault = true): Uint8Array {
	return join(pngHeader(width, height), animationControl(2),
		...(includeDefault ? [frameControl(0, width, height)] : []),
		pngChunk("IDAT", Uint8Array.of(0)),
		...(includeDefault ? [] : [frameControl(0, 1, 1), frameData(1)]),
		frameControl(includeDefault ? 1 : 2, 1, 1), frameData(includeDefault ? 2 : 3), pngChunk("IEND"));
}
function animatedGif(width: number, height: number): Uint8Array {
	const header = Uint8Array.from([71,73,70,56,57,97,0,0,0,0,0,0,0]);
	new DataView(header.buffer).setUint16(6, width, true); new DataView(header.buffer).setUint16(8, height, true);
	const frame = Uint8Array.from([44,0,0,0,0,1,0,1,0,0,2,0]);
	return join(header, frame, frame, Uint8Array.of(59));
}
function animatedWebp(width: number, height: number): Uint8Array {
	const chunk = (type: string, data: Uint8Array): Uint8Array => {
		const bytes = new Uint8Array(8 + data.length + (data.length & 1));
		bytes.set(Buffer.from(type), 0); new DataView(bytes.buffer).setUint32(4, data.length, true); bytes.set(data, 8);
		return bytes;
	};
	const extended = new Uint8Array(10); extended[0] = 2;
	for (const [at, value] of [[4, width - 1], [7, height - 1]] as const) {
		extended[at] = value & 255; extended[at + 1] = (value >>> 8) & 255; extended[at + 2] = (value >>> 16) & 255;
	}
	const frame = chunk("ANMF", join(new Uint8Array(16), chunk("VP8L", Uint8Array.from([47,0,0,0,0]))));
	const bytes = join(Uint8Array.from(Buffer.from("RIFF\0\0\0\0WEBP")), chunk("VP8X", extended), chunk("ANIM", new Uint8Array(6)), frame, frame);
	new DataView(bytes.buffer).setUint32(4, bytes.length - 8, true);
	return bytes;
}
function uri(bytes: Uint8Array, format = "png"): string {
	return `data:image/${format};base64,${Buffer.from(bytes).toString("base64")}`;
}

describe("raster dimensions before decode", () => {
	it("reads PNG, GIF and JPEG dimensions without decoding pixels", () => {
		assert.deepEqual(rasterDimensions(png(128, 64)), { format: "png", width: 128, height: 64 });
		assert.deepEqual(rasterDimensions(Uint8Array.from([71,73,70,56,57,97,24,0,12,0,0,0,0,44,0,0,0,0,24,0,12,0,0,2,0,59])),
			{ format: "gif", width: 24, height: 12 });
		const jpeg = Uint8Array.from([255,216,255,224,0,4,0,0,255,192,0,8,8,0,24,0,12,0]);
		assert.deepEqual(rasterDimensions(jpeg), { format: "jpeg", width: 12, height: 24 });
	});

	it("reads all three WebP header encodings", () => {
		for (const [kind, body] of [

			["VP8 ", [0,0,0,157,1,42,24,0,12,0]],
			["VP8L", [47,23,192,2,0]],
		] as const) {
			const bytes = new Uint8Array(20 + body.length);
			bytes.set(Buffer.from("RIFF"), 0); bytes.set(Buffer.from("WEBP"), 8);
			bytes.set(Buffer.from(kind), 12); new DataView(bytes.buffer).setUint32(16, body.length, true);
			bytes.set(body, 20);
			assert.deepEqual(rasterDimensions(bytes), { format: "webp", width: 24, height: 12 });
		}
	});

	it("checks GIF frame and WebP bitstream sizes even when the canvas claims a small image", () => {
		const gif = Uint8Array.from([71,73,70,56,57,97,24,0,12,0,0,0,0,44,0,0,0,0,255,255,255,255,0,2,0,59]);
		assert.equal(rasterDimensions(gif), null);
		const bytes = new Uint8Array(48);
		bytes.set(Buffer.from("RIFF"), 0); bytes.set(Buffer.from("WEBPVP8X"), 8);
		const view = new DataView(bytes.buffer); view.setUint32(16, 10, true);
		bytes[24] = 23; bytes[27] = 11; // 24 × 12 canvas.
		bytes.set(Buffer.from("VP8 "), 30); view.setUint32(34, 10, true);
		bytes.set([0,0,0,157,1,42,24,0,12,0], 38);
		assert.deepEqual(rasterDimensions(bytes), { format: "webp", width: 24, height: 12 });
		bytes[44] = 255; bytes[45] = 63; bytes[46] = 255; bytes[47] = 63;
		assert.equal(rasterDimensions(bytes), null);
	});

	it("rejects dimension bombs, empty images and mismatched claimed MIME types", () => {
		assert.equal(embeddedRasterSize(uri(png(100_000, 100_000))), null);
		assert.equal(embeddedRasterSize(uri(png(0, 128))), null);
		assert.equal(embeddedRasterSize(uri(png(128, 128), "jpeg")), null);
		assert.equal(safeRasterSize(4096, 4096), true);
		assert.equal(safeRasterSize(MAX_RASTER_PIXELS, 1), false);
		assert.equal(safeRasterSize(4097, 4096), false);
		assert.equal(embeddedRasterSize("data:image/png;base64,aaaa="), null);
	});

	it("refuses a huge compressed image before creating a browser Image", async () => {
		// Node has no Image/DOM decoder: reaching one changes this into the catch
		// path. Both outcomes are failure, so also observe attempted construction.
		const globals = globalThis as unknown as Record<string, unknown>;
		const previous = globals.Image; let attempted = false;
		globals.Image = class { constructor() { attempted = true; throw new Error("decoder reached"); } };
		try {
			const file = new File([png(100_000, 100_000) as Uint8Array<ArrayBuffer>], "bomb.png");
			const result = await importImageFile(file);
			assert.equal(result.ok, false);
			assert.equal(attempted, false);
		} finally { if (previous === undefined) delete globals.Image; else globals.Image = previous; }
	});

	it("never reads past truncated or invalid segment boundaries", () => {
		for (const bytes of [png(128, 128).subarray(0, 23), Uint8Array.from([255,216,255,192,0,99]),
			Uint8Array.from([255,216,255,192,0,0]), new Uint8Array(0)]) {
			assert.equal(rasterDimensions(bytes), null);
		}
	});

	it("requires complete PNG chunks, image data and a final IEND", () => {
		const valid = png(24, 12);
		for (let length = 0; length < valid.length; length++) assert.equal(rasterDimensions(valid.subarray(0, length)), null);
		const overrun = valid.slice(); new DataView(overrun.buffer).setUint32(33, 0xffffffff);
		for (const bytes of [overrun, join(pngHeader(24, 12), pngChunk("IEND")),
			join(valid, Uint8Array.of(0)), join(pngHeader(24, 12), pngHeader(24, 12).subarray(8), valid.subarray(33)),
			join(pngHeader(24, 12), pngChunk("IDAT"), pngChunk("IEND"))]) {
			assert.equal(rasterDimensions(bytes), null);
		}
	});

	it("supports both APNG default-image arrangements and counts all composited frames", () => {
		assert.deepEqual(rasterDimensions(apng(24, 12)), { format: "png", width: 24, height: 12, decodedPixels: 24 * 12 * 2 });
		assert.deepEqual(embeddedRasterSize(uri(apng(24, 12, false))), { format: "png", width: 24, height: 12, decodedPixels: 24 * 12 * 3 });
		assert.deepEqual(rasterDimensions(join(pngHeader(1, 1), animationControl(1), frameControl(0, 1, 1),
			pngChunk("IDAT", Uint8Array.of(0)), pngChunk("IEND"))), { format: "png", width: 1, height: 1, decodedPixels: 1 });
	});

	it("checks declared APNG frame counts against actual controls", () => {
		for (const count of [0, 1, 3, 0xffffffff]) {
			const bytes = apng(24, 12); new DataView(bytes.buffer).setUint32(41, count);
			assert.equal(rasterDimensions(bytes), null);
		}
		assert.equal(rasterDimensions(join(pngHeader(24, 12), animationControl(2), animationControl(2), apng(24, 12).subarray(53))), null);
	});

	it("rejects malformed APNG ordering, control sizes and sequence numbers", () => {
		const first = join(pngHeader(24, 12), animationControl(1));
		const idat = pngChunk("IDAT", Uint8Array.of(0)); const end = pngChunk("IEND");
		for (const tail of [
			join(frameControl(1, 24, 12), idat, end), // First sequence must be zero.
			join(idat, frameControl(0, 1, 1), frameData(2), end), // No sequence gaps.
			join(frameControl(0, 24, 12), end), // Every frame needs data.
			join(frameData(0), idat, end), // Data cannot precede a frame control.
			join(pngChunk("fcTL", new Uint8Array(25)), idat, end),
			join(idat, frameControl(0, 1, 1), frameData(1), idat, end), // No late IDAT.
		]) assert.equal(rasterDimensions(join(first, tail)), null);
		assert.equal(rasterDimensions(join(pngHeader(24, 12), frameControl(0, 24, 12), idat, end)), null);
		assert.equal(rasterDimensions(join(pngHeader(24, 12), idat, animationControl(1), frameControl(0, 1, 1), frameData(1), end)), null);
	});

	it("validates APNG frame rectangles and default-image control dimensions", () => {
		for (const [width, height, x, y] of [[0,1,0,0], [100000,1,0,0], [1,1,24,0], [1,1,0,12]]) {
			const bytes = join(pngHeader(24, 12), animationControl(1), pngChunk("IDAT", Uint8Array.of(0)),
				frameControl(0, width!, height!, x, y), frameData(1), pngChunk("IEND"));
			assert.equal(rasterDimensions(bytes), null);
		}
		assert.equal(rasterDimensions(join(pngHeader(24, 12), animationControl(1), frameControl(0, 1, 1),
			pngChunk("IDAT", Uint8Array.of(0)), pngChunk("IEND"))), null);
	});

	it("budgets full animation canvases rather than tiny patch rectangles for every format", () => {
		for (const make of [apng, animatedGif, animatedWebp]) {
			assert.equal(rasterDimensions(make(4096, 4096)), null);
			assert.equal(rasterDimensions(make(24, 12))?.decodedPixels, 24 * 12 * 2);
		}
		assert.equal(rasterDimensions(apng(4096, 2048, false)), null, "The separate static default also consumes pixels");
	});
});
