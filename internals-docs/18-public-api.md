# Public API

[`src/api/PluginAPI.ts`](../src/api/PluginAPI.ts) + `src/api/types.ts`.
Exposed at `app.plugins.plugins["callout-studio"].api`. This is the
plugin's one committed, versioned integration surface for *other* Obsidian
plugins — everything else in this codebase is free to change at will.
[`API.md`](../API.md) at the repo root is the consumer-facing contract
document; this page explains how the implementation actually enforces what
that document promises.

## Read-only, five members, and it stays that way

```ts
interface CalloutStudioApi {
  readonly version: number;
  getCallouts(): readonly Callout[];
  getCalloutsDetailed(): readonly CalloutDetails[];
  getCallout(id: string): Callout | undefined;
  onChange(callback: () => void): () => void;
}
```

`version: 1` today. `tests/publicApiContract.test.ts` pins the exact member
count, each one's kind and arity, and — separately — that `API.md`'s stated
member count agrees with the implementation. New members may be **added**
without a version bump (consumers are told to feature-detect); renaming or
changing the meaning of an existing member requires bumping `version`.

**It deliberately does not write markdown for you.** Inserting a callout
into a note is one line of text, and every consuming plugin wants to place
it differently — the API answers *which callouts exist* and *what changed*,
never *how to use them*.

## Nothing live escapes

> [!IMPORTANT]
> **Every value handed out is a frozen, structurally independent copy**,
> built by mapper functions (`toCallout`, `toDetails`, `toIconInfo`) at the
> bottom of `PluginAPI.ts` — never a live `CalloutDefinition` reference. The
> registry hands *its own* renderer real, mutable objects on every paint; if
> an external consumer held one of those same objects, a stray property
> assignment from outside the plugin could change styling with **no
> re-inject and no save** — a silent, hard-to-diagnose desync between what
> `data.json` says and what's actually rendering.

Enforced at three separate depths, all tested: the returned **array** is
frozen, every **element** in it is frozen, and nested objects (`aliases`,
`icon`) are **also** frozen and are fresh copies rather than shared
references — mutating an array returned from one call cannot affect a
later call's result, and `getCallouts()` and `getCalloutsDetailed()` never
hand back anything the registry itself is still holding onto.

## Real ECMAScript privacy — not TypeScript's

```ts
export class CalloutStudioAPI implements CalloutStudioApi {
  readonly version = 1;
  readonly #plugin: CalloutStudioPlugin;   // ← private field, not `private plugin`
  ...
}
```

> [!WARNING]
> **`constructor(private readonly plugin: CalloutStudioPlugin)` would have
> been a real vulnerability here, not just a style choice.** TypeScript's
> `private` keyword is a compile-time-only annotation — it compiles down to
> a completely ordinary `this.plugin = plugin` with no runtime enforcement
> at all. A consumer holding the `api` object could reach `api.plugin`
> directly at runtime (TypeScript wouldn't even need to be bypassed — plain
> JavaScript sees it fine) and from there reach `registry.update()`,
> `registry.remove()`, live settings, every live definition. `#plugin` is a
> genuine ECMAScript private field, invisible and unreachable outside the
> class body at runtime, which is what actually makes the five documented
> members the *only* five that exist.

The list-builder function (`usableDefinitions`) is likewise a **module-level
function, not a class method** — an ordinary method is a perfectly reachable
prototype member at runtime (`Object.getPrototypeOf(api).usableDefinitions`),
so keeping it off the class entirely is part of the same guarantee.

## `usableDefinitions()` — the one list, and it's *committed* state

```ts
const usableDefinitions = (plugin): CalloutDefinition[] => {
  const committed = [...registry.getBuiltIn(), ...registry.getUserDefined()]
    .map((def) => registry.getReal(def.id) ?? def);
  return sortCalloutsByDisplayName(
    filterUsableCallouts(committed, (id) => plugin.isKnownZeroUsageFallback(id)),
    getLocale(),
  );
};
```

Three deliberate steps, each closing a real gap:

1. **`getBuiltIn()` + `getUserDefined()`** both read through the registry's
   settings-list view, which already excludes the transient live-preview
   placeholder. Together they cover every source: built-ins are seeded
   unconditionally on every load, so all 13 of Obsidian's own types appear
   whether or not the user has ever touched them.
2. **All saved manual results are included**, regardless of note usage. There
   is no usage-based discovery filter or background pruning.
