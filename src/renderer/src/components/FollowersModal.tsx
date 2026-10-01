import React, { useState, useEffect } from 'react';
import {
  X,
  Users,
  RefreshCw,
  Crown,
  Folder,
  Loader2
} from 'lucide-react';
import { Button } from './ui/Button';
import { toast } from 'sonner';

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
  onRefreshData
}) => {
  const [isUpdatingAll, setIsUpdatingAll] = useState(false);
  const [updatingProfileId, setUpdatingProfileId] = useState<string | null>(null);
  const [progressInfo, setProgressInfo] = useState<{ current: number; total: number; profileName: string } | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isUpdatingAll) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    // Lắng nghe tiến độ quét stats
    const unsubProgress = window.api.onStatsProgress?.((p) => {
      setProgressInfo(p);
    });

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      unsubProgress?.();
    };
  }, [isOpen, isUpdatingAll, onClose]);

  if (!isOpen) return null;

  // Tính toán số liệu tổng hợp
  const totalFollowers = selectedProfiles.reduce(
    (sum, p) => sum + (Number(p.followers_count) || 0),
    0
  );
  const reaching1kCount = selectedProfiles.filter(
    (p) => (Number(p.followers_count) || 0) >= 1000
  ).length;

  // Cập nhật tất cả các kênh đang chọn
  const handleUpdateAll = async () => {
    if (isUpdatingAll || selectedProfiles.length === 0) return;
    setIsUpdatingAll(true);
    setProgressInfo(null);
    const ids = selectedProfiles.map((p) => p.id);

    try {
      toast.info(`Bắt đầu quét chỉ số Followers cho ${ids.length} kênh đã chọn...`);
      const res = await window.api.fetchBulkStats(ids);
      if (res.success) {
        toast.success(`Đã cập nhật Followers thành công cho ${res.count} kênh!`, {
          icon: '👥'
        });
        onRefreshData?.();
      }
    } catch (err: any) {
      toast.error('Lỗi khi quét Followers: ' + err.message);
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
          { icon: '👥' }
        );
        onRefreshData?.();
      } else {
        toast.error(res.error || 'Không thể lấy số liệu từ TikTok');
      }
    } catch (err: any) {
      toast.error('Lỗi khi lấy số liệu: ' + err.message);
    } finally {
      setUpdatingProfileId(null);
    }
  };

  const formatUpdatedAt = (isoString?: string | null) => {
    if (!isoString) return 'Chưa quét';
    try {
      const date = new Date(isoString);
      if (isNaN(date.getTime())) return 'Chưa quét';
      return date.toLocaleTimeString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
        day: '2-digit',
        month: '2-digit'
      });
    } catch {
      return 'Chưa quét';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div
        className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl border border-slate-200 flex flex-col max-h-[90vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600 shrink-0">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-800">
                  Thống Kê Followers & Mốc 1K
                </h3>
                <span className="text-[11px] font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full">
                  {selectedProfiles.length} kênh đã chọn
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Xem lượng người theo dõi, tiến độ đạt 1.000 followers và cập nhật trực tiếp từ TikTok.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="default"
              size="sm"
              onClick={handleUpdateAll}
              disabled={isUpdatingAll || selectedProfiles.length === 0}
              className="text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm shadow-indigo-500/20"
            >
              {isUpdatingAll ? (
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
              )}
              {isUpdatingAll ? 'Đang Quét Dữ Liệu...' : 'Cập Nhật Tất Cả'}
            </Button>

            <button
              onClick={onClose}
              disabled={isUpdatingAll}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
              title="Đóng"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Progress notification banner */}
        {isUpdatingAll && progressInfo && (
          <div className="bg-indigo-50 border-b border-indigo-100 px-5 py-2.5 flex items-center justify-between text-xs text-indigo-900 shrink-0">
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-indigo-600 shrink-0" />
              <span>
                Đang quét kênh: <strong>{progressInfo.profileName}</strong> ({progressInfo.current}/{progressInfo.total})...
              </span>
            </div>
            <span className="font-mono font-bold text-indigo-700">
              {Math.round((progressInfo.current / progressInfo.total) * 100)}%
            </span>
          </div>
        )}

        {/* Summary Metric Cards */}
        <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50/70 border-b border-slate-100 shrink-0">
          {/* Card 1: Tổng Followers */}
          <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-xs flex items-center justify-between">
            <div>
              <span className="text-[11px] font-medium text-slate-500 block">Tổng Người Theo Dõi (Followers)</span>
              <span className="text-xl font-black text-indigo-600 font-mono">
                {totalFollowers.toLocaleString()}
              </span>
            </div>
            <div className="h-8 w-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600">
              <Users className="h-4 w-4" />
            </div>
          </div>

          {/* Card 2: Mốc 1K Follows */}
          <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-xs flex items-center justify-between">
            <div>
              <span className="text-[11px] font-medium text-slate-500 block">Kênh Đạt Mốc 1.000 Followers</span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-xl font-black text-emerald-600 font-mono">
                  {reaching1kCount}
                </span>
                <span className="text-xs text-slate-400 font-medium">/ {selectedProfiles.length} kênh</span>
              </div>
            </div>
            <div className="h-8 w-8 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600">
              <Crown className="h-4 w-4" />
            </div>
          </div>
        </div>

        {/* Content Table */}
        <div className="flex-1 overflow-y-auto p-4">
          {selectedProfiles.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs">
              Chưa chọn kênh nào. Hãy tích chọn kênh ở ngoài danh sách để xem.
            </div>
          ) : (
            <div className="border border-slate-200/90 rounded-xl overflow-hidden shadow-xs">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 text-[11px] font-bold text-slate-500 border-b border-slate-200">
                    <th className="py-2.5 px-3 w-10 text-center">#</th>
                    <th className="py-2.5 px-3">Tên Kênh / Profile</th>
                    <th className="py-2.5 px-3">Nhóm</th>
                    <th className="py-2.5 px-3 text-right">Lượt Theo Dõi (Followers)</th>
                    <th className="py-2.5 px-3">Tiến Độ 1K</th>
                    <th className="py-2.5 px-3 text-center">Cập Nhật Lúc</th>
                    <th className="py-2.5 px-3 text-center w-24">Thao Tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {selectedProfiles.map((p, idx) => {
                    const follows = Number(p.followers_count) || 0;
                    const is1k = follows >= 1000;
                    const percent = Math.min(100, Math.round((follows / 1000) * 100));
                    const isUpdatingThis = updatingProfileId === p.id;

                    return (
                      <tr key={p.id} className="hover:bg-slate-50/60 transition-colors">
                        {/* STT */}
                        <td className="py-2.5 px-3 text-center font-mono text-slate-400 text-[11px]">
                          {idx + 1}
                        </td>

                        {/* Tên Kênh */}
                        <td className="py-2.5 px-3">
                          <div className="font-bold text-slate-800 truncate max-w-[220px]" title={p.name}>
                            {p.name}
                          </div>
                          {p.account_id && p.account_id !== p.name && (
                            <div className="text-[10px] text-slate-400 font-mono truncate max-w-[220px]">
                              @{p.account_id}
                            </div>
                          )}
                        </td>

                        {/* Nhóm */}
                        <td className="py-2.5 px-3">
                          <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600 border border-slate-200/60">
                            <Folder className="h-2.5 w-2.5 text-slate-400" />
                            {p.group_name || 'Mặc định'}
                          </span>
                        </td>

                        {/* Followers */}
                        <td className="py-2.5 px-3 text-right">
                          <span className="font-mono font-bold text-indigo-700 text-sm">
                            {p.followers_count !== null && p.followers_count !== undefined
                              ? follows.toLocaleString()
                              : '0'}
                          </span>
                          <span className="text-[10px] text-slate-400 block font-normal">follows</span>
                        </td>

                        {/* Tiến độ 1K */}
                        <td className="py-2.5 px-3 min-w-[150px]">
                          {is1k ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                              <Crown className="h-3 w-3 text-emerald-600" /> Đạt 1K!
                            </span>
                          ) : (
                            <div className="space-y-1">
                              <div className="flex items-center justify-between text-[10px] text-slate-500 font-medium">
                                <span>{follows}/1.000</span>
                                <span className="font-mono">{percent}%</span>
                              </div>
                              <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-indigo-500 rounded-full transition-all duration-300"
                                  style={{ width: `${percent}%` }}
                                />
                              </div>
                            </div>
                          )}
                        </td>

                        {/* Cập nhật */}
                        <td className="py-2.5 px-3 text-center text-[10px] text-slate-400 font-mono">
                          {formatUpdatedAt(p.stats_updated_at)}
                        </td>

                        {/* Thao tác */}
                        <td className="py-2.5 px-3 text-center">
                          <button
                            type="button"
                            onClick={() => handleRefreshSingle(p)}
                            disabled={isUpdatingThis || isUpdatingAll}
                            title="Bấm để lấy số Followers mới nhất của kênh này từ TikTok"
                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-600 hover:text-indigo-600 bg-slate-100 hover:bg-indigo-50 px-2 py-1 rounded-lg border border-slate-200 transition-colors disabled:opacity-40"
                          >
                            <RefreshCw className={`h-3 w-3 ${isUpdatingThis ? 'animate-spin text-indigo-600' : ''}`} />
                            <span>{isUpdatingThis ? 'Đang tải' : 'Làm mới'}</span>
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
        <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between text-xs text-slate-500 shrink-0">
          <div className="flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
            <span>Mốc 1.000 followers giúp kênh đủ uy tín để chuyển sang nhóm spam video hàng ngày.</span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={onClose}
            className="text-xs border-slate-200 hover:bg-slate-100"
          >
            Đóng
          </Button>
        </div>
      </div>
    </div>
  );
};
