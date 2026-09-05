/**
 * api/PluginAPI.ts — Public API surface for other Obsidian plugins.
 *
 * Exposed at `app.plugins.plugins['callout-studio'].api`. Read-only: it answers
 * "which callouts exist, what are they called, and tell me when that changes".
 * Writing a callout into a note is the caller's job — it is one line of markdown
 * and every plugin wants to place it differently.
 *
 * Everything handed out is a frozen copy built by the mappers at the bottom of
 * this file, never a live `CalloutDefinition`. The registry stores real objects
 * that the renderer reads on every paint; letting a consumer hold one meant a
 * stray assignment could change styling with no re-inject and no save.
 *
 * That is also why the plugin handle is a `#private` field and the list builder
 * is a module-level function rather than a method. TypeScript's `private` is a
 * compile-time keyword: `constructor(private readonly plugin)` compiles to
 * `this.plugin = plugin`, so it put the whole plugin — `registry.update()`,
 * `registry.remove()`, `settings`, every live definition — one property access
 * away from any consumer holding the api object. `#` is a runtime private, and
 * a module-level function is on no object at all, which is what makes the
 * documented five members the *only* five that exist.
 *
 * Reads committed definitions from CalloutRegistry, including manual results.
 */
import type CalloutStudioPlugin from "../main";
import type { CalloutDefinition, CalloutIcon } from "../types";
import type {
	Callout,
	CalloutDetails,
	CalloutIconInfo,
	CalloutStudioApi,
} from "./types";
import { getLocale } from "../i18n";
import {
	committedDefinitions,
} from "../utils/usableCallouts";
import { normalizeCalloutId } from "../utils/calloutId";
import { sortCalloutsByDisplayName } from "../utils/sorting";

export class CalloutStudioAPI implements CalloutStudioApi {
	readonly version = 1;

	/** Real ECMAScript privacy — see the file header for why it has to be. */
	readonly #plugin: CalloutStudioPlugin;

	constructor(plugin: CalloutStudioPlugin) {
		this.#plugin = plugin;
	}

