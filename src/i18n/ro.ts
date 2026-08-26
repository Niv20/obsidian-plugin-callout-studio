export const ro: Record<string, string> = {
	"cmd.openSettings": "Deschide setări",
	"cmd.createCallout": "Creează tip callout nou",
	"cmd.insertEmptyCallout": "Inserează callout gol",
	"cmd.calloutWrap": "Înfășoară în callout",
	"cmd.calloutUnwrap": "Elimină callout",

	"cmd.customWrapBlock": "Înfășoară în callout bloc {{name}}",
	"cmd.customInsertBlock": "Inserează callout bloc {{name}}",
	"cmd.customInsertHeading": "Inserează titlu H{{level}} callout {{name}}",
	"cmd.customInsertInline": "Inserează callout inline {{name}}",
	"cmd.openQuickInsert": "Inserare rapidă de callout bloc",

	"autocomplete.createNew": 'Creează callout nou: "{{name}}"',

	"settings.fallbackTag": "Implicit",
	"settings.fallbackTagAuto": "Implicit automat",
	"settings.rescanVault": "Rescaneaza vault",
	"settings.rescanVaultDesc":
		"Caută ID-uri de callout nerecunoscute în note și le adaugă ca rânduri de rezervă.",
	"settings.rescanVaultHintAction": "Scanează acum",
	"settings.rescanComplete":
		"Rescanare completă: {{count}} callout(uri) noi adăugate.",
	"replaceModal.deleteWithoutReplaceSuffix": "(revine la implicit)",
	"replaceModal.titleDelete": "Șterge callout",
	"replaceModal.titleReplace": "Înlocuiți în vault",

	"firstRun.title": "Găsiți callouts existente în vault?",
	"firstRun.body":
		"Callout Studio poate scana vault-ul pentru a descoperi callouts pe care le utilizați deja, astfel încât să apară în lista de setări și să adopte stilul de rezervă.",
	"firstRun.heavyVaultNote":
		"Vault-ul dvs. are {{count}} fișiere Markdown — scanarea poate dura câteva secunde.",
	"firstRun.laterHint":
		"Puteți rula oricând mai târziu din Setări → Informații și întreținere vault → Rescaneaza vault.",
	"firstRun.scanNow": "Scanează acum",
	"firstRun.noThanks": "Nu, mulțumesc",
	"firstRun.autoScanComplete":
		"Callout Studio a scanat vault-ul și a adăugat {{count}} callout(uri).",
	"firstRun.scanning": "Scanare",

	"welcome.tooltip": "Despre Callout Studio",
	"welcome.title": "Bine ați venit în Callout Studio",
	"welcome.tagline":
		"Soluția dvs. completă pentru gestionarea callouts din Obsidian.",
	"welcome.previewTitle": "Vedeți-l în acțiune",
	"welcome.sample":
		"Callout Studio vă permite să creați callouts cu o pictogramă, culori și un nume personalizate.\n\n" +
		"Puteți folosi același callout în **trei** moduri diferite:\n\n" +
		"## [!tip] Ca titlu\n" +
		"Pentru a transforma orice titlu într-un titlu în stil callout, adăugați `[!type]` imediat după `#`-uri.\n\n" +
		"Doriți un callout inline ca acesta [!warning]? Adăugați pur și simplu `[!type]` în mijlocul unei propoziții, fără a vă întrerupe scrisul.\n\n" +
		"> [!note] Block Callout\n" +
		"> Desigur, callout-ul clasic funcționează cu exact aceeași sintaxă cu care sunteți deja obișnuiți: `> [!type]`.\n\n" +
		"Callout Studio are mult mai multe de oferit! [Aflați mai multe]({{repoUrl}}).\n",

	"deleteModal.title": 'Ștergeți callout "{{name}}"?',
	"deleteModal.bodyInUse":
		"Acest callout apare de {{count}} ori în {{files}} fișier(e).",
	"deleteModal.bodyInUseExplain":
		"Ștergerea va converti acele blocuri în text simplu — vor pierde stilul și antetul callout.",
	"deleteModal.replaceHint":
		"Îl puteți înlocui cu alt callout, păstrând conținutul vault-ului ca un callout stilizat.",
	"deleteModal.bodyUnused":
		'"{{name}}" nu este folosit în nicio notă, dar este un callout personalizat pe care l-ați creat. Ștergerea îl va elimina din această listă.',
	"deleteModal.replaceInstead": "Înlocuiți în schimb",
	"deleteModal.deleteInUse": "Șterge (convertește în text simplu)",
	"deleteModal.deleteUnused": "Șterge callout",
	// The variant for a callout whose definition Callout Studio cannot remove:
	// one of Obsidian's built-ins, or a type the active theme declares.
	"deleteModal.titleKeep": 'Ștergeți toate utilizările "{{name}}"?',
	"deleteModal.keepsRowBuiltIn":
		"Acesta este unul dintre callouts integrate ale Obsidian, așa că tipul în sine rămâne disponibil — se schimbă doar utilizările lui din notele dvs.",
	"deleteModal.keepsRowTheme":
		"{{theme}} definește acest tip de callout, așa că rămâne disponibil și își păstrează aspectul. Callout Studio modifică doar notele din vault-ul dvs. — nimic ce aparține temei dvs. nu este atins.",
	"deleteModal.clearUsages": "Șterge utilizările (convertește în text simplu)",

	"settings.title": "Callout Studio",
	"settings.myCalloutTypes": "Tipurile mele de callout",
	"settings.builtInCallouts": "Callouts integrate",
	"settings.contextMenu": "Meniu contextual",
	"settings.autocomplete": "Completare automată",
	"settings.keyboardShortcuts": "Scurtături de tastatură",
	"settings.language": "Limbă",
	"settings.languageDesc":
		"Limba de afișare pentru Callout Studio. În mod implicit urmează limba interfeței Obsidian.",
	"settings.languageAuto": "Automat (la fel ca Obsidian)",
	"settings.importExport": "Import / export",
	"settings.import": "Importați",
	"settings.export": "Exportați",
	"settings.importDesc":
		"Importați progresul Callout Studio dintr-un alt vault folosind un fișier JSON.",
	"settings.exportDesc":
		"Salvați toate tipurile de callout personalizate în format JSON.",
	"settings.importConflictNotice":
		"Au fost importate {{count}} tip(uri) de callout; {{overwritten}} înregistrare(i) existentă(e) au fost suprascrisă(e).",

	"settings.addNewCallout": "+ adaugă callout",

	"settings.noCalloutsNow": "Niciun callout personalizat deocamdată.",

	"settings.editAria": "Editați {{name}}",
	"settings.moreRowActionsAria": "Mai multe acțiuni pentru {{name}}",
	"settings.usageInfo": "{{count}} utilizare(i) în {{files}} fișier(e)",
	"settings.replaceAction": "Înlocuiți în vault",
	"settings.deleteAction": "Șterge",
	"settings.resetAction": "Resetează la implicit",
	"settings.makeFallbackAction": "Utilizați stilul de rezervă implicit",

	"settings.colorSwatchAria": "Accent: {{accent}} · Fundal: {{bg}}",
	// Handing a callout to the user's own CSS. Not a statement about the theme —
	// that is derived and has no action — so the wording names the snippet.
	"settings.externalCssAction": "Stilizează cu CSS-ul meu propriu",
	"settings.externalCssStopAction": "Lasă Callout Studio să stilizeze din nou acest lucru",
	// The one label on any row: a callout sitting among the user's own that
	// Callout Studio has nonetheless stopped painting.
	"settings.externalCssTag": "CSS extern",
	// Settings — callouts the active theme styles
	"settings.themeCalloutsHeading": "Callouts din tema dvs.",
	"settings.themeCalloutsDesc":
		"{{theme}} furnizează sau restilizează acestea, așa că Callout Studio le lasă exact așa cum le desenează tema dvs. și le oferă doar ca callouts bloc. Ambele tipuri apar aici: tipurile de callout adăugate de tema dvs. și callouts integrate al căror aspect îl înlocuiește. Tipurile de callout adăugate de temă sunt afișate doar cât timp este activă.",
	"settings.themeCalloutsDefaultTheme": "Tema dvs.",
	"settings.themePreviewAria":
		'Previzualizare "{{name}}" — vedeți cum îl desenează tema dvs.',
	"settings.clearUsesAction": "Șterge utilizările din notele dvs.",
	"settings.builtInAllThemeStyled":
		"{{theme}} restilizează fiecare callout integrat, așa că toate sunt afișate mai sus și Callout Studio le lasă în pace. Pentru a proiecta unul propriu, adăugați un callout cu un ID diferit.",
	"settings.fallbackCallout": "Callout de rezervă implicit",
	"settings.fallbackCalloutDesc":
		"Tipurile de callout nerecunoscute din vault vor moșteni stilul acestui callout.",

	"settings.globalStyle": "Stil global callout",
	"settings.border": "Borduri",
	"settings.borderAll": "Toate",
	"settings.borderTop": "Sus",
	"settings.borderRight": "Dreapta",
	"settings.borderBottom": "Jos",
	"settings.borderLeft": "Stânga",
	"settings.borderWidth": "Grosimea bordurii",
	"settings.fontScaleGroup": "Scara fontului",
	"settings.titleScale": "Titlu",
	"settings.contentScale": "Conținut",
	"settings.inlineTextScale": "Text",
	"settings.shapeGroup": "Formă",
	"settings.borderRadius": "Rotunjirea colțurilor",
	"settings.alignGroup": "Aliniere",
	"settings.alignContent": "Aliniați conținutul cu titlul",
	"settings.headingSpacingGroup": "Spațierea titlului",
	"settings.headingPadVertical": "Spațiere verticală",
	"settings.headingGap": "Spațiere între titluri",
	"settings.headingFoldGroup": "Pliere",
	"settings.headingFoldArrow": "Afișează săgeata de pliere",
	"settings.styleDemoName": "Exemplu",
	"settings.previewTitle": "Previzualizare",

	// Settings — Saved color palettes
	"settings.customPalettes": "Palete de culori salvate",
	"settings.newPalette": "Paletă nouă",
	"settings.customPalettesEmpty": "Nicio paletă salvată deocamdată.",
	"settings.editPaletteAria": "Editați paleta {{name}}",
	"settings.deletePaletteAria": "Ștergeți paleta {{name}}",
	"settings.deletePaletteConfirm":
		'Ștergeți paleta "{{name}}"?\nCallout-urile care îi folosesc culorile nu sunt afectate.',
	"settings.enableAutocomplete": "Activați completarea automată [!",
	"settings.enableAutocompleteDesc":
		'Afișează sugestii când tastați "[!" într-un citat bloc în editor. Alegeți un tip de callout din listă pentru a insera un antet callout complet.',

	"settings.customCommands": "Comenzi și scurtături",
	"settings.customCommandsDesc":
		"Vedeți fiecare comandă Callout Studio și scurtătura la care este asociată, și creați-vă propriile comenzi pentru callouts pe care le folosiți cel mai mult. Implicit nu sunt atribuite scurtături.",
	"settings.customCommandsButton": "Gestionați comenzile",

	"commandBuilder.title": "Comenzi și scurtături",
	"commandBuilder.desc":
		"Folosiți butonul + pentru a seta sau schimba o scurtătură în setările de scurtături ale Obsidian.",
	"commandBuilder.builtIn": "Comenzi integrate",
	"commandBuilder.toggleAria": "Activați sau dezactivați {{name}}",
	"commandBuilder.hotkeyBlank": "Gol",
	"commandBuilder.hotkeyAria": "Setați o scurtătură pentru {{name}}",
	"commandBuilder.yourCommands": "Comenzile dvs.",
	"commandBuilder.newCommand": "Comandă nouă",
	"commandBuilder.empty": "Nicio comandă personalizată încă.",
	"commandBuilder.unknownCommand": "această comandă",
	"commandBuilder.editAria": "Editați {{name}}",
	"commandBuilder.deleteAria": "Ștergeți {{name}}",
	"commandBuilder.deleteConfirm":
		"Ștergeți comanda {{name}}? Orice scurtătură atribuită acesteia va înceta să funcționeze.",
	"commandBuilder.newTitle": "Comandă nouă",
	"commandBuilder.editTitle": "Editați comanda",
	"commandBuilder.format": "Format callout",
	"commandBuilder.formatDesc": "Ce fel de callout scrie comanda.",
	"commandBuilder.formatHeading": "Titlu",
	"commandBuilder.formatInline": "Inline",
	"commandBuilder.formatBlock": "Bloc",
	"commandBuilder.roleDisabled":
		"Acest format este dezactivat, așa că această comandă va insera text simplu până când îl reactivați.",
	"commandBuilder.roleThemeOwned":
		"Tema dvs. furnizează acest callout, așa că are doar un format bloc.",
	"commandBuilder.commandSuspended":
		"În pauză: tema dvs. furnizează acest callout, așa că are doar un format bloc. Această comandă funcționează din nou când tema nu îl mai furnizează.",
	"commandBuilder.callout": "Tip de callout",
	"commandBuilder.calloutDesc":
		"Callout-ul pe care îl inserează această comandă.",
	"commandBuilder.headingLevel": "Nivel de titlu",
	"commandBuilder.headingLevelDesc": "Ce nivel de titlu se scrie.",
	"commandBuilder.action": "Acțiune",
	"commandBuilder.actionDesc":
		"Înfășoară transformă selecția într-un callout; inserează adaugă unul gol.",
	"commandBuilder.actionWrap": "Înfășoară selecția",
	"commandBuilder.actionInsert": "Inserează nou",
	"commandBuilder.preview": "Numele comenzii",
	"commandBuilder.duplicate":
		"Aveți deja o comandă care face exact acest lucru.",
	"commandBuilder.noCallouts":
		"Nu există încă tipuri de callout din care să construiți o comandă.",
	"commandBuilder.save": "Salvați",

	"settings.vaultMaintenance": "Informații și întreținere vault",
	"settings.vaultStats": "Statistici callout",
	"settings.vaultStatsDesc":
		"Numără fiecare callout din notele Markdown — de bloc, de titlu și inline — și le grupează după tip.",
	"settings.vaultStatsButton": "Vizualizare statistici",
	"settings.vaultStatsScanning": "Scanare",
	"settings.resetAll": "Resetați",
	"settings.resetAllDesc":
		"Șterge toate callouts utilizator, resetează callouts integrate, stilurile globale (borduri, scara fontului, formă), paletele de culori salvate, personalizarea meniului clic dreapta și SVG-urile Material descărcate.",
	"settings.resetAllButton": "Resetați tot",
	"settings.resetAllConfirm":
		"Aceasta va șterge toate callouts personalizate, va reseta callouts integrate, stilurile globale, paletele de culori salvate, personalizarea meniului clic dreapta și toate SVG-urile Material din cache. Această acțiune nu poate fi anulată. Ești sigur?",
	"notice.resetAllDone": "Totul a fost resetat la valorile implicite.",

	"notice.customCommandsRemoved":
		"Au fost eliminate {{count}} comandă/comenzi personalizată(e) al căror tip de callout nu mai există.",
	"notice.customCommandMissingCallout":
		"Tipul de callout al acestei comenzi nu mai există.",

	"notice.exported": "Callouts exportate în callout-studio-export.json",
	"notice.importedJSON":
		"Au fost importate {{count}} tip(uri) de callout din JSON.",
	"notice.importedSettings": "Au fost importate setările pluginului.",
	"notice.importedCalloutManager":
		"Importat din Callout Manager: {{created}} create, {{updated}} actualizate.",
	"notice.importedAdmonition":
		"Importat din Admonition: {{created}} create, {{updated}} " +
		"actualizate.",
	"notice.noNewJSON":
		"Nu au fost importate tipuri noi de callout (ID-urile pot exista deja).",
	"notice.iconDownloadFailed":
		'Nu s-a putut descărca pictograma Material "{{name}}". Poate fi indisponibilă pentru acest stil/grosime sau conexiunea este offline.',
	"notice.externalCssOn":
		'Callout Studio nu mai stilizează "{{name}}" — CSS-ul dvs. propriu decide cum arată. Formele sale Callout tip titlu și Callout inline nu se vor reda.',
	"notice.externalCssOff": 'Callout Studio stilizează din nou "{{name}}".',
	"notice.nothingToWrap": "Nimic de înfășurat.",
	"notice.cursorNotInsideCallout":
		"Cursorul nu este în interiorul unui callout.",
	"notice.autocompleteTargetMoved":
		"Nu s-a inserat nimic — linia s-a schimbat cât timp editorul a fost deschis.",
	"notice.openHotkeysFailed":
		"Nu s-au putut deschide setările de scurtături Obsidian.",
	"notice.filterHotkeysFailed":
		"Scurtăturile Obsidian au fost deschise, dar filtrul Callout Studio nu a putut fi aplicat.",

	"editor.editCallout": "Editați callout",
	"editor.newCallout": "Callout nou",
	"editor.displayName": "Nume afișat",
	"editor.displayNameDesc": "Eticheta lizibilă afișată în interfață",
	"editor.displayNameBuiltIn":
		"Numele afișat nu poate fi modificat pentru callouts integrate",
	"editor.displayNamePlaceholder": "Callout-ul meu",
	"editor.calloutIds": "ID-uri callout",
	"editor.calloutIdsDesc":
		"Toți identificatorii pentru acest callout. Spațiile sunt permise.\nApăsați Enter sau butonul + pentru a adăuga.",
	"editor.calloutIdsPlaceholder": "Adaugă ID",
	"editor.addId": "Adaugă ID",
	"editor.idLinkedToName": "Legat de numele afișat",
	"editor.idCannotDelete":
		"Acest ID este legat de numele afișat și nu poate fi șters — editați numele pentru a-l schimba",
	"editor.icon": "Pictogramă",
	"editor.pickIcon": "Schimbă pictograma",
	"editor.replaceIcon": "Înlocuiește pictograma",
	"editor.removeIcon": "Elimină pictograma",
	"editor.noIcon": "Fără pictogramă",
	"editor.resetIcon": "Resetați pictograma la implicit",
	"editor.livePreview": "Previzualizare live",
	"editor.iconAdjustment": "Ajustare pictogramă",
	"editor.picture": "Imagine",
	"editor.size": "Dimensiune",
	"editor.horizontalOffset": "Decalaj orizontal",
	"editor.verticalOffset": "Decalaj vertical",
	"editor.colors": "Culori",
	"editor.colorsDesc":
		"Sets this callout's border, background, and text colors.",
	"editor.resetColors": "Resetați culorile la implicit",
	"editor.paletteDeleted": "Culoare ștearsă",
	"editor.paletteGroupObsidian": "Callouts Obsidian",
	"editor.paletteGroupPresets": "Presetări culori",
	"editor.paletteGroupCustom": "Personalizat",
	"editor.paletteNewColor": "Culoare nouă…",
	"editor.contrastWarning":
		"Contrast scăzut cu fundalul — poate fi greu de citit",
	"editor.foldable": "Pliabil",
	"editor.foldableDesc":
		"Alegeți dacă callout-ul poate fi pliat și ce stare implicită să aplice în tot vault-ul.",
	"editor.foldOff": "Dezactivat",
	"editor.foldOpen": "Deschis implicit",
	"editor.foldClosed": "Închis implicit",
	"editor.cancel": "Anulare",
	"editor.saveChanges": "Salvați modificările",
	"editor.createCallout": "Creați callout",
	"editor.nameRequired":
		"Este necesar un nume afișat înainte de a crea un callout.",
	"editor.noChangesToSave": "Nu s-au efectuat modificări.",
	"editor.downloadingIcon": "Se descarcă pictograma",
	"editor.idEmpty": "Este necesar cel puțin un ID",
	"editor.idExists": "Există deja un callout cu acest ID",
	"editor.idConflict": "Acest ID intră în conflict cu un callout existent",
	"editor.idFromTheme":
		"{{theme}} furnizează deja un callout cu acest ID, așa că Callout Studio nu îl poate stiliza. Alegeți un alt ID.",
	"editor.idThemePattern":
		"Atenție: tema dvs. stilizează fiecare callout care se potrivește cu {{pattern}}, așa că poate suprascrie aspectul acestuia.",
	"editor.idDashConflict":
		"Obsidian scrie spațiile ca liniuțe, așa că acest ID intră în conflict cu „{{other}}”",
	"editor.untitledCallout": "Callout fără titlu",
	"editor.loremIpsum":
		"Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
	"editor.loremIpsumShort":
		"Lorem ipsum dolor sit amet, consectetur adipiscing elit.",
	"editor.sampleInlineText":
		"Iată o pastilă [!{id}] inline în interiorul unui paragraf.",
	"editor.previewReadOnly": "Previzualizarea live nu poate fi editată",

	// Theme callout preview window — opens instead of the editor for a callout
	// the active theme supplies or restyles.
	"themePreview.title": '{{name}} — furnizat de tema dvs.',
	"themePreview.owned":
		'{{theme}} furnizează și stilizează "{{name}}". Callout Studio nu îl va suprascrie, așa că callout-ul său bloc arată exact așa cum îl desenează tema dvs.',
	"themePreview.readOnly":
		"Asta înseamnă că nu i se pot schimba aici culoarea, pictograma, numele și ID-ul. Dacă doriți un design propriu, creați un callout nou cu un ID diferit.",
	"themePreview.blockOnly":
		"Formatele Callout tip titlu și Callout inline nu sunt disponibile pentru callouts furnizate de tema dvs. Callouts de tip bloc folosesc stilul nativ al temei.",
	"themePreview.previewTitle": "Cum este redat acum",
	"themePreview.blockSample":
		"> [!{{id}}] {{name}}\n" +
		"> Așa arată conținutul acestui callout.\n",
	"editor.externalStyleClose": "Am înțeles",

	// Palette editor modal
	"palette.newTitle": "Paletă de culori nouă",
	"palette.groupPalette": "Paletă",
	"palette.editTitle": "Editați paleta de culori",
	"palette.name": "Nume",
	"palette.namePlaceholder": "Paleta mea",
	"palette.nameExists": "Există deja o paletă cu acest nume",
	"palette.baseColor": "Culoare de bază",
	"palette.baseColorHint":
		"Vom potrivi automat culoarea de fundal cu aceasta. Dacă dorești, o poți controla separat {{link}}.",
	"palette.baseColorHintLink": "făcând clic aici",
	"palette.advancedColors": "Culori",
	"palette.advancedColorsHint":
		"Editare culori pentru modul {{mode}} - celălalt mod se actualizează automat. Comută tema Obsidian pentru a verifica.",
	"palette.revertHint": "Preferi o singură culoare de bază? {{link}}.",
	"palette.revertHintLink": "Revenire",
	"palette.lightMode": "Luminos",
	"palette.darkMode": "Întunecat",
	"palette.accentColor": "Culoare de accent",
	"palette.backgroundColorChannel": "Culoare de fundal",
	"palette.textColorChannel": "Culoare text",
	"palette.bgIntensity": "Intensitate",
	"palette.bgStyle": "Stil",
	"palette.bgSolid": "Uniformă",
	"palette.bgGradient": "Degrade",
	"palette.bgTransparent": "Transparent",
	"palette.gradientTo": "A doua culoare",
	"palette.gradientDirection": "Direcție",
	"palette.gradientText": "Text de titlu cu degrade",
	"palette.save": "Salvare",

	// Color name suggestions (used to prefill palette names)
	"colorName.red": "Roșu",
	"colorName.orange": "Portocaliu",
	"colorName.amber": "Chihlimbariu",
	"colorName.yellow": "Galben",
	"colorName.lime": "Verde-lime",
	"colorName.green": "Verde",
	"colorName.teal": "Turcoaz",
	"colorName.cyan": "Cyan",
	"colorName.sky": "Bleu",
	"colorName.blue": "Albastru",
	"colorName.indigo": "Indigo",
	"colorName.violet": "Violet",
	"colorName.purple": "Mov",
	"colorName.pink": "Roz",
	"colorName.rose": "Roz-închis",
	"colorName.brown": "Maro",
	"colorName.gray": "Gri",
	"colorName.black": "Negru",
	"colorName.white": "Alb",
	"colorName.crimson": "Carmin",
	"colorName.coral": "Coral",
	"colorName.grape": "Strugure",
	"colorName.plum": "Prună",
	"colorName.bubblegum": "Gumă de mestecat",

	"iconPicker.pickIcon": "Alegeți o pictogramă",
	"iconPicker.confirm": "Confirmare",
	"iconPicker.cancel": "Anulare",
	"iconPicker.lucide": "Lucide",
	"iconPicker.tabler": "Tabler Icons",
	"iconPicker.material": "Material",
	"iconPicker.emoji": "Emoji",
	"iconPicker.searchLucide": "caută pictograme Lucide",
	"iconPicker.searchTabler": "caută pictograme Tabler",
	"iconPicker.tablerStyle": "Stilul pictogramei",
	"iconPicker.tablerStyleOutline": "Contur (Outline)",
	"iconPicker.tablerStyleFilled": "Umplut (Filled)",
	"iconPicker.loadMore": "Încarcă mai mult",
	"iconPicker.materialStyle": "Stilul pictogramei",
	"iconPicker.materialStyleOutlined": "Contur (Outlined)",
	"iconPicker.materialStyleFilled": "Umplut (Filled)",
	"iconPicker.materialStyleRounded": "Rotunjit (Rounded)",
	"iconPicker.materialStyleSharp": "Ascuțit (Sharp)",
	"iconPicker.materialWeight": "Grosimea pictogramei",
	"iconPicker.materialWeight100": "Subțire (Thin)",
	"iconPicker.materialWeight200": "Extra ușor (Extra Light)",
	"iconPicker.materialWeight300": "Ușor (Light)",
	"iconPicker.materialWeight400": "Normal (Regular)",
	"iconPicker.materialWeight500": "Mediu (Medium)",
	"iconPicker.materialWeight600": "Semi-îngroșat (Semi Bold)",
	"iconPicker.materialWeight700": "Îngroșat (Bold)",
	"iconPicker.materialFontFailed":
		"Previzualizările pictogramelor Material nu au putut fi încărcate. În schimb, sunt afișate numele pictogramelor — căutarea și alegerea funcționează în continuare.",
	"iconPicker.materialFontRetry": "Încearcă din nou",
	"iconPicker.searchMaterial": "caută pictograme Material",
	"iconPicker.searchEmoji": "Caută emoji",
	"iconPicker.skinTone": "Ton de piele",
	"iconPicker.allCategories": "Toate categoriile",
	"iconPicker.noIconSelected": "Nicio pictogramă selectată",
	"iconPicker.noResults": "Nicio pictogramă nu corespunde căutării dvs.",
	"iconPicker.octicons": "Octicons",
	"iconPicker.searchOcticons": "Caută în Octicons",
	"iconPicker.fa": "Font Awesome",
	"iconPicker.searchFa": "Caută în Font Awesome",
	"iconPicker.faStyle": "Stilul pictogramei",
	"iconPicker.faStyleSolid": "Plin (Solid)",
	"iconPicker.faStyleRegular": "Normal (Regular)",
	"iconPicker.faStyleBrands": "Mărci (Brands)",
	"iconPicker.rpgAwesome": "RPG Awesome",
	"iconPicker.searchRpgAwesome": "Caută în RPG Awesome",
	"iconPicker.image": "Imaginile tale",
	"iconPicker.searchImage": "Caută în imaginile tale",
	"iconPicker.imageTooLarge":
		"{{name}} este prea mare. Imaginile trebuie să fie sub 5 MB.",
	"iconPicker.imageUnsupported":
		"{{name}} nu este un format de imagine acceptat. Folosiți SVG, PNG, JPEG sau WebP.",
	"iconPicker.imageInvalidSvg":
		"{{name}} nu a putut fi citit ca SVG sigur și nu a fost adăugat.",
	"iconPicker.imageDecodeFailed": "{{name}} nu a putut fi citit ca imagine.",
	"iconPicker.imageDuplicate":
		"{{name}} există deja în imaginile tale. Redenumiți fișierul sau ștergeți imaginea existentă.",
	"iconPicker.imageAdd": "Adaugă imagini",
	"iconPicker.imageEmpty":
		"Nicio imagine încă. Adaugă un fișier SVG, PNG, JPEG sau WebP de pe calculatorul tău sau trage-l aici.",
	"iconPicker.imageDelete": "Șterge",
	"iconPicker.imageDeleteConfirm": "Ștergeți „{{name}}”?",
	"iconPicker.imageDeleteInUse":
		"{{count}} callouts folosesc această imagine. Vor afișa o pictogramă substituent până când furnizați una nouă.",
	"iconPicker.imageRecolor": "Urmează culoarea Callout",
	"iconPicker.allSources": "Toate sursele",
	"iconPicker.searchAllSources": "Caută în toate sursele de pictograme",
	"iconPicker.sourcesNotDownloaded":
		"Neincluși încă: {{names}}. Alege o sursă de mai sus pentru a o descărca.",
	"iconPicker.chooseSource": "Alege sursa",
	"iconPicker.sourceGroup": "{{name}} · {{count}}",

	// Source menu — what each library holds, in a few words
	"iconPicker.descAllSources": "caută în toate bibliotecile deodată",
	"iconPicker.descLucide": "setul propriu al Obsidian, mereu offline",
	"iconPicker.descTabler":
		"pictograme UI curate și consistente, contur și umplut",
	"iconPicker.descMaterial": "setul Google, patru stiluri și șapte grosimi",
	"iconPicker.descEmoji": "glife colorate, fiecare ton de piele",
	"iconPicker.descOcticons": "pictogramele de interfață GitHub",
	"iconPicker.descFa": "solid, normal și mărci",
	"iconPicker.descRpgAwesome": "pictograme fantasy și jocuri de masă",
	"iconPicker.descImage": "imagini adăugate de pe calculatorul tău",

	// Icon picker — category filter dropdown labels
	"iconPicker.cat.Accessibility": "Accesibilitate",
	"iconPicker.cat.Actions": "Acțiuni",
	"iconPicker.cat.Activities": "Activități",
	"iconPicker.cat.Alert": "Alertă",
	"iconPicker.cat.Alphabet": "Alfabet",
	"iconPicker.cat.Android": "Android",
	"iconPicker.cat.Animals": "Animale",
	"iconPicker.cat.Arrows": "Săgeți",
	"iconPicker.cat.Astronomy": "Astronomie",
	"iconPicker.cat.Audio&Video": "Audio și video",
	"iconPicker.cat.Automotive": "Auto",
	"iconPicker.cat.Badges": "Insigne",
	"iconPicker.cat.Brand": "Mărci",
	"iconPicker.cat.Buildings": "Clădiri",
	"iconPicker.cat.Business": "Afaceri",
	"iconPicker.cat.Camping": "Camping",
	"iconPicker.cat.Charity": "Caritate",
	"iconPicker.cat.Charts": "Diagrame",
	"iconPicker.cat.Charts + Diagrams": "Diagrame și grafice",
	"iconPicker.cat.Childhood": "Copilărie",
	"iconPicker.cat.Clothing + Fashion": "Îmbrăcăminte și modă",
	"iconPicker.cat.Coding": "Programare",
	"iconPicker.cat.Communicate": "Comunicare",
	"iconPicker.cat.Communication": "Comunicații",
	"iconPicker.cat.Computers": "Calculatoare",
	"iconPicker.cat.Connectivity": "Conectivitate",
	"iconPicker.cat.Construction": "Construcție",
	"iconPicker.cat.Currencies": "Valute",
	"iconPicker.cat.Database": "Bază de date",
	"iconPicker.cat.Design": "Design",
	"iconPicker.cat.Development": "Dezvoltare",
	"iconPicker.cat.Devices": "Dispozitive",
	"iconPicker.cat.Devices + Hardware": "Dispozitive și hardware",
	"iconPicker.cat.Disaster + Crisis": "Dezastre și crize",
	"iconPicker.cat.Document": "Document",
	"iconPicker.cat.E-commerce": "Comerț electronic",
	"iconPicker.cat.Editing": "Editare",
	"iconPicker.cat.Education": "Educație",
	"iconPicker.cat.Electrical": "Electric",
	"iconPicker.cat.Emoji": "Emoji",
	"iconPicker.cat.Energy": "Energie",
	"iconPicker.cat.Extensions": "Extensii",
	"iconPicker.cat.Files": "Fișiere",
	"iconPicker.cat.Film + Video": "Film și video",
	"iconPicker.cat.Food": "Mâncare",
	"iconPicker.cat.Food + Beverage": "Mâncare și băuturi",
	"iconPicker.cat.Fruits + Vegetables": "Fructe și legume",
	"iconPicker.cat.Games": "Jocuri",
	"iconPicker.cat.Gaming": "Gaming",
	"iconPicker.cat.Gender": "Gen",
	"iconPicker.cat.Genders": "Genuri",
	"iconPicker.cat.Gestures": "Gesturi",
	"iconPicker.cat.Halloween": "Halloween",
	"iconPicker.cat.Hands": "Mâini",
	"iconPicker.cat.Hardware": "Hardware",
	"iconPicker.cat.Health": "Sănătate",
	"iconPicker.cat.Holidays": "Sărbători",
	"iconPicker.cat.Home": "Acasă",
	"iconPicker.cat.Household": "Menaj",
	"iconPicker.cat.Humanitarian": "Umanitar",
	"iconPicker.cat.Images": "Imagini",
	"iconPicker.cat.Laundry": "Spălătorie",
	"iconPicker.cat.Letters": "Litere",
	"iconPicker.cat.Logic": "Logică",
	"iconPicker.cat.Logistics": "Logistică",
	"iconPicker.cat.Map": "Hartă",
	"iconPicker.cat.Maps": "Hărți",
	"iconPicker.cat.Maritime": "Maritim",
	"iconPicker.cat.Marketing": "Marketing",
	"iconPicker.cat.Math": "Matematică",
	"iconPicker.cat.Mathematics": "Matematică",
	"iconPicker.cat.Media": "Media",
	"iconPicker.cat.Media Playback": "Redare media",
	"iconPicker.cat.Medical + Health": "Medical și sănătate",
	"iconPicker.cat.Money": "Bani",
	"iconPicker.cat.Mood": "Dispoziție",
	"iconPicker.cat.Moving": "Mutare",
	"iconPicker.cat.Music + Audio": "Muzică și audio",
	"iconPicker.cat.Nature": "Natură",
	"iconPicker.cat.Numbers": "Numere",
	"iconPicker.cat.Photography": "Fotografie",
	"iconPicker.cat.Photos + Images": "Fotografii și imagini",
	"iconPicker.cat.Political": "Politic",
	"iconPicker.cat.Privacy": "Confidențialitate",
	"iconPicker.cat.Punctuation + Symbols": "Punctuație și simboluri",
	"iconPicker.cat.Religion": "Religie",
	"iconPicker.cat.Science": "Știință",
	"iconPicker.cat.Science Fiction": "Știință ficțiune",
	"iconPicker.cat.Security": "Securitate",
	"iconPicker.cat.Shapes": "Forme",
	"iconPicker.cat.Shopping": "Cumpărături",
	"iconPicker.cat.Social": "Rețele sociale",
	"iconPicker.cat.Spinners": "Rotițe",
	"iconPicker.cat.Sport": "Sport",
	"iconPicker.cat.Sports + Fitness": "Sport și fitness",
	"iconPicker.cat.Symbols": "Simboluri",
	"iconPicker.cat.System": "Sistem",
	"iconPicker.cat.Text": "Text",
	"iconPicker.cat.Text Formatting": "Formatare text",
	"iconPicker.cat.Time": "Timp",
	"iconPicker.cat.Toggle": "Comutator",
	"iconPicker.cat.Transit": "Transit",
	"iconPicker.cat.Transportation": "Transport",
	"iconPicker.cat.Travel": "Călătorii",
	"iconPicker.cat.Travel + Hotel": "Călătorii și hotel",
	"iconPicker.cat.UI actions": "Acțiuni interfață",
	"iconPicker.cat.Users + People": "Utilizatori și persoane",
	"iconPicker.cat.Vehicles": "Vehicule",
	"iconPicker.cat.Version control": "Control versiuni",
	"iconPicker.cat.Weather": "Vreme",
	"iconPicker.cat.Writing": "Scriere",
	"iconPicker.cat.Zodiac": "Zodiac",

	// Downloadable icon packs
	"iconPack.downloadTitle": "{{name}} nu a fost încă descărcat",
	"iconPack.downloadDetail":
		"{{count}} pictograme · {{size}} · descărcare unică",
	"iconPack.download": "Descarcă",
	"iconPack.downloading": "Se descarcă {{name}}…",
	"iconPack.downloadFailed":
		"Nu s-a putut descărca {{name}}. Verificați conexiunea și încercați din nou.",
	"iconPack.retry": "Încearcă din nou",
	"iconPack.faBrandsNotice":
		"Pictogramele de mărci sunt mărci înregistrate ale proprietarilor respectivi. Includerea lor nu indică o aprobare. Vă rugăm să le folosiți doar pentru a reprezenta compania, produsul sau serviciul la care se referă.",
	"iconPack.artworkRestored":
		"Arta pictogramelor pentru {{names}} a fost descărcată.",
	"iconPack.diskWriteFailed":
		"Callout Studio nu a putut salva pachetul de pictograme pe disc, deci va trebui descărcat din nou data viitoare. Pictogramele alese sunt încă salvate în setările dvs.",

	// Icon licences & credits
	"credits.title": "Licențe pictograme și credite",
	"credits.intro":
		"Callout Studio folosește mai multe biblioteci deschise de pictograme. Licențele lor sunt reproduse mai jos, împreună cu ce a fost schimbat pentru utilizarea lor aici.",
	"credits.fullNotices": "Notificări complete ale terților",
	"credits.pluginLicense":
		"Codul propriu al Callout Studio este sub o licență permissive; bibliotecile de pictograme păstrează propriile licențe.",

	"contextMenu.editCallout": "Editați setările callout",
	"contextMenu.copyMarkdown": "Copiați Markdown callout",
	"contextMenu.openSettings": "Deschideți setările Callout Studio",
	"contextMenu.setFoldClosed": "Setați callout ca închis (-)",
	"contextMenu.setFoldOpen": "Setați callout ca deschis (+)",
	"contextMenu.setFoldNone": "Setați callout ca nepliabil",
	"contextMenu.cutSection": "Decupați secțiunea de titlu",
	"contextMenu.copySection": "Copiați secțiunea de titlu",
	"contextMenu.deleteSection": "Ștergeți secțiunea de titlu",
	"heading.toggleFold": "Comutare pliere",
	"settings.globalSettings": "Opțiuni de stil Callout Studio",
	"settings.globalSettingsScope":
		"Formă, spațiere și dimensiune pentru callouts pe care le stilizează Callout Studio. Callouts stilizate de tema dvs. păstrează designul propriu al temei.",
	"settings.globalSettingsRegularDesc":
		"Adăugați un token callout într-un citat (de ex. `> [!type]`) pentru a afișa caseta de callout integrată a Obsidian. Puteți ajusta bordura, rotunjirea, scara fontului și alinierea.",
	"settings.globalSettingsHeadingDesc":
		"Adăugați un token callout imediat după simbolurile # ale titlului (de ex. `## [!type]`) pentru a-l afișa ca un titlu de callout stilizat. Puteți ajusta bordura, forma și spațierea verticală.",
	"settings.globalSettingsInlineDesc":
		"Adăugați un token callout oriunde într-o linie de text (de ex. `[!type]`) pentru a-l afișa ca o pastilă mică inline. Puteți ajusta bordura și forma.",
	"settings.globalSettingsCustomize": "Personalizați",
	"settings.calloutTypeRegular": "Block callout",
	"settings.calloutTypeHeading": "Callout tip titlu",
	"settings.calloutTypeInline": "Callout inline",
	"settings.customizeMenu": "Personalizați elementele meniului",
	"settings.customizeMenuDesc":
		"Alegeți ce acțiuni de clic dreapta apar pentru fiecare tip de callout și reordonați-le. Funcționează în modul sursă și Live Preview.",
	"settings.customizeMenuButton": "Personalizați elementele meniului",
	"menuCustomize.title": "Personalizare meniu clic dreapta",
	"menuCustomize.desc":
		"Activați sau dezactivați acțiuni și trageți mânerul pentru a le reordona. Modificările sunt salvate automat.",
	"menuCustomize.regular": "Block callout",
	"menuCustomize.heading": "Callout tip titlu",
	"menuCustomize.inline": "Callout inline",
	"menuCustomize.dragHandle": "Trageți pentru a reordona",
	"menuItem.edit": "Editați callout",
	"menuItem.openSettings": "Deschideți setările",
	"menuItem.copyMarkdown": "Copiați Markdown",
	"menuItem.foldDefaults":
		"Stare implicită de pliere (deschis / închis / niciuna)",
	"menuItem.cutSection": "Decupați secțiunea",
	"menuItem.copySection": "Copiați secțiunea",
	"menuItem.deleteSection": "Ștergeți secțiunea",

	"confirm.ok": "Șterge",
	"confirm.cancel": "Anulare",
	// Headings for each confirmation — every window carries one, so each
	// caller of ConfirmModal names what it is about to do.
	"confirm.titleDeleteCommand": "Șterge comanda",
	"confirm.titleResetAll": "Resetează toate callout-urile",
	"confirm.titleResetCallout": "Resetează callout",
	"confirm.titleDeletePalette": "Șterge paleta",
	"confirm.titleDeleteImage": "Șterge imaginea",

	"vault.filesUpdated":
		"Au fost actualizate {{count}} referință(e) callout în fișierele vault.",
	"vault.idsUpdated":
		"Au fost actualizate {{count}} ID(uri) callout în fișierele vault: {{oldIds}} → {{newId}}",
	"vault.titlesUpdated":
		"Au fost actualizate {{count}} titlu(uri) callout în fișierele vault: {{oldTitle}} → {{newTitle}}",
	"vault.replaceWith": "Înlocuiți cu:",
	"vault.deleteWithout": "Ștergeți fără înlocuire",
	"vault.confirmDelete": "Confirmare",
	"vault.confirmReplace": "Înlocuiți",
	"vault.replacePromptInUse":
		'"{{name}}" este utilizat de {{count}} ori în {{files}} fișier(e). Alegeți un callout cu care să îl înlocuiți:',
	"vault.replacePromptUnused":
		'Alegeți un callout cu care să înlocuiți "{{name}}":',
	"vault.noReplacementAvailable":
		"Nu există alte callouts disponibile pentru a înlocui acesta.",
	"vault.convertedToPlainText":
		"{{blocks}} bloc(uri) callout din {{files}} fișier(e) convertit(e) în text simplu.",
	"vault.resetAliasWarning":
		"{{count}} referință(e) din {{files}} fișier(e) folosesc aliasuri personalizate: {{aliases}}. Acestea vor înceta să funcționeze după resetare. Continuați?",
	"vault.resetConfirm": "Resetați",
	"vault.resetAllInUse":
		"⚠ {{count}} referință(e) callout din {{files}} fișier(e) folosesc tipuri de callout personalizate care vor fi șterse.",

	"quickInsert.title": "Inserare rapidă de callout bloc",
	"quickInsert.desc": "Alege un callout de inserat la poziția cursorului. Doar callout de tip bloc.",
	"quickInsert.searchPlaceholder": "Caută callout-uri",
	"quickInsert.sourceAria": "Filtrează după sursa callout",
	"quickInsert.sourceAll": "Toate",
	"quickInsert.sourceBuiltIn": "Integrat",
	"quickInsert.sourceUser": "Callout-urile mele",
	"quickInsert.editAria": "Editează {{name}}",
	"quickInsert.insertAria": "Inserează {{name}} ca callout bloc",
	"quickInsert.noResults": "Nu s-au găsit callout-uri",
	"quickInsert.noUserCallouts": "Nu ai creat încă niciun callout.",
	"quickInsert.noEditorHint": "Nicio notă nu este deschisă în modul de editare, așa că nimic nu poate fi inserat.",
	"quickInsert.noEditor": "Deschide o notă în modul de editare pentru a insera un callout.",

	"vaultStats.title": "Statistici callout",
	"vaultStats.totalCallouts": "Total callouts",
	"vaultStats.typesFound": "Tipuri găsite",
	"vaultStats.filesWithCallouts": "Fișiere cu callouts",
	"vaultStats.filesScanned": "Fișiere Markdown scanate",
	"vaultStats.empty": "Nu au fost găsite callouts în notele Markdown.",
	"vaultStats.columnType": "Tip",
	"vaultStats.columnName": "Nume",
	"vaultStats.columnSource": "Sursă",
	"vaultStats.columnCount": "Număr",
	"vaultStats.columnFiles": "Fișiere",
	"vaultStats.unknown": "Necunoscut",
	"vaultStats.sourceBuiltIn": "Integrat",
	"vaultStats.sourceCustom": "Personalizat",
	"vaultStats.sourceAutoFallback": "Rezervă automată",
	"vaultStats.sourceTheme": "Fragment CSS",
	"vaultStats.sourceAlias": "Alias pentru {{id}}",
	"vaultStats.sourceUnknown": "Necunoscut",
	"vaultStats.byRole": "Scris ca",
	"vaultStats.roleBlock": "Bloc",
	"vaultStats.roleHeading": "Titlu",
	"vaultStats.roleInline": "Inline",
	"vaultStats.defineUndefined": "Definește {{count}} lipsă",
	"vaultStats.defineRunning": "Scanare",
	"vaultStats.defineDone": "S-au adăugat {{count}} tipuri de callout.",
	"vaultStats.close": "Închide",

	"import.title": "Probleme de import",
	"import.reportLeadIn":
		"Se pare că fișierul importat a fost modificat. Iată lista problemelor:",
	"import.reportLeadInFatal":
		"Acest fișier nu pare a fi un export Callout Studio. Nu poate fi importat:",
	"import.entryHeading": "Intrare {{index}} — {{label}}",
	"import.summary":
		"{{valid}} din {{total}} intrări sunt valide · {{issues}} problemă(e) găsită(e).",
	"import.btnCancel": "Anulare",
	"import.btnImportValid": "Importați doar cele valide ({{count}})",
	"import.err.notRecognized":
		"Fișier nerecunoscut: se aștepta un array de definiții callout sau un export Callout Studio.",
	"import.warn.settingsIgnored":
		"Blocul de setări nu a fost un obiect valid și a fost ignorat.",
	"import.warn.invalidGradient":
		"Gradientul de fundal a fost invalid și a fost ignorat.",
	"import.err.parseFailed":
		"Fișierul nu este JSON valid și nu a putut fi analizat.",
	"import.err.entryNotObject": "Intrarea trebuie să fie un obiect.",
	"import.err.requiredMissing":
		'Câmpul obligatoriu "{{field}}" lipsește sau are tipul greșit.',
	"import.err.idEmpty": "ID-ul nu trebuie să fie gol.",
	"import.err.idTooLong":
		'ID-ul "{{value}}" are {{length}} caractere; maximul este {{max}}.',
	"import.err.idBadChar":
		'ID-ul "{{value}}" conține caractere invalide ("|", "[", "]", tabulatorii și sfârșiturile de linie nu sunt permise).',
	"import.err.idMetadata":
		'ID-ul "{{value}}" conține un "|". În Obsidian, tot ce urmează după primul "|" reprezintă metadate ale callout-ului, nu parte a tipului, deci această intrare descrie callout-ul "{{id}}". Ignorată, pentru ca "{{id}}" existent să rămână neschimbat.',
	"import.err.displayNameEmpty": "Numele afișat nu trebuie să fie gol.",
	"import.err.displayNameTooLong":
		"Numele afișat are {{length}} caractere; maximul este {{max}}.",
	"import.err.boolField":
		'"{{field}}" trebuie să fie o valoare booleană (true sau false).',
	"import.err.iconNotObject": "Pictograma trebuie să fie un obiect.",
	"import.err.iconTypeInvalid":
		'Tipul pictogramei "{{value}}" nu este unul dintre: {{types}}.',
	"import.warn.iconFieldIgnored":
		'"{{field}}" se aplică doar pictogramelor Material și este ignorat pentru tipul de pictogramă {{type}}.',
	"import.err.iconValueEmpty":
		"Valoarea pictogramei trebuie să fie un șir nevid.",
	"import.err.iconValueTooLong":
		"Valoarea pictogramei este neobișnuit de lungă ({{length}} caractere).",
	"import.err.materialStyle":
		'Stilul pictogramei Material "{{value}}" nu este unul dintre: outlined, filled, rounded, sharp.',
	"import.err.materialWeight":
		'Grosimea pictogramei Material "{{value}}" trebuie să fie un număr întreg între 100 și 700, în pași de 100.',
	"import.warn.iconRecolorIgnored":
		'"recolor" se aplică doar imaginilor proprii și este ignorat pentru tipul de pictogramă {{type}}.',
	"import.err.iconRecolorInvalid":
		'"recolor" trebuie să fie true sau false (primit: "{{value}}").',
	"import.err.colorInvalid":
		'"{{field}}" trebuie să fie o culoare hexadecimală ca "#448aff" (primit "{{value}}").',
	"import.err.numberRange":
		'"{{field}}" trebuie să fie un număr între {{min}} și {{max}} (primit "{{value}}").',
	"import.err.iconSizeRange":
		'"{{field}}" trebuie să fie un număr între {{min}} și {{max}} (primit "{{value}}").',
	"import.err.iconAdjustShape":
		'"iconAdjust" must be an object mapping a callout type ("regular", "heading", "inline") to its icon size and offsets.',
	"import.err.aliasesNotArray":
		'"aliases" trebuie să fie un array de șiruri.',
	"import.err.aliasNotString": "Aliasul trebuie să fie un șir.",
	"import.err.aliasDup":
		'Aliasul "{{value}}" este duplicat în această intrare.',
	"import.err.tooManyIds":
		"Prea multe ID-uri ({{count}}); fiecare callout poate avea cel mult {{max}} ID-uri (primar + aliasuri).",
	"import.err.metadataShape":
		'"metadata" trebuie să fie un obiect ale cărui valori sunt toate șiruri.',
	"import.warn.unknownFields": "Câmpuri necunoscute ignorate: {{fields}}.",
	"import.err.duplicateInFile":
		'ID/aliasul "{{value}}" este deja folosit de intrarea #{{first}} din acest fișier.',
	"import.err.aliasConflict":
		'Aliasul "{{value}}" este deja folosit de alt callout ("{{other}}") din vault-ul dvs.',
	"import.warn.defaultFoldedAutofix":
		'"defaultFolded" era true în timp ce "foldable" era false; defaultFolded a fost resetat la false.',
	"import.warn.imageMissing":
		"Acest Callout folosește o imagine care nu se află în fișier și nu se află în acest vault, deci va afișa o pictogramă substituent până când furnizați una nouă.",

	"import.err.paletteIdInvalid":
		'"paletteId" trebuie să fie un ID text nevid (primit "{{value}}").',
	"import.warn.iconNameUnknown":
		'Nu există nicio pictogramă "{{value}}" în {{type}}, deci a fost utilizată pictograma implicită.',
	"import.warn.cmIconUnknownNew":
		'Nu există nicio pictogramă "{{value}}" în Obsidian, deci a fost utilizată pictograma implicită.',
	"import.warn.cmIconUnknownExisting":
		'Nu există nicio pictogramă "{{value}}" în Obsidian, deci "{{id}}" a păstrat pictograma pe care o avea deja.',
	"import.chooseSource": "Importați din",
	"import.sourceStudio": "Callout Studio",
	"import.sourceStudioDesc":
		"Încărcați un fișier .json exportat din Callout Studio.",
	"import.sourceCalloutManager": "Callout Manager",
	"import.sourceCalloutManagerDesc":
		"Lipiți stilurile copiate din butonul Copy al Callout Manager.",
	"import.sourceAdmonition": "Admonition",
	"import.sourceAdmonitionDesc":
		"Adu-ți admonition-urile personalizate din pluginul Admonition.",
	"import.cmTitle": "Importați din Callout Manager",
	"import.cmFromVault": "Acest vault",
	"import.cmVaultChecking": "Se caută pluginul Callout Manager…",
	"import.cmVaultFound": "S-au găsit {{count}} callout-uri personalizate.",
	"import.cmVaultNotFound":
		"Nu s-au găsit callout-uri personalizate în acest vault.",
	"import.cmPasteLabel":
		"Sau lipește aici stilurile copiate din Callout Manager:",
	"import.cmInstructions":
		"În Callout Manager, utilizați butonul Copy pentru a copia stilurile de callout personalizate, apoi lipiți-le mai jos.",
	"import.cmPlaceholder": "Lipiți stilurile copiate aici…",
	"import.cmBtnCancel": "Anulare",
	"import.cmBtnImport": "Importați",
	"import.err.cmNotRecognized":
		"Fișier nerecunoscut: se așteptau stilurile produse de butonul Copy din Callout Manager sau un data.json al pluginului Callout Manager.",
	"import.err.cmNoEntries":
		"Nu s-au găsit callout-uri personalizate de importat.",
	"import.err.cmNoBlocksFound":
		"Nu au fost găsite stiluri Callout Manager în textul lipit.",
	"import.err.cmNoColorForNew":
		'Nu a fost găsită nicio culoare utilizabilă pentru noul callout "{{value}}"; a fost omis.',
	"import.warn.cmNoColorDefault":
		"Nu a fost setată nicio culoare în Callout Manager, așa că s-a folosit griul implicit.",
	"import.warn.cmThemeCondition":
		"Culoarea sau pictograma acestui callout a fost setată pentru o singură temă. Callout Studio nu are stilizare per temă, așa că a fost adusă pentru toate temele.",
	"import.warn.cmCustomStyles":
		"Acest callout are și CSS personalizat în Callout Manager. Stilul nu face parte din import, așa că au fost aduse doar pictograma și culoarea.",
	"import.err.cmIdConflict":
		'ID-ul "{{value}}" este deja utilizat ca alias de un alt callout ("{{other}}") și a fost omis.',

	// Import — Admonition
	"import.admTitle": "Importă din Admonition",
	"import.admInstructions":
		"Fiecare admonition devine un callout cu numele, pictograma și " +
		"culoarea sa. Setările fără echivalent în Callout Studio " +
		"(comandă, buton de copiere, titlu ascuns) rămân pe loc.",
	"import.admFromVault": "Acest seif",
	"import.admVaultChecking": "Se caută pluginul Admonition…",
	"import.admVaultFound": "S-au găsit {{count}} admonition personalizate.",
	"import.admVaultNotFound":
		"Nu s-au găsit admonition personalizate în acest seif.",
	"import.admFromFile": "Un fișier",
	"import.admFromFileDesc":
		"Un fișier admonitions.json sau un pachet partajat.",
	"import.admChooseFile": "Alege fișier…",
	"import.admPasteLabel": "Sau lipește JSON-ul aici:",
	"import.admPlaceholder": "Lipește aici admonition-urile tale…",
	"import.admBtnCancel": "Anulare",
	"import.admBtnImport": "Importați",
	"import.err.admNotRecognized":
		"Fișier nerecunoscut: se aștepta o listă de admonition sau un " +
		"data.json de la Admonition.",
	"import.err.admNoEntries": "Nu s-a găsit niciun admonition de importat.",
	"import.err.admTypeMissing":
		'Acest admonition nu are "type" și a fost omis.',
	"import.warn.admIconUnknown":
		'Nu s-a găsit nicio pictogramă numită "{{value}}" în nicio ' +
		"bibliotecă, așa că s-a folosit pictograma implicită.",
	"import.warn.admIconUnknownExisting":
		'Nu s-a găsit nicio pictogramă numită "{{value}}" în nicio ' +
		'bibliotecă, așa că "{{id}}" și-a păstrat pictograma existentă.',
	"import.warn.admImageFailed":
		"Imaginea încărcată nu a putut fi citită, așa că s-a folosit " +
		"pictograma implicită.",
	"import.warn.admIconWithCss":
		"Acest admonition este stilizat de un fragment CSS în Admonition. " +
		"Acel stil nu face parte din import, așa că au venit doar numele, " +
		"pictograma și culoarea.",
	"import.warn.admNoColor":
		"Nu era setată nicio culoare, așa că s-a folosit albastrul " +
		"implicit.",
	"import.warn.admTitleTruncated":
		"Titlul are {{length}} caractere; a fost scurtat la {{max}}.",

	"footer.tagline":
		"Aveți feedback, comentarii sau sugestii? Mi-ar plăcea să aud!",
	"footer.madeBy": "Creat de Niv  •  ",
	"settings.deletePaletteConfirmLinkedOne":
		'Ștergeți paleta "{{name}}"?\n1 callout o folosește. Își păstrează culorile, iar mai târziu îl puteți reconecta din rândul Culoare din editorul lui.',
	"settings.deletePaletteConfirmLinked":
		'Ștergeți paleta "{{name}}"?\n{{count}} callout-uri o folosesc. Își păstrează culorile, iar mai târziu le puteți reconecta din rândul Culoare din oricare dintre editoarele lor.',
	"settings.unlinkedColors": "Culori nelegate",
	"settings.unlinkedColorsDesc":
		"Callout-uri a căror culoare salvată a fost ștearsă. Își păstrează culorile pe care le aveau; restaurarea salvează din nou culoarea și reconectează întregul grup.",
	"settings.unlinkedColorOne": "1 callout",
	"settings.unlinkedColorCount": "{{count}} callout-uri",
	"settings.restoreColor": "Restabilește",
	"settings.palettesMergedNotice":
		"A fuzionat {{count}} paletă/palete importată/importate în culori salvate care aveau deja aceleași culori.",
	"notice.palettesMerged":
		"A fuzionat {{count}} culoare/culori salvată/salvate cu culori identice: {{names}}. Callout-urile care le folosesc își păstrează culorile și acum sunt legate de culoarea rămasă.",
	"editor.colorsDescDeleted":
		"Culoarea salvată a acestui callout a fost ștearsă. O puteți salva din nou {{link}}.",
	"editor.colorsDescDeletedOther":
		"Culoarea salvată a acestui callout a fost ștearsă. O puteți salva din nou {{link}} — încă 1 alt callout care o folosește va fi reconectat.",
	"editor.colorsDescDeletedOthers":
		"Culoarea salvată a acestui callout a fost ștearsă. O puteți salva din nou {{link}} — încă {{count}} alte callout-uri care o folosesc vor fi reconectate.",
	"editor.colorsDescDeletedLink": "făcând clic aici",
	"palette.colorExists":
		'Aceste culori sunt identice cu "{{name}}". Două culori salvate nu pot fi la fel — schimbați o culoare ca să le diferențiați.',
	"palette.colorExistsUse":
		'Aceste culori sunt identice cu "{{name}}". Două culori salvate nu pot fi la fel — schimbați o culoare sau {{link}}.',
	"palette.colorExistsUseLink": "folosiți-o pe cea existentă",
	"locale.downloading": "Se descarcă traducerea…",
	"locale.notDownloaded": "{{name}} nu a fost descărcat încă",
	"locale.notDownloadedDesc":
		"Callout Studio afișează engleza până când traducerea poate fi descărcată. Va încerca din nou la următoarea pornire a Obsidian.",
	"locale.retry": "Încearcă din nou",
	"locale.diskWriteFailed":
		"Callout Studio nu a putut salva traducerea pe disc, așa că va trebui descărcată din nou data viitoare.",
	"notice.exportedCssCreated": "Fragmentul CSS a fost salvat în {{path}}",
	"notice.exportedCssUpdated": "Fragmentul CSS a fost actualizat în {{path}}",
	"notice.exportedCssUnchanged": "Fragmentul CSS este deja actualizat.",
	"notice.exportCssEmpty": "Nu există callouturi personalizate de exportat.",
	"notice.exportCssFailed":
		"Fragmentul CSS nu a putut fi salvat. Verifică consola dezvoltatorului pentru detalii.",
	"notice.exportCssEnabled":
		"Acest fragment este activat în acest vault. Callout Studio stilizează deja aceste callouturi, iar fragmentul păstrează stilul din momentul exportului.",
	"confirm.titleOverwriteSnippet": "Suprascrie fragmentul CSS",
	"confirm.overwriteSnippet":
		"Fragmentul CSS din folderul snippets s-a schimbat de când a fost scris de Callout Studio. Un nou export va înlocui întregul fișier.",
	"confirm.overwriteSnippetOk": "Suprascrie",
	"export.chooseFormat": "Exportă ca",
	"export.formatJson": "Copie de siguranță Callout Studio",
	"export.formatJsonDesc":
		"Un fișier .json cu callouturile și setările tale, pentru import într-un alt vault.",
	"export.formatCss": "Fragment CSS",
	"export.formatCssDesc":
		"Un fișier .css salvat în folderul snippets al acestui vault, pentru utilizare unde Callout Studio nu este instalat. Acoperă doar callouturile obișnuite și este un instantaneu; exportă din nou după modificare.",
	"quickInsert.readingViewHint": "Această notă este deschisă în modul de citire, așa că nimic nu poate fi inserat.",
	"quickInsert.readingView": "Comută la modul sursă sau la Live Preview pentru a insera un callout.",
	"quickInsert.noCursorHint": "Nu există niciun cursor în această notă, așa că nu există unde să inserezi.",
	"quickInsert.noCursor": "Plasează cursorul în notă în locul în care dorești să inserezi callout-ul, apoi încearcă din nou.",
};
