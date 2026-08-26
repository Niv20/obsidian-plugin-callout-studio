/**
 * settings/openCalloutEditor.ts — the one way to open the editor for a callout
 * that already exists, and the one place that refuses to.
 *
 * It forks, and the fork is the point. A callout the **active theme** owns
 * cannot be edited here: every control in `CalloutEditor` writes a value the
 * plugin has stopped emitting, so a user could change six things, press Save,
 * and see nothing happen. That window opens `ThemeCalloutPreviewModal` instead,
 * which shows what the theme actually draws and offers the one adjustment that
 * is still ours to make.
 *
 * An earlier version of this file had the same fork and removed it, because at
 * the time theme mode was a *setting* that defaulted on — so pressing the
 * pencil on an untouched built-in opened an explainer instead of an editor,
 * which is a dead end wearing the costume of an explanation. What makes the
 * fork right now is that it is no longer a default: a callout reaches it only
 * because the theme genuinely names its id, which is a fact about the vault
 * rather than a state the user drifted into.
 *
 * Every route goes through here for exactly that reason. The settings row has
 * its own button, but the context menu, quick insert and the public API all
 * call this, and "theme callouts are not editable" has to hold at all four or
 * it does not hold at all.
 */
import { CalloutEditor } from "./CalloutEditor";
import { ThemeCalloutPreviewModal } from "./ThemeCalloutPreviewModal";
import type { CalloutEditorPlugin } from "./editor/types";
import type { CalloutDefinition } from "../types";

/**
 * Open the editor for `def` and resolve with the saved definition, or `null`
 * when nothing was saved.
 *
 * Resolves `null` for a theme-owned callout too, after showing the preview
 * window: nothing was saved *to this definition*, which is what every caller
 * uses the result to decide.
 */
export async function openCalloutEditorFor(
	plugin: CalloutEditorPlugin,
	def: CalloutDefinition,
): Promise<CalloutDefinition | null> {
	if (plugin.registry.themeOwns(def)) {
		new ThemeCalloutPreviewModal(plugin, def).open();
		return null;
	}
	return new CalloutEditor(plugin, def).openAndWait();
}