3. **Every row is re-resolved through `registry.getReal(id)`** — this is
   the step that makes the list answer with **saved** state, not
   in-progress editor state. The settings-list view *deliberately* lets a
   preview standing in for an existing callout pass through as-is (those
   rows are meant to track the open editor keystroke-by-keystroke) — but an
   external consumer is not the settings UI: a preview fires no
   `onChange`, so a consumer that happened to re-read the list during that
   window (any unrelated mutation would trigger it) could cache a title the
   user then cancels, and would never be told it was cancelled. `getReal`
   substitutes back in whatever the preview is shadowing.

### Which callouts are included

- **Every built-in**, customized or not.
- **Everything the user created themselves.**
- **Manually discovered theme types and saved plugin-provided definitions.**
- **All manually discovered callouts**, including uncustomized or unused types.
- **Callouts handed to the theme (`externalStyle: true`) — deliberately
  included**, even though Callout Studio itself no longer styles them: the
  id is still perfectly valid markdown to write, so hiding it from the API
  would make it impossible for a consumer to offer it as a choice.

## `getCallout(id)` — the lookup ladder, deliberately shallower than the renderer's

```ts
getCallout(id: string): Callout | undefined {
  const wanted = normalizeCalloutId(id);
  const resolved = registry.get(wanted) ?? registry.findByAlias(wanted) ?? registry.findByAttrId(wanted);
  if (!resolved) return undefined;
  const published = usableDefinitions(plugin).find((def) => def.id === resolved.id);
  return published ? toCallout(published) : undefined;
}
```

Forgiving in the same three ways Obsidian itself is (case-insensitive,
`|metadata` stripped via `normalizeCalloutId`, and the dashed
`data-callout` spelling resolves via `findByAttrId`). **Deliberately stops
one rung short of what the renderer does**: it tries id → alias → attribute
form, but never falls through to substituting the configured *fallback*
callout for a genuinely unknown id — an API meant to answer "does this
callout exist" would be useless if every id, known or not, always answered
with something.

The final **re-find by id in the published list** (rather than returning
`resolved` directly) is what makes the substitution described above work —
`resolved` here is very often the live-preview stand-in itself, and
matching by id against the *filtered, `getReal`-resolved* list is what
routes around it to the committed row.

## `onChange` — no payload, and explicitly documented as imprecise

```ts
onChange(callback: () => void): () => void {
  plugin.registry.onChange(callback);
  return () => plugin.registry.offChange(callback);
}
```

A thin pass-through to the registry's own change list (see
[Callout registry § onChange carries no payload](05-callout-registry.md#onchange-carries-no-payload)).
`API.md` is explicit that consumers must **not** treat this as a precise
diff: "A single user action can fire it more than once — editing the
callout that other manually discovered callouts mirror emits one event for the
edit and another for the rows it restyled — and most events change nothing
you care about, since a colour tweak fires it just as a rename does."
Consumers wanting to skip expensive rebuilds are told to diff the resolved
list themselves (a snippet showing exactly this is in `API.md`).

> [!WARNING]
> **Subscriptions are not cleaned up automatically.** The API hands back an
> unsubscribe function specifically so a consumer plugin can, and must, call
> it on its own unload — `API.md` shows `this.register(unsubscribe)` as the
> idiomatic pattern. An orphaned subscription would keep firing into a
> torn-down consumer forever.

## What's deliberately absent, and why

| Not exposed | Reason |
| --- | --- |
| Creating/editing callouts | Read-only removes a whole class of cross-plugin conflicts; the user creates callouts through this plugin's own UI. |
| Opening any modal | The icon picker and callout editor are internal UI, not an integration surface. |
| Icon artwork (beyond a Lucide name) | Only `pack: "lucide"` names are independently usable — pass `icon.name` straight to Obsidian's own `setIcon()`. Every other pack's artwork is fetched/cached by this plugin for itself. |
| Wrap/unwrap helpers | Every plugin scopes selection-wrapping differently; a consumer wanting this exact fence-aware, frontmatter-skipping behaviour is told to copy `CalloutBlockTools.ts` directly — the licence explicitly permits it. |

The earlier `registerCallout`/`unregisterCallout` pair (a mutation surface)
was **removed rather than fixed** — it had no ownership model at all and
left `source: "plugin"` rows permanently stuck in `data.json` with no way
to clean them up. This is the concrete cautionary precedent behind the
current read-only design; don't reintroduce a mutation surface without
solving that problem first.

## `src/api/types.ts` is intentionally a separate module

`CalloutDefinition` (in `src/types.ts`) is free to grow and reshape as
features land — `src/api/types.ts` (`Callout`, `CalloutDetails`,
`CalloutIconInfo`) is a **stable, separately-versioned public shape** that
must not move in lockstep with it. The mapper functions in `PluginAPI.ts`
are the seam between the two.

---
Next chapter: [19-extending.md](19-extending.md)
