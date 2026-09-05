# Callout Studio

This development build uses **manual discovery only**. In the plugin settings,
press **Discover now** beside **My callout types** and **Add new callout** to
add missing types from saved notes and the active theme. Results are saved in
`data.json` and included in backups/exports; discovery has no active local-storage
state. On upgrade, the old discovery cache and startup CSS are archived for
recovery before the old cache is removed. A failed archive leaves both original
values untouched and inactive. Update **both devices before resuming sync or
editing**: this build writes settings data format 5, but released versions
2.12.0–2.12.2 do not protect files written by newer builds. See
[manual discovery, upgrading and two-device recovery](user-guide/08-fallback-callouts-and-manual-discovery.md).


Callout Studio is a powerful callout management **plugin** for [Obsidian.](https://obsidian.md)

It lets you create, edit, and style your own callout types, override the built-in ones, pick icons from large libraries, and use every callout as a Block Callout, a Heading Callout, or an Inline Callout - all from a single settings tab!

<img alt="hero" src="https://github.com/user-attachments/assets/e24ff986-cf0c-4f18-95be-33a75283d83a" />

## The syntax

The same callout type can be written three ways:

| Type    | Default content | Custom content                      |
| ------- | --------------- | ----------------------------------- |
| Heading | `## [!note]`    | `## [!note] A custom heading title` |
| Inline  | `[!note]`       | `[!note]{A custom inline title}`    |
| Block   | `> [!note]`     | `> [!note] A custom block title`    |

<img alt="Three ways to use a callout" src="https://github.com/user-attachments/assets/3cf88262-184d-42e6-b810-d43889629afb" />

Unlock the full potential of Callout Studio! Explore the [User Guide](user-guide/README.md) to discover advanced features like custom color palettes, icon management, global styling, context menus, vault discovery, themes, and more.

## 💖 Special Thanks

A huge thank you to everyone who took the time to report bugs, identify issues, and help make Callout Studio more stable and reliable. Your reports, testing, and detailed feedback have been incredibly helpful:

[brianjwalton](https://github.com/brianjwalton) · [astreloff](https://github.com/astreloff) · [rubcap](https://github.com/rubcap) · [Xto-tT0](https://github.com/Xto-tT0) · [Jarsgon](https://github.com/Jarsgon) · [Ravencaller213](https://github.com/Ravencaller213) · [frudolph77](https://github.com/frudolph77) · [DesertSnak3](https://github.com/DesertSnak3) · [dragonish](https://github.com/dragonish) · [EddyCurrrent](https://github.com/EddyCurrrent) · [Ana-Mendes123](https://github.com/Ana-Mendes123)

And a huge thank you to everyone who shared ideas, suggested enhancements, and helped shape the direction of Callout Studio. Many of the features and improvements in the plugin have been inspired by your feedback and suggestions:

[ericxob77](https://github.com/ericxob77) · [TechnoMaverick](https://github.com/TechnoMaverick) · [epilo9er](https://github.com/epilo9er) · [Xto-tT0](https://github.com/Xto-tT0) · [TyceHerrman](https://github.com/TyceHerrman) · [eth-p](https://github.com/eth-p) · [kwhsiung](https://github.com/kwhsiung) · [archangelglass](https://github.com/archangelglass) · [quantumstargazer](https://github.com/quantumstargazer) · [BloatedBlowfish](https://github.com/BloatedBlowfish) · [alythobani](https://github.com/alythobani)

Thank you all for helping make Callout Studio better!

## Privacy, in short

Callout Studio never sends vault content anywhere, and collects no telemetry or analytics. The only things it ever downloads are icon artwork you actually pick and, when needed, the plugin's own UI translation — both explained in full, with exactly what's stored where, in [Privacy & permissions](user-guide/16-privacy-and-permissions.md).

## Install

### Community plugins (recommended)

1. Open **Settings → Community plugins** in Obsidian.
2. Search for **Callout Studio** and select **Install**, then **Enable**.

### Manual install

1. Download `manifest.json`, `main.js`, and `styles.css` from the latest GitHub release.
2. Copy them into `<Vault>/.obsidian/plugins/callout-studio/`.
3. Restart Obsidian and enable **Callout Studio** in **Settings → Community plugins**.

## Development

```bash
npm install
npm run dev    # watch build
npm run build  # production build (typecheck + minified bundle)
npm run lint   # ESLint with the official obsidianmd plugin rules
```

Source lives under `src/` and is bundled by esbuild into `main.js`. The release artifacts are `main.js`, `manifest.json`, and `styles.css`.

Digging into how it's built, or preparing a pull request? See [`internals-docs/`](internals-docs/00-index.md) for the architecture, and [CONTRIBUTING.md](CONTRIBUTING.md) for the process.

### Plugin API

Callout Studio exposes a small read-only API so other plugins can list the user's callout types and react when that list changes. See [API.md](API.md).

## License & Third-Party Assets

Callout Studio's code is available under a permissive [license](LICENSE) — use it however you like, no attribution required. There is one informal ask, and it is not a license term: please don't repackage this code and publish it as a new plugin in Obsidian's Community Plugins directory. Reuse it, learn from it, build on it — just not that.

The icon libraries offered within the plugin are separate works and retain their own licenses. You can view the full text for each in **[THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md)** or directly through the plugin via _Settings → Icon licences and credits_.
