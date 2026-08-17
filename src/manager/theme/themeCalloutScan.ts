/**
 * manager/theme/themeCalloutScan.ts — which callouts a stylesheet claims.
 *
 * Pure text in, plain data out: no DOM, no `CSSStyleSheet`, nothing to mock.
 * That is deliberate. The obvious implementation is to `replaceSync()` the
 * theme into an unadopted sheet and walk `cssRules`, which is what Callout
 * Manager does — but `CSSStyleSheet` does not exist in this repo's test DOM,
 * and a scanner nobody can test is how a false "your theme conflicts here"
 * badge ships. Comments are stripped up front and string bodies are skipped,
 * which is the only thing the CSSOM was really buying.
 *
 * ## What counts as a claim
 *
 * Only `[data-callout=x]` and `[data-callout^=x]`. `~=`, `*=` and `$=` are
 * skipped, and that is not a shortcut — ITS Theme writes
 * `[data-callout*=column]` to catch `two-column`, `three-column` and friends,
 * and reading that as an id invents a callout named "column" that nobody has.
 * Callout Manager learned the same lesson; the one thing it gets wrong is
 * treating `^=` as an id too, when it is a *prefix* and has to be matched
 * against the registry with `startsWith` instead.
 *
 * ## Why the class count
 *
 * A claim is only interesting if the theme's rule actually outranks ours, so
 * each id records the highest class-count seen among the selectors that match
 * it. That is the `b` of `(a,b,c)`: classes, attributes and pseudo-classes all
 * count one each, and since `b` is compared before `c` it is the number that
 * decides who wins.
 */

/** One thing a stylesheet says about one callout id. */
export interface ThemeClaim {
	/** Highest `b`-component (classes + attributes + pseudo-classes) seen. */
	maxClasses: number;
	/** Declared property names, lower-cased. `--callout-color`, `background`, … */
	props: Set<string>;
	/** The subset of `props` marked `!important`, which force cannot beat. */
	important: Set<string>;
}

export interface ThemeScan {
	/** Exact `[data-callout=x]` claims, keyed by the id as written. */
	byId: Map<string, ThemeClaim>;
	/** `[data-callout^=x]` prefixes, which match a registry id by `startsWith`. */
	prefixes: Map<string, ThemeClaim>;
}

/**
 * Strip CSS comments. Not string-aware, and does not need to be: comment
 * punctuation inside a CSS string literal is legal but vanishingly rare, and
 * the cost of getting it wrong is one missed claim rather than a wrong one.
 */
function stripComments(css: string): string {
	return css.replace(/\/\*[\s\S]*?\*\//g, "");
}

/**
 * The `b` component of a selector's specificity: classes, attribute selectors
 * and pseudo-classes.
 *
 * `:where()` contributes nothing and its contents are dropped. `:not()`/`:is()`
 * take the maximum of their arguments, which is approximated here by simply
 * counting inside them — an over-count at worst, and over-counting only ever
 * makes us *more* cautious about claiming we can win.
 *
 * Pseudo-*elements* (`::before`) are `c`, not `b`, so the double-colon form is
 * removed before single colons are counted.
 */
export function classCountOf(selector: string): number {
	let s = selector;
	// :where(...) contributes zero — drop it, contents and all.
	let guard = 0;
	while (guard++ < 20) {
		const next = s.replace(/:where\([^()]*\)/g, "");
		if (next === s) break;
		s = next;
	}
	s = s.replace(/::[a-z-]+(\([^)]*\))?/g, "");
	const classes = (s.match(/\.[A-Za-z_-][\w-]*/g) ?? []).length;
	const attrs = (s.match(/\[[^\]]*\]/g) ?? []).length;
	const pseudos = (s.match(/(?<!:):[a-z-]+/g) ?? []).length;
	return classes + attrs + pseudos;
}

/** Every `[data-callout<op>=<value>]` in one selector. */
function calloutAttrs(selector: string): Array<{ op: string; value: string }> {
	const out: Array<{ op: string; value: string }> = [];
	const re =
		/\[\s*data-callout\s*([~^*$|]?)=\s*("([^"]*)"|'([^']*)'|([^\]\s]+))\s*(?:[iIsS]\s*)?\]/g;
	let m: RegExpExecArray | null;
	while ((m = re.exec(selector)) !== null) {
		const value = m[3] ?? m[4] ?? m[5] ?? "";
		if (value.length > 0) out.push({ op: m[1] ?? "", value });
	}
	return out;
}

