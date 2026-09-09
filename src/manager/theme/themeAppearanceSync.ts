import type { App, EventRef } from "obsidian";
import type { CalloutDefinition } from "../../types";
import { enabledSnippetCss, stylingSignature, themeCss } from "./customCssApi";
import type { ThemeCalloutStore } from "./ThemeCalloutStore";
import { ThemeAppearanceProbe } from "./ThemeAppearanceProbe";
import { syncThemeOverlayRows } from "./themeOverlayRows";
import type { ThemeAppearance } from "./themeAppearance";

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
	};
	registerEvent(ref: EventRef): void;

	register(cb: () => void): void;
}

export function registerThemeAppearance(host: ThemeSyncHost): () => void {

	const appearance = new ThemeAppearanceProbe(host.app);
	host.register(() => {
		appearance.destroy();
	});
	let signature: string | null = null;

	const fingerprint = (): string =>
		JSON.stringify([stylingSignature(host.app), themeCss(host.app), enabledSnippetCss(host.app)]);
	const syncRows = (): number => syncThemeOverlayRows(
		host.registry, host.cssInjector.themeCallouts().themeDefinedIds(),
	);
	const sweep = (force = false): void => {
		const next = fingerprint();
		if (force || next !== signature) {
			signature = next;
			host.cssInjector.themeCallouts().invalidate();
		}
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
				host.registry.setThemeAppearances(appearance.results());
				host.cssInjector.inject(false);
			},
		);
	};

	// Closing an unsaved draft can release a newly theme-owned id without
	// changing generated CSS (for example with the fallback disabled).
	const previewChanged = (): void => { if (syncRows() > 0) probe(); };
	host.registry.onPreviewChange(previewChanged);
	host.register(() => host.registry.offPreviewChange(previewChanged));

	sweep(true);
	probe();

	const resweep = (): void => {
		sweep(true);
		probe();
	};
	host.registerEvent(
		host.app.workspace.on("css-change", () => {

			appearance.invalidate();
			host.registry.batch(() => {
				host.registry.setThemeAppearances(new Map());
				sweep();
			});
			host.cssInjector.inject(false);
			probe();
		}),
	);
	return resweep;
}
