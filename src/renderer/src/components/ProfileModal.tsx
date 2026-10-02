import {
  AlertTriangle,
  Calendar,
  Copy,
  Folder,
  Globe,
  KeyRound,
  Mail,
  Music,
  ShieldCheck,
  Users,
} from "lucide-react";
import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "./ui/Button";
import { Checkbox } from "./ui/Checkbox";
import { Input } from "./ui/Input";
import { Modal } from "./ui/Modal";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/Select";
import { cn } from "../lib/utils";

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: any) => Promise<void>;
  initialData?: any;
  availableGroups?: string[];
}

export const ProfileModal: React.FC<ProfileModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialData,
  availableGroups = [],
}) => {
  const [name, setName] = useState("");
  const [groupName, setGroupName] = useState("Mặc định");
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [newGroupInput, setNewGroupInput] = useState("");
  const [videoFolder, setVideoFolder] = useState("");
  const [accountId, setAccountId] = useState("");
  const [pass, setPass] = useState("");
  const [twoFactor, setTwoFactor] = useState("");
  const [otpResult, setOtpResult] = useState<{
    otp: string;
    remainingSec: number;
  } | null>(null);
  const [isGettingOtp, setIsGettingOtp] = useState(false);
  const [email, setEmail] = useState("");
  const [passEmail, setPassEmail] = useState("");
  const [mailAo, setMailAo] = useState("");
  const [enableMusic, setEnableMusic] = useState(true);
  const [musicMode, setMusicMode] = useState<
    "favorite_single" | "favorite_rotate"
  >("favorite_rotate");
  const [favoriteIndex, setFavoriteIndex] = useState(0);
  const [musicVolume, setMusicVolume] = useState(-50);
  const [scheduleMode, setScheduleMode] = useState<
    "immediate" | "auto_increment" | "golden_hours"
  >("auto_increment");
  const [scheduleInterval, setScheduleInterval] = useState(10);
  const [goldenHours, setGoldenHours] = useState("11:30,17:30,20:00");
  const [proxy, setProxy] = useState("");
  const [cookies, setCookies] = useState("");
  const [allowEditSecurity, setAllowEditSecurity] = useState(!initialData);
  const [loading, setLoading] = useState(false);
  const [isTestingProxy, setIsTestingProxy] = useState(false);
  const [proxyTestResult, setProxyTestResult] = useState<{
    success: boolean;
    ip?: string;
    latencyMs?: number;
    error?: string;
  } | null>(null);

  const handleCopyField = (text: string, label: string) => {
    if (!text || !text.trim()) {
      toast.warning(`Chưa có thông tin ${label} để copy!`);
      return;
    }
    navigator.clipboard.writeText(text.trim());
    toast.success(`Đã copy ${label}: ${text.trim()}`);
  };

  const handleGenerateOtp = async () => {
    if (!twoFactor.trim()) {
      toast.warning("Vui lòng nhập mã bí mật 2FA trước!");
      return;
    }
    setIsGettingOtp(true);
    try {
      const res = await window.api.get2FaCode(twoFactor.trim());
      if (res && res.otp) {
        setOtpResult(res);
        await navigator.clipboard.writeText(res.otp);
        toast.success(
          `Đã tạo mã OTP: ${res.otp} (Đã copy, còn ${res.remainingSec}s)!`,
        );
      } else {
        toast.error("Mã 2FA không hợp lệ (cần chuỗi Base32 chuẩn RFC 6238)!");
      }
    } catch (err: any) {
      toast.error(`Lỗi tạo mã OTP: ${err.message}`);
    } finally {
      setIsGettingOtp(false);
    }
  };

  const handleTestProxy = async () => {
    if (!proxy.trim()) return;
    setIsTestingProxy(true);
    setProxyTestResult(null);
    try {
      const res = await window.api.testProxy(proxy.trim());
      setProxyTestResult(res);
    } catch (err: any) {
      setProxyTestResult({
        success: false,
        error: err.message || "Lỗi khi kiểm tra proxy",
      });
    } finally {
      setIsTestingProxy(false);
    }
  };

  useEffect(() => {
    setProxyTestResult(null);
    setIsCreatingGroup(false);
    setNewGroupInput("");
    if (initialData) {
      setName(initialData.name || "");
      setGroupName(initialData.group_name || "Mặc định");
      setVideoFolder(initialData.video_folder || "");
      setAccountId(initialData.account_id || "");
      setPass(initialData.pass || "");
      setTwoFactor(initialData.two_factor || "");
      setOtpResult(null);
      setEmail(initialData.email || "");
      setPassEmail(initialData.pass_email || "");
      setMailAo(initialData.mail_ao || "");
      setCookies(initialData.cookies || "");
      setEnableMusic(initialData.enable_music !== 0);
      setMusicMode(initialData.music_mode || "favorite_rotate");
      setFavoriteIndex(initialData.favorite_index ?? 0);
      setMusicVolume(initialData.music_volume ?? -50);
      setScheduleMode(initialData.schedule_mode || "auto_increment");
      setScheduleInterval(initialData.schedule_interval ?? 10);
      setGoldenHours(initialData.golden_hours || "11:30,17:30,20:00");
      setProxy(initialData.proxy || "");
      setAllowEditSecurity(false);
    } else {
      setName("");
      setGroupName("Mặc định");
      setVideoFolder("");
      setAccountId("");
      setPass("");
      setTwoFactor("");
      setOtpResult(null);
      setEmail("");
      setPassEmail("");
      setMailAo("");
      setCookies("");
      setEnableMusic(true);
      setMusicMode("favorite_rotate");
      setFavoriteIndex(0);
      setMusicVolume(-50);
      setScheduleMode("auto_increment");
      setScheduleInterval(10);
      setGoldenHours("11:30,17:30,20:00");
      setProxy("");
      setAllowEditSecurity(true);
    }
  }, [initialData, isOpen]);

  const handleSelectFolder = async () => {
    try {
      const selected = await window.api.selectFolder();
      if (selected) setVideoFolder(selected);
    } catch (_) {}
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setLoading(true);
    try {
      await onSave({
        id: initialData?.id || `profile_${Date.now()}`,
        name: name.trim(),
        group_name: groupName.trim() || "Mặc định",
        video_folder: videoFolder.trim(),
        account_id: accountId.trim() || null,
        pass: pass.trim() || null,
        two_factor: twoFactor.trim() || null,
        email: email.trim() || null,
        pass_email: passEmail.trim() || null,
        mail_ao: mailAo.trim() || null,
        cookies: cookies.trim() || null,
        enable_music: enableMusic ? 1 : 0,
        music_mode: musicMode,
        favorite_index: Number(favoriteIndex) || 0,
        music_volume: Number(musicVolume) || -50,
        schedule_mode: scheduleMode,
        schedule_interval: Number(scheduleInterval) || 10,
        golden_hours: goldenHours.trim(),
        proxy: proxy.trim() || null,
        status: initialData?.status || "idle",
        last_run: initialData?.last_run || null,
      });
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        initialData
          ? `Chỉnh Sửa Profile: ${initialData.name}`
          : "Thêm Profile Mới"
      }
      description="Cấu hình tài khoản, nhóm kênh, thông tin đăng nhập, chèn nhạc và lên lịch."
      className="max-w-2xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* 1. Tên & Nhóm Kênh */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-700">
              Tên Profile (Định danh kênh)
            </label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="ví dụ: devyfunkk, juliapiper_paz"
              required
            />
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between">
              <label className="block flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-700">
                <Users className="h-3.5 w-3.5 text-slate-400" /> Nhóm Kênh
                (Group)
              </label>
              {!isCreatingGroup && (
                <button
                  type="button"
                  onClick={() => setIsCreatingGroup(true)}
                  className="text-[11px] font-semibold text-sky-600 hover:text-sky-700 hover:underline"
                >
                  + Thêm nhóm mới
                </button>
              )}
            </div>

            {isCreatingGroup ? (
              <div className="flex gap-1.5">
                <Input
                  autoFocus
                  value={newGroupInput}
                  onChange={(e) => setNewGroupInput(e.target.value)}
                  placeholder="Nhập tên nhóm mới..."
                  className="h-8 flex-1 text-xs"
                />
                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    const trimmed = newGroupInput.trim();
                    if (trimmed) {
                      setGroupName(trimmed);
                      setIsCreatingGroup(false);
                      setNewGroupInput("");
                    }
                  }}
                  className="h-8 px-2.5 text-xs"
                >
                  OK
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setIsCreatingGroup(false);
                    setNewGroupInput("");
                  }}
                  className="h-8 px-2 text-xs"
                >
                  Hủy
                </Button>
              </div>
            ) : (
              <Select
                value={groupName}
                onValueChange={(val) => {
                  if (val === "__NEW__") {
                    setIsCreatingGroup(true);
                  } else {
                    setGroupName(val);
                  }
                }}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Chọn nhóm kênh" />
                </SelectTrigger>
                <SelectContent>
                  {Array.from(
                    new Set(["Mặc định", ...availableGroups, groupName]),
                  )
                    .filter(Boolean)
                    .map((g) => (
                      <SelectItem key={g} value={g}>
                        {g}
                      </SelectItem>
                    ))}
                  <SelectItem value="__NEW__">
                    + Nhập nhóm mới khác...
                  </SelectItem>
                </SelectContent>
              </Select>
            )}
            <p className="mt-1 flex items-center gap-1 text-[10px] text-slate-500">
              <span className="font-bold text-amber-600">💡 Mẹo:</span> Nhóm có
              từ{" "}
              <code className="rounded bg-amber-50 px-1 font-semibold text-amber-800">
                nuôi
              </code>
              ,{" "}
              <code className="rounded bg-amber-50 px-1 font-semibold text-amber-800">
                warmup
              </code>{" "}
              hoặc{" "}
              <code className="rounded bg-amber-50 px-1 font-semibold text-amber-800">
                mới
              </code>{" "}
              sẽ tự động bật bảo vệ Cooldown 24h.
            </p>
          </div>
        </div>

        {/* 2. Thông tin Tài Khoản & Mật Khẩu (Quản lý kênh) */}
        <div className="space-y-2.5 rounded-xl border border-slate-200 bg-slate-50/60 p-3.5">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/80 pb-2">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-800">
              <ShieldCheck className="h-4 w-4 text-sky-600" /> Thông Tin Tài
              Khoản & Bảo Mật
            </div>
            {initialData && (
              <label className="flex cursor-pointer select-none items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-1 shadow-sm transition-colors hover:bg-slate-50">
                <Checkbox
                  checked={allowEditSecurity}
                  onCheckedChange={(checked) =>
                    setAllowEditSecurity(Boolean(checked))
                  }
                />
                <span className="text-[11px] font-medium text-slate-700">
                  Cho phép chỉnh sửa thông tin bảo mật
                </span>
              </label>
            )}
          </div>

          {initialData && !allowEditSecurity && (
            <p className="flex items-center gap-1.5 rounded-lg border border-amber-200/60 bg-amber-50/80 px-2.5 py-1.5 text-[11px] text-amber-700">
              <span>🔒</span> Đang ở chế độ xem an toàn để tránh sửa nhầm. Tích
              chọn ô trên nếu bạn muốn chỉnh sửa. Bạn vẫn có thể bôi đen hoặc
              bấm nút <strong>Copy</strong> để sao chép thông tin.
            </p>
          )}

          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            <div>
              <div className="mb-0.5 flex items-center justify-between text-[11px] font-medium text-slate-600">
                <span className="flex items-center gap-1">
                  <KeyRound className="h-3 w-3 text-slate-400" /> Tài khoản
                  TikTok (Username / ID)
                </span>
                {accountId.trim() && (
                  <button
                    type="button"
                    onClick={() =>
                      handleCopyField(accountId, "Tài khoản TikTok")
                    }
                    className="flex items-center gap-1 text-[10px] font-semibold text-sky-600 hover:text-sky-700 hover:underline"
                  >
                    <Copy className="h-2.5 w-2.5" /> Copy
                  </button>
                )}
              </div>
              <Input
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                readOnly={!allowEditSecurity}
                placeholder="User / Phone / ID"
                className={cn(
                  "h-8 select-all text-xs",
                  !allowEditSecurity &&
                    "cursor-default bg-slate-100/90 text-slate-700 focus:border-slate-200 focus:ring-0",
                )}
              />
            </div>

            <div>
              <div className="mb-0.5 flex items-center justify-between text-[11px] font-medium text-slate-600">
                <span>Mật khẩu TikTok</span>
                {pass.trim() && (
                  <button
                    type="button"
                    onClick={() => handleCopyField(pass, "Mật khẩu TikTok")}
                    className="flex items-center gap-1 text-[10px] font-semibold text-sky-600 hover:text-sky-700 hover:underline"
                  >
                    <Copy className="h-2.5 w-2.5" /> Copy
                  </button>
                )}
              </div>
              <Input
                type="text"
                value={pass}
                onChange={(e) => setPass(e.target.value)}
                readOnly={!allowEditSecurity}
                placeholder="Mật khẩu TikTok"
                className={cn(
                  "h-8 select-all font-mono text-xs",
                  !allowEditSecurity &&
                    "cursor-default bg-slate-100/90 text-slate-700 focus:border-slate-200 focus:ring-0",
                )}
              />
            </div>

            {/* Mã 2FA (Authenticator App) */}
            <div className="rounded-xl border border-purple-100 bg-purple-50/50 p-2.5 sm:col-span-2">
              <div className="mb-1 flex items-center justify-between">
                <label className="block flex items-center gap-1.5 text-[11px] font-semibold text-purple-900">
                  <ShieldCheck className="h-3.5 w-3.5 text-purple-600" /> Mã 2FA
                  (Authenticator Secret Key / 2FA Live)
                </label>
                <div className="flex items-center gap-2">
                  {twoFactor.trim() && (
                    <button
                      type="button"
                      onClick={() => handleCopyField(twoFactor, "Khóa 2FA")}
                      className="flex items-center gap-1 text-[10px] font-semibold text-purple-700 hover:underline"
                    >
                      <Copy className="h-2.5 w-2.5" /> Copy Key
                    </button>
                  )}
                  {twoFactor.trim() && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleGenerateOtp}
                      disabled={isGettingOtp}
                      className="h-6 border-purple-200 bg-white px-2 text-[10px] text-purple-700 hover:bg-purple-100/70"
                    >
                      {isGettingOtp ? "Đang tạo..." : "🔑 Lấy mã OTP 6 số"}
                    </Button>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                <Input
                  type="text"
                  value={twoFactor}
                  onChange={(e) => {
                    setTwoFactor(e.target.value);
                    setOtpResult(null);
                  }}
                  readOnly={!allowEditSecurity}
                  placeholder="Ví dụ: JBSWY3DPEHPK3PXP (Mã bí mật dạng Base32 khi mua acc)"
                  className={cn(
                    "h-8 flex-1 select-all bg-white font-mono text-xs",
                    !allowEditSecurity &&
                      "cursor-default bg-slate-100/90 text-slate-700 focus:border-slate-200 focus:ring-0",
                  )}
                />
              </div>
              {otpResult && (
                <div className="mt-2 flex items-center justify-between rounded-lg border border-purple-200 bg-white px-3 py-1.5 text-xs">
                  <span className="text-slate-600">
                    Mã OTP hiện tại:{" "}
                    <strong className="ml-1 font-mono text-sm font-bold tracking-wider text-purple-700">
                      {otpResult.otp}
                    </strong>
                    <span className="ml-2 text-[10px] text-slate-400">
                      (Hết hạn sau: {otpResult.remainingSec}s)
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(otpResult.otp);
                      toast.success(`Đã copy mã OTP: ${otpResult.otp}`);
                    }}
                    className="flex items-center gap-1 text-[11px] font-medium text-purple-600 hover:text-purple-800"
                  >
                    <Copy className="h-3 w-3" /> Copy
                  </button>
                </div>
              )}
              <p className="mt-1 text-[10px] text-purple-600/80">
                * Dùng cho acc có định dạng <code>user|pass|2fa</code>. Bấm "Lấy
                mã OTP 6 số" để lấy mã đăng nhập tức thì mà không cần vào web
                2fa.live.
              </p>
            </div>

            <div>
              <div className="mb-0.5 flex items-center justify-between text-[11px] font-medium text-slate-600">
                <span className="flex items-center gap-1">
                  <Mail className="h-3 w-3 text-slate-400" /> Email đăng ký
                </span>
                {email.trim() && (
                  <button
                    type="button"
                    onClick={() => handleCopyField(email, "Email")}
                    className="flex items-center gap-1 text-[10px] font-semibold text-sky-600 hover:text-sky-700 hover:underline"
                  >
                    <Copy className="h-2.5 w-2.5" /> Copy
                  </button>
                )}
              </div>
              <Input
                type="text"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                readOnly={!allowEditSecurity}
                placeholder="example@outlook.com"
                className={cn(
                  "h-8 select-all text-xs",
                  !allowEditSecurity &&
                    "cursor-default bg-slate-100/90 text-slate-700 focus:border-slate-200 focus:ring-0",
                )}
              />
            </div>

            <div>
              <div className="mb-0.5 flex items-center justify-between text-[11px] font-medium text-slate-600">
                <span>Mật khẩu Email</span>
                {passEmail.trim() && (
                  <button
                    type="button"
                    onClick={() => handleCopyField(passEmail, "Mật khẩu Email")}
                    className="flex items-center gap-1 text-[10px] font-semibold text-sky-600 hover:text-sky-700 hover:underline"
                  >
                    <Copy className="h-2.5 w-2.5" /> Copy
                  </button>
                )}
              </div>
              <Input
                type="text"
                value={passEmail}
                onChange={(e) => setPassEmail(e.target.value)}
                readOnly={!allowEditSecurity}
                placeholder="Mật khẩu hòm thư"
                className={cn(
                  "h-8 select-all font-mono text-xs",
                  !allowEditSecurity &&
                    "cursor-default bg-slate-100/90 text-slate-700 focus:border-slate-200 focus:ring-0",
                )}
              />
            </div>

            <div className="sm:col-span-2">
              <div className="mb-0.5 flex items-center justify-between text-[11px] font-medium text-slate-600">
                <span>Mail ảo / Mail khôi phục</span>
                {mailAo.trim() && (
                  <button
                    type="button"
                    onClick={() => handleCopyField(mailAo, "Mail ảo")}
                    className="flex items-center gap-1 text-[10px] font-semibold text-sky-600 hover:text-sky-700 hover:underline"
                  >
                    <Copy className="h-2.5 w-2.5" /> Copy
                  </button>
                )}
              </div>
              <Input
                type="text"
                value={mailAo}
                onChange={(e) => setMailAo(e.target.value)}
                readOnly={!allowEditSecurity}
                placeholder="Mail ảo liên kết..."
                className={cn(
                  "h-8 select-all text-xs",
                  !allowEditSecurity &&
                    "cursor-default bg-slate-100/90 text-slate-700 focus:border-slate-200 focus:ring-0",
                )}
              />
            </div>

            {/* Cookie Đăng Nhập */}
            <div className="border-t border-slate-200/80 pt-1 sm:col-span-2">
              <div className="mb-1 flex items-center justify-between">
                <label className="block flex items-center gap-1.5 text-[11px] font-semibold text-slate-700">
                  <span>🍪 Cookie Đăng Nhập (Tùy chọn)</span>
                  {cookies.trim() ? (
                    <span className="rounded border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">
                      Đã có Cookie ({cookies.length} ký tự)
                    </span>
                  ) : (
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-400">
                      Chưa có Cookie
                    </span>
                  )}
                </label>
                {cookies.trim() && (
                  <button
                    type="button"
                    onClick={() => setCookies("")}
                    className="text-[11px] font-medium text-rose-500 hover:text-rose-700 hover:underline"
                  >
                    Xóa Cookie
                  </button>
                )}
              </div>
              <textarea
                rows={2}
                value={cookies}
                onChange={(e) => setCookies(e.target.value)}
                placeholder="Dán Cookie vào đây (hỗ trợ sessionid=...; JSON hoặc Base64) để tự động đăng nhập không cần mật khẩu/captcha..."
                className="w-full rounded-lg border border-slate-200 bg-white p-2 font-mono text-[11px] text-slate-800 placeholder-slate-400 transition-colors focus:border-sky-500 focus:outline-none"
              />
              <p className="mt-0.5 text-[10px] text-slate-400">
                * Khi nạp Cookie hợp lệ (có chứa <code>sessionid</code>), trình
                duyệt sẽ vào thẳng trang quản lý TikTok Studio mà không cần nhập
                mật khẩu hay giải captcha đăng nhập.
              </p>
            </div>
          </div>
        </div>

        {/* 3. Thư mục Video nguồn */}
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-700">
            Thư mục Video nguồn
          </label>
          <div className="flex gap-2">
            <Input
              value={videoFolder}
              onChange={(e) => setVideoFolder(e.target.value)}
              placeholder="/Users/username/Videos/Channel1"
              className="flex-1 font-mono text-xs"
            />
            <Button
              type="button"
              variant="secondary"
              onClick={handleSelectFolder}
            >
              <Folder className="mr-1 h-4 w-4 text-slate-500" /> Chọn Thư Mục
            </Button>
          </div>
          <p className="mt-1 text-[11px] text-slate-500">
            Video đăng thành công sẽ tự động được xử lý theo Cài Đặt chung (Xóa
            hoặc Lưu vào done/).
          </p>
        </div>

        {/* 4. Khối Gắn Nhạc Favorites */}
        <div className="space-y-2.5 rounded-xl border border-sky-100 bg-sky-50/30 p-3.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-sky-800">
              <Music className="h-4 w-4 text-sky-600" /> Tự Động Chèn Nhạc
              Favorites
            </div>
            <label className="flex cursor-pointer select-none items-center gap-2">
              <Checkbox
                checked={enableMusic}
                onCheckedChange={(checked) => setEnableMusic(Boolean(checked))}
              />
              <span className="text-xs font-medium text-slate-700">
                {enableMusic ? "Đang Bật" : "Tắt (Giữ tiếng gốc)"}
              </span>
            </label>
          </div>

          {enableMusic ? (
            <>
              <div className="grid grid-cols-1 gap-2.5 pt-1 sm:grid-cols-2">
                <div>
                  <label className="mb-0.5 block text-[11px] font-medium text-slate-600">
                    Chế độ chọn bài
                  </label>
                  <Select
                    value={musicMode}
                    onValueChange={(val: any) => setMusicMode(val)}
                  >
                    <SelectTrigger className="h-8 bg-white text-xs">
                      <SelectValue placeholder="Chọn chế độ" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="favorite_rotate">
                        Xoay vòng các bài trong Favorites (Mặc định)
                      </SelectItem>
                      <SelectItem value="favorite_single">
                        Cố định 1 bài hát chỉ định
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {musicMode === "favorite_single" ? (
                  <div>
                    <label className="mb-0.5 block text-[11px] font-medium text-slate-600">
                      Vị trí bài trong Favorites (0 là đầu)
                    </label>
                    <Input
                      type="number"
                      min="0"
                      value={favoriteIndex}
                      onChange={(e) => setFavoriteIndex(Number(e.target.value))}
                      className="h-8 text-xs"
                    />
                  </div>
                ) : (
                  <div>
                    <label className="mb-0.5 block text-[11px] font-medium text-slate-600">
                      Âm lượng nhạc nền (dB)
                    </label>
                    <Input
                      type="number"
                      value={musicVolume}
                      onChange={(e) => setMusicVolume(Number(e.target.value))}
                      placeholder="-50"
                      className="h-8 text-xs"
                    />
                  </div>
                )}
              </div>

              {musicMode === "favorite_single" && (
                <div>
                  <label className="mb-0.5 block text-[11px] font-medium text-slate-600">
                    Âm lượng nhạc nền (dB)
                  </label>
                  <Input
                    type="number"
                    value={musicVolume}
                    onChange={(e) => setMusicVolume(Number(e.target.value))}
                    placeholder="-50"
                    className="h-8 text-xs"
                  />
                </div>
              )}

              <div className="flex items-start gap-2 rounded-lg bg-sky-100/60 p-2 text-xs text-sky-800">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-sky-600" />
                <span>
                  <strong>Bảo vệ doanh thu MMO:</strong> Giữ nguyên âm thanh gốc
                  của video ở mức 100%, đồng thời chèn nhạc nền tài trợ từ mục
                  Favorites ở mức -50dB để gắn Sound ID kiếm tiền.
                </span>
              </div>
            </>
          ) : (
            <p className="py-1 text-xs text-slate-500">
              Profile này được cấu hình <strong>TẮT chèn nhạc</strong>. Video sẽ
              được tải lên với âm thanh gốc, không mở editor âm thanh.
            </p>
          )}
        </div>

        {/* 5. Khối Lên Lịch (Scheduling) */}
        <div className="space-y-2.5 rounded-xl border border-slate-200 bg-slate-50/50 p-3.5">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-800">
            <Calendar className="h-4 w-4 text-slate-500" /> Cơ Chế Lên Lịch
            (Scheduling)
          </div>

          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            <div>
              <label className="mb-0.5 block text-[11px] font-medium text-slate-600">
                Chế độ lịch
              </label>
              <Select
                value={scheduleMode}
                onValueChange={(val: any) => setScheduleMode(val)}
              >
                <SelectTrigger className="h-8 bg-white text-xs">
                  <SelectValue placeholder="Chọn chế độ lịch" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto_increment">
                    Nối tiếp lịch cũ (+ khoảng cách phút)
                  </SelectItem>
                  <SelectItem value="golden_hours">
                    Rải theo Khung Giờ Vàng
                  </SelectItem>
                  <SelectItem value="immediate">
                    Đăng ngay lập tức (Public)
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {scheduleMode === "auto_increment" && (
              <div>
                <label className="mb-0.5 block text-[11px] font-medium text-slate-600">
                  Khoảng cách giữa các video (phút)
                </label>
                <Input
                  type="number"
                  min="5"
                  step="5"
                  value={scheduleInterval}
                  onChange={(e) => setScheduleInterval(Number(e.target.value))}
                  className="h-8 text-xs"
                />
              </div>
            )}

            {scheduleMode === "golden_hours" && (
              <div className="sm:col-span-2">
                <label className="mb-0.5 block text-[11px] font-medium text-slate-600">
                  Các khung giờ vàng (cách nhau bởi dấu phẩy)
                </label>
                <Input
                  value={goldenHours}
                  onChange={(e) => setGoldenHours(e.target.value)}
                  placeholder="11:30,17:30,20:00"
                  className="h-8 text-xs"
                />
              </div>
            )}
          </div>
        </div>

        {/* 6. Proxy */}
        <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50/50 p-3.5">
          <div className="flex items-center justify-between">
            <label className="block flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-700">
              <Globe className="h-3.5 w-3.5 text-slate-400" /> Cấu Hình Proxy
              (Tùy chọn)
            </label>
            {proxy.trim() && (
              <button
                type="button"
                onClick={handleTestProxy}
                disabled={isTestingProxy}
                className="flex items-center gap-1 text-[11px] font-semibold text-sky-600 hover:text-sky-700 hover:underline disabled:opacity-50"
              >
                {isTestingProxy ? (
                  <span className="flex items-center gap-1">
                    <span className="h-2 w-2 animate-ping rounded-full bg-sky-500" />{" "}
                    Đang kiểm tra...
                  </span>
                ) : (
                  "Kiểm tra kết nối"
                )}
              </button>
            )}
          </div>
          <Input
            value={proxy}
            onChange={(e) => {
              setProxy(e.target.value);
              setProxyTestResult(null);
            }}
            placeholder="http://user:pass@ip:port hoặc ip:port:user:pass"
            className="h-8 bg-white font-mono text-xs"
          />
          {proxyTestResult && (
            <div
              className={`mt-1.5 flex items-start gap-1.5 rounded-md px-2.5 py-1.5 text-[11px] leading-tight ${
                proxyTestResult.success
                  ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border border-rose-200 bg-rose-50 text-rose-700"
              }`}
            >
              <span className="shrink-0">
                {proxyTestResult.success ? "✅" : "❌"}
              </span>
              <div>
                {proxyTestResult.success ? (
                  <span>
                    Proxy hoạt động tốt! IP xuất cảnh:{" "}
                    <strong>{proxyTestResult.ip}</strong> (Độ trễ:{" "}
                    {proxyTestResult.latencyMs}ms)
                  </span>
                ) : (
                  <span>{proxyTestResult.error}</span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Nút bấm */}
        <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
          <Button type="button" variant="ghost" onClick={onClose}>
            Hủy
          </Button>
          <Button
            type="submit"
            variant="default"
            disabled={loading}
            className="bg-sky-500 font-semibold text-white hover:bg-sky-600"
          >
            {loading ? "Đang lưu..." : initialData ? "Cập Nhật" : "Tạo Profile"}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
