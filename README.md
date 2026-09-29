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

## 👥 Hướng Dẫn Cài Đặt Cho Thành Viên Khác (Phân Phối Nhanh)

Tool hoạt động theo mô hình **Smart Portable Runner** (giống tool cũ): Cực kỳ mượt, không cần cài đặt phức tạp, tự động cập nhật code mới mỗi khi mở app!

### 📥 1. Tải về lần đầu:
Mở Terminal (Mac) hoặc Git Bash / CMD (Windows) và chạy:
```bash
git clone https://github.com/phamxuanhuy3005dev/tiktok-uploader-pro.git
```

### ⚡ 2. Khởi chạy 1 chạm:
- **Trên macOS**: Nhấp đúp chuột vào file **`Chay-App-Mac.command`**
- **Trên Windows**: Nhấp đúp chuột vào file **`Chay-App-Windows.bat`**

> **Cơ chế tự động của Smart Runner**:
> - Tự động chạy `git pull` để nhận code mới nhất từ GitHub.
> - Tự động cài thư viện (`npm install` & `playwright`) nếu máy mới chưa có.
> - Tự động kiểm tra file thay đổi và compile siêu tốc (< 0.6s).
> - Mở ứng dụng trực tiếp ở chế độ Production tối ưu RAM và mượt mà nhất.

---

## 📖 Quy Trình Làm Việc Chuẩn (Workflow MMO)

1. **Bước 1: Thêm Profile & Gán Thư Mục**:
   - Bấm nút **"Thêm Profile"** trên giao diện.
   - Điền tên kênh (ví dụ: `review_phim_01`), chọn Nhóm kênh.
   - Chọn Folder video riêng hoặc dùng tính năng **"Chia Đều Video"** để tự động phân phối 1 thư mục mẹ cho nhiều profile theo nhóm.
   - Thiết lập cấu hình nhạc: *Tắt nhạc* hoặc *Bật nhạc yêu thích (Xoay vòng hoặc Cố định bài)*.
   - Thiết lập proxy (nếu nuôi nick ngoại: hỗ trợ `http://`, `socks5://`, có nút kiểm tra IP/Quốc gia trực tiếp).

2. **Bước 2: Đăng Nhập Tài Khoản Lần Đầu**:
   - Bấm nút **"Mở Trình Duyệt"** tại card profile tương ứng.
   - Đăng nhập tài khoản TikTok của bạn trên cửa sổ Chrome vừa mở.
   - Lưu ý: Vào mục Âm thanh trên TikTok và **Bấm "Thêm vào Yêu thích" (Favorite)** các bài nhạc của chiến dịch kiếm tiền.
   - Tắt cửa sổ trình duyệt: Ứng dụng sẽ tự động lưu Cookies và phiên đăng nhập vào database SQLite vĩnh viễn.

3. **Bước 3: Bắt Đầu Upload**:
   - Chọn các profile cần chạy rồi bấm **"Bắt đầu đăng"**.
   - Hệ thống tự động kiểm tra cảnh báo thư mục trống, lên lịch chuẩn xác và di chuyển video sang `done/` sau khi hoàn tất.
