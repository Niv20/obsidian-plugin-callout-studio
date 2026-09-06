/**
 * icons/renderIcon.ts — The single "icon → DOM" painter.
 *
 * Every surface that shows a callout icon calls renderIconInto. The surfaces
 * differ only in four ways, which is exactly what the options express:
 *
 * - what to draw when the artwork is not local yet (`missing`)
 * - whether the glyph should follow the surrounding CSS `color` or carry a
 *   baked-in one (`fill`) — the latter is how icons survive PDF export, where
 *   Obsidian's print clone ships the DOM but not our stylesheet
 * - whether a picture that follows its callout's colour is stencilled in that
 *   colour here (`followCalloutColor`)
 * - whether the result is wrapped/marked for a caller-specific rule
 *   (`className`, `rootStyle`)
 *
 * Everything else — parsing, validating, importing across documents, realm
 * safety — is identical everywhere and lives here once.
 */
import { setIcon } from "obsidian";
import type { CalloutIcon, CalloutRenderRole } from "../types";
import type { IconResolver } from "./types";
import { packFor } from "./registry";
import { resolveLucideId } from "./lucideId";
import { followsCalloutColor, userImageFor } from "./packs/userImages";
import { isolateSvgCopy } from "./isolateSvg";
import { sanitizeUserSvg } from "./svg";

/**
 * Shapes that carry their own paint inside a vendor SVG. A baked export colour
 * has to reach each of them: a core or theme rule targeting `svg path` directly
 * would otherwise outrank a colour set only on the root.
 */
const SHAPE_SELECTOR = "path, circle, rect, polygon, ellipse, line, polyline, g";

/**
 * SVG's initial `color`, which is what a `currentColor` written *inside* the
 * artwork resolves against when the picture is painted as a background image
 * (see CSSInjector.generateImageOverride): an image renders in a context of its
 * own, so the surrounding text colour never reaches it. A DOM copy has no such
 * boundary, so it has to state the same starting point to show the same picture.
 */
const SVG_INITIAL_COLOR = "#000";

/** What to draw when the artwork is not available locally. */
export type IconMissingBehavior =
	/** Draw a Lucide icon instead, so the surface is never blank. */
	| { kind: "placeholder"; lucideId: string }
	/** Show download state: a spinner, or an error once the download gave up. */
	| { kind: "status" }
	/** Touch nothing and leave whatever is already there. */
	| { kind: "leave" };

export interface RenderIconOptions {
	/** Which surface is drawing — decides between a pack's per-size drawings. */
	role: CalloutRenderRole;
	/**
	 * `"currentColor"` lets the glyph inherit the surrounding CSS colour, which
	 * is what every on-screen surface wants (it tracks light/dark for free).
	 * A literal bakes the colour inline with `!important`, for copies that will
	 * be rendered without our stylesheet.
	 */
	fill: "currentColor" | { literal: string };
	/**
	 * Whether a picture that follows its callout's colour is drawn here as a
	 * stencil in `fill` (see stencilSvg), rather than in the colours it was
	 * uploaded with. True everywhere by default: every surface that draws an
	 * icon draws it *for a callout*, so it must agree with the mask the regular
	 * callout paints. The picker's own grid is the exception — it is a library
	 * of pictures with no callout behind them.
	 */
	followCalloutColor?: boolean;
	missing: IconMissingBehavior;
	/** Class stamped on the produced node (e.g. `cs-export-icon`). */
	className?: string;
	/** Inline style for the produced `<svg>` root (export sizing). */
	rootStyle?: string;
	/** Text to fall back to if painting throws outright. Omit to leave the DOM alone. */
	errorText?: string;
	/** Localized `aria-label` for the failed state of `missing: "status"`. */
	errorAriaLabel?: string;
}

export type RenderIconResult =
	| "painted"
	| "placeholder"
	| "loading"
	| "failed"
	| "skipped";

/**
 * Paint `icon` into `target`, replacing whatever it held.
 *
 * Returns what was actually drawn, so callers that care (the settings list)
 * can react without re-deriving the state.
 */
