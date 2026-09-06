import { sanitizeUserSvg } from "../../src/icons/svg";
import { isolateSvgCopy } from "../../src/icons/isolateSvg";
import { renderIconInto } from "../../src/icons/renderIcon";
import { createIconResolver } from "../../src/icons/resolver";
import { CalloutRegistry } from "../../src/manager/CalloutRegistry";

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
	return checks + 6 + cachedSvgChecks();
}

/** Exercise saved data -> registry -> resolver -> the actual live DOM painter. */
function cachedSvgChecks(): number {
	const registry = new CalloutRegistry();
	registry.load({ iconSvgCache: [{
		pack: "material", name: "home", variant: "outlined|400",
		svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" onload="document.documentElement.dataset.csAudit=\'executed\'"><script>document.body.dataset.attacked="yes"</script><foreignObject><div xmlns="http://www.w3.org/1999/xhtml">outside</div></foreignObject><style>@\\69mport "https://example.invalid/cache.css";</style><path onclick="document.body.dataset.attacked=\'yes\'" d="M0 0L24 24"/></svg>',
	}] });
	const icon = { type: "material" as const, value: "home", style: "outlined" as const, weight: 400 };
	// Obsidian's convenience DOM method; parsing and painting remain native.
	const target = document.createElement("div");
	target.removeClass = (...names: string[]) => target.classList.remove(...names);
	document.body.appendChild(target);
	const resolver = createIconResolver(registry);
	check(resolver.resolveSvg(icon, "regular")?.includes("onload"), "Cache test did not reach the untrusted entry");
	const result = renderIconInto(target, icon, resolver, {
		role: "regular", fill: "currentColor", missing: { kind: "leave" },
	});
	check(result === "painted", "Safe cache geometry did not render");
	check(target.querySelector("path"), "Cache drawing was lost");
	check(!target.querySelector("[onload], [onclick], script, foreignObject, style"), "Active cached markup reached live DOM");
	registry.iconSvgCache[0]!.svg = "<svg><broken";
	check(renderIconInto(target, icon, resolver, {
		role: "regular", fill: "currentColor", missing: { kind: "leave" },
	}) === "skipped", "Malformed cache did not use the missing-artwork path");
	return 5;
}
