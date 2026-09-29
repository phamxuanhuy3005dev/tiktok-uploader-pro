import React, { useEffect, useState } from 'react';
import { ExternalLink, CheckCircle, XCircle, Clock } from 'lucide-react';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';

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

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Lịch Sử Đăng Video: ${profile.name}`}
      description="Chi tiết các video đã upload, link phát hành và lỗi (nếu có)."
      className="max-w-2xl"
    >
      <div className="space-y-4">
        {loading ? (
          <div className="py-12 text-center text-sm text-zinc-500">Đang tải lịch sử...</div>
        ) : logs.length === 0 ? (
          <div className="py-12 text-center text-sm text-zinc-500">
            Chưa có video nào được đăng từ profile này.
          </div>
        ) : (
          <div className="max-h-[50vh] overflow-y-auto space-y-2 pr-1">
            {logs.map((log) => (
              <div
                key={log.id}
                className="flex items-center justify-between gap-3 p-3 rounded-xl border border-zinc-800/80 bg-zinc-900/40 text-xs"
              >
                <div className="flex items-start gap-2.5 overflow-hidden">
                  {log.status === 'success' ? (
                    <CheckCircle className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
                  )}
                  <div className="overflow-hidden">
                    <p className="font-semibold text-zinc-200 truncate">{log.video_name}</p>
                    {log.error_message ? (
                      <p className="text-red-400 text-[11px] mt-0.5">{log.error_message}</p>
                    ) : (
                      <p className="text-zinc-500 text-[11px] mt-0.5 flex items-center gap-1">
                        <Clock className="h-3 w-3" /> {new Date(log.created_at).toLocaleString('vi-VN')}
                      </p>
                    )}
                  </div>
                </div>

                {log.video_url && (
                  <a
                    href={log.video_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 hover:text-white transition-colors shrink-0"
                  >
                    Xem Video <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="flex justify-between items-center pt-3 border-t border-zinc-800/80">
          <Button variant="ghost" size="sm" onClick={loadLogs}>
            Làm mới
          </Button>
          <Button variant="secondary" size="sm" onClick={onClose}>
            Đóng
          </Button>
        </div>
      </div>
    </Modal>
  );
};
