/**
 * i18n/en.ts — English translation strings.
 *
 * The base/fallback locale for the plugin. All translation keys are defined
 * here first; other locale files (e.g. he.ts) mirror this key set with their
 * own translated values. Imported by i18n/index.ts.
 */
export const en: Record<string, string> = {
	// Commands
	"cmd.openSettings": "Open settings",
	"cmd.createCallout": "Create new callout type",
	"cmd.insertEmptyCallout": "Insert empty callout",
	"cmd.calloutWrap": "Wrap in callout",
	"cmd.calloutUnwrap": "Unwrap from callout",
	"cmd.openQuickInsert": "Quick insert block callout",

	// Commands — names generated for the user's own commands. Obsidian adds
	// the "Callout Studio: " prefix itself, so these must not repeat it.
	"cmd.customWrapBlock": "Wrap in {{name}} block callout",
	"cmd.customInsertBlock": "Insert {{name}} block callout",
	"cmd.customInsertHeading": "Insert H{{level}} {{name}} heading callout",
	"cmd.customInsertInline": "Insert {{name}} inline callout",

	// Autocomplete
	"autocomplete.createNew": 'Create new callout: "{{name}}"',

	// Vault scan / fallback / delete
	"settings.fallbackTag": "Default",
	"settings.fallbackTagAuto": "Default fallback",
	"settings.rescanVault": "Re-scan vault",
	"settings.rescanVaultDesc":
		"Find unrecognized callout IDs used in notes and add them as fallback rows.",
	"settings.rescanVaultHintAction": "Scan now",
	"settings.rescanComplete":
		"Re-scan complete: {{count}} new callout(s) added.",
	"replaceModal.deleteWithoutReplaceSuffix": "(falls back to default)",
	"replaceModal.titleDelete": "Delete callout",
	"replaceModal.titleReplace": "Replace in vault",

	// First-run scan modal (shown once on first install for large vaults)
	"firstRun.title": "Find existing callouts in your vault?",
	"firstRun.body":
		"Callout Studio can scan your vault to discover callouts you already use, so they appear in your settings list and adopt your fallback style.",
	"firstRun.heavyVaultNote":
		"Your vault has {{count}} Markdown files — the scan may take a few seconds.",
	"firstRun.laterHint":
		"You can always run this later from Settings → Vault insights & maintenance → Re-scan vault.",
	"firstRun.scanNow": "Scan now",
	"firstRun.noThanks": "No thanks",
	"firstRun.autoScanComplete":
		"Callout Studio scanned your vault and added {{count}} callout(s).",
	"firstRun.scanning": "Scanning",

	// Welcome / splash screen (shown once on first load; reopen via header icon)
	"welcome.tooltip": "About Callout Studio",
	"welcome.title": "Welcome to Callout Studio",
	"welcome.tagline": "Your complete solution for managing Obsidian callouts.",
	"welcome.previewTitle": "See it in action",
	"welcome.sample":
		"Callout Studio lets you create callouts with a custom icon, colors, and name.\n\n" +
		"You can use the same callout in **three** different ways:\n\n" +
		"## [!tip] As a Heading Callout\n" +
		"To turn any heading into a callout-style heading, add `[!type]` right after the `#`s.\n\n" +
		"Want an Inline Callout like this [!warning]? Just add `[!type]` right in a sentence, without breaking your flow.\n\n" +
		"> [!note] Block Callout\n" +
		"> Of course, the classic callout works with the exact same syntax you're already used to: `> [!type]`.\n\n" +
		"There's a lot more Callout Studio has to offer! [Learn more]({{repoUrl}}).\n",

	// Delete-callout modal (trash button on user rows)
	"deleteModal.title": 'Delete callout "{{name}}"?',
	"deleteModal.bodyInUse":
		"This callout appears {{count}} time(s) across {{files}} file(s).",
	"deleteModal.bodyInUseExplain":
		"Deleting will convert those blocks to plain text — they will no longer be styled and will lose the callout header.",
	"deleteModal.replaceHint":
		"You can replace it with another callout instead, which keeps your vault content as a styled callout.",
	"deleteModal.bodyUnused":
		'"{{name}}" is not used in any note, but it is a custom callout you customized. Deleting will remove it from this list.',
	"deleteModal.replaceInstead": "Replace instead",
	"deleteModal.deleteInUse": "Delete (convert to plain text)",
	"deleteModal.deleteUnused": "Delete callout",

	// Settings — Section headings
	"settings.title": "Callout Studio",
	"settings.myCalloutTypes": "My callout types",
	"settings.builtInCallouts": "Built-in callouts",
	"settings.contextMenu": "Context menu",
	"settings.autocomplete": "Autocomplete",
	"settings.keyboardShortcuts": "Keyboard shortcuts",
	"settings.language": "Language",
	"settings.languageDesc":
		"Display language for Callout Studio. Defaults to Obsidian's interface language.",
	"settings.languageAuto": "Automatic (match Obsidian)",

	// Downloadable translations. English is built in; every other language is
	// fetched the first time it is needed and kept for later.
	"locale.downloading": "Downloading translation…",
	"locale.notDownloaded": "{{name}} is not downloaded yet",
	"locale.notDownloadedDesc":
		"Callout Studio is showing English until the translation can be downloaded. It will try again the next time Obsidian starts.",
	"locale.retry": "Retry",
	"locale.diskWriteFailed":
		"Callout Studio could not save the translation to disk, so it will need downloading again next time.",

	"settings.importExport": "Import / export",
	"settings.import": "Import",
	"settings.export": "Export",
	"settings.importDesc":
		"Import your Callout Studio progress from another vault, or bring your callouts over from a different plugin.",
	"settings.exportDesc":
		"Save your callouts as a Callout Studio backup, or as a CSS snippet you can use elsewhere.",
	"settings.importConflictNotice":
		"Imported {{count}} callout type(s); {{overwritten}} existing entry/entries were overwritten.",

	// Settings — Toolbar
	"settings.addNewCallout": "Add new callout",

	// Settings — Empty states
	"settings.noCalloutsNow": "No custom callouts for now.",

	// Settings — Row actions
	"settings.editAria": "Edit {{name}}",
	"settings.moreRowActionsAria": "More actions for {{name}}",
	"settings.usageInfo": "{{count}} use(s) in {{files}} file(s)",
	"settings.replaceAction": "Replace in vault",
	"settings.deleteAction": "Delete",
	"settings.resetAction": "Reset to default",
	"settings.makeFallbackAction": "Use default fallback style",
	"settings.colorSwatchAria": "Accent: {{accent}} · Background: {{bg}}",
	"settings.externalStyleTag": "External style",
	"settings.externalStyleAction": "Use external style (theme or CSS)",
	"settings.externalStyleBlocked":
		"this is the default fallback callout, pick a different one first",

	// Settings — Fallback callout
	"settings.fallbackCallout": "Default fallback callout",
	"settings.fallbackCalloutDesc":
		"Unrecognized callout types in your vault will inherit the style of this callout.",

	// Settings — Global style
	"settings.globalStyle": "Global callout style",
	"settings.border": "Borders",
	"settings.borderAll": "All",
	"settings.borderTop": "Top",
	"settings.borderRight": "Right",
	"settings.borderBottom": "Bottom",
	"settings.borderLeft": "Left",
	"settings.borderWidth": "Border thickness",
	"settings.fontScaleGroup": "Font scale",
	"settings.titleScale": "Title",
	"settings.contentScale": "Content",
	"settings.inlineTextScale": "Text",
	"settings.shapeGroup": "Shape",
	"settings.borderRadius": "Corner rounding",
	"settings.alignGroup": "Align",
	"settings.alignContent": "Align content with title",
	"settings.headingSpacingGroup": "Title spacing",
	"settings.headingPadVertical": "Vertical spacing",
	"settings.headingGap": "Spacing between headers",
	"settings.headingFoldGroup": "Fold",
	"settings.headingFoldArrow": "Show fold arrow",
	"settings.styleDemoName": "Example",
	"settings.previewTitle": "Preview",

	// Settings — Saved color palettes
	"settings.customPalettes": "Saved color palettes",
	"settings.newPalette": "New palette",
	"settings.customPalettesEmpty": "No saved palettes yet.",
	"settings.editPaletteAria": "Edit palette {{name}}",
	"settings.deletePaletteAria": "Delete palette {{name}}",
	"settings.deletePaletteConfirm":
		'Delete palette "{{name}}"?\nCallouts that use its colors are not affected.',

	// Settings — Autocomplete
	"settings.enableAutocomplete": "Enable [! Autocomplete",
	"settings.enableAutocompleteDesc":
		'Show suggestions when you type "[!" inside a block callout in the editor. Pick a callout type from the list to insert a complete callout header.',

	// Settings — Keyboard shortcuts
	"settings.customCommands": "Commands and shortcuts",
	"settings.customCommandsDesc":
		"See every Callout Studio command and the shortcut it is bound to, and create your own commands for the callouts you use most. No shortcuts are assigned by default.",
	"settings.customCommandsButton": "Manage commands",

	// Command builder
	"commandBuilder.title": "Commands and shortcuts",
	"commandBuilder.desc":
		"Use the + button to set or change a shortcut in Obsidian's hotkey settings.",
	"commandBuilder.builtIn": "Built-in commands",
	"commandBuilder.toggleAria": "Turn {{name}} on or off",
	"commandBuilder.hotkeyBlank": "Blank",
	"commandBuilder.hotkeyAria": "Set a shortcut for {{name}}",
	"commandBuilder.yourCommands": "Your commands",
	"commandBuilder.newCommand": "New command",
	"commandBuilder.empty": "No custom commands yet.",
	"commandBuilder.unknownCommand": "this command",
	"commandBuilder.editAria": "Edit {{name}}",
	"commandBuilder.deleteAria": "Delete {{name}}",
	"commandBuilder.deleteConfirm":
		"Delete the command {{name}}? Any shortcut assigned to it will stop working.",
	"commandBuilder.newTitle": "New command",
	"commandBuilder.editTitle": "Edit command",
	"commandBuilder.format": "Callout format",
	"commandBuilder.formatDesc": "Which kind of callout the command writes.",
	"commandBuilder.formatHeading": "Heading",
	"commandBuilder.formatInline": "Inline",
	"commandBuilder.formatBlock": "Block",
	"commandBuilder.roleDisabled":
		"This format is turned off, so the command will insert plain text until you switch it back on.",
	"commandBuilder.callout": "Callout type",
	"commandBuilder.calloutDesc": "The callout this command inserts.",
	"commandBuilder.headingLevel": "Heading level",
	"commandBuilder.headingLevelDesc": "Which heading level to write.",
	"commandBuilder.action": "Action",
	"commandBuilder.actionDesc":
		"Wrap turns the selection into a callout; insert adds an empty one.",
	"commandBuilder.actionWrap": "Wrap selection",
	"commandBuilder.actionInsert": "Insert new",
	"commandBuilder.preview": "Command name",
	"commandBuilder.duplicate":
		"You already have a command that does exactly this.",
	"commandBuilder.noCallouts":
		"There are no callout types to build a command from yet.",
	"commandBuilder.save": "Save",

	// Quick insert window (the ribbon icon). Block callouts only — the wording
	// has to say so, because the same list could plausibly be read as offering
	// heading and inline callouts too.
	"quickInsert.title": "Quick insert block callout",
	"quickInsert.desc":
		"Pick a callout to insert at the cursor. Block callouts only.",
	"quickInsert.searchPlaceholder": "Search callouts",
	"quickInsert.sourceAria": "Filter by callout source",
	"quickInsert.sourceAll": "All",
	"quickInsert.sourceBuiltIn": "Built-in",
	"quickInsert.sourceUser": "My callouts",
	"quickInsert.editAria": "Edit {{name}}",
	"quickInsert.insertAria": "Insert {{name}} as a block callout",
	"quickInsert.noResults": "No callouts found",
	"quickInsert.noUserCallouts": "You haven't created any callouts yet.",
	"quickInsert.noEditorHint":
		"No note is open in editing mode, so nothing can be inserted.",
	"quickInsert.noEditor": "Open a note in editing mode to insert a callout.",
	"quickInsert.readingViewHint":
		"This note is open in Reading view, so nothing can be inserted.",
	"quickInsert.readingView":
		"Switch to Source mode or Live Preview to insert a callout.",
	"quickInsert.noCursorHint":
		"There is no cursor in this note, so there is nowhere to insert.",
	"quickInsert.noCursor":
		"Place the cursor in the note where you want to insert the callout, then try again.",

	// Settings — Reset
	"settings.vaultMaintenance": "Vault insights & maintenance",
	"settings.vaultStats": "Callout statistics",
	"settings.vaultStatsDesc":
		"Count every callout in your Markdown notes — block, heading and inline — and group them by type.",
	"settings.vaultStatsButton": "View statistics",
	"settings.vaultStatsScanning": "Scanning",
	"settings.resetAll": "Reset",
	"settings.resetAllDesc":
		"Delete all user callouts, reset built-in callouts, global styles (borders, font scale, shape), saved color palettes, the right-click menu customization, and downloaded Material SVGs.",
	"settings.resetAllButton": "Reset everything",
	"settings.resetAllConfirm":
		"This will delete all custom callouts, reset built-in callouts, global styles, saved color palettes, the right-click menu customization, and all cached Material SVGs. This action cannot be undone. Are you sure?",
	"notice.resetAllDone": "Everything has been reset to defaults.",

	// Notices
	"notice.customCommandsRemoved":
		"Removed {{count}} custom command(s) whose callout type no longer exists.",
	"notice.customCommandMissingCallout":
		"That command's callout type no longer exists.",
	"notice.exported": "Callouts exported to callout-studio-export.json",
	"notice.exportedCssCreated": "CSS snippet saved to {{path}}",
	"notice.exportedCssUpdated": "CSS snippet updated at {{path}}",
	"notice.exportedCssUnchanged": "The CSS snippet is already up to date.",
	"notice.exportCssEmpty": "There are no custom callouts to export.",
	"notice.exportCssFailed":
		"Could not save the CSS snippet. Check the developer console for details.",
	"notice.exportCssEnabled":
		"This snippet is switched on in this vault. Callout Studio already styles these callouts here, and the snippet keeps the styling it had when you exported.",
	"notice.importedJSON": "Imported {{count}} callout type(s) from JSON.",
	"notice.importedSettings": "Imported plugin settings.",
	"notice.importedCalloutManager":
		"Imported from Callout Manager: {{created}} created, {{updated}} updated.",
	"notice.importedAdmonition":
		"Imported from Admonition: {{created}} created, {{updated}} updated.",
	"notice.noNewJSON":
		"No new callout types were imported (ids may already exist).",
	"notice.iconDownloadFailed":
		'Could not download Material icon "{{name}}". It may be unavailable for this style/weight, or your connection may be offline.',
	"notice.externalStyleOn":
		'"{{name}}" is now styled by your theme or CSS snippet.',
	"notice.externalStyleOff": 'Callout Studio styles "{{name}}" again.',
	"notice.nothingToWrap": "Nothing to wrap.",
	"notice.cursorNotInsideCallout": "Cursor is not inside a callout.",
	"notice.autocompleteTargetMoved":
		"Nothing was inserted — the line changed while the editor was open.",
	"notice.openHotkeysFailed": "Could not open Obsidian hotkeys settings.",
	"notice.filterHotkeysFailed":
		"Opened Obsidian hotkeys, but could not apply the Callout Studio filter.",

	// Callout Editor
	"editor.editCallout": "Edit callout",
	"editor.newCallout": "New callout",
	"editor.displayName": "Display name",
	"editor.displayNameDesc": "The human-readable label shown in the UI",
	"editor.displayNameBuiltIn":
		"Display name cannot be changed for built-in callouts",
	"editor.displayNamePlaceholder": "My callout",
	"editor.calloutIds": "Callout IDs",
	"editor.calloutIdsDesc":
		"All identifiers for this callout. Spaces are allowed.\nPress Enter or the + button to add.",
	"editor.calloutIdsPlaceholder": "Add ID",
	"editor.addId": "Add ID",
	"editor.idLinkedToName": "Linked to the display name",
	"editor.idCannotDelete":
		"This ID is linked to the display name and can't be deleted — edit the name to change it",
	"editor.icon": "Icon",
	"editor.pickIcon": "Change icon",
	"editor.replaceIcon": "Replace icon",
	"editor.removeIcon": "Remove icon",
	"editor.noIcon": "No icon",
	"editor.resetIcon": "Reset icon to default",
	"editor.livePreview": "Live preview",
	"editor.iconAdjustment": "Icon adjustment",
	"editor.picture": "Picture",
	"editor.size": "Size",
	"editor.horizontalOffset": "Horizontal offset",
	"editor.verticalOffset": "Vertical offset",
	"editor.colors": "Color",
	"editor.colorsDesc":
		"Sets this callout's border, background, and text colors.",
	"editor.resetColors": "Reset colors to default",
	"editor.paletteDeleted": "Deleted color",
	"editor.paletteGroupObsidian": "Obsidian callouts",
	"editor.paletteGroupPresets": "Color presets",
	"editor.paletteGroupCustom": "Custom",
	"editor.paletteNewColor": "New color…",
	"editor.contrastWarning":
		"Low contrast against the background — may be hard to read",
	"editor.foldable": "Foldable",
	"editor.foldableDesc":
		"Choose whether the callout can be folded and which default state to apply across the vault.",
	"editor.foldOff": "Off",
	"editor.foldOpen": "Open by default",
	"editor.foldClosed": "Closed by default",
	"editor.cancel": "Cancel",
	"editor.saveChanges": "Save changes",
	"editor.createCallout": "Create callout",
	"editor.nameRequired":
		"A display name is required before creating a callout.",
	"editor.noChangesToSave": "No changes were made.",
	"editor.downloadingIcon": "Downloading icon",
	"editor.idEmpty": "At least one ID is required",
	"editor.idExists": "A callout with this ID already exists",
	"editor.idConflict": "This ID conflicts with an existing callout",
	"editor.idDashConflict":
		'Obsidian writes spaces as dashes, so this ID collides with "{{other}}"',
	"editor.untitledCallout": "Untitled Callout",
	"editor.loremIpsum":
		"Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris.",
	"editor.loremIpsumShort":
		"Lorem ipsum dolor sit amet, consectetur adipiscing elit.",
	"editor.sampleInlineText":
		"Here is an inline [!{id}] callout inside a paragraph.",
	"editor.previewReadOnly": "The live preview can't be edited",

	// External style window (opens instead of the editor for a callout the
	// user handed to their theme / a CSS snippet)
	"editor.externalStyleTitle": "Styled outside Callout Studio",
	"editor.externalStyleBody":
		"Callout Studio isn't applying any style to {{id}}. Its look comes from your theme, a CSS snippet, or Obsidian's defaults.",
	"editor.externalStyleWhat": "What this means",
	"editor.externalStyleWhatHeading":
		"A Heading Callout like ## [!{{id}}] Title won't be rendered — the text just stays as written.",
	"editor.externalStyleWhatInline":
		"Neither will an Inline Callout, like word [!{{id}}] word.",
	"editor.externalStyleWhatGlobal":
		"Global style settings (border, radius, text size) don't apply to it.",
	"editor.externalStylePreviewTitle": "How it renders now",
	"editor.externalStyleSample":
		"## [!{{id}}] Title\n\n" +
		"This is what a sentence with [!{{id}}] in it looks like.\n\n" +
		"> [!{{id}}] {{name}}\n" +
		"> This is what the callout's content looks like.\n",
	"editor.externalStyleResume": "Take back styling",
	"editor.externalStyleClose": "Got it",

	// Palette editor modal
	"palette.newTitle": "New color palette",
	"palette.editTitle": "Edit color palette",
	"palette.groupPalette": "Palette",
	"palette.name": "Name",
	"palette.namePlaceholder": "My palette",
	"palette.nameExists": "A palette with this name already exists",
	"palette.baseColor": "Base color",
	"palette.baseColorHint":
		"We'll automatically match the background color to it. If you'd like, you can control it separately by {{link}}.",
	"palette.baseColorHintLink": "clicking here",
	// Doubles as the title of the palette editor's "Colors" card, which holds
	// the simple Base color row as well as the advanced per-channel grid.
	"palette.advancedColors": "Colors",
	"palette.advancedColorsHint":
		"Editing colors for {{mode}} mode - the other mode updates automatically. Switch Obsidian's theme to check it.",
	"palette.revertHint": "Prefer a single base color instead? {{link}}.",
	"palette.revertHintLink": "Revert",
	"palette.lightMode": "Light",
	"palette.darkMode": "Dark",
	"palette.accentColor": "Accent color",
	"palette.backgroundColorChannel": "Background color",
	"palette.textColorChannel": "Text color",
	"palette.bgIntensity": "Intensity",
	"palette.bgStyle": "Style",
	"palette.bgSolid": "Solid",
	"palette.bgGradient": "Gradient",
	"palette.bgTransparent": "Transparent",
	"palette.gradientTo": "Second color",
	"palette.gradientDirection": "Direction",
	"palette.gradientText": "Gradient title text",
	"palette.save": "Save",

	// Color name suggestions (used to prefill palette names)
	"colorName.red": "Red",
	"colorName.orange": "Orange",
	"colorName.amber": "Amber",
	"colorName.yellow": "Yellow",
	"colorName.lime": "Lime",
	"colorName.green": "Green",
	"colorName.teal": "Teal",
	"colorName.cyan": "Cyan",
	"colorName.sky": "Sky",
	"colorName.blue": "Blue",
	"colorName.indigo": "Indigo",
	"colorName.violet": "Violet",
	"colorName.purple": "Purple",
	"colorName.pink": "Pink",
	"colorName.rose": "Rose",
	"colorName.brown": "Brown",
	"colorName.gray": "Gray",
	"colorName.black": "Black",
	"colorName.white": "White",
	"colorName.crimson": "Crimson",
	"colorName.coral": "Coral",
	"colorName.grape": "Grape",
	"colorName.plum": "Plum",
	"colorName.bubblegum": "Bubblegum",

	// Icon Picker
	"iconPicker.pickIcon": "Pick an icon",
	"iconPicker.confirm": "Confirm",
	"iconPicker.cancel": "Cancel",
	"iconPicker.lucide": "Lucide",
	"iconPicker.tabler": "Tabler Icons",
	"iconPicker.material": "Material",
	"iconPicker.emoji": "Emoji",
	"iconPicker.searchLucide": "Search Lucide icons",
	"iconPicker.searchTabler": "Search Tabler icons",
	"iconPicker.tablerStyle": "Icon style",
	"iconPicker.tablerStyleOutline": "Outline",
	"iconPicker.tablerStyleFilled": "Filled",
	"iconPicker.loadMore": "Load more",
	"iconPicker.materialStyle": "Icon style",
	"iconPicker.materialStyleOutlined": "Outlined",
	"iconPicker.materialStyleFilled": "Filled",
	"iconPicker.materialStyleRounded": "Rounded",
	"iconPicker.materialStyleSharp": "Sharp",
	"iconPicker.materialWeight": "Icon weight",
	"iconPicker.materialWeight100": "Thin",
	"iconPicker.materialWeight200": "Extra Light",
	"iconPicker.materialWeight300": "Light",
	"iconPicker.materialWeight400": "Regular",
	"iconPicker.materialWeight500": "Medium",
	"iconPicker.materialWeight600": "Semi Bold",
	"iconPicker.materialWeight700": "Bold",
	"iconPicker.materialFontFailed":
		"Couldn't load the Material icon previews. Icon names are shown instead — searching and picking still work.",
	"iconPicker.materialFontRetry": "Try again",
	"iconPicker.searchMaterial": "Search Material icons",
	"iconPicker.searchEmoji": "Search emojis",
	"iconPicker.skinTone": "Skin tone",
	"iconPicker.allCategories": "All categories",
	"iconPicker.noIconSelected": "No icon selected",
	"iconPicker.noResults": "No icons match your search.",
	"iconPicker.octicons": "Octicons",
	"iconPicker.searchOcticons": "Search Octicons",
	"iconPicker.fa": "Font Awesome",
	"iconPicker.searchFa": "Search Font Awesome",
	"iconPicker.faStyle": "Icon style",
	"iconPicker.faStyleSolid": "Solid",
	"iconPicker.faStyleRegular": "Regular",
	"iconPicker.faStyleBrands": "Brands",
	"iconPicker.rpgAwesome": "RPG Awesome",
	"iconPicker.searchRpgAwesome": "Search RPG Awesome",
	"iconPicker.image": "Your images",
	"iconPicker.searchImage": "Search your images",
	"iconPicker.imageTooLarge":
		"{{name}} is too large. Pictures must be under 5 MB.",
	"iconPicker.imageUnsupported":
		"{{name}} is not a supported picture. Use SVG, PNG, JPEG or WebP.",
	"iconPicker.imageInvalidSvg":
		"{{name}} could not be read as a safe SVG, so it was not added.",
	"iconPicker.imageDecodeFailed": "{{name}} could not be read as a picture.",
	"iconPicker.imageDuplicate":
		"{{name}} is already in your images. Rename the file, or delete the " +
		"picture you already have.",
	"iconPicker.imageAdd": "Add images",
	"iconPicker.imageEmpty":
		"No pictures yet. Add an SVG, PNG, JPEG or WebP file from your computer, " +
		"or drop one here.",
	"iconPicker.imageDelete": "Delete",
	"iconPicker.imageDeleteConfirm": "Delete “{{name}}”?",
	"iconPicker.imageDeleteInUse":
		"{{count}} callouts use this picture. They will fall back to a " +
		"placeholder icon until you give them a new one.",
	"iconPicker.imageRecolor": "Follow callout color",
	"iconPicker.allSources": "All sources",
	"iconPicker.searchAllSources": "Search all icon sources",
	"iconPicker.sourcesNotDownloaded":
		"Not included yet: {{names}}. Pick a source above to download it.",
	"iconPicker.chooseSource": "Choose source",
	"iconPicker.sourceGroup": "{{name}} · {{count}}",

	// Source menu — what each library holds, in a few words
	"iconPicker.descAllSources": "search every library at once",
	"iconPicker.descLucide": "Obsidian's own set, always offline",
	"iconPicker.descTabler":
		"clean and consistent UI icons, outline and filled",
	"iconPicker.descMaterial": "Google's set, four styles and seven weights",
	"iconPicker.descEmoji": "colour glyphs, every skin tone",
	"iconPicker.descOcticons": "GitHub's interface icons",
	"iconPicker.descFa": "solid, regular and brand marks",
	"iconPicker.descRpgAwesome": "fantasy and tabletop icons",
	"iconPicker.descImage": "pictures you add from your computer",

	// Icon picker — category filter dropdown labels
	"iconPicker.cat.Accessibility": "Accessibility",
	"iconPicker.cat.Actions": "Actions",
	"iconPicker.cat.Activities": "Activities",
	"iconPicker.cat.Alert": "Alert",
	"iconPicker.cat.Alphabet": "Alphabet",
	"iconPicker.cat.Android": "Android",
	"iconPicker.cat.Animals": "Animals",
	"iconPicker.cat.Arrows": "Arrows",
	"iconPicker.cat.Astronomy": "Astronomy",
	"iconPicker.cat.Audio&Video": "Audio & Video",
	"iconPicker.cat.Automotive": "Automotive",
	"iconPicker.cat.Badges": "Badges",
	"iconPicker.cat.Brand": "Brand",
	"iconPicker.cat.Buildings": "Buildings",
	"iconPicker.cat.Business": "Business",
	"iconPicker.cat.Camping": "Camping",
	"iconPicker.cat.Charity": "Charity",
	"iconPicker.cat.Charts": "Charts",
	"iconPicker.cat.Charts + Diagrams": "Charts + Diagrams",
	"iconPicker.cat.Childhood": "Childhood",
	"iconPicker.cat.Clothing + Fashion": "Clothing + Fashion",
	"iconPicker.cat.Coding": "Coding",
	"iconPicker.cat.Communicate": "Communicate",
	"iconPicker.cat.Communication": "Communication",
	"iconPicker.cat.Computers": "Computers",
	"iconPicker.cat.Connectivity": "Connectivity",
	"iconPicker.cat.Construction": "Construction",
	"iconPicker.cat.Currencies": "Currencies",
	"iconPicker.cat.Database": "Database",
	"iconPicker.cat.Design": "Design",
	"iconPicker.cat.Development": "Development",
	"iconPicker.cat.Devices": "Devices",
	"iconPicker.cat.Devices + Hardware": "Devices + Hardware",
	"iconPicker.cat.Disaster + Crisis": "Disaster + Crisis",
	"iconPicker.cat.Document": "Document",
	"iconPicker.cat.E-commerce": "E-commerce",
	"iconPicker.cat.Editing": "Editing",
	"iconPicker.cat.Education": "Education",
	"iconPicker.cat.Electrical": "Electrical",
	"iconPicker.cat.Emoji": "Emoji",
	"iconPicker.cat.Energy": "Energy",
	"iconPicker.cat.Extensions": "Extensions",
	"iconPicker.cat.Files": "Files",
	"iconPicker.cat.Film + Video": "Film + Video",
	"iconPicker.cat.Food": "Food",
	"iconPicker.cat.Food + Beverage": "Food + Beverage",
	"iconPicker.cat.Fruits + Vegetables": "Fruits + Vegetables",
	"iconPicker.cat.Games": "Games",
	"iconPicker.cat.Gaming": "Gaming",
	"iconPicker.cat.Gender": "Gender",
	"iconPicker.cat.Genders": "Genders",
	"iconPicker.cat.Gestures": "Gestures",
	"iconPicker.cat.Halloween": "Halloween",
	"iconPicker.cat.Hands": "Hands",
	"iconPicker.cat.Hardware": "Hardware",
	"iconPicker.cat.Health": "Health",
	"iconPicker.cat.Holidays": "Holidays",
	"iconPicker.cat.Home": "Home",
	"iconPicker.cat.Household": "Household",
	"iconPicker.cat.Humanitarian": "Humanitarian",
	"iconPicker.cat.Images": "Images",
	"iconPicker.cat.Laundry": "Laundry",
	"iconPicker.cat.Letters": "Letters",
	"iconPicker.cat.Logic": "Logic",
	"iconPicker.cat.Logistics": "Logistics",
	"iconPicker.cat.Map": "Map",
	"iconPicker.cat.Maps": "Maps",
	"iconPicker.cat.Maritime": "Maritime",
	"iconPicker.cat.Marketing": "Marketing",
	"iconPicker.cat.Math": "Math",
	"iconPicker.cat.Mathematics": "Mathematics",
	"iconPicker.cat.Media": "Media",
	"iconPicker.cat.Media Playback": "Media Playback",
	"iconPicker.cat.Medical + Health": "Medical + Health",
	"iconPicker.cat.Money": "Money",
	"iconPicker.cat.Mood": "Mood",
	"iconPicker.cat.Moving": "Moving",
	"iconPicker.cat.Music + Audio": "Music + Audio",
	"iconPicker.cat.Nature": "Nature",
	"iconPicker.cat.Numbers": "Numbers",
	"iconPicker.cat.Photography": "Photography",
	"iconPicker.cat.Photos + Images": "Photos + Images",
	"iconPicker.cat.Political": "Political",
	"iconPicker.cat.Privacy": "Privacy",
	"iconPicker.cat.Punctuation + Symbols": "Punctuation + Symbols",
	"iconPicker.cat.Religion": "Religion",
	"iconPicker.cat.Science": "Science",
	"iconPicker.cat.Science Fiction": "Science Fiction",
	"iconPicker.cat.Security": "Security",
	"iconPicker.cat.Shapes": "Shapes",
	"iconPicker.cat.Shopping": "Shopping",
	"iconPicker.cat.Social": "Social",
	"iconPicker.cat.Spinners": "Spinners",
	"iconPicker.cat.Sport": "Sport",
	"iconPicker.cat.Sports + Fitness": "Sports + Fitness",
	"iconPicker.cat.Symbols": "Symbols",
	"iconPicker.cat.System": "System",
	"iconPicker.cat.Text": "Text",
	"iconPicker.cat.Text Formatting": "Text Formatting",
	"iconPicker.cat.Time": "Time",
	"iconPicker.cat.Toggle": "Toggle",
	"iconPicker.cat.Transit": "Transit",
	"iconPicker.cat.Transportation": "Transportation",
	"iconPicker.cat.Travel": "Travel",
	"iconPicker.cat.Travel + Hotel": "Travel + Hotel",
	"iconPicker.cat.UI actions": "UI actions",
	"iconPicker.cat.Users + People": "Users + People",
	"iconPicker.cat.Vehicles": "Vehicles",
	"iconPicker.cat.Version control": "Version control",
	"iconPicker.cat.Weather": "Weather",
	"iconPicker.cat.Writing": "Writing",
	"iconPicker.cat.Zodiac": "Zodiac",

	// Downloadable icon packs
	"iconPack.downloadTitle": "{{name}} is not downloaded yet",
	"iconPack.downloadDetail": "{{count}} icons · {{size}} · one-time download",
	"iconPack.download": "Download",
	"iconPack.downloading": "Downloading {{name}}…",
	"iconPack.downloadFailed":
		"Could not download {{name}}. Check your connection and try again.",
	"iconPack.retry": "Retry",
	"iconPack.faBrandsNotice":
		"Brand icons are trademarks of their respective owners. Their inclusion does not indicate endorsement. Please use them only to represent the company, product, or service they refer to.",
	"iconPack.artworkRestored": "Downloaded the icon artwork for {{names}}.",
	"iconPack.diskWriteFailed":
		"Callout Studio could not save the icon pack to disk, so it will need downloading again next time. The icons you pick are still saved with your settings.",

	// Icon licences & credits
	"credits.title": "Icon licences and credits",
	"credits.intro":
		"Callout Studio draws on several open icon libraries. Their licences are reproduced below, along with what was changed to use them here.",
	"credits.fullNotices": "Full third-party notices",
	"credits.pluginLicense":
		"Callout Studio's own code is under a permissive license; the icon libraries keep their own licences.",

	// Context Menu
	"contextMenu.editCallout": "Edit callout settings",
	"contextMenu.copyMarkdown": "Copy callout Markdown",
	"contextMenu.openSettings": "Open Callout Studio settings",
	"contextMenu.setFoldClosed": "Set callout closed (-)",
	"contextMenu.setFoldOpen": "Set callout open (+)",
	"contextMenu.setFoldNone": "Make callout non-collapsible",
	"contextMenu.cutSection": "Cut heading section",
	"contextMenu.copySection": "Copy heading section",
	"contextMenu.deleteSection": "Delete heading section",

	// Heading callouts
	"heading.toggleFold": "Toggle fold",

	// Global settings section (per-role style popups)
	"settings.globalSettings": "Global settings",
	"settings.globalSettingsRegularDesc":
		"Add a callout token to a block callout (e.g., `> [!type]`) to render Obsidian's native callout box. You can adjust its border, radius, font scale, and alignment.",
	"settings.globalSettingsHeadingDesc":
		"Add a callout token directly after the heading hashes (e.g., `## [!type]`) to render it as a styled callout heading. You can adjust its border, shape, and vertical spacing.",
	"settings.globalSettingsInlineDesc":
		"Add a callout token anywhere inside a line of text (e.g., `[!type]`) to render it as a small inline callout. You can adjust its border and shape.",
	"settings.globalSettingsCustomize": "Customize",

	// Callout types section
	"settings.calloutTypeRegular": "Block callout",
	"settings.calloutTypeHeading": "Heading callout",
	"settings.calloutTypeInline": "Inline callout",

	// Context menu customization
	"settings.customizeMenu": "Customize menu items",
	"settings.customizeMenuDesc":
		"Choose which right-click actions appear for each callout type and reorder them. Works in source mode and Live Preview.",
	"settings.customizeMenuButton": "Customize menu items",
	"menuCustomize.title": "Customize right-click menu",
	"menuCustomize.desc":
		"Toggle actions on or off and drag the handle to reorder them. Changes are saved automatically.",
	"menuCustomize.regular": "Block callout",
	"menuCustomize.heading": "Heading callout",
	"menuCustomize.inline": "Inline callout",
	"menuCustomize.dragHandle": "Drag to reorder",
	"menuItem.edit": "Edit callout",
	"menuItem.openSettings": "Open settings",
	"menuItem.copyMarkdown": "Copy Markdown",
	"menuItem.foldDefaults": "Fold defaults (open / closed / none)",
	"menuItem.cutSection": "Cut section",
	"menuItem.copySection": "Copy section",
	"menuItem.deleteSection": "Delete section",

	// Confirm modal
	"confirm.ok": "Delete",
	"confirm.cancel": "Cancel",
	// Headings for each confirmation — every window carries one, so each
	// caller of ConfirmModal names what it is about to do.
	"confirm.titleDeleteCommand": "Delete command",
	"confirm.titleResetAll": "Reset all callouts",
	"confirm.titleResetCallout": "Reset callout",
	"confirm.titleDeletePalette": "Delete palette",
	"confirm.titleDeleteImage": "Delete image",
	"confirm.titleOverwriteSnippet": "Overwrite CSS snippet",
	"confirm.overwriteSnippet":
		"The CSS snippet in your snippets folder has changed since Callout Studio wrote it. Exporting again replaces the whole file.",
	"confirm.overwriteSnippetOk": "Overwrite",

	// Vault edge-case modals
	"vault.filesUpdated":
		"Updated {{count}} callout reference(s) in vault files.",
	"vault.idsUpdated":
		"Updated {{count}} callout ID(s) in vault files: {{oldIds}} → {{newId}}",
	"vault.titlesUpdated":
		"Updated {{count}} callout title(s) in vault files: {{oldTitle}} → {{newTitle}}",
	"vault.replaceWith": "Replace with:",
	"vault.deleteWithout": "Delete without replacing",
	"vault.confirmDelete": "Confirm",
	"vault.confirmReplace": "Replace",
	"vault.replacePromptInUse":
		'"{{name}}" is used {{count}} time(s) in {{files}} file(s). Pick a callout to replace it with:',
	"vault.replacePromptUnused": 'Pick a callout to replace "{{name}}" with:',
	"vault.noReplacementAvailable":
		"No other callouts are available to replace this one.",
	"vault.convertedToPlainText":
		"Converted {{blocks}} callout block(s) in {{files}} file(s) to plain text.",
	"vault.resetAliasWarning":
		"{{count}} reference(s) in {{files}} file(s) use custom alias(es): {{aliases}}. These will stop working after reset. Continue?",
	"vault.resetConfirm": "Reset",
	"vault.resetAllInUse":
		"⚠ {{count}} callout reference(s) in {{files}} file(s) use custom callout types that will be deleted.",

	// Vault statistics modal
	"vaultStats.title": "Callout statistics",
	"vaultStats.totalCallouts": "Total callouts",
	"vaultStats.typesFound": "Types found",
	"vaultStats.filesWithCallouts": "Files with callouts",
	"vaultStats.filesScanned": "Markdown files scanned",
	"vaultStats.empty": "No callouts were found in Markdown notes.",
	"vaultStats.columnType": "Type",
	"vaultStats.columnFiles": "Files",
	"vaultStats.sourceAlias": "Alias of {{id}}",
	"vaultStats.sourceUnknown": "Not defined",
	// Retained unused. The report is three columns now — type, how it is written
	// (`byRole`) and files — so the Name, Source and Count headers are gone with
	// their columns, `unknown` went when an unresolved row started being named
	// after its own id, and of the six source labels only the two above survive,
	// as a tag beside the id. Deleting an English key while the 31 generated
	// locale files still carry it fails their "no key English lacks" check until
	// the next translation pass, and the strings cost nothing to keep.
	"vaultStats.unknown": "Unknown",
	"vaultStats.columnName": "Name",
	"vaultStats.columnSource": "Source",
	"vaultStats.columnCount": "Count",
	"vaultStats.sourceBuiltIn": "Built-in",
	"vaultStats.sourceCustom": "Custom",
	"vaultStats.sourceAutoFallback": "Auto fallback",
	"vaultStats.sourceTheme": "CSS snippet",
	"vaultStats.byRole": "Written as",
	"vaultStats.roleBlock": "Block",
	"vaultStats.roleHeading": "Heading",
	"vaultStats.roleInline": "Inline",
	"vaultStats.defineUndefined": "Define {{count}} missing",
	"vaultStats.defineRunning": "Scanning",
	"vaultStats.defineDone": "Added {{count}} callout types.",
	"vaultStats.close": "Close",

	// Import validation
	"import.title": "Import issues",
	"import.reportLeadIn":
		"Hmm, looks like the file you imported has been modified. Here is the list of issues:",
	"import.reportLeadInFatal":
		"Hmm, this file does not look like a Callout Studio export. It cannot be imported:",
	"import.entryHeading": "Entry {{index}} — {{label}}",
	"import.summary":
		"{{valid}} of {{total}} entries are valid · {{issues}} issue(s) found.",
	"import.btnCancel": "Cancel",
	"import.btnImportValid": "Import valid only ({{count}})",
	"import.err.notRecognized":
		"Unrecognized file: expected a callout definitions array or a Callout Studio export.",
	"import.warn.settingsIgnored":
		"The settings block was not a valid object and was ignored.",
	"import.warn.invalidGradient":
		"The background gradient was invalid and was ignored.",
	"import.err.parseFailed":
		"The file is not valid JSON and could not be parsed.",
	"import.err.entryNotObject": "Entry must be an object.",
	"import.err.requiredMissing":
		'Required field "{{field}}" is missing or has the wrong type.',
	"import.err.idEmpty": "ID must not be empty.",
	"import.err.idTooLong":
		'ID "{{value}}" is {{length}} characters; the maximum is {{max}}.',
	"import.err.idBadChar":
		'ID "{{value}}" contains invalid characters ("|", "[", "]", tabs, and line breaks are not allowed).',
	"import.err.idMetadata":
		'ID "{{value}}" contains a "|". In Obsidian everything after the first "|" is callout metadata, not part of the type, so this entry describes the "{{id}}" callout. Skipped, so your existing "{{id}}" is left untouched.',
	"import.err.displayNameEmpty": "Display name must not be empty.",
	"import.err.displayNameTooLong":
		"Display name is {{length}} characters; the maximum is {{max}}.",
	"import.err.boolField": '"{{field}}" must be a boolean (true or false).',
	"import.err.iconNotObject": "Icon must be an object.",
	"import.err.iconTypeInvalid":
		'Icon type "{{value}}" is not one of: {{types}}.',
	"import.warn.iconFieldIgnored":
		'"{{field}}" only applies to Material icons and is ignored for icon type {{type}}.',
	"import.err.iconValueEmpty": "Icon value must be a non-empty string.",
	"import.err.iconValueTooLong":
		"Icon value is unusually long ({{length}} characters).",
	"import.err.materialStyle":
		'Material icon style "{{value}}" is not one of: outlined, filled, rounded, sharp.',
	"import.err.materialWeight":
		'Material icon weight "{{value}}" must be an integer between 100 and 700, in steps of 100.',
	"import.warn.iconRecolorIgnored":
		'"recolor" only applies to your own pictures and is ignored for icon type {{type}}.',
	"import.err.iconRecolorInvalid":
		'"recolor" must be true or false (got "{{value}}").',
	"import.err.colorInvalid":
		'"{{field}}" must be a hex color like "#448aff" (got "{{value}}").',
	"import.err.numberRange":
		'"{{field}}" must be a number between {{min}} and {{max}} (got "{{value}}").',
	"import.err.iconSizeRange":
		'"{{field}}" must be a number between {{min}} and {{max}} (got "{{value}}").',
	"import.err.iconAdjustShape":
		'"iconAdjust" must be an object mapping a callout type ("block", "heading", "inline") to its icon size and offsets.',
	"import.err.aliasesNotArray": '"aliases" must be an array of strings.',
	"import.err.aliasNotString": "Alias must be a string.",
	"import.err.aliasDup": 'Alias "{{value}}" is duplicated within this entry.',
	"import.err.tooManyIds":
		"Too many IDs ({{count}}); each callout can have at most {{max}} IDs (primary + aliases).",
	"import.err.metadataShape":
		'"metadata" must be an object whose values are all strings.',
	"import.warn.unknownFields": "Unknown field(s) ignored: {{fields}}.",
	"import.err.duplicateInFile":
		'ID/alias "{{value}}" is already used by entry #{{first}} in this file.',
	"import.err.aliasConflict":
		'Alias "{{value}}" is already used by another callout ("{{other}}") in your vault.',
	"import.warn.defaultFoldedAutofix":
		'"defaultFolded" was true while "foldable" was false; defaultFolded was reset to false.',
	"import.warn.imageMissing":
		"This callout uses a picture that is not in the file and not in this " +
		"vault, so it will show a placeholder icon until you give it a new one.",
	"import.err.paletteIdInvalid":
		'"paletteId" must be a non-empty text ID (got "{{value}}").',
	"import.warn.iconNameUnknown":
		'There is no "{{value}}" icon in {{type}}, so the default icon was used instead.',
	// Not necessarily a typo: Callout Manager lets you pick any icon Obsidian
	// knows about, which includes ones other plugins register — so the name can
	// be perfectly real and simply belong to a plugin this vault does not have.
	"import.warn.cmIconUnknownNew":
		'The "{{value}}" icon is not available in this vault, so the default icon was used instead.',
	"import.warn.cmIconUnknownExisting":
		'The "{{value}}" icon is not available in this vault, so "{{id}}" kept the icon it already had.',

	// Import — source chooser
	"import.chooseSource": "Import from",
	"import.sourceStudio": "Callout Studio",
	"import.sourceStudioDesc":
		"Load a .json file exported from Callout Studio.",
	"import.sourceCalloutManager": "Callout Manager",
	"import.sourceCalloutManagerDesc":
		"Bring your customized callouts over from the Callout Manager plugin.",
	"import.sourceAdmonition": "Admonition",
	"import.sourceAdmonitionDesc":
		"Bring your custom admonitions over from the Admonition plugin.",

	// Export — format chooser
	"export.chooseFormat": "Export as",
	"export.formatJson": "Callout Studio backup",
	"export.formatJsonDesc":
		"A .json file with your callouts and settings, for importing into another vault.",
	"export.formatCss": "CSS snippet",
	"export.formatCssDesc":
		"A .css file saved into this vault's snippets folder, for use where Callout Studio isn't installed. It covers regular callouts only, and is a snapshot — export again after you change a callout.",

	// Import — Callout Manager
	"import.cmTitle": "Import from Callout Manager",
	"import.cmInstructions":
		"Each customized callout comes over with its icon and color. Per-theme " +
		"styling and custom CSS have no equivalent here and are left behind.",
	"import.cmFromVault": "This vault",
	"import.cmVaultChecking": "Looking for the Callout Manager plugin…",
	"import.cmVaultFound": "{{count}} customized callout(s) found.",
	"import.cmVaultNotFound":
		"No customized callouts were found in this vault.",
	"import.cmPasteLabel": "Or paste Callout Manager's copied styles here:",
	"import.cmPlaceholder": "Paste the copied styles, or a data.json, here…",
	"import.cmBtnCancel": "Cancel",
	"import.cmBtnImport": "Import",
	"import.err.cmNoBlocksFound":
		"No Callout Manager styles were found in the pasted text.",
	"import.err.cmNotRecognized":
		"Unrecognized file: expected the styles Callout Manager's Copy button " +
		"produces, or a Callout Manager data.json.",
	"import.err.cmNoEntries": "No customized callouts were found to import.",
	"import.err.cmNoColorForNew":
		'No usable color was found for the new callout "{{value}}"; it was skipped.',
	"import.err.cmIdConflict":
		'ID "{{value}}" is already used as an alias by another callout ("{{other}}") and was skipped.',
	"import.warn.cmNoColorDefault":
		"No color was set in Callout Manager, so its default gray was used.",
	"import.warn.cmThemeCondition":
		"This callout's color or icon was set for one theme only. Callout " +
		"Studio has no per-theme styling, so it was brought over for every theme.",
	"import.warn.cmCustomStyles":
		"This callout also has custom CSS in Callout Manager. That styling is " +
		"not part of the import, so only its icon and color came over.",

	// Import — Admonition
	"import.admTitle": "Import from Admonition",
	"import.admInstructions":
		"Each admonition comes over as a callout with its name, icon, and " +
		"color. Settings Callout Studio has no equivalent for (command, copy " +
		"button, hidden title) are left behind.",
	"import.admFromVault": "This vault",
	"import.admVaultChecking": "Looking for the Admonition plugin…",
	"import.admVaultFound": "{{count}} custom admonition(s) found.",
	"import.admVaultNotFound":
		"No custom admonitions were found in this vault.",
	"import.admFromFile": "A file",
	"import.admFromFileDesc": "An admonitions.json file, or a shared pack.",
	"import.admChooseFile": "Choose file…",
	"import.admPasteLabel": "Or paste the JSON here:",
	"import.admPlaceholder": "Paste your admonitions here…",
	"import.admBtnCancel": "Cancel",
	"import.admBtnImport": "Import",
	"import.err.admNotRecognized":
		"Unrecognized file: expected a list of admonitions, or an Admonition " +
		"data.json.",
	"import.err.admNoEntries": "No admonitions were found to import.",
	"import.err.admTypeMissing":
		'This admonition has no "type" and was skipped.',
	"import.warn.admIconUnknown":
		'No icon named "{{value}}" was found in any icon library, so the default icon was used instead.',
	"import.warn.admIconUnknownExisting":
		'No icon named "{{value}}" was found in any icon library, so "{{id}}" kept the icon it already had.',
	"import.warn.admImageFailed":
		"The uploaded picture could not be read, so the default icon was used instead.",
	"import.warn.admIconWithCss":
		"This admonition is styled by a CSS snippet in Admonition. That styling " +
		"is not part of the import, so only its name, icon, and color came over.",
	"import.warn.admNoColor": "No color was set, so the default blue was used.",
	"import.warn.admTitleTruncated":
		"The title is {{length}} characters; it was shortened to {{max}}.",

	// Footer
	"footer.tagline":
		"Have feedback, comments, or suggestions? I'd love to hear from you!",
	"settings.deletePaletteConfirmLinkedOne":
		'Delete palette "{{name}}"?\n1 callout uses it. It keeps its colors, and you can reconnect it later from the Color row in its editor.',
	"settings.deletePaletteConfirmLinked":
		'Delete palette "{{name}}"?\n{{count}} callouts use it. They keep their colors, and you can reconnect them later from the Color row in any of their editors.',
	"settings.unlinkedColors": "Unlinked colors",
	"settings.unlinkedColorsDesc":
		"Callouts whose saved color was deleted. They keep the colors they had; restoring saves the color again and reconnects the whole group.",
	"settings.unlinkedColorOne": "1 callout",
	"settings.unlinkedColorCount": "{{count}} callouts",
	"settings.restoreColor": "Restore",
	"settings.palettesMergedNotice":
		"Merged {{count}} imported palette(s) into saved colors that already had the same colors.",
	"notice.palettesMerged":
		"Merged {{count}} saved color(s) that had identical colors: {{names}}. The callouts using them keep their colors and are now linked to the color that remains.",
	"editor.colorsDescDeleted":
		"This callout's saved color was deleted. You can save it again by {{link}}.",
	"editor.colorsDescDeletedOther":
		"This callout's saved color was deleted. You can save it again by {{link}} — 1 other callout using it will be reconnected too.",
	"editor.colorsDescDeletedOthers":
		"This callout's saved color was deleted. You can save it again by {{link}} — {{count}} other callouts using it will be reconnected too.",
	"editor.colorsDescDeletedLink": "clicking here",
	"palette.colorExists":
		'These colors are identical to "{{name}}". Two saved colors cannot be the same — change a color to tell them apart.',
	"palette.colorExistsUse":
		'These colors are identical to "{{name}}". Two saved colors cannot be the same — change a color, or {{link}}.',
	"palette.colorExistsUseLink": "use the existing one",
	"footer.madeBy": "Made by Niv  •  ",
};
