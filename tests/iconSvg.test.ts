/**
 * tests/iconSvg.test.ts — the parts of the SVG surface that are decided without
 * a DOM.
 *
 * `icons/svg.ts` holds two sanitizers and one encoder. The sanitizers parse and
 * re-serialize through `DOMParser`/`XMLSerializer`, which Node has not got, and
 * this project's standing answer to that is the one written at the top of
 * `userImages.test.ts`: a test that stubbed a DOM would be testing the stub. So
 * the real sanitizer/DOM regression cases live in tests/browser/svgSecurity.ts,
 * run with scripts/test-svg-security.mjs against an existing Chromium install.
 *
 * What *is* here is everything on that surface that is pure or is decided before
 * the artwork is ever parsed:
 *
 * - **`svgToDataUri`**, which is not decoration. It is how a picture reaches a
 *   block callout at all: CSSInjector paints one as a `url()` background rather
 *   than as DOM, and an SVG is *full* of characters a CSS URL reads as syntax.
 *   `#` is the sharp one — it opens a fragment, so a single unescaped `fill="#f00"`
 *   truncates the whole image at the first colour it declares.
 * - **`followsCalloutColor`**, the one predicate that decides whether a picture
 *   is stencilled in the callout's colour or left with its own. Two surfaces
 *   split on it — CSS choosing between a mask and a background image, and
 *   renderIcon choosing whether to recolour the DOM copy — and they must not be
 *   able to disagree.
 * - **`importImageFile`'s guards**, which run off the file's own bytes before
 *   anything is decoded: the size ceiling, and format detection by signature
 *   rather than by the extension somebody typed.
 */
import assert from "node:assert";
import { describe, it } from "node:test";
import { svgToDataUri } from "../src/icons/svg";
import { followsCalloutColor } from "../src/icons/packs/userImages";
import {
	USER_IMAGE_ACCEPT,
	importImageFile,
} from "../src/icons/userImageImport";
import type { CalloutIcon, UserImageIcon } from "../src/types";

/* ------------------------------------------------------------------ *
 * svgToDataUri
 * ------------------------------------------------------------------ */

/** The payload inside `url("data:image/svg+xml,…")`. */
function payload(uri: string): string {
	const match = /^url\("data:image\/svg\+xml,([\s\S]*)"\)$/.exec(uri);
	assert.ok(match, `not a data URI: ${uri.slice(0, 80)}`);
	return match[1] ?? "";
}

