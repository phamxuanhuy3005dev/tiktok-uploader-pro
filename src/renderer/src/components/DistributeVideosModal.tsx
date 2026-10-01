import { Folder, Loader2, Shuffle, Sparkles } from "lucide-react";
import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import { Badge } from "./ui/Badge";
import { Button } from "./ui/Button";
import { Modal } from "./ui/Modal";

interface DistributeVideosModalProps {
  isOpen: boolean;
  onClose: () => void;
  profiles: any[];
  groups: string[];
  initialSelectedGroup: string;
  selectedProfileIds: Set<string>;
  onSuccess: (updatedProfiles: any[]) => void;
}

export const DistributeVideosModal: React.FC<DistributeVideosModalProps> = ({
  isOpen,
  onClose,
  profiles,
  groups,
  initialSelectedGroup,
  selectedProfileIds,
  onSuccess,
}) => {
  const [sourceFolder, setSourceFolder] = useState<string>("");
  const [videoCount, setVideoCount] = useState<number>(0);
  const [targetType, setTargetType] = useState<"group" | "selected" | "all">(
    "group",
  );
  const [targetGroup, setTargetGroup] = useState<string>(
    initialSelectedGroup !== "all"
      ? initialSelectedGroup
      : groups[0] || "Mặc định",
  );
  const [mode, setMode] = useState<"move" | "copy">("move");
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      if (selectedProfileIds.size > 0) {
        setTargetType("selected");
      } else if (initialSelectedGroup !== "all") {
        setTargetType("group");
        setTargetGroup(initialSelectedGroup);
      } else {
        setTargetType("group");
        if (groups.length > 0) setTargetGroup(groups[0]);
      }
    }
  }, [isOpen, selectedProfileIds, initialSelectedGroup, groups]);

  const handleSelectSourceFolder = async () => {
    try {
      const folder = await window.api.selectFolder();
      if (folder) {
        setSourceFolder(folder);
        const scan = await window.api.scanVideoFolder(folder);
        const count =
          scan.totalCount ??
          scan.count ??
          (scan.videoFiles || scan.files || []).length;
        setVideoCount(count);
        if (count === 0) {
          toast.warning(
            "Thư mục được chọn không có video (.mp4, .mov, .webm, .mkv) nào!",
          );
        } else {
          toast.success(`Đã quét thấy ${count} video hợp lệ.`);
        }
      }
    } catch (err: any) {
      toast.error(`Lỗi chọn thư mục: ${err.message}`);
    }
  };

  // Tính toán danh sách profile mục tiêu
  const targetProfiles = profiles.filter((p) => {
    if (targetType === "selected") {
      return selectedProfileIds.has(p.id);
    }
    if (targetType === "group") {
      return (p.group_name || "Mặc định") === targetGroup;
    }
    return true; // all
  });

  const perProfileCount =
    targetProfiles.length > 0 && videoCount > 0
      ? Math.floor(videoCount / targetProfiles.length)
      : 0;
  const remainderCount =
    targetProfiles.length > 0 && videoCount > 0
      ? videoCount % targetProfiles.length
      : 0;

  const handleDistribute = async () => {
    if (!sourceFolder) {
      toast.error("Vui lòng chọn thư mục video nguồn!");
      return;
    }
    if (videoCount === 0) {
      toast.error("Thư mục nguồn không có video nào để phân bổ!");
      return;
    }
    if (targetProfiles.length === 0) {
      toast.error("Không có kênh mục tiêu nào được chọn!");
      return;
    }

    setLoading(true);
    try {
      const res = await window.api.distributeVideos({
        sourceFolder,
        targetProfileIds: targetProfiles.map((p) => p.id),
        mode,
      });

      const assignedCount = res.totalAssigned ?? res.totalVideos ?? 0;
      toast.success(
        `Đã chia đều thành công ${assignedCount} video cho ${targetProfiles.length} kênh!`,
      );
      const updated = await window.api.getProfiles();
      onSuccess(updated);
      onClose();
    } catch (err: any) {
      toast.error(`Lỗi chia video: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Chia Đều Video Cho Các Kênh (Tránh Trùng Lặp)"
      className="max-w-lg"
    >
      <div className="space-y-5">
        <p className="text-xs text-slate-500">
          Tự động chia đều danh sách video từ 1 thư mục chung sang các thư mục
          con riêng biệt cho từng kênh. Đảm bảo mỗi kênh sở hữu các video độc
          lập, không bị đăng trùng nhau.
        </p>

        {/* BƯỚC 1: Chọn thư mục nguồn */}
        <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <label className="flex items-center justify-between text-xs font-bold text-slate-700">
            <span className="flex items-center gap-1.5">
              <Folder className="h-4 w-4 text-sky-500" /> 1. Chọn Thư Mục Video
              Nguồn
            </span>
            {videoCount > 0 && (
              <Badge variant="success" className="text-[11px]">
                {videoCount} video hợp lệ
              </Badge>
            )}
          </label>

          <div className="flex gap-2">
            <input
              type="text"
              readOnly
              value={sourceFolder || "Chưa chọn thư mục nào..."}
              className="flex-1 truncate rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleSelectSourceFolder}
              className="shrink-0 bg-white text-xs"
            >
              Chọn Thư Mục
            </Button>
          </div>
        </div>

        {/* BƯỚC 2: Chọn đối tượng nhận video */}
        <div className="space-y-2.5 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
            <Shuffle className="h-4 w-4 text-sky-500" /> 2. Chọn Nhóm Kênh Phân
            Bổ
          </label>

          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => setTargetType("group")}
              className={`rounded-lg border p-2 text-center text-xs font-semibold transition-all ${
                targetType === "group"
                  ? "border-sky-500 bg-sky-50 text-sky-700 shadow-sm"
                  : "border-slate-200 bg-white text-slate-600 hover:bg-slate-100"
              }`}
            >
              Theo Nhóm
            </button>

            <button
              type="button"
              onClick={() => setTargetType("selected")}
              disabled={selectedProfileIds.size === 0}
              className={`rounded-lg border p-2 text-center text-xs font-semibold transition-all disabled:opacity-40 ${
                targetType === "selected"
                  ? "border-sky-500 bg-sky-50 text-sky-700 shadow-sm"
                  : "border-slate-200 bg-white text-slate-600 hover:bg-slate-100"
              }`}
            >
              Kênh Đã Chọn ({selectedProfileIds.size})
            </button>

            <button
              type="button"
              onClick={() => setTargetType("all")}
              className={`rounded-lg border p-2 text-center text-xs font-semibold transition-all ${
                targetType === "all"
                  ? "border-sky-500 bg-sky-50 text-sky-700 shadow-sm"
                  : "border-slate-200 bg-white text-slate-600 hover:bg-slate-100"
              }`}
            >
              Tất Cả ({profiles.length})
            </button>
          </div>

          {targetType === "group" && (
            <div className="pt-1">
              <select
                value={targetGroup}
                onChange={(e) => setTargetGroup(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-800 focus:border-sky-500 focus:outline-none"
              >
                {groups.map((grp) => {
                  const count = profiles.filter(
                    (p) => (p.group_name || "Mặc định") === grp,
                  ).length;
                  return (
                    <option key={grp} value={grp}>
                      Nhóm: {grp} ({count} kênh)
                    </option>
                  );
                })}
              </select>
            </div>
          )}
        </div>

        {/* BƯỚC 3: Xem trước phân bổ */}
        <div className="space-y-1.5 rounded-xl border border-sky-100 bg-sky-50/70 p-3.5 text-xs text-slate-700">
          <div className="flex items-center gap-1.5 font-bold text-sky-800">
            <Sparkles className="h-4 w-4 text-sky-600" /> Dự tính phân bổ:
          </div>
          <p>
            • Tổng số video:{" "}
            <strong className="text-slate-900">{videoCount}</strong>
          </p>
          <p>
            • Số kênh nhận:{" "}
            <strong className="text-slate-900">
              {targetProfiles.length} kênh
            </strong>
          </p>
          {targetProfiles.length > 0 && videoCount > 0 ? (
            <p className="pt-1 font-semibold text-sky-700">
              ➔ Mỗi kênh sẽ nhận được khoảng{" "}
              <span className="font-bold text-sky-900">{perProfileCount}</span>{" "}
              video
              {remainderCount > 0 &&
                ` (cộng thêm 1 video cho ${remainderCount} kênh đầu tiên)`}
              .
            </p>
          ) : (
            <p className="italic text-slate-400">
              Vui lòng chọn thư mục có video để xem trước.
            </p>
          )}
        </div>

        {/* Tùy chọn di chuyển hoặc copy */}
        <div className="flex items-center gap-4 px-1 text-xs text-slate-600">
          <label className="flex cursor-pointer items-center gap-1.5">
            <input
              type="radio"
              name="mode"
              value="move"
              checked={mode === "move"}
              onChange={() => setMode("move")}
              className="text-sky-500 focus:ring-sky-500"
            />
            <span>Di chuyển file (Move - Tiết kiệm dung lượng)</span>
          </label>
          <label className="flex cursor-pointer items-center gap-1.5">
            <input
              type="radio"
              name="mode"
              value="copy"
              checked={mode === "copy"}
              onChange={() => setMode("copy")}
              className="text-sky-500 focus:ring-sky-500"
            />
            <span>Sao chép file (Copy)</span>
          </label>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end gap-2.5 border-t border-slate-100 pt-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={loading}
            className="text-xs"
          >
            Hủy Bỏ
          </Button>
          <Button
            type="button"
            variant="default"
            size="sm"
            onClick={handleDistribute}
            disabled={
              loading || videoCount === 0 || targetProfiles.length === 0
            }
            className="text-xs shadow-sm shadow-sky-500/20"
          >
            {loading && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
            {loading ? "Đang phân bổ video..." : "Tiến Hành Phân Bổ Ngay"}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
