/**
 * tests/repoSourceRules.test.ts — the rules CLAUDE.md states about how `src/`
 * is written, turned into something that fails.
 *
 * A convention in a document is a convention until something checks it. Each
 * suite below is one of those documented rules, and each is here because
 * breaking it is invisible in review and expensive afterwards:
 *
 * - **No hardcoded UI copy** — a string that skipped `t()` is not a bug in
 *   English, which is the only language a reviewer reads. It shows up as one
 *   untranslated label in 31 other languages, and the download-on-demand locale
 *   pipeline cannot fix it after the fact.
 * - **Listeners are unregistered** — Obsidian keeps the plugin object across a
 *   disable/enable cycle within a session. A workspace listener that is never
 *   released fires twice after one reload, four times after two, and the
 *   symptom (a duplicated re-render, a doubled notice) never points at the
 *   listener.
 * - **No `any`** — the codebase has *none* today; this is the ratchet that
 *   keeps that true. `npm run lint` enforces the same thing, and better, since
 *   it has type information — but lint is a separate command, and this one is
 *   in `npm test`.
 * - **`main.ts` stays wiring** — the file every future feature is tempted to
 *   put "just one more thing" into.
 * - **No new network calls** — the plugin's privacy claim is a *closed list* of
 *   four call sites, disclosed in the README. The claim is only worth anything
 *   if adding a fifth is hard to do by accident.
 * - **Files split by responsibility** — a ratchet rather than a rule, because
 *   40 files are already over the stated 300-line line. Freezing them at
 *   today's size is what makes the number mean something: nothing new joins the
 *   list, and nothing on it grows.
 *
 * A seventh suite turns the document around and checks *it* instead: CLAUDE.md
 * spent a long release cycle stating that this repository has no automated
 * tests, while `npm test` was the thing every one of the rules above ran under.
 * A stale sentence there is worse than no sentence, because it is read as the
 * instruction — a contributor who believes it writes no test at all.
 *
 * The other six read the source as text, through `tests/support/sourceScan.ts`,
 * which blanks comments and string bodies first. That is not a detail — every
 * one of these checks has an obvious grep-shaped version, and every such version
 * is wrong. `src/utils/iconAdjust.ts` has a local variable called `any`;
 * `src/manager/CalloutRegistry.ts` has a comment beginning "Migration: any
 * callout…"; four more files say "has anything" in prose. A grep for `any`
 * finds five hits in `src/` and all five are false. The scanner finds zero,
 * which is the truth.
 */
import assert from "node:assert";
import { describe, it } from "node:test";
import {
	allSourceFiles,
	argSpan,
	at,
	blankLiterals,
	lineOf,
	literals,
	pluginSourceFiles,
	readRepoFile,
	report,
	scanIsBalanced,
	type SourceFile,
} from "./support/sourceScan";

const files = pluginSourceFiles();

/**
 * Lines in a file, counted the way `wc -l` counts them.
 *
 * A trailing newline is a terminator, not an empty last line, and every number
 * frozen below was read off `wc -l`. Getting this wrong is an off-by-one on all
 * 40 entries at once — which is exactly how it first ran.
 */
function lineCount(file: SourceFile): number {
	return file.text.replace(/\n$/, "").split("\n").length;
}

/* -------------------------------------------------------------------------- */
/* The scanner itself                                                         */
/* -------------------------------------------------------------------------- */

describe("the source scanner is sound", () => {
	// Everything below is only as trustworthy as this. A scanner that loses its
	// place mid-file blanks the remainder as string body — and a check that
	// sees an empty file passes. So the failure mode is silence, and these
	// three assertions are what turn it into noise.

	it("found the source tree", () => {
		assert.ok(
			files.length > 100,
			`only ${files.length} source files found — the walk is looking in the wrong place`,
		);
	});

	it("finishes every file in a code state", () => {
		const unbalanced = files.filter((f) => !scanIsBalanced(f.text));
		assert.deepStrictEqual(
			unbalanced.map((f) => f.path),
			[],
			"the scanner ended one of these files inside a string or template, which means it silently blanked real code",
		);
	});

	it("keeps offsets and line numbers intact", () => {
		for (const f of files) {
			assert.strictEqual(f.code.length, f.text.length, `${f.path}: length drift`);
			assert.strictEqual(
				(f.code.match(/\n/g) ?? []).length,
				(f.text.match(/\n/g) ?? []).length,
				`${f.path}: newline drift`,
			);
		}
	});
});

/* -------------------------------------------------------------------------- */
/* 153 — every user-facing string goes through t()                            */
/* -------------------------------------------------------------------------- */

