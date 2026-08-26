/**
 * tests/calloutTokenDom.test.ts — `buildCalloutTokenDom` and its two companions.
 *
 * This is the one builder behind three surfaces: the Live Preview widgets, the
 * reading-view post-processor, and every reference token (outline pane, links,
 * the `[[` suggestion popup). They are byte-identical because they all come from
 * here, so a change in this shape is a change on all three at once.
 *
 * What the assertions are about:
 *
 * - **`hideIcon` builds no icon span at all.** Not an empty one, and not a
 *   hidden one. The token roots are flex boxes, so an empty item would still
 *   claim the container's `gap` and read as a stray space before the text — the
 *   same reason the ref token suppresses its icon by omission. `CSS_TOKEN_EMPTY`
 *   then covers the remaining case: nothing to draw *and* no name to draw it
 *   beside, where even the root has to leave the flow.
 * - **The root class is the variant's**, and `data-callout` is what per-callout
 *   CSS keys on — so `calloutDomId` has to hand back a spelling the generated
 *   selectors actually contain (the id or one of its aliases), never the
 *   attribute-form spelling that only Obsidian's own block callout understands.
 * - **An unknown id keeps what the user wrote**, both as the label and in the
 *   attribute, because that is what `.cs-unknown` styling expects to find.
 *
 * The DOM is the fake one from `tests/support/fakeDom.ts`; icons are Lucide
 * throughout, so painting bottoms out in the stubbed `setIcon` and no artwork
 * is involved. What is checked is the *shape* the builder produces, which is the
 * part every surface depends on.
 */
import assert from "node:assert";
import { describe, it } from "node:test";
// Listed first: importing it installs the DOM globals (`createSpan` and the
// rest are free identifiers in the bundle), before anything under test loads.
import { fakeDom } from "./support/fakeDom";
import { CalloutRegistry } from "../src/manager/CalloutRegistry";
import {
	CSS_CALLOUT_LEAD,
	CSS_CALLOUT_PAYLOAD,
	CSS_HEADING_TOKEN,
	CSS_INLINE_HAS_CONTENT,
	CSS_INLINE_TOKEN,
	CSS_REF_TOKEN,
	CSS_TOKEN_EMPTY,
	CSS_TOKEN_ICON,
	CSS_TOKEN_NAME,
	CSS_UNKNOWN,
	VARIANT_ROLE,
	buildCalloutLeadDom,
	buildCalloutTokenDom,
	buildContentPillDom,
	calloutDomId,
	resolveCalloutDef,
	shouldRenderToken,
	tokenIconKey,
} from "../src/editor/renderShared";

type Registry = InstanceType<typeof CalloutRegistry>;
type AnyElement = ReturnType<typeof buildCalloutTokenDom>;

/* -------------------------------------------------------------------------- */
/* Harness                                                                    */
/* -------------------------------------------------------------------------- */

/** A registry seeded exactly as a first run seeds it, plus whatever a test adds. */
function harness(): Registry {
	const registry = new CalloutRegistry();
	registry.load(null);
	return registry;
}

function addCallout(
	registry: Registry,
	over: Partial<Parameters<Registry["add"]>[0]> = {},
): void {
	registry.add({
		id: "quiet",
		displayName: "Quiet",
		icon: { type: "lucide", value: "pencil" },
		colorLight: "#336699",
		colorDark: "#88bbee",
		foldable: true,
		defaultFolded: false,
		builtIn: false,
		source: "user",
		...over,
	});
}

/** The classes on an element, as a set assertions can talk about. */
const classes = (element: AnyElement): string[] =>
	(element as unknown as { classList: { toArray(): string[] } }).classList.toArray();

const hasClass = (element: AnyElement, cls: string): boolean =>
	classes(element).includes(cls);

/** Direct element children, in order. */
const kids = (element: AnyElement): AnyElement[] =>
	(element as unknown as { children: AnyElement[] }).children;

