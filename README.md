# Sticky Note

Giấy nhớ dán trên desktop cho Windows (Electron). Cửa sổ không viền, trong suốt, **luôn nổi trên mọi cửa sổ** kể cả video toàn màn hình, có danh sách việc kèm hạn, ghi chú tự do và kéo giãn viền bằng chuột.

## Cài đặt & chạy

```bash
npm install
npm start        # chạy app
npm run dev      # chạy kèm cờ --dev
```

Yêu cầu: Node.js 18+ và Windows (đã kiểm thử trên Windows 10/11).

## Tính năng

**Cửa sổ**
- Không viền, nền trong suốt, không hiện trên taskbar; luôn nổi với mức `screen-saver` và `visibleOnFullScreen` nên nằm trên cả video/web toàn màn hình.
- Kéo thanh tiêu đề để di chuyển, nháy đúp thanh tiêu đề để thu gọn.
- Kéo giãn bằng 8 tay nắm sát viền cửa sổ (N/S/E/W + 4 góc); di chuyển/kéo giãn bắt đầu sau khi chuột đi 4px nên không phá con trỏ khi bấm nhầm.
- Vị trí/kích thước được lưu lại, tự kẹp vào vùng làm việc của màn hình gần nhất.
- Nút trên thanh tiêu đề: `◍` chế độ mờ, `⌖` bật/tắt luôn nổi (áp dụng cho mọi giấy nhớ), `⋯` menu thêm, `×` ẩn giấy nhớ.

**Việc & hạn**
- Thêm việc nhanh, sửa nội dung trực tiếp, tick xong, xoá từng việc, xoá hết việc đã xong.
- Việc có hạn hiện chip `⏰` (đổi màu theo mức gần hạn/quá hạn); bấm chip để chọn hạn khác, `Shift+click` để bỏ hạn.
- Ưu tiên `!1`/`!2`/`!3` hiện chip và tô đậm mức ưu tiên; thẻ việc có lớp `p1..p3`.
- Thông báo desktop khi việc tới hạn.

**Ghi chú**
- Ô ghi chú tự do bên dưới danh sách việc.
- Dàn đều chữ, tăng/giảm cỡ chữ, đổi kiểu chữ (Viết tay / Nét mảnh / Có chân / Đánh máy), đổi màu giấy, đổi độ mờ (100/90/80/65%).
- Chọn font có sẵn trên máy: `⋯` → **Kiểu chữ** → **Chọn font trên máy…** mở cửa sổ liệt kê font đã cài kèm ô tìm kiếm; mỗi font hiện tên và một câu tiếng Việt xem trước (Đi ăn sáng rồi về làm bài tập, nhớ mua sữa nhé.) để thấy ngay dấu hiển thị thế nào. Danh sách **chỉ gồm font đủ dấu tiếng Việt**, font thiếu dấu bị loại bỏ. Font đang dùng được đánh dấu `✓`, bấm một font để áp dụng ngay cho giấy nhớ đang mở.
- Chế độ mờ (ghost): giấy nhớ mờ 22% và cho chuột xuyên qua, chỉ còn viền mờ để tham chiếu.

**Khác**
- Nhiều giấy nhớ cùng lúc; nhân đôi giấy nhớ; chuyển nhanh giữa các giấy nhớ từ menu `⋯`.
- Ghi nhanh bằng cửa sổ nhỏ luôn nổi (mặc định gửi vào giấy nhớ đang chỉ định).
- Khay hệ thống: danh sách giấy nhớ kèm số việc chưa xong, bật/tắt luôn nổi, chế độ mờ, khởi động cùng Windows, mở thư mục dữ liệu, thoát.
- Đóng hết cửa sổ không thoát app — app vẫn chạy ở khay.

## Phím tắt (toàn hệ thống)

| Phím | Việc |
| --- | --- |
| `Ctrl+Alt+N` | Mở cửa sổ ghi nhanh |
| `Ctrl+Alt+T` | Giấy nhớ mới |
| `Ctrl+Alt+H` | Ẩn / hiện tất cả giấy nhớ |
| `Ctrl+Alt+G` | Bật / tắt chế độ mờ |