export function renderIconInto(
	target: HTMLElement,
	icon: CalloutIcon,
	resolver: IconResolver,
	options: RenderIconOptions,
): RenderIconResult {
	target.removeClass("is-loading");
	target.removeClass("is-error");
	// The same element is repainted in place when a row's icon comes back on,
	// and the muted ring's colour would otherwise outlive the ring.
	target.removeClass(CSS_ICON_NONE);
	try {
		return paint(target, icon, resolver, options);
	} catch {
		// setIcon and DOMParser can both be missing in exotic render realms
		// (an export clone, a popout window mid-teardown). A missing icon is
		// always preferable to a crash in the middle of a render pass.
		if (options.errorText !== undefined) {
			target.textContent = options.errorText;
		}
		return "failed";
	}
}

/** Class on the placeholder {@link renderNoIcon} draws. */
export const CSS_ICON_NONE = "cs-icon-none";

/**
 * Draw the stand-in for a callout the user set to `hideIcon`.
 *
 * Only for the surfaces that *manage* callouts — the settings list, the
 * autocomplete popup, the statistics and replace modals. Those are columns of
 * rows, and a genuinely empty slot both breaks the column and reads exactly like
 * an icon that is still downloading (which is a real state a row next to it may
 * be in). A faint dashed ring says the emptiness is the answer.
 *
 * Content surfaces — the block callout, the heading and inline tokens, PDF
 * export — draw nothing at all instead, and take the space back with it.
 */
export function renderNoIcon(target: HTMLElement): void {
	target.removeClass("is-loading");
	target.removeClass("is-error");
	target.removeAttribute("aria-label");
	target.empty();
	target.addClass(CSS_ICON_NONE);
	setIcon(target, "circle-dashed");
}

function paint(
	target: HTMLElement,
	icon: CalloutIcon,
	resolver: IconResolver,
	options: RenderIconOptions,
): RenderIconResult {
	// An unknown pack means data written by a newer build (or edited by hand);
	// treat it as artwork we simply don't have, which is what it is.
	const pack = packFor(icon);
	if (!pack) return paintMissing(target, icon, resolver, options);

	switch (pack.kind) {
		case "builtin":
			// Already a visible DOM SVG stroked with currentColor, so it needs
			// none of the colouring below and survives PDF export as-is.
			//
			// Through `resolveLucideId` because a value can still arrive spelled
			// the way v2.7.0-2.7.1 wrote it — from a vault synced by a device
			// that has not updated, a restored backup, or a JSON export from
			// those versions (the import validator only length-checks `value`).
			// `load()`'s migration cannot reach any of those; this can.
			setIcon(target, resolveLucideId(icon.value));
			return "painted";
		case "glyph":
			// textContent, never innerHTML — the glyph is user data. A wrapper
			// span is only needed when the caller has a rule to hang off it.
			if (options.className) {
				const span = createSpan();
				span.classList.add(options.className);
				span.textContent = icon.value;
				target.replaceChildren(span);
			} else {
				target.textContent = icon.value;
			}
			return "painted";
		default:
			return paintSvgIcon(target, icon, resolver, options);
	}
}

