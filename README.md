# Callout Studio

Callout Studio is a callout management **plugin** for [Obsidian](https://obsidian.md).

Create and style your own callout types, customize Obsidian's built-in callouts, and choose icons from several libraries. Every callout can appear as a block, heading, or inline callout, all managed from one settings tab.

<img alt="hero" src="https://github.com/user-attachments/assets/e24ff986-cf0c-4f18-95be-33a75283d83a" />

## The syntax

The same callout type can be written three ways:

| Type    | Default content | Custom content                      |
| ------- | --------------- | ----------------------------------- |
| Heading | `## [!note]`    | `## [!note] A custom heading title` |
| Inline  | `[!note]`       | `[!note]{A custom inline title}`    |
| Block   | `> [!note]`     | `> [!note] A custom block title`    |

<img alt="Three ways to use a callout" src="https://github.com/user-attachments/assets/3cf88262-184d-42e6-b810-d43889629afb" />

The [User Guide](docs/user-guide/README.md) covers color palettes, icons, global styles, context menus, vault discovery, theme compatibility, and more.

## 💖 Special Thanks

Thank you to everyone who reported bugs, tested fixes, and shared detailed feedback:

[brianjwalton](https://github.com/brianjwalton) · [astreloff](https://github.com/astreloff) · [rubcap](https://github.com/rubcap) · [Xto-tT0](https://github.com/Xto-tT0) · [Jarsgon](https://github.com/Jarsgon) · [Ravencaller213](https://github.com/Ravencaller213) · [frudolph77](https://github.com/frudolph77) · [DesertSnak3](https://github.com/DesertSnak3) · [alythobani](https://github.com/alythobani) · [dragonish](https://github.com/dragonish) · [Ana-Mendes123](https://github.com/Ana-Mendes123) · [EddyCurrrent](https://github.com/EddyCurrrent) · [Indra-Reaper](https://github.com/Indra-Reaper) · [hisbo](https://github.com/hisbo) · [engineeringbees](https://github.com/engineeringbees)

And thank you to everyone whose ideas and suggestions helped shape the plugin:

[ericxob77](https://github.com/ericxob77) · [TechnoMaverick](https://github.com/TechnoMaverick) · [epilo9er](https://github.com/epilo9er) · [Xto-tT0](https://github.com/Xto-tT0) · [TyceHerrman](https://github.com/TyceHerrman) · [eth-p](https://github.com/eth-p) · [kwhsiung](https://github.com/kwhsiung) · [archangelglass](https://github.com/archangelglass) · [quantumstargazer](https://github.com/quantumstargazer) · [BloatedBlowfish](https://github.com/BloatedBlowfish) · [Camouflagee](https://github.com/Camouflagee)

Thank you all for helping make Callout Studio better!

## Privacy, in short

Callout Studio keeps a local recovery copy of its settings in case sync replaces `data.json` while the plugin is closed. It can merge valid concurrent edits and recognized conflict copies, while preserving damaged or unsupported data for recovery. For the safest sync setup, install the same up-to-date build on every device. See [persistence and recovery](docs/internals-docs/07-persistence-and-caching.md).

Callout Studio never sends your vault content anywhere and collects no telemetry or analytics. It only downloads icon artwork you choose and, when needed, a translation for the plugin interface. See [Privacy & permissions](docs/internals-docs/24-privacy-and-permissions.md) for a full explanation of every download and where data is stored.

**Convert to standard Markdown** reads Markdown notes locally for a selectable preview and, after a separate irreversible-action confirmation, rewrites heading and inline callout syntax and updates links to changed headings. Back up your vault first; see [the conversion guide](docs/user-guide/13-danger-zone.md).

## Install

1. Open **Settings → Community plugins** in Obsidian.
2. Search for **Callout Studio** and select **Install**, then **Enable**.

## Developers

The [internals guide](docs/internals-docs/README.md) covers architecture, source, build and release details, including [manual installation](docs/internals-docs/19-build-test-release.md#manual-installation-from-a-release); see [CONTRIBUTING.md](docs/CONTRIBUTING.md) for the contribution process. Other plugins can use the [public API](docs/API.md) to read callout types and subscribe to changes.

## License & Third-Party Assets

Callout Studio's code is available under a permissive [license](LICENSE), with no attribution required. One informal request, which is not a license term: please do not repackage the code and publish it as a new plugin in Obsidian's Community Plugins directory. You are welcome to reuse it, learn from it, and build on it in other ways.

The icon libraries offered within the plugin are separate works and retain their own licenses. You can view the full text for each in **[THIRD-PARTY-NOTICES.md](docs/THIRD-PARTY-NOTICES.md)** or select **Icon licenses & credits** at the bottom of the plugin settings.
