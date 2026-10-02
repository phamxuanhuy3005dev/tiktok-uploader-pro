import {
  CheckCircle2,
  Cpu,
  Film,
  FolderCheck,
  HardDrive,
  Info,
  Settings,
  ShieldAlert,
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
  const [maxVideos, setMaxVideos] = useState<number>(50);
  const [customMaxVideos, setCustomMaxVideos] = useState<string>("50");
  const [circuitBreakerLimit, setCircuitBreakerLimit] = useState<number>(2);

  useEffect(() => {
    window.api
      .getCleanupMode()
      .then((mode) => {
        if (mode === "done" || mode === "delete") {
          setCleanupMode(mode);
        }
      })
      .catch((err) => {
        console.error("Lỗi khi tải cleanup mode:", err);
      });

    window.api
      .getMaxVideos()
      .then((limit) => {
        const val = typeof limit === "number" ? limit : 50;
        setMaxVideos(val);
        setCustomMaxVideos(String(val));
      })
      .catch((err) => {
        console.error("Lỗi khi tải max videos:", err);
      });

    window.api
      .getCircuitBreakerLimit?.()
      .then((val) => setCircuitBreakerLimit(val ?? 2))
      .catch(() => {});
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

  const handleSaveMaxVideos = async (num: number) => {
    const validNum = Math.max(0, Math.floor(num));
    setMaxVideos(validNum);
    setCustomMaxVideos(String(validNum));
    try {
      await window.api.setMaxVideos(validNum);
      toast.success(
        validNum === 0
          ? "Đã lưu cài đặt: Tải lên tất cả video có trong thư mục"
          : `Đã lưu cài đặt: Giới hạn tối đa ${validNum} video / lần chạy`,
      );
    } catch (err: any) {
      toast.error("Không thể lưu cài đặt: " + err.message);
    }
  };

  const handleSaveCircuitBreakerLimit = async (limit: number) => {
    const validLimit = Math.max(0, Math.floor(limit));
    setCircuitBreakerLimit(validLimit);
    try {
      await window.api.setCircuitBreakerLimit?.(validLimit);
      toast.success(
        validLimit === 0
          ? "Đã tắt tự động tạm dừng (luôn cố gắng tải hết)"
          : `Đã lưu: Tự động tạm dừng kênh nếu gặp lỗi liên tiếp ${validLimit} video`,
      );
    } catch (err: any) {
      toast.error("Lỗi lưu cấu hình bảo vệ tài khoản: " + err.message);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Title */}
      <div className="flex items-center justify-between rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm">
        <div>
          <h2 className="flex items-center gap-2 text-base font-bold text-slate-800">
            <Settings className="h-5 w-5 text-sky-500" /> Cài Đặt Hệ Thống
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Cấu hình số luồng chạy, giới hạn video mỗi đợt upload và cơ chế dọn
            dẹp file.
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
                Số lượng kênh được mở trình duyệt xử lý video cùng một lúc.
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
            { count: 1, label: "1 Luồng", desc: "Máy yếu" },
            { count: 2, label: "2 Luồng", desc: "Khuyên dùng" },
            { count: 3, label: "3 Luồng", desc: "RAM 16GB" },
            { count: 4, label: "4 Luồng", desc: "Tốc độ cao" },
            { count: 5, label: "5 Luồng", desc: "Đa nhiệm" },
            { count: 8, label: "8 Luồng", desc: "Máy trạm" },
          ].map((item) => (
            <button
              key={item.count}
              type="button"
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
            Mỗi trình duyệt tiêu tốn khoảng 300MB - 500MB RAM. Nếu máy 8GB RAM
            nên dùng 1-2 luồng, máy 16GB RAM trở lên có thể dùng 3-5 luồng.
          </span>
        </div>
      </div>

      {/* Cấu hình Số video tối đa mỗi lần upload */}
      <div className="space-y-4 rounded-2xl border border-slate-200/90 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-violet-100 bg-violet-50 text-violet-600">
              <Film className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800">
                Số Video Tối Đa Mỗi Lần Upload (Toàn Cục)
              </h3>
              <p className="mt-0.5 text-xs text-slate-500">
                Giới hạn số video tối đa mỗi kênh được upload trong một lần
                chạy. Áp dụng cho tất cả các profile.
              </p>
            </div>
          </div>
          <Badge
            variant="outline"
            className="border-violet-200 bg-violet-50 font-mono font-bold text-violet-600"
          >
            {maxVideos === 0 ? "Tất cả video" : `Tối đa ${maxVideos} video`}
          </Badge>
        </div>

        <div className="grid grid-cols-2 gap-2.5 pt-2 sm:grid-cols-5">
          {[
            { count: 10, label: "10 Video" },
            { count: 20, label: "20 Video" },
            { count: 50, label: "50 Video (Chuẩn)" },
            { count: 100, label: "100 Video" },
            { count: 0, label: "Tất cả" },
          ].map((item) => (
            <button
              key={item.count}
              type="button"
              onClick={() => handleSaveMaxVideos(item.count)}
              className={`rounded-xl border p-3 text-left transition-all ${
                maxVideos === item.count
                  ? "border-violet-500 bg-violet-50/70 shadow-sm ring-2 ring-violet-500/20"
                  : "border-slate-200 hover:border-slate-300 hover:bg-slate-50/60"
              }`}
            >
              <div className="flex items-center justify-between">
                <span
                  className={`text-sm font-bold ${maxVideos === item.count ? "text-violet-700" : "text-slate-700"}`}
                >
                  {item.label}
                </span>
                {maxVideos === item.count && (
                  <CheckCircle2 className="h-4 w-4 text-violet-500" />
                )}
              </div>
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3 pt-1">
          <span className="text-xs font-semibold text-slate-600">
            Hoặc nhập số tùy chỉnh:
          </span>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min="0"
              value={customMaxVideos}
              onChange={(e) => setCustomMaxVideos(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleSaveMaxVideos(Number(customMaxVideos) || 0);
                }
              }}
              className="w-24 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-bold text-slate-800 focus:border-violet-500 focus:outline-none"
              placeholder="0 = Tất cả"
            />
            <button
              type="button"
              onClick={() => handleSaveMaxVideos(Number(customMaxVideos) || 0)}
              className="rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-violet-700"
            >
              Lưu
            </button>
          </div>
          <span className="text-[11px] text-slate-400">
            (0 = không giới hạn, tải hết video trong thư mục)
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
              Xóa ngay file video sau khi đăng thành công để giải phóng dung
              lượng ổ cứng.
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
              Di chuyển video vào thư mục con <code>done/</code> bên trong thư
              mục nguồn để lưu trữ lại.
            </p>
          </button>
        </div>
      </div>

      {/* Cấu hình Bảo Vệ Tài Khoản (Circuit Breaker) */}
      <div className="space-y-4 rounded-2xl border border-slate-200/90 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-rose-100 bg-rose-50 text-rose-600">
              <ShieldAlert className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800">
                Bảo Vệ Tài Khoản Tự Động (Circuit Breaker)
              </h3>
              <p className="mt-0.5 text-xs text-slate-500">
                Tự động tạm dừng kênh nếu gặp lỗi liên tiếp để tránh bị TikTok
                quét spam hoặc checkpoint.
              </p>
            </div>
          </div>
          <Badge
            variant="outline"
            className="border-rose-200 bg-rose-50 font-mono font-bold text-rose-600"
          >
            {circuitBreakerLimit === 0
              ? "Tắt bảo vệ"
              : `Lỗi ${circuitBreakerLimit} lần liên tiếp`}
          </Badge>
        </div>

        <div className="grid grid-cols-2 gap-2.5 pt-1 sm:grid-cols-4">
          {[
            { limit: 1, label: "1 Video lỗi", desc: "Nghiêm ngặt nhất" },
            { limit: 2, label: "2 Video lỗi", desc: "Chuẩn MMO (Khuyên dùng)" },
            { limit: 3, label: "3 Video lỗi", desc: "Thoải mái hơn" },
            { limit: 0, label: "Tắt tự dừng", desc: "Luôn cố gắng thử hết" },
          ].map((item) => (
            <button
              key={item.limit}
              type="button"
              onClick={() => handleSaveCircuitBreakerLimit(item.limit)}
              className={`rounded-xl border p-3.5 text-left transition-all ${
                circuitBreakerLimit === item.limit
                  ? "border-rose-500 bg-rose-50/70 shadow-sm ring-2 ring-rose-500/20"
                  : "border-slate-200 hover:border-slate-300 hover:bg-slate-50/60"
              }`}
            >
              <div className="mb-1 flex items-center justify-between">
                <span
                  className={`text-sm font-bold ${
                    circuitBreakerLimit === item.limit
                      ? "text-rose-700"
                      : "text-slate-700"
                  }`}
                >
                  {item.label}
                </span>
                {circuitBreakerLimit === item.limit && (
                  <CheckCircle2 className="h-4 w-4 text-rose-500" />
                )}
              </div>
              <p className="text-[11px] text-slate-400">{item.desc}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