/** Paint an icon whose artwork is an SVG the plugin stores itself. */
function paintSvgIcon(
	target: HTMLElement,
	icon: CalloutIcon,
	resolver: IconResolver,
	options: RenderIconOptions,
): RenderIconResult {
	const svg = resolver.resolveSvg(icon, options.role);
	if (!svg) return paintMissing(target, icon, resolver, options);

	const svgEl = importSvg(svg, target.ownerDocument);
	if (!svgEl) return paintMissing(target, icon, resolver, options);

	if (options.className) svgEl.classList.add(options.className);

	const color =
		options.fill === "currentColor" ? "currentColor" : options.fill.literal;
	// A picture the user supplied is the one artwork that carries colours of its
	// own, so it is also the only one there is anything to decide: the callout
	// either claims those colours whole (stencil) or leaves every one of them
	// alone. Every library glyph is monochrome and simply takes the colour.
	const picture = userImageFor(icon);
	const stencil =
		options.followCalloutColor !== false && followsCalloutColor(icon, picture);
	const keepsOwnColors = picture !== undefined && !stencil;
	// An outline drawing is defined by the ink it withholds: its root fills
	// `none` and strokes `currentColor` (see buildPackSvg). It therefore needs
	// the same treatment a stencilled picture does, and for the same reason —
	// a blanket fill would overwrite that `none` and flood the outline solid.
	const stroked = !stencil && !keepsOwnColors && isStroked(svgEl);

	const rootDecls: string[] = [];
	if (options.rootStyle) rootDecls.push(options.rootStyle);
	if (keepsOwnColors) {
		// Nothing is painted on it — not even `fill: currentColor`. A blanket fill
		// on the root reaches exactly the shapes that declared no colour of their
		// own, and those are the black ones (SVG fills black by default), so it
		// left the heading and inline copies with their black lines wearing the
		// callout's colour while the block callout — a background image, which
		// nothing outside it can paint — showed them black.
		if (!svgEl.hasAttribute("color")) {
			// A presentation attribute, so anything the artwork declares for itself
			// still wins; it is only here to stop a `currentColor` inside the
			// drawing from resolving against the surrounding callout colour.
			svgEl.setAttribute("color", SVG_INITIAL_COLOR);
		}
	} else if (stroked) {
		// Nothing here either. On screen the artwork's own `currentColor` already
		// tracks the surrounding colour, exactly as Obsidian's Lucide does; a
		// baked export colour is left to stencilSvg below, which is already the
		// routine that recolours a drawing without adding ink.
	} else if (!stencil) {
		// A stencilled picture gets its paint from stencilSvg alone, root included:
		// blanketing the root here would overwrite a `fill="none"` an outline
		// drawing depends on, and flood it into a solid shape.
		if (options.fill === "currentColor") {
			svgEl.setAttribute("fill", "currentColor");
		} else {
			const decl = `fill:${color} !important`;
			rootDecls.push(decl);
			for (const shape of Array.from(svgEl.querySelectorAll(SHAPE_SELECTOR))) {
				shape.setAttribute("style", decl);
			}
		}
	}
	// Appended rather than assigned: a picture can declare its paint in a `style`
	// on its own root, and replacing that attribute with the caller's sizing would
	// throw away the colours this whole branch just decided to keep.
	if (rootDecls.length > 0) appendStyle(svgEl, rootDecls.join(";"));
	// A stroked drawing only needs this for a baked colour; on screen its own
	// `currentColor` is already right, and rewriting it would pin the icon to
	// one theme's colour.
	if (stencil || (stroked && options.fill !== "currentColor")) {
		stencilSvg(svgEl, color);
	}

	target.replaceChildren(svgEl);
	return "painted";
}

/**
 * Whether this artwork paints itself with strokes rather than fills.
 *
 * Read off the drawing rather than asked of the pack, so a copy already sitting
 * in `data.json` describes itself — the cache is written once and read by every
 * later build. Only a stroked pack's root carries `stroke` (see buildPackSvg);
 * a solid one declares no paint at all.
 */
function isStroked(svgEl: Element): boolean {
	return svgEl.hasAttribute("stroke");
}

/* ------------------------------------------------------------------ *
 * Stencilling a picture in the callout's colour
 * ------------------------------------------------------------------ */

/**
 * Paint properties whose declared value decides what colour the artwork shows:
 * the two that ink a shape, the gradient stop that feeds them, and `color`,
 * which is what a `currentColor` written inside the artwork resolves against.
 */
const PAINT_PROPS = ["fill", "stroke", "stop-color", "color"] as const;

/** The two properties inheritance has to be tracked for (see stencilElement). */
const INHERITED_PROPS = ["fill", "stroke"] as const;

/** Declared values that draw nothing — recolouring one would ADD ink. */
const UNPAINTED = new Set(["none", "transparent"]);

/**
 * Elements whose own paint never reaches the screen: metadata, and the defs a
 * shape refers to. Their colours are still rewritten (they may feed a shape),
 * but they collect no `style` of their own — a `<style>` element carrying a
 * `fill` is noise in the DOM inspector and nothing else.
 */
const NON_DRAWABLE = new Set([
	"style",
	"title",
	"desc",
	"defs",
	"lineargradient",
	"radialgradient",
	"stop",
]);

/**
 * Subtrees left exactly as they were drawn.
 *
 * A `<mask>` is read as luminance, not as ink: its white areas are what shows
 * through. Recolouring those to the callout's colour would dim or erase whatever
 * the mask reveals. A `<clipPath>` is pure geometry, so painting it is merely
 * pointless — both are skipped whole, children included.
 */
const OPAQUE_SUBTREES = new Set(["mask", "clippath"]);

/**
 * SVG's own initial paint: shapes are filled black and stroked with nothing,
 * which is why the black parts of a picture were the ones that already followed
 * the callout — they declared no colour, so the root's `fill` reached them.
 */
const INITIAL_PAINT: PaintState = { fill: "black", stroke: "none" };

