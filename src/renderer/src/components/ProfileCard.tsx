import React from 'react';
import {
  Globe,
  Music,
  Folder,
  Calendar,
  ExternalLink,
  Play,
  Edit2,
  Trash2,
  ListOrdered,
  CheckCircle2,
  AlertCircle,
  Users
} from 'lucide-react';
import { Badge } from './ui/Badge';
import { Button } from './ui/Button';

interface ProfileCardProps {
  profile: any;
  onEdit: () => void;
  onDelete: () => void;
  onOpenBrowser: () => void;
  onRunUpload: () => void;
  onViewLogs: () => void;
  isRunning: boolean;
}

export const ProfileCard: React.FC<ProfileCardProps> = ({
  profile,
  onEdit,
  onDelete,
  onOpenBrowser,
  onRunUpload,
  onViewLogs,
  isRunning
}) => {
  const hasCookies = Boolean(profile.cookies);

  const getStatusBadge = () => {
    switch (profile.status) {
      case 'uploading':
        return <Badge variant="uploading">Đang Upload</Badge>;
      case 'queued':
        return <Badge variant="queued">Trong Hàng Đợi</Badge>;
      case 'captcha_required':
        return <Badge variant="captcha">Cần Giải Captcha</Badge>;
      case 'manual_session':
        return <Badge variant="manual">Trình Duyệt Mở</Badge>;
      case 'error':
        return <Badge variant="error">Gặp Lỗi</Badge>;
      default:
        return <Badge variant="idle">Sẵn Sàng</Badge>;
    }
  };

  return (
    <div className="group relative rounded-xl border border-zinc-800/80 bg-zinc-900/40 hover:bg-zinc-900/70 p-5 transition-all duration-200 hover:border-zinc-700/80 hover:shadow-xl hover:shadow-black/40">
      {/* Header card */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-bold text-base text-zinc-100 group-hover:text-white">{profile.name}</h3>
            {profile.group_name && profile.group_name !== 'Mặc định' && (
              <span className="inline-flex items-center gap-1 rounded-md bg-zinc-800/80 px-2 py-0.5 text-[11px] font-medium text-zinc-300 border border-zinc-700/50">
                <Users className="h-3 w-3 text-zinc-400" /> {profile.group_name}
              </span>
            )}
            {getStatusBadge()}
          </div>
          <div className="flex items-center gap-1.5 text-xs text-zinc-400 mt-1">
            {hasCookies ? (
              <span className="flex items-center gap-1 text-emerald-400">
                <CheckCircle2 className="h-3.5 w-3.5" /> Đã lưu phiên đăng nhập
              </span>
            ) : (
              <span className="flex items-center gap-1 text-amber-400">
                <AlertCircle className="h-3.5 w-3.5" /> Chưa lưu cookie (Bấm mở trình duyệt để login)
              </span>
            )}
          </div>
        </div>

        {/* Nút hành động phụ */}
        <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
          <button
            onClick={onViewLogs}
            title="Xem lịch sử đăng video"
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
          >
            <ListOrdered className="h-4 w-4" />
          </button>
          <button
            onClick={onEdit}
            title="Chỉnh sửa cấu hình"
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
          >
            <Edit2 className="h-4 w-4" />
          </button>
          <button
            onClick={onDelete}
            title="Xóa Profile"
            className="p-1.5 rounded-lg text-zinc-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Thông số cấu hình */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 py-3 border-y border-zinc-800/60 text-xs text-zinc-400 my-3">
        <div className="flex items-center gap-2 overflow-hidden">
          <Folder className="h-3.5 w-3.5 text-zinc-500 shrink-0" />
          <span className="truncate font-mono text-[11px]" title={profile.video_folder || 'Chưa chọn folder'}>
            {profile.video_folder || 'Chưa chọn folder video'}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Music className="h-3.5 w-3.5 text-rose-400 shrink-0" />
          <span className="truncate text-zinc-300">
            {profile.enable_music === 0
              ? 'Tắt chèn nhạc (Tiếng gốc)'
              : profile.music_mode === 'favorite_rotate'
                ? `Xoay vòng Favorites (${profile.music_volume} dB)`
                : `Favorites #${profile.favorite_index + 1} (${profile.music_volume} dB)`}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Calendar className="h-3.5 w-3.5 text-zinc-500 shrink-0" />
          <span className="truncate">
            {profile.schedule_mode === 'golden_hours'
              ? `Khung giờ: ${profile.golden_hours}`
              : profile.schedule_mode === 'auto_increment'
                ? `Nối tiếp (+${profile.schedule_interval}p)`
                : 'Đăng ngay lập tức'}
          </span>
        </div>

        <div className="flex items-center gap-2 overflow-hidden">
          <Globe className="h-3.5 w-3.5 text-zinc-500 shrink-0" />
          <span className="truncate font-mono text-[11px]">
            {profile.proxy ? profile.proxy.replace(/:[^:]*@/, ':***@') : 'IP Trực Tiếp (No Proxy)'}
          </span>
        </div>
      </div>

      {/* Nút hành động chính */}
      <div className="flex items-center gap-2.5 pt-2">
        <Button
          variant="secondary"
          size="sm"
          onClick={onOpenBrowser}
          className="flex-1 text-xs"
        >
          <ExternalLink className="h-3.5 w-3.5 mr-1 text-zinc-400" /> Mở Trình Duyệt
        </Button>

        <Button
          variant="tiktok"
          size="sm"
          onClick={onRunUpload}
          disabled={isRunning || !profile.video_folder}
          className="flex-1 text-xs font-semibold"
        >
          <Play className="h-3.5 w-3.5 mr-1 fill-current" />
          {isRunning ? 'Đang Xử Lý...' : 'Bắt Đầu Upload'}
        </Button>
      </div>
    </div>
  );
};