Đổi được trong `settings` của file dữ liệu (`quickCaptureHotkey`, `newNoteHotkey`, `toggleAllHotkey`, `ghostHotkey`).

## Cú pháp thêm việc nhanh

Gõ vào ô `＋ Thêm việc`; phần nhận diện sẽ được tách khỏi tên việc và hiện trước ở dòng xem trước:

```
Mua sữa @mai 8h30 #nhà !2
```

| Cú pháp | Ý nghĩa |
| --- | --- |
| `#nhà`, `#work` | Nhãn (tag) |
| `!1` `!2` `!3` | Ưu tiên cao → thấp (`!cao`, `!gap`, `!tb`, `!vua`, `!thap`, `!low` cũng được) |
| `hn`, `hôm nay`, `nay` | Hạn hôm nay |
| `mai`, `ngày mai` | Hạn ngày mai |
| `mốt`, `kia` | Hạn +2 ngày |
| `+3d`, `in5d`, `+2w` | Hạn sau n ngày / n tuần |
| `t2`…`t7`, `cn`, `mon`…`sun` | Thứ trong tuần tới |
| `25/12`, `25-12-2026` | Ngày cụ thể |
| `8h30`, `8g`, `8:30`, `8pm` | Giờ (kết hợp với ngày; nếu chỉ có giờ và giờ đã qua thì hiểu là ngày mai) |
| `Enter` | Thêm việc |
| `Escape` | Đóng ô thêm nhanh |

## Dữ liệu

Lưu tại `%APPDATA%\Sticky Note\sticky-note-data.json` (thư mục lấy theo `productName` trong `package.json`, nên tên là **Sticky Note** chứ không phải `sticky-note`). Ghi tạm ra `.tmp` rồi đổi tên, có debounce 350ms khi đang gõ. Mở nhanh bằng mục **Mở thư mục dữ liệu** trong menu khay.

## Cấu trúc mã

```
src/main/main.js       cửa sổ giấy nhớ, khay, phím tắt, cửa sổ ghi nhanh, IPC
src/main/preload.js    cầu contextBridge (window.sticky.*)
src/main/store.js      đọc/ghi JSON, giá trị mặc định
src/renderer/note.*    giao diện giấy nhớ (HTML/CSS/JS)
src/renderer/capture.* cửa sổ ghi nhanh
src/renderer/fonts.*   cửa sổ chọn font có sẵn trên máy
src/main/list-fonts.ps1 liệt kê font đã cài + độ phủ dấu tiếng Việt (đọc cmap, chạy 1 lần rồi cache)
src/shared/dates.js    tách hạn/giờ/nhãn/ưu tiên từ câu thêm nhanh
tools/make-icon.js     sinh assets/icon.png (không cần thư viện ngoài)
```

## Đóng gói

```bash
npm run icon     # sinh lại assets/icon.png
npm run dist     # electron-builder → bộ cài NSIS cho Windows x64
```

## Điểm cần lưu ý

- Cửa sổ dùng `setAlwaysOnTop(true, 'screen-saver')` + `setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })` — đây là cách Electron giữ cửa sổ trên video toàn màn hình; một số trình phát dùng chế độ exclusive fullscreen vẫn có thể che cửa sổ, khi đó chuyển trình phát sang chế độ borderless/windowed.
- Chế độ mờ đặt `setIgnoreMouseEvents(true, { forward: true })`, nên khi đang bật ghost thì tạm thời không bấm được vào giấy nhớ; dùng `Ctrl+Alt+G` để tắt.

## Tài liệu thêm

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — kiến trúc: tiến trình, các cửa sổ, IPC, dữ liệu và những quyết định kỹ thuật (kể cả vì sao phần chọn font phải chạy qua PowerShell).

## Giấy phép

MIT — xem [`LICENSE`](LICENSE).
