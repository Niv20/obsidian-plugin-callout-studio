/** 04B keeps the original storefront backdrop and places two source-rendered windows in it. */
import { compose } from "./composition.mjs";

function vectorContent(svg, prefix) {
	const dimensions = /viewBox="0 0 ([\d.]+) ([\d.]+)"/.exec(svg);
	if (!dimensions) throw new Error("Source window needs a numeric viewBox");
	const content = svg.replace(/^<svg\b[^>]*>/, "").replace(/<\/svg>\s*$/, "")
		.replace(/\bid="([^"]+)"/g, (_, id) => `id="${prefix}-${id}"`)
		.replace(/url\(#([^)]+)\)/g, (_, id) => `url(#${prefix}-${id})`)
		.replace(/\bhref="#([^"]+)"/g, (_, id) => `href="#${prefix}-${id}"`);
	return { content, width: Number(dimensions[1]), height: Number(dimensions[2]) };
}

export function compose04B(pickerSvg, librariesSvg) {
	const picker = vectorContent(pickerSvg, "04B-picker");
	const libraries = vectorContent(librariesSvg, "04B-libraries");
	const description = "Pick an icon and Manage icon libraries, with all nine icon libraries available and the requested order.";
	const scaffold = compose("04-icons", '<svg viewBox="0 0 1 1"></svg>', { description });
	const marker = '<g transform="translate(';
	const at = scaffold.lastIndexOf(marker);
	if (at < 0) throw new Error("Could not locate the storefront scene slot");
	let svg = scaffold.slice(0, at);
	// Both windows share the same top and bottom. The management window is
	// slightly narrower, while the icon picker keeps almost its original size.
	const top = 110, height = 664, gap = 18;
	const pickerScale = height / picker.height;
	const librariesScale = height / libraries.height;
	const totalWidth = picker.width * pickerScale + gap + libraries.width * librariesScale;
	if (totalWidth > 1120) throw new Error(`04B windows exceed frame width: ${totalWidth}`);
	const left = 600 - totalWidth / 2;
	const right = left + picker.width * pickerScale + gap;
	svg += `<g transform="translate(${left} ${top}) scale(${pickerScale})">${picker.content}</g>`;
	svg += `<g transform="translate(${right} ${top}) scale(${librariesScale})">${libraries.content}</g>`;
	svg += '</svg>\n';
	if (/\b(?:NaN|Infinity)\b/.test(svg)) throw new Error("Invalid 04B geometry");
	return svg;
}
