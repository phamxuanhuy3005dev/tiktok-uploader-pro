import {
  CheckCircle2,
  Clock,
  Cpu,
  Info,
  Music,
  Settings,
  ShieldCheck,
} from "lucide-react";
import React, { useState } from "react";
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

  const handleSaveConcurrency = (num: number) => {
    setSelectedConcurrency(num);
    onUpdateConcurrency(num);
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
