import { harness, themedHarness, definition } from "../support/cssInjectorHarness";
import { FALLBACK_ICON_SENTINEL } from "../../src/manager/css/calloutIconProp";

function check(condition: unknown, message: string): asserts condition {
	if (!condition) throw new Error(message);
}

/** Exercise the browser's actual cascade, including source order and dark mode. */
export function runFallbackCascadeTests(): number {
	return runFallbackCascadeCase(false) + runFallbackCascadeCase(true);
}

function runFallbackCascadeCase(triplet: boolean): number {
	Object.assign(globalThis, { activeDocument: document, activeWindow: window,
		__CS_ICON_IDS__: ["lucide-pencil", "lucide-star", "pencil", "star"] });
	const color = triplet ? "rgb(var(--callout-color))" : "var(--callout-color)";
	const { registry, css } = triplet
		? themedHarness(`.callout { color: ${color}; background-color: rgba(var(--callout-color), 0.1); }`)
		: harness();
	const fallback = definition({ id: "fallback-template", icon: { type: "emoji", value: "🌱" },
		colorLight: "#ff0000", colorDark: "#0000ff" });
	const owned = definition({ id: "owned", colorLight: "#aa0000", colorDark: "#0000aa",
		aliases: Array.from({ length: 200 }, (_, i) => `owned-alias-${i}`) });
	const hostile = definition({ id: 'quoted"tail\\', colorLight: "#009900", colorDark: "#008800" });
	registry.add(fallback); registry.add(owned); registry.add(hostile);
	registry.settings.fallbackCalloutId = fallback.id;
	registry.settings.globalStyle.borderRadius = 28;
	registry.settings.globalStyle.borderWidth = 7;
	registry.setThemeOwnedIds(new Set(["note"]));
	const base = document.createElement("style");
	base.textContent = `
		.callout { --callout-color: ${triplet ? "85, 85, 85" : "#555555"}; --callout-icon: lucide-pencil;
			color: ${color}; border: 0 solid currentColor; border-radius: 4px;
			background-color: color-mix(in srgb, ${color} 10%, transparent); }
		.callout-title { display: flex; }
	`;
	document.head.appendChild(base);
	const snippet = document.createElement("style");
	snippet.textContent = `
		.callout[data-callout="snippet-card"], .callout[data-callout="owned"] {
			--callout-color: ${triplet ? "34, 170, 85" : "#22aa55"}; --callout-icon: lucide-star;
			border-radius: 33px; border: 2px dotted #123456; background-color: #fafafa;
		}
	`;
	document.head.appendChild(snippet);
	const studio = document.createElement("style");
	studio.textContent = [css.generateGlobalStyleCSS(), css.generateCalloutCSS(fallback),
		css.generateCalloutCSS(owned), css.generateCalloutCSS(hostile), css.generateFallbackCSS(registry.getAll())].join("\n");
	document.head.appendChild(studio);
	const make = (id: string) => {
		const el = document.createElement("div"); el.className = "callout";
		el.dataset.callout = id;
		const title = document.createElement("div"); title.className = "callout-title";
		const icon = document.createElement("div"); icon.className = "callout-icon";
		title.appendChild(icon); el.appendChild(title); document.body.appendChild(el);
		return el;
	};
	const external = make("snippet-card");
	const managed = make("owned");
	const alias = make("owned-alias-199");
	const escaped = make(hostile.id);
	const plain = make("unknown");
	const theme = make("note");
	let checks = 0;
	for (const dark of [false, true]) {
		document.body.className = dark ? "theme-dark" : "theme-light";
		const s = getComputedStyle(external);
		check(s.color === "rgb(34, 170, 85)", `Snippet color lost in ${dark ? "dark" : "light"} mode`);
		check(s.getPropertyValue("--cs-accent").replace(/\s/g, "") === (triplet ? "rgb(34,170,85)" : "#22aa55"), "Derived accent ignores winning snippet variable");
		check(s.getPropertyValue("--callout-icon").trim() === "lucide-star", "Snippet icon lost");
		check(s.borderRadius === "33px" && s.borderTopWidth === "2px", "Studio global geometry leaked onto unknown id");
		check(s.backgroundColor === "rgb(250, 250, 250)", "Snippet background lost");
		check(getComputedStyle(managed).color === (dark ? "rgb(0, 0, 170)" : "rgb(170, 0, 0)"), "Registered Studio color lost");
		check(getComputedStyle(alias).color === getComputedStyle(managed).color, "Known alias caught by fallback");
		check(getComputedStyle(escaped).color === (dark ? "rgb(0, 136, 0)" : "rgb(0, 153, 0)"), "Quoted or backslashed id broke a selector list");
		check(getComputedStyle(managed).borderRadius === "28px", "Registered global geometry missing");
		check(getComputedStyle(plain).borderRadius === "4px", "Unknown id received Studio global geometry");
		check(getComputedStyle(theme).borderRadius === "4px", "Theme-owned id received Studio global geometry");
		checks += 11;
	}
	snippet.remove();
	for (const dark of [false, true]) {
		document.body.className = dark ? "theme-dark" : "theme-light";
		const s = getComputedStyle(external);
		check(s.color === (dark ? "rgb(0, 0, 255)" : "rgb(255, 0, 0)"), "Disabling snippet did not restore fallback color");
		check(s.getPropertyValue("--callout-icon").trim() === FALLBACK_ICON_SENTINEL, "Fallback artwork did not regain its slot");
		checks += 2;
	}
	for (const el of [external, managed, alias, escaped, plain, theme, base, studio]) el.remove();
	return checks;
}
