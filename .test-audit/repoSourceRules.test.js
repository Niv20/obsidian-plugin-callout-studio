// tests/repoSourceRules.test.ts
import assert2 from "node:assert";
import { describe, it } from "node:test";

// tests/support/sourceScan.ts
import assert from "node:assert";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
var REPO_ROOT = process.cwd();
assert.ok(
  existsSync(join(REPO_ROOT, "manifest.json")) && existsSync(join(REPO_ROOT, "src")),
  `sourceScan: cwd is not the repository root (${REPO_ROOT}). Run the suites through \`npm test\`.`
);
function readRepoFile(relPath) {
  return readFileSync(join(REPO_ROOT, relPath), "utf8");
}
var GENERATED_OR_DATA = [
  "src/i18n/",
  "src/icons/data/",
  "src/data/"
];
function isGeneratedOrData(path) {
  return GENERATED_OR_DATA.some((prefix) => path.startsWith(prefix));
}
var cached = null;
function scanTree(relDir) {
  const out = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir).sort()) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) {
        walk(full);
        continue;
      }
      if (!full.endsWith(".ts")) continue;
      const text = readFileSync(full, "utf8");
      out.push({
        path: relative(REPO_ROOT, full).split(sep).join("/"),
        text,
        code: blankLiterals(text)
      });
    }
  };
  walk(join(REPO_ROOT, relDir));
  return out;
}
function allSourceFiles() {
  cached ??= scanTree("src");
  return cached;
}
function pluginSourceFiles() {
  return allSourceFiles().filter((f) => !isGeneratedOrData(f.path));
}
var REGEX_PRECEDERS = new Set("(,=:[!&|?{};+-*%~^<>");
var REGEX_KEYWORDS = /* @__PURE__ */ new Set([
  "return",
  "typeof",
  "instanceof",
  "in",
  "of",
  "new",
  "delete",
  "void",
  "case",
  "do",
  "else",
  "yield",
  "await"
]);
function scan(text) {
  const out = new Array(text.length).fill(" ");
  const found = [];
  const stack = [{ kind: "code", fromHole: false, braces: 0 }];
  let i = 0;
  let lastSignificant = "";
  let lastWord = "";
  const blank = (from, to) => {
    for (let k = from; k < to && k < text.length; k++) {
      out[k] = text[k] === "\n" ? "\n" : " ";
    }
  };
  const keep = (k) => {
    out[k] = text[k];
  };
  const advance = (c) => {
    if (/\s/.test(c)) return;
    lastSignificant = c;
    lastWord = /[A-Za-z_$0-9]/.test(c) ? lastWord + c : "";
  };
  while (i < text.length) {
    const frame = stack[stack.length - 1];
    if (frame.kind === "template") {
      const start = i;
      let j = i;
      while (j < text.length) {
        if (text[j] === "\\") {
          j += 2;
          continue;
        }
        if (text[j] === "`") break;
        if (text[j] === "$" && text[j + 1] === "{") break;
        j++;
      }
      blank(start, j);
      if (j > start) {
        found.push({
          kind: "template",
          value: text.slice(start, j),
          start,
          end: j
        });
      }
      i = j;
      if (text[i] === "`") {
        keep(i);
        i++;
        stack.pop();
        advance("`");
      } else if (text[i] === "$") {
        keep(i);
        keep(i + 1);
        i += 2;
        stack.push({ kind: "code", fromHole: true, braces: 0 });
        advance("{");
      }
      continue;
    }
    const c = text[i];
    const next = text[i + 1];
    if (c === "/" && next === "/") {
      let j = i;
      while (j < text.length && text[j] !== "\n") j++;
      blank(i, j);
      i = j;
      continue;
    }
    if (c === "/" && next === "*") {
      let j = i + 2;
      while (j < text.length && !(text[j] === "*" && text[j + 1] === "/")) j++;
      j = Math.min(j + 2, text.length);
      blank(i, j);
      i = j;
      continue;
    }
    if (c === '"' || c === "'") {
      const start = i;
      let j = i + 1;
      while (j < text.length && text[j] !== c && text[j] !== "\n") {
        j += text[j] === "\\" ? 2 : 1;
      }
      const closed = text[j] === c;
      const bodyEnd = j;
      const end = closed ? j + 1 : j;
      keep(start);
      blank(start + 1, bodyEnd);
      if (closed) keep(bodyEnd);
      found.push({
        kind: "string",
        value: text.slice(start + 1, bodyEnd),
        start,
        end
      });
      i = end;
      advance(c);
      continue;
    }
    if (c === "`") {
      keep(i);
      i++;
      stack.push({ kind: "template", fromHole: false, braces: 0 });
      continue;
    }
    if (c === "/" && startsRegex(lastSignificant, lastWord)) {
      let j = i + 1;
      let inClass = false;
      let terminated = false;
      while (j < text.length) {
        const d = text[j];
        if (d === "\\") {
          j += 2;
          continue;
        }
        if (d === "\n") break;
        if (d === "[") inClass = true;
        else if (d === "]") inClass = false;
        else if (d === "/" && !inClass) {
          terminated = true;
          break;
        }
        j++;
      }
      if (terminated) {
        let end = j + 1;
        while (end < text.length && /[a-z]/.test(text[end])) end++;
        keep(i);
        blank(i + 1, end);
        found.push({ kind: "regex", value: text.slice(i + 1, j), start: i, end });
        i = end;
        advance("/");
        continue;
      }
    }
    keep(i);
    if (c === "{") frame.braces++;
    else if (c === "}") {
      if (frame.fromHole && frame.braces === 0) {
        stack.pop();
        i++;
        advance("}");
        continue;
      }
      frame.braces--;
    }
    advance(c);
    i++;
  }
  return {
    blanked: out.join(""),
    literals: found,
    balanced: stack.length === 1
  };
}
function startsRegex(lastSignificant, lastWord) {
  if (lastSignificant === "") return true;
  if (REGEX_KEYWORDS.has(lastWord)) return true;
  return REGEX_PRECEDERS.has(lastSignificant);
}
function blankLiterals(text) {
  return scan(text).blanked;
}
function literals(text) {
  return scan(text).literals;
}
function scanIsBalanced(text) {
  return scan(text).balanced;
}
function lineOf(text, index) {
  let line = 1;
  for (let i = 0; i < index && i < text.length; i++) {
    if (text[i] === "\n") line++;
  }
  return line;
}
function at(file, index) {
  return `${file.path}:${lineOf(file.text, index)}`;
}
function argSpan(code, openParen) {
  let depth = 0;
  for (let i = openParen; i < code.length; i++) {
    const c = code[i];
    if (c === "(") depth++;
    else if (c === ")") {
      depth--;
      if (depth === 0) return { start: openParen + 1, end: i };
    }
  }
  return null;
}
function report(title, lines) {
  return `${title}
  ${lines.join("\n  ")}
`;
}

