# Kiến trúc

Tài liệu này mô tả app được ghép lại thế nào: tiến trình nào giữ việc gì, dữ liệu nằm ở đâu, IPC có những kênh nào và vì sao vài chỗ làm theo cách khác thường.

## Tổng quan

- **Electron 44**, không bundler, không framework. Renderer là HTML/CSS/JS thuần, chỉ ba trang: giấy nhớ, ghi nhanh, chọn font.
- **Main process** (`src/main/main.js`) giữ toàn bộ phần hệ thống: tạo/quản lý cửa sổ, khay hệ thống, phím tắt toàn cục, thông báo desktop, menu, đọc font trên máy, lưu dữ liệu.
- **Preload** (`src/main/preload.js`) là cầu duy nhất giữa hai bên: mở `window.sticky.*` qua `contextBridge`. Không bật `nodeIntegration`, vẫn giữ `contextIsolation`.
- Mỗi giấy nhớ là **một `BrowserWindow` riêng** (`note.html?id=<noteId>`); renderer biết mình đang phục vụ giấy nhớ nào nhờ query `id` (preload đọc `location.search` và tự gắn vào mọi lời gọi IPC).

## Bản đồ file

| File | Vai trò |
| --- | --- |
| `src/main/main.js` | Cửa sổ giấy nhớ, cửa sổ ghi nhanh, cửa sổ chọn font, khay hệ thống, phím tắt, thông báo, menu chuột phải, toàn bộ IPC |
| `src/main/preload.js` | `window.sticky.*` (note/window/capture/fonts/settings + hai hàm `onChanged`, `onCaptureFocus`) |
| `src/main/store.js` | Đọc/ghi JSON, giá trị mặc định, debounce 350ms |
| `src/main/list-fonts.ps1` | Liệt kê font đã cài + số ký tự dấu tiếng Việt bị thiếu, in ra `<family>|<miss>` |
| `src/renderer/note.*` | Giao diện giấy nhớ (HTML/CSS/JS) |
| `src/renderer/capture.*` | Cửa sổ ghi nhanh |
| `src/renderer/fonts.*` | Cửa sổ chọn font trên máy |
| `src/shared/dates.js` | Tách hạn/giờ/nhãn/ưu tiên từ câu thêm việc nhanh (thuần, không phụ thuộc Electron) |
| `tools/make-icon.js` | Sinh `assets/icon.png` bằng thuật toán trong Node, không cần thư viện ngoài |

## Các cửa sổ

| Cửa sổ | Đặc điểm |
| --- | --- |
| Giấy nhớ | `frame: false`, `transparent: true`, `skipTaskbar: true`, `alwaysOnTop` mức `screen-saver` + `visibleOnFullScreen`, tối thiểu 180×110, thu gọn còn 74px chiều cao |
| Ghi nhanh | Nhỏ, luôn nổi, ẩn/hiện bằng phím tắt; main gửi `capture:focus` để renderer focus ô nhập |
| Chọn font | 480×600 nhưng kẹp theo `workArea` của màn hình đang có con trỏ; chỉ một cửa sổ tại một thời điểm (mở cái mới thì đóng cái cũ) |

## Dữ liệu

File: `%APPDATA%\Sticky Note\sticky-note-data.json` — thư mục là `app.getPath('userData')`, Electron lấy theo `productName` (`"Sticky Note"`), **không phải** `name` (`sticky-note`).

```jsonc
{
  "version": 1,
  "settings": {
    "alwaysOnTop": true,
    "ghost": false,
    "launchAtLogin": false,
    "quickCaptureHotkey": "Control+Alt+N",
    "toggleAllHotkey": "Control+Alt+H",
    "ghostHotkey": "Control+Alt+G",
    "newNoteHotkey": "Control+Alt+T",
    "captureTargetNoteId": null
  },
  "notes": [
    {
      "id": "…", "createdAt": 0, "updatedAt": 0,
      "x": 0, "y": 0, "width": 320, "height": 380,
      "title": "Việc hôm nay", "color": "yellow", "body": "",
      "tasks": [], "justify": true, "fontScale": 1, "font": "hand",
      "tilt": 0, "compact": false, "ghost": false, "opacity": 1
    }
  ]
}
```

Ghi an toàn: nội dung mới ghi ra `sticky-note-data.json.tmp` rồi `rename`, nên tắt app giữa chừng cũng không làm hỏng file; `app.on('will-quit')` gọi `store.flush()` để đẩy nốt thay đổi đang chờ debounce.

## IPC

