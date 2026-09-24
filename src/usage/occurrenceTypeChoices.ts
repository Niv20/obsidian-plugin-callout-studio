import { t } from "../i18n";
import type { CalloutRegistry } from "../manager/CalloutRegistry";
import { buildDiscoveredRow, fallbackSourceFor } from "../manager/discoveredRow";
import type { CalloutDefinition } from "../types";
import { calloutIdentity, mergeDashSpaceVariants, normalizeCalloutId } from "../utils/calloutId";
import { committedDefinitions } from "../utils/usableCallouts";
import type { CalloutOccurrenceIndex } from "./CalloutOccurrenceIndex";

interface OccurrenceTypeSelection { id: string; ids: string[]; }
interface OccurrenceTypeChoice { definition: CalloutDefinition; ids: string[]; registered: boolean; }

export const ALL_TYPES_ID = "";

/** The aggregate scope exists only in this sidebar picker, never in the registry. */
export function occurrencePickerChoices(types: OccurrenceTypeChoices, selectedId: string): readonly CalloutDefinition[] {
	const all: CalloutDefinition = {
		id: ALL_TYPES_ID, displayName: t("usage.allTypes"),
		icon: { type: "lucide", value: "list" },
		colorLight: "var(--text-normal)", colorDark: "var(--text-normal)",
		foldable: false, defaultFolded: false, builtIn: false, source: "fallback",
	};
	return [all, ...types.definitions(selectedId)];
}

/** Display data only: these rows never enter the registry, CSS, or saved settings. */
function sourceChoice(rawId: string, fallback: CalloutDefinition): OccurrenceTypeChoice {
	const id = normalizeCalloutId(rawId);
	const identity = calloutIdentity(id);
	return {
		definition: Object.freeze({
			...buildDiscoveredRow(id, fallback),
			displayName: id,
			...(identity === id ? {} : { aliases: [identity] }),
		}),
		ids: [id],
		registered: false,
	};
}

/** The occurrence sidebar's own options; searching the picker never scans notes. */
export class OccurrenceTypeChoices {
	private revision = -1;
	private choices: readonly CalloutDefinition[] = [];
	private byIdentity = new Map<string, OccurrenceTypeChoice>();
	private retained: { id: string; choices: readonly CalloutDefinition[] } | null = null;
	private fallback: CalloutDefinition | null = null;

	constructor(private readonly registry: CalloutRegistry, private readonly index: CalloutOccurrenceIndex) {}

	invalidate(): void { this.revision = -1; }

	/** Membership comes from committed choices, never the display row's fallback artwork. */
	isRegistered(definition: CalloutDefinition): boolean {
		this.refresh();
		return this.byIdentity.get(calloutIdentity(definition.id))?.registered ?? false;
	}

	definitions(selectedId = ""): readonly CalloutDefinition[] {
		this.refresh();
		const id = normalizeCalloutId(selectedId);
		if (!id || this.byIdentity.has(calloutIdentity(id))) return this.choices;
		// A vanished/restored selection remains visible with zero results until
		// another type is chosen; source changes must not silently change filters.
		if (this.retained?.id !== id) this.retained = { id, choices: [...this.choices, sourceChoice(id, this.fallback!).definition] };
		return this.retained.choices;
	}

	resolve(ids: readonly string[] = []): OccurrenceTypeSelection {
		this.refresh();
		for (const id of ids) {
			const match = this.byIdentity.get(calloutIdentity(id));
			if (match) return { id: match.definition.id, ids: [...match.ids] };
		}
		const retained = ids.map(normalizeCalloutId).find(Boolean);
		if (retained) return { id: retained, ids: [retained] };
		const fallback = this.byIdentity.get(calloutIdentity(this.registry.settings.fallbackCalloutId));
		const choice = fallback ?? this.byIdentity.values().next().value as OccurrenceTypeChoice | undefined;
		return choice ? { id: choice.definition.id, ids: [...choice.ids] } : { id: "", ids: [] };
	}

	private refresh(): void {
		const fallback = fallbackSourceFor({ get: (id) => this.registry.getReal(id) }, this.registry.settings.fallbackCalloutId);
		if (this.revision === this.index.dataRevision && this.fallback === fallback) return;
		this.revision = this.index.dataRevision;
		this.fallback = fallback;
		this.retained = null;
		this.byIdentity.clear();
		const definitions: CalloutDefinition[] = [];
		for (const definition of committedDefinitions(this.registry)) {
			if (definition.source === "theme" || this.byIdentity.has(calloutIdentity(definition.id))) continue;
			const choice = { definition, ids: this.registry.vaultIdFormsFor(definition), registered: true };
			definitions.push(definition);
			for (const id of choice.ids) this.byIdentity.set(calloutIdentity(id), choice);
		}
		const observed = mergeDashSpaceVariants(this.index.query().occurrences
			.map((occurrence) => normalizeCalloutId(occurrence.rawId)));
		for (const id of observed) {
			const identity = calloutIdentity(id);
			if (this.byIdentity.has(identity)) continue;
			const choice = sourceChoice(id, fallback);
			this.byIdentity.set(identity, choice);
			definitions.push(choice.definition);
		}
		this.choices = definitions;
	}
}
