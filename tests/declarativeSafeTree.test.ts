/**
 * tests/declarativeSafeTree.test.ts — the settings tree never lets an error
 * out (settings/declarative/safeTree.ts).
 *
 * Obsidian catches neither an error while building the tree (it would stop the
 * plugin from loading, since `addSettingTab` builds it) nor one in a render
 * row (it would stop the rest of the page drawing). Both are caught here.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Setting, SettingGroup } from "obsidian";
import { buildTreeSafely, guardRender } from "../src/settings/declarative/safeTree";

/** Run `body` with `console.error` recorded instead of printed. */
function withConsoleErrors(body: (errors: unknown[][]) => void): void {
	const errors: unknown[][] = [];
	const original = console.error;
	console.error = (...args: unknown[]) => { errors.push(args); };
	try {
		body(errors);
	} finally {
		console.error = original;
	}
}

describe("buildTreeSafely", () => {
	it("returns the tree when building works", () => {
		const tree = [{ name: "Row" }];
		assert.equal(buildTreeSafely(() => tree, []), tree);
	});

	it("returns the fallback, and says why in the console, when building throws", () => {
		withConsoleErrors((errors) => {
			const fallback = [{ name: "Fallback" }];
			assert.equal(buildTreeSafely(() => { throw new Error("broken"); }, fallback), fallback);
			assert.equal(errors.length, 1);
		});
	});
});

describe("guardRender", () => {
	const setting = {} as Setting;
	const group = {} as SettingGroup;

	it("passes the row's cleanup through", () => {
		const cleanup = () => {};
		assert.equal(guardRender("Row", () => cleanup)(setting, group), cleanup);
	});

	it("keeps a throwing row from stopping the page, naming it in the console", () => {
		withConsoleErrors((errors) => {
			assert.equal(guardRender("Broken row", () => { throw new Error("oops"); })(setting, group), undefined);
			assert.match(String(errors[0]?.[0]), /Broken row/);
		});
	});
});
