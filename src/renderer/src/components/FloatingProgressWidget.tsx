import { Activity, ArrowUpRight, CheckCircle2, Film } from "lucide-react";
import React from "react";

interface FloatingProgressWidgetProps {
  isVisible: boolean;
  runningCount: number;
  totalVideos: number;
  processedVideos: number;
  successVideos: number;
  onClick: () => void;
}

export const FloatingProgressWidget: React.FC<FloatingProgressWidgetProps> = ({
  isVisible,
  runningCount,
  totalVideos,
  processedVideos,
  successVideos,
  onClick,
}) => {
  if (!isVisible || runningCount === 0) return null;

  const percent =
    totalVideos > 0
      ? Math.min(100, Math.round((processedVideos / totalVideos) * 100))
      : 0;

  return (
    <div
      onClick={onClick}
      className="fixed bottom-5 right-6 z-40 flex cursor-pointer items-center gap-3.5 rounded-2xl border border-sky-300 bg-white/95 px-4 py-3 shadow-xl shadow-sky-500/15 backdrop-blur-md transition-all duration-200 hover:-translate-y-0.5 hover:border-sky-400 hover:shadow-2xl"
    >
      <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sky-500 text-white shadow-sm shadow-sky-500/30">
        <Activity className="h-5 w-5 animate-spin" />
        <span className="absolute -right-1 -top-1 flex h-3 w-3">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sky-400 opacity-75" />
          <span className="relative inline-flex h-3 w-3 rounded-full bg-sky-600" />
        </span>
      </div>

      <div className="min-w-[170px]">
        <div className="flex items-center justify-between text-xs">
          <span className="font-bold text-slate-800">
            Đang upload ({runningCount} luồng)
          </span>
          <span className="font-mono font-bold text-sky-600">{percent}%</span>
        </div>

        {/* Mini progress bar */}
        <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-gradient-to-r from-sky-400 to-blue-500 transition-all duration-300"
            style={{ width: `${percent}%` }}
          />
        </div>

        <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500">
          <span className="flex items-center gap-1">
            <Film className="h-3 w-3" />
            {totalVideos > 0
              ? `${processedVideos}/${totalVideos} video`
              : "Đang khởi tạo..."}
          </span>
          <span className="flex items-center gap-0.5 font-medium text-emerald-600">
            <CheckCircle2 className="h-3 w-3" /> {successVideos}
          </span>
        </div>
      </div>

      <div className="ml-1 flex h-7 w-7 items-center justify-center rounded-lg bg-sky-50 text-sky-600 transition-colors hover:bg-sky-100">
        <ArrowUpRight className="h-4 w-4" />
      </div>
    </div>
  );
};
