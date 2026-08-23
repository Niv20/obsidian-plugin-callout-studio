export const tr: Record<string, string> = {
	"cmd.openSettings": "Ayarları aç",
	"cmd.createCallout": "Yeni callout türü oluştur",
	"cmd.insertEmptyCallout": "Boş callout ekle",
	"cmd.calloutWrap": "Callout'a sar",
	"cmd.calloutUnwrap": "Callout'u kaldır",

	"cmd.customWrapBlock": "{{name}} blok callout'una sar",
	"cmd.customInsertBlock": "{{name}} blok callout'u ekle",
	"cmd.customInsertHeading": "H{{level}} {{name}} başlık callout'u ekle",
	"cmd.customInsertInline": "{{name}} satır içi callout'u ekle",
	"cmd.openQuickInsert": "Blok callout'u hızlı ekle",

	"autocomplete.createNew": 'Yeni callout oluştur: "{{name}}"',

	"settings.fallbackTag": "Varsayılan",
	"settings.fallbackTagAuto": "Otomatik varsayılan",
	"settings.rescanVault": "Vault'u yeniden tara",
	"settings.rescanVaultDesc":
		"Notlardaki tanınmayan callout ID'lerini bulur ve geri dönüş satırları olarak ekler.",
	"settings.rescanVaultHintAction": "Şimdi tara",
	"settings.rescanComplete":
		"Yeniden tarama tamamlandı: {{count}} yeni callout eklendi.",
	"replaceModal.deleteWithoutReplaceSuffix": "(varsayılana geri döner)",
	"replaceModal.titleDelete": "Callout'u sil",
	"replaceModal.titleReplace": "Vault'ta değiştir",

	"firstRun.title": "Vault'unuzdaki mevcut callout'ları bulsun mu?",
	"firstRun.body":
		"Callout Studio, zaten kullandığınız callout'ları keşfetmek için vault'unuzu tarayabilir; bunlar ayarlar listenizde görünür ve geri dönüş stilinizi benimser.",
	"firstRun.heavyVaultNote":
		"Vault'unuzda {{count}} Markdown dosyası var — tarama birkaç saniye sürebilir.",
	"firstRun.laterHint":
		"Bunu daha sonra Ayarlar → Vault içgörüleri ve bakımı → Vault'u yeniden tara üzerinden her zaman çalıştırabilirsiniz.",
	"firstRun.scanNow": "Şimdi tara",
	"firstRun.noThanks": "Hayır, teşekkürler",
	"firstRun.autoScanComplete":
		"Callout Studio vault'unuzu taradı ve {{count}} callout ekledi.",
	"firstRun.scanning": "Taranıyor",

	"welcome.tooltip": "Callout Studio hakkında",
	"welcome.title": "Callout Studio'ya hoş geldiniz",
	"welcome.tagline":
		"Obsidian callout'larını yönetmek için eksiksiz çözümünüz.",
	"welcome.previewTitle": "Aksiyon halinde görün",
	"welcome.sample":
		"Callout Studio, özel bir simge, renkler ve ad ile callout'lar oluşturmanızı sağlar.\n\n" +
		"Aynı callout'u **üç** farklı şekilde kullanabilirsiniz:\n\n" +
		"## [!tip] Başlık olarak\n" +
		"Herhangi bir başlığı callout stiline dönüştürmek için `#` işaretlerinin hemen ardından `[!type]` ekleyin.\n\n" +
		"Bunun gibi satır içi bir callout mu istiyorsunuz [!warning]? Akışınızı bozmadan bir cümlenin ortasına `[!type]` eklemeniz yeterli.\n\n" +
		"> [!note] Block Callout\n" +
		"> Elbette, klasik callout zaten alışık olduğunuz aynı sözdizimiyle çalışır: `> [!type]`.\n\n" +
		"Callout Studio'nun sunacağı çok daha fazlası var! [Daha fazla bilgi]({{repoUrl}}).\n",

	"deleteModal.title": '"{{name}}" callout\'unu sil?',
	"deleteModal.bodyInUse":
		"Bu callout {{files}} dosyada {{count}} kez görünüyor.",
	"deleteModal.bodyInUseExplain":
		"Silmek, bu blokları düz metne dönüştürür — stil ve callout başlığını kaybeder.",
	"deleteModal.replaceHint":
		"Bunun yerine başka bir callout ile değiştirebilir, böylece vault içeriğini biçimli callout olarak koruyabilirsiniz.",
	"deleteModal.bodyUnused":
		'"{{name}}" hiçbir notta kullanılmıyor, ancak oluşturduğunuz özel bir callout. Silmek onu bu listeden kaldırır.',
	"deleteModal.replaceInstead": "Bunun yerine değiştir",
	"deleteModal.deleteInUse": "Sil (düz metne dönüştür)",
	"deleteModal.deleteUnused": "Callout'u sil",

	"settings.title": "Callout Studio",
	"settings.myCalloutTypes": "Callout türlerim",
	"settings.builtInCallouts": "Yerleşik callout'lar",
	"settings.contextMenu": "Bağlam menüsü",
	"settings.autocomplete": "Otomatik tamamlama",
	"settings.keyboardShortcuts": "Klavye kısayolları",
	"settings.language": "Dil",
	"settings.languageDesc":
		"Callout Studio görüntüleme dili. Varsayılan olarak Obsidian'ın arayüz dilini izler.",
	"settings.languageAuto": "Otomatik (Obsidian ile aynı)",
	"settings.importExport": "İçe aktar / dışa aktar",
	"settings.import": "İçe aktar",
	"settings.export": "Dışa aktar",
	"settings.importDesc":
		"JSON dosyası kullanarak başka bir vault'tan Callout Studio verilerinizi içe aktarın.",
	"settings.exportDesc":
		"Tüm özel callout türlerinizi JSON formatında kaydedin.",
	"settings.importConflictNotice":
		"{{count}} callout türü içe aktarıldı; {{overwritten}} mevcut kayıt üzerine yazıldı.",

	"settings.addNewCallout": "+ callout ekle",

	"settings.noCalloutsNow": "Şu an özel callout yok.",

	"settings.editAria": "{{name}} düzenle",
	"settings.moreRowActionsAria": "{{name}} için daha fazla eylem",
	"settings.usageInfo": "{{files}} dosyada {{count}} kullanım",
	"settings.replaceAction": "Vault'ta değiştir",
	"settings.deleteAction": "Sil",
	"settings.resetAction": "Varsayılana sıfırla",
	"settings.makeFallbackAction": "Varsayılan geri dönüş stilini kullan",

	"settings.colorSwatchAria": "Vurgu: {{accent}} · Arka plan: {{bg}}",
	"settings.externalStyleTag": "Harici stil",
	"settings.externalStyleAction": "Harici stili kullan (tema veya CSS)",
	"settings.externalStyleBlocked":
		"bu varsayılan yedek callout, önce başka birini seçin",
	"settings.fallbackCallout": "Varsayılan geri dönüş callout'u",
	"settings.fallbackCalloutDesc":
		"Vault'unuzdaki tanınmayan callout türleri bu callout'un stilini devralır.",

	"settings.globalStyle": "Genel callout stili",
	"settings.border": "Kenarlıklar",
	"settings.borderAll": "Tümü",
	"settings.borderTop": "Üst",
	"settings.borderRight": "Sağ",
	"settings.borderBottom": "Alt",
	"settings.borderLeft": "Sol",
	"settings.borderWidth": "Kenarlık kalınlığı",
	"settings.fontScaleGroup": "Yazı tipi ölçeği",
	"settings.titleScale": "Başlık",
	"settings.contentScale": "İçerik",
	"settings.inlineTextScale": "Metin",
	"settings.shapeGroup": "Şekil",
	"settings.borderRadius": "Köşe yuvarlaklığı",
	"settings.alignGroup": "Hizalama",
	"settings.alignContent": "İçeriği başlıkla hizala",
	"settings.headingSpacingGroup": "Başlık aralığı",
	"settings.headingPadVertical": "Dikey aralık",
	"settings.headingGap": "Başlıklar arası boşluk",
	"settings.headingFoldGroup": "Katla",
	"settings.headingFoldArrow": "Katlama okunu göster",
	"settings.styleDemoName": "Örnek",
	"settings.previewTitle": "Önizleme",

	// Settings — Saved color palettes
	"settings.customPalettes": "Kaydedilmiş renk paletleri",
	"settings.newPalette": "Yeni palet",
	"settings.customPalettesEmpty": "Şu an kaydedilmiş palet yok.",
	"settings.editPaletteAria": "{{name}} paletini düzenle",
	"settings.deletePaletteAria": "{{name}} paletini sil",
	"settings.deletePaletteConfirm":
		'"{{name}}" paletini sil?\nBu renkleri kullanan callout öğeleri etkilenmez.',
	"settings.enableAutocomplete": "[! Otomatik tamamlamayı etkinleştir",
	"settings.enableAutocompleteDesc":
		'Düzenleyicide blok alıntı içinde "[!" yazdığınızda öneriler gösterir. Tam bir callout başlığı eklemek için listeden bir callout türü seçin.',

	"settings.customCommands": "Komutlar ve kısayollar",
	"settings.customCommandsDesc":
		"Her Callout Studio komutunu ve bağlı olduğu kısayolu görün, en sık kullandığınız callout'lar için kendi komutlarınızı oluşturun. Varsayılan olarak kısayol atanmamıştır.",
	"settings.customCommandsButton": "Komutları yönet",

	"commandBuilder.title": "Komutlar ve kısayollar",
	"commandBuilder.desc":
		"Obsidian'ın kısayol ayarlarında bir kısayol belirlemek veya değiştirmek için + düğmesini kullanın.",
	"commandBuilder.builtIn": "Yerleşik komutlar",
	"commandBuilder.toggleAria": "{{name}} komutunu aç veya kapat",
	"commandBuilder.hotkeyBlank": "Boş",
	"commandBuilder.hotkeyAria": "{{name}} için bir kısayol belirle",
	"commandBuilder.yourCommands": "Komutlarınız",
	"commandBuilder.newCommand": "Yeni komut",
	"commandBuilder.empty": "Henüz özel komut yok.",
	"commandBuilder.unknownCommand": "bu komut",
	"commandBuilder.editAria": "{{name}} düzenle",
	"commandBuilder.deleteAria": "{{name}} sil",
	"commandBuilder.deleteConfirm":
		"{{name}} komutu silinsin mi? Ona atanmış kısayol varsa çalışmayı durduracak.",
	"commandBuilder.newTitle": "Yeni komut",
	"commandBuilder.editTitle": "Komutu düzenle",
	"commandBuilder.format": "Callout biçimi",
	"commandBuilder.formatDesc": "Komutun yazacağı callout türü.",
	"commandBuilder.formatHeading": "Başlık",
	"commandBuilder.formatInline": "Satır içi",
	"commandBuilder.formatBlock": "Blok",
	"commandBuilder.roleDisabled":
		"Bu biçim kapalı, bu yüzden siz tekrar açana kadar komut düz metin ekleyecek.",
	"commandBuilder.callout": "Callout türü",
	"commandBuilder.calloutDesc": "Bu komutun ekleyeceği callout.",
	"commandBuilder.headingLevel": "Başlık düzeyi",
	"commandBuilder.headingLevelDesc": "Hangi başlık düzeyinin yazılacağı.",
	"commandBuilder.action": "Eylem",
	"commandBuilder.actionDesc":
		"Sar, seçimi bir callout'a dönüştürür; ekle boş bir tane ekler.",
	"commandBuilder.actionWrap": "Seçimi sar",
	"commandBuilder.actionInsert": "Yeni ekle",
	"commandBuilder.preview": "Komut adı",
	"commandBuilder.duplicate":
		"Tam olarak aynısını yapan bir komutunuz zaten var.",
	"commandBuilder.noCallouts":
		"Henüz bir komut oluşturabileceğiniz callout türü yok.",
	"commandBuilder.save": "Kaydet",

	"settings.vaultMaintenance": "Vault içgörüleri ve bakımı",
	"settings.vaultStats": "Callout istatistikleri",
	"settings.vaultStatsDesc":
		"Markdown notlarınızdaki her callout'u — blok, başlık ve satır içi — sayar ve türe göre gruplar.",
	"settings.vaultStatsButton": "İstatistikleri görüntüle",
	"settings.vaultStatsScanning": "Taranıyor",
	"settings.resetAll": "Sıfırla",
	"settings.resetAllDesc":
		"Tüm kullanıcı callout'larını siler, yerleşik callout'ları, global stilleri (kenarlıklar, yazı tipi ölçeği, şekil), kaydedilmiş renk paletlerini, sağ tık menüsü özelleştirmesini ve indirilen Material SVG'leri sıfırlar.",
	"settings.resetAllButton": "Her şeyi sıfırla",
	"settings.resetAllConfirm":
		"Bu işlem tüm özel callout'ları siler, yerleşik callout'ları, global stilleri, kaydedilmiş renk paletlerini, sağ tık menüsü özelleştirmesini ve önbelleğe alınmış tüm Material SVG'leri sıfırlar. Bu işlem geri alınamaz. Emin misiniz?",
	"notice.resetAllDone": "Her şey varsayılanlara sıfırlandı.",

	"notice.customCommandsRemoved":
		"Callout türü artık mevcut olmayan {{count}} özel komut kaldırıldı.",
	"notice.customCommandMissingCallout":
		"Bu komutun callout türü artık mevcut değil.",
	"notice.exported":
		"Callout'lar callout-studio-export.json dosyasına dışa aktarıldı",
	"notice.importedJSON": "JSON'dan {{count}} callout türü içe aktarıldı.",
	"notice.importedSettings": "Eklenti ayarları içe aktarıldı.",
	"notice.importedCalloutManager":
		"Callout Manager'dan içe aktarıldı: {{created}} oluşturuldu, {{updated}} güncellendi.",
	"notice.importedAdmonition":
		"Admonition'dan içe aktarıldı: {{created}} oluşturuldu, " +
		"{{updated}} güncellendi.",
	"notice.noNewJSON":
		"Yeni callout türü içe aktarılmadı (ID'ler zaten mevcut olabilir).",
	"notice.iconDownloadFailed":
		'"{{name}}" Material simgesi indirilemedi. Bu stil/ağırlık için mevcut olmayabilir veya bağlantınız çevrimdışı olabilir.',
	"notice.externalStyleOn":
		'"{{name}}" artık temanız veya CSS parçanız tarafından stillendiriliyor.',
	"notice.externalStyleOff":
		'Callout Studio "{{name}}" öğesini yeniden stillendiriyor.',
	"notice.nothingToWrap": "Sarılacak bir şey yok.",
	"notice.cursorNotInsideCallout": "İmleç callout içinde değil.",
	"notice.autocompleteTargetMoved":
		"Hiçbir şey eklenmedi — düzenleyici açıkken satır değişti.",
	"notice.openHotkeysFailed": "Obsidian kısayol ayarları açılamadı.",
	"notice.filterHotkeysFailed":
		"Obsidian kısayolları açıldı, ancak Callout Studio filtresi uygulanamadı.",

	"editor.editCallout": "Callout düzenle",
	"editor.newCallout": "Yeni callout",
	"editor.displayName": "Görünen ad",
	"editor.displayNameDesc":
		"Kullanıcı arayüzünde gösterilen okunabilir etiket",
	"editor.displayNameBuiltIn":
		"Yerleşik callout'lar için görünen ad değiştirilemez",
	"editor.displayNamePlaceholder": "Callout'um",
	"editor.calloutIds": "Callout ID'leri",
	"editor.calloutIdsDesc":
		"Bu callout için tüm tanımlayıcılar. Boşluklara izin verilir.\nEklemek için Enter veya + düğmesine basın.",
	"editor.calloutIdsPlaceholder": "ID ekle",
	"editor.addId": "ID ekle",
	"editor.idLinkedToName": "Görünen ada bağlı",
	"editor.idCannotDelete":
		"Bu ID, görünen ada bağlı olduğu için silinemez — değiştirmek için adı düzenleyin",
	"editor.icon": "Simge",
	"editor.pickIcon": "Simge değiştir",
	"editor.replaceIcon": "Simgeyi değiştir",
	"editor.removeIcon": "Simgeyi kaldır",
	"editor.noIcon": "Simge yok",
	"editor.resetIcon": "Simgeyi varsayılana sıfırla",
	"editor.livePreview": "Canlı önizleme",
	"editor.iconAdjustment": "Simge ayarı",
	"editor.picture": "Resim",
	"editor.size": "Boyut",
	"editor.horizontalOffset": "Yatay uzaklık",
	"editor.verticalOffset": "Dikey uzaklık",
	"editor.colors": "Renkler",
	"editor.colorsDesc":
		"Sets this callout's border, background, and text colors.",
	"editor.resetColors": "Renkleri varsayılana sıfırla",
	"editor.paletteDeleted": "Silinmiş renk",
	"editor.paletteGroupObsidian": "Obsidian callout'ları",
	"editor.paletteGroupPresets": "Renk ön ayarları",
	"editor.paletteGroupCustom": "Özel",
	"editor.paletteNewColor": "Yeni renk…",
	"editor.contrastWarning":
		"Arka plana karşı düşük kontrast — okunması zor olabilir",
	"editor.foldable": "Katlanabilir",
	"editor.foldableDesc":
		"Callout'un katlanabilir olup olmayacağını ve vault genelinde uygulanacak varsayılan durumu seçin.",
	"editor.foldOff": "Kapalı",
	"editor.foldOpen": "Varsayılan olarak açık",
	"editor.foldClosed": "Varsayılan olarak kapalı",
	"editor.cancel": "İptal",
	"editor.saveChanges": "Değişiklikleri kaydet",
	"editor.createCallout": "Callout oluştur",
	"editor.nameRequired": "Callout oluşturmadan önce görünen ad gereklidir.",
	"editor.noChangesToSave": "Herhangi bir değişiklik yapılmadı.",
	"editor.downloadingIcon": "Simge indiriliyor",
	"editor.idEmpty": "En az bir ID gereklidir",
	"editor.idExists": "Bu ID ile bir callout zaten mevcut",
	"editor.idConflict": "Bu ID mevcut bir callout ile çakışıyor",
	"editor.idDashConflict":
		'Obsidian boşlukları tire olarak yazar, bu yüzden bu ID "{{other}}" ile çakışıyor',
	"editor.untitledCallout": "Başlıksız Callout",
	"editor.loremIpsum":
		"Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
	"editor.loremIpsumShort":
		"Lorem ipsum dolor sit amet, consectetur adipiscing elit.",
	"editor.sampleInlineText":
		"İşte bir paragraf içinde satır içi bir [!{id}] hapı.",
	"editor.previewReadOnly": "Canlı önizleme düzenlenemez",

	// External style window (opens instead of the editor for a callout the
	// user handed to their theme / a CSS snippet)
	"editor.externalStyleTitle": "Callout Studio dışında stillendirildi",
	"editor.externalStyleBody":
		"Callout Studio, {{id}} öğesine hiçbir stil uygulamıyor. Görünümü temanızdan, bir CSS parçasından veya Obsidian'ın varsayılanlarından geliyor.",
	"editor.externalStyleWhat": "Bunun anlamı",
	"editor.externalStyleWhatHeading":
		"## [!{{id}}] Başlık gibi bir başlık callout'u işlenmeyecek — metin yazıldığı gibi kalır.",
	"editor.externalStyleWhatInline":
		"Satır içi bir tane de öyle, örneğin kelime [!{{id}}] kelime.",
	"editor.externalStyleWhatGlobal":
		"Genel stil ayarları (kenarlık, yarıçap, metin boyutu) buna uygulanmaz.",
	"editor.externalStylePreviewTitle": "Şu anda nasıl görüntüleniyor",
	"editor.externalStyleSample":
		"## [!{{id}}] Başlık\n\n" +
		"İçinde [!{{id}}] olan bir cümle böyle görünür.\n\n" +
		"> [!{{id}}] {{name}}\n" +
		"> Callout içeriği böyle görünür.\n",
	"editor.externalStyleResume": "Stili geri al",
	"editor.externalStyleClose": "Anladım",

	// Palette editor modal
	"palette.newTitle": "Yeni renk paleti",
	"palette.groupPalette": "Palet",
	"palette.editTitle": "Renk paletini düzenle",
	"palette.name": "Ad",
	"palette.namePlaceholder": "Paletim",
	"palette.nameExists": "Bu adla bir palet zaten var",
	"palette.baseColor": "Temel renk",
	"palette.baseColorHint":
		"Arka plan rengini otomatik olarak buna uyduracağız. İsterseniz {{link}} ile ayrı olarak kontrol edebilirsiniz.",
	"palette.baseColorHintLink": "buraya tıklayarak",
	"palette.advancedColors": "Renkler",
	"palette.advancedColorsHint":
		"{{mode}} modu için renkler düzenleniyor - diğer mod otomatik olarak güncellenir. Kontrol etmek için Obsidian temasını değiştirin.",
	"palette.revertHint":
		"Bunun yerine tek bir temel renk mi tercih edersiniz? {{link}}.",
	"palette.revertHintLink": "Geri al",
	"palette.lightMode": "Açık",
	"palette.darkMode": "Koyu",
	"palette.accentColor": "Vurgu rengi",
	"palette.backgroundColorChannel": "Arka plan rengi",
	"palette.textColorChannel": "Metin rengi",
	"palette.bgIntensity": "Yoğunluk",
	"palette.bgStyle": "Stil",
	"palette.bgSolid": "Düz renk",
	"palette.bgGradient": "Gradyan",
	"palette.bgTransparent": "Şeffaf",
	"palette.gradientTo": "İkinci renk",
	"palette.gradientDirection": "Yön",
	"palette.gradientText": "Gradyanlı başlık metni",
	"palette.save": "Kaydet",

	// Color name suggestions (used to prefill palette names)
	"colorName.red": "Kırmızı",
	"colorName.orange": "Turuncu",
	"colorName.amber": "Kehribar",
	"colorName.yellow": "Sarı",
	"colorName.lime": "Limon yeşili",
	"colorName.green": "Yeşil",
	"colorName.teal": "Deniz mavisi",
	"colorName.cyan": "Camgöbeği",
	"colorName.sky": "Gök mavisi",
	"colorName.blue": "Mavi",
	"colorName.indigo": "Çivit mavisi",
	"colorName.violet": "Eflatun",
	"colorName.purple": "Mor",
	"colorName.pink": "Pembe",
	"colorName.rose": "Gül kurusu",
	"colorName.brown": "Kahverengi",
	"colorName.gray": "Gri",
	"colorName.black": "Siyah",
	"colorName.white": "Beyaz",
	"colorName.crimson": "Kızıl",
	"colorName.coral": "Mercan",
	"colorName.grape": "Üzüm",
	"colorName.plum": "Erik",
	"colorName.bubblegum": "Sakız",

	"iconPicker.pickIcon": "Simge seç",
	"iconPicker.confirm": "Onayla",
	"iconPicker.cancel": "İptal",
	"iconPicker.lucide": "Lucide",
	"iconPicker.tabler": "Tabler Icons",
	"iconPicker.material": "Material",
	"iconPicker.emoji": "Emoji",
	"iconPicker.searchLucide": "Lucide simgelerini ara",
	"iconPicker.searchTabler": "Tabler simgelerini ara",
	"iconPicker.tablerStyle": "Simge stili",
	"iconPicker.tablerStyleOutline": "Çizgi",
	"iconPicker.tablerStyleFilled": "Dolu",
	"iconPicker.loadMore": "Daha fazla yükle",
	"iconPicker.materialStyle": "Simge stili",
	"iconPicker.materialStyleOutlined": "Çizgi (Outlined)",
	"iconPicker.materialStyleFilled": "Dolu (Filled)",
	"iconPicker.materialStyleRounded": "Yuvarlak (Rounded)",
	"iconPicker.materialStyleSharp": "Keskin (Sharp)",
	"iconPicker.materialWeight": "Simge kalınlığı",
	"iconPicker.materialWeight100": "İnce (Thin)",
	"iconPicker.materialWeight200": "Ekstra ince (Extra Light)",
	"iconPicker.materialWeight300": "Hafif (Light)",
	"iconPicker.materialWeight400": "Normal (Regular)",
	"iconPicker.materialWeight500": "Orta (Medium)",
	"iconPicker.materialWeight600": "Yarı kalın (Semi Bold)",
	"iconPicker.materialWeight700": "Kalın (Bold)",
	"iconPicker.materialFontFailed":
		"Material simgelerinin önizlemeleri yüklenemedi. Bunun yerine simge adları gösterilir — arama ve seçme yine de çalışır.",
	"iconPicker.materialFontRetry": "Tekrar dene",
	"iconPicker.searchMaterial": "Material simgelerini ara",
	"iconPicker.searchEmoji": "Emoji ara",
	"iconPicker.skinTone": "Ten rengi",
	"iconPicker.allCategories": "Tüm kategoriler",
	"iconPicker.noIconSelected": "Simge seçilmedi",
	"iconPicker.noResults": "Aramanızla eşleşen simge yok.",
	"iconPicker.octicons": "Octicons",
	"iconPicker.searchOcticons": "Octicons ara",
	"iconPicker.fa": "Font Awesome",
	"iconPicker.searchFa": "Font Awesome ara",
	"iconPicker.faStyle": "Simge stili",
	"iconPicker.faStyleSolid": "Düz",
	"iconPicker.faStyleRegular": "Normal",
	"iconPicker.faStyleBrands": "Markalar",
	"iconPicker.rpgAwesome": "RPG Awesome",
	"iconPicker.searchRpgAwesome": "RPG Awesome ara",
	"iconPicker.image": "Resimleriniz",
	"iconPicker.searchImage": "Resimlerinizde ara",
	"iconPicker.imageTooLarge":
		"{{name}} çok büyük. Resimler 5 MB'ın altında olmalıdır.",
	"iconPicker.imageUnsupported":
		"{{name}} desteklenen bir resim biçimi değil. SVG, PNG, JPEG veya WebP kullanın.",
	"iconPicker.imageInvalidSvg":
		"{{name}} güvenli SVG olarak okunamadı ve eklenmedi.",
	"iconPicker.imageDecodeFailed": "{{name}} resim olarak okunamadı.",
	"iconPicker.imageDuplicate":
		"{{name}} zaten resimlerinizde var. Dosyayı yeniden adlandırın veya mevcut resmi silin.",
	"iconPicker.imageAdd": "Resim ekle",
	"iconPicker.imageEmpty":
		"Henüz resim yok. Bilgisayarınızdan SVG, PNG, JPEG veya WebP dosyası ekleyin ya da buraya sürükleyin.",
	"iconPicker.imageDelete": "Sil",
	"iconPicker.imageDeleteConfirm": "“{{name}}” silinsin mi?",
	"iconPicker.imageDeleteInUse":
		"{{count}} callout bu resmi kullanıyor. Yeni bir resim belirtene kadar yer tutucu simge gösterilecek.",
	"iconPicker.imageRecolor": "Callout rengini izle",
	"iconPicker.allSources": "Tüm kaynaklar",
	"iconPicker.searchAllSources": "Tüm simge kaynaklarında ara",
	"iconPicker.sourcesNotDownloaded":
		"Henüz dahil edilmedi: {{names}}. İndirmek için yukarıdan bir kaynak seçin.",
	"iconPicker.chooseSource": "Kaynak seç",
	"iconPicker.sourceGroup": "{{name}} · {{count}}",

	// Source menu — what each library holds, in a few words
	"iconPicker.descAllSources": "tüm kütüphanelerde aynı anda ara",
	"iconPicker.descLucide": "Obsidian'ın kendi seti, her zaman çevrimdışı",
	"iconPicker.descTabler": "temiz ve tutarlı arayüz simgeleri, çizgi ve dolu",
	"iconPicker.descMaterial": "Google'ın seti, dört stil ve yedi kalınlık",
	"iconPicker.descEmoji": "renkli glifler, her cilt tonu",
	"iconPicker.descOcticons": "GitHub arayüz simgeleri",
	"iconPicker.descFa": "düz, normal ve markalar",
	"iconPicker.descRpgAwesome": "fantezi ve masa oyunları simgeleri",
	"iconPicker.descImage": "bilgisayarınızdan eklediğiniz resimler",

	// Icon picker — category filter dropdown labels
	"iconPicker.cat.Accessibility": "Erişilebilirlik",
	"iconPicker.cat.Actions": "Eylemler",
	"iconPicker.cat.Activities": "Etkinlikler",
	"iconPicker.cat.Alert": "Uyarı",
	"iconPicker.cat.Alphabet": "Alfabe",
	"iconPicker.cat.Android": "Android",
	"iconPicker.cat.Animals": "Hayvanlar",
	"iconPicker.cat.Arrows": "Oklar",
	"iconPicker.cat.Astronomy": "Astronomi",
	"iconPicker.cat.Audio&Video": "Ses ve Video",
	"iconPicker.cat.Automotive": "Otomotiv",
	"iconPicker.cat.Badges": "Rozetler",
	"iconPicker.cat.Brand": "Marka",
	"iconPicker.cat.Buildings": "Binalar",
	"iconPicker.cat.Business": "İş",
	"iconPicker.cat.Camping": "Kamp",
	"iconPicker.cat.Charity": "Hayır işleri",
	"iconPicker.cat.Charts": "Grafikler",
	"iconPicker.cat.Charts + Diagrams": "Grafikler ve Şemalar",
	"iconPicker.cat.Childhood": "Çocukluk",
	"iconPicker.cat.Clothing + Fashion": "Giyim ve Moda",
	"iconPicker.cat.Coding": "Kodlama",
	"iconPicker.cat.Communicate": "İletişim kur",
	"iconPicker.cat.Communication": "İletişim",
	"iconPicker.cat.Computers": "Bilgisayarlar",
	"iconPicker.cat.Connectivity": "Bağlantı",
	"iconPicker.cat.Construction": "İnşaat",
	"iconPicker.cat.Currencies": "Para birimleri",
	"iconPicker.cat.Database": "Veritabanı",
	"iconPicker.cat.Design": "Tasarım",
	"iconPicker.cat.Development": "Geliştirme",
	"iconPicker.cat.Devices": "Cihazlar",
	"iconPicker.cat.Devices + Hardware": "Cihazlar ve Donanım",
	"iconPicker.cat.Disaster + Crisis": "Afet ve Kriz",
	"iconPicker.cat.Document": "Belge",
	"iconPicker.cat.E-commerce": "E-ticaret",
	"iconPicker.cat.Editing": "Düzenleme",
	"iconPicker.cat.Education": "Eğitim",
	"iconPicker.cat.Electrical": "Elektrik",
	"iconPicker.cat.Emoji": "Emoji",
	"iconPicker.cat.Energy": "Enerji",
	"iconPicker.cat.Extensions": "Uzantılar",
	"iconPicker.cat.Files": "Dosyalar",
	"iconPicker.cat.Film + Video": "Film ve Video",
	"iconPicker.cat.Food": "Yiyecek",
	"iconPicker.cat.Food + Beverage": "Yiyecek ve İçecek",
	"iconPicker.cat.Fruits + Vegetables": "Meyve ve Sebze",
	"iconPicker.cat.Games": "Oyunlar",
	"iconPicker.cat.Gaming": "Oyun",
	"iconPicker.cat.Gender": "Cinsiyet",
	"iconPicker.cat.Genders": "Cinsiyetler",
	"iconPicker.cat.Gestures": "Jestler",
	"iconPicker.cat.Halloween": "Cadılar Bayramı",
	"iconPicker.cat.Hands": "Eller",
	"iconPicker.cat.Hardware": "Donanım",
	"iconPicker.cat.Health": "Sağlık",
	"iconPicker.cat.Holidays": "Tatiller",
	"iconPicker.cat.Home": "Ev",
	"iconPicker.cat.Household": "Ev eşyaları",
	"iconPicker.cat.Humanitarian": "İnsani yardım",
	"iconPicker.cat.Images": "Görseller",
	"iconPicker.cat.Laundry": "Çamaşır",
	"iconPicker.cat.Letters": "Harfler",
	"iconPicker.cat.Logic": "Mantık",
	"iconPicker.cat.Logistics": "Lojistik",
	"iconPicker.cat.Map": "Harita",
	"iconPicker.cat.Maps": "Haritalar",
	"iconPicker.cat.Maritime": "Denizcilik",
	"iconPicker.cat.Marketing": "Pazarlama",
	"iconPicker.cat.Math": "Matematik",
	"iconPicker.cat.Mathematics": "Matematik",
	"iconPicker.cat.Media": "Medya",
	"iconPicker.cat.Media Playback": "Medya Oynatma",
	"iconPicker.cat.Medical + Health": "Tıp ve Sağlık",
	"iconPicker.cat.Money": "Para",
	"iconPicker.cat.Mood": "Ruh hali",
	"iconPicker.cat.Moving": "Taşınma",
	"iconPicker.cat.Music + Audio": "Müzik ve Ses",
	"iconPicker.cat.Nature": "Doğa",
	"iconPicker.cat.Numbers": "Sayılar",
	"iconPicker.cat.Photography": "Fotoğrafçılık",
	"iconPicker.cat.Photos + Images": "Fotoğraflar ve Görseller",
	"iconPicker.cat.Political": "Siyasi",
	"iconPicker.cat.Privacy": "Gizlilik",
	"iconPicker.cat.Punctuation + Symbols": "Noktalama ve Semboller",
	"iconPicker.cat.Religion": "Din",
	"iconPicker.cat.Science": "Bilim",
	"iconPicker.cat.Science Fiction": "Bilim kurgu",
	"iconPicker.cat.Security": "Güvenlik",
	"iconPicker.cat.Shapes": "Şekiller",
	"iconPicker.cat.Shopping": "Alışveriş",
	"iconPicker.cat.Social": "Sosyal medya",
	"iconPicker.cat.Spinners": "Yükleme göstergeleri",
	"iconPicker.cat.Sport": "Spor",
	"iconPicker.cat.Sports + Fitness": "Spor ve Fitness",
	"iconPicker.cat.Symbols": "Semboller",
	"iconPicker.cat.System": "Sistem",
	"iconPicker.cat.Text": "Metin",
	"iconPicker.cat.Text Formatting": "Metin Biçimlendirme",
	"iconPicker.cat.Time": "Zaman",
	"iconPicker.cat.Toggle": "Anahtar",
	"iconPicker.cat.Transit": "Toplu Taşıma",
	"iconPicker.cat.Transportation": "Ulaşım",
	"iconPicker.cat.Travel": "Seyahat",
	"iconPicker.cat.Travel + Hotel": "Seyahat ve Otel",
	"iconPicker.cat.UI actions": "Arayüz eylemleri",
	"iconPicker.cat.Users + People": "Kullanıcılar ve İnsanlar",
	"iconPicker.cat.Vehicles": "Araçlar",
	"iconPicker.cat.Version control": "Sürüm kontrolü",
	"iconPicker.cat.Weather": "Hava durumu",
	"iconPicker.cat.Writing": "Yazma",
	"iconPicker.cat.Zodiac": "Burçlar",

	// Downloadable icon packs
	"iconPack.downloadTitle": "{{name}} henüz indirilmedi",
	"iconPack.downloadDetail":
		"{{count}} simge · {{size}} · tek seferlik indirme",
	"iconPack.download": "İndir",
	"iconPack.downloading": "{{name}} indiriliyor…",
	"iconPack.downloadFailed":
		"{{name}} indirilemedi. Bağlantınızı kontrol edin ve tekrar deneyin.",
	"iconPack.retry": "Yeniden dene",
	"iconPack.faBrandsNotice":
		"Marka simgeleri ilgili sahiplerinin ticari markalarıdır. Dahil edilmeleri onay anlamına gelmez. Lütfen yalnızca temsil ettikleri şirket, ürün veya hizmeti temsil etmek için kullanın.",
	"iconPack.artworkRestored": "{{names}} için simge çizimleri indirildi.",
	"iconPack.diskWriteFailed":
		"Callout Studio simge paketini diske kaydedemedi, bu nedenle bir sonraki seferde yeniden indirilmesi gerekecek. Seçtiğiniz simgeler hâlâ ayarlarınıza kaydedildi.",

	// Icon licences & credits
	"credits.title": "Simge lisansları ve katkılar",
	"credits.intro":
		"Callout Studio birçok açık simge kitaplığından yararlanır. Lisansları aşağıda yeniden üretilmiştir; burada kullanım için yapılan değişikliklerle birlikte.",
	"credits.fullNotices": "Tam üçüncü taraf bildirimleri",
	"credits.pluginLicense":
		"Callout Studio'nun kendi kodu permissive lisansı altında; simge kütüphaneleri kendi lisanslarını korur.",

	"contextMenu.editCallout": "Callout ayarlarını düzenle",
	"contextMenu.copyMarkdown": "Callout Markdown'ı kopyala",
	"contextMenu.openSettings": "Callout Studio ayarlarını aç",
	"contextMenu.setFoldClosed": "Callout'u kapalı olarak ayarla (-)",
	"contextMenu.setFoldOpen": "Callout'u açık olarak ayarla (+)",
	"contextMenu.setFoldNone": "Callout'u katlanamaz yap",
	"contextMenu.cutSection": "Başlık bölümünü kes",
	"contextMenu.copySection": "Başlık bölümünü kopyala",
	"contextMenu.deleteSection": "Başlık bölümünü sil",

	"heading.toggleFold": "Katlamayı aç/kapat",

	"settings.globalSettings": "Genel ayarlar",
	"settings.globalSettingsRegularDesc":
		"Obsidian'ın yerel callout kutusu olarak görüntülemek için bir blok alıntıya callout belirteci ekleyin (örn. `> [!type]`). Kenarlığını, köşe yuvarlaklığını, yazı tipi ölçeğini ve hizalamasını ayarlayabilirsiniz.",
	"settings.globalSettingsHeadingDesc":
		"Stilli bir callout başlığı olarak görüntülemek için callout belirtecini başlık işaretlerinden hemen sonra ekleyin (örn. `## [!type]`). Kenarlığını, şeklini ve dikey boşluğunu ayarlayabilirsiniz.",
	"settings.globalSettingsInlineDesc":
		"Küçük bir satır içi hap olarak görüntülemek için callout belirtecini bir metin satırının herhangi bir yerine ekleyin (örn. `[!type]`). Kenarlığını ve şeklini ayarlayabilirsiniz.",
	"settings.globalSettingsCustomize": "Özelleştir",

	"settings.calloutTypeRegular": "Block callout",
	"settings.calloutTypeHeading": "Başlık callout'u",
	"settings.calloutTypeInline": "Satır içi callout",

	"settings.customizeMenu": "Menü öğelerini özelleştir",
	"settings.customizeMenuDesc":
		"Her callout türü için hangi sağ tık eylemlerinin görüneceğini seçin ve sırasını değiştirin. Kaynak modunda ve Canlı Önizleme'de çalışır.",
	"settings.customizeMenuButton": "Menü öğelerini özelleştir",
	"menuCustomize.title": "Sağ tık menüsünü özelleştir",
	"menuCustomize.desc":
		"Eylemleri açıp kapatın ve yeniden sıralamak için tutamacı sürükleyin. Değişiklikler otomatik olarak kaydedilir.",
	"menuCustomize.regular": "Block callout",
	"menuCustomize.heading": "Başlık callout'u",
	"menuCustomize.inline": "Satır içi callout",
	"menuCustomize.dragHandle": "Yeniden sıralamak için sürükleyin",
	"menuItem.edit": "Callout düzenle",
	"menuItem.openSettings": "Ayarları aç",
	"menuItem.copyMarkdown": "Markdown'ı kopyala",
	"menuItem.foldDefaults": "Katlama varsayılanları (açık / kapalı / yok)",
	"menuItem.cutSection": "Bölümü kes",
	"menuItem.copySection": "Bölümü kopyala",
	"menuItem.deleteSection": "Bölümü sil",

	"confirm.ok": "Sil",
	"confirm.cancel": "İptal",
	// Headings for each confirmation — every window carries one, so each
	// caller of ConfirmModal names what it is about to do.
	"confirm.titleDeleteCommand": "Komutu sil",
	"confirm.titleResetAll": "Tüm callout'ları sıfırla",
	"confirm.titleResetCallout": "Callout'u sıfırla",
	"confirm.titleDeletePalette": "Paleti sil",
	"confirm.titleDeleteImage": "Resmi sil",

	"vault.filesUpdated":
		"Vault dosyalarında {{count}} callout referansı güncellendi.",
	"vault.idsUpdated":
		"Vault dosyalarında {{count}} callout ID'si güncellendi: {{oldIds}} → {{newId}}",
	"vault.titlesUpdated":
		"Vault dosyalarında {{count}} callout başlığı güncellendi: {{oldTitle}} → {{newTitle}}",
	"vault.replaceWith": "Şununla değiştir:",
	"vault.deleteWithout": "Değiştirmeden sil",
	"vault.confirmDelete": "Onayla",
	"vault.confirmReplace": "Değiştir",
	"vault.replacePromptInUse":
		'"{{name}}" {{files}} dosyada {{count}} kez kullanılıyor. Onu değiştirmek için bir callout seçin:',
	"vault.replacePromptUnused": '"{{name}}" yerine geçecek bir callout seçin:',
	"vault.noReplacementAvailable":
		"Bunu değiştirmek için başka callout mevcut değil.",
	"vault.convertedToPlainText":
		"{{files}} dosyadaki {{blocks}} callout bloğu düz metne dönüştürüldü.",
	"vault.resetAliasWarning":
		"{{files}} dosyadaki {{count}} referans özel takma adlar kullanıyor: {{aliases}}. Sıfırlamadan sonra çalışmayacaklar. Devam edilsin mi?",
	"vault.resetConfirm": "Sıfırla",
	"vault.resetAllInUse":
		"⚠ {{files}} dosyadaki {{count}} callout referansı silinecek özel callout türleri kullanıyor.",

	"quickInsert.title": "Blok callout'u hızlı ekle",
	"quickInsert.desc": "İmleç konumuna eklemek için bir callout seçin. Yalnızca blok callout'lar.",
	"quickInsert.searchPlaceholder": "Callout ara",
	"quickInsert.sourceAria": "Callout kaynağına göre filtrele",
	"quickInsert.sourceAll": "Tümü",
	"quickInsert.sourceBuiltIn": "Yerleşik",
	"quickInsert.sourceUser": "Callout'larım",
	"quickInsert.editAria": "{{name}} düzenle",
	"quickInsert.insertAria": "{{name}} öğesini blok callout olarak ekle",
	"quickInsert.noResults": "Callout bulunamadı",
	"quickInsert.noUserCallouts": "Henüz herhangi bir callout oluşturmadınız.",
	"quickInsert.noEditorHint": "Düzenleme modunda açık bir not yok, bu yüzden hiçbir şey eklenemez.",
	"quickInsert.noEditor": "Bir callout eklemek için bir notu düzenleme modunda açın.",

	"vaultStats.title": "Callout istatistikleri",
	"vaultStats.totalCallouts": "Toplam callout",
	"vaultStats.typesFound": "Bulunan türler",
	"vaultStats.filesWithCallouts": "Callout içeren dosyalar",
	"vaultStats.filesScanned": "Taranan Markdown dosyaları",
	"vaultStats.empty": "Markdown notlarında callout bulunamadı.",
	"vaultStats.columnType": "Tür",
	"vaultStats.columnName": "Ad",
	"vaultStats.columnSource": "Kaynak",
	"vaultStats.columnCount": "Sayı",
	"vaultStats.columnFiles": "Dosyalar",
	"vaultStats.unknown": "Bilinmiyor",
	"vaultStats.sourceBuiltIn": "Yerleşik",
	"vaultStats.sourceCustom": "Özel",
	"vaultStats.sourceAutoFallback": "Otomatik geri dönüş",
	"vaultStats.sourceTheme": "CSS snippet",
	"vaultStats.sourceAlias": "{{id}}'nin takma adı",
	"vaultStats.sourceUnknown": "Bilinmiyor",
	"vaultStats.byRole": "Şu şekilde yazıldı",
	"vaultStats.roleBlock": "Blok",
	"vaultStats.roleHeading": "Başlık",
	"vaultStats.roleInline": "Satır içi",
	"vaultStats.defineUndefined": "{{count}} eksik olanı tanımla",
	"vaultStats.defineRunning": "Taranıyor",
	"vaultStats.defineDone": "{{count}} callout türü eklendi.",
	"vaultStats.close": "Kapat",

	"import.title": "İçe aktarma sorunları",
	"import.reportLeadIn":
		"İçe aktardığınız dosya değiştirilmiş gibi görünüyor. İşte sorunların listesi:",
	"import.reportLeadInFatal":
		"Bu dosya bir Callout Studio dışa aktarması gibi görünmüyor. İçe aktarılamaz:",
	"import.entryHeading": "Giriş {{index}} — {{label}}",
	"import.summary":
		"{{total}} girişten {{valid}} tanesi geçerli · {{issues}} sorun bulundu.",
	"import.btnCancel": "İptal",
	"import.btnImportValid": "Yalnızca geçerli olanları içe aktar ({{count}})",
	"import.err.notRecognized":
		"Tanınmayan dosya: bir callout tanımları dizisi veya bir Callout Studio dışa aktarımı bekleniyordu.",
	"import.warn.settingsIgnored":
		"Ayarlar bloğu geçerli bir nesne değildi ve yoksayıldı.",
	"import.warn.invalidGradient":
		"Arka plan gradyanı geçersizdi ve yoksayıldı.",
	"import.err.parseFailed": "Dosya geçerli JSON değil ve ayrıştırılamadı.",
	"import.err.entryNotObject": "Giriş bir nesne olmalıdır.",
	"import.err.requiredMissing":
		'"{{field}}" zorunlu alanı eksik veya yanlış türde.',
	"import.err.idEmpty": "ID boş olmamalıdır.",
	"import.err.idTooLong":
		'"{{value}}" ID\'si {{length}} karakter; maksimum {{max}}.',
	"import.err.idBadChar":
		'"{{value}}" ID\'si geçersiz karakterler içeriyor ("|", "[", "]", sekmeler ve satır sonları kullanılamaz).',
	"import.err.idMetadata":
		'"{{value}}" ID\'si "|" içeriyor. Obsidian\'da ilk "|"den sonraki her şey callout\'un meta verisidir, türün bir parçası değildir; bu nedenle bu giriş "{{id}}" callout\'unu tanımlar. Mevcut "{{id}}"niz değiştirilmeden bırakılması için atlandı.',
	"import.err.displayNameEmpty": "Görünen ad boş olmamalıdır.",
	"import.err.displayNameTooLong":
		"Görünen ad {{length}} karakter; maksimum {{max}}.",
	"import.err.boolField":
		'"{{field}}" bir boole (true veya false) olmalıdır.',
	"import.err.iconNotObject": "Simge bir nesne olmalıdır.",
	"import.err.iconTypeInvalid":
		'"{{value}}" simge türü şunlardan biri olmalıdır: {{types}}.',
	"import.warn.iconFieldIgnored":
		'"{{field}}" yalnızca Material simgeleri için geçerlidir ve simge türü {{type}} için yoksayılır.',
	"import.err.iconValueEmpty": "Simge değeri boş olmayan bir dize olmalıdır.",
	"import.err.iconValueTooLong":
		"Simge değeri olağandışı uzun ({{length}} karakter).",
	"import.err.materialStyle":
		'"{{value}}" Material simge stili şunlardan biri olmalıdır: outlined, filled, rounded, sharp.',
	"import.err.materialWeight":
		'"{{value}}" Material simge ağırlığı 100 ile 700 arasında, 100\'er adımlarla tam sayı olmalıdır.',
	"import.warn.iconRecolorIgnored":
		'"recolor" yalnızca kendi resimleriniz için geçerlidir ve simge türü {{type}} için yoksayılır.',
	"import.err.iconRecolorInvalid":
		'"recolor" true veya false olmalıdır ("{{value}}" alındı).',
	"import.err.colorInvalid":
		'"{{field}}" "#448aff" gibi bir onaltılık renk olmalıdır ("{{value}}" alındı).',
	"import.err.numberRange":
		'"{{field}}" {{min}} ile {{max}} arasında bir sayı olmalıdır ("{{value}}" alındı).',
	"import.err.iconSizeRange":
		'"{{field}}" {{min}} ile {{max}} arasında bir sayı olmalıdır ("{{value}}" alındı).',
	"import.err.iconAdjustShape":
		'"iconAdjust" must be an object mapping a callout type ("regular", "heading", "inline") to its icon size and offsets.',
	"import.err.aliasesNotArray": '"aliases" bir dize dizisi olmalıdır.',
	"import.err.aliasNotString": "Takma ad bir dize olmalıdır.",
	"import.err.aliasDup": '"{{value}}" takma adı bu giriş içinde yineleniyor.',
	"import.err.tooManyIds":
		"Çok fazla ID ({{count}}); her callout en fazla {{max}} ID'ye sahip olabilir (birincil + takma adlar).",
	"import.err.metadataShape":
		'"metadata" tüm değerleri dize olan bir nesne olmalıdır.',
	"import.warn.unknownFields": "Bilinmeyen alanlar yoksayıldı: {{fields}}.",
	"import.err.duplicateInFile":
		'"{{value}}" ID/takma adı bu dosyadaki #{{first}} girişi tarafından zaten kullanılıyor.',
	"import.err.aliasConflict":
		'"{{value}}" takma adı vault\'unuzdaki başka bir callout ("{{other}}") tarafından zaten kullanılıyor.',
	"import.warn.defaultFoldedAutofix":
		'"defaultFolded" true iken "foldable" false\'tu; defaultFolded false\'a sıfırlandı.',
	"import.warn.imageMissing":
		"Bu Callout, dosyada ve bu vault'ta bulunmayan bir resim kullanıyor, bu nedenle yeni bir resim sağlayana kadar yer tutucu simge gösterecek.",

	"import.err.paletteIdInvalid":
		'"paletteId" boş olmayan bir metin ID\'si olmalıdır ("{{value}}" alındı).',
	"import.warn.iconNameUnknown":
		'"{{value}}" simgesi {{type}} içinde bulunmuyor, bu nedenle varsayılan simge kullanıldı.',
	"import.warn.cmIconUnknownNew":
		'"{{value}}" simgesi Obsidian içinde bulunmuyor, bu nedenle varsayılan simge kullanıldı.',
	"import.warn.cmIconUnknownExisting":
		'"{{value}}" simgesi Obsidian içinde bulunmuyor, bu nedenle "{{id}}" zaten sahip olduğu simgeyi korudu.',
	"import.chooseSource": "Şuradan içe aktar",
	"import.sourceStudio": "Callout Studio",
	"import.sourceStudioDesc":
		"Callout Studio'dan dışa aktarılmış bir .json dosyası yükleyin.",
	"import.sourceCalloutManager": "Callout Manager",
	"import.sourceCalloutManagerDesc":
		"Callout Manager'ın Copy düğmesinden kopyaladığınız stilleri yapıştırın.",
	"import.sourceAdmonition": "Admonition",
	"import.sourceAdmonitionDesc":
		"Özel admonition'larınızı Admonition eklentisinden getirin.",
	"import.cmTitle": "Callout Manager'dan İçe Aktar",
	"import.cmFromVault": "Bu kasa",
	"import.cmVaultChecking": "Callout Manager eklentisi aranıyor…",
	"import.cmVaultFound": "{{count}} özel callout bulundu.",
	"import.cmVaultNotFound": "Bu kasada özel callout bulunamadı.",
	"import.cmPasteLabel":
		"Veya Callout Manager'dan kopyalanan stilleri buraya yapıştırın:",
	"import.cmInstructions":
		"Callout Manager'da, özelleştirilmiş callout stillerinizi kopyalamak için Copy düğmesini kullanın, ardından aşağıya yapıştırın.",
	"import.cmPlaceholder": "Kopyalanan stilleri buraya yapıştırın…",
	"import.cmBtnCancel": "İptal",
	"import.cmBtnImport": "İçe aktar",
	"import.err.cmNotRecognized":
		"Dosya tanınmadı: Callout Manager'ın Copy düğmesiyle oluşturulan stiller veya Callout Manager data.json dosyası bekleniyordu.",
	"import.err.cmNoEntries": "İçe aktarılacak özel callout bulunamadı.",
	"import.err.cmNoBlocksFound":
		"Yapıştırılan metinde Callout Manager stilleri bulunamadı.",
	"import.err.cmNoColorForNew":
		'Yeni callout "{{value}}" için kullanılabilir bir renk bulunamadı; atlandı.',
	"import.warn.cmNoColorDefault":
		"Callout Manager'da renk ayarlanmadığından varsayılan gri kullanıldı.",
	"import.warn.cmThemeCondition":
		"Bu callout'un rengi veya simgesi yalnızca bir tema için ayarlanmıştı. Callout Studio tema başına stil oluşturmadığından tüm temalara aktarıldı.",
	"import.warn.cmCustomStyles":
		"Bu callout'un Callout Manager'da özel CSS'i de var. Bu stil içe aktarmaya dahil olmadığından yalnızca simgesi ve rengi aktarıldı.",
	"import.err.cmIdConflict":
		'"{{value}}" ID\'si zaten başka bir callout ("{{other}}") tarafından takma ad olarak kullanılıyor ve atlandı.',

	// Import — Admonition
	"import.admTitle": "Admonition'dan içe aktar",
	"import.admInstructions":
		"Her admonition adı, simgesi ve rengiyle birlikte bir callout " +
		"olarak gelir. Callout Studio'da karşılığı olmayan ayarlar " +
		"(komut, kopyala düğmesi, gizli başlık) geride kalır.",
	"import.admFromVault": "Bu kasa",
	"import.admVaultChecking": "Admonition eklentisi aranıyor…",
	"import.admVaultFound": "{{count}} özel admonition bulundu.",
	"import.admVaultNotFound": "Bu kasada özel admonition bulunamadı.",
	"import.admFromFile": "Bir dosya",
	"import.admFromFileDesc":
		"Bir admonitions.json dosyası veya paylaşılan bir paket.",
	"import.admChooseFile": "Dosya seç…",
	"import.admPasteLabel": "Ya da JSON'u buraya yapıştırın:",
	"import.admPlaceholder": "Admonition'larınızı buraya yapıştırın…",
	"import.admBtnCancel": "İptal",
	"import.admBtnImport": "İçe aktar",
	"import.err.admNotRecognized":
		"Tanınmayan dosya: bir admonition listesi veya Admonition'ın " +
		"data.json dosyası bekleniyordu.",
	"import.err.admNoEntries": "İçe aktarılacak admonition bulunamadı.",
	"import.err.admTypeMissing": 'Bu admonition\'da "type" yok, atlandı.',
	"import.warn.admIconUnknown":
		'Hiçbir simge kitaplığında "{{value}}" adlı bir simge bulunamadı, ' +
		"bu yüzden varsayılan simge kullanıldı.",
	"import.warn.admIconUnknownExisting":
		'Hiçbir simge kitaplığında "{{value}}" adlı bir simge bulunamadı, ' +
		'bu yüzden "{{id}}" mevcut simgesini korudu.',
	"import.warn.admImageFailed":
		"Yüklenen görsel okunamadı, bu yüzden varsayılan simge " +
		"kullanıldı.",
	"import.warn.admIconWithCss":
		"Bu admonition, Admonition içindeki bir CSS parçacığıyla " +
		"biçimlendiriliyor. Bu biçimlendirme içe aktarmaya dahil " +
		"değildir; yalnızca adı, simgesi ve rengi geldi.",
	"import.warn.admNoColor":
		"Renk ayarlanmamıştı, bu yüzden varsayılan mavi kullanıldı.",
	"import.warn.admTitleTruncated":
		"Başlık {{length}} karakter; {{max}} karaktere kısaltıldı.",

	"footer.tagline":
		"Geri bildiriminiz, yorumlarınız veya önerileriniz var mı? Duymak isterim!",
	"footer.madeBy": "Niv tarafından yapıldı  •  ",
	"settings.deletePaletteConfirmLinkedOne":
		'"{{name}}" paleti silinsin mi?\n1 callout bunu kullanıyor. Renklerini korur ve daha sonra düzenleyicisindeki Renk satırından yeniden bağlayabilirsiniz.',
	"settings.deletePaletteConfirmLinked":
		'"{{name}}" paleti silinsin mi?\n{{count}} callout bunu kullanıyor. Renklerini korurlar ve daha sonra düzenleyicilerindeki Renk satırından yeniden bağlayabilirsiniz.',
	"settings.unlinkedColors": "Bağlantısı kaldırılmış renkler",
	"settings.unlinkedColorsDesc":
		"Kaydedilmiş rengi silinen callout'lar. Sahip oldukları renkleri korurlar; geri yükleme rengi tekrar kaydeder ve tüm grubu yeniden bağlar.",
	"settings.unlinkedColorOne": "1 callout",
	"settings.unlinkedColorCount": "{{count}} callout",
	"settings.restoreColor": "Geri yükle",
	"settings.palettesMergedNotice":
		"Aynı renklere zaten sahip kayıtlı renklere {{count}} içe aktarılan palet birleştirildi.",
	"notice.palettesMerged":
		"Aynı renklere sahip {{count}} kayıtlı renk birleştirildi: {{names}}. Bunları kullanan callout'lar renklerini korur ve artık kalan renge bağlıdır.",
	"editor.colorsDescDeleted":
		"Bu callout'un kaydedilmiş rengi silindi. {{link}} tekrar kaydedebilirsiniz.",
	"editor.colorsDescDeletedOther":
		"Bu callout'un kaydedilmiş rengi silindi. {{link}} tekrar kaydedebilirsiniz — bunu kullanan 1 diğer callout da yeniden bağlanacaktır.",
	"editor.colorsDescDeletedOthers":
		"Bu callout'un kaydedilmiş rengi silindi. {{link}} tekrar kaydedebilirsiniz — bunu kullanan {{count}} diğer callout da yeniden bağlanacaktır.",
	"editor.colorsDescDeletedLink": "buraya tıklayarak",
	"palette.colorExists":
		'Bu renkler "{{name}}" ile aynı. İki kayıtlı renk aynı olamaz — ayırt etmek için bir rengi değiştirin.',
	"palette.colorExistsUse":
		'Bu renkler "{{name}}" ile aynı. İki kayıtlı renk aynı olamaz — bir rengi değiştirin veya {{link}}.',
	"palette.colorExistsUseLink": "mevcut olanı kullanın",
	"locale.downloading": "Çeviri indiriliyor…",
	"locale.notDownloaded": "{{name}} henüz indirilmedi",
	"locale.notDownloadedDesc":
		"Callout Studio, çeviri indirilene kadar İngilizce gösterir. Obsidian bir sonraki başlatıldığında tekrar deneyecek.",
	"locale.retry": "Yeniden dene",
	"locale.diskWriteFailed":
		"Callout Studio çeviriyi diske kaydedemedi; bu nedenle bir dahaki sefere yeniden indirilmesi gerekecek.",
	"notice.exportedCssCreated": "CSS snippet {{path}} konumuna kaydedildi",
	"notice.exportedCssUpdated": "CSS snippet {{path}} konumunda güncellendi",
	"notice.exportedCssUnchanged": "CSS snippet zaten güncel.",
	"notice.exportCssEmpty": "Dışa aktarılacak özel callout yok.",
	"notice.exportCssFailed":
		"CSS snippet kaydedilemedi. Ayrıntılar için geliştirici konsolunu kontrol edin.",
	"notice.exportCssEnabled":
		"Bu snippet vault içinde açık. Callout Studio bu callout'ları zaten biçimlendiriyor ve snippet dışa aktarıldığı zamanki stili koruyor.",
	"confirm.titleOverwriteSnippet": "CSS snippet'in üzerine yaz",
	"confirm.overwriteSnippet":
		"Snippets klasöründeki CSS snippet, Callout Studio yazdıktan sonra değişti. Yeniden dışa aktarma dosyanın tamamını değiştirir.",
	"confirm.overwriteSnippetOk": "Üzerine yaz",
	"export.chooseFormat": "Şu biçimde dışa aktar",
	"export.formatJson": "Callout Studio yedeği",
	"export.formatJsonDesc":
		"Callout'larınızı ve ayarlarınızı başka bir vault'a aktarmak için bir .json dosyası.",
	"export.formatCss": "CSS snippet",
	"export.formatCssDesc":
		"Callout Studio'nun kurulu olmadığı yerlerde kullanmak üzere bu vault'un snippets klasörüne kaydedilen .css dosyası. Yalnızca normal callout'ları kapsar ve bir anlık görüntüdür; değişiklikten sonra yeniden dışa aktarın.",
};
