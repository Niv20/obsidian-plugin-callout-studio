import { sanitizeUserSvg } from "../../src/icons/svg";
import { isolateSvgCopy } from "../../src/icons/isolateSvg";

function check(value: unknown, message: string): asserts value {
	if (!value) throw new Error(message);
}

function clean(contents: string): SVGSVGElement {
	const result = sanitizeUserSvg(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">${contents}</svg>`);
	check(result, "Drawable SVG was rejected");
	const parsed = new DOMParser().parseFromString(result.svg, "image/svg+xml");
	const svg = document.importNode(parsed.documentElement, true) as unknown as SVGSVGElement;
	isolateSvgCopy(svg);
	document.body.appendChild(svg);
	return svg;
}

export function runSvgSecurityTests(): number {
	let checks = 0;
	for (const css of [
		'@\\69mport "https://example.invalid/audit.css";',
		'@IMPORT "https://example.invalid/audit.css";',
		'@page { size:1px 1px }',
		'@font-face { font-family:attack; src:url(https://example.invalid/font) }',
		'@media all { body { display:none } }',
	]) {
		const svg = clean(`<style onload="document.body.dataset.attacked='yes'">${css}</style><rect width="24" height="24"/>`);
		check(!svg.querySelector("style"), `Global rule survived: ${css}`);
		checks++;
	}
	for (const css of [
		'fill:u\\72l("https://example.invalid/paint")',
		'fill:URL("https://example.invalid/paint")',
		'fill:var(--remote)',
		'position:fixed; inset:0; background:url(https://example.invalid/image)',
	]) {
		const svg = clean(`<style>.st0{${css}}</style><rect class="st0" style="${css.replace(/"/g, "&quot;")}" width="24" height="24"/>`);
		check(!svg.querySelector("style"), `Unsafe stylesheet survived: ${css}`);
		check(!svg.querySelector("rect")?.hasAttribute("style"), `Unsafe style survived: ${css}`);
		checks++;
	}
	const outside = document.createElement("div");
	outside.className = "st0";
	document.body.appendChild(outside);
	const safe = clean('<defs><linearGradient id="grad"><stop stop-color="#ff0000"/></linearGradient></defs><style onload="document.body.dataset.attacked=\'yes\'">.st0{fill:#ff0000;stroke:rgb(0, 0, 255)}.gradient{fill:url(#grad)}</style><rect class="st0" width="10" height="10"/><rect class="gradient" width="10" height="10"/>');
	check(!safe.querySelector("style")?.hasAttribute("onload"), "Style event handler survived");
	check(getComputedStyle(safe.querySelector(".st0")!).fill === "rgb(255, 0, 0)", "Safe class color was lost");
	check(getComputedStyle(outside).fill !== "rgb(255, 0, 0)", "SVG selector escaped its copy");
	const gradientId = safe.querySelector("linearGradient")?.id;
	check(gradientId && safe.querySelector("style")?.textContent?.includes(`#${gradientId}`), "Gradient reference was not isolated");
	const foreign = clean('<style xmlns="http://www.w3.org/1999/xhtml">body{display:none}</style><rect width="24" height="24"/>');
	check(!foreign.querySelector("style"), "Foreign namespace style survived");
	check(document.body.dataset.attacked === undefined, "Event handler executed");
	return checks + 6;
}
