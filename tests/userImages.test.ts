/**
 * tests/userImages.test.ts — naming and validating the user's own pictures.
 *
 * The naming rules look cosmetic and are not. A picture's name is its identity
 * in the grid *and* the key the duplicate rule reads, and the extension is half
 * of that key: `logo.svg` and `logo.png` are two pictures, while two `logo.png`
 * are the same one twice. Three consequences are tested below — the extension is
 * never truncated away, comparison is case-insensitive because the file systems
 * these names come from are, and a collision renames rather than drops, because
 * an import is a batch with nobody to ask and dropping would quietly cost a
 * callout its icon.
 *
 * `sanitizeUserImages` is covered here only up to the point where it hands the
 * markup to `sanitizeUserSvg`, which needs a real `DOMParser`. Node has none, so
 * every case below is one that is decided *before* the artwork is filtered —
 * which is all of the "junk input, missing fields, missing SVG" surface. Which
 * drawings survive the filter is exercised in the app, not here; a test that
 * stubbed a DOM would be testing the stub.
 *
 * Node's missing `DOMParser` does buy one real case, and the last suite spends
 * it: a filter that cannot run at all. That is the shape of the risk in the app
 * too — this runs inside `mergeSavedSettings`, on the load path, so a picture
 * that makes the filter throw must cost that picture and not the whole plugin.
 */
import assert from "node:assert";
import { describe, it } from "node:test";
import {
	claimUserImageName,
	newUserImageId,
	normalizeUserImageName,
	sanitizeUserImages,
	takenUserImageNames,
	userImageNameFromFilename,
} from "../src/utils/userImages";
import type { UserImageIcon } from "../src/types";

/** The cap `userImageNameFromFilename` enforces. */
const MAX_NAME_LENGTH = 60;

function image(over: Partial<UserImageIcon> = {}): UserImageIcon {
	return {
		id: "img-0000abcd",
		name: "logo.svg",
		format: "svg",
		svg: "<svg/>",
		width: 24,
		height: 24,
		monochrome: false,
		rev: 1,
		addedAt: 0,
		...over,
	};
}

describe("userImageNameFromFilename", () => {
	it("keeps the filename exactly as the OS shows it", () => {
		// Nothing is prettified: a name the user did not choose is a name they
		// have to re-learn to recognize in the grid.
		assert.equal(userImageNameFromFilename("logo.svg"), "logo.svg");
		assert.equal(userImageNameFromFilename("My Logo (final).PNG"), "My Logo (final).PNG");
		assert.equal(userImageNameFromFilename("my-icon_2.webp"), "my-icon_2.webp");
	});

	it("trims surrounding whitespace", () => {
		assert.equal(userImageNameFromFilename("  logo.svg  "), "logo.svg");
	});

	it("falls back to `Image` for a name with nothing in it", () => {
		assert.equal(userImageNameFromFilename(""), "Image");
		assert.equal(userImageNameFromFilename("   "), "Image");
		assert.equal(userImageNameFromFilename("\t\n"), "Image");
	});

	it("keeps every dot in a multi-dot name", () => {
		assert.equal(userImageNameFromFilename("archive.tar.gz.png"), "archive.tar.gz.png");
	});

	it("keeps a name of exactly the cap", () => {
		const name = `${"a".repeat(MAX_NAME_LENGTH - 4)}.png`;
		assert.equal(name.length, MAX_NAME_LENGTH);
		assert.equal(userImageNameFromFilename(name), name);
	});

	it("shortens the stem and NEVER the extension", () => {
		// The extension is what the duplicate rule reads; dropping it would
		// merge two distinct pictures.
		const long = `${"a".repeat(200)}.png`;
		const out = userImageNameFromFilename(long);
		assert.ok(out.endsWith(".png"), out);
		assert.equal(out.length, MAX_NAME_LENGTH);
	});

	it("trims the stem's trailing space rather than leaving `foo .png`", () => {
		const long = `${"a".repeat(MAX_NAME_LENGTH - 5)} bbbbbbbbbb.png`;
		const out = userImageNameFromFilename(long);
		assert.ok(!out.includes(" ."), out);
	});

	it("truncates a name with no extension at all", () => {
		const out = userImageNameFromFilename("b".repeat(200));
		assert.equal(out.length, MAX_NAME_LENGTH);
		assert.ok(!out.includes("."));
	});

	it("treats a leading dot as part of the stem, not as an extension", () => {
		// `.gitignore` has no extension — lastIndexOf(".") is 0, not > 0.
		assert.equal(userImageNameFromFilename(".hidden"), ".hidden");
		const out = userImageNameFromFilename(`.${"c".repeat(200)}`);
		assert.equal(out.length, MAX_NAME_LENGTH);
	});

	it("never returns an empty name", () => {
		for (const raw of ["", " ", ".", "..", "x", `${"y".repeat(300)}.jpeg`]) {
			assert.ok(userImageNameFromFilename(raw).length > 0, JSON.stringify(raw));
		}
	});
});

