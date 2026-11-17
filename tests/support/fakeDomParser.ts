/**
 * tests/support/fakeDomParser.ts — a `DOMParser` for the suites that run the
 * web renderer as a browser does.
 *
 * Not a `*.test.ts`, so `scripts/run-tests.mjs` never treats it as an entry
 * point; it is bundled into each suite that imports it.
 *
 * Kept out of `fakeDom.ts` on purpose. Node has no `DOMParser`, and several
 * suites are *about* that: the icon painter and the SVG sanitiser both fall
 * back when it is missing, and their tests pin the fallback. Installing one
 * for everybody would quietly turn those into tests of something else. The
 * renderer's default icon parser (`src/web/core.ts`, used by
 * `src/web/browser.ts`) is the opposite case — it only ever runs in a browser,
 * where the parser is a given — so the two suites that evaluate it install
 * this one for themselves. The build-time hosts bring their own parser
 * (`src/web/static/htmlFragment.ts`) and need none of this.
 *
 * It answers the one call the renderer makes, `parseFromString(markup,
 * "text/html").body`, with the grammar `html()` already parses.
 */
import { el, parseMarkupInto, type FakeElement } from "./fakeDom";

class FakeDOMParser {
	parseFromString(markup: string): { body: FakeElement } {
		const body = el({ tag: "body" });
		parseMarkupInto(body, markup);
		return { body };
	}
}

/** Put the parser on `globalThis`. Each suite is its own process, so it stays. */
export function installFakeDomParser(): void {
	(globalThis as Record<string, unknown>).DOMParser = FakeDOMParser;
}