describe("no hardcoded UI copy", () => {
	/**
	 * The setters that put text on screen.
	 *
	 * `setIcon`, `setClass`, `setValue` and friends are deliberately absent:
	 * they take identifiers, not prose. `setAttribute` is absent for the same
	 * reason, with one exception handled below.
	 */
	const TEXT_SETTERS = [
		"setName",
		"setDesc",
		"setText",
		"setTitle",
		"setTooltip",
		"setButtonText",
		"setPlaceholder",
	] as const;

	/**
	 * A literal that could be prose: two or more consecutive letters somewhere.
	 *
	 * `setDesc("")` clears a description and is not copy. `setText("×")`,
	 * `setText(":")` and `setText("1")` are glyphs and separators. Requiring two
	 * letters is what separates those from a sentence without needing a
	 * dictionary.
	 */
	const LOOKS_LIKE_PROSE = /[A-Za-z]{2}/;

	/**
	 * Argument text that already routes through the translator.
	 *
	 * Matching `t(` anywhere in the argument span — rather than requiring the
	 * call to *start* with it — is deliberate, because the real code does all
	 * three of these:
	 *
	 *     .setDesc(this.isBuiltIn ? t("a") : t("b"))
	 *     .setTitle(`${t("a")} — ${t("b")}`)
	 *     .setName(label)                              // label came from t()
	 *
	 * The last one is invisible to any check that does not follow the variable,
	 * so the rule is narrowed honestly: this suite catches a *literal* that
	 * never met the translator, which is the mistake that actually happens.
	 */
	const TRANSLATED = /\bt\s*\(/;

	function violations(): string[] {
		const out: string[] = [];
		for (const f of files) {
			for (const setter of TEXT_SETTERS) {
				const re = new RegExp(`\\.${setter}\\s*\\(`, "g");
				for (const m of f.code.matchAll(re)) {
					const index = m.index ?? 0;
					const span = argSpan(f.code, index + m[0].length - 1);
					if (!span) continue;
					const raw = f.text.slice(span.start, span.end);
					if (TRANSLATED.test(raw)) continue;
					const prose = literals(raw).filter((l) =>
						LOOKS_LIKE_PROSE.test(l.value),
					);
					if (prose.length === 0) continue;
					out.push(
						`${at(f, index)}  .${setter}(${JSON.stringify(prose[0]?.value ?? "")}…)`,
					);
				}
			}
		}
		return out;
	}

	it("no text setter is handed a bare English literal", () => {
		const bad = violations();
		assert.deepStrictEqual(
			bad,
			[],
			report(
				"These strings would stay English in all 31 other locales. Add a key to src/i18n/en.ts and call t():",
				bad,
			),
		);
	});

	it("no Notice is raised with a bare literal", () => {
		// A Notice is the loudest untranslated surface there is — it is the only
		// UI that appears without the user opening anything.
		const bad: string[] = [];
		for (const f of files) {
			for (const m of f.code.matchAll(/new\s+Notice\s*\(/g)) {
				const index = m.index ?? 0;
				const span = argSpan(f.code, index + m[0].length - 1);
				if (!span) continue;
				const raw = f.text.slice(span.start, span.end);
				if (TRANSLATED.test(raw)) continue;
				const prose = literals(raw).filter((l) => LOOKS_LIKE_PROSE.test(l.value));
				if (prose.length > 0) bad.push(`${at(f, index)}  ${prose[0]?.value ?? ""}`);
			}
		}
		assert.deepStrictEqual(bad, [], report("Untranslated Notice text:", bad));
	});

	it("aria-labels go through t() too", () => {
		// An aria-label is the only text a screen-reader user gets, so leaving
		// it in English is worse than leaving a visible label in English, not
		// better. It is set through setAttribute, which is why the generic
		// setter list above cannot see it.
		//
		// The attribute *name* cannot be matched in `f.code` — the scanner
		// blanks string bodies, so every `setAttribute("aria-label", …)` reads
		// as `setAttribute("          ", …)` there. This looked for the name in
		// the blanked text for a long time and therefore matched nothing at
		// all; it now matches any string-literal first argument in `f.code` and
		// reads the name back out of `f.text`. `title` has left the list
		// because the suite below bans that attribute outright.
		const NAMES = ["aria-label", "placeholder"];
		const bad: string[] = [];
		for (const f of files) {
			for (const m of f.code.matchAll(
				/setAttribute\s*\(\s*(["'])(\s*)\1\s*,/g,
			)) {
				const index = m.index ?? 0;
				const name = f.text
					.slice(index, index + m[0].length)
					.match(/["']([^"']*)["']/)?.[1];
				if (name === undefined || !NAMES.includes(name)) continue;
				const span = argSpan(f.code, f.code.indexOf("(", index));
				if (!span) continue;
				const raw = f.text.slice(span.start, span.end);
				if (TRANSLATED.test(raw)) continue;
				// Drop the attribute name itself before looking for prose.
				const value = raw.slice(raw.indexOf(",") + 1);
				const prose = literals(value).filter((l) =>
					LOOKS_LIKE_PROSE.test(l.value),
				);
				if (prose.length > 0) {
					bad.push(`${at(f, index)}  ${name}="${prose[0]?.value ?? ""}"`);
				}
			}
		}
		assert.deepStrictEqual(bad, [], report("Untranslated attribute text:", bad));
	});
});

/* -------------------------------------------------------------------------- */
/* 165 — only Obsidian ever draws a tooltip                                   */
/* -------------------------------------------------------------------------- */

describe("nothing sets a native tooltip", () => {
	/**
	 * `title` is the one attribute that draws a tooltip this plugin does not
	 * control, and the trouble is not that it looks different:
	 *
	 * - **It stacks.** Obsidian draws its own tooltip for anything carrying an
	 *   `aria-label`, so an element with both shows two at once, in two styles,
	 *   on two delays. That is how a bare `[!bug]` came to sit beside "Insert
	 *   Bug as a block callout" in the quick-insert window.
	 * - **It is inherited.** A `title` fires while the pointer is over any
	 *   descendant that has none of its own, so one set on a row reaches every
	 *   button inside it — including buttons that were already labelled.
	 *
	 * `aria-label` is therefore the only hover text in `src/`. Only the three
	 * forms that reach the DOM are matched: `title:` is *also* a plain options
	 * field on some forty modal headings, icon-pack names and parsed callout
	 * headers, and none of those is an attribute.
	 */
	interface Form {
		label: string;
		/** Every index in `f.code` where this form starts. */
		find: (f: SourceFile) => number[];
	}

	/** Indices of every match of `re` in `text`. */
	function indices(text: string, re: RegExp): number[] {
		return [...text.matchAll(re)].map((m) => m.index ?? 0);
	}

	const FORMS: Form[] = [
		{
			// setAttribute("title", …) / setAttr("title", …). The name is read
			// out of `f.text`, because `f.code` has blanked the string body.
			label: 'setAttribute("title", …)',
			find: (f) =>
				indices(f.code, /\bsetAttr(?:ibute)?\s*\(\s*(["'])(\s*)\1/g).filter(
					(i) => /["']title["']/.test(f.text.slice(i, i + 40)),
				),
		},
		{
			// attr: { title: … } in a createEl/createDiv/createSpan options
			// object. Anchored on `attr:` so the plain options field is not
			// touched; the key survives blanking when it is a bare identifier,
			// and is read from `f.text` when it is quoted.
			label: "attr: { title: … }",
			find: (f) =>
				indices(f.code, /\battr\s*:\s*\{/g).filter((i) => {
					const open = f.code.indexOf("{", i);
					const close = f.code.indexOf("}", open);
					if (close === -1) return false;
					return /[{,]\s*(["']?)title\1\s*:/.test(
						f.text.slice(open, close + 1),
					);
				}),
		},
		{
			// el.title = …, but never `this.title =`: a receiver of `this` is a
			// class field by construction — ReplaceCalloutModal has one — and an
			// element is never `this`. That carve-out needs no allowlist, so it
			// cannot go stale the way a frozen list of files would.
			label: "el.title = …",
			find: (f) => indices(f.code, /(?<!\bthis)\.title\s*=(?!=)/g),
		},
	];

	it("no title attribute reaches the DOM", () => {
		const bad: string[] = [];
		for (const f of files) {
			for (const form of FORMS) {
				for (const index of form.find(f)) {
					bad.push(`${at(f, index)}  ${form.label}`);
				}
			}
		}
		assert.deepStrictEqual(
			bad,
			[],
			report(
				"A `title` draws the OS tooltip, which stacks with Obsidian's and is inherited by every child. Use aria-label:",
				bad,
			),
		);
	});

	it("the rule sees each of the three forms", () => {
		// A scan that silently matches nothing passes for years — this suite's
		// own neighbour did exactly that. Feed it the shapes it exists to catch.
		const fake = (text: string): SourceFile => ({
			path: "src/fake.ts",
			text,
			code: blankLiterals(text),
		});
		const caught = (text: string): boolean =>
			FORMS.some((form) => form.find(fake(text)).length > 0);

		for (const sample of [
			'el.setAttribute("title", label);',
			"el.setAttr('title', label);",
			'row.createDiv({ cls: "x", attr: { title: name } });',
			'row.createDiv({ attr: { "title": name } });',
			"el.title = name;",
		]) {
			assert.ok(caught(sample), `missed: ${sample}`);
		}

		for (const sample of [
			'el.setAttribute("aria-label", label);',
			'new ConfirmModal(app, { title: t("x") });',
			'row.createDiv({ attr: { "aria-label": name } });',
			"this.title = t('x');",
			'const { title } = parseHeader(line);',
		]) {
			assert.ok(!caught(sample), `false positive: ${sample}`);
		}
	});
});

/* -------------------------------------------------------------------------- */
/* 154 — nothing is left listening                                            */
/* -------------------------------------------------------------------------- */

describe("every listener is released", () => {
	/**
	 * Obsidian's own emitters. Each `.on()` hands back an `EventRef` that stays
	 * live until something gives it back.
	 */
	const EMITTER_ON =
		/\b(workspace|vault|metadataCache)\s*\.\s*on\s*\(/g;

	it("every workspace/vault/metadataCache listener is registered or offref'd", () => {
		const bad: string[] = [];
		for (const f of files) {
			// Any identifier this file ever hands to `offref`. Collected once
			// per file rather than per call site, because the release usually
			// happens in a different method (`hide()`, a disposer) far below.
			const released = new Set<string>();
			for (const m of f.code.matchAll(/offref\s*\(\s*([\w$.]+)\s*\)/g)) {
				released.add((m[1] as string).replace(/^this\./, ""));
			}
			for (const m of f.code.matchAll(EMITTER_ON)) {
				const index = m.index ?? 0;
				const before = f.code.slice(Math.max(0, index - 300), index);
				// `registerEvent(` with nothing but whitespace, an opening
				// paren or `this.` between it and the call — i.e. the call is
				// the argument, not merely somewhere above it.
				if (/registerEvent\s*\(\s*[\w$.]*$/.test(before)) continue;
				// Otherwise: `const ref = …` / `this.ref = …`, and that name
				// must reach offref somewhere in the file. The trailing
				// `[\w$.]*` is the receiver between the `=` and the match —
				// `this.cssChangeRef = this.app.workspace.on(…)` puts
				// `this.app.` there, and without it every real site looks
				// unassigned.
				const assign =
					/(?:const|let|var)\s+([\w$]+)\s*(?::[^=]*)?=\s*[\w$.]*$|([\w$.]+)\s*=\s*[\w$.]*$/.exec(
						before,
					);
				const name = (assign?.[1] ?? assign?.[2] ?? "").replace(/^this\./, "");
				if (name && released.has(name)) continue;
				bad.push(
					`${at(f, index)}  ${m[1]}.on(…)${name ? ` → ${name}` : ""}`,
				);
			}
		}
		assert.deepStrictEqual(
			bad,
			[],
			report(
				"These listeners outlive their owner. Wrap the call in this.registerEvent(…), or keep the EventRef and pass it to app.workspace.offref() when the owner goes away:",
				bad,
			),
		);
	});

	it("nothing listens on a document or window without taking it back", () => {
		// A listener on an element the owner created dies with that element, so
		// `addEventListener` on modal DOM is fine and is what the settings UI
		// does everywhere. A listener on the *document* does not: it survives
		// the modal, the note and the workspace leaf. Those are the ones that
		// have to be undone by hand — `registerDomEvent` is unavailable to a
		// Modal, which is not a Component.
		const GLOBAL_HOST = /^(document|window|activeDocument|activeWindow|globalThis|ownerDoc|ownerWin|body)$/;
		const bad: string[] = [];
		for (const f of files) {
			// Every handler expression this file hands to removeEventListener.
			const removed = f.code.matchAll(/removeEventListener\s*\(/g);
			const removedText: string[] = [];
			for (const m of removed) {
				const span = argSpan(f.code, (m.index ?? 0) + m[0].length - 1);
				if (span) removedText.push(f.code.slice(span.start, span.end));
			}
			for (const m of f.code.matchAll(
				/\b([\w$]+(?:\.[\w$]+)*)\.addEventListener\s*\(/g,
			)) {
				const index = m.index ?? 0;
				const host = (m[1] as string).split(".").pop() ?? "";
				if (!GLOBAL_HOST.test(host)) continue;
				const before = f.code.slice(Math.max(0, index - 120), index);
				if (/registerDomEvent\s*\(\s*$/.test(before)) continue;
				const span = argSpan(f.code, index + m[0].length - 1);
				const args = span ? f.code.slice(span.start, span.end) : "";
				// The handler is the second argument; compare it by text.
				const handler = args.slice(args.indexOf(",") + 1).trim();
				if (handler && removedText.some((r) => r.includes(handler))) continue;
				bad.push(`${at(f, index)}  ${m[1]}.addEventListener(${args.slice(0, 60)})`);
			}
		}
		assert.deepStrictEqual(
			bad,
			[],
			report(
				"These attach to a document or window and never detach. Use plugin.registerDomEvent(), or call removeEventListener with the same handler on teardown:",
				bad,
			),
		);
	});

	it("no interval runs outside registerInterval", () => {
		// `registerInterval` is the only form that survives an unload, and an
		// interval that does not is a timer firing against a torn-down plugin
		// for the rest of the session.
		const bad: string[] = [];
		for (const f of files) {
			for (const m of f.code.matchAll(/\bsetInterval\s*\(/g)) {
				const index = m.index ?? 0;
				const before = f.code.slice(Math.max(0, index - 60), index);
				if (/registerInterval\s*\(\s*(?:window\.)?$/.test(before)) continue;
				bad.push(at(f, index));
			}
		}
		assert.deepStrictEqual(
			bad,
			[],
			report("Wrap these in this.registerInterval(window.setInterval(…)):", bad),
		);
	});
});

/* -------------------------------------------------------------------------- */
/* 155 — no `any`                                                             */
/* -------------------------------------------------------------------------- */

describe("no `any` without an explicit exemption", () => {
	/**
	 * `any` in type position, in each of the six shapes it can take.
	 *
	 * Matched against blanked code, so prose and identifiers are already gone —
	 * but the shapes still matter, because `let any = false` in
	 * `src/utils/iconAdjust.ts` is a real, legitimate local variable and a bare
	 * `\bany\b` would flag it.
	 */
	const ANY_IN_TYPE_POSITION = [
		/:\s*any\b/g, // annotation
		/\bas\s+any\b/g, // assertion
		/<\s*any\s*[,>]/g, // type argument
		/\bany\s*\[\s*\]/g, // array
		/[|&]\s*any\b/g, // union / intersection member
		/=>\s*any\b/g, // return type
	];

	it("src/ contains no `any` that is not explicitly disabled", () => {
		const bad: string[] = [];
		for (const f of files) {
			const lines = f.text.split("\n");
			for (const re of ANY_IN_TYPE_POSITION) {
				for (const m of f.code.matchAll(re)) {
					const line = lineOf(f.text, m.index ?? 0);
					// The disable comment is a comment, so it lives in `text`,
					// not in `code`. It may sit on the line itself or the one
					// above (eslint-disable-next-line).
					const context = `${lines[line - 2] ?? ""}\n${lines[line - 1] ?? ""}`;
					if (/eslint-disable[\w-]*\s+.*no-explicit-any/.test(context)) continue;
					bad.push(`${f.path}:${line}  ${m[0].trim()}`);
				}
			}
		}
		assert.deepStrictEqual(
			bad,
			[],
			report(
				"TypeScript strict mode is the point of this codebase. If one of these is genuinely unavoidable, narrow it to `unknown` or write the eslint-disable comment and say why:",
				bad,
			),
		);
	});
});

/* -------------------------------------------------------------------------- */
/* 156 — main.ts stays wiring                                                 */
/* -------------------------------------------------------------------------- */

describe("main.ts stays lifecycle and wiring", () => {
	/**
	 * The ceiling, set just above today's 556 lines.
	 *
	 * Deliberately tight rather than generous: the value of this number is that
	 * it is reached, noticed, and answered by moving something out — not by
	 * being raised. `main.ts` is where every feature's `onload` wiring wants to
	 * live, and it is the one file whose growth nothing else would flag.
	 */
	const MAIN_TS_MAX_LINES = 600;

	const main = files.find((f) => f.path === "src/main.ts");

	it("exists", () => {
		assert.ok(main, "src/main.ts not found");
	});

	it(`is at most ${MAIN_TS_MAX_LINES} lines`, () => {
		const lines = lineCount(main as SourceFile);
		assert.ok(
			lines <= MAIN_TS_MAX_LINES,
			`src/main.ts is ${lines} lines (ceiling ${MAIN_TS_MAX_LINES}). ` +
				"Move the logic into a sub-module rather than raising this.",
		);
	});
});

/* -------------------------------------------------------------------------- */
/* 158 — the network surface is closed                                        */
/* -------------------------------------------------------------------------- */

describe("the network surface is exactly what the README discloses", () => {
	/**
	 * Every file allowed to reach the network, and what it is for.
	 *
	 * This is the *implementation* of the README's "Network usage and privacy"
	 * section, and the list is shorter than it looks: two of the four are the
	 * same feature. Note that the fetching for Material Symbols lives in
	 * `icons/packs/`, not in `IconFetchManager` — the manager owns the queue and
	 * the cache, and the pack owns the request.
	 */
	const ALLOWED_REQUEST_URL: Record<string, string> = {
		"src/icons/PackDataStore.ts":
			"whole icon packs, SHA-256 verified against packManifest.ts",
		"src/icons/packs/material.ts":
			"one Material Symbols drawing, on demand from the picker",
		"src/icons/packs/materialFont.ts":
			"the Material Symbols webfont, for the picker grid",
		"src/i18n/LocaleStore.ts":
			"the user's UI language — the one background fetch, argued for in CLAUDE.md",
	};

	it("only the disclosed files call requestUrl", () => {
		// `allSourceFiles`, not `files`: the i18n tree is excluded from the
		// *text* rules above because it is 32 tables of translated prose, but
		// `LocaleStore.ts` lives there and is one of the four callers. Scanning
		// the narrowed list would have quietly dropped it from the allowlist.
		const callers = allSourceFiles()
			.filter((f) => /\brequestUrl\s*\(/.test(f.code))
			.map((f) => f.path)
			.sort();
		assert.deepStrictEqual(
			callers,
			Object.keys(ALLOWED_REQUEST_URL).sort(),
			"the set of files that reach the network changed. Every addition needs a line in the README's 'Network usage and privacy' section and an entry here — and per CLAUDE.md, must be triggered by an explicit user action with an offline fallback.",
		);
	});

	it("nothing uses a network primitive that bypasses requestUrl", () => {
		// `requestUrl` is Obsidian's own, which means it is subject to the
		// user's proxy settings and is the API reviewers look for. `fetch` and
		// XHR are not, and would also break CORS on mobile.
		const BANNED = [
			/\bfetch\s*\(/g,
			/\bXMLHttpRequest\b/g,
			/\bWebSocket\b/g,
			/\bEventSource\b/g,
			/navigator\s*\.\s*sendBeacon\b/g,
			/\bnavigator\s*\.\s*serviceWorker\b/g,
		];
		const bad: string[] = [];
		for (const f of allSourceFiles()) {
			for (const re of BANNED) {
				for (const m of f.code.matchAll(re)) {
					bad.push(`${at(f, m.index ?? 0)}  ${m[0]}`);
				}
			}
		}
		assert.deepStrictEqual(
			bad,
			[],
			report("Use Obsidian's requestUrl instead:", bad),
		);
	});

	it("nothing evaluates remote code", () => {
		// The developer policy that has no exceptions. `<link>` to a webfont is
		// the one remote *resource* the plugin loads, and a stylesheet cannot
		// execute; a remote script or an eval could.
		const bad: string[] = [];
		for (const f of allSourceFiles()) {
			for (const m of f.code.matchAll(
				/\beval\s*\(|new\s+Function\s*\(|createEl\s*\(\s*["']script["']/g,
			)) {
				bad.push(`${at(f, m.index ?? 0)}  ${m[0]}`);
			}
		}
		assert.deepStrictEqual(bad, [], report("Remote/dynamic code execution:", bad));
	});

	it("every remote host in the source is one of the disclosed four", () => {
		// The call sites are checked above; this checks where they point.
		// Hosts that only ever appear in a link the *user* clicks (the repo,
		// the docs) are here too, because an `<a href>` is not a request the
		// plugin makes — but a typo'd CDN host would be.
		const ALLOWED_HOSTS = new Set([
			// Not a request at all: the SVG XML namespace, written into every
			// piece of markup this plugin builds. It is a name, and nothing
			// ever resolves it.
			"www.w3.org",
			"cdn.jsdelivr.net", // icon packs and locale files
			"raw.githubusercontent.com", // their fallback
			"fonts.gstatic.com", // Material Symbols artwork and webfont
			"fonts.googleapis.com", // the webfont's stylesheet
			"github.com", // user-clicked links only
			"docs.obsidian.md",
			"obsidian.md",
			"www.gnu.org", // licence links in the credits
			"www.apache.org",
			"opensource.org",
			"creativecommons.org",
			"scripts.sil.org",
			"fontawesome.com",
			"tabler.io",
			"primer.style",
			"nagoshiashumari.github.io",
			"fonts.google.com",
			"lucide.dev",
			"buymeacoffee.com",
			"ko-fi.com",
			"www.paypal.com",
		]);
		const seen = new Map<string, string>();
		for (const f of allSourceFiles()) {
			for (const lit of literals(f.text)) {
				for (const m of lit.value.matchAll(/https?:\/\/([A-Za-z0-9.-]+)/g)) {
					const host = m[1] as string;
					if (!seen.has(host)) seen.set(host, at(f, lit.start));
				}
			}
		}
		const unknown = [...seen.entries()]
			.filter(([host]) => !ALLOWED_HOSTS.has(host))
			.map(([host, where]) => `${host}  (${where})`);
		assert.deepStrictEqual(
			unknown,
			[],
			report(
				"A host appears in src/ that is not on the disclosed list. If the plugin requests it, disclose it in the README; if a user clicks it, add it here:",
				unknown,
			),
		);
	});
});

/* -------------------------------------------------------------------------- */
/* 160 — file size ratchet                                                    */
/* -------------------------------------------------------------------------- */

describe("no new oversized files", () => {
	/**
	 * The files already over CLAUDE.md's ~300-line line, frozen at the size
	 * they were when this test was written.
	 *
	 * This is a ratchet, not a rule, and saying so plainly matters: 40 files are
	 * already over, the three largest are ten times over, and a test that
	 * demanded 300 lines today would simply be deleted. What it *can* enforce is
	 * the direction of travel — a 41st file cannot join quietly, and none of
	 * these 40 can grow. Splitting one is expected to *lower* its entry here,
	 * which the last assertion insists on so the list cannot rot into a
	 * permanently generous allowance.
	 *
	 * `src/i18n/`, `src/icons/data/` and `src/data/` are out of scope entirely
	 * (see `sourceScan.ts`): they are tables and generated indexes, where line
	 * count measures how many icons exist, not how much a file is doing.
	 */
	const SOFT_LIMIT = 300;

	const FROZEN: Record<string, number> = {
		// Raised from 2322 for the create-only autofocus: the guard, the field
		// holding its disposer, and the two lines that release it on close.
		// Everything movable already moved — settings/modalAutofocus.ts owns the
		// focus and the scroll hold whole — and what is left is the one thing
		// only this class can answer: whether this window is creating a callout.
		"src/settings/CalloutEditor.ts": 2335,
		// Lowered repeatedly, per this ratchet's own ask: `bgAlphaFor`'s solve moved
		// to utils/bgTintAlpha.ts, which owns the CHOICE of alpha among the many
		// that render the callout identically; `generateFallbackCSS` to
		// manager/css/fallbackCSS.ts, taking the icon-box width the two now share
		// with it to manager/css/iconBox.ts; core's own icon reader to
		// manager/css/coreIcon.ts; the three `::after` icon overrides to
		// manager/css/iconOverrides.ts; and the `--callout-icon` decision to
		// manager/css/calloutIconProp.ts. Held flat since: the outline half of
		// `transparentBg` moved out to manager/css/transparentBorder.ts — which
		// both this file and fallbackCSS were already reaching for through
		// `FallbackCssContext` — and the room that bought was spent on the core
		// accent shim rather than banked.
		// Lowered from 1859: `bgProps` and `bgImageFor` moved to
		// manager/css/backgroundProps.ts — they were already being handed to
		// `fallbackCSS` as plain functions of a definition, and read nothing off
		// the injector — and part of the room that bought went to `themeSurface`,
		// which asks manager/theme/calloutSurface.ts whether the active styling
		// owns the callout surface.
		"src/manager/CSSInjector.ts": 1838,
		// Lowered from 2014: what "mirror the fallback callout" means now lives
		// entirely in manager/discoveredRow.ts, beside the other half of the same
		// agreement, and the two-mode migration in manager/styleModeMigration.ts.
		// Lowered again from 2003: attribute-form identity — which definition a
		// dasherized id belongs to, and which raw forms one definition may claim
		// in the vault — moved to manager/calloutIdForms.ts, and what the active
		// theme claims and draws to manager/theme/ThemeFacts.ts.
		// Lowered from 1990: the dash/space collision fold moved to
		// manager/idCollisionMigration.ts, which owns the merge rule.
		// Raised from 1983 for the `RESERVED_DEMO_IDS` filter in
		// `getExportableDefinitions`. Six lines, and there is no sibling module
		// for them: the question is "what does an export contain", which is
		// this class's, and the set they consult already lives in constants.ts
		// precisely so `manager/` and `utils/` can share it.
		// Lowered from 1989: the four icon repairs that run on load moved to
		// manager/iconMigrations.ts (which also made them ask for the write-back
		// they had always skipped), and which rows `data.json` may hold — above
		// all why an unclaimed discovered row may not — to
		// manager/discoveredRowPersistence.ts.
		// Raised from 1949 for the foreign-field quarantine: a field a NEWER
		// build wrote is now set aside on load and handed back on save, so two
		// devices on different versions stop rewriting `data.json` at each
		// other forever. The rule and both key lists live in
		// manager/foreignFields.ts; what is left here is the three places only
		// this class can put them — the load that sets them aside, the save
		// that hands them back, and the reset that throws them away with
		// everything else. Most of that raise was paid straight back by moving
		// CURRENT_DATA_VERSION to constants.ts, where the same check can read
		// it without importing the class that imports the check.
		"src/manager/CalloutRegistry.ts": 1958,
		// Raised from 1184 for the same set, rejected in `validateIdString`.
		// Same reasoning: "which id strings are valid on import" is the one
		// thing this file is for, so the rule cannot move out of it without
		// splitting the answer in two.
		"src/utils/importValidator.ts": 1200,
		// Lowered from 1190: the style-mode pair's import rules moved to
		// utils/importStyleMode.ts.
		// Lowered from 1106: the Base color row moved to
		// settings/paletteBaseColorRow.ts (which also owns seedBaseColor, the
		// reason CustomPalette.baseColor exists), and the gradient's arrow
		// direction picker — a pure function of its arguments — to
		// settings/paletteDirectionPicker.ts.
		// Raised from 1070 for the same create-only autofocus, for the same
		// reason: settings/modalAutofocus.ts holds all of it except "is this
		// window creating a palette", which is `existing` and lives here.
		"src/settings/PaletteEditorModal.ts": 1082,
		// Joined this list at 306, crossing 300 for the autofocus that stops the
		// search field dragging the list up under a phone keyboard. Admitted
		// rather than split, deliberately: everything this window does that is
		// not "list callouts and insert one" already lives in a sibling —
		// quickInsertToolbar, quickInsertRow, quickInsertPreview,
		// quickInsertMessages, and wrapSelectionInCallout in editor/. What is
		// left is one modal's lifecycle, its arrow-key walk and its list, and any
		// further cut would be by line count rather than by responsibility.
		"src/settings/QuickInsertModal.ts": 306,
		"src/editor/calloutTokens.ts": 840,
		// The one entry that is allowed to move, and only for this reason: a
		// member of `PluginSettings` has no sibling module to be moved into, so
		// the remedy this list asks for is structurally unavailable to it. Raise
		// it only for a settings field; anything else here still splits.
		// Raised from 803 for `CustomPalette.baseColor`, lowered again when
		// `externalStyle`'s cascade derivation moved to internals-docs, raised
		// for the style-mode field that replaced it, and raised again for
		// `PluginSettings.defaultStyleMode` — the one field standing between an
		// upgrade and every built-in callout being handed to the theme. Raised
		// again for `PluginSettings.retiredThemeIds`, which is what stops
		// discovery re-creating a theme's callout types from notes that still
		// mention them after the theme is gone.
		// Raised again for `PluginSettings.calloutListsExpanded`, which remembers
		// the fold state of the three callout-list sections across a
		// settings-tab reopen and a plugin reload. Raised again when Saved color
		// palettes joined that fold state as its fourth key, `palettes`.
		// Lowered from 839: `firstRunCompleted`, `retiredThemeIds` and the
		// settings-list fold are not settings at all — they describe a machine,
		// not a vault — and moved to manager/DeviceLocalStore.ts. Raised again
		// for `autoDiscoverCallouts`, on the same terms as every settings field
		// above: this file is where a settings field is declared, and there is
		// no sibling module for one field's declaration to move into.
		// Raised from 838 for `ignoredCalloutIds` — the per-callout half of
		// automatic discovery, asked for in issue #41 by a user who had already
		// deleted every `[!mcc]` in their vault from a row they never wanted.
		// The field has to be declared here; everything it means lives in
		// manager/ignoredCallouts.ts.
		"src/types.ts": 841,
		"src/editor/livepreview/widgets.ts": 793,
		"src/reading/calloutPostProcessor.ts": 781,
		"src/settings/iconpicker/PackPanel.ts": 736,
		"src/utils/colorUtils.ts": 685,
		"src/settings/iconpicker/IconPickerModal.ts": 681,
		"src/editor/livepreview/calloutViewPlugin.ts": 676,
		// Lowered from 666: sanitizeCustomPalettes — the untrusted-data gate,
		// the opposite job to the rest of this file — moved to
		// utils/paletteSanitize.ts, taking its three colorUtils imports with it.
		"src/utils/colorPalettes.ts": 612,
		// Lowered from 666: the two structural questions the transforms only
		// consult — blockquote prefix arithmetic and the fenced code/math
		// ranges an expansion must not cut through — moved to
		// editor/quotePrefix.ts and editor/fenceBlocks.ts.
		"src/editor/CalloutBlockTools.ts": 577,
		"src/utils/vaultCalloutScanner.ts": 574,
		// Lowered from 593: the suggestion row's icon and accent go through
		// manager/theme/calloutListIcon.ts, shared with the three other lists
		// that draw a callout small.
		"src/editor/AutoComplete.ts": 576,
		// Lowered from 537: everything that has to happen when the active theme
		// changes — re-derive its callout rows, then re-inject, in that order —
		// moved to manager/theme/themeProvidedRows.ts, which is where the rule
		// about which pass goes first belongs.
		// Lowered from 532 while gaining `onExternalSettingsChange`: the welcome
		// screen's "who sees it, and when" moved to settings/welcomeRouting.ts,
		// the data.json write policy to manager/SettingsWriter.ts, reading it
		// back into a live registry to manager/settingsBoot.ts, and the two
		// repaint passes to editor/renderRefresh.ts. What is left is lifecycle
		// and wiring, which is all CLAUDE.md asks of this file.
		// Lowered again from 512: the post-layout half of startup — confirm the
		// fresh install, greet, run first-run discovery — moved to
		// manager/launchSequence.ts, which is where the ordering rule between
		// those three belongs.
		// Lowered from 503: what the plugin hands SettingsWriter — including
		// what to do when a write turns out to be stale — moved to
		// manager/settingsWriterHost.ts. That last part is a policy, not a
		// wire, and "why did a save sometimes not save" should be findable
		// without reading the plugin class.
		// Lowered again from 501: serializing external reloads and retrying a
		// deferred one moved to manager/reloadQueue.ts, and the discovery host
		// stopped being handed a `settings` object it would only hold stale.
		"src/main.ts": 500,
		"src/icons/renderIcon.ts": 547,
		// Lowered from 528: `STYLE_DEMO_ID` moved to constants.ts, where the
		// discovery/import/autocomplete filters that now consult it can reach
		// it without importing a settings modal.
		// Lowered from 522: standing a demo callout up and taking it down —
		// including raising `pruneSuspended` for as long as it is up, which is
		// what lets a deferred settings reload be released — moved to
		// settings/previewOwnership.ts, shared with WelcomeModal.
		"src/settings/GlobalStyleModal.ts": 516,
		// Lowered from 497: the two role-icon helpers moved to editor/roleIcon.ts,
		// beside the theme-artwork renderer they now both consult.
		"src/editor/renderShared.ts": 475,
		// Lowered from 454: the two reasons automatic discovery is held back from
		// an id — an explicit delete seconds ago, and a callout type the active
		// theme stopped supplying — are one question now, in
		// manager/rediscoveryHold.ts.
		// Lowered from 412: "what ids do we already know" moved to
		// manager/knownCalloutIds.ts, so the settings tab can ask the same
		// question without a forwarder through the plugin.
		// Lowered from 398: the whole-vault half — which rows nothing references
		// any more — moved to manager/CalloutPrune.ts. Discovery reads one file;
		// the prune reads every file. They shared a subject, not a job.
		// Lowered from 318: *when* to scan — the debounce, the triggers including
		// the `file-open` one, and the mtime memo that keeps it cheap — moved to
		// manager/discoveryScheduler.ts, and reading the half-typed line under
		// the cursor to editor/activeTypingIds.ts.
		"src/manager/CalloutDiscovery.ts": 307,
		"src/editor/contextmenu/resolve.ts": 455,
		"src/ui/TagInput.ts": 414,
		"src/settings/editor/CalloutEditorSave.ts": 410,
		"src/icons/isolateSvg.ts": 402,
		"src/icons/packs/materialFont.ts": 398,
		"src/outline/OutlineDecorator.ts": 382,
		// Lowered from 357: the read-only rule — and the transaction filter
		// that finally made it one — moved to settings/previewReadOnly.ts,
		// where it can be tested against a real EditorState.
		"src/settings/EmbeddableMarkdownEditor.ts": 349,
		// Lowered from 367: the deny-list of what is unsafe in ANY svg moved to
		// icons/svgSafety.ts, where a third caller outside this file — the theme
		// artwork importer in manager/css/coreIcon.ts — can reach it.
		"src/icons/svg.ts": 329,
		"src/settings/iconpicker/ImagePanel.ts": 354,
		// Raised for the "Automatically discover callouts in your vault" toggle,
		// which belongs beside Re-scan vault: this file IS the vault-maintenance
		// section, and a sibling module for one Setting row would only hide it.
		// Raised from 329 for the ignored-callout list: one call and its import.
		// The list itself — a repeated row with its own undo, which is a different
		// shape from the settings-plus-buttons around it — lives in
		// settings/sections/IgnoredCalloutsList.ts.
		"src/settings/sections/DataManagementSection.ts": 332,
		// Lowered from 345: its row icon goes through
		// manager/theme/calloutListIcon.ts. Lowered again from 337: the shortcut
		// chips and the hotkey-pane button — carried identically by both lists
		// in the window — moved to settings/command/hotkeyRow.ts.
		"src/settings/CommandBuilderModal.ts": 308,
		"src/settings/iconpicker/IconGrid.ts": 343,
		"src/icons/PackDataStore.ts": 309,
	};

	it("nothing new crosses the 300-line line", () => {
		const newcomers = files
			.filter((f) => lineCount(f) > SOFT_LIMIT && FROZEN[f.path] === undefined)
			.map((f) => `${f.path}  (${lineCount(f)} lines)`);
		assert.deepStrictEqual(
			newcomers,
			[],
			report(
				`These files passed ${SOFT_LIMIT} lines. Split by responsibility, or — if the file genuinely is one responsibility — add it to FROZEN with a note:`,
				newcomers,
			),
		);
	});

	it("none of the known-oversized files has grown", () => {
		const grown: string[] = [];
		for (const [path, frozen] of Object.entries(FROZEN)) {
			const f = files.find((x) => x.path === path);
			if (!f) continue; // handled by the staleness check below
			const now = lineCount(f);
			if (now > frozen) grown.push(`${path}  ${frozen} → ${now} (+${now - frozen})`);
		}
		assert.deepStrictEqual(
			grown,
			[],
			report(
				"An already-oversized file grew. Put the new code in a sibling module instead of raising these numbers:",
				grown,
			),
		);
	});

	it("the frozen list has no stale entries", () => {
		// Two kinds of rot, both of which quietly turn the ratchet into a
		// rubber band: a file that was split (so its entry now permits growth
		// it no longer needs) and a file that was deleted or renamed.
		const stale: string[] = [];
		for (const [path, frozen] of Object.entries(FROZEN)) {
			const f = files.find((x) => x.path === path);
			if (!f) {
				stale.push(`${path}  — gone; remove the entry`);
				continue;
			}
			const now = lineCount(f);
			if (now <= SOFT_LIMIT) {
				stale.push(`${path}  — now ${now} lines; remove the entry`);
			} else if (now < frozen) {
				stale.push(`${path}  — now ${now} lines; lower the entry from ${frozen}`);
			}
		}
		assert.deepStrictEqual(
			stale,
			[],
			report("Tighten the ratchet — these entries are looser than the truth:", stale),
		);
	});
});

/* -------------------------------------------------------------------------- */
/* The document itself                                                        */
/* -------------------------------------------------------------------------- */

describe("CLAUDE.md describes the checks that exist", () => {
	const doc = readRepoFile("CLAUDE.md");

	it("does not claim the repository is untested", () => {
		// It said exactly this while every suite above was already running under
		// `npm test`. The damage is not the inaccuracy: CLAUDE.md is read as the
		// instruction, so a contributor who believes the sentence writes no test.
		assert.strictEqual(
			/no automated test/i.test(doc),
			false,
			"CLAUDE.md still says there is no automated test suite",
		);
	});

	it("lists `npm test` among the commands", () => {
		const commands = doc.split("```")[1] ?? "";

		assert.ok(
			/^npm test\b/m.test(commands),
			"CLAUDE.md's Commands block does not mention `npm test`",
		);
	});

	it("still says what the suite cannot see", () => {
		// The manual pass is not superstition — the DOM is a stand-in and
		// `obsidian` is a stub, so nothing here can tell whether a callout
		// *looks* right. Dropping that sentence would trade one wrong
		// instruction for another.
		assert.ok(
			doc.includes("reload Obsidian"),
			"CLAUDE.md no longer tells anyone to check the result in Obsidian",
		);
	});
});