describe("svgToDataUri", () => {
	it("wraps the markup as a CSS url() value", () => {
		const uri = svgToDataUri("<svg/>");
		assert.ok(uri.startsWith(`url("data:image/svg+xml,`));
		assert.ok(uri.endsWith(`")`));
	});

	it("escapes `#`, which would otherwise truncate the image", () => {
		// The failure this exists to prevent: `#` starts a URL fragment, so an
		// unescaped `fill="#f00"` ends the data URI right there and the callout
		// shows no icon at all.
		const uri = svgToDataUri(`<svg><path fill="#ff0000"/></svg>`);
		assert.ok(!payload(uri).includes("#"), "a raw # survived into the URL");
		assert.ok(payload(uri).includes("%23"));
	});

	it("escapes every `#`, not just the first", () => {
		const uri = svgToDataUri(`<svg><stop stop-color="#000"/><stop stop-color="#fff"/></svg>`);
		assert.equal((payload(uri).match(/%23/g) ?? []).length, 2);
		assert.ok(!payload(uri).includes("#"));
	});

	it("escapes the double quote that would close the url() itself", () => {
		// The value is wrapped in double quotes, so an SVG's own attribute quotes
		// have to stop being quotes.
		const uri = svgToDataUri(`<svg viewBox="0 0 24 24"/>`);
		assert.ok(!payload(uri).includes('"'), "a raw quote survived");
		assert.ok(payload(uri).includes("%22"));
	});

	it("escapes the single quote too, which encodeURIComponent leaves alone", () => {
		// `encodeURIComponent` deliberately preserves `'`; a picture written with
		// single-quoted attributes would otherwise carry them into the URL.
		const uri = svgToDataUri("<svg viewBox='0 0 24 24'/>");
		assert.ok(!payload(uri).includes("'"), "a raw apostrophe survived");
		assert.ok(payload(uri).includes("%27"));
	});

	it("percent-encodes non-ASCII as UTF-8", () => {
		// A user's own picture can carry a `<title>` in any language, and a data
		// URI is bytes.
		const uri = svgToDataUri("<svg><title>עברית</title></svg>");
		const text = payload(uri);
		assert.ok(!/[^\x20-\x7e]/.test(text), "a raw non-ASCII byte survived");
		assert.ok(text.includes("%D7%A2"), text.slice(0, 80));
	});

	it("survives an emoji outside the basic plane", () => {
		const uri = svgToDataUri("<svg><title>😀</title></svg>");
		assert.equal(
			decodeURIComponent(payload(uri).replace(/%27/g, "'").replace(/%22/g, '"')),
			"<svg><title>😀</title></svg>",
		);
	});

	it("round-trips the markup byte for byte", () => {
		// The point of the whole function: what the browser decodes must be what
		// the sanitizer approved, unchanged.
		const svg =
			`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">` +
			`<path d="M1 1L2 2Z" fill="#3b82f6"/><title>a&amp;b</title></svg>`;
		assert.equal(
			decodeURIComponent(payload(svgToDataUri(svg)).replace(/%22/g, '"')),
			svg,
		);
	});

	it("escapes the whitespace an unquoted url() token would end on", () => {
		const text = payload(svgToDataUri("<svg>\n  <g/>\n</svg>"));
		assert.ok(!/\s/.test(text), "raw whitespace survived");
		assert.ok(text.includes("%0A") && text.includes("%20"));
	});

	it("leaves parentheses raw, which the quoted form makes safe", () => {
		// `encodeURIComponent` preserves `(` and `)`, and a transform list is full
		// of them. That is sound only because the value is emitted *quoted*: an
		// unquoted `url(data:…translate(1 2)…)` would close at the inner paren.
		// So the quotes in the template are load-bearing, not cosmetic.
		const uri = svgToDataUri(`<svg><g transform="translate(1 2)"/></svg>`);
		assert.ok(payload(uri).includes("translate(1%202)"));
		assert.ok(uri.startsWith(`url("`) && uri.endsWith(`")`));
	});

	it("encodes an empty string without producing something unparseable", () => {
		assert.equal(svgToDataUri(""), `url("data:image/svg+xml,")`);
	});
});

/* ------------------------------------------------------------------ *
 * followsCalloutColor
 * ------------------------------------------------------------------ */

describe("followsCalloutColor", () => {
	const image = (over: Partial<UserImageIcon> = {}): UserImageIcon => ({
		id: "img-1",
		name: "logo.svg",
		format: "svg",
		svg: "<svg/>",
		width: 24,
		height: 24,
		monochrome: true,
		rev: 1,
		addedAt: 0,
		...over,
	});
	const icon = (over: Partial<CalloutIcon> = {}): CalloutIcon => ({
		type: "image",
		value: "img-1",
		...over,
	});

	it("stencils a vector picture the callout asked to recolour", () => {
		assert.equal(followsCalloutColor(icon({ recolor: true }), image()), true);
	});

	it("leaves a picture alone when the callout did not ask", () => {
		// The choice is the callout's; `monochrome` only decides what is *offered*
		// when the picture is first picked.
		assert.equal(followsCalloutColor(icon(), image()), false);
		assert.equal(followsCalloutColor(icon({ recolor: false }), image()), false);
	});

	it("never stencils a raster, however the callout is set", () => {
		// The capability is the artwork's: a mask is a stencil, so recolouring a
		// photograph would come out as a silhouette.
		for (const format of ["png", "jpeg", "webp"] as const) {
			assert.equal(
				followsCalloutColor(icon({ recolor: true }), image({ format })),
				false,
				format,
			);
		}
	});

	it("says no once the picture has been deleted", () => {
		// Same answer as any library icon: the ordinary monochrome treatment.
		assert.equal(followsCalloutColor(icon({ recolor: true }), undefined), false);
	});

	it("says no for a library icon, which has no colours of its own to keep", () => {
		assert.equal(
			followsCalloutColor({ type: "octicons", value: "alert", recolor: true }, undefined),
			false,
		);
	});
});

/* ------------------------------------------------------------------ *
 * importImageFile — the guards that run before anything is decoded
 * ------------------------------------------------------------------ */

/** A `File` built from raw bytes, as the picker or a drop would hand one over. */
function file(name: string, bytes: number[] | string, size?: number): File {
	const body =
		typeof bytes === "string" ? bytes : new Uint8Array(bytes);
	const real = new File([body], name);
	if (size === undefined) return real;
	// `File.size` is read-only; a five-megabyte fixture would be five megabytes
	// of test, and the ceiling is checked before a single byte is read.
	return Object.defineProperty(real, "size", { value: size });
}

