import React, { useState, useEffect } from 'react';
import { Folder, Music, Calendar, Globe, AlertTriangle, Users, KeyRound, Mail, ShieldCheck } from 'lucide-react';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { Input } from './ui/Input';

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
  availableGroups = []
}) => {
  const [name, setName] = useState('');
  const [groupName, setGroupName] = useState('Mặc định');
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [newGroupInput, setNewGroupInput] = useState('');
  const [videoFolder, setVideoFolder] = useState('');
  const [accountId, setAccountId] = useState('');
  const [pass, setPass] = useState('');
  const [email, setEmail] = useState('');
  const [passEmail, setPassEmail] = useState('');
  const [mailAo, setMailAo] = useState('');
  const [enableMusic, setEnableMusic] = useState(true);
  const [musicMode, setMusicMode] = useState<'favorite_single' | 'favorite_rotate'>('favorite_rotate');
  const [favoriteIndex, setFavoriteIndex] = useState(0);
  const [musicVolume, setMusicVolume] = useState(-50);
  const [scheduleMode, setScheduleMode] = useState<'immediate' | 'auto_increment' | 'golden_hours'>('auto_increment');
  const [scheduleInterval, setScheduleInterval] = useState(10);
  const [goldenHours, setGoldenHours] = useState('11:30,17:30,20:00');
  const [proxy, setProxy] = useState('');
  const [cookies, setCookies] = useState('');
  const [maxVideos, setMaxVideos] = useState<number | string>(50);
  const [loading, setLoading] = useState(false);
  const [isTestingProxy, setIsTestingProxy] = useState(false);
  const [proxyTestResult, setProxyTestResult] = useState<{
    success: boolean;
    ip?: string;
    latencyMs?: number;
    error?: string;
  } | null>(null);

  const handleTestProxy = async () => {
    if (!proxy.trim()) return;
    setIsTestingProxy(true);
    setProxyTestResult(null);
    try {
      const res = await window.api.testProxy(proxy.trim());
      setProxyTestResult(res);
    } catch (err: any) {
      setProxyTestResult({ success: false, error: err.message || 'Lỗi khi kiểm tra proxy' });
    } finally {
      setIsTestingProxy(false);
    }
  };

  useEffect(() => {
    setProxyTestResult(null);
    setIsCreatingGroup(false);
    setNewGroupInput('');
    if (initialData) {
      setName(initialData.name || '');
      setGroupName(initialData.group_name || 'Mặc định');
      setVideoFolder(initialData.video_folder || '');
      setMaxVideos(initialData.max_videos !== undefined && initialData.max_videos !== null ? initialData.max_videos : 50);
      setAccountId(initialData.account_id || '');
      setPass(initialData.pass || '');
      setEmail(initialData.email || '');
      setPassEmail(initialData.pass_email || '');
      setMailAo(initialData.mail_ao || '');
      setCookies(initialData.cookies || '');
      setEnableMusic(initialData.enable_music !== 0);
      setMusicMode(initialData.music_mode || 'favorite_rotate');
      setFavoriteIndex(initialData.favorite_index ?? 0);
      setMusicVolume(initialData.music_volume ?? -50);
      setScheduleMode(initialData.schedule_mode || 'auto_increment');
      setScheduleInterval(initialData.schedule_interval ?? 10);
      setGoldenHours(initialData.golden_hours || '11:30,17:30,20:00');
      setProxy(initialData.proxy || '');
    } else {
      setName('');
      setGroupName('Mặc định');
      setVideoFolder('');
      setMaxVideos(50);
      setAccountId('');
      setPass('');
      setEmail('');
      setPassEmail('');
      setMailAo('');
      setCookies('');
      setEnableMusic(true);
      setMusicMode('favorite_rotate');
      setFavoriteIndex(0);
      setMusicVolume(-50);
      setScheduleMode('auto_increment');
      setScheduleInterval(10);
      setGoldenHours('11:30,17:30,20:00');
      setProxy('');
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
        group_name: groupName.trim() || 'Mặc định',
        video_folder: videoFolder.trim(),
        max_videos: maxVideos === '' ? 50 : Math.max(0, Number(maxVideos)),
        account_id: accountId.trim() || null,
        pass: pass.trim() || null,
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
        caption_mode: 'remove_title',
        proxy: proxy.trim() || null,
        status: initialData?.status || 'idle',
        last_run: initialData?.last_run || null
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
      title={initialData ? `Chỉnh Sửa Profile: ${initialData.name}` : 'Thêm Profile Mới'}
      description="Cấu hình tài khoản, nhóm kênh, thông tin đăng nhập, chèn nhạc và lên lịch."
      className="max-w-2xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* 1. Tên & Nhóm Kênh */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
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
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5 text-slate-400" /> Nhóm Kênh (Group)
              </label>
              {!isCreatingGroup && (
                <button
                  type="button"
                  onClick={() => setIsCreatingGroup(true)}
                  className="text-[11px] text-sky-600 hover:text-sky-700 font-semibold hover:underline"
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
                  className="text-xs h-8 flex-1"
                />
                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    const trimmed = newGroupInput.trim();
                    if (trimmed) {
                      setGroupName(trimmed);
                      setIsCreatingGroup(false);
                      setNewGroupInput('');
                    }
                  }}
                  className="text-xs h-8 px-2.5"
                >
                  OK
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setIsCreatingGroup(false);
                    setNewGroupInput('');
                  }}
                  className="text-xs h-8 px-2"
                >
                  Hủy
                </Button>
              </div>
            ) : (
              <select
                value={groupName}
                onChange={(e) => {
                  if (e.target.value === '__NEW__') {
                    setIsCreatingGroup(true);
                  } else {
                    setGroupName(e.target.value);
                  }
                }}
                className="w-full h-8 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-700 font-medium focus:outline-none focus:border-sky-500"
              >
                {Array.from(new Set(['Mặc định', ...availableGroups, groupName])).filter(Boolean).map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
                <option value="__NEW__">+ Nhập nhóm mới khác...</option>
              </select>
            )}
          </div>
        </div>

        {/* 2. Thông tin Tài Khoản & Mật Khẩu (Quản lý kênh) */}
        <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3.5 space-y-2.5">
          <div className="flex items-center gap-2 text-slate-800 font-semibold text-xs uppercase tracking-wider">
            <ShieldCheck className="h-4 w-4 text-sky-600" /> Thông Tin Tài Khoản & Bảo Mật
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div>
              <label className="block text-[11px] font-medium text-slate-600 mb-0.5 flex items-center gap-1">
                <KeyRound className="h-3 w-3 text-slate-400" /> Tài khoản TikTok (Username / ID)
              </label>
              <Input
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                placeholder="User / Phone / ID"
                className="text-xs h-8"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-600 mb-0.5">
                Mật khẩu TikTok
              </label>
              <Input
                type="text"
                value={pass}
                onChange={(e) => setPass(e.target.value)}
                placeholder="Mật khẩu TikTok"
                className="text-xs h-8 font-mono"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-600 mb-0.5 flex items-center gap-1">
                <Mail className="h-3 w-3 text-slate-400" /> Email đăng ký
              </label>
              <Input
                type="text"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="example@outlook.com"
                className="text-xs h-8"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-600 mb-0.5">
                Mật khẩu Email
              </label>
              <Input
                type="text"
                value={passEmail}
                onChange={(e) => setPassEmail(e.target.value)}
                placeholder="Mật khẩu hòm thư"
                className="text-xs h-8 font-mono"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-[11px] font-medium text-slate-600 mb-0.5">
                Mail ảo / Mail khôi phục
              </label>
              <Input
                type="text"
                value={mailAo}
                onChange={(e) => setMailAo(e.target.value)}
                placeholder="Mail ảo liên kết..."
                className="text-xs h-8"
              />
            </div>

            {/* Cookie Đăng Nhập */}
            <div className="sm:col-span-2 pt-1 border-t border-slate-200/80">
              <div className="flex items-center justify-between mb-1">
                <label className="block text-[11px] font-semibold text-slate-700 flex items-center gap-1.5">
                  <span>🍪 Cookie Đăng Nhập (Tùy chọn)</span>
                  {cookies.trim() ? (
                    <span className="text-[10px] text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 font-semibold">
                      Đã có Cookie ({cookies.length} ký tự)
                    </span>
                  ) : (
                    <span className="text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                      Chưa có Cookie
                    </span>
                  )}
                </label>
                {cookies.trim() && (
                  <button
                    type="button"
                    onClick={() => setCookies('')}
                    className="text-[11px] text-rose-500 hover:text-rose-700 font-medium hover:underline"
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
                className="w-full p-2 font-mono text-[11px] rounded-lg border border-slate-200 bg-white text-slate-800 placeholder-slate-400 focus:outline-none focus:border-sky-500 transition-colors"
              />
              <p className="text-[10px] text-slate-400 mt-0.5">
                * Khi nạp Cookie hợp lệ (có chứa <code>sessionid</code>), trình duyệt sẽ vào thẳng trang quản lý TikTok Studio mà không cần nhập mật khẩu hay giải captcha đăng nhập.
              </p>
            </div>
          </div>
        </div>

        {/* 3. Thư mục Video nguồn & Giới hạn số lượng */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Thư mục Video nguồn
            </label>
            <div className="flex gap-2">
              <Input
                value={videoFolder}
                onChange={(e) => setVideoFolder(e.target.value)}
                placeholder="/Users/username/Videos/Channel1"
                className="flex-1 font-mono text-xs"
              />
              <Button type="button" variant="secondary" onClick={handleSelectFolder}>
                <Folder className="h-4 w-4 mr-1 text-slate-500" /> Chọn Folder
              </Button>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              * Video đăng thành công sẽ tự động chuyển vào thư mục con <code className="text-slate-700 font-semibold">done/</code>.
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Tối đa video / đợt
            </label>
            <Input
              type="number"
              min="0"
              max="999"
              value={maxVideos}
              onChange={(e) => setMaxVideos(e.target.value)}
              placeholder="50"
              className="text-xs font-bold text-sky-700 h-9"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              Mặc định 50. Nhập 0 để upload hết.
            </p>
          </div>
        </div>

        {/* 4. Khối Gắn Nhạc Favorites */}
        <div className="rounded-xl border border-sky-100 bg-sky-50/30 p-3.5 space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sky-800 font-semibold text-xs uppercase tracking-wider">
              <Music className="h-4 w-4 text-sky-600" /> Tự Động Chèn Nhạc Favorites
            </div>
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={enableMusic}
                onChange={(e) => setEnableMusic(e.target.checked)}
                className="w-4 h-4 rounded text-sky-600 focus:ring-sky-500 border-slate-300"
              />
              <span className="text-xs font-medium text-slate-700">
                {enableMusic ? 'Đang Bật' : 'Tắt (Giữ tiếng gốc)'}
              </span>
            </label>
          </div>

          {enableMusic ? (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-0.5">Chế độ chọn bài</label>
                  <select
                    value={musicMode}
                    onChange={(e: any) => setMusicMode(e.target.value)}
                    className="w-full h-8 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-700 focus:outline-none focus:border-sky-500"
                  >
                    <option value="favorite_rotate">Xoay vòng các bài trong Favorites (Mặc định)</option>
                    <option value="favorite_single">Cố định 1 bài hát chỉ định</option>
                  </select>
                </div>

                {musicMode === 'favorite_single' ? (
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-0.5">Vị trí bài trong Favorites (0 là đầu)</label>
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
                    <label className="block text-[11px] font-medium text-slate-600 mb-0.5">Âm lượng nhạc nền (dB)</label>
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

              {musicMode === 'favorite_single' && (
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-0.5">Âm lượng nhạc nền (dB)</label>
                  <Input
                    type="number"
                    value={musicVolume}
                    onChange={(e) => setMusicVolume(Number(e.target.value))}
                    placeholder="-50"
                    className="h-8 text-xs"
                  />
                </div>
              )}

              <div className="flex items-start gap-2 bg-sky-100/60 rounded-lg p-2 text-xs text-sky-800">
                <AlertTriangle className="h-4 w-4 shrink-0 text-sky-600 mt-0.5" />
                <span>
                  <strong>Bảo vệ doanh thu MMO:</strong> Giữ nguyên âm thanh gốc của video ở mức 100%, đồng thời chèn nhạc nền tài trợ từ mục Favorites ở mức -50dB để gắn Sound ID kiếm tiền.
                </span>
              </div>
            </>
          ) : (
            <p className="text-xs text-slate-500 py-1">
              Profile này được cấu hình <strong>TẮT chèn nhạc</strong>. Video sẽ được tải lên với âm thanh gốc, không mở editor âm thanh.
            </p>
          )}
        </div>

        {/* 5. Khối Lên Lịch (Scheduling) */}
        <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3.5 space-y-2.5">
          <div className="flex items-center gap-2 text-slate-800 font-semibold text-xs uppercase tracking-wider">
            <Calendar className="h-4 w-4 text-slate-500" /> Cơ Chế Lên Lịch (Scheduling)
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div>
              <label className="block text-[11px] font-medium text-slate-600 mb-0.5">Chế độ lịch</label>
              <select
                value={scheduleMode}
                onChange={(e: any) => setScheduleMode(e.target.value)}
                className="w-full h-8 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-700 focus:outline-none focus:border-sky-500"
              >
                <option value="auto_increment">Nối tiếp lịch cũ (+ khoảng cách phút)</option>
                <option value="golden_hours">Rải theo Khung Giờ Vàng</option>
                <option value="immediate">Đăng ngay lập tức (Public)</option>
              </select>
            </div>

            {scheduleMode === 'auto_increment' && (
              <div>
                <label className="block text-[11px] font-medium text-slate-600 mb-0.5">Khoảng cách giữa các video (phút)</label>
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

            {scheduleMode === 'golden_hours' && (
              <div className="sm:col-span-2">
                <label className="block text-[11px] font-medium text-slate-600 mb-0.5">Các khung giờ vàng (cách nhau bởi dấu phẩy)</label>
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
        <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3.5 space-y-2">
          <div className="flex items-center justify-between">
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <Globe className="h-3.5 w-3.5 text-slate-400" /> Cấu Hình Proxy (Tùy chọn)
            </label>
            {proxy.trim() && (
              <button
                type="button"
                onClick={handleTestProxy}
                disabled={isTestingProxy}
                className="text-[11px] text-sky-600 hover:text-sky-700 font-semibold hover:underline disabled:opacity-50 flex items-center gap-1"
              >
                {isTestingProxy ? (
                  <span className="flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-sky-500 animate-ping" /> Đang kiểm tra...
                  </span>
                ) : (
                  'Kiểm tra kết nối'
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
            className="font-mono text-xs h-8 bg-white"
          />
          {proxyTestResult && (
            <div
              className={`mt-1.5 px-2.5 py-1.5 rounded-md text-[11px] leading-tight flex items-start gap-1.5 ${
                proxyTestResult.success
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-rose-50 text-rose-700 border border-rose-200'
              }`}
            >
              <span className="shrink-0">{proxyTestResult.success ? '✅' : '❌'}</span>
              <div>
                {proxyTestResult.success ? (
                  <span>
                    Proxy hoạt động tốt! IP xuất cảnh: <strong>{proxyTestResult.ip}</strong> (Độ trễ: {proxyTestResult.latencyMs}ms)
                  </span>
                ) : (
                  <span>{proxyTestResult.error}</span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Nút bấm */}
        <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
          <Button type="button" variant="ghost" onClick={onClose}>
            Hủy
          </Button>
          <Button type="submit" variant="default" disabled={loading} className="bg-sky-500 hover:bg-sky-600 text-white font-semibold">
            {loading ? 'Đang lưu...' : initialData ? 'Cập Nhật' : 'Tạo Profile'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
