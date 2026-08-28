export const id: Record<string, string> = {
	"cmd.openSettings": "Buka pengaturan",
	"cmd.createCallout": "Buat tipe callout baru",
	"cmd.insertEmptyCallout": "Sisipkan callout kosong",
	"cmd.calloutWrap": "Bungkus dalam callout",
	"cmd.calloutUnwrap": "Hapus callout",

	"cmd.customWrapBlock": "Bungkus dalam callout blok {{name}}",
	"cmd.customInsertBlock": "Sisipkan callout blok {{name}}",
	"cmd.customInsertHeading": "Sisipkan heading callout {{name}} H{{level}}",
	"cmd.customInsertInline": "Sisipkan inline callout {{name}}",
	"cmd.openQuickInsert": "Sisipan cepat callout blok",

	"autocomplete.createNew": 'Buat callout baru: "{{name}}"',

	"settings.fallbackTag": "Default",
	"settings.fallbackTagAuto": "Default otomatis",
	"settings.autoDiscover": "Deteksi callout secara otomatis di vault Anda",
	"settings.autoDiscoverDesc":
		"Mengenali jenis callout yang ditulis di catatan Anda dan menambahkannya ke daftar secara otomatis. Menonaktifkan ini membiarkan callout yang sudah Anda miliki tidak berubah — Anda tetap bisa menambahkannya sendiri, atau gunakan Pindai ulang vault di bawah.",
	"settings.rescanVault": "Pindai ulang vault",
	"settings.rescanVaultDesc":
		"Menemukan ID callout yang tidak dikenal dalam catatan dan menambahkannya sebagai baris fallback.",
	"settings.rescanVaultHintAction": "Pindai sekarang",
	"settings.rescanComplete":
		"Pemindaian ulang selesai: {{count}} callout baru ditambahkan.",
	"replaceModal.deleteWithoutReplaceSuffix": "(kembali ke default)",
	"replaceModal.titleDelete": "Hapus callout",
	"replaceModal.titleReplace": "Ganti di vault",

	"firstRun.title": "Temukan callout yang ada di vault Anda?",
	"firstRun.body":
		"Callout Studio dapat memindai vault Anda untuk menemukan callout yang sudah Anda gunakan, sehingga muncul di daftar pengaturan dan mengadopsi gaya fallback Anda.",
	"firstRun.heavyVaultNote":
		"Vault Anda memiliki {{count}} file Markdown — pemindaian mungkin membutuhkan beberapa detik.",
	"firstRun.laterHint":
		"Anda selalu dapat menjalankan ini nanti dari Pengaturan → Wawasan & pemeliharaan vault → Pindai ulang vault.",
	"firstRun.scanNow": "Pindai sekarang",
	"firstRun.noThanks": "Tidak, terima kasih",
	"firstRun.autoScanComplete":
		"Callout Studio memindai vault Anda dan menambahkan {{count}} callout.",
	"firstRun.scanning": "Memindai",
	"firstRun.autoScanFailed":
		"Callout Studio tidak dapat memindai vault Anda. Anda dapat mencoba lagi dari Pengaturan → Wawasan & pemeliharaan vault → Pindai ulang vault.",
	"firstRun.scanFailed":
		"Pemindaian tidak selesai. Anda dapat mencoba lagi dari Pengaturan → Wawasan & pemeliharaan vault → Pindai ulang vault.",

	"welcome.tooltip": "Tentang Callout Studio",
	"welcome.title": "Selamat datang di Callout Studio!",
	"welcome.tagline":
		"Solusi lengkap Anda untuk membuat, menata gaya, dan mengelola callout Obsidian.",
	"welcome.previewTitle": "Lihat dalam aksi",
	"welcome.demoName": "Callout Studio",
	"welcome.sample":
		"Callout Studio memungkinkan Anda membuat callout dengan ikon, warna, dan nama khusus.\n\n" +
		"Anda dapat menggunakan callout ini dengan **tiga** cara berbeda:\n\n" +
		"## [!{{id}}] Callout sebagai judul\n" +
		"Untuk mengubah judul apa pun menjadi judul bergaya callout, tambahkan `[!type]` tepat setelah `#`.\n\n" +
		"Ingin [!{{id}}]{callout inline} seperti ini? Cukup tambahkan `[!type]{text}` di tengah kalimat, tanpa mengganggu alur tulisan Anda.\n\n" +
		"> [!{{id}}] Callout blok\n" +
		"> Callout klasik tetap berfungsi dengan sintaks yang sama persis seperti yang sudah Anda kenal: `> [!type]`.\n\n" +
		"Callout Studio masih punya banyak hal lain untuk ditawarkan! [Pelajari lebih lanjut]({{repoUrl}}).\n",

	"deleteModal.title": 'Hapus callout "{{name}}"?',
	"deleteModal.bodyInUse":
		"Callout ini muncul {{count}} kali di {{files}} file.",
	"deleteModal.bodyInUseExplain":
		"Menghapus akan mengubah blok tersebut menjadi teks biasa — mereka akan kehilangan gaya dan header callout.",
	"deleteModal.replaceHint":
		"Anda dapat menggantinya dengan callout lain, yang menjaga konten vault sebagai callout bergaya.",
	"deleteModal.bodyUnused":
		'"{{name}}" tidak digunakan di catatan mana pun, tetapi merupakan callout kustom yang Anda buat. Menghapus akan menghapusnya dari daftar ini.',
	"deleteModal.replaceInstead": "Ganti sebagai gantinya",
	"deleteModal.deleteInUse": "Hapus (ubah ke teks biasa)",
	"deleteModal.deleteUnused": "Hapus callout",
	// The variant for a callout whose definition Callout Studio cannot remove:
	// one of Obsidian's built-ins, or a type the active theme declares.
	"deleteModal.titleKeep": 'Hapus semua penggunaan "{{name}}"?',
	"deleteModal.keepsRowBuiltIn":
		"Ini adalah salah satu callout bawaan Obsidian, sehingga tipe itu sendiri tetap tersedia — hanya penggunaannya di catatan Anda yang berubah.",
	"deleteModal.keepsRowTheme":
		"{{theme}} mendefinisikan tipe callout ini, sehingga tetap tersedia dan mempertahankan tampilannya. Callout Studio hanya mengubah catatan di dalam vault Anda — tidak ada yang berkaitan dengan tema Anda yang tersentuh.",
	"deleteModal.clearUsages": "Hapus penggunaan (ubah ke teks biasa)",

	"settings.title": "Callout Studio",
	"settings.myCalloutTypes": "Tipe callout saya",
	"settings.builtInCallouts": "Callout bawaan",
	"settings.contextMenu": "Menu konteks",
	"settings.autocomplete": "Pelengkapan otomatis",
	"settings.keyboardShortcuts": "Pintasan keyboard",
	"settings.language": "Bahasa",
	"settings.languageDesc":
		"Bahasa tampilan untuk Callout Studio. Secara default mengikuti bahasa antarmuka Obsidian.",
	"settings.languageAuto": "Otomatis (sama seperti Obsidian)",
	"settings.importExport": "Impor / ekspor",
	"settings.import": "Impor",
	"settings.export": "Ekspor",
	"settings.importDesc":
		"Impor kemajuan Callout Studio Anda dari vault lain menggunakan file JSON.",
	"settings.exportDesc":
		"Simpan semua tipe callout kustom Anda dalam format JSON.",
	"settings.importConflictNotice":
		"{{count}} tipe callout diimpor; {{overwritten}} entri yang ada ditimpa.",

	"settings.addNewCallout": "+ tambah callout",

	"settings.noCalloutsNow": "Tidak ada callout kustom untuk saat ini.",

	"settings.editAria": "Edit {{name}}",
	"settings.moreRowActionsAria": "Tindakan lainnya untuk {{name}}",
	"settings.usageInfo": "{{count}} penggunaan di {{files}} file",
	"settings.replaceAction": "Ganti di vault",
	"settings.deleteAction": "Hapus",
	"settings.resetAction": "Reset ke default",
	"settings.makeFallbackAction": "Gunakan gaya fallback default",

	"settings.colorSwatchAria": "Aksen: {{accent}} · Latar belakang: {{bg}}",
	// Handing a callout to the user's own CSS. Not a statement about the theme —
	// that is derived and has no action — so the wording names the snippet.
	"settings.externalCssAction": "Gaya dengan CSS saya sendiri",
	"settings.externalCssStopAction": "Biarkan Callout Studio menata gaya ini lagi",
	// The one label on any row: a callout sitting among the user's own that
	// Callout Studio has nonetheless stopped painting.
	"settings.externalCssTag": "CSS eksternal",
	// Settings — callouts the active theme styles
	"settings.themeCalloutsHeading": "Callout dari tema Anda",
	"settings.themeCalloutsDesc":
		"{{theme}} menyediakan atau mengubah gaya callout ini, sehingga Callout Studio membiarkannya persis seperti yang digambar oleh tema Anda, dan hanya menawarkannya sebagai callout blok. Dua jenis muncul di sini: tipe callout yang ditambahkan oleh tema Anda, dan callout bawaan yang tampilannya digantikan tema. Tipe callout yang ditambahkan tema Anda hanya terdaftar selama tema itu aktif.",
	"settings.themeCalloutsDefaultTheme": "Tema Anda",
	"settings.themePreviewAria":
		'Pratinjau "{{name}}" — lihat bagaimana tema Anda menggambarnya',
	"settings.clearUsesAction": "Hapus penggunaan di catatan Anda",
	"settings.builtInAllThemeStyled":
		"{{theme}} mengubah gaya setiap callout bawaan, sehingga semuanya terdaftar di atas dan Callout Studio membiarkannya begitu saja. Untuk merancang milik Anda sendiri, tambahkan callout dengan ID yang berbeda.",
	"settings.fallbackCallout": "Callout fallback default",
	"settings.fallbackCalloutDesc":
		"Tipe callout yang tidak dikenal di vault Anda akan mewarisi gaya callout ini.",

	"settings.globalStyle": "Gaya callout global",
	"settings.border": "Batas",
	"settings.borderAll": "Semua",
	"settings.borderTop": "Atas",
	"settings.borderRight": "Kanan",
	"settings.borderBottom": "Bawah",
	"settings.borderLeft": "Kiri",
	"settings.borderWidth": "Ketebalan batas",
	"settings.fontScaleGroup": "Skala font",
	"settings.titleScale": "Judul",
	"settings.contentScale": "Konten",
	"settings.inlineTextScale": "Teks",
	"settings.shapeGroup": "Bentuk",
	"settings.borderRadius": "Pembulatan sudut",
	"settings.alignGroup": "Perataan",
	"settings.alignContent": "Sejajarkan konten dengan judul",
	"settings.headingSpacingGroup": "Jarak judul",
	"settings.headingPadVertical": "Jarak vertikal",
	"settings.headingGap": "Jarak antar judul",
	"settings.headingFoldGroup": "Lipat",
	"settings.headingFoldArrow": "Tampilkan panah lipat",
	"settings.styleDemoName": "Contoh",
	"settings.previewTitle": "Pratinjau",

	// Settings — Saved color palettes
	"settings.customPalettes": "Palet warna tersimpan",
	"settings.newPalette": "Palet baru",
	"settings.customPalettesEmpty": "Tidak ada palet tersimpan untuk saat ini.",
	"settings.editPaletteAria": "Edit palet {{name}}",
	"settings.deletePaletteAria": "Hapus palet {{name}}",
	"settings.deletePaletteConfirm":
		'Hapus palet "{{name}}"?\nCallout yang menggunakan warna ini tidak terpengaruh.',
	"settings.enableAutocomplete": "Aktifkan pelengkapan otomatis [!",
	"settings.enableAutocompleteDesc":
		'Menampilkan saran saat Anda mengetik "[!" di dalam Block Callout di editor. Pilih tipe callout dari daftar untuk menyisipkan header callout lengkap.',

	"settings.customCommands": "Perintah dan pintasan",
	"settings.customCommandsDesc":
		"Lihat setiap perintah Callout Studio dan pintasan yang ditetapkan padanya, serta buat perintah Anda sendiri untuk callout yang paling sering Anda gunakan. Tidak ada pintasan yang ditetapkan secara default.",
	"settings.customCommandsButton": "Kelola perintah",

	"commandBuilder.title": "Perintah dan pintasan",
	"commandBuilder.desc":
		"Gunakan tombol + untuk menetapkan atau mengubah pintasan di pengaturan hotkey Obsidian.",
	"commandBuilder.builtIn": "Perintah bawaan",
	"commandBuilder.toggleAria": "Aktifkan atau nonaktifkan {{name}}",
	"commandBuilder.hotkeyBlank": "Kosong",
	"commandBuilder.hotkeyAria": "Tetapkan pintasan untuk {{name}}",
	"commandBuilder.yourCommands": "Perintah Anda",
	"commandBuilder.newCommand": "Perintah baru",
	"commandBuilder.empty": "Belum ada perintah kustom.",
	"commandBuilder.unknownCommand": "perintah ini",
	"commandBuilder.editAria": "Edit {{name}}",
	"commandBuilder.deleteAria": "Hapus {{name}}",
	"commandBuilder.deleteConfirm":
		"Hapus perintah {{name}}? Pintasan apa pun yang ditetapkan padanya akan berhenti berfungsi.",
	"commandBuilder.newTitle": "Perintah baru",
	"commandBuilder.editTitle": "Edit perintah",
	"commandBuilder.format": "Format callout",
	"commandBuilder.formatDesc": "Jenis callout apa yang ditulis perintah ini.",
	"commandBuilder.formatHeading": "Heading",
	"commandBuilder.formatInline": "Inline",
	"commandBuilder.formatBlock": "Block",
	"commandBuilder.roleDisabled":
		"Format ini dimatikan, sehingga perintah akan menyisipkan teks biasa sampai Anda mengaktifkannya kembali.",
	"commandBuilder.roleThemeOwned":
		"Tema Anda menyediakan callout ini, sehingga hanya memiliki format Block.",
	"commandBuilder.commandSuspended":
		"Dijeda: tema Anda menyediakan callout ini, sehingga hanya memiliki format Block. Perintah ini akan berfungsi lagi ketika tema berhenti menyediakannya.",
	"commandBuilder.callout": "Tipe callout",
	"commandBuilder.calloutDesc": "Callout yang disisipkan oleh perintah ini.",
	"commandBuilder.headingLevel": "Level heading",
	"commandBuilder.headingLevelDesc": "Level heading mana yang akan ditulis.",
	"commandBuilder.action": "Aksi",
	"commandBuilder.actionDesc":
		"Bungkus mengubah seleksi menjadi callout; sisipkan menambahkan callout kosong.",
	"commandBuilder.actionWrap": "Bungkus seleksi",
	"commandBuilder.actionInsert": "Sisipkan baru",
	"commandBuilder.preview": "Nama perintah",
	"commandBuilder.duplicate":
		"Anda sudah memiliki perintah yang melakukan persis hal ini.",
	"commandBuilder.noCallouts":
		"Belum ada tipe callout untuk membuat perintah.",
	"commandBuilder.save": "Simpan",

	"settings.vaultMaintenance": "Wawasan & pemeliharaan vault",
	"settings.vaultStats": "Statistik callout",
	"settings.vaultStatsDesc":
		"Menghitung setiap callout di catatan Markdown Anda — blok, judul, dan sebaris — lalu mengelompokkannya berdasarkan tipe.",
	"settings.vaultStatsButton": "Lihat statistik",
	"settings.vaultStatsScanning": "Memindai",
	"settings.resetAll": "Reset",
	"settings.resetAllDesc":
		"Menghapus semua callout pengguna, mereset callout bawaan, gaya global (batas, skala font, bentuk), palet warna tersimpan, penyesuaian menu klik kanan, dan SVG Material yang diunduh.",
	"settings.resetAllButton": "Reset semua",
	"settings.resetAllConfirm":
		"Ini akan menghapus semua callout kustom, mereset callout bawaan, gaya global, palet warna tersimpan, penyesuaian menu klik kanan, dan semua SVG Material yang di-cache. Tindakan ini tidak dapat dibatalkan. Apakah Anda yakin?",
	"notice.resetAllDone": "Semua telah direset ke default.",

	"notice.customCommandsRemoved":
		"Menghapus {{count}} perintah kustom yang tipe callout-nya sudah tidak ada.",
	"notice.customCommandMissingCallout":
		"Tipe callout untuk perintah tersebut sudah tidak ada.",

	"notice.exported": "Callout diekspor ke callout-studio-export.json",
	"notice.importedJSON": "{{count}} tipe callout diimpor dari JSON.",
	"notice.importedSettings": "Pengaturan plugin diimpor.",
	"notice.importedCalloutManager":
		"Diimpor dari Callout Manager: {{created}} dibuat, {{updated}} diperbarui.",
	"notice.importedAdmonition":
		"Diimpor dari Admonition: {{created}} dibuat, {{updated}} " +
		"diperbarui.",
	"notice.noNewJSON":
		"Tidak ada tipe callout baru yang diimpor (ID mungkin sudah ada).",
	"notice.iconDownloadFailed":
		'Gagal mengunduh ikon Material "{{name}}". Ikon ini mungkin tidak tersedia untuk gaya/ketebalan ini, atau koneksi Anda sedang offline.',
	"notice.externalCssOn":
		'Callout Studio tidak lagi menata gaya "{{name}}" — CSS Anda sendiri yang menentukan tampilannya. Bentuk Heading Callout dan Inline Callout-nya tidak akan dirender.',
	"notice.externalCssOff": 'Callout Studio kini menata gaya "{{name}}" lagi.',
	"notice.nothingToWrap": "Tidak ada yang perlu dibungkus.",
	"notice.cursorNotInsideCallout": "Kursor tidak berada di dalam callout.",
	"notice.autocompleteTargetMoved":
		"Tidak ada yang disisipkan — baris berubah saat editor terbuka.",
	"notice.openHotkeysFailed":
		"Tidak dapat membuka pengaturan pintasan Obsidian.",
	"notice.filterHotkeysFailed":
		"Pintasan Obsidian dibuka, tetapi filter Callout Studio tidak dapat diterapkan.",

	"editor.editCallout": "Edit callout",
	"editor.newCallout": "Callout baru",
	"editor.displayName": "Nama tampilan",
	"editor.displayNameDesc": "Label yang dapat dibaca yang ditampilkan di UI",
	"editor.displayNameBuiltIn":
		"Nama tampilan tidak dapat diubah untuk callout bawaan",
	"editor.displayNamePlaceholder": "Callout saya",
	"editor.calloutIds": "ID callout",
	"editor.calloutIdsDesc":
		"Semua pengidentifikasi untuk callout ini. Spasi diperbolehkan.\nTekan Enter atau tombol + untuk menambahkan.",
	"editor.calloutIdsPlaceholder": "Tambah ID",
	"editor.addId": "Tambah ID",
	"editor.idLinkedToName": "Terhubung ke nama tampilan",
	"editor.idCannotDelete":
		"ID ini terhubung ke nama tampilan dan tidak dapat dihapus — edit nama untuk mengubahnya",
	"editor.icon": "Ikon",
	"editor.pickIcon": "Ganti ikon",
	"editor.replaceIcon": "Ganti ikon",
	"editor.removeIcon": "Hapus ikon",
	"editor.noIcon": "Tanpa ikon",
	"editor.resetIcon": "Setel ulang ikon ke default",
	"editor.livePreview": "Pratinjau langsung",
	"editor.iconAdjustment": "Penyesuaian ikon",
	"editor.picture": "Gambar",
	"editor.size": "Ukuran",
	"editor.horizontalOffset": "Offset horizontal",
	"editor.verticalOffset": "Offset vertikal",
	"editor.colors": "Warna",
	"editor.colorsDesc":
		"Sets this callout's border, background, and text colors.",
	"editor.resetColors": "Setel ulang warna ke default",
	"editor.paletteDeleted": "Warna yang dihapus",
	"editor.paletteGroupObsidian": "Callout Obsidian",
	"editor.paletteGroupPresets": "Preset warna",
	"editor.paletteGroupCustom": "Kustom",
	"editor.paletteNewColor": "Warna baru…",
	"editor.contrastWarning":
		"Kontras rendah terhadap latar belakang — mungkin sulit dibaca",
	"editor.foldable": "Dapat dilipat",
	"editor.foldableDesc":
		"Pilih apakah callout dapat dilipat dan status default mana yang diterapkan di seluruh vault.",
	"editor.foldOff": "Mati",
	"editor.foldOpen": "Terbuka secara default",
	"editor.foldClosed": "Tertutup secara default",
	"editor.cancel": "Batal",
	"editor.saveChanges": "Simpan perubahan",
	"editor.createCallout": "Buat callout",
	"editor.nameRequired": "Nama tampilan diperlukan sebelum membuat callout.",
	"editor.noChangesToSave": "Tidak ada perubahan yang dibuat.",
	"editor.downloadingIcon": "Mengunduh ikon",
	"editor.idEmpty": "Diperlukan setidaknya satu ID",
	"editor.idExists": "Callout dengan ID ini sudah ada",
	"editor.idConflict": "ID ini bertentangan dengan callout yang ada",
	"editor.idFromTheme":
		"{{theme}} sudah menyediakan callout dengan ID ini, sehingga Callout Studio tidak dapat menata gayanya. Pilih ID lain.",
	"editor.idThemePattern":
		"Perhatian: tema Anda menata gaya setiap callout yang cocok dengan {{pattern}}, sehingga mungkin akan menimpa tampilan callout ini.",
	"editor.idDashConflict":
		'Obsidian menulis spasi sebagai tanda hubung, sehingga ID ini bertentangan dengan "{{other}}"',
	"editor.untitledCallout": "Callout Tanpa Judul",
	"editor.loremIpsum":
		"Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
	"editor.loremIpsumShort":
		"Lorem ipsum dolor sit amet, consectetur adipiscing elit.",
	"editor.sampleInlineText":
		"Berikut adalah Inline Callout [!{id}] di dalam sebuah paragraf.",
	"editor.previewReadOnly": "Pratinjau langsung tidak dapat diedit",

	// Theme callout preview window — opens instead of the editor for a callout
	// the active theme supplies or restyles.
	"themePreview.title": '{{name}} — disediakan oleh tema Anda',
	"themePreview.owned":
		'{{theme}} menyediakan dan menata gaya "{{name}}". Callout Studio tidak akan menimpanya, sehingga callout bloknya terlihat persis seperti yang digambar tema Anda.',
	"themePreview.readOnly":
		"Artinya warna, ikon, nama, dan ID-nya tidak dapat diubah di sini. Jika Anda ingin desain sendiri, buat callout baru dengan ID yang berbeda.",
	"themePreview.blockOnly":
		"Format Heading dan Inline tidak tersedia untuk callout yang disediakan oleh tema Anda. Callout blok menggunakan gaya asli tema.",
	"themePreview.previewTitle": "Tampilannya sekarang",
	"themePreview.blockSample":
		"> [!{{id}}] {{name}}\n" +
		"> Beginilah tampilan konten callout ini.\n",

	// External style window (opens instead of the editor for a callout the
	// user handed to their theme / a CSS snippet)
	"editor.externalStyleClose": "Mengerti",

	// Palette editor modal
	"palette.newTitle": "Palet warna baru",
	"palette.groupPalette": "Palet",
	"palette.editTitle": "Edit palet warna",
	"palette.name": "Nama",
	"palette.namePlaceholder": "Palet saya",
	"palette.nameExists": "Palet dengan nama ini sudah ada",
	"palette.baseColor": "Warna dasar",
	"palette.baseColorHint":
		"Kami akan otomatis menyesuaikan warna latar belakang dengannya. Jika mau, Anda dapat mengaturnya secara terpisah dengan {{link}}.",
	"palette.baseColorHintLink": "klik di sini",
	"palette.advancedColors": "Warna",
	"palette.advancedColorsHint":
		"Mengedit warna untuk mode {{mode}} - mode lainnya diperbarui secara otomatis. Ganti tema Obsidian untuk memeriksanya.",
	"palette.revertHint": "Lebih suka satu warna dasar saja? {{link}}.",
	"palette.revertHintLink": "Kembalikan",
	"palette.lightMode": "Terang",
	"palette.darkMode": "Gelap",
	"palette.accentColor": "Warna aksen",
	"palette.backgroundColorChannel": "Warna latar belakang",
	"palette.textColorChannel": "Warna teks",
	"palette.bgIntensity": "Intensitas",
	"palette.bgStyle": "Gaya",
	"palette.bgSolid": "Polos",
	"palette.bgGradient": "Gradien",
	"palette.bgTransparent": "Transparan",
	"palette.gradientTo": "Warna kedua",
	"palette.gradientDirection": "Arah",
	"palette.gradientText": "Teks judul bergradien",
	"palette.save": "Simpan",

	// Color name suggestions (used to prefill palette names)
	"colorName.red": "Merah",
	"colorName.orange": "Oranye",
	"colorName.amber": "Amber",
	"colorName.yellow": "Kuning",
	"colorName.lime": "Hijau limau",
	"colorName.green": "Hijau",
	"colorName.teal": "Toska",
	"colorName.cyan": "Sian",
	"colorName.sky": "Biru langit",
	"colorName.blue": "Biru",
	"colorName.indigo": "Nila",
	"colorName.violet": "Lembayung",
	"colorName.purple": "Ungu",
	"colorName.pink": "Merah muda",
	"colorName.rose": "Merah mawar",
	"colorName.brown": "Cokelat",
	"colorName.gray": "Abu-abu",
	"colorName.black": "Hitam",
	"colorName.white": "Putih",
	"colorName.crimson": "Merah krimson",
	"colorName.coral": "Koral",
	"colorName.grape": "Anggur",
	"colorName.plum": "Prune",
	"colorName.bubblegum": "Permen karet",

	"iconPicker.pickIcon": "Pilih ikon",
	"iconPicker.confirm": "Konfirmasi",
	"iconPicker.cancel": "Batal",
	"iconPicker.lucide": "Lucide",
	"iconPicker.tabler": "Tabler Icons",
	"iconPicker.material": "Material",
	"iconPicker.emoji": "Emoji",
	"iconPicker.searchLucide": "cari ikon Lucide",
	"iconPicker.searchTabler": "cari ikon Tabler",
	"iconPicker.tablerStyle": "Gaya ikon",
	"iconPicker.tablerStyleOutline": "Garis luar (Outline)",
	"iconPicker.tablerStyleFilled": "Penuh (Filled)",
	"iconPicker.loadMore": "Muat lebih banyak",
	"iconPicker.materialStyle": "Gaya ikon",
	"iconPicker.materialStyleOutlined": "Garis luar (Outlined)",
	"iconPicker.materialStyleFilled": "Terisi (Filled)",
	"iconPicker.materialStyleRounded": "Membulat (Rounded)",
	"iconPicker.materialStyleSharp": "Tajam (Sharp)",
	"iconPicker.materialWeight": "Ketebalan ikon",
	"iconPicker.materialWeight100": "Tipis (Thin)",
	"iconPicker.materialWeight200": "Sangat ringan (Extra Light)",
	"iconPicker.materialWeight300": "Ringan (Light)",
	"iconPicker.materialWeight400": "Normal (Regular)",
	"iconPicker.materialWeight500": "Sedang (Medium)",
	"iconPicker.materialWeight600": "Semi tebal (Semi Bold)",
	"iconPicker.materialWeight700": "Tebal (Bold)",
	"iconPicker.materialFontFailed":
		"Tidak dapat memuat pratinjau ikon Material. Nama ikon ditampilkan sebagai gantinya — pencarian dan pemilihan tetap berfungsi.",
	"iconPicker.materialFontRetry": "Coba lagi",
	"iconPicker.searchMaterial": "cari ikon Material",
	"iconPicker.searchEmoji": "Cari emoji",
	"iconPicker.skinTone": "Warna kulit",
	"iconPicker.allCategories": "Semua kategori",
	"iconPicker.noIconSelected": "Tidak ada ikon yang dipilih",
	"iconPicker.noResults": "Tidak ada ikon yang cocok dengan pencarian Anda.",
	"iconPicker.octicons": "Octicons",
	"iconPicker.searchOcticons": "Cari Octicons",
	"iconPicker.fa": "Font Awesome",
	"iconPicker.searchFa": "Cari Font Awesome",
	"iconPicker.faStyle": "Gaya ikon",
	"iconPicker.faStyleSolid": "Terisi (Solid)",
	"iconPicker.faStyleRegular": "Biasa (Regular)",
	"iconPicker.faStyleBrands": "Merek (Brands)",
	"iconPicker.rpgAwesome": "RPG Awesome",
	"iconPicker.searchRpgAwesome": "Cari RPG Awesome",
	"iconPicker.image": "Gambar Anda",
	"iconPicker.searchImage": "Cari gambar Anda",
	"iconPicker.imageTooLarge":
		"{{name}} terlalu besar. Gambar harus di bawah 5 MB.",
	"iconPicker.imageUnsupported":
		"{{name}} bukan format gambar yang didukung. Gunakan SVG, PNG, JPEG, atau WebP.",
	"iconPicker.imageInvalidSvg":
		"{{name}} tidak dapat dibaca sebagai SVG aman, sehingga tidak ditambahkan.",
	"iconPicker.imageDecodeFailed":
		"{{name}} tidak dapat dibaca sebagai gambar.",
	"iconPicker.imageDuplicate":
		"{{name}} sudah ada di gambar Anda. Ganti nama file atau hapus gambar yang sudah ada.",
	"iconPicker.imageAdd": "Tambah gambar",
	"iconPicker.imageEmpty":
		"Belum ada gambar. Tambahkan file SVG, PNG, JPEG, atau WebP dari komputer Anda, atau seret ke sini.",
	"iconPicker.imageDelete": "Hapus",
	"iconPicker.imageDeleteConfirm": "Hapus “{{name}}”?",
	"iconPicker.imageDeleteInUse":
		"{{count}} callout menggunakan gambar ini. Mereka akan menampilkan ikon placeholder hingga Anda memberikan yang baru.",
	"iconPicker.imageRecolor": "Ikuti warna Callout",
	"iconPicker.allSources": "Semua sumber",
	"iconPicker.searchAllSources": "Cari semua sumber ikon",
	"iconPicker.sourcesNotDownloaded":
		"Belum disertakan: {{names}}. Pilih sumber di atas untuk mengunduhnya.",
	"iconPicker.chooseSource": "Pilih sumber",
	"iconPicker.sourceGroup": "{{name}} · {{count}}",

	// Source menu — what each library holds, in a few words
	"iconPicker.descAllSources": "cari semua pustaka sekaligus",
	"iconPicker.descLucide": "set milik Obsidian, selalu offline",
	"iconPicker.descTabler":
		"ikon UI yang bersih dan konsisten, garis luar dan penuh",
	"iconPicker.descMaterial": "set Google, empat gaya dan tujuh ketebalan",
	"iconPicker.descEmoji": "glyph berwarna, setiap warna kulit",
	"iconPicker.descOcticons": "ikon antarmuka GitHub",
	"iconPicker.descFa": "solid, regular, dan merek",
	"iconPicker.descRpgAwesome": "ikon fantasi dan permainan meja",
	"iconPicker.descImage": "gambar yang Anda tambahkan dari komputer",

	// Icon picker — category filter dropdown labels
	"iconPicker.cat.Accessibility": "Aksesibilitas",
	"iconPicker.cat.Actions": "Tindakan",
	"iconPicker.cat.Activities": "Aktivitas",
	"iconPicker.cat.Alert": "Peringatan",
	"iconPicker.cat.Alphabet": "Alfabet",
	"iconPicker.cat.Android": "Android",
	"iconPicker.cat.Animals": "Hewan",
	"iconPicker.cat.Arrows": "Panah",
	"iconPicker.cat.Astronomy": "Astronomi",
	"iconPicker.cat.Audio&Video": "Audio & Video",
	"iconPicker.cat.Automotive": "Otomotif",
	"iconPicker.cat.Badges": "Lencana",
	"iconPicker.cat.Brand": "Merek",
	"iconPicker.cat.Buildings": "Gedung",
	"iconPicker.cat.Business": "Bisnis",
	"iconPicker.cat.Camping": "Berkemah",
	"iconPicker.cat.Charity": "Amal",
	"iconPicker.cat.Charts": "Grafik",
	"iconPicker.cat.Charts + Diagrams": "Grafik & Diagram",
	"iconPicker.cat.Childhood": "Masa Kecil",
	"iconPicker.cat.Clothing + Fashion": "Pakaian & Mode",
	"iconPicker.cat.Coding": "Pemrograman",
	"iconPicker.cat.Communicate": "Berkomunikasi",
	"iconPicker.cat.Communication": "Komunikasi",
	"iconPicker.cat.Computers": "Komputer",
	"iconPicker.cat.Connectivity": "Konektivitas",
	"iconPicker.cat.Construction": "Konstruksi",
	"iconPicker.cat.Currencies": "Mata Uang",
	"iconPicker.cat.Database": "Basis Data",
	"iconPicker.cat.Design": "Desain",
	"iconPicker.cat.Development": "Pengembangan",
	"iconPicker.cat.Devices": "Perangkat",
	"iconPicker.cat.Devices + Hardware": "Perangkat & Hardware",
	"iconPicker.cat.Disaster + Crisis": "Bencana & Krisis",
	"iconPicker.cat.Document": "Dokumen",
	"iconPicker.cat.E-commerce": "E-commerce",
	"iconPicker.cat.Editing": "Penyuntingan",
	"iconPicker.cat.Education": "Pendidikan",
	"iconPicker.cat.Electrical": "Listrik",
	"iconPicker.cat.Emoji": "Emoji",
	"iconPicker.cat.Energy": "Energi",
	"iconPicker.cat.Extensions": "Ekstensi",
	"iconPicker.cat.Files": "Berkas",
	"iconPicker.cat.Film + Video": "Film & Video",
	"iconPicker.cat.Food": "Makanan",
	"iconPicker.cat.Food + Beverage": "Makanan & Minuman",
	"iconPicker.cat.Fruits + Vegetables": "Buah & Sayuran",
	"iconPicker.cat.Games": "Permainan",
	"iconPicker.cat.Gaming": "Gaming",
	"iconPicker.cat.Gender": "Jenis Kelamin",
	"iconPicker.cat.Genders": "Jenis Kelamin",
	"iconPicker.cat.Gestures": "Gerakan",
	"iconPicker.cat.Halloween": "Halloween",
	"iconPicker.cat.Hands": "Tangan",
	"iconPicker.cat.Hardware": "Hardware",
	"iconPicker.cat.Health": "Kesehatan",
	"iconPicker.cat.Holidays": "Hari Libur",
	"iconPicker.cat.Home": "Rumah",
	"iconPicker.cat.Household": "Rumah Tangga",
	"iconPicker.cat.Humanitarian": "Kemanusiaan",
	"iconPicker.cat.Images": "Gambar",
	"iconPicker.cat.Laundry": "Cucian",
	"iconPicker.cat.Letters": "Huruf",
	"iconPicker.cat.Logic": "Logika",
	"iconPicker.cat.Logistics": "Logistik",
	"iconPicker.cat.Map": "Peta",
	"iconPicker.cat.Maps": "Peta",
	"iconPicker.cat.Maritime": "Maritim",
	"iconPicker.cat.Marketing": "Pemasaran",
	"iconPicker.cat.Math": "Matematika",
	"iconPicker.cat.Mathematics": "Matematika",
	"iconPicker.cat.Media": "Media",
	"iconPicker.cat.Media Playback": "Pemutaran Media",
	"iconPicker.cat.Medical + Health": "Medis & Kesehatan",
	"iconPicker.cat.Money": "Uang",
	"iconPicker.cat.Mood": "Suasana Hati",
	"iconPicker.cat.Moving": "Pindahan",
	"iconPicker.cat.Music + Audio": "Musik & Audio",
	"iconPicker.cat.Nature": "Alam",
	"iconPicker.cat.Numbers": "Angka",
	"iconPicker.cat.Photography": "Fotografi",
	"iconPicker.cat.Photos + Images": "Foto & Gambar",
	"iconPicker.cat.Political": "Politik",
	"iconPicker.cat.Privacy": "Privasi",
	"iconPicker.cat.Punctuation + Symbols": "Tanda Baca & Simbol",
	"iconPicker.cat.Religion": "Agama",
	"iconPicker.cat.Science": "Ilmu Pengetahuan",
	"iconPicker.cat.Science Fiction": "Fiksi Ilmiah",
	"iconPicker.cat.Security": "Keamanan",
	"iconPicker.cat.Shapes": "Bentuk",
	"iconPicker.cat.Shopping": "Belanja",
	"iconPicker.cat.Social": "Media Sosial",
	"iconPicker.cat.Spinners": "Spinner",
	"iconPicker.cat.Sport": "Olahraga",
	"iconPicker.cat.Sports + Fitness": "Olahraga & Kebugaran",
	"iconPicker.cat.Symbols": "Simbol",
	"iconPicker.cat.System": "Sistem",
	"iconPicker.cat.Text": "Teks",
	"iconPicker.cat.Text Formatting": "Pemformatan Teks",
	"iconPicker.cat.Time": "Waktu",
	"iconPicker.cat.Toggle": "Sakelar",
	"iconPicker.cat.Transit": "Transit",
	"iconPicker.cat.Transportation": "Transportasi",
	"iconPicker.cat.Travel": "Perjalanan",
	"iconPicker.cat.Travel + Hotel": "Perjalanan & Hotel",
	"iconPicker.cat.UI actions": "Tindakan UI",
	"iconPicker.cat.Users + People": "Pengguna & Orang",
	"iconPicker.cat.Vehicles": "Kendaraan",
	"iconPicker.cat.Version control": "Kontrol Versi",
	"iconPicker.cat.Weather": "Cuaca",
	"iconPicker.cat.Writing": "Penulisan",
	"iconPicker.cat.Zodiac": "Zodiak",

	// Downloadable icon packs
	"iconPack.downloadTitle": "{{name}} belum diunduh",
	"iconPack.downloadDetail": "{{count}} ikon · {{size}} · unduhan sekali",
	"iconPack.download": "Unduh",
	"iconPack.downloading": "Mengunduh {{name}}…",
	"iconPack.downloadFailed":
		"Tidak dapat mengunduh {{name}}. Periksa koneksi Anda dan coba lagi.",
	"iconPack.retry": "Coba lagi",
	"iconPack.faBrandsNotice":
		"Ikon merek adalah merek dagang dari pemiliknya masing-masing. Penyertaannya tidak menunjukkan dukungan. Gunakan hanya untuk mewakili perusahaan, produk, atau layanan yang dimaksud.",
	"iconPack.artworkRestored":
		"Karya seni ikon untuk {{names}} telah diunduh.",
	"iconPack.diskWriteFailed":
		"Callout Studio tidak dapat menyimpan paket ikon ke disk, sehingga perlu diunduh ulang lain kali. Ikon yang Anda pilih tetap tersimpan dengan pengaturan Anda.",

	// Icon licences & credits
	"credits.title": "Lisensi ikon dan kredit",
	"credits.intro":
		"Callout Studio menggunakan beberapa pustaka ikon terbuka. Lisensinya direproduksi di bawah, bersama dengan apa yang diubah untuk menggunakannya di sini.",
	"credits.fullNotices": "Pemberitahuan pihak ketiga lengkap",
	"credits.pluginLicense":
		"Kode milik Callout Studio sendiri berada di bawah lisensi permissive; pustaka ikon mempertahankan lisensinya sendiri.",

	"contextMenu.editCallout": "Edit pengaturan callout",
	"contextMenu.copyMarkdown": "Salin Markdown callout",
	"contextMenu.openSettings": "Buka pengaturan Callout Studio",
	"contextMenu.setFoldClosed": "Atur callout menjadi tertutup (-)",
	"contextMenu.setFoldOpen": "Atur callout menjadi terbuka (+)",
	"contextMenu.setFoldNone": "Jadikan callout tidak dapat dilipat",
	"contextMenu.cutSection": "Potong bagian heading",
	"contextMenu.copySection": "Salin bagian heading",
	"contextMenu.deleteSection": "Hapus bagian heading",

	"heading.toggleFold": "Alihkan lipatan",

	"settings.globalSettings": "Opsi gaya global Callout Studio",
	"settings.globalSettingsScope":
		"Ini adalah pengaturan global: masing-masing sekaligus mengubah bentuk, jarak, dan ukuran setiap callout yang ditata gayanya oleh Callout Studio. Callout yang ditata gayanya oleh tema Anda tetap mempertahankan desain tema itu sendiri.",
	"settings.globalSettingsRegularDesc":
		"Sesuaikan batas, radius, skala font, dan perataan setiap block callout di vault Anda.",
	"settings.globalSettingsHeadingDesc":
		"Sesuaikan batas, bentuk, dan jarak vertikal setiap callout heading di vault Anda.",
	"settings.globalSettingsInlineDesc":
		"Sesuaikan batas dan bentuk setiap callout sebaris di vault Anda.",
	"settings.globalSettingsCustomize": "Sesuaikan",

	"settings.calloutTypeRegular": "Block Callout",
	"settings.calloutTypeHeading": "Callout heading",
	"settings.calloutTypeInline": "Callout sebaris",

	"settings.customizeMenu": "Sesuaikan item menu",
	"settings.customizeMenuDesc":
		"Pilih tindakan klik kanan mana yang muncul untuk setiap tipe callout dan atur ulang urutannya. Berfungsi di mode sumber dan Pratinjau Langsung.",
	"settings.customizeMenuButton": "Sesuaikan item menu",
	"menuCustomize.title": "Sesuaikan menu klik kanan",
	"menuCustomize.desc":
		"Aktifkan atau nonaktifkan tindakan dan seret gagang untuk mengatur ulang urutannya. Perubahan disimpan secara otomatis.",
	"menuCustomize.regular": "Block Callout",
	"menuCustomize.heading": "Callout heading",
	"menuCustomize.inline": "Callout sebaris",
	"menuCustomize.dragHandle": "Seret untuk mengatur ulang urutan",
	"menuItem.edit": "Edit callout",
	"menuItem.openSettings": "Buka pengaturan",
	"menuItem.copyMarkdown": "Salin Markdown",
	"menuItem.foldDefaults": "Default lipatan (terbuka / tertutup / tidak ada)",
	"menuItem.cutSection": "Potong bagian",
	"menuItem.copySection": "Salin bagian",
	"menuItem.deleteSection": "Hapus bagian",

	"confirm.ok": "Hapus",
	"confirm.cancel": "Batal",
	// Headings for each confirmation — every window carries one, so each
	// caller of ConfirmModal names what it is about to do.
	"confirm.titleDeleteCommand": "Hapus perintah",
	"confirm.titleResetAll": "Reset semua callout",
	"confirm.titleResetCallout": "Reset callout",
	"confirm.titleDeletePalette": "Hapus palet",
	"confirm.titleDeleteImage": "Hapus gambar",

	"vault.filesUpdated":
		"{{count}} referensi callout diperbarui di file vault.",
	"vault.idsUpdated":
		"{{count}} ID callout diperbarui di file vault: {{oldIds}} → {{newId}}",
	"vault.titlesUpdated":
		"{{count}} judul callout diperbarui di file vault: {{oldTitle}} → {{newTitle}}",
	"vault.replaceWith": "Ganti dengan:",
	"vault.deleteWithout": "Hapus tanpa mengganti",
	"vault.confirmDelete": "Konfirmasi",
	"vault.confirmReplace": "Ganti",
	"vault.replacePromptInUse":
		'"{{name}}" digunakan {{count}} kali di {{files}} file. Pilih callout untuk menggantikannya:',
	"vault.replacePromptUnused": 'Pilih callout untuk mengganti "{{name}}":',
	"vault.noReplacementAvailable":
		"Tidak ada callout lain yang tersedia untuk menggantikan ini.",
	"vault.convertedToPlainText":
		"{{blocks}} blok callout di {{files}} file diubah ke teks biasa.",
	"vault.resetAliasWarning":
		"{{count}} referensi di {{files}} file menggunakan alias kustom: {{aliases}}. Ini akan berhenti berfungsi setelah reset. Lanjutkan?",
	"vault.resetConfirm": "Reset",
	"vault.resetAllInUse":
		"⚠ {{count}} referensi callout di {{files}} file menggunakan tipe callout kustom yang akan dihapus.",

	"quickInsert.title": "Sisipan cepat callout blok",
	"quickInsert.desc": "Pilih callout untuk disisipkan di posisi kursor. Hanya callout blok.",
	"quickInsert.searchPlaceholder": "Cari callout",
	"quickInsert.sourceAria": "Filter menurut sumber callout",
	"quickInsert.sourceAll": "Semua",
	"quickInsert.sourceBuiltIn": "Bawaan",
	"quickInsert.sourceUser": "Callout saya",
	"quickInsert.editAria": "Edit {{name}}",
	"quickInsert.insertAria": "Sisipkan {{name}} sebagai callout blok",
	"quickInsert.noResults": "Tidak ada callout yang ditemukan",
	"quickInsert.noUserCallouts": "Anda belum membuat callout apa pun.",
	"quickInsert.noEditorHint": "Tidak ada catatan yang terbuka dalam mode edit, jadi tidak ada yang dapat disisipkan.",
	"quickInsert.noEditor": "Buka catatan dalam mode edit untuk menyisipkan callout.",

	"vaultStats.title": "Statistik callout",
	"vaultStats.totalCallouts": "Total callout",
	"vaultStats.typesFound": "Tipe yang ditemukan",
	"vaultStats.filesWithCallouts": "File dengan callout",
	"vaultStats.filesScanned": "File Markdown yang dipindai",
	"vaultStats.empty": "Tidak ada callout yang ditemukan di catatan Markdown.",
	"vaultStats.columnType": "Tipe",
	"vaultStats.columnName": "Nama",
	"vaultStats.columnSource": "Sumber",
	"vaultStats.columnCount": "Jumlah",
	"vaultStats.columnFiles": "File",
	"vaultStats.unknown": "Tidak diketahui",
	"vaultStats.sourceBuiltIn": "Bawaan",
	"vaultStats.sourceCustom": "Kustom",
	"vaultStats.sourceAutoFallback": "Fallback otomatis",
	"vaultStats.sourceTheme": "Cuplikan CSS",
	"vaultStats.sourceAlias": "Alias dari {{id}}",
	"vaultStats.sourceUnknown": "Tidak diketahui",
	"vaultStats.byRole": "Ditulis sebagai",
	"vaultStats.roleBlock": "Blok",
	"vaultStats.roleHeading": "Judul",
	"vaultStats.roleInline": "Inline",
	"vaultStats.defineUndefined": "Definisikan {{count}} yang hilang",
	"vaultStats.defineRunning": "Memindai",
	"vaultStats.defineDone": "{{count}} jenis callout ditambahkan.",
	"vaultStats.close": "Tutup",

	"import.title": "Masalah impor",
	"import.reportLeadIn":
		"Sepertinya file yang Anda impor telah dimodifikasi. Berikut daftar masalahnya:",
	"import.reportLeadInFatal":
		"File ini tidak terlihat seperti ekspor Callout Studio. Tidak dapat diimpor:",
	"import.entryHeading": "Entri {{index}} — {{label}}",
	"import.summary":
		"{{valid}} dari {{total}} entri valid · {{issues}} masalah ditemukan.",
	"import.btnCancel": "Batal",
	"import.btnImportValid": "Impor yang valid saja ({{count}})",
	"import.err.notRecognized":
		"File tidak dikenali: harus berupa array definisi callout atau ekspor Callout Studio.",
	"import.warn.settingsIgnored":
		"Blok pengaturan bukan objek yang valid dan diabaikan.",
	"import.warn.invalidGradient":
		"Gradien latar belakang tidak valid dan diabaikan.",
	"import.err.parseFailed":
		"File bukan JSON yang valid dan tidak dapat diurai.",
	"import.err.entryNotObject": "Entri harus berupa objek.",
	"import.err.requiredMissing":
		'Bidang yang diperlukan "{{field}}" hilang atau memiliki tipe yang salah.',
	"import.err.idEmpty": "ID tidak boleh kosong.",
	"import.err.idTooLong":
		'ID "{{value}}" memiliki {{length}} karakter; maksimum adalah {{max}}.',
	"import.err.idBadChar":
		'ID "{{value}}" mengandung karakter tidak valid ("|", "[", "]", tab, dan baris baru tidak diizinkan).',
	"import.err.idMetadata":
		'ID "{{value}}" mengandung "|". Di Obsidian, semua yang ada setelah "|" pertama adalah metadata callout, bukan bagian dari tipenya, sehingga entri ini mendeskripsikan callout "{{id}}". Dilewati, sehingga "{{id}}" yang sudah ada tidak berubah.',
	"import.err.idReserved":
		'ID "{{value}}" dicadangkan oleh Callout Studio untuk pratinjaunya sendiri dan tidak dapat diimpor.',
	"import.err.displayNameEmpty": "Nama tampilan tidak boleh kosong.",
	"import.err.displayNameTooLong":
		"Nama tampilan memiliki {{length}} karakter; maksimum adalah {{max}}.",
	"import.err.boolField":
		'"{{field}}" harus berupa boolean (true atau false).',
	"import.err.iconNotObject": "Ikon harus berupa objek.",
	"import.err.iconTypeInvalid":
		'Tipe ikon "{{value}}" bukan salah satu dari: {{types}}.',
	"import.warn.iconFieldIgnored":
		'"{{field}}" hanya berlaku untuk ikon Material dan diabaikan untuk tipe ikon {{type}}.',
	"import.err.iconValueEmpty":
		"Nilai ikon harus berupa string yang tidak kosong.",
	"import.err.iconValueTooLong":
		"Nilai ikon sangat panjang ({{length}} karakter).",
	"import.err.materialStyle":
		'Gaya ikon Material "{{value}}" bukan salah satu dari: outlined, filled, rounded, sharp.',
	"import.err.materialWeight":
		'Ketebalan ikon Material "{{value}}" harus berupa bilangan bulat antara 100 dan 700, dengan langkah 100.',
	"import.warn.iconRecolorIgnored":
		'"recolor" hanya berlaku untuk gambar Anda sendiri dan diabaikan untuk tipe ikon {{type}}.',
	"import.err.iconRecolorInvalid":
		'"recolor" harus true atau false (mendapat "{{value}}").',
	"import.err.colorInvalid":
		'"{{field}}" harus berupa warna heksadesimal seperti "#448aff" (diterima "{{value}}").',
	"import.err.numberRange":
		'"{{field}}" harus berupa angka antara {{min}} dan {{max}} (diterima "{{value}}").',
	"import.err.iconSizeRange":
		'"{{field}}" harus berupa angka antara {{min}} dan {{max}} (diterima "{{value}}").',
	"import.err.iconAdjustShape":
		'"iconAdjust" must be an object mapping a callout type ("regular", "heading", "inline") to its icon size and offsets.',
	"import.err.aliasesNotArray": '"aliases" harus berupa array string.',
	"import.err.aliasNotString": "Alias harus berupa string.",
	"import.err.aliasDup": 'Alias "{{value}}" duplikat dalam entri ini.',
	"import.err.tooManyIds":
		"Terlalu banyak ID ({{count}}); setiap callout dapat memiliki maksimal {{max}} ID (utama + alias).",
	"import.err.metadataShape":
		'"metadata" harus berupa objek yang semua nilainya adalah string.',
	"import.warn.unknownFields": "Bidang tidak dikenal diabaikan: {{fields}}.",
	"import.err.duplicateInFile":
		'ID/alias "{{value}}" sudah digunakan oleh entri #{{first}} dalam file ini.',
	"import.err.aliasConflict":
		'Alias "{{value}}" sudah digunakan oleh callout lain ("{{other}}") di vault Anda.',
	"import.warn.defaultFoldedAutofix":
		'"defaultFolded" adalah true sementara "foldable" adalah false; defaultFolded direset ke false.',
	"import.warn.imageMissing":
		"Callout ini menggunakan gambar yang tidak ada dalam file dan tidak ada dalam vault ini, sehingga akan menampilkan ikon placeholder hingga Anda memberikan yang baru.",

	"import.err.paletteIdInvalid":
		'"paletteId" harus berupa ID teks yang tidak kosong (menerima "{{value}}").',
	"import.warn.iconNameUnknown":
		'Tidak ada ikon "{{value}}" di {{type}}, sehingga ikon default digunakan.',
	"import.warn.cmIconUnknownNew":
		'Ikon "{{value}}" tidak tersedia di vault ini, sehingga ikon default digunakan.',
	"import.warn.cmIconUnknownExisting":
		'Ikon "{{value}}" tidak tersedia di vault ini, sehingga "{{id}}" mempertahankan ikon yang sudah dimilikinya.',
	"import.chooseSource": "Impor dari",
	"import.sourceStudio": "Callout Studio",
	"import.sourceStudioDesc":
		"Muat file .json yang diekspor dari Callout Studio.",
	"import.sourceCalloutManager": "Callout Manager",
	"import.sourceCalloutManagerDesc":
		"Bawa callout kustom Anda dari plugin Callout Manager.",
	"import.sourceAdmonition": "Admonition",
	"import.sourceAdmonitionDesc":
		"Bawa admonition kustom Anda dari plugin Admonition.",
	"import.cmTitle": "Impor dari Callout Manager",
	"import.cmInstructions":
		"Setiap callout yang disesuaikan dibawa beserta ikon dan warnanya. Gaya per-tema dan CSS kustom tidak memiliki padanan di sini dan tidak ikut dibawa.",
	"import.cmFromVault": "Vault ini",
	"import.cmVaultChecking": "Mencari plugin Callout Manager…",
	"import.cmVaultFound": "{{count}} callout kustom ditemukan.",
	"import.cmVaultNotFound":
		"Tidak ada callout kustom yang ditemukan di vault ini.",
	"import.cmPasteLabel":
		"Atau tempel gaya yang disalin dari Callout Manager di sini:",
	"import.cmPlaceholder":
		"Tempel gaya yang disalin, atau file data.json, di sini…",
	"import.cmBtnCancel": "Batal",
	"import.cmBtnImport": "Impor",
	"import.err.cmNoBlocksFound":
		"Tidak ada gaya Callout Manager yang ditemukan dalam teks yang ditempel.",
	"import.err.cmNotRecognized":
		"File tidak dikenali: yang diharapkan adalah gaya yang dihasilkan oleh tombol Copy Callout Manager, atau file data.json Callout Manager.",
	"import.err.cmNoEntries":
		"Tidak ada callout kustom yang ditemukan untuk diimpor.",
	"import.err.cmNoColorForNew":
		'Tidak ada warna yang dapat digunakan ditemukan untuk callout baru "{{value}}"; dilewati.',
	"import.err.cmIdConflict":
		'ID "{{value}}" sudah digunakan sebagai alias oleh callout lain ("{{other}}") dan dilewati.',
	"import.warn.cmNoColorDefault":
		"Tidak ada warna yang diatur di Callout Manager, sehingga abu-abu default digunakan.",
	"import.warn.cmThemeCondition":
		"Warna atau ikon callout ini hanya diatur untuk satu tema. Callout Studio tidak memiliki gaya per-tema, sehingga dibawa untuk semua tema.",
	"import.warn.cmCustomStyles":
		"Callout ini juga memiliki CSS kustom di Callout Manager. Gaya tersebut bukan bagian dari impor, sehingga hanya ikon dan warnanya yang dibawa.",

	// Import — Admonition
	"import.admTitle": "Impor dari Admonition",
	"import.admInstructions":
		"Setiap admonition menjadi callout dengan nama, ikon, dan " +
		"warnanya. Pengaturan yang tidak ada padanannya di Callout Studio " +
		"(perintah, tombol salin, judul tersembunyi) ditinggalkan.",
	"import.admFromVault": "Vault ini",
	"import.admVaultChecking": "Mencari plugin Admonition…",
	"import.admVaultFound": "Ditemukan {{count}} admonition kustom.",
	"import.admVaultNotFound":
		"Tidak ada admonition kustom yang ditemukan di vault ini.",
	"import.admFromFile": "Sebuah berkas",
	"import.admFromFileDesc":
		"Berkas admonitions.json, atau paket yang dibagikan.",
	"import.admChooseFile": "Pilih berkas…",
	"import.admPasteLabel": "Atau tempel JSON di sini:",
	"import.admPlaceholder": "Tempel admonition Anda di sini…",
	"import.admBtnCancel": "Batal",
	"import.admBtnImport": "Impor",
	"import.err.admNotRecognized":
		"Berkas tidak dikenali: diharapkan daftar admonition atau " +
		"data.json milik Admonition.",
	"import.err.admNoEntries":
		"Tidak ada admonition yang ditemukan untuk diimpor.",
	"import.err.admTypeMissing":
		'Admonition ini tidak memiliki "type" dan dilewati.',
	"import.warn.admIconUnknown":
		'Tidak ada ikon bernama "{{value}}" di pustaka ikon mana pun, ' +
		"jadi ikon bawaan digunakan.",
	"import.warn.admIconUnknownExisting":
		'Tidak ada ikon bernama "{{value}}" di pustaka ikon mana pun, ' +
		'jadi "{{id}}" tetap memakai ikon yang sudah ada.',
	"import.warn.admImageFailed":
		"Gambar yang diunggah tidak dapat dibaca, jadi ikon bawaan " +
		"digunakan.",
	"import.warn.admIconWithCss":
		"Admonition ini digayakan oleh cuplikan CSS di Admonition. Gaya " +
		"itu bukan bagian dari impor, jadi hanya nama, ikon, dan warnanya " +
		"yang ikut.",
	"import.warn.admNoColor": "Warna tidak diatur, jadi biru bawaan digunakan.",
	"import.warn.admTitleTruncated":
		"Judul memiliki {{length}} karakter; dipendekkan menjadi {{max}}.",

	"footer.tagline":
		"Ada umpan balik, komentar, atau saran? Saya ingin mendengarnya!",
	"footer.madeBy": "Dibuat oleh Niv  •  ",
	"settings.deletePaletteConfirmLinkedOne":
		'Hapus palet "{{name}}"?\n1 callout menggunakannya. Ia tetap mempertahankan warnanya, dan Anda bisa menyambungkannya lagi nanti dari baris Warna di editornya.',
	"settings.deletePaletteConfirmLinked":
		'Hapus palet "{{name}}"?\n{{count}} callout menggunakannya. Mereka tetap mempertahankan warnanya, dan Anda bisa menyambungkannya lagi nanti dari baris Warna di salah satu editornya.',
	"settings.unlinkedColors": "Warna tidak tertaut",
	"settings.unlinkedColorsDesc":
		"Callout yang warna tersimpannya dihapus. Mereka tetap mempertahankan warna yang dimiliki; pulihkan akan menyimpan warna lagi dan menyambungkan kembali seluruh grup.",
	"settings.unlinkedColorOne": "1 callout",
	"settings.unlinkedColorCount": "{{count}} callout",
	"settings.restoreColor": "Pulihkan",
	"settings.palettesMergedNotice":
		"Menggabungkan {{count}} palet impor ke warna tersimpan yang sudah memiliki warna yang sama.",
	"notice.palettesMerged":
		"Menggabungkan {{count}} warna tersimpan yang memiliki warna identik: {{names}}. Callout yang menggunakannya tetap mempertahankan warnanya dan sekarang tertaut ke warna yang tersisa.",
	"editor.colorsDescDeleted":
		"Warna tersimpan callout ini telah dihapus. Anda bisa menyimpannya lagi dengan {{link}}.",
	"editor.colorsDescDeletedOther":
		"Warna tersimpan callout ini telah dihapus. Anda bisa menyimpannya lagi dengan {{link}} — 1 callout lain yang menggunakannya juga akan tersambung kembali.",
	"editor.colorsDescDeletedOthers":
		"Warna tersimpan callout ini telah dihapus. Anda bisa menyimpannya lagi dengan {{link}} — {{count}} callout lain yang menggunakannya juga akan tersambung kembali.",
	"editor.colorsDescDeletedLink": "klik di sini",
	"palette.colorExists":
		'Warna-warna ini identik dengan "{{name}}". Dua warna tersimpan tidak boleh sama — ubah satu warna untuk membedakannya.',
	"palette.colorExistsUse":
		'Warna-warna ini identik dengan "{{name}}". Dua warna tersimpan tidak boleh sama — ubah satu warna, atau {{link}}.',
	"palette.colorExistsUseLink": "gunakan yang sudah ada",
	"locale.downloading": "Mengunduh terjemahan…",
	"locale.notDownloaded": "{{name}} belum diunduh",
	"locale.notDownloadedDesc":
		"Callout Studio menampilkan bahasa Inggris sampai terjemahan dapat diunduh. Akan mencoba lagi saat Obsidian dijalankan berikutnya.",
	"locale.retry": "Coba lagi",
	"locale.diskWriteFailed":
		"Callout Studio tidak dapat menyimpan terjemahan ke disk, jadi terjemahan perlu diunduh lagi nanti.",
	"notice.exportedCssCreated": "Cuplikan CSS disimpan di {{path}}",
	"notice.exportedCssUpdated": "Cuplikan CSS diperbarui di {{path}}",
	"notice.exportedCssUnchanged": "Cuplikan CSS sudah terbaru.",
	"notice.exportCssEmpty": "Tidak ada callout khusus untuk diekspor.",
	"notice.exportCssFailed":
		"Cuplikan CSS tidak dapat disimpan. Periksa konsol pengembang untuk detailnya.",
	"notice.exportCssEnabled":
		"Cuplikan ini diaktifkan di vault ini. Callout Studio sudah memberi gaya pada callout tersebut, dan cuplikan mempertahankan gaya saat diekspor.",
	"confirm.titleOverwriteSnippet": "Timpa cuplikan CSS",
	"confirm.overwriteSnippet":
		"Cuplikan CSS di folder snippets berubah sejak ditulis oleh Callout Studio. Mengekspor lagi akan mengganti seluruh file.",
	"confirm.overwriteSnippetOk": "Timpa",
	"export.chooseFormat": "Ekspor sebagai",
	"export.formatJson": "Cadangan Callout Studio",
	"export.formatJsonDesc":
		"File .json berisi callout dan pengaturan Anda untuk diimpor ke vault lain.",
	"export.formatCss": "Cuplikan CSS",
	"export.formatCssDesc":
		"File .css yang disimpan di folder snippets vault ini, untuk digunakan saat Callout Studio tidak terpasang. Hanya mencakup callout biasa dan merupakan snapshot; ekspor lagi setelah mengubah callout.",
	"quickInsert.readingViewHint": "Catatan ini terbuka dalam mode baca, jadi tidak ada yang dapat disisipkan.",
	"quickInsert.readingView": "Beralihlah ke mode sumber atau Pratinjau Langsung untuk menyisipkan callout.",
	"quickInsert.noCursorHint": "Tidak ada kursor di catatan ini, jadi tidak ada tempat untuk menyisipkan.",
	"quickInsert.noCursor": "Tempatkan kursor di catatan pada posisi tempat Anda ingin menyisipkan callout, lalu coba lagi.",
};
