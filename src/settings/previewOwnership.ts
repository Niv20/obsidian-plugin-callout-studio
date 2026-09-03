/**
 * settings/previewOwnership.ts — putting up a demo callout, and taking it down.
 *
 * Two modals preview a callout that is not in the user's settings: the vault-wide
 * geometry modal and the welcome splash. Both register a **demo** definition —
 * transient, never persisted, hidden from the settings lists — and both have to
 * undo it exactly.
 *
 * They also both have to say, for as long as the preview stands, that a modal
 * owns the registry. That is what `pruneSuspended` means: `CalloutEditor` already
 * raises it, the prune skips while it is up, and `adoptExternalSettings` defers a
 * settings reload rather than rebuilding the registry underneath a live preview.
 *
 * The flag is also the **only** seam that re-runs a deferred reload — `main.ts`'s
 * setter calls `onExternalSettingsChange()` again when it drops. Without it, a
 * `data.json` change arriving while one of these modals was open left
 * `pendingExternalReload` latched true with nothing to lower it, and the device
 * silently stopped adopting settings for the rest of the session. `onPreviewChange`
 * is not an alternative: it deliberately stays quiet for a demo going down
 * (`CalloutRegistry.setPreviewDefinition`'s `wasListVisible` gate), which is
 * precisely the transition these two make.
 *
 * Kept here rather than in either modal so the pairing cannot drift apart, and so
 * the reasoning above lives in one place instead of two.
 */
import type { CalloutDefinition } from "../types";

/** The slice of the plugin a previewing modal drives. */
export interface PreviewOwner {
	pruneSuspended: boolean;
	registry: {
		setPreviewDefinition(def: CalloutDefinition | null, isDemo?: boolean): void;
	};
	cssInjector: { inject(emitCssChange?: boolean): void };
}

/**
 * Stand `def` up as the live demo preview and mark the registry as borrowed.
 *
 * `inject(false)` throughout: the preview is our own change, so re-emitting
 * `css-change` in response to it would loop with the other plugins that listen
 * and re-emit.
 */
export function beginDemoPreview(
	owner: PreviewOwner,
	def: CalloutDefinition,
): void {
	owner.pruneSuspended = true;
	owner.registry.setPreviewDefinition(def, true);
	owner.cssInjector.inject(false);
}

/**
 * Take the demo down and hand the registry back.
 *
 * The final inject is not merely tidying: `injectNow` skips the startup CSS
 * snapshot for as long as a preview definition is live, and on a fresh install
 * the welcome modal holds one through the very first launch — so this is the
 * inject that writes that snapshot.
 */
export function endDemoPreview(owner: PreviewOwner): void {
	owner.registry.setPreviewDefinition(null);
	owner.cssInjector.inject(false);
	// Last, so a reload released by the setter can never run while the preview
	// it would rebuild around is still registered.
	owner.pruneSuspended = false;
}