describe("normalizeUserImageName", () => {
	it("folds case, because macOS and Windows do", () => {
		assert.equal(normalizeUserImageName("Logo.PNG"), "logo.png");
		assert.equal(normalizeUserImageName("LOGO.png"), normalizeUserImageName("logo.PNG"));
	});

	it("trims", () => {
		assert.equal(normalizeUserImageName("  logo.svg "), "logo.svg");
	});

	it("keeps the extension in the comparison key", () => {
		// Two real pictures, not one: the extension has to survive normalization.
		assert.notEqual(normalizeUserImageName("logo.svg"), normalizeUserImageName("logo.png"));
	});

	it("is idempotent", () => {
		const once = normalizeUserImageName("  Logo.PNG ");
		assert.equal(normalizeUserImageName(once), once);
	});
});

describe("takenUserImageNames", () => {
	it("collects the normalized names of a collection", () => {
		const taken = takenUserImageNames([image({ id: "a", name: "Logo.PNG" }), image({ id: "b", name: "icon.svg" })]);
		assert.ok(taken.has("logo.png"));
		assert.ok(taken.has("icon.svg"));
		assert.ok(!taken.has("Logo.PNG"));
	});

	it("collapses names that differ only by case", () => {
		const taken = takenUserImageNames([image({ id: "a", name: "logo.png" }), image({ id: "b", name: "LOGO.PNG" })]);
		assert.equal(taken.size, 1);
	});

	it("is empty for an empty collection", () => {
		assert.equal(takenUserImageNames([]).size, 0);
	});
});

