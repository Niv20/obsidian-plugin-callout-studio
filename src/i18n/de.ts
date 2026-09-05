export const de: Record<string, string> = {
	"cmd.openSettings": "Einstellungen öffnen",
	"cmd.createCallout": "Neuen Callout-Typ erstellen",
	"cmd.insertEmptyCallout": "Leeren Callout einfügen",
	"cmd.calloutWrap": "In Callout einbetten",
	"cmd.calloutUnwrap": "Aus Callout entfernen",

	"cmd.customWrapBlock": "In {{name}}-Block-Callout einbetten",
	"cmd.customInsertBlock": "{{name}}-Block-Callout einfügen",
	"cmd.customInsertHeading":
		"H{{level}}-{{name}}-Überschrift-Callout einfügen",
	"cmd.customInsertInline": "{{name}}-Inline-Callout einfügen",
	"cmd.openQuickInsert": "Block-Callout schnell einfügen",

	"autocomplete.createNew": 'Neuen Callout erstellen: "{{name}}"',

	"settings.fallbackTag": "Standard",
	"settings.fallbackTagAuto": "Automatischer Standard",
	"settings.rescanVault": "Discover callouts",
	"settings.rescanVaultDesc": "Scan saved notes and the current theme once. Add missing callout types to your saved settings without changing existing types. Nothing is discovered automatically.",
	"settings.rescanVaultHintAction": "Discover now",
	"manualDiscovery.failed": "Discovery was not saved. Check that settings are writable and sync has finished, then try Settings → My callout types → Discover now again. Existing callouts have not been replaced.",
	"manualDiscovery.scanning": "Discovering…",
	"settings.rescanComplete":
		"Scan abgeschlossen: {{count}} neuer/neue Callout(s) hinzugefügt.",
	"replaceModal.deleteWithoutReplaceSuffix": "(fällt auf Standard zurück)",
	"replaceModal.titleDelete": "Callout löschen",
	"replaceModal.titleReplace": "Im Vault ersetzen",

	"welcome.tooltip": "Über Callout Studio",
	"welcome.title": "Willkommen bei Callout Studio!",
	"welcome.tagline":
		"Ihre umfassende Lösung zum Erstellen, Gestalten und Verwalten von Obsidian-Callouts.",
	"welcome.previewTitle": "In Aktion sehen",
	"welcome.demoName": "Callout Studio",
	"welcome.sample":
		"Mit Callout Studio können Sie Callouts mit eigenem Symbol, eigenen Farben und Namen erstellen.\n\n" +
		"Sie können diesen Callout auf **drei** verschiedene Arten verwenden:\n\n" +
		"## [!{{id}}] Callout als Überschrift\n" +
		"Um eine Überschrift in eine Callout-Überschrift zu verwandeln, fügen Sie `[!type]` direkt nach den `#` ein.\n\n" +
		"Möchten Sie einen [!{{id}}]{Inline-Callout} wie diesen? Fügen Sie einfach `[!type]{text}` mitten in einem Satz ein, ohne Ihren Lesefluss zu unterbrechen.\n\n" +
		"> [!{{id}}] Block-Callout\n" +
		"> Der klassische Callout funktioniert mit genau der gleichen Syntax, die Sie bereits kennen: `> [!type]`.\n\n" +
		"Callout Studio hat noch viel mehr zu bieten! [Mehr erfahren]({{repoUrl}}).\n",

	"deleteModal.title": 'Callout "{{name}}" löschen?',
	"deleteModal.bodyInUse":
		"Dieser Callout erscheint {{count}} Mal in {{files}} Datei(en).",
	"deleteModal.bodyInUseExplain":
		"Beim Löschen werden diese Blöcke in einfachen Text umgewandelt – sie verlieren ihre Formatierung und die Callout-Überschrift.",
	"deleteModal.replaceHint":
		"Sie können ihn stattdessen durch einen anderen Callout ersetzen, sodass der Vault-Inhalt als formatierter Callout erhalten bleibt.",
	"deleteModal.bodyUnused":
		'"{{name}}" wird in keiner Notiz verwendet, ist aber ein von Ihnen erstellter benutzerdefinierter Callout. Beim Löschen wird er aus dieser Liste entfernt.',
	"deleteModal.replaceInstead": "Stattdessen ersetzen",
	"deleteModal.deleteInUse": "Löschen (in einfachen Text umwandeln)",
	"deleteModal.deleteUnused": "Callout löschen",
	// The variant for a callout whose definition Callout Studio cannot remove:
	// one of Obsidian's built-ins, or a type the active theme declares.
	"deleteModal.titleKeep": 'Alle Verwendungen von "{{name}}" löschen?',
	"deleteModal.keepsRowBuiltIn":
		"Dies ist einer der integrierten Callouts von Obsidian, sodass der Typ selbst verfügbar bleibt — nur seine Verwendungen in Ihren Notizen ändern sich.",
	"deleteModal.keepsRowTheme":
		"{{theme}} definiert diesen Callout-Typ, sodass er verfügbar bleibt und sein Aussehen behält. Callout Studio ändert nur Notizen in Ihrem Vault — nichts, was zu Ihrem Theme gehört, wird angetastet.",
	"deleteModal.clearUsages": "Verwendungen löschen (in einfachen Text umwandeln)",

	"settings.title": "Callout Studio",
	"settings.myCalloutTypes": "Meine Callout-Typen",
	"settings.builtInCallouts": "Integrierte Callouts",
	"settings.contextMenu": "Kontextmenü",
	"settings.autocomplete": "Autovervollständigung",
	"settings.keyboardShortcuts": "Tastaturkürzel",
	"settings.language": "Sprache",
	"settings.languageDesc":
		"Anzeigesprache für Callout Studio. Folgt standardmäßig der Oberflächensprache von Obsidian.",
	"settings.languageAuto": "Automatisch (wie Obsidian)",
	"settings.importExport": "Importieren / Exportieren",
	"settings.import": "Importieren",
	"settings.export": "Exportieren",
	"settings.importDesc":
		"Importieren Sie Ihren Callout Studio-Fortschritt aus einem anderen Vault per JSON-Datei.",
	"settings.exportDesc":
		"Alle benutzerdefinierten Callout-Typen im JSON-Format speichern.",
	"settings.importConflictNotice":
		"{{count}} Callout-Typ(en) importiert; {{overwritten}} bestehende Einträge wurden überschrieben.",

	"settings.addNewCallout": "+ Callout hinzufügen",

	"settings.noCalloutsNow": "Derzeit keine benutzerdefinierten Callouts.",

	"settings.editAria": "{{name}} bearbeiten",
	"settings.moreRowActionsAria": "Weitere Aktionen für {{name}}",
	"settings.usageInfo": "{{count}} Verwendung(en) in {{files}} Datei(en)",
	"settings.replaceAction": "Im Vault ersetzen",
	"settings.deleteAction": "Löschen",
	"settings.resetAction": "Auf Standard zurücksetzen",
	"settings.makeFallbackAction": "Standard-Fallback-Stil verwenden",
	"settings.colorSwatchAria": "Akzent: {{accent}} · Hintergrund: {{bg}}",
	// Handing a callout to the user's own CSS. Not a statement about the theme —
	// that is derived and has no action — so the wording names the snippet.
	"settings.externalCssAction": "Mit eigenem CSS gestalten",
	"settings.externalCssStopAction": "Wieder von Callout Studio gestalten lassen",
	// The one label on any row: a callout sitting among the user's own that
	// Callout Studio has nonetheless stopped painting.
	"settings.externalCssTag": "Externes CSS",
	// Settings — callouts the active theme styles
	"settings.themeCalloutsHeading": "Callouts aus Ihrem Theme",
	"settings.themeCalloutsDesc":
		"{{theme}} liefert oder gestaltet diese neu, daher lässt Callout Studio sie genau so, wie Ihr Theme sie zeichnet, und bietet sie nur als Block-Callouts an. Hier erscheinen beide Arten: Callout-Typen, die Ihr Theme hinzufügt, und integrierte Callouts, deren Aussehen es ersetzt. Vom Theme hinzugefügte Callout-Typen werden nur angezeigt, solange es aktiv ist.",
	"settings.themeCalloutsDefaultTheme": "Ihr Theme",
	"settings.themePreviewAria":
		'"{{name}}" ansehen — wie Ihr Theme sie zeichnet',
	"settings.clearUsesAction": "Verwendungen in Ihren Notizen löschen",
	"settings.builtInAllThemeStyled":
		"{{theme}} gestaltet alle integrierten Callouts neu, daher sind sie alle oben aufgeführt, und Callout Studio lässt sie unangetastet. Um einen eigenen zu entwerfen, fügen Sie einen Callout mit einer anderen ID hinzu.",

	"settings.fallbackCallout": "Standard-Fallback-Callout",
	"settings.fallbackCalloutDesc":
		"Unbekannte Callout-Typen im Vault übernehmen den Stil dieses Callouts.",

	"settings.globalStyle": "Globaler Callout-Stil",
	"settings.border": "Rahmen",
	"settings.borderAll": "Alle",
	"settings.borderTop": "Oben",
	"settings.borderRight": "Rechts",
	"settings.borderBottom": "Unten",
	"settings.borderLeft": "Links",
	"settings.borderWidth": "Rahmendicke",
	"settings.fontScaleGroup": "Schriftskalierung",
	"settings.titleScale": "Überschrift",
	"settings.contentScale": "Inhalt",
	"settings.inlineTextScale": "Text",
	"settings.shapeGroup": "Form",
	"settings.borderRadius": "Eckabrundung",
	"settings.alignGroup": "Ausrichtung",
	"settings.alignContent": "Inhalt am Titel ausrichten",
	"settings.headingSpacingGroup": "Überschriftenabstand",
	"settings.headingPadVertical": "Vertikaler Abstand",
	"settings.headingGap": "Abstand zwischen Überschriften",
	"settings.headingFoldGroup": "Einklappen",
	"settings.headingFoldArrow": "Einklapp-Pfeil anzeigen",
	"settings.styleDemoName": "Beispiel",
	"settings.previewTitle": "Vorschau",

	// Settings — Saved color palettes
	"settings.customPalettes": "Gespeicherte Farbpaletten",
	"settings.newPalette": "Neue Palette",
	"settings.customPalettesEmpty": "Derzeit keine gespeicherten Paletten.",
	"settings.editPaletteAria": "Palette {{name}} bearbeiten",
	"settings.deletePaletteAria": "Palette {{name}} löschen",
	"settings.deletePaletteConfirm":
		'Palette "{{name}}" löschen?\nCallouts, die ihre Farben verwenden, sind davon nicht betroffen.',
	"settings.enableAutocomplete": "[! Autovervollständigung aktivieren",
	"settings.enableAutocompleteDesc":
		'Zeigt Vorschläge an, wenn Sie "[!" in einem Blockzitat im Editor eingeben. Wählen Sie einen Callout-Typ aus der Liste, um eine vollständige Callout-Überschrift einzufügen.',

	"settings.customCommands": "Befehle und Tastaturkürzel",
	"settings.customCommandsDesc":
		"Sehen Sie jeden Callout Studio-Befehl und das Tastaturkürzel, an das er gebunden ist, und erstellen Sie eigene Befehle für die Callouts, die Sie am häufigsten verwenden. Standardmäßig sind keine Kürzel zugewiesen.",
	"settings.customCommandsButton": "Befehle verwalten",

	"commandBuilder.title": "Befehle und Tastaturkürzel",
	"commandBuilder.desc":
		"Nutzen Sie die +-Schaltfläche, um in Obsidians Tastaturkürzel-Einstellungen ein Kürzel festzulegen oder zu ändern.",
	"commandBuilder.builtIn": "Integrierte Befehle",
	"commandBuilder.toggleAria": "{{name}} ein- oder ausschalten",
	"commandBuilder.hotkeyBlank": "Leer",
	"commandBuilder.hotkeyAria": "Kürzel für {{name}} festlegen",
	"commandBuilder.yourCommands": "Ihre Befehle",
	"commandBuilder.newCommand": "Neuer Befehl",
	"commandBuilder.empty": "Noch keine eigenen Befehle.",
	"commandBuilder.unknownCommand": "diesen Befehl",
	"commandBuilder.editAria": "{{name}} bearbeiten",
	"commandBuilder.deleteAria": "{{name}} löschen",
	"commandBuilder.deleteConfirm":
		"Befehl {{name}} löschen? Ein zugewiesenes Kürzel funktioniert dann nicht mehr.",
	"commandBuilder.newTitle": "Neuer Befehl",
	"commandBuilder.editTitle": "Befehl bearbeiten",
	"commandBuilder.format": "Callout-Format",
	"commandBuilder.formatDesc": "Welche Art von Callout der Befehl schreibt.",
	"commandBuilder.formatHeading": "Überschrift",
	"commandBuilder.formatInline": "Inline",
	"commandBuilder.formatBlock": "Block",
	"commandBuilder.roleDisabled":
		"Dieses Format ist deaktiviert, daher fügt der Befehl reinen Text ein, bis Sie es wieder aktivieren.",
	"commandBuilder.callout": "Callout-Typ",
	"commandBuilder.calloutDesc": "Der Callout, den dieser Befehl einfügt.",
	"commandBuilder.headingLevel": "Überschriftsebene",
	"commandBuilder.headingLevelDesc":
		"Welche Überschriftsebene geschrieben wird.",
	"commandBuilder.action": "Aktion",
	"commandBuilder.actionDesc":
		"Einbetten verwandelt die Auswahl in einen Callout; Einfügen fügt einen leeren hinzu.",
	"commandBuilder.actionWrap": "Auswahl einbetten",
	"commandBuilder.actionInsert": "Neu einfügen",
	"commandBuilder.preview": "Befehlsname",
	"commandBuilder.duplicate":
		"Sie haben bereits einen Befehl, der genau das tut.",
	"commandBuilder.noCallouts":
		"Es gibt noch keine Callout-Typen, aus denen ein Befehl erstellt werden kann.",
	"commandBuilder.save": "Speichern",
	"commandBuilder.roleThemeOwned":
		"Ihr Theme liefert diesen Callout, daher hat er nur ein Block-Format.",
	"commandBuilder.commandSuspended":
		"Pausiert: Ihr Theme liefert diesen Callout, daher hat er nur ein Block-Format. Dieser Befehl funktioniert wieder, sobald das Theme ihn nicht mehr liefert.",

	"settings.vaultMaintenance": "Vault-Einblicke & Wartung",
	"settings.vaultStats": "Callout-Statistiken",
	"settings.vaultStatsDesc":
		"Zählt jeden Callout in Ihren Markdown-Notizen – Block, Überschrift und inline – und gruppiert ihn nach Typ.",
	"settings.vaultStatsButton": "Statistiken anzeigen",
	"settings.vaultStatsScanning": "Scannt",
	"settings.resetAll": "Zurücksetzen",
	"settings.resetAllDesc":
		"Löscht alle Benutzer-Callouts, setzt integrierte Callouts, globale Stile (Rahmen, Schriftskalierung, Form), gespeicherte Farbpaletten, die Anpassung des Rechtsklickmenüs und heruntergeladene Material-SVGs zurück.",
	"settings.resetAllButton": "Alles zurücksetzen",
	"settings.resetAllConfirm":
		"Dadurch werden alle benutzerdefinierten Callouts gelöscht, integrierte Callouts, globale Stile, gespeicherte Farbpaletten, die Anpassung des Rechtsklickmenüs und alle gecachten Material-SVGs zurückgesetzt. Diese Aktion kann nicht rückgängig gemacht werden. Sind Sie sicher?",
	"notice.resetAllDone": "Alles wurde auf die Standardwerte zurückgesetzt.",

	"notice.customCommandsRemoved":
		"{{count}} eigene(r) Befehl(e) entfernt, deren Callout-Typ nicht mehr existiert.",
	"notice.customCommandMissingCallout":
		"Der Callout-Typ dieses Befehls existiert nicht mehr.",
	"notice.exported": "Callouts nach callout-studio-export.json exportiert",
	"notice.importedJSON": "{{count}} Callout-Typ(en) aus JSON importiert.",
	"notice.importedSettings": "Plugin-Einstellungen importiert.",
	"notice.importedCalloutManager":
		"Aus Callout Manager importiert: {{created}} erstellt, {{updated}} aktualisiert.",
	"notice.importedAdmonition":
		"Aus Admonition importiert: {{created}} erstellt, {{updated}} " +
		"aktualisiert.",
	"notice.noNewJSON":
		"Keine neuen Callout-Typen importiert (IDs möglicherweise bereits vorhanden).",
	"notice.iconDownloadFailed":
		'Material-Symbol "{{name}}" konnte nicht heruntergeladen werden. Es ist möglicherweise für diesen Stil/diese Stärke nicht verfügbar oder Sie sind offline.',
	"notice.externalCssOn":
		'Callout Studio gestaltet "{{name}}" nicht mehr — Ihr eigenes CSS bestimmt jetzt das Aussehen. Die Formate Überschrift-Callout und Inline-Callout werden nicht mehr dargestellt.',
	"notice.externalCssOff": 'Callout Studio gestaltet "{{name}}" wieder.',
	"notice.vaultRewritePartial":
		"{{count}} Notiz(en) konnten nicht aktualisiert werden und blieben unverändert. Details in der Entwicklerkonsole.",
	"notice.settingsUnreadable":
		"Callout Studio konnte seine Einstellungsdatei nicht lesen, daher fehlen deine Callout-Typen in dieser Sitzung. Es wurde nichts geschrieben, und die Datei auf der Festplatte ist unverändert — lade Obsidian neu, um es erneut zu versuchen.",
	"notice.settingsMissing":
		"Die Einstellungsdatei von Callout Studio fehlt, daher fehlen deine Callout-Typen in dieser Sitzung. Es wurde nichts geschrieben — wenn du diesen Tresor synchronisierst, lass die Synchronisierung abschließen und lade Obsidian neu, bevor du Änderungen vornimmst.",
	"notice.settingsMissingAction": "Auf diesem Gerät neu beginnen",
	"notice.nothingToWrap": "Nichts zum Einbetten.",
	"notice.cursorNotInsideCallout":
		"Der Cursor befindet sich nicht in einem Callout.",
	"notice.autocompleteTargetMoved":
		"Nichts wurde eingefügt – die Zeile hat sich geändert, während der Editor geöffnet war.",
	"notice.openHotkeysFailed":
		"Obsidians Tastaturkürzel-Einstellungen konnten nicht geöffnet werden.",
	"notice.filterHotkeysFailed":
		"Obsidians Tastaturkürzel wurden geöffnet, der Callout Studio-Filter konnte jedoch nicht angewendet werden.",

	"editor.editCallout": "Callout bearbeiten",
	"editor.newCallout": "Neuer Callout",
	"editor.displayName": "Anzeigename",
	"editor.displayNameDesc":
		"Die in der Benutzeroberfläche angezeigte lesbare Bezeichnung",
	"editor.displayNameBuiltIn":
		"Der Anzeigename kann bei integrierten Callouts nicht geändert werden",
	"editor.displayNamePlaceholder": "Mein Callout",
	"editor.calloutIds": "Callout-IDs",
	"editor.calloutIdsDesc":
		"Alle Bezeichner für diesen Callout. Leerzeichen sind erlaubt.\nEnter oder die +-Schaltfläche drücken zum Hinzufügen.",
	"editor.calloutIdsPlaceholder": "ID hinzufügen",
	"editor.addId": "ID hinzufügen",
	"editor.idLinkedToName": "Mit dem Anzeigenamen verknüpft",
	"editor.idCannotDelete":
		"Diese ID ist mit dem Anzeigenamen verknüpft und kann nicht gelöscht werden — ändern Sie den Namen, um sie zu ändern",
	"editor.icon": "Symbol",
	"editor.pickIcon": "Symbol ändern",
	"editor.replaceIcon": "Symbol ersetzen",
	"editor.removeIcon": "Symbol entfernen",
	"editor.noIcon": "Kein Symbol",
	"editor.resetIcon": "Symbol auf Standard zurücksetzen",
	"editor.livePreview": "Live-Vorschau",
	"editor.iconAdjustment": "Symbolanpassung",
	"editor.picture": "Bild",
	"editor.size": "Größe",
	"editor.horizontalOffset": "Horizontaler Versatz",
	"editor.verticalOffset": "Vertikaler Versatz",
	"editor.colors": "Farben",
	"editor.colorsDesc":
		"Sets this callout's border, background, and text colors.",
	"editor.resetColors": "Farben auf Standard zurücksetzen",
	"editor.paletteDeleted": "Gelöschte Farbe",
	"editor.paletteGroupObsidian": "Obsidian-Callouts",
	"editor.paletteGroupPresets": "Farbvoreinstellungen",
	"editor.paletteGroupCustom": "Benutzerdefiniert",
	"editor.paletteNewColor": "Neue Farbe…",
	"editor.contrastWarning":
		"Geringer Kontrast zum Hintergrund — könnte schwer lesbar sein",
	"editor.foldable": "Faltbar",
	"editor.foldableDesc":
		"Wählen Sie, ob der Callout gefaltet werden kann und welcher Standardzustand im gesamten Vault gilt.",
	"editor.foldOff": "Aus",
	"editor.foldOpen": "Standardmäßig geöffnet",
	"editor.foldClosed": "Standardmäßig geschlossen",
	"editor.cancel": "Abbrechen",
	"editor.saveChanges": "Änderungen speichern",
	"editor.saving": "Saving…",
	"editor.saveFailed": "The save could not be completed. If this editor is still open, keep it open and retry after checking storage and synchronization. Some settings or note updates may already have been saved.",
	"notice.settingsSaveFailed": "Callout Studio could not save your changes. Check available storage and synchronization, then retry before closing Obsidian.",
	"editor.createCallout": "Callout erstellen",
	"editor.nameRequired":
		"Vor dem Erstellen eines Callouts ist ein Anzeigename erforderlich.",
	"editor.noChangesToSave": "Es wurden keine Änderungen vorgenommen.",
	"editor.downloadingIcon": "Symbol wird heruntergeladen",
	"editor.idEmpty": "Mindestens eine ID ist erforderlich",
	"editor.idExists": "Ein Callout mit dieser ID existiert bereits",
	"editor.idConflict":
		"Diese ID steht in Konflikt mit einem bestehenden Callout",
	"editor.idDashConflict":
		"Obsidian schreibt Leerzeichen als Bindestriche, daher kollidiert diese ID mit „{{other}}“",
	"editor.idFromTheme":
		"{{theme}} liefert bereits einen Callout mit dieser ID, daher kann Callout Studio ihn nicht gestalten. Wählen Sie eine andere ID.",
	"editor.idThemePattern":
		"Hinweis: Ihr Theme gestaltet jeden Callout, der zu {{pattern}} passt, daher könnte es das Aussehen dieses hier überschreiben.",
	"editor.untitledCallout": "Callout ohne Titel",
	"editor.loremIpsum":
		"Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
	"editor.loremIpsumShort":
		"Lorem ipsum dolor sit amet, consectetur adipiscing elit.",
	"editor.sampleInlineText":
		"Hier ist eine eingebettete [!{id}] Pille innerhalb eines Absatzes.",
	"editor.previewReadOnly": "Die Live-Vorschau kann nicht bearbeitet werden",

	// Theme callout preview window — opens instead of the editor for a callout
	// the active theme supplies or restyles.
	"themePreview.title": '{{name}} — von Ihrem Theme geliefert',
	"themePreview.owned":
		'{{theme}} liefert und gestaltet "{{name}}". Callout Studio überschreibt ihn nicht, daher sieht sein Block-Callout genauso aus, wie Ihr Theme ihn zeichnet.',
	"themePreview.readOnly":
		"Das bedeutet, dass Farbe, Symbol, Name und ID hier nicht geändert werden können. Wenn Sie ein eigenes Design möchten, erstellen Sie einen neuen Callout mit einer anderen ID.",
	"themePreview.blockOnly":
		"Die Formate Überschrift und Inline sind für von Ihrem Theme gelieferte Callouts nicht verfügbar. Block-Callouts verwenden den nativen Stil des Themes.",
	"themePreview.previewTitle": "So sieht er derzeit aus",
	"themePreview.blockSample":
		"> [!{{id}}] {{name}}\n" +
		"> So sieht der Inhalt dieses Callouts aus.\n",
	"editor.externalStyleClose": "Verstanden",

	// Palette editor modal
	"palette.newTitle": "Neue Farbpalette",
	"palette.groupPalette": "Palette",
	"palette.editTitle": "Farbpalette bearbeiten",
	"palette.name": "Name",
	"palette.namePlaceholder": "Meine Palette",
	"palette.nameExists": "Es gibt bereits eine Palette mit diesem Namen",
	"palette.baseColor": "Basisfarbe",
	"palette.baseColorHint":
		"Wir passen die Hintergrundfarbe automatisch daran an. Wenn du möchtest, kannst du sie separat steuern, indem du {{link}}.",
	"palette.baseColorHintLink": "hier klickst",
	"palette.advancedColors": "Farben",
	"palette.advancedColorsHint":
		"Bearbeiten der Farben für den {{mode}}-Modus – der andere Modus wird automatisch aktualisiert. Wechsle das Obsidian-Theme, um es zu überprüfen.",
	"palette.revertHint":
		"Bevorzugst du stattdessen eine einzelne Basisfarbe? {{link}}.",
	"palette.revertHintLink": "Zurücksetzen",
	"palette.lightMode": "Hell",
	"palette.darkMode": "Dunkel",
	"palette.accentColor": "Akzentfarbe",
	"palette.backgroundColorChannel": "Hintergrundfarbe",
	"palette.textColorChannel": "Textfarbe",
	"palette.bgIntensity": "Intensität",
	"palette.bgStyle": "Stil",
	"palette.bgSolid": "Einfarbig",
	"palette.bgGradient": "Verlauf",
	"palette.bgTransparent": "Transparent",
	"palette.gradientTo": "Zweite Farbe",
	"palette.gradientDirection": "Richtung",
	"palette.gradientText": "Verlaufs-Titeltext",
	"palette.save": "Speichern",

	// Color name suggestions (used to prefill palette names)
	"colorName.red": "Rot",
	"colorName.orange": "Orange",
	"colorName.amber": "Bernstein",
	"colorName.yellow": "Gelb",
	"colorName.lime": "Limette",
	"colorName.green": "Grün",
	"colorName.teal": "Petrol",
	"colorName.cyan": "Cyan",
	"colorName.sky": "Himmelblau",
	"colorName.blue": "Blau",
	"colorName.indigo": "Indigo",
	"colorName.violet": "Violett",
	"colorName.purple": "Lila",
	"colorName.pink": "Pink",
	"colorName.rose": "Rosé",
	"colorName.brown": "Braun",
	"colorName.gray": "Grau",
	"colorName.black": "Schwarz",
	"colorName.white": "Weiß",
	"colorName.crimson": "Karmesinrot",
	"colorName.coral": "Koralle",
	"colorName.grape": "Traube",
	"colorName.plum": "Pflaume",
	"colorName.bubblegum": "Kaugummi",

	"iconPicker.pickIcon": "Symbol auswählen",
	"iconPicker.confirm": "Bestätigen",
	"iconPicker.cancel": "Abbrechen",
	"iconPicker.lucide": "Lucide",
	"iconPicker.tabler": "Tabler Icons",
	"iconPicker.material": "Material",
	"iconPicker.emoji": "Emoji",
	"iconPicker.searchLucide": "Lucide-Symbole suchen",
	"iconPicker.searchTabler": "Tabler-Symbole suchen",
	"iconPicker.tablerStyle": "Symbol-Stil",
	"iconPicker.tablerStyleOutline": "Kontur (Outline)",
	"iconPicker.tablerStyleFilled": "Gefüllt (Filled)",
	"iconPicker.loadMore": "Mehr laden",
	"iconPicker.materialStyle": "Symbol-Stil",
	"iconPicker.materialStyleOutlined": "Umrissen (Outlined)",
	"iconPicker.materialStyleFilled": "Gefüllt (Filled)",
	"iconPicker.materialStyleRounded": "Abgerundet (Rounded)",
	"iconPicker.materialStyleSharp": "Scharf (Sharp)",
	"iconPicker.materialWeight": "Symbol-Stärke",
	"iconPicker.materialWeight100": "Dünn (Thin)",
	"iconPicker.materialWeight200": "Extra leicht (Extra Light)",
	"iconPicker.materialWeight300": "Leicht (Light)",
	"iconPicker.materialWeight400": "Normal (Regular)",
	"iconPicker.materialWeight500": "Mittel (Medium)",
	"iconPicker.materialWeight600": "Halbfett (Semi Bold)",
	"iconPicker.materialWeight700": "Fett (Bold)",
	"iconPicker.materialFontFailed":
		"Die Vorschaubilder der Material-Symbole konnten nicht geladen werden. Stattdessen werden die Symbolnamen angezeigt — Suchen und Auswählen funktionieren weiterhin.",
	"iconPicker.materialFontRetry": "Erneut versuchen",
	"iconPicker.searchMaterial": "Material-Symbole suchen",
	"iconPicker.searchEmoji": "Emojis suchen",
	"iconPicker.skinTone": "Hautton",
	"iconPicker.allCategories": "Alle Kategorien",
	"iconPicker.noIconSelected": "Kein Symbol ausgewählt",
	"iconPicker.noResults": "Keine Symbole entsprechen Ihrer Suche.",
	"iconPicker.octicons": "Octicons",
	"iconPicker.searchOcticons": "Octicons durchsuchen",
	"iconPicker.fa": "Font Awesome",
	"iconPicker.searchFa": "Font Awesome durchsuchen",
	"iconPicker.faStyle": "Symbol-Stil",
	"iconPicker.faStyleSolid": "Ausgefüllt (Solid)",
	"iconPicker.faStyleRegular": "Regulär (Regular)",
	"iconPicker.faStyleBrands": "Marken (Brands)",
	"iconPicker.rpgAwesome": "RPG Awesome",
	"iconPicker.searchRpgAwesome": "RPG Awesome durchsuchen",
	"iconPicker.image": "Ihre Bilder",
	"iconPicker.searchImage": "Bilder durchsuchen",
	"iconPicker.imageTooLarge":
		"{{name}} ist zu groß. Bilder müssen kleiner als 5 MB sein.",
	"iconPicker.imageUnsupported":
		"{{name}} ist kein unterstütztes Bildformat. Verwenden Sie SVG, PNG, JPEG oder WebP.",
	"iconPicker.imageInvalidSvg":
		"{{name}} konnte nicht als sicheres SVG gelesen werden und wurde nicht hinzugefügt.",
	"iconPicker.imageDecodeFailed":
		"{{name}} konnte nicht als Bild gelesen werden.",
	"iconPicker.imageDuplicate":
		"{{name}} ist bereits in Ihren Bildern. Benennen Sie die Datei um oder löschen Sie das vorhandene Bild.",
	"iconPicker.imageAdd": "Bilder hinzufügen",
	"iconPicker.imageEmpty":
		"Noch keine Bilder. Fügen Sie eine SVG-, PNG-, JPEG- oder WebP-Datei von Ihrem Computer hinzu oder ziehen Sie eine hierher.",
	"iconPicker.imageDelete": "Löschen",
	"iconPicker.imageDeleteConfirm": "„{{name}}“ löschen?",
	"iconPicker.imageDeleteInUse":
		"{{count}} Callout(s) verwendet dieses Bild. Es wird ein Platzhalter-Symbol angezeigt, bis Sie ein neues festlegen.",
	"iconPicker.imageRecolor": "Callout-Farbe übernehmen",
	"iconPicker.allSources": "Alle Quellen",
	"iconPicker.searchAllSources": "Alle Symbol-Quellen durchsuchen",
	"iconPicker.sourcesNotDownloaded":
		"Noch nicht enthalten: {{names}}. Wählen Sie oben eine Quelle, um sie herunterzuladen.",
	"iconPicker.chooseSource": "Quelle wählen",
	"iconPicker.sourceGroup": "{{name}} · {{count}}",

	// Source menu — what each library holds, in a few words
	"iconPicker.descAllSources": "alle Bibliotheken auf einmal durchsuchen",
	"iconPicker.descLucide": "Obsidians eigene Sammlung, immer offline",
	"iconPicker.descTabler":
		"klare und einheitliche UI-Symbole, Kontur und gefüllt",
	"iconPicker.descMaterial":
		"Googles Sammlung, vier Stile und sieben Stärken",
	"iconPicker.descEmoji": "farbige Glyphen, alle Hauttöne",
	"iconPicker.descOcticons": "GitHubs Interface-Symbole",
	"iconPicker.descFa": "ausgefüllt, regulär und Marken",
	"iconPicker.descRpgAwesome": "Fantasy- und Tabletop-Symbole",
	"iconPicker.descImage": "Bilder, die Sie von Ihrem Computer hinzufügen",

	// Icon picker — category filter dropdown labels
	"iconPicker.cat.Accessibility": "Barrierefreiheit",
	"iconPicker.cat.Actions": "Aktionen",
	"iconPicker.cat.Activities": "Aktivitäten",
	"iconPicker.cat.Alert": "Alarm",
	"iconPicker.cat.Alphabet": "Alphabet",
	"iconPicker.cat.Android": "Android",
	"iconPicker.cat.Animals": "Tiere",
	"iconPicker.cat.Arrows": "Pfeile",
	"iconPicker.cat.Astronomy": "Astronomie",
	"iconPicker.cat.Audio&Video": "Audio und Video",
	"iconPicker.cat.Automotive": "Fahrzeuge",
	"iconPicker.cat.Badges": "Abzeichen",
	"iconPicker.cat.Brand": "Marken",
	"iconPicker.cat.Buildings": "Gebäude",
	"iconPicker.cat.Business": "Geschäft",
	"iconPicker.cat.Camping": "Camping",
	"iconPicker.cat.Charity": "Wohltätigkeit",
	"iconPicker.cat.Charts": "Diagramme",
	"iconPicker.cat.Charts + Diagrams": "Diagramme und Grafiken",
	"iconPicker.cat.Childhood": "Kindheit",
	"iconPicker.cat.Clothing + Fashion": "Kleidung und Mode",
	"iconPicker.cat.Coding": "Programmierung",
	"iconPicker.cat.Communicate": "Kommunizieren",
	"iconPicker.cat.Communication": "Kommunikation",
	"iconPicker.cat.Computers": "Computer",
	"iconPicker.cat.Connectivity": "Konnektivität",
	"iconPicker.cat.Construction": "Bauwesen",
	"iconPicker.cat.Currencies": "Währungen",
	"iconPicker.cat.Database": "Datenbank",
	"iconPicker.cat.Design": "Design",
	"iconPicker.cat.Development": "Entwicklung",
	"iconPicker.cat.Devices": "Geräte",
	"iconPicker.cat.Devices + Hardware": "Geräte und Hardware",
	"iconPicker.cat.Disaster + Crisis": "Katastrophen und Krisen",
	"iconPicker.cat.Document": "Dokument",
	"iconPicker.cat.E-commerce": "E-Commerce",
	"iconPicker.cat.Editing": "Bearbeitung",
	"iconPicker.cat.Education": "Bildung",
	"iconPicker.cat.Electrical": "Elektrik",
	"iconPicker.cat.Emoji": "Emoji",
	"iconPicker.cat.Energy": "Energie",
	"iconPicker.cat.Extensions": "Erweiterungen",
	"iconPicker.cat.Files": "Dateien",
	"iconPicker.cat.Film + Video": "Film und Video",
	"iconPicker.cat.Food": "Essen",
	"iconPicker.cat.Food + Beverage": "Essen und Trinken",
	"iconPicker.cat.Fruits + Vegetables": "Obst und Gemüse",
	"iconPicker.cat.Games": "Spiele",
	"iconPicker.cat.Gaming": "Gaming",
	"iconPicker.cat.Gender": "Geschlecht",
	"iconPicker.cat.Genders": "Geschlechter",
	"iconPicker.cat.Gestures": "Gesten",
	"iconPicker.cat.Halloween": "Halloween",
	"iconPicker.cat.Hands": "Hände",
	"iconPicker.cat.Hardware": "Hardware",
	"iconPicker.cat.Health": "Gesundheit",
	"iconPicker.cat.Holidays": "Feiertage",
	"iconPicker.cat.Home": "Zuhause",
	"iconPicker.cat.Household": "Haushalt",
	"iconPicker.cat.Humanitarian": "Humanitär",
	"iconPicker.cat.Images": "Bilder",
	"iconPicker.cat.Laundry": "Wäsche",
	"iconPicker.cat.Letters": "Buchstaben",
	"iconPicker.cat.Logic": "Logik",
	"iconPicker.cat.Logistics": "Logistik",
	"iconPicker.cat.Map": "Karte",
	"iconPicker.cat.Maps": "Karten",
	"iconPicker.cat.Maritime": "Maritime",
	"iconPicker.cat.Marketing": "Marketing",
	"iconPicker.cat.Math": "Mathematik",
	"iconPicker.cat.Mathematics": "Mathematik",
	"iconPicker.cat.Media": "Medien",
	"iconPicker.cat.Media Playback": "Medienwiedergabe",
	"iconPicker.cat.Medical + Health": "Medizin und Gesundheit",
	"iconPicker.cat.Money": "Geld",
	"iconPicker.cat.Mood": "Stimmung",
	"iconPicker.cat.Moving": "Umzug",
	"iconPicker.cat.Music + Audio": "Musik und Audio",
	"iconPicker.cat.Nature": "Natur",
	"iconPicker.cat.Numbers": "Zahlen",
	"iconPicker.cat.Photography": "Fotografie",
	"iconPicker.cat.Photos + Images": "Fotos und Bilder",
	"iconPicker.cat.Political": "Politisch",
	"iconPicker.cat.Privacy": "Datenschutz",
	"iconPicker.cat.Punctuation + Symbols": "Satzzeichen und Symbole",
	"iconPicker.cat.Religion": "Religion",
	"iconPicker.cat.Science": "Wissenschaft",
	"iconPicker.cat.Science Fiction": "Science-Fiction",
	"iconPicker.cat.Security": "Sicherheit",
	"iconPicker.cat.Shapes": "Formen",
	"iconPicker.cat.Shopping": "Einkaufen",
	"iconPicker.cat.Social": "Soziale Medien",
	"iconPicker.cat.Spinners": "Spinner",
	"iconPicker.cat.Sport": "Sport",
	"iconPicker.cat.Sports + Fitness": "Sport und Fitness",
	"iconPicker.cat.Symbols": "Symbole",
	"iconPicker.cat.System": "System",
	"iconPicker.cat.Text": "Text",
	"iconPicker.cat.Text Formatting": "Textformatierung",
	"iconPicker.cat.Time": "Zeit",
	"iconPicker.cat.Toggle": "Schalter",
	"iconPicker.cat.Transit": "Transit",
	"iconPicker.cat.Transportation": "Transport",
	"iconPicker.cat.Travel": "Reise",
	"iconPicker.cat.Travel + Hotel": "Reise und Hotel",
	"iconPicker.cat.UI actions": "UI-Aktionen",
	"iconPicker.cat.Users + People": "Benutzer und Personen",
	"iconPicker.cat.Vehicles": "Fahrzeuge",
	"iconPicker.cat.Version control": "Versionskontrolle",
	"iconPicker.cat.Weather": "Wetter",
	"iconPicker.cat.Writing": "Schreiben",
	"iconPicker.cat.Zodiac": "Tierkreis",

	// Downloadable icon packs
	"iconPack.downloadTitle": "{{name}} wurde noch nicht heruntergeladen",
	"iconPack.downloadDetail":
		"{{count}} Symbole · {{size}} · Einmaliger Download",
	"iconPack.download": "Herunterladen",
	"iconPack.downloading": "{{name}} wird heruntergeladen…",
	"iconPack.downloadFailed":
		"{{name}} konnte nicht heruntergeladen werden. Überprüfen Sie Ihre Verbindung und versuchen Sie es erneut.",
	"iconPack.retry": "Erneut versuchen",
	"iconPack.faBrandsNotice":
		"Marken-Symbole sind Markenzeichen ihrer jeweiligen Eigentümer. Ihre Aufnahme impliziert keine Empfehlung. Bitte verwenden Sie sie nur zur Darstellung des Unternehmens, Produkts oder der Dienstleistung, für das sie stehen.",
	"iconPack.artworkRestored":
		"Die Symbol-Grafiken für {{names}} wurden heruntergeladen.",
	"iconPack.diskWriteFailed":
		"Callout Studio konnte das Symbol-Paket nicht auf der Festplatte speichern; es muss beim nächsten Mal erneut heruntergeladen werden. Die ausgewählten Symbole werden weiterhin mit Ihren Einstellungen gespeichert.",

	// Icon licences & credits
	"credits.title": "Symbol-Lizenzen und Quellenangaben",
	"credits.intro":
		"Callout Studio nutzt mehrere offene Symbol-Bibliotheken. Ihre Lizenzen sind nachfolgend wiedergegeben, zusammen mit den vorgenommenen Anpassungen für die hiesige Verwendung.",
	"credits.fullNotices": "Vollständige Drittanbieter-Hinweise",
	"credits.pluginLicense":
		"Callout Studios eigener Code steht unter einer permissiven Lizenz; die Symbol-Bibliotheken behalten ihre eigenen Lizenzen.",

	"contextMenu.editCallout": "Callout-Einstellungen bearbeiten",
	"contextMenu.copyMarkdown": "Callout-Markdown kopieren",
	"contextMenu.openSettings": "Callout Studio-Einstellungen öffnen",
	"contextMenu.setFoldClosed": "Callout als geschlossen festlegen (-)",
	"contextMenu.setFoldOpen": "Callout als geöffnet festlegen (+)",
	"contextMenu.setFoldNone": "Callout nicht faltbar machen",
	"contextMenu.cutSection": "Überschriftsabschnitt ausschneiden",
	"contextMenu.copySection": "Überschriftsabschnitt kopieren",
	"contextMenu.deleteSection": "Überschriftsabschnitt löschen",
	"heading.toggleFold": "Faltung umschalten",
	"settings.globalSettings": "Globale Callout Studio-Stiloptionen",
	"settings.globalSettingsScope":
		"Dies sind globale Einstellungen: Jede davon ändert auf einen Schlag Form, Abstand und Größe jedes Callouts, das Callout Studio gestaltet. Callouts, die Ihr Theme gestaltet, behalten das eigene Design des Themes.",
	"settings.globalSettingsRegularDesc":
		"Passen Sie Rahmen, Radius, Schriftskalierung und Ausrichtung jedes Block-Callouts in Ihrem Tresor an.",
	"settings.globalSettingsHeadingDesc":
		"Passen Sie Rahmen, Form und vertikalen Abstand jedes Überschriften-Callouts in Ihrem Tresor an.",
	"settings.globalSettingsInlineDesc":
		"Passen Sie Rahmen und Form jedes Inline-Callouts in Ihrem Tresor an.",
	"settings.globalSettingsCustomize": "Anpassen",
	"settings.calloutTypeRegular": "Block callout",
	"settings.calloutTypeHeading": "Überschrift-Callout",
	"settings.calloutTypeInline": "Inline-Callout",
	"settings.customizeMenu": "Menüelemente anpassen",
	"settings.customizeMenuDesc":
		"Wählen Sie, welche Rechtsklick-Aktionen für jeden Callout-Typ angezeigt werden, und ordnen Sie sie neu an. Funktioniert im Quellmodus und in der Live-Vorschau.",
	"settings.customizeMenuButton": "Menüelemente anpassen",
	"menuCustomize.title": "Rechtsklickmenü anpassen",
	"menuCustomize.desc":
		"Aktionen ein- oder ausschalten und den Griff ziehen, um sie neu anzuordnen. Änderungen werden automatisch gespeichert.",
	"menuCustomize.regular": "Block callout",
	"menuCustomize.heading": "Überschrift-Callout",
	"menuCustomize.inline": "Inline-Callout",
	"menuCustomize.dragHandle": "Zum Neuanordnen ziehen",
	"menuItem.edit": "Callout bearbeiten",
	"menuItem.openSettings": "Einstellungen öffnen",
	"menuItem.copyMarkdown": "Markdown kopieren",
	"menuItem.foldDefaults":
		"Standard-Faltzustand (offen / geschlossen / keiner)",
	"menuItem.cutSection": "Abschnitt ausschneiden",
	"menuItem.copySection": "Abschnitt kopieren",
	"menuItem.deleteSection": "Abschnitt löschen",

	"confirm.ok": "Löschen",
	"confirm.cancel": "Abbrechen",
	// Headings for each confirmation — every window carries one, so each
	// caller of ConfirmModal names what it is about to do.
	"confirm.titleDeleteCommand": "Befehl löschen",
	"confirm.titleResetAll": "Alle Callouts zurücksetzen",
	"confirm.titleResetCallout": "Callout zurücksetzen",
	"confirm.titleDeletePalette": "Palette löschen",
	"confirm.titleDeleteImage": "Bild löschen",

	"vault.filesUpdated":
		"{{count}} Callout-Referenz(en) in Vault-Dateien aktualisiert.",
	"vault.idsUpdated":
		"{{count}} Callout-ID(s) in Vault-Dateien aktualisiert: {{oldIds}} → {{newId}}",
	"vault.titlesUpdated":
		"{{count}} Callout-Titel in Vault-Dateien aktualisiert: {{oldTitle}} → {{newTitle}}",
	"vault.replaceWith": "Ersetzen durch:",
	"vault.deleteWithout": "Ohne Ersetzen löschen",
	"vault.confirmDelete": "Bestätigen",
	"vault.confirmReplace": "Ersetzen",
	"vault.replacePromptInUse":
		'"{{name}}" wird {{count}} Mal in {{files}} Datei(en) verwendet. Wählen Sie einen Callout, durch den er ersetzt werden soll:',
	"vault.replacePromptUnused":
		'Wählen Sie einen Callout, durch den "{{name}}" ersetzt werden soll:',
	"vault.noReplacementAvailable":
		"Keine anderen Callouts zum Ersetzen verfügbar.",
	"vault.convertedToPlainText":
		"{{blocks}} Callout-Block(s) in {{files}} Datei(en) in einfachen Text umgewandelt.",
	"vault.resetAliasWarning":
		"{{count}} Referenz(en) in {{files}} Datei(en) verwenden benutzerdefinierte Aliase: {{aliases}}. Diese werden nach dem Zurücksetzen nicht mehr funktionieren. Fortfahren?",
	"vault.resetConfirm": "Zurücksetzen",
	"vault.resetAllInUse":
		"⚠ {{count}} Callout-Referenz(en) in {{files}} Datei(en) verwenden benutzerdefinierte Callout-Typen, die gelöscht werden.",

	"quickInsert.title": "Block-Callout schnell einfügen",
	"quickInsert.desc": "Callout auswählen, der an der Cursorposition eingefügt wird. Nur Block-Callouts.",
	"quickInsert.searchPlaceholder": "Callouts durchsuchen",
	"quickInsert.sourceAria": "Nach Callout-Quelle filtern",
	"quickInsert.sourceAll": "Alle",
	"quickInsert.sourceBuiltIn": "Integriert",
	"quickInsert.sourceUser": "Meine Callouts",
	"quickInsert.editAria": "{{name}} bearbeiten",
	"quickInsert.insertAria": "{{name}} als Block-Callout einfügen",
	"quickInsert.noResults": "Keine Callouts gefunden",
	"quickInsert.noUserCallouts": "Du hast noch keine Callouts erstellt.",
	"quickInsert.noEditorHint": "Keine Notiz ist im Bearbeitungsmodus geöffnet, daher kann nichts eingefügt werden.",
	"quickInsert.noEditor": "Öffne eine Notiz im Bearbeitungsmodus, um einen Callout einzufügen.",

	"vaultStats.title": "Callout-Statistiken",
	"vaultStats.totalCallouts": "Callouts gesamt",
	"vaultStats.typesFound": "Gefundene Typen",
	"vaultStats.filesWithCallouts": "Dateien mit Callouts",
	"vaultStats.filesScanned": "Gescannte Markdown-Dateien",
	"vaultStats.empty": "Keine Callouts in Markdown-Notizen gefunden.",
	"vaultStats.columnType": "Typ",
	"vaultStats.columnName": "Name",
	"vaultStats.columnSource": "Quelle",
	"vaultStats.columnCount": "Anzahl",
	"vaultStats.columnFiles": "Dateien",
	"vaultStats.unknown": "Unbekannt",
	"vaultStats.sourceBuiltIn": "Integriert",
	"vaultStats.sourceCustom": "Benutzerdefiniert",
	"vaultStats.sourceAutoFallback": "Automatischer Fallback",
	"vaultStats.sourceTheme": "CSS-Snippet",
	"vaultStats.sourceAlias": "Alias von {{id}}",
	"vaultStats.sourceUnknown": "Unbekannt",
	"vaultStats.byRole": "Geschrieben als",
	"vaultStats.roleBlock": "Block",
	"vaultStats.roleHeading": "Überschrift",
	"vaultStats.roleInline": "Inline",
	"vaultStats.close": "Schließen",

	"import.title": "Importprobleme",
	"import.reportLeadIn":
		"Die importierte Datei scheint verändert worden zu sein. Hier ist die Liste der Probleme:",
	"import.reportLeadInFatal":
		"Diese Datei sieht nicht wie ein Callout Studio-Export aus. Sie kann nicht importiert werden:",
	"import.entryHeading": "Eintrag {{index}} — {{label}}",
	"import.summary":
		"{{valid}} von {{total}} Einträgen sind gültig · {{issues}} Problem(e) gefunden.",
	"import.btnCancel": "Abbrechen",
	"import.btnImportValid": "Nur gültige importieren ({{count}})",
	"import.err.notRecognized":
		"Datei nicht erkannt: Es wurde ein Array von Callout-Definitionen oder ein Callout-Studio-Export erwartet.",
	"import.warn.settingsIgnored":
		"Der Einstellungsblock war kein gültiges Objekt und wurde ignoriert.",
	"import.warn.invalidGradient":
		"Der Hintergrundverlauf war ungültig und wurde ignoriert.",
	"import.err.parseFailed":
		"Die Datei ist kein gültiges JSON und konnte nicht geparst werden.",
	"import.err.entryNotObject": "Der Eintrag muss ein Objekt sein.",
	"import.err.requiredMissing":
		'Das Pflichtfeld "{{field}}" fehlt oder hat den falschen Typ.',
	"import.err.idEmpty": "Die ID darf nicht leer sein.",
	"import.err.idTooLong":
		'Die ID "{{value}}" hat {{length}} Zeichen; das Maximum ist {{max}}.',
	"import.err.idBadChar":
		'Die ID "{{value}}" enthält ungültige Zeichen ("|", "[", "]", Tabulatoren und Zeilenumbrüche sind nicht erlaubt).',
	"import.err.idMetadata":
		'Die ID "{{value}}" enthält ein "|". In Obsidian ist alles nach dem ersten "|" Callout-Metadaten und nicht Teil des Typs. Daher beschreibt dieser Eintrag den Callout "{{id}}". Übersprungen, sodass Ihr vorhandenes "{{id}}" unverändert bleibt.',
	"import.err.idReserved":
		'Die ID "{{value}}" ist von Callout Studio für seine eigenen Vorschauen reserviert und kann nicht importiert werden.',
	"import.err.displayNameEmpty": "Der Anzeigename darf nicht leer sein.",
	"import.err.displayNameTooLong":
		"Der Anzeigename hat {{length}} Zeichen; das Maximum ist {{max}}.",
	"import.err.boolField":
		'"{{field}}" muss ein Boolean sein (true oder false).',
	"import.err.iconNotObject": "Das Symbol muss ein Objekt sein.",
	"import.err.iconTypeInvalid":
		'Der Symboltyp "{{value}}" ist keiner der folgenden: {{types}}.',
	"import.warn.iconFieldIgnored":
		'"{{field}}" gilt nur für Material-Symbole und wird für den Symboltyp {{type}} ignoriert.',
	"import.err.iconValueEmpty":
		"Der Symbolwert muss eine nicht leere Zeichenkette sein.",
	"import.err.iconValueTooLong":
		"Der Symbolwert ist ungewöhnlich lang ({{length}} Zeichen).",
	"import.err.materialStyle":
		'Der Material-Symbolstil "{{value}}" ist keiner der folgenden: outlined, filled, rounded, sharp.',
	"import.err.materialWeight":
		'Das Material-Symbolgewicht "{{value}}" muss eine ganze Zahl zwischen 100 und 700 in 100er-Schritten sein.',
	"import.warn.iconRecolorIgnored":
		'"recolor" gilt nur für eigene Bilder und wird für den Symboltyp {{type}} ignoriert.',
	"import.err.iconRecolorInvalid":
		'"recolor" muss true oder false sein (Wert: "{{value}}").',
	"import.err.colorInvalid":
		'"{{field}}" muss eine Hex-Farbe wie "#448aff" sein (erhalten: "{{value}}").',
	"import.err.numberRange":
		'"{{field}}" muss eine Zahl zwischen {{min}} und {{max}} sein (erhalten: "{{value}}").',
	"import.err.iconSizeRange":
		'"{{field}}" muss eine Zahl zwischen {{min}} und {{max}} sein (erhalten: "{{value}}").',
	"import.err.iconAdjustShape":
		'"iconAdjust" must be an object mapping a callout type ("regular", "heading", "inline") to its icon size and offsets.',
	"import.err.aliasesNotArray":
		'"aliases" muss ein Array von Zeichenketten sein.',
	"import.err.aliasNotString": "Der Alias muss eine Zeichenkette sein.",
	"import.err.aliasDup":
		'Der Alias "{{value}}" ist in diesem Eintrag doppelt vorhanden.',
	"import.err.tooManyIds":
		"Zu viele IDs ({{count}}); jeder Callout kann maximal {{max}} IDs haben (primär + Aliase).",
	"import.err.metadataShape":
		'"metadata" muss ein Objekt sein, dessen Werte alle Zeichenketten sind.',
	"import.warn.unknownFields": "Unbekannte Felder ignoriert: {{fields}}.",
	"import.err.duplicateInFile":
		'Die ID/der Alias "{{value}}" wird bereits von Eintrag #{{first}} in dieser Datei verwendet.',
	"import.err.aliasConflict":
		'Der Alias "{{value}}" wird bereits von einem anderen Callout ("{{other}}") in Ihrem Vault verwendet.',
	"import.warn.defaultFoldedAutofix":
		'"defaultFolded" war true, während "foldable" false war; defaultFolded wurde auf false zurückgesetzt.',
	"import.warn.imageMissing":
		"Dieser Callout verwendet ein Bild, das weder in der Datei noch im Vault vorhanden ist; es wird ein Platzhalter-Symbol angezeigt, bis Sie ein neues festlegen.",

	"import.err.paletteIdInvalid":
		'"paletteId" muss eine nicht leere Text-ID sein (erhalten: "{{value}}").',
	"import.warn.iconNameUnknown":
		'Es gibt kein Symbol "{{value}}" in {{type}}, daher wurde das Standardsymbol verwendet.',
	"import.warn.cmIconUnknownNew":
		'Das Symbol "{{value}}" ist in diesem Vault nicht verfügbar, daher wurde das Standardsymbol verwendet.',
	"import.warn.cmIconUnknownExisting":
		'Das Symbol "{{value}}" ist in diesem Vault nicht verfügbar, daher hat "{{id}}" das bereits vorhandene Symbol behalten.',
	"import.chooseSource": "Importieren aus",
	"import.sourceStudio": "Callout Studio",
	"import.sourceStudioDesc":
		"Eine aus Callout Studio exportierte .json-Datei laden.",
	"import.sourceCalloutManager": "Callout Manager",
	"import.sourceCalloutManagerDesc":
		"Übernimm deine angepassten Callouts aus dem Callout Manager-Plugin.",
	"import.sourceAdmonition": "Admonition",
	"import.sourceAdmonitionDesc":
		"Übernimm deine eigenen Admonitions aus dem Admonition-Plugin.",
	"import.cmTitle": "Aus Callout Manager importieren",
	"import.cmInstructions":
		"Jeder angepasste Callout wird mit Symbol und Farbe übernommen. " +
		"Theme-abhängige Stile und eigenes CSS haben hier keine Entsprechung " +
		"und werden nicht übernommen.",
	"import.cmFromVault": "Dieser Tresor",
	"import.cmVaultChecking": "Suche nach dem Callout Manager-Plugin…",
	"import.cmVaultFound": "{{count}} angepasste(r) Callout(s) gefunden.",
	"import.cmVaultNotFound":
		"In diesem Tresor wurden keine angepassten Callouts gefunden.",
	"import.cmPasteLabel":
		"Oder füge die kopierten Stile von Callout Manager hier ein:",
	"import.cmPlaceholder": "Kopierte Stile oder eine data.json hier einfügen…",
	"import.cmBtnCancel": "Abbrechen",
	"import.cmBtnImport": "Importieren",
	"import.err.cmNoBlocksFound":
		"Im eingefügten Text wurden keine Callout Manager-Stile gefunden.",
	"import.err.cmNotRecognized":
		"Unbekannte Datei: erwartet werden die Stile aus dem Copy-Button von " +
		"Callout Manager oder eine data.json von Callout Manager.",
	"import.err.cmNoEntries":
		"Es wurden keine angepassten Callouts zum Importieren gefunden.",
	"import.err.cmNoColorForNew":
		'Für den neuen Callout "{{value}}" wurde keine verwendbare Farbe gefunden; er wurde übersprungen.',
	"import.err.cmIdConflict":
		'Die ID "{{value}}" wird bereits als Alias von einem anderen Callout ("{{other}}") verwendet und wurde übersprungen.',
	"import.warn.cmNoColorDefault":
		"In Callout Manager war keine Farbe festgelegt, daher wurde das " +
		"Standardgrau verwendet.",
	"import.warn.cmThemeCondition":
		"Farbe oder Symbol dieses Callouts wurden nur für ein Theme " +
		"festgelegt. Callout Studio kennt keine Theme-abhängigen Stile, " +
		"daher wurde die Einstellung für alle Themes übernommen.",
	"import.warn.cmCustomStyles":
		"Dieser Callout hat außerdem eigenes CSS in Callout Manager. Diese " +
		"Stile sind nicht Teil des Imports, daher wurden nur Symbol und " +
		"Farbe übernommen.",

	// Import — Admonition
	"import.admTitle": "Aus Admonition importieren",
	"import.admInstructions":
		"Jede Admonition wird zu einem Callout mit Name, Symbol und " +
		"Farbe. Einstellungen ohne Entsprechung in Callout Studio " +
		"(Befehl, Kopier-Schaltfläche, ausgeblendeter Titel) bleiben " +
		"zurück.",
	"import.admFromVault": "Dieser Tresor",
	"import.admVaultChecking": "Suche nach dem Admonition-Plugin…",
	"import.admVaultFound": "{{count}} eigene Admonition(s) gefunden.",
	"import.admVaultNotFound":
		"In diesem Tresor wurden keine eigenen Admonitions gefunden.",
	"import.admFromFile": "Eine Datei",
	"import.admFromFileDesc":
		"Eine admonitions.json-Datei oder ein geteiltes Paket.",
	"import.admChooseFile": "Datei wählen…",
	"import.admPasteLabel": "Oder füge das JSON hier ein:",
	"import.admPlaceholder": "Füge deine Admonitions hier ein…",
	"import.admBtnCancel": "Abbrechen",
	"import.admBtnImport": "Importieren",
	"import.err.admNotRecognized":
		"Datei nicht erkannt: erwartet wurde eine Liste von Admonitions " +
		"oder eine data.json von Admonition.",
	"import.err.admNoEntries":
		"Es wurden keine Admonitions zum Importieren gefunden.",
	"import.err.admTypeMissing":
		'Diese Admonition hat kein "type" und wurde übersprungen.',
	"import.warn.admIconUnknown":
		"In keiner Symbolbibliothek gibt es ein Symbol namens " +
		'"{{value}}", daher wurde das Standardsymbol verwendet.',
	"import.warn.admIconUnknownExisting":
		"In keiner Symbolbibliothek gibt es ein Symbol namens " +
		'"{{value}}", daher hat "{{id}}" sein bisheriges Symbol behalten.',
	"import.warn.admImageFailed":
		"Das hochgeladene Bild konnte nicht gelesen werden, daher wurde " +
		"das Standardsymbol verwendet.",
	"import.warn.admIconWithCss":
		"Diese Admonition wird in Admonition über ein CSS-Snippet " +
		"gestaltet. Dieses Styling gehört nicht zum Import — übernommen " +
		"wurden nur Name, Symbol und Farbe.",
	"import.warn.admNoColor":
		"Es war keine Farbe gesetzt, daher wurde das Standardblau " +
		"verwendet.",
	"import.warn.admTitleTruncated":
		"Der Titel hat {{length}} Zeichen; er wurde auf {{max}} gekürzt.",

	"footer.tagline":
		"Feedback, Kommentare oder Vorschläge? Ich würde mich freuen, von Ihnen zu hören!",
	"footer.madeBy": "Erstellt von Niv  •  ",
	"settings.deletePaletteConfirmLinkedOne":
		'Palette "{{name}}" löschen?\n1 Callout verwendet sie. Es behält seine Farben, und du kannst sie später über die Farbzeile im Editor wieder verknüpfen.',
	"settings.deletePaletteConfirmLinked":
		'Palette "{{name}}" löschen?\n{{count}} Callouts verwenden sie. Sie behalten ihre Farben, und du kannst sie später über die Farbzeile in jedem ihrer Editoren wieder verknüpfen.',
	"settings.unlinkedColors": "Nicht verknüpfte Farben",
	"settings.unlinkedColorsDesc":
		"Callouts, deren gespeicherte Farbe gelöscht wurde. Sie behalten ihre bisherigen Farben; beim Wiederherstellen wird die Farbe erneut gespeichert und die ganze Gruppe wieder verknüpft.",
	"settings.unlinkedColorOne": "1 Callout",
	"settings.unlinkedColorCount": "{{count}} Callouts",
	"settings.restoreColor": "Wiederherstellen",
	"settings.palettesMergedNotice":
		"{{count}} importierte Palette(n) wurden mit gespeicherten Farben zusammengeführt, die bereits dieselben Farben hatten.",
	"notice.palettesMerged":
		"{{count}} gespeicherte Farbe(n) mit identischen Farben wurden zusammengeführt: {{names}}. Die Callouts, die sie verwenden, behalten ihre Farben und sind jetzt mit der verbleibenden Farbe verknüpft.",
	"editor.colorsDescDeleted":
		"Die gespeicherte Farbe dieses Callouts wurde gelöscht. Du kannst sie wieder speichern, indem du {{link}}.",
	"editor.colorsDescDeletedOther":
		"Die gespeicherte Farbe dieses Callouts wurde gelöscht. Du kannst sie wieder speichern, indem du {{link}} — 1 weiteres Callout, das sie nutzt, wird ebenfalls wieder verknüpft.",
	"editor.colorsDescDeletedOthers":
		"Die gespeicherte Farbe dieses Callouts wurde gelöscht. Du kannst sie wieder speichern, indem du {{link}} — {{count}} weitere Callouts, die sie nutzen, werden ebenfalls wieder verknüpft.",
	"editor.colorsDescDeletedLink": "hier klickst",
	"palette.colorExists":
		'Diese Farben sind identisch mit "{{name}}". Zwei gespeicherte Farben dürfen nicht gleich sein — ändere eine Farbe, um sie zu unterscheiden.',
	"palette.colorExistsUse":
		'Diese Farben sind identisch mit "{{name}}". Zwei gespeicherte Farben dürfen nicht gleich sein — ändere eine Farbe oder {{link}}.',
	"palette.colorExistsUseLink": "die bestehende verwenden",
	"locale.downloading": "Übersetzung wird heruntergeladen…",
	"locale.notDownloaded": "{{name}} wurde noch nicht heruntergeladen",
	"locale.notDownloadedDesc":
		"Callout Studio zeigt Englisch, bis die Übersetzung heruntergeladen werden kann. Beim nächsten Start von Obsidian wird es erneut versucht.",
	"locale.retry": "Erneut versuchen",
	"locale.diskWriteFailed":
		"Callout Studio konnte die Übersetzung nicht auf der Festplatte speichern. Sie muss beim nächsten Mal erneut heruntergeladen werden.",
	"notice.exportedCssCreated": "CSS-Snippet in {{path}} gespeichert",
	"notice.exportedCssUpdated": "CSS-Snippet in {{path}} aktualisiert",
	"notice.exportedCssUnchanged": "Das CSS-Snippet ist bereits aktuell.",
	"notice.exportCssEmpty":
		"Es gibt keine benutzerdefinierten Callouts zum Exportieren.",
	"notice.exportCssFailed":
		"Das CSS-Snippet konnte nicht gespeichert werden. Einzelheiten finden Sie in der Entwicklerkonsole.",
	"notice.exportCssEnabled":
		"Dieses Snippet ist in diesem Vault aktiviert. Callout Studio gestaltet diese Callouts bereits, und das Snippet behält den Stand beim Export bei.",
	"confirm.titleOverwriteSnippet": "CSS-Snippet überschreiben",
	"confirm.overwriteSnippet":
		"Das CSS-Snippet in Ihrem Snippets-Ordner wurde geändert, seit Callout Studio es geschrieben hat. Ein erneuter Export ersetzt die gesamte Datei.",
	"confirm.overwriteSnippetOk": "Überschreiben",
	"export.chooseFormat": "Exportieren als",
	"export.formatJson": "Callout-Studio-Sicherung",
	"export.formatJsonDesc":
		"Eine .json-Datei mit Ihren Callouts und Einstellungen zum Import in einen anderen Vault.",
	"export.formatCss": "CSS-Snippet",
	"export.formatCssDesc":
		"Eine .css-Datei im Snippets-Ordner dieses Vaults, für die Verwendung ohne installiertes Callout Studio. Sie umfasst nur reguläre Callouts und ist eine Momentaufnahme; nach Änderungen erneut exportieren.",
	"quickInsert.readingViewHint": "Diese Notiz ist im Lesemodus geöffnet, daher kann nichts eingefügt werden.",
	"quickInsert.readingView": "Wechsle in den Quellmodus oder die Live-Vorschau, um einen Callout einzufügen.",
	"quickInsert.noCursorHint": "In dieser Notiz gibt es keinen Cursor, daher gibt es keine Einfügeposition.",
	"quickInsert.noCursor": "Platziere den Cursor in der Notiz an der Stelle, an der du den Callout einfügen möchtest, und versuche es erneut.",
	"notice.legacyDiscoveryArchived": "Upgrade recovery copy saved: {{path}}. It contains the previous discovery cache and startup CSS for recovery only; no callout types were restored automatically.",
	"notice.legacyDiscoveryArchiveFailed": "The upgrade recovery copy could not be completed. The previous local discovery cache and startup CSS have been kept unchanged. Check storage access and free space, then restart Obsidian to retry.",
};
