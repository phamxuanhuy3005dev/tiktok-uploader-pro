import React, { useState, useMemo } from 'react';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';
import { 
  Users, 
  FileText, 
  Sparkles, 
  FolderOpen, 
  Download, 
  FileSpreadsheet,
  Info,
  Loader2
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
  pass?: string;
  email?: string;
  pass_email?: string;
  mail_ao?: string;
  proxy?: string;
  cookies?: string;
  group_name?: string;
}

function parseCsvLine(text: string, delimiter: string = ','): string[] {
  const result: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (inQuotes && text[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (c === delimiter && !inQuotes) {
      result.push(cur.trim());
      cur = '';
    } else {
      cur += c;
    }
  }
  result.push(cur.trim());
  return result;
}

const isHeaderRow = (parts: string[]): boolean => {
  if (parts.length === 0) return false;
  const col0 = (parts[0] || '').toLowerCase().trim();
  const col1 = (parts[1] || '').toLowerCase().trim();
  const headerKeywordsCol0 = [
    'username', 'tài khoản', 'tai khoan', 'user', 'account', 'acc', 'name', 'tên kênh', 'ten kenh', 'id'
  ];
  const headerKeywordsCol1 = [
    'password', 'mật khẩu', 'mat khau', 'pass', 'pwd', 'email', 'proxy'
  ];
  if (headerKeywordsCol0.some((k) => col0.includes(k))) return true;
  if (headerKeywordsCol1.some((k) => col1.includes(k))) return true;
  return false;
};

export const BulkImportModal: React.FC<BulkImportModalProps> = ({
  isOpen,
  onClose,
  availableGroups,
  onSuccess
}) => {
  const [rawText, setRawText] = useState('');
  const [loadedFileName, setLoadedFileName] = useState<string | null>(null);
  const [targetGroup, setTargetGroup] = useState('Mặc định');
  const [isNewGroup, setIsNewGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [separator, setSeparator] = useState('auto');
  const [loading, setLoading] = useState(false);

  const handleChooseFile = async () => {
    try {
      const res = await window.api.readTxtFile();
      if (res.success && res.content) {
        setRawText(res.content);
        setLoadedFileName(res.fileName || 'file');
        toast.success(`Đã nạp file: ${res.fileName}`);
      }
    } catch (err: any) {
      toast.error(`Lỗi đọc file: ${err.message}`);
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      const res = await window.api.downloadTemplate();
      if (res.success && res.filePath) {
        const fileName = res.filePath.split(/[/\\]/).pop();
        const typeLabel = res.format === 'csv' ? 'Excel CSV' : 'TXT';
        toast.success(`Đã tải file mẫu [${fileName}] (${typeLabel}) thành công!`);
      }
    } catch (err: any) {
      toast.error(`Lỗi tải file mẫu: ${err.message}`);
    }
  };

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
          toast.success(`Đã nạp file kéo thả: ${file.name}`);
        }
      };
      reader.readAsText(file);
    }
  };

  // Phân tích cú pháp text theo thời gian thực
  const parsedAccounts = useMemo(() => {
    if (!rawText.trim()) return [];

    // Bỏ ký tự UTF-8 BOM nếu file Excel CSV có BOM
    const cleanText = rawText.replace(/^\uFEFF/, '');

    const lines = cleanText
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0 && !l.startsWith('#') && !l.startsWith('//'));

    const list: ParsedAccount[] = [];

    const isCookieToken = (t: string): boolean => {
      if (!t) return false;
      const lower = t.toLowerCase();
      if (lower.includes('sessionid') || lower.includes('sid_tt') || lower.includes('tt_chain_token') || lower.includes('csrf_token')) {
        return true;
      }
      if (t.startsWith('[{"') || t.startsWith('{"')) {
        return true;
      }
      if (t.length > 50 && (t.includes(';') || t.includes('='))) {
        return true;
      }
      return false;
    };

    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
      const line = lines[lineIndex];

      let rawParts: string[] = [];
      if (separator === 'auto') {
        if (line.includes('|')) {
          rawParts = line.split('|').map((p) => p.trim());
        } else if (line.includes(',')) {
          rawParts = parseCsvLine(line, ',');
        } else if (line.includes(';')) {
          rawParts = parseCsvLine(line, ';');
        } else if (line.includes('\t')) {
          rawParts = line.split('\t').map((p) => p.trim());
        } else {
          rawParts = [line.trim()];
        }
      } else if (separator === ',') {
        rawParts = parseCsvLine(line, ',');
      } else if (separator === ';') {
        rawParts = parseCsvLine(line, ';');
      } else {
        const sep = separator === 'tab' ? '\t' : separator;
        rawParts = line.split(sep).map((p) => p.trim());
      }

      if (rawParts.length === 0 || !rawParts[0]) continue;

      // Tự động bỏ qua dòng tiêu đề (Header row ví dụ: Username, Password, Email...)
      if (lineIndex === 0 && isHeaderRow(rawParts)) {
        continue;
      }

      const acc: ParsedAccount = {
        name: rawParts[0],
        account_id: rawParts[0]
      };

      if (rawParts.length >= 8) {
        // user|pass|email|pass_email|mail_ao|proxy|cookies|group
        acc.pass = rawParts[1];
        acc.email = rawParts[2];
        acc.pass_email = rawParts[3];
        acc.mail_ao = rawParts[4];
        acc.proxy = rawParts[5];
        acc.cookies = rawParts[6];
        acc.group_name = rawParts[7];
      } else if (rawParts.length === 7) {
        acc.pass = rawParts[1];
        acc.email = rawParts[2];
        acc.pass_email = rawParts[3];
        acc.mail_ao = rawParts[4];
        acc.proxy = rawParts[5];
        if (isCookieToken(rawParts[6])) {
          acc.cookies = rawParts[6];
        } else {
          acc.group_name = rawParts[6];
        }
      } else {
        // Tách cookie nếu phát hiện thấy trong các cột
        let detectedCookie: string | undefined;
        const parts: string[] = [rawParts[0]];

        for (let i = 1; i < rawParts.length; i++) {
          const token = rawParts[i];
          if (!detectedCookie && isCookieToken(token)) {
            detectedCookie = token;
          } else {
            parts.push(token);
          }
        }

        if (detectedCookie) {
          acc.cookies = detectedCookie;
        }

        if (parts.length === 2) {
          if (parts[1].includes('://') || (parts[1].includes(':') && parts[1].split(':').length >= 2)) {
            acc.proxy = parts[1];
          } else {
            acc.pass = parts[1];
          }
        } else if (parts.length === 3) {
          acc.pass = parts[1];
          if (parts[2].includes('@')) {
            acc.email = parts[2];
          } else if (parts[2].includes(':') || parts[2].includes('://')) {
            acc.proxy = parts[2];
          } else {
            acc.group_name = parts[2];
          }
        } else if (parts.length === 4) {
          acc.pass = parts[1];
          if (parts[2].includes('@')) {
            acc.email = parts[2];
            acc.pass_email = parts[3];
          } else if (parts[2].includes(':') || parts[2].includes('://')) {
            acc.proxy = parts[2];
            acc.group_name = parts[3];
          } else {
            acc.proxy = parts[2];
          }
        } else if (parts.length === 5) {
          acc.pass = parts[1];
          acc.email = parts[2];
          acc.pass_email = parts[3];
          acc.mail_ao = parts[4];
        } else if (parts.length >= 6) {
          acc.pass = parts[1];
          acc.email = parts[2];
          acc.pass_email = parts[3];
          acc.mail_ao = parts[4];
          if (parts[5].includes(':') || parts[5].includes('://')) {
            acc.proxy = parts[5];
            if (parts[6]) acc.group_name = parts[6];
          } else {
            acc.group_name = parts[5];
          }
        }
      }

      list.push(acc);
    }

    return list;
  }, [rawText, separator]);

  const handleImport = async () => {
    if (parsedAccounts.length === 0) {
      toast.error('Chưa có tài khoản hợp lệ nào để nhập!');
      return;
    }

    const groupToUse = isNewGroup && newGroupName.trim() ? newGroupName.trim() : targetGroup;

    setLoading(true);
    try {
      const profilesToCreate = parsedAccounts.map((acc) => {
        const assignedGroup = (acc.group_name && acc.group_name.trim()) ? acc.group_name.trim() : groupToUse;
        return {
          id: `profile_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          name: acc.name,
          group_name: assignedGroup || 'Mặc định',
          account_id: acc.account_id || acc.name,
          pass: acc.pass || null,
          email: acc.email || null,
          pass_email: acc.pass_email || null,
          mail_ao: acc.mail_ao || null,
          proxy: acc.proxy || null,
          cookies: acc.cookies || null,
          video_folder: '',
          enable_music: 1,
          music_mode: 'favorite_rotate',
          favorite_index: 0,
          music_volume: -50,
          schedule_mode: 'auto_increment',
          schedule_interval: 10,
          golden_hours: '11:30,17:30,20:00',
          caption_mode: 'remove_title',
          max_videos: 50,
          status: 'idle'
        };
      });

      const res = await window.api.bulkCreateProfiles(profilesToCreate);
      const uniqueGroups = Array.from(new Set(profilesToCreate.map((p) => p.group_name)));
      toast.success(
        `Đã thêm thành công ${res.count} tài khoản vào ${
          uniqueGroups.length > 1 ? `${uniqueGroups.length} nhóm` : `nhóm [${uniqueGroups[0]}]`
        }!`
      );
      onSuccess(res.profiles);
      setRawText('');
      onClose();
    } catch (err: any) {
      toast.error(`Lỗi nhập hàng loạt: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Nhập Nhanh Tài Khoản (Excel CSV / TXT)"
      description="Hỗ trợ cả file Excel (.csv) và file văn bản (.txt). Hệ thống tự nhận diện cột, nhóm kênh, cookie, proxy và tự bỏ qua dòng tiêu đề."
      className="max-w-3xl"
    >
      <div className="space-y-3.5">
        {/* Chọn nhóm kênh mục tiêu */}
        <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5 text-sky-500" /> Nhóm Kênh Mặc Định (Nếu dòng tài khoản không chỉ định nhóm)
            </label>
            <button
              type="button"
              onClick={() => setIsNewGroup(!isNewGroup)}
              className="text-[11px] text-sky-600 font-semibold hover:underline"
            >
              {isNewGroup ? 'Chọn nhóm có sẵn' : '+ Tạo nhóm mới'}
            </button>
          </div>

          {isNewGroup ? (
            <input
              type="text"
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              placeholder="Nhập tên nhóm mới (ví dụ: Kênh US Mua 30/9)..."
              className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-white text-slate-800 focus:outline-none focus:border-sky-500"
            />
          ) : (
            <select
              value={targetGroup}
              onChange={(e) => setTargetGroup(e.target.value)}
              className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-white text-slate-800 font-medium focus:outline-none focus:border-sky-500"
            >
              {Array.from(new Set(['Mặc định', ...availableGroups])).filter(Boolean).map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Thanh công cụ: Nạp file, Tải template mẫu, Chọn dấu phân cách */}
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleChooseFile}
              className="h-7 text-xs border-sky-300 text-sky-700 bg-sky-50/70 hover:bg-sky-100 font-medium px-2.5"
            >
              <FolderOpen className="h-3.5 w-3.5 mr-1 text-sky-600" /> Chọn File CSV / TXT Từ Máy
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleDownloadTemplate}
              title="Tải file mẫu Excel (.csv) hoặc Text (.txt) có sẵn cột và dữ liệu mẫu"
              className="h-7 text-xs border-emerald-300 text-emerald-700 bg-emerald-50/70 hover:bg-emerald-100 font-medium px-2.5"
            >
              <Download className="h-3.5 w-3.5 mr-1 text-emerald-600" /> Tải File Mẫu (CSV / TXT)
            </Button>

            {loadedFileName && (
              <span className="text-[11px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 font-medium truncate max-w-[180px]" title={loadedFileName}>
                📄 {loadedFileName}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-slate-500 font-medium">Phân cách:</span>
            <select
              value={separator}
              onChange={(e) => setSeparator(e.target.value)}
              className="border border-slate-200 rounded px-2 py-0.5 bg-white text-slate-700 font-mono text-xs focus:outline-none focus:border-sky-500"
            >
              <option value="auto">Tự động phát hiện (Khuyên dùng)</option>
              <option value="|">Gạch đứng | (MMO chuẩn)</option>
              <option value=",">Dấu phẩy , (Excel CSV)</option>
              <option value=";">Dấu chấm phẩy ;</option>
              <option value="tab">Tab (Copy từ Excel)</option>
            </select>
          </div>
        </div>

        {/* Cấu trúc các cột chuẩn hóa */}
        <div className="bg-slate-50/90 p-2.5 rounded-lg border border-slate-200/80 text-[11px] text-slate-600 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-slate-700 font-bold flex items-center gap-1">
              <FileSpreadsheet className="h-3.5 w-3.5 text-sky-600" /> Thứ tự 8 cột chuẩn hóa:
            </span>
            <span className="text-slate-400 text-[10px] flex items-center gap-1">
              <Info className="h-3 w-3" /> Tự động bỏ qua dòng tiêu đề nếu có
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-1 font-mono text-[10px]">
            <span className="bg-white px-1.5 py-0.5 rounded border border-slate-200 text-slate-700 font-bold">1. Username</span>
            <span className="text-slate-300">→</span>
            <span className="bg-white px-1.5 py-0.5 rounded border border-slate-200 text-slate-700">2. Password</span>
            <span className="text-slate-300">→</span>
            <span className="bg-white px-1.5 py-0.5 rounded border border-slate-200 text-slate-700">3. Email</span>
            <span className="text-slate-300">→</span>
            <span className="bg-white px-1.5 py-0.5 rounded border border-slate-200 text-slate-700">4. Pass Email</span>
            <span className="text-slate-300">→</span>
            <span className="bg-white px-1.5 py-0.5 rounded border border-slate-200 text-slate-700">5. Mail Ảo</span>
            <span className="text-slate-300">→</span>
            <span className="bg-white px-1.5 py-0.5 rounded border border-slate-200 text-slate-700">6. Proxy</span>
            <span className="text-slate-300">→</span>
            <span className="bg-white px-1.5 py-0.5 rounded border border-slate-200 text-slate-700">7. Cookie</span>
            <span className="text-slate-300">→</span>
            <span className="bg-white px-1.5 py-0.5 rounded border border-slate-200 text-slate-700 font-bold">8. Nhóm Kênh</span>
          </div>
        </div>

        {/* Khung dán Textarea & Kéo Thả File */}
        <div className="space-y-1">
          <textarea
            rows={6}
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            placeholder={`Dán danh sách tài khoản tại đây HOẶC kéo thả file .csv / .txt vào đây (mỗi dòng 1 acc):\nUsername,Password,Email,Pass_Email,Mail_Ao,Proxy,Cookie,Nhom\ntiktok_user_01,Pass123456,user01@outlook.com,PassMail123,mailao01@gmail.com,http://user:pass@127.0.0.1:8080,sessionid=xxxxx...,Nhóm Nuôi US\ntiktok_user_02,Pass654321,,,,socks5://192.168.1.100:1080,,Nhóm Reup\nuser_demo_03|Pass789|demo@gmail.com|passdemo||||Nhóm Test`}
            className="w-full p-2.5 font-mono text-xs rounded-xl border border-slate-200 bg-white text-slate-800 placeholder-slate-400 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-all"
          />
        </div>

        {/* Bảng xem trước phân tích kết quả */}
        {parsedAccounts.length > 0 && (
          <div className="bg-sky-50/60 p-3 rounded-xl border border-sky-100 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-sky-900 flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-sky-600" />
                Đã nhận diện: {parsedAccounts.length} tài khoản hợp lệ
              </span>
              <Badge variant="success" className="text-[10px]">
                Sẵn sàng thêm
              </Badge>
            </div>

            {/* Bảng danh sách tài khoản với tiêu đề cột rõ ràng */}
            <div className="max-h-40 overflow-y-auto rounded-lg border border-sky-200/80 bg-white divide-y divide-slate-100 text-[11px]">
              {/* Header cột của bảng xem trước */}
              <div className="sticky top-0 bg-slate-50 p-2 flex items-center justify-between gap-2 font-bold text-slate-600 text-[10px] border-b border-slate-200">
                <div className="flex items-center gap-2 truncate min-w-0">
                  <span className="w-5 shrink-0 text-right">STT</span>
                  <span className="w-32 truncate">Tài khoản / User</span>
                  <span className="w-24 truncate hidden sm:inline">Mật khẩu</span>
                  <span className="w-32 truncate hidden md:inline">Email</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="w-28 text-center truncate">Nhóm</span>
                  <span className="w-14 text-center">Cookie</span>
                  <span className="w-14 text-center">Proxy</span>
                </div>
              </div>

              {parsedAccounts.slice(0, 15).map((acc, idx) => (
                <div key={idx} className="p-2 flex items-center justify-between gap-2 font-mono hover:bg-slate-50/70 transition-colors">
                  <div className="flex items-center gap-2 truncate min-w-0">
                    <span className="text-slate-400 w-5 shrink-0 text-right text-[10px]">{idx + 1}.</span>
                    <strong className="text-slate-800 w-32 truncate" title={acc.name}>{acc.name}</strong>
                    <span className="text-slate-400 w-24 truncate hidden sm:inline" title={acc.pass || ''}>
                      {acc.pass ? `• ${acc.pass}` : '-'}
                    </span>
                    <span className="text-sky-600 w-32 truncate hidden md:inline" title={acc.email || ''}>
                      {acc.email || '-'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] text-sky-700 bg-sky-50 px-1.5 py-0.5 rounded border border-sky-200 font-medium truncate max-w-[120px] text-center" title={acc.group_name || targetGroup}>
                      {acc.group_name || (isNewGroup && newGroupName.trim() ? newGroupName.trim() : targetGroup)}
                    </span>
                    <span className="w-14 text-center">
                      {acc.cookies ? (
                        <span className="text-[10px] text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 font-semibold" title={acc.cookies}>
                          🍪 Có
                        </span>
                      ) : (
                        <span className="text-slate-300 text-[10px]">-</span>
                      )}
                    </span>
                    <span className="w-14 text-center">
                      {acc.proxy ? (
                        <span className="text-[10px] text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200" title={acc.proxy}>
                          🌐 Có
                        </span>
                      ) : (
                        <span className="text-slate-300 text-[10px]">-</span>
                      )}
                    </span>
                  </div>
                </div>
              ))}
              {parsedAccounts.length > 15 && (
                <div className="p-1.5 text-center text-slate-400 text-[10px] bg-slate-50 italic">
                  ... và {parsedAccounts.length - 15} tài khoản khác tiếp theo
                </div>
              )}
            </div>
          </div>
        )}

        {/* Nút thao tác */}
        <div className="flex justify-end gap-2.5 pt-2 border-t border-slate-100">
          <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={loading} className="text-xs">
            Hủy Bỏ
          </Button>
          <Button
            type="button"
            variant="default"
            size="sm"
            onClick={handleImport}
            disabled={loading || parsedAccounts.length === 0}
            className="text-xs shadow-sm shadow-sky-500/20"
          >
            {loading && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
            {loading ? 'Đang thêm tài khoản...' : `Xác Nhận Thêm ${parsedAccounts.length} Tài Khoản`}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