describe("claimUserImageName", () => {
	it("returns a free name unchanged", () => {
		const taken = new Set<string>();
		assert.equal(claimUserImageName("logo.svg", taken, "img-1"), "logo.svg");
	});

	it("marks what it returned as taken, so the next caller gets another", () => {
		const taken = new Set<string>();
		assert.equal(claimUserImageName("logo.svg", taken, "img-1"), "logo.svg");
		assert.equal(claimUserImageName("logo.svg", taken, "img-2"), "logo (2).svg");
		assert.equal(claimUserImageName("logo.svg", taken, "img-3"), "logo (3).svg");
	});

	it("numbers before the extension, never after it", () => {
		const taken = new Set(["logo.svg"]);
		assert.equal(claimUserImageName("logo.svg", taken, "img-1"), "logo (2).svg");
	});

	it("handles a name with no extension", () => {
		const taken = new Set(["logo"]);
		assert.equal(claimUserImageName("logo", taken, "img-1"), "logo (2)");
	});

	it("handles a multi-dot name by splitting at the LAST dot", () => {
		const taken = new Set(["a.b.png"]);
		assert.equal(claimUserImageName("a.b.png", taken, "img-1"), "a.b (2).png");
	});

	it("compares case-insensitively when deciding a name is taken", () => {
		const taken = new Set(["logo.png"]);
		assert.equal(claimUserImageName("LOGO.PNG", taken, "img-1"), "LOGO (2).PNG");
	});

	it("falls back to the picture's own id when every number is spoken for", () => {
		// The loop is bounded; `unique` is the way out, and it collides with
		// nothing because it is the id.
		const taken = new Set(["logo.png"]);
		for (let n = 2; n < 100; n++) taken.add(`logo (${n}).png`);
		const claimed = claimUserImageName("logo.png", taken, "img-dead10cc");
		assert.equal(claimed, "logo (img-dead10cc).png");
		assert.ok(taken.has("logo (img-dead10cc).png"));
	});

	it("keeps the result inside the length cap", () => {
		const long = `${"a".repeat(MAX_NAME_LENGTH - 4)}.png`;
		const taken = new Set([normalizeUserImageName(long)]);
		const claimed = claimUserImageName(long, taken, "img-1");
		assert.ok(claimed.length <= MAX_NAME_LENGTH, `${claimed.length}: ${claimed}`);
		assert.ok(claimed.endsWith(".png"));
	});

	it("makes room for the number on a stem already at the cap", () => {
		// The regression this guards: building the candidate as
		// `${stem} (2)${ext}` and truncating the result afterwards throws the
		// ` (2)` away again on a maximal stem, so the numbered loop makes no
		// progress and hands back the name it was avoiding. Shortening the stem
		// instead keeps the suffix, which is the only part that makes the name
		// new.
		const capped = userImageNameFromFilename(`${"a".repeat(300)}.png`);
		const taken = new Set([normalizeUserImageName(capped)]);
		const claimed = claimUserImageName(capped, taken, "img-abcd1234");
		assert.ok(claimed.length <= MAX_NAME_LENGTH, `${claimed.length}: ${claimed}`);
		assert.ok(claimed.endsWith(" (2).png"), `suffix truncated away: ${claimed}`);
		assert.notEqual(
			normalizeUserImageName(claimed),
			normalizeUserImageName(capped),
			"handed back a name that was already taken",
		);
	});

	it("keeps the id fallback free of collisions even at the cap", () => {
		// The doc promises `unique` "collides with nothing, because it is the
		// picture's own id". That is only true while the id survives the length
		// cap — appending it to a maximal stem and truncating afterwards cut it
		// straight back off, and the fallback returned the taken name.
		const capped = userImageNameFromFilename(`${"a".repeat(300)}.png`);
		const taken = new Set([normalizeUserImageName(capped)]);
		// Every number spoken for, so only the id fallback is left. Claimed
		// through the function itself rather than spelled out, so the set holds
		// exactly the names it really hands out.
		for (let n = 2; n < 100; n++) claimUserImageName(capped, taken, `img-${n}`);
		const before = new Set(taken);

		const claimed = claimUserImageName(capped, taken, "img-abcd1234");
		assert.ok(claimed.includes("(img-abcd1234)"), `the id was truncated out of the fallback name: ${claimed}`);
		assert.ok(
			!before.has(normalizeUserImageName(claimed)),
			`handed back a name that was already taken: ${claimed}`,
		);
		assert.ok(claimed.length <= MAX_NAME_LENGTH, `${claimed.length}: ${claimed}`);
		assert.ok(claimed.endsWith(".png"), claimed);
	});

	it("leaves room for the suffix whenever the stem is short enough", () => {
		// The ordinary case, and the reason the gap above stays narrow.
		const name = `${"a".repeat(40)}.png`;
		const taken = new Set([normalizeUserImageName(name)]);
		const claimed = claimUserImageName(name, taken, "img-abcd1234");
		assert.notEqual(normalizeUserImageName(claimed), normalizeUserImageName(name));
		assert.ok(claimed.endsWith(" (2).png"), claimed);
	});

	it("never hands the same name out twice over a long run", () => {
		const taken = new Set<string>();
		const claimed = new Set<string>();
		for (let i = 0; i < 50; i++) {
			const name = claimUserImageName("logo.png", taken, `img-${i}`);
			assert.ok(!claimed.has(normalizeUserImageName(name)), name);
			claimed.add(normalizeUserImageName(name));
		}
	});
});

describe("newUserImageId", () => {
	it("has the stored-id shape", () => {
		assert.match(newUserImageId(), /^img-[0-9a-f]{8}$/);
	});

	it("is short — it is copied into every callout that uses the picture", () => {
		assert.equal(newUserImageId().length, 12);
	});

	it("does not repeat over a large run", () => {
		const seen = new Set<string>();
		for (let i = 0; i < 5000; i++) seen.add(newUserImageId());
		// 32 bits of randomness: a handful of birthday collisions is expected
		// and harmless (the caller re-rolls), a systematic repeat is not.
		assert.ok(seen.size > 4990, `only ${seen.size} distinct ids`);
	});
});

