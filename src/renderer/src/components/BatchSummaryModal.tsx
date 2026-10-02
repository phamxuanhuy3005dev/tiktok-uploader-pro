import {
  CheckCircle2,
  ExternalLink,
  Film,
  Sparkles,
  Trophy,
  XCircle,
} from "lucide-react";
import React from "react";
import { Badge } from "./ui/Badge";
import { Button } from "./ui/Button";
import { Modal } from "./ui/Modal";

export interface BatchVideoResult {
  profileId: string;
  profileName: string;
  videoName: string;
  status: "success" | "failed";
  videoUrl?: string | null;
  errorMessage?: string | null;
  timestamp: string;
}

interface BatchSummaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onViewLogs: () => void;
  startTime: Date | null;
  endTime: Date | null;
  totalProfilesCount: number;
  results: BatchVideoResult[];
}

export const BatchSummaryModal: React.FC<BatchSummaryModalProps> = ({
  isOpen,
  onClose,
  onViewLogs,
  startTime,
  endTime,
  totalProfilesCount,
  results,
}) => {
  if (!isOpen) return null;

  const totalVideos = results.length;
  const successCount = results.filter((r) => r.status === "success").length;
  const failedCount = results.filter((r) => r.status === "failed").length;

  const durationSec =
    startTime && endTime
      ? Math.max(
          1,
          Math.round((endTime.getTime() - startTime.getTime()) / 1000),
        )
      : 0;

  const formatDuration = (sec: number) => {
    if (sec < 60) return `${sec} giây`;
    const min = Math.floor(sec / 60);
    const remainSec = sec % 60;
    return remainSec > 0 ? `${min} phút ${remainSec} giây` : `${min} phút`;
  };

  const hasErrors = failedCount > 0;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Tổng Kết Đợt Chạy Upload">
      <div className="space-y-5">
        {/* Banner Hero */}
        <div
          className={`p-4.5 flex items-center gap-4 rounded-2xl border ${
            hasErrors
              ? "border-amber-200 bg-amber-50/70"
              : "border-emerald-200 bg-emerald-50/70"
          }`}
        >
          <div
            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl shadow-sm ${
              hasErrors
                ? "bg-amber-500 text-white"
                : "bg-emerald-600 text-white"
            }`}
          >
            {hasErrors ? (
              <Sparkles className="h-6 w-6" />
            ) : (
              <Trophy className="h-6 w-6" />
            )}
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-800">
              {hasErrors
                ? "Đợt chạy hoàn tất với một số cảnh báo"
                : "Xuất sắc! Toàn bộ video đã được đăng thành công"}
            </h3>
            <p className="mt-0.5 text-xs text-slate-600">
              Hệ thống đã xử lý xong {totalProfilesCount} kênh trong thời gian{" "}
              <strong>{formatDuration(durationSec)}</strong>.
            </p>
          </div>
        </div>

        {/* 3 Thẻ KPI Thống Kê Nhanh */}
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-center">
            <span className="text-[11px] font-medium text-slate-500">
              Tổng Video
            </span>
            <div className="mt-1 flex items-center justify-center gap-1.5 text-lg font-extrabold text-slate-800">
              <Film className="h-4 w-4 text-slate-500" />
              <span>{totalVideos}</span>
            </div>
          </div>

          <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-3 text-center">
            <span className="text-[11px] font-medium text-emerald-700">
              Thành Công
            </span>
            <div className="mt-1 flex items-center justify-center gap-1.5 text-lg font-extrabold text-emerald-700">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              <span>{successCount}</span>
            </div>
          </div>

          <div
            className={`rounded-xl border p-3 text-center ${
              failedCount > 0
                ? "border-rose-200 bg-rose-50/70"
                : "border-slate-200 bg-slate-50"
            }`}
          >
            <span
              className={`text-[11px] font-medium ${
                failedCount > 0 ? "text-rose-700" : "text-slate-500"
              }`}
            >
              Thất Bại
            </span>
            <div
              className={`mt-1 flex items-center justify-center gap-1.5 text-lg font-extrabold ${
                failedCount > 0 ? "text-rose-700" : "text-slate-500"
              }`}
            >
              <XCircle
                className={`h-4 w-4 ${failedCount > 0 ? "text-rose-600" : "text-slate-400"}`}
              />
              <span>{failedCount}</span>
            </div>
          </div>
        </div>

        {/* Danh sách video chi tiết */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
            <span>Chi tiết video trong đợt chạy:</span>
            <span className="text-[11px] text-slate-400">
              ({results.length} kết quả)
            </span>
          </div>

          <div className="scrollbar-thin max-h-60 space-y-2 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50/50 p-2">
            {results.length === 0 ? (
              <p className="py-6 text-center text-xs text-slate-400">
                Không có dữ liệu video nào được ghi nhận.
              </p>
            ) : (
              results.map((item, idx) => (
                <div
                  key={idx}
                  className="shadow-xs flex items-center justify-between gap-3 rounded-lg border border-slate-200/80 bg-white p-2.5 text-xs"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-800">
                        {item.profileName}
                      </span>
                      <span className="truncate font-mono text-[11px] text-slate-500">
                        {item.videoName}
                      </span>
                    </div>
                    {item.errorMessage && (
                      <p className="mt-1 line-clamp-1 text-[11px] text-rose-600">
                        Lỗi: {item.errorMessage}
                      </p>
                    )}
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    {item.status === "success" ? (
                      <>
                        <Badge variant="success" className="text-[10px]">
                          Thành công
                        </Badge>
                        {item.videoUrl && (
                          <a
                            href={item.videoUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 rounded bg-sky-50 px-2 py-1 text-[11px] font-medium text-sky-600 hover:bg-sky-100"
                            title="Xem video trên TikTok"
                          >
                            <ExternalLink className="h-3 w-3" /> Link
                          </a>
                        )}
                      </>
                    ) : (
                      <Badge variant="error" className="text-[10px]">
                        Thất bại
                      </Badge>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-2.5 border-t border-slate-100 pt-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              onClose();
              onViewLogs();
            }}
            className="text-xs"
          >
            Mở Toàn Bộ Nhật Ký
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={onClose}
            className="px-4 text-xs"
          >
            Đóng
          </Button>
        </div>
      </div>
    </Modal>
  );
};
