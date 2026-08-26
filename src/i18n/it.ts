export const it: Record<string, string> = {
	"cmd.openSettings": "Apri impostazioni",
	"cmd.createCallout": "Crea nuovo tipo di callout",
	"cmd.insertEmptyCallout": "Inserisci callout vuoto",
	"cmd.calloutWrap": "Racchiudi in callout",
	"cmd.calloutUnwrap": "Rimuovi callout",

	"cmd.customWrapBlock": "Racchiudi in callout a blocco {{name}}",
	"cmd.customInsertBlock": "Inserisci callout a blocco {{name}}",
	"cmd.customInsertHeading": "Inserisci titolo callout H{{level}} {{name}}",
	"cmd.customInsertInline": "Inserisci callout in linea {{name}}",
	"cmd.openQuickInsert": "Inserimento rapido di callout a blocco",

	"autocomplete.createNew": 'Crea nuovo callout: "{{name}}"',

	"settings.fallbackTag": "Predefinito",
	"settings.fallbackTagAuto": "Predefinito automatico",
	"settings.rescanVault": "Riscansiona vault",
	"settings.rescanVaultDesc":
		"Cerca ID callout non riconosciuti nelle note e li aggiunge come righe di fallback.",
	"settings.rescanVaultHintAction": "Scansiona ora",
	"settings.rescanComplete":
		"Riscansione completata: {{count}} nuovo/i callout aggiunto/i.",
	"replaceModal.deleteWithoutReplaceSuffix": "(torna al predefinito)",
	"replaceModal.titleDelete": "Elimina callout",
	"replaceModal.titleReplace": "Sostituisci nel vault",

	"firstRun.title": "Trovare callout esistenti nel vault?",
	"firstRun.body":
		"Callout Studio può scansionare il vault per scoprire i callout già in uso, così appariranno nell'elenco delle impostazioni e adotteranno lo stile di fallback.",
	"firstRun.heavyVaultNote":
		"Il tuo vault ha {{count}} file Markdown — la scansione potrebbe richiedere alcuni secondi.",
	"firstRun.laterHint":
		"Puoi sempre eseguirlo in seguito da Impostazioni → Approfondimenti e manutenzione vault → Riscansiona vault.",
	"firstRun.scanNow": "Scansiona ora",
	"firstRun.noThanks": "No, grazie",
	"firstRun.autoScanComplete":
		"Callout Studio ha scansionato il vault e aggiunto {{count}} callout.",
	"firstRun.scanning": "Scansione",

	"welcome.tooltip": "Informazioni su Callout Studio",
	"welcome.title": "Benvenuto in Callout Studio",
	"welcome.tagline":
		"La tua soluzione completa per gestire i callout di Obsidian.",
	"welcome.previewTitle": "Guardalo in azione",
	"welcome.sample":
		"Callout Studio ti permette di creare callout con un'icona, colori e nome personalizzati.\n\n" +
		"Puoi usare lo stesso callout in **tre** modi diversi:\n\n" +
		"## [!tip] Come titolo\n" +
		"Per trasformare qualsiasi titolo in un titolo in stile callout, aggiungi `[!type]` subito dopo i `#`.\n\n" +
		"Vuoi un callout inline come questo [!warning]? Basta aggiungere `[!type]` in mezzo a una frase, senza interrompere il flusso.\n\n" +
		"> [!note] Block Callout\n" +
		"> Naturalmente, il callout classico funziona con la stessa identica sintassi a cui sei già abituato: `> [!type]`.\n\n" +
		"Callout Studio ha molto altro da offrire! [Scopri di più]({{repoUrl}}).\n",

	"deleteModal.title": 'Elimina callout "{{name}}"?',
	"deleteModal.bodyInUse":
		"Questo callout appare {{count}} volta/e in {{files}} file.",
	"deleteModal.bodyInUseExplain":
		"L'eliminazione convertirà quei blocchi in testo normale — perderanno lo stile e l'intestazione del callout.",
	"deleteModal.replaceHint":
		"Puoi sostituirlo con un altro callout, mantenendo il contenuto del vault come callout stilizzato.",
	"deleteModal.bodyUnused":
		'"{{name}}" non è usato in nessuna nota, ma è un callout personalizzato che hai creato. L\'eliminazione lo rimuoverà da questo elenco.',
	"deleteModal.replaceInstead": "Sostituisci invece",
	"deleteModal.deleteInUse": "Elimina (converti in testo normale)",
	"deleteModal.deleteUnused": "Elimina callout",

	// The variant for a callout whose definition Callout Studio cannot remove:
	// one of Obsidian's built-ins, or a type the active theme declares.
	"deleteModal.titleKeep": 'Eliminare tutti gli usi di "{{name}}"?',
	"deleteModal.keepsRowBuiltIn":
		"Questo è uno dei callout integrati di Obsidian, quindi il tipo stesso rimane disponibile — cambiano solo i suoi usi nelle tue note.",
	"deleteModal.keepsRowTheme":
		"{{theme}} definisce questo tipo di callout, quindi rimane disponibile e mantiene il suo aspetto. Callout Studio modifica solo le note nel tuo vault — nulla che appartenga al tuo tema viene toccato.",
	"deleteModal.clearUsages": "Elimina usi (converti in testo normale)",

	"settings.title": "Callout Studio",
	"settings.myCalloutTypes": "I miei tipi di callout",
	"settings.builtInCallouts": "Callout integrati",
	"settings.contextMenu": "Menu contestuale",
	"settings.autocomplete": "Completamento automatico",
	"settings.keyboardShortcuts": "Scorciatoie da tastiera",
	"settings.language": "Lingua",
	"settings.languageDesc":
		"Lingua di visualizzazione di Callout Studio. Per impostazione predefinita segue la lingua dell'interfaccia di Obsidian.",
	"settings.languageAuto": "Automatico (come Obsidian)",
	"settings.importExport": "Importa / esporta",
	"settings.import": "Importa",
	"settings.export": "Esporta",
	"settings.importDesc":
		"Importa i dati di Callout Studio da un altro vault usando un file JSON.",
	"settings.exportDesc":
		"Salva tutti i tipi di callout personalizzati in formato JSON.",
	"settings.importConflictNotice":
		"Importato/i {{count}} tipo/i di callout; {{overwritten}} voce/voci esistente/i sovrascritte.",

	"settings.addNewCallout": "+ aggiungi callout",

	"settings.noCalloutsNow": "Per ora nessun callout personalizzato.",

	"settings.editAria": "Modifica {{name}}",
	"settings.moreRowActionsAria": "Altre azioni per {{name}}",
	"settings.usageInfo": "{{count}} utilizzo/i in {{files}} file",
	"settings.replaceAction": "Sostituisci nel vault",
	"settings.deleteAction": "Elimina",
	"settings.resetAction": "Ripristina predefinito",
	"settings.makeFallbackAction": "Usa stile di fallback predefinito",
	"settings.colorSwatchAria": "Accento: {{accent}} · Sfondo: {{bg}}",

	// Handing a callout to the user's own CSS. Not a statement about the theme —
	// that is derived and has no action — so the wording names the snippet.
	"settings.externalCssAction": "Applica uno stile con il mio CSS",
	"settings.externalCssStopAction": "Lascia che Callout Studio applichi di nuovo lo stile",
	// The one label on any row: a callout sitting among the user's own that
	// Callout Studio has nonetheless stopped painting.
	"settings.externalCssTag": "CSS esterno",
	// Settings — callouts the active theme styles
	"settings.themeCalloutsHeading": "Callout dal tuo tema",
	"settings.themeCalloutsDesc":
		"{{theme}} fornisce o ristilizza questi, quindi Callout Studio li lascia esattamente come li disegna il tuo tema e li offre solo come callout a blocco. Qui compaiono entrambi i tipi: i tipi di callout che il tuo tema aggiunge e i callout integrati di cui sostituisce l'aspetto. I tipi di callout aggiunti dal tuo tema sono elencati solo mentre è attivo.",
	"settings.themeCalloutsDefaultTheme": "Il tuo tema",
	"settings.themePreviewAria":
		'Anteprima di "{{name}}" — guarda come lo disegna il tuo tema',
	"settings.clearUsesAction": "Elimina usi nelle tue note",
	"settings.builtInAllThemeStyled":
		"{{theme}} ristilizza ogni callout integrato, quindi sono tutti elencati sopra e Callout Studio non li tocca. Per progettarne uno tuo, aggiungi un callout con un ID diverso.",

	"settings.fallbackCallout": "Callout di fallback predefinito",
	"settings.fallbackCalloutDesc":
		"I tipi di callout non riconosciuti nel vault erediteranno lo stile di questo callout.",

	"settings.globalStyle": "Stile callout globale",
	"settings.border": "Bordi",
	"settings.borderAll": "Tutti",
	"settings.borderTop": "Superiore",
	"settings.borderRight": "Destro",
	"settings.borderBottom": "Inferiore",
	"settings.borderLeft": "Sinistro",
	"settings.borderWidth": "Spessore bordo",
	"settings.fontScaleGroup": "Scala font",
	"settings.titleScale": "Titolo",
	"settings.contentScale": "Contenuto",
	"settings.inlineTextScale": "Testo",
	"settings.shapeGroup": "Forma",
	"settings.borderRadius": "Arrotondamento angoli",
	"settings.alignGroup": "Allineamento",
	"settings.alignContent": "Allinea il contenuto al titolo",
	"settings.headingSpacingGroup": "Spaziatura titolo",
	"settings.headingPadVertical": "Spaziatura verticale",
	"settings.headingGap": "Spaziatura tra le intestazioni",
	"settings.headingFoldGroup": "Piega",
	"settings.headingFoldArrow": "Mostra freccia di piega",
	"settings.styleDemoName": "Esempio",
	"settings.previewTitle": "Anteprima",

	// Settings — Saved color palettes
	"settings.customPalettes": "Tavolozze di colori salvate",
	"settings.newPalette": "Nuova tavolozza",
	"settings.customPalettesEmpty": "Per ora nessuna tavolozza salvata.",
	"settings.editPaletteAria": "Modifica tavolozza {{name}}",
	"settings.deletePaletteAria": "Elimina tavolozza {{name}}",
	"settings.deletePaletteConfirm":
		'Eliminare la tavolozza "{{name}}"?\nI callout che usano i suoi colori non vengono modificati.',
	"settings.enableAutocomplete": "Abilita completamento automatico [!",
	"settings.enableAutocompleteDesc":
		"Mostra suggerimenti quando si digita \"[!\" in una citazione nell'editor. Scegli un tipo di callout dall'elenco per inserire un'intestazione callout completa.",

	"settings.customCommands": "Comandi e scorciatoie",
	"settings.customCommandsDesc":
		"Visualizza ogni comando di Callout Studio e la scorciatoia a cui è associato, e crea i tuoi comandi personalizzati per i callout che usi di più. Nessuna scorciatoia è assegnata per impostazione predefinita.",
	"settings.customCommandsButton": "Gestisci comandi",

	"commandBuilder.title": "Comandi e scorciatoie",
	"commandBuilder.desc":
		"Usa il pulsante + per impostare o cambiare una scorciatoia nelle impostazioni scorciatoie di Obsidian.",
	"commandBuilder.builtIn": "Comandi integrati",
	"commandBuilder.toggleAria": "Attiva o disattiva {{name}}",
	"commandBuilder.hotkeyBlank": "Vuoto",
	"commandBuilder.hotkeyAria": "Imposta una scorciatoia per {{name}}",
	"commandBuilder.yourCommands": "I tuoi comandi",
	"commandBuilder.newCommand": "Nuovo comando",
	"commandBuilder.empty": "Nessun comando personalizzato ancora.",
	"commandBuilder.unknownCommand": "questo comando",
	"commandBuilder.editAria": "Modifica {{name}}",
	"commandBuilder.deleteAria": "Elimina {{name}}",
	"commandBuilder.deleteConfirm":
		"Eliminare il comando {{name}}? Qualsiasi scorciatoia assegnata smetterà di funzionare.",
	"commandBuilder.newTitle": "Nuovo comando",
	"commandBuilder.editTitle": "Modifica comando",
	"commandBuilder.format": "Formato callout",
	"commandBuilder.formatDesc": "Il tipo di callout che il comando scrive.",
	"commandBuilder.formatHeading": "Intestazione",
	"commandBuilder.formatInline": "In linea",
	"commandBuilder.formatBlock": "Block",
	"commandBuilder.roleDisabled":
		"Questo formato è disattivato, quindi il comando inserirà testo semplice finché non lo riattivi.",
	"commandBuilder.callout": "Tipo di callout",
	"commandBuilder.calloutDesc": "Il callout che questo comando inserisce.",
	"commandBuilder.headingLevel": "Livello di intestazione",
	"commandBuilder.headingLevelDesc":
		"Quale livello di intestazione scrivere.",
	"commandBuilder.action": "Azione",
	"commandBuilder.actionDesc":
		"Racchiudi trasforma la selezione in un callout; inserisci ne aggiunge uno vuoto.",
	"commandBuilder.actionWrap": "Racchiudi selezione",
	"commandBuilder.actionInsert": "Inserisci nuovo",
	"commandBuilder.preview": "Nome del comando",
	"commandBuilder.duplicate": "Hai già un comando che fa esattamente questo.",
	"commandBuilder.noCallouts":
		"Non ci sono ancora tipi di callout da cui creare un comando.",
	"commandBuilder.save": "Salva",

	"commandBuilder.roleThemeOwned":
		"Il tuo tema fornisce questo callout, quindi ha solo il formato Block.",
	"commandBuilder.commandSuspended":
		"In pausa: il tuo tema fornisce questo callout, quindi ha solo il formato Block. Questo comando funzionerà di nuovo quando il tema smetterà di fornirlo.",

	"settings.vaultMaintenance": "Approfondimenti e manutenzione vault",
	"settings.vaultStats": "Statistiche callout",
	"settings.vaultStatsDesc":
		"Conta ogni callout nelle tue note Markdown — a blocco, di intestazione e in linea — e li raggruppa per tipo.",
	"settings.vaultStatsButton": "Visualizza statistiche",
	"settings.vaultStatsScanning": "Scansione",
	"settings.resetAll": "Ripristina",
	"settings.resetAllDesc":
		"Elimina tutti i callout utente, ripristina i callout integrati, gli stili globali (bordi, scala font, forma), le tavolozze di colori salvate, la personalizzazione del menu del clic destro e gli SVG Material scaricati.",
	"settings.resetAllButton": "Ripristina tutto",
	"settings.resetAllConfirm":
		"Questo eliminerà tutti i callout personalizzati, ripristinerà i callout integrati, gli stili globali, le tavolozze di colori salvate, la personalizzazione del menu del clic destro e tutti gli SVG Material nella cache. Questa azione non può essere annullata. Sei sicuro?",
	"notice.resetAllDone": "Tutto è stato ripristinato ai valori predefiniti.",

	"notice.customCommandsRemoved":
		"Rimosso/i {{count}} comando/i personalizzato/i il cui tipo di callout non esiste più.",
	"notice.customCommandMissingCallout":
		"Il tipo di callout di questo comando non esiste più.",

	"notice.exported": "Callout esportati in callout-studio-export.json",
	"notice.importedJSON": "Importato/i {{count}} tipo/i di callout da JSON.",
	"notice.importedSettings": "Impostazioni del plugin importate.",
	"notice.importedCalloutManager":
		"Importato da Callout Manager: {{created}} creati, {{updated}} aggiornati.",
	"notice.importedAdmonition":
		"Importato da Admonition: {{created}} creati, {{updated}} " +
		"aggiornati.",
	"notice.noNewJSON":
		"Nessun nuovo tipo di callout importato (gli ID potrebbero già esistere).",
	"notice.iconDownloadFailed":
		'Impossibile scaricare l\'icona Material "{{name}}". Potrebbe non essere disponibile per questo stile/peso, o la connessione è offline.',

	"notice.externalCssOn":
		"Callout Studio non applica più uno stile a \"{{name}}\" — il tuo CSS decide il suo aspetto. Le sue forme Callout di intestazione e Callout in linea non verranno visualizzate.",
	"notice.externalCssOff": 'Callout Studio applica di nuovo uno stile a "{{name}}".',

	"notice.nothingToWrap": "Niente da racchiudere.",
	"notice.cursorNotInsideCallout": "Il cursore non è dentro un callout.",
	"notice.autocompleteTargetMoved":
		"Non è stato inserito nulla: la riga è cambiata mentre l'editor era aperto.",
	"notice.openHotkeysFailed":
		"Impossibile aprire le impostazioni scorciatoie di Obsidian.",
	"notice.filterHotkeysFailed":
		"Impostazioni scorciatoie di Obsidian aperte, ma impossibile applicare il filtro Callout Studio.",

	"editor.editCallout": "Modifica callout",
	"editor.newCallout": "Nuovo callout",
	"editor.displayName": "Nome visualizzato",
	"editor.displayNameDesc": "L'etichetta leggibile mostrata nell'interfaccia",
	"editor.displayNameBuiltIn":
		"Il nome visualizzato non può essere modificato per i callout integrati",
	"editor.displayNamePlaceholder": "Il mio callout",
	"editor.calloutIds": "ID callout",
	"editor.calloutIdsDesc":
		"Tutti gli identificatori per questo callout. Sono consentiti gli spazi.\nPremi Invio o il pulsante + per aggiungere.",
	"editor.calloutIdsPlaceholder": "Aggiungi ID",
	"editor.addId": "Aggiungi ID",
	"editor.idLinkedToName": "Collegato al nome visualizzato",
	"editor.idCannotDelete":
		"Questo ID è collegato al nome visualizzato e non può essere eliminato — modifica il nome per cambiarlo",
	"editor.icon": "Icona",
	"editor.pickIcon": "Cambia icona",
	"editor.replaceIcon": "Sostituisci icona",
	"editor.removeIcon": "Rimuovi icona",
	"editor.noIcon": "Nessuna icona",
	"editor.resetIcon": "Ripristina icona predefinita",
	"editor.livePreview": "Anteprima live",
	"editor.iconAdjustment": "Regolazione icona",
	"editor.picture": "Immagine",
	"editor.size": "Dimensione",
	"editor.horizontalOffset": "Offset orizzontale",
	"editor.verticalOffset": "Offset verticale",
	"editor.colors": "Colori",
	"editor.colorsDesc":
		"Sets this callout's border, background, and text colors.",
	"editor.resetColors": "Ripristina colori predefiniti",
	"editor.paletteDeleted": "Colore eliminato",
	"editor.paletteGroupObsidian": "Callout Obsidian",
	"editor.paletteGroupPresets": "Preimpostazioni colore",
	"editor.paletteGroupCustom": "Personalizzati",
	"editor.paletteNewColor": "Nuovo colore…",
	"editor.contrastWarning":
		"Contrasto basso rispetto allo sfondo — potrebbe essere difficile da leggere",
	"editor.foldable": "Pieghevole",
	"editor.foldableDesc":
		"Scegli se il callout può essere piegato e quale stato predefinito applicare in tutto il vault.",
	"editor.foldOff": "Disattivato",
	"editor.foldOpen": "Aperto per impostazione predefinita",
	"editor.foldClosed": "Chiuso per impostazione predefinita",
	"editor.cancel": "Annulla",
	"editor.saveChanges": "Salva modifiche",
	"editor.createCallout": "Crea callout",
	"editor.nameRequired":
		"È necessario un nome visualizzato prima di creare un callout.",
	"editor.noChangesToSave": "Non sono state apportate modifiche.",
	"editor.downloadingIcon": "Download icona",
	"editor.idEmpty": "È richiesto almeno un ID",
	"editor.idExists": "Esiste già un callout con questo ID",
	"editor.idConflict": "Questo ID è in conflitto con un callout esistente",
	"editor.idDashConflict":
		'Obsidian scrive gli spazi come trattini, quindi questo ID è in conflitto con "{{other}}"',

	"editor.idFromTheme":
		"{{theme}} fornisce già un callout con questo ID, quindi Callout Studio non può applicargli uno stile. Scegli un ID diverso.",
	"editor.idThemePattern":
		"Attenzione: il tuo tema applica uno stile a ogni callout che corrisponde a {{pattern}}, quindi potrebbe sovrascrivere l'aspetto di questo.",

	"editor.untitledCallout": "Callout senza titolo",
	"editor.loremIpsum":
		"Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
	"editor.loremIpsumShort":
		"Lorem ipsum dolor sit amet, consectetur adipiscing elit.",
	"editor.sampleInlineText":
		"Ecco una pillola [!{id}] incorporata all'interno di un paragrafo.",
	"editor.previewReadOnly": "L'anteprima dal vivo non può essere modificata",

	// Theme callout preview window — opens instead of the editor for a callout
	// the active theme supplies or restyles.
	"themePreview.title": '{{name}} — fornito dal tuo tema',
	"themePreview.owned":
		"{{theme}} fornisce e stilizza \"{{name}}\". Callout Studio non lo sovrascriverà, quindi il suo callout a blocco ha esattamente l'aspetto che gli dà il tuo tema.",
	"themePreview.readOnly":
		"Questo significa che il suo colore, l'icona, il nome e l'ID non possono essere modificati qui. Se vuoi un design tuo, crea un nuovo callout con un ID diverso.",
	"themePreview.blockOnly":
		"I formati Intestazione e In linea non sono disponibili per i callout forniti dal tuo tema. I callout a blocco usano lo stile nativo del tema.",
	"themePreview.previewTitle": "Come appare ora",
	"themePreview.blockSample":
		"> [!{{id}}] {{name}}\n" +
		"> Ecco come appare il contenuto del callout.\n",

	"editor.externalStyleClose": "Capito",

	// Palette editor modal
	"palette.newTitle": "Nuova tavolozza di colori",
	"palette.groupPalette": "Tavolozza",
	"palette.editTitle": "Modifica tavolozza di colori",
	"palette.name": "Nome",
	"palette.namePlaceholder": "La mia tavolozza",
	"palette.nameExists": "Esiste già una tavolozza con questo nome",
	"palette.baseColor": "Colore di base",
	"palette.baseColorHint":
		"Adatteremo automaticamente il colore di sfondo a questo. Se preferisci, puoi controllarlo separatamente {{link}}.",
	"palette.baseColorHintLink": "cliccando qui",
	"palette.advancedColors": "Colori",
	"palette.advancedColorsHint":
		"Modifica dei colori per la modalità {{mode}} - l'altra modalità si aggiorna automaticamente. Cambia il tema di Obsidian per verificarlo.",
	"palette.revertHint": "Preferisci un unico colore di base? {{link}}.",
	"palette.revertHintLink": "Ripristina",
	"palette.lightMode": "Chiaro",
	"palette.darkMode": "Scuro",
	"palette.accentColor": "Colore accento",
	"palette.backgroundColorChannel": "Colore di sfondo",
	"palette.textColorChannel": "Colore del testo",
	"palette.bgIntensity": "Intensità",
	"palette.bgStyle": "Stile",
	"palette.bgSolid": "Tinta unita",
	"palette.bgGradient": "Sfumatura",
	"palette.bgTransparent": "Trasparente",
	"palette.gradientTo": "Secondo colore",
	"palette.gradientDirection": "Direzione",
	"palette.gradientText": "Testo del titolo sfumato",
	"palette.save": "Salva",

	// Color name suggestions (used to prefill palette names)
	"colorName.red": "Rosso",
	"colorName.orange": "Arancione",
	"colorName.amber": "Ambra",
	"colorName.yellow": "Giallo",
	"colorName.lime": "Lime",
	"colorName.green": "Verde",
	"colorName.teal": "Verde acqua",
	"colorName.cyan": "Ciano",
	"colorName.sky": "Azzurro",
	"colorName.blue": "Blu",
	"colorName.indigo": "Indaco",
	"colorName.violet": "Violetto",
	"colorName.purple": "Viola",
	"colorName.pink": "Rosa",
	"colorName.rose": "Rosé",
	"colorName.brown": "Marrone",
	"colorName.gray": "Grigio",
	"colorName.black": "Nero",
	"colorName.white": "Bianco",
	"colorName.crimson": "Cremisi",
	"colorName.coral": "Corallo",
	"colorName.grape": "Uva",
	"colorName.plum": "Prugna",
	"colorName.bubblegum": "Gomma da masticare",

	"iconPicker.pickIcon": "Scegli un'icona",
	"iconPicker.confirm": "Conferma",
	"iconPicker.cancel": "Annulla",
	"iconPicker.lucide": "Lucide",
	"iconPicker.tabler": "Tabler Icons",
	"iconPicker.material": "Material",
	"iconPicker.emoji": "Emoji",
	"iconPicker.searchLucide": "cerca icone Lucide",
	"iconPicker.searchTabler": "cerca icone Tabler",
	"iconPicker.tablerStyle": "Stile icona",
	"iconPicker.tablerStyleOutline": "Contorno (Outline)",
	"iconPicker.tablerStyleFilled": "Pieno (Filled)",
	"iconPicker.loadMore": "Carica altro",
	"iconPicker.materialStyle": "Stile icona",
	"iconPicker.materialStyleOutlined": "Contorno (Outlined)",
	"iconPicker.materialStyleFilled": "Pieno (Filled)",
	"iconPicker.materialStyleRounded": "Arrotondato (Rounded)",
	"iconPicker.materialStyleSharp": "Affilato (Sharp)",
	"iconPicker.materialWeight": "Spessore icona",
	"iconPicker.materialWeight100": "Sottile (Thin)",
	"iconPicker.materialWeight200": "Extra leggero (Extra Light)",
	"iconPicker.materialWeight300": "Leggero (Light)",
	"iconPicker.materialWeight400": "Normale (Regular)",
	"iconPicker.materialWeight500": "Medio (Medium)",
	"iconPicker.materialWeight600": "Semi-grassetto (Semi Bold)",
	"iconPicker.materialWeight700": "Grassetto (Bold)",
	"iconPicker.materialFontFailed":
		"Impossibile caricare l'anteprima delle icone Material. Al loro posto vengono mostrati i nomi delle icone — la ricerca e la selezione continuano a funzionare.",
	"iconPicker.materialFontRetry": "Riprova",
	"iconPicker.searchMaterial": "cerca icone Material",
	"iconPicker.searchEmoji": "Cerca emoji",
	"iconPicker.skinTone": "Tono della pelle",
	"iconPicker.allCategories": "Tutte le categorie",
	"iconPicker.noIconSelected": "Nessuna icona selezionata",
	"iconPicker.noResults": "Nessuna icona corrisponde alla ricerca.",
	"iconPicker.octicons": "Octicons",
	"iconPicker.searchOcticons": "Cerca in Octicons",
	"iconPicker.fa": "Font Awesome",
	"iconPicker.searchFa": "Cerca in Font Awesome",
	"iconPicker.faStyle": "Stile icona",
	"iconPicker.faStyleSolid": "Pieno (Solid)",
	"iconPicker.faStyleRegular": "Normale (Regular)",
	"iconPicker.faStyleBrands": "Marchi (Brands)",
	"iconPicker.rpgAwesome": "RPG Awesome",
	"iconPicker.searchRpgAwesome": "Cerca in RPG Awesome",
	"iconPicker.image": "Le tue immagini",
	"iconPicker.searchImage": "Cerca nelle tue immagini",
	"iconPicker.imageTooLarge":
		"{{name}} è troppo grande. Le immagini devono essere inferiori a 5 MB.",
	"iconPicker.imageUnsupported":
		"{{name}} non è un formato immagine supportato. Usa SVG, PNG, JPEG o WebP.",
	"iconPicker.imageInvalidSvg":
		"{{name}} non può essere letto come SVG sicuro e non è stato aggiunto.",
	"iconPicker.imageDecodeFailed":
		"{{name}} non può essere letto come immagine.",
	"iconPicker.imageDuplicate":
		"{{name}} è già nelle tue immagini. Rinomina il file o elimina l'immagine esistente.",
	"iconPicker.imageAdd": "Aggiungi immagini",
	"iconPicker.imageEmpty":
		"Nessuna immagine ancora. Aggiungi un file SVG, PNG, JPEG o WebP dal tuo computer o trascinalo qui.",
	"iconPicker.imageDelete": "Elimina",
	"iconPicker.imageDeleteConfirm": "Eliminare “{{name}}”?",
	"iconPicker.imageDeleteInUse":
		"{{count}} callout usano questa immagine. Mostreranno un'icona segnaposto finché non ne fornisci una nuova.",
	"iconPicker.imageRecolor": "Segui il colore del Callout",
	"iconPicker.allSources": "Tutte le fonti",
	"iconPicker.searchAllSources": "Cerca in tutte le fonti di icone",
	"iconPicker.sourcesNotDownloaded":
		"Non ancora incluso: {{names}}. Scegli una fonte sopra per scaricarlo.",
	"iconPicker.chooseSource": "Scegli fonte",
	"iconPicker.sourceGroup": "{{name}} · {{count}}",

	// Source menu — what each library holds, in a few words
	"iconPicker.descAllSources":
		"cerca in tutte le librerie contemporaneamente",
	"iconPicker.descLucide": "il set di Obsidian, sempre offline",
	"iconPicker.descTabler": "icone UI pulite e coerenti, contorno e pieno",
	"iconPicker.descMaterial":
		"il set di Google, quattro stili e sette spessori",
	"iconPicker.descEmoji": "glifi colorati, ogni tono di pelle",
	"iconPicker.descOcticons": "icone di interfaccia di GitHub",
	"iconPicker.descFa": "pieno, normale e marchi",
	"iconPicker.descRpgAwesome": "icone fantasy e giochi da tavolo",
	"iconPicker.descImage": "immagini che aggiungi dal tuo computer",

	// Icon picker — category filter dropdown labels
	"iconPicker.cat.Accessibility": "Accessibilità",
	"iconPicker.cat.Actions": "Azioni",
	"iconPicker.cat.Activities": "Attività",
	"iconPicker.cat.Alert": "Avviso",
	"iconPicker.cat.Alphabet": "Alfabeto",
	"iconPicker.cat.Android": "Android",
	"iconPicker.cat.Animals": "Animali",
	"iconPicker.cat.Arrows": "Frecce",
	"iconPicker.cat.Astronomy": "Astronomia",
	"iconPicker.cat.Audio&Video": "Audio e video",
	"iconPicker.cat.Automotive": "Automotive",
	"iconPicker.cat.Badges": "Distintivi",
	"iconPicker.cat.Brand": "Marchi",
	"iconPicker.cat.Buildings": "Edifici",
	"iconPicker.cat.Business": "Affari",
	"iconPicker.cat.Camping": "Campeggio",
	"iconPicker.cat.Charity": "Beneficenza",
	"iconPicker.cat.Charts": "Grafici",
	"iconPicker.cat.Charts + Diagrams": "Grafici e diagrammi",
	"iconPicker.cat.Childhood": "Infanzia",
	"iconPicker.cat.Clothing + Fashion": "Abbigliamento e moda",
	"iconPicker.cat.Coding": "Programmazione",
	"iconPicker.cat.Communicate": "Comunicare",
	"iconPicker.cat.Communication": "Comunicazione",
	"iconPicker.cat.Computers": "Computer",
	"iconPicker.cat.Connectivity": "Connettività",
	"iconPicker.cat.Construction": "Costruzione",
	"iconPicker.cat.Currencies": "Valute",
	"iconPicker.cat.Database": "Database",
	"iconPicker.cat.Design": "Design",
	"iconPicker.cat.Development": "Sviluppo",
	"iconPicker.cat.Devices": "Dispositivi",
	"iconPicker.cat.Devices + Hardware": "Dispositivi e hardware",
	"iconPicker.cat.Disaster + Crisis": "Disastri e crisi",
	"iconPicker.cat.Document": "Documento",
	"iconPicker.cat.E-commerce": "E-commerce",
	"iconPicker.cat.Editing": "Modifica",
	"iconPicker.cat.Education": "Istruzione",
	"iconPicker.cat.Electrical": "Elettrico",
	"iconPicker.cat.Emoji": "Emoji",
	"iconPicker.cat.Energy": "Energia",
	"iconPicker.cat.Extensions": "Estensioni",
	"iconPicker.cat.Files": "File",
	"iconPicker.cat.Film + Video": "Film e video",
	"iconPicker.cat.Food": "Cibo",
	"iconPicker.cat.Food + Beverage": "Cibo e bevande",
	"iconPicker.cat.Fruits + Vegetables": "Frutta e verdura",
	"iconPicker.cat.Games": "Giochi",
	"iconPicker.cat.Gaming": "Gaming",
	"iconPicker.cat.Gender": "Genere",
	"iconPicker.cat.Genders": "Generi",
	"iconPicker.cat.Gestures": "Gesti",
	"iconPicker.cat.Halloween": "Halloween",
	"iconPicker.cat.Hands": "Mani",
	"iconPicker.cat.Hardware": "Hardware",
	"iconPicker.cat.Health": "Salute",
	"iconPicker.cat.Holidays": "Festività",
	"iconPicker.cat.Home": "Casa",
	"iconPicker.cat.Household": "Domestico",
	"iconPicker.cat.Humanitarian": "Umanitario",
	"iconPicker.cat.Images": "Immagini",
	"iconPicker.cat.Laundry": "Lavanderia",
	"iconPicker.cat.Letters": "Lettere",
	"iconPicker.cat.Logic": "Logica",
	"iconPicker.cat.Logistics": "Logistica",
	"iconPicker.cat.Map": "Mappa",
	"iconPicker.cat.Maps": "Mappe",
	"iconPicker.cat.Maritime": "Marittimo",
	"iconPicker.cat.Marketing": "Marketing",
	"iconPicker.cat.Math": "Matematica",
	"iconPicker.cat.Mathematics": "Matematica",
	"iconPicker.cat.Media": "Media",
	"iconPicker.cat.Media Playback": "Riproduzione multimediale",
	"iconPicker.cat.Medical + Health": "Medicina e salute",
	"iconPicker.cat.Money": "Denaro",
	"iconPicker.cat.Mood": "Umore",
	"iconPicker.cat.Moving": "Trasloco",
	"iconPicker.cat.Music + Audio": "Musica e audio",
	"iconPicker.cat.Nature": "Natura",
	"iconPicker.cat.Numbers": "Numeri",
	"iconPicker.cat.Photography": "Fotografia",
	"iconPicker.cat.Photos + Images": "Foto e immagini",
	"iconPicker.cat.Political": "Politico",
	"iconPicker.cat.Privacy": "Privacy",
	"iconPicker.cat.Punctuation + Symbols": "Punteggiatura e simboli",
	"iconPicker.cat.Religion": "Religione",
	"iconPicker.cat.Science": "Scienza",
	"iconPicker.cat.Science Fiction": "Fantascienza",
	"iconPicker.cat.Security": "Sicurezza",
	"iconPicker.cat.Shapes": "Forme",
	"iconPicker.cat.Shopping": "Shopping",
	"iconPicker.cat.Social": "Social media",
	"iconPicker.cat.Spinners": "Spinner",
	"iconPicker.cat.Sport": "Sport",
	"iconPicker.cat.Sports + Fitness": "Sport e fitness",
	"iconPicker.cat.Symbols": "Simboli",
	"iconPicker.cat.System": "Sistema",
	"iconPicker.cat.Text": "Testo",
	"iconPicker.cat.Text Formatting": "Formattazione del testo",
	"iconPicker.cat.Time": "Tempo",
	"iconPicker.cat.Toggle": "Interruttore",
	"iconPicker.cat.Transit": "Transito",
	"iconPicker.cat.Transportation": "Trasporti",
	"iconPicker.cat.Travel": "Viaggi",
	"iconPicker.cat.Travel + Hotel": "Viaggi e hotel",
	"iconPicker.cat.UI actions": "Azioni dell'interfaccia",
	"iconPicker.cat.Users + People": "Utenti e persone",
	"iconPicker.cat.Vehicles": "Veicoli",
	"iconPicker.cat.Version control": "Controllo versione",
	"iconPicker.cat.Weather": "Meteo",
	"iconPicker.cat.Writing": "Scrittura",
	"iconPicker.cat.Zodiac": "Zodiaco",

	// Downloadable icon packs
	"iconPack.downloadTitle": "{{name}} non è ancora stato scaricato",
	"iconPack.downloadDetail": "{{count}} icone · {{size}} · download unico",
	"iconPack.download": "Scarica",
	"iconPack.downloading": "Download di {{name}}…",
	"iconPack.downloadFailed":
		"Impossibile scaricare {{name}}. Controlla la connessione e riprova.",
	"iconPack.retry": "Riprova",
	"iconPack.faBrandsNotice":
		"Le icone dei marchi sono marchi registrati dei rispettivi proprietari. La loro inclusione non indica un'approvazione. Usale solo per rappresentare l'azienda, il prodotto o il servizio a cui si riferiscono.",
	"iconPack.artworkRestored":
		"L'artwork delle icone per {{names}} è stato scaricato.",
	"iconPack.diskWriteFailed":
		"Callout Studio non è riuscito a salvare il pacchetto di icone su disco, quindi dovrà essere scaricato di nuovo la prossima volta. Le icone che scegli sono comunque salvate nelle tue impostazioni.",

	// Icon licences & credits
	"credits.title": "Licenze icone e crediti",
	"credits.intro":
		"Callout Studio si basa su diverse librerie di icone aperte. Le loro licenze sono riprodotte di seguito, insieme a ciò che è stato modificato per usarle qui.",
	"credits.fullNotices": "Avvisi terze parti completi",
	"credits.pluginLicense":
		"Il codice proprio di Callout Studio è rilasciato con una licenza permissive; le librerie di icone mantengono le proprie licenze.",

	"contextMenu.editCallout": "Modifica impostazioni callout",
	"contextMenu.copyMarkdown": "Copia Markdown callout",
	"contextMenu.openSettings": "Apri impostazioni Callout Studio",
	"contextMenu.setFoldClosed": "Imposta il callout come chiuso (-)",
	"contextMenu.setFoldOpen": "Imposta il callout come aperto (+)",
	"contextMenu.setFoldNone": "Rendi il callout non pieghevole",
	"contextMenu.cutSection": "Taglia sezione di intestazione",
	"contextMenu.copySection": "Copia sezione di intestazione",
	"contextMenu.deleteSection": "Elimina sezione di intestazione",

	"heading.toggleFold": "Attiva/disattiva la piegatura",

	"settings.globalSettings": "Opzioni di stile di Callout Studio",
	"settings.globalSettingsScope":
		"Forma, spaziatura e dimensione per i callout a cui Callout Studio applica uno stile. I callout stilizzati dal tuo tema mantengono il design proprio del tema.",
	"settings.globalSettingsRegularDesc":
		"Aggiungi un token callout a una citazione (ad es. `> [!type]`) per visualizzare il riquadro callout nativo di Obsidian. Puoi regolarne bordo, raggio, scala font e allineamento.",
	"settings.globalSettingsHeadingDesc":
		"Aggiungi un token callout subito dopo i cancelletti dell'intestazione (ad es. `## [!type]`) per visualizzarlo come un'intestazione callout stilizzata. Puoi regolarne bordo, forma e spaziatura verticale.",
	"settings.globalSettingsInlineDesc":
		"Aggiungi un token callout in un punto qualsiasi di una riga di testo (ad es. `[!type]`) per visualizzarlo come una piccola pillola in linea. Puoi regolarne bordo e forma.",
	"settings.globalSettingsCustomize": "Personalizza",

	"settings.calloutTypeRegular": "Block callout",
	"settings.calloutTypeHeading": "Callout di intestazione",
	"settings.calloutTypeInline": "Callout in linea",

	"settings.customizeMenu": "Personalizza voci di menu",
	"settings.customizeMenuDesc":
		"Scegli quali azioni del clic destro appaiono per ciascun tipo di callout e riordinale. Funziona in modalità sorgente e anteprima live.",
	"settings.customizeMenuButton": "Personalizza voci di menu",
	"menuCustomize.title": "Personalizza il menu del clic destro",
	"menuCustomize.desc":
		"Attiva o disattiva le azioni e trascina la maniglia per riordinarle. Le modifiche vengono salvate automaticamente.",
	"menuCustomize.regular": "Block callout",
	"menuCustomize.heading": "Callout di intestazione",
	"menuCustomize.inline": "Callout in linea",
	"menuCustomize.dragHandle": "Trascina per riordinare",
	"menuItem.edit": "Modifica callout",
	"menuItem.openSettings": "Apri impostazioni",
	"menuItem.copyMarkdown": "Copia Markdown",
	"menuItem.foldDefaults":
		"Piegatura predefinita (aperta / chiusa / nessuna)",
	"menuItem.cutSection": "Taglia sezione",
	"menuItem.copySection": "Copia sezione",
	"menuItem.deleteSection": "Elimina sezione",

	"confirm.ok": "Elimina",
	"confirm.cancel": "Annulla",
	// Headings for each confirmation — every window carries one, so each
	// caller of ConfirmModal names what it is about to do.
	"confirm.titleDeleteCommand": "Elimina comando",
	"confirm.titleResetAll": "Ripristina tutti i callout",
	"confirm.titleResetCallout": "Ripristina callout",
	"confirm.titleDeletePalette": "Elimina tavolozza",
	"confirm.titleDeleteImage": "Elimina immagine",

	"vault.filesUpdated":
		"{{count}} riferimento/i callout aggiornato/i nei file del vault.",
	"vault.idsUpdated":
		"{{count}} ID callout aggiornato/i nei file del vault: {{oldIds}} → {{newId}}",
	"vault.titlesUpdated":
		"{{count}} titolo/i callout aggiornato/i nei file del vault: {{oldTitle}} → {{newTitle}}",
	"vault.replaceWith": "Sostituisci con:",
	"vault.deleteWithout": "Elimina senza sostituire",
	"vault.confirmDelete": "Conferma",
	"vault.confirmReplace": "Sostituisci",
	"vault.replacePromptInUse":
		'"{{name}}" è usato {{count}} volta/e in {{files}} file. Scegli un callout con cui sostituirlo:',
	"vault.replacePromptUnused":
		'Scegli un callout con cui sostituire "{{name}}":',
	"vault.noReplacementAvailable":
		"Nessun altro callout disponibile per sostituire questo.",
	"vault.convertedToPlainText":
		"{{blocks}} blocco/i callout in {{files}} file convertito/i in testo normale.",
	"vault.resetAliasWarning":
		"{{count}} riferimento/i in {{files}} file usano alias personalizzati: {{aliases}}. Dopo il ripristino non funzioneranno più. Continuare?",
	"vault.resetConfirm": "Ripristina",
	"vault.resetAllInUse":
		"⚠ {{count}} riferimento/i callout in {{files}} file usano tipi di callout personalizzati che verranno eliminati.",

	"quickInsert.title": "Inserimento rapido di callout a blocco",
	"quickInsert.desc": "Scegli un callout da inserire nella posizione del cursore. Solo callout a blocco.",
	"quickInsert.searchPlaceholder": "Cerca callout",
	"quickInsert.sourceAria": "Filtra per origine del callout",
	"quickInsert.sourceAll": "Tutti",
	"quickInsert.sourceBuiltIn": "Integrato",
	"quickInsert.sourceUser": "I miei callout",
	"quickInsert.editAria": "Modifica {{name}}",
	"quickInsert.insertAria": "Inserisci {{name}} come callout a blocco",
	"quickInsert.noResults": "Nessun callout trovato",
	"quickInsert.noUserCallouts": "Non hai ancora creato alcun callout.",
	"quickInsert.noEditorHint": "Nessuna nota è aperta in modalità modifica, quindi non è possibile inserire nulla.",
	"quickInsert.noEditor": "Apri una nota in modalità modifica per inserire un callout.",

	"vaultStats.title": "Statistiche callout",
	"vaultStats.totalCallouts": "Callout totali",
	"vaultStats.typesFound": "Tipi trovati",
	"vaultStats.filesWithCallouts": "File con callout",
	"vaultStats.filesScanned": "File Markdown scansionati",
	"vaultStats.empty": "Nessun callout trovato nelle note Markdown.",
	"vaultStats.columnType": "Tipo",
	"vaultStats.columnName": "Nome",
	"vaultStats.columnSource": "Fonte",
	"vaultStats.columnCount": "Conteggio",
	"vaultStats.columnFiles": "File",
	"vaultStats.unknown": "Sconosciuto",
	"vaultStats.sourceBuiltIn": "Integrato",
	"vaultStats.sourceCustom": "Personalizzato",
	"vaultStats.sourceAutoFallback": "Fallback automatico",
	"vaultStats.sourceTheme": "Snippet CSS",
	"vaultStats.sourceAlias": "Alias di {{id}}",
	"vaultStats.sourceUnknown": "Sconosciuto",
	"vaultStats.byRole": "Scritto come",
	"vaultStats.roleBlock": "Blocco",
	"vaultStats.roleHeading": "Titolo",
	"vaultStats.roleInline": "In linea",
	"vaultStats.defineUndefined": "Definisci {{count}} mancanti",
	"vaultStats.defineRunning": "Scansione in corso",
	"vaultStats.defineDone": "Aggiunti {{count}} tipi di callout.",
	"vaultStats.close": "Chiudi",

	"import.title": "Problemi di importazione",
	"import.reportLeadIn":
		"Sembra che il file importato sia stato modificato. Ecco l'elenco dei problemi:",
	"import.reportLeadInFatal":
		"Questo file non sembra un'esportazione di Callout Studio. Non può essere importato:",
	"import.entryHeading": "Voce {{index}} — {{label}}",
	"import.summary":
		"{{valid}} su {{total}} voci sono valide · {{issues}} problema/i trovato/i.",
	"import.btnCancel": "Annulla",
	"import.btnImportValid": "Importa solo le valide ({{count}})",
	"import.err.notRecognized":
		"File non riconosciuto: atteso un array di definizioni callout o un'esportazione di Callout Studio.",
	"import.warn.settingsIgnored":
		"Il blocco delle impostazioni non era un oggetto valido ed è stato ignorato.",
	"import.warn.invalidGradient":
		"Il gradiente dello sfondo non era valido ed è stato ignorato.",
	"import.err.parseFailed":
		"Il file non è JSON valido e non può essere analizzato.",
	"import.err.entryNotObject": "La voce deve essere un oggetto.",
	"import.err.requiredMissing":
		'Il campo obbligatorio "{{field}}" è mancante o ha il tipo sbagliato.',
	"import.err.idEmpty": "L'ID non deve essere vuoto.",
	"import.err.idTooLong":
		'L\'ID "{{value}}" è di {{length}} caratteri; il massimo è {{max}}.',
	"import.err.idBadChar":
		'L\'ID "{{value}}" contiene caratteri non validi ("|", "[", "]", tabulazioni e a capo non sono consentiti).',
	"import.err.idMetadata":
		'L\'ID "{{value}}" contiene un "|". In Obsidian tutto ciò che segue il primo "|" è metadata del callout, non parte del tipo; quindi questa voce descrive il callout "{{id}}". Saltata, in modo che il tuo "{{id}}" esistente resti invariato.',
	"import.err.displayNameEmpty":
		"Il nome visualizzato non deve essere vuoto.",
	"import.err.displayNameTooLong":
		"Il nome visualizzato è di {{length}} caratteri; il massimo è {{max}}.",
	"import.err.boolField":
		'"{{field}}" deve essere un booleano (true o false).',
	"import.err.iconNotObject": "L'icona deve essere un oggetto.",
	"import.err.iconTypeInvalid":
		'Il tipo di icona "{{value}}" non è uno tra: {{types}}.',
	"import.warn.iconFieldIgnored":
		'"{{field}}" si applica solo alle icone Material ed è ignorato per il tipo di icona {{type}}.',
	"import.err.iconValueEmpty":
		"Il valore dell'icona deve essere una stringa non vuota.",
	"import.err.iconValueTooLong":
		"Il valore dell'icona è insolitamente lungo ({{length}} caratteri).",
	"import.err.materialStyle":
		'Lo stile icona Material "{{value}}" non è uno tra: outlined, filled, rounded, sharp.',
	"import.err.materialWeight":
		'Il peso icona Material "{{value}}" deve essere un intero tra 100 e 700, a passi di 100.',
	"import.warn.iconRecolorIgnored":
		'"recolor" si applica solo alle proprie immagini ed è ignorato per il tipo di icona {{type}}.',
	"import.err.iconRecolorInvalid":
		'"recolor" deve essere true o false (ricevuto: "{{value}}").',
	"import.err.colorInvalid":
		'"{{field}}" deve essere un colore esadecimale come "#448aff" (ricevuto "{{value}}").',
	"import.err.numberRange":
		'"{{field}}" deve essere un numero tra {{min}} e {{max}} (ricevuto "{{value}}").',
	"import.err.iconSizeRange":
		'"{{field}}" deve essere un numero tra {{min}} e {{max}} (ricevuto "{{value}}").',
	"import.err.iconAdjustShape":
		'"iconAdjust" must be an object mapping a callout type ("regular", "heading", "inline") to its icon size and offsets.',
	"import.err.aliasesNotArray": '"aliases" deve essere un array di stringhe.',
	"import.err.aliasNotString": "L'alias deve essere una stringa.",
	"import.err.aliasDup": 'L\'alias "{{value}}" è duplicato in questa voce.',
	"import.err.tooManyIds":
		"Troppi ID ({{count}}); ogni callout può avere al massimo {{max}} ID (principale + alias).",
	"import.err.metadataShape":
		'"metadata" deve essere un oggetto i cui valori sono tutti stringhe.',
	"import.warn.unknownFields": "Campi sconosciuti ignorati: {{fields}}.",
	"import.err.duplicateInFile":
		'L\'ID/alias "{{value}}" è già in uso dalla voce #{{first}} in questo file.',
	"import.err.aliasConflict":
		'L\'alias "{{value}}" è già in uso da un altro callout ("{{other}}") nel vault.',
	"import.warn.defaultFoldedAutofix":
		'"defaultFolded" era true mentre "foldable" era false; defaultFolded è stato reimpostato a false.',
	"import.warn.imageMissing":
		"Questo Callout usa un'immagine che non è nel file e non è in questo vault, quindi mostrerà un'icona segnaposto finché non ne fornisci una nuova.",

	"import.err.paletteIdInvalid":
		'"paletteId" deve essere un ID testo non vuoto (ricevuto "{{value}}").',
	"import.warn.iconNameUnknown":
		"Non c'è nessuna icona \"{{value}}\" in {{type}}, quindi è stata usata l'icona predefinita.",
	"import.warn.cmIconUnknownNew":
		"L'icona \"{{value}}\" non è disponibile in questo vault, quindi è stata usata l'icona predefinita.",
	"import.warn.cmIconUnknownExisting":
		'L\'icona "{{value}}" non è disponibile in questo vault, quindi "{{id}}" ha mantenuto l\'icona che aveva già.',
	"import.chooseSource": "Importa da",
	"import.sourceStudio": "Callout Studio",
	"import.sourceStudioDesc":
		"Carica un file .json esportato da Callout Studio.",
	"import.sourceCalloutManager": "Callout Manager",
	"import.sourceCalloutManagerDesc":
		"Porta qui i tuoi callout personalizzati dal plugin Callout Manager.",
	"import.sourceAdmonition": "Admonition",
	"import.sourceAdmonitionDesc":
		"Porta qui le tue admonition personalizzate dal plugin " +
		"Admonition.",
	"import.cmTitle": "Importa da Callout Manager",
	"import.cmInstructions":
		"Ogni callout personalizzato viene portato con la sua icona e il suo colore. Lo stile per tema e i CSS personalizzati non hanno un equivalente qui e vengono lasciati indietro.",
	"import.cmFromVault": "Questo vault",
	"import.cmVaultChecking": "Ricerca del plugin Callout Manager…",
	"import.cmVaultFound": "{{count}} callout personalizzati trovati.",
	"import.cmVaultNotFound":
		"Nessun callout personalizzato è stato trovato in questo vault.",
	"import.cmPasteLabel":
		"Oppure incolla qui gli stili copiati da Callout Manager:",
	"import.cmPlaceholder":
		"Incolla qui gli stili copiati, o un file data.json…",
	"import.cmBtnCancel": "Annulla",
	"import.cmBtnImport": "Importa",
	"import.err.cmNoBlocksFound":
		"Non sono stati trovati stili di Callout Manager nel testo incollato.",
	"import.err.cmNotRecognized":
		"File non riconosciuto: erano attesi gli stili prodotti dal pulsante Copy di Callout Manager, oppure un file data.json di Callout Manager.",
	"import.err.cmNoEntries":
		"Non è stato trovato nessun callout personalizzato da importare.",
	"import.err.cmNoColorForNew":
		'Nessun colore utilizzabile è stato trovato per il nuovo callout "{{value}}"; è stato ignorato.',
	"import.warn.cmNoColorDefault":
		"In Callout Manager non era impostato nessun colore, quindi è stato usato il grigio predefinito.",
	"import.warn.cmThemeCondition":
		"Il colore o l'icona di questo callout erano impostati per un solo tema. Callout Studio non ha stili per tema, quindi sono stati portati per ogni tema.",
	"import.warn.cmCustomStyles":
		"Questo callout ha anche CSS personalizzati in Callout Manager. Quello stile non fa parte dell'importazione, quindi sono stati portati solo l'icona e il colore.",
	"import.err.cmIdConflict":
		'L\'ID "{{value}}" è già utilizzato come alias da un altro callout ("{{other}}") ed è stato ignorato.',

	// Import — Admonition
	"import.admTitle": "Importa da Admonition",
	"import.admInstructions":
		"Ogni admonition diventa un callout con il suo nome, la sua icona " +
		"e il suo colore. Le impostazioni senza un equivalente in Callout " +
		"Studio (comando, pulsante copia, titolo nascosto) restano " +
		"indietro.",
	"import.admFromVault": "Questo vault",
	"import.admVaultChecking": "Ricerca del plugin Admonition…",
	"import.admVaultFound": "Trovate {{count}} admonition personalizzate.",
	"import.admVaultNotFound":
		"Nessuna admonition personalizzata trovata in questo vault.",
	"import.admFromFile": "Un file",
	"import.admFromFileDesc":
		"Un file admonitions.json, o un pacchetto condiviso.",
	"import.admChooseFile": "Scegli file…",
	"import.admPasteLabel": "Oppure incolla qui il JSON:",
	"import.admPlaceholder": "Incolla qui le tue admonition…",
	"import.admBtnCancel": "Annulla",
	"import.admBtnImport": "Importa",
	"import.err.admNotRecognized":
		"File non riconosciuto: era attesa una lista di admonition o un " +
		"data.json di Admonition.",
	"import.err.admNoEntries": "Nessuna admonition da importare.",
	"import.err.admTypeMissing":
		'Questa admonition non ha "type" ed è stata saltata.',
	"import.warn.admIconUnknown":
		'Nessuna icona di nome "{{value}}" è stata trovata in alcuna ' +
		"libreria, quindi è stata usata l'icona predefinita.",
	"import.warn.admIconUnknownExisting":
		'Nessuna icona di nome "{{value}}" è stata trovata in alcuna ' +
		'libreria, quindi "{{id}}" ha mantenuto l\'icona che aveva già.',
	"import.warn.admImageFailed":
		"Non è stato possibile leggere l'immagine caricata, quindi è " +
		"stata usata l'icona predefinita.",
	"import.warn.admIconWithCss":
		"Questa admonition è stilizzata da uno snippet CSS in Admonition. " +
		"Quello stile non fa parte dell'importazione, quindi sono " +
		"arrivati solo nome, icona e colore.",
	"import.warn.admNoColor":
		"Nessun colore impostato, quindi è stato usato il blu " +
		"predefinito.",
	"import.warn.admTitleTruncated":
		"Il titolo è di {{length}} caratteri; è stato accorciato a " +
		"{{max}}.",

	"footer.tagline":
		"Hai feedback, commenti o suggerimenti? Mi farebbe piacere sentirti!",
	"footer.madeBy": "Creato da Niv  •  ",
	"settings.deletePaletteConfirmLinkedOne":
		'Eliminare la palette "{{name}}"?\n1 callout la usa. Mantiene i suoi colori e potrai ricollegarla più tardi dalla riga Colore nel suo editor.',
	"settings.deletePaletteConfirmLinked":
		'Eliminare la palette "{{name}}"?\n{{count}} callout la usano. Mantengono i loro colori e potrai ricollegarli più tardi dalla riga Colore in uno qualsiasi dei loro editor.',
	"settings.unlinkedColors": "Colori scollegati",
	"settings.unlinkedColorsDesc":
		"Callout il cui colore salvato è stato eliminato. Mantengono i colori che avevano; ripristinare salva di nuovo il colore e ricollega l'intero gruppo.",
	"settings.unlinkedColorOne": "1 callout",
	"settings.unlinkedColorCount": "{{count}} callout",
	"settings.restoreColor": "Ripristina",
	"settings.palettesMergedNotice":
		"Unite {{count}} palette importate nei colori salvati che avevano già gli stessi colori.",
	"notice.palettesMerged":
		"Uniti {{count}} colori salvati con colori identici: {{names}}. I callout che li usano mantengono i loro colori e ora sono collegati al colore rimasto.",
	"editor.colorsDescDeleted":
		"Il colore salvato di questo callout è stato eliminato. Puoi salvarlo di nuovo {{link}}.",
	"editor.colorsDescDeletedOther":
		"Il colore salvato di questo callout è stato eliminato. Puoi salvarlo di nuovo {{link}} — verrà ricollegato anche 1 altro callout che lo usa.",
	"editor.colorsDescDeletedOthers":
		"Il colore salvato di questo callout è stato eliminato. Puoi salvarlo di nuovo {{link}} — verranno ricollegati anche altri {{count}} callout che lo usano.",
	"editor.colorsDescDeletedLink": "facendo clic qui",
	"palette.colorExists":
		'Questi colori sono identici a "{{name}}". Due colori salvati non possono essere uguali: cambia un colore per distinguerli.',
	"palette.colorExistsUse":
		'Questi colori sono identici a "{{name}}". Due colori salvati non possono essere uguali: cambia un colore, oppure {{link}}.',
	"palette.colorExistsUseLink": "usa quello esistente",
	"locale.downloading": "Download della traduzione…",
	"locale.notDownloaded": "{{name}} non è ancora stata scaricata",
	"locale.notDownloadedDesc":
		"Callout Studio mostra l’inglese finché non sarà possibile scaricare la traduzione. Riproverà al prossimo avvio di Obsidian.",
	"locale.retry": "Riprova",
	"locale.diskWriteFailed":
		"Callout Studio non ha potuto salvare la traduzione sul disco, quindi dovrà essere scaricata di nuovo la prossima volta.",
	"notice.exportedCssCreated": "Snippet CSS salvato in {{path}}",
	"notice.exportedCssUpdated": "Snippet CSS aggiornato in {{path}}",
	"notice.exportedCssUnchanged": "Lo snippet CSS è già aggiornato.",
	"notice.exportCssEmpty": "Non ci sono callout personalizzati da esportare.",
	"notice.exportCssFailed":
		"Impossibile salvare lo snippet CSS. Controlla la console per sviluppatori per i dettagli.",
	"notice.exportCssEnabled":
		"Questo snippet è attivo in questo vault. Callout Studio applica già lo stile a questi callout e lo snippet conserva lo stile del momento dell’esportazione.",
	"confirm.titleOverwriteSnippet": "Sovrascrivi snippet CSS",
	"confirm.overwriteSnippet":
		"Lo snippet CSS nella cartella snippets è cambiato da quando Callout Studio lo ha scritto. Una nuova esportazione sostituirà l’intero file.",
	"confirm.overwriteSnippetOk": "Sovrascrivi",
	"export.chooseFormat": "Esporta come",
	"export.formatJson": "Backup di Callout Studio",
	"export.formatJsonDesc":
		"Un file .json con callout e impostazioni da importare in un altro vault.",
	"export.formatCss": "Snippet CSS",
	"export.formatCssDesc":
		"Un file .css salvato nella cartella snippets di questo vault, da usare dove Callout Studio non è installato. Copre solo i callout normali ed è un’istantanea; esportalo di nuovo dopo una modifica.",
	"quickInsert.readingViewHint": "Questa nota è aperta in modalità lettura, quindi non è possibile inserire nulla.",
	"quickInsert.readingView": "Passa alla modalità sorgente o all'anteprima live per inserire un callout.",
	"quickInsert.noCursorHint": "Non c'è alcun cursore in questa nota, quindi non c'è dove inserire.",
	"quickInsert.noCursor": "Posiziona il cursore nella nota nel punto in cui vuoi inserire il callout, quindi riprova.",
};
