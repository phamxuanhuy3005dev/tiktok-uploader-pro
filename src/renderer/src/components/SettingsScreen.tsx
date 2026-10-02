import {
  CheckCircle2,
  Clock,
  Cpu,
  FolderCheck,
  HardDrive,
  Info,
  Music,
  Settings,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import { Badge } from "./ui/Badge";

interface SettingsScreenProps {
  concurrency: number;
  onUpdateConcurrency: (concurrency: number) => void;
}

export const SettingsScreen: React.FC<SettingsScreenProps> = ({
  concurrency,
  onUpdateConcurrency,
}) => {
  const [selectedConcurrency, setSelectedConcurrency] = useState(concurrency);
  const [cleanupMode, setCleanupMode] = useState<"delete" | "done">("delete");

  useEffect(() => {
    window.api
      .getCleanupMode()
      .then((mode) => {
        if (mode === "done" || mode === "delete") {
          setCleanupMode(mode);
        }
      })
      .catch((err) => {
        console.error("Failed to get cleanup mode:", err);
      });
  }, []);

  const handleSaveConcurrency = (num: number) => {
    setSelectedConcurrency(num);
    onUpdateConcurrency(num);
  };

  const handleSaveCleanupMode = async (mode: "delete" | "done") => {
    setCleanupMode(mode);
    try {
      await window.api.setCleanupMode(mode);
      toast.success(
        mode === "delete"
          ? "Đã lưu cài đặt: Tự động xóa video gốc sau khi đăng"
          : "Đã lưu cài đặt: Chuyển video gốc vào thư mục done/",
      );
    } catch (err: any) {
      toast.error("Không thể lưu cài đặt: " + err.message);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Title */}
      <div className="flex items-center justify-between rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm">
        <div>
          <h2 className="flex items-center gap-2 text-base font-bold text-slate-800">
            <Settings className="h-5 w-5 text-sky-500" /> Cài Đặt Hệ Thống & Tối
            Ưu Luồng
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Tùy chỉnh số luồng chạy upload đồng thời và kiểm tra các quy chuẩn
            tự động hóa.
          </p>
        </div>
      </div>

      {/* Cấu hình Luồng chạy (Concurrency) */}
      <div className="space-y-4 rounded-2xl border border-slate-200/90 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-sky-100 bg-sky-50 text-sky-600">
              <Cpu className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800">
                Số Luồng Chạy Đồng Thời (Worker Concurrency)
              </h3>
              <p className="mt-0.5 text-xs text-slate-500">
                Quy định số lượng trình duyệt mở cùng lúc để upload video, chèn
                nhạc và lên lịch.
              </p>
            </div>
          </div>
          <Badge
            variant="outline"
            className="border-sky-200 bg-sky-50 font-mono font-bold text-sky-600"
          >
            Hiện tại: {concurrency} luồng
          </Badge>
        </div>

        <div className="grid grid-cols-2 gap-2.5 pt-2 sm:grid-cols-6">
          {[
            { count: 1, label: "1 Luồng", desc: "An toàn / Máy yếu" },
            { count: 2, label: "2 Luồng", desc: "Mặc định (Khuyên dùng)" },
            { count: 3, label: "3 Luồng", desc: "RAM 16GB+" },
            { count: 4, label: "4 Luồng", desc: "Tốc độ cao" },
            { count: 5, label: "5 Luồng", desc: "Đa nhiệm mạnh" },
            { count: 8, label: "8 Luồng", desc: "Máy trạm / Cực mạnh" },
          ].map((item) => (
            <button
              key={item.count}
              onClick={() => handleSaveConcurrency(item.count)}
              className={`rounded-xl border p-3 text-left transition-all ${
                selectedConcurrency === item.count
                  ? "border-sky-500 bg-sky-50/70 shadow-sm ring-2 ring-sky-500/20"
                  : "border-slate-200 hover:border-slate-300 hover:bg-slate-50/60"
              }`}
            >
              <div className="mb-1 flex items-center justify-between">
                <span
                  className={`text-sm font-bold ${selectedConcurrency === item.count ? "text-sky-700" : "text-slate-700"}`}
                >
                  {item.label}
                </span>
                {selectedConcurrency === item.count && (
                  <CheckCircle2 className="h-4 w-4 text-sky-500" />
                )}
              </div>
              <p className="line-clamp-1 text-[11px] text-slate-400">
                {item.desc}
              </p>
            </button>
          ))}
        </div>

        <div className="flex items-start gap-2 rounded-xl border border-slate-100 bg-slate-50 p-3 text-xs text-slate-500">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-sky-500" />
          <span>
            <strong>Gợi ý MMO:</strong> Mỗi phiên Chrome giả lập tiêu tốn khoảng
            300MB - 500MB RAM. Nếu máy của bạn có 8GB RAM, hãy giữ ở mức 1-2
            luồng. Với 16GB RAM trở lên, bạn có thể chạy 3-5 luồng mượt mà để
            tăng tốc độ đẩy video.
          </span>
        </div>
      </div>

      {/* Cấu hình Xử lý Video sau khi Upload */}
      <div className="space-y-4 rounded-2xl border border-slate-200/90 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-amber-100 bg-amber-50 text-amber-600">
              <HardDrive className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800">
                Xử Lý Video Sau Khi Đăng Thành Công
              </h3>
              <p className="mt-0.5 text-xs text-slate-500">
                Lựa chọn hành động tự động sau khi video được tải lên TikTok
                Studio thành công.
              </p>
            </div>
          </div>
          <Badge
            variant="outline"
            className={
              cleanupMode === "delete"
                ? "border-rose-200 bg-rose-50 font-bold text-rose-600"
                : "border-sky-200 bg-sky-50 font-bold text-sky-600"
            }
          >
            {cleanupMode === "delete" ? "Xóa video ngay" : "Lưu vào done/"}
          </Badge>
        </div>

        <div className="grid grid-cols-1 gap-3 pt-1 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => handleSaveCleanupMode("delete")}
            className={`rounded-xl border p-4 text-left transition-all ${
              cleanupMode === "delete"
                ? "border-rose-500 bg-rose-50/60 shadow-sm ring-2 ring-rose-500/20"
                : "border-slate-200 hover:border-slate-300 hover:bg-slate-50/60"
            }`}
          >
            <div className="mb-1.5 flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-bold text-slate-800">
                <Trash2 className="h-4 w-4 text-rose-500" />
                <span>Xóa video gốc ngay lập tức</span>
              </div>
              {cleanupMode === "delete" && (
                <CheckCircle2 className="h-4 w-4 text-rose-500" />
              )}
            </div>
            <p className="text-xs leading-relaxed text-slate-500">
              <strong>Khuyên dùng:</strong> Xóa ngay file video sau khi đăng
              thành công để giải phóng dung lượng ổ cứng tối đa cho máy tính,
              tránh đầy ổ khi cày số lượng lớn.
            </p>
          </button>

          <button
            type="button"
            onClick={() => handleSaveCleanupMode("done")}
            className={`rounded-xl border p-4 text-left transition-all ${
              cleanupMode === "done"
                ? "border-sky-500 bg-sky-50/60 shadow-sm ring-2 ring-sky-500/20"
                : "border-slate-200 hover:border-slate-300 hover:bg-slate-50/60"
            }`}
          >
            <div className="mb-1.5 flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-bold text-slate-800">
                <FolderCheck className="h-4 w-4 text-sky-500" />
                <span>Chuyển vào thư mục done/</span>
              </div>
              {cleanupMode === "done" && (
                <CheckCircle2 className="h-4 w-4 text-sky-500" />
              )}
            </div>
            <p className="text-xs leading-relaxed text-slate-500">
              Tạo thư mục con <code>done/</code> bên trong thư mục nguồn và di
              chuyển video vào đó để lưu trữ lại và kiểm tra đối chiếu sau này.
            </p>
          </button>
        </div>

        <p className="text-[11px] text-slate-400">
          * Bạn cũng có thể thiết lập riêng cho từng Profile cụ thể trong mục
          Chỉnh sửa Profile (ghi đè cài đặt chung này).
        </p>
      </div>

      {/* Thông Tin Cơ Chế Tự Động */}
      <div className="space-y-4 rounded-2xl border border-slate-200/90 bg-white p-6 shadow-sm">
        <h3 className="flex items-center gap-2 text-sm font-bold text-slate-800">
          <ShieldCheck className="h-4 w-4 text-sky-500" /> Quy Chuẩn Tự Động &
          Chống Spam Đã Kích Hoạt
        </h3>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="space-y-1 rounded-xl border border-slate-100 bg-slate-50/60 p-3.5">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
              <Clock className="h-3.5 w-3.5 text-sky-500" /> Giãn Cách Giờ Đăng
              Chuẩn Xác
            </div>
            <p className="text-[11px] text-slate-500">
              Hệ thống tự động quét các video đã hẹn giờ từ trước trên TikTok
              Studio Content để nối tiếp chính xác, không trùng lịch.
            </p>
          </div>

          <div className="space-y-1 rounded-xl border border-slate-100 bg-slate-50/60 p-3.5">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
              <Music className="h-3.5 w-3.5 text-sky-500" /> Xoay Vòng Nhạc
              Favorites -50dB
            </div>
            <p className="text-[11px] text-slate-500">
              Tự động chèn nhạc từ danh sách Yêu thích ở mức âm lượng thấp nhất
              (-50dB) nhằm gắn Sound kiếm tiền mà vẫn giữ nguyên tiếng gốc.
            </p>
          </div>

          <div className="space-y-1 rounded-xl border border-slate-100 bg-slate-50/60 p-3.5">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
              <ShieldCheck className="h-3.5 w-3.5 text-sky-500" /> Môi Trường
              en-US & Tự Xử Lý Popup
            </div>
            <p className="text-[11px] text-slate-500">
              Thiết lập ngôn ngữ tiếng Anh chuẩn cho kênh US/Global, tự động
              đóng các hộp thoại/banner cản trở và tự nạp Cookie đăng nhập.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
