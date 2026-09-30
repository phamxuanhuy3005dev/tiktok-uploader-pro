import React, { useState } from 'react';
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
  ShieldCheck,
  Loader2,
  X
} from 'lucide-react';
import { Badge } from './ui/Badge';
import { Button } from './ui/Button';
import { toast } from 'sonner';

interface ProfileCardProps {
  profile: any;
  isSelected?: boolean;
  onToggleSelect?: (selected: boolean) => void;
  onEdit: () => void;
  onDelete: () => void;
  onOpenBrowser: () => void;
  onCloseBrowser?: () => void;
  onRunUpload: () => void;
  onViewLogs: () => void;
  onQuickSelectFolder?: () => void;
  isRunning: boolean;
  isOpeningBrowser?: boolean;
  isProcessing?: boolean;
}

export const ProfileCard: React.FC<ProfileCardProps> = ({
  profile,
  isSelected = false,
  onToggleSelect,
  onEdit,
  onDelete,
  onOpenBrowser,
  onCloseBrowser,
  onRunUpload,
  onViewLogs,
  onQuickSelectFolder,
  isRunning,
  isOpeningBrowser = false,
  isProcessing = false
}) => {
  const [isGettingOtp, setIsGettingOtp] = useState(false);
  const isLoggedIn = Boolean(
    profile.cookies && /sessionid|sessionid_ss|sid_tt/i.test(profile.cookies)
  );

  const handleCopyOtp = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!profile.two_factor) return;
    setIsGettingOtp(true);
    try {
      const res = await window.api.get2FaCode(profile.two_factor);
      if (res && res.otp) {
        await navigator.clipboard.writeText(res.otp);
        toast.success(`Mã 2FA của "${profile.name}": ${res.otp} (Đã copy, còn ${res.remainingSec}s)`, {
          icon: '🔐'
        });
      } else {
        toast.error('Mã bí mật 2FA không hợp lệ!');
      }
    } catch (err: any) {
      toast.error(`Lỗi lấy mã 2FA: ${err.message}`);
    } finally {
      setIsGettingOtp(false);
    }
  };

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
      className={`group relative rounded-xl border transition-all duration-150 p-3 sm:p-3.5 flex flex-col justify-between ${
        isSelected
          ? 'bg-sky-50/50 border-sky-400 ring-2 ring-sky-500/20 shadow-sm'
          : 'bg-white border-slate-200/80 hover:border-sky-300 hover:shadow-md'
      }`}
    >
      <div>
        {/* Row 1: Checkbox + Name + Group Tag + Action Icons */}
        <div className="flex items-center justify-between gap-1.5 mb-1.5">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            {onToggleSelect && (
              <input
                type="checkbox"
                checked={isSelected}
                onChange={(e) => onToggleSelect(e.target.checked)}
                className="h-3.5 w-3.5 rounded border-slate-300 text-sky-600 focus:ring-sky-500/20 cursor-pointer shrink-0"
              />
            )}
            <h3
              className="font-bold text-xs sm:text-sm text-slate-800 group-hover:text-sky-700 transition-colors truncate"
              title={profile.name}
            >
              {profile.name}
            </h3>
            {profile.group_name && profile.group_name !== 'Mặc định' && (
              <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600 border border-slate-200/60 shrink-0">
                <Users className="h-2.5 w-2.5 text-slate-400" /> {profile.group_name}
              </span>
            )}
          </div>

          {/* Action icons */}
          <div className="flex items-center gap-0.5 shrink-0 bg-slate-50/80 p-0.5 rounded-lg border border-slate-100">
            <button
              onClick={onViewLogs}
              title="Xem lịch sử đăng video"
              className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-white transition-colors"
            >
              <ListOrdered className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={onEdit}
              title="Chỉnh sửa cấu hình & tài khoản"
              className="p-1 rounded text-slate-400 hover:text-sky-600 hover:bg-white transition-colors"
            >
              <Edit2 className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={onDelete}
              disabled={isProcessing}
              title="Xóa Profile"
              className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Row 2: Status Badge + Login Session + (Optional Account ID) + Max Videos Limit */}
        <div className="flex items-center gap-1.5 flex-wrap text-[11px] mb-2">
          {getStatusBadge()}

          {isLoggedIn ? (
            <span className="inline-flex items-center gap-1 text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-200/60 px-1.5 py-0.5 rounded-full font-medium shrink-0">
              <CheckCircle2 className="h-3 w-3 text-emerald-600" /> Đã đăng nhập
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[10px] text-amber-700 bg-amber-50 border border-amber-200/60 px-1.5 py-0.5 rounded-full font-medium shrink-0">
              <AlertCircle className="h-3 w-3 text-amber-500" /> Chưa login
            </span>
          )}

          {profile.two_factor && (
            <button
              type="button"
              onClick={handleCopyOtp}
              disabled={isGettingOtp}
              title="Nhấn để lấy mã 2FA OTP 6 số (tự động copy vào clipboard)"
              className="inline-flex items-center gap-1 text-[10px] text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200/80 px-1.5 py-0.5 rounded-full font-semibold transition-colors cursor-pointer shrink-0"
            >
              {isGettingOtp ? (
                <Loader2 className="h-2.5 w-2.5 animate-spin text-purple-600" />
              ) : (
                <ShieldCheck className="h-2.5 w-2.5 text-purple-600" />
              )}
              <span>2FA OTP</span>
            </button>
          )}

          {profile.account_id && profile.account_id !== profile.name && (
            <span
              className="inline-flex items-center gap-1 text-[10px] text-slate-500 font-mono truncate max-w-[110px]"
              title={`ID: ${profile.account_id}`}
            >
              <KeyRound className="h-2.5 w-2.5 text-slate-400 shrink-0" />
              <span className="truncate">{profile.account_id}</span>
            </span>
          )}

          <span
            className="text-[10px] text-slate-500 ml-auto font-mono bg-slate-50 px-1.5 py-0.5 rounded border border-slate-200/70 shrink-0"
            title="Số video tối đa upload mỗi lần"
          >
            Tối đa: <strong className="text-sky-700">{profile.max_videos !== undefined && profile.max_videos > 0 ? `${profile.max_videos} vid` : 'Hết'}</strong>
          </span>
        </div>

        {/* Row 3: Folder & Proxy specs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 py-2 border-y border-slate-100/90 text-xs text-slate-600 mb-2">
          <div
            onClick={(e) => {
              e.stopPropagation();
              onQuickSelectFolder?.();
            }}
            className="flex items-center gap-1.5 overflow-hidden cursor-pointer hover:bg-sky-50/80 p-0.5 rounded transition-all group/folder"
            title="Bấm để chọn nhanh thư mục video cho kênh này"
          >
            <Folder className={`h-3.5 w-3.5 shrink-0 ${profile.video_folder ? 'text-sky-500' : 'text-amber-500 group-hover/folder:scale-110'} transition-transform`} />
            <span
              className={`truncate font-mono text-[11px] ${
                profile.video_folder
                  ? 'text-slate-700 font-medium group-hover/folder:text-sky-600'
                  : 'text-amber-600 font-semibold bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 group-hover/folder:border-amber-300'
              }`}
              title={profile.video_folder || 'Bấm để gán thư mục video!'}
            >
              {profile.video_folder
                ? profile.video_folder.split(/[/\\]/).filter(Boolean).pop() || profile.video_folder
                : '⚠️ Chọn folder...'}
            </span>
          </div>

          <div className="flex items-center gap-1.5 overflow-hidden">
            <Globe className="h-3.5 w-3.5 text-slate-400 shrink-0" />
            <span className="truncate font-mono text-[11px] text-slate-500" title={profile.proxy || 'Direct (No Proxy)'}>
              {profile.proxy ? profile.proxy.replace(/:[^:]*@/, ':***@') : 'Direct (No Proxy)'}
            </span>
          </div>
        </div>
      </div>

      {/* Row 4: Action Buttons */}
      <div className="flex items-center gap-2 pt-0.5">
        {profile.status === 'manual_session' ? (
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={onOpenBrowser}
              disabled={isOpeningBrowser}
              title="Trình duyệt đang mở - Bấm để chuyển cửa sổ lên trước màn hình"
              className="flex-1 h-7 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border-emerald-200 rounded-lg truncate shadow-none"
            >
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse mr-1.5 shrink-0" />
              <span className="truncate">Đang Mở</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onCloseBrowser}
              title="Đóng cửa sổ trình duyệt của profile này"
              className="flex-1 h-7 text-xs font-medium text-rose-600 bg-rose-50 hover:bg-rose-100 border-rose-200 rounded-lg truncate shadow-none"
            >
              <X className="h-3.5 w-3.5 mr-1 text-rose-500 shrink-0" />
              <span className="truncate">Đóng Chrome</span>
            </Button>
          </>
        ) : (
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={onOpenBrowser}
              disabled={isOpeningBrowser || isRunning}
              className="flex-1 h-7 text-xs text-slate-700 border-slate-200 hover:bg-slate-50 rounded-lg disabled:opacity-50 truncate"
            >
              {isOpeningBrowser ? (
                <Loader2 className="h-3 w-3 mr-1 text-sky-500 animate-spin shrink-0" />
              ) : (
                <ExternalLink className="h-3 w-3 mr-1 text-slate-400 shrink-0" />
              )}
              <span className="truncate">{isOpeningBrowser ? 'Đang Mở...' : 'Mở Trình Duyệt'}</span>
            </Button>

            <Button
              variant="tiktok"
              size="sm"
              onClick={onRunUpload}
              disabled={isRunning || isProcessing || !profile.video_folder}
              className="flex-1 h-7 text-xs font-semibold bg-sky-500 hover:bg-sky-600 shadow-sm shadow-sky-500/20 text-white rounded-lg disabled:opacity-50 truncate"
            >
              {isRunning ? (
                <Loader2 className="h-3 w-3 mr-1 animate-spin shrink-0" />
              ) : (
                <Play className="h-3 w-3 mr-1 fill-current shrink-0" />
              )}
              <span className="truncate">{isRunning ? 'Đang Xử Lý...' : 'Upload'}</span>
            </Button>
          </>
        )}
      </div>
    </div>
  );
};
