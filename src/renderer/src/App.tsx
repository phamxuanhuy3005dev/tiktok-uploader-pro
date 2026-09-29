import React, { useEffect, useState } from 'react';
import { toast, Toaster } from 'sonner';
import { AppHeader } from './components/AppHeader';
import { ProfileCard } from './components/ProfileCard';
import { ProfileModal } from './components/ProfileModal';
import { LogsDrawer } from './components/LogsDrawer';
import { Sparkles, Terminal, Activity, Users, Layers } from 'lucide-react';

export const App: React.FC = () => {
  const [profiles, setProfiles] = useState<any[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<string>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState<any | null>(null);
  const [viewingLogsProfile, setViewingLogsProfile] = useState<any | null>(null);
  const [liveLogs, setLiveLogs] = useState<any[]>([]);
  const [queueStats, setQueueStats] = useState<any>({ runningProfiles: [] });

  useEffect(() => {
    loadProfiles();

    // Lắng nghe sự kiện upload progress từ Main process
    const unsubscribeProgress = window.api.onUploadProgress((event) => {
      setLiveLogs((prev) => [event, ...prev].slice(0, 50));

      if (event.type === 'error') {
        toast.error(`[${event.step}] ${event.message}`);
      } else if (event.type === 'success') {
        toast.success(`[Thành công] ${event.message}`);
      }

      loadProfiles();
    });

    // Lắng nghe sự kiện profiles được update từ browser session
    const unsubscribeProfiles = window.api.onProfilesUpdated((updatedList) => {
      setProfiles(updatedList);
    });

    // Polling nhẹ queue stats
    const interval = setInterval(async () => {
      try {
        const stats = await window.api.getQueueStats();
        setQueueStats(stats);
      } catch (_) {}
    }, 2500);

    return () => {
      unsubscribeProgress();
      unsubscribeProfiles();
      clearInterval(interval);
    };
  }, []);

  const loadProfiles = async () => {
    try {
      const data = await window.api.getProfiles();
      setProfiles(data || []);
    } catch (err: any) {
      toast.error(`Không thể tải profiles: ${err.message}`);
    }
  };

  const handleSaveProfile = async (formData: any) => {
    try {
      if (editingProfile) {
        await window.api.updateProfile(formData);
        toast.success(`Đã cập nhật profile: ${formData.name}`);
      } else {
        await window.api.createProfile(formData);
        toast.success(`Đã thêm profile mới: ${formData.name}`);
      }
      await loadProfiles();
    } catch (err: any) {
      toast.error(`Lỗi lưu profile: ${err.message}`);
    }
  };

  const handleDeleteProfile = async (profile: any) => {
    if (confirm(`Bạn có chắc chắn muốn xóa profile "${profile.name}"?`)) {
      try {
        await window.api.deleteProfile(profile.id);
        toast.success(`Đã xóa profile: ${profile.name}`);
        await loadProfiles();
      } catch (err: any) {
        toast.error(`Lỗi khi xóa: ${err.message}`);
      }
    }
  };

  const handleOpenBrowser = async (profile: any) => {
    toast.info(`Đang mở trình duyệt (en-US) cho profile [${profile.name}]...`);
    try {
      await window.api.openBrowser(profile.id);
    } catch (err: any) {
      toast.error(`Lỗi mở trình duyệt: ${err.message}`);
    }
  };

  const handleRunSingle = async (profile: any) => {
    if (!profile.video_folder) {
      toast.error(`Vui lòng chọn thư mục video cho profile [${profile.name}] trước khi chạy!`);
      return;
    }
    toast.info(`Đã đưa [${profile.name}] vào hàng đợi upload.`);
    try {
      await window.api.startQueue([profile.id]);
    } catch (err: any) {
      toast.error(`Lỗi khởi chạy: ${err.message}`);
    }
  };

  const handleRunBatch = async () => {
    // Nếu đang chọn một nhóm cụ thể, chỉ chạy các profile trong nhóm đó
    const pool = selectedGroup === 'all' 
      ? profiles 
      : profiles.filter((p) => (p.group_name || 'Mặc định') === selectedGroup);

    const readyProfiles = pool.filter((p) => p.video_folder);
    if (readyProfiles.length === 0) {
      toast.error(`Chưa có profile nào ${selectedGroup !== 'all' ? `trong nhóm [${selectedGroup}]` : ''} được gán thư mục video hợp lệ!`);
      return;
    }

    const ids = readyProfiles.map((p) => p.id);
    toast.info(`Bắt đầu chạy hàng loạt cho ${ids.length} kênh ${selectedGroup !== 'all' ? `(Nhóm: ${selectedGroup})` : ''}...`);
    try {
      await window.api.startQueue(ids);
    } catch (err: any) {
      toast.error(`Lỗi chạy hàng loạt: ${err.message}`);
    }
  };

  const handleImportOldTool = async () => {
    toast.loading('Đang quét và nhập dữ liệu từ thư mục tiktok-at cũ...');
    try {
      const res = await window.api.importFromOldTool();
      toast.dismiss();
      if (res.importedCount > 0) {
        toast.success(res.message);
        setProfiles(res.profiles);
      } else {
        toast.info('Không có profile mới nào cần nhập (tất cả đã tồn tại).');
      }
    } catch (err: any) {
      toast.dismiss();
      toast.error(`Lỗi nhập từ tool cũ: ${err.message}`);
    }
  };

  const handleExportJson = async () => {
    try {
      const res = await window.api.exportJson();
      if (res.success) {
        toast.success(`Đã xuất danh sách profiles ra file JSON thành công!`);
      }
    } catch (err: any) {
      toast.error(`Lỗi xuất JSON: ${err.message}`);
    }
  };

  const handleImportJson = async () => {
    try {
      const res = await window.api.importJson();
      if (res.success) {
        toast.success(`Đã nhập thành công ${res.count} profile từ file JSON!`);
        if (res.profiles) setProfiles(res.profiles);
      }
    } catch (err: any) {
      toast.error(`Lỗi nhập JSON: ${err.message}`);
    }
  };

  // Trích xuất danh sách các nhóm duy nhất
  const groups = Array.from(new Set(profiles.map((p) => p.group_name || 'Mặc định'))).filter(Boolean);

  // Lọc profiles theo nhóm đã chọn
  const filteredProfiles = selectedGroup === 'all'
    ? profiles
    : profiles.filter((p) => (p.group_name || 'Mặc định') === selectedGroup);

  const runningCount = queueStats.runningProfiles?.length || 0;

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <Toaster position="top-right" theme="dark" richColors />

      {/* Main Container */}
      <main className="flex-1 p-6 max-w-7xl mx-auto w-full space-y-6">
        {/* Header */}
        <AppHeader
          onAddProfile={() => {
            setEditingProfile(null);
            setIsModalOpen(true);
          }}
          onRunBatch={handleRunBatch}
          onImportOldTool={handleImportOldTool}
          onExportJson={handleExportJson}
          onImportJson={handleImportJson}
          totalProfiles={profiles.length}
          runningCount={runningCount}
        />

        {/* Thanh Tabs Lọc Nhóm (Groups Bar) */}
        {profiles.length > 0 && (
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none border-b border-zinc-800/60">
            <span className="text-xs font-semibold text-zinc-400 flex items-center gap-1.5 mr-1 shrink-0">
              <Layers className="h-3.5 w-3.5 text-zinc-500" /> Nhóm:
            </span>

            {/* Tab Tất Cả */}
            <button
              onClick={() => setSelectedGroup('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all shrink-0 flex items-center gap-1.5 ${
                selectedGroup === 'all'
                  ? 'bg-zinc-100 text-zinc-900 font-semibold shadow'
                  : 'bg-zinc-900/60 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
              }`}
            >
              Tất cả ({profiles.length})
            </button>

            {/* Các Tabs Từng Nhóm */}
            {groups.map((group) => {
              const countInGroup = profiles.filter((p) => (p.group_name || 'Mặc định') === group).length;
              return (
                <button
                  key={group}
                  onClick={() => setSelectedGroup(group)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all shrink-0 flex items-center gap-1.5 ${
                    selectedGroup === group
                      ? 'bg-rose-500 text-white font-semibold shadow-md shadow-rose-500/20'
                      : 'bg-zinc-900/60 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 border border-zinc-800/80'
                  }`}
                >
                  <Users className="h-3 w-3 opacity-70" />
                  {group} ({countInGroup})
                </button>
              );
            })}
          </div>
        )}

        {/* Live Banner nếu có profile đang chạy */}
        {runningCount > 0 && (
          <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 flex items-center justify-between gap-4 shadow-lg shadow-rose-950/20">
            <div className="flex items-center gap-3">
              <div className="h-3 w-3 rounded-full bg-rose-500 animate-ping" />
              <div>
                <p className="text-sm font-semibold text-rose-300">
                  Hàng đợi đang xử lý: {runningCount} profile đồng thời (Worker Pool Concurrency: 2)
                </p>
                <p className="text-xs text-rose-400/80">
                  Chuẩn hóa giao diện en-US cho kênh US, kiểm tra chèn nhạc Favorites (-50dB) và chuyển video sang folder done/.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs font-mono bg-zinc-950/60 px-3 py-1.5 rounded-lg border border-zinc-800 text-zinc-300">
              <Activity className="h-4 w-4 text-rose-400 animate-spin" />
              Active: {queueStats.runningProfiles.join(', ')}
            </div>
          </div>
        )}

        {/* Danh sách Profiles */}
        {profiles.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 border border-dashed border-zinc-800 rounded-2xl bg-zinc-900/20 text-center px-4">
            <div className="h-16 w-16 rounded-2xl bg-zinc-900 flex items-center justify-center border border-zinc-800 mb-4 shadow-inner">
              <Sparkles className="h-8 w-8 text-rose-500" />
            </div>
            <h3 className="text-base font-bold text-zinc-100">Chưa có Profile TikTok nào</h3>
            <p className="text-xs text-zinc-400 max-w-md mt-1 mb-5">
              Bạn có thể bấm nút <strong className="text-amber-400">&quot;Nhập từ Tool Cũ&quot;</strong> để kéo toàn bộ kênh & cookie có sẵn từ tiktok-at, hoặc bấm &quot;Thêm Profile&quot; để tạo mới.
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleImportOldTool}
                className="px-4 py-2 rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs font-semibold hover:bg-amber-500/30 transition-all"
              >
                Nhập từ Tool Cũ (tiktok-at)
              </button>
              <button
                onClick={() => {
                  setEditingProfile(null);
                  setIsModalOpen(true);
                }}
                className="px-4 py-2 rounded-lg bg-zinc-100 text-zinc-900 text-xs font-semibold hover:bg-white shadow transition-all"
              >
                + Tạo Profile Mới
              </button>
            </div>
          </div>
        ) : filteredProfiles.length === 0 ? (
          <div className="py-16 text-center text-sm text-zinc-500">
            Không có profile nào trong nhóm &quot;{selectedGroup}&quot;.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredProfiles.map((profile) => (
              <ProfileCard
                key={profile.id}
                profile={profile}
                onEdit={() => {
                  setEditingProfile(profile);
                  setIsModalOpen(true);
                }}
                onDelete={() => handleDeleteProfile(profile)}
                onOpenBrowser={() => handleOpenBrowser(profile)}
                onRunUpload={() => handleRunSingle(profile)}
                onViewLogs={() => setViewingLogsProfile(profile)}
                isRunning={queueStats.runningProfiles?.includes(profile.id)}
              />
            ))}
          </div>
        )}

        {/* Live Logs Terminal Mini */}
        {liveLogs.length > 0 && (
          <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4 space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-zinc-400 border-b border-zinc-800/80 pb-2">
              <span className="flex items-center gap-1.5">
                <Terminal className="h-4 w-4 text-rose-400" /> Nhật Ký Tiến Trình Realtime
              </span>
              <button
                onClick={() => setLiveLogs([])}
                className="text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                Xóa nhật ký
              </button>
            </div>
            <div className="font-mono text-xs max-h-36 overflow-y-auto space-y-1 text-zinc-300 pr-1">
              {liveLogs.map((log, idx) => (
                <div key={idx} className="flex items-start gap-2">
                  <span className="text-zinc-600 select-none">›</span>
                  <span
                    className={
                      log.type === 'error'
                        ? 'text-red-400'
                        : log.type === 'success'
                          ? 'text-emerald-400'
                          : log.type === 'warn'
                            ? 'text-amber-400'
                            : 'text-zinc-300'
                    }
                  >
                    {log.message}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Modals */}
      <ProfileModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingProfile(null);
        }}
        onSave={handleSaveProfile}
        initialData={editingProfile}
      />

      <LogsDrawer
        isOpen={Boolean(viewingLogsProfile)}
        onClose={() => setViewingLogsProfile(null)}
        profile={viewingLogsProfile}
      />
    </div>
  );
};
