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
import { ManageGroupsModal } from './components/ManageGroupsModal';
import { BulkImportModal } from './components/BulkImportModal';
import { 
  Sparkles, 
  Search, 
  Filter, 
  CheckSquare, 
  Square, 
  Play, 
  Plus, 
  Users, 
  Folder, 
  X,
  Shuffle,
  Copy,
  Trash2,
  FolderInput,
  FileSpreadsheet,
  Loader2
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
  const [batchMaxVideos, setBatchMaxVideos] = useState<number>(50);

  // Trạng thái xử lý tác vụ (tránh cảm giác đơ/treo ứng dụng)
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [processingMessage, setProcessingMessage] = useState<string>('');
  const [openingBrowserProfileId, setOpeningBrowserProfileId] = useState<string | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isBulkImportOpen, setIsBulkImportOpen] = useState(false);
  const [isDistributeModalOpen, setIsDistributeModalOpen] = useState(false);
  const [isManageGroupsOpen, setIsManageGroupsOpen] = useState(false);
  const [dbGroups, setDbGroups] = useState<string[]>([]);
  const [editingProfile, setEditingProfile] = useState<any | null>(null);
  const [viewingLogsProfile, setViewingLogsProfile] = useState<any | null>(null);
  const [liveLogs, setLiveLogs] = useState<any[]>([]);
  const [queueStats, setQueueStats] = useState<any>({ runningProfiles: [] });

  useEffect(() => {
    loadProfiles();
    loadGroupsList();
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
      loadGroupsList();
    } catch (err: any) {
      toast.error(`Không thể tải profiles: ${err.message}`);
    }
  };

  const loadGroupsList = async () => {
    try {
      const list = await window.api.getGroups();
      if (Array.isArray(list)) {
        setDbGroups(
          list.map((g: any) => (typeof g === 'string' ? g : g?.name)).filter(Boolean)
        );
      }
    } catch (_) {}
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
    if (isProcessing) return;
    if (confirm(`Bạn có chắc chắn muốn xóa profile "${profile.name}"?`)) {
      setIsProcessing(true);
      setProcessingMessage(`Đang xóa profile [${profile.name}]...`);
      try {
        await window.api.deleteProfile(profile.id);
        toast.success(`Đã xóa profile: ${profile.name}`);
        setSelectedProfileIds((prev) => {
          const next = new Set(prev);
          next.delete(profile.id);
          return next;
        });
        await loadProfiles();
      } catch (err: any) {
        toast.error(`Lỗi khi xóa: ${err.message}`);
      } finally {
        setIsProcessing(false);
        setProcessingMessage('');
      }
    }
  };

  const handleOpenBrowser = async (profile: any) => {
    setOpeningBrowserProfileId(profile.id);
    try {
      const res = await window.api.openBrowser(profile.id);
      if (res && typeof res === 'object' && res.alreadyOpen) {
        toast.info(`Trình duyệt của "${profile.name}" đang mở sẵn! Đã chuyển cửa sổ lên trước.`, {
          icon: '🌐'
        });
      } else {
        toast.info(`Đang mở trình duyệt (en-US) cho profile [${profile.name}]...`);
      }
    } catch (err: any) {
      toast.error(`Lỗi mở trình duyệt: ${err.message}`);
    } finally {
      setOpeningBrowserProfileId(null);
    }
  };

  const handleCloseBrowser = async (profile: any) => {
    try {
      await window.api.closeBrowser(profile.id);
      toast.info(`Đã đóng trình duyệt của "${profile.name}".`);
    } catch (err: any) {
      toast.error(`Lỗi đóng trình duyệt: ${err.message}`);
    }
  };

  const handleRunSingle = async (profile: any) => {
    if (!profile.video_folder) {
      toast.error(`Vui lòng chọn thư mục video cho profile [${profile.name}] trước khi chạy!`);
      return;
    }
    const maxLimit = profile.max_videos !== undefined && profile.max_videos !== null ? profile.max_videos : 50;
    const limitText = maxLimit > 0 ? ` (Tối đa ${maxLimit} video)` : ' (Upload toàn bộ video)';
    toast.info(`Đã đưa [${profile.name}] vào hàng đợi upload${limitText}.`);
    try {
      await window.api.startQueue([profile.id]);
      setActiveTab('queue');
    } catch (err: any) {
      toast.error(`Lỗi khởi chạy: ${err.message}`);
    }
  };

  // Chạy các profile được tích chọn
  const handleRunSelected = async () => {
    if (selectedProfileIds.size === 0 || isProcessing) {
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
    const limitInfo = batchMaxVideos > 0 ? ` (Tối đa ${batchMaxVideos} video/kênh)` : ' (Upload toàn bộ video)';
    toast.info(`Bắt đầu chạy cho ${ids.length} kênh đã chọn${limitInfo}...`);
    setIsProcessing(true);
    setProcessingMessage(`Đang chuẩn bị khởi chạy ${ids.length} kênh...`);
    try {
      await window.api.startQueue(ids, { maxVideos: batchMaxVideos });
      setActiveTab('queue');
    } catch (err: any) {
      toast.error(`Lỗi khởi chạy: ${err.message}`);
    } finally {
      setIsProcessing(false);
      setProcessingMessage('');
    }
  };

  // Chạy toàn bộ nhóm hiện tại (hoặc tất cả)
  const handleRunBatch = async () => {
    if (isProcessing) return;
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
    const limitInfo = batchMaxVideos > 0 ? ` (Tối đa ${batchMaxVideos} video/kênh)` : ' (Upload toàn bộ video)';
    toast.info(`Bắt đầu chạy cho ${ids.length} kênh ${selectedGroup !== 'all' ? `(Nhóm: ${selectedGroup})` : ''}${limitInfo}...`);
    setIsProcessing(true);
    setProcessingMessage(`Đang chuẩn bị chạy ${ids.length} kênh...`);
    try {
      await window.api.startQueue(ids, { maxVideos: batchMaxVideos });
      setActiveTab('queue');
    } catch (err: any) {
      toast.error(`Lỗi chạy hàng loạt: ${err.message}`);
    } finally {
      setIsProcessing(false);
      setProcessingMessage('');
    }
  };

  const handleBulkChangeGroup = async (targetGroup: string) => {
    if (!targetGroup || selectedProfileIds.size === 0 || isProcessing) return;
    setIsProcessing(true);
    setProcessingMessage(`Đang chuyển ${selectedProfileIds.size} kênh sang nhóm [${targetGroup}]...`);
    try {
      const ids = Array.from(selectedProfileIds);
      await window.api.bulkUpdateGroup(ids, targetGroup);
      toast.success(`Đã chuyển ${ids.length} kênh sang nhóm [${targetGroup}]`);
      await loadProfiles();
    } catch (err: any) {
      toast.error(`Lỗi chuyển nhóm: ${err.message}`);
    } finally {
      setIsProcessing(false);
      setProcessingMessage('');
    }
  };

  const handleBulkDelete = async () => {
    if (selectedProfileIds.size === 0 || isProcessing) return;
    if (!confirm(`Bạn có chắc chắn muốn xóa ${selectedProfileIds.size} profile đã chọn không?`)) return;
    setIsProcessing(true);
    setProcessingMessage(`Đang xóa ${selectedProfileIds.size} profiles...`);
    try {
      const ids = Array.from(selectedProfileIds);
      await window.api.bulkDeleteProfiles(ids);
      setSelectedProfileIds(new Set());
      toast.success(`Đã xóa ${ids.length} profiles thành công!`);
      await loadProfiles();
    } catch (err: any) {
      toast.error(`Lỗi khi xóa profiles: ${err.message}`);
    } finally {
      setIsProcessing(false);
      setProcessingMessage('');
    }
  };

  const handleExportSelectedTxt = async () => {
    const targetProfiles = selectedProfileIds.size > 0 
      ? profiles.filter((p) => selectedProfileIds.has(p.id))
      : filteredProfiles;

    if (targetProfiles.length === 0) {
      toast.error('Không có tài khoản nào để xuất!');
      return;
    }

    const cleanCookie = (raw: any): string => {
      if (!raw) return '';
      let str = typeof raw === 'string' ? raw.trim() : '';
      if (!str) return '';
      if (str.startsWith('[') || str.startsWith('{')) {
        try {
          const parsed = JSON.parse(str);
          if (Array.isArray(parsed)) {
            const TIKTOK_COOKIE_NAMES = new Set([
              'sessionid', 'sessionid_ss', 'sid_tt', 'sid_guard', 'uid_tt', 'uid_tt_ss',
              'tt_chain_token', 'csrf_token', 'ttwid', 'msToken', 'odin_tt', 'store-country-sign',
              'passport_csrf_token', 'passport_csrf_token_default', 'tt_csrf_token', 's_v_web_id'
            ]);
            const matched = parsed.filter((c: any) => c && c.name && TIKTOK_COOKIE_NAMES.has(c.name));
            const listToUse = matched.length > 0 ? matched : parsed.slice(0, 15);
            return listToUse
              .map((c: any) => `${c.name}=${c.value}`)
              .join('; ')
              .replace(/[\r\n|]/g, ' ')
              .trim();
          }
        } catch (_) {}
      }
      return str.replace(/[\r\n|]/g, ' ').trim();
    };

    const lines = targetProfiles.map((p) => {
      const items = [
        p.account_id || p.name || '',
        p.pass || '',
        p.two_factor || '',
        p.email || '',
        p.pass_email || '',
        p.mail_ao || '',
        p.proxy || '',
        cleanCookie(p.cookies),
        p.group_name || 'Mặc định'
      ];
      return items.join('|');
    });

    const header = '# Username|Password|2FA|Email|Pass_Email|Mail_Ao|Proxy|Cookie|Nhom';
    const clipboardContent = [header, ...lines].join('\n');
    await navigator.clipboard.writeText(clipboardContent).catch(() => {});

    try {
      const res = await window.api.exportAccounts(targetProfiles);
      if (res.success && res.filePath) {
        const fileName = res.filePath.split(/[/\\]/).pop();
        const typeLabel = res.format === 'csv' ? 'Excel CSV' : (res.format === 'json' ? 'JSON' : 'TXT');
        toast.success(`Đã xuất ${targetProfiles.length} tài khoản ra file [${fileName}] (${typeLabel}) & copy vào clipboard!`);
      } else if (!res.canceled) {
        toast.success(`Đã copy ${targetProfiles.length} tài khoản vào clipboard!`);
      }
    } catch (_) {
      toast.success(`Đã copy ${targetProfiles.length} tài khoản vào clipboard!`);
    }
  };

  const handleExportJson = async () => {
    try {
      setIsProcessing(true);
      setProcessingMessage('Đang xuất danh sách profiles ra file JSON...');
      const res = await window.api.exportJson();
      if (res.success && res.filePath) {
        const fileName = res.filePath.split(/[/\\]/).pop();
        toast.success(`Đã xuất thành công file backup JSON [${fileName}]!`);
      }
    } catch (err: any) {
      toast.error(`Lỗi xuất JSON: ${err.message}`);
    } finally {
      setIsProcessing(false);
      setProcessingMessage('');
    }
  };

  const handleImportJson = async () => {
    try {
      setIsProcessing(true);
      setProcessingMessage('Đang nạp danh sách profiles từ file JSON...');
      const res = await window.api.importJson();
      if (res.success) {
        toast.success(`Đã nạp thành công ${res.count || 0} profiles từ file JSON!`);
        if (res.profiles) {
          setProfiles(res.profiles);
        } else {
          await loadProfiles();
        }
        await loadGroupsList();
      }
    } catch (err: any) {
      toast.error(`Lỗi nhập JSON: ${err.message}`);
    } finally {
      setIsProcessing(false);
      setProcessingMessage('');
    }
  };

  const handleQuickSelectFolder = async (profile: any) => {
    try {
      const folder = await window.api.selectFolder();
      if (folder) {
        await window.api.updateProfile({ ...profile, video_folder: folder });
        toast.success(`Đã gán folder video cho kênh [${profile.name}]`);
        await loadProfiles();
      }
    } catch (err: any) {
      toast.error(`Lỗi chọn folder: ${err.message}`);
    }
  };

  // Trích xuất danh sách các nhóm duy nhất (luôn đảm bảo là mảng chuỗi)
  const groups = useMemo(() => {
    const rawList: any[] = [
      'Mặc định',
      ...dbGroups,
      ...profiles.map((p) => p.group_name || 'Mặc định')
    ];
    const stringNames = rawList
      .map((g) => (typeof g === 'object' && g !== null ? g.name : g))
      .filter((g): g is string => typeof g === 'string' && g.trim().length > 0);
    return Array.from(new Set(stringNames));
  }, [dbGroups, profiles]);

  // Tự động đồng bộ selectedGroup nếu nhóm bị xóa hoặc không còn tồn tại
  useEffect(() => {
    if (selectedGroup !== 'all' && groups.length > 0 && !groups.includes(selectedGroup)) {
      setSelectedGroup('all');
    }
  }, [groups, selectedGroup]);

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
        onBulkImport={() => setIsBulkImportOpen(true)}
        totalProfiles={profiles.length}
        runningCount={runningCount}
      />

      {/* Main Container */}
      <main className="flex-1 p-3 sm:p-5 max-w-[1600px] mx-auto w-full">
        {/* TAB 1: KÊNH & PROFILES */}
        {activeTab === 'profiles' && (
          <div className="space-y-3.5">
            {/* Filter & Selection Toolbar */}
            <div className="bg-white p-3 rounded-xl border border-slate-200/90 shadow-sm space-y-2.5">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
                {/* Search Input */}
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-2 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Tìm theo tên kênh, email, ID tài khoản..."
                    className="w-full pl-9 pr-3 h-8 text-xs rounded-lg border border-slate-200 bg-slate-50/70 text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-sky-500 focus:bg-white transition-all"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                {/* Group Selector Dropdown & Chia Đều Video */}
                <div className="flex items-center gap-2 shrink-0">
                  <div className="flex items-center gap-1.5 text-xs text-slate-500 bg-slate-50 px-2.5 h-8 rounded-lg border border-slate-200 font-medium">
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

                  {/* Nút Quản lý nhóm */}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsManageGroupsOpen(true)}
                    title="Quản lý danh sách nhóm, thêm mới hoặc đổi tên nhóm"
                    className="h-8 text-xs border-slate-200 text-slate-700 bg-white hover:bg-slate-50 shrink-0 px-2.5"
                  >
                    <Users className="h-3.5 w-3.5 mr-1 text-slate-500" /> Quản Lý Nhóm
                  </Button>

                  {/* Nút Chia Đều Video */}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsDistributeModalOpen(true)}
                    title="Tự động chia đều danh sách video từ 1 thư mục cho các kênh"
                    className="h-8 text-xs border-sky-300 text-sky-700 bg-sky-50/60 hover:bg-sky-100/80 shrink-0 px-2.5"
                  >
                    <Shuffle className="h-3.5 w-3.5 mr-1 text-sky-600" /> Chia Đều Video
                  </Button>

                  {/* Nút Xuất Danh Sách File (CSV / TXT / JSON) */}
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={isProcessing || filteredProfiles.length === 0}
                    onClick={handleExportSelectedTxt}
                    title="Xuất danh sách tài khoản ra file Excel CSV, TXT (chuẩn MMO) hoặc JSON"
                    className="h-8 text-xs border-emerald-300 text-emerald-700 bg-emerald-50/60 hover:bg-emerald-100/80 shrink-0 px-2.5"
                  >
                    <FileSpreadsheet className="h-3.5 w-3.5 mr-1 text-emerald-600" /> Xuất File ({filteredProfiles.length})
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

                <div className="flex items-center gap-2 flex-wrap">
                  {/* Nếu đã chọn >= 1 profile: Các thao tác hàng loạt MMO */}
                  {selectedProfileIds.size > 0 ? (
                    <>
                      {/* Chuyển nhóm hàng loạt */}
                      <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-lg px-2 h-8 text-xs">
                        <FolderInput className="h-3.5 w-3.5 text-slate-400" />
                        <span className="text-slate-500 font-medium hidden sm:inline">Chuyển sang:</span>
                        <select
                          defaultValue=""
                          disabled={isProcessing}
                          onChange={(e) => {
                            if (e.target.value) {
                              handleBulkChangeGroup(e.target.value);
                              e.target.value = '';
                            }
                          }}
                          className="bg-transparent text-slate-800 font-bold focus:outline-none cursor-pointer text-xs disabled:opacity-50"
                        >
                          <option value="" disabled>Nhóm...</option>
                          {groups.map((g) => (
                            <option key={g} value={g}>{g}</option>
                          ))}
                        </select>
                      </div>

                      {/* Xuất File Excel CSV / TXT / JSON các kênh đang chọn */}
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={isProcessing}
                        onClick={handleExportSelectedTxt}
                        title="Xuất file Excel CSV, TXT (chuẩn MMO) hoặc JSON các kênh đang chọn"
                        className="h-8 text-xs border-emerald-300 text-emerald-700 bg-emerald-50/60 hover:bg-emerald-100/80 px-2.5 disabled:opacity-50"
                      >
                        <FileSpreadsheet className="h-3.5 w-3.5 mr-1 text-emerald-600" /> Xuất Đã Chọn ({selectedProfileIds.size})
                      </Button>

                      {/* Xóa hàng loạt */}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleBulkDelete}
                        disabled={isProcessing}
                        title="Xóa các profile đang chọn"
                        className="h-8 text-xs border-rose-300 text-rose-700 bg-rose-50/60 hover:bg-rose-100/80 px-2.5 disabled:opacity-50"
                      >
                        {isProcessing ? (
                          <Loader2 className="h-3.5 w-3.5 mr-1 text-rose-600 animate-spin" />
                        ) : (
                          <Trash2 className="h-3.5 w-3.5 mr-1 text-rose-600" />
                        )}
                        {isProcessing ? 'Đang xóa...' : 'Xóa'}
                      </Button>

                      <div className="h-4 w-[1px] bg-slate-200 mx-1" />

                      {/* Ô chỉnh giới hạn upload tối đa */}
                      <div
                        className="flex items-center gap-1.5 text-xs text-slate-600 bg-slate-50 border border-slate-200/90 px-2 py-1 rounded-lg"
                        title="Số video tối đa upload mỗi kênh trong đợt chạy này. Nhập 0 nếu muốn upload toàn bộ video có trong folder."
                      >
                        <span className="font-medium text-[11px] text-slate-500">Tối đa:</span>
                        <input
                          type="number"
                          min={0}
                          max={999}
                          value={batchMaxVideos}
                          disabled={isProcessing}
                          onChange={(e) => setBatchMaxVideos(Math.max(0, parseInt(e.target.value) || 0))}
                          className="w-10 h-6 text-center text-xs font-bold text-sky-700 bg-white border border-slate-200 rounded focus:outline-none focus:border-sky-500 disabled:opacity-50"
                        />
                        <span className="text-[11px] text-slate-400">vid/kênh</span>
                      </div>

                      <button
                        onClick={handleClearSelection}
                        disabled={isProcessing}
                        className="text-xs text-slate-500 hover:text-slate-700 px-1.5 py-1 disabled:opacity-50"
                      >
                        Hủy chọn
                      </button>

                      <Button
                        variant="default"
                        size="sm"
                        onClick={handleRunSelected}
                        disabled={isProcessing}
                        className="h-8 text-xs shadow-sm shadow-sky-500/30 disabled:opacity-50"
                      >
                        {isProcessing ? (
                          <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                        ) : (
                          <Play className="h-3.5 w-3.5 mr-1 fill-current" />
                        )}
                        Chạy {selectedProfileIds.size} Kênh
                      </Button>
                    </>
                  ) : (
                    /* Nếu chưa chọn profile nào: Nút chạy toàn bộ nhóm */
                    <>
                      <div
                        className="flex items-center gap-1.5 text-xs text-slate-600 bg-slate-50 border border-slate-200/90 px-2 py-1 rounded-lg"
                        title="Số video tối đa upload mỗi kênh trong đợt chạy này. Nhập 0 nếu muốn upload toàn bộ video có trong folder."
                      >
                        <span className="font-medium text-[11px] text-slate-500">Tối đa:</span>
                        <input
                          type="number"
                          min={0}
                          max={999}
                          value={batchMaxVideos}
                          disabled={isProcessing}
                          onChange={(e) => setBatchMaxVideos(Math.max(0, parseInt(e.target.value) || 0))}
                          className="w-10 h-6 text-center text-xs font-bold text-sky-700 bg-white border border-slate-200 rounded focus:outline-none focus:border-sky-500 disabled:opacity-50"
                        />
                        <span className="text-[11px] text-slate-400">vid/kênh</span>
                      </div>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleRunBatch}
                        disabled={filteredProfiles.length === 0 || runningCount > 0 || isProcessing}
                        className="h-8 text-xs border-sky-300 text-sky-700 hover:bg-sky-50 font-medium disabled:opacity-50"
                      >
                        {isProcessing ? (
                          <Loader2 className="h-3.5 w-3.5 mr-1 text-sky-500 animate-spin" />
                        ) : (
                          <Play className="h-3.5 w-3.5 mr-1 fill-current text-sky-500" />
                        )}
                        Chạy Toàn Bộ {selectedGroup === 'all' ? 'Tất Cả Kênh' : `Nhóm [${selectedGroup}]`}
                      </Button>
                    </>
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
                  Bắt đầu ngay bằng cách nhập danh sách tài khoản hàng loạt từ file TXT hoặc tạo từng profile.
                </p>
                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsBulkImportOpen(true)}
                    className="border-sky-300 bg-sky-50/60 hover:bg-sky-100 text-sky-700 text-xs font-semibold"
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" /> Nhập Hàng Loạt (TXT)
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
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-4 gap-3">
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
                    onCloseBrowser={() => handleCloseBrowser(profile)}
                    onRunUpload={() => handleRunSingle(profile)}
                    onViewLogs={() => setViewingLogsProfile(profile)}
                    onQuickSelectFolder={() => handleQuickSelectFolder(profile)}
                    isRunning={queueStats.runningProfiles?.includes(profile.id)}
                    isOpeningBrowser={openingBrowserProfileId === profile.id}
                    isProcessing={isProcessing}
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
            totalProfiles={profiles.length}
            onExportJson={handleExportJson}
            onImportJson={handleImportJson}
            isProcessing={isProcessing}
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

      {/* Quản lý danh sách nhóm Modal */}
      <ManageGroupsModal
        isOpen={isManageGroupsOpen}
        onClose={() => setIsManageGroupsOpen(false)}
        onGroupsUpdated={(info) => {
          if (info?.updatedProfiles && Array.isArray(info.updatedProfiles)) {
            setProfiles(info.updatedProfiles);
          } else {
            loadProfiles();
          }
          if (info?.updatedGroups && Array.isArray(info.updatedGroups)) {
            setDbGroups(
              info.updatedGroups
                .map((g: any) => (typeof g === 'string' ? g : g?.name))
                .filter(Boolean)
            );
          } else {
            loadGroupsList();
          }
          if (info?.renamedFrom && selectedGroup === info.renamedFrom) {
            setSelectedGroup(info.renamedTo || 'all');
          }
        }}
      />

      {/* Bulk Import Modal từ file TXT */}
      <BulkImportModal
        isOpen={isBulkImportOpen}
        onClose={() => setIsBulkImportOpen(false)}
        availableGroups={groups}
        onSuccess={(updatedProfiles) => {
          if (updatedProfiles) {
            setProfiles(updatedProfiles);
          } else {
            loadProfiles();
          }
          loadGroupsList();
        }}
      />

      {/* Floating Processing Banner - Phản hồi tức thì khi thực hiện tác vụ nặng */}
      {isProcessing && (
        <div className="fixed bottom-5 right-5 z-50 bg-slate-900/90 text-white px-4 py-2.5 rounded-xl shadow-2xl border border-slate-700/80 backdrop-blur-md flex items-center gap-2.5 text-xs animate-in fade-in slide-in-from-bottom-2">
          <Loader2 className="h-4 w-4 text-sky-400 animate-spin shrink-0" />
          <span className="font-semibold text-slate-100">{processingMessage || 'Đang xử lý dữ liệu...'}</span>
        </div>
      )}
    </div>
  );
};
