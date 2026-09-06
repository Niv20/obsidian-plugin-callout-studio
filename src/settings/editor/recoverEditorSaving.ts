import type { CalloutEditorPlugin } from "./types";
import type { EditorSaveSession } from "./EditorSaveSession";

/** Form fields remain owned by the editor while only committed settings reload. */
export async function recoverEditorSaving(plugin: CalloutEditorPlugin, session: EditorSaveSession, ui: {
	prepare(): void;
	busyChanged(): void;
	finish(recovered: boolean): void;
}): Promise<boolean> {
	if (session.busy) return false;
	ui.prepare();
	plugin.registry.setPreviewDefinition(null);
	let recovered = false;
	try { recovered = await session.recover(plugin, () => ui.busyChanged()); return recovered; }
	finally { ui.finish(recovered); }
}
