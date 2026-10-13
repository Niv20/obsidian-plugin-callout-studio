import type { App, EventRef } from "obsidian";
import type { CalloutDefinition } from "../../types";
import { enabledSnippetCss, stylingSignature, themeCss } from "./customCssApi";
import type { ThemeCalloutStore } from "./ThemeCalloutStore";
import { ThemeAppearanceProbe } from "./ThemeAppearanceProbe";
import { ThemeClaimCheck } from "./ThemeClaimCheck";
import { syncThemeOverlayRows } from "./themeOverlayRows";
import type { ThemeAppearance } from "./themeAppearance";
import { obsidianCalloutAttrId } from "../../utils/calloutId";
import { isOwnCssChange } from "../ownCssChange";
import { QuietGate, type GateScheduler } from "../../utils/quietGate";

/**
 * `css-change` comes once for a theme switch and once per step while a slider
 * or a Style Settings colour is dragged. Re-reading what the theme draws is
 * done at once for the first event of a burst and once more when the burst has
 * been quiet this long, or has run this long, so a drag costs a pass or so a
 * second rather than one per step.
 */
const REREAD_QUIET_MS = 250;
const REREAD_MAX_MS = 2000;

/**
 * What a test swaps in; production passes nothing. The two DOM-reading halves
 * (what the theme draws, and whether it draws what it names) are the parts a
 * fake DOM cannot answer, and this file's subject is when they are asked.
 */
export interface ThemeSyncOptions {
	appearance?: Pick<ThemeAppearanceProbe, "ensure" | "results" | "invalidate" | "destroy">;
	claims?: Pick<ThemeClaimCheck, "invalidate" | "pageRootOff" | "unstyled" | "check" | "destroy">;
	schedule?: GateScheduler;
}

export interface ThemeSyncHost {

	app: App;
	registry: {
		settings: { fallbackCalloutId: string };
		onPreviewChange(callback: () => void): void;
		offPreviewChange(callback: () => void): void;
		batch<T>(body: () => T): T;
		setThemeOwnedIds(ids: ReadonlySet<string>): boolean;
		getAll(): CalloutDefinition[];
		get(id: string): CalloutDefinition | undefined;
		add(def: CalloutDefinition): boolean;
		remove(id: string): boolean;
		vaultIdFormsFor(def: CalloutDefinition): string[];
		setThemeAppearances(
			map: ReadonlyMap<string, ThemeAppearance>,
		): boolean;
		themeOwns(def: CalloutDefinition): boolean;
	};
	cssInjector: {
		themeCallouts(): ThemeCalloutStore;
		inject(emitCssChange?: boolean): void;
		suspendOwnStyles(): () => void;
	};
	registerEvent(ref: EventRef): void;

	register(cb: () => void): void;
}

/**
 * Keep the registry's two derived theme facts - who owns which id, and what
 * the theme draws for it - true to the page, and re-read them when it moves.
 *
 * ## What one `css-change` costs, and why it is small
 *
 * Obsidian fires `css-change` for a theme switch and for a font-size step
 * alike, and a drag fires one per step. So the handler distinguishes a
 * *restyle* (the theme or snippet text moved: everything is re-derived, the
 * old readings are dropped and the theme is read again at once) from a
 * *nudge* from outside (same text: the readings on hand stay, and the re-read
 * is folded into one per burst by a `QuietGate`). Only a move is announced,
 * and an announcement of a theme fact does not save `data.json`
 * (`RegistryChange.persists`). This plugin's own `css-change` is neither: it
 * re-reads at once, as it always did.
 *
 * Measured per event in Obsidian 1.14.4, on a note of sixty callouts open in
 * Reading view and Live Preview and a 1.2 MB `data.json`, where core alone
 * spends 13 ms on an event: a theme that draws nine of the callouts went from
 * about 320 ms to 19 ms, and Serenity, which owns ninety-five types, from about
 * 540 ms to 73 ms. The full table, and what is left of Serenity's, is in
 * `docs/internals-docs/18-theme-callout-discovery.md`.
 *
 * ## Why the chain terminates
 *
 * The handler injects, an inject that changes the generated text emits this
 * plugin's own `css-change`, and that is heard here too. Every hop stands on a
 * comparison that goes quiet: ownership is announced only when the set moved
 * (`ThemeFacts.setOwnedIds`), readings only when they differ
 * (`setAppearances`), and `CSSInjector.inject` emits only when the text it
 * generated differs from what is installed. The generated text depends on
 * ownership but never on the readings, so a published reading cannot emit a
 * `css-change` at all, and an ownership change emits exactly one, whose
 * handler finds the theme text unchanged and the set already published.
 */
