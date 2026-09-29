# 🎬 TikTok Uploader Pro (MMO Edition) 🚀

> **Hệ Thống Desktop App Quản Trị & Tự Động Hoá Kênh TikTok Chuyên Dụng**  
> Thiết kế chuẩn cho anh em làm MMO kiếm tiền từ **Lượt xem video gắn nhạc bản quyền (Favorites Sound Promotion)**: Tự động hóa upload, bắt buộc gắn nhạc Favorites -50dB, lên lịch thông minh, bảo toàn file và chống shadowban.

---

## 🌟 Ưu Điểm Đột Phá So Với Tool Cũ

1. **Bảo Vệ Doanh Thu Nhạc Kiếm Tiền (Zero-Risk Sound)**:
   - Chỉ lấy nhạc từ tab **Yêu thích (Favorites)**, loại bỏ tìm kiếm từ khóa dễ sai bài.
   - Chỉnh âm lượng nhạc nền về **-50 dB** (giữ trọn tiếng gốc video nhưng TikTok vẫn ghi nhận Sound ID chính thức).
   - **Fail-safe nghiêm ngặt**: Nếu Favorites rỗng hoặc thử lại 3 lần vẫn lỗi gắn nhạc ➔ **Lập tức HỦY UPLOAD**, giữ nguyên file video trên máy, tuyệt đối không đăng video trần làm mất tiền view.

2. **Giao Diện Desktop App Chuẩn Shadcn UI**:
   - Ứng dụng Desktop chạy độc lập trên **macOS** và **Windows** (Electron + React 18 + Tailwind CSS + Shadcn UI).
   - Giao diện Dark Mode sang trọng, hiển thị live status badge, tiến độ upload realtime và link video TikTok sau khi đăng.

3. **Bảo Toàn File Video (Done Folder)**:
   - Video sau khi đăng thành công sẽ tự động được di chuyển vào thư mục con `done/` (thay vì xóa đứt file như tool cũ), giúp bạn dễ dàng lưu trữ và đối soát số liệu.

4. **Kiểm Soát Tài Nguyên (Worker Pool Queue)**:
   - Giới hạn số profile chạy đồng thời (mặc định 2 luồng) giúp máy không bị đơ RAM hay quá tải CPU.

5. **Playwright Stealth Core & Báo Động Captcha**:
   - Ngụy trang vân tay trình duyệt (chống TikTok gắn cờ bot / 0 view).
   - Khi phát hiện Captcha: Tự động đưa cửa sổ ra màn hình chính + phát chuông thông báo Desktop Notification để bạn kịp thời kéo mảnh ghép.

---

## 🚀 Hướng Dẫn Sử Dụng Nhanh (1-Click Run)

### Trên macOS:
- Nhấp đúp chuột vào file: **`Chay-App-Mac.command`**

### Trên Windows:
- Nhấp đúp chuột vào file: **`Chay-App-Windows.bat`**

### Hoặc chạy qua Terminal:
```bash
cd /Users/fanboyrose/Desktop/tiktok-uploader-pro
npm run dev
```

---

## 📖 Quy Trình Làm Việc Chuẩn (Workflow MMO)

1. **Bước 1: Thêm Profile**:
   - Bấm nút **"Thêm Profile"** trên giao diện.
   - Điền tên kênh (ví dụ: `review_phim_01`).
   - Bấm **"Chọn Folder"** để chỉ định thư mục chứa các video cần đăng.
   - Thiết lập chế độ nhạc: *Cố định 1 bài* hoặc *Xoay vòng các bài trong Favorites*.
   - Thiết lập lịch đăng: *Nối tiếp (+10 phút)* hoặc *Khung giờ vàng (11:30, 17:30, 20:00)*.

2. **Bước 2: Đăng Nhập Tài Khoản Lần Đầu**:
   - Bấm nút **"Mở Trình Duyệt"** tại card profile tương ứng.
   - Đăng nhập tài khoản TikTok của bạn trên cửa sổ Chrome vừa mở.
   - Lưu ý: Vào mục Âm thanh trên TikTok và **Bấm "Thêm vào Yêu thích" (Favorite)** các bài nhạc của chiến dịch kiếm tiền.
   - Tắt cửa sổ trình duyệt: Ứng dụng sẽ tự động lưu Cookies và phiên đăng nhập vào database SQLite vĩnh viễn.

3. **Bước 3: Bắt Đầu Upload**:
   - Bấm nút **"Bắt Đầu Upload"** trên từng profile hoặc nút **"Chạy Hàng Loạt"** ở góc trên để hệ thống tự động xử lý toàn bộ dàn kênh!
