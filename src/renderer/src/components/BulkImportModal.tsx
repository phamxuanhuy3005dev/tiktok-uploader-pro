import React, { useState, useMemo } from 'react';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';
import { 
  FileCode2, 
  FolderOpen, 
  CheckCircle2, 
  AlertCircle, 
  ShieldCheck, 
  KeyRound, 
  Globe, 
  Loader2,
  Users
} from 'lucide-react';
import { toast } from 'sonner';

interface BulkImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  availableGroups: string[];
  onSuccess: (updatedProfiles: any[]) => void;
}

interface ParsedAccount {
  name: string;
  account_id?: string;
  group_name?: string;
  pass?: string | null;
  two_factor?: string | null;
  email?: string | null;
  pass_email?: string | null;
  mail_ao?: string | null;
  proxy?: string | null;
  cookies?: string | null;
  video_folder?: string;
  enable_music?: number;
  music_mode?: string;
  favorite_index?: number;
  music_volume?: number;
  schedule_mode?: string;
  schedule_interval?: number;
  golden_hours?: string;
  caption_mode?: string;
  max_videos?: number;
}

export const BulkImportModal: React.FC<BulkImportModalProps> = ({
  isOpen,
  onClose,
  availableGroups,
  onSuccess
}) => {
  const [rawText, setRawText] = useState('');
  const [loadedFileName, setLoadedFileName] = useState<string | null>(null);
  const [targetGroupOption, setTargetGroupOption] = useState<'keep' | 'assign'>('keep');
  const [selectedGroup, setSelectedGroup] = useState('Mặc định');
  const [isNewGroup, setIsNewGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [loading, setLoading] = useState(false);

  // Chọn file JSON từ máy tính qua Native File Dialog
  const handleChooseFile = async () => {
    try {
      const res = await window.api.readTxtFile();
      if (res.success && res.content) {
        setRawText(res.content);
        setLoadedFileName(res.fileName || 'file.json');
        toast.success(`Đã nạp file: ${res.fileName}`);
      }
    } catch (err: any) {
      toast.error(`Lỗi đọc file: ${err.message}`);
    }
  };

  // Xử lý kéo thả file JSON
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target?.result as string;
        if (content) {
          setRawText(content);
          setLoadedFileName(file.name);
          toast.success(`Đã nạp file: ${file.name}`);
        }
      };
      reader.readAsText(file);
    }
  };

  // Phân tích cú pháp JSON theo thời gian thực
  const { parsedAccounts, parseError } = useMemo(() => {
    if (!rawText.trim()) return { parsedAccounts: [], parseError: null };

    const clean = rawText.replace(/^\uFEFF/, '').trim();
    if (!clean) return { parsedAccounts: [], parseError: null };

    try {
      let data = JSON.parse(clean);
      if (!Array.isArray(data) && data && Array.isArray(data.profiles)) {
        data = data.profiles;
      }

      if (!Array.isArray(data)) {
        return { parsedAccounts: [], parseError: 'File JSON phải chứa một mảng danh sách các tài khoản [ ... ]' };
      }

      const list: ParsedAccount[] = data.map((item: any) => {
        let cookiesStr: string | null = null;
        if (item.cookies) {
          cookiesStr = typeof item.cookies === 'string' ? item.cookies : JSON.stringify(item.cookies);
        }

        const name = String(item.name || item.account_id || item.username || item.uid || '').trim();
        return {
          name,
          account_id: String(item.account_id || item.name || '').trim() || name,
          group_name: String(item.group_name || item.group || 'Mặc định').trim() || 'Mặc định',
          pass: item.pass || null,
          two_factor: item.two_factor || item.two_fa || item['2fa'] || null,
          email: item.email || null,
          pass_email: item.pass_email || null,
          mail_ao: item.mail_ao || null,
          proxy: item.proxy || null,
          cookies: cookiesStr,
          video_folder: item.video_folder || '',
          enable_music: item.enable_music !== undefined ? Number(item.enable_music) : 1,
          music_mode: item.music_mode || 'favorite_rotate',
          favorite_index: item.favorite_index !== undefined ? Number(item.favorite_index) : 0,
          music_volume: item.music_volume !== undefined ? Number(item.music_volume) : -50,
          schedule_mode: item.schedule_mode || 'auto_increment',
          schedule_interval: item.schedule_interval !== undefined ? Number(item.schedule_interval) : 10,
          golden_hours: item.golden_hours || '11:30,17:30,20:00',
          caption_mode: item.caption_mode || 'remove_title',
          max_videos: item.max_videos !== undefined ? Number(item.max_videos) : 50
        };
      }).filter((p) => p.name.length > 0);

      return { parsedAccounts: list, parseError: null };
    } catch (err: any) {
      return { parsedAccounts: [], parseError: `Lỗi định dạng JSON: ${err.message}` };
    }
  }, [rawText]);

  // Thống kê số lượng
  const stats = useMemo(() => {
    let withCookies = 0;
    let withProxy = 0;
    for (const acc of parsedAccounts) {
      if (acc.cookies && (acc.cookies.includes('sessionid') || acc.cookies.includes('sid_tt'))) {
        withCookies++;
      }
      if (acc.proxy && acc.proxy.trim().length > 0) {
        withProxy++;
      }
    }
    return {
      total: parsedAccounts.length,
      withCookies,
      withProxy
    };
  }, [parsedAccounts]);

  // Thực hiện nạp tài khoản vào hệ thống
  const handleImport = async () => {
    if (parsedAccounts.length === 0) {
      toast.error('Chưa có dữ liệu tài khoản JSON hợp lệ để nạp!');
      return;
    }

    const groupToAssign = isNewGroup && newGroupName.trim() ? newGroupName.trim() : selectedGroup;

    setLoading(true);
    try {
      const profilesToCreate = parsedAccounts.map((acc) => {
        const finalGroup = targetGroupOption === 'assign'
          ? (groupToAssign || 'Mặc định')
          : (acc.group_name || 'Mặc định');

        return {
          id: `profile_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          name: acc.name,
          group_name: finalGroup,
          account_id: acc.account_id || acc.name,
          pass: acc.pass || null,
          two_factor: acc.two_factor || null,
          email: acc.email || null,
          pass_email: acc.pass_email || null,
          mail_ao: acc.mail_ao || null,
          proxy: acc.proxy || null,
          cookies: acc.cookies || null,
          status: 'idle',
          video_folder: acc.video_folder || '',
          enable_music: acc.enable_music !== undefined ? acc.enable_music : 1,
          music_mode: acc.music_mode || 'favorite_rotate',
          favorite_index: acc.favorite_index || 0,
          music_volume: acc.music_volume !== undefined ? acc.music_volume : -50,
          schedule_mode: acc.schedule_mode || 'auto_increment',
          schedule_interval: acc.schedule_interval || 10,
          golden_hours: acc.golden_hours || '11:30,17:30,20:00',
          caption_mode: acc.caption_mode || 'remove_title',
          max_videos: acc.max_videos || 50
        };
      });

      const res = await window.api.bulkCreateProfiles(profilesToCreate);
      toast.success(`Đã nạp thành công ${res.count} profiles từ file JSON!`);
      onSuccess(res.profiles);
      onClose();
    } catch (err: any) {
      toast.error(`Lỗi khi nạp profiles: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Nhập Danh Sách Profiles (File JSON Chuẩn)"
      className="max-w-3xl"
    >
      <div className="space-y-4">
        {/* Banner hướng dẫn chuẩn JSON */}
        <div className="p-3 bg-sky-50/80 rounded-xl border border-sky-100 flex items-start gap-2.5">
          <FileCode2 className="h-5 w-5 text-sky-600 shrink-0 mt-0.5" />
          <div className="text-xs text-slate-600 leading-relaxed">
            <span className="font-bold text-slate-800">Chuẩn JSON an toàn 100%:</span> File JSON giữ nguyên vẹn mảng cookies đăng nhập, tên nhóm, proxy và cấu hình của từng kênh. Không bao giờ bị lỗi lệch cột hay mất session như file Excel/TXT.
          </div>
        </div>

        {/* Nút chọn file & Drag Drop */}
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          className="border-2 border-dashed border-slate-200 hover:border-sky-400 bg-slate-50/50 hover:bg-sky-50/30 rounded-xl p-4 text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-2"
          onClick={handleChooseFile}
        >
          <FolderOpen className="h-8 w-8 text-sky-500" />
          <div>
            <span className="text-xs font-bold text-slate-700 hover:text-sky-600">
              {loadedFileName ? `Đang mở file: ${loadedFileName}` : 'Bấm vào đây để chọn File JSON (*.json)'}
            </span>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Hoặc kéo thả file JSON vào đây, hoặc dán nội dung JSON vào khung bên dưới
            </p>
          </div>
        </div>

        {/* Khung dán / chỉnh sửa JSON */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <span>Nội Dung Dữ Liệu JSON:</span>
              {stats.total > 0 && (
                <Badge variant="outline" className="text-[11px] font-mono text-emerald-600 border-emerald-200 bg-emerald-50">
                  {stats.total} Profiles
                </Badge>
              )}
            </label>
            {rawText && (
              <button
                type="button"
                onClick={() => {
                  setRawText('');
                  setLoadedFileName(null);
                }}
                className="text-[11px] text-slate-400 hover:text-rose-500 transition-colors"
              >
                Xóa trắng
              </button>
            )}
          </div>
          <textarea
            value={rawText}
            onChange={(e) => {
              setRawText(e.target.value);
              setLoadedFileName(null);
            }}
            placeholder='Dán nội dung JSON vào đây. Ví dụ:&#10;[&#10;  {&#10;    "name": "kenh_tiktok_01",&#10;    "group_name": "Nuôi US",&#10;    "cookies": [ ... ]&#10;  }&#10;]'
            rows={6}
            className={`w-full p-3 font-mono text-xs rounded-xl border bg-white focus:outline-none transition-all ${
              parseError
                ? 'border-rose-300 focus:border-rose-500 bg-rose-50/20 text-slate-800'
                : 'border-slate-200 focus:border-sky-500 text-slate-800'
            }`}
          />
          {parseError && (
            <p className="text-[11px] text-rose-500 flex items-center gap-1 mt-1 font-medium">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" /> {parseError}
            </p>
          )}
        </div>

        {/* Thống kê & Xem trước dữ liệu */}
        {stats.total > 0 && (
          <div className="space-y-2.5 bg-slate-50 p-3 rounded-xl border border-slate-200">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-700">Xem trước:</span>
                <span className="text-[11px] text-emerald-600 font-semibold flex items-center gap-1">
                  <CheckCircle2 className="h-3.5 w-3.5" /> {stats.withCookies} có Cookie đăng nhập
                </span>
                {stats.withProxy > 0 && (
                  <span className="text-[11px] text-sky-600 font-semibold flex items-center gap-1">
                    <Globe className="h-3.5 w-3.5" /> {stats.withProxy} có Proxy
                  </span>
                )}
              </div>
            </div>

            {/* Bảng xem trước tối đa 5 profiles */}
            <div className="max-h-36 overflow-y-auto rounded-lg border border-slate-200 bg-white">
              <table className="w-full text-left text-[11px]">
                <thead className="bg-slate-50 text-slate-600 border-b border-slate-100 font-semibold sticky top-0">
                  <tr>
                    <th className="py-1.5 px-3">Tên Kênh (Profile)</th>
                    <th className="py-1.5 px-3">Nhóm</th>
                    <th className="py-1.5 px-3">Cookie Phiên</th>
                    <th className="py-1.5 px-3">Proxy</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  {parsedAccounts.slice(0, 8).map((acc, idx) => {
                    const hasSession = acc.cookies && (acc.cookies.includes('sessionid') || acc.cookies.includes('sid_tt'));
                    return (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="py-1.5 px-3 font-bold text-slate-800">{acc.name}</td>
                        <td className="py-1.5 px-3 text-slate-600">
                          {targetGroupOption === 'assign'
                            ? (isNewGroup && newGroupName.trim() ? newGroupName.trim() : selectedGroup)
                            : (acc.group_name || 'Mặc định')}
                        </td>
                        <td className="py-1.5 px-3">
                          {hasSession ? (
                            <span className="text-emerald-600 font-bold inline-flex items-center gap-0.5">
                              <ShieldCheck className="h-3 w-3" /> Đã đăng nhập
                            </span>
                          ) : (
                            <span className="text-slate-400">Chưa có session</span>
                          )}
                        </td>
                        <td className="py-1.5 px-3 text-slate-500 truncate max-w-[120px]">
                          {acc.proxy || 'Trực tiếp'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {stats.total > 8 && (
                <div className="p-1.5 text-center text-[10px] text-slate-400 bg-slate-50 border-t border-slate-100">
                  ... và {stats.total - 8} tài khoản khác nữa
                </div>
              )}
            </div>
          </div>
        )}

        {/* Lựa chọn Nhóm đích */}
        <div className="bg-slate-50/70 p-3 rounded-xl border border-slate-200 space-y-2.5">
          <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5 text-sky-500" /> Thiết Lập Nhóm Cho Profiles Được Nhập:
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setTargetGroupOption('keep')}
              className={`p-2.5 rounded-lg border text-left text-xs transition-all ${
                targetGroupOption === 'keep'
                  ? 'border-sky-500 bg-sky-50 text-sky-800 font-bold'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
              }`}
            >
              <div>Giữ nguyên Nhóm trong file JSON</div>
              <div className="text-[10px] text-slate-400 font-normal mt-0.5">Tự động tạo nhóm mới nếu nhóm chưa tồn tại</div>
            </button>

            <button
              type="button"
              onClick={() => setTargetGroupOption('assign')}
              className={`p-2.5 rounded-lg border text-left text-xs transition-all ${
                targetGroupOption === 'assign'
                  ? 'border-sky-500 bg-sky-50 text-sky-800 font-bold'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
              }`}
            >
              <div>Gán toàn bộ vào 1 Nhóm cụ thể</div>
              <div className="text-[10px] text-slate-400 font-normal mt-0.5">Quy tụ toàn bộ danh sách nạp vào nhóm được chọn</div>
            </button>
          </div>

          {targetGroupOption === 'assign' && (
            <div className="flex items-center gap-2 pt-1">
              {!isNewGroup ? (
                <>
                  <select
                    value={selectedGroup}
                    onChange={(e) => setSelectedGroup(e.target.value)}
                    className="flex-1 h-8 text-xs rounded-lg border border-slate-200 bg-white px-2.5 font-medium text-slate-800 focus:outline-none focus:border-sky-500"
                  >
                    {availableGroups.map((g) => (
                      <option key={g} value={g}>
                        {g}
                      </option>
                    ))}
                  </select>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setIsNewGroup(true)}
                    className="h-8 text-xs shrink-0"
                  >
                    + Tạo nhóm mới
                  </Button>
                </>
              ) : (
                <>
                  <input
                    type="text"
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                    placeholder="Nhập tên nhóm mới..."
                    className="flex-1 h-8 text-xs rounded-lg border border-slate-200 bg-white px-2.5 font-medium text-slate-800 focus:outline-none focus:border-sky-500"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setIsNewGroup(false);
                      setNewGroupName('');
                    }}
                    className="h-8 text-xs shrink-0"
                  >
                    Hủy
                  </Button>
                </>
              )}
            </div>
          )}
        </div>

        {/* Nút hành động */}
        <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={loading}
            className="text-xs"
          >
            Hủy
          </Button>
          <Button
            type="button"
            variant="default"
            size="sm"
            onClick={handleImport}
            disabled={loading || parsedAccounts.length === 0}
            className="text-xs bg-sky-600 hover:bg-sky-700 shadow-sm shadow-sky-600/20 font-bold px-4"
          >
            {loading ? (
              <>
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Đang Nạp...
              </>
            ) : (
              `Xác Nhận Nạp (${parsedAccounts.length} Profiles)`
            )}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