function claimFor(map: Map<string, ThemeClaim>, key: string): ThemeClaim {
	let claim = map.get(key);
	if (!claim) {
		claim = { maxClasses: 0, props: new Set(), important: new Set() };
		map.set(key, claim);
	}
	return claim;
}

/** Property names declared in one rule body, with their `!important` flag. */
function declarationsOf(body: string): Array<{ name: string; bang: boolean }> {
	const out: Array<{ name: string; bang: boolean }> = [];
	for (const piece of body.split(";")) {
		const colon = piece.indexOf(":");
		if (colon < 0) continue;
		const name = piece.slice(0, colon).trim().toLowerCase();
		if (name.length === 0 || /[{}]/.test(name)) continue;
		out.push({ name, bang: /!\s*important/i.test(piece.slice(colon + 1)) });
	}
	return out;
}

/**
 * Visit every `prelude { body }` block, descending into at-rule wrappers.
 *
 * The close brace has to be found by depth rather than by the next `}`: with a
 * flat search, `@media print { .callout[data-callout=x] { … } }` matches the
 * *inner* rule's brace, so the inner selector ends up inside what is treated as
 * the wrapper's body and the claim is silently lost. A wrapper is recognised by
 * its body containing a brace at all, which covers `@media`, `@supports` and
 * their nestings without needing to know their names.
 */
function eachBlock(
	text: string,
	visit: (prelude: string, body: string) => void,
): void {
	let cursor = 0;
	while (cursor < text.length) {
		const open = text.indexOf("{", cursor);
		if (open < 0) return;
		let depth = 0;
		let close = -1;
		for (let i = open; i < text.length; i++) {
			const ch = text[i];
			if (ch === "{") depth++;
			else if (ch === "}" && --depth === 0) {
				close = i;
				break;
			}
		}
		if (close < 0) return;
		const prelude = text.slice(cursor, open);
		const body = text.slice(open + 1, close);
		cursor = close + 1;
		if (body.includes("{")) eachBlock(body, visit);
		else visit(prelude, body);
	}
}

/** Scan one stylesheet's text. */
export function scanCalloutClaims(css: string): ThemeScan {
	const byId = new Map<string, ThemeClaim>();
	const prefixes = new Map<string, ThemeClaim>();

	eachBlock(stripComments(css), (prelude, body) => {
		if (!prelude.includes("data-callout")) return;
		const decls = declarationsOf(body);

		// A selector list; each comma-separated part is scored on its own.
		for (const part of prelude.split(",")) {
			if (!part.includes("data-callout")) continue;
			const weight = classCountOf(part);
			for (const { op, value } of calloutAttrs(part)) {
				if (op !== "" && op !== "^") continue;
				const target = op === "^" ? prefixes : byId;
				const claim = claimFor(target, value);
				if (weight > claim.maxClasses) claim.maxClasses = weight;
				for (const { name, bang } of decls) {
					claim.props.add(name);
					if (bang) claim.important.add(name);
				}
			}
		}
	});

	return { byId, prefixes };
}

/**
 * The claim a stylesheet makes about one registry id, exact match first and a
 * `^=` prefix second. Returns `undefined` when the sheet says nothing about it.
 *
 * `attrId` must already be the dasherized attribute form — the one Obsidian
 * actually writes — because that is what a theme's selector is written against.
 */
export function claimForId(
	scan: ThemeScan,
	attrId: string,
): ThemeClaim | undefined {
	const exact = scan.byId.get(attrId);
	if (exact) return exact;
	for (const [prefix, claim] of scan.prefixes) {
		if (attrId.startsWith(prefix)) return claim;
	}
	return undefined;
}

/** Merge two scans, keeping the strongest claim per id. Snippets over theme. */
export function mergeScans(scans: ThemeScan[]): ThemeScan {
	const out: ThemeScan = { byId: new Map(), prefixes: new Map() };
	for (const scan of scans) {
		for (const key of ["byId", "prefixes"] as const) {
			for (const [id, claim] of scan[key]) {
				const target = claimFor(out[key], id);
				if (claim.maxClasses > target.maxClasses) {
					target.maxClasses = claim.maxClasses;
				}
				for (const p of claim.props) target.props.add(p);
				for (const p of claim.important) target.important.add(p);
			}
		}
	}
	return out;
}
