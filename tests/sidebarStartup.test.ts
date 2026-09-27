import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { App } from "obsidian";
import { initializeSidebarTabs } from "../src/ui/initializeSidebarTabs";

describe("sidebar tabs at startup", () => {
	it("removes only a restored conversion tab before creating the inactive Find callouts tab", async () => {
		const events: unknown[][] = [];
		const app = { workspace: {
			detachLeavesOfType: (type: string) => { events.push(["detach", type]); },
			ensureSideLeaf: async (type: string, side: string, options: unknown) => {
				events.push(["ensure", type, side, options]);
				return {
					loadIfDeferred: () => { throw new Error("The background tab must remain deferred"); },
					setViewState: () => { throw new Error("The background tab must keep its saved state"); },
				};
			},
			revealLeaf: () => { throw new Error("The sidebar must remain hidden"); },
		} } as unknown as App;

		await initializeSidebarTabs(app);

		assert.deepEqual(events, [
			["detach", "callout-studio-portable-conversion"],
			["ensure", "callout-studio-occurrences", "right", { active: false, reveal: false }],
		]);
	});
});