| Kênh | Kiểu | Việc |
| --- | --- | --- |
| `note:boot` | handle | Trả dữ liệu khởi động: `note`, `notes` (id/title/color để chuyển nhanh), `settings`, `loginAtStartup` |
| `note:save` | handle | Lưu patch vào một giấy nhớ |
| `note:create` / `note:delete` | handle | Tạo / xoá giấy nhớ |
| `note:list` | handle | Danh sách giấy nhớ (kèm số việc chưa xong) cho khay và menu |
| `note:show`, `note:context-menu` | send, handle | Hiện giấy nhớ; mở menu `⋯` |
| `settings:get` / `settings:set` | handle | Đọc / ghi `settings` |
| `win:close`, `win:opacity`, `win:drag-*`, `win:resize-*` | send | Đóng, đổi độ mờ, kéo di chuyển và kéo giãn cửa sổ |
| `win:topmost`, `win:ghost`, `win:compact` | handle | Bật/tắt luôn nổi, chế độ mờ, thu gọn |
| `capture:hide` / `capture:submit` | send / handle | Ẩn cửa sổ ghi nhanh; gửi nội dung vào giấy nhớ đích |
| `fonts:list` / `fonts:apply` / `fonts:close` | handle / send / send | Danh sách font đủ dấu; áp font cho giấy nhớ đang mở; đóng cửa sổ chọn font |
| `app:notify` | send | Hiện thông báo desktop khi việc tới hạn |
| `note:changed` (main → renderer) | event | Báo renderer cập nhật lại khi dữ liệu đổi từ nơi khác (khay, menu, cửa sổ chọn font) |

## Vài quyết định đáng chú ý

1. **Kéo/giãn do main làm, không dùng `-webkit-app-region: drag`.** Renderer bắt chuột ở 8 tay nắm rồi gửi delta (`win:drag-move`, `win:resize-move`), main tự đổi `bounds`. Cách này mới có tay nắm đủ 8 hướng và ngưỡng 4px (chuột phải đi 4px mới coi là kéo, tránh phá con trỏ khi bấm nhầm).
2. **Luôn nổi cần chống hạ cấp.** `setAlwaysOnTop(true, 'screen-saver')` + `setVisibleOnAllWorkspaces(..., { visibleOnFullScreen: true })`, cộng thêm `setInterval(keepOnTop, 2500)` để bật lại khi Windows tự hạ cửa sổ xuống dưới.
3. **Chế độ mờ (ghost)** = `setOpacity(0.22)` + `setIgnoreMouseEvents(true, { forward: true })`, nên lúc bật thì chuột xuyên qua giấy nhớ — thoát bằng `Ctrl+Alt+G`.
4. **Font hệ thống không lấy được từ renderer.** Electron 44 không có `navigator.queryLocalFonts` (kể cả khi bật `--enable-features=FontAccess`), nên main gọi PowerShell đọc danh sách font qua .NET/WPF và kiểm tra độ phủ dấu tiếng Việt bằng `CharacterToGlyphMap` (cmap thật của font). Kết quả chạy một lần rồi cache. Script được truyền bằng `-EncodedCommand` thay vì `-File` vì bản đóng gói nằm trong `app.asar` và PowerShell không đọc được file bên trong asar.
5. **`font` trong dữ liệu có hai dạng.** Hoặc mã preset (`hand` / `ui` / `serif` / `mono`), hoặc tên font hệ thống (ví dụ `Verdana`). `fontStack()` trong `note.js` phân biệt hai dạng và luôn thêm `"Segoe UI", system-ui, sans-serif` làm chỗ dựa cho ký tự mà font được chọn thiếu.
6. **Không thoát khi đóng hết cửa sổ.** `window-all-closed` để trống; app sống ở khay, thoát bằng mục **Thoát** trong menu khay.
7. **Khởi động cùng Windows phải truyền `path` + `args`.** Windows chạy nguyên chuỗi trong `HKCU\Software\Microsoft\Windows\CurrentVersion\Run`, nên bản dev cần `args: [app.getAppPath()]` (thiếu thì chỉ mở `electron.exe` trần, không mở Sticky Note), bản đóng gói để `args: []`. Tên mục trong registry là AppUserModelID (`com.local.stickynote`), và `getLoginItemSettings()` **không** truyền `path`/`args` sẽ trả `false` dù mục đã có — muốn đọc đúng trạng thái phải truyền đúng cặp `path` + `args`. Lúc khởi động, app tự so lại registry với `settings.launchAtLogin` và ghi lại nếu lệch (đổi thư mục app, cài lại…).

## Dễ nhầm

- Thư mục dữ liệu là `%APPDATA%\Sticky Note\` (theo `productName`), không phải `sticky-note`.
- Preset `hand` (Segoe Print) và `serif` (Georgia) thiếu ký tự dấu tiếng Việt trên nhiều máy, nên dấu bị rơi sang font khác. Cửa sổ chọn font chỉ liệt kê font đủ dấu để tránh chuyện đó.
- Cửa sổ chọn font không có IPC để mở từ renderer: chỉ mở được qua menu `⋯` → **Kiểu chữ** → **Chọn font trên máy…**.
- Nếu file JSON bị hỏng, app **không** ghi đè ngay: bản lỗi được đổi tên thành `sticky-note-data.json.bad` rồi mới tạo dữ liệu mặc định. Giữ lại file `.bad` đó, nó là bản cuối cùng còn lại của dữ liệu cũ.
- App chấp nhận file có BOM (bỏ BOM khi đọc), nhưng nếu tự sửa file bằng tay thì ghi **UTF-8 không BOM** — `Set-Content -Encoding UTF8` của PowerShell 5.1 thêm BOM và từng làm hỏng dữ liệu theo cách đó.
