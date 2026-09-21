// tests/repoStyles.test.ts
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
function report(title, lines) {
  return `${title}
  ${lines.join("\n  ")}
`;
}

// tests/repoStyles.test.ts
var files = pluginSourceFiles();
var css = readRepoFile("styles.css").replace(
  /\/\*[\s\S]*?\*\//g,
  (m) => m.replace(/[^\n]/g, " ")
);
var cssRaw = readRepoFile("styles.css");
var OWNED = /(?<![-\w])(?:cs|callout-studio)-[A-Za-z0-9_-]*/;
describe("--cs-* custom properties", () => {
  const DECLARED = /(?:^|[;{)\s])(--cs-[A-Za-z0-9-]+)\s*:/g;
  const READ = /var\(\s*(--cs-[A-Za-z0-9-]+)\s*([,)])/g;
  const written = /* @__PURE__ */ new Set();
  const readBare = /* @__PURE__ */ new Map();
  const readWithFallback = /* @__PURE__ */ new Set();
  for (const m of css.matchAll(DECLARED)) written.add(m[1]);
  for (const m of css.matchAll(READ)) {
    const name = m[1];
    if (m[2] === ",") readWithFallback.add(name);
    else if (!readBare.has(name)) {
      readBare.set(name, `styles.css:${lineOf(cssRaw, m.index ?? 0)}`);
    }
  }
  for (const f of files) {
    for (const lit of literals(f.text)) {
      for (const m of lit.value.matchAll(/--cs-[A-Za-z0-9-]+/g)) {
        const name = m[0];
        const beforeInLit = lit.value.slice(0, m.index ?? 0);
        if (/var\(\s*$/.test(beforeInLit)) continue;
        written.add(name);
      }
      for (const m of lit.value.matchAll(READ)) {
        const name = m[1];
        if (m[2] === ",") readWithFallback.add(name);
        else if (!readBare.has(name)) readBare.set(name, at(f, lit.start));
      }
    }
  }
  it("found both sides", () => {
    assert2.ok(written.size > 5, "no --cs-* declarations found at all");
    assert2.ok(readBare.size + readWithFallback.size > 5, "no --cs-* reads found");
  });
  it("every fallback-less read has a writer", () => {
    const orphans = [...readBare.entries()].filter(([name]) => !written.has(name)).map(([name, where]) => `${name}  (${where})`);
    assert2.deepStrictEqual(
      orphans,
      [],
      report(
        "These resolve to nothing, so the declaration reading them is dropped entirely. Either set the property, or give the read a fallback and make it a deliberate escape hatch:",
        orphans
      )
    );
  });
  const COMPAT_EXPORTS = /* @__PURE__ */ new Set(["--cs-color-rgb"]);
  it("every property that is written is also read", () => {
    const unread = [...written].filter(
      (n) => !readBare.has(n) && !readWithFallback.has(n) && !COMPAT_EXPORTS.has(n)
    ).sort();
    assert2.deepStrictEqual(
      unread,
      [],
      report("Written but never read \u2014 dead custom properties:", unread)
    );
  });
  it("the compatibility exports are still written", () => {
    for (const name of COMPAT_EXPORTS) {
      assert2.ok(
        written.has(name),
        `${name} is listed as a compatibility export but nothing writes it any more \u2014 delete the entry`
      );
    }
  });
  it("the documented escape hatches still have their fallbacks", () => {
    const HATCHES = [
      "--cs-heading-fold-offset",
      "--cs-heading-icon-offset",
      "--cs-regular-icon-gap"
    ];
    for (const name of HATCHES) {
      assert2.ok(
        readWithFallback.has(name),
        `${name} is documented as a snippet escape hatch but is no longer read with a fallback`
      );
      assert2.ok(
        !readBare.has(name),
        `${name} is read somewhere without a fallback, which defeats the point of it being optional`
      );
    }
  });
});
describe("class names in styles.css and src/ agree", () => {
  const PREFIXES = [
    "cs-import-issue-",
    "cs-settings-group",
    "cs-palette-menu-item",
    "cs-border-side-btn"
  ];
  const NOT_A_CLASS = /* @__PURE__ */ new Set([
    "callout-studio-css",
    // localStorage key for the startup CSS snapshot
    "callout-studio-local",
    // localStorage key for the device-local state
    "callout-studio-dynamic-css",
    // <style> element id
    "callout-studio-do-not-delete",
    // the legacy vault snippet's filename
    "callout-studio-custom",
    // the exported vault snippet's filename
    "callout-studio-welcome",
    // obsidian:// URI action
    "callout-studio-context-menu",
    // Menu section id
    "callout-studio-export",
    // export filename stem
    "callout-studio-upgrade-recovery",
    // recovery archive format identifier
    "callout-studio-recovery"
    // inert legacy snippet archive directory
  ]);
  const EMITTED_WITHOUT_RULES = /* @__PURE__ */ new Set([
    "cs-discover-callouts-btn",
    // stable action hook; neutral-button and heading rules supply its styling
    "callout-studio-credit-license",
    "callout-studio-delete-modal",
    "callout-studio-delete-modal-hint",
    "callout-studio-delete-modal-warning",
    "callout-studio-footer-tagline",
    "callout-studio-more-btn",
    "callout-studio-replace-modal",
    "cs-cm-widget",
    "cs-command-editor",
    "cs-fold-dropdown",
    "cs-fold-trigger",
    "cs-icon-source",
    "cs-source-name",
    "cs-welcome-hero",
    "cs-welcome-panel"
  ]);
  const STYLED_BY_GENERATED_CSS = /* @__PURE__ */ new Set(["cs-export-icon", "cs-unknown"]);
  const RULES_WITHOUT_EMITTERS = /* @__PURE__ */ new Set([]);
  const styled = /* @__PURE__ */ new Set();
  for (const m of css.matchAll(
    new RegExp(`\\.(${OWNED.source})`, "g")
  )) {
    styled.add(m[1]);
  }
  const emitted = /* @__PURE__ */ new Map();
  for (const f of files) {
    for (const lit of literals(f.text)) {
      if (!/(?:cs|callout-studio)-/.test(lit.value)) continue;
      for (const m of lit.value.matchAll(new RegExp(OWNED.source, "g"))) {
        const name = m[0];
        const index = m.index ?? 0;
        if (name.endsWith("-") || lit.value.slice(index + name.length, index + name.length + 2) === "${") {
          continue;
        }
        if (NOT_A_CLASS.has(name)) continue;
        if (!emitted.has(name)) emitted.set(name, at(f, lit.start));
      }
    }
  }
  it("found both sides", () => {
    assert2.ok(styled.size > 200, `only ${styled.size} classes in styles.css`);
    assert2.ok(emitted.size > 200, `only ${emitted.size} classes emitted from src/`);
  });
  it("every class the code applies has a rule", () => {
    const bad = [...emitted.entries()].filter(
      ([name]) => !styled.has(name) && !EMITTED_WITHOUT_RULES.has(name) && !STYLED_BY_GENERATED_CSS.has(name)
    ).map(([name, where]) => `${name}  (${where})`).sort();
    assert2.deepStrictEqual(
      bad,
      [],
      report(
        "These classes are applied but styled by nothing. Add the rule; if CSSInjector already styles it, add it to STYLED_BY_GENERATED_CSS; if it is only a JS hook, add it to EMITTED_WITHOUT_RULES with the reason:",
        bad
      )
    );
  });
  it("every rule in styles.css is applied by something", () => {
    const bad = [...styled].filter(
      (name) => !emitted.has(name) && !RULES_WITHOUT_EMITTERS.has(name) && !PREFIXES.some((p) => name.startsWith(p))
    ).sort();
    assert2.deepStrictEqual(
      bad,
      [],
      report(
        "These rules style a class nothing applies \u2014 usually a rename that only landed on one side:",
        bad
      )
    );
  });
  it("the frozen exception lists have no stale entries", () => {
    const stale = [];
    for (const name of EMITTED_WITHOUT_RULES) {
      if (styled.has(name)) {
        stale.push(`EMITTED_WITHOUT_RULES: ${name} now has a rule \u2014 remove it`);
      } else if (!emitted.has(name)) {
        stale.push(`EMITTED_WITHOUT_RULES: ${name} is no longer emitted \u2014 remove it`);
      }
    }
    for (const name of RULES_WITHOUT_EMITTERS) {
      if (emitted.has(name)) {
        stale.push(`RULES_WITHOUT_EMITTERS: ${name} is emitted now \u2014 remove it`);
      } else if (!styled.has(name)) {
        stale.push(`RULES_WITHOUT_EMITTERS: ${name} has no rule left \u2014 remove it`);
      }
    }
    for (const name of STYLED_BY_GENERATED_CSS) {
      if (styled.has(name)) {
        stale.push(
          `STYLED_BY_GENERATED_CSS: ${name} has a styles.css rule now \u2014 remove it`
        );
      } else if (!emitted.has(name)) {
        stale.push(
          `STYLED_BY_GENERATED_CSS: ${name} is no longer emitted \u2014 remove it`
        );
      }
    }
    assert2.deepStrictEqual(stale, [], report("Stale exceptions:", stale));
  });
});
describe("modal surfaces use the --cs-surface pair", () => {
  it("no rule scoped to .cs-modal paints a raw --background-primary", () => {
    const bad = [];
    const RULE = /([^{}]+)\{([^{}]*)\}/g;
    for (const m of css.matchAll(RULE)) {
      const selector = m[1].trim();
      const body = m[2];
      if (!/\.cs-modal\b/.test(selector)) continue;
      for (const decl of body.matchAll(
        /(background|background-color)\s*:\s*var\(\s*(--background-primary|--background-secondary)\s*\)/g
      )) {
        bad.push(
          `styles.css:${lineOf(cssRaw, m.index ?? 0)}  ${selector.slice(0, 70)} \u2192 ${decl[2]}`
        );
      }
    }
    assert2.deepStrictEqual(
      bad,
      [],
      report(
        "Inside .cs-modal, paint var(--cs-surface, var(--background-primary)) or var(--cs-surface-raised, var(--background-secondary)) \u2014 the raw variables are wrong on mobile dark:",
        bad
      )
    );
  });
});