	getCallouts(): readonly Callout[] {
		return Object.freeze(usableDefinitions(this.#plugin).map(toCallout));
	}

	getCalloutsDetailed(): readonly CalloutDetails[] {
		const dark = isDarkMode();
		return Object.freeze(
			usableDefinitions(this.#plugin).map((def) =>
				toDetails(
				def,
				dark,
				this.#plugin.registry.standsDown(def),
				this.#plugin.registry.themeOwns(def),
			),
			),
		);
	}

	getCallout(id: string): Callout | undefined {
		const { registry } = this.#plugin;
		const wanted = normalizeCalloutId(id);
		// The first three rungs of resolveCalloutDef — id, then alias, then the
		// dashed `data-callout` spelling. Deliberately NOT the fourth: the
		// renderer substitutes the fallback callout for an unknown id because it
		// still has to draw something, but an API that answered every id with a
		// definition would be useless for asking whether one exists.
		const resolved =
			registry.get(wanted) ??
			registry.findByAlias(wanted) ??
			registry.findByAttrId(wanted);
		if (!resolved) return undefined;
		// Re-find it in the published list rather than returning `resolved`
		// directly. That list is the one filtered view: it hides the transient
		// live-preview row and unused discovered callouts, and where a preview
		// shadows a real callout it substitutes the committed one back. Matching
		// by id rather than by identity is what makes that substitution work —
		// `resolved` here is often the preview stand-in itself.
		const published = usableDefinitions(this.#plugin).find(
			(def) => def.id === resolved.id,
		);
		return published ? toCallout(published) : undefined;
	}

	onChange(callback: () => void): () => void {
		this.#plugin.registry.onChange(callback);
		return () => this.#plugin.registry.offChange(callback);
	}
}

/**
 * Every callout a user could write today, in display order.
 *
 * `getBuiltIn()` and `getUserDefined()` both read through the registry's
 * list view, so their union already excludes the settings live-preview
 * placeholder. Between them they cover all five sources — the built-ins are
 * seeded into the registry on every load, so all of Obsidian's own types are
 * here whether or not the user has ever touched them.
 *
 * Auto-discovered rows are then dropped unless they are customized or still
 * used somewhere in the vault. Discovery creates one for every `[!id]` it
 * has ever seen, so without this a consumer building a command per callout
 * would offer a list full of ids the user deleted from their notes hours
 * ago. Same predicate the autocomplete dropdown uses, for the same reason.
 *
 * Every row is then read through `getReal`, which is what makes the list
 * *committed* state. The registry's list view hides a preview that occupies a
 * fresh id, but a preview standing in for a callout the user already has passes
 * through as-is — deliberately, because the settings rows are supposed to track
 * the open editor keystroke by keystroke. An outside consumer is not: a preview
 * fires no `onChange`, so a consumer that happens to re-read the list during
 * that window (any unrelated mutation will make it) caches a title the user may
 * then cancel, and hears nothing when they do. `getReal` hands back the row the
 * preview shadows, so the API answers with what is saved.
 *
 * A module-level function, not a method: a `private` method is an ordinary
 * prototype member at runtime, and this file's whole job is that nothing
 * beyond the documented five is reachable.
 */
const usableDefinitions = (plugin: CalloutStudioPlugin): CalloutDefinition[] => {
	const { registry } = plugin;
	const committed = committedDefinitions(registry).map(
		(def) => registry.getReal(def.id) ?? def,
	);
	const defs = committed;
	return sortCalloutsByDisplayName(defs, getLocale());
};

/** Whether the window is currently showing the dark theme. */
const isDarkMode = (): boolean =>
	activeDocument.body.classList.contains("theme-dark");

const toIconInfo = (icon: CalloutIcon): CalloutIconInfo => {
	const info: {
		pack: string;
		name: string;
		style?: string;
		weight?: number;
	} = {
		// `value` is stored in whatever spelling its pack expects — for Lucide
		// that is exactly what Obsidian's own `setIcon()` takes, prefix or not.
		pack: icon.type,
		name: icon.value,
	};
	if (icon.style) info.style = icon.style;
	if (icon.weight !== undefined) info.weight = icon.weight;
	return Object.freeze(info);
};

const toCallout = (def: CalloutDefinition): Callout =>
	Object.freeze({
		id: def.id,
		title: def.displayName,
		aliases: Object.freeze([...(def.aliases ?? [])]),
	});

const toDetails = (
	def: CalloutDefinition,
	dark: boolean,
	// Both resolved by the registry rather than read off the definition. The
	// stored `externalStyle` field answers only half of `standsDown`, and
	// nothing on the row records theme ownership at all — it is derived from
	// the active theme's stylesheet. See `CalloutRegistry.themeOwns`.
	standsDown: boolean,
	themeStyled: boolean,
): CalloutDetails => {
	const details: {
		-readonly [K in keyof CalloutDetails]: CalloutDetails[K];
	} = {
		...toCallout(def),
		color: dark ? def.colorDark : def.colorLight,
		colorLight: def.colorLight,
		colorDark: def.colorDark,
		icon: toIconInfo(def.icon),
		hideIcon: def.hideIcon === true,
		foldable: def.foldable,
		defaultFolded: def.defaultFolded,
		builtIn: def.builtIn,
		source: def.source,
		externalStyle: standsDown,
		themeStyled,
	};
	// Left absent rather than set to undefined: "no authored background" is a
	// real state that means Obsidian's own tint applies, and a consumer using
	// `in` or `Object.keys` should be able to tell the two apart.
	if (def.bgColorLight) details.bgColorLight = def.bgColorLight;
	if (def.bgColorDark) details.bgColorDark = def.bgColorDark;
	if (def.textColorLight) details.textColorLight = def.textColorLight;
	if (def.textColorDark) details.textColorDark = def.textColorDark;
	return Object.freeze(details);
};
