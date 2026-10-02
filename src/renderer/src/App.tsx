import {
  CheckSquare,
  Clock,
  FileJson,
  Filter,
  FolderInput,
  Loader2,
  Play,
  Search,
  Shuffle,
  Sparkles,
  Square,
  Trash2,
  Users,
  X,
} from "lucide-react";
import React, { useEffect, useMemo, useState } from "react";
import { toast, Toaster } from "sonner";
import { AppHeader, TabType } from "./components/AppHeader";
import {
  BatchSummaryModal,
  BatchVideoResult,
} from "./components/BatchSummaryModal";
import { BulkImportModal } from "./components/BulkImportModal";
import {
  CooldownBatchItem,
  CooldownBatchModal,
} from "./components/CooldownBatchModal";
import { CooldownGuideModal } from "./components/CooldownGuideModal";
import { DistributeVideosModal } from "./components/DistributeVideosModal";
import { FloatingProgressWidget } from "./components/FloatingProgressWidget";
import { FollowersModal } from "./components/FollowersModal";
import { LogsDrawer } from "./components/LogsDrawer";
import { LogsScreen } from "./components/LogsScreen";
import { ManageGroupsModal } from "./components/ManageGroupsModal";
import { ProfileCard } from "./components/ProfileCard";
import { ProfileModal } from "./components/ProfileModal";
import { QueueScreen } from "./components/QueueScreen";
import { SettingsScreen } from "./components/SettingsScreen";
import { Badge } from "./components/ui/Badge";
import { Button } from "./components/ui/Button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./components/ui/Select";
import { getCooldownStatus, isNurturingGroup } from "./utils/cooldown";

