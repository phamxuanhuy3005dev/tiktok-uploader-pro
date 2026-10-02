import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Edit2,
  ExternalLink,
  Folder,
  Globe,
  KeyRound,
  ListOrdered,
  Loader2,
  Play,
  ShieldCheck,
  Trash2,
  Users,
  X,
} from "lucide-react";
import React, { useState } from "react";
import { toast } from "sonner";
import { getCooldownStatus } from "../utils/cooldown";
import { Badge } from "./ui/Badge";
import { Button } from "./ui/Button";
import { Checkbox } from "./ui/Checkbox";

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
  isProcessing = false,
}) => {
  const [isGettingOtp, setIsGettingOtp] = useState(false);
  const cooldown = getCooldownStatus(profile.last_run, profile.group_name);

  const isLoggedIn = Boolean(
    profile.cookies && /sessionid|sessionid_ss|sid_tt/i.test(profile.cookies),
  );

  const handleUploadWithCooldownCheck = () => {
    onRunUpload();
  };

  const handleCopyOtp = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!profile.two_factor) return;
    setIsGettingOtp(true);
    try {
      const res = await window.api.get2FaCode(profile.two_factor);
      if (res && res.otp) {
        await navigator.clipboard.writeText(res.otp);
        toast.success(
          `Mã 2FA của "${profile.name}": ${res.otp} (Đã copy, còn ${res.remainingSec}s)`,
          {
            icon: "🔐",
          },
        );
      } else {
        toast.error("Mã bí mật 2FA không hợp lệ!");
      }
    } catch (err: any) {
      toast.error(`Lỗi lấy mã 2FA: ${err.message}`);
    } finally {
      setIsGettingOtp(false);
    }
  };

  const getStatusBadge = () => {
    switch (profile.status) {
      case "uploading":
        return <Badge variant="uploading">Đang Upload</Badge>;
      case "queued":
        return <Badge variant="queued">Trong Hàng Đợi</Badge>;
      case "captcha_required":
        return <Badge variant="captcha">Cần Giải Captcha</Badge>;
      case "manual_session":
        return <Badge variant="manual">Trình Duyệt Mở</Badge>;
      case "error":
        return <Badge variant="error">Gặp Lỗi</Badge>;
      default:
        return <Badge variant="idle">Sẵn Sàng</Badge>;
    }
  };

  return (
    <div
      className={`group relative flex flex-col justify-between rounded-xl border p-3 transition-all duration-150 sm:p-3.5 ${
        isSelected
          ? "border-sky-400 bg-sky-50/50 shadow-sm ring-2 ring-sky-500/20"
          : "border-slate-200/80 bg-white hover:border-sky-300 hover:shadow-md"
      }`}
    >
      <div>
        {/* Row 1: Checkbox + Name + Group Tag + Action Icons */}
        <div className="mb-1.5 flex items-center justify-between gap-1.5">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            {onToggleSelect && (
              <Checkbox
                checked={isSelected}
                onCheckedChange={(checked) => onToggleSelect(Boolean(checked))}
                className="shrink-0 cursor-pointer"
              />
            )}
            <h3
              className="truncate text-xs font-bold text-slate-800 transition-colors group-hover:text-sky-700 sm:text-sm"
              title={profile.name}
            >
              {profile.name}
            </h3>
            {profile.group_name && profile.group_name !== "Mặc định" && (
              <span className="inline-flex shrink-0 items-center gap-1 rounded border border-slate-200/60 bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">
                <Users className="h-2.5 w-2.5 text-slate-400" />{" "}
                {profile.group_name}
              </span>
            )}
          </div>

          {/* Action icons */}
          <div className="flex shrink-0 items-center gap-0.5 rounded-lg border border-slate-100 bg-slate-50/80 p-0.5">
            <button
              onClick={onViewLogs}
              title="Xem lịch sử đăng video"
              className="rounded p-1 text-slate-400 transition-colors hover:bg-white hover:text-slate-700"
            >
              <ListOrdered className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={onEdit}
              title="Chỉnh sửa cấu hình & tài khoản"
              className="rounded p-1 text-slate-400 transition-colors hover:bg-white hover:text-sky-600"
            >
              <Edit2 className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={onDelete}
              disabled={isProcessing}
              title="Xóa Profile"
              className="rounded p-1 text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Row 2: Status Badge + Login Session + (Optional Account ID) + Max Videos Limit */}
        <div className="mb-2 flex flex-wrap items-center gap-1.5 text-[11px]">
          {getStatusBadge()}

          {isLoggedIn ? (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-emerald-200/60 bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700">
              <CheckCircle2 className="h-3 w-3 text-emerald-600" /> Đã đăng nhập
            </span>
          ) : (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-amber-200/60 bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
              <AlertCircle className="h-3 w-3 text-amber-500" /> Chưa login
            </span>
          )}

          {/* Huy hiệu 24h Cooldown cho Kênh Nuôi */}
          {cooldown.isNurturing &&
            (cooldown.isUnderCooldown ? (
              <span
                className="inline-flex shrink-0 items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800"
                title={`Kênh nuôi cần cách nhau 24h. Lần chạy cuối: ${cooldown.lastRunFormatted}. Còn ${cooldown.remainingText}`}
              >
                <Clock className="h-2.5 w-2.5 animate-pulse text-amber-600" />
                <span>Chờ 24h: Còn {cooldown.remainingText}</span>
              </span>
            ) : (
              <span
                className="inline-flex shrink-0 items-center gap-1 rounded-full border border-emerald-300 bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-800"
                title={`Đã đủ 24h kể từ lần chạy trước (${cooldown.lastRunFormatted}). Kênh sẵn sàng đăng an toàn!`}
              >
                <CheckCircle2 className="h-2.5 w-2.5 text-emerald-600" />
                <span>Đã đủ 24h</span>
              </span>
            ))}

          {profile.two_factor && (
            <button
              type="button"
              onClick={handleCopyOtp}
              disabled={isGettingOtp}
              title="Nhấn để lấy mã 2FA OTP 6 số (tự động copy vào clipboard)"
              className="inline-flex shrink-0 cursor-pointer items-center gap-1 rounded-full border border-purple-200/80 bg-purple-50 px-1.5 py-0.5 text-[10px] font-semibold text-purple-700 transition-colors hover:bg-purple-100"
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
              className="inline-flex max-w-[110px] items-center gap-1 truncate font-mono text-[10px] text-slate-500"
              title={`ID: ${profile.account_id}`}
            >
              <KeyRound className="h-2.5 w-2.5 shrink-0 text-slate-400" />
              <span className="truncate">{profile.account_id}</span>
            </span>
          )}

          <span
            className="ml-auto shrink-0 rounded border border-slate-200/70 bg-slate-50 px-1.5 py-0.5 font-mono text-[10px] text-slate-500"
            title="Số video tối đa upload mỗi lần"
          >
            Tối đa:{" "}
            <strong className="text-sky-700">
              {profile.max_videos !== undefined && profile.max_videos > 0
                ? `${profile.max_videos} vid`
                : "Hết"}
            </strong>
          </span>
        </div>

        {/* Row 3: Folder & Proxy specs */}
        <div className="mb-2 grid grid-cols-1 gap-1.5 border-y border-slate-100/90 py-2 text-xs text-slate-600 sm:grid-cols-2">
          <div
            onClick={(e) => {
              e.stopPropagation();
              onQuickSelectFolder?.();
            }}
            className="group/folder flex cursor-pointer items-center gap-1.5 overflow-hidden rounded p-0.5 transition-all hover:bg-sky-50/80"
            title="Bấm để chọn nhanh thư mục video cho kênh này"
          >
            <Folder
              className={`h-3.5 w-3.5 shrink-0 ${profile.video_folder ? "text-sky-500" : "text-amber-500 group-hover/folder:scale-110"} transition-transform`}
            />
            <span
              className={`truncate font-mono text-[11px] ${
                profile.video_folder
                  ? "font-medium text-slate-700 group-hover/folder:text-sky-600"
                  : "rounded border border-amber-200 bg-amber-50 px-1.5 py-0.5 font-semibold text-amber-600 group-hover/folder:border-amber-300"
              }`}
              title={profile.video_folder || "Bấm để gán thư mục video!"}
            >
              {profile.video_folder
                ? profile.video_folder.split(/[/\\]/).filter(Boolean).pop() ||
                  profile.video_folder
                : "⚠️ Chọn folder..."}
            </span>
          </div>

          <div className="flex items-center gap-1.5 overflow-hidden">
            <Globe className="h-3.5 w-3.5 shrink-0 text-slate-400" />
            <span
              className="truncate font-mono text-[11px] text-slate-500"
              title={profile.proxy || "Direct (No Proxy)"}
            >
              {profile.proxy
                ? profile.proxy.replace(/:[^:]*@/, ":***@")
                : "Direct (No Proxy)"}
            </span>
          </div>
        </div>
      </div>

      {/* Row 4: Action Buttons */}
      <div className="flex items-center gap-2 pt-0.5">
        {profile.status === "manual_session" ? (
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={onOpenBrowser}
              disabled={isOpeningBrowser}
              title="Trình duyệt đang mở - Bấm để chuyển cửa sổ lên trước màn hình"
              className="h-7 flex-1 truncate rounded-lg border-emerald-200 bg-emerald-50 text-xs font-semibold text-emerald-700 shadow-none hover:bg-emerald-100"
            >
              <span className="mr-1.5 h-2 w-2 shrink-0 animate-pulse rounded-full bg-emerald-500" />
              <span className="truncate">Đang Mở</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onCloseBrowser}
              title="Đóng cửa sổ trình duyệt của profile này"
              className="h-7 flex-1 truncate rounded-lg border-rose-200 bg-rose-50 text-xs font-medium text-rose-600 shadow-none hover:bg-rose-100"
            >
              <X className="mr-1 h-3.5 w-3.5 shrink-0 text-rose-500" />
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
              className="h-7 flex-1 truncate rounded-lg border-slate-200 text-xs text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              {isOpeningBrowser ? (
                <Loader2 className="mr-1 h-3 w-3 shrink-0 animate-spin text-sky-500" />
              ) : (
                <ExternalLink className="mr-1 h-3 w-3 shrink-0 text-slate-400" />
              )}
              <span className="truncate">
                {isOpeningBrowser ? "Đang Mở..." : "Mở Trình Duyệt"}
              </span>
            </Button>

            <Button
              variant="tiktok"
              size="sm"
              onClick={handleUploadWithCooldownCheck}
              disabled={isRunning || isProcessing || !profile.video_folder}
              className="h-7 flex-1 truncate rounded-lg bg-sky-500 text-xs font-semibold text-white shadow-sm shadow-sky-500/20 hover:bg-sky-600 disabled:opacity-50"
            >
              {isRunning ? (
                <Loader2 className="mr-1 h-3 w-3 shrink-0 animate-spin" />
              ) : (
                <Play className="mr-1 h-3 w-3 shrink-0 fill-current" />
              )}
              <span className="truncate">
                {isRunning ? "Đang Xử Lý..." : "Upload"}
              </span>
            </Button>
          </>
        )}
      </div>
    </div>
  );
};