describe("sanitizeUserImages — what is refused before the artwork is even read", () => {
	it("returns an empty list for anything that is not an array", () => {
		for (const junk of [null, undefined, {}, "images", 0, true]) {
			assert.deepStrictEqual(sanitizeUserImages(junk), [], JSON.stringify(junk));
		}
	});

	it("returns an empty list for an empty array", () => {
		assert.deepStrictEqual(sanitizeUserImages([]), []);
	});

	it("drops entries that are not objects", () => {
		assert.deepStrictEqual(sanitizeUserImages([null, undefined, 1, "x", true]), []);
	});

	it("drops an entry with no usable id", () => {
		assert.deepStrictEqual(
			sanitizeUserImages([
				{ ...image(), id: undefined },
				{ ...image(), id: "" },
				{ ...image(), id: 42 },
			]),
			[],
		);
	});

	it("drops an entry with no usable name", () => {
		assert.deepStrictEqual(
			sanitizeUserImages([
				{ ...image(), name: undefined },
				{ ...image(), name: "" },
				{ ...image(), name: 7 },
			]),
			[],
		);
	});

	it("drops an entry with no artwork at all", () => {
		// A picture with no artwork is not a degraded picture, it is nothing —
		// keeping it would put an un-drawable cell in the picker.
		assert.deepStrictEqual(
			sanitizeUserImages([
				{ ...image(), svg: undefined },
				{ ...image(), svg: "" },
				{ ...image(), svg: {} },
			]),
			[],
		);
	});

	it("drops an entry whose format is not one of the four", () => {
		assert.deepStrictEqual(
			sanitizeUserImages([
				{ ...image(), format: "gif" },
				{ ...image(), format: "jpg" },
				{ ...image(), format: undefined },
				{ ...image(), format: "SVG" },
			]),
			[],
		);
	});

	it("checks every required field, so one bad entry cannot pass on another's", () => {
		const result = sanitizeUserImages([{ id: "a" }, { name: "b.svg" }, { svg: "<svg/>" }, { format: "svg" }]);
		assert.deepStrictEqual(result, []);
	});

	it("never throws on hostile input", () => {
		// data.json syncs between devices and can be hand-edited, so this is a
		// real code path, not a hypothetical.
		assert.doesNotThrow(() =>
			sanitizeUserImages([
				Object.create(null),
				{ id: { toString: () => "x" } },
				{ id: "a", name: "b", svg: "", format: "png" },
				[],
			]),
		);
	});
});

describe("sanitizeUserImages — when the artwork filter cannot run at all", () => {
	it("drops the picture instead of throwing", () => {
		// `sanitizeUserSvg` needs `DOMParser`, which Node has not got — so in
		// here the filter does not refuse the drawing, it *explodes*. That is
		// worth pinning rather than working around: this function runs from
		// `mergeSavedSettings`, on the load path, before a single callout has
		// been styled. An escaping throw is not one missing icon, it is the
		// plugin failing to load and taking every callout's styling with it.
		assert.doesNotThrow(() => sanitizeUserImages([image()]));
		assert.deepStrictEqual(sanitizeUserImages([image()]), []);
	});

	it("lets nothing unfiltered through in its place", () => {
		// "The artwork could not be checked" and "the artwork did not pass" have
		// to have the same answer, or the repair would be worse than the crash.
		assert.deepStrictEqual(
			sanitizeUserImages([image({ svg: `<svg xmlns="http://www.w3.org/2000/svg"><script/></svg>` })]),
			[],
		);
	});

	it("keeps going after one entry blows up", () => {
		// Whether it is a broken drawing or a missing DOM, the loop has to reach
		// the entries behind it — otherwise one bad picture silently costs the
		// user every picture stored after it. Read through a getter, since in
		// Node every entry is dropped and the returned list cannot tell the two
		// apart.
		let reached = false;
		const second = {
			...image({ id: "b" }),
			get svg(): string {
				reached = true;
				return "<svg/>";
			},
		};
		sanitizeUserImages([image({ id: "a" }), second]);
		assert.ok(reached, "the loop stopped at the first unfilterable picture");
	});
});
