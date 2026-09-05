import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { committedDefinitions, suggestableCallouts } from "../src/utils/usableCallouts";
import { CalloutRegistry } from "../src/manager/CalloutRegistry";
import { definition, discovered } from "./support/discoveryHarness";
import { PREVIEW_PLACEHOLDER_ID } from "../src/constants";

describe("saved callouts remain available without usage tracking", () => {
	it("keeps manually discovered rows in committed and suggestion lists", () => {
		const r = new CalloutRegistry(); r.load(null); r.add(discovered("saved"));
		assert.ok(committedDefinitions(r).some(d => d.id === "saved"));
		for (const role of ["regular", "heading", "inline"] as const) {
			assert.ok(suggestableCallouts(r, role).some(d => d.id === "saved"));
		}
	});
	it("keeps demo previews out of suggestions and committed definitions", () => {
		const r = new CalloutRegistry(); r.load(null);
		r.setPreviewDefinition(definition({ id: PREVIEW_PLACEHOLDER_ID }), true);
		assert.ok(!committedDefinitions(r).some(d => d.id === PREVIEW_PLACEHOLDER_ID));
		assert.ok(!suggestableCallouts(r, "regular").some(d => d.id === PREVIEW_PLACEHOLDER_ID));
	});
});
