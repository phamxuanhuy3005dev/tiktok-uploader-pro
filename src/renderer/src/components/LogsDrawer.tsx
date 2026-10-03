import {
  AlertCircle,
  CheckCircle2,
  Clock,
  ExternalLink,
  RefreshCw,
  Video,
  XCircle,
} from "lucide-react";
import React, { useEffect, useState } from "react";
import { Badge } from "./ui/Badge";
import { Button } from "./ui/Button";
import { Modal } from "./ui/Modal";
import { formatDateTime } from "../utils/date";

interface LogsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  profile: any;
}

export const LogsDrawer: React.FC<LogsDrawerProps> = ({
  isOpen,
  onClose,
  profile,
}) => {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && profile?.id) {
      loadLogs();
    }
  }, [isOpen, profile]);

  const loadLogs = async () => {
    setLoading(true);
    try {
      const data = await window.api.getLogs(profile.id);
      setLogs(data || []);
    } catch (_) {
      setLogs([]);
    } finally {
      setLoading(false);
    }
  };

  if (!profile) return null;

  const successCount = logs.filter((l) => l.status === "success").length;
  const failedCount = logs.filter((l) => l.status === "failed").length;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Lịch Sử Đăng Video: ${profile.name}`}
      description="Chi tiết các video đã đăng tải, link phát hành trên TikTok và thông tin lỗi (nếu có)."
      className="max-w-2xl"
    >
      <div className="space-y-4">
        {/* Quick summary badges */}
        <div className="flex items-center justify-between rounded-xl border border-slate-200/80 bg-slate-50 p-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-700">
              Tổng cộng: {logs.length} lượt upload
            </span>
            {successCount > 0 && (
              <Badge variant="success" className="text-[11px]">
                {successCount} thành công
              </Badge>
            )}
            {failedCount > 0 && (
              <Badge variant="destructive" className="text-[11px]">
                {failedCount} thất bại
              </Badge>
            )}
          </div>
          <button
            onClick={loadLogs}
            disabled={loading}
            className="flex items-center gap-1 text-xs font-medium text-slate-500 transition-colors hover:text-sky-600"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`}
            />{" "}
            Làm mới
          </button>
        </div>

        {/* Logs list */}
        {loading ? (
          <div className="py-12 text-center text-xs text-slate-400">
            Đang tải lịch sử bài đăng...
          </div>
        ) : logs.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 py-12 text-center text-xs text-slate-400">
            Kênh này chưa có video nào được đăng tải.
          </div>
        ) : (
          <div className="scrollbar-thin max-h-[55vh] space-y-2.5 overflow-y-auto pr-1">
            {logs.map((log) => {
              const isSuccess = log.status === "success";

              return (
                <div
                  key={log.id}
                  className={`flex flex-col justify-between gap-3 rounded-xl border p-3.5 transition-all sm:flex-row sm:items-center ${
                    isSuccess
                      ? "shadow-xs border-slate-200/90 bg-white hover:border-sky-300"
                      : "border-red-200 bg-red-50/40 hover:border-red-300"
                  }`}
                >
                  <div className="flex min-w-0 items-start gap-3">
                    <div
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${
                        isSuccess
                          ? "border-emerald-200 bg-emerald-50 text-emerald-600"
                          : "border-red-200 bg-red-100 text-red-600"
                      }`}
                    >
                      {isSuccess ? (
                        <CheckCircle2 className="h-4 w-4" />
                      ) : (
                        <XCircle className="h-4 w-4" />
                      )}
                    </div>

                    <div className="min-w-0 space-y-0.5">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-xs font-bold text-slate-800">
                          {log.video_name}
                        </p>
                        {log.video_id && (
                          <span className="py-0.2 shrink-0 rounded bg-slate-100 px-1.5 font-mono text-[10px] text-slate-400">
                            ID: {log.video_id}
                          </span>
                        )}
                      </div>

                      {log.error_message ? (
                        <p className="flex items-center gap-1 text-[11px] font-medium text-red-600">
                          <AlertCircle className="h-3 w-3 shrink-0" />
                          <span className="line-clamp-2">
                            {log.error_message}
                          </span>
                        </p>
                      ) : (
                        <p className="flex items-center gap-1.5 font-mono text-[11px] text-slate-400">
                          <Clock className="h-3 w-3 shrink-0 text-slate-400" />
                          <span>{formatDateTime(log.created_at)}</span>
                        </p>
                      )}
                    </div>
                  </div>

                  {log.video_url && (
                    <div className="flex shrink-0 sm:justify-end">
                      <a
                        href={log.video_url}
                        target="_blank"
                        rel="noreferrer"
                        className="shadow-xs inline-flex items-center gap-1.5 rounded-lg border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-semibold text-sky-700 transition-all hover:bg-sky-500 hover:text-white"
                      >
                        <Video className="h-3.5 w-3.5" /> Xem Video{" "}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <div className="flex justify-end border-t border-slate-100 pt-3">
          <Button
            variant="outline"
            size="sm"
            onClick={onClose}
            className="text-xs"
          >
            Đóng
          </Button>
        </div>
      </div>
    </Modal>
  );
};
