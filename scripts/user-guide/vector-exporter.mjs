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
		// `radius` is one number for all four corners, or one per corner as
		// cornerRadii returns them; a box with corners that differ is a path.
		const rect = (r, fill, radius = 0, extra = "") => {
			const [tl, tr, br, bl] = Array.isArray(radius) ? radius : [radius, radius, radius, radius];
			if (tl === tr && tr === br && br === bl) return `<rect x="${n(r.x)}" y="${n(r.y)}" width="${n(r.width)}" height="${n(r.height)}" rx="${n(tl)}" fill="${escape(color(fill))}" ${extra}/>`;
			const { x, y, width: w, height: h } = r, arc = v => `A${n(v)} ${n(v)} 0 0 1`;
			const d = `M${n(x + tl)} ${n(y)}H${n(x + w - tr)}${arc(tr)} ${n(x + w)} ${n(y + tr)}V${n(y + h - br)}${arc(br)} ${n(x + w - br)} ${n(y + h)}H${n(x + bl)}${arc(bl)} ${n(x)} ${n(y + h - bl)}V${n(y + tl)}${arc(tl)} ${n(x + tl)} ${n(y)}Z`;
			return `<path d="${d}" fill="${escape(color(fill))}" ${extra}/>`;
		};
		// Each corner's radius, [top-left, top-right, bottom-right, bottom-left]:
		// a box may round only some corners (a list box under its search field
		// rounds the bottom two), which one number for all four would draw wrong.
		const cornerRadii = (style, r) => ["TopLeft", "TopRight", "BottomRight", "BottomLeft"]
			.map(corner => Math.min(px(style[`border${corner}Radius`]), r.width / 2, r.height / 2));
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
			const ownWidth = px(mask.getAttribute("width") || ""), ownHeight = px(mask.getAttribute("height") || "");
			const intrinsicWidth = ownWidth || viewBox[2] || r.width;
			const intrinsicHeight = ownHeight || viewBox[3] || r.height;
			const ratio = intrinsicHeight / intrinsicWidth;
			const [sx = "auto", sy = "auto"] = style.maskSize.split(" ");
			const length = (value, total) => value.endsWith("%") ? px(value) / 100 * total : px(value);
			let width, height;
			// An image with a shape (a viewBox) but no size of its own is drawn as
			// large as fits, as `contain` would (CSS background sizing): an icon
			// mask such as a search field's magnifier fills its box.
			const sizeless = !ownWidth && !ownHeight && sx === "auto" && sy === "auto";
			if (sx === "contain" || sx === "cover" || sizeless) {
				const scale = (sx === "cover" ? Math.max : Math.min)(r.width / intrinsicWidth, r.height / intrinsicHeight);
				width = intrinsicWidth * scale; height = intrinsicHeight * scale;
			} else { width = sx === "auto" ? sy === "auto" ? intrinsicWidth : length(sy, r.height) / ratio : length(sx, r.width); height = sy === "auto" ? width * ratio : length(sy, r.height); }
			const [posX = "50%", posY = "50%"] = style.maskPosition.split(" ");
			for (const node of [mask, ...mask.querySelectorAll("*")]) {
				node.removeAttribute("style"); node.removeAttribute("xmlns:xlink");
				// A shape without a fill of its own inherits its parent's: a Lucide
				// icon says `fill="none"` once, on its <svg>, and is drawn by strokes.
				if (node.closest("[fill]")?.getAttribute("fill") !== "none") node.setAttribute("fill", color(style.backgroundColor));
				if (node.getAttribute("stroke") === "currentColor") node.setAttribute("stroke", color(style.backgroundColor));
			}
			mask.setAttribute("x", n(r.x + length(posX, r.width - width))); mask.setAttribute("y", n(r.y + length(posY, r.height - height)));
			mask.setAttribute("width", n(width)); mask.setAttribute("height", n(height));
			return serializer.serializeToString(mask);
		}
		// Split CSS layers without breaking commas inside color/gradient functions.
		function layers(value) {
			const values = []; let start = 0, depth = 0;
			for (let index = 0; index < value.length; index++) {
				if (value[index] === "(") depth++;
				else if (value[index] === ")") depth--;
				else if (value[index] === "," && depth === 0) { values.push(value.slice(start, index).trim()); start = index + 1; }
			}
			values.push(value.slice(start).trim()); return values;
		}
		function backgrounds(style) {
			const clips = layers(style.backgroundClip || style.webkitBackgroundClip || "border-box");
			const sizes = layers(style.backgroundSize || "auto"), positions = layers(style.backgroundPosition || "0% 0%");
			return layers(style.backgroundImage).map((image, index) => ({
				image, clip: clips[index % clips.length], size: sizes[index % sizes.length], position: positions[index % positions.length],
			}));
		}
		// Where a layer is painted in the box: all of it unless it has a size of
		// its own (a checkbox's tick is a bar `0% 2px` wide, which a box that is
		// not ticked keeps empty), placed by its position; null where it has none.
		function layerBox(layer, r) {
			const [sx = "auto", sy = "auto"] = layer.size.split(" ");
			if (sx === "cover" || sx === "contain" || sx === "auto" && sy === "auto") return r;
			const length = (value, total) => value === "auto" ? total : value.endsWith("%") ? px(value) / 100 * total : px(value);
			const width = length(sx, r.width), height = length(sy, r.height);
			if (width <= 0 || height <= 0) return null;
			const [ox, oy] = positionOf(layer);
			return { x: r.x + place(ox, r.width - width), y: r.y + place(oy, r.height - height), width, height };
		}
		// A background's position is two values, one of which may be a calc():
		// Chrome reports `right 8px center` as `calc(100% - 8px) 50%`.
		function positionOf(layer) {
			const parts = layer.position.replace(/calc\([^)]*\)/g, match => match.replace(/\s+/g, "")).split(" ");
			return [parts[0] ?? "0%", parts[1] ?? "0%"];
		}
		// Where that value puts the image: a percentage is of the room left over.
		function place(value, free) {
			const sum = /^calc\((-?[\d.]+)%([+-])([\d.]+)px\)$/.exec(value);
			if (sum) return Number(sum[1]) / 100 * free + (sum[2] === "-" ? -1 : 1) * Number(sum[3]);
			return value.endsWith("%") ? px(value) / 100 * free : px(value);
		}
		// A background image that is an SVG data URL (Obsidian's dropdown chevrons),
		// drawn at its size and position as the vector it is.
		function paintImage(image, layer, r) {
			const viewBox = (image.getAttribute("viewBox") || "").split(/[ ,]+/).map(Number);
			const naturalWidth = px(image.getAttribute("width") || "") || viewBox[2] || 0, naturalHeight = px(image.getAttribute("height") || "") || viewBox[3] || naturalWidth;
			if (!naturalWidth) return "";
			const [sx = "auto", sy = "auto"] = layer.size.split(" ");
			const length = (value, total) => value.endsWith("%") ? px(value) / 100 * total : px(value);
			let width = naturalWidth, height = naturalHeight;
			if (sx !== "auto") { width = length(sx, r.width); height = sy === "auto" ? width * naturalHeight / naturalWidth : length(sy, r.height); }
			else if (sy !== "auto") { height = length(sy, r.height); width = height * naturalWidth / naturalHeight; }
			const [ox, oy] = positionOf(layer);
			image.removeAttribute("style"); image.removeAttribute("xmlns:xlink");
			image.setAttribute("x", n(r.x + place(ox, r.width - width))); image.setAttribute("y", n(r.y + place(oy, r.height - height)));
			image.setAttribute("width", n(width)); image.setAttribute("height", n(height));
			return serializer.serializeToString(image);
		}
		function gradient(value, r, textSpace = false) {
			if (!value.startsWith("linear-gradient(")) return null;
			const colors = [...value.matchAll(/(?:rgba?\([^)]*\)|okl(?:ch|ab)\([^)]*\)|color\([^)]*\)|#[a-f\d]{3,8})\s*(\d+(?:\.\d+)?%)?/gi)];
			if (colors.length < 2) return null;
			const id = `gradient-${++serial}`, angle = /linear-gradient\(([-\d.]+)deg/.exec(value);
			const degrees = angle ? Number(angle[1]) : value.includes("to right") ? 90 : 180;
			const dx = Math.sin(degrees * Math.PI / 180), dy = -Math.cos(degrees * Math.PI / 180);
			// Text children share the source element's sweep, including wrapped lines.
			// User-space coordinates prevent it restarting on each exported text run.
			const length = Math.abs(r.width * dx) + Math.abs(r.height * dy);
			const coordinates = textSpace
				? `gradientUnits="userSpaceOnUse" x1="${n(r.x + r.width / 2 - dx * length / 2)}" y1="${n(r.y + r.height / 2 - dy * length / 2)}" x2="${n(r.x + r.width / 2 + dx * length / 2)}" y2="${n(r.y + r.height / 2 + dy * length / 2)}"`
				: `x1="${n((.5 - dx / 2) * 100)}%" y1="${n((.5 - dy / 2) * 100)}%" x2="${n((.5 + dx / 2) * 100)}%" y2="${n((.5 + dy / 2) * 100)}%"`;
			defs.push(`<linearGradient id="${id}" ${coordinates}>${colors.map((match, index) => `<stop offset="${match[1] || n(index / (colors.length - 1) * 100) + "%"}" stop-color="${escape(color(match[0].replace(/\s+[\d.]+%$/, "")))}"/>`).join("")}</linearGradient>`);
			return `url(#${id})`;
		}
		function paintBox(style, r, element) {
			const radius = cornerRadii(style, r);
			const output = [];
			// A hard ring, `0 0 0 1px colour` (no offset, no blur), is how Obsidian
			// outlines a Find callouts note's card; it lies outside the box, so it is
			// a stroke centred half its width beyond the edge. A soft drop shadow is
			// not vector geometry and is left out, as are inset shadows. So is the ring
			// of a focused control and of what holds one: the fixture focuses a field
			// with a script, which draws the keyboard's ring, where a click draws none.
			for (const shadow of element?.matches(":focus-within") ? [] : layers(style.boxShadow)) {
				const ring = /^(.+?)\s+0px 0px 0px (\d*\.?\d+)px$/.exec(shadow);
				if (!ring || !visibleColor(color(ring[1]))) continue;
				const spread = Number(ring[2]);
				output.push(rect({ x: r.x - spread / 2, y: r.y - spread / 2, width: r.width + spread, height: r.height + spread }, "none", radius.map(v => v ? v + spread / 2 : 0), `stroke="${escape(color(ring[1]))}" stroke-width="${n(spread)}"`));
			}
			const background = backgrounds(style);
			if (background.at(-1).clip !== "text" && visibleColor(style.backgroundColor)) output.push(rect(r, style.backgroundColor, radius));
			for (const layer of background.reverse()) {
				const image = layer.clip === "text" ? null : vectorUrl(layer.image);
				if (image) { output.push(paintImage(image, layer, r)); continue; }
				const where = layer.clip === "text" ? null : layerBox(layer, r);
				const fill = where && gradient(layer.image, where);
				if (fill) output.push(rect(where, fill, where === r ? radius : 0));
			}
			const borders = ["Top", "Right", "Bottom", "Left"].map(side => ({ side, width: px(style[`border${side}Width`]), color: style[`border${side}Color`], style: style[`border${side}Style`] }));
			if (borders.every(edge => edge.width === borders[0].width && edge.color === borders[0].color) && borders[0].width && borders[0].style !== "none") {
				const edge = borders[0], inset = edge.width / 2;
				output.push(rect({ x: r.x + inset, y: r.y + inset, width: r.width - edge.width, height: r.height - edge.width }, "none", radius.map(v => Math.max(0, v - inset)), `stroke="${escape(color(edge.color))}" stroke-width="${n(edge.width)}"`));
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
		// The bullet of a list item (`::marker`, which is not an element, so it is
		// never walked): a disc, circle or square hung outside the item, sized and
		// set against the first line as Chrome draws it.
		function bullet(element, style, r) {
			if (style.display !== "list-item" || style.listStyleImage !== "none" || style.listStylePosition !== "outside") return "";
			const kind = style.listStyleType;
			if (!["disc", "circle", "square"].includes(kind)) return "";
			metrics.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
			const measured = metrics.measureText("x");
			const ascent = measured.fontBoundingBoxAscent, height = ascent + measured.fontBoundingBoxDescent;
			const size = Math.floor((Math.floor(ascent * 2 / 3) + 1) / 2);
			const line = px(style.lineHeight) || height, ink = color(getComputedStyle(element, "::marker").color || style.color);
			const middleX = r.x - 8 - size / 2;
			const middleY = r.y + px(style.paddingTop) + px(style.borderTopWidth) + (line - height) / 2 + 3 * (ascent - Math.floor(ascent * 2 / 3)) / 2 + size / 2;
			if (kind === "square") return `<rect x="${n(middleX - size / 2)}" y="${n(middleY - size / 2)}" width="${size}" height="${size}" fill="${escape(ink)}"/>`;
			return kind === "disc"
				? `<circle cx="${n(middleX)}" cy="${n(middleY)}" r="${n(size / 2)}" fill="${escape(ink)}"/>`
				: `<circle cx="${n(middleX)}" cy="${n(middleY)}" r="${n((size - 1) / 2)}" fill="none" stroke="${escape(ink)}" stroke-width="1"/>`;
		}
		function font(style) { return `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`; }
		const textSweeps = new WeakMap();
		function textFill(element, style) {
			const flat = style.webkitTextFillColor || style.color;
			if (visibleColor(flat)) return flat;
			for (let source = element; source; source = source.parentElement) {
				if (!textSweeps.has(source)) {
					const layer = backgrounds(getComputedStyle(source)).find(layer => layer.clip === "text" && layer.image.startsWith("linear-gradient("));
					textSweeps.set(source, layer ? gradient(layer.image, box(source.getBoundingClientRect()), true) : null);
				}
				if (textSweeps.get(source)) return textSweeps.get(source);
				if (source === root) break;
			}
			return flat;
		}
		function text(value, style, r, measuredWidth = r.width, fill = style.color) {
			if (!value || !r.width || !r.height) return "";
			if (style.textTransform === "uppercase") value = value.toLocaleUpperCase();
			else if (style.textTransform === "lowercase") value = value.toLocaleLowerCase();
			metrics.font = font(style);
			const m = metrics.measureText(value), ascent = m.fontBoundingBoxAscent || px(style.fontSize) * .8, descent = m.fontBoundingBoxDescent || px(style.fontSize) * .2;
			const baseline = r.y + (r.height - ascent - descent) / 2 + ascent;
			const rtl = style.direction === "rtl", tracking = px(style.letterSpacing);
			return `<text x="${n(r.x + (rtl ? measuredWidth : 0))}" y="${n(baseline)}" fill="${escape(color(fill))}" font-family="${escape(style.fontFamily)}" font-size="${escape(style.fontSize)}" font-weight="${escape(style.fontWeight)}" font-style="${escape(style.fontStyle)}" direction="${rtl ? "rtl" : "ltr"}" unicode-bidi="embed" letter-spacing="${n(tracking)}" textLength="${n(measuredWidth)}" lengthAdjust="spacing" xml:space="preserve">${escape(value)}</text>`;
		}
		function textNode(node, style, element) {
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
			const fill = textFill(element, style);
			return runs.map(run => text(run.value, style, run.r, run.r.width, fill)).join("");
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
			// A content-box size leaves out the border and padding, and a box with no
			// content can still be a line: a settings row's divider is a 0-high
			// ::before drawn entirely by its top border.
			const outer = (start, end) => style.boxSizing === "border-box" ? 0
				: px(style[`border${start}Width`]) + px(style[`border${end}Width`]) + px(style[`padding${start}`]) + px(style[`padding${end}`]);
			const width = size(style.width, parentBox.width) + outer("Left", "Right");
			const height = size(style.height, parentBox.height) + outer("Top", "Bottom");
			if (!width || !height) return "";
			const r = { x: parentBox.x + px(style.marginLeft), y: parentBox.y + px(style.marginTop), width, height };
			// The one box a flex container holds is placed by its alignment, not at
			// its corner: a search field's clear button is a `display: flex` box with
			// the ✕ as its `::after`, centred in it. (Only for a host with nothing
			// else in it, so there is no other item to share the line with.)
			const host = getComputedStyle(element), other = getComputedStyle(element, name === "::before" ? "::after" : "::before");
			if (!["absolute", "fixed"].includes(style.position) && /flex/.test(host.display) && !element.firstChild && (other.content === "none" || other.display === "none")) {
				const edge = side => px(host[`border${side}Width`]) + px(host[`padding${side}`]);
				const free = (total, ...sides) => total - sides.reduce((sum, side) => sum + edge(side), 0);
				const share = (value, space) => value === "center" ? space / 2 : /(^|-)end$/.test(value) ? space : 0;
				const column = host.flexDirection.startsWith("column");
				const across = share(column ? host.alignItems : host.justifyContent, free(parentBox.width, "Left", "Right") - width - px(style.marginLeft) - px(style.marginRight));
				const down = share(column ? host.justifyContent : host.alignItems, free(parentBox.height, "Top", "Bottom") - height - px(style.marginTop) - px(style.marginBottom));
				r.x = parentBox.x + edge("Left") + across + px(style.marginLeft);
				r.y = parentBox.y + edge("Top") + down + px(style.marginTop);
			}
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
			// A colour input is Obsidian's round swatch (`::-webkit-color-swatch`,
			// which the page cannot read): a circle of its value, filling the box.
			if (element instanceof HTMLInputElement && element.type === "color") {
				const radius = Math.min(r.width, r.height) / 2;
				return `<circle cx="${n(r.x + r.width / 2)}" cy="${n(r.y + r.height / 2)}" r="${n(radius)}" fill="${escape(color(element.value))}"/>`;
			}
			// Inputs whose value is not text on screen: a radio's value is "on".
			const textless = ["checkbox", "radio", "color", "file", "hidden", "button", "submit", "reset", "image"];
			if (element instanceof HTMLInputElement && !textless.includes(element.type) || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement) {
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
			// An element that is not displayed paints nothing, so it lifts nothing:
			// a closed picker's list must not raise the page above an open menu.
			if (style.display === "none") { paintOrders.set(element, 0); return 0; }
			// A positioned popup participates in its nearest stacking context,
			// even through wrappers whose z-index is auto. Keep that branch above
			// ordinary siblings, stopping at real intervening stacking contexts.
			const context = style.zIndex !== "auto" && style.position !== "static" || style.transform !== "none" || Number(style.opacity) < 1 || style.isolation === "isolate";
			const order = context ? own : Math.max(own, ...[...element.children].map(paintOrder));
			paintOrders.set(element, order); return order;
		}
		// What a sticky bar hides. The icon picker opens with its chosen icon centred,
		// so a row or two of icons sit under the search bar, which stays at the top of
		// the scroller. The browser never shows them. They were exported anyway,
		// clipped to the scroller, and the bar's box starts at the very edge of that
		// clip: at a fractional scale the one pixel row both only half cover let a
		// hairline of the hidden icons through under the line above. So an element
		// that lies wholly behind an opaque sticky bar is not drawn at all.
		const hidingBars = [];
		const opaque = value => /^rgb\(|,\s*1\)$/.test(color(value));
		function stickyBarsIn(scroller, view) {
			// Only a scrolled container has anything passing under its bars.
			if (!scroller.scrollTop && !scroller.scrollLeft) return [];
			const bars = [];
			for (const candidate of scroller.querySelectorAll("*")) {
				const style = getComputedStyle(candidate), measured = candidate.getBoundingClientRect();
				if (style.position !== "sticky" || style.display === "none" || style.visibility === "hidden" || Number(style.opacity) < 1 || !opaque(style.backgroundColor)) continue;
				if (measured.width && measured.height) bars.push({ element: candidate, order: paintOrder(candidate), view, box: box(measured) });
			}
			return bars;
		}
		function behindBar(element, r) {
			return hidingBars.some(bar => {
				// The bar, what it holds and what holds it are drawn; so is anything that paints above it.
				if (bar.element.contains(element) || element.contains(bar.element) || paintOrder(element) > bar.order) return false;
				const left = Math.max(r.x, bar.view.x), top = Math.max(r.y, bar.view.y);
				const right = Math.min(r.x + r.width, bar.view.x + bar.view.width), bottom = Math.min(r.y + r.height, bar.view.y + bar.view.height);
				return right > left && bottom > top && left >= bar.box.x - .02 && top >= bar.box.y - .02
					&& right <= bar.box.x + bar.box.width + .02 && bottom <= bar.box.y + bar.box.height + .02;
			});
		}
		function walk(element) {
			const style = getComputedStyle(element), measured = element.getBoundingClientRect();
			if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0) return "";
			if (!measured.width || !measured.height) return [...element.children].map(walk).join("");
			const r = box(measured);
			if (r.x + r.width < padding || r.y + r.height < padding || r.x > width - padding || r.y > height - padding) return "";
			if (behindBar(element, r)) return "";
			if (element instanceof SVGSVGElement) return artwork(element, r);
			if (element instanceof HTMLImageElement) throw new Error("Raster images are not supported by the vector documentation exporter");
			const after = pseudo(element, "::after", r), afterBehind = Number(getComputedStyle(element, "::after").zIndex) < 0;
			// A positioned ::before paints above the element's in-flow children, as
			// the browser layers it (a search field's magnifier over its input).
			const beforeStyle = getComputedStyle(element, "::before");
			const beforeOnTop = beforeStyle.position !== "static" && !(Number(beforeStyle.zIndex) < 0);
			const before = pseudo(element, "::before", r);
			let result = paintBox(style, r, element) + bullet(element, style, r) + (beforeOnTop ? "" : before) + (afterBehind ? after : "");
			result = paintMask(style, r) ?? result;
			result += control(element, style, r);
			let children = "";
			// Sticky toolbars and floating menus paint above their later siblings.
			const childNodes = [...element.childNodes].map((node, index) => ({ node, index, z: node.nodeType === Node.ELEMENT_NODE ? paintOrder(node) : 0 })).sort((a, b) => a.z - b.z || a.index - b.index);
			const clips = ["hidden", "clip", "auto", "scroll"].some(value => style.overflowX === value || style.overflowY === value);
			const bars = clips ? stickyBarsIn(element, r) : [];
			hidingBars.push(...bars);
			for (const { node: child } of childNodes) children += child.nodeType === Node.TEXT_NODE ? textNode(child, style, element) : child.nodeType === Node.ELEMENT_NODE ? walk(child) : "";
			hidingBars.length -= bars.length;
			if (clips) children = `<g clip-path="url(#${clip(r, cornerRadii(style, r))})">${children}</g>`;
			result += children + (beforeOnTop ? before : "") + (afterBehind ? "" : after);
			return Number(style.opacity) < 1 ? `<g opacity="${style.opacity}">${result}</g>` : result;
		}
		pieces.push(rect({ x: 0, y: 0, width, height }, options.background || getComputedStyle(document.body).backgroundColor || "#1e1e1e", 12));
		pieces.push(walk(root));
		const svg = `<svg xmlns="${svgNs}" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title description"><title id="title">${escape(options.title || "Callout Studio")}</title><desc id="description">${escape(options.description || "Dark-mode vector rendering of the plugin source UI.")}</desc><defs>${defs.join("")}</defs>${pieces.join("")}</svg>\n`;
		if (/<(?:script|foreignObject|image)\b|\son\w+=|href\s*=/.test(svg)) throw new Error("Export contains unsupported active or non-vector content");
		return svg;
	}, { selector, options });
}
