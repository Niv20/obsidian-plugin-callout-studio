/**
 * manager/web/detectService.ts — a guess at which service publishes this
 * vault, so the Publish to the web panel can put that one first.
 *
 * It is a guess, and is used as one: a detected service is listed first with a
 * line saying why, and nothing is chosen, written or switched on because of
 * it. The user still presses the button.
 *
 * **Only the vault is looked at** — its top folder, its notes' properties and
 * its own configuration folder — through the vault adapter, which is the same
 * on desktop and mobile. That is a rule of this project (never read outside
 * the vault), and it is why Quartz is the hard one: a Quartz site usually
 * keeps the vault *inside* its repository, as the `content` folder, so the
 * file that would settle it (`quartz.config.ts`) sits one level above anything
 * we may read. What is left for that layout is the Quartz Syncer plugin, or
 * the vault being called `content`, and the second is only a hint.
 *
 * Reading (`readServiceSignals`) is kept apart from judging (`rankServices`),
 * so the judgement is a pure function a test can feed any combination.
 */
import type { App } from "obsidian";
import type { WebTargetId } from "./targets";

/** What was found in the vault. */
export interface ServiceSignals {
	/** `publish.js` or `publish.css` in the top folder. */
	publishFiles: boolean;
	/** A Publish site is connected: `publish.json` in the configuration folder. */
	publishSite: boolean;
	/** The Publish core plugin is switched on. */
	publishPlugin: boolean;
	/** The Digital Garden community plugin is switched on. */
	gardenPlugin: boolean;
	/** Some note has a `dg-publish` property. */
	gardenNotes: boolean;
	/** The Quartz Syncer community plugin is switched on. */
	quartzSyncer: boolean;
	/** A Quartz configuration file in the top folder, and which generation's. */
	quartzConfig: 4 | 5 | null;
	/** The vault itself is named `content`, as Quartz's content folder is. */
	contentVault: boolean;
}

/** Why a service was detected — one user-facing line each (`web.detected.*`). */
export type DetectionReason =
	| "publishFiles"
	| "publishSite"
	| "publishPlugin"
	| "gardenPlugin"
	| "gardenNotes"
	| "quartzSyncer"
	| "quartzConfig"
	| "contentVault";

export interface Detection {
	id: WebTargetId;
	/** `weak` is a hint: listed first, but worded as a maybe. */
	strength: "strong" | "weak";
	reason: DetectionReason;
	quartzVersion?: 4 | 5;
	/** The vault is the Quartz repository itself. */
	quartzInVault?: boolean;
}

/** Community plugin ids, from each plugin's own `manifest.json`. */
export const GARDEN_PLUGIN_ID = "digitalgarden";
export const QUARTZ_SYNCER_PLUGIN_ID = "quartz-syncer";

/** The services the signals point at, most convincing first. At most one each. */
export function rankServices(signals: ServiceSignals): Detection[] {
	const found: Detection[] = [];
	const add = (detection: Detection): void => {
		if (!found.some((other) => other.id === detection.id)) found.push(detection);
	};

	if (signals.gardenPlugin) add({ id: "garden", strength: "strong", reason: "gardenPlugin" });
	if (signals.quartzConfig !== null) {
		add({
			id: "quartz",
			strength: "strong",
			reason: "quartzConfig",
			quartzVersion: signals.quartzConfig,
			quartzInVault: true,
		});
	}
	if (signals.quartzSyncer) add({ id: "quartz", strength: "strong", reason: "quartzSyncer" });
	if (signals.publishSite) add({ id: "publish", strength: "strong", reason: "publishSite" });
	if (signals.publishFiles) add({ id: "publish", strength: "strong", reason: "publishFiles" });

	if (signals.gardenNotes) add({ id: "garden", strength: "weak", reason: "gardenNotes" });
	if (signals.contentVault) add({ id: "quartz", strength: "weak", reason: "contentVault" });
	if (signals.publishPlugin) add({ id: "publish", strength: "weak", reason: "publishPlugin" });

	return [...found.filter((d) => d.strength === "strong"), ...found.filter((d) => d.strength === "weak")];
}

/**
 * The vault itself is named `content`, as Quartz's content folder is. The
 * folder that holds the vault is then, most likely, the Quartz repository.
 */
export const isContentVault = (app: App): boolean => app.vault.getName().toLowerCase() === "content";

async function exists(app: App, path: string): Promise<boolean> {
	try {
		return await app.vault.adapter.exists(path);
	} catch {
		return false;
	}
}

/**
 * The ids switched on in one of Obsidian's plugin lists. The community list is
 * an array of ids; the core list has been an array and, later, a map of id to
 * on/off — both are read.
 */
async function enabledIds(app: App, file: string): Promise<Set<string>> {
	try {
		const path = `${app.vault.configDir}/${file}`;
		if (!(await app.vault.adapter.exists(path))) return new Set();
		const parsed: unknown = JSON.parse(await app.vault.adapter.read(path));
		if (Array.isArray(parsed)) return new Set(parsed.filter((id): id is string => typeof id === "string"));
		if (parsed && typeof parsed === "object") {
			return new Set(
				Object.entries(parsed)
					.filter(([, on]) => on === true)
					.map(([id]) => id),
			);
		}
	} catch {
		// An unreadable list is the same as an empty one, for a guess.
	}
	return new Set();
}

/** The community plugins switched on in this vault, by id. Never throws. */
export const enabledCommunityPlugins = (app: App): Promise<Set<string>> => enabledIds(app, "community-plugins.json");

function hasGardenNote(app: App): boolean {
	for (const file of app.vault.getMarkdownFiles()) {
		const frontmatter: unknown = app.metadataCache.getFileCache(file)?.frontmatter;
		if (frontmatter && typeof frontmatter === "object" && "dg-publish" in frontmatter) return true;
	}
	return false;
}

/** Look at the vault. Never throws; whatever cannot be read counts as absent. */
export async function readServiceSignals(app: App): Promise<ServiceSignals> {
	const [core, community, publishJs, publishCss, publishSite, yaml, defaultYaml, ts] = await Promise.all([
		enabledIds(app, "core-plugins.json"),
		enabledIds(app, "community-plugins.json"),
		exists(app, "publish.js"),
		exists(app, "publish.css"),
		exists(app, `${app.vault.configDir}/publish.json`),
		exists(app, "quartz.config.yaml"),
		exists(app, "quartz.config.default.yaml"),
		exists(app, "quartz.config.ts"),
	]);
	const gardenPlugin = community.has(GARDEN_PLUGIN_ID);
	return {
		publishFiles: publishJs || publishCss,
		publishSite,
		publishPlugin: core.has("publish"),
		gardenPlugin,
		// Only worth a walk over every note when the plugin did not settle it.
		gardenNotes: !gardenPlugin && hasGardenNote(app),
		quartzSyncer: community.has(QUARTZ_SYNCER_PLUGIN_ID),
		quartzConfig: yaml || defaultYaml ? 5 : ts ? 4 : null,
		contentVault: isContentVault(app),
	};
}

/** {@link readServiceSignals}, judged. */
export async function detectServices(app: App): Promise<Detection[]> {
	return rankServices(await readServiceSignals(app));
}
