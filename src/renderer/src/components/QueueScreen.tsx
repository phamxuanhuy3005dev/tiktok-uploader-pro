import {
  Activity,
  ArrowRight,
  Clock,
  Folder,
  OctagonAlert,
  Sparkles,
  Terminal,
  Zap,
} from "lucide-react";
import React, { useState } from "react";
import { Badge } from "./ui/Badge";
import { Button } from "./ui/Button";

interface QueueScreenProps {
  queueStats: {
    runningProfiles: string[];
  };
  profiles: any[];
  liveLogs: any[];
  concurrency: number;
  onUpdateConcurrency: (concurrency: number) => void;
  onClearLiveLogs: () => void;
  onNavigateToProfiles: () => void;
  onStopQueue?: () => Promise<void> | void;
}

export const QueueScreen: React.FC<QueueScreenProps> = ({
  queueStats,
  profiles,
  liveLogs,
  concurrency,
  onUpdateConcurrency,
  onClearLiveLogs,
  onNavigateToProfiles,
  onStopQueue,
}) => {
  const [stopping, setStopping] = useState(false);
  const runningProfiles = profiles.filter((p) =>
    queueStats.runningProfiles?.includes(p.id),
  );
  const isRunning = runningProfiles.length > 0;

  return (
    <div className="space-y-6">
      {/* Top Banner / Stat Bar */}
      <div className="flex flex-col items-start justify-between gap-4 rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm md:flex-row md:items-center">
        <div className="flex items-center gap-3.5">
          <div
            className={`flex h-11 w-11 items-center justify-center rounded-xl border shadow-sm ${
              isRunning
                ? "border-sky-200 bg-sky-50 text-sky-600"
                : "border-slate-200 bg-slate-100 text-slate-500"
            }`}
          >
            <Activity
              className={`h-5 w-5 ${isRunning ? "animate-spin" : ""}`}
            />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-slate-800">
                Tiến Trình Đang Chạy (Queue Engine)
              </h2>
              {isRunning ? (
                <Badge variant="success" className="animate-pulse">
                  Đang chạy ({runningProfiles.length} luồng)
                </Badge>
              ) : (
                <Badge variant="outline">Đang chờ</Badge>
              )}
            </div>
            <p className="mt-0.5 text-xs text-slate-500">
              Hệ thống worker pool tự động điều phối upload, gắn nhạc Favorites
              và đặt lịch hẹn giờ theo luồng song song.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Nút Dừng Hàng Đợi nếu đang có tiến trình chạy */}
          {isRunning && (
            <Button
              variant="destructive"
              size="sm"
              disabled={stopping}
              onClick={async () => {
                if (
                  window.confirm(
                    "Bạn có chắc chắn muốn DỪNG TẤT CẢ các kênh đang upload trong hàng đợi không?",
                  )
                ) {
                  setStopping(true);
                  try {
                    await onStopQueue?.();
                  } finally {
                    setStopping(false);
                  }
                }
              }}
              className="h-8 gap-1.5 px-3 text-xs font-bold shadow-sm shadow-rose-500/20"
            >
              <OctagonAlert className="h-3.5 w-3.5" />
              <span>{stopping ? "Đang dừng..." : "Dừng Hàng Đợi"}</span>
            </Button>
          )}

          {/* Luồng chạy (Concurrency) Selector */}
          <div className="flex items-center gap-3 rounded-xl border border-slate-200/80 bg-slate-50 px-3.5 py-2">
            <div className="flex items-center gap-1.5 text-xs font-medium text-slate-600">
              <Zap className="h-4 w-4 text-sky-500" />
              <span>Số luồng chạy:</span>
            </div>
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5, 8].map((num) => (
                <button
                  key={num}
                  onClick={() => onUpdateConcurrency(num)}
                  className={`h-7 w-7 rounded-lg text-xs font-bold transition-all ${
                    concurrency === num
                      ? "bg-sky-500 text-white shadow-sm shadow-sky-500/30"
                      : "text-slate-600 hover:bg-slate-200/70"
                  }`}
                  title={`Đặt số luồng chạy đồng thời là ${num}`}
                >
                  {num}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Running Profiles Cards */}
      <div className="space-y-3">
        <h3 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-400">
          <Sparkles className="h-3.5 w-3.5 text-sky-500" />
          Kênh đang hoạt động ({runningProfiles.length})
        </h3>

        {!isRunning ? (
          <div className="space-y-3 rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-400">
              <Clock className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-700">
                Hàng đợi hiện đang rảnh rỗi
              </p>
              <p className="mt-0.5 text-xs text-slate-400">
                Chưa có profile nào đang thực hiện upload video. Hãy qua màn
                hình Kênh & Profiles để bấm chạy.
              </p>
            </div>
            <div>
              <Button
                size="sm"
                onClick={onNavigateToProfiles}
                className="text-xs"
              >
                Xem danh sách Kênh & Chọn chạy{" "}
                <ArrowRight className="ml-1 h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
            {runningProfiles.map((p) => {
              // Tìm log gần nhất liên quan tới profile này
              const recentProfileLog = liveLogs.find(
                (l) => l.profileId === p.id || l.message?.includes(p.name),
              );
              return (
                <div
                  key={p.id}
                  className="relative space-y-3 overflow-hidden rounded-xl border border-sky-200 bg-white p-4 shadow-sm shadow-sky-100/50"
                >
                  <div className="absolute left-0 right-0 top-0 h-1 animate-pulse bg-gradient-to-r from-sky-400 to-blue-500" />
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="h-2 w-2 animate-ping rounded-full bg-emerald-500" />
                        <h4 className="truncate text-sm font-bold text-slate-800">
                          {p.name}
                        </h4>
                        <Badge variant="secondary" className="text-[10px]">
                          {p.group_name || "Mặc định"}
                        </Badge>
                      </div>
                      <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-slate-400">
                        <Folder className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                        {p.video_folder || "Chưa chọn thư mục"}
                      </p>
                    </div>

                    <div className="shrink-0 text-right">
                      <span className="rounded border border-sky-100 bg-sky-50 px-2 py-0.5 font-mono text-[11px] font-semibold text-sky-600">
                        Đang xử lý
                      </span>
                    </div>
                  </div>

                  {/* Bước hiện tại */}
                  <div className="flex items-center gap-2 rounded-lg border border-slate-100 bg-slate-50 p-2.5 text-xs text-slate-600">
                    <Activity className="h-3.5 w-3.5 shrink-0 animate-spin text-sky-500" />
                    <span className="font-medium text-slate-700">Bước:</span>
                    <span className="truncate font-mono text-[11px] text-slate-600">
                      {recentProfileLog?.message ||
                        "Khởi tạo phiên trình duyệt và tải danh sách video..."}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Realtime Terminal Log Box */}
      <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/70 px-4 py-3">
          <div className="flex items-center gap-2">
            <Terminal className="h-4 w-4 text-sky-500" />
            <h3 className="text-xs font-bold text-slate-700">
              Nhật Ký Realtime (Trực tiếp từ Engine)
            </h3>
            <span className="font-mono text-[11px] text-slate-400">
              ({liveLogs.length} sự kiện)
            </span>
          </div>

          <button
            onClick={onClearLiveLogs}
            disabled={liveLogs.length === 0}
            className="text-[11px] font-medium text-slate-400 transition-colors hover:text-slate-600 disabled:opacity-40"
          >
            Làm sạch
          </button>
        </div>

        <div className="scrollbar-thin max-h-96 space-y-1.5 overflow-y-auto bg-slate-900 p-4 font-mono text-xs text-slate-200">
          {liveLogs.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-500">
              Chưa có sự kiện nào. Khi bắt đầu upload, các dòng lệnh engine sẽ
              xuất hiện trực tiếp tại đây.
            </div>
          ) : (
            liveLogs.map((log, idx) => {
              const isError = log.type === "error";
              const isSuccess = log.type === "success";
              const isWarn = log.type === "warn";

              return (
                <div
                  key={idx}
                  className="flex items-start gap-2.5 leading-relaxed"
                >
                  <span className="mt-0.5 shrink-0 select-none text-[10px] text-slate-600">
                    ›
                  </span>
                  {log.step && (
                    <span className="py-0.2 shrink-0 rounded border border-slate-700 bg-slate-800 px-1.5 text-[10px] text-slate-400">
                      [{log.step}]
                    </span>
                  )}
                  <span
                    className={`flex-1 break-words ${
                      isError
                        ? "font-medium text-red-400"
                        : isSuccess
                          ? "font-medium text-emerald-400"
                          : isWarn
                            ? "text-amber-300"
                            : "text-slate-300"
                    }`}
                  >
                    {log.message}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
