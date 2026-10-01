import { Crown, Folder, Loader2, RefreshCw, Users, X } from "lucide-react";
import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "./ui/Button";

interface FollowersModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedProfiles: any[];
  onRefreshData?: () => void;
}

export const FollowersModal: React.FC<FollowersModalProps> = ({
  isOpen,
  onClose,
  selectedProfiles,
  onRefreshData,
}) => {
  const [isUpdatingAll, setIsUpdatingAll] = useState(false);
  const [updatingProfileId, setUpdatingProfileId] = useState<string | null>(
    null,
  );
  const [progressInfo, setProgressInfo] = useState<{
    current: number;
    total: number;
    profileName: string;
  } | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isUpdatingAll) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);

    // Lắng nghe tiến độ quét stats
    const unsubProgress = window.api.onStatsProgress?.((p) => {
      setProgressInfo(p);
    });

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      unsubProgress?.();
    };
  }, [isOpen, isUpdatingAll, onClose]);

  if (!isOpen) return null;

  // Tính toán số liệu tổng hợp
  const totalFollowers = selectedProfiles.reduce(
    (sum, p) => sum + (Number(p.followers_count) || 0),
    0,
  );
  const reaching1kCount = selectedProfiles.filter(
    (p) => (Number(p.followers_count) || 0) >= 1000,
  ).length;

  // Cập nhật tất cả các kênh đang chọn
  const handleUpdateAll = async () => {
    if (isUpdatingAll || selectedProfiles.length === 0) return;
    setIsUpdatingAll(true);
    setProgressInfo(null);
    const ids = selectedProfiles.map((p) => p.id);

    try {
      toast.info(
        `Bắt đầu quét chỉ số Followers cho ${ids.length} kênh đã chọn...`,
      );
      const res = await window.api.fetchBulkStats(ids);
      if (res.success) {
        toast.success(
          `Đã cập nhật Followers thành công cho ${res.count} kênh!`,
          {
            icon: "👥",
          },
        );
        onRefreshData?.();
      }
    } catch (err: any) {
      toast.error("Lỗi khi quét Followers: " + err.message);
    } finally {
      setIsUpdatingAll(false);
      setProgressInfo(null);
    }
  };

  // Làm mới chỉ số cho 1 kênh riêng lẻ
  const handleRefreshSingle = async (profile: any) => {
    if (updatingProfileId || isUpdatingAll) return;
    setUpdatingProfileId(profile.id);

    try {
      const res = await window.api.fetchStats(profile.id);
      if (res.success) {
        toast.success(
          `Kênh "${profile.name}": ${res.stats.followers.toLocaleString()} followers!`,
          { icon: "👥" },
        );
        onRefreshData?.();
      } else {
        toast.error(res.error || "Không thể lấy số liệu từ TikTok");
      }
    } catch (err: any) {
      toast.error("Lỗi khi lấy số liệu: " + err.message);
    } finally {
      setUpdatingProfileId(null);
    }
  };

  const formatUpdatedAt = (isoString?: string | null) => {
    if (!isoString) return "Chưa quét";
    try {
      const date = new Date(isoString);
      if (isNaN(date.getTime())) return "Chưa quét";
      return date.toLocaleTimeString("vi-VN", {
        hour: "2-digit",
        minute: "2-digit",
        day: "2-digit",
        month: "2-digit",
      });
    } catch {
      return "Chưa quét";
    }
  };

  return (
    <div className="animate-in fade-in fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-3 backdrop-blur-sm duration-150 sm:p-4">
      <div
        className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-slate-100 bg-slate-50/50 px-5 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-indigo-200 bg-indigo-50 text-indigo-600">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-800">
                  Thống Kê Followers & Mốc 1K
                </h3>
                <span className="rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold text-indigo-700">
                  {selectedProfiles.length} kênh đã chọn
                </span>
              </div>
              <p className="mt-0.5 text-xs text-slate-500">
                Xem lượng người theo dõi, tiến độ đạt 1.000 followers và cập
                nhật trực tiếp từ TikTok.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="default"
              size="sm"
              onClick={handleUpdateAll}
              disabled={isUpdatingAll || selectedProfiles.length === 0}
              className="bg-indigo-600 text-xs font-semibold text-white shadow-sm shadow-indigo-500/20 hover:bg-indigo-700"
            >
              {isUpdatingAll ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
              )}
              {isUpdatingAll ? "Đang Quét Dữ Liệu..." : "Cập Nhật Tất Cả"}
            </Button>

            <button
              onClick={onClose}
              disabled={isUpdatingAll}
              className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
              title="Đóng"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Progress notification banner */}
        {isUpdatingAll && progressInfo && (
          <div className="flex shrink-0 items-center justify-between border-b border-indigo-100 bg-indigo-50 px-5 py-2.5 text-xs text-indigo-900">
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 shrink-0 animate-spin text-indigo-600" />
              <span>
                Đang quét kênh: <strong>{progressInfo.profileName}</strong> (
                {progressInfo.current}/{progressInfo.total})...
              </span>
            </div>
            <span className="font-mono font-bold text-indigo-700">
              {Math.round((progressInfo.current / progressInfo.total) * 100)}%
            </span>
          </div>
        )}

        {/* Summary Metric Cards */}
        <div className="grid shrink-0 grid-cols-1 gap-3 border-b border-slate-100 bg-slate-50/70 p-4 sm:grid-cols-2">
          {/* Card 1: Tổng Followers */}
          <div className="shadow-xs flex items-center justify-between rounded-xl border border-slate-200/80 bg-white p-3">
            <div>
              <span className="block text-[11px] font-medium text-slate-500">
                Tổng Người Theo Dõi (Followers)
              </span>
              <span className="font-mono text-xl font-black text-indigo-600">
                {totalFollowers.toLocaleString()}
              </span>
            </div>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
              <Users className="h-4 w-4" />
            </div>
          </div>

          {/* Card 2: Mốc 1K Follows */}
          <div className="shadow-xs flex items-center justify-between rounded-xl border border-slate-200/80 bg-white p-3">
            <div>
              <span className="block text-[11px] font-medium text-slate-500">
                Kênh Đạt Mốc 1.000 Followers
              </span>
              <div className="flex items-baseline gap-1.5">
                <span className="font-mono text-xl font-black text-emerald-600">
                  {reaching1kCount}
                </span>
                <span className="text-xs font-medium text-slate-400">
                  / {selectedProfiles.length} kênh
                </span>
              </div>
            </div>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
              <Crown className="h-4 w-4" />
            </div>
          </div>
        </div>

        {/* Content Table */}
        <div className="flex-1 overflow-y-auto p-4">
          {selectedProfiles.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400">
              Chưa chọn kênh nào. Hãy tích chọn kênh ở ngoài danh sách để xem.
            </div>
          ) : (
            <div className="shadow-xs overflow-hidden rounded-xl border border-slate-200/90">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-bold text-slate-500">
                    <th className="w-10 px-3 py-2.5 text-center">#</th>
                    <th className="px-3 py-2.5">Tên Kênh / Profile</th>
                    <th className="px-3 py-2.5">Nhóm</th>
                    <th className="px-3 py-2.5 text-right">
                      Lượt Theo Dõi (Followers)
                    </th>
                    <th className="px-3 py-2.5">Tiến Độ 1K</th>
                    <th className="px-3 py-2.5 text-center">Cập Nhật Lúc</th>
                    <th className="w-24 px-3 py-2.5 text-center">Thao Tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {selectedProfiles.map((p, idx) => {
                    const follows = Number(p.followers_count) || 0;
                    const is1k = follows >= 1000;
                    const percent = Math.min(
                      100,
                      Math.round((follows / 1000) * 100),
                    );
                    const isUpdatingThis = updatingProfileId === p.id;

                    return (
                      <tr
                        key={p.id}
                        className="transition-colors hover:bg-slate-50/60"
                      >
                        {/* STT */}
                        <td className="px-3 py-2.5 text-center font-mono text-[11px] text-slate-400">
                          {idx + 1}
                        </td>

                        {/* Tên Kênh */}
                        <td className="px-3 py-2.5">
                          <div
                            className="max-w-[220px] truncate font-bold text-slate-800"
                            title={p.name}
                          >
                            {p.name}
                          </div>
                          {p.account_id && p.account_id !== p.name && (
                            <div className="max-w-[220px] truncate font-mono text-[10px] text-slate-400">
                              @{p.account_id}
                            </div>
                          )}
                        </td>

                        {/* Nhóm */}
                        <td className="px-3 py-2.5">
                          <span className="inline-flex items-center gap-1 rounded border border-slate-200/60 bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">
                            <Folder className="h-2.5 w-2.5 text-slate-400" />
                            {p.group_name || "Mặc định"}
                          </span>
                        </td>

                        {/* Followers */}
                        <td className="px-3 py-2.5 text-right">
                          <span className="font-mono text-sm font-bold text-indigo-700">
                            {p.followers_count !== null &&
                            p.followers_count !== undefined
                              ? follows.toLocaleString()
                              : "0"}
                          </span>
                          <span className="block text-[10px] font-normal text-slate-400">
                            follows
                          </span>
                        </td>

                        {/* Tiến độ 1K */}
                        <td className="min-w-[150px] px-3 py-2.5">
                          {is1k ? (
                            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700">
                              <Crown className="h-3 w-3 text-emerald-600" /> Đạt
                              1K!
                            </span>
                          ) : (
                            <div className="space-y-1">
                              <div className="flex items-center justify-between text-[10px] font-medium text-slate-500">
                                <span>{follows}/1.000</span>
                                <span className="font-mono">{percent}%</span>
                              </div>
                              <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                                <div
                                  className="h-full rounded-full bg-indigo-500 transition-all duration-300"
                                  style={{ width: `${percent}%` }}
                                />
                              </div>
                            </div>
                          )}
                        </td>

                        {/* Cập nhật */}
                        <td className="px-3 py-2.5 text-center font-mono text-[10px] text-slate-400">
                          {formatUpdatedAt(p.stats_updated_at)}
                        </td>

                        {/* Thao tác */}
                        <td className="px-3 py-2.5 text-center">
                          <button
                            type="button"
                            onClick={() => handleRefreshSingle(p)}
                            disabled={isUpdatingThis || isUpdatingAll}
                            title="Bấm để lấy số Followers mới nhất của kênh này từ TikTok"
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-600 transition-colors hover:bg-indigo-50 hover:text-indigo-600 disabled:opacity-40"
                          >
                            <RefreshCw
                              className={`h-3 w-3 ${isUpdatingThis ? "animate-spin text-indigo-600" : ""}`}
                            />
                            <span>
                              {isUpdatingThis ? "Đang tải" : "Làm mới"}
                            </span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex shrink-0 items-center justify-between border-t border-slate-100 bg-slate-50/50 px-5 py-3 text-xs text-slate-500">
          <div className="flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
            <span>
              Mốc 1.000 followers giúp kênh đủ uy tín để chuyển sang nhóm spam
              video hàng ngày.
            </span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={onClose}
            className="border-slate-200 text-xs hover:bg-slate-100"
          >
            Đóng
          </Button>
        </div>
      </div>
    </div>
  );
};
