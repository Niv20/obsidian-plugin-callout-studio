/**
 * defaultCallouts.ts — the 13 built-in callout definitions.
 *
 * Split out of `constants.ts`, which was carrying two responsibilities at once:
 * the plugin's compile-time constants and this table. This half is *data* —
 * its length measures how many callouts Obsidian ships, not how much the module
 * does — and it is read by exactly three places (the registry, the discovered-row
 * builder, and the suites that assert what a fresh vault starts with).
 */
import type { CalloutDefinition } from "./types";

/**
 * The 13 built-ins, coloured to match Obsidian.
 *
 * The hexes are the resolved values of {@link OBSIDIAN_CALLOUT_VAR} in core's
 * default theme, read out of the shipped `app.css` (`--color-blue` and friends
 * under `.theme-light` / `.theme-dark`). They are a *seed*, not the rendering
 * path: an untouched built-in never has its `--callout-color` overridden at all,
 * so what actually paints is the theme's. These values are what the editor
 * shows in its swatches, what a customized copy starts from, and what
 * `resetBuiltIn` restores.
 *
 * This is the first time a built-in's light and dark accents differ — Obsidian's
 * own palette shifts between themes (its `example` purple moves by ΔE00 15.4),
 * and carrying one value for both was a large part of why the plugin's colours
 * never quite matched. Backgrounds are still deliberately absent: a definition
 * with no `bgColorLight`/`bgColorDark` emits no background rule, which leaves
 * core's translucent fill in place and is what lets nested callouts step.
 */
export const DEFAULT_CALLOUTS: CalloutDefinition[] = [
	{
		id: "note",
		displayName: "Note",
		icon: { type: "lucide", value: "lucide-pencil" },
		colorLight: "#086ddd",
		colorDark: "#027aff",
		foldable: false,
		defaultFolded: false,
		builtIn: true,
		source: "builtin",
	},
	{
		id: "abstract",
		displayName: "Abstract",
		icon: { type: "lucide", value: "clipboard-list" },
		colorLight: "#00bfbc",
		colorDark: "#53dfdd",
		foldable: false,
		defaultFolded: false,
		builtIn: true,
		source: "builtin",
		aliases: ["summary", "tldr"],
	},
	{
		id: "info",
		displayName: "Info",
		icon: { type: "lucide", value: "info" },
		colorLight: "#086ddd",
		colorDark: "#027aff",
		foldable: false,
		defaultFolded: false,
		builtIn: true,
		source: "builtin",
	},
	{
		id: "todo",
		displayName: "Todo",
		icon: { type: "lucide", value: "check-circle-2" },
		colorLight: "#086ddd",
		colorDark: "#027aff",
		foldable: false,
		defaultFolded: false,
		builtIn: true,
		source: "builtin",
	},
	{
		id: "tip",
		displayName: "Tip",
		icon: { type: "lucide", value: "flame" },
		colorLight: "#00bfbc",
		colorDark: "#53dfdd",
		foldable: false,
		defaultFolded: false,
		builtIn: true,
		source: "builtin",
		aliases: ["hint", "important"],
	},
	{
		id: "success",
		displayName: "Success",
		icon: { type: "lucide", value: "check" },
		colorLight: "#08b94e",
		colorDark: "#44cf6e",
		foldable: false,
		defaultFolded: false,
		builtIn: true,
		source: "builtin",
		aliases: ["check", "done"],
	},
	{
		id: "question",
		displayName: "Question",
		icon: { type: "lucide", value: "help-circle" },
		colorLight: "#ec7500",
		colorDark: "#e9973f",
		foldable: false,
		defaultFolded: false,
		builtIn: true,
		source: "builtin",
		aliases: ["help", "faq"],
	},
	{
		id: "warning",
		displayName: "Warning",
		icon: { type: "lucide", value: "alert-triangle" },
		colorLight: "#ec7500",
		colorDark: "#e9973f",
		foldable: false,
		defaultFolded: false,
		builtIn: true,
		source: "builtin",
		aliases: ["caution", "attention"],
	},
	{
		id: "failure",
		displayName: "Failure",
		icon: { type: "lucide", value: "x" },
		colorLight: "#e93147",
		colorDark: "#fb464c",
		foldable: false,
		defaultFolded: false,
		builtIn: true,
		source: "builtin",
		aliases: ["fail", "missing"],
	},
	{
		id: "danger",
		displayName: "Danger",
		icon: { type: "lucide", value: "zap" },
		colorLight: "#e93147",
		colorDark: "#fb464c",
		foldable: false,
		defaultFolded: false,
		builtIn: true,
		source: "builtin",
		aliases: ["error"],
	},
	{
		id: "bug",
		displayName: "Bug",
		icon: { type: "lucide", value: "bug" },
		colorLight: "#e93147",
		colorDark: "#fb464c",
		foldable: false,
		defaultFolded: false,
		builtIn: true,
		source: "builtin",
	},
	{
		id: "example",
		displayName: "Example",
		icon: { type: "lucide", value: "list" },
		colorLight: "#7852ee",
		colorDark: "#a882ff",
		foldable: false,
		defaultFolded: false,
		builtIn: true,
		source: "builtin",
	},
	{
		id: "quote",
		displayName: "Quote",
		icon: { type: "lucide", value: "quote" },
		colorLight: "#9e9e9e",
		colorDark: "#9e9e9e",
		foldable: false,
		defaultFolded: false,
		builtIn: true,
		source: "builtin",
		aliases: ["cite"],
	},
];
