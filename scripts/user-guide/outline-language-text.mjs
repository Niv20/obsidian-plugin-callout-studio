/** Freeze non-Latin language labels as vectors so viewers need no matching fonts. */
import { spawnSync } from "node:child_process";

export async function outlineLanguageText(page, svg) {
	const labels = await page.evaluate(source => {
		const holder = document.createElement("div");
		holder.style.cssText = "position:fixed;left:-100000px;top:0;opacity:0;pointer-events:none";
		holder.innerHTML = source;
		document.body.append(holder);
		try {
			const canvas = document.createElement("canvas").getContext("2d");
			return [...holder.querySelectorAll("text")].flatMap((text, index) => {
				const value = text.textContent;
				if (![...value].some(char => /\p{Letter}/u.test(char) && !/\p{Script=Latin}/u.test(char))) return [];
				const box = text.getBBox(), style = getComputedStyle(text);
				canvas.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
				canvas.direction = style.direction;
				canvas.textAlign = "left";
				canvas.letterSpacing = style.letterSpacing;
				const metrics = canvas.measureText(value);
				const scale = text.getAttribute("lengthAdjust") === "spacingAndGlyphs" ? box.width / metrics.width : 1;
				// Text's SVG box includes ascent/advance whitespace; paths measure ink only.
				const target = {
					x: box.x - metrics.actualBoundingBoxLeft * scale,
					y: text.y.baseVal.getItem(0).value - metrics.actualBoundingBoxAscent,
					width: box.width - (metrics.width - metrics.actualBoundingBoxLeft - metrics.actualBoundingBoxRight) * scale,
					height: metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent,
				};
				if (!(target.width > 0 && target.height > 0)) throw new Error(`Cannot measure language label: ${value}`);
				const clone = text.cloneNode(true), size = parseFloat(style.fontSize);
				const width = Math.ceil(Math.max(256, box.width * 3 + 128)), height = Math.ceil(size * 6 + 64);
				clone.setAttribute("x", width / 2);
				clone.setAttribute("y", height / 2);
				clone.setAttribute("font-family", 'Arial, "Arial Unicode MS", sans-serif');
				clone.removeAttribute("textLength");
				clone.removeAttribute("lengthAdjust");
				clone.removeAttribute("transform");
				const markup = new XMLSerializer().serializeToString(clone);
				return [{ index, value, target, source: `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">${markup}</svg>` }];
			});
		} finally { holder.remove(); }
	}, svg);
	if (!labels.length) return svg;
	const executable = process.env.GUIDE_RSVG_CONVERT || "rsvg-convert";
	for (const label of labels) {
		const result = spawnSync(executable, ["--format=svg"], { input: label.source, encoding: "utf8", maxBuffer: 4 * 1024 * 1024 });
		if (result.error || result.status !== 0) throw new Error(`Cannot outline language label "${label.value}". Install rsvg-convert or set GUIDE_RSVG_CONVERT. ${result.error?.message || result.stderr.trim()}`);
		label.outline = result.stdout;
		delete label.source;
	}
	return page.evaluate(({ svg, labels }) => {
		const ns = "http://www.w3.org/2000/svg", parser = new DOMParser();
		const holder = document.createElement("div");
		holder.style.cssText = "position:fixed;left:-100000px;top:0;opacity:0;pointer-events:none";
		holder.innerHTML = svg;
		document.body.append(holder);
		try {
			const root = holder.querySelector("svg"), texts = [...root.querySelectorAll("text")];
			for (const { index, value, target, outline } of labels) {
				const document = parser.parseFromString(outline, "image/svg+xml");
				if (document.querySelector("parsererror, image, text, use, script, foreignObject") || !document.querySelector("path")) throw new Error(`No standalone glyph paths for language label: ${value}`);
				const replacement = root.ownerDocument.createElementNS(ns, "g");
				replacement.setAttribute("role", "img");
				replacement.setAttribute("aria-label", value);
				const title = replacement.appendChild(root.ownerDocument.createElementNS(ns, "title"));
				title.textContent = value;
				const paths = replacement.appendChild(root.ownerDocument.createElementNS(ns, "g"));
				for (const child of [...document.documentElement.children]) paths.appendChild(root.ownerDocument.importNode(child, true));
				texts[index].replaceWith(replacement);
				const box = paths.getBBox();
				if (!(box.width > 0 && box.height > 0)) throw new Error(`Empty glyph paths for language label: ${value}`);
				// One scale for both axes, from the width: the outline is drawn in
				// another font than the page's, so fitting each axis separately
				// squashes the letters. The ink's bottom sits where the page's does.
				const scale = target.width / box.width, bottom = target.y + target.height;
				paths.setAttribute("transform", `matrix(${scale} 0 0 ${scale} ${target.x - box.x * scale} ${bottom - (box.y + box.height) * scale})`);
			}
			return new XMLSerializer().serializeToString(root);
		} finally { holder.remove(); }
	}, { svg, labels });
}
