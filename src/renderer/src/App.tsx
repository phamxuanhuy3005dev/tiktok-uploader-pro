import React, { useEffect, useState, useMemo } from 'react';
import { toast, Toaster } from 'sonner';
import { AppHeader, TabType } from './components/AppHeader';
import { ProfileCard } from './components/ProfileCard';
import { ProfileModal } from './components/ProfileModal';
import { LogsDrawer } from './components/LogsDrawer';
import { QueueScreen } from './components/QueueScreen';
import { LogsScreen } from './components/LogsScreen';
import { SettingsScreen } from './components/SettingsScreen';
import { DistributeVideosModal } from './components/DistributeVideosModal';
import { 
  Sparkles, 
  Search, 
  Filter, 
  CheckSquare, 
  Square, 
  Play, 
  Upload, 
  Users, 
  Folder, 
  X,
  Shuffle
} from 'lucide-react';
import { Button } from './components/ui/Button';
import { Badge } from './components/ui/Badge';

export const App: React.FC = () => {
  const [profiles, setProfiles] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<TabType>('profiles');
  const [selectedGroup, setSelectedGroup] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedProfileIds, setSelectedProfileIds] = useState<Set<string>>(new Set());
  const [concurrency, setConcurrency] = useState<number>(2);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDistributeModalOpen, setIsDistributeModalOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState<any | null>(null);
  const [viewingLogsProfile, setViewingLogsProfile] = useState<any | null>(null);
  const [liveLogs, setLiveLogs] = useState<any[]>([]);
  const [queueStats, setQueueStats] = useState<any>({ runningProfiles: [] });

  useEffect(() => {
    loadProfiles();
    loadConcurrency();

    // Lắng nghe sự kiện upload progress từ Main process
    const unsubscribeProgress = window.api.onUploadProgress((event) => {
      setLiveLogs((prev) => [event, ...prev].slice(0, 100));

      if (event.type === 'error') {
        toast.error(`[${event.step || 'Lỗi'}] ${event.message}`);
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

  const loadConcurrency = async () => {
    try {
      const c = await window.api.getConcurrency();
      if (typeof c === 'number' && c > 0) {
        setConcurrency(c);
      }
    } catch (_) {}
  };

  const handleUpdateConcurrency = async (num: number) => {
    try {
      await window.api.setConcurrency(num);
      setConcurrency(num);
      toast.success(`Đã cập nhật số luồng chạy: ${num} luồng song song.`);
    } catch (err: any) {
      toast.error(`Lỗi cập nhật luồng: ${err.message}`);
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
        // Xóa khỏi danh sách đã chọn nếu có
        setSelectedProfileIds((prev) => {
          const next = new Set(prev);
          next.delete(profile.id);
          return next;
        });
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
      setActiveTab('queue');
    } catch (err: any) {
      toast.error(`Lỗi khởi chạy: ${err.message}`);
    }
  };

  // Chạy các profile được tích chọn
  const handleRunSelected = async () => {
    if (selectedProfileIds.size === 0) {
      toast.error('Vui lòng tích chọn ít nhất 1 profile để chạy!');
      return;
    }

    const selectedProfiles = profiles.filter((p) => selectedProfileIds.has(p.id));
    const readyProfiles = selectedProfiles.filter((p) => p.video_folder);
    const missingProfiles = selectedProfiles.filter((p) => !p.video_folder);

    if (readyProfiles.length === 0) {
      toast.error(
        `Các profiles đã chọn đều chưa có thư mục video: ${selectedProfiles.map((p) => p.name).join(', ')}`
      );
      return;
    }

    if (missingProfiles.length > 0) {
      toast.warning(
        `Bỏ qua ${missingProfiles.length} kênh chưa chọn thư mục video: ${missingProfiles.map((p) => p.name).join(', ')}`
      );
    }

    const ids = readyProfiles.map((p) => p.id);
    toast.info(`Bắt đầu chạy cho ${ids.length} kênh đã chọn...`);
    try {
      await window.api.startQueue(ids);
      setActiveTab('queue');
    } catch (err: any) {
      toast.error(`Lỗi khởi chạy: ${err.message}`);
    }
  };

  // Chạy toàn bộ nhóm hiện tại (hoặc tất cả)
  const handleRunBatch = async () => {
    const pool = selectedGroup === 'all' 
      ? profiles 
      : profiles.filter((p) => (p.group_name || 'Mặc định') === selectedGroup);

    const readyProfiles = pool.filter((p) => p.video_folder);
    const missingProfiles = pool.filter((p) => !p.video_folder);

    if (readyProfiles.length === 0) {
      toast.error(`Chưa có profile nào ${selectedGroup !== 'all' ? `trong nhóm [${selectedGroup}]` : ''} được gán thư mục video hợp lệ!`);
      return;
    }

    if (missingProfiles.length > 0) {
      toast.warning(
        `Bỏ qua ${missingProfiles.length} kênh trong nhóm chưa có thư mục video: ${missingProfiles.map((p) => p.name).join(', ')}`
      );
    }

    const ids = readyProfiles.map((p) => p.id);
    toast.info(`Bắt đầu chạy cho ${ids.length} kênh ${selectedGroup !== 'all' ? `(Nhóm: ${selectedGroup})` : ''}...`);
    try {
      await window.api.startQueue(ids);
      setActiveTab('queue');
    } catch (err: any) {
      toast.error(`Lỗi chạy hàng loạt: ${err.message}`);
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

  const handleDeleteAll = async () => {
    if (confirm(`CẢNH BÁO: Bạn có chắc chắn muốn xóa TOÀN BỘ ${profiles.length} profiles để làm sạch dữ liệu không?`)) {
      try {
        await window.api.deleteAllProfiles();
        setSelectedProfileIds(new Set());
        toast.success('Đã xóa sạch toàn bộ profiles thành công!');
        await loadProfiles();
      } catch (err: any) {
        toast.error(`Lỗi khi xóa toàn bộ: ${err.message}`);
      }
    }
  };

  // Trích xuất danh sách các nhóm duy nhất
  const groups = useMemo(() => {
    return Array.from(new Set(profiles.map((p) => p.group_name || 'Mặc định'))).filter(Boolean);
  }, [profiles]);

  // Lọc profiles theo nhóm & từ khóa tìm kiếm
  const filteredProfiles = useMemo(() => {
    return profiles.filter((p) => {
      // Lọc theo nhóm
      if (selectedGroup !== 'all' && (p.group_name || 'Mặc định') !== selectedGroup) {
        return false;
      }
      // Lọc theo từ khóa tìm kiếm (tên, email, account_id)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = (p.name || '').toLowerCase().includes(q);
        const matchAccount = (p.account_id || '').toLowerCase().includes(q);
        const matchEmail = (p.email || '').toLowerCase().includes(q);
        const matchMailAo = (p.mail_ao || '').toLowerCase().includes(q);
        if (!matchName && !matchAccount && !matchEmail && !matchMailAo) {
          return false;
        }
      }
      return true;
    });
  }, [profiles, selectedGroup, searchQuery]);

  // Xử lý chọn / bỏ chọn 1 profile
  const handleToggleSelect = (profileId: string, selected: boolean) => {
    setSelectedProfileIds((prev) => {
      const next = new Set(prev);
      if (selected) {
        next.add(profileId);
      } else {
        next.delete(profileId);
      }
      return next;
    });
  };

  // Chọn / bỏ chọn tất cả các profile đang hiển thị
  const isAllFilteredSelected = filteredProfiles.length > 0 && filteredProfiles.every((p) => selectedProfileIds.has(p.id));

  const handleToggleSelectAll = () => {
    if (isAllFilteredSelected) {
      // Bỏ chọn tất cả profile đang hiển thị
      setSelectedProfileIds((prev) => {
        const next = new Set(prev);
        filteredProfiles.forEach((p) => next.delete(p.id));
        return next;
      });
    } else {
      // Chọn tất cả profile đang hiển thị
      setSelectedProfileIds((prev) => {
        const next = new Set(prev);
        filteredProfiles.forEach((p) => next.add(p.id));
        return next;
      });
    }
  };

  const handleClearSelection = () => {
    setSelectedProfileIds(new Set());
  };

  const runningCount = queueStats.runningProfiles?.length || 0;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      <Toaster position="top-right" theme="light" richColors />

      {/* Header with Navigation Tabs & Luồng Quick Picker */}
      <AppHeader
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onAddProfile={() => {
          setEditingProfile(null);
          setIsModalOpen(true);
        }}
        totalProfiles={profiles.length}
        runningCount={runningCount}
      />

      {/* Main Container */}
      <main className="flex-1 p-4 sm:p-6 max-w-7xl mx-auto w-full">
        {/* TAB 1: KÊNH & PROFILES */}
        {activeTab === 'profiles' && (
          <div className="space-y-4">
            {/* Filter & Selection Toolbar */}
            <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200/90 shadow-sm space-y-3">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                {/* Search Input */}
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Tìm theo tên kênh, email, ID tài khoản..."
                    className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50/70 text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-sky-500 focus:bg-white transition-all"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                {/* Group Selector Dropdown & Chia Đều Video */}
                <div className="flex items-center gap-2 shrink-0">
                  <div className="flex items-center gap-1.5 text-xs text-slate-500 bg-slate-50 px-3 py-2 rounded-xl border border-slate-200 font-medium">
                    <Filter className="h-3.5 w-3.5 text-sky-500" />
                    <span>Nhóm:</span>
                    <select
                      value={selectedGroup}
                      onChange={(e) => setSelectedGroup(e.target.value)}
                      className="bg-transparent text-slate-800 font-bold focus:outline-none cursor-pointer text-xs"
                    >
                      <option value="all">Tất cả ({profiles.length})</option>
                      {groups.map((grp) => {
                        const count = profiles.filter((p) => (p.group_name || 'Mặc định') === grp).length;
                        return (
                          <option key={grp} value={grp}>
                            {grp} ({count})
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  {/* Nút Chia Đều Video */}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsDistributeModalOpen(true)}
                    title="Tự động chia đều danh sách video từ 1 thư mục cho các kênh"
                    className="text-xs border-sky-300 text-sky-700 bg-sky-50/60 hover:bg-sky-100/80 shrink-0"
                  >
                    <Shuffle className="h-3.5 w-3.5 mr-1 text-sky-600" /> Chia Đều Video
                  </Button>
                </div>
              </div>

              {/* Selection Bar & Batch Run Actions */}
              <div className="flex flex-wrap items-center justify-between gap-2.5 pt-2 border-t border-slate-100">
                <div className="flex items-center gap-3">
                  {/* Checkbox Chọn tất cả */}
                  <button
                    onClick={handleToggleSelectAll}
                    disabled={filteredProfiles.length === 0}
                    className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors disabled:opacity-50"
                  >
                    {isAllFilteredSelected ? (
                      <CheckSquare className="h-4 w-4 text-sky-500" />
                    ) : (
                      <Square className="h-4 w-4 text-slate-400" />
                    )}
                    <span>
                      {isAllFilteredSelected ? 'Bỏ chọn tất cả' : 'Chọn tất cả'} ({filteredProfiles.length})
                    </span>
                  </button>

                  {/* Số lượng đã chọn & Cảnh báo kênh thiếu folder */}
                  {selectedProfileIds.size > 0 && (
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <Badge variant="info" className="text-xs bg-sky-50 text-sky-700 border-sky-200">
                        Đã chọn {selectedProfileIds.size} profile
                      </Badge>
                      {profiles.filter((p) => selectedProfileIds.has(p.id) && !p.video_folder).length > 0 && (
                        <span className="text-[11px] text-amber-600 font-semibold bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                          ⚠️ {profiles.filter((p) => selectedProfileIds.has(p.id) && !p.video_folder).length} kênh chưa gán folder
                        </span>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {/* Nếu đã chọn >= 1 profile: Nút Chạy các profile đã chọn */}
                  {selectedProfileIds.size > 0 ? (
                    <>
                      <button
                        onClick={handleClearSelection}
                        className="text-xs text-slate-500 hover:text-slate-700 px-2 py-1"
                      >
                        Hủy chọn
                      </button>

                      <Button
                        variant="default"
                        size="sm"
                        onClick={handleRunSelected}
                        className="text-xs shadow-sm shadow-sky-500/30"
                      >
                        <Play className="h-3.5 w-3.5 mr-1 fill-current" />
                        Chạy {selectedProfileIds.size} Profile Đã Chọn
                      </Button>
                    </>
                  ) : (
                    /* Nếu chưa chọn profile nào: Nút chạy toàn bộ nhóm */
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleRunBatch}
                      disabled={filteredProfiles.length === 0 || runningCount > 0}
                      className="text-xs border-sky-300 text-sky-700 hover:bg-sky-50"
                    >
                      <Play className="h-3.5 w-3.5 mr-1 fill-current text-sky-500" />
                      Chạy Toàn Bộ {selectedGroup === 'all' ? 'Tất Cả Kênh' : `Nhóm [${selectedGroup}]`}
                    </Button>
                  )}
                </div>
              </div>
            </div>

            {/* Profile Grid */}
            {profiles.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 border border-dashed border-slate-200 rounded-3xl bg-white text-center px-4 shadow-sm">
                <div className="h-16 w-16 rounded-2xl bg-sky-50 flex items-center justify-center border border-sky-100 mb-4 shadow-inner">
                  <Sparkles className="h-8 w-8 text-sky-500" />
                </div>
                <h3 className="text-base font-bold text-slate-800">Chưa có Profile TikTok nào</h3>
                <p className="text-xs text-slate-500 max-w-md mt-1 mb-5">
                  Bắt đầu ngay bằng cách tạo profile kênh TikTok đầu tiên hoặc phục hồi từ file backup JSON.
                </p>
                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleImportJson}
                    className="border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs"
                  >
                    <Upload className="h-3.5 w-3.5 mr-1 text-slate-500" /> Phục Hồi File JSON
                  </Button>
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => {
                      setEditingProfile(null);
                      setIsModalOpen(true);
                    }}
                    className="text-xs"
                  >
                    + Tạo Profile Mới
                  </Button>
                </div>
              </div>
            ) : filteredProfiles.length === 0 ? (
              <div className="py-16 text-center text-sm text-slate-400 bg-white rounded-2xl border border-slate-200">
                Không tìm thấy profile nào phù hợp với bộ lọc hoặc từ khóa tìm kiếm.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredProfiles.map((profile) => (
                  <ProfileCard
                    key={profile.id}
                    profile={profile}
                    isSelected={selectedProfileIds.has(profile.id)}
                    onToggleSelect={(selected) => handleToggleSelect(profile.id, selected)}
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
          </div>
        )}

        {/* TAB 2: TIẾN TRÌNH (QUEUE) */}
        {activeTab === 'queue' && (
          <QueueScreen
            queueStats={queueStats}
            profiles={profiles}
            liveLogs={liveLogs}
            concurrency={concurrency}
            onUpdateConcurrency={handleUpdateConcurrency}
            onClearLiveLogs={() => setLiveLogs([])}
            onNavigateToProfiles={() => setActiveTab('profiles')}
          />
        )}

        {/* TAB 3: NHẬT KÝ (LOGS) */}
        {activeTab === 'logs' && (
          <LogsScreen
            liveLogs={liveLogs}
            onClearLiveLogs={() => setLiveLogs([])}
          />
        )}

        {/* TAB 4: CÀI ĐẶT (SETTINGS) */}
        {activeTab === 'settings' && (
          <SettingsScreen
            concurrency={concurrency}
            onUpdateConcurrency={handleUpdateConcurrency}
            onExportJson={handleExportJson}
            onImportJson={handleImportJson}
            onDeleteAll={handleDeleteAll}
            totalProfiles={profiles.length}
          />
        )}
      </main>

      {/* Profile Modal */}
      <ProfileModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingProfile(null);
        }}
        onSave={handleSaveProfile}
        initialData={editingProfile}
        availableGroups={groups}
      />

      {/* Individual Profile Logs Drawer */}
      <LogsDrawer
        isOpen={Boolean(viewingLogsProfile)}
        onClose={() => setViewingLogsProfile(null)}
        profile={viewingLogsProfile}
      />

      {/* Distribute Videos Modal */}
      <DistributeVideosModal
        isOpen={isDistributeModalOpen}
        onClose={() => setIsDistributeModalOpen(false)}
        profiles={profiles}
        groups={groups}
        initialSelectedGroup={selectedGroup}
        selectedProfileIds={selectedProfileIds}
        onSuccess={(updatedProfiles) => {
          setProfiles(updatedProfiles);
        }}
      />
    </div>
  );
};
