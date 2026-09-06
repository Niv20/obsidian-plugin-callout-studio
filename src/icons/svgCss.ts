/** A deliberately small drawing-only CSS profile for untrusted inline SVG. */
export const SVG_CSS_PROPERTIES = new Set([
	"fill", "fill-opacity", "fill-rule", "stroke", "stroke-width",
	"stroke-opacity", "stroke-linecap", "stroke-linejoin", "stroke-miterlimit",
	"stroke-dasharray", "stroke-dashoffset", "opacity", "color", "stop-color",
	"stop-opacity", "paint-order", "vector-effect", "display", "visibility",
	"clip-path", "clip-rule", "mask", "text-anchor", "font-size", "font-family",
	"font-weight", "transform", "transform-origin",
]);

const FUNCTIONS = new Set([
	"rgb", "rgba", "hsl", "hsla", "hwb", "lab", "lch", "oklab", "oklch",
	"color", "color-mix", "matrix", "translate", "translatex", "translatey",
	"scale", "scalex", "scaley", "rotate", "skew", "skewx", "skewy",
]);
const IDENTIFIER = /^[a-zA-Z_-][a-zA-Z0-9_-]*/;
const NUMBER = /^[+-]?(?:\d*\.\d+|\d+\.?\d*)(?:e[+-]?\d+)?(?:%|[a-z]+)?/i;

/**
 * Parse the entire value, admitting only literal drawing tokens and known
 * functions. Escapes, substitutions (var/attr), and unknown functions are not
 * part of this language, so they cannot hide a URL from a spelling deny-list.
 */
export function safeSvgCssValue(value: string): boolean {
	let i = 0;
	let depth = 0;
	let tokens = 0;
	while (i < value.length) {
		const tail = value.slice(i);
		const ch = value.charAt(i);
		if (/\s/.test(ch)) { i++; continue; }
		if (ch === "," || ch === "/") { i++; continue; }
		if (ch === ")") {
			if (depth-- === 0) return false;
			i++;
			continue;
		}
		if (ch === "\"" || ch === "'") {
			const end = value.indexOf(ch, i + 1);
			if (end < 0 || /[\\\n\r\f]/.test(value.slice(i + 1, end))) return false;
			i = end + 1;
			tokens++;
			continue;
		}
		const hex = /^#[\da-f]{3,8}\b/i.exec(tail);
		const number = NUMBER.exec(tail);
		if (hex || number) {
			i += (hex ?? number)![0].length;
			tokens++;
			continue;
		}
		const ident = IDENTIFIER.exec(tail)?.[0];
		if (!ident) return false;
		i += ident.length;
		tokens++;
		if (value.charAt(i) !== "(") continue;
		if (ident.toLowerCase() === "url") {
			// Canonical literal local references only; isolateSvg rewrites these
			// exact references along with the copied IDs before DOM insertion.
			const local = /^\(\s*(['"]?)#[a-zA-Z_][\w:.-]*\1\s*\)/.exec(value.slice(i));
			if (!local) return false;
			i += local[0].length;
			continue;
		}
		if (!FUNCTIONS.has(ident.toLowerCase()) || ++depth > 16) return false;
		i++;
	}
	return tokens > 0 && depth === 0;
}

/** Serialize only supported declarations from the browser's CSS parser. */
function drawingDeclarations(style: CSSStyleDeclaration): string {
	const declarations: string[] = [];
	for (let i = 0; i < style.length; i++) {
		const name = style.item(i).toLowerCase();
		const value = style.getPropertyValue(name);
		if (!SVG_CSS_PROPERTIES.has(name) || !safeSvgCssValue(value)) continue;
		const priority = style.getPropertyPriority(name) === "important" ? " !important" : "";
		declarations.push(`${name}:${value}${priority};`);
	}
	return declarations.join("");
}

/**
 * A constructed stylesheet has no document and replaceSync ignores @import,
 * so parsing never loads a resource. Only flat style rules are serialized;
 * all global/group at-rules, custom properties and nested rules are discarded.
 * The native parser decodes CSS escapes before declarations are allow-listed.
 */
export function sanitizeSvgStylesheet(css: string): string {
	try {
		const sheet = new CSSStyleSheet();
		sheet.replaceSync(css);
		return Array.from(sheet.cssRules).flatMap((rule) => {
			if (!(rule instanceof CSSStyleRule)) return [];
			const styleRule = rule;
			const declarations = drawingDeclarations(styleRule.style);
			return declarations ? [`${styleRule.selectorText}{${declarations}}`] : [];
		}).join("");
	} catch {
		// Older render realms without constructable stylesheets fail closed;
		// their SVG presentation attributes still work.
		return "";
	}
}

/**
 * The element has already parsed its own `style` attribute into an inert
 * declaration block, so nothing has to be created to read one back. An element
 * outside the SVG namespace has no such block — and no styling either — so its
 * attribute is dropped rather than rewritten.
 */
export function sanitizeSvgStyleAttribute(el: Element): string {
	const { style } = el as { style?: CSSStyleDeclaration };
	return style ? drawingDeclarations(style) : "";
}
