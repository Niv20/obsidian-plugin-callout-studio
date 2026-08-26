/**
 * manager/cssSnippetExport.ts — writes the user's callout styling into the
 * vault as a plain CSS snippet they can carry somewhere Callout Studio is not
 * installed (another vault, Obsidian Publish, a Digital Garden build).
 *
 * Sibling to `legacyStartupSnippet.ts`, and the distinction is the whole point.
 * Versions up to 2.5.0 wrote a snippet into this same folder *automatically*
 * and switched it on through `app.customCss` — which is what made it an orphan:
 * uninstalling left a file still styling the vault and a dangling name in
 * `appearance.json`. This one is written only when asked for, and never
 * enabled, so what it leaves behind is inert like any other export.
 *
 * Not enabling it is also what keeps it *correct*. The live sheet skips a
 * `.theme-dark` override whenever it would duplicate the unscoped rule (see
 * CSSInjector's explicit-undefined cascade), which is only sound inside one
 * self-consistent sheet. An enabled snippet is a second, frozen generation of
 * those rules, so a stale — and more specific — `.theme-dark` block would
 * outrank the fresh unscoped one for as long as the file sat there.
 *
 * What it emits: the global style block and the per-callout rules, both from
 * `CSSInjector`, so the snippet cannot drift from what the plugin draws. The
 * preamble wrapped around them, and the fingerprint that tells our file from a
 * hand-edited one, live in `cssSnippetFile.ts`.
 *
 * `standalone` drops what only means something while the plugin runs —
 * `.cs-heading-callout`, `.cs-inline-callout` and `.cs-ref-token` are classes
 * our own post-processors stamp, so nothing carries them once we are gone. The
 * fallback `:not()` catch-all is left out for a different reason: it chains
 * over every known id and would restyle callouts this export never touched.
 *
 * Two survivors that can look like oversights. Icon `::after` overrides stay
 * inside `@media screen`, so a non-Lucide icon prints as core's pencil: print
 * is served by the inline `<svg>` `paintIcon` bakes into the DOM, and that is
 * the one repair a stylesheet is structurally unable to make — CSS styles
 * elements, it never creates them — so the exported file cannot have it at any
 * price. Everything else print gets wrong IS pure CSS and does travel:
 * `printGradientCSS` is emitted here too. And `calloutColorValue` emits the
 * `--callout-color` format the *running* Obsidian
 * expects (a bare RGB triplet on ≤1.12, a color on 1.13+): right for this
 * vault, worth knowing before carrying the file to a much older one.
 */
import { normalizePath } from "obsidian";
import type { App } from "obsidian";
import { calloutSel } from "../utils/calloutSelector";
import { filterUsableCallouts } from "../utils/usableCallouts";
import type { CalloutDefinition } from "../types";
import type { CalloutRegistry } from "./CalloutRegistry";
import type { CSSInjector } from "./CSSInjector";
import {
	buildSnippetFile,
	classifyExisting,
	type Existing,
} from "./cssSnippetFile";

/** The snippet's filename, and so the name Obsidian shows in Appearance. */
export const SNIPPET_BASENAME = "callout-studio-custom";

/**
 * What one export did. `unchanged` is a real outcome, not a quiet success: it
 * means nothing was written, which is what keeps a repeated export from costing
 * a vault-sync event.
 */
export type SnippetExportOutcome =
	| { status: "created"; path: string }
	| { status: "updated"; path: string }
	| { status: "unchanged"; path: string }
	| { status: "empty" }
	| { status: "cancelled" }
	| { status: "failed" };

/** Structural on purpose: `SettingsTabPlugin` and a test double both satisfy it. */
export interface SnippetExportPlugin {
	registry: CalloutRegistry;
	cssInjector: CSSInjector;
	isKnownZeroUsageFallback(id: string): boolean;
}

/**
 * The undocumented corner of `app.customCss` needed to answer one question.
 * Optional throughout, like every other internal this plugin reads: if the
 * shape changes we report "not enabled", which is only ever a missing warning.
 */
interface CustomCssApi {
	enabledSnippets?: Set<string>;
}

/* --- What goes in the file ------------------------------------------------ */

/**
 * The callouts the snippet covers: the same set the JSON export carries, minus
 * discovered rows never adopted and written nowhere in the vault — those are
 * invisible in the user's own list, so rules for them would style something
 * they cannot see. Sorted by codepoint, never with a locale-aware comparator:
 * the file must come out byte-identical whatever language the UI is in.
 */
export function exportableDefinitions(
	plugin: SnippetExportPlugin,
): CalloutDefinition[] {
	const usable = filterUsableCallouts(
		plugin.registry.getExportableDefinitions(),
		(id) => plugin.isKnownZeroUsageFallback(id),
	);
	return usable.sort(byId);
}

const byId = (a: CalloutDefinition, b: CalloutDefinition): number =>
	a.id < b.id ? -1 : a.id > b.id ? 1 : 0;

/**
 * `--cs-accent` for the built-ins the user never touched.
 *
 * The global border is drawn in `color-mix(… var(--cs-accent, currentColor) …)`
 * and the live sheet defines that variable for every callout, because its
 * inject pass walks the whole registry. This export walks a subset, so without
 * these an untouched `[!note]` would fall through to `currentColor` and come
 * out grey. `ownAccentProps` points them at Obsidian's own `--callout-default`
 * and friends, so the target's theme still decides the hue — as the live sheet
 * does too.
 *
 * Only when a border is switched on, and light-mode only: through a core
 * variable the value is already the same in both themes.
 */