/**
 * A paint declaration inside a `<style>` block or a `style` attribute, split so
 * only the value is rewritten.
 *
 * The value alternatives are spelled out rather than "everything up to the next
 * delimiter" for the same reason the import-time detector spells them out (see
 * userImageImport): run two rules together as `.a{fill:#f00}.b{fill:#0f0}` and a
 * permissive pattern swallows both as one value. `fill-opacity` and
 * `stroke-width` do not match, because the property has to be followed by `:`.
 */
const CSS_PAINT_RE =
	/(fill|stroke|stop-color|color)(\s*:\s*)(#[0-9a-f]{3,8}|[a-z-]+\([^)]*\)|[a-z]+)/gi;

/** The paint an element passes down to its children. */
interface PaintState {
	fill: string;
	stroke: string;
}

/**
 * Draw a picture as a one-colour stencil — the DOM equivalent of the CSS mask
 * the block callout paints a followed picture through (see CSSInjector).
 *
 * A `fill` on the `<svg>` root only reaches shapes that declare no paint of
 * their own, so a multi-coloured drawing came out half recoloured on the
 * heading and inline surfaces: the parts that were default black followed the
 * callout and everything else kept the colours it was uploaded with. Every
 * declared paint is therefore rewritten instead — in presentation attributes, in
 * `style` attributes, and in the `<style>` blocks Illustrator and Figma colour
 * whole drawings through.
 *
 * What is never rewritten is `none` / `transparent`: those declare the *absence*
 * of ink, and colouring them would fill a stroked outline into a solid blob. The
 * walk carries the inherited paint down for the same reason, so a shape inside
 * `<g fill="none">` is left unfilled rather than flooded.
 *
 * The `<style>` blocks rewritten below belong to this copy alone by the time we
 * get here (see isolateSvgCopy). Before they were fenced, this rewrite reached
 * every other copy in the document too — so one callout recolouring a picture
 * stripped the colours off a second callout using the same file with
 * "Follow callout color" off.
 */
function stencilSvg(root: Element, color: string): void {
	for (const styleEl of Array.from(root.querySelectorAll("style"))) {
		styleEl.textContent = rewriteCssPaint(styleEl.textContent ?? "", color);
	}
	stencilElement(root, color, INITIAL_PAINT);
}

function stencilElement(el: Element, color: string, inherited: PaintState): void {
	const name = el.localName.toLowerCase();
	if (OPAQUE_SUBTREES.has(name)) return;

	const effective: PaintState = { ...inherited };
	const decls: string[] = [];

	for (const prop of INHERITED_PROPS) {
		const declared = declaredPaint(el, prop);
		const value = declared ?? inherited[prop];
		effective[prop] = value;
		if (UNPAINTED.has(value.toLowerCase())) continue;
		// A class in a `<style>` block can declare `fill: none` where nothing
		// readable here says so. Those rules were rewritten above and belong to
		// this copy alone, so an element that leans on one is left to them rather
		// than forced to take ink it may have been drawn without.
		if (declared === undefined && el.hasAttribute("class")) continue;
		if (NON_DRAWABLE.has(name)) continue;
		// `!important`, and on the element rather than only on the root, for the
		// same reason the export copy bakes it that way: a core or theme rule
		// targeting `svg path` directly outranks anything weaker.
		decls.push(`${prop}:${color} !important`);
	}

	rewriteDeclaredPaint(el, color);
	if (decls.length > 0) appendStyle(el, decls.join(";"));

	for (const child of Array.from(el.children)) {
		stencilElement(child, color, effective);
	}
}

/**
 * The paint this element declares for `prop`, or undefined when it inherits.
 * A `style` attribute wins over the presentation attribute, as in CSS.
 */
function declaredPaint(el: Element, prop: "fill" | "stroke"): string | undefined {
	const inline = el.getAttribute("style");
	if (inline) {
		const match = INLINE_PAINT_RE[prop].exec(inline);
		if (match?.[1]) return match[1].trim();
	}
	return el.getAttribute(prop)?.trim();
}

const INLINE_PAINT_RE: Record<"fill" | "stroke", RegExp> = {
	fill: /(?:^|;)\s*fill\s*:\s*([^;!]+)/i,
	stroke: /(?:^|;)\s*stroke\s*:\s*([^;!]+)/i,
};

/** Replace the colours this element names with `color`, adding none. */
function rewriteDeclaredPaint(el: Element, color: string): void {
	for (const prop of PAINT_PROPS) {
		const value = el.getAttribute(prop);
		if (value !== null && !UNPAINTED.has(value.trim().toLowerCase())) {
			el.setAttribute(prop, color);
		}
	}
	const inline = el.getAttribute("style");
	if (inline) el.setAttribute("style", rewriteCssPaint(inline, color));
}

function rewriteCssPaint(css: string, color: string): string {
	return css.replace(
		CSS_PAINT_RE,
		(whole: string, prop: string, separator: string, value: string) =>
			UNPAINTED.has(value.toLowerCase())
				? whole
				: `${prop}${separator}${color}`,
	);
}

function appendStyle(el: Element, decls: string): void {
	const existing = el.getAttribute("style");
	el.setAttribute("style", existing ? `${existing};${decls}` : decls);
}

function paintMissing(
	target: HTMLElement,
	icon: CalloutIcon,
	resolver: IconResolver,
	options: RenderIconOptions,
): RenderIconResult {
	switch (options.missing.kind) {
		case "leave":
			return "skipped";
		case "placeholder":
			setIcon(target, options.missing.lucideId);
			return "placeholder";
		case "status":
			// A local pack has nothing to download, so artwork it cannot produce
			// is a picture the user deleted, not a fetch still in flight. Draw
			// the same pencil the stylesheet falls back to for it (see
			// CSSInjector.getIconCSS) rather than spinning for artwork that can
			// never arrive.
			if (packFor(icon)?.kind === "local") {
				setIcon(target, "pencil");
				target.removeAttribute("aria-label");
				return "placeholder";
			}
			if (resolver.hasFailed(icon, options.role)) {
				setIcon(target, "circle-help");
				target.addClass("is-error");
				if (options.errorAriaLabel) {
					target.setAttribute("aria-label", options.errorAriaLabel);
				}
				return "failed";
			}
			setIcon(target, "loader-2");
			target.addClass("is-loading");
			// Clear a label left by an earlier failed render of the same node.
			target.removeAttribute("aria-label");
			return "loading";
	}
}

/**
 * A string that changes whenever this icon would draw differently — including
 * when artwork that was pending has since arrived.
 *
 * CodeMirror widgets and outline decorations key their `eq()` on it, so a
 * placeholder painted while a download was in flight is replaced with the real
 * glyph as soon as the download lands, without a full re-render of the note.
 */
export function iconRenderKey(
	icon: CalloutIcon,
	resolver: IconResolver,
	role: CalloutRenderRole,
): string {
	const pack = packFor(icon);
	// Packs drawn by Obsidian or by the system font have nothing to wait for.
	const needsArtwork =
		pack !== undefined && pack.kind !== "builtin" && pack.kind !== "glyph";
	const ready = !needsArtwork || resolver.resolveSvg(icon, role) !== null;
	// The pack's own cache variant rather than `style`/`weight`: those two cover
	// Material and nothing else, so a source that varies its drawing any other
	// way would keep a stale widget. `cacheVariant` is by contract everything
	// besides the name that changes the artwork — Octicons' per-role sizes and a
	// re-uploaded picture's revision both land here.
	return [
		icon.type,
		icon.value,
		pack?.cacheVariant(icon, role) ?? "",
		ready ? "r" : "",
	].join(":");
}

/**
 * Sanitize cached SVG markup and import it into `doc`.
 *
 * Returns null for anything that is not a well-formed `<svg>` root, so a
 * corrupted cache entry falls through to the caller's missing behavior instead
 * of appending a `<parsererror>` block to the page.
 *
 * The copy is isolated before it is handed back, so "every SVG that leaves here
 * answers only for itself" holds at one place rather than at each of
 * paintSvgIcon's colour branches. It has to happen before stencilSvg, which
 * rewrites the paint *values* inside the very `<style>` blocks isolateSvgCopy
 * has just fenced — the other order would fence rules that had already leaked
 * into a sibling copy.
 */
function importSvg(svg: string, doc: Document): Element | null {
	// Cache provenance is not a trust boundary: data.json can be edited or
	// synced. Apply the full markup/CSS profile to every source at the sink.
	const safe = sanitizeUserSvg(svg);
	if (!safe) return null;
	const parsed = new DOMParser().parseFromString(safe.svg, "image/svg+xml");
	const copy = doc.importNode(parsed.documentElement, true);
	isolateSvgCopy(copy);
	return copy;
}