export const App: React.FC = () => {
  const [profiles, setProfiles] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<TabType>("profiles");
  const [selectedGroup, setSelectedGroup] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedProfileIds, setSelectedProfileIds] = useState<Set<string>>(
    new Set(),
  );
  const [concurrency, setConcurrency] = useState<number>(2);

  // Trạng thái xử lý tác vụ (tránh cảm giác đơ/treo ứng dụng)
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [processingMessage, setProcessingMessage] = useState<string>("");
  const [openingBrowserProfileId, setOpeningBrowserProfileId] = useState<
    string | null
  >(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isFollowersModalOpen, setIsFollowersModalOpen] = useState(false);
  const [isBulkImportOpen, setIsBulkImportOpen] = useState(false);
  const [isDistributeModalOpen, setIsDistributeModalOpen] = useState(false);
  const [isManageGroupsOpen, setIsManageGroupsOpen] = useState(false);
  const [isCooldownGuideOpen, setIsCooldownGuideOpen] = useState(false);
  const [cooldownBatchData, setCooldownBatchData] = useState<{
    isOpen: boolean;
    cooldownProfiles: CooldownBatchItem[];
    safeCount: number;
    totalCount: number;
    pendingIdsAll: string[];
    pendingIdsSafeOnly: string[];
    contextTitle: string;
  }>({
    isOpen: false,
    cooldownProfiles: [],
    safeCount: 0,
    totalCount: 0,
    pendingIdsAll: [],
    pendingIdsSafeOnly: [],
    contextTitle: "",
  });
  const [dbGroups, setDbGroups] = useState<string[]>([]);
  const [editingProfile, setEditingProfile] = useState<any | null>(null);
  const [viewingLogsProfile, setViewingLogsProfile] = useState<any | null>(
    null,
  );
  const [liveLogs, setLiveLogs] = useState<any[]>([]);
  const [queueStats, setQueueStats] = useState<any>({ runningProfiles: [] });
  const [batchTracking, setBatchTracking] = useState<{
    isActive: boolean;
    startTime: Date | null;
    endTime: Date | null;
    totalProfilesCount: number;
    totalVideos: number;
    processedVideos: number;
    successVideos: number;
    failedVideos: number;
    results: BatchVideoResult[];
    showSummaryModal: boolean;
  }>({
    isActive: false,
    startTime: null,
    endTime: null,
    totalProfilesCount: 0,
    totalVideos: 0,
    processedVideos: 0,
    successVideos: 0,
    failedVideos: 0,
    results: [],
    showSummaryModal: false,
  });

  useEffect(() => {
    loadProfiles();
    loadGroupsList();
    loadConcurrency();

    // Lắng nghe sự kiện upload progress từ Main process
    const unsubscribeProgress = window.api.onUploadProgress((event) => {
      setLiveLogs((prev) => [event, ...prev].slice(0, 150));

      setBatchTracking((prev) => {
        let updatedResults = [...prev.results];
        let newSuccess = prev.successVideos;
        let newFailed = prev.failedVideos;
        let newProcessed = prev.processedVideos;
        let newTotal = Math.max(prev.totalVideos, event.totalVideos || 0);

        // Bắt sự kiện video hoàn thành
        if (
          event.videoName &&
          event.type === "success" &&
          (event.message?.includes("Hoàn thành xuất sắc") ||
            event.step === "SUBMITTING")
        ) {
          const alreadyRecorded = updatedResults.some(
            (r) =>
              r.profileId === event.profileId &&
              r.videoName === event.videoName &&
              r.status === "success",
          );
          if (!alreadyRecorded) {
            updatedResults.push({
              profileId: event.profileId,
              profileName: event.profileName || "",
              videoName: event.videoName,
              status: "success",
              timestamp: new Date().toISOString(),
            });
            newSuccess++;
            newProcessed++;
          }
        } else if (
          event.videoName &&
          event.type === "error" &&
          (event.message?.includes("Bỏ qua video") || event.failedCount > 0)
        ) {
          const alreadyRecorded = updatedResults.some(
            (r) =>
              r.profileId === event.profileId &&
              r.videoName === event.videoName &&
              r.status === "failed",
          );
          if (!alreadyRecorded) {
            updatedResults.push({
              profileId: event.profileId,
              profileName: event.profileName || "",
              videoName: event.videoName,
              status: "failed",
              errorMessage: event.message,
              timestamp: new Date().toISOString(),
            });
            newFailed++;
            newProcessed++;
          }
        }

        const isQueueFinished =
          event.step === "QUEUE_COMPLETED" || event.step === "QUEUE_STOPPED";

        return {
          ...prev,
          isActive: isQueueFinished ? false : prev.isActive,
          endTime: isQueueFinished ? new Date() : prev.endTime,
          totalVideos: newTotal,
          processedVideos: newProcessed,
          successVideos: newSuccess,
          failedVideos: newFailed,
          results: updatedResults,
          showSummaryModal:
            isQueueFinished && updatedResults.length > 0
              ? true
              : prev.showSummaryModal,
        };
      });

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
          list
            .map((g: any) => (typeof g === "string" ? g : g?.name))
            .filter(Boolean),
        );
      }
    } catch (_) {}
  };

  const loadConcurrency = async () => {
    try {
      const c = await window.api.getConcurrency();
      if (typeof c === "number" && c > 0) {
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
        setProcessingMessage("");
      }
    }
  };

  const handleOpenBrowser = async (profile: any) => {
    setOpeningBrowserProfileId(profile.id);
    try {
      const res = await window.api.openBrowser(profile.id);
      if (res && typeof res === "object" && res.alreadyOpen) {
        toast.info(
          `Trình duyệt của "${profile.name}" đang mở sẵn! Đã chuyển cửa sổ lên trước.`,
          {
            icon: "🌐",
          },
        );
      } else {
        toast.info(
          `Đang mở trình duyệt (en-US) cho profile [${profile.name}]...`,
        );
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
      toast.error(
        `Vui lòng chọn thư mục video cho profile [${profile.name}] trước khi chạy!`,
      );
      return;
    }

    const cd = getCooldownStatus(profile.last_run, profile.group_name);
    if (cd.isUnderCooldown) {
      const proceed = window.confirm(
        `⚠️ CẢNH BÁO KÊNH ĐANG NUÔI:\n\nKênh "${profile.name}" mới đăng video cách đây ${cd.elapsedHours} giờ (còn ${cd.remainingText} nữa mới đủ 24h an toàn).\n\nĐăng sớm có thể bị thuật toán TikTok giảm tương tác hoặc dính lỗi spam.\n\nBạn có chắc chắn muốn TIẾP TỤC ĐĂNG ngay không?`,
      );
      if (!proceed) return;
    }

    toast.info(`Đã đưa [${profile.name}] vào hàng đợi upload.`);
    setBatchTracking({
      isActive: true,
      startTime: new Date(),
      endTime: null,
      totalProfilesCount: 1,
      totalVideos: 0,
      processedVideos: 0,
      successVideos: 0,
      failedVideos: 0,
      results: [],
      showSummaryModal: false,
    });
    try {
      await window.api.startQueue([profile.id]);
      setActiveTab("queue");
    } catch (err: any) {
      toast.error(`Lỗi khởi chạy: ${err.message}`);
    }
  };

  // Helper thực thi startQueue dùng chung
  const startQueueExecution = async (ids: string[], titleContext: string) => {
    if (ids.length === 0) {
      toast.info("Không có kênh nào để chạy.");
      return;
    }
    toast.info(`Bắt đầu chạy cho ${ids.length} kênh ${titleContext}...`);
    setIsProcessing(true);
    setProcessingMessage(`Đang chuẩn bị chạy ${ids.length} kênh...`);
    setBatchTracking({
      isActive: true,
      startTime: new Date(),
      endTime: null,
      totalProfilesCount: ids.length,
      totalVideos: 0,
      processedVideos: 0,
      successVideos: 0,
      failedVideos: 0,
      results: [],
      showSummaryModal: false,
    });
    try {
      await window.api.startQueue(ids);
      setActiveTab("queue");
    } catch (err: any) {
      toast.error(`Lỗi khởi chạy: ${err.message}`);
    } finally {
      setIsProcessing(false);
      setProcessingMessage("");
    }
  };

  // Callback xác nhận từ CooldownBatchModal: Vẫn chạy tất cả
  const handleConfirmRunAllFromCooldown = () => {
    const ids = cooldownBatchData.pendingIdsAll;
    const title = cooldownBatchData.contextTitle;
    setCooldownBatchData((prev) => ({ ...prev, isOpen: false }));
    startQueueExecution(ids, `${title} (vượt qua cảnh báo 24h)`);
  };

  // Callback xác nhận từ CooldownBatchModal: Chỉ chạy kênh an toàn
  const handleConfirmRunSafeOnlyFromCooldown = () => {
    const ids = cooldownBatchData.pendingIdsSafeOnly;
    const title = cooldownBatchData.contextTitle;
    setCooldownBatchData((prev) => ({ ...prev, isOpen: false }));
    startQueueExecution(ids, `${title} (chỉ các kênh đã đủ 24h)`);
  };

  // Chạy hàng loạt các profile được tick chọn
  const handleRunSelected = async () => {
    if (isProcessing) return;
    if (selectedProfileIds.size === 0) {
      toast.warning("Vui lòng chọn ít nhất 1 profile để chạy hàng loạt!");
      return;
    }

    const selectedProfiles = profiles.filter((p) =>
      selectedProfileIds.has(p.id),
    );
    const readyProfiles = selectedProfiles.filter((p) => p.video_folder);
    const missingProfiles = selectedProfiles.filter((p) => !p.video_folder);

    if (readyProfiles.length === 0) {
      toast.error(
        `Các profiles đã chọn đều chưa có thư mục video: ${selectedProfiles.map((p) => p.name).join(", ")}`,
      );
      return;
    }

    if (missingProfiles.length > 0) {
      toast.warning(
        `Bỏ qua ${missingProfiles.length} kênh chưa chọn thư mục video: ${missingProfiles.map((p) => p.name).join(", ")}`,
      );
    }

    // Kiểm tra Cooldown 24h cho các kênh đang nuôi
    const nurturingUnderCooldown = readyProfiles.filter((p) => {
      const cd = getCooldownStatus(p.last_run, p.group_name);
      return cd.isUnderCooldown;
    });

    const safeProfiles = readyProfiles.filter((p) => {
      const cd = getCooldownStatus(p.last_run, p.group_name);
      return !cd.isUnderCooldown;
    });

    if (nurturingUnderCooldown.length > 0) {
      setCooldownBatchData({
        isOpen: true,
        cooldownProfiles: nurturingUnderCooldown.map((p) => {
          const cd = getCooldownStatus(p.last_run, p.group_name);
          return {
            name: p.name,
            groupName: p.group_name,
            remainingText: cd.remainingText,
            elapsedHours: cd.elapsedHours,
          };
        }),
        safeCount: safeProfiles.length,
        totalCount: readyProfiles.length,
        pendingIdsAll: readyProfiles.map((p) => p.id),
        pendingIdsSafeOnly: safeProfiles.map((p) => p.id),
        contextTitle: "đã chọn",
      });
      return;
    }

    await startQueueExecution(
      readyProfiles.map((p) => p.id),
      "đã chọn",
    );
  };

  // Chạy toàn bộ nhóm hiện tại (Có kiểm tra Cooldown 24h)
  const handleRunBatch = async () => {
    if (isProcessing) return;
    const pool =
      selectedGroup === "all"
        ? profiles
        : profiles.filter(
            (p) => (p.group_name || "Mặc định") === selectedGroup,
          );

    const readyProfiles = pool.filter((p) => p.video_folder);
    const missingProfiles = pool.filter((p) => !p.video_folder);

    if (readyProfiles.length === 0) {
      toast.error(
        `Chưa có profile nào ${selectedGroup !== "all" ? `trong nhóm [${selectedGroup}]` : ""} được gán thư mục video hợp lệ!`,
      );
      return;
    }

    if (missingProfiles.length > 0) {
      toast.warning(
        `Bỏ qua ${missingProfiles.length} kênh trong nhóm chưa có thư mục video: ${missingProfiles.map((p) => p.name).join(", ")}`,
      );
    }

    // Kiểm tra Cooldown 24h cho các kênh đang nuôi
    const nurturingUnderCooldown = readyProfiles.filter((p) => {
      const cd = getCooldownStatus(p.last_run, p.group_name);
      return cd.isUnderCooldown;
    });

    const safeProfiles = readyProfiles.filter((p) => {
      const cd = getCooldownStatus(p.last_run, p.group_name);
      return !cd.isUnderCooldown;
    });

    const groupContextTitle =
      selectedGroup !== "all" ? `(Nhóm: ${selectedGroup})` : "toàn bộ";

    if (nurturingUnderCooldown.length > 0) {
      setCooldownBatchData({
        isOpen: true,
        cooldownProfiles: nurturingUnderCooldown.map((p) => {
          const cd = getCooldownStatus(p.last_run, p.group_name);
          return {
            name: p.name,
            groupName: p.group_name,
            remainingText: cd.remainingText,
            elapsedHours: cd.elapsedHours,
          };
        }),
        safeCount: safeProfiles.length,
        totalCount: readyProfiles.length,
        pendingIdsAll: readyProfiles.map((p) => p.id),
        pendingIdsSafeOnly: safeProfiles.map((p) => p.id),
        contextTitle: groupContextTitle,
      });
      return;
    }

    await startQueueExecution(
      readyProfiles.map((p) => p.id),
      groupContextTitle,
    );
  };

  const handleBulkChangeGroup = async (targetGroup: string) => {
    if (!targetGroup || selectedProfileIds.size === 0 || isProcessing) return;
    setIsProcessing(true);
    setProcessingMessage(
      `Đang chuyển ${selectedProfileIds.size} kênh sang nhóm [${targetGroup}]...`,
    );
    try {
      const ids = Array.from(selectedProfileIds);
      await window.api.bulkUpdateGroup(ids, targetGroup);
      toast.success(`Đã chuyển ${ids.length} kênh sang nhóm [${targetGroup}]`);
      await loadProfiles();
    } catch (err: any) {
      toast.error(`Lỗi chuyển nhóm: ${err.message}`);
    } finally {
      setIsProcessing(false);
      setProcessingMessage("");
    }
  };

  const handleBulkDelete = async () => {
    if (selectedProfileIds.size === 0 || isProcessing) return;
    if (
      !confirm(
        `Bạn có chắc chắn muốn xóa ${selectedProfileIds.size} profile đã chọn không?`,
      )
    )
      return;
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
      setProcessingMessage("");
    }
  };

  const handleExportJson = async (customProfiles?: any[]) => {
    try {
      const targetProfiles =
        customProfiles ||
        (selectedProfileIds.size > 0
          ? profiles.filter((p) => selectedProfileIds.has(p.id))
          : filteredProfiles);

      if (targetProfiles.length === 0) {
        toast.error("Không có tài khoản nào để xuất!");
        return;
      }

      setIsProcessing(true);
      setProcessingMessage(
        `Đang xuất ${targetProfiles.length} profiles ra file JSON...`,
      );
      const res = await window.api.exportJson(targetProfiles);
      if (res.success && res.filePath) {
        const fileName = res.filePath.split(/[/\\]/).pop();
        toast.success(
          `Đã xuất thành công ${targetProfiles.length} profiles ra file JSON [${fileName}]!`,
        );
      }
    } catch (err: any) {
      toast.error(`Lỗi xuất JSON: ${err.message}`);
    } finally {
      setIsProcessing(false);
      setProcessingMessage("");
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
      "Mặc định",
      ...dbGroups,
      ...profiles.map((p) => p.group_name || "Mặc định"),
    ];
    const stringNames = rawList
      .map((g) => (typeof g === "object" && g !== null ? g.name : g))
      .filter((g): g is string => typeof g === "string" && g.trim().length > 0);
    return Array.from(new Set(stringNames));
  }, [dbGroups, profiles]);

  // Tự động đồng bộ selectedGroup nếu nhóm bị xóa hoặc không còn tồn tại
  useEffect(() => {
    if (
      selectedGroup !== "all" &&
      groups.length > 0 &&
      !groups.includes(selectedGroup)
    ) {
      setSelectedGroup("all");
    }
  }, [groups, selectedGroup]);

  // Lọc profiles theo nhóm & từ khóa tìm kiếm
  const filteredProfiles = useMemo(() => {
    return profiles.filter((p) => {
      // Lọc theo nhóm
      if (
        selectedGroup !== "all" &&
        (p.group_name || "Mặc định") !== selectedGroup
      ) {
        return false;
      }
      // Lọc theo từ khóa tìm kiếm (tên, email, account_id)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = (p.name || "").toLowerCase().includes(q);
        const matchAccount = (p.account_id || "").toLowerCase().includes(q);
        const matchEmail = (p.email || "").toLowerCase().includes(q);
        const matchMailAo = (p.mail_ao || "").toLowerCase().includes(q);
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
  const isAllFilteredSelected =
    filteredProfiles.length > 0 &&
    filteredProfiles.every((p) => selectedProfileIds.has(p.id));

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
    <div className="flex min-h-screen flex-col bg-slate-50 font-sans text-slate-900">
      <Toaster position="top-right" theme="light" richColors closeButton />

      {/* Header with Navigation Tabs & Luồng Quick Picker */}
      <AppHeader
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onAddProfile={() => {
          setEditingProfile(null);
          setIsModalOpen(true);
        }}
        onBulkImport={() => setIsBulkImportOpen(true)}
        onCooldownGuide={() => setIsCooldownGuideOpen(true)}
        totalProfiles={profiles.length}
        runningCount={runningCount}
      />

      {/* Main Container */}
      <main className="mx-auto w-full max-w-[1600px] flex-1 p-3 sm:p-5">
        {/* TAB 1: KÊNH & PROFILES */}
        {activeTab === "profiles" && (
          <div className="space-y-3.5">
            {/* Filter & Selection Toolbar */}
            <div className="space-y-2.5 rounded-xl border border-slate-200/90 bg-white p-3 shadow-sm">
              <div className="flex flex-col items-stretch justify-between gap-2.5 sm:flex-row sm:items-center">
                {/* Search Input */}
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-2 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Tìm theo tên kênh, email, ID tài khoản..."
                    className="h-8 w-full rounded-lg border border-slate-200 bg-slate-50/70 pl-9 pr-3 text-xs text-slate-800 transition-all placeholder:text-slate-400 focus:border-sky-500 focus:bg-white focus:outline-none"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery("")}
                      className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                {/* Group Selector Dropdown & Chia Đều Video */}
                <div className="flex shrink-0 items-center gap-2">
                  <div className="flex items-center">
                    <Select
                      value={selectedGroup}
                      onValueChange={(val) => setSelectedGroup(val)}
                    >
                      <SelectTrigger className="h-8 min-w-[140px] border-slate-200 bg-slate-50 text-xs">
                        <Filter className="mr-1.5 h-3.5 w-3.5 shrink-0 text-sky-500" />
                        <span className="mr-1 text-slate-500">Nhóm:</span>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">
                          Tất cả ({profiles.length})
                        </SelectItem>
                        {groups.map((grp) => {
                          const count = profiles.filter(
                            (p) => (p.group_name || "Mặc định") === grp,
                          ).length;
                          return (
                            <SelectItem key={grp} value={grp}>
                              {grp} ({count})
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Huy hiệu cảnh báo nhóm nuôi nếu đang lọc nhóm nuôi */}
                  {selectedGroup !== "all" &&
                    isNurturingGroup(selectedGroup) && (
                      <button
                        onClick={() => setIsCooldownGuideOpen(true)}
                        className="shadow-xs flex h-8 shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-2.5 text-xs font-semibold text-amber-900 transition-colors hover:bg-amber-100"
                        title="Nhóm này được nhận diện là kênh nuôi (Bảo vệ 24h). Nhấn để xem hướng dẫn chi tiết."
                      >
                        <Clock className="h-3.5 w-3.5 animate-pulse text-amber-600" />
                        <span>Kênh Nuôi (24h)</span>
                      </button>
                    )}

                  {/* Nút Quản lý nhóm */}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsManageGroupsOpen(true)}
                    title="Quản lý danh sách nhóm, thêm mới hoặc đổi tên nhóm"
                    className="h-8 shrink-0 border-slate-200 bg-white px-2.5 text-xs text-slate-700 hover:bg-slate-50"
                  >
                    <Users className="mr-1 h-3.5 w-3.5 text-slate-500" /> Quản
                    Lý Nhóm
                  </Button>

                  {/* Nút Chia Đều Video */}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsDistributeModalOpen(true)}
                    title="Tự động chia đều danh sách video từ 1 thư mục cho các kênh"
                    className="h-8 shrink-0 border-sky-300 bg-sky-50/60 px-2.5 text-xs text-sky-700 hover:bg-sky-100/80"
                  >
                    <Shuffle className="mr-1 h-3.5 w-3.5 text-sky-600" /> Chia
                    Đều Video
                  </Button>

                  {/* Nút Xuất JSON */}
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={isProcessing || filteredProfiles.length === 0}
                    onClick={() => handleExportJson()}
                    title="Xuất danh sách profiles ra file JSON an toàn, đầy đủ cookies"
                    className="h-8 shrink-0 border-emerald-300 bg-emerald-50/60 px-2.5 text-xs text-emerald-700 hover:bg-emerald-100/80"
                  >
                    <FileJson className="mr-1 h-3.5 w-3.5 text-emerald-600" />{" "}
                    Xuất JSON ({filteredProfiles.length})
                  </Button>
                </div>
              </div>

              {/* Selection Bar & Batch Run Actions */}
              <div className="flex flex-wrap items-center justify-between gap-2.5 border-t border-slate-100 pt-2">
                <div className="flex items-center gap-3">
                  {/* Checkbox Chọn tất cả */}
                  <button
                    onClick={handleToggleSelectAll}
                    disabled={filteredProfiles.length === 0}
                    className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 transition-colors hover:text-slate-900 disabled:opacity-50"
                  >
                    {isAllFilteredSelected ? (
                      <CheckSquare className="h-4 w-4 text-sky-500" />
                    ) : (
                      <Square className="h-4 w-4 text-slate-400" />
                    )}
                    <span>
                      {isAllFilteredSelected ? "Bỏ chọn tất cả" : "Chọn tất cả"}{" "}
                      ({filteredProfiles.length})
                    </span>
                  </button>

                  {/* Số lượng đã chọn & Cảnh báo kênh thiếu folder */}
                  {selectedProfileIds.size > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge
                        variant="info"
                        className="border-sky-200 bg-sky-50 text-xs text-sky-700"
                      >
                        Đã chọn {selectedProfileIds.size} profile
                      </Badge>
                      {profiles.filter(
                        (p) => selectedProfileIds.has(p.id) && !p.video_folder,
                      ).length > 0 && (
                        <span className="rounded border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-600">
                          ⚠️{" "}
                          {
                            profiles.filter(
                              (p) =>
                                selectedProfileIds.has(p.id) && !p.video_folder,
                            ).length
                          }{" "}
                          kênh chưa gán folder
                        </span>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {/* Nếu đã chọn >= 1 profile: Các thao tác hàng loạt MMO */}
                  {selectedProfileIds.size > 0 ? (
                    <>
                      {/* Chuyển nhóm hàng loạt */}
                      <div className="flex items-center">
                        <Select
                          value=""
                          disabled={isProcessing}
                          onValueChange={(val) => {
                            if (val) {
                              handleBulkChangeGroup(val);
                            }
                          }}
                        >
                          <SelectTrigger className="h-8 border-slate-200 bg-slate-50 text-xs">
                            <FolderInput className="mr-1.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
                            <span className="mr-1 hidden font-medium text-slate-500 sm:inline">
                              Chuyển sang:
                            </span>
                            <SelectValue placeholder="Nhóm..." />
                          </SelectTrigger>
                          <SelectContent>
                            {groups.map((g) => (
                              <SelectItem key={g} value={g}>
                                {g}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Xem Followers & 1K Milestone của các kênh đã chọn */}
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={isProcessing}
                        onClick={() => setIsFollowersModalOpen(true)}
                        title="Xem bảng thống kê số lượng Followers, mốc 1K và cập nhật số liệu từ TikTok"
                        className="h-8 border-indigo-300 bg-indigo-50/70 px-2.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 disabled:opacity-50"
                      >
                        <Users className="mr-1 h-3.5 w-3.5 text-indigo-600" />
                        Xem Followers ({selectedProfileIds.size})
                      </Button>

                      {/* Xuất JSON các kênh đang chọn */}
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={isProcessing}
                        onClick={() =>
                          handleExportJson(
                            profiles.filter((p) =>
                              selectedProfileIds.has(p.id),
                            ),
                          )
                        }
                        title="Xuất file JSON an toàn các kênh đang chọn"
                        className="h-8 border-emerald-300 bg-emerald-50/60 px-2.5 text-xs text-emerald-700 hover:bg-emerald-100/80 disabled:opacity-50"
                      >
                        <FileJson className="mr-1 h-3.5 w-3.5 text-emerald-600" />{" "}
                        Xuất Đã Chọn ({selectedProfileIds.size})
                      </Button>

                      {/* Xóa hàng loạt */}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleBulkDelete}
                        disabled={isProcessing}
                        title="Xóa các profile đang chọn"
                        className="h-8 border-rose-300 bg-rose-50/60 px-2.5 text-xs text-rose-700 hover:bg-rose-100/80 disabled:opacity-50"
                      >
                        {isProcessing ? (
                          <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin text-rose-600" />
                        ) : (
                          <Trash2 className="mr-1 h-3.5 w-3.5 text-rose-600" />
                        )}
                        {isProcessing ? "Đang xóa..." : "Xóa"}
                      </Button>

                      <div className="mx-1 h-4 w-[1px] bg-slate-200" />

                      <button
                        onClick={handleClearSelection}
                        disabled={isProcessing}
                        className="px-1.5 py-1 text-xs text-slate-500 hover:text-slate-700 disabled:opacity-50"
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
                          <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Play className="mr-1 h-3.5 w-3.5 fill-current" />
                        )}
                        Chạy {selectedProfileIds.size} Kênh
                      </Button>
                    </>
                  ) : (
                    /* Nếu chưa chọn profile nào: Nút chạy toàn bộ nhóm */
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleRunBatch}
                        disabled={
                          filteredProfiles.length === 0 ||
                          runningCount > 0 ||
                          isProcessing
                        }
                        className="h-8 border-sky-300 text-xs font-medium text-sky-700 hover:bg-sky-50 disabled:opacity-50"
                      >
                        {isProcessing ? (
                          <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin text-sky-500" />
                        ) : (
                          <Play className="mr-1 h-3.5 w-3.5 fill-current text-sky-500" />
                        )}
                        Chạy Toàn Bộ{" "}
                        {selectedGroup === "all"
                          ? "Tất Cả Kênh"
                          : `Nhóm [${selectedGroup}]`}
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Profile Grid */}
            {profiles.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-slate-200 bg-white px-4 py-20 text-center shadow-sm">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-sky-100 bg-sky-50 shadow-inner">
                  <Sparkles className="h-8 w-8 text-sky-500" />
                </div>
                <h3 className="text-base font-bold text-slate-800">
                  Chưa có Profile TikTok nào
                </h3>
                <p className="mb-5 mt-1 max-w-md text-xs text-slate-500">
                  Bắt đầu ngay bằng cách nhập danh sách profiles từ file JSON
                  hoặc tạo từng profile.
                </p>
                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsBulkImportOpen(true)}
                    className="border-sky-300 bg-sky-50/60 text-xs font-semibold text-sky-700 hover:bg-sky-100"
                  >
                    <FileJson className="mr-1 h-3.5 w-3.5" /> Nhập Profiles
                    (JSON)
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
              <div className="rounded-2xl border border-slate-200 bg-white py-16 text-center text-sm text-slate-400">
                Không tìm thấy profile nào phù hợp với bộ lọc hoặc từ khóa tìm
                kiếm.
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-4">
                {filteredProfiles.map((profile) => (
                  <ProfileCard
                    key={profile.id}
                    profile={profile}
                    isSelected={selectedProfileIds.has(profile.id)}
                    onToggleSelect={(selected) =>
                      handleToggleSelect(profile.id, selected)
                    }
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
        {activeTab === "queue" && (
          <QueueScreen
            queueStats={queueStats}
            profiles={profiles}
            liveLogs={liveLogs}
            concurrency={concurrency}
            onUpdateConcurrency={handleUpdateConcurrency}
            onClearLiveLogs={() => setLiveLogs([])}
            onNavigateToProfiles={() => setActiveTab("profiles")}
            onStopQueue={async () => {
              try {
                await window.api.stopQueue();
                toast.success("Đã dừng hàng đợi upload thành công.");
                await loadProfiles();
              } catch (err: any) {
                toast.error(`Lỗi khi dừng hàng đợi: ${err.message}`);
              }
            }}
          />
        )}

        {/* TAB 3: NHẬT KÝ (LOGS) */}
        {activeTab === "logs" && (
          <LogsScreen
            liveLogs={liveLogs}
            onClearLiveLogs={() => setLiveLogs([])}
          />
        )}

        {/* TAB 4: CÀI ĐẶT (SETTINGS) */}
        {activeTab === "settings" && (
          <SettingsScreen
            concurrency={concurrency}
            onUpdateConcurrency={handleUpdateConcurrency}
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
                .map((g: any) => (typeof g === "string" ? g : g?.name))
                .filter(Boolean),
            );
          } else {
            loadGroupsList();
          }
          if (info?.renamedFrom && selectedGroup === info.renamedFrom) {
            setSelectedGroup(info.renamedTo || "all");
          }
        }}
      />

      {/* Bulk Import Modal từ file JSON */}
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

      {/* Followers & 1K Milestone Modal */}
      <FollowersModal
        isOpen={isFollowersModalOpen}
        onClose={() => setIsFollowersModalOpen(false)}
        selectedProfiles={profiles.filter((p) => selectedProfileIds.has(p.id))}
        onRefreshData={loadProfiles}
      />

      {/* Cooldown 24h Batch Confirmation Modal */}
      <CooldownBatchModal
        isOpen={cooldownBatchData.isOpen}
        cooldownProfiles={cooldownBatchData.cooldownProfiles}
        safeCount={cooldownBatchData.safeCount}
        totalCount={cooldownBatchData.totalCount}
        onConfirmRunAll={handleConfirmRunAllFromCooldown}
        onConfirmRunSafeOnly={handleConfirmRunSafeOnlyFromCooldown}
        onClose={() =>
          setCooldownBatchData((prev) => ({ ...prev, isOpen: false }))
        }
      />

      {/* Cooldown 24h Guide Modal */}
      <CooldownGuideModal
        isOpen={isCooldownGuideOpen}
        onClose={() => setIsCooldownGuideOpen(false)}
      />

      {/* Floating Processing Banner - Phản hồi tức thì khi thực hiện tác vụ nặng */}
      {isProcessing && (
        <div className="animate-in fade-in slide-in-from-bottom-2 fixed bottom-5 right-5 z-50 flex items-center gap-2.5 rounded-xl border border-slate-700/80 bg-slate-900/90 px-4 py-2.5 text-xs text-white shadow-2xl backdrop-blur-md">
          <Loader2 className="h-4 w-4 shrink-0 animate-spin text-sky-400" />
          <span className="font-semibold text-slate-100">
            {processingMessage || "Đang xử lý dữ liệu..."}
          </span>
        </div>
      )}

      {/* Floating Mini Progress Widget (khi duyệt ở tab khác mà đang có upload) */}
      <FloatingProgressWidget
        isVisible={
          activeTab !== "queue" &&
          (batchTracking.isActive || queueStats.runningProfiles?.length > 0)
        }
        runningCount={queueStats.runningProfiles?.length || 0}
        totalVideos={batchTracking.totalVideos}
        processedVideos={batchTracking.processedVideos}
        successVideos={batchTracking.successVideos}
        onClick={() => setActiveTab("queue")}
      />

      {/* Batch Summary Completion Modal */}
      <BatchSummaryModal
        isOpen={batchTracking.showSummaryModal}
        onClose={() =>
          setBatchTracking((prev) => ({ ...prev, showSummaryModal: false }))
        }
        onViewLogs={() => {
          setBatchTracking((prev) => ({ ...prev, showSummaryModal: false }));
          setActiveTab("logs");
        }}
        startTime={batchTracking.startTime}
        endTime={batchTracking.endTime || new Date()}
        totalProfilesCount={batchTracking.totalProfilesCount || 1}
        results={batchTracking.results}
      />
    </div>
  );
};
