import React from 'react';
import { Plus, Play, Music, Sparkles, FolderSync, Download, Upload, FolderDown, Trash2 } from 'lucide-react';
import { Button } from './ui/Button';

interface AppHeaderProps {
  onAddProfile: () => void;
  onRunBatch: () => void;
  onImportOldTool: () => void;
  onExportJson: () => void;
  onImportJson: () => void;
  onDeleteAll: () => void;
  totalProfiles: number;
  runningCount: number;
}

export const AppHeader: React.FC<AppHeaderProps> = ({
  onAddProfile,
  onRunBatch,
  onImportOldTool,
  onExportJson,
  onImportJson,
  onDeleteAll,
  totalProfiles,
  runningCount
}) => {
  return (
    <header className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 pb-6 border-b border-zinc-800/80">
      <div className="flex items-center gap-3">
        <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-[#FE2C55] to-rose-600 flex items-center justify-center shadow-lg shadow-[#FE2C55]/25 border border-rose-400/30 shrink-0">
          <Music className="h-6 w-6 text-white" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-white">TikTok Uploader Pro</h1>
            <span className="inline-flex items-center gap-1 rounded-md bg-rose-500/15 px-2 py-0.5 text-[11px] font-semibold text-rose-400 border border-rose-500/30">
              <Sparkles className="h-3 w-3" /> US / Global MMO Edition
            </span>
          </div>
          <p className="text-xs text-zinc-400 mt-0.5">
            Quản lý {totalProfiles} kênh • Tiếng Anh chuẩn (en-US) • Gắn nhạc Favorites kiếm tiền • Lên lịch thông minh
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
        {/* Nút Import Tool Cũ */}
        <Button
          variant="outline"
          size="sm"
          onClick={onImportOldTool}
          title="Nhập toàn bộ profile & cookie từ thư mục tiktok-at cũ"
          className="border-amber-500/40 text-amber-300 hover:bg-amber-500/10 hover:border-amber-500 text-xs"
        >
          <FolderDown className="h-3.5 w-3.5 mr-1 text-amber-400" /> Nhập từ Tool Cũ
        </Button>

        {/* Nút Export JSON */}
        <Button
          variant="outline"
          size="sm"
          onClick={onExportJson}
          title="Xuất file backup JSON"
          className="border-zinc-700/80 hover:border-zinc-500 text-xs"
        >
          <Download className="h-3.5 w-3.5 mr-1 text-zinc-400" /> Xuất JSON
        </Button>

        {/* Nút Import JSON */}
        <Button
          variant="outline"
          size="sm"
          onClick={onImportJson}
          title="Nhập file JSON backup"
          className="border-zinc-700/80 hover:border-zinc-500 text-xs"
        >
          <Upload className="h-3.5 w-3.5 mr-1 text-zinc-400" /> Nhập JSON
        </Button>

        {/* Nút Xóa Tất Cả (Nếu có profile) */}
        {totalProfiles > 0 && (
          <Button
            variant="destructive"
            size="sm"
            onClick={onDeleteAll}
            title="Xóa toàn bộ profiles để làm sạch và nạp lại"
            className="text-xs"
          >
            <Trash2 className="h-3.5 w-3.5 mr-1" /> Xóa Tất Cả
          </Button>
        )}

        {/* Nút Thêm Profile */}
        <Button
          variant="outline"
          size="sm"
          onClick={onAddProfile}
          className="border-zinc-700/80 hover:border-zinc-500 text-xs"
        >
          <Plus className="h-4 w-4 mr-1 text-zinc-400" /> Thêm Profile
        </Button>

        {/* Nút Chạy Hàng Loạt */}
        <Button
          variant="tiktok"
          size="sm"
          onClick={onRunBatch}
          disabled={totalProfiles === 0 || runningCount > 0}
          className="text-xs"
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
