import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createRequire } from "node:module";
import { readRepoFile } from "./support/sourceScan";

const { parse } = createRequire(import.meta.url)("yaml") as typeof import("yaml");

interface ReleaseStep {
	run?: string;
	uses?: string;
	if?: string;
	"continue-on-error"?: boolean;
}

interface ReleaseWorkflow {
	jobs: { release: { steps: ReleaseStep[] } };
}

describe("tagged release validation", () => {
	it("requires build, lint and tests before attesting or publishing artifacts", () => {
		const workflow = parse(readRepoFile(".github/workflows/release.yml")) as ReleaseWorkflow;
		const steps = workflow.jobs.release.steps;
		const publish = steps.findIndex((step) =>
			/attest-build-provenance|action-gh-release/.test(step.uses ?? ""),
		);
		assert.ok(publish >= 0, "release artifacts must have a validation boundary");
		let previous = -1;
		for (const command of ["npm run build", "npm run lint", "npm test"]) {
			const index = steps.findIndex((step) => step.run === command);
			assert.ok(index > previous && index < publish, `${command} must gate artifact publication`);
			const step = steps[index]!;
			assert.equal(step.if, undefined, `${command} must run for every release tag`);
			assert.notEqual(step["continue-on-error"], true, `${command} failures must stop the release`);
			previous = index;
		}
	});
});