const token = (
	registry: Registry,
	options: Partial<Parameters<typeof buildCalloutTokenDom>[0]> = {},
): AnyElement =>
	buildCalloutTokenDom({
		rawId: "quiet",
		registry,
		variant: "inline",
		showName: true,
		...options,
	});

/* -------------------------------------------------------------------------- */
/* hideIcon                                                                   */
/* -------------------------------------------------------------------------- */

describe("buildCalloutTokenDom — hideIcon", () => {
	it("builds no icon span at all, rather than an empty one", () => {
		const registry = harness();
		addCallout(registry, { hideIcon: true });

		const el = token(registry);
		assert.deepStrictEqual(
			kids(el).map((child) => classes(child)),
			[[CSS_TOKEN_NAME]],
			"an icon span would still claim the flex gap, even empty",
		);
	});

	/**
	 * Which way round the flag works, for all three builders at once.
	 *
	 * The inverse — "no icon span *without* `hideIcon`" — reads just as
	 * plausibly, and no single assertion above refutes it: each one fixes the
	 * flag and looks at one builder. This fixes the builder and varies the flag,
	 * so the statement cannot be made backwards without something here failing.
	 *
	 * `false` and absent are listed separately because they reach the check by
	 * different routes (`=== true` on a present value, and on `undefined`), and
	 * an inversion written as `!== true` would keep one of them working.
	 */
	it("drops the span when the flag is ON, in all three builders", () => {
		const cases = [
			{ label: "hideIcon: true", over: { hideIcon: true }, icons: 0 },
			{ label: "hideIcon: false", over: { hideIcon: false }, icons: 1 },
			{ label: "flag absent", over: {}, icons: 1 },
		];

		for (const { label, over, icons } of cases) {
			const registry = harness();
			addCallout(registry, over);

			const inToken = kids(token(registry)).filter((child) =>
				hasClass(child, CSS_TOKEN_ICON),
			);
			assert.strictEqual(inToken.length, icons, `token — ${label}`);

			const lead = buildCalloutLeadDom("quiet", registry);
			assert.strictEqual(kids(lead).length, icons, `lead — ${label}`);

			const { root } = buildContentPillDom({ rawId: "quiet", registry });
			assert.strictEqual(
				kids(kids(root)[0]!).length,
				icons,
				`pill lead — ${label}`,
			);
		}
	});

	it("takes the root itself out of flow when there is no name either", () => {
		// The ref token, and a content pill's lead: nothing but an icon that
		// isn't drawn, so the root's own gap is all that would be left.
		const registry = harness();
		addCallout(registry, { hideIcon: true });

		const el = token(registry, { variant: "ref", showName: false });
		assert.ok(hasClass(el, CSS_TOKEN_EMPTY));
		assert.strictEqual(kids(el).length, 0);
	});

	it("does NOT mark the root empty while a name still renders", () => {
		const registry = harness();
		addCallout(registry, { hideIcon: true });

		assert.ok(!hasClass(token(registry, { showName: true }), CSS_TOKEN_EMPTY));
	});

	it("keeps the icon span when only the name is suppressed", () => {
		const registry = harness();
		addCallout(registry);

		const el = token(registry, { showName: false });
		assert.deepStrictEqual(
			kids(el).map((child) => classes(child)),
			[[CSS_TOKEN_ICON]],
		);
		assert.ok(!hasClass(el, CSS_TOKEN_EMPTY));
	});

	it("is what `tokenIconKey` reports, so a toggled widget cannot compare equal", () => {
		// `iconRenderKey` alone would not move: the icon it *would* have drawn
		// is unchanged, only whether it is drawn at all.
		const registry = harness();
		addCallout(registry);
		const shown = registry.get("quiet");
		assert.ok(shown);

		const before = tokenIconKey(shown, registry, "inline");
		registry.update("quiet", { hideIcon: true });
		const after = tokenIconKey(registry.get("quiet"), registry, "inline");

		assert.strictEqual(after, "none");
		assert.notStrictEqual(before, after);
		assert.strictEqual(tokenIconKey(undefined, registry, "inline"), "");
	});
});

/* -------------------------------------------------------------------------- */
/* Variants                                                                   */
/* -------------------------------------------------------------------------- */

