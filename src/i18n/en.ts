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
	// The fold word is part of the sentence rather than a suffix glued on in
	// code, so a translation can put it wherever its grammar wants it.
	"cmd.customWrapBlockExpanded": "Wrap in {{name}} block callout (expanded)",
	"cmd.customWrapBlockCollapsed": "Wrap in {{name}} block callout (collapsed)",
	"cmd.customInsertBlockExpanded": "Insert {{name}} block callout (expanded)",
	"cmd.customInsertBlockCollapsed":
		"Insert {{name}} block callout (collapsed)",
	"cmd.customInsertHeading": "Insert H{{level}} {{name}} heading callout",
	"cmd.customInsertInline": "Insert {{name}} inline callout",

	// Autocomplete
	"autocomplete.createNew": 'Create "{{name}}"',

	// Vault scan / fallback / delete
	"settings.fallbackTag": "Default",
	"settings.fallbackTagAuto": "Default fallback",
	"settings.rescanVaultDesc": "Adds callout types used in your notes that aren't in this list yet. Your existing callouts and notes aren't changed.",
	"settings.rescanVaultHintAction": "Scan for callouts",
	"manualDiscovery.failed": "Discovery was not saved. Check that settings are writable and sync has finished, then try Settings → My callout types → Scan for callouts again. Existing callouts have not been replaced.",
	"saveStatus.missing": "Saving is paused because the settings file is missing. Deleting the plugin on another device can sync this deletion here; the file may also be waiting to download. Any settings already loaded on this device remain available. Let your sync service finish and make the vault available offline, then choose Check again. If the file does not return, you can restore the settings shown in Callout Studio settings on this device.",
	"saveStatus.unreadable": "Saving is paused because the settings file cannot be read safely. Finish synchronization or restore a valid copy, then retry. The existing file has been kept.",
	"saveStatus.recoveryRead": "Saving is paused because the local recovery copy cannot be read. Your settings file may still be intact. Check available storage, then retry recovery. Existing recovery data will not be overwritten.",
	"saveStatus.recoveryWrite": "The local recovery copy could not be saved. Check available storage, then retry. Keep your draft open until saving succeeds.",
	"saveStatus.writePermission": "The settings file could not be saved because storage denied write access. Check that the vault and plugin folder are writable, then retry.",
	"saveStatus.writeSpace": "The settings file could not be saved because storage is full or its quota was exceeded. Free some space, then retry.",
	"saveStatus.notesFailed": "The callout definition was saved, but some note updates could not be completed. Keep this editor open and choose Save to retry the unfinished updates.",
	"saveStatus.write": "The settings file could not be saved. Check available storage, folder permissions and synchronization, then retry before closing Obsidian.",
	// Shown only through settingsSaveMessage(), which reads this English table
	// directly, so rewording it here cannot leave a stale translation on screen.
	"saveStatus.changed": "The settings file changed while you were editing. Your draft is still available. Choose Try again to load the incoming settings, then review your draft and save again.",
	"saveStatus.syncConflict": "Incoming settings conflict with a callout needed for unfinished note updates. Your draft and pending updates have been kept. Resolve the conflicting settings before retrying.",
	"saveStatus.titlePaused": "Saving is paused",
	"saveStatus.titleFailed": "Settings were not saved",
	// The retry button and the line shown while any banner action runs: plain
	// words, like the rest of the banner. Their own keys, although
	// portable.retry also says "Try again".
	"saveStatus.tryAgain": "Try again",
	"saveStatus.working": "Working on it…",
	"saveStatus.retryFailed": "Saving is still blocked. Check the saving status in Callout Studio settings for the cause, then retry.",
	"saveStatus.reviewDraft": "Incoming settings and recovery checks are complete. Your draft is unchanged. Review it and save again.",
	"saveStatus.settingsArrived": "Existing settings arrived and were loaded. A replacement file was not created.",
	"saveStatus.restoreSettings": "Restore these settings",
	"saveStatus.createSettingsFile": "Create settings file",
	"saveStatus.checkAgain": "Check again",
	"saveStatus.recoverInSettings": "To restore the missing file on this device, open Callout Studio settings. Before closing this editor, copy any unsaved edits you want to keep; they have not been saved.",
	"saveStatus.openSettings": "Open Callout Studio settings",
	"saveStatus.diagnosis.unavailable":
		"This device can't open the file right now. It may still be downloading, the vault may not be available offline, or storage isn't responding. Callout Studio checks again automatically.",
	"saveStatus.diagnosis.empty":
		"The file is empty, which usually means a sync was interrupted. If another device still has your settings, let it sync. Otherwise, replace the file.",
	"saveStatus.diagnosis.mergeMarkers":
		"The file contains unresolved merge conflict markers, for example from Git. Resolve the conflict in your Git tool, or replace the file.",
	"saveStatus.diagnosis.damaged": "The file is incomplete or damaged, so it can't be read as settings.",
	"saveStatus.diagnosis.combined":
		"Your sync service combined two versions of the file, so its internal check no longer matches. The settings inside are intact, and replacing the file keeps them.",
	"saveStatus.diagnosis.invalidEntries":
		"The file contains entries Callout Studio can't use, for example the same callout type listed twice.",
	"saveStatus.replaceUnreadable": "Replace settings file",
	"saveStatus.discardRecoveryCopy": "Discard recovery copy",
	// The paused banner, for someone who may be worried their work is gone:
	// calm first, then what happened, then what to do (see
	// settings/saveStatusCopy.ts). Each sentence is its own key because the
	// banner leaves out any sentence whose button it isn't showing. A sentence
	// that names a button must use that button's label exactly.
	"saveStatus.calm.opening": "First of all, take a deep breath — everything is going to be okay.",
	"saveStatus.calm.kept": "Your notes are safe, and your callouts are still here on this device.",
	"saveStatus.calm.safe": "Your notes are safe.",
	"saveStatus.calm.pausedPage":
		"Callout Studio has only paused saving to protect your setup, so this page is read-only for now.",
	"saveStatus.calm.paused": "Callout Studio has only paused saving to protect your setup.",
	"saveStatus.explain.missing":
		"Callout Studio can't find its settings file. This usually happens while your sync app is still downloading it, or after Callout Studio was removed on another device.",
	"saveStatus.explain.stillMissing":
		"The settings file still isn't back. Checking only looks for it; it never creates a new one. If your vault is in iCloud, OneDrive, Google Drive or Dropbox, make sure it's set to stay downloaded on this device.",
	"saveStatus.explain.unreadable":
		"Callout Studio can't read its settings file right now, so it has left the file exactly as it is.",
	"saveStatus.explain.recoveryRead":
		"Callout Studio keeps a spare copy of your settings on this device, and that copy can't be read right now. Your settings file itself may be fine.",
	"saveStatus.explain.newerVersion":
		"Your settings were saved by a newer version of Callout Studio, so this older version won't change them.",
	"saveStatus.explain.changed":
		"The settings file changed while Callout Studio was working with it, so it stopped without replacing anything.",
	"saveStatus.guide.rechecks":
		"Callout Studio checks again every minute while Obsidian is open, so this often fixes itself.",
	"saveStatus.guide.rechecksCheckNow":
		"Callout Studio checks again every minute while Obsidian is open, so this often fixes itself — or choose Check again to look right now.",
	"saveStatus.guide.restore":
		"If your settings don't come back, choose Restore these settings to keep the callouts you see here.",
	"saveStatus.guide.create":
		"If your settings don't come back, choose Create settings file to start saving again.",
	"saveStatus.guide.backup":
		"Once saving works again, you can also bring back an earlier version from the Backup section.",
	"saveStatus.guide.recoveryRetry":
		"Make sure this device has some free storage, then choose Try again.",
	"saveStatus.guide.recoveryDiscard":
		"If that doesn't help, choose Discard recovery copy. An exact copy is saved first, and your settings file isn't touched.",
	"saveStatus.guide.newerVersion": "Update Callout Studio in Settings → Community plugins, then reload Obsidian.",
	"saveStatus.goToBackups": "Go to backups",
	"saveStatus.missingNotice":
		"Your notes are safe. Callout Studio has paused saving because it can't find its settings file right now.",
	"statusBar.paused": "Saving paused",
	"statusBar.pausedTooltip": "Callout Studio isn't saving settings changes. Click to see why.",
	"statusBar.pausedNotice": "Callout Studio isn't saving settings changes right now.",
	// When a pause someone could have seen ends; see settings/pausedIndicator.ts.
	"saveStatus.resumed": "Saving is back on. Callout Studio is saving settings changes again.",
	"notice.replaceUnreadableUnavailable":
		"The settings file can't be replaced right now: it is changing, or this device can't read it. Try again in a moment.",
	"notice.recoveryStorageUnavailable":
		"This device's recovery storage isn't responding, so the copy can't be discarded. Restart Obsidian, then try again.",
	"recovery.title": "Restore an earlier setup",
	"recovery.intro":
		"Callout Studio keeps earlier versions of your setup on this device and in the plugin's backups folder. Restoring one replaces your current setup on every synced device. A backup of the current setup is saved first.",
	"recovery.pausedViewHint": "Saving is paused, so restoring is unavailable. You can still compare or delete earlier setups.",
	"recovery.loading": "Looking for earlier versions…",
	"recovery.empty": "No earlier versions were found.",
	"recovery.sectionHistory": "Saved on this device",
	"recovery.sectionBackups": "Backups",
	"recovery.sectionCopies": "Other copies of the settings file",
	"recovery.unreadable": "Can't be read as settings",
	"recovery.same": "Same as your current setup",
	"recovery.restoreSame": "This setup is the same as your current one, so there is nothing to restore.",
	"recovery.summaryCallouts": "{{callouts}} saved callout type(s)",
	"recovery.summaryChanges": "{{count}} difference(s) from now",
	"recovery.details.view": "View details",
	"recovery.details.title": "Setup details",
	"recovery.details.savedOn": "Saved {{date}}",
	"recovery.details.comparingNow": "Compared with the setup currently running on this device.",
	"recovery.details.loading": "Building the before-and-after comparison…",
	"recovery.details.renderFailed": "The comparison could not be rendered.",
	"recovery.details.count.changed": "Changed: {{count}}",
	"recovery.details.count.added": "Added: {{count}}",
	"recovery.details.count.removed": "Removed: {{count}}",
	"recovery.details.calloutState.changed": "Changed",
	"recovery.details.calloutState.added": "Added",
	"recovery.details.calloutState.removed": "Removed",
	"recovery.details.onlySaved": "Not present in the current setup",
	"recovery.details.willRemove": "Removed when this version is restored",
	"recovery.details.order": "Order",
	"recovery.details.unknownTime": "Save time not recorded",
	"recovery.details.current": "Current setup",
	"recovery.details.restored": "After restoring this version",
	"recovery.details.unreadable": "This copy cannot be interpreted as a restorable setup by this version of Callout Studio. It may be damaged, unavailable, or use a newer format. A comparison and a restored-settings report are unavailable. Any original content that could be read is included below.",
	"recovery.details.null": "No value (null)",
	"recovery.details.yes": "Yes",
	"recovery.details.no": "No",
	"recovery.details.emptyText": "Empty text",
	"recovery.details.emptyList": "No entries",
	"recovery.details.emptyObject": "No stored properties",
	"recovery.details.field.id": "Identifier",
	"recovery.details.field.displayName": "Display name",
	"recovery.details.field.name": "Name",
	"recovery.details.field.icon": "Icon",
	"recovery.details.field.type": "Type or icon library",
	"recovery.details.field.value": "Value or icon name",
	"recovery.details.field.style": "Style",
	"recovery.details.field.weight": "Icon weight",
	"recovery.details.field.recolor": "Use the callout color for the image",
	"recovery.details.field.hideIcon": "Hide icon",
	"recovery.details.field.colorLight": "Accent color in light mode",
	"recovery.details.field.colorDark": "Accent color in dark mode",
	"recovery.details.field.bgColorLight": "Background color in light mode",
	"recovery.details.field.bgColorDark": "Background color in dark mode",
	"recovery.details.field.textColorLight": "Text color in light mode",
	"recovery.details.field.textColorDark": "Text color in dark mode",
	"recovery.details.field.bgGradient": "Background gradient",
	"recovery.details.field.transparentBg": "Transparent background",
	"recovery.details.field.foldable": "Foldable",
	"recovery.details.field.defaultFolded": "Folded by default",
	"recovery.details.field.builtIn": "Built-in callout",
	"recovery.details.field.source": "Definition source",
	"recovery.details.field.customized": "Customized",
	"recovery.details.field.aliases": "Aliases",
	"recovery.details.field.metadata": "Metadata",
	"recovery.details.field.paletteId": "Palette identifier",
	"recovery.details.field.iconAdjust": "Icon adjustments by role",
	"recovery.details.field.offsetX": "Horizontal icon offset",
	"recovery.details.field.offsetY": "Vertical icon offset",
	"recovery.details.field.size": "Icon scale",
	"recovery.details.field.regular": "Block callout",
	"recovery.details.field.heading": "Heading callout",
	"recovery.details.field.inline": "Inline callout",
	"recovery.details.field.version": "Settings format version",
	"recovery.details.field.globalStyle": "Global callout style",
	"recovery.details.field.contextMenu": "Context menu",
	"recovery.details.field.autocomplete": "Autocomplete",
	"recovery.details.field.iconSources": "Icon sources and picker preferences",
	"recovery.details.field.headingCallouts": "Heading callouts",
	"recovery.details.field.inlineCallouts": "Inline callouts",
	"recovery.details.field.fallbackCalloutId": "Fallback callout identifier",
	"recovery.details.field.language": "Interface language",
	"recovery.details.field.customPalettes": "Saved color palettes",
	"recovery.details.field.userImages": "Your images",
	"recovery.details.field.customCommands": "Custom commands",
	"recovery.details.field.disabledFixedCommands": "Disabled built-in commands",
	"recovery.details.field.quickInsertSource": "Remembered Quick Insert source",
	"recovery.details.field.welcomeSeen": "Welcome screen seen",
	"recovery.details.field.competitorImportBannerHandled": "First-install import prompt handled",
	"recovery.details.field.iconSvgCache": "Saved icon artwork",
	"recovery.details.field.enabled": "Enabled",
	"recovery.details.field.items": "Items",
	"recovery.details.field.format": "Image format",
	"recovery.details.field.width": "Width",
	"recovery.details.field.height": "Height",
	"recovery.details.field.monochrome": "Monochrome",
	"recovery.details.field.rev": "Image revision",
	"recovery.details.field.addedAt": "Added at (Unix milliseconds)",
	"recovery.details.field.pack": "Icon pack",
	"recovery.details.field.variant": "Icon variant",
	"recovery.details.field.calloutId": "Callout identifier",
	"recovery.details.field.role": "Callout role",
	"recovery.details.field.headingLevel": "Heading level",
	"recovery.details.field.action": "Command action",
	"recovery.details.field.fold": "Folding choice",
	"recovery.details.field.borderSides": "Visible borders",
	"recovery.details.field.borderWidth": "Border width",
	"recovery.details.field.borderRadius": "Corner radius",
	"recovery.details.field.top": "Top",
	"recovery.details.field.right": "Right",
	"recovery.details.field.bottom": "Bottom",
	"recovery.details.field.left": "Left",
	"recovery.details.field.titleScale": "Title text scale",
	"recovery.details.field.contentScale": "Content text scale",
	"recovery.details.field.alignContentWithTitle": "Align content with title",
	"recovery.details.field.fontScale": "Text scale",
	"recovery.details.field.paddingTop": "Top padding",
	"recovery.details.field.paddingBottom": "Bottom padding",
	"recovery.details.field.marginTop": "Space above heading",
	"recovery.details.field.refCleanTitles": "Clean heading titles in references",
	"recovery.details.field.refShowIcon": "Show heading icons in references",
	"recovery.details.field.showFoldArrow": "Show fold arrow",
	"recovery.details.field.allowContent": "Allow inline content",
	"recovery.details.field.angleDeg": "Gradient angle in degrees",
	"recovery.details.field.toColorLight": "Gradient end color in light mode",
	"recovery.details.field.toColorDark": "Gradient end color in dark mode",
	"recovery.details.field.textGradient": "Gradient title text",
	"recovery.details.field.textToColorLight": "Text gradient end color in light mode",
	"recovery.details.field.textToColorDark": "Text gradient end color in dark mode",
	"recovery.details.field.bgIntensity": "Background intensity",
	"recovery.details.field.baseColor": "Base color",
	"recovery.details.field.colorMode": "Color editing mode",
	"recovery.details.field.materialStyleDefault": "Default Material style",
	"recovery.details.field.materialWeightDefault": "Default Material weight",
	"recovery.details.field.faStyleDefault": "Default Font Awesome style",
	"recovery.details.field.tablerStyleDefault": "Default Tabler style",
	"recovery.details.field.lastMaterialCategory": "Remembered Material category",
	"recovery.details.field.lastCategory": "Remembered categories",
	"recovery.details.field.lastEmojiSkinTone": "Remembered emoji skin tone",
	"recovery.details.field.iconAdjustRole": "Icon position and size ({{role}})",
	"recovery.details.field.iconArtwork": "Icon artwork",
	"recovery.details.field.artwork": "Artwork",
	"recovery.details.previewBody": "Callout content",
	"recovery.details.previewUnavailable": "Preview unavailable",
	"recovery.details.column.number": "No.",
	"recovery.details.column.item": "Item",
	"recovery.details.count.total": "{{count}} difference(s)",
	"recovery.details.section.iconSources": "Icon picker defaults",
	"recovery.details.section.other": "Other settings",
	"recovery.details.item.imageOrder": "Order of custom icons",
	"recovery.details.item.paletteOrder": "Order of saved palettes",
	"recovery.details.item.commandOrder": "Order of custom commands",
	"recovery.details.item.menu": "{{role}} menu",
	"recovery.details.value.notSet": "Not set",
	"recovery.details.value.none": "None",
	"recovery.details.value.default": "Default",
	"recovery.details.value.automatic": "Automatic (from the accent color)",
	"recovery.details.value.themeDefault": "Theme default",
	"recovery.details.value.on": "On",
	"recovery.details.value.off": "Off",
	"recovery.details.value.shown": "Shown",
	"recovery.details.value.hidden": "Hidden",
	"recovery.details.value.notInMenu": "Not in this menu",
	"recovery.details.value.px": "{{value}} px",
	"recovery.details.value.em": "{{value}} em",
	"recovery.details.value.scale": "{{value}}×",
	"recovery.details.value.percent": "{{value}}%",
	"recovery.details.value.headingLevel": "H{{value}}",
	"recovery.details.value.angle": "Angle {{value}}°",
	"recovery.details.value.textGradient": "title text uses the gradient",
	"recovery.details.value.lightMode": "Light mode",
	"recovery.details.value.darkMode": "Dark mode",
	"recovery.details.value.noBorders": "No borders",
	"recovery.details.value.allSides": "All sides",
	"recovery.details.value.offsetX": "Horizontal {{value}} px",
	"recovery.details.value.offsetY": "Vertical {{value}} px",
	"recovery.details.value.size": "Scale {{value}}×",
	"recovery.details.value.followsColor": "Follows the callout color",
	"recovery.details.value.paletteMissing": "This palette is not in this setup",
	"recovery.details.value.calloutMissing": "This callout type is not in this setup",
	"recovery.details.value.obsidianDefault": "Obsidian's default",
	"recovery.details.value.artwork": "Saved drawing, {{size}} KB",
	"recovery.details.value.longText": "{{count}} characters in total",
	"recovery.details.value.nested": "Nested value",
	"recovery.details.value.more": "…and {{count}} more",
	"recovery.details.value.wholeGroup": "Whole setting group",
	"recovery.details.value.roleOff": "Turned off",
	"recovery.details.value.sampleText": "Sample text",
	"recovery.details.value.customCommand": "Custom command",
	"recovery.details.value.builtInCommand": "Built-in command",
	"recovery.details.value.colorModeSimple": "Simple (one base color)",
	"recovery.details.value.colorModeAdvanced": "Advanced (separate colors)",
	"recovery.details.value.formatSvg": "SVG",
	"recovery.details.value.formatPng": "PNG",
	"recovery.details.value.formatJpeg": "JPEG",
	"recovery.details.value.formatWebp": "WebP",
	"recovery.restore": "Restore",
	"recovery.confirmTitle": "Restore this setup",
	"recovery.confirmBody":
		"Your current setup is replaced with the one from {{when}} ({{count}} difference(s)). A backup of your current setup is saved first, and your sync service sends the restored setup to your other devices.",
	"recovery.restored": "Restored the setup from {{when}}.",
	"recovery.stale":
		"Nothing was restored: your settings changed or couldn't be checked. Open this window again and review the list.",
	"recovery.backupFailed":
		"Nothing was restored: a backup of your current setup could not be saved first. Check available storage, then try again.",
	"recovery.failed": "The setup could not be restored. Nothing was changed.",
		"recovery.delete": "Delete",
		"recovery.deleteConfirmTitle": "Delete this copy",
		"recovery.deleteConfirmBody":
			"The copy from {{when}} is permanently deleted and cannot be recovered afterward. Your current setup is not affected.",
		"recovery.deleted": "Deleted the copy from {{when}}.",
		"recovery.deleteFailed": "This copy could not be deleted. Nothing was changed.",
	"notice.unsavedChangesReplaced":
		"Some changes made on this device had not been saved yet, and newer settings from another device replaced them. Your version was saved first: open Restore an earlier setup in Callout Studio settings to get it back.",
	"notice.recoveryCopyStale":
		"Your settings were saved, but this device's recovery copy could not be updated. Check available storage on this device. Callout Studio tries again with your next change.",
	"notice.blockedWhilePaused":
		"Saving is paused, so this change cannot be kept right now. Resolve the saving problem shown in Callout Studio settings first.",
	"notice.openSettingsFailed": "Callout Studio settings could not be opened. Open Settings → Callout Studio to choose what to do.",
	"notice.settingsBackupFailed": "Settings recovery could not continue because a safety backup could not be saved. Check available storage and write permissions, then retry.",
	"commandBuilder.missingCallout": "Paused: the callout is missing. Discover or create it to restore this command, or edit the command to choose another type.",
	"manualDiscovery.scanning": "Scanning…",
	"settings.rescanComplete":
		"Scan complete: {{count}} new callout type(s) added.",
	"settings.readOnly":
		"Callout Studio could not use its settings file when Obsidian started, so nothing on this page is being saved on this device. Your changes will last until you close Obsidian. Reload Obsidian once the file is back — if you sync this vault, let the sync finish first.",
	"replaceModal.deleteWithoutReplaceSuffix": "(falls back to default)",
	"replaceModal.titleDelete": "Delete callout",
	"replaceModal.titleReplace": "Replace in vault",
	"replaceModal.searchPlaceholder": "Search callouts…",
	"replaceModal.chooseFirst": "Choose a replacement callout, or “{{delete}}”, to continue.",
	"replaceModal.chooseFirstReplace": "Choose the callout to replace it with first.",

	// Welcome / splash screen (shown once on first load; reopen via header icon)
	"welcome.tooltip": "About Callout Studio",
	"welcome.title": "Welcome to Callout Studio!",
	"welcome.tagline":
		"Your complete solution for creating, styling and managing Obsidian callouts.",
	"welcome.syncNote":
		"Already use Callout Studio on another device? Let your sync service finish first. Your callouts and settings appear here once they arrive.",
	"importBanner.message":
		"We noticed you are using {{plugins}}. Would you like to import your callouts?",
	"importBanner.action": "Import",
	"importBanner.dismiss": "Dismiss",
	"welcome.previewTitle": "See it in action",
	"welcome.demoName": "Callout Studio",
	// `{{id}}` is the demo callout the splash styles itself with, so the three
	// examples cannot be hijacked by a theme that restyles `tip` or `warning`
	// (see settings/welcomeDemo.ts). Two structural rules for anyone
	// translating this: `{` must follow `]` with NO space or the payload is
	// read as literal prose, and the sample must END outside a block callout
	// (see EmbeddableMarkdownEditor.parkCursor).
	"welcome.sample":
		"Callout Studio lets you create callouts with a custom icon, colors, and name.\n\n" +
		"You can use this callout in **three** different ways:\n\n" +
		"## [!{{id}}] Heading Callout\n" +
		"To turn any heading into a callout-style heading, add `[!type]` right after the `#`s.\n\n" +
		"Want an [!{{id}}]{Inline Callout}? Just add `[!type]{text}` right in a sentence, without breaking your flow.\n\n" +
		"> [!{{id}}] Block Callout\n" +
		"> The classic callout works with the exact syntax you're already used to: `> [!type]`.\n\n" +
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
	"deleteModal.replaceInstead": "Replace instead…",
	"deleteModal.deleteInUse": "Delete (convert to plain text)",
	"deleteModal.deleteUnused": "Delete callout",
	// The variant for a callout whose definition Callout Studio cannot remove:
	// one of Obsidian's built-ins, or a type the active theme declares.
	"deleteModal.titleKeep": 'Clear every use of "{{name}}"?',
	"deleteModal.keepsRowBuiltIn":
		"This is one of Obsidian's built-in callouts, so the type itself stays available — only its uses in your notes change.",
	"deleteModal.keepsRowTheme":
		"{{theme}} defines this callout type, so it stays available and keeps its look. Callout Studio only changes notes inside your vault — nothing belonging to your theme is touched.",
	"deleteModal.clearUsages": "Clear uses (convert to plain text)",

	// Settings — Section headings
	"settings.title": "Callout Studio",
	"settings.myCalloutTypes": "My callout types",
	"settings.builtInCallouts": "Built-in callouts",
	"settings.contextMenu": "Context menu",
	"settings.keyboardShortcuts": "Commands",
	"settings.language": "Language",
	"settings.languageDesc":
		"Display language for Callout Studio. Defaults to Obsidian's interface language.",
	"settings.languageAuto": "Automatic",

	// Downloadable translations. English is built in; every other language is
	// fetched the first time it is needed and kept for later.
	"locale.downloading": "Downloading translation…",
	"locale.notDownloaded": "{{name}} is not downloaded yet",
	"locale.notDownloadedDesc":
		"Callout Studio is showing English until the translation can be downloaded. It will try again the next time Obsidian starts.",
	"locale.retry": "Retry",
	"locale.diskWriteFailed":
		"Callout Studio could not save the translation to disk, so it will need downloading again next time.",

	"settings.importExport": "Import and export",
	"settings.import": "Import…",
	"settings.export": "Export…",
	"settings.importTitle": "Import callouts",
	"settings.exportTitle": "Export callouts",
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
	"settings.replaceAction": "Replace in vault…",
	"settings.deleteAction": "Delete",
	"settings.duplicateAction": "Duplicate",
	"notice.calloutDuplicated": 'Duplicated callout as "{{name}}".',
	"notice.calloutDuplicateFailed": "Could not duplicate the callout. Check the saving status and try again.",
	"settings.resetAction": "Reset to default",
	"settings.makeFallbackAction": "Use default fallback style",
	"settings.colorSwatchAria": "Accent: {{accent}} · Background: {{bg}}",
	// Settings — callouts the active theme styles
	"settings.themeCalloutsHeading": "Callouts from your theme",
	"settings.themeCalloutsDesc":
		"{{theme}} supplies or restyles these, so Callout Studio leaves them exactly as your theme draws them and offers them as Block callouts only. Both kinds appear here: callout types your theme adds, and built-in callouts whose look it replaces. Callout types your theme adds are listed only while it is active.",
	"settings.themeCalloutsDefaultTheme": "Your theme",
	"settings.themePreviewAria":
		'Preview "{{name}}" — see how your theme draws it',
	"settings.clearUsesAction": "Clear uses in your notes",
	"settings.builtInAllThemeStyled":
		"{{theme}} restyles every built-in callout, so they are all listed above and Callout Studio leaves them alone. To design one of your own, add a callout with a different ID.",

	// The shared callout picker — the fallback row, the command editor
	"calloutPicker.placeholder": "Search callouts…",
	"calloutPicker.noMatches": "No callout matches “{{query}}”.",

	// Settings — Fallback callout
	"settings.fallbackCallout": "Default fallback callout",
	"settings.fallbackCalloutDesc":
		"Unrecognized callout types in your vault will inherit the style of this callout.",

	// Settings — Global style
	"settings.globalStyleRegularTitle": "Global Block callout style",
	"settings.globalStyleHeadingTitle": "Global Heading callout style",
	"settings.globalStyleInlineTitle": "Global Inline callout style",
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
	"settings.styleDemoInlineName": "Example",
	"settings.styleDemoInlineText":
		"Lorem ipsum dolor sit amet, consectetur adipiscing elit. {{callout}} Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
	"settings.previewTitle": "Preview",

	// Settings — Saved color palettes
	"settings.customPalettes": "Saved color palettes",
	"settings.newPalette": "New palette",
	"settings.customPalettesEmpty": "No saved palettes yet.",
	"settings.editPaletteAria": "Edit palette {{name}}",
	"settings.deletePaletteAria": "Delete palette {{name}}",
	"settings.deletePaletteConfirm":
		'Delete palette "{{name}}"?\nCallouts that use its colors are not affected.',

	// Settings — Keyboard shortcuts
	"settings.customCommands": "Commands & Hotkeys",
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
	"commandBuilder.roleThemeOwned":
		"Your theme supplies this callout, so it only has a Block format.",
	"commandBuilder.commandSuspended":
		"Paused: your theme supplies this callout, so it only has a Block format. This command works again when the theme stops supplying it.",
	"commandBuilder.callout": "Callout type",
	"commandBuilder.calloutDesc": "The callout this command inserts.",
	"commandBuilder.headingLevel": "Heading level",
	"commandBuilder.headingLevelDesc": "Which heading level to write.",
	"commandBuilder.action": "Action",
	"commandBuilder.actionDesc":
		"Wrap turns the selection into a callout; insert adds an empty one.",
	"commandBuilder.actionWrap": "Wrap selection",
	"commandBuilder.actionInsert": "Insert new",
	"commandBuilder.foldState": "Fold state",
	"commandBuilder.foldStateDesc":
		"Whether the callout can be folded, and how it starts out.",
	"commandBuilder.foldNone": "Non-foldable",
	"commandBuilder.foldExpanded": "Foldable, expanded (+)",
	"commandBuilder.foldCollapsed": "Foldable, collapsed (-)",
	"commandBuilder.preview": "Command name",
	"commandBuilder.duplicate":
		"You already have a command that does exactly this.",
	"commandBuilder.noCallouts":
		"There are no callout types to build a command from yet.",
	"commandBuilder.noCalloutChosen": "Choose a callout for this command first.",
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
	"quickInsert.sourceTheme": "Theme callouts",
	"quickInsert.sourceUser": "My callouts",
	"quickInsert.editAria": "Edit {{name}}",
	"quickInsert.insertAria": "Insert {{name}} as a block callout",
	"quickInsert.noResults": "No callouts found",
	"quickInsert.noBuiltInCallouts":
		"No built-in callouts are currently available.",
	"quickInsert.noThemeCallouts":
		"No theme-specific callouts are currently available.",
	"quickInsert.targetMoved": "The note you opened Quick insert from changed or closed. Reopen Quick insert in the note you want to edit.",
	"quickInsert.targetMovedHint": "The original note is no longer available for this insertion.",
	"quickInsert.noUserCallouts":
		"You haven't created any custom callouts yet. Run “Callout Studio: Create new callout type” from the Command Palette.",
	"quickInsert.noAvailableUserCallouts":
		"Your custom callouts are currently listed under the theme filter because the active theme controls them.",
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
	"portable.reviewTitle": "Review conversion",
	"portable.help": "About conversion",
	"portable.helpIntro": "Select the replacements to apply. Click the pencil or replacement text to edit, then press Enter or click away to save. Use the reset icon to discard a draft or restore the default replacement. Notes change only after you choose Convert selected and confirm. Heading links update with their selected headings.",
	"portable.subtitle": "Choose which heading and inline callouts to convert to standard Markdown before leaving Callout Studio.",
	"portable.customize": "Custom replacement…",
	"portable.editCustom": "Edit custom replacement…",
	"portable.restoreDefault": "Restore default replacement",
	"portable.cancelEdit": "Discard changes",
	"portable.customInvalid": "Keep the replacement on one line without changing the surrounding Markdown structure.",
	"portable.customUnsafe": "This replacement would make a heading or its links ambiguous. Choose a different heading.",
	"portable.customStale": "The review changed. Reopen the replacement editor.",
	"portable.customDiscarded": "{{count}} custom replacements were cleared because their source text changed or could not be located safely.",
	"portable.customBadge": "Custom",
	"portable.roleLink": "Heading link",
	"portable.convertSelected": "Convert selected",
	"portable.selectionSummary": "{{selected}} of {{total}} replacements selected · {{links}} heading links to update",
	"portable.selectionConflict": "That choice would make heading links ambiguous. Your previous selection was kept.",
	"portable.selectAll": "Select all",
	"portable.selectNone": "Deselect all",
	"portable.relatedLinksHint": "Links and embeds follow the selected headings and are converted with them.",
	"portable.selectChange": "Convert {{path}}, line {{line}}",
	"portable.showMore": "Show {{count}} more",
	"portable.openFailed": "The conversion sidebar could not be opened.",
	"portable.closeSettings": "Close settings to review the conversion in the sidebar.",
	"portable.retry": "Try again",
	"portable.blockedAmbiguous": "This heading is skipped because its link target is ambiguous.",
	"portable.blockedTarget": "This heading is skipped because its link target cannot be preserved safely.",
	"portable.recovery": "Some changes remain. Finish this conversion and its heading-link updates before restarting or disabling the plugin; the pending plan is kept only in memory.",
	"portable.recoveryChanged": "Notes changed after conversion stopped. Pending link updates are retained; every note is checked again before writing.",
	"portable.finishConversion": "Finish conversion",
	"portable.recoveryUnavailable": "Some pending link updates could not be recovered safely. Check the affected notes before starting a new conversion.",
	"portable.title": "Convert to standard Markdown",
	"portable.settingDesc": "Replace heading and inline callouts across the vault with ordinary text, ready to use without Callout Studio.",
	"portable.review": "Review conversion",
	"portable.intro": "If you plan to stop using Callout Studio or move your vault to an app without it, convert your heading and inline callouts to standard Markdown.",
	"portable.before": "Before",
	"portable.after": "After",
	"portable.replacement": "Replacement",
	"portable.word": "Word",
	"portable.type": "type",
	"portable.text": "Text",
	"portable.headingText": "Title",
	"portable.backup": "We recommend backing up your vault before converting. This edits the original notes and cannot be undone in Callout Studio.",
	"portable.scanning": "Reading Markdown notes…",
	"portable.progress": "Reading notes: {{done}} of {{total}}",
	"portable.empty": "No eligible heading or inline callouts found. Nothing will be changed.",
	"portable.skipped": "{{count}} incomplete or unsupported occurrences were left unchanged for manual review.",
	"portable.confirmTitle": "Permanently convert this vault?",
	"portable.confirmBody": "Convert {{count}} occurrences and update {{links}} heading links in {{files}} notes?\nThis changes the original files and cannot be undone in Callout Studio. No automatic backup is created. Back up your vault first, save open notes, and pause editing and sync until conversion finishes.\nIf a file changes or a write fails, conversion stops. Notes already converted remain changed.",
	"portable.confirmAction": "Convert permanently",
	"portable.converting": "Converting the selected changes… Closing this pane will not stop the conversion.",
	"portable.complete": "Converted {{count}} occurrences and updated {{links}} heading links in {{files}} notes.",
	"portable.stopped": "Conversion stopped. {{count}} occurrences and {{links}} heading links in {{files}} notes were already changed; those edits remain.",
	"portable.errorEditor": "Save open notes to update the review automatically.",
	"portable.errorChanged": "The notes changed. Review the updated changes before converting.",
	"portable.errorBusy": "Another conversion is running. Wait for it to finish.",
	"portable.error": "The vault could not be read or updated safely. Check file access, then try again.",
	// Shown when the dimmed Convert button is pressed: one sentence per reason it is blocked.
	"portable.blockedConverting": "A conversion is already running. Wait for it to finish.",
	"portable.blockedUpdating": "The review is still updating. Wait for it to finish before converting.",
	"portable.blockedEditing": "Finish editing the replacement first: press Enter to save it, or Esc to discard it.",
	"portable.blockedNothingSelected": "Select at least one replacement to convert.",

	"settings.maintenance": "Danger zone",
	"settings.resetAll": "Reset everything",
	"settings.resetAllDesc":
		"Delete all user callouts, reset built-in callouts, global styles (borders, font scale, shape), saved color palettes, the right-click menu customization, and downloaded Material SVGs.",
	"settings.resetAllButton": "Reset everything",
	"notice.resetAllDone": "Everything has been reset to defaults.",
	// The confirmation lists what this vault would lose, one bullet per kind,
	// the number first; a bullet with nothing behind it is left out.
	"settings.resetIntro":
		"Take a moment to appreciate everything you've built with Callout Studio.",
	"settings.resetDeletes": "All of it is about to be deleted:",
	"settings.resetRestores": "This goes back to its defaults:",
	"settings.resetItemCallouts": "{{count}} custom callout type(s)",
	"settings.resetItemImages": "{{count}} uploaded picture(s)",
	"settings.resetItemCommands": "{{count}} custom command(s)",
	"settings.resetItemPalettes": "{{count}} saved color palette(s)",
	"settings.resetItemReferences": "{{count}} callout reference(s)",
	"settings.resetItemBuiltIns": "{{count}} built-in callout(s) you changed",
	"settings.resetItemGlobalStyle": "Global styles",
	"settings.resetItemContextMenu": "Right-click menu",
	"settings.resetItemHeading": "Heading callout settings",
	"settings.resetItemInline": "Inline callout settings",
	"settings.resetItemFallback": "Fallback style",
	"settings.resetAllConfirmAfter":
		"Don't worry: before resetting, we save a backup of your current setup. You can restore it at any time from the Backups section in the settings.\nIf you use a sync service, the reset might travel to your other devices too.",
	// No longer drawn: the list above replaced it. Kept because every locale
	// still carries it, and a locale may not hold a key English lacks.
	"settings.resetNothing": "Nothing to reset: everything is already at its defaults.",
	"settings.resetBackupFailed":
		"Nothing was reset: a backup of your current setup could not be saved first. Check available storage, then try again.",
	"settings.resetNotSaved":
		"The reset is shown but could not be saved yet, so your settings file still holds the previous setup. Check the saving status in Callout Studio settings.",
	"settings.backup": "Backup",
	"settings.recovery": "Earlier setups",
	"settings.recoveryDesc": "Restore a version of your setup saved earlier on this device or in the plugin's backups folder.",
	"settings.recoveryButton": "Restore an earlier setup",

	// Notices
	"notice.customCommandMissingCallout":
		"That command's callout type no longer exists.",
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
	"notice.externalCssRetired":
		"The personal CSS styling option was removed. These callouts now use their saved Callout Studio design unless your theme styles them. Your notes and personal CSS snippets were not changed.",
	"notice.vaultRewritePartial":
		"{{count}} note(s) could not be updated and were left unchanged. See the developer console for details.",
	"notice.calloutDeleteIncomplete":
		"Some notes could not be converted. The callout type was kept. Completed conversions are saved; resolve the file problem, then run the action again to finish.",
	"notice.vaultScanFailed":
		"Callout usage could not be counted because {{count}} note(s) could not be read. Check storage and synchronization, then try again.",
	"notice.settingsNewerVersion":
		"Callout Studio's settings were saved by a newer version of the plugin, so nothing will be written on this device until you update it. Your settings are safe — update Callout Studio here and reload Obsidian.",
	"notice.nothingToWrap": "Nothing to wrap.",
	"notice.cursorNotInsideCallout": "Cursor is not inside a callout.",
	"notice.autocompleteTargetMoved":
		"Nothing was inserted — the line changed while the editor was open.",
	"notice.autocompleteAlwaysEnabled":
		"Autocomplete is now a core feature and is always enabled.",
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
	"editor.paletteSearchPlaceholder": "Search colors…",
	"editor.paletteNoMatches": "No color matches “{{query}}”.",
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
	"editor.saving": "Saving…",
	"editor.saveFailed": "The save could not be completed. If this editor is still open, keep it open and retry after checking storage and synchronization. Some settings or note updates may already have been saved.",
	"editor.createCallout": "Create callout",
	"editor.nameRequired":
		"A display name is required before creating a callout.",
	"editor.noChangesToSave": "No changes were made.",
	"editor.downloadingIcon": "Downloading icon",
	"editor.idEmpty": "At least one ID is required",
	"editor.idExists": "A callout with this ID already exists",
	"editor.idConflict": "This ID conflicts with an existing callout",
	"editor.idFromTheme":
		"{{theme}} already supplies a callout with this ID, so Callout Studio can't style it. Pick a different ID.",
	"editor.idThemePattern":
		"Heads up: your theme styles every callout matching {{pattern}}, so it may override how this one looks.",
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

	// Theme callout preview window — opens instead of the editor for a callout
	// the active theme supplies or restyles.
	"themePreview.title": "{{name}} — supplied by your theme",
	"themePreview.summary":
		"Supplied by {{theme}} (Read-only). Color, icon, and ID cannot be modified here, and Heading/Inline formats are unavailable. To customize, create a new callout.",
	"themePreview.previewTitle": "How it renders now",
	"themePreview.blockSample":
		"> [!{{id}}] {{name}}\n" +
		"> This is what the callout's content looks like.\n",
	"editor.themePreviewClose": "Got it",

	// Palette editor modal
	"palette.newTitle": "New color palette",
	"palette.editTitle": "Edit color palette",
	"palette.groupPalette": "Palette",
	"palette.name": "Name",
	"palette.namePlaceholder": "My palette",
	"palette.nameExists": "A palette with this name already exists",
	"palette.saveBlockedName": "A palette with this name already exists. Choose a different name to save it.",
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
	"iconPicker.chooseFirst": "Select an icon first.",
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
	"iconPicker.simpleIcons": "Simple Icons",
	"iconPicker.searchSimpleIcons": "Search Simple Icons",
	"iconPicker.custom": "Custom Icons",
	"iconPicker.searchCustom": "Search custom icons",
	"iconPicker.customTooLarge":
		"{{name}} is too large. Custom icons must be at most 5 MB.",
	"iconPicker.customUnsupported":
		"{{name}} is not a supported custom icon file. Use SVG, PNG, JPEG or WebP.",
	"iconPicker.customInvalidSvg":
		"{{name}} could not be read as a safe SVG, so it was not added.",
	"iconPicker.customDecodeFailed": "{{name}} could not be read as a custom icon.",
	"iconPicker.customDuplicate":
		"{{name}} is already in your custom icons. Rename the file, or delete the custom icon you already have.",
	"iconPicker.uploadCustom": "Upload image files",
	"iconPicker.customEmpty":
		"No custom icons yet. Add an SVG, PNG, JPEG or WebP file from your computer, or drop one here.",
	"iconPicker.customEmptyTitle": "No custom icons yet",
	"iconPicker.customEmptyHint": "Click the image button above or drop a file here",
	"iconPicker.customEmptyFormats": "Accepted formats: SVG, PNG, JPEG, and WebP",
	"iconPicker.customDeleteConfirm": "Delete “{{name}}”?",
	"iconPicker.customDeleteInUse":
		"{{count}} callouts use this custom icon. They will fall back to a placeholder icon until you give them a new one.",
	"iconPicker.customRecolor": "Follow callout color",
	"iconPicker.allSources": "All sources",
	"iconPicker.searchAllSources": "Search all icon sources",
	"iconPicker.sourcesNotDownloaded":
		"Not included yet: {{names}}. Pick a source above to download it.",
	"iconPicker.chooseSource": "Choose source",
	"iconPicker.sourceGroup": "{{name}} · {{count}}",
	"iconPicker.notDownloaded": "Not downloaded",

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
	"iconPicker.descSimpleIcons": "brand and product logos",
	"iconPicker.descCustom": "custom icons you add from your computer",

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
	"iconPack.simpleIconsNotice":
		"Logos are trademarks of their owners; inclusion here does not indicate endorsement. Use a logo only to represent its own brand, and follow that brand's guidelines. Some logos also carry their own license; see the icon credits.",
	"iconPack.artworkRestored": "Downloaded the icon artwork for {{names}}.",
	"iconPack.diskWriteFailed":
		"Callout Studio could not save the icon pack to disk, so it will need downloading again next time. The icons you pick are still saved with your settings.",

	// Icon licenses & credits
	"credits.title": "Icon licenses & credits",
	"credits.introBeforeNotices":
		"Callout Studio uses open-source icon libraries; view each library's license, attribution, and modifications below, or read the ",
	"credits.fullNoticesInline": "full third-party notices",

	// Context Menu
	"contextMenu.editCallout": "Edit callout settings",
	"contextMenu.createCallout": "Create new callout",
	"contextMenu.copyMarkdown": "Copy callout Markdown",
	"contextMenu.openSettings": "Open Callout Studio settings",
	"contextMenu.setFoldClosed": "Set callout closed (-)",
	"contextMenu.setFoldOpen": "Set callout open (+)",
	"contextMenu.setFoldNone": "Make callout non-collapsible",
	"contextMenu.cutSection": "Cut heading section",
	"notice.clipboardWriteFailed": "Could not copy to the clipboard. The note was left unchanged.",
	"notice.sectionChangedAfterCopy": "The section was copied, but the note changed before it could be cut. Nothing was removed.",
	"contextMenu.copySection": "Copy heading section",
	"contextMenu.deleteSection": "Delete heading section",

	// Heading callouts
	"heading.toggleFold": "Toggle fold",

	// Global settings section (per-role style popups)
	"settings.globalSettings": "Global Callout Studio style options",
	"settings.globalSettingsRegularDesc":
		"Adjust the border, radius, font scale, and alignment of every block callout in your vault.",
	"settings.globalSettingsHeadingDesc":
		"Adjust the border, shape, and vertical spacing of every heading callout in your vault.",
	"settings.globalSettingsInlineDesc":
		"Adjust the border and shape of every inline callout in your vault.",
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
	"menuItem.createOrEdit": "Create or edit callout",
	"menuItem.openSettings": "Open settings",
	"menuItem.copyMarkdown": "Copy Markdown",
	"menuItem.foldDefaults": "Fold defaults (open / closed / none)",
	"menuItem.cutSection": "Cut section",
	"menuItem.copySection": "Copy section",
	"menuItem.deleteSection": "Delete section",

	// Confirm modal
	"confirm.ok": "Delete",
	"confirm.cancel": "Cancel",
	"confirm.acknowledge": "I have read and understood",
	// Headings for each confirmation — every window carries one, so each
	// caller of ConfirmModal names what it is about to do.
	"confirm.titleDeleteCommand": "Delete command",
	"confirm.titleResetEverything": "Reset everything",
	"confirm.titleReplaceUnreadable": "Replace settings file",
	"confirm.replaceUnreadable":
		"An exact copy of the current file is saved to the plugin's backups folder first. The file is then replaced with the setup shown here, and your sync service sends it to your other devices.",
	"confirm.replaceUnreadableSalvage":
		"An exact copy of the current file is saved to the plugin's backups folder first. The settings inside it are combined with the setup shown here, and the file is rewritten so every device can read it again.",
	"confirm.titleDiscardRecoveryCopy": "Discard recovery copy",
	"confirm.discardRecoveryCopy":
		"This device's recovery copy can't be read, so saving is paused on this device. An exact copy of it is saved to the plugin's backups folder first. It is then replaced with the setup shown here. Your settings file is not changed.",
	"confirm.titleResetCallout": "Reset callout",
	"confirm.titleDeletePalette": "Delete palette",
	"confirm.titleDeleteImage": "Delete image",
	"confirm.titleOverwriteSnippet": "Overwrite CSS snippet",
	"confirm.overwriteSnippet":
		"The CSS snippet in your snippets folder has changed since Callout Studio wrote it. Exporting again replaces the whole file.",
	"confirm.overwriteSnippetOk": "Overwrite",
	"confirm.titleRestoreSettings": "Restore these settings",
	"confirm.titleCreateSettingsFile": "Create settings file",
	// The same safety facts as the entry above, in plain words: what is saved,
	// what is backed up first, what reaches other devices, and the last check.
	"confirm.saveDisplayedSettings":
		"This saves the setup you see now as your settings file and turns saving back on. The spare copy this device keeps is backed up first.\nIf another device might have newer changes you want to keep, let it finish syncing before you continue. Your sync app may send this file to your other devices.\nCallout Studio looks for the settings file once more before saving. If it has come back, Callout Studio keeps it instead.",

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
	"vault.undoRewrite": "Undo",
	"vault.undoRestored": "Restored {{count}} note(s).",
	"vault.undoPartial":
		"Restored {{count}} note(s). {{skipped}} note(s) changed after the rewrite, so they were left as they are.",
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

	// Vault statistics modal
	"vaultStats.columnType": "Type",
	// Retained unused. The report is three columns now — type, how it is written
	// (`byRole`) and files — so the Name, Source and Count headers are gone with
	// their columns, `unknown` went when an unresolved row started being named
	// after its own id, and of the six source labels only the two above survive,
	// as a tag beside the id. Deleting an English key while the 31 generated
	// locale files still carry it fails their "no key English lacks" check until
	// the next translation pass, and the strings cost nothing to keep.
	"vaultStats.roleBlock": "Block",
	"vaultStats.roleHeading": "Heading",
	"vaultStats.roleInline": "Inline",

	"usage.title": "Find callouts",
	"usage.command": "Callout occurrences",
	"usage.subtitle": "Find callouts in your vault and jump to their source.",
	"usage.browse": "Browse",
	"usage.allTypes": "All types",
	"usage.registeredCallouts": "Registered callouts",
	"usage.unregisteredCallouts": "Unregistered callouts",
	"usage.summary": "{{count}} occurrences in {{files}} files",
	"usage.allRoles": "All formats",
	"usage.failed": "Could not update callout occurrences.",
	"usage.loading": "Scanning Markdown notes…",
	"usage.partial": "Results are incomplete: {{count}} read errors.",
	"usage.stale": "Updating callout occurrences…",
	"usage.empty": "No matching callouts were found.",
	"usage.failedFiles": "Files that could not be read",
	"usage.vaultReadFailed": "Could not list Markdown notes in this vault.",
	"usage.more": "Show {{count}} more",
	"usage.location": "Line {{line}} · {{role}}",
	"usage.missing": "This note no longer exists. Updating results…",
	"usage.changed": "This occurrence has changed or moved ambiguously. Updating results…",
	"usage.openFailed": "Could not open this callout occurrence.",
	"usage.menuCount": "Find usages ({{count}})",
	"usage.menuIncomplete": "Find usages — scan incomplete",
	"usage.menu": "Find usages",
	"usage.closeSettings": "Close Settings to view the callout results in the sidebar.",

	// Import validation
	"import.title": "Import issues",
	"import.reportLeadIn":
		"Review these import issues before continuing:",
	"import.reportLeadInFatal":
		"This data could not be imported:",
	"import.entryHeading": "Entry {{index}} — {{label}}",
	"import.summary":
		"{{valid}} of {{total}} entries are valid · {{issues}} issue(s) found.",
	"import.btnCancel": "Cancel",
	"import.btnImportValid": "Import valid only ({{count}})",
	"import.nothingValid": "None of the entries are valid, so there is nothing to import. Cancel, fix the issues listed here, and import again.",
	"import.err.notRecognized":
		"Unrecognized file: expected a callout definitions array or a Callout Studio export.",
	"import.warn.settingsIgnored":
		"The settings block was not a valid object and was ignored.",
	"import.warn.invalidGradient":
		"The background gradient was invalid and was ignored.",
	"import.err.parseFailed":
		"The file is not valid JSON and could not be parsed.",
	"import.confirmTitle": "Import Callout Studio backup",
	"import.confirmSummary":
		"This adds {{added}} callout type(s), replaces {{replaced}} existing one(s) with the file's version, and restores {{settings}} group(s) of settings from the file. A backup of your current setup is saved first.",
	"import.confirmAction": "Import",
	"import.backupFailed":
		"Nothing was imported: a backup of your current setup could not be saved first. Check available storage, then try again.",
	"import.notSaved":
		"The import is shown but could not be saved yet. Check the saving status in Callout Studio settings.",
	"import.err.tooLarge": "This import exceeds the 16 MiB size limit. Split it into smaller files and try again.",
	"import.err.tooComplex": "This import is too complex: use at most 1,000 items per list or object, 50,000 values in total, and 32 levels of nesting.",
	"import.err.imageBudget": "The combined picture collection exceeds the image size or complexity limits. Remove or simplify large pictures before importing.",
	"import.err.processingFailed": "The import could not be completed. Review the data and try again.",
	"import.reportTruncated": "Showing the first {{shown}} issues of {{total}}. Long values are shortened in this report.",
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
	"import.err.idReserved":
		'ID "{{value}}" is reserved by Callout Studio for its own previews and can\'t be imported.',
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
		"Icon value exceeds the 200-character limit ({{length}} characters).",
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
		'"iconAdjust" must be an object mapping a callout type ("regular", "heading", "inline") to its icon size and offsets.',
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
		"A .json file exported from Callout Studio.",
	"import.sourceCalloutManager": "Callout Manager",
	"import.sourceCalloutManagerDesc":
		"Your customized callouts from the plugin.",
	"import.sourceAdmonition": "Admonition",
	"import.sourceAdmonitionDesc":
		"Your custom admonitions from the plugin.",
	"import.sourceOtherPlugins": "From another plugin",

	// Import — plugin import window (Admonition and Callout Manager alike)
	"import.fileReady": "Ready to import.",
	"import.upload": "Upload…",
	"import.replace": "Replace…",
	"import.fileUploaded": "Uploaded {{name}}.",
	"import.fileReplaced": "Replaced the file with {{name}}.",
	"import.pasteButton": "Paste",
	// Pressing Import, or choosing the empty fallback, before it holds anything.
	// One per fallback: Callout Manager's window takes pasted text, Admonition's
	// an uploaded file.
	"import.pasteFirst": "Paste the copied styles first.",
	"import.uploadFirst": "Upload a file first.",
	"import.cmPlaceholder": "Paste the copied styles, or a data.json, here…",
	"import.clipboardEmpty": "The clipboard is empty. Copy the data first.",
	// Says nothing about choosing a file: the one window that reads the
	// clipboard has no file option.
	"import.clipboardBlocked":
		"The clipboard could not be read. Paste into the box yourself instead.",
	"import.importing": "Importing…",
	"import.err.fileUnreadable": "The file could not be read.",

	// Shared by the export format chooser and the plugin import window.
	"settings.recommended": "Recommended",

	// Export — format chooser
	"export.chooseFormat": "Export as",
	"export.formatJson": "Callout Studio backup",
	"export.formatJsonDesc":
		"A .json file — the only supported format for fully restoring your callouts and settings in another vault with Callout Studio.",
	"export.formatCss": "Standalone CSS snapshot",
	"export.formatCssDesc":
		"For websites or vaults where Callout Studio isn't running. Covers block callouts only; export again after changes.",

	// Import — Callout Manager
	"import.cmTitle": "Import from Callout Manager",
	"import.cmInstructions":
		"Each customized callout comes over with its icon and color. Per-theme " +
		"styling and custom CSS have no equivalent here and are left behind.",
	"import.cmFromVault": "This vault",
	"import.cmVaultChecking": "Looking for the Callout Manager plugin…",
	"import.cmVaultFound": "{{count}} customized callout(s) found.",
	"import.cmFromPaste": "Copied styles",
	"import.cmFromPasteDesc":
		"What Callout Manager's Copy button copies, or a data.json.",
	"import.cmBtnCancel": "Cancel",
	"import.cmBtnImport": "Import",
	"import.err.cmNoBlocksFound":
		"No Callout Manager styles were found in the file or pasted text.",
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
	// Previous warning keys remain while their existing translations are retired.
	// New keys let the corrected report fall back to English in every locale.
	"import.warn.cmThemeConditionPartial":
		"Theme-dependent styling cannot be preserved. Unconditional values are preferred; any conditional fallback is applied across themes.",
	"import.warn.cmCustomStylesSkipped":
		"Custom CSS from Callout Manager is not imported. Only supported icon and color settings can be brought over.",
	"import.warn.cmSchemeIcon": "Callout Studio uses one icon for both color schemes; the imported icon will be used in both.",
	"import.err.cmDuplicateId": 'ID "{{value}}" duplicates "{{other}}" in this import and was skipped.',

	// Import — Admonition
	"import.warn.admUnsupportedOptions": "These Admonition options are not imported: {{fields}}.",
	"import.admTitle": "Import from Admonition",
	"import.admInstructions":
		"Each admonition comes over as a callout with its name, icon, and " +
		"color. Settings Callout Studio has no equivalent for (command, copy " +
		"button, hidden title) are left behind.",
	"import.admFromVault": "This vault",
	"import.admVaultChecking": "Looking for the Admonition plugin…",
	"import.admVaultFound": "{{count}} custom admonition(s) found.",
	"import.admFromFile": "A file",
	"import.admFromFileDesc": "An admonitions.json file, or a shared pack.",
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
	"import.warn.admImageSkipped":
		"The uploaded picture could not be read and was not imported.",
	"import.warn.admIconWithCss":
		"This admonition is styled by a CSS snippet in Admonition. That styling " +
		"is not part of the import, so only its name, icon, and color came over.",
	"import.warn.admNoColor": "No color was set, so the default blue was used.",
	"import.warn.admTitleTruncated":
		"The title is {{length}} characters; it was shortened to {{max}}.",

	// Footer
	"footer.prompt":
		"Questions, bugs, or ideas? I'd love to hear from you!{{break}} {{issue}} or {{email}}.",
	"footer.openIssue": "Open a GitHub issue",
	"footer.sendEmail": "send me an email",
	"footer.sourceCode": "Source code",
	"footer.contribute": "Contribute",
	"footer.license": "Plugin license",
	"footer.iconCredits": "Icon licenses",
	"settings.deletePaletteConfirmLinkedOne":
		'Delete palette "{{name}}"?\n1 callout uses it. It keeps its colors, and you can reconnect it later from the Color row in its editor.',
	"settings.deletePaletteConfirmLinked":
		'Delete palette "{{name}}"?\n{{count}} callouts use it. They keep their colors, and you can reconnect them later from the Color row in any of their editors.',
	"notice.palettesMerged":
		"Merged {{count}} saved color(s) that had identical colors: {{names}}. The callouts using them keep their colors and are now linked to the color that remains.",
	"editor.colorsDescDeleted":
		"This callout's saved color was deleted. {{link}}",
	"editor.colorsDescDeletedLink": "Restore",
	"palette.colorExists":
		'These colors are identical to "{{name}}". Two saved colors cannot be the same — change a color to tell them apart.',
	"palette.colorExistsUse":
		'These colors are identical to "{{name}}". Two saved colors cannot be the same — change a color, or {{link}}.',
	"palette.colorExistsUseLink": "use the existing one",
	"notice.legacyDiscoveryArchiveFailed": "The upgrade recovery copy could not be completed. The previous local discovery cache and startup CSS have been kept unchanged. Check write access and free space, then restart Obsidian to retry.",
};