function supportAccentRules(plugin: SnippetExportPlugin): string[] {
	const { top, right, bottom, left } =
		plugin.registry.settings.globalStyle.borderSides;
	if (!(top || right || bottom || left)) return [];

	const rules: string[] = [];
	for (const def of [...plugin.registry.getBuiltIn()].sort(byId)) {
		if (plugin.registry.standsDown(def)) continue;
		if (!plugin.registry.isUnmodifiedBuiltIn(def)) continue;
		const props = plugin.cssInjector.ownAccentProps(def, "light");
		rules.push(`${calloutSel(def.id)} {\n${props.join("\n")}\n}`);
	}
	return rules;
}

/**
 * The stylesheet, without its header. Empty when no callout of the user's own
 * produced a rule — which covers having none at all *and* having handed every
 * one of them to the theme. Global style alone styles no callout in particular,
 * so a file holding only that is not worth putting in someone's vault.
 */
export function buildSnippetCss(plugin: SnippetExportPlugin): string {
	const callouts = exportableDefinitions(plugin)
		.map((def) => plugin.cssInjector.generateCalloutCSS(def, true))
		.filter((css) => css.trim());
	if (callouts.length === 0) return "";

	const parts = [
		plugin.cssInjector.generateGlobalStyleCSS(true),
		...supportAccentRules(plugin),
		...callouts,
	];
	return `${parts.filter((p) => p.trim()).join("\n\n")}\n`;
}

/* --- Writing it ----------------------------------------------------------- */

async function readExisting(app: App, path: string): Promise<Existing> {
	const adapter = app.vault.adapter;
	try {
		if (!(await adapter.exists(path))) return { kind: "missing" };
		return await classifyExisting(await adapter.read(path));
	} catch (e) {
		// Unreadable is not the same as absent: something is there, so ask
		// before replacing it.
		console.warn(`[CalloutStudio] could not read "${path}"`, e);
		return { kind: "foreign" };
	}
}

/** De-duplicates a double-click, so two clicks never race one write. */
let inFlight: Promise<SnippetExportOutcome> | null = null;

/**
 * Write the snippet, deciding deliberately what to do about whatever is already
 * at the path. Never throws: every failure comes back as an outcome. The CSS is
 * generated once, up front, so the file reflects the registry as it was when
 * the user clicked rather than as it may be several awaits later.
 *
 * `confirmOverwrite` is passed in rather than reached for, which is what lets
 * the tests drive the hand-edited branch without a modal.
 */
export function exportCssSnippet(
	app: App,
	plugin: SnippetExportPlugin,
	confirmOverwrite: () => Promise<boolean>,
): Promise<SnippetExportOutcome> {
	if (inFlight) return inFlight;
	const run = runExport(app, plugin, confirmOverwrite).finally(() => {
		inFlight = null;
	});
	inFlight = run;
	return run;
}

async function runExport(
	app: App,
	plugin: SnippetExportPlugin,
	confirmOverwrite: () => Promise<boolean>,
): Promise<SnippetExportOutcome> {
	const dir = normalizePath(`${app.vault.configDir}/snippets`);
	const path = normalizePath(`${dir}/${SNIPPET_BASENAME}.css`);

	let text: string;
	try {
		const body = buildSnippetCss(plugin);
		if (!body.trim()) return { status: "empty" };
		text = await buildSnippetFile(body);
	} catch (e) {
		console.warn("[CalloutStudio] could not build the CSS snippet", e);
		return { status: "failed" };
	}

	const existing = await readExisting(app, path);
	// Byte-identical: skip the write entirely. Every write to the vault is a
	// sync event, and re-exporting after no change should cost nothing.
	if (existing.kind === "ours" && existing.text === text) {
		return { status: "unchanged", path };
	}
	if (existing.kind === "foreign" && !(await confirmOverwrite())) {
		return { status: "cancelled" };
	}

	try {
		const adapter = app.vault.adapter;
		if (!(await adapter.exists(dir))) await adapter.mkdir(dir);
		await adapter.write(path, text);
	} catch (e) {
		console.warn(`[CalloutStudio] could not write "${path}"`, e);
		return { status: "failed" };
	}
	return {
		status: existing.kind === "missing" ? "created" : "updated",
		path,
	};
}

/**
 * Whether this snippet is switched on in this vault — which is worth telling
 * the user about, because the plugin already styles these callouts here and
 * the file will keep whatever styling it had at export time.
 *
 * Nothing here ever switches it on, yet this can be true on the first export
 * of a session, which reads as if something did: `enabledCssSnippets` is a list
 * of *names*, and nothing prunes a name whose file is gone. So enabling this
 * once, then deleting the file, gets it back live the moment an export
 * re-creates it — hence asking rather than inferring from "we just wrote it".
 */
export function isSnippetEnabled(app: App): boolean {
	const customCss = (app as App & { customCss?: CustomCssApi }).customCss;
	return customCss?.enabledSnippets?.has?.(SNIPPET_BASENAME) ?? false;
}
