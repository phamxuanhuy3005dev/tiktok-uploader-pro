import React, { useEffect, useState } from 'react';
import { ExternalLink, CheckCircle2, XCircle, Clock, Video, RefreshCw, AlertCircle } from 'lucide-react';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';

interface LogsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  profile: any;
}

export const LogsDrawer: React.FC<LogsDrawerProps> = ({ isOpen, onClose, profile }) => {
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

  const successCount = logs.filter((l) => l.status === 'success').length;
  const failedCount = logs.filter((l) => l.status === 'failed').length;

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
        <div className="flex items-center justify-between bg-slate-50 p-3 rounded-xl border border-slate-200/80 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-700">Tổng cộng: {logs.length} lượt upload</span>
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
            className="flex items-center gap-1 text-slate-500 hover:text-sky-600 transition-colors text-xs font-medium"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Làm mới
          </button>
        </div>

        {/* Logs list */}
        {loading ? (
          <div className="py-12 text-center text-xs text-slate-400">Đang tải lịch sử bài đăng...</div>
        ) : logs.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-400 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
            Kênh này chưa có video nào được đăng tải.
          </div>
        ) : (
          <div className="max-h-[55vh] overflow-y-auto space-y-2.5 pr-1 scrollbar-thin">
            {logs.map((log) => {
              const isSuccess = log.status === 'success';

              return (
                <div
                  key={log.id}
                  className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl border transition-all ${
                    isSuccess
                      ? 'bg-white border-slate-200/90 hover:border-sky-300 shadow-xs'
                      : 'bg-red-50/40 border-red-200 hover:border-red-300'
                  }`}
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <div
                      className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 border ${
                        isSuccess
                          ? 'bg-emerald-50 text-emerald-600 border-emerald-200'
                          : 'bg-red-100 text-red-600 border-red-200'
                      }`}
                    >
                      {isSuccess ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                    </div>

                    <div className="min-w-0 space-y-0.5">
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-slate-800 text-xs truncate">{log.video_name}</p>
                        {log.video_id && (
                          <span className="font-mono text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.2 rounded shrink-0">
                            ID: {log.video_id}
                          </span>
                        )}
                      </div>

                      {log.error_message ? (
                        <p className="text-red-600 text-[11px] font-medium flex items-center gap-1">
                          <AlertCircle className="h-3 w-3 shrink-0" />
                          <span className="line-clamp-2">{log.error_message}</span>
                        </p>
                      ) : (
                        <p className="text-slate-400 text-[11px] flex items-center gap-1.5 font-mono">
                          <Clock className="h-3 w-3 text-slate-400 shrink-0" />
                          <span>{new Date(log.created_at).toLocaleString('vi-VN')}</span>
                        </p>
                      )}
                    </div>
                  </div>

                  {log.video_url && (
                    <div className="shrink-0 flex sm:justify-end">
                      <a
                        href={log.video_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-50 text-sky-700 hover:bg-sky-500 hover:text-white border border-sky-200 text-xs font-semibold shadow-xs transition-all"
                      >
                        <Video className="h-3.5 w-3.5" /> Xem Video <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <div className="flex justify-end pt-3 border-t border-slate-100">
          <Button variant="outline" size="sm" onClick={onClose} className="text-xs">
            Đóng
          </Button>
        </div>
      </div>
    </Modal>
  );
};
