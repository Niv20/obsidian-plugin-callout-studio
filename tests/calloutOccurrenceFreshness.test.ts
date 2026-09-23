import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getCalloutOccurrenceIndex } from "../src/usage/CalloutOccurrenceIndex";
import { deferred, occurrenceVault } from "./occurrenceIndexHarness";

describe("read failures changed during an occurrence scan", () => {
	for (const change of ["deleted", "modified", "replaced"] as const) {
		it(`discards a failure from a ${change} file and honors the pending refresh`, async () => {
			const h = occurrenceVault({ "a.md": "[!old]", "b.md": "[!b]" });
			h.failures.add("a.md");
			const gate = deferred<string>();
			h.held.set("b.md", gate.promise);
			const index = getCalloutOccurrenceIndex(h.app);
			const running = index.ensureFresh();
			while (!h.reads.includes("b.md")) await Promise.resolve();
			if (change !== "modified") h.remove("a.md");
			if (change !== "deleted") h.put("a.md", "[!new]");
			h.failures.delete("a.md");
			index.invalidate("a.md");
			assert.equal(index.ensureFresh(), running, "the event joins the still-running pass");
			gate.resolve("[!b]");
			await running;
			assert.equal(index.status, "stale", "the lifecycle can now honor the queued refresh");
			assert.deepEqual(index.failures, [], "the old read failure no longer describes this file");
			assert.equal(index.query(["b"]).totalCount, 1);
			await index.ensureFresh();
			assert.equal(index.status, "ready");
			assert.equal(index.query(["old"]).totalCount, 0);
			assert.equal(index.query(["new"]).totalCount, change === "deleted" ? 0 : 1);
			index.dispose();
		});
	}
});