// tests/repoSourceRules.test.ts
var files = pluginSourceFiles();
function lineCount(file) {
  return file.text.replace(/\n$/, "").split("\n").length;
}
describe("the source scanner is sound", () => {
  it("found the source tree", () => {
    assert2.ok(
      files.length > 100,
      `only ${files.length} source files found \u2014 the walk is looking in the wrong place`
    );
  });
  it("finishes every file in a code state", () => {
    const unbalanced = files.filter((f) => !scanIsBalanced(f.text));
    assert2.deepStrictEqual(
      unbalanced.map((f) => f.path),
      [],
      "the scanner ended one of these files inside a string or template, which means it silently blanked real code"
    );
  });
  it("keeps offsets and line numbers intact", () => {
    for (const f of files) {
      assert2.strictEqual(f.code.length, f.text.length, `${f.path}: length drift`);
      assert2.strictEqual(
        (f.code.match(/\n/g) ?? []).length,
        (f.text.match(/\n/g) ?? []).length,
        `${f.path}: newline drift`
      );
    }
  });
});
describe("no hardcoded UI copy", () => {
  const TEXT_SETTERS = [
    "setName",
    "setDesc",
    "setText",
    "setTitle",
    "setTooltip",
    "setButtonText",
    "setPlaceholder"
  ];
  const LOOKS_LIKE_PROSE = /[A-Za-z]{2}/;
  const TRANSLATED = /\bt\s*\(/;
  function violations() {
    const out = [];
    for (const f of files) {
      for (const setter of TEXT_SETTERS) {
        const re = new RegExp(`\\.${setter}\\s*\\(`, "g");
        for (const m of f.code.matchAll(re)) {
          const index = m.index ?? 0;
          const span = argSpan(f.code, index + m[0].length - 1);
          if (!span) continue;
          const raw = f.text.slice(span.start, span.end);
          if (TRANSLATED.test(raw)) continue;
          const prose = literals(raw).filter(
            (l) => LOOKS_LIKE_PROSE.test(l.value)
          );
          if (prose.length === 0) continue;
          out.push(
            `${at(f, index)}  .${setter}(${JSON.stringify(prose[0]?.value ?? "")}\u2026)`
          );
        }
      }
    }
    return out;
  }
  it("no text setter is handed a bare English literal", () => {
    const bad = violations();
    assert2.deepStrictEqual(
      bad,
      [],
      report(
        "These strings would stay English in all 31 other locales. Add a key to src/i18n/en.ts and call t():",
        bad
      )
    );
  });
  it("no Notice is raised with a bare literal", () => {
    const bad = [];
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
    assert2.deepStrictEqual(bad, [], report("Untranslated Notice text:", bad));
  });
  it("aria-labels go through t() too", () => {
    const NAMES = ["aria-label", "placeholder"];
    const bad = [];
    for (const f of files) {
      for (const m of f.code.matchAll(
        /setAttribute\s*\(\s*(["'])(\s*)\1\s*,/g
      )) {
        const index = m.index ?? 0;
        const name = f.text.slice(index, index + m[0].length).match(/["']([^"']*)["']/)?.[1];
        if (name === void 0 || !NAMES.includes(name)) continue;
        const span = argSpan(f.code, f.code.indexOf("(", index));
        if (!span) continue;
        const raw = f.text.slice(span.start, span.end);
        if (TRANSLATED.test(raw)) continue;
        const value = raw.slice(raw.indexOf(",") + 1);
        const prose = literals(value).filter(
          (l) => LOOKS_LIKE_PROSE.test(l.value)
        );
        if (prose.length > 0) {
          bad.push(`${at(f, index)}  ${name}="${prose[0]?.value ?? ""}"`);
        }
      }
    }
    assert2.deepStrictEqual(bad, [], report("Untranslated attribute text:", bad));
  });
});
describe("nothing sets a native tooltip", () => {
  function indices(text, re) {
    return [...text.matchAll(re)].map((m) => m.index ?? 0);
  }
  const FORMS = [
    {
      // setAttribute("title", …) / setAttr("title", …). The name is read
      // out of `f.text`, because `f.code` has blanked the string body.
      label: 'setAttribute("title", \u2026)',
      find: (f) => indices(f.code, /\bsetAttr(?:ibute)?\s*\(\s*(["'])(\s*)\1/g).filter(
        (i) => /["']title["']/.test(f.text.slice(i, i + 40))
      )
    },
    {
      // attr: { title: … } in a createEl/createDiv/createSpan options
      // object. Anchored on `attr:` so the plain options field is not
      // touched; the key survives blanking when it is a bare identifier,
      // and is read from `f.text` when it is quoted.
      label: "attr: { title: \u2026 }",
      find: (f) => indices(f.code, /\battr\s*:\s*\{/g).filter((i) => {
        const open = f.code.indexOf("{", i);
        const close = f.code.indexOf("}", open);
        if (close === -1) return false;
        return /[{,]\s*(["']?)title\1\s*:/.test(
          f.text.slice(open, close + 1)
        );
      })
    },
    {
      // el.title = …, but never `this.title =`: a receiver of `this` is a
      // class field by construction — ReplaceCalloutModal has one — and an
      // element is never `this`. That carve-out needs no allowlist, so it
      // cannot go stale the way a frozen list of files would.
      label: "el.title = \u2026",
      find: (f) => indices(f.code, /(?<!\bthis)\.title\s*=(?!=)/g)
    }
  ];
  it("no title attribute reaches the DOM", () => {
    const bad = [];
    for (const f of files) {
      for (const form of FORMS) {
        for (const index of form.find(f)) {
          bad.push(`${at(f, index)}  ${form.label}`);
        }
      }
    }
    assert2.deepStrictEqual(
      bad,
      [],
      report(
        "A `title` draws the OS tooltip, which stacks with Obsidian's and is inherited by every child. Use aria-label:",
        bad
      )
    );
  });
  it("the rule sees each of the three forms", () => {
    const fake = (text) => ({
      path: "src/fake.ts",
      text,
      code: blankLiterals(text)
    });
    const caught = (text) => FORMS.some((form) => form.find(fake(text)).length > 0);
    for (const sample of [
      'el.setAttribute("title", label);',
      "el.setAttr('title', label);",
      'row.createDiv({ cls: "x", attr: { title: name } });',
      'row.createDiv({ attr: { "title": name } });',
      "el.title = name;"
    ]) {
      assert2.ok(caught(sample), `missed: ${sample}`);
    }
    for (const sample of [
      'el.setAttribute("aria-label", label);',
      'new ConfirmModal(app, { title: t("x") });',
      'row.createDiv({ attr: { "aria-label": name } });',
      "this.title = t('x');",
      "const { title } = parseHeader(line);"
    ]) {
      assert2.ok(!caught(sample), `false positive: ${sample}`);
    }
  });
});
describe("every listener is released", () => {
  const EMITTER_ON = /\b(workspace|vault|metadataCache)\s*\.\s*on\s*\(/g;
  it("every workspace/vault/metadataCache listener is registered or offref'd", () => {
    const bad = [];
    for (const f of files) {
      const released = /* @__PURE__ */ new Set();
      for (const m of f.code.matchAll(/offref\s*\(\s*([\w$.]+)\s*\)/g)) {
        released.add(m[1].replace(/^this\./, ""));
      }
      for (const m of f.code.matchAll(EMITTER_ON)) {
        const index = m.index ?? 0;
        const before = f.code.slice(Math.max(0, index - 300), index);
        if (/registerEvent\s*\(\s*[\w$.]*$/.test(before)) continue;
        const assign = /(?:const|let|var)\s+([\w$]+)\s*(?::[^=]*)?=\s*[\w$.]*$|([\w$.]+)\s*=\s*[\w$.]*$/.exec(
          before
        );
        const name = (assign?.[1] ?? assign?.[2] ?? "").replace(/^this\./, "");
        if (name && released.has(name)) continue;
        bad.push(
          `${at(f, index)}  ${m[1]}.on(\u2026)${name ? ` \u2192 ${name}` : ""}`
        );
      }
    }
    assert2.deepStrictEqual(
      bad,
      [],
      report(
        "These listeners outlive their owner. Wrap the call in this.registerEvent(\u2026), or keep the EventRef and pass it to app.workspace.offref() when the owner goes away:",
        bad
      )
    );
  });
  it("nothing listens on a document or window without taking it back", () => {
    const GLOBAL_HOST = /^(document|window|activeDocument|activeWindow|globalThis|ownerDoc|ownerWin|body)$/;
    const bad = [];
    for (const f of files) {
      const removed = f.code.matchAll(/removeEventListener\s*\(/g);
      const removedText = [];
      for (const m of removed) {
        const span = argSpan(f.code, (m.index ?? 0) + m[0].length - 1);
        if (span) removedText.push(f.code.slice(span.start, span.end));
      }
      for (const m of f.code.matchAll(
        /\b([\w$]+(?:\.[\w$]+)*)\.addEventListener\s*\(/g
      )) {
        const index = m.index ?? 0;
        const host = m[1].split(".").pop() ?? "";
        if (!GLOBAL_HOST.test(host)) continue;
        const before = f.code.slice(Math.max(0, index - 120), index);
        if (/registerDomEvent\s*\(\s*$/.test(before)) continue;
        const span = argSpan(f.code, index + m[0].length - 1);
        const args = span ? f.code.slice(span.start, span.end) : "";
        const handler = args.slice(args.indexOf(",") + 1).trim();
        if (handler && removedText.some((r) => r.includes(handler))) continue;
        bad.push(`${at(f, index)}  ${m[1]}.addEventListener(${args.slice(0, 60)})`);
      }
    }
    assert2.deepStrictEqual(
      bad,
      [],
      report(
        "These attach to a document or window and never detach. Use plugin.registerDomEvent(), or call removeEventListener with the same handler on teardown:",
        bad
      )
    );
  });
  it("no interval runs outside registerInterval", () => {
    const bad = [];
    for (const f of files) {
      for (const m of f.code.matchAll(/\bsetInterval\s*\(/g)) {
        const index = m.index ?? 0;
        const before = f.code.slice(Math.max(0, index - 60), index);
        if (/registerInterval\s*\(\s*(?:window\.)?$/.test(before)) continue;
        bad.push(at(f, index));
      }
    }
    assert2.deepStrictEqual(
      bad,
      [],
      report("Wrap these in this.registerInterval(window.setInterval(\u2026)):", bad)
    );
  });
});
describe("no `any` without an explicit exemption", () => {
  const ANY_IN_TYPE_POSITION = [
    /:\s*any\b/g,
    // annotation
    /\bas\s+any\b/g,
    // assertion
    /<\s*any\s*[,>]/g,
    // type argument
    /\bany\s*\[\s*\]/g,
    // array
    /[|&]\s*any\b/g,
    // union / intersection member
    /=>\s*any\b/g
    // return type
  ];
  it("src/ contains no `any` that is not explicitly disabled", () => {
    const bad = [];
    for (const f of files) {
      const lines = f.text.split("\n");
      for (const re of ANY_IN_TYPE_POSITION) {
        for (const m of f.code.matchAll(re)) {
          const line = lineOf(f.text, m.index ?? 0);
          const context = `${lines[line - 2] ?? ""}
${lines[line - 1] ?? ""}`;
          if (/eslint-disable[\w-]*\s+.*no-explicit-any/.test(context)) continue;
          bad.push(`${f.path}:${line}  ${m[0].trim()}`);
        }
      }
    }
    assert2.deepStrictEqual(
      bad,
      [],
      report(
        "TypeScript strict mode is the point of this codebase. If one of these is genuinely unavoidable, narrow it to `unknown` or write the eslint-disable comment and say why:",
        bad
      )
    );
  });
});
describe("main.ts stays lifecycle and wiring", () => {
  const MAIN_TS_MAX_LINES = 600;
  const main = files.find((f) => f.path === "src/main.ts");
  it("exists", () => {
    assert2.ok(main, "src/main.ts not found");
  });
  it(`is at most ${MAIN_TS_MAX_LINES} lines`, () => {
    const lines = lineCount(main);
    assert2.ok(
      lines <= MAIN_TS_MAX_LINES,
      `src/main.ts is ${lines} lines (ceiling ${MAIN_TS_MAX_LINES}). Move the logic into a sub-module rather than raising this.`
    );
  });
});
describe("the network surface is exactly what the README discloses", () => {
  const ALLOWED_REQUEST_URL = {
    "src/icons/PackDataStore.ts": "whole icon packs, SHA-256 verified against packManifest.ts",
    "src/icons/packs/material.ts": "one Material Symbols drawing, on demand from the picker",
    "src/icons/packs/materialFont.ts": "the Material Symbols webfont, for the picker grid",
    "src/i18n/LocaleStore.ts": "the user's UI language \u2014 the one background fetch, argued for in CLAUDE.md"
  };
  it("only the disclosed files call requestUrl", () => {
    const callers = allSourceFiles().filter((f) => /\brequestUrl\s*\(/.test(f.code)).map((f) => f.path).sort();
    assert2.deepStrictEqual(
      callers,
      Object.keys(ALLOWED_REQUEST_URL).sort(),
      "the set of files that reach the network changed. Every addition needs a line in the README's 'Network usage and privacy' section and an entry here \u2014 and per CLAUDE.md, must be triggered by an explicit user action with an offline fallback."
    );
  });
  it("nothing uses a network primitive that bypasses requestUrl", () => {
    const BANNED = [
      /\bfetch\s*\(/g,
      /\bXMLHttpRequest\b/g,
      /\bWebSocket\b/g,
      /\bEventSource\b/g,
      /navigator\s*\.\s*sendBeacon\b/g,
      /\bnavigator\s*\.\s*serviceWorker\b/g
    ];
    const bad = [];
    for (const f of allSourceFiles()) {
      for (const re of BANNED) {
        for (const m of f.code.matchAll(re)) {
          bad.push(`${at(f, m.index ?? 0)}  ${m[0]}`);
        }
      }
    }
    assert2.deepStrictEqual(
      bad,
      [],
      report("Use Obsidian's requestUrl instead:", bad)
    );
  });
  it("nothing evaluates remote code", () => {
    const bad = [];
    for (const f of allSourceFiles()) {
      for (const m of f.code.matchAll(
        /\beval\s*\(|new\s+Function\s*\(|createEl\s*\(\s*["']script["']/g
      )) {
        bad.push(`${at(f, m.index ?? 0)}  ${m[0]}`);
      }
    }
    assert2.deepStrictEqual(bad, [], report("Remote/dynamic code execution:", bad));
  });
  it("every remote host in the source is one of the disclosed four", () => {
    const ALLOWED_HOSTS = /* @__PURE__ */ new Set([
      // Not a request at all: the SVG XML namespace, written into every
      // piece of markup this plugin builds. It is a name, and nothing
      // ever resolves it.
      "www.w3.org",
      "cdn.jsdelivr.net",
      // icon packs and locale files
      "raw.githubusercontent.com",
      // their fallback
      "fonts.gstatic.com",
      // Material Symbols artwork and webfont
      "fonts.googleapis.com",
      // the webfont's stylesheet
      "github.com",
      // user-clicked links only
      "docs.obsidian.md",
      "obsidian.md",
      "www.gnu.org",
      // licence links in the credits
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
      "www.paypal.com"
    ]);
    const seen = /* @__PURE__ */ new Map();
    for (const f of allSourceFiles()) {
      for (const lit of literals(f.text)) {
        for (const m of lit.value.matchAll(/https?:\/\/([A-Za-z0-9.-]+)/g)) {
          const host = m[1];
          if (!seen.has(host)) seen.set(host, at(f, lit.start));
        }
      }
    }
    const unknown = [...seen.entries()].filter(([host]) => !ALLOWED_HOSTS.has(host)).map(([host, where]) => `${host}  (${where})`);
    assert2.deepStrictEqual(
      unknown,
      [],
      report(
        "A host appears in src/ that is not on the disclosed list. If the plugin requests it, disclose it in the README; if a user clicks it, add it here:",
        unknown
      )
    );
  });
});
describe("no new oversized files", () => {
  const SOFT_LIMIT = 300;
  const FROZEN = {
    // Raised from 2322 for the create-only autofocus: the guard, the field
    // holding its disposer, and the two lines that release it on close.
    // Everything movable already moved — settings/modalAutofocus.ts owns the
    // focus and the scroll hold whole — and what is left is the one thing
    // only this class can answer: whether this window is creating a callout.
    "src/settings/CalloutEditor.ts": 2328,
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
    "src/manager/CalloutRegistry.ts": 1892,
    // Raised from 1184 for the same set, rejected in `validateIdString`.
    // Same reasoning: "which id strings are valid on import" is the one
    // thing this file is for, so the rule cannot move out of it without
    // splitting the answer in two.
    "src/utils/importValidator.ts": 1199,
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
    "src/types.ts": 825,
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
    "src/utils/vaultCalloutScanner.ts": 409,
    // Lowered from 593: the suggestion row's icon and accent go through
    // manager/theme/calloutListIcon.ts, shared with the three other lists
    // that draw a callout small.
    "src/editor/AutoComplete.ts": 574,
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
    "src/main.ts": 454,
    "src/icons/renderIcon.ts": 547,
    // Lowered from 528: `STYLE_DEMO_ID` moved to constants.ts, where the
    // discovery/import/autocomplete filters that now consult it can reach
    // it without importing a settings modal.
    // Lowered from 522: standing a demo callout up and taking it down —
    // including raising `settingsEditOpen` for as long as it is up, which is
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
    "src/editor/contextmenu/resolve.ts": 455,
    "src/ui/TagInput.ts": 414,
    "src/settings/editor/CalloutEditorSave.ts": 368,
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
    // Lowered from 345: its row icon goes through
    // manager/theme/calloutListIcon.ts. Lowered again from 337: the shortcut
    // chips and the hotkey-pane button — carried identically by both lists
    // in the window — moved to settings/command/hotkeyRow.ts.
    "src/settings/CommandBuilderModal.ts": 303,
    "src/settings/iconpicker/IconGrid.ts": 343,
    "src/icons/PackDataStore.ts": 309
  };
  it("nothing new crosses the 300-line line", () => {
    const newcomers = files.filter((f) => lineCount(f) > SOFT_LIMIT && FROZEN[f.path] === void 0).map((f) => `${f.path}  (${lineCount(f)} lines)`);
    assert2.deepStrictEqual(
      newcomers,
      [],
      report(
        `These files passed ${SOFT_LIMIT} lines. Split by responsibility, or \u2014 if the file genuinely is one responsibility \u2014 add it to FROZEN with a note:`,
        newcomers
      )
    );
  });
  it("none of the known-oversized files has grown", () => {
    const grown = [];
    for (const [path, frozen] of Object.entries(FROZEN)) {
      const f = files.find((x) => x.path === path);
      if (!f) continue;
      const now = lineCount(f);
      if (now > frozen) grown.push(`${path}  ${frozen} \u2192 ${now} (+${now - frozen})`);
    }
    assert2.deepStrictEqual(
      grown,
      [],
      report(
        "An already-oversized file grew. Put the new code in a sibling module instead of raising these numbers:",
        grown
      )
    );
  });
  it("the frozen list has no stale entries", () => {
    const stale = [];
    for (const [path, frozen] of Object.entries(FROZEN)) {
      const f = files.find((x) => x.path === path);
      if (!f) {
        stale.push(`${path}  \u2014 gone; remove the entry`);
        continue;
      }
      const now = lineCount(f);
      if (now <= SOFT_LIMIT) {
        stale.push(`${path}  \u2014 now ${now} lines; remove the entry`);
      } else if (now < frozen) {
        stale.push(`${path}  \u2014 now ${now} lines; lower the entry from ${frozen}`);
      }
    }
    assert2.deepStrictEqual(
      stale,
      [],
      report("Tighten the ratchet \u2014 these entries are looser than the truth:", stale)
    );
  });
});
describe("CLAUDE.md describes the checks that exist", () => {
  const doc = readRepoFile("CLAUDE.md");
  it("does not claim the repository is untested", () => {
    assert2.strictEqual(
      /no automated test/i.test(doc),
      false,
      "CLAUDE.md still says there is no automated test suite"
    );
  });
  it("lists `npm test` among the commands", () => {
    const commands = doc.split("```")[1] ?? "";
    assert2.ok(
      /^npm test\b/m.test(commands),
      "CLAUDE.md's Commands block does not mention `npm test`"
    );
  });
  it("still says what the suite cannot see", () => {
    assert2.ok(
      doc.includes("reload Obsidian"),
      "CLAUDE.md no longer tells anyone to check the result in Obsidian"
    );
  });
});