describe("buildCalloutTokenDom — variant classes", () => {
	it("stamps one root class per variant", () => {
		const registry = harness();
		addCallout(registry);

		assert.ok(hasClass(token(registry, { variant: "inline" }), CSS_INLINE_TOKEN));
		assert.ok(
			hasClass(token(registry, { variant: "heading" }), CSS_HEADING_TOKEN),
		);
		assert.ok(hasClass(token(registry, { variant: "ref" }), CSS_REF_TOKEN));
	});

	it("never stamps two of them", () => {
		const registry = harness();
		addCallout(registry);
		const roots = [CSS_INLINE_TOKEN, CSS_HEADING_TOKEN, CSS_REF_TOKEN];

		for (const variant of ["inline", "heading", "ref"] as const) {
			const on = classes(token(registry, { variant })).filter((cls) =>
				roots.includes(cls),
			);
			assert.strictEqual(on.length, 1, `${variant} carried ${on.join()}`);
		}
	});

	it("draws a reference at inline size — a ref is a compact inline copy", () => {
		assert.strictEqual(VARIANT_ROLE.ref, "inline");
		assert.strictEqual(VARIANT_ROLE.inline, "inline");
		assert.strictEqual(VARIANT_ROLE.heading, "heading");
	});
});

/* -------------------------------------------------------------------------- */
/* Identity: data-callout and the label                                        */
/* -------------------------------------------------------------------------- */

describe("buildCalloutTokenDom — data-callout", () => {
	it("carries the definition's own id for a plain match", () => {
		const registry = harness();
		addCallout(registry);

		assert.strictEqual(token(registry).getAttribute("data-callout"), "quiet");
	});

	it("keeps the alias the user actually wrote, because CSS is emitted for it", () => {
		const registry = harness();
		addCallout(registry, { aliases: ["hush"] });

		const el = token(registry, { rawId: "hush" });
		assert.strictEqual(el.getAttribute("data-callout"), "hush");
		// …while the label still comes from the definition.
		assert.strictEqual(kids(el).at(-1)?.textContent, "Quiet");
	});

	it("falls back to the definition's id when only the attribute form matched", () => {
		// `[!a-b]` written for the callout `a b`: Obsidian renders both the same,
		// but no generated selector carries the dashed spelling, so the token
		// would come out with its icon painted and no colour.
		const registry = harness();
		addCallout(registry, { id: "a b", displayName: "A B" });

		const el = token(registry, { rawId: "a-b" });
		assert.strictEqual(el.getAttribute("data-callout"), "a b");
		assert.strictEqual(
			calloutDomId("a-b", resolveCalloutDef(registry, "a-b")),
			"a b",
		);
	});

	it("normalizes case and whitespace", () => {
		const registry = harness();
		addCallout(registry, { id: "two words", displayName: "Two Words" });

		assert.strictEqual(
			token(registry, { rawId: "  Two   Words " }).getAttribute(
				"data-callout",
			),
			"two words",
		);
	});

	it("keeps an unknown id exactly as normalized, spelling included", () => {
		const registry = harness();

		const el = token(registry, { rawId: "Nope" });
		assert.strictEqual(el.getAttribute("data-callout"), "nope");
		assert.ok(hasClass(el, CSS_UNKNOWN));
	});
});

describe("buildCalloutTokenDom — the label", () => {
	it("shows the display name for a known callout", () => {
		const registry = harness();
		addCallout(registry, { displayName: "Be Quiet" });

		assert.strictEqual(kids(token(registry)).at(-1)?.textContent, "Be Quiet");
	});

	it("shows what the user wrote for an unknown one", () => {
		const registry = harness();

		const el = token(registry, { rawId: "  mystery  " });
		assert.strictEqual(kids(el).at(-1)?.textContent, "mystery");
	});

	it("builds no name span at all when showName is false", () => {
		const registry = harness();
		addCallout(registry);

		const el = token(registry, { showName: false });
		assert.ok(!kids(el).some((child) => hasClass(child, CSS_TOKEN_NAME)));
	});
});

