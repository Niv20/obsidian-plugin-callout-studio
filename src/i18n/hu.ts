export const hu: Record<string, string> = {
	"cmd.openSettings": "Beállítások megnyitása",
	"cmd.createCallout": "Új callout-típus létrehozása",
	"cmd.insertEmptyCallout": "Üres callout beszúrása",
	"cmd.calloutWrap": "Callout-ba csomagolás",
	"cmd.calloutUnwrap": "Callout eltávolítása",

	"cmd.customWrapBlock": "Becsomagolás {{name}} blokk callout-ba",
	"cmd.customInsertBlock": "{{name}} blokk callout beszúrása",
	"cmd.customInsertHeading": "H{{level}} {{name}} címsor callout beszúrása",
	"cmd.customInsertInline": "{{name}} beágyazott callout beszúrása",
	"cmd.openQuickInsert": "Blokk callout gyors beszúrása",

	"autocomplete.createNew": 'Új callout létrehozása: "{{name}}"',

	"settings.fallbackTag": "Alapértelmezett",
	"settings.fallbackTagAuto": "Aut. alapértelmezett",
	"settings.rescanVault": "Tár újraszkennelése",
	"settings.rescanVaultDesc":
		"Megkeresi a fel nem ismert callout-azonosítókat a jegyzetekben, és hozzáadja őket tartalék sorokként.",
	"settings.rescanVaultHintAction": "Szkennelés most",
	"settings.rescanComplete":
		"Újraszkennelés kész: {{count}} új callout hozzáadva.",
	"replaceModal.deleteWithoutReplaceSuffix":
		"(visszaesik az alapértelmezettre)",
	"replaceModal.titleDelete": "Callout törlése",
	"replaceModal.titleReplace": "Csere a tárban",

	"firstRun.title": "Meglévő callout-ok keresése a tárban?",
	"firstRun.body":
		"A Callout Studio szkennelheti a tárat, hogy felfedezze a már használt callout-okat, így megjelennek a beállítások listájában, és átveszik a tartalék stílust.",
	"firstRun.heavyVaultNote":
		"A tárban {{count}} Markdown-fájl van – a szkennelés néhány másodpercet vehet igénybe.",
	"firstRun.laterHint":
		"Ezt később is futtathatja a Beállítások → Tár-elemzések és karbantartás → Tár újraszkennelése menüpontból.",
	"firstRun.scanNow": "Szkennelés most",
	"firstRun.noThanks": "Nem, köszönöm",
	"firstRun.autoScanComplete":
		"A Callout Studio beszkennelte a tárat, és {{count}} callout-ot hozzáadott.",
	"firstRun.scanning": "Szkennelés",

	"welcome.tooltip": "A Callout Studio névjegye",
	"welcome.title": "Üdvözöljük a Callout Studióban",
	"welcome.tagline":
		"Az Ön teljes körű megoldása az Obsidian callout-ok kezelésére.",
	"welcome.previewTitle": "Nézze meg működés közben",
	"welcome.sample":
		"A Callout Studio segítségével egyéni ikonnal, színekkel és névvel hozhat létre callout-okat.\n\n" +
		"Ugyanazt a callout-ot **három** különböző módon használhatja:\n\n" +
		"## [!tip] Címsorként\n" +
		"Ahhoz, hogy bármely címsort callout stílusú címsorrá alakítsa, adja hozzá a `[!type]`-ot közvetlenül a `#` jelek után.\n\n" +
		"Szeretne egy ilyen beágyazott callout-ot, mint ez [!warning]? Egyszerűen illessze be a `[!type]`-ot egy mondat közepére, anélkül, hogy megszakítaná az írás menetét.\n\n" +
		"> [!note] Normál callout\n" +
		"> A klasszikus callout természetesen ugyanazzal a szintaxissal működik, amit már megszokott: `> [!type]`.\n\n" +
		"A Callout Studio ennél sokkal többet is kínál! [Tudjon meg többet]({{repoUrl}}).\n",

	"deleteModal.title": '"{{name}}" callout törlése?',
	"deleteModal.bodyInUse":
		"Ez a callout {{count}} alkalommal szerepel {{files}} fájlban.",
	"deleteModal.bodyInUseExplain":
		"A törlés ezeket a blokkokat egyszerű szöveggé alakítja – elveszítik a stílusukat és a callout fejlécét.",
	"deleteModal.replaceHint":
		"Helyettesítheti egy másik callout-tal, így a tár tartalma stílusos callout marad.",
	"deleteModal.bodyUnused":
		'"{{name}}" nem szerepel egyetlen jegyzetben sem, de egy általad létrehozott egyéni callout. A törlés eltávolítja a listából.',
	"deleteModal.replaceInstead": "Inkább cserélje le",
	"deleteModal.deleteInUse": "Törlés (egyszerű szöveggé alakítás)",
	"deleteModal.deleteUnused": "Callout törlése",
	// The variant for a callout whose definition Callout Studio cannot remove:
	// one of Obsidian's built-ins, or a type the active theme declares.
	"deleteModal.titleKeep": 'Törli "{{name}}" minden előfordulását?',
	"deleteModal.keepsRowBuiltIn":
		"Ez az Obsidian egyik beépített callout-ja, ezért maga a típus elérhető marad — csak a jegyzeteiben lévő előfordulásai változnak.",
	"deleteModal.keepsRowTheme":
		"A(z) {{theme}} határozza meg ezt a callout-típust, ezért elérhető marad, és megtartja a kinézetét. A Callout Studio csak a tárában lévő jegyzeteket módosítja — a témájához tartozó semmi nem változik.",
	"deleteModal.clearUsages": "Előfordulások törlése (egyszerű szöveggé alakítás)",

	"settings.title": "Callout Studio",
	"settings.myCalloutTypes": "Callout-típusaim",
	"settings.builtInCallouts": "Beépített callout-ok",
	"settings.contextMenu": "Helyi menü",
	"settings.autocomplete": "Automatikus kiegészítés",
	"settings.keyboardShortcuts": "Billentyűparancsok",
	"settings.language": "Nyelv",
	"settings.languageDesc":
		"A Callout Studio megjelenítési nyelve. Alapértelmezés szerint az Obsidian felületi nyelvét követi.",
	"settings.languageAuto": "Automatikus (mint az Obsidian)",
	"settings.importExport": "Importálás / exportálás",
	"settings.import": "Importálás",
	"settings.export": "Exportálás",
	"settings.importDesc":
		"Importálja a Callout Studio adatait egy másik tárból JSON-fájl segítségével.",
	"settings.exportDesc":
		"Mentse el az összes egyéni callout-típust JSON formátumban.",
	"settings.importConflictNotice":
		"{{count}} callout-típus importálva; {{overwritten}} meglévő bejegyzés felülírva.",

	"settings.addNewCallout": "+ callout hozzáadása",

	"settings.noCalloutsNow": "Jelenleg nincs egyéni callout.",

	"settings.editAria": "{{name}} szerkesztése",
	"settings.moreRowActionsAria": "További műveletek a következőhöz: {{name}}",
	"settings.usageInfo": "{{count}} előfordulás {{files}} fájlban",
	"settings.replaceAction": "Csere a tárban",
	"settings.deleteAction": "Törlés",
	"settings.resetAction": "Visszaállítás alapértelmezettre",
	"settings.makeFallbackAction": "Alapértelmezett tartalékstílus használata",

	"settings.colorSwatchAria": "Kiemelés: {{accent}} · Háttér: {{bg}}",
	// Handing a callout to the user's own CSS. Not a statement about the theme —
	// that is derived and has no action — so the wording names the snippet.
	"settings.externalCssAction": "Stílus saját CSS-sel",
	"settings.externalCssStopAction": "A Callout Studio ismét stílust adhat neki",
	// The one label on any row: a callout sitting among the user's own that
	// Callout Studio has nonetheless stopped painting.
	"settings.externalCssTag": "Külső CSS",
	// Settings — callouts the active theme styles
	"settings.themeCalloutsHeading": "A témájából származó callout-ok",
	"settings.themeCalloutsDesc":
		"A(z) {{theme}} biztosítja vagy stílusozza át ezeket, ezért a Callout Studio pontosan úgy hagyja őket, ahogy a témája megrajzolja, és csak Block callout-ként kínálja fel őket. Kétféle itt jelenik meg: a témája által hozzáadott callout-típusok, és azok a beépített callout-ok, amelyek kinézetét lecseréli. A témája által hozzáadott callout-típusok csak addig szerepelnek a listán, amíg az aktív.",
	"settings.themeCalloutsDefaultTheme": "A témája",
	"settings.themePreviewAria":
		'Előnézet: "{{name}}" — nézze meg, hogyan rajzolja meg a témája',
	"settings.clearUsesAction": "Előfordulások törlése a jegyzeteiben",
	"settings.builtInAllThemeStyled":
		"A(z) {{theme}} minden beépített callout-ot átstílusoz, ezért mindegyik fent szerepel, és a Callout Studio nem nyúl hozzájuk. Ha saját tervezésűt szeretne, adjon hozzá egy callout-ot másik azonosítóval.",
	"settings.fallbackCallout": "Alapértelmezett tartalék callout",
	"settings.fallbackCalloutDesc":
		"A tárban fel nem ismert callout-típusok öröklik ennek a callout-nak a stílusát.",

	"settings.globalStyle": "Globális callout-stílus",
	"settings.border": "Szegélyek",
	"settings.borderAll": "Mind",
	"settings.borderTop": "Felül",
	"settings.borderRight": "Jobb",
	"settings.borderBottom": "Alul",
	"settings.borderLeft": "Bal",
	"settings.borderWidth": "Szegélyvastagság",
	"settings.fontScaleGroup": "Betűméret-arány",
	"settings.titleScale": "Cím",
	"settings.contentScale": "Tartalom",
	"settings.inlineTextScale": "Szöveg",
	"settings.shapeGroup": "Alak",
	"settings.borderRadius": "Sarokkerekítés",
	"settings.alignGroup": "Igazítás",
	"settings.alignContent": "Tartalom igazítása a címhez",
	"settings.headingSpacingGroup": "Címtérköz",
	"settings.headingPadVertical": "Függőleges térköz",
	"settings.headingGap": "Térköz a címsorok között",
	"settings.headingFoldGroup": "Összecsukás",
	"settings.headingFoldArrow": "Összecsukási nyíl megjelenítése",
	"settings.styleDemoName": "Minta",
	"settings.previewTitle": "Előnézet",

	// Settings — Saved color palettes
	"settings.customPalettes": "Mentett színpaletták",
	"settings.newPalette": "Új paletta",
	"settings.customPalettesEmpty": "Jelenleg nincs mentett paletta.",
	"settings.editPaletteAria": "{{name}} paletta szerkesztése",
	"settings.deletePaletteAria": "{{name}} paletta törlése",
	"settings.deletePaletteConfirm":
		'"{{name}}" paletta törlése?\nAz ezt a színt használó callout-ok nem változnak.',
	"settings.enableAutocomplete": "[! Automatikus kiegészítés engedélyezése",
	"settings.enableAutocompleteDesc":
		'Javaslatokat jelenít meg, amikor "[!" szöveget gépel egy blokkidézet-belsejébe a szerkesztőben. Válasszon callout-típust a listából egy teljes callout fejléc beillesztéséhez.',

	"settings.customCommands": "Parancsok és billentyűparancsok",
	"settings.customCommandsDesc":
		"Tekintse meg az összes Callout Studio parancsot és a hozzájuk rendelt billentyűparancsot, valamint hozzon létre saját parancsokat a leggyakrabban használt callout-okhoz. Alapértelmezés szerint nincs hozzárendelt billentyűparancs.",
	"settings.customCommandsButton": "Parancsok kezelése",

	"commandBuilder.title": "Parancsok és billentyűparancsok",
	"commandBuilder.desc":
		"Használja a + gombot billentyűparancs beállításához vagy módosításához az Obsidian billentyűparancs-beállításaiban.",
	"commandBuilder.builtIn": "Beépített parancsok",
	"commandBuilder.toggleAria": "{{name}} be- vagy kikapcsolása",
	"commandBuilder.hotkeyBlank": "Üres",
	"commandBuilder.hotkeyAria": "Billentyűparancs beállítása ehhez: {{name}}",
	"commandBuilder.yourCommands": "Saját parancsai",
	"commandBuilder.newCommand": "Új parancs",
	"commandBuilder.empty": "Még nincsenek egyéni parancsok.",
	"commandBuilder.unknownCommand": "ez a parancs",
	"commandBuilder.editAria": "{{name}} szerkesztése",
	"commandBuilder.deleteAria": "{{name}} törlése",
	"commandBuilder.deleteConfirm":
		"Törli a(z) {{name}} parancsot? A hozzárendelt billentyűparancs megszűnik működni.",
	"commandBuilder.newTitle": "Új parancs",
	"commandBuilder.editTitle": "Parancs szerkesztése",
	"commandBuilder.format": "Callout formátum",
	"commandBuilder.formatDesc": "Milyen típusú callout-ot ír be a parancs.",
	"commandBuilder.formatHeading": "Címsor",
	"commandBuilder.formatInline": "Beágyazott",
	"commandBuilder.formatBlock": "Block",
	"commandBuilder.roleDisabled":
		"Ez a formátum ki van kapcsolva, ezért a parancs egyszerű szöveget szúr be, amíg vissza nem kapcsolja.",
	"commandBuilder.roleThemeOwned":
		"A témája biztosítja ezt a callout-ot, ezért csak Block formátuma van.",
	"commandBuilder.commandSuspended":
		"Szüneteltetve: a témája biztosítja ezt a callout-ot, ezért csak Block formátuma van. Ez a parancs újra működik, ha a téma már nem biztosítja.",
	"commandBuilder.callout": "Callout típus",
	"commandBuilder.calloutDesc": "A callout, amelyet ez a parancs beszúr.",
	"commandBuilder.headingLevel": "Címsorszint",
	"commandBuilder.headingLevelDesc": "Melyik címsorszintet írja be.",
	"commandBuilder.action": "Művelet",
	"commandBuilder.actionDesc":
		"A becsomagolás callout-tá alakítja a kijelölést; a beszúrás egy üreset ad hozzá.",
	"commandBuilder.actionWrap": "Kijelölés becsomagolása",
	"commandBuilder.actionInsert": "Új beszúrása",
	"commandBuilder.preview": "Parancs neve",
	"commandBuilder.duplicate":
		"Már van egy parancsa, amely pontosan ezt teszi.",
	"commandBuilder.noCallouts":
		"Még nincs callout-típus, amiből parancsot lehetne készíteni.",
	"commandBuilder.save": "Mentés",

	"settings.vaultMaintenance": "Tár-elemzések és karbantartás",
	"settings.vaultStats": "Callout-statisztikák",
	"settings.vaultStatsDesc":
		"Megszámolja a Markdown-jegyzetekben található összes callout-ot — blokk, cím és beágyazott — és típusonként csoportosítja.",
	"settings.vaultStatsButton": "Statisztikák megtekintése",
	"settings.vaultStatsScanning": "Szkennelés",
	"settings.resetAll": "Visszaállítás",
	"settings.resetAllDesc":
		"Törli az összes felhasználói callout-ot, visszaállítja a beépített callout-okat, a globális stílusokat (szegélyek, betűméret-arány, alak), a mentett színpalettákat, a jobb gombos menü testreszabását és a letöltött Material SVG-ket.",
	"settings.resetAllButton": "Mindent visszaállít",
	"settings.resetAllConfirm":
		"Ez törli az összes egyéni callout-ot, visszaállítja a beépített callout-okat, a globális stílusokat, a mentett színpalettákat, a jobb gombos menü testreszabását és az összes gyorsítótárazott Material SVG-t. Ez a művelet nem vonható vissza. Biztos benne?",
	"notice.resetAllDone": "Minden visszaállt az alapértelmezettekre.",

	"notice.customCommandsRemoved":
		"{{count}} egyéni parancs eltávolítva, amelyek callout-típusa már nem létezik.",
	"notice.customCommandMissingCallout":
		"Ennek a parancsnak a callout-típusa már nem létezik.",

	"notice.exported": "A callout-ok exportálva: callout-studio-export.json",
	"notice.importedJSON": "{{count}} callout-típus importálva JSON-ból.",
	"notice.importedSettings": "A bővítmény beállításai importálva.",
	"notice.importedCalloutManager":
		"Importálva a Callout Managerből: {{created}} létrehozva, {{updated}} frissítve.",
	"notice.importedAdmonition":
		"Importálva az Admonitionből: {{created}} létrehozva, {{updated}} " +
		"frissítve.",
	"notice.noNewJSON":
		"Nem importáltunk új callout-típust (az azonosítók már létezhetnek).",
	"notice.iconDownloadFailed":
		'A "{{name}}" Material ikon letöltése nem sikerült. Lehet, hogy ez a stílus/vastagság nem érhető el, vagy nincs internetkapcsolata.',
	"notice.externalCssOn":
		'A Callout Studio többé nem stílusozza a(z) "{{name}}"-t — a saját CSS-e dönti el, hogyan néz ki. A Címsor callout és a Beágyazott callout formája nem jelenik meg.',
	"notice.externalCssOff": 'A Callout Studio ismét stílust ad a(z) "{{name}}"-nek.',
	"notice.nothingToWrap": "Nincs mit becsomagolni.",
	"notice.cursorNotInsideCallout": "A kurzor nem callout-on belül van.",
	"notice.autocompleteTargetMoved":
		"Semmi nem lett beszúrva — a sor megváltozott, amíg a szerkesztő nyitva volt.",
	"notice.openHotkeysFailed":
		"Az Obsidian billentyűparancs-beállításai nem nyithatók meg.",
	"notice.filterHotkeysFailed":
		"Az Obsidian billentyűparancsai megnyíltak, de a Callout Studio szűrő nem alkalmazható.",

	"editor.editCallout": "Callout szerkesztése",
	"editor.newCallout": "Új callout",
	"editor.displayName": "Megjelenítési név",
	"editor.displayNameDesc":
		"A felhasználói felületen megjelenő olvasható felirat",
	"editor.displayNameBuiltIn":
		"A beépített callout-ok megjelenítési neve nem módosítható",
	"editor.displayNamePlaceholder": "Saját callout",
	"editor.calloutIds": "Callout-azonosítók",
	"editor.calloutIdsDesc":
		"Ennek a callout-nak az összes azonosítója. A szóközök engedélyezettek.\nNyomja meg az Enter billentyűt vagy a + gombot a hozzáadáshoz.",
	"editor.calloutIdsPlaceholder": "Azonosító hozzáadása",
	"editor.addId": "Azonosító hozzáadása",
	"editor.idLinkedToName": "A megjelenítési névhez kapcsolva",
	"editor.idCannotDelete":
		"Ez az azonosító a megjelenítési névhez van kapcsolva, és nem törölhető — a módosításhoz szerkessze a nevet",
	"editor.icon": "Ikon",
	"editor.pickIcon": "Ikon módosítása",
	"editor.replaceIcon": "Ikon cseréje",
	"editor.removeIcon": "Ikon eltávolítása",
	"editor.noIcon": "Nincs ikon",
	"editor.resetIcon": "Ikon visszaállítása alapértelmezettre",
	"editor.livePreview": "Élő előnézet",
	"editor.iconAdjustment": "Ikon igazítása",
	"editor.picture": "Kép",
	"editor.size": "Méret",
	"editor.horizontalOffset": "Vízszintes eltolás",
	"editor.verticalOffset": "Függőleges eltolás",
	"editor.colors": "Színek",
	"editor.colorsDesc":
		"Sets this callout's border, background, and text colors.",
	"editor.resetColors": "Színek visszaállítása alapértelmezettre",
	"editor.paletteDeleted": "Törölt szín",
	"editor.paletteGroupObsidian": "Obsidian callout-ok",
	"editor.paletteGroupPresets": "Szín-előbeállítások",
	"editor.paletteGroupCustom": "Egyéni",
	"editor.paletteNewColor": "Új szín…",
	"editor.contrastWarning":
		"Alacsony kontraszt a háttérrel szemben — nehezen olvasható lehet",
	"editor.foldable": "Összecsukható",
	"editor.foldableDesc":
		"Válassza meg, hogy a callout összecsukható-e, és milyen alapértelmezett állapot vonatkozzon az egész tárra.",
	"editor.foldOff": "Ki",
	"editor.foldOpen": "Alapértelmezetten nyitva",
	"editor.foldClosed": "Alapértelmezetten zárva",
	"editor.cancel": "Mégse",
	"editor.saveChanges": "Változtatások mentése",
	"editor.createCallout": "Callout létrehozása",
	"editor.nameRequired":
		"Callout létrehozása előtt megjelenítési név szükséges.",
	"editor.noChangesToSave": "Nem történt változtatás.",
	"editor.downloadingIcon": "Ikon letöltése",
	"editor.idEmpty": "Legalább egy azonosító szükséges",
	"editor.idExists": "Már létezik callout ezzel az azonosítóval",
	"editor.idConflict": "Ez az azonosító ütközik egy meglévő callout-tal",
	"editor.idFromTheme":
		"A(z) {{theme}} már biztosít egy callout-ot ezzel az azonosítóval, ezért a Callout Studio nem tudja stílusozni. Válasszon másik azonosítót.",
	"editor.idThemePattern":
		"Figyelem: a témája minden, a(z) {{pattern}}-nak megfelelő callout-ot stílusoz, ezért felülírhatja ennek a kinézetét.",
	"editor.idDashConflict":
		"Az Obsidian a szóközöket kötőjelként írja, ezért ez az azonosító ütközik ezzel: „{{other}}”",
	"editor.untitledCallout": "Névtelen callout",
	"editor.loremIpsum":
		"Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
	"editor.loremIpsumShort":
		"Lorem ipsum dolor sit amet, consectetur adipiscing elit.",
	"editor.sampleInlineText":
		"Íme egy soron belüli [!{id}] pirula egy bekezdésen belül.",
	"editor.previewReadOnly": "Az élő előnézet nem szerkeszthető",

	// Theme callout preview window — opens instead of the editor for a callout
	// the active theme supplies or restyles.
	"themePreview.title": 'A(z) {{name}} — a témája biztosítja',
	"themePreview.owned":
		'A(z) {{theme}} biztosítja és stílusozza a(z) "{{name}}"-t. A Callout Studio nem írja felül, ezért a Block callout-ja pontosan úgy néz ki, ahogy a témája megrajzolja.',
	"themePreview.readOnly":
		"Ez azt jelenti, hogy a színe, ikonja, neve és azonosítója itt nem módosítható. Ha saját tervezésűt szeretne, hozzon létre egy új callout-ot másik azonosítóval.",
	"themePreview.blockOnly":
		"A Címsor és a Beágyazott formátum nem elérhető a témája által biztosított callout-oknál. A Block callout-ok a téma natív stílusát használják.",
	"themePreview.previewTitle": "Hogyan jelenik meg most",
	"themePreview.blockSample":
		"> [!{{id}}] {{name}}\n" +
		"> Így néz ki a callout tartalma.\n",

	// External style window (opens instead of the editor for a callout the
	// user handed to their theme / a CSS snippet)
	"editor.externalStyleClose": "Értem",

	// Palette editor modal
	"palette.newTitle": "Új színpaletta",
	"palette.groupPalette": "Paletta",
	"palette.editTitle": "Színpaletta szerkesztése",
	"palette.name": "Név",
	"palette.namePlaceholder": "Saját paletta",
	"palette.nameExists": "Már létezik paletta ezzel a névvel",
	"palette.baseColor": "Alapszín",
	"palette.baseColorHint":
		"Automatikusan hozzá igazítjuk a háttérszínt. Ha szeretné, külön is beállíthatja a(z) {{link}} lehetőséggel.",
	"palette.baseColorHintLink": "ide kattintva",
	"palette.advancedColors": "Színek",
	"palette.advancedColorsHint":
		"A(z) {{mode}} mód színeinek szerkesztése – a másik mód automatikusan frissül. Váltson Obsidian témát az ellenőrzéshez.",
	"palette.revertHint": "Inkább egyetlen alapszínt szeretne? {{link}}.",
	"palette.revertHintLink": "Visszaállítás",
	"palette.lightMode": "Világos",
	"palette.darkMode": "Sötét",
	"palette.accentColor": "Kiemelőszín",
	"palette.backgroundColorChannel": "Háttérszín",
	"palette.textColorChannel": "Szövegszín",
	"palette.bgIntensity": "Intenzitás",
	"palette.bgStyle": "Stílus",
	"palette.bgSolid": "Egyszínű",
	"palette.bgGradient": "Színátmenet",
	"palette.bgTransparent": "Átlátszó",
	"palette.gradientTo": "Második szín",
	"palette.gradientDirection": "Irány",
	"palette.gradientText": "Címszöveg színátmenettel",
	"palette.save": "Mentés",

	// Color name suggestions (used to prefill palette names)
	"colorName.red": "Piros",
	"colorName.orange": "Narancs",
	"colorName.amber": "Borostyán",
	"colorName.yellow": "Sárga",
	"colorName.lime": "Lime",
	"colorName.green": "Zöld",
	"colorName.teal": "Petróleumkék",
	"colorName.cyan": "Cián",
	"colorName.sky": "Égkék",
	"colorName.blue": "Kék",
	"colorName.indigo": "Indigó",
	"colorName.violet": "Ibolya",
	"colorName.purple": "Lila",
	"colorName.pink": "Rózsaszín",
	"colorName.rose": "Rózsa",
	"colorName.brown": "Barna",
	"colorName.gray": "Szürke",
	"colorName.black": "Fekete",
	"colorName.white": "Fehér",
	"colorName.crimson": "Karmazsinvörös",
	"colorName.coral": "Korall",
	"colorName.grape": "Szőlő",
	"colorName.plum": "Szilva",
	"colorName.bubblegum": "Rágógumi",

	"iconPicker.pickIcon": "Ikon kiválasztása",
	"iconPicker.confirm": "Megerősítés",
	"iconPicker.cancel": "Mégse",
	"iconPicker.lucide": "Lucide",
	"iconPicker.tabler": "Tabler Icons",
	"iconPicker.material": "Material",
	"iconPicker.emoji": "Emoji",
	"iconPicker.searchLucide": "Lucide ikonok keresése",
	"iconPicker.searchTabler": "Tabler ikonok keresése",
	"iconPicker.tablerStyle": "Ikon stílusa",
	"iconPicker.tablerStyleOutline": "Kontúr (Outline)",
	"iconPicker.tablerStyleFilled": "Kitöltött (Filled)",
	"iconPicker.loadMore": "Több betöltése",
	"iconPicker.materialStyle": "Ikon stílusa",
	"iconPicker.materialStyleOutlined": "Körvonalazott (Outlined)",
	"iconPicker.materialStyleFilled": "Kitöltött (Filled)",
	"iconPicker.materialStyleRounded": "Lekerekített (Rounded)",
	"iconPicker.materialStyleSharp": "Éles (Sharp)",
	"iconPicker.materialWeight": "Ikon vastagsága",
	"iconPicker.materialWeight100": "Vékony (Thin)",
	"iconPicker.materialWeight200": "Extra könnyű (Extra Light)",
	"iconPicker.materialWeight300": "Könnyű (Light)",
	"iconPicker.materialWeight400": "Normál (Regular)",
	"iconPicker.materialWeight500": "Közepes (Medium)",
	"iconPicker.materialWeight600": "Félkövér (Semi Bold)",
	"iconPicker.materialWeight700": "Kövér (Bold)",
	"iconPicker.materialFontFailed":
		"A Material ikonok előnézeteit nem sikerült betölteni. Ehelyett az ikonok nevei látszanak — a keresés és a kiválasztás továbbra is működik.",
	"iconPicker.materialFontRetry": "Próbáld újra",
	"iconPicker.searchMaterial": "Material ikonok keresése",
	"iconPicker.searchEmoji": "Emoji keresése",
	"iconPicker.skinTone": "Bőrtónus",
	"iconPicker.allCategories": "Összes kategória",
	"iconPicker.noIconSelected": "Nincs ikon kiválasztva",
	"iconPicker.noResults": "Egyetlen ikon sem egyezik a keresésre.",
	"iconPicker.octicons": "Octicons",
	"iconPicker.searchOcticons": "Keresés az Octicons-ban",
	"iconPicker.fa": "Font Awesome",
	"iconPicker.searchFa": "Keresés a Font Awesome-ban",
	"iconPicker.faStyle": "Ikon stílusa",
	"iconPicker.faStyleSolid": "Tömör (Solid)",
	"iconPicker.faStyleRegular": "Normál (Regular)",
	"iconPicker.faStyleBrands": "Márkák (Brands)",
	"iconPicker.rpgAwesome": "RPG Awesome",
	"iconPicker.searchRpgAwesome": "Keresés az RPG Awesome-ban",
	"iconPicker.image": "Saját képek",
	"iconPicker.searchImage": "Keresés a képek között",
	"iconPicker.imageTooLarge":
		"{{name}} túl nagy. A képeknek 5 MB alatt kell lenniük.",
	"iconPicker.imageUnsupported":
		"{{name}} nem támogatott képformátum. Használjon SVG, PNG, JPEG vagy WebP formátumot.",
	"iconPicker.imageInvalidSvg":
		"{{name}} nem olvasható biztonságos SVG-ként, ezért nem lett hozzáadva.",
	"iconPicker.imageDecodeFailed": "{{name}} nem olvasható képként.",
	"iconPicker.imageDuplicate":
		"{{name}} már szerepel a képei között. Nevezze át a fájlt, vagy törölje a meglévő képet.",
	"iconPicker.imageAdd": "Képek hozzáadása",
	"iconPicker.imageEmpty":
		"Még nincsenek képek. Adjon hozzá SVG, PNG, JPEG vagy WebP fájlt a számítógépéről, vagy húzza ide.",
	"iconPicker.imageDelete": "Törlés",
	"iconPicker.imageDeleteConfirm": "„{{name}}” törlése?",
	"iconPicker.imageDeleteInUse":
		"{{count}} callout használja ezt a képet. Helyőrző ikont fognak megjeleníteni, amíg nem ad meg egy újat.",
	"iconPicker.imageRecolor": "Callout szín követése",
	"iconPicker.allSources": "Minden forrás",
	"iconPicker.searchAllSources": "Keresés az összes ikonforrásban",
	"iconPicker.sourcesNotDownloaded":
		"Még nem tartalmazza: {{names}}. Válasszon fent egy forrást a letöltéshez.",
	"iconPicker.chooseSource": "Forrás kiválasztása",
	"iconPicker.sourceGroup": "{{name}} · {{count}}",

	// Source menu — what each library holds, in a few words
	"iconPicker.descAllSources": "egyszerre keresés az összes könyvtárban",
	"iconPicker.descLucide": "Az Obsidian saját készlete, mindig offline",
	"iconPicker.descTabler":
		"tiszta és következetes UI ikonok, kontúr és kitöltött",
	"iconPicker.descMaterial":
		"A Google készlete, négy stílus és hét vastagság",
	"iconPicker.descEmoji": "színes glífák, minden bőrtónus",
	"iconPicker.descOcticons": "GitHub felületi ikonjai",
	"iconPicker.descFa": "tömör, normál és márkák",
	"iconPicker.descRpgAwesome": "fantasy és asztali játék ikonok",
	"iconPicker.descImage": "képek, amelyeket a számítógépéről ad hozzá",

	// Icon picker — category filter dropdown labels
	"iconPicker.cat.Accessibility": "Akadálymentesség",
	"iconPicker.cat.Actions": "Műveletek",
	"iconPicker.cat.Activities": "Tevékenységek",
	"iconPicker.cat.Alert": "Figyelmeztetés",
	"iconPicker.cat.Alphabet": "Ábécé",
	"iconPicker.cat.Android": "Android",
	"iconPicker.cat.Animals": "Állatok",
	"iconPicker.cat.Arrows": "Nyilak",
	"iconPicker.cat.Astronomy": "Csillagászat",
	"iconPicker.cat.Audio&Video": "Hang és videó",
	"iconPicker.cat.Automotive": "Autók",
	"iconPicker.cat.Badges": "Jelvények",
	"iconPicker.cat.Brand": "Márkák",
	"iconPicker.cat.Buildings": "Épületek",
	"iconPicker.cat.Business": "Üzlet",
	"iconPicker.cat.Camping": "Kemping",
	"iconPicker.cat.Charity": "Jótékonyság",
	"iconPicker.cat.Charts": "Diagramok",
	"iconPicker.cat.Charts + Diagrams": "Diagramok és ábrák",
	"iconPicker.cat.Childhood": "Gyermekkor",
	"iconPicker.cat.Clothing + Fashion": "Ruha és divat",
	"iconPicker.cat.Coding": "Programozás",
	"iconPicker.cat.Communicate": "Kommunikáció",
	"iconPicker.cat.Communication": "Kommunikáció",
	"iconPicker.cat.Computers": "Számítógépek",
	"iconPicker.cat.Connectivity": "Kapcsolódás",
	"iconPicker.cat.Construction": "Építkezés",
	"iconPicker.cat.Currencies": "Valuták",
	"iconPicker.cat.Database": "Adatbázis",
	"iconPicker.cat.Design": "Tervezés",
	"iconPicker.cat.Development": "Fejlesztés",
	"iconPicker.cat.Devices": "Eszközök",
	"iconPicker.cat.Devices + Hardware": "Eszközök és hardver",
	"iconPicker.cat.Disaster + Crisis": "Katasztrófák és válságok",
	"iconPicker.cat.Document": "Dokumentum",
	"iconPicker.cat.E-commerce": "E-kereskedelem",
	"iconPicker.cat.Editing": "Szerkesztés",
	"iconPicker.cat.Education": "Oktatás",
	"iconPicker.cat.Electrical": "Elektromos",
	"iconPicker.cat.Emoji": "Emoji",
	"iconPicker.cat.Energy": "Energia",
	"iconPicker.cat.Extensions": "Bővítmények",
	"iconPicker.cat.Files": "Fájlok",
	"iconPicker.cat.Film + Video": "Film és videó",
	"iconPicker.cat.Food": "Étel",
	"iconPicker.cat.Food + Beverage": "Étel és ital",
	"iconPicker.cat.Fruits + Vegetables": "Gyümölcsök és zöldségek",
	"iconPicker.cat.Games": "Játékok",
	"iconPicker.cat.Gaming": "Gaming",
	"iconPicker.cat.Gender": "Nem",
	"iconPicker.cat.Genders": "Nemek",
	"iconPicker.cat.Gestures": "Gesztusok",
	"iconPicker.cat.Halloween": "Halloween",
	"iconPicker.cat.Hands": "Kezek",
	"iconPicker.cat.Hardware": "Hardver",
	"iconPicker.cat.Health": "Egészség",
	"iconPicker.cat.Holidays": "Ünnepnapok",
	"iconPicker.cat.Home": "Otthon",
	"iconPicker.cat.Household": "Háztartás",
	"iconPicker.cat.Humanitarian": "Humanitárius",
	"iconPicker.cat.Images": "Képek",
	"iconPicker.cat.Laundry": "Mosás",
	"iconPicker.cat.Letters": "Betűk",
	"iconPicker.cat.Logic": "Logika",
	"iconPicker.cat.Logistics": "Logisztika",
	"iconPicker.cat.Map": "Térkép",
	"iconPicker.cat.Maps": "Térképek",
	"iconPicker.cat.Maritime": "Tengeri",
	"iconPicker.cat.Marketing": "Marketing",
	"iconPicker.cat.Math": "Matematika",
	"iconPicker.cat.Mathematics": "Matematika",
	"iconPicker.cat.Media": "Média",
	"iconPicker.cat.Media Playback": "Média lejátszás",
	"iconPicker.cat.Medical + Health": "Orvosi és egészség",
	"iconPicker.cat.Money": "Pénz",
	"iconPicker.cat.Mood": "Hangulat",
	"iconPicker.cat.Moving": "Költözés",
	"iconPicker.cat.Music + Audio": "Zene és hang",
	"iconPicker.cat.Nature": "Természet",
	"iconPicker.cat.Numbers": "Számok",
	"iconPicker.cat.Photography": "Fényképezés",
	"iconPicker.cat.Photos + Images": "Fotók és képek",
	"iconPicker.cat.Political": "Politikai",
	"iconPicker.cat.Privacy": "Adatvédelem",
	"iconPicker.cat.Punctuation + Symbols": "Írásjelek és szimbólumok",
	"iconPicker.cat.Religion": "Vallás",
	"iconPicker.cat.Science": "Tudomány",
	"iconPicker.cat.Science Fiction": "Sci-fi",
	"iconPicker.cat.Security": "Biztonság",
	"iconPicker.cat.Shapes": "Alakzatok",
	"iconPicker.cat.Shopping": "Vásárlás",
	"iconPicker.cat.Social": "Közösségi média",
	"iconPicker.cat.Spinners": "Töltők",
	"iconPicker.cat.Sport": "Sport",
	"iconPicker.cat.Sports + Fitness": "Sport és fitness",
	"iconPicker.cat.Symbols": "Szimbólumok",
	"iconPicker.cat.System": "Rendszer",
	"iconPicker.cat.Text": "Szöveg",
	"iconPicker.cat.Text Formatting": "Szövegformázás",
	"iconPicker.cat.Time": "Idő",
	"iconPicker.cat.Toggle": "Kapcsoló",
	"iconPicker.cat.Transit": "Tranzit",
	"iconPicker.cat.Transportation": "Közlekedés",
	"iconPicker.cat.Travel": "Utazás",
	"iconPicker.cat.Travel + Hotel": "Utazás és szálloda",
	"iconPicker.cat.UI actions": "Felhasználói felület műveletek",
	"iconPicker.cat.Users + People": "Felhasználók és emberek",
	"iconPicker.cat.Vehicles": "Járművek",
	"iconPicker.cat.Version control": "Verziókövetés",
	"iconPicker.cat.Weather": "Időjárás",
	"iconPicker.cat.Writing": "Írás",
	"iconPicker.cat.Zodiac": "Állatöv",

	// Downloadable icon packs
	"iconPack.downloadTitle": "{{name}} még nincs letöltve",
	"iconPack.downloadDetail": "{{count}} ikon · {{size}} · egyszeri letöltés",
	"iconPack.download": "Letöltés",
	"iconPack.downloading": "{{name}} letöltése…",
	"iconPack.downloadFailed":
		"{{name}} nem tölthető le. Ellenőrizze a kapcsolatot, majd próbálja újra.",
	"iconPack.retry": "Újrapróbálkozás",
	"iconPack.faBrandsNotice":
		"A márka ikonok a megfelelő tulajdonosok védjegyei. Szerepeltetésük nem jelent jóváhagyást. Kérjük, csak az általuk képviselt vállalat, termék vagy szolgáltatás megjelenítésére használja őket.",
	"iconPack.artworkRestored":
		"Az ikonok grafikája letöltve a(z) {{names}} számára.",
	"iconPack.diskWriteFailed":
		"A Callout Studio nem tudta menteni az ikoncsomagot a lemezre, ezért legközelebb újra le kell tölteni. A választott ikonok továbbra is mentve vannak a beállításaiban.",

	// Icon licences & credits
	"credits.title": "Ikon licenszek és köszönet",
	"credits.intro":
		"A Callout Studio számos nyílt ikonkönyvtárra támaszkodik. Licenszeik alább találhatók, a felhasználáshoz szükséges módosításokkal együtt.",
	"credits.fullNotices": "Teljes harmadik féltől származó megjegyzések",
	"credits.pluginLicense":
		"A Callout Studio saját kódja egy permissive licenc alatt áll; az ikonkönyvtárak megőrzik saját licencüket.",

	"contextMenu.editCallout": "Callout-beállítások szerkesztése",
	"contextMenu.copyMarkdown": "Callout Markdown másolása",
	"contextMenu.openSettings": "Callout Studio beállítások megnyitása",
	"contextMenu.setFoldClosed": "Callout beállítása zártra (-)",
	"contextMenu.setFoldOpen": "Callout beállítása nyitottra (+)",
	"contextMenu.setFoldNone": "Callout összecsukhatatlanná tétele",
	"contextMenu.cutSection": "Címsor szakasz kivágása",
	"contextMenu.copySection": "Címsor szakasz másolása",
	"contextMenu.deleteSection": "Címsor szakasz törlése",
	"heading.toggleFold": "Összecsukás váltása",
	"settings.globalSettings": "Callout Studio stílusbeállítások",
	"settings.globalSettingsScope":
		"Alak, térköz és méret a Callout Studio által stílusozott callout-okhoz. A témája által stílusozott callout-ok megtartják a téma saját dizájnját.",
	"settings.globalSettingsRegularDesc":
		"Adjon hozzá egy callout tokent egy idézethez (pl. `> [!type]`), hogy megjelenjen az Obsidian natív callout-doboza. Beállíthatja a szegélyét, a sugarát, a betűméret-arányát és az igazítását.",
	"settings.globalSettingsHeadingDesc":
		"Adjon hozzá egy callout tokent közvetlenül a címsor kettőskeresztjei után (pl. `## [!type]`), hogy stílusos callout-címsorként jelenjen meg. Beállíthatja a szegélyét, az alakját és a függőleges térközét.",
	"settings.globalSettingsInlineDesc":
		"Adjon hozzá egy callout tokent egy szövegsor bármelyik pontján (pl. `[!type]`), hogy kis beágyazott pirulaként jelenjen meg. Beállíthatja a szegélyét és az alakját.",
	"settings.globalSettingsCustomize": "Testreszabás",
	"settings.calloutTypeRegular": "Block callout",
	"settings.calloutTypeHeading": "Címsor callout",
	"settings.calloutTypeInline": "Beágyazott callout",
	"settings.customizeMenu": "Menüelemek testreszabása",
	"settings.customizeMenuDesc":
		"Válassza ki, mely jobb gombos műveletek jelenjenek meg az egyes callout-típusoknál, és rendezze át őket. Forrás módban és élő előnézetben is működik.",
	"settings.customizeMenuButton": "Menüelemek testreszabása",
	"menuCustomize.title": "Jobb gombos menü testreszabása",
	"menuCustomize.desc":
		"Kapcsolja be vagy ki a műveleteket, és húzza a fogantyút az átrendezéshez. A módosítások automatikusan mentésre kerülnek.",
	"menuCustomize.regular": "Block callout",
	"menuCustomize.heading": "Címsor callout",
	"menuCustomize.inline": "Beágyazott callout",
	"menuCustomize.dragHandle": "Húzás az átrendezéshez",
	"menuItem.edit": "Callout szerkesztése",
	"menuItem.openSettings": "Beállítások megnyitása",
	"menuItem.copyMarkdown": "Markdown másolása",
	"menuItem.foldDefaults":
		"Alapértelmezett összecsukási állapot (nyitott / zárt / nincs)",
	"menuItem.cutSection": "Szakasz kivágása",
	"menuItem.copySection": "Szakasz másolása",
	"menuItem.deleteSection": "Szakasz törlése",

	"confirm.ok": "Törlés",
	"confirm.cancel": "Mégse",
	// Headings for each confirmation — every window carries one, so each
	// caller of ConfirmModal names what it is about to do.
	"confirm.titleDeleteCommand": "Parancs törlése",
	"confirm.titleResetAll": "Összes callout visszaállítása",
	"confirm.titleResetCallout": "Callout visszaállítása",
	"confirm.titleDeletePalette": "Paletta törlése",
	"confirm.titleDeleteImage": "Kép törlése",

	"vault.filesUpdated":
		"{{count}} callout-hivatkozás frissítve a tárfájlokban.",
	"vault.idsUpdated":
		"{{count}} callout-azonosító frissítve a tárfájlokban: {{oldIds}} → {{newId}}",
	"vault.titlesUpdated":
		"{{count}} callout-cím frissítve a tárfájlokban: {{oldTitle}} → {{newTitle}}",
	"vault.replaceWith": "Csere erre:",
	"vault.deleteWithout": "Törlés csere nélkül",
	"vault.confirmDelete": "Megerősítés",
	"vault.confirmReplace": "Csere",
	"vault.replacePromptInUse":
		'"{{name}}" {{count}} alkalommal szerepel {{files}} fájlban. Válasszon callout-ot a helyettesítéshez:',
	"vault.replacePromptUnused":
		'Válasszon callout-ot a következő helyettesítéséhez: "{{name}}":',
	"vault.noReplacementAvailable":
		"Nincs más elérhető callout a helyettesítéshez.",
	"vault.convertedToPlainText":
		"{{blocks}} callout-blokk {{files}} fájlban egyszerű szöveggé alakítva.",
	"vault.resetAliasWarning":
		"{{count}} hivatkozás {{files}} fájlban egyéni aliasokat használ: {{aliases}}. Visszaállítás után ezek nem fognak működni. Folytatja?",
	"vault.resetConfirm": "Visszaállítás",
	"vault.resetAllInUse":
		"⚠ {{count}} callout-hivatkozás {{files}} fájlban olyan egyéni callout-típusokat használ, amelyek törlődni fognak.",

	"quickInsert.title": "Blokk callout gyors beszúrása",
	"quickInsert.desc": "Válassz egy callout-ot a kurzor pozíciójába való beszúráshoz. Csak blokk callout-ok.",
	"quickInsert.searchPlaceholder": "Callout-ok keresése",
	"quickInsert.sourceAria": "Szűrés callout forrás szerint",
	"quickInsert.sourceAll": "Összes",
	"quickInsert.sourceBuiltIn": "Beépített",
	"quickInsert.sourceUser": "Saját callout-jaim",
	"quickInsert.editAria": "{{name}} szerkesztése",
	"quickInsert.insertAria": "{{name}} beszúrása blokk callout-ként",
	"quickInsert.noResults": "Nem található callout",
	"quickInsert.noUserCallouts": "Még nem hoztál létre callout-ot.",
	"quickInsert.noEditorHint": "Nincs szerkesztési módban megnyitott jegyzet, ezért semmit sem lehet beszúrni.",
	"quickInsert.noEditor": "Nyiss meg egy jegyzetet szerkesztési módban a callout beszúrásához.",

	"vaultStats.title": "Callout-statisztikák",
	"vaultStats.totalCallouts": "Összes callout",
	"vaultStats.typesFound": "Talált típusok",
	"vaultStats.filesWithCallouts": "Callout-okat tartalmazó fájlok",
	"vaultStats.filesScanned": "Beszkennelt Markdown-fájlok",
	"vaultStats.empty": "Nem található callout a Markdown-jegyzetekben.",
	"vaultStats.columnType": "Típus",
	"vaultStats.columnName": "Név",
	"vaultStats.columnSource": "Forrás",
	"vaultStats.columnCount": "Darab",
	"vaultStats.columnFiles": "Fájlok",
	"vaultStats.unknown": "Ismeretlen",
	"vaultStats.sourceBuiltIn": "Beépített",
	"vaultStats.sourceCustom": "Egyéni",
	"vaultStats.sourceAutoFallback": "Aut. tartalék",
	"vaultStats.sourceTheme": "CSS-részlet",
	"vaultStats.sourceAlias": "{{id}} aliasa",
	"vaultStats.sourceUnknown": "Ismeretlen",
	"vaultStats.byRole": "Íráshelye",
	"vaultStats.roleBlock": "Blokk",
	"vaultStats.roleHeading": "Címsor",
	"vaultStats.roleInline": "Beágyazott",
	"vaultStats.defineUndefined": "{{count}} hiányzó meghatározása",
	"vaultStats.defineRunning": "Vizsgálat",
	"vaultStats.defineDone": "{{count}} callout-típus hozzáadva.",
	"vaultStats.close": "Bezárás",

	"import.title": "Importálási problémák",
	"import.reportLeadIn":
		"Úgy tűnik, az importált fájlt módosították. Íme a problémák listája:",
	"import.reportLeadInFatal":
		"Ez a fájl nem tűnik Callout Studio exportnak. Nem importálható:",
	"import.entryHeading": "Bejegyzés {{index}} — {{label}}",
	"import.summary":
		"{{valid}} / {{total}} bejegyzés érvényes · {{issues}} probléma találva.",
	"import.btnCancel": "Mégse",
	"import.btnImportValid": "Csak érvényesek importálása ({{count}})",
	"import.err.notRecognized":
		"Ismeretlen fájl: callout-definíciók tömbje vagy Callout Studio exportálás volt várható.",
	"import.warn.settingsIgnored":
		"A beállítási blokk nem volt érvényes objektum, ezért figyelmen kívül lett hagyva.",
	"import.warn.invalidGradient":
		"A háttér színátmenete nem volt érvényes, ezért figyelmen kívül lett hagyva.",
	"import.err.parseFailed": "A fájl nem érvényes JSON, és nem elemezhető.",
	"import.err.entryNotObject": "A bejegyzésnek objektumnak kell lennie.",
	"import.err.requiredMissing":
		'A kötelező "{{field}}" mező hiányzik vagy rossz típusú.',
	"import.err.idEmpty": "Az azonosító nem lehet üres.",
	"import.err.idTooLong":
		'A "{{value}}" azonosító {{length}} karakter; a maximum {{max}}.',
	"import.err.idBadChar":
		'A "{{value}}" azonosító érvénytelen karaktereket tartalmaz ("|", "[", "]", tabulátorok és sortörések nem megengedettek).',
	"import.err.idMetadata":
		'A "{{value}}" azonosító "|" karaktert tartalmaz. Az Obsidianban az első "|" utáni minden szöveg callout-metaadat, nem a típus része, ezért ez a bejegyzés a "{{id}}" calloutot írja le. Kihagyva, hogy a meglévő "{{id}}" érintetlen maradjon.',
	"import.err.displayNameEmpty": "A megjelenítési név nem lehet üres.",
	"import.err.displayNameTooLong":
		"A megjelenítési név {{length}} karakter; a maximum {{max}}.",
	"import.err.boolField":
		'"{{field}}" boolean értéknek kell lennie (true vagy false).',
	"import.err.iconNotObject": "Az ikonnak objektumnak kell lennie.",
	"import.err.iconTypeInvalid":
		'Az "{{value}}" ikontípus nem egyike a következőknek: {{types}}.',
	"import.warn.iconFieldIgnored":
		'"{{field}}" csak a Material ikonokra vonatkozik, és a rendszer figyelmen kívül hagyja a(z) {{type}} ikontípus esetén.',
	"import.err.iconValueEmpty":
		"Az ikonértéknek nem üres karakterláncnak kell lennie.",
	"import.err.iconValueTooLong":
		"Az ikonérték szokatlanul hosszú ({{length}} karakter).",
	"import.err.materialStyle":
		'A "{{value}}" Material ikonstílus nem egyike a következőknek: outlined, filled, rounded, sharp.',
	"import.err.materialWeight":
		'A "{{value}}" Material ikonvastagság 100–700 közötti, 100-asával növekvő egész szám kell legyen.',
	"import.warn.iconRecolorIgnored":
		'"recolor" csak a saját képeire vonatkozik, és a rendszer figyelmen kívül hagyja a(z) {{type}} ikontípus esetén.',
	"import.err.iconRecolorInvalid":
		'"recolor" igaz vagy hamis kell legyen (kapott: "{{value}}").',
	"import.err.colorInvalid":
		'"{{field}}" hexadecimális szín kell legyen, pl. "#448aff" (kapott: "{{value}}").',
	"import.err.numberRange":
		'"{{field}}" {{min}} és {{max}} közötti szám kell legyen (kapott: "{{value}}").',
	"import.err.iconSizeRange":
		'"{{field}}" {{min}} és {{max}} közötti szám kell legyen (kapott: "{{value}}").',
	"import.err.iconAdjustShape":
		'"iconAdjust" must be an object mapping a callout type ("regular", "heading", "inline") to its icon size and offsets.',
	"import.err.aliasesNotArray":
		'"aliases" karakterláncok tömbje kell legyen.',
	"import.err.aliasNotString": "Az aliasnak karakterláncnak kell lennie.",
	"import.err.aliasDup":
		'A "{{value}}" alias ismétlődik ezen a bejegyzésen belül.',
	"import.err.tooManyIds":
		"Túl sok azonosító ({{count}}); minden callout-nak legfeljebb {{max}} azonosítója lehet (elsődleges + aliasok).",
	"import.err.metadataShape":
		'"metadata" olyan objektum kell legyen, amelynek minden értéke karakterlánc.',
	"import.warn.unknownFields":
		"Ismeretlen mezők figyelmen kívül hagyva: {{fields}}.",
	"import.err.duplicateInFile":
		'A "{{value}}" azonosítót/aliast a #{{first}} bejegyzés már használja ebben a fájlban.',
	"import.err.aliasConflict":
		'A "{{value}}" aliast egy másik callout ("{{other}}") már használja a tárban.',
	"import.warn.defaultFoldedAutofix":
		'"defaultFolded" true volt, míg "foldable" false volt; a defaultFolded visszaállt false-ra.',
	"import.warn.imageMissing":
		"Ez a Callout olyan képet használ, amely nincs sem a fájlban, sem ebben a vaultban, ezért helyőrző ikont fog megjeleníteni, amíg nem ad meg egy újat.",

	"import.err.paletteIdInvalid":
		'A "paletteId" egy nem üres szöveges azonosítónak kell lennie (kapott: "{{value}}").',
	"import.warn.iconNameUnknown":
		'Nincs "{{value}}" ikon a következőben: {{type}}, ezért az alapértelmezett ikont használtuk.',
	"import.warn.cmIconUnknownNew":
		'A "{{value}}" ikon nem érhető el ebben a vaultban, ezért az alapértelmezett ikont használtuk.',
	"import.warn.cmIconUnknownExisting":
		'A "{{value}}" ikon nem érhető el ebben a vaultban, ezért a "{{id}}" megtartotta a korábban beállított ikont.',
	"import.chooseSource": "Importálás innen",
	"import.sourceStudio": "Callout Studio",
	"import.sourceStudioDesc":
		"Egy Callout Studióból exportált .json fájl betöltése.",
	"import.sourceCalloutManager": "Callout Manager",
	"import.sourceCalloutManagerDesc":
		"Hozd át a testreszabott callout-jaidat a Callout Manager bővítményből.",
	"import.sourceAdmonition": "Admonition",
	"import.sourceAdmonitionDesc":
		"Hozd át a saját admonition-jeidet az Admonition bővítményből.",
	"import.cmTitle": "Importálás a Callout Managerből",
	"import.cmInstructions":
		"Minden testreszabott callout az ikonjával és a színével együtt kerül át. A témánkénti stílusoknak és az egyéni CSS-nek itt nincs megfelelője, ezek nem kerülnek át.",
	"import.cmFromVault": "Ez a vault",
	"import.cmVaultChecking": "Callout Manager bővítmény keresése…",
	"import.cmVaultFound": "{{count}} testreszabott callout található.",
	"import.cmVaultNotFound":
		"Nem található testreszabott callout ebben a vaultban.",
	"import.cmPasteLabel":
		"Vagy illeszd be ide a Callout Manager Copy gombjáról másolt stílusokat:",
	"import.cmPlaceholder":
		"Illeszd be a másolt stílusokat, vagy egy data.json fájlt, ide…",
	"import.cmBtnCancel": "Mégse",
	"import.cmBtnImport": "Importálás",
	"import.err.cmNoBlocksFound":
		"Nem találhatók Callout Manager stílusok a beillesztett szövegben.",
	"import.err.cmNotRecognized":
		"Ismeretlen fájl: a Callout Manager Copy gombja által előállított stílusokat, vagy egy Callout Manager data.json fájlt vártunk.",
	"import.err.cmNoEntries":
		"Nem található importálható, testreszabott callout.",
	"import.err.cmNoColorForNew":
		'Nem található használható szín az új "{{value}}" callouthoz; kihagyva.',
	"import.err.cmIdConflict":
		'A "{{value}}" azonosítót már egy másik callout ("{{other}}") alias-ként használja, ezért kihagyva.',
	"import.warn.cmNoColorDefault":
		"A Callout Managerben nem volt beállítva szín, ezért az alapértelmezett szürkét használtuk.",
	"import.warn.cmThemeCondition":
		"Ennek a callout-nak a színe vagy ikonja csak egy témára volt beállítva. A Callout Studióban nincs témánkénti stílus, ezért minden témára átkerült.",
	"import.warn.cmCustomStyles":
		"Ennek a callout-nak egyéni CSS-e is van a Callout Managerben. Az a stílus nem része az importnak, csak az ikonja és a színe került át.",

	// Import — Admonition
	"import.admTitle": "Importálás az Admonitionből",
	"import.admInstructions":
		"Minden admonition callout lesz, a nevével, ikonjával és színével " +
		"együtt. Azok a beállítások, amelyeknek nincs megfelelője a " +
		"Callout Studióban (parancs, másolás gomb, rejtett cím), nem " +
		"jönnek át.",
	"import.admFromVault": "Ez a tároló",
	"import.admVaultChecking": "Az Admonition bővítmény keresése…",
	"import.admVaultFound": "{{count}} saját admonition található.",
	"import.admVaultNotFound":
		"Ebben a tárolóban nem található saját admonition.",
	"import.admFromFile": "Egy fájl",
	"import.admFromFileDesc":
		"Egy admonitions.json fájl vagy egy megosztott csomag.",
	"import.admChooseFile": "Fájl kiválasztása…",
	"import.admPasteLabel": "Vagy illeszd be ide a JSON-t:",
	"import.admPlaceholder": "Illeszd be ide az admonition-jeidet…",
	"import.admBtnCancel": "Mégse",
	"import.admBtnImport": "Importálás",
	"import.err.admNotRecognized":
		"Ismeretlen fájl: admonition-lista vagy az Admonition data.json " +
		"fájlja volt várható.",
	"import.err.admNoEntries": "Nem található importálható admonition.",
	"import.err.admTypeMissing":
		'Ennek az admonitionnek nincs "type" mezője, ezért kimaradt.',
	"import.warn.admIconUnknown":
		'Egyik ikonkönyvtárban sincs "{{value}}" nevű ikon, ezért az ' +
		"alapértelmezett ikon került a helyére.",
	"import.warn.admIconUnknownExisting":
		'Egyik ikonkönyvtárban sincs "{{value}}" nevű ikon, ezért a(z) ' +
		'"{{id}}" megtartotta a korábbi ikonját.',
	"import.warn.admImageFailed":
		"A feltöltött kép nem volt olvasható, ezért az alapértelmezett " +
		"ikon került a helyére.",
	"import.warn.admIconWithCss":
		"Ezt az admonitiont egy CSS-részlet formázza az Admonitionben. Ez " +
		"a formázás nem része az importnak, így csak a neve, ikonja és " +
		"színe jött át.",
	"import.warn.admNoColor":
		"Nem volt szín beállítva, ezért az alapértelmezett kék került a " +
		"helyére.",
	"import.warn.admTitleTruncated":
		"A cím {{length}} karakter; {{max}} karakterre rövidült.",

	"footer.tagline":
		"Van visszajelzése, megjegyzése vagy javaslata? Szívesen meghallgatom!",
	"footer.madeBy": "Készítette: Niv  •  ",
	"settings.deletePaletteConfirmLinkedOne":
		'Törli a(z) "{{name}}" palettát?\n1 callout használja. Megtartja a színeit, és később újra összekapcsolhatod a szerkesztőjében a Szín sorból.',
	"settings.deletePaletteConfirmLinked":
		'Törli a(z) "{{name}}" palettát?\n{{count}} callout használja. Megtartják a színeiket, és később újra összekapcsolhatod őket bármelyik szerkesztőjük Szín sorából.',
	"settings.unlinkedColors": "Nem kapcsolt színek",
	"settings.unlinkedColorsDesc":
		"Olyan calloutok, amelyeknek a mentett színe törölve lett. Megtartják a korábbi színeiket; a visszaállítás újra elmenti a színt és újrakapcsolja az egész csoportot.",
	"settings.unlinkedColorOne": "1 callout",
	"settings.unlinkedColorCount": "{{count}} callout",
	"settings.restoreColor": "Visszaállítás",
	"settings.palettesMergedNotice":
		"{{count}} importált paletta összevonva olyan mentett színekkel, amelyek már ugyanazokat a színeket használták.",
	"notice.palettesMerged":
		"{{count}} azonos színű mentett szín összevonva: {{names}}. Az ezeket használó calloutok megtartják a színeiket, és most a megmaradt színhez kapcsolódnak.",
	"editor.colorsDescDeleted":
		"Ennek a calloutnak a mentett színe törölve lett. Újra elmentheted {{link}}.",
	"editor.colorsDescDeletedOther":
		"Ennek a calloutnak a mentett színe törölve lett. Újra elmentheted {{link}} — 1 másik, ezt használó callout is újra kapcsolódik.",
	"editor.colorsDescDeletedOthers":
		"Ennek a calloutnak a mentett színe törölve lett. Újra elmentheted {{link}} — {{count}} másik, ezt használó callout is újra kapcsolódik.",
	"editor.colorsDescDeletedLink": "ide kattintva",
	"palette.colorExists":
		'Ezek a színek megegyeznek ezzel: "{{name}}". Két mentett szín nem lehet ugyanaz — módosíts egy színt, hogy megkülönböztesd őket.',
	"palette.colorExistsUse":
		'Ezek a színek megegyeznek ezzel: "{{name}}". Két mentett szín nem lehet ugyanaz — módosíts egy színt, vagy {{link}}.',
	"palette.colorExistsUseLink": "használd a meglévőt",
	"locale.downloading": "Fordítás letöltése…",
	"locale.notDownloaded": "A(z) {{name}} még nincs letöltve",
	"locale.notDownloadedDesc":
		"A Callout Studio angolul jelenik meg, amíg a fordítás letölthetővé nem válik. Az Obsidian következő indításakor újra próbálkozik.",
	"locale.retry": "Újrapróbálkozás",
	"locale.diskWriteFailed":
		"A Callout Studio nem tudta lemezre menteni a fordítást, ezért legközelebb újra le kell tölteni.",
	"notice.exportedCssCreated": "A CSS-részlet mentve ide: {{path}}",
	"notice.exportedCssUpdated": "A CSS-részlet frissítve itt: {{path}}",
	"notice.exportedCssUnchanged": "A CSS-részlet már naprakész.",
	"notice.exportCssEmpty": "Nincs exportálható egyéni callout.",
	"notice.exportCssFailed":
		"A CSS-részlet mentése nem sikerült. Részletekért nézd meg a fejlesztői konzolt.",
	"notice.exportCssEnabled":
		"Ez a részlet engedélyezve van ebben a vaultban. A Callout Studio már formázza ezeket a calloutokat, a részlet pedig az exportáláskori stílust őrzi.",
	"confirm.titleOverwriteSnippet": "CSS-részlet felülírása",
	"confirm.overwriteSnippet":
		"A snippets mappában lévő CSS-részlet megváltozott azóta, hogy a Callout Studio létrehozta. Az újbóli exportálás a teljes fájlt lecseréli.",
	"confirm.overwriteSnippetOk": "Felülírás",
	"export.chooseFormat": "Exportálás mint",
	"export.formatJson": "Callout Studio biztonsági mentés",
	"export.formatJsonDesc":
		".json fájl a calloutokkal és beállításokkal, másik vaultba való importáláshoz.",
	"export.formatCss": "CSS-részlet",
	"export.formatCssDesc":
		".css fájl a vault snippets mappájában való használatra ott, ahol a Callout Studio nincs telepítve. Csak a normál calloutokat fedi le, és pillanatkép; módosítás után exportáld újra.",
	"quickInsert.readingViewHint": "Ez a jegyzet olvasó módban van megnyitva, ezért semmit sem lehet beszúrni.",
	"quickInsert.readingView": "Váltson forrás módra vagy élő előnézetre a callout beszúrásához.",
	"quickInsert.noCursorHint": "Ebben a jegyzetben nincs kurzor, ezért nincs hova beszúrni.",
	"quickInsert.noCursor": "Helyezze a kurzort a jegyzetben oda, ahová be szeretné szúrni a callout-ot, majd próbálja újra.",
};
