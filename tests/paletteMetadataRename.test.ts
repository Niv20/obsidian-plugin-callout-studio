/**
 * tests/paletteMetadataRename.test.ts — when renaming a palette offers to
 * rewrite the notes that name it, and when it must not.
 *
 * A rename rewrites every `[!type|old-word]` in the vault, and a rewrite
 * cannot tell which callouts meant the palette. So the offer is only made for
 * a word that meant nothing else: never for a built-in colour's word (a
 * palette called "Pink" from before that preset) or one the theme or a snippet
 * styles — those notes may mean the other thing, and stay as written.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { App } from "obsidian";
import {
	isBuiltInColorWord,
	isStylingWord,
	offerMetadataRename,
	ownedMetadataKey,
} from "../src/settings/sections/paletteMetadataRename";
import type { CustomPalette } from "../src/types";

const palette = (id: string, name: string): CustomPalette => ({
	id,
	name,
	colorLight: "#aa0000",
	colorDark: "#ff5555",
	bgColorLight: "#ffeeee",
	bgColorDark: "#331111",
	textColorLight: "#111111",
	textColorDark: "#eeeeee",
});

/** An app whose vault fails the test if anything reads it. */
const untouchableApp = (): App =>
	({
		vault: new Proxy({}, { get: (_t, prop) => { throw new Error(`vault.${String(prop)} was read`); } }),
	}) as unknown as App;

describe("which words mean something else too", () => {
	it("knows the built-in colours and their aliases", () => {
		for (const word of ["pink", "purple", "gray", "grey", "sky"]) assert.ok(isBuiltInColorWord(word), word);
		for (const word of ["comic-red", "violet", "amber", "wide"]) assert.ok(!isBuiltInColorWord(word), word);
	});

	it("knows a styling word in any case the stylesheet would match", () => {
		const sources = [{ label: "Dune", words: [{ word: "Rot", placement: "spaced" as const, guards: null }] }];
		assert.ok(isStylingWord("rot", sources));
		assert.ok(!isStylingWord("blau", sources));
	});
});

describe("ownedMetadataKey", () => {
	it("is empty for a palette whose word the user's own snippet keeps", () => {
		const palettes = [palette("cp-1", "Comic Red")];
		assert.equal(ownedMetadataKey(palettes, "cp-1"), "comic-red");
		assert.equal(ownedMetadataKey(palettes, "cp-1", new Set(["comic-red"])), "");
	});
});

describe("offerMetadataRename", () => {
	it("asks nothing — and reads no note — for a word that means something else", async () => {
		await offerMetadataRename(untouchableApp(), "pink", "rose", (word) => isBuiltInColorWord(word));
		await offerMetadataRename(untouchableApp(), "rot", "ruby", (word) => word === "rot");
	});

	it("asks nothing when the word did not change, or there is no word", async () => {
		await offerMetadataRename(untouchableApp(), "comic-red", "comic-red", () => false);
		await offerMetadataRename(untouchableApp(), "", "comic-red", () => false);
		await offerMetadataRename(untouchableApp(), "comic-red", "", () => false);
	});
});
