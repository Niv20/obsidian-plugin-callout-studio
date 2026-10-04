/**
 * Export the browser's source-rendered DOM as portable vector geometry.
 * Reads layout/style/text ranges, never screenshots or pixels. SVG artwork,
 * masks, boxes, borders and text remain vector elements; HTML is not embedded.
 */
export async function exportSvg(page, selector, options = {}) {
	return page.evaluate(({ selector, options }) => {
		const root = document.querySelector(selector);
		if (!root) throw new Error(`Missing vector export root: ${selector}`);
		const bounds = root.getBoundingClientRect(), padding = options.padding ?? 24;
		if (!bounds.width || !bounds.height) throw new Error(`Empty vector export root: ${selector}`);
		const width = Math.ceil(bounds.width + padding * 2), height = Math.ceil(bounds.height + padding * 2);
		const origin = { x: bounds.x - padding, y: bounds.y - padding };
		const escape = value => String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
		const n = value => Math.round(Number(value) * 100) / 100;
		const px = value => parseFloat(value) || 0;
		const defs = [], pieces = [];
		let serial = 0;
		// Convert modern CSS color spaces to sRGB for GitHub and SVG rasterizers.
		function color(value) {
			const modern = /^(oklch|oklab|color)\((.*)\)$/.exec(value?.trim() || "");
			if (!modern) return value;
			const [body, alphaText = "1"] = modern[2].split("/");
			const alpha = alphaText.trim().endsWith("%") ? parseFloat(alphaText) / 100 : parseFloat(alphaText);
			const parts = body.trim().split(/\s+/);
			let channels;
			if (modern[1] === "color" && parts.shift() === "srgb") channels = parts.map(v => v.endsWith("%") ? parseFloat(v) / 100 : Number(v));
			else if (modern[1] === "oklch" || modern[1] === "oklab") {
				const L = parts[0].endsWith("%") ? parseFloat(parts[0]) / 100 : Number(parts[0]);
				let a, b;
				const coordinate = v => v.endsWith("%") ? parseFloat(v) * .004 : Number(v);
				if (modern[1] === "oklch") { const C = coordinate(parts[1]), hue = parts[2] === "none" ? 0 : parseFloat(parts[2]) * Math.PI / 180; a = C * Math.cos(hue); b = C * Math.sin(hue); }
				else { a = coordinate(parts[1]); b = coordinate(parts[2]); }
				const l = (L + .3963377774 * a + .2158037573 * b) ** 3;
				const m = (L - .1055613458 * a - .0638541728 * b) ** 3;
				const s = (L - .0894841775 * a - 1.291485548 * b) ** 3;
				channels = [4.0767416621 * l - 3.3077115913 * m + .2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - .3413193965 * s, -.0041960863 * l - .7034186147 * m + 1.707614701 * s].map(v => v <= .0031308 ? v * 12.92 : 1.055 * Math.max(v, 0) ** (1 / 2.4) - .055);
			}
			if (!channels || channels.some(v => !Number.isFinite(v)) || !Number.isFinite(alpha)) throw new Error(`Unsupported SVG color: ${value}`);
			return `rgba(${channels.map(v => n(Math.max(0, Math.min(1, v)) * 255)).join(", ")}, ${n(alpha)})`;
		}
		const visibleColor = color => color && color !== "transparent" && !/rgba\([^)]*,\s*0\)$/.test(color);
		const box = r => ({ x: n(r.x - origin.x), y: n(r.y - origin.y), width: n(r.width), height: n(r.height) });
		const rect = (r, fill, radius = 0, extra = "") => `<rect x="${n(r.x)}" y="${n(r.y)}" width="${n(r.width)}" height="${n(r.height)}" rx="${n(radius)}" fill="${escape(color(fill))}" ${extra}/>`;
		const clip = (r, radius = 0) => {
			const id = `clip-${++serial}`;
			defs.push(`<clipPath id="${id}">${rect(r, "white", radius)}</clipPath>`);
			return id;
		};
		const svgNs = "http://www.w3.org/2000/svg";
		const serializer = new XMLSerializer();
		function artwork(element, r) {
			const clone = element.cloneNode(true);
			const original = [element, ...element.querySelectorAll("*")], copied = [clone, ...clone.querySelectorAll("*")];
			for (let index = 0; index < original.length; index++) {
				const source = original[index], dest = copied[index], style = getComputedStyle(source);
				for (const attribute of [...dest.attributes]) if (/^(?:on|class$|style$|id$)/.test(attribute.name)) dest.removeAttribute(attribute.name);
				for (const key of ["fill", "stroke", "stroke-width", "stroke-linecap", "stroke-linejoin", "fill-rule", "clip-rule", "opacity"]) {
					const value = style.getPropertyValue(key);
					if (value && value !== "normal") dest.setAttribute(key, ["fill", "stroke"].includes(key) ? color(value) : value);
				}
				if (style.display === "none" || style.visibility === "hidden") dest.setAttribute("display", "none");
			}
			// Screen CTM includes viewBox scale and CSS rotations on ancestors.
			const matrix = element.getScreenCTM(), group = document.createElementNS(svgNs, "g");
			for (const attribute of [...clone.attributes]) if (!["viewBox", "x", "y", "width", "height", "xmlns"].includes(attribute.name)) group.setAttribute(attribute.name, attribute.value);
			group.setAttribute("transform", `matrix(${matrix.a} ${matrix.b} ${matrix.c} ${matrix.d} ${matrix.e - origin.x} ${matrix.f - origin.y})`);
			while (clone.firstChild) group.appendChild(clone.firstChild);
			return serializer.serializeToString(group);
		}
		function vectorUrl(value) {
			const match = /^url\((["'])([\s\S]*)\1\)$/.exec(value) ?? /^url\((data:image\/[\s\S]*)\)$/.exec(value);
			if (!match) return null;
			const url = (match[2] ?? match[1]).replace(/\\([\da-f]{1,6})\s?/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16))).replace(/\\(.)/g, "$1");
			if (!url.startsWith("data:image/svg+xml")) return null;
			const comma = url.indexOf(","), data = url.slice(comma + 1);
			const xml = url.slice(0, comma).includes(";base64") ? atob(data) : decodeURIComponent(data.replace(/%(?![\da-f]{2})/gi, "%25"));
			const parsed = new DOMParser().parseFromString(xml, "image/svg+xml");
			if (parsed.querySelector("parsererror")) throw new Error("Cannot decode the source CSS vector mask");
			return parsed.documentElement;
		}
		function paintMask(style, r) {
			const mask = vectorUrl(style.maskImage || style.webkitMaskImage || "");
			if (!mask) return null;
			const viewBox = (mask.getAttribute("viewBox") || "").split(/[ ,]+/).map(Number);
			const intrinsicWidth = px(mask.getAttribute("width") || "") || viewBox[2] || r.width;
			const intrinsicHeight = px(mask.getAttribute("height") || "") || viewBox[3] || r.height;
			const ratio = intrinsicHeight / intrinsicWidth;
			const [sx = "auto", sy = "auto"] = style.maskSize.split(" ");
			const length = (value, total) => value.endsWith("%") ? px(value) / 100 * total : px(value);
			let width, height;
			if (sx === "contain" || sx === "cover") {
				const scale = (sx === "contain" ? Math.min : Math.max)(r.width / intrinsicWidth, r.height / intrinsicHeight);
				width = intrinsicWidth * scale; height = intrinsicHeight * scale;
			} else { width = sx === "auto" ? sy === "auto" ? intrinsicWidth : length(sy, r.height) / ratio : length(sx, r.width); height = sy === "auto" ? width * ratio : length(sy, r.height); }
			const [posX = "50%", posY = "50%"] = style.maskPosition.split(" ");
			for (const node of [mask, ...mask.querySelectorAll("*")]) {
				node.removeAttribute("style"); node.removeAttribute("xmlns:xlink");
				if (node.getAttribute("fill") !== "none") node.setAttribute("fill", color(style.backgroundColor));
				if (node.getAttribute("stroke") === "currentColor") node.setAttribute("stroke", color(style.backgroundColor));
			}
			mask.setAttribute("x", n(r.x + length(posX, r.width - width))); mask.setAttribute("y", n(r.y + length(posY, r.height - height)));
			mask.setAttribute("width", n(width)); mask.setAttribute("height", n(height));
			return serializer.serializeToString(mask);
		}
		function gradient(value, r) {
			if (!value.startsWith("linear-gradient(")) return null;
			const colors = [...value.matchAll(/(?:rgba?\([^)]*\)|okl(?:ch|ab)\([^)]*\)|color\([^)]*\)|#[a-f\d]{3,8})\s*(\d+(?:\.\d+)?%)?/gi)];
			if (colors.length < 2) return null;
			const id = `gradient-${++serial}`, angle = /linear-gradient\(([-\d.]+)deg/.exec(value);
			const degrees = angle ? Number(angle[1]) : value.includes("to right") ? 90 : 180;
			const dx = Math.sin(degrees * Math.PI / 180), dy = -Math.cos(degrees * Math.PI / 180);
			defs.push(`<linearGradient id="${id}" x1="${n((.5 - dx / 2) * 100)}%" y1="${n((.5 - dy / 2) * 100)}%" x2="${n((.5 + dx / 2) * 100)}%" y2="${n((.5 + dy / 2) * 100)}%">${colors.map((match, index) => `<stop offset="${match[1] || n(index / (colors.length - 1) * 100) + "%"}" stop-color="${escape(color(match[0].replace(/\s+[\d.]+%$/, "")))}"/>`).join("")}</linearGradient>`);
			return `url(#${id})`;
		}
		function paintBox(style, r) {
			const radius = Math.min(px(style.borderTopLeftRadius), r.width / 2, r.height / 2);
			const output = [];
			if (visibleColor(style.backgroundColor)) output.push(rect(r, style.backgroundColor, radius));
			const fill = gradient(style.backgroundImage, r);
			if (fill) output.push(rect(r, fill, radius));
			const borders = ["Top", "Right", "Bottom", "Left"].map(side => ({ side, width: px(style[`border${side}Width`]), color: style[`border${side}Color`], style: style[`border${side}Style`] }));
			if (borders.every(edge => edge.width === borders[0].width && edge.color === borders[0].color) && borders[0].width && borders[0].style !== "none") {
				const edge = borders[0], inset = edge.width / 2;
				output.push(rect({ x: r.x + inset, y: r.y + inset, width: r.width - edge.width, height: r.height - edge.width }, "none", Math.max(0, radius - inset), `stroke="${escape(color(edge.color))}" stroke-width="${n(edge.width)}"`));
			} else {
				for (const edge of borders) if (edge.width && edge.style !== "none" && visibleColor(edge.color)) {
					const b = edge.side === "Top" ? { x: r.x, y: r.y, width: r.width, height: edge.width }
						: edge.side === "Bottom" ? { x: r.x, y: r.y + r.height - edge.width, width: r.width, height: edge.width }
							: edge.side === "Left" ? { x: r.x, y: r.y, width: edge.width, height: r.height } : { x: r.x + r.width - edge.width, y: r.y, width: edge.width, height: r.height };
					output.push(rect(b, edge.color));
				}
			}
			return output.join("");
		}
		const metrics = document.createElement("canvas").getContext("2d");
		function font(style) { return `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`; }
		function text(value, style, r, measuredWidth = r.width) {
			if (!value || !r.width || !r.height) return "";
			if (style.textTransform === "uppercase") value = value.toLocaleUpperCase();
			else if (style.textTransform === "lowercase") value = value.toLocaleLowerCase();
			metrics.font = font(style);
			const m = metrics.measureText(value), ascent = m.fontBoundingBoxAscent || px(style.fontSize) * .8, descent = m.fontBoundingBoxDescent || px(style.fontSize) * .2;
			const baseline = r.y + (r.height - ascent - descent) / 2 + ascent;
			const rtl = style.direction === "rtl", tracking = px(style.letterSpacing);
			return `<text x="${n(r.x + (rtl ? measuredWidth : 0))}" y="${n(baseline)}" fill="${escape(color(style.color))}" font-family="${escape(style.fontFamily)}" font-size="${escape(style.fontSize)}" font-weight="${escape(style.fontWeight)}" font-style="${escape(style.fontStyle)}" direction="${rtl ? "rtl" : "ltr"}" unicode-bidi="embed" letter-spacing="${n(tracking)}" textLength="${n(measuredWidth)}" lengthAdjust="spacing" xml:space="preserve">${escape(value)}</text>`;
		}
		function textNode(node, style) {
			const value = node.textContent, range = document.createRange(), runs = [];
			let active = null;
			for (const { segment, index } of new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(value)) {
				range.setStart(node, index); range.setEnd(node, index + segment.length);
				const measured = range.getBoundingClientRect();
				if (!measured.width || !measured.height) continue;
				const r = box(measured);
				// Keep each visual line in logical order, including right-to-left
				// runs. Exporting separate letters loses bidi ordering and shaping.
				if (active && Math.abs(active.r.y - r.y) < 1) {
					const right = Math.max(active.r.x + active.r.width, r.x + r.width);
					active.value += segment; active.r.x = Math.min(active.r.x, r.x);
					active.r.width = n(right - active.r.x);
				}
				else { active = { value: segment, r }; runs.push(active); }
			}
			return runs.map(run => text(run.value, style, run.r)).join("");
		}
		function pseudo(element, name, parentBox) {
			const style = getComputedStyle(element, name);
			if (style.content === "none" || style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0) return "";
			// Absolutely positioned pseudo-elements use the parent's padding box.
			// Counting its border again shifts checkbox masks up and to the left.
			if (style.position === "absolute") {
				const parentStyle = getComputedStyle(element);
				const left = px(parentStyle.borderLeftWidth), top = px(parentStyle.borderTopWidth);
				parentBox = { x: parentBox.x + left, y: parentBox.y + top,
					width: parentBox.width - left - px(parentStyle.borderRightWidth),
					height: parentBox.height - top - px(parentStyle.borderBottomWidth) };
			}
			const size = (value, total) => value.endsWith("%") ? px(value) / 100 * total : px(value);
			const width = size(style.width, parentBox.width), height = size(style.height, parentBox.height);
			if (!width || !height) return "";
			const r = { x: parentBox.x + px(style.marginLeft), y: parentBox.y + px(style.marginTop), width, height };
			if (style.left !== "auto") r.x += size(style.left, parentBox.width);
			else if (style.right !== "auto") r.x += parentBox.width - size(style.right, parentBox.width) - width;
			if (style.top !== "auto") r.y += size(style.top, parentBox.height);
			else if (style.bottom !== "auto") r.y += parentBox.height - size(style.bottom, parentBox.height) - height;
			const transform = style.transform !== "none" ? new DOMMatrix(style.transform) : null;
			const painted = paintMask(style, r) ?? paintBox(style, r);
			if (!transform) return painted;
			const [originX, originY] = style.transformOrigin.split(" ").map(px);
			const x = r.x + originX, y = r.y + originY;
			return `<g transform="matrix(${transform.a} ${transform.b} ${transform.c} ${transform.d} ${n(transform.e + x - transform.a * x - transform.c * y)} ${n(transform.f + y - transform.b * x - transform.d * y)})">${painted}</g>`;
		}
		function control(element, style, r) {
			if (element instanceof HTMLInputElement && element.type === "range") {
				const track = style.backgroundColor;
				const thumb = style.getPropertyValue("--slider-thumb-background").trim() || "white";
				const fill = style.getPropertyValue("--slider-fill-background").trim();
				const knob = px(style.getPropertyValue("--slider-thumb-height")) || 12;
				const fraction = (Number(element.value) - Number(element.min || 0)) / (Number(element.max || 100) - Number(element.min || 0));
				const center = n(r.x + knob / 2 + fraction * (r.width - knob));
				return `<line x1="${r.x}" x2="${r.x + r.width}" y1="${n(r.y + r.height / 2)}" y2="${n(r.y + r.height / 2)}" stroke="${escape(color(track))}" stroke-width="${r.height}" stroke-linecap="round"/><line x1="${r.x}" x2="${center}" y1="${n(r.y + r.height / 2)}" y2="${n(r.y + r.height / 2)}" stroke="${escape(color(fill))}" stroke-width="${r.height}" stroke-linecap="round"/><circle cx="${center}" cy="${n(r.y + r.height / 2)}" r="${knob / 2}" fill="${escape(color(thumb))}"/>`;
			}
			if (element instanceof HTMLInputElement && element.type !== "checkbox" || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement) {
				const value = element instanceof HTMLSelectElement ? element.selectedOptions[0]?.textContent : element.value || element.placeholder;
				const inset = px(style.paddingLeft) + px(style.borderLeftWidth), available = r.width - inset - px(style.paddingRight) - px(style.borderRightWidth);
				metrics.font = font(style); const measured = metrics.measureText(value || "").width;
				const textStyle = !element.value && !(element instanceof HTMLSelectElement) ? getComputedStyle(element, "::placeholder") : style;
				const id = clip({ x: r.x + inset, y: r.y, width: Math.max(0, available), height: r.height });
				return `<g clip-path="url(#${id})">${text(value, { ...style, color: textStyle.color || style.color, fontFamily: style.fontFamily, fontSize: style.fontSize, fontWeight: style.fontWeight, fontStyle: style.fontStyle }, { x: r.x + inset, y: r.y, width: measured, height: r.height }, measured)}</g>`;
			}
			return "";
		}
		const paintOrders = new WeakMap();
		function paintOrder(element) {
			if (paintOrders.has(element)) return paintOrders.get(element);
			const style = getComputedStyle(element), own = Number(style.zIndex) || 0;
			// A positioned popup participates in its nearest stacking context,
			// even through wrappers whose z-index is auto. Keep that branch above
			// ordinary siblings, stopping at real intervening stacking contexts.
			const context = style.zIndex !== "auto" && style.position !== "static" || style.transform !== "none" || Number(style.opacity) < 1 || style.isolation === "isolate";
			const order = context ? own : Math.max(own, ...[...element.children].map(paintOrder));
			paintOrders.set(element, order); return order;
		}
		function walk(element) {
			const style = getComputedStyle(element), measured = element.getBoundingClientRect();
			if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0) return "";
			if (!measured.width || !measured.height) return [...element.children].map(walk).join("");
			const r = box(measured);
			if (r.x + r.width < padding || r.y + r.height < padding || r.x > width - padding || r.y > height - padding) return "";
			if (element instanceof SVGSVGElement) return artwork(element, r);
			if (element instanceof HTMLImageElement) throw new Error("Raster images are not supported by the vector documentation exporter");
			const after = pseudo(element, "::after", r), afterBehind = Number(getComputedStyle(element, "::after").zIndex) < 0;
			let result = paintBox(style, r) + pseudo(element, "::before", r) + (afterBehind ? after : "");
			result = paintMask(style, r) ?? result;
			result += control(element, style, r);
			let children = "";
			// Sticky toolbars and floating menus paint above their later siblings.
			const childNodes = [...element.childNodes].map((node, index) => ({ node, index, z: node.nodeType === Node.ELEMENT_NODE ? paintOrder(node) : 0 })).sort((a, b) => a.z - b.z || a.index - b.index);
			for (const { node: child } of childNodes) children += child.nodeType === Node.TEXT_NODE ? textNode(child, style) : child.nodeType === Node.ELEMENT_NODE ? walk(child) : "";
			if (["hidden", "clip", "auto", "scroll"].some(value => style.overflowX === value || style.overflowY === value)) children = `<g clip-path="url(#${clip(r, px(style.borderTopLeftRadius))})">${children}</g>`;
			result += children + (afterBehind ? "" : after);
			return Number(style.opacity) < 1 ? `<g opacity="${style.opacity}">${result}</g>` : result;
		}
		pieces.push(rect({ x: 0, y: 0, width, height }, options.background || getComputedStyle(document.body).backgroundColor || "#1e1e1e", 12));
		pieces.push(walk(root));
		const svg = `<svg xmlns="${svgNs}" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title description"><title id="title">${escape(options.title || "Callout Studio")}</title><desc id="description">${escape(options.description || "Dark-mode vector rendering of the plugin source UI.")}</desc><defs>${defs.join("")}</defs>${pieces.join("")}</svg>\n`;
		if (/<(?:script|foreignObject|image)\b|\son\w+=|href\s*=/.test(svg)) throw new Error("Export contains unsupported active or non-vector content");
		return svg;
	}, { selector, options });
}
