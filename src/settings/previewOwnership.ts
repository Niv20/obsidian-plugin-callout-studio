import type { CalloutDefinition } from "../types";

export interface PreviewOwner {
	settingsEditOpen: boolean;
	registry: {
		setPreviewDefinition(def: CalloutDefinition | null, isDemo?: boolean): void;
	};
	cssInjector: { inject(emitCssChange?: boolean): void };
}

export function beginDemoPreview(
	owner: PreviewOwner,
	def: CalloutDefinition,
): void {
	owner.settingsEditOpen = true;
	owner.registry.setPreviewDefinition(def, true);
	owner.cssInjector.inject(false);
}

export function endDemoPreview(owner: PreviewOwner): void {
	owner.registry.setPreviewDefinition(null);
	owner.cssInjector.inject(false);
	// Last, so a reload released by the setter can never run while the preview
	// it would rebuild around is still registered.
	owner.settingsEditOpen = false;
}
