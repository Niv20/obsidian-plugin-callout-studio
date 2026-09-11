import tseslint from "typescript-eslint";
import obsidianmd from "eslint-plugin-obsidianmd";
import globals from "globals";
import { globalIgnores } from "eslint/config";
import { fileURLToPath } from "node:url";
import path from "node:path";

export default tseslint.config(
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	...(obsidianmd.configs.recommended as any[]),
	{
		files: ["src/**/*.ts", "tests/**/*.ts"],
		languageOptions: {
			globals: {
				...globals.browser,
				// Obsidian global helpers (declared in obsidian.d.ts)
				activeWindow: "readonly",
				activeDocument: "readonly",
				createEl: "readonly",
				createDiv: "readonly",
				createSpan: "readonly",
				createFragment: "readonly",
			},
			parserOptions: {
				projectService: true,
				tsconfigRootDir: path.dirname(fileURLToPath(import.meta.url)),
			},
		},
	},
	{
		// The recommended config lints package.json/manifest.json (for
		// validate-manifest) but leaves them without a TS parser. Parse them so
		// the manifest rules can run, and turn off the type-aware obsidianmd
		// rules here — they require type info that JSON files don't have, and are
		// irrelevant to JSON anyway (otherwise they crash, see block scoped
		// `files: undefined` in the recommended config).
		files: ["package.json", "manifest.json"],
		languageOptions: {
			parser: tseslint.parser,
			parserOptions: { extraFileExtensions: [".json"] },
		},
		rules: {
			"obsidianmd/no-plugin-as-component": "off",
			"obsidianmd/no-unsupported-api": "off",
			"obsidianmd/no-view-references-in-plugin": "off",
			"obsidianmd/prefer-file-manager-trash-file": "off",
			"obsidianmd/prefer-instanceof": "off",
		},
	},
	{
		// Tests run in Node, never in Obsidian — `npm test` bundles them
		// separately and nothing here reaches main.js. The mobile-availability
		// rule is about shipped plugin code, so it is scoped off here rather
		// than suppressed per-import (obsidianmd/* disables are blocked by
		// eslint-comments/no-restricted-disable, and rightly so for src/).
		files: ["tests/**/*.ts"],
		// Node globals for the same reason: a test that reads a generated file
		// off disk needs `process.cwd()`, which the browser globals above do
		// not cover.
		languageOptions: { globals: { ...globals.node } },
		rules: {
			"obsidianmd/no-nodejs-modules": "off",
			// A fake vault adapter has to be handed *some* config folder, and the
			// literal is the point: the assertion is that a pack lands under the
			// folder it was given. Nothing here reads a real vault.
			"obsidianmd/hardcoded-config-path": "off",
			// `window` and `activeWindow` are what a *plugin* must use; a test
			// runs in Node, where the only realm there is is `globalThis`.
			"obsidianmd/no-global-this": "off",
			// `node:test` types its registration functions as returning a
			// promise, and the runner is what awaits them — a suite that awaited
			// its own `it` calls would nest them instead of registering them. So
			// they are named here rather than `void`-ed at ~4,000 call sites,
			// which is noise that would hide the real floating promise this rule
			// exists to catch.
			//
			// Four names for two functions: `@types/node` declares `test` and
			// `suite` and re-exports them as `it` and `describe`, and the rule
			// matches the *declared* name, not the imported one. Bare names
			// rather than a `{ from: "package" }` specifier because both halves
			// of that specifier miss here — `suite` is declared inside a nested
			// `namespace test`, so the `declare module "node:test"` above it is
			// not the enclosing one the matcher looks for.
			"@typescript-eslint/no-floating-promises": [
				"error",
				{
					allowForKnownSafeCalls: ["describe", "it", "suite", "test"],
				},
			],
		},
	},
	{
		// The one bare timer left in `src/`, and it has to stay bare.
		//
		// `readSettledSettingsFile` waits 150ms between two reads of `data.json`
		// to let a sync provider finish writing. It schedules nothing that belongs
		// to a window — no element, no view, no popout — so the compatibility this
		// rule protects is not at stake here.
		//
		// What is at stake is the eleven Node suites that drive the settling read
		// through `loadSettingsInto` and friends, none of which can pass their own
		// `wait`. Some run with no `window` at all; the rest install one whose
		// `setTimeout` is deliberately inert — `tests/support/fakeDom.ts` queues
		// timers until a suite flushes them on purpose, and syncPingPong and
		// syncMobileWipe stub `setTimeout` to a no-op so `ReloadQueue` cannot
		// retry behind their backs. A window timer here resolves in none of them,
		// and every one of those suites deadlocks inside the await.
		//
		// So this is scoped off in the config, where the reason is written down,
		// rather than suppressed at the call site — which
		// `eslint-comments/no-restricted-disable` rightly forbids for `src/`.
		files: ["src/manager/settingsSettledRead.ts"],
		rules: { "obsidianmd/prefer-window-timers": "off" },
	},
	globalIgnores([
		"node_modules",
		"dist",
		"scripts",
		// Bundled test output (npm test) — generated, and a copy of tests/.
		".test-out",
		"scripts/esbuild.config.mjs",
		"eslint.config.js",
		"eslint.config.mts",
		"scripts/version-bump.mjs",
		"versions.json",
		"main.js",
	]),
);
