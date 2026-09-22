/**
 * tests/repoRelease.test.ts — the four facts that decide whether a release
 * installs, updates and keeps working, none of which any behavioural test can
 * see.
 *
 * Every one of them fails *after* publication, on someone else's machine:
 *
 * - **The version files agree.** Obsidian requires the git tag to equal
 *   `manifest.json`'s version exactly, and it reads `versions.json` to decide
 *   whether a given app build may take the update at all. `release.yml` already
 *   refuses a tag that disagrees with `manifest.json`/`package.json` — but it
 *   runs on the tag push, which is the last possible moment, and it does not
 *   look at `package-lock.json` at all. This runs on every commit instead, and
 *   covers the lockfile's two copies of the number, which `npm version` updates
 *   and a hand edit does not.
 * - **The manifest passes obsidian-releases' entry validation.** The community
 *   plugin list is gated by `validate-plugin-entry.yml`, whose rules are about
 *   the manifest, not the code: an id that contains "obsidian", a name that ends
 *   in "Plugin", a version with a leading `v`. Failing them costs a review
 *   round trip. `isDesktopOnly: false` is the local rule on top — this plugin
 *   deliberately runs on phones, and flipping it would silently drop every
 *   mobile install.
 * - **`main.js` fits its budget.** It is the only file Obsidian downloads to
 *   install or update, and icon metadata makes it trivially easy to add a
 *   megabyte without noticing — which is exactly what happened, and what moving
 *   31 locales out of the bundle undid. The ceiling is not restated here; it is
 *   *read out of* `release.yml`, so the gate that blocks publication and the
 *   gate that runs in `npm test` cannot drift apart.
 * - **Command ids have not moved.** Obsidian keys the user's hotkey by
 *   `callout-studio:<command id>`, so both halves of that string are frozen
 *   API. `fixedCommands.test.ts` already checks the declared list against what
 *   is really registered — which keeps them consistent with *each other*, and
 *   would happily pass through a rename of both. The frozen literal below is
 *   the missing half: it is a copy of what shipped, and it is deliberately not
 *   derived from anything.
 */
