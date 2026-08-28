/**
 * constants.ts — Global constants and plugin defaults.
 *
 * Exports compile-time constants (MAX_TAG_LENGTH, HEAVY_VAULT_FILE_THRESHOLD,
 * PLUGIN_ICON_ID) and DEFAULT_SETTINGS. The 13 built-in callout definitions
 * they used to sit beside now live in `defaultCallouts.ts`.
 * Imported by CalloutRegistry (for defaults), main.ts (for threshold checks),
 * and several utility/settings modules.
 */
import type {
	CalloutIcon,
	CalloutRenderRole,
	ContextMenuItemConfig,
	GlobalStyleSettings,
	PluginSettings,
} from "./types";

/**
 * The 13 built-ins now live in their own module — this file was carrying the
 * plugin's constants and a 159-line data table at once. Re-exported here so the
 * registry, the discovered-row builder and the suites keep one import path.
 */
export { DEFAULT_CALLOUTS } from "./defaultCallouts";

/**
 * Generous safety cap on callout-ID length, applied only when validating
 * imported JSON (untrusted data). The editor itself enforces no length limit —
 * long IDs are truncated with an ellipsis in the UI and shown in full on hover.
 */
export const MAX_TAG_LENGTH: number = 200;

/** Maximum number of IDs (aliases) allowed per callout */
export const MAX_TAGS_COUNT: number = 4;

/**
 * The Lucide id that stands for Callout Studio itself.
 *
 * Named once because two surfaces wear it and they must not drift: the welcome
 * splash's hero mark and the left-ribbon button. The plugin registers no icon
 * of its own with `addIcon()` — this is a stock Obsidian glyph, so it needs no
 * asset, costs no bytes and follows the theme.
 */
export const PLUGIN_ICON_ID = "paintbrush";

/**
 * Placeholder callout ID the editor's live preview renders under while the
 * callout being created has no ID yet (empty name). Once the user types one,
 * the preview switches to the real ID being edited.
 *
 * Reserved rather than readable, and that is the whole point. The registry's
 * preview slot feeds `getAll()`, which is what CSSInjector generates from, and
 * the `isDemo` flag only keeps the row out of the settings lists — it never
 * reaches the injector. So this id is globally restyled for as long as the
 * modal sits in its empty state, which is why it must be one nothing here ships
 * and `generateId` would not plausibly produce. It used to be `example`, a
 * built-in every vault has, so every real `[!example]` note repainted behind
 * the modal. The name the user actually sees is `editor.untitledCallout`, so
 * the id itself is all but invisible.
 */
export const PREVIEW_PLACEHOLDER_ID = "new-callout-preview";

/**
 * Reserved id for the neutral demo callout the per-role style popups and the
 * welcome splash render. Reserved as {@link PREVIEW_PLACEHOLDER_ID} is and for
 * its reason: it reaches `getAll()`, so a modal restyles it vault-wide.
 *
 * It lives here rather than beside either of its two users because
 * `RESERVED_DEMO_IDS` below has to be readable from `manager/` and `utils/`,
 * and neither may import a settings modal.
 */
export const STYLE_DEMO_ID = "global-style-demo";

/**
 * The ids that exist only to be previewed, and must therefore never become a
 * callout the user can reach.
 *
 * The `isDemo` flag on the registry's preview slot keeps a demo out of the
 * settings lists, but only for as long as a modal holds it — and it was never
 * the whole story anyway, since `getAll()` (autocomplete, discovery's known-id
 * set) reads straight past it. These ids are unreachable *permanently*: a note
 * that happens to write `[!global-style-demo]` must not mint a row, an import
 * must not carry one in, and neither may ever be offered or exported.
 *
 * Both are spelled with a dash, which `sanitizeCalloutIdInput` never produces,
 * so the editor cannot mint one either — that is what keeps the preview slot's
 * `previewShadowedDef` null and its list filter honest.
 */
export const RESERVED_DEMO_IDS: ReadonlySet<string> = new Set([
	PREVIEW_PLACEHOLDER_ID,
	STYLE_DEMO_ID,
]);

/**
 * The id the welcome splash's three examples are written with.
 *
 * **Deliberately absent from {@link RESERVED_DEMO_IDS}, and that is the whole
 * point of it being its own constant.** The splash sample is copy the user
 * reads — `> [!global-style-demo]` puts plumbing in the middle of the one
 * screen that is supposed to teach the syntax — so this one is spelled the way
 * a person would write it.
 *
 * The cost of that is precisely what reserving buys, and it is not worth
 * paying: `demo` is a plain word, so `sanitizeCalloutIdInput` DOES produce it
 * (`"Demo"` → `demo`) and a user may legitimately own a callout with this id.
 * Reserving it would then filter *their* callout out of the autocomplete, drop
 * it from their exports and make their own file fail to re-import — silently,
 * because nothing in the editor tells them the name is taken. A reserved id
 * has to be one nobody can reach, and this is not one.
 *
 * What stands in for reservation is that this definition only exists **while
 * the splash is open**, which is all the isolation it actually needs:
 * `setPreviewDefinition(def, isDemo)` never persists, never notifies, and
 * `definitionsForLists()` hides it from every settings list; if the user *does*
 * own a real `demo`, the preview slot shadows it and hands the real row back on
 * close (see `previewShadowedDef`). The one residue is cosmetic and transient —
 * their own `[!demo]` callouts in a note behind the modal repaint violet until
 * it closes.
 */
export const WELCOME_DEMO_ID = "demo";

