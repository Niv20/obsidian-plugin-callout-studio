export const vi: Record<string, string> = {
	"cmd.openSettings": "Mở cài đặt",
	"cmd.createCallout": "Tạo loại callout mới",
	"cmd.insertEmptyCallout": "Chèn callout trống",
	"cmd.calloutWrap": "Bọc trong callout",
	"cmd.calloutUnwrap": "Bỏ callout",

	"cmd.customWrapBlock": "Bọc trong callout khối {{name}}",
	"cmd.customInsertBlock": "Chèn callout khối {{name}}",
	"cmd.customInsertHeading": "Chèn tiêu đề callout H{{level}} {{name}}",
	"cmd.customInsertInline": "Chèn callout nội dòng {{name}}",
	"cmd.openQuickInsert": "Chèn nhanh callout khối",

	"autocomplete.createNew": 'Tạo callout mới: "{{name}}"',

	"settings.fallbackTag": "Mặc định",
	"settings.fallbackTagAuto": "Mặc định tự động",
	"settings.autoDiscover": "Tự động phát hiện callout trong kho của bạn",
	"settings.autoDiscoverDesc":
		"Nhận biết các loại callout được viết trong ghi chú của bạn và tự động thêm chúng vào danh sách. Tắt tùy chọn này không ảnh hưởng đến các callout bạn đã có — bạn vẫn có thể tự thêm chúng, hoặc dùng Quét lại kho bên dưới.",
	"settings.rescanVault": "Quét lại vault",
	"settings.rescanVaultDesc":
		"Tìm các ID callout chưa được nhận dạng trong ghi chú và thêm chúng như các hàng dự phòng.",
	"settings.rescanVaultHintAction": "Quét ngay",
	"settings.rescanComplete":
		"Quét lại hoàn tất: đã thêm {{count}} callout mới.",
	"replaceModal.deleteWithoutReplaceSuffix": "(quay lại mặc định)",
	"replaceModal.titleDelete": "Xóa callout",
	"replaceModal.titleReplace": "Thay thế trong vault",

	"firstRun.title": "Tìm callouts hiện có trong vault?",
	"firstRun.body":
		"Callout Studio có thể quét vault của bạn để khám phá các callout bạn đang sử dụng, để chúng xuất hiện trong danh sách cài đặt và áp dụng kiểu dự phòng của bạn.",
	"firstRun.heavyVaultNote":
		"Vault của bạn có {{count}} tệp Markdown — quá trình quét có thể mất vài giây.",
	"firstRun.laterHint":
		"Bạn luôn có thể chạy điều này sau từ Cài đặt → Thông tin & bảo trì vault → Quét lại vault.",
	"firstRun.scanNow": "Quét ngay",
	"firstRun.noThanks": "Không, cảm ơn",
	"firstRun.autoScanComplete":
		"Callout Studio đã quét vault và thêm {{count}} callout.",
	"firstRun.scanning": "Đang quét",
	"firstRun.autoScanFailed":
		"Callout Studio không thể quét vault của bạn. Bạn có thể thử lại từ Cài đặt → Thông tin & bảo trì vault → Quét lại vault.",
	"firstRun.scanFailed":
		"Quá trình quét chưa hoàn tất. Bạn có thể thử lại từ Cài đặt → Thông tin & bảo trì vault → Quét lại vault.",

	"welcome.tooltip": "Giới thiệu về Callout Studio",
	"welcome.title": "Chào mừng đến với Callout Studio!",
	"welcome.tagline":
		"Giải pháp toàn diện của bạn để tạo, tạo kiểu và quản lý callout trong Obsidian.",
	"welcome.previewTitle": "Xem nó hoạt động",
	"welcome.demoName": "Callout Studio",
	"welcome.sample":
		"Callout Studio cho phép bạn tạo callout với biểu tượng, màu sắc và tên tùy chỉnh.\n\n" +
		"Bạn có thể sử dụng callout này theo **ba** cách khác nhau:\n\n" +
		"## [!{{id}}] Callout làm tiêu đề\n" +
		"Để biến bất kỳ tiêu đề nào thành tiêu đề kiểu callout, hãy thêm `[!type]` ngay sau các dấu `#`.\n\n" +
		"Muốn có một [!{{id}}]{callout nội dòng} như thế này? Chỉ cần thêm `[!type]{text}` vào giữa câu, mà không làm gián đoạn mạch viết của bạn.\n\n" +
		"> [!{{id}}] Callout khối\n" +
		"> Callout cổ điển vẫn hoạt động với đúng cú pháp mà bạn đã quen thuộc: `> [!type]`.\n\n" +
		"Callout Studio còn có nhiều thứ hơn thế để mang lại! [Tìm hiểu thêm]({{repoUrl}}).\n",

	"deleteModal.title": 'Xóa callout "{{name}}"?',
	"deleteModal.bodyInUse":
		"Callout này xuất hiện {{count}} lần trong {{files}} tệp.",
	"deleteModal.bodyInUseExplain":
		"Xóa sẽ chuyển đổi các khối đó thành văn bản thường — chúng sẽ mất kiểu và tiêu đề callout.",
	"deleteModal.replaceHint":
		"Bạn có thể thay thế nó bằng callout khác, giữ nguyên nội dung vault dưới dạng callout có kiểu.",
	"deleteModal.bodyUnused":
		'"{{name}}" không được sử dụng trong bất kỳ ghi chú nào, nhưng là callout tùy chỉnh bạn đã tạo. Xóa sẽ loại bỏ nó khỏi danh sách này.',
	"deleteModal.replaceInstead": "Thay thế thay vào đó",
	"deleteModal.deleteInUse": "Xóa (chuyển thành văn bản thường)",
	"deleteModal.deleteUnused": "Xóa callout",

	// The variant for a callout whose definition Callout Studio cannot remove:
	// one of Obsidian's built-ins, or a type the active theme declares.
	"deleteModal.titleKeep": 'Xóa mọi lượt sử dụng "{{name}}"?',
	"deleteModal.keepsRowBuiltIn":
		"Đây là một trong các callout tích hợp của Obsidian, vì vậy bản thân loại này vẫn khả dụng — chỉ các lượt sử dụng trong ghi chú của bạn thay đổi.",
	"deleteModal.keepsRowTheme":
		"{{theme}} định nghĩa loại callout này, vì vậy nó vẫn khả dụng và giữ nguyên hình thức. Callout Studio chỉ thay đổi ghi chú trong vault của bạn — không có gì thuộc về giao diện của bạn bị ảnh hưởng.",
	"deleteModal.clearUsages": "Xóa các lượt sử dụng (chuyển thành văn bản thường)",

	"settings.title": "Callout Studio",
	"settings.myCalloutTypes": "Các loại callout của tôi",
	"settings.builtInCallouts": "Callouts tích hợp",
	"settings.contextMenu": "Menu ngữ cảnh",
	"settings.autocomplete": "Tự động hoàn thành",
	"settings.keyboardShortcuts": "Phím tắt",
	"settings.language": "Ngôn ngữ",
	"settings.languageDesc":
		"Ngôn ngữ hiển thị cho Callout Studio. Mặc định theo ngôn ngữ giao diện của Obsidian.",
	"settings.languageAuto": "Tự động (giống Obsidian)",
	"settings.importExport": "Nhập / xuất",
	"settings.import": "Nhập",
	"settings.export": "Xuất",
	"settings.importDesc":
		"Nhập dữ liệu Callout Studio từ vault khác bằng tệp JSON.",
	"settings.exportDesc":
		"Lưu tất cả các loại callout tùy chỉnh ở định dạng JSON.",
	"settings.importConflictNotice":
		"Đã nhập {{count}} loại callout; {{overwritten}} mục hiện có đã bị ghi đè.",

	"settings.addNewCallout": "+ thêm callout",

	"settings.noCalloutsNow": "Hiện không có callout tùy chỉnh.",

	"settings.editAria": "Chỉnh sửa {{name}}",
	"settings.moreRowActionsAria": "Thêm hành động cho {{name}}",
	"settings.usageInfo": "{{count}} lần sử dụng trong {{files}} tệp",
	"settings.replaceAction": "Thay thế trong vault",
	"settings.deleteAction": "Xóa",
	"settings.resetAction": "Đặt lại về mặc định",
	"settings.makeFallbackAction": "Sử dụng kiểu dự phòng mặc định",

	"settings.colorSwatchAria": "Điểm nhấn: {{accent}} · Nền: {{bg}}",

	// Handing a callout to the user's own CSS. Not a statement about the theme —
	// that is derived and has no action — so the wording names the snippet.
	"settings.externalCssAction": "Tạo kiểu bằng CSS của riêng tôi",
	"settings.externalCssStopAction": "Để Callout Studio tạo kiểu cho callout này trở lại",
	// The one label on any row: a callout sitting among the user's own that
	// Callout Studio has nonetheless stopped painting.
	"settings.externalCssTag": "CSS bên ngoài",
	// Settings — callouts the active theme styles
	"settings.themeCalloutsHeading": "Callout từ giao diện của bạn",
	"settings.themeCalloutsDesc":
		"{{theme}} cung cấp hoặc tạo kiểu lại cho những callout này, vì vậy Callout Studio giữ nguyên như giao diện của bạn vẽ chúng và chỉ cung cấp chúng dưới dạng callout khối. Cả hai loại đều xuất hiện ở đây: các loại callout mà giao diện của bạn thêm vào, và các callout tích hợp mà giao diện thay đổi hình thức. Các loại callout do giao diện thêm vào chỉ được liệt kê khi giao diện đó đang hoạt động.",
	"settings.themeCalloutsDefaultTheme": "Giao diện của bạn",
	"settings.themePreviewAria":
		'Xem trước "{{name}}" — xem giao diện của bạn vẽ nó như thế nào',
	"settings.clearUsesAction": "Xóa các lượt sử dụng trong ghi chú của bạn",
	"settings.builtInAllThemeStyled":
		"{{theme}} tạo kiểu lại cho mọi callout tích hợp, vì vậy tất cả đều được liệt kê ở trên và Callout Studio không can thiệp vào chúng. Để thiết kế callout của riêng bạn, hãy thêm một callout với ID khác.",

	"settings.fallbackCallout": "Callout dự phòng mặc định",
	"settings.fallbackCalloutDesc":
		"Các loại callout không nhận dạng được trong vault sẽ kế thừa kiểu của callout này.",

	"settings.globalStyle": "Kiểu callout toàn cục",
	"settings.border": "Viền",
	"settings.borderAll": "Tất cả",
	"settings.borderTop": "Trên",
	"settings.borderRight": "Phải",
	"settings.borderBottom": "Dưới",
	"settings.borderLeft": "Trái",
	"settings.borderWidth": "Độ dày viền",
	"settings.fontScaleGroup": "Tỷ lệ phông",
	"settings.titleScale": "Tiêu đề",
	"settings.contentScale": "Nội dung",
	"settings.inlineTextScale": "Văn bản",
	"settings.shapeGroup": "Hình dạng",
	"settings.borderRadius": "Độ bo góc",
	"settings.alignGroup": "Căn chỉnh",
	"settings.alignContent": "Căn chỉnh nội dung với tiêu đề",
	"settings.headingSpacingGroup": "Khoảng cách tiêu đề",
	"settings.headingPadVertical": "Khoảng cách dọc",
	"settings.headingGap": "Khoảng cách giữa các tiêu đề",
	"settings.headingFoldGroup": "Thu gọn",
	"settings.headingFoldArrow": "Hiển thị mũi tên thu gọn",
	"settings.styleDemoName": "Mẫu",
	"settings.previewTitle": "Xem trước",

	// Settings — Saved color palettes
	"settings.customPalettes": "Bảng màu đã lưu",
	"settings.newPalette": "Bảng màu mới",
	"settings.customPalettesEmpty": "Hiện không có bảng màu đã lưu.",
	"settings.editPaletteAria": "Chỉnh sửa bảng màu {{name}}",
	"settings.deletePaletteAria": "Xóa bảng màu {{name}}",
	"settings.deletePaletteConfirm":
		'Xóa bảng màu "{{name}}"?\nCác callout dùng màu này sẽ không bị ảnh hưởng.',
	"settings.enableAutocomplete": "Bật tự động hoàn thành [!",
	"settings.enableAutocompleteDesc":
		'Hiển thị gợi ý khi bạn gõ "[!" trong trích dẫn khối trong trình soạn thảo. Chọn loại callout từ danh sách để chèn tiêu đề callout đầy đủ.',

	"settings.customCommands": "Lệnh và phím tắt",
	"settings.customCommandsDesc":
		"Xem mọi lệnh của Callout Studio và phím tắt được gán cho lệnh đó, đồng thời tạo lệnh riêng cho những callout bạn dùng nhiều nhất. Không có phím tắt nào được gán theo mặc định.",
	"settings.customCommandsButton": "Quản lý lệnh",

	"commandBuilder.title": "Lệnh và phím tắt",
	"commandBuilder.desc":
		"Dùng nút + để đặt hoặc thay đổi phím tắt trong cài đặt phím tắt của Obsidian.",
	"commandBuilder.builtIn": "Lệnh tích hợp",
	"commandBuilder.toggleAria": "Bật hoặc tắt {{name}}",
	"commandBuilder.hotkeyBlank": "Trống",
	"commandBuilder.hotkeyAria": "Đặt phím tắt cho {{name}}",
	"commandBuilder.yourCommands": "Lệnh của bạn",
	"commandBuilder.newCommand": "Lệnh mới",
	"commandBuilder.empty": "Chưa có lệnh tùy chỉnh nào.",
	"commandBuilder.unknownCommand": "lệnh này",
	"commandBuilder.editAria": "Chỉnh sửa {{name}}",
	"commandBuilder.deleteAria": "Xóa {{name}}",
	"commandBuilder.deleteConfirm":
		"Xóa lệnh {{name}}? Phím tắt gán cho lệnh này sẽ ngừng hoạt động.",
	"commandBuilder.newTitle": "Lệnh mới",
	"commandBuilder.editTitle": "Chỉnh sửa lệnh",
	"commandBuilder.format": "Định dạng callout",
	"commandBuilder.formatDesc": "Loại callout mà lệnh này sẽ viết.",
	"commandBuilder.formatHeading": "Tiêu đề",
	"commandBuilder.formatInline": "Nội dòng",
	"commandBuilder.formatBlock": "Khối",
	"commandBuilder.roleDisabled":
		"Định dạng này đang tắt, vì vậy lệnh sẽ chèn văn bản thường cho đến khi bạn bật lại.",
	"commandBuilder.callout": "Loại callout",
	"commandBuilder.calloutDesc": "Callout mà lệnh này chèn vào.",
	"commandBuilder.headingLevel": "Cấp độ tiêu đề",
	"commandBuilder.headingLevelDesc": "Cấp độ tiêu đề sẽ được viết.",
	"commandBuilder.action": "Hành động",
	"commandBuilder.actionDesc":
		"Bọc sẽ biến phần chọn thành callout; chèn sẽ thêm một callout trống.",
	"commandBuilder.actionWrap": "Bọc phần chọn",
	"commandBuilder.actionInsert": "Chèn mới",
	"commandBuilder.preview": "Tên lệnh",
	"commandBuilder.duplicate": "Bạn đã có một lệnh làm chính xác việc này.",
	"commandBuilder.noCallouts": "Chưa có loại callout nào để tạo lệnh.",
	"commandBuilder.save": "Lưu",

	"commandBuilder.roleThemeOwned":
		"Giao diện của bạn cung cấp callout này, nên nó chỉ có định dạng Khối.",
	"commandBuilder.commandSuspended":
		"Đã tạm dừng: giao diện của bạn cung cấp callout này, nên nó chỉ có định dạng Khối. Lệnh này sẽ hoạt động trở lại khi giao diện ngừng cung cấp nó.",

	"settings.vaultMaintenance": "Thông tin & bảo trì vault",
	"settings.vaultStats": "Thống kê callout",
	"settings.vaultStatsDesc":
		"Đếm mọi callout trong ghi chú Markdown của bạn — dạng khối, tiêu đề và nội tuyến — và nhóm theo loại.",
	"settings.vaultStatsButton": "Xem thống kê",
	"settings.vaultStatsScanning": "Đang quét",
	"settings.resetAll": "Đặt lại",
	"settings.resetAllDesc":
		"Xóa tất cả callouts người dùng, đặt lại callouts tích hợp, kiểu toàn cục (viền, tỷ lệ phông, hình dạng), bảng màu đã lưu, tùy chỉnh menu chuột phải và SVG Material đã tải.",
	"settings.resetAllButton": "Đặt lại tất cả",
	"settings.resetAllConfirm":
		"Điều này sẽ xóa tất cả callouts tùy chỉnh, đặt lại callouts tích hợp, kiểu toàn cục, bảng màu đã lưu, tùy chỉnh menu chuột phải và tất cả SVG Material đã cache. Hành động này không thể hoàn tác. Bạn có chắc không?",
	"notice.resetAllDone": "Đã đặt lại tất cả về mặc định.",

	"notice.customCommandsRemoved":
		"Đã xóa {{count}} lệnh tùy chỉnh có loại callout không còn tồn tại.",
	"notice.customCommandMissingCallout":
		"Loại callout của lệnh đó không còn tồn tại.",
	"notice.exported": "Đã xuất callouts vào callout-studio-export.json",
	"notice.importedJSON": "Đã nhập {{count}} loại callout từ JSON.",
	"notice.importedSettings": "Đã nhập cài đặt plugin.",
	"notice.importedCalloutManager":
		"Đã nhập từ Callout Manager: {{created}} đã tạo, {{updated}} đã cập nhật.",
	"notice.importedAdmonition":
		"Đã nhập từ Admonition: tạo mới {{created}}, cập nhật " +
		"{{updated}}.",
	"notice.noNewJSON":
		"Không có loại callout mới nào được nhập (ID có thể đã tồn tại).",
	"notice.iconDownloadFailed":
		'Không thể tải biểu tượng Material "{{name}}". Nó có thể không có sẵn cho kiểu/độ dày này, hoặc kết nối của bạn đang ngoại tuyến.',

	"notice.externalCssOn":
		'Callout Studio không còn tạo kiểu cho "{{name}}" nữa — CSS của riêng bạn quyết định hình thức của nó. Các dạng Callout tiêu đề và Callout nội dòng của nó sẽ không hiển thị.',
	"notice.externalCssOff": 'Callout Studio lại tạo kiểu cho "{{name}}".',

	"notice.nothingToWrap": "Không có gì để bọc.",
	"notice.cursorNotInsideCallout": "Con trỏ không nằm trong callout.",
	"notice.autocompleteTargetMoved":
		"Không có gì được chèn — dòng đã thay đổi khi trình chỉnh sửa đang mở.",
	"notice.openHotkeysFailed": "Không thể mở cài đặt phím tắt Obsidian.",
	"notice.filterHotkeysFailed":
		"Đã mở phím tắt Obsidian, nhưng không thể áp dụng bộ lọc Callout Studio.",

	"editor.editCallout": "Chỉnh sửa callout",
	"editor.newCallout": "Callout mới",
	"editor.displayName": "Tên hiển thị",
	"editor.displayNameDesc": "Nhãn dễ đọc được hiển thị trong giao diện",
	"editor.displayNameBuiltIn":
		"Không thể thay đổi tên hiển thị của callouts tích hợp",
	"editor.displayNamePlaceholder": "Callout của tôi",
	"editor.calloutIds": "ID callout",
	"editor.calloutIdsDesc":
		"Tất cả các định danh cho callout này. Cho phép dấu cách.\nNhấn Enter hoặc nút + để thêm.",
	"editor.calloutIdsPlaceholder": "Thêm ID",
	"editor.addId": "Thêm ID",
	"editor.idLinkedToName": "Liên kết với tên hiển thị",
	"editor.idCannotDelete":
		"ID này được liên kết với tên hiển thị và không thể xóa — chỉnh sửa tên để thay đổi nó",
	"editor.icon": "Biểu tượng",
	"editor.pickIcon": "Thay đổi biểu tượng",
	"editor.replaceIcon": "Thay thế biểu tượng",
	"editor.removeIcon": "Xóa biểu tượng",
	"editor.noIcon": "Không có biểu tượng",
	"editor.resetIcon": "Đặt lại biểu tượng về mặc định",
	"editor.livePreview": "Xem trước trực tiếp",
	"editor.iconAdjustment": "Điều chỉnh biểu tượng",
	"editor.picture": "Hình ảnh",
	"editor.size": "Kích thước",
	"editor.horizontalOffset": "Độ lệch ngang",
	"editor.verticalOffset": "Độ lệch dọc",
	"editor.colors": "Màu sắc",
	"editor.colorsDesc":
		"Sets this callout's border, background, and text colors.",
	"editor.resetColors": "Đặt lại màu sắc về mặc định",
	"editor.paletteDeleted": "Màu đã xóa",
	"editor.paletteGroupObsidian": "Callouts Obsidian",
	"editor.paletteGroupPresets": "Cài đặt màu trước",
	"editor.paletteGroupCustom": "Tùy chỉnh",
	"editor.paletteNewColor": "Màu mới…",
	"editor.contrastWarning": "Độ tương phản thấp so với nền — có thể khó đọc",
	"editor.foldable": "Có thể gập",
	"editor.foldableDesc":
		"Chọn liệu callout có thể gập và trạng thái mặc định nào áp dụng trên toàn vault.",
	"editor.foldOff": "Tắt",
	"editor.foldOpen": "Mặc định mở",
	"editor.foldClosed": "Mặc định đóng",
	"editor.cancel": "Hủy",
	"editor.saveChanges": "Lưu thay đổi",
	"editor.createCallout": "Tạo callout",
	"editor.nameRequired": "Cần có tên hiển thị trước khi tạo callout.",
	"editor.noChangesToSave": "Không có thay đổi nào được thực hiện.",
	"editor.downloadingIcon": "Đang tải biểu tượng",
	"editor.idEmpty": "Cần ít nhất một ID",
	"editor.idExists": "Đã tồn tại callout với ID này",
	"editor.idConflict": "ID này xung đột với callout hiện có",
	"editor.idDashConflict":
		'Obsidian ghi khoảng trắng thành dấu gạch ngang, vì vậy ID này xung đột với "{{other}}"',

	"editor.idFromTheme":
		"{{theme}} đã cung cấp một callout với ID này, vì vậy Callout Studio không thể tạo kiểu cho nó. Hãy chọn một ID khác.",
	"editor.idThemePattern":
		"Lưu ý: giao diện của bạn tạo kiểu cho mọi callout khớp với {{pattern}}, vì vậy nó có thể ghi đè hình thức của callout này.",

	"editor.untitledCallout": "Callout chưa đặt tên",
	"editor.loremIpsum":
		"Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
	"editor.loremIpsumShort":
		"Lorem ipsum dolor sit amet, consectetur adipiscing elit.",
	"editor.sampleInlineText":
		"Đây là một viên [!{id}] nội tuyến bên trong một đoạn văn.",
	"editor.previewReadOnly": "Không thể chỉnh sửa bản xem trước trực tiếp",

	// Theme callout preview window — opens instead of the editor for a callout
	// the active theme supplies or restyles.
	"themePreview.title": '{{name}} — do giao diện của bạn cung cấp',
	"themePreview.owned":
		'{{theme}} cung cấp và tạo kiểu cho "{{name}}". Callout Studio sẽ không ghi đè nó, vì vậy callout khối của nó trông giống hệt như giao diện của bạn vẽ.',
	"themePreview.readOnly":
		"Điều đó có nghĩa là màu sắc, biểu tượng, tên và ID của nó không thể thay đổi ở đây. Nếu bạn muốn một thiết kế riêng, hãy tạo một callout mới với ID khác.",
	"themePreview.blockOnly":
		"Định dạng Tiêu đề và Nội dòng không khả dụng cho các callout do giao diện của bạn cung cấp. Callout khối sử dụng kiểu gốc của giao diện.",
	"themePreview.previewTitle": "Cách nó hiển thị hiện tại",
	"themePreview.blockSample":
		"> [!{{id}}] {{name}}\n" +
		"> Đây là hình thức nội dung của callout.\n",

	"editor.externalStyleClose": "Đã hiểu",

	// Palette editor modal
	"palette.newTitle": "Bảng màu mới",
	"palette.groupPalette": "Bảng màu",
	"palette.editTitle": "Chỉnh sửa bảng màu",
	"palette.name": "Tên",
	"palette.namePlaceholder": "Bảng màu của tôi",
	"palette.nameExists": "Đã tồn tại bảng màu với tên này",
	"palette.baseColor": "Màu gốc",
	"palette.baseColorHint":
		"Chúng tôi sẽ tự động khớp màu nền với màu này. Nếu muốn, bạn có thể điều khiển riêng bằng cách {{link}}.",
	"palette.baseColorHintLink": "nhấp vào đây",
	"palette.advancedColors": "Màu sắc",
	"palette.advancedColorsHint":
		"Đang chỉnh sửa màu cho chế độ {{mode}} - chế độ còn lại sẽ tự động cập nhật. Chuyển giao diện Obsidian để kiểm tra.",
	"palette.revertHint":
		"Muốn dùng một màu cơ bản duy nhất thay thế? {{link}}.",
	"palette.revertHintLink": "Hoàn tác",
	"palette.lightMode": "Sáng",
	"palette.darkMode": "Tối",
	"palette.accentColor": "Màu nhấn",
	"palette.backgroundColorChannel": "Màu nền",
	"palette.textColorChannel": "Màu chữ",
	"palette.bgIntensity": "Cường độ",
	"palette.bgStyle": "Kiểu",
	"palette.bgSolid": "Màu đơn",
	"palette.bgGradient": "Chuyển sắc",
	"palette.bgTransparent": "Trong suốt",
	"palette.gradientTo": "Màu thứ hai",
	"palette.gradientDirection": "Hướng",
	"palette.gradientText": "Văn bản tiêu đề chuyển sắc",
	"palette.save": "Lưu",

	// Color name suggestions (used to prefill palette names)
	"colorName.red": "Đỏ",
	"colorName.orange": "Cam",
	"colorName.amber": "Hổ phách",
	"colorName.yellow": "Vàng",
	"colorName.lime": "Xanh chanh",
	"colorName.green": "Xanh lá",
	"colorName.teal": "Xanh mòng két",
	"colorName.cyan": "Xanh lơ",
	"colorName.sky": "Xanh da trời",
	"colorName.blue": "Xanh dương",
	"colorName.indigo": "Chàm",
	"colorName.violet": "Tím oải hương",
	"colorName.purple": "Tím",
	"colorName.pink": "Hồng",
	"colorName.rose": "Hồng đậm",
	"colorName.brown": "Nâu",
	"colorName.gray": "Xám",
	"colorName.black": "Đen",
	"colorName.white": "Trắng",
	"colorName.crimson": "Đỏ thẫm",
	"colorName.coral": "San hô",
	"colorName.grape": "Nho",
	"colorName.plum": "Mận",
	"colorName.bubblegum": "Kẹo cao su",

	"iconPicker.pickIcon": "Chọn biểu tượng",
	"iconPicker.confirm": "Xác nhận",
	"iconPicker.cancel": "Hủy",
	"iconPicker.lucide": "Lucide",
	"iconPicker.tabler": "Tabler Icons",
	"iconPicker.material": "Material",
	"iconPicker.emoji": "Emoji",
	"iconPicker.searchLucide": "tìm biểu tượng Lucide",
	"iconPicker.searchTabler": "tìm biểu tượng Tabler",
	"iconPicker.tablerStyle": "Kiểu biểu tượng",
	"iconPicker.tablerStyleOutline": "Đường nét",
	"iconPicker.tablerStyleFilled": "Đặc",
	"iconPicker.loadMore": "Tải thêm",
	"iconPicker.materialStyle": "Kiểu biểu tượng",
	"iconPicker.materialStyleOutlined": "Đường nét (Outlined)",
	"iconPicker.materialStyleFilled": "Đặc (Filled)",
	"iconPicker.materialStyleRounded": "Bo tròn (Rounded)",
	"iconPicker.materialStyleSharp": "Sắc nét (Sharp)",
	"iconPicker.materialWeight": "Độ đậm biểu tượng",
	"iconPicker.materialWeight100": "Mảnh (Thin)",
	"iconPicker.materialWeight200": "Cực mảnh (Extra Light)",
	"iconPicker.materialWeight300": "Nhẹ (Light)",
	"iconPicker.materialWeight400": "Thường (Regular)",
	"iconPicker.materialWeight500": "Vừa (Medium)",
	"iconPicker.materialWeight600": "Hơi đậm (Semi Bold)",
	"iconPicker.materialWeight700": "Đậm (Bold)",
	"iconPicker.materialFontFailed":
		"Không thể tải bản xem trước biểu tượng Material. Thay vào đó, tên biểu tượng sẽ được hiển thị — việc tìm kiếm và chọn vẫn hoạt động.",
	"iconPicker.materialFontRetry": "Thử lại",
	"iconPicker.searchMaterial": "tìm biểu tượng Material",
	"iconPicker.searchEmoji": "Tìm kiếm emoji",
	"iconPicker.skinTone": "Tông màu da",
	"iconPicker.allCategories": "Tất cả danh mục",
	"iconPicker.noIconSelected": "Chưa chọn biểu tượng",
	"iconPicker.noResults":
		"Không có biểu tượng nào khớp với tìm kiếm của bạn.",
	"iconPicker.octicons": "Octicons",
	"iconPicker.searchOcticons": "Tìm kiếm Octicons",
	"iconPicker.fa": "Font Awesome",
	"iconPicker.searchFa": "Tìm kiếm Font Awesome",
	"iconPicker.faStyle": "Kiểu biểu tượng",
	"iconPicker.faStyleSolid": "Đặc",
	"iconPicker.faStyleRegular": "Thường",
	"iconPicker.faStyleBrands": "Thương hiệu",
	"iconPicker.rpgAwesome": "RPG Awesome",
	"iconPicker.searchRpgAwesome": "Tìm kiếm RPG Awesome",
	"iconPicker.image": "Hình ảnh của bạn",
	"iconPicker.searchImage": "Tìm kiếm hình ảnh của bạn",
	"iconPicker.imageTooLarge": "{{name}} quá lớn. Hình ảnh phải nhỏ hơn 5 MB.",
	"iconPicker.imageUnsupported":
		"{{name}} không phải định dạng hình ảnh được hỗ trợ. Sử dụng SVG, PNG, JPEG hoặc WebP.",
	"iconPicker.imageInvalidSvg":
		"{{name}} không thể đọc được như một SVG an toàn và đã không được thêm vào.",
	"iconPicker.imageDecodeFailed":
		"{{name}} không thể đọc được như một hình ảnh.",
	"iconPicker.imageDuplicate":
		"{{name}} đã có trong hình ảnh của bạn. Đổi tên tệp hoặc xóa hình ảnh hiện có.",
	"iconPicker.imageAdd": "Thêm hình ảnh",
	"iconPicker.imageEmpty":
		"Chưa có hình ảnh nào. Thêm tệp SVG, PNG, JPEG hoặc WebP từ máy tính của bạn hoặc kéo thả vào đây.",
	"iconPicker.imageDelete": "Xóa",
	"iconPicker.imageDeleteConfirm": "Xóa “{{name}}”?",
	"iconPicker.imageDeleteInUse":
		"{{count}} callout đang sử dụng hình ảnh này. Chúng sẽ hiển thị biểu tượng giữ chỗ cho đến khi bạn cung cấp hình ảnh mới.",
	"iconPicker.imageRecolor": "Theo màu Callout",
	"iconPicker.allSources": "Tất cả nguồn",
	"iconPicker.searchAllSources": "Tìm kiếm trong tất cả nguồn biểu tượng",
	"iconPicker.sourcesNotDownloaded":
		"Chưa có: {{names}}. Chọn nguồn ở trên để tải xuống.",
	"iconPicker.chooseSource": "Chọn nguồn",
	"iconPicker.sourceGroup": "{{name}} · {{count}}",

	// Source menu — what each library holds, in a few words
	"iconPicker.descAllSources": "tìm kiếm mọi thư viện cùng lúc",
	"iconPicker.descLucide": "bộ riêng của Obsidian, luôn ngoại tuyến",
	"iconPicker.descTabler":
		"biểu tượng UI sạch và nhất quán, đường nét và đặc",
	"iconPicker.descMaterial": "bộ của Google, bốn kiểu và bảy độ đậm",
	"iconPicker.descEmoji": "ký tự màu, mọi tông da",
	"iconPicker.descOcticons": "biểu tượng giao diện GitHub",
	"iconPicker.descFa": "đặc, thường và thương hiệu",
	"iconPicker.descRpgAwesome": "biểu tượng fantasy và trò chơi bàn",
	"iconPicker.descImage": "hình ảnh bạn thêm từ máy tính",

	// Icon picker — category filter dropdown labels
	"iconPicker.cat.Accessibility": "Trợ năng",
	"iconPicker.cat.Actions": "Hành động",
	"iconPicker.cat.Activities": "Hoạt động",
	"iconPicker.cat.Alert": "Cảnh báo",
	"iconPicker.cat.Alphabet": "Bảng chữ cái",
	"iconPicker.cat.Android": "Android",
	"iconPicker.cat.Animals": "Động vật",
	"iconPicker.cat.Arrows": "Mũi tên",
	"iconPicker.cat.Astronomy": "Thiên văn học",
	"iconPicker.cat.Audio&Video": "Âm thanh & Video",
	"iconPicker.cat.Automotive": "Ô tô",
	"iconPicker.cat.Badges": "Huy hiệu",
	"iconPicker.cat.Brand": "Thương hiệu",
	"iconPicker.cat.Buildings": "Tòa nhà",
	"iconPicker.cat.Business": "Kinh doanh",
	"iconPicker.cat.Camping": "Cắm trại",
	"iconPicker.cat.Charity": "Từ thiện",
	"iconPicker.cat.Charts": "Biểu đồ",
	"iconPicker.cat.Charts + Diagrams": "Biểu đồ & Sơ đồ",
	"iconPicker.cat.Childhood": "Tuổi thơ",
	"iconPicker.cat.Clothing + Fashion": "Trang phục & Thời trang",
	"iconPicker.cat.Coding": "Lập trình",
	"iconPicker.cat.Communicate": "Giao tiếp",
	"iconPicker.cat.Communication": "Truyền thông",
	"iconPicker.cat.Computers": "Máy tính",
	"iconPicker.cat.Connectivity": "Kết nối",
	"iconPicker.cat.Construction": "Xây dựng",
	"iconPicker.cat.Currencies": "Tiền tệ",
	"iconPicker.cat.Database": "Cơ sở dữ liệu",
	"iconPicker.cat.Design": "Thiết kế",
	"iconPicker.cat.Development": "Phát triển",
	"iconPicker.cat.Devices": "Thiết bị",
	"iconPicker.cat.Devices + Hardware": "Thiết bị & Phần cứng",
	"iconPicker.cat.Disaster + Crisis": "Thảm họa & Khủng hoảng",
	"iconPicker.cat.Document": "Tài liệu",
	"iconPicker.cat.E-commerce": "Thương mại điện tử",
	"iconPicker.cat.Editing": "Chỉnh sửa",
	"iconPicker.cat.Education": "Giáo dục",
	"iconPicker.cat.Electrical": "Điện",
	"iconPicker.cat.Emoji": "Emoji",
	"iconPicker.cat.Energy": "Năng lượng",
	"iconPicker.cat.Extensions": "Tiện ích mở rộng",
	"iconPicker.cat.Files": "Tệp",
	"iconPicker.cat.Film + Video": "Phim & Video",
	"iconPicker.cat.Food": "Thức ăn",
	"iconPicker.cat.Food + Beverage": "Thức ăn & Đồ uống",
	"iconPicker.cat.Fruits + Vegetables": "Trái cây & Rau củ",
	"iconPicker.cat.Games": "Trò chơi",
	"iconPicker.cat.Gaming": "Chơi game",
	"iconPicker.cat.Gender": "Giới tính",
	"iconPicker.cat.Genders": "Giới tính",
	"iconPicker.cat.Gestures": "Cử chỉ",
	"iconPicker.cat.Halloween": "Halloween",
	"iconPicker.cat.Hands": "Bàn tay",
	"iconPicker.cat.Hardware": "Phần cứng",
	"iconPicker.cat.Health": "Sức khỏe",
	"iconPicker.cat.Holidays": "Ngày lễ",
	"iconPicker.cat.Home": "Nhà",
	"iconPicker.cat.Household": "Gia đình",
	"iconPicker.cat.Humanitarian": "Nhân đạo",
	"iconPicker.cat.Images": "Hình ảnh",
	"iconPicker.cat.Laundry": "Giặt ủi",
	"iconPicker.cat.Letters": "Chữ cái",
	"iconPicker.cat.Logic": "Logic",
	"iconPicker.cat.Logistics": "Hậu cần",
	"iconPicker.cat.Map": "Bản đồ",
	"iconPicker.cat.Maps": "Bản đồ",
	"iconPicker.cat.Maritime": "Hàng hải",
	"iconPicker.cat.Marketing": "Tiếp thị",
	"iconPicker.cat.Math": "Toán học",
	"iconPicker.cat.Mathematics": "Toán học",
	"iconPicker.cat.Media": "Phương tiện truyền thông",
	"iconPicker.cat.Media Playback": "Phát media",
	"iconPicker.cat.Medical + Health": "Y tế & Sức khỏe",
	"iconPicker.cat.Money": "Tiền",
	"iconPicker.cat.Mood": "Tâm trạng",
	"iconPicker.cat.Moving": "Chuyển nhà",
	"iconPicker.cat.Music + Audio": "Âm nhạc & Âm thanh",
	"iconPicker.cat.Nature": "Thiên nhiên",
	"iconPicker.cat.Numbers": "Số",
	"iconPicker.cat.Photography": "Nhiếp ảnh",
	"iconPicker.cat.Photos + Images": "Ảnh & Hình ảnh",
	"iconPicker.cat.Political": "Chính trị",
	"iconPicker.cat.Privacy": "Quyền riêng tư",
	"iconPicker.cat.Punctuation + Symbols": "Dấu câu & Ký hiệu",
	"iconPicker.cat.Religion": "Tôn giáo",
	"iconPicker.cat.Science": "Khoa học",
	"iconPicker.cat.Science Fiction": "Khoa học viễn tưởng",
	"iconPicker.cat.Security": "Bảo mật",
	"iconPicker.cat.Shapes": "Hình dạng",
	"iconPicker.cat.Shopping": "Mua sắm",
	"iconPicker.cat.Social": "Mạng xã hội",
	"iconPicker.cat.Spinners": "Biểu tượng xoay",
	"iconPicker.cat.Sport": "Thể thao",
	"iconPicker.cat.Sports + Fitness": "Thể thao & Thể hình",
	"iconPicker.cat.Symbols": "Ký hiệu",
	"iconPicker.cat.System": "Hệ thống",
	"iconPicker.cat.Text": "Văn bản",
	"iconPicker.cat.Text Formatting": "Định dạng văn bản",
	"iconPicker.cat.Time": "Thời gian",
	"iconPicker.cat.Toggle": "Chuyển đổi",
	"iconPicker.cat.Transit": "Giao thông công cộng",
	"iconPicker.cat.Transportation": "Giao thông vận tải",
	"iconPicker.cat.Travel": "Du lịch",
	"iconPicker.cat.Travel + Hotel": "Du lịch & Khách sạn",
	"iconPicker.cat.UI actions": "Thao tác giao diện",
	"iconPicker.cat.Users + People": "Người dùng & Con người",
	"iconPicker.cat.Vehicles": "Phương tiện",
	"iconPicker.cat.Version control": "Quản lý phiên bản",
	"iconPicker.cat.Weather": "Thời tiết",
	"iconPicker.cat.Writing": "Viết",
	"iconPicker.cat.Zodiac": "Cung hoàng đạo",

	// Downloadable icon packs
	"iconPack.downloadTitle": "{{name}} chưa được tải xuống",
	"iconPack.downloadDetail":
		"{{count}} biểu tượng · {{size}} · tải xuống một lần",
	"iconPack.download": "Tải xuống",
	"iconPack.downloading": "Đang tải xuống {{name}}…",
	"iconPack.downloadFailed":
		"Không thể tải xuống {{name}}. Kiểm tra kết nối và thử lại.",
	"iconPack.retry": "Thử lại",
	"iconPack.faBrandsNotice":
		"Biểu tượng thương hiệu là nhãn hiệu của chủ sở hữu tương ứng. Việc đưa vào không có nghĩa là xác nhận. Chỉ sử dụng để đại diện cho công ty, sản phẩm hoặc dịch vụ mà chúng đề cập.",
	"iconPack.artworkRestored":
		"Đã tải xuống hình ảnh biểu tượng cho {{names}}.",
	"iconPack.diskWriteFailed":
		"Callout Studio không thể lưu gói biểu tượng vào đĩa, vì vậy cần tải xuống lại lần sau. Các biểu tượng bạn chọn vẫn được lưu cùng cài đặt.",

	// Icon licences & credits
	"credits.title": "Giấy phép biểu tượng và nhận định",
	"credits.intro":
		"Callout Studio sử dụng một số thư viện biểu tượng mở. Giấy phép của chúng được tái bản dưới đây, cùng với những gì đã được thay đổi để sử dụng ở đây.",
	"credits.fullNotices": "Thông báo đầy đủ của bên thứ ba",
	"credits.pluginLicense":
		"Mã nguồn của Callout Studio thuộc giấy phép permissive; các thư viện biểu tượng giữ nguyên giấy phép riêng.",

	"contextMenu.editCallout": "Chỉnh sửa cài đặt callout",
	"contextMenu.copyMarkdown": "Sao chép Markdown callout",
	"contextMenu.openSettings": "Mở cài đặt Callout Studio",
	"contextMenu.setFoldClosed": "Đặt callout thành đóng (-)",
	"contextMenu.setFoldOpen": "Đặt callout thành mở (+)",
	"contextMenu.setFoldNone": "Làm cho callout không thể gập",
	"contextMenu.cutSection": "Cắt phần tiêu đề",
	"contextMenu.copySection": "Sao chép phần tiêu đề",
	"contextMenu.deleteSection": "Xóa phần tiêu đề",

	"heading.toggleFold": "Chuyển đổi gập",

	"settings.globalSettings": "Tùy chọn kiểu toàn cục của Callout Studio",
	"settings.globalSettingsScope":
		"Đây là các thiết lập toàn cục: mỗi thiết lập thay đổi cùng lúc hình dạng, khoảng cách và kích thước của mọi callout mà Callout Studio tạo kiểu. Các callout mà giao diện của bạn tạo kiểu vẫn giữ thiết kế riêng của giao diện.",
	"settings.globalSettingsRegularDesc":
		"Điều chỉnh viền, độ bo góc, tỷ lệ phông và căn chỉnh của mọi block callout trong vault của bạn.",
	"settings.globalSettingsHeadingDesc":
		"Điều chỉnh viền, hình dạng và khoảng cách dọc của mọi callout tiêu đề trong vault của bạn.",
	"settings.globalSettingsInlineDesc":
		"Điều chỉnh viền và hình dạng của mọi callout nội tuyến trong vault của bạn.",
	"settings.globalSettingsCustomize": "Tùy chỉnh",

	"settings.calloutTypeRegular": "Block callout",
	"settings.calloutTypeHeading": "Callout tiêu đề",
	"settings.calloutTypeInline": "Callout nội tuyến",

	"settings.customizeMenu": "Tùy chỉnh mục menu",
	"settings.customizeMenuDesc":
		"Chọn những hành động chuột phải nào xuất hiện cho từng loại callout và sắp xếp lại thứ tự. Hoạt động trong chế độ nguồn và Xem trước trực tiếp.",
	"settings.customizeMenuButton": "Tùy chỉnh mục menu",
	"menuCustomize.title": "Tùy chỉnh menu chuột phải",
	"menuCustomize.desc":
		"Bật hoặc tắt các hành động và kéo tay cầm để sắp xếp lại. Thay đổi được lưu tự động.",
	"menuCustomize.regular": "Block callout",
	"menuCustomize.heading": "Callout tiêu đề",
	"menuCustomize.inline": "Callout nội tuyến",
	"menuCustomize.dragHandle": "Kéo để sắp xếp lại",
	"menuItem.edit": "Chỉnh sửa callout",
	"menuItem.openSettings": "Mở cài đặt",
	"menuItem.copyMarkdown": "Sao chép Markdown",
	"menuItem.foldDefaults": "Mặc định gập (mở / đóng / không)",
	"menuItem.cutSection": "Cắt phần",
	"menuItem.copySection": "Sao chép phần",
	"menuItem.deleteSection": "Xóa phần",

	"confirm.ok": "Xóa",
	"confirm.cancel": "Hủy",
	// Headings for each confirmation — every window carries one, so each
	// caller of ConfirmModal names what it is about to do.
	"confirm.titleDeleteCommand": "Xóa lệnh",
	"confirm.titleResetAll": "Đặt lại tất cả callout",
	"confirm.titleResetCallout": "Đặt lại callout",
	"confirm.titleDeletePalette": "Xóa bảng màu",
	"confirm.titleDeleteImage": "Xóa hình ảnh",

	"vault.filesUpdated":
		"Đã cập nhật {{count}} tham chiếu callout trong các tệp vault.",
	"vault.idsUpdated":
		"Đã cập nhật {{count}} ID callout trong các tệp vault: {{oldIds}} → {{newId}}",
	"vault.titlesUpdated":
		"Đã cập nhật {{count}} tiêu đề callout trong các tệp vault: {{oldTitle}} → {{newTitle}}",
	"vault.replaceWith": "Thay thế bằng:",
	"vault.deleteWithout": "Xóa không thay thế",
	"vault.confirmDelete": "Xác nhận",
	"vault.confirmReplace": "Thay thế",
	"vault.replacePromptInUse":
		'"{{name}}" được sử dụng {{count}} lần trong {{files}} tệp. Chọn callout để thay thế:',
	"vault.replacePromptUnused": 'Chọn callout để thay thế "{{name}}":',
	"vault.noReplacementAvailable":
		"Không có callout nào khác để thay thế callout này.",
	"vault.convertedToPlainText":
		"Đã chuyển {{blocks}} khối callout trong {{files}} tệp thành văn bản thường.",
	"vault.resetAliasWarning":
		"{{count}} tham chiếu trong {{files}} tệp đang sử dụng bí danh tùy chỉnh: {{aliases}}. Chúng sẽ ngừng hoạt động sau khi đặt lại. Tiếp tục?",
	"vault.resetConfirm": "Đặt lại",
	"vault.resetAllInUse":
		"⚠ {{count}} tham chiếu callout trong {{files}} tệp đang sử dụng các loại callout tùy chỉnh sẽ bị xóa.",

	"quickInsert.title": "Chèn nhanh callout khối",
	"quickInsert.desc": "Chọn một callout để chèn vào vị trí con trỏ. Chỉ callout dạng khối.",
	"quickInsert.searchPlaceholder": "Tìm kiếm callout",
	"quickInsert.sourceAria": "Lọc theo nguồn callout",
	"quickInsert.sourceAll": "Tất cả",
	"quickInsert.sourceBuiltIn": "Tích hợp",
	"quickInsert.sourceUser": "Callout của tôi",
	"quickInsert.editAria": "Chỉnh sửa {{name}}",
	"quickInsert.insertAria": "Chèn {{name}} dưới dạng callout khối",
	"quickInsert.noResults": "Không tìm thấy callout nào",
	"quickInsert.noUserCallouts": "Bạn chưa tạo callout nào.",
	"quickInsert.noEditorHint": "Không có ghi chú nào đang mở ở chế độ chỉnh sửa, nên không thể chèn gì cả.",
	"quickInsert.noEditor": "Mở một ghi chú ở chế độ chỉnh sửa để chèn callout.",

	"vaultStats.title": "Thống kê callout",
	"vaultStats.totalCallouts": "Tổng callouts",
	"vaultStats.typesFound": "Loại tìm thấy",
	"vaultStats.filesWithCallouts": "Tệp có callouts",
	"vaultStats.filesScanned": "Tệp Markdown đã quét",
	"vaultStats.empty": "Không tìm thấy callouts trong ghi chú Markdown.",
	"vaultStats.columnType": "Loại",
	"vaultStats.columnName": "Tên",
	"vaultStats.columnSource": "Nguồn",
	"vaultStats.columnCount": "Số lượng",
	"vaultStats.columnFiles": "Tệp",
	"vaultStats.unknown": "Không rõ",
	"vaultStats.sourceBuiltIn": "Tích hợp",
	"vaultStats.sourceCustom": "Tùy chỉnh",
	"vaultStats.sourceAutoFallback": "Dự phòng tự động",
	"vaultStats.sourceTheme": "Đoạn CSS",
	"vaultStats.sourceAlias": "Bí danh của {{id}}",
	"vaultStats.sourceUnknown": "Không rõ",
	"vaultStats.byRole": "Được viết dưới dạng",
	"vaultStats.roleBlock": "Khối",
	"vaultStats.roleHeading": "Tiêu đề",
	"vaultStats.roleInline": "Nội dòng",
	"vaultStats.defineUndefined": "Xác định {{count}} còn thiếu",
	"vaultStats.defineRunning": "Đang quét",
	"vaultStats.defineDone": "Đã thêm {{count}} loại callout.",
	"vaultStats.close": "Đóng",

	"import.title": "Vấn đề nhập",
	"import.reportLeadIn":
		"Có vẻ như tệp bạn nhập đã bị sửa đổi. Đây là danh sách vấn đề:",
	"import.reportLeadInFatal":
		"Tệp này trông không giống xuất khẩu Callout Studio. Không thể nhập:",
	"import.entryHeading": "Mục {{index}} — {{label}}",
	"import.summary":
		"{{valid}} trong {{total}} mục hợp lệ · tìm thấy {{issues}} vấn đề.",
	"import.btnCancel": "Hủy",
	"import.btnImportValid": "Chỉ nhập hợp lệ ({{count}})",
	"import.err.notRecognized":
		"Tệp không được nhận dạng: cần một mảng định nghĩa callout hoặc một tệp xuất Callout Studio.",
	"import.warn.settingsIgnored":
		"Khối cài đặt không phải là một đối tượng hợp lệ và đã bị bỏ qua.",
	"import.warn.invalidGradient":
		"Chuyển sắc nền không hợp lệ và đã bị bỏ qua.",
	"import.err.parseFailed":
		"Tệp không phải JSON hợp lệ và không thể phân tích.",
	"import.err.entryNotObject": "Mục phải là một đối tượng.",
	"import.err.requiredMissing":
		'Trường bắt buộc "{{field}}" thiếu hoặc có kiểu sai.',
	"import.err.idEmpty": "ID không được để trống.",
	"import.err.idTooLong":
		'ID "{{value}}" có {{length}} ký tự; tối đa là {{max}}.',
	"import.err.idBadChar":
		'ID "{{value}}" chứa ký tự không hợp lệ ("|", "[", "]", tab và ngắt dòng không được phép).',
	"import.err.idMetadata":
		'ID "{{value}}" chứa "|". Trong Obsidian, mọi thứ sau "|" đầu tiên là siêu dữ liệu callout, không phải một phần của loại, vì vậy mục này mô tả callout "{{id}}". Đã bỏ qua để "{{id}}" hiện có của bạn không bị thay đổi.',
	"import.err.idReserved":
		'ID "{{value}}" được Callout Studio dành riêng cho các bản xem trước của chính nó và không thể nhập.',
	"import.err.displayNameEmpty": "Tên hiển thị không được để trống.",
	"import.err.displayNameTooLong":
		"Tên hiển thị có {{length}} ký tự; tối đa là {{max}}.",
	"import.err.boolField":
		'"{{field}}" phải là giá trị boolean (true hoặc false).',
	"import.err.iconNotObject": "Biểu tượng phải là một đối tượng.",
	"import.err.iconTypeInvalid":
		'Loại biểu tượng "{{value}}" không phải một trong: {{types}}.',
	"import.warn.iconFieldIgnored":
		'"{{field}}" chỉ áp dụng cho biểu tượng Material và bị bỏ qua cho loại biểu tượng {{type}}.',
	"import.err.iconValueEmpty": "Giá trị biểu tượng phải là chuỗi không rỗng.",
	"import.err.iconValueTooLong":
		"Giá trị biểu tượng dài bất thường ({{length}} ký tự).",
	"import.err.materialStyle":
		'Kiểu biểu tượng Material "{{value}}" không phải một trong: outlined, filled, rounded, sharp.',
	"import.err.materialWeight":
		'Độ dày biểu tượng Material "{{value}}" phải là số nguyên từ 100 đến 700, bước 100.',
	"import.warn.iconRecolorIgnored":
		'"recolor" chỉ áp dụng cho hình ảnh của riêng bạn và bị bỏ qua cho loại biểu tượng {{type}}.',
	"import.err.iconRecolorInvalid":
		'"recolor" phải là true hoặc false (nhận: "{{value}}").',
	"import.err.colorInvalid":
		'"{{field}}" phải là màu hex như "#448aff" (nhận được "{{value}}").',
	"import.err.numberRange":
		'"{{field}}" phải là số từ {{min}} đến {{max}} (nhận được "{{value}}").',
	"import.err.iconSizeRange":
		'"{{field}}" phải là số từ {{min}} đến {{max}} (nhận được "{{value}}").',
	"import.err.iconAdjustShape":
		'"iconAdjust" must be an object mapping a callout type ("regular", "heading", "inline") to its icon size and offsets.',
	"import.err.aliasesNotArray": '"aliases" phải là mảng chuỗi.',
	"import.err.aliasNotString": "Bí danh phải là chuỗi.",
	"import.err.aliasDup": 'Bí danh "{{value}}" bị trùng trong mục này.',
	"import.err.tooManyIds":
		"Quá nhiều ID ({{count}}); mỗi callout có thể có tối đa {{max}} ID (chính + bí danh).",
	"import.err.metadataShape":
		'"metadata" phải là đối tượng có tất cả giá trị là chuỗi.',
	"import.warn.unknownFields":
		"Các trường không rõ đã bị bỏ qua: {{fields}}.",
	"import.err.duplicateInFile":
		'ID/bí danh "{{value}}" đã được sử dụng bởi mục #{{first}} trong tệp này.',
	"import.err.aliasConflict":
		'Bí danh "{{value}}" đã được sử dụng bởi callout khác ("{{other}}") trong vault của bạn.',
	"import.warn.defaultFoldedAutofix":
		'"defaultFolded" là true trong khi "foldable" là false; defaultFolded đã được đặt lại về false.',
	"import.warn.imageMissing":
		"Callout này sử dụng hình ảnh không có trong tệp và không có trong vault này, vì vậy sẽ hiển thị biểu tượng giữ chỗ cho đến khi bạn cung cấp hình ảnh mới.",

	"import.err.paletteIdInvalid":
		'"paletteId" phải là một ID văn bản không rỗng (nhận được "{{value}}").',
	"import.warn.iconNameUnknown":
		'Không có biểu tượng "{{value}}" trong {{type}}, vì vậy biểu tượng mặc định đã được sử dụng.',
	"import.warn.cmIconUnknownNew":
		'Biểu tượng "{{value}}" không có sẵn trong vault này, vì vậy biểu tượng mặc định đã được sử dụng.',
	"import.warn.cmIconUnknownExisting":
		'Biểu tượng "{{value}}" không có sẵn trong vault này, vì vậy "{{id}}" giữ nguyên biểu tượng đã có.',
	"import.chooseSource": "Nhập từ",
	"import.sourceStudio": "Callout Studio",
	"import.sourceStudioDesc": "Tải tệp .json được xuất từ Callout Studio.",
	"import.sourceCalloutManager": "Callout Manager",
	"import.sourceCalloutManagerDesc":
		"Mang các callout đã tùy chỉnh của bạn từ plugin Callout Manager sang.",
	"import.sourceAdmonition": "Admonition",
	"import.sourceAdmonitionDesc":
		"Mang các admonition tùy chỉnh của bạn từ plugin Admonition sang.",
	"import.cmTitle": "Nhập từ Callout Manager",
	"import.cmInstructions":
		"Mỗi callout đã tùy chỉnh được mang sang cùng biểu tượng và màu sắc. Kiểu dáng theo từng giao diện và CSS tùy chỉnh không có tương đương ở đây nên sẽ không được mang sang.",
	"import.cmFromVault": "Vault này",
	"import.cmVaultChecking": "Đang tìm plugin Callout Manager…",
	"import.cmVaultFound": "Đã tìm thấy {{count}} callout đã tùy chỉnh.",
	"import.cmVaultNotFound":
		"Không tìm thấy callout đã tùy chỉnh nào trong vault này.",
	"import.cmPasteLabel":
		"Hoặc dán các kiểu đã sao chép từ Callout Manager vào đây:",
	"import.cmPlaceholder":
		"Dán các kiểu đã sao chép, hoặc một tệp data.json, vào đây…",
	"import.cmBtnCancel": "Hủy",
	"import.cmBtnImport": "Nhập",
	"import.err.cmNoBlocksFound":
		"Không tìm thấy kiểu Callout Manager nào trong văn bản đã dán.",
	"import.err.cmNotRecognized":
		"Tệp không nhận dạng được: cần các kiểu do nút Copy của Callout Manager tạo ra, hoặc một tệp data.json của Callout Manager.",
	"import.err.cmNoEntries":
		"Không tìm thấy callout đã tùy chỉnh nào để nhập.",
	"import.err.cmNoColorForNew":
		'Không tìm thấy màu sắc có thể sử dụng cho callout mới "{{value}}"; đã bỏ qua.',
	"import.err.cmIdConflict":
		'ID "{{value}}" đã được sử dụng làm bí danh bởi một callout khác ("{{other}}") và đã bị bỏ qua.',
	"import.warn.cmNoColorDefault":
		"Không có màu nào được đặt trong Callout Manager, nên màu xám mặc định đã được sử dụng.",
	"import.warn.cmThemeCondition":
		"Màu hoặc biểu tượng của callout này chỉ được đặt cho một giao diện. Callout Studio không có kiểu dáng theo từng giao diện, nên nó đã được mang sang cho mọi giao diện.",
	"import.warn.cmCustomStyles":
		"Callout này cũng có CSS tùy chỉnh trong Callout Manager. Kiểu dáng đó không thuộc phạm vi nhập, nên chỉ biểu tượng và màu sắc được mang sang.",

	// Import — Admonition
	"import.admTitle": "Nhập từ Admonition",
	"import.admInstructions":
		"Mỗi admonition sẽ sang đây thành một callout với tên, biểu tượng " +
		"và màu của nó. Những tùy chọn không có tương đương trong Callout " +
		"Studio (lệnh, nút sao chép, ẩn tiêu đề) sẽ không được nhập.",
	"import.admFromVault": "Kho này",
	"import.admVaultChecking": "Đang tìm plugin Admonition…",
	"import.admVaultFound": "Đã tìm thấy {{count}} admonition tùy chỉnh.",
	"import.admVaultNotFound":
		"Không tìm thấy admonition tùy chỉnh nào trong kho này.",
	"import.admFromFile": "Một tệp",
	"import.admFromFileDesc":
		"Một tệp admonitions.json, hoặc một gói được chia sẻ.",
	"import.admChooseFile": "Chọn tệp…",
	"import.admPasteLabel": "Hoặc dán JSON vào đây:",
	"import.admPlaceholder": "Dán admonition của bạn vào đây…",
	"import.admBtnCancel": "Hủy",
	"import.admBtnImport": "Nhập",
	"import.err.admNotRecognized":
		"Tệp không nhận dạng được: cần một danh sách admonition hoặc tệp " +
		"data.json của Admonition.",
	"import.err.admNoEntries": "Không tìm thấy admonition nào để nhập.",
	"import.err.admTypeMissing":
		'Admonition này không có "type" nên đã bị bỏ qua.',
	"import.warn.admIconUnknown":
		'Không tìm thấy biểu tượng nào tên "{{value}}" trong bất kỳ thư ' +
		"viện nào, nên biểu tượng mặc định đã được dùng.",
	"import.warn.admIconUnknownExisting":
		'Không tìm thấy biểu tượng nào tên "{{value}}" trong bất kỳ thư ' +
		'viện nào, nên "{{id}}" vẫn giữ biểu tượng sẵn có.',
	"import.warn.admImageFailed":
		"Không đọc được ảnh đã tải lên, nên biểu tượng mặc định đã được " +
		"dùng.",
	"import.warn.admIconWithCss":
		"Admonition này được tạo kiểu bằng một đoạn CSS trong Admonition. " +
		"Kiểu đó không thuộc phần nhập, nên chỉ tên, biểu tượng và màu " +
		"được mang sang.",
	"import.warn.admNoColor":
		"Chưa đặt màu nào, nên màu xanh mặc định đã được dùng.",
	"import.warn.admTitleTruncated":
		"Tiêu đề dài {{length}} ký tự; đã được rút ngắn còn {{max}}.",

	"footer.tagline": "Có phản hồi, nhận xét hoặc đề xuất? Tôi rất muốn nghe!",
	"footer.madeBy": "Được tạo bởi Niv  •  ",
	"settings.deletePaletteConfirmLinkedOne":
		'Xóa bảng màu "{{name}}"?\nCó 1 callout đang dùng nó. Callout đó giữ nguyên màu, và bạn có thể liên kết lại sau từ hàng Màu trong trình chỉnh sửa của nó.',
	"settings.deletePaletteConfirmLinked":
		'Xóa bảng màu "{{name}}"?\nCó {{count}} callout đang dùng nó. Chúng giữ nguyên màu, và bạn có thể liên kết lại sau từ hàng Màu trong bất kỳ trình chỉnh sửa nào của chúng.',
	"settings.unlinkedColors": "Màu chưa liên kết",
	"settings.unlinkedColorsDesc":
		"Các callout có màu đã lưu bị xóa. Chúng vẫn giữ màu hiện có; khôi phục sẽ lưu lại màu và liên kết lại cả nhóm.",
	"settings.unlinkedColorOne": "1 callout",
	"settings.unlinkedColorCount": "{{count}} callout",
	"settings.restoreColor": "Khôi phục",
	"settings.palettesMergedNotice":
		"Đã gộp {{count}} bảng màu nhập vào các màu đã lưu vốn đã có cùng màu.",
	"notice.palettesMerged":
		"Đã gộp {{count}} màu đã lưu có màu giống hệt nhau: {{names}}. Các callout dùng chúng vẫn giữ màu và giờ được liên kết với màu còn lại.",
	"editor.colorsDescDeleted":
		"Màu đã lưu của callout này đã bị xóa. Bạn có thể lưu lại bằng cách {{link}}.",
	"editor.colorsDescDeletedOther":
		"Màu đã lưu của callout này đã bị xóa. Bạn có thể lưu lại bằng cách {{link}} — 1 callout khác đang dùng màu này cũng sẽ được liên kết lại.",
	"editor.colorsDescDeletedOthers":
		"Màu đã lưu của callout này đã bị xóa. Bạn có thể lưu lại bằng cách {{link}} — {{count}} callout khác đang dùng màu này cũng sẽ được liên kết lại.",
	"editor.colorsDescDeletedLink": "nhấp vào đây",
	"palette.colorExists":
		'Những màu này giống hệt "{{name}}". Hai màu đã lưu không thể giống nhau — hãy đổi một màu để phân biệt.',
	"palette.colorExistsUse":
		'Những màu này giống hệt "{{name}}". Hai màu đã lưu không thể giống nhau — hãy đổi một màu, hoặc {{link}}.',
	"palette.colorExistsUseLink": "dùng màu hiện có",
	"locale.downloading": "Đang tải bản dịch…",
	"locale.notDownloaded": "{{name}} chưa được tải xuống",
	"locale.notDownloadedDesc":
		"Callout Studio đang hiển thị tiếng Anh cho đến khi có thể tải bản dịch. Sẽ thử lại vào lần Obsidian khởi động tiếp theo.",
	"locale.retry": "Thử lại",
	"locale.diskWriteFailed":
		"Callout Studio không thể lưu bản dịch vào đĩa, nên lần sau sẽ phải tải xuống lại.",
	"notice.exportedCssCreated": "Đã lưu đoạn CSS vào {{path}}",
	"notice.exportedCssUpdated": "Đã cập nhật đoạn CSS tại {{path}}",
	"notice.exportedCssUnchanged": "Đoạn CSS đã được cập nhật.",
	"notice.exportCssEmpty": "Không có callout tùy chỉnh nào để xuất.",
	"notice.exportCssFailed":
		"Không thể lưu đoạn CSS. Hãy kiểm tra bảng điều khiển dành cho nhà phát triển để biết chi tiết.",
	"notice.exportCssEnabled":
		"Đoạn này đang được bật trong vault. Callout Studio đã tạo kiểu cho các callout này và đoạn này giữ nguyên kiểu tại thời điểm xuất.",
	"confirm.titleOverwriteSnippet": "Ghi đè đoạn CSS",
	"confirm.overwriteSnippet":
		"Đoạn CSS trong thư mục snippets đã thay đổi kể từ khi Callout Studio ghi nó. Xuất lại sẽ thay thế toàn bộ tệp.",
	"confirm.overwriteSnippetOk": "Ghi đè",
	"export.chooseFormat": "Xuất dưới dạng",
	"export.formatJson": "Bản sao lưu Callout Studio",
	"export.formatJsonDesc":
		"Tệp .json chứa callout và cài đặt của bạn để nhập vào vault khác.",
	"export.formatCss": "Đoạn CSS",
	"export.formatCssDesc":
		"Tệp .css được lưu trong thư mục snippets của vault này để dùng ở nơi chưa cài Callout Studio. Chỉ bao gồm callout thông thường và là ảnh chụp; hãy xuất lại sau khi thay đổi.",
	"quickInsert.readingViewHint": "Ghi chú này đang mở ở chế độ đọc, nên không thể chèn gì cả.",
	"quickInsert.readingView": "Chuyển sang chế độ nguồn hoặc Xem trước trực tiếp để chèn callout.",
	"quickInsert.noCursorHint": "Không có con trỏ nào trong ghi chú này, nên không có chỗ để chèn.",
	"quickInsert.noCursor": "Đặt con trỏ trong ghi chú ở vị trí bạn muốn chèn callout, sau đó thử lại.",
};