/* -------------------------------------------------------------------------- */
/* Metadata                                                                   */
/* -------------------------------------------------------------------------- */

describe("buildCalloutTokenDom — metadata", () => {
	it("mirrors Obsidian's data-callout-metadata", () => {
		const registry = harness();
		addCallout(registry);

		assert.strictEqual(
			token(registry, { metadata: "purple" }).getAttribute(
				"data-callout-metadata",
			),
			"purple",
		);
	});

	it("leaves the attribute off entirely when there is none", () => {
		// An empty attribute is a selector match, which is not the same thing.
		const registry = harness();
		addCallout(registry);

		for (const metadata of [undefined, ""]) {
			assert.strictEqual(
				token(registry, { metadata }).hasAttribute(
					"data-callout-metadata",
				),
				false,
			);
		}
	});
});

/* -------------------------------------------------------------------------- */
/* The content pill                                                           */
/* -------------------------------------------------------------------------- */

describe("buildCalloutLeadDom", () => {
	it("is nothing but the icon", () => {
		const registry = harness();
		addCallout(registry);

		const lead = buildCalloutLeadDom("quiet", registry);
		assert.ok(hasClass(lead, CSS_CALLOUT_LEAD));
		assert.deepStrictEqual(
			kids(lead).map((child) => classes(child)),
			[[CSS_TOKEN_ICON]],
		);
	});

	it("empties out when the callout draws no icon", () => {
		// Its own margin-inline-end would otherwise open a gap before a payload
		// that has nothing in front of it.
		const registry = harness();
		addCallout(registry, { hideIcon: true });

		const lead = buildCalloutLeadDom("quiet", registry);
		assert.ok(hasClass(lead, CSS_TOKEN_EMPTY));
		assert.strictEqual(kids(lead).length, 0);
	});
});

describe("buildContentPillDom", () => {
	it("is one pill box holding exactly a lead and a payload", () => {
		const registry = harness();
		addCallout(registry);

		const { root, payload } = buildContentPillDom({
			rawId: "quiet",
			registry,
		});

		assert.ok(hasClass(root, CSS_INLINE_TOKEN));
		assert.ok(hasClass(root, CSS_INLINE_HAS_CONTENT));
		assert.deepStrictEqual(
			kids(root).map((child) => classes(child)),
			[[CSS_CALLOUT_LEAD], [CSS_CALLOUT_PAYLOAD]],
		);
		// Returned rather than found by position: with an icon hidden the lead
		// is still there, so "the last child" and "the second child" are not
		// reliably the same element.
		assert.strictEqual(payload, kids(root)[1]);
	});

	it("still returns a usable payload when the lead is empty", () => {
		const registry = harness();
		addCallout(registry, { hideIcon: true });

		const { root, payload } = buildContentPillDom({
			rawId: "quiet",
			registry,
		});
		assert.strictEqual(kids(root).length, 2);
		assert.ok(hasClass(payload, CSS_CALLOUT_PAYLOAD));
	});

	it("carries the unknown marker and the metadata like a plain token", () => {
		const registry = harness();

		const { root } = buildContentPillDom({
			rawId: "nope",
			metadata: "purple",
			registry,
		});
		assert.ok(hasClass(root, CSS_UNKNOWN));
		assert.strictEqual(root.getAttribute("data-callout"), "nope");
		assert.strictEqual(
			root.getAttribute("data-callout-metadata"),
			"purple",
		);
	});
});

/* -------------------------------------------------------------------------- */
/* Theme-independence                                                          */
/* -------------------------------------------------------------------------- */

describe("buildCalloutTokenDom — what it does not do", () => {
	it("bakes no colour into the DOM, in either theme", () => {
		// Colour reaches these tokens through the generated stylesheet, keyed on
		// `data-callout`. A style attribute here would pin them to one theme.
		const registry = harness();
		addCallout(registry);

		fakeDom.dark();
		const darkEl = token(registry);
		fakeDom.light();
		const lightEl = token(registry);

		for (const el of [darkEl, lightEl]) {
			assert.strictEqual(el.hasAttribute("style"), false);
		}
	});
});

