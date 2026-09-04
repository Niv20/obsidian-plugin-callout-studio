/**
 * manager/registryOwnership.ts — "is a modal holding the registry right now?"
 *
 * Asked by both paths that can adopt a `data.json` mid-session — the desktop
 * watcher's `adoptExternalSettings` and the mobile foreground check in
 * `settingsLateArrival` — because both would otherwise rebuild the registry
 * underneath a row the user is in the middle of editing, or underneath a demo
 * callout a modal has stood up. They differ only in what they do about it:
 * `adoptExternalSettings` reports the adoption as *deferred* so `main.ts` can
 * re-run it when the flag drops, while the foreground check simply waits for
 * the next time the user comes back.
 *
 * Two flags rather than one because they are raised by different owners.
 * `pruneSuspended` is the callout editor and the two previewing modals (see
 * `settings/previewOwnership.ts`, which is the *writing* side of the same
 * question); `hasPreviewDefinition()` is the registry's own answer about a live
 * preview slot. Either one means the same thing to a reload.
 *
 * Its own module, and structurally typed, because the alternative — an exported
 * helper on `settingsBoot` — is a file already at the repo's size limit, and
 * because the two copies of this expression had already started to drift in
 * their comments while agreeing in their code.
 */

/** What answering the question needs. */
export interface RegistryOwnershipHost {
	/** True exactly while the callout editor or a previewing modal owns it. */
	pruneSuspended: boolean;
	registry: { hasPreviewDefinition(): boolean };
}

/**
 * Whether something is holding the registry that a rebuild must not disturb.
 *
 * Callers must not adopt an incoming settings file while this is true.
 */
export function registryIsOwned(host: RegistryOwnershipHost): boolean {
	return host.pruneSuspended || host.registry.hasPreviewDefinition();
}
