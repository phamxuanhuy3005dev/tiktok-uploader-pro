import React from 'react';
import {
  Globe,
  Folder,
  ExternalLink,
  Play,
  Edit2,
  Trash2,
  ListOrdered,
  CheckCircle2,
  AlertCircle,
  Users,
  KeyRound,
  Mail
} from 'lucide-react';
import { Badge } from './ui/Badge';
import { Button } from './ui/Button';

interface ProfileCardProps {
  profile: any;
  isSelected?: boolean;
  onToggleSelect?: (selected: boolean) => void;
  onEdit: () => void;
  onDelete: () => void;
  onOpenBrowser: () => void;
  onRunUpload: () => void;
  onViewLogs: () => void;
  isRunning: boolean;
}

export const ProfileCard: React.FC<ProfileCardProps> = ({
  profile,
  isSelected = false,
  onToggleSelect,
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
    <div
      className={`group relative rounded-2xl border transition-all duration-200 p-4 flex flex-col justify-between ${
        isSelected
          ? 'bg-sky-50/40 border-sky-400 ring-2 ring-sky-500/20 shadow-md'
          : 'bg-white border-slate-200/90 hover:border-sky-300 hover:shadow-md'
      }`}
    >
      {/* Top Header: Checkbox + Name + Status + Action Buttons */}
      <div>
        <div className="flex items-start justify-between gap-2 mb-2.5">
          {/* Left: Checkbox & Name */}
          <div className="flex items-start gap-2.5 min-w-0 flex-1">
            {onToggleSelect && (
              <input
                type="checkbox"
                checked={isSelected}
                onChange={(e) => onToggleSelect(e.target.checked)}
                className="mt-1 h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500/20 cursor-pointer shrink-0"
              />
            )}

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h3
                  className="font-bold text-sm text-slate-800 group-hover:text-sky-700 transition-colors truncate max-w-[200px] sm:max-w-[220px]"
                  title={profile.name}
                >
                  {profile.name}
                </h3>
                {profile.group_name && profile.group_name !== 'Mặc định' && (
                  <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600 border border-slate-200/70 shrink-0">
                    <Users className="h-2.5 w-2.5 text-slate-400" /> {profile.group_name}
                  </span>
                )}
                {getStatusBadge()}
              </div>

              {/* Account / Email info nếu có */}
              {(profile.account_id || profile.email) && (
                <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-0.5 font-mono truncate">
                  {profile.account_id && (
                    <span className="inline-flex items-center gap-1 truncate" title={`TikTok ID: ${profile.account_id}`}>
                      <KeyRound className="h-3 w-3 text-sky-500 shrink-0" />
                      <span className="truncate">{profile.account_id}</span>
                    </span>
                  )}
                  {profile.email && (
                    <span className="inline-flex items-center gap-1 truncate" title={`Email: ${profile.email}`}>
                      <Mail className="h-3 w-3 text-slate-400 shrink-0" />
                      <span className="truncate">{profile.email}</span>
                    </span>
                  )}
                </div>
              )}

              {/* Login session status */}
              <div className="flex items-center gap-1.5 text-[11px] mt-1">
                {hasCookies ? (
                  <span className="flex items-center gap-1 text-emerald-600 font-medium">
                    <CheckCircle2 className="h-3 w-3" /> Đã lưu phiên đăng nhập
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-amber-600 font-medium">
                    <AlertCircle className="h-3 w-3" /> Chưa lưu cookie
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Right: Action icons - Fixed shrink-0 to prevent overflowing */}
          <div className="flex items-center gap-0.5 shrink-0 bg-slate-50 p-1 rounded-lg border border-slate-100">
            <button
              onClick={onViewLogs}
              title="Xem lịch sử đăng video"
              className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-white transition-colors"
            >
              <ListOrdered className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={onEdit}
              title="Chỉnh sửa cấu hình & tài khoản"
              className="p-1.5 rounded-md text-slate-400 hover:text-sky-600 hover:bg-white transition-colors"
            >
              <Edit2 className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={onDelete}
              title="Xóa Profile"
              className="p-1.5 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Configuration specs grid: Chỉ giữ lại Folder & Proxy theo yêu cầu */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 py-2.5 border-y border-slate-100 text-xs text-slate-600 my-2">
          <div className="flex items-center gap-1.5 overflow-hidden">
            <Folder className={`h-3.5 w-3.5 shrink-0 ${profile.video_folder ? 'text-sky-500' : 'text-amber-500'}`} />
            <span
              className={`truncate font-mono text-[11px] ${
                profile.video_folder ? 'text-slate-700 font-medium' : 'text-amber-600 font-bold bg-amber-50 px-1 py-0.5 rounded border border-amber-200'
              }`}
              title={profile.video_folder || 'Chưa gán thư mục video!'}
            >
              {profile.video_folder
                ? profile.video_folder.split(/[/\\]/).filter(Boolean).pop() || profile.video_folder
                : '⚠️ Chưa chọn folder'}
            </span>
          </div>

          <div className="flex items-center gap-1.5 overflow-hidden">
            <Globe className="h-3.5 w-3.5 text-slate-400 shrink-0" />
            <span className="truncate font-mono text-[11px] text-slate-500" title={profile.proxy || 'Direct'}>
              {profile.proxy ? profile.proxy.replace(/:[^:]*@/, ':***@') : 'Direct (No Proxy)'}
            </span>
          </div>
        </div>
      </div>

      {/* Bottom Main Action Buttons */}
      <div className="flex items-center gap-2 pt-1 mt-1">
        <Button
          variant="outline"
          size="sm"
          onClick={onOpenBrowser}
          className="flex-1 text-xs text-slate-700 border-slate-200 hover:bg-slate-50"
        >
          <ExternalLink className="h-3.5 w-3.5 mr-1 text-slate-400" /> Mở Trình Duyệt
        </Button>

        <Button
          variant="tiktok"
          size="sm"
          onClick={onRunUpload}
          disabled={isRunning || !profile.video_folder}
          className="flex-1 text-xs font-semibold bg-sky-500 hover:bg-sky-600 shadow-sm shadow-sky-500/20 text-white"
        >
          <Play className="h-3.5 w-3.5 mr-1 fill-current" />
          {isRunning ? 'Đang Xử Lý...' : 'Upload'}
        </Button>
      </div>
    </div>
  );
};