/**
 * First-run vault-scan threshold (number of markdown files).
 *
 * On the very first plugin install:
 * - If `vault.getMarkdownFiles().length < HEAVY_VAULT_FILE_THRESHOLD` →
 *   the vault is auto-scanned silently in the background (a Notice is
 *   shown when callouts are found).
 * - If `>= HEAVY_VAULT_FILE_THRESHOLD` → a one-time modal asks the user
 *   whether to scan now or skip (they can always run it later from
 *   Settings → Vault insights & maintenance → Re-scan vault).
 *
 * Tweak this value while testing to see both UX paths. Purely a UI/UX
 * threshold — does not affect what the scan itself does.
 */
export const HEAVY_VAULT_FILE_THRESHOLD: number = 500;

/**
 * The icon a callout gets when the import it came from named one that does not
 * exist — a typo in hand-edited JSON, or a Callout Manager paste referring to an
 * icon this Obsidian does not ship.
 *
 * Lucide, because it is the only pack that needs no download and so is certain
 * to draw; `pencil` for the same reason `CSSInjector` uses it as the first-paint
 * placeholder. Deliberately a visible, ordinary icon rather than a warning
 * glyph: the import report already says which name was wrong, and the callout
 * itself is fine.
 */
export const FALLBACK_ICON: CalloutIcon = Object.freeze({
	type: "lucide",
	value: "lucide-pencil",
});

/**
 * The Obsidian CSS variable each built-in takes its accent from.
 *
 * These are core's own names, defined on `body` in `app.css`, and they are what
 * a theme redefines when it restyles callouts. `CSSInjector` hands an untouched
 * built-in this variable instead of a baked hex, so the plugin's own surfaces
 * (heading callouts, inline callouts, borders, icon tints) follow whatever the active
 * theme paints rather than pinning Material colours over it.
 *
 * `note` has no rule of its own in `app.css` — it falls through to the base
 * `.callout` rule — so it maps to `--callout-default` like every unrecognized
 * type. Aliases are deliberately absent: they resolve to their parent's
 * definition long before this map is read.
 */
export const OBSIDIAN_CALLOUT_VAR: Readonly<Record<string, string>> =
	Object.freeze({
		note: "--callout-default",
		abstract: "--callout-summary",
		info: "--callout-info",
		todo: "--callout-todo",
		tip: "--callout-tip",
		success: "--callout-success",
		question: "--callout-question",
		warning: "--callout-warning",
		failure: "--callout-fail",
		danger: "--callout-error",
		bug: "--callout-bug",
		example: "--callout-example",
		quote: "--callout-quote",
	});

/**
 * Default right-click menu layout per render role. Array order = menu order.
 * The settings loader merges saved lists against these (unknown ids dropped,
 * newly introduced ids appended), so extending a list here is upgrade-safe.
 */
export const DEFAULT_CONTEXT_MENU_ITEMS: Record<
	CalloutRenderRole,
	ContextMenuItemConfig[]
> = {
	regular: [
		{ id: "copyMarkdown", enabled: true },
		{ id: "foldDefaults", enabled: true },
		{ id: "edit", enabled: true },
		{ id: "openSettings", enabled: true },
	],
	heading: [
		{ id: "cutSection", enabled: true },
		{ id: "copySection", enabled: true },
		{ id: "deleteSection", enabled: true },
		{ id: "edit", enabled: true },
		{ id: "openSettings", enabled: true },
	],
	inline: [
		{ id: "edit", enabled: true },
		{ id: "openSettings", enabled: true },
	],
};

export const DEFAULT_SETTINGS: PluginSettings = {
	globalStyle: {
		borderSides: { top: false, right: false, bottom: false, left: false },
		borderWidth: 2.5,
		titleScale: 1,
		contentScale: 1,
		borderRadius: 4,
		alignContentWithTitle: false,
		heading: {
			borderSides: {
				top: false,
				right: false,
				bottom: false,
				left: false,
			},
			borderWidth: 1.5,
			borderRadius: 4,
			// Equal top/bottom spacing so the heading text sits vertically
			// centered in the bar (overriding Obsidian's editor padding that
			// pushes heading text toward the bottom).
			paddingTop: 0.25,
			paddingBottom: 0.25,
			// Extra gap above each heading callout (em). 0 → keep the theme's own
			// heading spacing untouched; raising it separates stacked/collapsed
			// heading callouts that otherwise render glued together. Defaults to
			// a gentle half-em so stacked heading callouts read as distinct out
			// of the box; users can zero it to fall back to theme spacing.
			marginTop: 0.5,
		},
		inline: {
			borderSides: {
				top: false,
				right: false,
				bottom: false,
				left: false,
			},
			borderWidth: 1.5,
			// ≈1em at the pill's 0.9em font size → keeps the default pill shape.
			borderRadius: 16,
			fontScale: 1,
		},
	} satisfies GlobalStyleSettings,
	contextMenu: {
		enabled: true,
		items: DEFAULT_CONTEXT_MENU_ITEMS,
	},
	autocomplete: {
		enabled: true,
	},
	iconSources: {
		materialStyleDefault: "rounded",
		materialWeightDefault: 300,
		lastCategory: { material: "" },
		lastEmojiSkinTone: 0,
	},
	headingCallouts: {
		enabled: true,
		refCleanTitles: true,
		refShowIcon: true,
		showFoldArrow: true,
	},
	inlineCallouts: { enabled: true, allowContent: true },
	welcomeSeen: false,
	autoDiscoverCallouts: true,
	fallbackCalloutId: "note",
	language: "auto",
	customPalettes: [],
	userImages: [],
	customCommands: [],
	disabledFixedCommands: [],
	quickInsertSource: "all",
};