import assert from "node:assert";
import { statSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { FIXED_COMMAND_IDS, FIXED_COMMAND_NAME_KEYS } from "../src/editor/commands";
import { obsidianCommandId } from "../src/utils/customCommands";
import {
	REPO_ROOT,
	readRepoFile,
	readRepoJson,
	repoFileExists,
} from "./support/sourceScan";

interface Manifest {
	id: string;
	name: string;
	version: string;
	minAppVersion: string;
	description: string;
	author: string;
	authorUrl?: string;
	fundingUrl?: string;
	isDesktopOnly: boolean;
}

const manifest = readRepoJson<Manifest>("manifest.json");
const pkg = readRepoJson<{ name: string; version: string }>("package.json");
const lock = readRepoJson<{
	name: string;
	version: string;
	packages: Record<string, { name?: string; version?: string }>;
}>("package-lock.json");
const versions = readRepoJson<Record<string, string>>("versions.json");

const SEMVER = /^\d+\.\d+\.\d+$/;

/** `1.2.10` sorts after `1.2.9`, which is what a string compare gets wrong. */
function compareSemver(a: string, b: string): number {
	const pa = a.split(".").map(Number);
	const pb = b.split(".").map(Number);
	for (let i = 0; i < 3; i++) {
		const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
		if (diff !== 0) return diff;
	}
	return 0;
}

/* -------------------------------------------------------------------------- */
/* 148 — the four version files                                               */
/* -------------------------------------------------------------------------- */

describe("version files agree", () => {
	it("manifest, package.json and both lockfile copies carry one version", () => {
		assert.match(
			manifest.version,
			SEMVER,
			"manifest.json version must be bare `x.y.z` — Obsidian matches the tag literally, so a leading `v` or a pre-release suffix never installs",
		);
		assert.strictEqual(
			pkg.version,
			manifest.version,
			"package.json disagrees with manifest.json",
		);
		// `npm version` writes the number twice: once at the top level for
		// older consumers, once in the synthetic root package entry. A hand
		// edit typically updates the first and leaves the second stale.
		assert.strictEqual(
			lock.version,
			manifest.version,
			"package-lock.json (root) disagrees with manifest.json — run `npm install` after bumping",
		);
		assert.strictEqual(
			lock.packages[""]?.version,
			manifest.version,
			'package-lock.json (packages[""]) disagrees with manifest.json — run `npm install` after bumping',
		);
	});

	it("the package name is the plugin id", () => {
		// Not cosmetic: the lockfile, the vault folder and the community
		// registry key are all this string, and AGENTS.md pins the manifest id
		// as unrenameable. Keeping package.json on the same value means one
		// grep finds every place it has to change if that ever stops being true.
		assert.strictEqual(pkg.name, manifest.id);
		assert.strictEqual(lock.name, manifest.id);
		assert.strictEqual(lock.packages[""]?.name, manifest.id);
	});

	it("versions.json lists this version last, and maps it to minAppVersion", () => {
		const keys = Object.keys(versions);
		assert.ok(keys.length > 0, "versions.json is empty");
		assert.strictEqual(
			keys[keys.length - 1],
			manifest.version,
			"the newest versions.json entry is not the version being shipped",
		);
		assert.strictEqual(
			versions[manifest.version],
			manifest.minAppVersion,
			"versions.json maps this release to a different minAppVersion than manifest.json declares — Obsidian reads the map, so this is the one that would win",
		);
	});

	it("versions.json is in ascending order and free of duplicates", () => {
		// Order is load-bearing for the assertion above ("last key is this
		// release"), and JSON objects preserve insertion order only for keys
		// that are not array indices — every version string here qualifies.
		const keys = Object.keys(versions);
		const outOfOrder: string[] = [];
		for (let i = 1; i < keys.length; i++) {
			const prev = keys[i - 1] as string;
			const curr = keys[i] as string;
			assert.match(curr, SEMVER, `versions.json key "${curr}" is not x.y.z`);
			if (compareSemver(prev, curr) >= 0) outOfOrder.push(`${prev} → ${curr}`);
		}
		assert.deepStrictEqual(outOfOrder, [], "versions.json is not ascending");
		assert.strictEqual(
			new Set(keys).size,
			keys.length,
			"versions.json has a duplicate key",
		);
	});

	it("every minAppVersion in the map is a real version number", () => {
		for (const [version, min] of Object.entries(versions)) {
			assert.match(min, SEMVER, `versions.json["${version}"] = "${min}"`);
		}
	});
});

/* -------------------------------------------------------------------------- */
/* 149 — obsidian-releases entry validation                                    */
/* -------------------------------------------------------------------------- */

describe("manifest.json passes the community-plugin entry rules", () => {
	// The canonical list is obsidian-releases'
	// .github/workflows/validate-plugin-entry.yml. Only the rules that are
	// decidable from this file alone are here — uniqueness of the id across the
	// registry and the repo/author cross-check are not.

	it("has every required field", () => {
		for (const field of [
			"id",
			"name",
			"version",
			"minAppVersion",
			"description",
			"author",
		] as const) {
			const value = manifest[field];
			assert.ok(
				typeof value === "string" && value.length > 0,
				`manifest.json is missing "${field}"`,
			);
		}
	});

	it("id is lowercase kebab, without 'obsidian' and without a '-plugin' tail", () => {
		assert.match(
			manifest.id,
			/^[a-z0-9-]+$/,
			"plugin ids are lowercase letters, digits and hyphens only",
		);
		assert.ok(
			!manifest.id.includes("obsidian"),
			'a plugin id may not contain "obsidian"',
		);
		assert.ok(
			!manifest.id.endsWith("-plugin"),
			'a plugin id may not end with "-plugin"',
		);
	});

	it("id is the one that shipped and can never change", () => {
		// The vault folder name, the community-registry key and every command
		// id are this string. Renaming it is not an update — it is a new plugin
		// that leaves the old one installed and orphaned.
		assert.strictEqual(manifest.id, "callout-studio");
	});

	it("name does not repeat 'Obsidian' or end in 'Plugin'", () => {
		assert.ok(
			!/obsidian/i.test(manifest.name),
			'the display name may not contain "Obsidian"',
		);
		assert.ok(
			!/plugin$/i.test(manifest.name.trim()),
			'the display name may not end with "Plugin"',
		);
	});

	it("description is short, is not padded with boilerplate, and ends in a period", () => {
		assert.ok(
			manifest.description.length <= 250,
			`description is ${manifest.description.length} characters; the limit is 250`,
		);
		assert.ok(
			!/^(this|the|a|an)\s+(obsidian\s+)?plugin\b/i.test(manifest.description),
			'the description must not open with "This plugin…" — the context is already a plugin list',
		);
		assert.ok(
			manifest.description.trim().endsWith("."),
			"the description reads as a sentence and ends with a period",
		);
	});

	it("authorUrl does not point at obsidian.md", () => {
		if (manifest.authorUrl === undefined) return;
		assert.ok(
			!/obsidian\.md/i.test(manifest.authorUrl),
			"authorUrl must be the author's own page, not obsidian.md",
		);
		assert.match(manifest.authorUrl, /^https:\/\//, "authorUrl must be https");
	});

	it("minAppVersion is a real version and not ahead of what has shipped", () => {
		assert.match(manifest.minAppVersion, SEMVER);
		// A minAppVersion raised without a matching versions.json entry means
		// older apps keep being offered an update they cannot run.
		const mapped = Object.values(versions);
		assert.ok(
			mapped.includes(manifest.minAppVersion),
			`minAppVersion ${manifest.minAppVersion} appears nowhere in versions.json`,
		);
	});

	it("isDesktopOnly is false", () => {
		// The local rule, not obsidian-releases': mobile is a supported target
		// (it is why the startup CSS snapshot exists, and why Node APIs are
		// banned in src/). Flipping this hides the plugin on every phone.
		assert.strictEqual(manifest.isDesktopOnly, false);
	});

	it("carries no unknown top-level keys", () => {
		const known = new Set([
			"id",
			"name",
			"version",
			"minAppVersion",
			"description",
			"author",
			"authorUrl",
			"fundingUrl",
			"isDesktopOnly",
			"helpUrl",
		]);
		const unknown = Object.keys(manifest).filter((k) => !known.has(k));
		assert.deepStrictEqual(
			unknown,
			[],
			"Obsidian ignores unknown manifest keys, so one is always either a typo or a misremembered field name",
		);
	});
});

/* -------------------------------------------------------------------------- */
/* 157 — bundle budget                                                        */
/* -------------------------------------------------------------------------- */

describe("main.js stays inside its budget", () => {
	/**
	 * The limit, read out of the release workflow rather than restated.
	 *
	 * Two numbers for one budget is how a "4 MiB" test ends up passing while a
	 * 2 MiB publication gate fails — which is exactly the state this repository
	 * was in, the workflow having been cut to 2 MiB when the locales moved out
	 * of the bundle. Parsing it keeps one of them authoritative.
	 */
	const workflow = readRepoFile(".github/workflows/release.yml");
	const declared = /^\s*limit=(\d+)\b/m.exec(workflow);

	it("the release workflow still declares a limit this test can read", () => {
		assert.ok(
			declared,
			"could not find `limit=<bytes>` in .github/workflows/release.yml — if the size gate moved, point this test at its new home rather than hardcoding a second number",
		);
	});

	it("is under the limit the release workflow enforces", () => {
		if (!repoFileExists("main.js")) {
			// main.js is gitignored and produced by `npm run build`, which both
			// CI jobs run before `npm test`. A fresh clone that runs the suite
			// on its own has nothing to measure. That is tolerated locally and
			// is a hard failure in CI, where the build definitely ran — so the
			// budget can never be skipped in the place that publishes.
			assert.ok(
				!process.env.CI,
				"main.js has not been built, but this is CI, where `npm run build` runs before `npm test` — the size gate just silently lost its subject",
			);
			console.warn(
				"  ! main.js has not been built — bundle size not checked (run `npm run build`)",
			);
			return;
		}
		const limit = Number(declared?.[1]);
		const size = statSync(join(REPO_ROOT, "main.js")).size;
		assert.ok(
			size <= limit,
			`main.js is ${size} bytes (${(size / 1048576).toFixed(2)} MiB), over the ${limit}-byte budget. ` +
				"Raise it in release.yml consciously, with a note saying what earned the space.",
		);
	});
});

/* -------------------------------------------------------------------------- */
/* 159 — frozen command ids                                                   */
/* -------------------------------------------------------------------------- */

describe("command ids have not moved since release", () => {
	/**
	 * What shipped. A literal on purpose — the moment this is derived from
	 * `FIXED_COMMAND_IDS` it stops being able to notice a rename, because a
	 * rename changes both sides at once.
	 *
	 * Order is part of it: it is the registration order and the order the
	 * command builder lists the fixed ones in, under the user's own. A new
	 * command goes on the END for that reason — appending leaves every command
	 * a user already knows where they left it.
	 */
	const RELEASED_COMMAND_IDS = [
		"open-settings",
		"create-callout",
		"insert-empty-callout",
		"callout-wrap",
		"callout-unwrap",
		"open-quick-insert",
	] as const;

	it("the fixed ids are exactly the released ones, in order", () => {
		assert.deepStrictEqual(
			[...FIXED_COMMAND_IDS],
			[...RELEASED_COMMAND_IDS],
			"a fixed command id changed. Obsidian keys the user's hotkey by id, so this silently unbinds every shortcut for the renamed command — add a new id instead, and leave the old one registered if the command still exists.",
		);
	});

	it("every fixed id has a name key, and nothing else does", () => {
		assert.deepStrictEqual(
			Object.keys(FIXED_COMMAND_NAME_KEYS).sort(),
			[...RELEASED_COMMAND_IDS].sort(),
		);
	});

	it("the full Obsidian id is built from the frozen plugin id", () => {
		// What Obsidian actually stores in hotkeys.json is `<plugin id>:<id>`.
		// Both halves are frozen, so the composed string is too.
		for (const id of RELEASED_COMMAND_IDS) {
			assert.strictEqual(`${manifest.id}:${id}`, `callout-studio:${id}`);
		}
	});

	it("custom commands keep their own namespace, and cannot collide with the fixed five", () => {
		// A user-built command's id is `custom-<minted identity>`, and the
		// prefix doubles as the marker CustomCommandManager uses to recognise
		// its own registrations during a sweep. If a fixed id ever started with
		// it, the sweep would unregister a built-in command.
		assert.strictEqual(obsidianCommandId("cc-abc123"), "custom-cc-abc123");
		for (const id of RELEASED_COMMAND_IDS) {
			assert.ok(
				!id.startsWith("custom-"),
				`fixed command "${id}" collides with the custom-command namespace`,
			);
		}
	});
});
