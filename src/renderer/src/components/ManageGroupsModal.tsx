import React, { useState, useEffect } from 'react';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';
import { Users, Plus, Edit2, Trash2, Check, X, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';

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
  onGroupsUpdated
}) => {
  const [groups, setGroups] = useState<GroupItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Trạng thái đang chỉnh sửa tên nhóm
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

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
      setNewGroupName('');
    }
  }, [isOpen]);

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newGroupName.trim();
    if (!trimmed) {
      toast.warning('Vui lòng nhập tên nhóm mới!');
      return;
    }

    try {
      setIsSubmitting(true);
      await window.api.createGroup(trimmed);
      toast.success(`Đã tạo nhóm "${trimmed}" thành công!`);
      setNewGroupName('');
      await loadGroups();
      onGroupsUpdated();
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
      toast.warning('Tên nhóm không được để trống!');
      return;
    }

    const currentGroup = groups.find((g) => g.id === groupId);
    const oldName = currentGroup ? currentGroup.name : undefined;

    try {
      const res: any = await window.api.renameGroup(groupId, trimmed);
      toast.success(`Đã đổi tên nhóm thành công (${res.updatedProfilesCount} kênh đã cập nhật)!`);
      setEditingGroupId(null);
      await loadGroups();
      onGroupsUpdated({
        renamedFrom: oldName,
        renamedTo: trimmed,
        updatedProfiles: res.updatedProfiles,
        updatedGroups: res.updatedGroups
      });
    } catch (err: any) {
      toast.error(`Lỗi đổi tên nhóm: ${err.message}`);
    }
  };

  const handleDeleteGroup = async (group: GroupItem) => {
    if (group.name === 'Mặc định') {
      toast.warning('Không thể xóa nhóm "Mặc định"!');
      return;
    }

    const count = group.profile_count || 0;
    const confirmMsg = count > 0
      ? `Nhóm "${group.name}" hiện đang có ${count} kênh. Bạn có chắc muốn xóa không? Tất cả các kênh này sẽ được tự động chuyển về nhóm "Mặc định".`
      : `Bạn có chắc muốn xóa nhóm "${group.name}" không?`;

    if (!window.confirm(confirmMsg)) return;

    try {
      const res: any = await window.api.deleteGroup(group.id);
      toast.success(`Đã xóa nhóm "${group.name}".`);
      await loadGroups();
      onGroupsUpdated({
        renamedFrom: group.name,
        renamedTo: 'Mặc định',
        updatedProfiles: res?.updatedProfiles,
        updatedGroups: res?.updatedGroups
      });
    } catch (err: any) {
      toast.error(`Lỗi xóa nhóm: ${err.message}`);
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
        {/* Form thêm nhóm mới */}
        <form onSubmit={handleCreateGroup} className="flex gap-2">
          <input
            type="text"
            value={newGroupName}
            onChange={(e) => setNewGroupName(e.target.value)}
            placeholder="Nhập tên nhóm mới (ví dụ: Kênh US, Phim Review...)"
            disabled={isSubmitting}
            className="flex-1 px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white text-slate-800 placeholder-slate-400 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
          />
          <Button
            type="submit"
            disabled={isSubmitting || !newGroupName.trim()}
            size="sm"
            className="gap-1.5 shrink-0 text-xs shadow-sm shadow-sky-500/10"
          >
            <Plus className="h-3.5 w-3.5" /> Thêm Nhóm
          </Button>
        </form>

        {/* Danh sách các nhóm */}
        <div className="rounded-xl border border-slate-200 overflow-hidden divide-y divide-slate-100 bg-slate-50/50">
          <div className="bg-slate-100/70 px-3.5 py-2 text-[11px] font-bold text-slate-600 uppercase tracking-wider flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5 text-slate-500" /> Tên Nhóm Hiện Có ({groups.length})
            </span>
            <span>Thao tác</span>
          </div>

          <div className="max-h-72 overflow-y-auto divide-y divide-slate-100 bg-white">
            {loading ? (
              <div className="p-6 text-center text-xs text-slate-400">Đang tải danh sách nhóm...</div>
            ) : groups.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400">Chưa có nhóm nào.</div>
            ) : (
              groups.map((group) => {
                const isEditing = editingGroupId === group.id;
                const isDefault = group.name === 'Mặc định';

                return (
                  <div
                    key={group.id}
                    className="flex items-center justify-between px-3.5 py-2.5 hover:bg-slate-50 transition-colors gap-3"
                  >
                    {isEditing ? (
                      <div className="flex items-center gap-2 flex-1">
                        <input
                          type="text"
                          autoFocus
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveRename(group.id);
                            if (e.key === 'Escape') setEditingGroupId(null);
                          }}
                          className="flex-1 px-2.5 py-1 text-xs rounded-lg border border-sky-400 focus:outline-none focus:ring-1 focus:ring-sky-500 bg-white"
                        />
                        <button
                          type="button"
                          onClick={() => handleSaveRename(group.id)}
                          className="p-1 rounded-md bg-sky-50 text-sky-600 hover:bg-sky-100"
                          title="Lưu tên mới"
                        >
                          <Check className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingGroupId(null)}
                          className="p-1 rounded-md bg-slate-100 text-slate-500 hover:bg-slate-200"
                          title="Hủy"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-semibold text-xs text-slate-800 truncate" title={group.name}>
                            {group.name}
                          </span>
                          <Badge variant="secondary" className="text-[10px] shrink-0 font-normal">
                            {group.profile_count || 0} kênh
                          </Badge>
                          {isDefault && (
                            <span className="text-[10px] font-medium text-slate-400 italic shrink-0">
                              (Mặc định hệ thống)
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleStartRename(group)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-sky-600 hover:bg-sky-50 transition-colors"
                            title="Đổi tên nhóm"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteGroup(group)}
                            disabled={isDefault}
                            className={`p-1.5 rounded-lg transition-colors ${
                              isDefault
                                ? 'opacity-20 cursor-not-allowed text-slate-300'
                                : 'text-slate-400 hover:text-rose-600 hover:bg-rose-50'
                            }`}
                            title={isDefault ? 'Không thể xóa nhóm mặc định' : 'Xóa nhóm'}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
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

        <div className="flex items-start gap-2 bg-amber-50 rounded-xl p-3 text-xs text-amber-800 border border-amber-200/60">
          <ShieldAlert className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
          <span>
            <strong>Lưu ý:</strong> Khi bạn đổi tên một nhóm, tất cả các profile thuộc nhóm đó sẽ tự động được cập nhật sang tên mới ngay lập tức mà không cần chỉnh sửa từng kênh.
          </span>
        </div>

        <div className="flex justify-end pt-2">
          <Button variant="outline" size="sm" onClick={onClose} className="text-xs">
            Đóng
          </Button>
        </div>
      </div>
    </Modal>
  );
};
