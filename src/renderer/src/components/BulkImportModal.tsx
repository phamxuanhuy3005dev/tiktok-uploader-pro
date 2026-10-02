import {
  AlertCircle,
  CheckCircle2,
  FileCode2,
  FolderOpen,
  Globe,
  Loader2,
  ShieldCheck,
  Users,
} from "lucide-react";
import React, { useMemo, useState } from "react";
import { toast } from "sonner";
import { Badge } from "./ui/Badge";
import { Button } from "./ui/Button";
import { Modal } from "./ui/Modal";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/Select";

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
  onSuccess,
}) => {
  const [rawText, setRawText] = useState("");
  const [loadedFileName, setLoadedFileName] = useState<string | null>(null);
  const [targetGroupOption, setTargetGroupOption] = useState<"keep" | "assign">(
    "keep",
  );
  const [selectedGroup, setSelectedGroup] = useState("Mặc định");
  const [isNewGroup, setIsNewGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [loading, setLoading] = useState(false);

  // Chọn file JSON từ máy tính qua Native File Dialog
  const handleChooseFile = async () => {
    try {
      const res = await window.api.readTxtFile();
      if (res.success && res.content) {
        setRawText(res.content);
        setLoadedFileName(res.fileName || "file.json");
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

    const clean = rawText.replace(/^\uFEFF/, "").trim();
    if (!clean) return { parsedAccounts: [], parseError: null };

    try {
      let data = JSON.parse(clean);
      if (!Array.isArray(data) && data && Array.isArray(data.profiles)) {
        data = data.profiles;
      }

      if (!Array.isArray(data)) {
        return {
          parsedAccounts: [],
          parseError:
            "File JSON phải chứa một mảng danh sách các tài khoản [ ... ]",
        };
      }

      const list: ParsedAccount[] = data
        .map((item: any) => {
          let cookiesStr: string | null = null;
          if (item.cookies) {
            cookiesStr =
              typeof item.cookies === "string"
                ? item.cookies
                : JSON.stringify(item.cookies);
          }

          const name = String(
            item.name || item.account_id || item.username || item.uid || "",
          ).trim();
          return {
            name,
            account_id:
              String(item.account_id || item.name || "").trim() || name,
            group_name:
              String(item.group_name || item.group || "Mặc định").trim() ||
              "Mặc định",
            pass: item.pass || null,
            two_factor: item.two_factor || item.two_fa || item["2fa"] || null,
            email: item.email || null,
            pass_email: item.pass_email || null,
            mail_ao: item.mail_ao || null,
            proxy: item.proxy || null,
            cookies: cookiesStr,
            video_folder: item.video_folder || "",
            enable_music:
              item.enable_music !== undefined ? Number(item.enable_music) : 1,
            music_mode: item.music_mode || "favorite_rotate",
            favorite_index:
              item.favorite_index !== undefined
                ? Number(item.favorite_index)
                : 0,
            music_volume:
              item.music_volume !== undefined ? Number(item.music_volume) : -50,
            schedule_mode: item.schedule_mode || "auto_increment",
            schedule_interval:
              item.schedule_interval !== undefined
                ? Number(item.schedule_interval)
                : 10,
            golden_hours: item.golden_hours || "11:30,17:30,20:00",
            caption_mode: item.caption_mode || "remove_title",
            max_videos:
              item.max_videos !== undefined ? Number(item.max_videos) : 50,
          };
        })
        .filter((p) => p.name.length > 0);

      return { parsedAccounts: list, parseError: null };
    } catch (err: any) {
      return {
        parsedAccounts: [],
        parseError: `Lỗi định dạng JSON: ${err.message}`,
      };
    }
  }, [rawText]);

  // Thống kê số lượng
  const stats = useMemo(() => {
    let withCookies = 0;
    let withProxy = 0;
    for (const acc of parsedAccounts) {
      if (
        acc.cookies &&
        (acc.cookies.includes("sessionid") || acc.cookies.includes("sid_tt"))
      ) {
        withCookies++;
      }
      if (acc.proxy && acc.proxy.trim().length > 0) {
        withProxy++;
      }
    }
    return {
      total: parsedAccounts.length,
      withCookies,
      withProxy,
    };
  }, [parsedAccounts]);

  // Thực hiện nạp tài khoản vào hệ thống
  const handleImport = async () => {
    if (parsedAccounts.length === 0) {
      toast.error("Chưa có dữ liệu tài khoản JSON hợp lệ để nạp!");
      return;
    }

    const groupToAssign =
      isNewGroup && newGroupName.trim() ? newGroupName.trim() : selectedGroup;

    setLoading(true);
    try {
      const profilesToCreate = parsedAccounts.map((acc) => {
        const finalGroup =
          targetGroupOption === "assign"
            ? groupToAssign || "Mặc định"
            : acc.group_name || "Mặc định";

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
          status: "idle",
          video_folder: acc.video_folder || "",
          enable_music: acc.enable_music !== undefined ? acc.enable_music : 1,
          music_mode: acc.music_mode || "favorite_rotate",
          favorite_index: acc.favorite_index || 0,
          music_volume: acc.music_volume !== undefined ? acc.music_volume : -50,
          schedule_mode: acc.schedule_mode || "auto_increment",
          schedule_interval: acc.schedule_interval || 10,
          golden_hours: acc.golden_hours || "11:30,17:30,20:00",
          caption_mode: acc.caption_mode || "remove_title",
          max_videos: acc.max_videos || 50,
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
        <div className="flex items-start gap-2.5 rounded-xl border border-sky-100 bg-sky-50/80 p-3">
          <FileCode2 className="mt-0.5 h-5 w-5 shrink-0 text-sky-600" />
          <div className="text-xs leading-relaxed text-slate-600">
            <span className="font-bold text-slate-800">
              Chuẩn JSON an toàn 100%:
            </span>{" "}
            File JSON giữ nguyên vẹn mảng cookies đăng nhập, tên nhóm, proxy và
            cấu hình của từng kênh. Không bao giờ bị lỗi lệch cột hay mất
            session như file Excel/TXT.
          </div>
        </div>

        {/* Nút chọn file & Drag Drop */}
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/50 p-4 text-center transition-all hover:border-sky-400 hover:bg-sky-50/30"
          onClick={handleChooseFile}
        >
          <FolderOpen className="h-8 w-8 text-sky-500" />
          <div>
            <span className="text-xs font-bold text-slate-700 hover:text-sky-600">
              {loadedFileName
                ? `Đang mở file: ${loadedFileName}`
                : "Bấm vào đây để chọn File JSON (*.json)"}
            </span>
            <p className="mt-0.5 text-[11px] text-slate-400">
              Hoặc kéo thả file JSON vào đây, hoặc dán nội dung JSON vào khung
              bên dưới
            </p>
          </div>
        </div>

        {/* Khung dán / chỉnh sửa JSON */}
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
              <span>Nội Dung Dữ Liệu JSON:</span>
              {stats.total > 0 && (
                <Badge
                  variant="outline"
                  className="border-emerald-200 bg-emerald-50 font-mono text-[11px] text-emerald-600"
                >
                  {stats.total} Profiles
                </Badge>
              )}
            </label>
            {rawText && (
              <button
                type="button"
                onClick={() => {
                  setRawText("");
                  setLoadedFileName(null);
                }}
                className="text-[11px] text-slate-400 transition-colors hover:text-rose-500"
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
            className={`w-full rounded-xl border bg-white p-3 font-mono text-xs transition-all focus:outline-none ${
              parseError
                ? "border-rose-300 bg-rose-50/20 text-slate-800 focus:border-rose-500"
                : "border-slate-200 text-slate-800 focus:border-sky-500"
            }`}
          />
          {parseError && (
            <p className="mt-1 flex items-center gap-1 text-[11px] font-medium text-rose-500">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" /> {parseError}
            </p>
          )}
        </div>

        {/* Thống kê & Xem trước dữ liệu */}
        {stats.total > 0 && (
          <div className="space-y-2.5 rounded-xl border border-slate-200 bg-slate-50 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-700">
                  Xem trước:
                </span>
                <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-600">
                  <CheckCircle2 className="h-3.5 w-3.5" /> {stats.withCookies}{" "}
                  có Cookie đăng nhập
                </span>
                {stats.withProxy > 0 && (
                  <span className="flex items-center gap-1 text-[11px] font-semibold text-sky-600">
                    <Globe className="h-3.5 w-3.5" /> {stats.withProxy} có Proxy
                  </span>
                )}
              </div>
            </div>

            {/* Bảng xem trước tối đa 5 profiles */}
            <div className="max-h-36 overflow-y-auto rounded-lg border border-slate-200 bg-white">
              <table className="w-full text-left text-[11px]">
                <thead className="sticky top-0 border-b border-slate-100 bg-slate-50 font-semibold text-slate-600">
                  <tr>
                    <th className="px-3 py-1.5">Tên Kênh (Profile)</th>
                    <th className="px-3 py-1.5">Nhóm</th>
                    <th className="px-3 py-1.5">Cookie Phiên</th>
                    <th className="px-3 py-1.5">Proxy</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  {parsedAccounts.slice(0, 8).map((acc, idx) => {
                    const hasSession =
                      acc.cookies &&
                      (acc.cookies.includes("sessionid") ||
                        acc.cookies.includes("sid_tt"));
                    return (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="px-3 py-1.5 font-bold text-slate-800">
                          {acc.name}
                        </td>
                        <td className="px-3 py-1.5 text-slate-600">
                          {targetGroupOption === "assign"
                            ? isNewGroup && newGroupName.trim()
                              ? newGroupName.trim()
                              : selectedGroup
                            : acc.group_name || "Mặc định"}
                        </td>
                        <td className="px-3 py-1.5">
                          {hasSession ? (
                            <span className="inline-flex items-center gap-0.5 font-bold text-emerald-600">
                              <ShieldCheck className="h-3 w-3" /> Đã đăng nhập
                            </span>
                          ) : (
                            <span className="text-slate-400">
                              Chưa có session
                            </span>
                          )}
                        </td>
                        <td className="max-w-[120px] truncate px-3 py-1.5 text-slate-500">
                          {acc.proxy || "Trực tiếp"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {stats.total > 8 && (
                <div className="border-t border-slate-100 bg-slate-50 p-1.5 text-center text-[10px] text-slate-400">
                  ... và {stats.total - 8} tài khoản khác nữa
                </div>
              )}
            </div>
          </div>
        )}

        {/* Lựa chọn Nhóm đích */}
        <div className="space-y-2.5 rounded-xl border border-slate-200 bg-slate-50/70 p-3">
          <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
            <Users className="h-3.5 w-3.5 text-sky-500" /> Thiết Lập Nhóm Cho
            Profiles Được Nhập:
          </label>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setTargetGroupOption("keep")}
              className={`rounded-lg border p-2.5 text-left text-xs transition-all ${
                targetGroupOption === "keep"
                  ? "border-sky-500 bg-sky-50 font-bold text-sky-800"
                  : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
              }`}
            >
              <div>Giữ nguyên Nhóm trong file JSON</div>
              <div className="mt-0.5 text-[10px] font-normal text-slate-400">
                Tự động tạo nhóm mới nếu nhóm chưa tồn tại
              </div>
            </button>

            <button
              type="button"
              onClick={() => setTargetGroupOption("assign")}
              className={`rounded-lg border p-2.5 text-left text-xs transition-all ${
                targetGroupOption === "assign"
                  ? "border-sky-500 bg-sky-50 font-bold text-sky-800"
                  : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
              }`}
            >
              <div>Gán toàn bộ vào 1 Nhóm cụ thể</div>
              <div className="mt-0.5 text-[10px] font-normal text-slate-400">
                Quy tụ toàn bộ danh sách nạp vào nhóm được chọn
              </div>
            </button>
          </div>

          {targetGroupOption === "assign" && (
            <div className="flex items-center gap-2 pt-1">
              {!isNewGroup ? (
                <>
                  <Select
                    value={selectedGroup}
                    onValueChange={(val) => setSelectedGroup(val)}
                  >
                    <SelectTrigger className="h-8 flex-1 bg-white text-xs">
                      <SelectValue placeholder="Chọn nhóm" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableGroups.map((g) => (
                        <SelectItem key={g} value={g}>
                          {g}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setIsNewGroup(true)}
                    className="h-8 shrink-0 text-xs"
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
                    className="h-8 flex-1 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-800 focus:border-sky-500 focus:outline-none"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setIsNewGroup(false);
                      setNewGroupName("");
                    }}
                    className="h-8 shrink-0 text-xs"
                  >
                    Hủy
                  </Button>
                </>
              )}
            </div>
          )}
        </div>

        {/* Nút hành động */}
        <div className="flex items-center justify-end gap-2.5 border-t border-slate-100 pt-2">
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
            className="bg-sky-600 px-4 text-xs font-bold shadow-sm shadow-sky-600/20 hover:bg-sky-700"
          >
            {loading ? (
              <>
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Đang
                Nạp...
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
