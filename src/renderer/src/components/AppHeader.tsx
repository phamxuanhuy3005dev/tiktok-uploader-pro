import React from 'react';
import { Plus, Play, Music, Sparkles, FolderSync } from 'lucide-react';
import { Button } from './ui/Button';

interface AppHeaderProps {
  onAddProfile: () => void;
  onRunBatch: () => void;
  totalProfiles: number;
  runningCount: number;
}

export const AppHeader: React.FC<AppHeaderProps> = ({
  onAddProfile,
  onRunBatch,
  totalProfiles,
  runningCount
}) => {
  return (
    <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-zinc-800/80">
      <div className="flex items-center gap-3">
        <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-[#FE2C55] to-rose-600 flex items-center justify-center shadow-lg shadow-[#FE2C55]/25 border border-rose-400/30">
          <Music className="h-6 w-6 text-white" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-white">TikTok Uploader Pro</h1>
            <span className="inline-flex items-center gap-1 rounded-md bg-rose-500/15 px-2 py-0.5 text-[11px] font-semibold text-rose-400 border border-rose-500/30">
              <Sparkles className="h-3 w-3" /> MMO Edition
            </span>
          </div>
          <p className="text-xs text-zinc-400 mt-0.5">
            Quản lý {totalProfiles} kênh • Gắn nhạc Favorites kiếm tiền • Lên lịch thông minh
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2.5 w-full sm:w-auto">
        <Button
          variant="outline"
          size="sm"
          onClick={onAddProfile}
          className="flex-1 sm:flex-none border-zinc-700/80 hover:border-zinc-500"
        >
          <Plus className="h-4 w-4 mr-1 text-zinc-400" /> Thêm Profile
        </Button>

        <Button
          variant="tiktok"
          size="sm"
          onClick={onRunBatch}
          disabled={totalProfiles === 0 || runningCount > 0}
          className="flex-1 sm:flex-none"
        >
          {runningCount > 0 ? (
            <>
              <FolderSync className="h-4 w-4 mr-1.5 animate-spin" /> Đang chạy ({runningCount})
            </>
          ) : (
            <>
              <Play className="h-4 w-4 mr-1.5 fill-current" /> Chạy Hàng Loạt
            </>
          )}
        </Button>
      </div>
    </header>
  );
};
