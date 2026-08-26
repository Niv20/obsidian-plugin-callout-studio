export const fi: Record<string, string> = {
	"cmd.openSettings": "Avaa asetukset",
	"cmd.createCallout": "Luo uusi callout-tyyppi",
	"cmd.insertEmptyCallout": "Lisää tyhjä callout",
	"cmd.calloutWrap": "Kääri calloutiin",
	"cmd.calloutUnwrap": "Poista callout",
	"cmd.customWrapBlock": "Kääri {{name}}-lohkocalloutiin",
	"cmd.customInsertBlock": "Lisää {{name}}-lohkocallout",
	"cmd.customInsertHeading": "Lisää H{{level}}-otsikkocallout ({{name}})",
	"cmd.customInsertInline": "Lisää {{name}}-rivin sisäinen callout",
	"cmd.openQuickInsert": "Lisää lohko-callout nopeasti",
	"autocomplete.createNew": 'Luo uusi callout: "{{name}}"',
	"settings.fallbackTag": "Oletus",
	"settings.fallbackTagAuto": "Automaattinen oletus",
	"settings.rescanVault": "Skannaa holvi uudelleen",
	"settings.rescanVaultDesc":
		"Etsii muistiinpanoista tunnistamattomia callout-tunnuksia ja lisää ne varariveinä.",
	"settings.rescanVaultHintAction": "Skannaa nyt",
	"settings.rescanComplete":
		"Uudelleenskannaus valmis: {{count}} uutta callouttia lisätty.",
	"replaceModal.deleteWithoutReplaceSuffix": "(palaa oletukseen)",
	"replaceModal.titleDelete": "Poista callout",
	"replaceModal.titleReplace": "Korvaa holvissa",
	"firstRun.title": "Etsitkö olemassa olevia callouteja holvista?",
	"firstRun.body":
		"Callout Studio voi skannata holvisi löytääkseen jo käyttämäsi calloutit, jotta ne näkyvät asetusluettelossasi ja omaksuvat varatyylisi.",
	"firstRun.heavyVaultNote":
		"Holvissasi on {{count}} Markdown-tiedostoa — skannaus voi kestää muutaman sekunnin.",
	"firstRun.laterHint":
		"Voit aina suorittaa tämän myöhemmin kohdasta Asetukset → Holvin näkemykset ja huolto → Skannaa holvi uudelleen.",
	"firstRun.scanNow": "Skannaa nyt",
	"firstRun.noThanks": "Ei kiitos",
	"firstRun.autoScanComplete":
		"Callout Studio skannasi holvisi ja lisäsi {{count}} callouttia.",
	"firstRun.scanning": "Skannataan",
	"firstRun.autoScanFailed":
		"Callout Studio ei pystynyt skannaamaan holviasi. Voit yrittää uudelleen kohdasta Asetukset → Holvin näkemykset ja huolto → Skannaa holvi uudelleen.",
	"firstRun.scanFailed":
		"Skannaus ei valmistunut. Voit yrittää uudelleen kohdasta Asetukset → Holvin näkemykset ja huolto → Skannaa holvi uudelleen.",

	"welcome.tooltip": "Tietoja Callout Studiosta",
	"welcome.title": "Tervetuloa Callout Studioon",
	"welcome.tagline":
		"Täydellinen ratkaisusi Obsidian-callouttien hallintaan.",
	"welcome.previewTitle": "Näe se toiminnassa",
	"welcome.sample":
		"Callout Studion avulla voit luoda callouteja mukautetulla kuvakkeella, väreillä ja nimellä.\n\n" +
		"Voit käyttää samaa calloutia **kolmella** eri tavalla:\n\n" +
		"## [!tip] Otsikkona\n" +
		"Muuttaaksesi minkä tahansa otsikon callout-tyyliseksi otsikoksi, lisää `[!type]` heti `#`-merkkien jälkeen.\n\n" +
		"Haluatko tällaisen upotetun calloutin [!warning]? Lisää vain `[!type]` keskelle lausetta, kirjoituksen kulkua katkaisematta.\n\n" +
		"> [!note] Block Callout\n" +
		"> Klassinen callout toimii tietysti täsmälleen samalla syntaksilla, johon olet jo tottunut: `> [!type]`.\n\n" +
		"Callout Studiolla on paljon muutakin tarjottavaa! [Lue lisää]({{repoUrl}}).\n",

	"deleteModal.title": 'Poistetaanko callout "{{name}}"?',
	"deleteModal.bodyInUse":
		"Tämä callout esiintyy {{count}} kertaa {{files}} tiedostossa.",
	"deleteModal.bodyInUseExplain":
		"Poistaminen muuntaa nämä lohkot tavalliseksi tekstiksi — ne menettävät tyylinsä ja callout-otsikkonsa.",
	"deleteModal.replaceHint":
		"Voit korvata sen toisella calloutilla, jolloin holvin sisältö säilyy tyyliteltynä calloutina.",
	"deleteModal.bodyUnused":
		'"{{name}}" ei ole käytössä missään muistiinpanossa, mutta se on luomasi mukautettu callout. Poistaminen poistaa sen tästä luettelosta.',
	"deleteModal.replaceInstead": "Korvaa sen sijaan",
	"deleteModal.deleteInUse": "Poista (muunna tavalliseksi tekstiksi)",
	"deleteModal.deleteUnused": "Poista callout",

	// The variant for a callout whose definition Callout Studio cannot remove:
	// one of Obsidian's built-ins, or a type the active theme declares.
	"deleteModal.titleKeep": 'Poistetaanko kaikki calloutin "{{name}}" käytöt?',
	"deleteModal.keepsRowBuiltIn":
		"Tämä on yksi Obsidianin sisäänrakennetuista callouteista, joten itse tyyppi pysyy käytettävissä — vain sen käytöt muistiinpanoissasi muuttuvat.",
	"deleteModal.keepsRowTheme":
		"{{theme}} määrittää tämän callout-tyypin, joten se pysyy käytettävissä ja säilyttää ulkoasunsa. Callout Studio muuttaa vain holvisi muistiinpanoja — mikään teemaasi kuuluva ei muutu.",
	"deleteModal.clearUsages": "Poista käytöt (muunna tavalliseksi tekstiksi)",

	"settings.title": "Callout Studio",
	"settings.myCalloutTypes": "Omat callout-tyypit",
	"settings.builtInCallouts": "Sisäänrakennetut calloutit",
	"settings.contextMenu": "Kontekstivalikko",
	"settings.autocomplete": "Automaattinen täydennys",
	"settings.keyboardShortcuts": "Näppäinoikotiet",
	"settings.language": "Kieli",
	"settings.languageDesc":
		"Callout Studion näyttökieli. Seuraa oletuksena Obsidianin käyttöliittymän kieltä.",
	"settings.languageAuto": "Automaattinen (sama kuin Obsidian)",
	"settings.importExport": "Tuo / vie",
	"settings.import": "Tuo",
	"settings.export": "Vie",
	"settings.importDesc":
		"Tuo Callout Studio -tietosi toisesta holvista JSON-tiedoston avulla.",
	"settings.exportDesc":
		"Tallenna kaikki mukautetut callout-tyypit JSON-muodossa.",
	"settings.importConflictNotice":
		"{{count}} callout-tyyppiä tuotu; {{overwritten}} olemassa olevaa merkintää ylikirjoitettu.",
	"settings.addNewCallout": "+ lisää callout",
	"settings.noCalloutsNow": "Ei mukautettuja callouteja tällä hetkellä.",
	"settings.editAria": "Muokkaa {{name}}",
	"settings.moreRowActionsAria": "Lisää toimintoja kohteelle {{name}}",
	"settings.usageInfo": "{{count}} käyttö(ä) {{files}} tiedostossa",
	"settings.replaceAction": "Korvaa holvissa",
	"settings.deleteAction": "Poista",
	"settings.resetAction": "Palauta oletukseksi",
	"settings.makeFallbackAction": "Käytä oletusvaratyyliä",
	"settings.colorSwatchAria": "Aksentti: {{accent}} · Tausta: {{bg}}",

	// Handing a callout to the user's own CSS. Not a statement about the theme —
	// that is derived and has no action — so the wording names the snippet.
	"settings.externalCssAction": "Tyylittele omalla CSS:llä",
	"settings.externalCssStopAction": "Anna Callout Studion tyylitellä tämä taas",
	// The one label on any row: a callout sitting among the user's own that
	// Callout Studio has nonetheless stopped painting.
	"settings.externalCssTag": "Ulkoinen CSS",
	// Settings — callouts the active theme styles
	"settings.themeCalloutsHeading": "Teemasi calloutit",
	"settings.themeCalloutsDesc":
		"{{theme}} tarjoaa tai muotoilee nämä uudelleen, joten Callout Studio jättää ne täsmälleen sellaisiksi kuin teemasi piirtää ne, ja tarjoaa niitä vain lohko-callouteina. Molemmat tyypit näkyvät tässä: teemasi lisäämät callout-tyypit ja sisäänrakennetut calloutit, joiden ulkoasun se korvaa. Teemasi lisäämät callout-tyypit näkyvät luettelossa vain, kun teema on käytössä.",
	"settings.themeCalloutsDefaultTheme": "Teemasi",
	"settings.themePreviewAria":
		'Esikatsele "{{name}}" — näe, miten teemasi piirtää sen',
	"settings.clearUsesAction": "Poista käytöt muistiinpanoistasi",
	"settings.builtInAllThemeStyled":
		"{{theme}} muotoilee jokaisen sisäänrakennetun calloutin uudelleen, joten ne kaikki näkyvät yllä eikä Callout Studio koske niihin. Jos haluat suunnitella oman, lisää callout eri tunnuksella.",

	"settings.fallbackCallout": "Oletus-varausCallout",
	"settings.fallbackCalloutDesc":
		"Holvisi tuntemattomat callout-tyypit perivät tämän calloutin tyylin.",
	"settings.globalStyle": "Callout-yleistyyli",
	"settings.border": "Reunat",
	"settings.borderAll": "Kaikki",
	"settings.borderTop": "Ylä",
	"settings.borderRight": "Oikea",
	"settings.borderBottom": "Ala",
	"settings.borderLeft": "Vasen",
	"settings.borderWidth": "Reunan paksuus",
	"settings.fontScaleGroup": "Fonttiskaala",
	"settings.titleScale": "Otsikko",
	"settings.contentScale": "Sisältö",
	"settings.inlineTextScale": "Teksti",
	"settings.shapeGroup": "Muoto",
	"settings.borderRadius": "Kulmien pyöristys",
	"settings.alignGroup": "Tasaus",
	"settings.alignContent": "Tasaa sisältö otsikon kanssa",
	"settings.headingSpacingGroup": "Otsikon väli",
	"settings.headingPadVertical": "Pystysuuntainen väli",
	"settings.headingGap": "Otsikoiden välinen tila",
	"settings.headingFoldGroup": "Kutistaminen",
	"settings.headingFoldArrow": "Näytä kutistamisnuoli",
	"settings.styleDemoName": "Esimerkki",
	"settings.previewTitle": "Esikatselu",
	// Settings — Saved color palettes
	"settings.customPalettes": "Tallennetut väripaletit",
	"settings.newPalette": "Uusi paletti",
	"settings.customPalettesEmpty":
		"Ei tallennettuja paletteja tällä hetkellä.",
	"settings.editPaletteAria": "Muokkaa palettia {{name}}",
	"settings.deletePaletteAria": "Poista paletti {{name}}",
	"settings.deletePaletteConfirm":
		'Poistetaanko paletti "{{name}}"?\nSen värejä käyttävät callout-tyypit eivät muutu.',
	"settings.enableAutocomplete": "Ota [! automaattinen täydennys käyttöön",
	"settings.enableAutocompleteDesc":
		'Näyttää ehdotuksia, kun kirjoitat "[!" lainausblokissa editorissa. Valitse callout-tyyppi luettelosta lisätäksesi täydellisen callout-otsikon.',
	"settings.customCommands": "Komennot ja pikanäppäimet",
	"settings.customCommandsDesc":
		"Näytä jokainen Callout Studion komento ja sen pikanäppäin, ja luo omia komentoja eniten käyttämillesi callouteille. Oletuksena ei ole määritetty pikanäppäimiä.",
	"settings.customCommandsButton": "Hallinnoi komentoja",
	"commandBuilder.title": "Komennot ja pikanäppäimet",
	"commandBuilder.desc":
		"Aseta tai vaihda pikanäppäin Obsidianin pikanäppäinasetuksista +-painikkeella.",
	"commandBuilder.builtIn": "Sisäänrakennetut komennot",
	"commandBuilder.toggleAria": "Ota {{name}} käyttöön tai pois käytöstä",
	"commandBuilder.hotkeyBlank": "Tyhjä",
	"commandBuilder.hotkeyAria": "Aseta pikanäppäin komennolle {{name}}",
	"commandBuilder.yourCommands": "Omat komentosi",
	"commandBuilder.newCommand": "Uusi komento",
	"commandBuilder.empty": "Ei vielä mukautettuja komentoja.",
	"commandBuilder.unknownCommand": "tämä komento",
	"commandBuilder.editAria": "Muokkaa {{name}}",
	"commandBuilder.deleteAria": "Poista {{name}}",
	"commandBuilder.deleteConfirm":
		"Poistetaanko komento {{name}}? Sille asetettu pikanäppäin lakkaa toimimasta.",
	"commandBuilder.newTitle": "Uusi komento",
	"commandBuilder.editTitle": "Muokkaa komentoa",
	"commandBuilder.format": "Callout-muoto",
	"commandBuilder.formatDesc":
		"Minkä tyyppisen calloutin komento kirjoittaa.",
	"commandBuilder.formatHeading": "Otsikko",
	"commandBuilder.formatInline": "Rivin sisäinen",
	"commandBuilder.formatBlock": "Lohko",
	"commandBuilder.roleDisabled":
		"Tämä muoto on pois käytöstä, joten komento lisää tavallista tekstiä, kunnes otat sen taas käyttöön.",
	"commandBuilder.callout": "Callout-tyyppi",
	"commandBuilder.calloutDesc": "Callout, jonka tämä komento lisää.",
	"commandBuilder.headingLevel": "Otsikkotaso",
	"commandBuilder.headingLevelDesc": "Mikä otsikkotaso kirjoitetaan.",
	"commandBuilder.action": "Toiminto",
	"commandBuilder.actionDesc":
		"Kääri muuttaa valinnan calloutiksi; lisää lisää tyhjän.",
	"commandBuilder.actionWrap": "Kääri valinta",
	"commandBuilder.actionInsert": "Lisää uusi",
	"commandBuilder.preview": "Komennon nimi",
	"commandBuilder.duplicate":
		"Sinulla on jo täsmälleen tämän tekevä komento.",
	"commandBuilder.noCallouts":
		"Ei vielä callout-tyyppejä, joista rakentaa komento.",
	"commandBuilder.save": "Tallenna",

	"commandBuilder.roleThemeOwned":
		"Teemasi tarjoaa tämän calloutin, joten sillä on vain lohkomuoto.",
	"commandBuilder.commandSuspended":
		"Keskeytetty: teemasi tarjoaa tämän calloutin, joten sillä on vain lohkomuoto. Tämä komento toimii taas, kun teema lakkaa tarjoamasta sitä.",

	"settings.vaultMaintenance": "Holvin näkemykset ja huolto",
	"settings.vaultStats": "Callout-tilastot",
	"settings.vaultStatsDesc":
		"Laskee jokaisen calloutin Markdown-muistiinpanoissasi — lohko-, otsikko- ja rivinsisäisen — ja ryhmittelee ne tyypin mukaan.",
	"settings.vaultStatsButton": "Näytä tilastot",
	"settings.vaultStatsScanning": "Skannataan",
	"settings.resetAll": "Palauta",
	"settings.resetAllDesc":
		"Poistaa kaikki käyttäjän calloutit, palauttaa sisäänrakennetut calloutit, yleiset tyylit, tallennetut väripaletit, hiiren kakkospainikkeen valikon mukautukset ja ladatut Material-SVG:t.",
	"settings.resetAllButton": "Palauta kaikki",
	"settings.resetAllConfirm":
		"Tämä poistaa kaikki mukautetut calloutit, palauttaa sisäänrakennetut calloutit, yleiset tyylit, tallennetut väripaletit, hiiren kakkospainikkeen valikon mukautukset ja kaikki välimuistissa olevat Material-SVG:t. Toimintoa ei voi kumota. Oletko varma?",
	"notice.resetAllDone": "Kaikki on palautettu oletuksiksi.",
	"notice.customCommandsRemoved":
		"Poistettiin {{count}} mukautettu(a) komento(a), joiden callout-tyyppiä ei enää ole.",
	"notice.customCommandMissingCallout":
		"Tämän komennon callout-tyyppiä ei enää ole.",
	"notice.exported": "Calloutit viety tiedostoon callout-studio-export.json",
	"notice.importedJSON": "{{count}} callout-tyyppiä tuotu JSONista.",
	"notice.importedSettings": "Lisäosan asetukset tuotu.",
	"notice.importedCalloutManager":
		"Tuotu Callout Managerista: {{created}} luotu, {{updated}} päivitetty.",
	"notice.importedAdmonition":
		"Tuotu Admonitionista: {{created}} luotu, {{updated}} päivitetty.",
	"notice.noNewJSON":
		"Uusia callout-tyyppejä ei tuotu (tunnukset voivat jo olla olemassa).",
	"notice.iconDownloadFailed":
		'Material-kuvakkeen "{{name}}" lataaminen epäonnistui. Se ei ehkä ole saatavilla tälle tyylille/painolle tai yhteys on poikki.',

	"notice.externalCssOn":
		'Callout Studio ei enää tyylittele calloutia "{{name}}" — oma CSS:äsi päättää sen ulkoasun. Sen otsikko- ja rivinsisäinen callout-muoto eivät näy.',
	"notice.externalCssOff": 'Callout Studio tyylittelee taas calloutia "{{name}}".',

	"notice.nothingToWrap": "Ei mitään kääriä.",
	"notice.cursorNotInsideCallout": "Kursori ei ole calloutin sisällä.",
	"notice.autocompleteTargetMoved":
		"Mitään ei lisätty — rivi muuttui, kun editori oli auki.",
	"notice.openHotkeysFailed": "Obsidianin oikotieasetuksia ei voitu avata.",
	"notice.filterHotkeysFailed":
		"Obsidianin oikotiet avattiin, mutta Callout Studio -suodatinta ei voitu käyttää.",
	"editor.editCallout": "Muokkaa callouttia",
	"editor.newCallout": "Uusi callout",
	"editor.displayName": "Näyttönimi",
	"editor.displayNameDesc": "Käyttöliittymässä näkyvä luettava etiketti",
	"editor.displayNameBuiltIn":
		"Sisäänrakennettujen calloutien näyttönimeä ei voi muuttaa",
	"editor.displayNamePlaceholder": "Oma callout",
	"editor.calloutIds": "Callout-tunnukset",
	"editor.calloutIdsDesc":
		"Kaikki tämän calloutin tunnisteet. Välilyönnit ovat sallittuja.\nLisää painamalla Enter tai +-painiketta.",
	"editor.calloutIdsPlaceholder": "Lisää tunnus",
	"editor.addId": "Lisää tunnus",
	"editor.idLinkedToName": "Linkitetty näyttönimeen",
	"editor.idCannotDelete":
		"Tämä tunnus on linkitetty näyttönimeen eikä sitä voi poistaa — muuta nimeä muuttaaksesi sitä",
	"editor.icon": "Kuvake",
	"editor.pickIcon": "Vaihda kuvake",
	"editor.replaceIcon": "Korvaa kuvake",
	"editor.removeIcon": "Poista kuvake",
	"editor.noIcon": "Ei kuvaketta",
	"editor.resetIcon": "Palauta kuvake oletukseksi",
	"editor.livePreview": "Reaaliaikainen esikatselu",
	"editor.iconAdjustment": "Kuvakkeen säätö",
	"editor.picture": "Kuva",
	"editor.size": "Koko",
	"editor.horizontalOffset": "Vaakasuuntainen siirtymä",
	"editor.verticalOffset": "Pystysuuntainen siirtymä",
	"editor.colors": "Värit",
	"editor.colorsDesc":
		"Sets this callout's border, background, and text colors.",
	"editor.resetColors": "Palauta värit oletukseksi",
	"editor.paletteDeleted": "Poistettu väri",
	"editor.paletteGroupObsidian": "Obsidian-calloutit",
	"editor.paletteGroupPresets": "Väriesiasennukset",
	"editor.paletteGroupCustom": "Mukautettu",
	"editor.paletteNewColor": "Uusi väri…",
	"editor.contrastWarning":
		"Heikko kontrasti taustaan — voi olla vaikea lukea",
	"editor.foldable": "Taitettava",
	"editor.foldableDesc":
		"Valitse, voiko calloutin taittaa, ja mikä oletustila koskee koko holvia.",
	"editor.foldOff": "Pois",
	"editor.foldOpen": "Auki oletuksena",
	"editor.foldClosed": "Kiinni oletuksena",
	"editor.cancel": "Peruuta",
	"editor.saveChanges": "Tallenna muutokset",
	"editor.createCallout": "Luo callout",
	"editor.nameRequired": "Näyttönimi vaaditaan ennen calloutin luomista.",
	"editor.noChangesToSave": "Muutoksia ei tehty.",
	"editor.downloadingIcon": "Ladataan kuvaketta",
	"editor.idEmpty": "Vähintään yksi tunnus vaaditaan",
	"editor.idExists": "Callout tällä tunnuksella on jo olemassa",
	"editor.idConflict":
		"Tämä tunnus on ristiriidassa olemassa olevan calloutin kanssa",
	"editor.idDashConflict":
		'Obsidian kirjoittaa välilyönnit väliviivoina, joten tämä tunnus on ristiriidassa tunnuksen "{{other}}" kanssa',

	"editor.idFromTheme":
		"{{theme}} tarjoaa jo calloutin tällä tunnuksella, joten Callout Studio ei voi tyylitellä sitä. Valitse toinen tunnus.",
	"editor.idThemePattern":
		"Huomio: teemasi tyylittelee jokaisen calloutin, joka vastaa mallia {{pattern}}, joten se saattaa ohittaa tämän ulkoasun.",

	"editor.untitledCallout": "Nimetön Callout",
	"editor.loremIpsum":
		"Lorem ipsum dolor sit amet, consectetur adipiscing elit.",
	"editor.loremIpsumShort":
		"Lorem ipsum dolor sit amet, consectetur adipiscing elit.",
	"editor.sampleInlineText":
		"Tässä on upotettu [!{id}] -pilleri kappaleen sisällä.",
	"editor.previewReadOnly": "Live-esikatselua ei voi muokata",

	// Theme callout preview window — opens instead of the editor for a callout
	// the active theme supplies or restyles.
	"themePreview.title": '{{name}} — teemasi tarjoama',
	"themePreview.owned":
		'{{theme}} tarjoaa ja tyylittelee calloutin "{{name}}". Callout Studio ei ohita sitä, joten sen lohko-callout näyttää täsmälleen siltä, miltä teemasi sen piirtää.',
	"themePreview.readOnly":
		"Tämä tarkoittaa, ettei sen väriä, kuvaketta, nimeä tai tunnusta voi muuttaa täällä. Jos haluat oman suunnittelun, luo uusi callout eri tunnuksella.",
	"themePreview.blockOnly":
		"Otsikko- ja rivinsisäinen muoto eivät ole käytettävissä teemasi tarjoamille callouteille. Lohko-calloutit käyttävät teeman omaa tyyliä.",
	"themePreview.previewTitle": "Miltä se näyttää nyt",
	"themePreview.blockSample":
		"> [!{{id}}] {{name}}\n" +
		"> Tältä calloutin sisältö näyttää.\n",

	"editor.externalStyleClose": "Selvä",
	// Palette editor modal
	"palette.newTitle": "Uusi väripaletti",
	"palette.groupPalette": "Paletti",
	"palette.editTitle": "Muokkaa väripalettia",
	"palette.name": "Nimi",
	"palette.namePlaceholder": "Oma paletti",
	"palette.nameExists": "Tämän niminen paletti on jo olemassa",
	"palette.baseColor": "Perusväri",
	"palette.baseColorHint":
		"Sovitamme taustavärin automaattisesti siihen. Jos haluat, voit hallita sitä erikseen {{link}}.",
	"palette.baseColorHintLink": "napsauttamalla tätä",
	"palette.advancedColors": "Värit",
	"palette.advancedColorsHint":
		"Muokataan {{mode}}-tilan värejä – toinen tila päivittyy automaattisesti. Vaihda Obsidianin teemaa tarkistaaksesi sen.",
	"palette.revertHint": "Haluatko mieluummin yhden peruvärin? {{link}}.",
	"palette.revertHintLink": "Palauta",
	"palette.lightMode": "Vaalea",
	"palette.darkMode": "Tumma",
	"palette.accentColor": "Korostusväri",
	"palette.backgroundColorChannel": "Taustaväri",
	"palette.textColorChannel": "Tekstin väri",
	"palette.bgIntensity": "Voimakkuus",
	"palette.bgStyle": "Tyyli",
	"palette.bgSolid": "Yksivärinen",
	"palette.bgGradient": "Liukuväri",
	"palette.bgTransparent": "Läpinäkyvä",
	"palette.gradientTo": "Toinen väri",
	"palette.gradientDirection": "Suunta",
	"palette.gradientText": "Otsikkoteksti liukuvärillä",
	"palette.save": "Tallenna",

	// Color name suggestions (used to prefill palette names)
	"colorName.red": "Punainen",
	"colorName.orange": "Oranssi",
	"colorName.amber": "Meripihka",
	"colorName.yellow": "Keltainen",
	"colorName.lime": "Limetti",
	"colorName.green": "Vihreä",
	"colorName.teal": "Sinivihreä",
	"colorName.cyan": "Syaani",
	"colorName.sky": "Taivaansininen",
	"colorName.blue": "Sininen",
	"colorName.indigo": "Indigo",
	"colorName.violet": "Violetti",
	"colorName.purple": "Purppura",
	"colorName.pink": "Pinkki",
	"colorName.rose": "Ruusu",
	"colorName.brown": "Ruskea",
	"colorName.gray": "Harmaa",
	"colorName.black": "Musta",
	"colorName.white": "Valkoinen",
	"colorName.crimson": "Karmiininpunainen",
	"colorName.coral": "Koralli",
	"colorName.grape": "Rypäle",
	"colorName.plum": "Luumu",
	"colorName.bubblegum": "Purukumi",

	"iconPicker.pickIcon": "Valitse kuvake",
	"iconPicker.confirm": "Vahvista",
	"iconPicker.cancel": "Peruuta",
	"iconPicker.lucide": "Lucide",
	"iconPicker.tabler": "Tabler Icons",
	"iconPicker.material": "Material",
	"iconPicker.emoji": "Emoji",
	"iconPicker.searchLucide": "hae Lucide-kuvakkeita",
	"iconPicker.searchTabler": "hae Tabler-kuvakkeita",
	"iconPicker.tablerStyle": "Kuvaketyyli",
	"iconPicker.tablerStyleOutline": "Ääriviiva (Outline)",
	"iconPicker.tablerStyleFilled": "Täytetty (Filled)",
	"iconPicker.loadMore": "Lataa lisää",
	"iconPicker.materialStyle": "Kuvaketyyli",
	"iconPicker.materialStyleOutlined": "Ääriviiva (Outlined)",
	"iconPicker.materialStyleFilled": "Täytetty (Filled)",
	"iconPicker.materialStyleRounded": "Pyöristetty (Rounded)",
	"iconPicker.materialStyleSharp": "Terävä (Sharp)",
	"iconPicker.materialWeight": "Kuvakkeen paino",
	"iconPicker.materialWeight100": "Ohut (Thin)",
	"iconPicker.materialWeight200": "Erittäin kevyt (Extra Light)",
	"iconPicker.materialWeight300": "Kevyt (Light)",
	"iconPicker.materialWeight400": "Normaali (Regular)",
	"iconPicker.materialWeight500": "Keskipaksu (Medium)",
	"iconPicker.materialWeight600": "Puolilihava (Semi Bold)",
	"iconPicker.materialWeight700": "Lihava (Bold)",
	"iconPicker.materialFontFailed":
		"Material-kuvakkeiden esikatselujen lataaminen ei onnistunut. Kuvakkeiden nimet näytetään sen sijaan — haku ja valitseminen toimivat silti.",
	"iconPicker.materialFontRetry": "Yritä uudelleen",
	"iconPicker.searchMaterial": "hae Material-kuvakkeita",
	"iconPicker.searchEmoji": "Hae emojeja",
	"iconPicker.skinTone": "Ihonsävy",
	"iconPicker.allCategories": "Kaikki kategoriat",
	"iconPicker.noIconSelected": "Kuvaketta ei valittu",
	"iconPicker.noResults": "Mikään kuvake ei vastaa hakuasi.",
	"iconPicker.octicons": "Octicons",
	"iconPicker.searchOcticons": "Hae Octicons-kuvakkeita",
	"iconPicker.fa": "Font Awesome",
	"iconPicker.searchFa": "Hae Font Awesome -kuvakkeita",
	"iconPicker.faStyle": "Kuvaketyyli",
	"iconPicker.faStyleSolid": "Täytetty (Solid)",
	"iconPicker.faStyleRegular": "Tavallinen (Regular)",
	"iconPicker.faStyleBrands": "Brändit (Brands)",
	"iconPicker.rpgAwesome": "RPG Awesome",
	"iconPicker.searchRpgAwesome": "Hae RPG Awesome -kuvakkeita",
	"iconPicker.image": "Kuvasi",
	"iconPicker.searchImage": "Hae kuvistasi",
	"iconPicker.imageTooLarge":
		"{{name}} on liian suuri. Kuvien on oltava alle 5 Mt.",
	"iconPicker.imageUnsupported":
		"{{name}} ei ole tuettu kuvamuoto. Käytä SVG-, PNG-, JPEG- tai WebP-muotoa.",
	"iconPicker.imageInvalidSvg":
		"{{name}} ei voitu lukea turvallisena SVG-tiedostona, joten sitä ei lisätty.",
	"iconPicker.imageDecodeFailed": "{{name}} ei voitu lukea kuvana.",
	"iconPicker.imageDuplicate":
		"{{name}} on jo kuvissasi. Nimeä tiedosto uudelleen tai poista olemassa oleva kuva.",
	"iconPicker.imageAdd": "Lisää kuvia",
	"iconPicker.imageEmpty":
		"Ei vielä kuvia. Lisää SVG-, PNG-, JPEG- tai WebP-tiedosto tietokoneeltasi tai pudota se tähän.",
	"iconPicker.imageDelete": "Poista",
	"iconPicker.imageDeleteConfirm": "Poistetaanko „{{name}}“?",
	"iconPicker.imageDeleteInUse":
		"{{count}} calloutia käyttää tätä kuvaa. Ne näyttävät paikkamerkkikuvakkeen, kunnes annat uuden.",
	"iconPicker.imageRecolor": "Seuraa Callout-väriä",
	"iconPicker.allSources": "Kaikki lähteet",
	"iconPicker.searchAllSources": "Hae kaikista kuvakelähteis",
	"iconPicker.sourcesNotDownloaded":
		"Ei vielä sisällytetty: {{names}}. Valitse lähde ylhäältä ladataksesi sen.",
	"iconPicker.chooseSource": "Valitse lähde",
	"iconPicker.sourceGroup": "{{name}} · {{count}}",

	// Source menu — what each library holds, in a few words
	"iconPicker.descAllSources": "hae kaikista kirjastoista kerralla",
	"iconPicker.descLucide": "Obsidianin oma setti, aina offline",
	"iconPicker.descTabler":
		"siistit ja yhtenäiset UI-kuvakkeet, ääriviiva ja täytetty",
	"iconPicker.descMaterial":
		"Googlen setti, neljä tyyliä ja seitsemän painoa",
	"iconPicker.descEmoji": "värilliset glyfit, kaikki ihonsävyt",
	"iconPicker.descOcticons": "GitHubin käyttöliittymäkuvakkeet",
	"iconPicker.descFa": "täytetty, tavallinen ja brändit",
	"iconPicker.descRpgAwesome": "fantasia- ja lautapelikuvakkeet",
	"iconPicker.descImage": "kuvat, jotka lisäät tietokoneeltasi",

	// Icon picker — category filter dropdown labels
	"iconPicker.cat.Accessibility": "Saavutettavuus",
	"iconPicker.cat.Actions": "Toiminnot",
	"iconPicker.cat.Activities": "Aktiviteetit",
	"iconPicker.cat.Alert": "Varoitus",
	"iconPicker.cat.Alphabet": "Aakkoset",
	"iconPicker.cat.Android": "Android",
	"iconPicker.cat.Animals": "Eläimet",
	"iconPicker.cat.Arrows": "Nuolet",
	"iconPicker.cat.Astronomy": "Tähtitiede",
	"iconPicker.cat.Audio&Video": "Ääni ja video",
	"iconPicker.cat.Automotive": "Autot",
	"iconPicker.cat.Badges": "Merkit",
	"iconPicker.cat.Brand": "Brändit",
	"iconPicker.cat.Buildings": "Rakennukset",
	"iconPicker.cat.Business": "Liiketoiminta",
	"iconPicker.cat.Camping": "Retkeily",
	"iconPicker.cat.Charity": "Hyväntekeväisyys",
	"iconPicker.cat.Charts": "Kaaviot",
	"iconPicker.cat.Charts + Diagrams": "Kaaviot ja diagrammit",
	"iconPicker.cat.Childhood": "Lapsuus",
	"iconPicker.cat.Clothing + Fashion": "Vaatteet ja muoti",
	"iconPicker.cat.Coding": "Ohjelmointi",
	"iconPicker.cat.Communicate": "Kommunikointi",
	"iconPicker.cat.Communication": "Viestintä",
	"iconPicker.cat.Computers": "Tietokoneet",
	"iconPicker.cat.Connectivity": "Yhteydet",
	"iconPicker.cat.Construction": "Rakentaminen",
	"iconPicker.cat.Currencies": "Valuutat",
	"iconPicker.cat.Database": "Tietokanta",
	"iconPicker.cat.Design": "Muotoilu",
	"iconPicker.cat.Development": "Kehitys",
	"iconPicker.cat.Devices": "Laitteet",
	"iconPicker.cat.Devices + Hardware": "Laitteet ja laitteisto",
	"iconPicker.cat.Disaster + Crisis": "Katastrofit ja kriisit",
	"iconPicker.cat.Document": "Asiakirja",
	"iconPicker.cat.E-commerce": "Verkkokauppa",
	"iconPicker.cat.Editing": "Muokkaus",
	"iconPicker.cat.Education": "Koulutus",
	"iconPicker.cat.Electrical": "Sähkö",
	"iconPicker.cat.Emoji": "Emoji",
	"iconPicker.cat.Energy": "Energia",
	"iconPicker.cat.Extensions": "Laajennukset",
	"iconPicker.cat.Files": "Tiedostot",
	"iconPicker.cat.Film + Video": "Elokuvat ja video",
	"iconPicker.cat.Food": "Ruoka",
	"iconPicker.cat.Food + Beverage": "Ruoka ja juoma",
	"iconPicker.cat.Fruits + Vegetables": "Hedelmät ja vihannekset",
	"iconPicker.cat.Games": "Pelit",
	"iconPicker.cat.Gaming": "Pelaaminen",
	"iconPicker.cat.Gender": "Sukupuoli",
	"iconPicker.cat.Genders": "Sukupuolet",
	"iconPicker.cat.Gestures": "Eleet",
	"iconPicker.cat.Halloween": "Halloween",
	"iconPicker.cat.Hands": "Kädet",
	"iconPicker.cat.Hardware": "Laitteisto",
	"iconPicker.cat.Health": "Terveys",
	"iconPicker.cat.Holidays": "Lomat",
	"iconPicker.cat.Home": "Koti",
	"iconPicker.cat.Household": "Kotitalous",
	"iconPicker.cat.Humanitarian": "Humanitaarinen",
	"iconPicker.cat.Images": "Kuvat",
	"iconPicker.cat.Laundry": "Pyykinpesu",
	"iconPicker.cat.Letters": "Kirjaimet",
	"iconPicker.cat.Logic": "Logiikka",
	"iconPicker.cat.Logistics": "Logistiikka",
	"iconPicker.cat.Map": "Kartta",
	"iconPicker.cat.Maps": "Kartat",
	"iconPicker.cat.Maritime": "Merenkulku",
	"iconPicker.cat.Marketing": "Markkinointi",
	"iconPicker.cat.Math": "Matematiikka",
	"iconPicker.cat.Mathematics": "Matematiikka",
	"iconPicker.cat.Media": "Media",
	"iconPicker.cat.Media Playback": "Median toisto",
	"iconPicker.cat.Medical + Health": "Lääketiede ja terveys",
	"iconPicker.cat.Money": "Raha",
	"iconPicker.cat.Mood": "Mieliala",
	"iconPicker.cat.Moving": "Muutto",
	"iconPicker.cat.Music + Audio": "Musiikki ja ääni",
	"iconPicker.cat.Nature": "Luonto",
	"iconPicker.cat.Numbers": "Numerot",
	"iconPicker.cat.Photography": "Valokuvaus",
	"iconPicker.cat.Photos + Images": "Valokuvat ja kuvat",
	"iconPicker.cat.Political": "Poliittinen",
	"iconPicker.cat.Privacy": "Yksityisyys",
	"iconPicker.cat.Punctuation + Symbols": "Välimerkit ja symbolit",
	"iconPicker.cat.Religion": "Uskonto",
	"iconPicker.cat.Science": "Tiede",
	"iconPicker.cat.Science Fiction": "Tieteiskirjallisuus",
	"iconPicker.cat.Security": "Turvallisuus",
	"iconPicker.cat.Shapes": "Muodot",
	"iconPicker.cat.Shopping": "Ostokset",
	"iconPicker.cat.Social": "Sosiaalinen media",
	"iconPicker.cat.Spinners": "Pyörijät",
	"iconPicker.cat.Sport": "Urheilu",
	"iconPicker.cat.Sports + Fitness": "Urheilu ja kunto",
	"iconPicker.cat.Symbols": "Symbolit",
	"iconPicker.cat.System": "Järjestelmä",
	"iconPicker.cat.Text": "Teksti",
	"iconPicker.cat.Text Formatting": "Tekstin muotoilu",
	"iconPicker.cat.Time": "Aika",
	"iconPicker.cat.Toggle": "Vaihto",
	"iconPicker.cat.Transit": "Liikenne",
	"iconPicker.cat.Transportation": "Kuljetus",
	"iconPicker.cat.Travel": "Matkailu",
	"iconPicker.cat.Travel + Hotel": "Matkailu ja hotellit",
	"iconPicker.cat.UI actions": "Käyttöliittymätoiminnot",
	"iconPicker.cat.Users + People": "Käyttäjät ja ihmiset",
	"iconPicker.cat.Vehicles": "Ajoneuvot",
	"iconPicker.cat.Version control": "Versionhallinta",
	"iconPicker.cat.Weather": "Sää",
	"iconPicker.cat.Writing": "Kirjoittaminen",
	"iconPicker.cat.Zodiac": "Horoskooppi",

	// Downloadable icon packs
	"iconPack.downloadTitle": "{{name}} ei ole vielä ladattu",
	"iconPack.downloadDetail": "{{count}} kuvaketta · {{size}} · kertasiirto",
	"iconPack.download": "Lataa",
	"iconPack.downloading": "Ladataan {{name}}…",
	"iconPack.downloadFailed":
		"{{name}} ei voitu ladata. Tarkista yhteys ja yritä uudelleen.",
	"iconPack.retry": "Yritä uudelleen",
	"iconPack.faBrandsNotice":
		"Brändi-kuvakkeet ovat asianomaisten omistajien tavaramerkkejä. Niiden sisällyttäminen ei tarkoita hyväksyntää. Käytä niitä vain edustamaan yritystä, tuotetta tai palvelua, johon ne viittaavat.",
	"iconPack.artworkRestored":
		"Kuvakkeiden grafiikka ladattiin kohteille {{names}}.",
	"iconPack.diskWriteFailed":
		"Callout Studio ei voinut tallentaa kuvakepakettia levylle, joten se on ladattava uudelleen ensi kerralla. Valitsemasi kuvakkeet on silti tallennettu asetuksiisi.",

	// Icon licences & credits
	"credits.title": "Kuvakkeiden lisenssit ja kiitokset",
	"credits.intro":
		"Callout Studio hyödyntää useita avoimia kuvakekirjastoja. Niiden lisenssit on toistettu alla, yhdessä sen kanssa, mitä muutettiin niiden käyttämiseksi täällä.",
	"credits.fullNotices": "Täydelliset kolmannen osapuolen ilmoitukset",
	"credits.pluginLicense":
		"Callout Studion oma koodi on permissive-lisenssissä; kuvakekirjastot säilyttävät omat lisenssinsä.",
	"contextMenu.editCallout": "Muokkaa callout-asetuksia",
	"contextMenu.copyMarkdown": "Kopioi callout Markdown",
	"contextMenu.openSettings": "Avaa Callout Studio -asetukset",
	"contextMenu.setFoldClosed": "Aseta callout suljetuksi (-)",
	"contextMenu.setFoldOpen": "Aseta callout avoimeksi (+)",
	"contextMenu.setFoldNone": "Tee calloutista ei-taitettava",
	"contextMenu.cutSection": "Leikkaa otsikko-osio",
	"contextMenu.copySection": "Kopioi otsikko-osio",
	"contextMenu.deleteSection": "Poista otsikko-osio",
	"heading.toggleFold": "Vaihda taitto",
	"settings.globalSettings": "Callout Studion tyyliasetukset",
	"settings.globalSettingsScope":
		"Muoto, välit ja koko callouteille, joita Callout Studio tyylittelee. Teemasi tyylittelemät calloutit säilyttävät teeman oman ulkoasun.",
	"settings.globalSettingsRegularDesc":
		"Lisää callout-token lainaukseen (esim. `> [!type]`), jolloin se näkyy Obsidianin natiivina callout-laatikkona. Voit säätää sen reunaa, pyöristystä, fonttiskaalaa ja tasausta.",
	"settings.globalSettingsHeadingDesc":
		"Lisää callout-token suoraan otsikon risuaitojen jälkeen (esim. `## [!type]`), jolloin se näkyy tyyliteltynä callout-otsikkona. Voit säätää sen reunaa, muotoa ja pystysuuntaista väliä.",
	"settings.globalSettingsInlineDesc":
		"Lisää callout-token mihin tahansa kohtaan tekstiriviä (esim. `[!type]`), jolloin se näkyy pienenä rivinsisäisenä pillerinä. Voit säätää sen reunaa ja muotoa.",
	"settings.globalSettingsCustomize": "Mukauta",
	"settings.calloutTypeRegular": "Block callout",
	"settings.calloutTypeHeading": "Otsikko-callout",
	"settings.calloutTypeInline": "Rivinsisäinen callout",
	"settings.customizeMenu": "Mukauta valikon kohteita",
	"settings.customizeMenuDesc":
		"Valitse, mitkä hiiren kakkospainikkeen toiminnot näkyvät kullekin callout-tyypille, ja järjestä ne uudelleen. Toimii lähdetilassa ja Live Preview -tilassa.",
	"settings.customizeMenuButton": "Mukauta valikon kohteita",
	"menuCustomize.title": "Mukauta hiiren kakkospainikkeen valikkoa",
	"menuCustomize.desc":
		"Ota toimintoja käyttöön tai pois käytöstä ja järjestä niitä uudelleen vetämällä kahvasta. Muutokset tallennetaan automaattisesti.",
	"menuCustomize.regular": "Block callout",
	"menuCustomize.heading": "Otsikko-callout",
	"menuCustomize.inline": "Rivinsisäinen callout",
	"menuCustomize.dragHandle": "Vedä järjestääksesi uudelleen",
	"menuItem.edit": "Muokkaa calloutia",
	"menuItem.openSettings": "Avaa asetukset",
	"menuItem.copyMarkdown": "Kopioi Markdown",
	"menuItem.foldDefaults": "Oletustaitto (auki / kiinni / ei mitään)",
	"menuItem.cutSection": "Leikkaa osio",
	"menuItem.copySection": "Kopioi osio",
	"menuItem.deleteSection": "Poista osio",
	"confirm.ok": "Poista",
	"confirm.cancel": "Peruuta",
	// Headings for each confirmation — every window carries one, so each
	// caller of ConfirmModal names what it is about to do.
	"confirm.titleDeleteCommand": "Poista komento",
	"confirm.titleResetAll": "Palauta kaikki calloutit",
	"confirm.titleResetCallout": "Palauta callout",
	"confirm.titleDeletePalette": "Poista paletti",
	"confirm.titleDeleteImage": "Poista kuva",
	"vault.filesUpdated":
		"{{count}} callout-viite(ttä) päivitetty holvin tiedostoissa.",
	"vault.idsUpdated":
		"{{count}} callout-tunnus(ta) päivitetty holvin tiedostoissa: {{oldIds}} → {{newId}}",
	"vault.titlesUpdated":
		"{{count}} callout-otsikko(a) päivitetty holvin tiedostoissa: {{oldTitle}} → {{newTitle}}",
	"vault.replaceWith": "Korvaa:",
	"vault.deleteWithout": "Poista korvaamatta",
	"vault.confirmDelete": "Vahvista",
	"vault.confirmReplace": "Korvaa",
	"vault.replacePromptInUse":
		'"{{name}}" on käytössä {{count}} kertaa {{files}} tiedostossa. Valitse callout, jolla se korvataan:',
	"vault.replacePromptUnused": 'Valitse callout, jolla korvataan "{{name}}":',
	"vault.noReplacementAvailable":
		"Ei muita callouteja saatavilla korvaukseksi.",
	"vault.convertedToPlainText":
		"{{blocks}} callout-lohkoa {{files}} tiedostossa muunnettu tavalliseksi tekstiksi.",
	"vault.resetAliasWarning":
		"{{count}} viite(ttä) {{files}} tiedostossa käyttää mukautettuja aliaksia: {{aliases}}. Ne lopettavat toimintansa palautuksen jälkeen. Jatketaanko?",
	"vault.resetConfirm": "Palauta",
	"vault.resetAllInUse":
		"⚠ {{count}} callout-viite(ttä) {{files}} tiedostossa käyttää mukautettuja callout-tyyppejä, jotka poistetaan.",
	"quickInsert.title": "Lisää lohko-callout nopeasti",
	"quickInsert.desc": "Valitse callout lisättäväksi kohdistimen kohdalle. Vain lohko-callout.",
	"quickInsert.searchPlaceholder": "Hae callouteja",
	"quickInsert.sourceAria": "Suodata callout-lähteen mukaan",
	"quickInsert.sourceAll": "Kaikki",
	"quickInsert.sourceBuiltIn": "Sisäänrakennettu",
	"quickInsert.sourceUser": "Omat calloutini",
	"quickInsert.editAria": "Muokkaa {{name}}",
	"quickInsert.insertAria": "Lisää {{name}} lohko-callout'ina",
	"quickInsert.noResults": "Ei löytyneitä callouteja",
	"quickInsert.noUserCallouts": "Et ole vielä luonut yhtään calloutia.",
	"quickInsert.noEditorHint": "Yhtään muistiinpanoa ei ole avoinna muokkaustilassa, joten mitään ei voida lisätä.",
	"quickInsert.noEditor": "Avaa muistiinpano muokkaustilassa lisätäksesi calloutin.",

	"vaultStats.title": "Callout-tilastot",
	"vaultStats.totalCallouts": "Callouteja yhteensä",
	"vaultStats.typesFound": "Löydetyt tyypit",
	"vaultStats.filesWithCallouts": "Tiedostot, joissa on callouteja",
	"vaultStats.filesScanned": "Skannatut Markdown-tiedostot",
	"vaultStats.empty": "Markdown-muistiinpanoissa ei löydetty callouteja.",
	"vaultStats.columnType": "Tyyppi",
	"vaultStats.columnName": "Nimi",
	"vaultStats.columnSource": "Lähde",
	"vaultStats.columnCount": "Määrä",
	"vaultStats.columnFiles": "Tiedostot",
	"vaultStats.unknown": "Tuntematon",
	"vaultStats.sourceBuiltIn": "Sisäänrakennettu",
	"vaultStats.sourceCustom": "Mukautettu",
	"vaultStats.sourceAutoFallback": "Automaattinen vara",
	"vaultStats.sourceTheme": "CSS-katkelma",
	"vaultStats.sourceAlias": "{{id}}:n alias",
	"vaultStats.sourceUnknown": "Tuntematon",
	"vaultStats.byRole": "Kirjoitettu muodossa",
	"vaultStats.roleBlock": "Lohko",
	"vaultStats.roleHeading": "Otsikko",
	"vaultStats.roleInline": "Rivin sisäinen",
	"vaultStats.defineUndefined": "Määritä {{count}} puuttuvaa",
	"vaultStats.defineRunning": "Skannataan",
	"vaultStats.defineDone": "{{count}} callout-tyyppiä lisätty.",
	"vaultStats.close": "Sulje",
	"import.title": "Tuontiongelmat",
	"import.reportLeadIn":
		"Näyttää siltä, että tuomasi tiedosto on muokattu. Tässä on ongelmaluettelo:",
	"import.reportLeadInFatal":
		"Tämä tiedosto ei näytä Callout Studio -vienniltä. Sitä ei voi tuoda:",
	"import.entryHeading": "Merkintä {{index}} — {{label}}",
	"import.summary":
		"{{valid}}/{{total}} merkintää on kelvollisia · löydetty {{issues}} ongelma(a).",
	"import.btnCancel": "Peruuta",
	"import.btnImportValid": "Tuo vain kelvolliset ({{count}})",
	"import.err.notRecognized":
		"Tunnistamaton tiedosto: odotettiin callout-määritelmien taulukkoa tai Callout Studio -vientiä.",
	"import.warn.settingsIgnored":
		"Asetuslohko ei ollut kelvollinen objekti, ja se jätettiin huomiotta.",
	"import.warn.invalidGradient":
		"Taustan liukuväri ei ollut kelvollinen, ja se jätettiin huomiotta.",
	"import.err.parseFailed":
		"Tiedosto ei ole kelvollinen JSON eikä sitä voitu jäsentää.",
	"import.err.entryNotObject": "Merkinnän on oltava objekti.",
	"import.err.requiredMissing":
		'Pakollinen kenttä "{{field}}" puuttuu tai on väärää tyyppiä.',
	"import.err.idEmpty": "Tunnus ei saa olla tyhjä.",
	"import.err.idTooLong":
		'Tunnus "{{value}}" on {{length}} merkkiä; enimmäismäärä on {{max}}.',
	"import.err.idBadChar":
		'Tunnus "{{value}}" sisältää virheellisiä merkkejä ("|", "[", "]", sarkaimet ja rivinvaihdot eivät ole sallittuja).',
	"import.err.idMetadata":
		'Tunnus "{{value}}" sisältää "|". Obsidianissa kaikki ensimmäisen "|" jälkeen on callout-metatietoa, ei osa tyyppiä, joten tämä merkintä kuvaa calloutia "{{id}}". Ohitettu, jotta olemassa oleva "{{id}}" pysyy muuttumattomana.',
	"import.err.displayNameEmpty": "Näyttönimi ei saa olla tyhjä.",
	"import.err.displayNameTooLong":
		"Näyttönimi on {{length}} merkkiä; enimmäismäärä on {{max}}.",
	"import.err.boolField":
		'"{{field}}" on oltava totuusarvo (true tai false).',
	"import.err.iconNotObject": "Kuvakkeen on oltava objekti.",
	"import.err.iconTypeInvalid":
		'Kuvaketyyppi "{{value}}" ei ole yksi seuraavista: {{types}}.',
	"import.warn.iconFieldIgnored":
		'"{{field}}" koskee vain Material-kuvakkeita ja ohitetaan kuvaketyypille {{type}}.',
	"import.err.iconValueEmpty":
		"Kuvakkeen arvon on oltava ei-tyhjä merkkijono.",
	"import.err.iconValueTooLong":
		"Kuvakkeen arvo on epätavallisen pitkä ({{length}} merkkiä).",
	"import.err.materialStyle":
		'Material-kuvaketyyli "{{value}}" ei ole yksi seuraavista: outlined, filled, rounded, sharp.',
	"import.err.materialWeight":
		'Material-kuvakkeen paino "{{value}}" on oltava kokonaisluku välillä 100–700 portain 100.',
	"import.warn.iconRecolorIgnored":
		'"recolor" koskee vain omia kuviasi ja ohitetaan kuvaketyypille {{type}}.',
	"import.err.iconRecolorInvalid":
		'"recolor" on oltava true tai false (saatiin "{{value}}").',
	"import.err.colorInvalid":
		'"{{field}}" on oltava hex-väri kuten "#448aff" (saatiin "{{value}}").',
	"import.err.numberRange":
		'"{{field}}" on oltava luku välillä {{min}}–{{max}} (saatiin "{{value}}").',
	"import.err.iconSizeRange":
		'"{{field}}" on oltava luku välillä {{min}}–{{max}} (saatiin "{{value}}").',
	"import.err.iconAdjustShape":
		'"iconAdjust" must be an object mapping a callout type ("regular", "heading", "inline") to its icon size and offsets.',
	"import.err.aliasesNotArray": '"aliases" on oltava merkkijonotaulukko.',
	"import.err.aliasNotString": "Aliaksen on oltava merkkijono.",
	"import.err.aliasDup": 'Alias "{{value}}" on tässä merkinnässä kahdesti.',
	"import.err.tooManyIds":
		"Liikaa tunnuksia ({{count}}); jokaisella calloutilla voi olla korkeintaan {{max}} tunnusta (ensisijainen + aliakset).",
	"import.err.metadataShape":
		'"metadata" on oltava objekti, jonka kaikki arvot ovat merkkijonoja.',
	"import.warn.unknownFields": "Tuntemattomat kentät ohitettu: {{fields}}.",
	"import.err.duplicateInFile":
		'Tunnus/alias "{{value}}" on jo merkinnän #{{first}} käytössä tässä tiedostossa.',
	"import.err.aliasConflict":
		'Alias "{{value}}" on jo toisen calloutin ("{{other}}") käytössä holvissasi.',
	"import.warn.defaultFoldedAutofix":
		'"defaultFolded" oli true, kun "foldable" oli false; defaultFolded palautettiin arvoon false.',
	"import.warn.imageMissing":
		"Tämä Callout käyttää kuvaa, jota ei ole tiedostossa eikä tässä vaultissa, joten se näyttää paikkamerkkikuvakkeen, kunnes annat uuden.",
	"import.err.paletteIdInvalid":
		'"paletteId" on oltava ei-tyhjä tekstitunniste (saatiin "{{value}}").',
	"import.warn.iconNameUnknown":
		'Kuvaketta "{{value}}" ei ole {{type}}:ssa, joten käytettiin oletuskuvaketta.',
	"import.warn.cmIconUnknownNew":
		'Kuvaketta "{{value}}" ei ole tässä holvissa, joten käytettiin oletuskuvaketta.',
	"import.warn.cmIconUnknownExisting":
		'Kuvaketta "{{value}}" ei ole tässä holvissa, joten "{{id}}" säilytti jo olemassa olevan kuvakkeensa.',
	"import.chooseSource": "Tuo kohteesta",
	"import.sourceStudio": "Callout Studio",
	"import.sourceStudioDesc": "Lataa Callout Studiosta viety .json-tiedosto.",
	"import.sourceCalloutManager": "Callout Manager",
	"import.sourceCalloutManagerDesc":
		"Tuo mukautetut calloutisi Callout Manager -laajennuksesta.",
	"import.sourceAdmonition": "Admonition",
	"import.sourceAdmonitionDesc":
		"Tuo omat admonitionisi Admonition-laajennuksesta.",
	"import.cmTitle": "Tuo Callout Managerista",
	"import.cmInstructions":
		"Jokainen mukautettu callout tuodaan kuvakkeineen ja väreineen. Teemakohtaiselle " +
		"tyylittelylle ja mukautetulle CSS:lle ei ole vastinetta täällä, joten ne jäävät tuomatta.",
	"import.cmFromVault": "Tämä holvi",
	"import.cmVaultChecking": "Etsitään Callout Manager -laajennusta…",
	"import.cmVaultFound": "{{count}} mukautettua callouttia löydetty.",
	"import.cmVaultNotFound":
		"Tästä holvista ei löytynyt mukautettuja callouteja.",
	"import.cmPasteLabel":
		"Tai liitä Callout Managerin kopioimat tyylit tähän:",
	"import.cmPlaceholder": "Liitä kopioidut tyylit tai data.json tähän…",
	"import.cmBtnCancel": "Peruuta",
	"import.cmBtnImport": "Tuo",
	"import.err.cmNoBlocksFound":
		"Liitetystä tekstistä ei löydetty Callout Manager -tyylejä.",
	"import.err.cmNotRecognized":
		"Tuntematon tiedosto: odotettiin Callout Managerin Copy-painikkeen tuottamia " +
		"tyylejä tai Callout Managerin data.json-tiedostoa.",
	"import.err.cmNoEntries": "Tuotavia mukautettuja callouteja ei löytynyt.",
	"import.err.cmNoColorForNew":
		'Uudelle calloutille "{{value}}" ei löydetty käyttökelpoista väriä; se ohitettiin.',
	"import.err.cmIdConflict":
		'Tunnus "{{value}}" on jo käytössä toisen calloutin aliaksena ("{{other}}") ja se ohitettiin.',
	"import.warn.cmNoColorDefault":
		"Callout Managerissa ei ollut asetettu väriä, joten käytettiin sen oletusharmaata.",
	"import.warn.cmThemeCondition":
		"Tämän calloutin väri tai kuvake oli asetettu vain yhdelle teemalle. Callout " +
		"Studiossa ei ole teemakohtaista tyylittelyä, joten se tuotiin kaikille teemoille.",
	"import.warn.cmCustomStyles":
		"Tällä calloutilla on myös mukautettu CSS Callout Managerissa. Kyseinen tyylittely " +
		"ei ole osa tuontia, joten vain sen kuvake ja väri tuotiin.",

	// Import — Admonition
	"import.admTitle": "Tuo Admonitionista",
	"import.admInstructions":
		"Jokainen admonition tulee tänne calloutina nimineen, " +
		"kuvakkeineen ja väreineen. Asetukset, joille ei ole vastinetta " +
		"Callout Studiossa (komento, kopiointipainike, piilotettu " +
		"otsikko), jäävät pois.",
	"import.admFromVault": "Tämä holvi",
	"import.admVaultChecking": "Etsitään Admonition-laajennusta…",
	"import.admVaultFound": "Löytyi {{count}} omaa admonitionia.",
	"import.admVaultNotFound": "Tästä holvista ei löytynyt omia admonitioneja.",
	"import.admFromFile": "Tiedosto",
	"import.admFromFileDesc": "admonitions.json-tiedosto tai jaettu paketti.",
	"import.admChooseFile": "Valitse tiedosto…",
	"import.admPasteLabel": "Tai liitä JSON tähän:",
	"import.admPlaceholder": "Liitä admonitionisi tähän…",
	"import.admBtnCancel": "Peruuta",
	"import.admBtnImport": "Tuo",
	"import.err.admNotRecognized":
		"Tiedostoa ei tunnistettu: odotettiin admonition-luetteloa tai " +
		"Admonitionin data.json-tiedostoa.",
	"import.err.admNoEntries": "Tuotavia admonitioneja ei löytynyt.",
	"import.err.admTypeMissing":
		'Tältä admonitionilta puuttuu "type", joten se ohitettiin.',
	"import.warn.admIconUnknown":
		'Missään kuvakekirjastossa ei ole kuvaketta nimeltä "{{value}}", ' +
		"joten käytettiin oletuskuvaketta.",
	"import.warn.admIconUnknownExisting":
		'Missään kuvakekirjastossa ei ole kuvaketta nimeltä "{{value}}", ' +
		'joten "{{id}}" säilytti entisen kuvakkeensa.',
	"import.warn.admImageFailed":
		"Ladattua kuvaa ei voitu lukea, joten käytettiin oletuskuvaketta.",
	"import.warn.admIconWithCss":
		"Tämän admonitionin ulkoasu tulee Admonitionin CSS-katkelmasta. " +
		"Se ei kuulu tuontiin, joten mukaan tulivat vain nimi, kuvake ja " +
		"väri.",
	"import.warn.admNoColor":
		"Väriä ei ollut asetettu, joten käytettiin oletussinistä.",
	"import.warn.admTitleTruncated":
		"Otsikko on {{length}} merkkiä; se lyhennettiin {{max}} merkkiin.",

	"footer.tagline":
		"Onko sinulla palautetta, kommentteja tai ehdotuksia? Kuulisin mielelläni!",
	"footer.madeBy": "Luonut Niv  •  ",
	"settings.deletePaletteConfirmLinkedOne":
		'Poistetaanko paletti "{{name}}"?\n1 callout käyttää sitä. Se säilyttää värinsä, ja voit yhdistää sen myöhemmin uudelleen editorin Väririviltä.',
	"settings.deletePaletteConfirmLinked":
		'Poistetaanko paletti "{{name}}"?\n{{count}} calloutia käyttää sitä. Ne säilyttävät värinsä, ja voit yhdistää ne myöhemmin uudelleen minkä tahansa editorinsa Väririviltä.',
	"settings.unlinkedColors": "Irrotetut värit",
	"settings.unlinkedColorsDesc":
		"Calloutit, joiden tallennettu väri poistettiin. Ne säilyttävät aiemmat värinsä; palauttaminen tallentaa värin uudelleen ja yhdistää koko ryhmän uudelleen.",
	"settings.unlinkedColorOne": "1 callout",
	"settings.unlinkedColorCount": "{{count}} calloutia",
	"settings.restoreColor": "Palauta",
	"settings.palettesMergedNotice":
		"Yhdistettiin {{count}} tuotua palettia tallennettuihin väreihin, joilla oli jo samat värit.",
	"notice.palettesMerged":
		"Yhdistettiin {{count}} tallennettua väriä, joilla oli samat värit: {{names}}. Niitä käyttävät calloutit säilyttävät värinsä ja ovat nyt linkitetty jäljelle jääneeseen väriin.",
	"editor.colorsDescDeleted":
		"Tämän calloutin tallennettu väri poistettiin. Voit tallentaa sen uudelleen {{link}}.",
	"editor.colorsDescDeletedOther":
		"Tämän calloutin tallennettu väri poistettiin. Voit tallentaa sen uudelleen {{link}} — myös 1 muu sitä käyttävä callout yhdistetään uudelleen.",
	"editor.colorsDescDeletedOthers":
		"Tämän calloutin tallennettu väri poistettiin. Voit tallentaa sen uudelleen {{link}} — myös {{count}} muuta sitä käyttävää calloutia yhdistetään uudelleen.",
	"editor.colorsDescDeletedLink": "klikkaamalla tästä",
	"palette.colorExists":
		'Nämä värit ovat samat kuin "{{name}}". Kaksi tallennettua väriä ei voi olla sama — muuta yhtä väriä erottaaksesi ne.',
	"palette.colorExistsUse":
		'Nämä värit ovat samat kuin "{{name}}". Kaksi tallennettua väriä ei voi olla sama — muuta yhtä väriä tai {{link}}.',
	"palette.colorExistsUseLink": "käytä olemassa olevaa",
	"locale.downloading": "Ladataan käännöstä…",
	"locale.notDownloaded": "{{name}} ei ole vielä ladattu",
	"locale.notDownloadedDesc":
		"Callout Studio näyttää englanninkielisenä, kunnes käännös voidaan ladata. Se yrittää uudelleen, kun Obsidian käynnistetään seuraavan kerran.",
	"locale.retry": "Yritä uudelleen",
	"locale.diskWriteFailed":
		"Callout Studio ei voinut tallentaa käännöstä levylle, joten se on ladattava uudelleen seuraavalla kerralla.",
	"notice.exportedCssCreated": "CSS-katkelma tallennettu sijaintiin {{path}}",
	"notice.exportedCssUpdated": "CSS-katkelma päivitetty sijaintiin {{path}}",
	"notice.exportedCssUnchanged": "CSS-katkelma on jo ajan tasalla.",
	"notice.exportCssEmpty": "Vietäviä mukautettuja callouteja ei ole.",
	"notice.exportCssFailed":
		"CSS-katkelmaa ei voitu tallentaa. Katso lisätietoja kehittäjäkonsolista.",
	"notice.exportCssEnabled":
		"Tämä katkelma on käytössä tässä vaultissa. Callout Studio tyylittelee nämä calloutit jo, ja katkelma säilyttää vientihetken tyylin.",
	"confirm.titleOverwriteSnippet": "Korvaa CSS-katkelma",
	"confirm.overwriteSnippet":
		"Snippets-kansiossa oleva CSS-katkelma on muuttunut sen jälkeen, kun Callout Studio kirjoitti sen. Uusi vienti korvaa koko tiedoston.",
	"confirm.overwriteSnippetOk": "Korvaa",
	"export.chooseFormat": "Vie muodossa",
	"export.formatJson": "Callout Studion varmuuskopio",
	"export.formatJsonDesc":
		".json-tiedosto, joka sisältää calloutit ja asetukset tuontia varten toiseen vaultiin.",
	"export.formatCss": "CSS-katkelma",
	"export.formatCssDesc":
		".css-tiedosto tämän vaultin snippets-kansiossa käytettäväksi siellä, missä Callout Studioa ei ole asennettu. Se kattaa vain tavalliset calloutit ja on tilannekuva; vie uudelleen muutoksen jälkeen.",
	"quickInsert.readingViewHint": "Tämä muistiinpano on avoinna lukutilassa, joten mitään ei voida lisätä.",
	"quickInsert.readingView": "Vaihda lähdetilaan tai Live Previewiin lisätäksesi calloutin.",
	"quickInsert.noCursorHint": "Tässä muistiinpanossa ei ole kohdistinta, joten lisäämiselle ei ole paikkaa.",
	"quickInsert.noCursor": "Aseta kohdistin muistiinpanoon kohtaan, johon haluat lisätä calloutin, ja yritä uudelleen.",
};
