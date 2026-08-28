/**
 * tests/discoveredRowPersistence.test.ts — the three claims that make a
 * discovered row real.
 *
 * `isEphemeralDiscoveredRow` decides whether `data.json` may describe a row, and
 * it is the same question `CalloutDiscovery.pruneUnused` asks about whether the
 * row may be deleted. That is deliberate and worth pinning: a row the prune
 * refuses to delete is a row the file has to keep, or a restart loses it.
 *
 * The one thing it must NOT consult is theme ownership. That is derived from
 * the theme active on *this* device, so letting it decide what gets written
 * would put per-device state straight back into the synced file — the whole
 * failure being fixed.
 */
import assert from "node:assert";
import { describe, it } from "node:test";
import {
	isEphemeralDiscoveredRow,
	selectPersistedRows,
} from "../src/manager/discoveredRowPersistence";
import type { CalloutDefinition, CustomCommand } from "../src/types";

const row = (over: Partial<CalloutDefinition> = {}): CalloutDefinition => ({
	id: "seen",
	displayName: "Seen",
	icon: { type: "lucide", value: "star" },
	colorLight: "#111111",
	colorDark: "#eeeeee",
	foldable: true,
	defaultFolded: false,
	builtIn: false,
	source: "fallback",
	...over,
});

const command = (calloutId: string) =>
	({ id: "c1", calloutId }) as unknown as CustomCommand;

describe("isEphemeralDiscoveredRow", () => {
	it("is true for a discovered row nobody has claimed", () => {
		assert.strictEqual(isEphemeralDiscoveredRow(row(), []), true);
	});

	it("is false for anything discovery did not mint", () => {
		for (const source of ["user", "builtin", "theme", "plugin"] as const) {
			assert.strictEqual(
				isEphemeralDiscoveredRow(row({ source }), []),
				false,
				source,
			);
		}
	});

	it("is false once the user has customized it", () => {
		assert.strictEqual(
			isEphemeralDiscoveredRow(row({ customized: true }), []),
			false,
		);
	});

	it("is false once the user has handed its styling to their own CSS", () => {
		// Sharper than "they chose it": drop the row and the id falls back under
		// generateFallbackCSS's `!important` catch-all, so a callout explicitly
		// handed off would silently start being repainted again.
		assert.strictEqual(
			isEphemeralDiscoveredRow(row({ externalStyle: true }), []),
			false,
		);
	});

	it("is false once a custom command points at it", () => {
		assert.strictEqual(
			isEphemeralDiscoveredRow(row({ id: "seen" }), [command("seen")]),
			false,
		);
	});

	it("matches a command's callout by identity, not by spelling", () => {
		// A hotkey is bound to that command; keying by spelling would drop the
		// row through the dash form and orphan the binding.
		assert.strictEqual(
			isEphemeralDiscoveredRow(row({ id: "two words" }), [
				command("two-words"),
			]),
			false,
		);
	});

	it("is unmoved by a command pointing somewhere else", () => {
		assert.strictEqual(
			isEphemeralDiscoveredRow(row({ id: "seen" }), [command("other")]),
			true,
		);
	});

	it("takes `customized: false` as unclaimed", () => {
		// The flag means "the user adopted it"; only `true` says so.
		assert.strictEqual(
			isEphemeralDiscoveredRow(row({ customized: false }), []),
			true,
		);
	});
});

describe("selectPersistedRows", () => {
	const ctx = (over = {}) => ({
		previewActiveId: null,
		previewShadowedDef: null,
		customCommands: [] as CustomCommand[],
		builtInDefault: () => undefined,
		...over,
	});
	const ids = (defs: CalloutDefinition[]) => defs.map((d) => d.id);
	const map = (defs: CalloutDefinition[]) =>
		new Map(defs.map((d) => [d.id, d]));

	it("keeps the user's own rows and drops the observed ones", () => {
		const rows = map([
			row({ id: "mine", source: "user" }),
			row({ id: "seen" }),
		]);
		assert.deepStrictEqual(ids(selectPersistedRows(rows, ctx())), ["mine"]);
	});

	it("drops a theme row, which is re-derived every launch", () => {
		const rows = map([row({ id: "themed", source: "theme" })]);
		assert.deepStrictEqual(selectPersistedRows(rows, ctx()), []);
	});

	it("writes the shadowed original rather than a live preview", () => {
		// A background save mid-edit must neither drop the real definition nor
		// leak the draft.
		const real = row({ id: "editing", source: "user", colorLight: "#000000" });
		const draft = row({ id: "editing", source: "user", colorLight: "#ffffff" });
		const out = selectPersistedRows(
			map([draft]),
			ctx({ previewActiveId: "editing", previewShadowedDef: real }),
		);
		assert.deepStrictEqual(out, [real]);
	});

	it("drops a preview that shadows nothing at all", () => {
		const rows = map([row({ id: "draft", source: "user" })]);
		const out = selectPersistedRows(
			rows,
			ctx({ previewActiveId: "draft", previewShadowedDef: null }),
		);
		assert.deepStrictEqual(out, []);
	});

	it("writes a built-in only once it differs from its shipped default", () => {
		const shipped = row({ id: "note", builtIn: true, source: "builtin" });
		const edited = { ...shipped, colorLight: "#abcdef" };
		const unchanged = selectPersistedRows(
			map([{ ...shipped }]),
			ctx({ builtInDefault: () => shipped }),
		);
		assert.deepStrictEqual(unchanged, []);

		const changed = selectPersistedRows(
			map([edited]),
			ctx({ builtInDefault: () => shipped }),
		);
		assert.deepStrictEqual(ids(changed), ["note"]);
	});
});