describe("theme-styled callouts and the two Callout Studio-only syntaxes", () => {
	// `## [!id] Title` and `word [!id] word` are this plugin's own invented
	// markdown, and a callout that stands down gets neither of them — for two
	// unrelated reasons that happen to give the same answer.
	//
	// `externalStyle` is the obvious one: there is nothing here for the user's
	// snippet to style. Theme ownership is the deliberate one. The plugin
	// *could* paint `.cs-heading-token` for a theme callout — no theme selector
	// can match it — and for one release it did. But that offers two formats
	// the theme has no design for beside a Block callout it draws itself:
	// three renderings of one callout with two of them invented. A theme
	// callout is Block only, and the raw text stays as written.

	it("renders no token for a callout the user handed over", () => {
		const registry = harness();
		addCallout(registry, { id: "handed", externalStyle: true });
		const resolved = resolveCalloutDef(registry, "handed");

		assert.strictEqual(resolved.external, true);
		assert.strictEqual(shouldRenderToken(resolved), false);
		// Not "unknown": the id resolved perfectly well, and an unknown token
		// would get `.cs-unknown` styling and its raw id as a label — both of
		// which are still this plugin painting something.
		assert.strictEqual(resolved.unknown, false);
	});

	it("renders one for an untouched built-in on a clean install", () => {
		// The case a reader is most likely to meet first. Nothing is theme-owned
		// until the theme names it, so an unconfigured built-in is this plugin's
		// and its heading form draws.
		const registry = harness();
		assert.strictEqual(shouldRenderToken(resolveCalloutDef(registry, "note")), true);
	});

	it("renders none for a callout the THEME owns — Block only", () => {
		const registry = harness();
		addCallout(registry, { id: "recite" });
		registry.setThemeOwnedIds(new Set(["recite"]));

		const resolved = resolveCalloutDef(registry, "recite");
		assert.strictEqual(resolved.themeOwned, true);
		// Not `external`, and the two must stay apart: this row is nobody's
		// snippet, and every surface that decides where it is *listed* asks
		// ownership rather than this.
		assert.strictEqual(resolved.external, false);
		assert.strictEqual(shouldRenderToken(resolved), false);
	});

	it("gives them back the moment the theme stops claiming the id", () => {
		// The pre-existing-callout case, which is the one that must not lose
		// anything: no migration runs either way, because nothing was ever
		// removed from the definition — only from what the renderer acts on.
		const registry = harness();
		addCallout(registry, { id: "mine", displayName: "Mine" });
		registry.setThemeOwnedIds(new Set(["mine"]));
		assert.strictEqual(
			shouldRenderToken(resolveCalloutDef(registry, "mine")),
			false,
		);

		registry.setThemeOwnedIds(new Set());
		const back = resolveCalloutDef(registry, "mine");
		assert.strictEqual(shouldRenderToken(back), true);
		assert.strictEqual(back.def?.displayName, "Mine");
	});

	it("renders one again the moment Callout Studio takes it back", () => {
		const registry = harness();
		addCallout(registry, { id: "handed", externalStyle: true });
		assert.strictEqual(shouldRenderToken(resolveCalloutDef(registry, "handed")), false);
		registry.setExternalStyle("handed", false);

		const resolved = resolveCalloutDef(registry, "handed");
		assert.strictEqual(resolved.external, false);
		assert.strictEqual(shouldRenderToken(resolved), true);
	});

	it("still renders one for an unknown id borrowing a theme-styled fallback", () => {
		// `external` describes the token's OWN callout. An unrecognized id is
		// this plugin's to draw whatever the fallback template is doing.
		const registry = harness();
		registry.settings.fallbackCalloutId = "note";
		const resolved = resolveCalloutDef(registry, "never-seen");
		assert.strictEqual(resolved.unknown, true);
		assert.strictEqual(resolved.external, false);
		assert.strictEqual(shouldRenderToken(resolved), true);
	});
});