const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const JPEG = [0xff, 0xd8, 0xff, 0xe0];
const WEBP = [0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50];

describe("importImageFile — the size ceiling", () => {
	it("refuses a file too big to be an icon, before decoding it", async () => {
		const result = await importImageFile(file("huge.png", PNG, 5 * 1024 * 1024 + 1));
		assert.equal(result.ok, false);
		assert.equal(result.ok ? "" : result.reason, "iconPicker.imageTooLarge");
	});

	it("accepts a file of exactly the ceiling as far as the size check", async () => {
		// The guard is `>`, not `>=`; anything past it here fails for a later
		// reason, which is what the next block is about.
		const result = await importImageFile(file("big.png", PNG, 5 * 1024 * 1024));
		assert.notEqual(result.ok ? "" : result.reason, "iconPicker.imageTooLarge");
	});
});

describe("importImageFile — what the file actually is", () => {
	const reason = async (f: File): Promise<string> => {
		const result = await importImageFile(f);
		assert.equal(result.ok, false, "expected this file to be refused");
		return result.ok ? "" : result.reason;
	};

	it("refuses a file whose first bytes are no picture at all", async () => {
		assert.equal(
			await reason(file("notes.txt", "just some text")),
			"iconPicker.imageUnsupported",
		);
		assert.equal(await reason(file("empty.png", "")), "iconPicker.imageUnsupported");
	});

	it("refuses a PDF, whatever it has been renamed to", async () => {
		assert.equal(
			await reason(file("logo.png", "%PDF-1.7\n")),
			"iconPicker.imageUnsupported",
		);
	});

	it("refuses a GIF — a real picture, but not one of the four offered", async () => {
		assert.equal(await reason(file("anim.gif", "GIF89a")), "iconPicker.imageUnsupported");
	});

	it("refuses a RIFF container that is not WebP", async () => {
		const wav = [0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x41, 0x56, 0x45];
		assert.equal(await reason(file("sound.webp", wav)), "iconPicker.imageUnsupported");
	});

	it("reads the signature, not the extension somebody typed", async () => {
		// A `.png` that is really a JPEG is routine, and trusting the name would
		// reject perfectly good pictures. Each of these is recognised as a
		// picture and gets past detection — it then fails on decoding, which
		// needs a canvas this runtime has not got.
		for (const [name, bytes] of [
			["photo.png", JPEG],
			["logo.jpg", PNG],
			["shot.png", WEBP],
		] as const) {
			assert.equal(
				await reason(file(name, [...bytes])),
				"iconPicker.imageDecodeFailed",
				name,
			);
		}
	});

	it("recognises SVG through a BOM, a declaration, or a leading comment", async () => {
		// SVG is text and may open with any of these before the root element
		// appears; a naive `startsWith("<svg")` would refuse files every editor
		// emits. Each gets past detection and fails later, in the DOM parse.
		for (const head of [
			"<svg xmlns='http://www.w3.org/2000/svg'/>",
			"﻿<svg/>",
			`<?xml version="1.0"?><svg/>`,
			"<!-- Generator: Illustrator --><svg/>",
			"   \n<svg/>",
		]) {
			const result = await importImageFile(file("logo.svg", head));
			assert.equal(result.ok, false);
			assert.notEqual(
				result.ok ? "" : result.reason,
				"iconPicker.imageUnsupported",
				`not recognised as SVG: ${head.slice(0, 30)}`,
			);
		}
	});

	it("never throws, whatever it is handed", async () => {
		// A bad file is an outcome the picker reports, not an error that should
		// abandon the rest of a multi-file drop.
		for (const f of [
			file("x.svg", "<svg"),
			file("x.png", PNG),
			file("x", ""),
			file("x.webp", [0x52, 0x49]),
		]) {
			const result = await importImageFile(f);
			assert.equal(typeof result.ok, "boolean");
		}
	});
});

describe("USER_IMAGE_ACCEPT", () => {
	it("offers exactly the formats the importer can detect", () => {
		assert.equal(USER_IMAGE_ACCEPT, ".svg,.png,.jpg,.jpeg,.webp");
	});

	it("names both spellings of JPEG, which the file picker matches literally", () => {
		assert.ok(USER_IMAGE_ACCEPT.includes(".jpg"));
		assert.ok(USER_IMAGE_ACCEPT.includes(".jpeg"));
	});
});