export function registerThemeAppearance(
	host: ThemeSyncHost,
	options: ThemeSyncOptions = {},
): () => void {

	const appearance = options.appearance ?? new ThemeAppearanceProbe(host.app);
	const claims = options.claims ?? new ThemeClaimCheck(host.app);
	host.register(() => {
		appearance.destroy();
		claims.destroy();
	});
	let signature: string | null = null;

	const fingerprint = (): string =>
		JSON.stringify([stylingSignature(host.app), themeCss(host.app), enabledSnippetCss(host.app)]);
	// What the theme names, less what it names only behind a page condition
	// that is off right now — see ThemeClaimCheck.
	const declared = (): ReadonlySet<string> => {
		const named = host.cssInjector.themeCallouts().themeDefinedIds();
		const off = claims.pageRootOff(named);
		return off.size === 0 ? named : new Set([...named].filter((id) => !off.has(id)));
	};
	// Every attribute form of the callouts whose design is lost if the theme is
	// wrongly said to own them: built-ins, the user's own, and those another
	// plugin made. A saved scan row is a copy of the fallback's look, often of a
	// type the theme draws only in context (Ukiyo's `col` inside a `cont`), so
	// it stays as it was.
	const ownForms = (): Set<string> => {
		const out = new Set<string>();
		for (const def of host.registry.getAll()) {
			if (!def.builtIn && def.source !== "user" && def.source !== "plugin") continue;
			for (const form of host.registry.vaultIdFormsFor(def)) {
				out.add(obsidianCalloutAttrId(form));
			}
		}
		return out;
	};
	const syncRows = (): number => {
		const named = declared();
		const own = ownForms();
		return syncThemeOverlayRows(
			host.registry,
			named,
			claims.unstyled([...named].filter((id) => own.has(id))),
		);
	};
	/**
	 * Whether the theme or the enabled snippets are other than the last time
	 * this ran, dropping the cached scan when they are. It is also how a
	 * `css-change` that moved nothing of ours - a font-size step, a dragged
	 * Style Settings colour - is told from one that did.
	 */
	const restyled = (force = false): boolean => {
		const next = fingerprint();
		if (!force && next === signature) return false;
		signature = next;
		host.cssInjector.themeCallouts().invalidate();
		return true;
	};
	const sweep = (force = false): void => {
		restyled(force);
		// The stylesheet can stay the same while a reset, import or closed
		// draft releases an id. Reconcile rows using the cached CSS scan.
		syncRows();
	};

	const probe = (): void => {
		const owned = host.registry.getAll().filter((def) =>
			host.registry.themeOwns(def),
		);
		void appearance.ensure(
			owned.flatMap((def) => host.registry.vaultIdFormsFor(def)),
			() => {
				// Publish, and regenerate only for what moved: readings equal
				// to the ones on hand are not an event, and the CSS they would
				// regenerate was written by the `css-change` that started this.
				if (host.registry.setThemeAppearances(appearance.results())) {
					host.cssInjector.inject(false);
				}
			},
		);
	};

	// Measure whether the theme really draws the callouts of ours it names,
	// and hand back the ones it does not. Publishing the new ownership is a
	// registry change, which injects; the css-change that inject fires is this
	// plugin's own and does not start another check, so this cannot cycle.
	const checkClaims = (): void => {
		const own = ownForms();
		void claims.check({
			ids: [...declared()].filter((id) => own.has(id)),
			suspendStudioCss: () => host.cssInjector.suspendOwnStyles(),
			onChange: () => {
				syncRows();
				probe();
			},
		});
	};

	// Re-reading what the theme draws is two questions - the probe's "what does
	// it look like" and the claim check's "does it draw what it names" - and
	// neither has anything new to say at every step of a drag. A nudge from
	// outside only marks them owed; the gate runs them at once for the first of
	// a burst and again when it ends. `nudged` is the invalidation still to be
	// applied, kept out of the handler so a folded event cannot discard a pass
	// that is already in flight.
	let nudged = false;
	let claimsOwed = false;
	const reread = (): void => {
		if (nudged) {
			nudged = false;
			appearance.invalidate({ keepAnswers: true });
		}
		probe();
		if (claimsOwed) {
			claimsOwed = false;
			claims.invalidate();
			checkClaims();
		}
	};
	const rereadGate = new QuietGate(reread, REREAD_QUIET_MS, REREAD_MAX_MS, options.schedule);
	host.register(() => rereadGate.destroy());

	// Closing an unsaved draft can release a newly theme-owned id without
	// changing generated CSS (for example with the fallback disabled).
	const previewChanged = (): void => { if (syncRows() > 0) probe(); };
	host.registry.onPreviewChange(previewChanged);
	host.register(() => host.registry.offPreviewChange(previewChanged));

	sweep(true);
	claimsOwed = true;
	rereadGate.request(true);

	const resweep = (): void => {
		sweep(true);
		claimsOwed = true;
		rereadGate.request(true);
	};
	host.registerEvent(
		host.app.workspace.on("css-change", (data?: unknown) => {
			// The claim check switches this plugin's CSS off while it measures,
			// so this plugin's own CSS moving cannot change a verdict.
			const theirs = !isOwnCssChange(data);
			let restyledNow = false;
			host.registry.batch(() => {
				restyledNow = restyled();
				if (restyledNow) {
					// A different theme or snippet text: nothing measured
					// under the old one is true, and the rows repaint before
					// the new readings can land, so none may be published.
					appearance.invalidate();
					nudged = false;
					host.registry.setThemeAppearances(new Map());
					if (theirs) claims.invalidate();
				}
				syncRows();
			});
			if (theirs) claimsOwed = true;
			// The same styling nudged from outside (a size, an accent, a mode,
			// an option): the readings on hand are this theme's own, and the
			// pass that follows replaces them. Clearing first only flashed
			// placeholders and announced the same readings twice, and a drag
			// asks this once per step - so it is folded, and its invalidation
			// is applied when the pass runs, not now.
			const nudge = theirs && !restyledNow;
			if (nudge) {
				nudged = true;
			} else if (!restyledNow) {
				// Our own css-change: re-read at once, as it always did. The
				// invalidation made here covers any a folded step still owed.
				nudged = false;
				appearance.invalidate({ keepAnswers: true });
			}
			host.cssInjector.inject(false);
			rereadGate.request(!nudge);
		}),
	);
	return resweep;
}
