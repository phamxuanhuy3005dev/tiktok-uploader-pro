import React, { useState, useEffect } from 'react';
import { Terminal, CheckCircle2, XCircle, ExternalLink, RefreshCw, Trash2, Search, Filter } from 'lucide-react';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';
import { toast } from 'sonner';

interface LogsScreenProps {
  liveLogs: any[];
  onClearLiveLogs: () => void;
}

export const LogsScreen: React.FC<LogsScreenProps> = ({ liveLogs, onClearLiveLogs }) => {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterStatus, setFilterStatus] = useState<'all' | 'success' | 'failed'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const data = await window.api.getAllLogs();
      setLogs(data || []);
    } catch (err: any) {
      toast.error(`Không thể tải nhật ký: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const handleClearLogs = async () => {
    if (confirm('Bạn có chắc chắn muốn xóa toàn bộ lịch sử nhật ký đăng video không?')) {
      try {
        await window.api.clearLogs();
        setLogs([]);
        onClearLiveLogs();
        toast.success('Đã xóa toàn bộ nhật ký.');
      } catch (err: any) {
        toast.error(`Lỗi xóa: ${err.message}`);
      }
    }
  };

  const filteredLogs = logs.filter((log) => {
    if (filterStatus !== 'all' && log.status !== filterStatus) return false;
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      const matchName = (log.profile_name || log.profile_id || '').toLowerCase().includes(query);
      const matchVideo = (log.video_name || '').toLowerCase().includes(query);
      if (!matchName && !matchVideo) return false;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200/90 shadow-sm">
        <div>
          <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
            <Terminal className="h-5 w-5 text-sky-500" /> Nhật Ký & Lịch Sử Upload
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Theo dõi chi tiết các video đã đăng, video ID, link xem TikTok và thông báo lỗi.
          </p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Button variant="outline" size="sm" onClick={fetchLogs} disabled={loading} className="text-xs">
            <RefreshCw className={`h-3.5 w-3.5 mr-1 ${loading ? 'animate-spin' : ''}`} /> Làm Mới
          </Button>

          <Button variant="destructive" size="sm" onClick={handleClearLogs} className="text-xs">
            <Trash2 className="h-3.5 w-3.5 mr-1" /> Xóa Nhật Ký
          </Button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200/80 shadow-sm">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm theo tên kênh hoặc tên file video..."
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-slate-50/50 text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-sky-500 focus:bg-white"
          />
        </div>

        {/* Filter Status */}
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-xs text-slate-400 flex items-center gap-1 mr-1">
            <Filter className="h-3 w-3" /> Trạng thái:
          </span>
          <button
            onClick={() => setFilterStatus('all')}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
              filterStatus === 'all'
                ? 'bg-sky-500 text-white font-semibold shadow-sm'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Tất cả ({logs.length})
          </button>
          <button
            onClick={() => setFilterStatus('success')}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
              filterStatus === 'success'
                ? 'bg-emerald-600 text-white font-semibold shadow-sm'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Thành công ({logs.filter((l) => l.status === 'success').length})
          </button>
          <button
            onClick={() => setFilterStatus('failed')}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
              filterStatus === 'failed'
                ? 'bg-rose-600 text-white font-semibold shadow-sm'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Thất bại ({logs.filter((l) => l.status === 'failed').length})
          </button>
        </div>
      </div>

      {/* Realtime Live Progress Box (nếu có liveLogs) */}
      {liveLogs.length > 0 && (
        <div className="rounded-2xl border border-sky-200 bg-sky-50/30 p-4 space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-sky-800 border-b border-sky-100 pb-2">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-sky-500 animate-ping" />
              Tiến Trình Đang Chạy Realtime
            </span>
            <button
              onClick={onClearLiveLogs}
              className="text-xs text-sky-600 hover:text-sky-800 underline transition-colors cursor-pointer"
            >
              Dọn log trực tiếp
            </button>
          </div>
          <div className="font-mono text-xs max-h-40 overflow-y-auto space-y-1 text-slate-700 bg-white p-3 rounded-xl border border-sky-100">
            {liveLogs.map((log, idx) => (
              <div key={idx} className="flex items-start gap-2">
                <span className="text-slate-400 select-none">›</span>
                <span
                  className={
                    log.type === 'error'
                      ? 'text-rose-600 font-semibold'
                      : log.type === 'success'
                        ? 'text-emerald-600 font-semibold'
                        : log.type === 'warn'
                          ? 'text-amber-600'
                          : 'text-slate-700'
                  }
                >
                  {log.message}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Table of Database Logs */}
      <div className="bg-white rounded-2xl border border-slate-200/90 overflow-hidden shadow-sm">
        {filteredLogs.length === 0 ? (
          <div className="py-16 text-center text-sm text-slate-400">
            Chưa có lịch sử đăng video nào phù hợp với bộ lọc.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-700 font-semibold uppercase text-[11px] tracking-wider">
                <tr>
                  <th className="py-3 px-4">Thời gian</th>
                  <th className="py-3 px-4">Kênh (Profile)</th>
                  <th className="py-3 px-4">Video</th>
                  <th className="py-3 px-4">Trạng thái</th>
                  <th className="py-3 px-4">Video ID / Link TikTok</th>
                  <th className="py-3 px-4">Chi tiết / Lỗi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 px-4 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                      {log.created_at ? new Date(log.created_at).toLocaleString('vi-VN') : '—'}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-800">{log.profile_name || log.profile_id}</div>
                      {log.group_name && (
                        <span className="text-[10px] text-slate-400">{log.group_name}</span>
                      )}
                    </td>
                    <td className="py-3 px-4 font-mono text-[11px] text-slate-700 max-w-[180px] truncate" title={log.video_name}>
                      {log.video_name}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      {log.status === 'success' ? (
                        <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full text-[11px] font-semibold border border-emerald-200">
                          <CheckCircle2 className="h-3 w-3" /> Thành công
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full text-[11px] font-semibold border border-rose-200">
                          <XCircle className="h-3 w-3" /> Thất bại
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      {log.video_url ? (
                        <a
                          href={log.video_url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-sky-600 hover:text-sky-800 font-mono text-[11px] underline"
                        >
                          {log.video_id ? `ID: ${log.video_id.replace(/'/g, '')}` : 'Mở Video'}
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      ) : log.video_id ? (
                        <span className="font-mono text-[11px] text-slate-600">{log.video_id.replace(/'/g, '')}</span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4 max-w-[280px] truncate text-[11px] text-slate-500" title={log.error_message || ''}>
                      {log.error_message ? (
                        <span className="text-rose-600">{log.error_message}</span>
                      ) : (
                        <span className="text-emerald-600">Lên lịch thành công</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
