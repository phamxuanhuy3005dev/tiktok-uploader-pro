import {
  Check,
  Clock,
  Edit2,
  Loader2,
  Plus,
  ShieldAlert,
  Trash2,
  Users,
  X,
} from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { isNurturingGroup } from "../utils/cooldown";
import { Badge } from "./ui/Badge";
import { Button } from "./ui/Button";
import { Modal } from "./ui/Modal";

interface GroupItem {
  id: string;
  name: string;
  profile_count?: number;
  created_at: string;
}

interface ManageGroupsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGroupsUpdated: (info?: {
    renamedFrom?: string;
    renamedTo?: string;
    updatedProfiles?: any[];
    updatedGroups?: any[];
  }) => void;
}

export const ManageGroupsModal: React.FC<ManageGroupsModalProps> = ({
  isOpen,
  onClose,
  onGroupsUpdated,
}) => {
  const [groups, setGroups] = useState<GroupItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingGroupId, setDeletingGroupId] = useState<string | null>(null);

  // Input ref để luôn focus mượt mà vào ô tạo nhóm
  const inputRef = useRef<HTMLInputElement>(null);

  // Trạng thái đang chỉnh sửa tên nhóm
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");

  const loadGroups = async () => {
    try {
      setLoading(true);
      const res = await window.api.getGroups();
      setGroups(res || []);
    } catch (err: any) {
      toast.error(`Lỗi tải danh sách nhóm: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadGroups();
      setEditingGroupId(null);
      setNewGroupName("");
      setIsSubmitting(false);

      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 80);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newGroupName.trim();
    if (!trimmed) {
      toast.warning("Vui lòng nhập tên nhóm mới!");
      inputRef.current?.focus();
      return;
    }

    try {
      setIsSubmitting(true);
      await window.api.createGroup(trimmed);
      toast.success(`Đã tạo nhóm "${trimmed}" thành công!`);
      setNewGroupName("");
      await loadGroups();
      onGroupsUpdated();
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    } catch (err: any) {
      toast.error(`Lỗi tạo nhóm: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStartRename = (group: GroupItem) => {
    setEditingGroupId(group.id);
    setEditingName(group.name);
  };

  const handleSaveRename = async (groupId: string) => {
    const trimmed = editingName.trim();
    if (!trimmed) {
      toast.warning("Tên nhóm không được để trống!");
      return;
    }

    const currentGroup = groups.find((g) => g.id === groupId);
    const oldName = currentGroup ? currentGroup.name : undefined;

    try {
      const res: any = await window.api.renameGroup(groupId, trimmed);
      toast.success(
        `Đã đổi tên nhóm thành công (${res.updatedProfilesCount} kênh đã cập nhật)!`,
      );
      setEditingGroupId(null);
      await loadGroups();
      onGroupsUpdated({
        renamedFrom: oldName,
        renamedTo: trimmed,
        updatedProfiles: res.updatedProfiles,
        updatedGroups: res.updatedGroups,
      });
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    } catch (err: any) {
      toast.error(`Lỗi đổi tên nhóm: ${err.message}`);
    }
  };

  const handleDeleteGroup = async (group: GroupItem) => {
    if (group.name === "Mặc định") {
      toast.warning('Không thể xóa nhóm "Mặc định"!');
      return;
    }

    const count = group.profile_count || 0;
    const confirmMsg =
      count > 0
        ? `Nhóm "${group.name}" hiện đang có ${count} kênh. Bạn có chắc muốn xóa không? Tất cả các kênh này sẽ được tự động chuyển về nhóm "Mặc định".`
        : `Bạn có chắc muốn xóa nhóm "${group.name}" không?`;

    if (!window.confirm(confirmMsg)) return;

    try {
      setDeletingGroupId(group.id);
      const res: any = await window.api.deleteGroup(group.id);
      toast.success(`Đã xóa nhóm "${group.name}".`);
      await loadGroups();
      onGroupsUpdated({
        renamedFrom: group.name,
        renamedTo: "Mặc định",
        updatedProfiles: res?.updatedProfiles,
        updatedGroups: res?.updatedGroups,
      });
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    } catch (err: any) {
      toast.error(`Lỗi xóa nhóm: ${err.message}`);
    } finally {
      setDeletingGroupId(null);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Quản Lý Danh Sách Nhóm Kênh"
      description="Tạo bảng nhóm riêng biệt giúp bạn phân loại kênh, dễ dàng lọc và đồng bộ đổi tên hàng loạt."
      className="max-w-lg"
    >
      <div className="space-y-4">
        {/* Banner hướng dẫn tính năng Cooldown 24h cho Kênh Nuôi */}
        <div className="flex items-start gap-2.5 rounded-xl border border-amber-200/80 bg-amber-50/90 p-3 text-xs text-amber-950">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <div className="space-y-1">
            <span className="block font-bold text-amber-950">
              💡 Chế độ bảo vệ Cooldown 24 Giờ cho Kênh Nuôi:
            </span>
            <p className="text-[11px] leading-relaxed text-amber-800">
              Đặt tên nhóm có chứa từ{" "}
              <code className="rounded bg-amber-100 px-1 py-0.5 font-bold text-amber-900">
                nuôi
              </code>
              ,{" "}
              <code className="rounded bg-amber-100 px-1 py-0.5 font-bold text-amber-900">
                warmup
              </code>{" "}
              hoặc{" "}
              <code className="rounded bg-amber-100 px-1 py-0.5 font-bold text-amber-900">
                mới
              </code>{" "}
              (ví dụ: <i>Nuôi US</i>, <i>nuoi-vo-tri</i>, <i>Warmup Kênh</i>...)
              để hệ thống tự động kích hoạt bộ đếm <b>24h Cooldown an toàn</b>{" "}
              giữa các lần đăng video cho các kênh trong nhóm.
            </p>
          </div>
        </div>

        {/* Form thêm nhóm mới */}
        <form onSubmit={handleCreateGroup} className="flex gap-2">
          <input
            ref={inputRef}
            autoFocus
            type="text"
            id="new-group-name-input"
            value={newGroupName}
            onChange={(e) => setNewGroupName(e.target.value)}
            onClick={(e) => {
              e.stopPropagation();
              e.currentTarget.focus();
            }}
            placeholder="Nhập tên nhóm mới (ví dụ: Nuôi Kênh US, Phim Review...)"
            disabled={isSubmitting}
            className="flex-1 cursor-text select-text rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs text-slate-800 placeholder-slate-400 shadow-sm transition-all focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20 disabled:cursor-not-allowed disabled:bg-slate-100"
          />
          <Button
            type="submit"
            disabled={isSubmitting || !newGroupName.trim()}
            size="sm"
            className="shrink-0 gap-1.5 text-xs shadow-sm shadow-sky-500/10"
          >
            {isSubmitting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Plus className="h-3.5 w-3.5" />
            )}
            {isSubmitting ? "Đang thêm..." : "Thêm Nhóm"}
          </Button>
        </form>

        {/* Danh sách các nhóm */}
        <div className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-slate-50/50">
          <div className="flex items-center justify-between bg-slate-100/70 px-3.5 py-2 text-[11px] font-bold uppercase tracking-wider text-slate-600">
            <span className="flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5 text-slate-500" /> Tên Nhóm Hiện Có
              ({groups.length})
            </span>
            <span>Thao tác</span>
          </div>

          <div className="max-h-72 divide-y divide-slate-100 overflow-y-auto bg-white">
            {loading ? (
              <div className="p-6 text-center text-xs text-slate-400">
                Đang tải danh sách nhóm...
              </div>
            ) : groups.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400">
                Chưa có nhóm nào.
              </div>
            ) : (
              groups.map((group) => {
                const isEditing = editingGroupId === group.id;
                const isDefault = group.name === "Mặc định";
                const isNurturing = isNurturingGroup(group.name);

                return (
                  <div
                    key={group.id}
                    className="flex items-center justify-between gap-3 px-3.5 py-2.5 transition-colors hover:bg-slate-50"
                  >
                    {isEditing ? (
                      <div className="flex flex-1 items-center gap-2">
                        <input
                          type="text"
                          autoFocus
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleSaveRename(group.id);
                            if (e.key === "Escape") setEditingGroupId(null);
                          }}
                          className="flex-1 rounded-lg border border-sky-400 bg-white px-2.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-sky-500"
                        />
                        <button
                          type="button"
                          onClick={() => handleSaveRename(group.id)}
                          className="rounded-md bg-sky-50 p-1 text-sky-600 hover:bg-sky-100"
                          title="Lưu tên mới"
                        >
                          <Check className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingGroupId(null)}
                          className="rounded-md bg-slate-100 p-1 text-slate-500 hover:bg-slate-200"
                          title="Hủy"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="flex min-w-0 flex-wrap items-center gap-2">
                          <span
                            className="truncate text-xs font-semibold text-slate-800"
                            title={group.name}
                          >
                            {group.name}
                          </span>
                          <Badge
                            variant="secondary"
                            className="shrink-0 text-[10px] font-normal"
                          >
                            {group.profile_count || 0} kênh
                          </Badge>
                          {isNurturing ? (
                            <span
                              className="inline-flex shrink-0 items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800"
                              title="Nhóm này được tự động bảo vệ Cooldown 24h giữa các lần đăng video"
                            >
                              <Clock className="h-2.5 w-2.5 animate-pulse text-amber-600" />{" "}
                              Kênh nuôi (24h)
                            </span>
                          ) : (
                            <span
                              className="inline-flex shrink-0 items-center gap-1 rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500"
                              title="Kênh thường, không giới hạn khoảng cách 24h giữa các lần đăng"
                            >
                              Kênh thường
                            </span>
                          )}
                          {isDefault && (
                            <span className="shrink-0 text-[10px] font-medium italic text-slate-400">
                              (Mặc định)
                            </span>
                          )}
                        </div>

                        <div className="flex shrink-0 items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleStartRename(group)}
                            className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-sky-50 hover:text-sky-600"
                            title="Đổi tên nhóm"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteGroup(group)}
                            disabled={isDefault || deletingGroupId === group.id}
                            className={`rounded-lg p-1.5 transition-colors ${
                              isDefault || deletingGroupId === group.id
                                ? "cursor-not-allowed text-slate-300 opacity-30"
                                : "text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                            }`}
                            title={
                              isDefault
                                ? "Không thể xóa nhóm mặc định"
                                : "Xóa nhóm"
                            }
                          >
                            {deletingGroupId === group.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin text-rose-500" />
                            ) : (
                              <Trash2 className="h-3.5 w-3.5" />
                            )}
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="flex items-start gap-2 rounded-xl border border-amber-200/60 bg-amber-50 p-3 text-xs text-amber-800">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <span>
            <strong>Lưu ý:</strong> Khi bạn đổi tên một nhóm, tất cả các profile
            thuộc nhóm đó sẽ tự động được cập nhật sang tên mới ngay lập tức mà
            không cần chỉnh sửa từng kênh.
          </span>
        </div>

        <div className="flex justify-end pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onClose}
            className="text-xs"
          >
            Đóng
          </Button>
        </div>
      </div>
    </Modal>
  );
};
