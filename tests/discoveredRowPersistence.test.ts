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

	it("keeps both authored and manually discovered rows", () => {
		const rows = map([
			row({ id: "mine", source: "user" }),
			row({ id: "seen" }),
		]);
		assert.deepStrictEqual(ids(selectPersistedRows(rows, ctx())), ["mine", "seen"]);
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
