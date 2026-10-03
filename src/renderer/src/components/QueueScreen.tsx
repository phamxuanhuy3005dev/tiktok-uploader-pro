import {
  Activity,
  ArrowRight,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  FileText,
  Folder,
  Music,
  OctagonAlert,
  Sparkles,
  Terminal,
  Upload,
  Video,
  XCircle,
  Zap,
} from "lucide-react";
import React, { useMemo, useState } from "react";
import { Badge } from "./ui/Badge";
import { Button } from "./ui/Button";

interface QueueScreenProps {
  queueStats: {
    runningProfiles: string[];
    batchTotalVideos?: number;
    batchProcessedVideos?: number;
    batchSuccessVideos?: number;
    batchFailedVideos?: number;
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
  const [showTerminal, setShowTerminal] = useState(false);
  const [expandedProfileLogId, setExpandedProfileLogId] = useState<
    string | null
  >(null);

  const runningProfiles = profiles.filter((p) =>
    queueStats.runningProfiles?.includes(p.id),
  );
  const isRunning = runningProfiles.length > 0;

  // Lấy trạng thái tiến độ mới nhất của từng profile từ liveLogs
  const profileProgressMap = useMemo(() => {
    const map = new Map<
      string,
      {
        videoName: string;
        videoIndex: number;
        totalVideos: number;
        step: string;
        stepText: string;
        message: string;
        type: string;
        uploadedCount: number;
        failedCount: number;
      }
    >();

    for (const log of liveLogs) {
      if (!log.profileId) continue;
      // liveLogs có thứ tự mới nhất ở đầu mảng (index 0).
      // Chỉ lưu log đầu tiên bắt gặp của mỗi profileId để giữ trạng thái mới nhất!
      if (!map.has(log.profileId)) {
        map.set(log.profileId, {
          videoName: log.videoName || "",
          videoIndex: log.videoIndex || 0,
          totalVideos: log.totalVideos || 0,
          step: log.step || "INIT",
          stepText: log.stepText || "Đang xử lý",
          message: log.message || "",
          type: log.type || "info",
          uploadedCount: log.uploadedCount || 0,
          failedCount: log.failedCount || 0,
        });
      }
    }
    return map;
  }, [liveLogs]);

  // Tính toán số liệu tổng thể đợt chạy (Batch)
  const {
    totalVideosInBatch,
    processedVideosInBatch,
    totalSuccess,
    totalFailed,
  } = useMemo(() => {
    // Ưu tiên số liệu batch chính xác được Backend tính toán toàn diện cho tất cả profile
    if (
      queueStats?.batchTotalVideos !== undefined &&
      queueStats?.batchTotalVideos > 0
    ) {
      return {
        totalVideosInBatch: queueStats.batchTotalVideos,
        processedVideosInBatch: queueStats.batchProcessedVideos || 0,
        totalSuccess: queueStats.batchSuccessVideos || 0,
        totalFailed: queueStats.batchFailedVideos || 0,
      };
    }

    let totalVideos = 0;
    let processed = 0;
    let success = 0;
    let failed = 0;

    for (const p of runningProfiles) {
      const prog = profileProgressMap.get(p.id);
      if (prog) {
        totalVideos += prog.totalVideos;
        processed += (prog.uploadedCount || 0) + (prog.failedCount || 0);
        success += prog.uploadedCount || 0;
        failed += prog.failedCount || 0;
      }
    }
    return {
      totalVideosInBatch: totalVideos,
      processedVideosInBatch: processed,
      totalSuccess: success,
      totalFailed: failed,
    };
  }, [queueStats, runningProfiles, profileProgressMap]);

  const batchPercent =
    totalVideosInBatch > 0
      ? Math.min(
          100,
          Math.round((processedVideosInBatch / totalVideosInBatch) * 100),
        )
      : isRunning
        ? 10
        : 0;

  // Helper xác định trạng thái các bước trong Stepper
  const getStepState = (
    currentStep: string,
    stepKey:
      | "ATTACHING_FILE"
      | "CLEARING_CAPTION"
      | "ATTACHING_MUSIC"
      | "SCHEDULING"
      | "SUBMITTING",
  ) => {
    const order = [
      "ATTACHING_FILE",
      "CLEARING_CAPTION",
      "ATTACHING_MUSIC",
      "SCHEDULING",
      "SUBMITTING",
    ];
    const currentIndex = order.indexOf(currentStep);
    const stepIndex = order.indexOf(stepKey);

    if (currentIndex === -1) {
      if (currentStep === "FINISH" || currentStep === "SUCCESS") return "done";
      return "waiting";
    }

    if (stepIndex < currentIndex) return "done";
    if (stepIndex === currentIndex) return "active";
    return "waiting";
  };

  return (
    <div className="space-y-6">
      {/* 1. TOP DASHBOARD: Thống Kê Tổng Quan & Tiến Độ Đợt Chạy */}
      <div className="space-y-4 rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm">
        <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
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
                  Bảng Điều Khiển Hàng Đợi (Queue Dashboard)
                </h2>
                {isRunning ? (
                  <Badge variant="success" className="animate-pulse">
                    Đang chạy ({runningProfiles.length} kênh)
                  </Badge>
                ) : (
                  <Badge variant="outline">Đang chờ</Badge>
                )}
              </div>
              <p className="mt-0.5 text-xs text-slate-500">
                Theo dõi tiến độ upload từng video theo thời gian thực và quản
                lý số luồng xử lý đồng thời.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Nút Dừng Hàng Đợi */}
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

            {/* Bộ chọn luồng Concurrency */}
            <div className="flex items-center gap-2 rounded-xl border border-slate-200/80 bg-slate-50 px-3 py-1.5">
              <div className="flex items-center gap-1 text-xs font-medium text-slate-600">
                <Zap className="h-3.5 w-3.5 text-sky-500" />
                <span>Số luồng:</span>
              </div>
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5, 8].map((num) => (
                  <button
                    key={num}
                    onClick={() => onUpdateConcurrency(num)}
                    className={`h-6 w-6 rounded-md text-xs font-bold transition-all ${
                      concurrency === num
                        ? "shadow-xs bg-sky-500 text-white"
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

        {/* Thanh % Tiến Độ Tổng Thể (khi đang có kênh chạy) */}
        {isRunning && (
          <div className="space-y-2 rounded-xl border border-sky-100 bg-sky-50/40 p-4">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-3">
                <span className="font-bold text-slate-800">
                  Tiến độ đợt chạy:
                </span>
                <span className="font-mono font-bold text-sky-700">
                  {totalVideosInBatch > 0
                    ? `${processedVideosInBatch}/${totalVideosInBatch} video`
                    : "Đang khởi tạo danh sách video..."}
                </span>
              </div>

              <div className="flex items-center gap-3 text-xs">
                <span className="flex items-center gap-1 font-semibold text-emerald-700">
                  <CheckCircle2 className="h-3.5 w-3.5" /> {totalSuccess} thành
                  công
                </span>
                {totalFailed > 0 && (
                  <span className="flex items-center gap-1 font-semibold text-rose-700">
                    <XCircle className="h-3.5 w-3.5" /> {totalFailed} thất bại
                  </span>
                )}
                <span className="rounded-full bg-sky-100 px-2 py-0.5 font-mono font-extrabold text-sky-700">
                  {batchPercent}%
                </span>
              </div>
            </div>

            {/* Progress bar line */}
            <div className="h-2 w-full overflow-hidden rounded-full bg-sky-100">
              <div
                className="h-full rounded-full bg-gradient-to-r from-sky-400 via-sky-500 to-blue-600 transition-all duration-300"
                style={{ width: `${batchPercent}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* 2. THẺ KÊNH THÔNG MINH (Per-Profile Live Progress Cards) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-500">
            <Sparkles className="h-3.5 w-3.5 text-sky-500" />
            Kênh đang chạy ({runningProfiles.length})
          </h3>
          <span className="text-[11px] text-slate-400">
            Cập nhật trực tiếp từng thao tác
          </span>
        </div>

        {!isRunning ? (
          <div className="space-y-3 rounded-2xl border border-dashed border-slate-200 bg-white p-10 text-center">
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
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {runningProfiles.map((p) => {
              const prog = profileProgressMap.get(p.id);
              const totalVids = prog?.totalVideos || 0;
              const currentVidIdx = prog?.videoIndex || 0;
              const currentVidName = prog?.videoName || "";
              const activeStep = prog?.step || "INIT";
              const stepDescription =
                prog?.stepText || "Đang kết nối trình duyệt...";
              const uploaded = prog?.uploadedCount || 0;
              const failed = prog?.failedCount || 0;

              const profilePercent =
                totalVids > 0
                  ? Math.min(
                      100,
                      Math.round(
                        ((uploaded +
                          (activeStep === "SUBMITTING" ? 0.8 : 0.3)) /
                          totalVids) *
                          100,
                      ),
                    )
                  : 5;

              // Filter live logs of this profile for debug
              const profileLogs = liveLogs.filter(
                (l) => l.profileId === p.id || l.message?.includes(p.name),
              );

              const isLogExpanded = expandedProfileLogId === p.id;

              return (
                <div
                  key={p.id}
                  className="relative space-y-3.5 overflow-hidden rounded-2xl border border-sky-200/90 bg-white p-5 shadow-sm shadow-sky-100/60 transition-all hover:border-sky-300"
                >
                  <div className="absolute left-0 right-0 top-0 h-1 animate-pulse bg-gradient-to-r from-sky-400 to-blue-600" />

                  {/* Header: Tên kênh, Nhóm, Huy hiệu trạng thái */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="h-2 w-2 animate-ping rounded-full bg-emerald-500" />
                        <h4
                          className="truncate text-sm font-bold text-slate-800"
                          title={p.name}
                        >
                          {p.name}
                        </h4>
                        {p.group_name && p.group_name !== "Mặc định" && (
                          <Badge variant="secondary" className="text-[10px]">
                            {p.group_name}
                          </Badge>
                        )}
                      </div>
                      <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-slate-400">
                        <Folder className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                        <span className="truncate">
                          {p.video_folder || "Chưa chọn thư mục"}
                        </span>
                      </p>
                    </div>

                    <div className="shrink-0 text-right">
                      <Badge
                        variant="outline"
                        className="border-sky-200 bg-sky-50 font-mono text-[11px] font-bold text-sky-700"
                      >
                        {totalVids > 0
                          ? `Video ${currentVidIdx || 1}/${totalVids}`
                          : "Đang mở"}
                      </Badge>
                    </div>
                  </div>

                  {/* Thanh Progress Bar riêng của Kênh */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-medium text-slate-500">
                        {currentVidName ? (
                          <span className="max-w-[220px] truncate font-mono text-slate-700">
                            {currentVidName}
                          </span>
                        ) : (
                          "Đang quét thư mục video..."
                        )}
                      </span>
                      <span className="font-mono font-bold text-sky-600">
                        {profilePercent}%
                      </span>
                    </div>

                    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-sky-400 to-blue-500 transition-all duration-300"
                        style={{ width: `${profilePercent}%` }}
                      />
                    </div>
                  </div>

                  {/* THANH STEPPER 5 BƯỚC TRỰC QUAN */}
                  <div className="grid grid-cols-5 gap-1 rounded-xl border border-slate-100 bg-slate-50/70 p-2 text-center text-[10px]">
                    {[
                      {
                        key: "ATTACHING_FILE",
                        label: "1. Nạp file",
                        icon: Video,
                      },
                      {
                        key: "CLEARING_CAPTION",
                        label: "2. Xóa tiêu đề",
                        icon: FileText,
                      },
                      {
                        key: "ATTACHING_MUSIC",
                        label: "3. Chèn nhạc",
                        icon: Music,
                      },
                      {
                        key: "SCHEDULING",
                        label: "4. Lên lịch",
                        icon: Calendar,
                      },
                      {
                        key: "SUBMITTING",
                        label: "5. Đăng bài",
                        icon: Upload,
                      },
                    ].map((stepItem) => {
                      const state = getStepState(
                        activeStep,
                        stepItem.key as any,
                      );
                      const Icon = stepItem.icon;

                      return (
                        <div
                          key={stepItem.key}
                          className={`flex flex-col items-center gap-1 rounded-lg py-1.5 transition-all ${
                            state === "active"
                              ? "shadow-xs bg-sky-100/80 font-bold text-sky-800 ring-1 ring-sky-300"
                              : state === "done"
                                ? "font-medium text-emerald-700"
                                : "text-slate-400 opacity-60"
                          }`}
                        >
                          <div
                            className={`flex h-5 w-5 items-center justify-center rounded-full ${
                              state === "active"
                                ? "animate-pulse bg-sky-500 text-white"
                                : state === "done"
                                  ? "bg-emerald-100 text-emerald-600"
                                  : "bg-slate-200 text-slate-400"
                            }`}
                          >
                            {state === "done" ? (
                              <CheckCircle2 className="h-3 w-3" />
                            ) : (
                              <Icon className="h-3 w-3" />
                            )}
                          </div>
                          <span className="line-clamp-1 text-[10px]">
                            {stepItem.label}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Thông tin dòng bước hiện tại & Nút xem log kênh */}
                  <div className="flex items-center justify-between gap-2 border-t border-slate-100 pt-2 text-xs">
                    <div className="flex min-w-0 items-center gap-1.5 text-slate-600">
                      <Activity className="h-3.5 w-3.5 shrink-0 animate-spin text-sky-500" />
                      <span className="truncate font-medium text-slate-700">
                        {stepDescription}
                      </span>
                    </div>

                    <button
                      onClick={() =>
                        setExpandedProfileLogId(isLogExpanded ? null : p.id)
                      }
                      className="flex shrink-0 items-center gap-1 rounded px-2 py-0.5 text-[11px] font-medium text-sky-600 hover:bg-sky-50 hover:text-sky-700"
                    >
                      <span>Log kênh</span>
                      {isLogExpanded ? (
                        <ChevronUp className="h-3 w-3" />
                      ) : (
                        <ChevronDown className="h-3 w-3" />
                      )}
                    </button>
                  </div>

                  {/* Accordion Log riêng của kênh nếu được mở */}
                  {isLogExpanded && (
                    <div className="max-h-36 space-y-1 overflow-y-auto rounded-lg bg-slate-900 p-2.5 font-mono text-[11px] text-slate-300">
                      {profileLogs.length === 0 ? (
                        <p className="text-slate-500">Chưa có log riêng.</p>
                      ) : (
                        profileLogs.slice(-15).map((l, lIdx) => (
                          <div key={lIdx} className="leading-relaxed">
                            <span className="text-slate-500">› </span>
                            <span
                              className={
                                l.type === "error"
                                  ? "font-semibold text-red-400"
                                  : l.type === "success"
                                    ? "text-emerald-400"
                                    : l.type === "warn"
                                      ? "text-amber-300"
                                      : "text-slate-300"
                              }
                            >
                              {l.message}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 3. TERMINAL LOG REALTIME (Gom gọn Accordion mặc định thu gọn) */}
      <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm">
        <div
          onClick={() => setShowTerminal(!showTerminal)}
          className="flex cursor-pointer select-none items-center justify-between border-b border-slate-100 bg-slate-50/80 px-4 py-3 transition-colors hover:bg-slate-100/70"
        >
          <div className="flex items-center gap-2">
            <Terminal className="h-4 w-4 text-sky-500" />
            <h3 className="text-xs font-bold text-slate-700">
              Nhật Ký Kỹ Thuật Trực Tiếp (Engine Terminal)
            </h3>
            <span className="font-mono text-[11px] text-slate-400">
              ({liveLogs.length} sự kiện)
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onClearLiveLogs();
              }}
              disabled={liveLogs.length === 0}
              className="text-[11px] font-medium text-slate-400 transition-colors hover:text-slate-600 disabled:opacity-40"
            >
              Làm sạch
            </button>
            <div className="flex items-center gap-1 text-xs font-medium text-sky-600">
              <span>{showTerminal ? "Thu gọn" : "Mở rộng"}</span>
              {showTerminal ? (
                <ChevronUp className="h-3.5 w-3.5" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5" />
              )}
            </div>
          </div>
        </div>

        {showTerminal && (
          <div className="scrollbar-thin max-h-80 space-y-1.5 overflow-y-auto bg-slate-900 p-4 font-mono text-xs text-slate-200">
            {liveLogs.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-500">
                Chưa có sự kiện nào. Khi bắt đầu upload, các dòng lệnh engine sẽ
                xuất hiện tại đây.
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
        )}
      </div>
    </div>
  );
};
