import React from 'react';
import { Activity, Play, Zap, Terminal, Sparkles, Folder, Clock, CheckCircle2, AlertCircle, ArrowRight } from 'lucide-react';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';

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
}

export const QueueScreen: React.FC<QueueScreenProps> = ({
  queueStats,
  profiles,
  liveLogs,
  concurrency,
  onUpdateConcurrency,
  onClearLiveLogs,
  onNavigateToProfiles
}) => {
  const runningProfiles = profiles.filter((p) => queueStats.runningProfiles?.includes(p.id));
  const isRunning = runningProfiles.length > 0;

  return (
    <div className="space-y-6">
      {/* Top Banner / Stat Bar */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className={`h-11 w-11 rounded-xl flex items-center justify-center border shadow-sm ${
            isRunning 
              ? 'bg-sky-50 text-sky-600 border-sky-200' 
              : 'bg-slate-100 text-slate-500 border-slate-200'
          }`}>
            <Activity className={`h-5 w-5 ${isRunning ? 'animate-spin' : ''}`} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-slate-800">Tiến Trình Đang Chạy (Queue Engine)</h2>
              {isRunning ? (
                <Badge variant="success" className="animate-pulse">
                  Đang chạy ({runningProfiles.length} luồng)
                </Badge>
              ) : (
                <Badge variant="outline">Đang chờ</Badge>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Hệ thống worker pool tự động điều phối upload, gắn nhạc Favorites và đặt lịch hẹn giờ theo luồng song song.
            </p>
          </div>
        </div>

        {/* Luồng chạy (Concurrency) Selector */}
        <div className="flex items-center gap-3 bg-slate-50 px-3.5 py-2 rounded-xl border border-slate-200/80">
          <div className="flex items-center gap-1.5 text-xs font-medium text-slate-600">
            <Zap className="h-4 w-4 text-sky-500" />
            <span>Số luồng chạy:</span>
          </div>
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5, 8].map((num) => (
              <button
                key={num}
                onClick={() => onUpdateConcurrency(num)}
                className={`w-7 h-7 rounded-lg text-xs font-bold transition-all ${
                  concurrency === num
                    ? 'bg-sky-500 text-white shadow-sm shadow-sky-500/30'
                    : 'text-slate-600 hover:bg-slate-200/70'
                }`}
                title={`Đặt số luồng chạy đồng thời là ${num}`}
              >
                {num}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Running Profiles Cards */}
      <div className="space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-sky-500" />
          Kênh đang hoạt động ({runningProfiles.length})
        </h3>

        {!isRunning ? (
          <div className="bg-white rounded-2xl border border-dashed border-slate-200 p-8 text-center space-y-3">
            <div className="h-12 w-12 rounded-xl bg-slate-50 text-slate-400 flex items-center justify-center mx-auto border border-slate-200">
              <Clock className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-700">Hàng đợi hiện đang rảnh rỗi</p>
              <p className="text-xs text-slate-400 mt-0.5">
                Chưa có profile nào đang thực hiện upload video. Hãy qua màn hình Kênh & Profiles để bấm chạy.
              </p>
            </div>
            <div>
              <Button size="sm" onClick={onNavigateToProfiles} className="text-xs">
                Xem danh sách Kênh & Chọn chạy <ArrowRight className="h-3.5 w-3.5 ml-1" />
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {runningProfiles.map((p) => {
              // Tìm log gần nhất liên quan tới profile này
              const recentProfileLog = liveLogs.find((l) => l.profileId === p.id || l.message?.includes(p.name));
              return (
                <div
                  key={p.id}
                  className="bg-white rounded-xl border border-sky-200 p-4 shadow-sm shadow-sky-100/50 space-y-3 relative overflow-hidden"
                >
                  <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-sky-400 to-blue-500 animate-pulse" />
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
                        <h4 className="text-sm font-bold text-slate-800 truncate">{p.name}</h4>
                        <Badge variant="secondary" className="text-[10px]">
                          {p.group_name || 'Mặc định'}
                        </Badge>
                      </div>
                      <p className="text-xs text-slate-400 truncate mt-0.5 flex items-center gap-1">
                        <Folder className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                        {p.video_folder || 'Chưa chọn thư mục'}
                      </p>
                    </div>

                    <div className="shrink-0 text-right">
                      <span className="text-[11px] font-mono text-sky-600 bg-sky-50 px-2 py-0.5 rounded border border-sky-100 font-semibold">
                        Đang xử lý
                      </span>
                    </div>
                  </div>

                  {/* Bước hiện tại */}
                  <div className="bg-slate-50 rounded-lg p-2.5 border border-slate-100 text-xs text-slate-600 flex items-center gap-2">
                    <Activity className="h-3.5 w-3.5 text-sky-500 animate-spin shrink-0" />
                    <span className="font-medium text-slate-700">Bước:</span>
                    <span className="truncate text-slate-600 font-mono text-[11px]">
                      {recentProfileLog?.message || 'Khởi tạo phiên trình duyệt và tải danh sách video...'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Realtime Terminal Log Box */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50/70">
          <div className="flex items-center gap-2">
            <Terminal className="h-4 w-4 text-sky-500" />
            <h3 className="text-xs font-bold text-slate-700">Nhật Ký Realtime (Trực tiếp từ Engine)</h3>
            <span className="text-[11px] text-slate-400 font-mono">({liveLogs.length} sự kiện)</span>
          </div>

          <button
            onClick={onClearLiveLogs}
            disabled={liveLogs.length === 0}
            className="text-[11px] font-medium text-slate-400 hover:text-slate-600 transition-colors disabled:opacity-40"
          >
            Làm sạch
          </button>
        </div>

        <div className="p-4 bg-slate-900 text-slate-200 font-mono text-xs max-h-96 overflow-y-auto space-y-1.5 scrollbar-thin">
          {liveLogs.length === 0 ? (
            <div className="py-8 text-center text-slate-500 text-xs">
              Chưa có sự kiện nào. Khi bắt đầu upload, các dòng lệnh engine sẽ xuất hiện trực tiếp tại đây.
            </div>
          ) : (
            liveLogs.map((log, idx) => {
              const isError = log.type === 'error';
              const isSuccess = log.type === 'success';
              const isWarn = log.type === 'warn';

              return (
                <div key={idx} className="flex items-start gap-2.5 leading-relaxed">
                  <span className="text-slate-600 select-none text-[10px] shrink-0 mt-0.5">›</span>
                  {log.step && (
                    <span className="text-slate-400 text-[10px] bg-slate-800 px-1.5 py-0.2 rounded border border-slate-700 shrink-0">
                      [{log.step}]
                    </span>
                  )}
                  <span
                    className={`flex-1 break-words ${
                      isError
                        ? 'text-red-400 font-medium'
                        : isSuccess
                          ? 'text-emerald-400 font-medium'
                          : isWarn
                            ? 'text-amber-300'
                            : 'text-slate-300'
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
