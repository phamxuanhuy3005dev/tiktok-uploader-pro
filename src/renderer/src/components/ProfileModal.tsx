import React, { useState, useEffect } from 'react';
import { Folder, Music, Calendar, FileText, Globe, AlertTriangle, Users } from 'lucide-react';
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
  const [videoFolder, setVideoFolder] = useState('');
  const [enableMusic, setEnableMusic] = useState(true);
  const [musicMode, setMusicMode] = useState<'favorite_single' | 'favorite_rotate'>('favorite_rotate');
  const [favoriteIndex, setFavoriteIndex] = useState(0);
  const [musicVolume, setMusicVolume] = useState(-50);
  const [scheduleMode, setScheduleMode] = useState<'immediate' | 'auto_increment' | 'golden_hours'>('auto_increment');
  const [scheduleInterval, setScheduleInterval] = useState(10);
  const [goldenHours, setGoldenHours] = useState('11:30,17:30,20:00');
  const [captionMode, setCaptionMode] = useState<'remove_title' | 'from_txt_file'>('remove_title');
  const [proxy, setProxy] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (initialData) {
      setName(initialData.name || '');
      setGroupName(initialData.group_name || 'Mặc định');
      setVideoFolder(initialData.video_folder || '');
      setEnableMusic(initialData.enable_music !== 0);
      setMusicMode(initialData.music_mode || 'favorite_rotate');
      setFavoriteIndex(initialData.favorite_index ?? 0);
      setMusicVolume(initialData.music_volume ?? -50);
      setScheduleMode(initialData.schedule_mode || 'auto_increment');
      setScheduleInterval(initialData.schedule_interval ?? 10);
      setGoldenHours(initialData.golden_hours || '11:30,17:30,20:00');
      setCaptionMode(initialData.caption_mode || 'remove_title');
      setProxy(initialData.proxy || '');
    } else {
      setName('');
      setGroupName('Mặc định');
      setVideoFolder('');
      setEnableMusic(true);
      setMusicMode('favorite_rotate'); // Mặc định xoay vòng theo yêu cầu
      setFavoriteIndex(0);
      setMusicVolume(-50);
      setScheduleMode('auto_increment');
      setScheduleInterval(10);
      setGoldenHours('11:30,17:30,20:00');
      setCaptionMode('remove_title');
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
        enable_music: enableMusic ? 1 : 0,
        music_mode: musicMode,
        favorite_index: Number(favoriteIndex) || 0,
        music_volume: Number(musicVolume) || -50,
        schedule_mode: scheduleMode,
        schedule_interval: Number(scheduleInterval) || 10,
        golden_hours: goldenHours.trim(),
        caption_mode: captionMode,
        proxy: proxy.trim() || null,
        status: initialData?.status || 'idle',
        cookies: initialData?.cookies || null,
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
      description="Cấu hình tài khoản, nhóm kênh, thư mục video, quy tắc chèn nhạc và lên lịch."
      className="max-w-2xl max-h-[90vh] overflow-y-auto"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Tên & Nhóm */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-1.5">
              Tên Profile (Định danh kênh)
            </label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="ví dụ: juliapiper_paz, review_01"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5 text-zinc-400" /> Nhóm Kênh (Group)
            </label>
            <Input
              list="existing-groups"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder="Chọn nhóm có sẵn hoặc gõ nhóm mới..."
            />
            <datalist id="existing-groups">
              {availableGroups.map((g) => (
                <option key={g} value={g} />
              ))}
            </datalist>
            <span className="text-[10px] text-zinc-500">Bấm mũi tên hoặc click đúp để chọn nhóm có sẵn.</span>
          </div>
        </div>

        {/* Thư mục Video nguồn */}
        <div>
          <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-1.5">
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
              <Folder className="h-4 w-4 mr-1 text-zinc-400" /> Chọn Folder
            </Button>
          </div>
          <p className="text-[11px] text-zinc-500 mt-1">
            * Video sau khi đăng thành công sẽ tự động được chuyển sang thư mục con <code className="text-zinc-400">done/</code>.
          </p>
        </div>

        {/* Khối Gắn Nhạc Favorites (Tùy chọn Bật/Tắt) */}
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/5 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-rose-400 font-semibold text-sm">
              <Music className="h-4 w-4" /> Tự Động Chèn Nhạc Favorites
            </div>
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={enableMusic}
                onChange={(e) => setEnableMusic(e.target.checked)}
                className="w-4 h-4 rounded text-rose-600 focus:ring-rose-500 bg-zinc-900 border-zinc-700"
              />
              <span className="text-xs font-medium text-zinc-200">
                {enableMusic ? 'Đang Bật' : 'Tắt (Giữ tiếng gốc)'}
              </span>
            </label>
          </div>

          {enableMusic ? (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">Chế độ chọn bài</label>
                  <select
                    value={musicMode}
                    onChange={(e: any) => setMusicMode(e.target.value)}
                    className="w-full h-9 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-rose-500"
                  >
                    <option value="favorite_rotate">Xoay vòng các bài trong Favorites (Mặc định)</option>
                    <option value="favorite_single">Cố định 1 bài hát chỉ định</option>
                  </select>
                </div>

                {musicMode === 'favorite_single' ? (
                  <div>
                    <label className="block text-xs text-zinc-400 mb-1">Vị trí bài trong Favorites (0 là đầu tiên)</label>
                    <Input
                      type="number"
                      min="0"
                      value={favoriteIndex}
                      onChange={(e) => setFavoriteIndex(Number(e.target.value))}
                    />
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs text-zinc-400 mb-1">Âm lượng nhạc nền (dB)</label>
                    <Input
                      type="number"
                      value={musicVolume}
                      onChange={(e) => setMusicVolume(Number(e.target.value))}
                      placeholder="-50"
                    />
                    <span className="text-[10px] text-zinc-500">-50 dB giúp giữ tiếng gốc nhưng vẫn ăn view nhạc.</span>
                  </div>
                )}
              </div>

              {musicMode === 'favorite_single' && (
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">Âm lượng nhạc nền (dB)</label>
                  <Input
                    type="number"
                    value={musicVolume}
                    onChange={(e) => setMusicVolume(Number(e.target.value))}
                    placeholder="-50"
                  />
                  <span className="text-[10px] text-zinc-500">-50 dB giúp giữ tiếng gốc nhưng vẫn ăn view nhạc.</span>
                </div>
              )}

              <div className="flex items-start gap-2 bg-rose-500/10 rounded-lg p-2.5 text-xs text-rose-300">
                <AlertTriangle className="h-4 w-4 shrink-0 text-rose-400 mt-0.5" />
                <span>
                  <strong>Bảo vệ doanh thu:</strong> Nếu tài khoản chưa lưu bài nhạc nào trong mục Favorites hoặc kẹt nút Save, hệ thống sẽ <strong>HỦY ĐĂNG</strong> video đó để bảo toàn file, không làm mất view nhạc!
                </span>
              </div>
            </>
          ) : (
            <p className="text-xs text-zinc-400 py-1">
              Profile này được cấu hình <strong>TẮT chèn nhạc</strong>. Video sẽ được tải lên với âm thanh gốc, bỏ qua hoàn toàn trình biên tập âm thanh.
            </p>
          )}
        </div>

        {/* Khối Lên Lịch (Scheduling) */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 space-y-3">
          <div className="flex items-center gap-2 text-zinc-200 font-semibold text-sm">
            <Calendar className="h-4 w-4 text-zinc-400" /> Cơ Chế Lên Lịch (Scheduling)
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Chế độ lịch</label>
              <select
                value={scheduleMode}
                onChange={(e: any) => setScheduleMode(e.target.value)}
                className="w-full h-9 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-zinc-500"
              >
                <option value="auto_increment">Nối tiếp lịch cũ (Bước nhảy phút)</option>
                <option value="golden_hours">Rải theo Khung Giờ Vàng</option>
                <option value="immediate">Đăng ngay lập tức (Public)</option>
              </select>
            </div>

            {scheduleMode === 'auto_increment' && (
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Khoảng cách giữa các video (phút)</label>
                <Input
                  type="number"
                  min="5"
                  value={scheduleInterval}
                  onChange={(e) => setScheduleInterval(Number(e.target.value))}
                />
              </div>
            )}

            {scheduleMode === 'golden_hours' && (
              <div className="sm:col-span-2">
                <label className="block text-xs text-zinc-400 mb-1">Các khung giờ vàng (cách nhau bởi dấu phẩy)</label>
                <Input
                  value={goldenHours}
                  onChange={(e) => setGoldenHours(e.target.value)}
                  placeholder="11:30,17:30,20:00"
                />
              </div>
            )}
          </div>
        </div>

        {/* Khối Caption & Proxy */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5 text-zinc-400" /> Xử lý Tiêu Đề (Caption)
            </label>
            <select
              value={captionMode}
              onChange={(e: any) => setCaptionMode(e.target.value)}
              className="w-full h-9 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-zinc-500"
            >
              <option value="remove_title">Xóa sạch tiêu đề (Để trống)</option>
              <option value="from_txt_file">Đọc từ file .txt cùng tên video</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <Globe className="h-3.5 w-3.5 text-zinc-400" /> Proxy (Tùy chọn)
            </label>
            <Input
              value={proxy}
              onChange={(e) => setProxy(e.target.value)}
              placeholder="http://user:pass@ip:port"
              className="font-mono text-xs"
            />
          </div>
        </div>

        {/* Nút bấm */}
        <div className="flex justify-end gap-2.5 pt-3 border-t border-zinc-800/80">
          <Button type="button" variant="ghost" onClick={onClose}>
            Hủy
          </Button>
          <Button type="submit" variant="tiktok" disabled={loading}>
            {loading ? 'Đang lưu...' : initialData ? 'Cập Nhật' : 'Tạo Profile'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
