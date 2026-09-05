import type { App, EventRef } from "obsidian";
import type { CalloutDefinition } from "../../types";
import { stylingSignature, themeCss } from "./customCssApi";
import type { ThemeCalloutStore } from "./ThemeCalloutStore";
import { ThemeAppearanceProbe } from "./ThemeAppearanceProbe";
import type { ThemeAppearance } from "./themeAppearance";

export interface ThemeSyncHost {

	app: App;
	registry: {
		batch<T>(body: () => T): T;
		setThemeOwnedIds(ids: ReadonlySet<string>): boolean;
		getAll(): CalloutDefinition[];
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
		`${stylingSignature(host.app)}|${themeCss(host.app)}`;
	const sweep = (force = false): void => {
		const next = fingerprint();
		if (!force && next === signature) return;
		signature = next;

		host.cssInjector.themeCallouts().invalidate();

		host.registry.setThemeOwnedIds(host.cssInjector.themeCallouts().themeDefinedIds());
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
