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
  two_factor?: string;
  email?: string;
  pass_email?: string;
  mail_ao?: string;
  proxy?: string;
  cookies?: string;
  group_name?: string;
}

function parseCsvText(text: string, delimiter: string = ','): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentCell += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      currentRow.push(currentCell.trim());
      currentCell = '';
    } else if ((char === '\r' || char === '\n') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') {
        i++;
      }
      currentRow.push(currentCell.trim());
      if (currentRow.some((c) => c.length > 0)) {
        rows.push(currentRow);
      }
      currentRow = [];
      currentCell = '';
    } else {
      currentCell += char;
    }
  }
  if (currentCell.length > 0 || currentRow.length > 0) {
    currentRow.push(currentCell.trim());
    if (currentRow.some((c) => c.length > 0)) {
      rows.push(currentRow);
    }
  }
  return rows;
}

const isProxyString = (str?: string): boolean => {
  if (!str) return false;
  const s = str.trim();
  // Nếu chứa dấu chấm phẩy, ngoặc nhọn/vuông hoặc chứa từ khóa cookie -> TUYỆT ĐỐI KHÔNG PHẢI PROXY
  if (
    s.includes(';') ||
    s.includes('sessionid') ||
    s.includes('msToken') ||
    s.includes('sid_tt') ||
    s.includes('ttwid') ||
    s.startsWith('{') ||
    s.startsWith('[')
  ) {
    return false;
  }
  if (/^(https?|socks[45]):\/\//i.test(s)) return true;
  const parts = s.split(':');
  if (parts.length >= 2) {
    const port = Number(parts[1]);
    return !isNaN(port) && port > 0 && port <= 65535;
  }
  return false;
};

const isCookieString = (str?: string): boolean => {
  if (!str) return false;
  const s = str.trim().toLowerCase();
  return (
    s.includes('sessionid') ||
    s.includes('sid_tt') ||
    s.includes('mstoken') ||
    s.includes('ttwid') ||
    s.includes('odin_tt') ||
    s.includes('tt_chain_token') ||
    s.startsWith('[{"') ||
    s.startsWith('{"') ||
    (s.length > 30 && s.includes('='))
  );
};

const isHeaderRow = (parts: string[]): boolean => {
  if (parts.length === 0) return false;
  const p0 = (parts[0] || '').toLowerCase().trim();
  const p1 = (parts[1] || '').toLowerCase().trim();

  // Dòng bắt đầu bằng comment
  if (p0.startsWith('#') || p0.startsWith('//')) return true;

  // Header thật phải khớp chính xác các từ khóa header cố định
  const EXACT_HEADERS = new Set([
    'username', 'user', 'uid', 'taikhoan', 'tài khoản', 'tai khoan',
    'account', 'acc', 'name', 'tên kênh', 'ten kenh', 'stt'
  ]);
  const EXACT_P1_HEADERS = new Set([
    'password', 'pass', 'pwd', 'matkhau', 'mật khẩu', 'mat khau', '2fa'
  ]);

  return EXACT_HEADERS.has(p0) && (parts.length === 1 || EXACT_P1_HEADERS.has(p1));
};

interface HeaderColumnMap {
  name: number;
  pass?: number;
  two_factor?: number;
  email?: number;
  pass_email?: number;
  mail_ao?: number;
  proxy?: number;
  cookies?: number;
  group_name?: number;
}

const parseHeaderMap = (parts: string[]): HeaderColumnMap | null => {
  if (parts.length === 0) return null;
  const map: Partial<HeaderColumnMap> = {};
  let matchCount = 0;

  for (let i = 0; i < parts.length; i++) {
    const raw = parts[i].toLowerCase().replace(/^[#\s/]+/, '').trim();
    if (!raw) continue;

    if (
      map.name === undefined &&
      (raw === 'username' || raw === 'user' || raw === 'uid' || raw === 'account' || raw === 'acc' || raw === 'taikhoan' || raw === 'tài khoản' || raw === 'tai khoan' || raw === 'name' || raw === 'tên kênh')
    ) {
      map.name = i;
      matchCount++;
    } else if (
      map.pass === undefined &&
      (raw === 'password' || raw === 'pass' || raw === 'pwd' || raw === 'matkhau' || raw === 'mật khẩu' || raw === 'mat khau')
    ) {
      map.pass = i;
      matchCount++;
    } else if (
      map.two_factor === undefined &&
      (raw === '2fa' || raw === 'two_factor' || raw === 'twofa' || raw === 'two_fa' || raw === 'fa2' || raw === 'ma2fa' || raw === 'mã 2fa')
    ) {
      map.two_factor = i;
      matchCount++;
    } else if (
      map.pass_email === undefined &&
      (raw === 'pass_email' || raw === 'email_pass' || raw === 'passemail' || raw === 'matkhaumail' || raw === 'mật khẩu mail' || raw === 'passmail')
    ) {
      map.pass_email = i;
      matchCount++;
    } else if (
      map.mail_ao === undefined &&
      (raw === 'mail_ao' || raw === 'mail_kp' || raw === 'mailkp' || raw === 'mailao' || raw === 'recovery_email' || raw === 'email_khoi_phuc' || raw === 'mail khôi phục')
    ) {
      map.mail_ao = i;
      matchCount++;
    } else if (
      map.email === undefined &&
      (raw === 'email' || raw === 'mail' || raw === 'mail_chinh' || raw === 'email_chinh' || raw === 'homthu')
    ) {
      map.email = i;
      matchCount++;
    } else if (
      map.proxy === undefined &&
      (raw === 'proxy' || raw === 'ip' || raw === 'ip_proxy' || raw === 'http_proxy' || raw === 'sock_proxy' || raw === 'socks5')
    ) {
      map.proxy = i;
      matchCount++;
    } else if (
      map.cookies === undefined &&
      (raw === 'cookie' || raw === 'cookies' || raw === 'session' || raw === 'cookie_string')
    ) {
      map.cookies = i;
      matchCount++;
    } else if (
      map.group_name === undefined &&
      (raw === 'nhom' || raw === 'nhóm' || raw === 'group' || raw === 'group_name' || raw === 'nhom_kenh')
    ) {
      map.group_name = i;
      matchCount++;
    }
  }

  if (matchCount >= 2 && map.name !== undefined) {
    return map as HeaderColumnMap;
  }
  return null;
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

  // Phân tích cú pháp text theo thời gian thực chuẩn MMO TikTok
  const parsedAccounts = useMemo(() => {
    if (!rawText.trim()) return [];

    // Bỏ ký tự UTF-8 BOM nếu file Excel CSV có BOM
    const cleanText = rawText.replace(/^\uFEFF/, '').trim();
    if (!cleanText) return [];

    // 1. Tự động nhận diện định dạng JSON (nếu là file backup JSON hoặc mảng JSON)
    if (cleanText.startsWith('[') || cleanText.startsWith('{')) {
      try {
        let parsed = JSON.parse(cleanText);
        if (!Array.isArray(parsed) && parsed && Array.isArray(parsed.profiles)) {
          parsed = parsed.profiles;
        }
        if (Array.isArray(parsed)) {
          return parsed.map((item) => {
            const rawCookie = item.cookies;
            let cookiesStr: string | undefined;
            if (rawCookie) {
              cookiesStr = typeof rawCookie === 'string' ? rawCookie : JSON.stringify(rawCookie);
            }
            return {
              name: String(item.name || item.account_id || item.username || item.uid || '').trim(),
              account_id: String(item.account_id || item.name || item.username || item.uid || '').trim(),
              pass: item.pass || item.password || undefined,
              two_factor: item.two_factor || item.two_fa || item['2fa'] || undefined,
              email: item.email || undefined,
              pass_email: item.pass_email || item.email_pass || undefined,
              mail_ao: item.mail_ao || item.recovery_email || undefined,
              proxy: item.proxy || undefined,
              cookies: cookiesStr,
              group_name: item.group_name || item.group || undefined
            };
          }).filter((acc) => acc.name.length > 0);
        }
      } catch (_) {
        // Không phải JSON hợp lệ, chuyển sang phân tích dòng Delimiter
      }
    }

    // 2. Xác định ký tự phân cách (Separator)
    let activeDelim = separator;
    if (separator === 'auto') {
      if (loadedFileName?.toLowerCase().endsWith('.csv')) {
        activeDelim = ',';
      } else {
        const firstLine = cleanText.split(/[\r\n]+/).find((l) => {
          const t = l.trim();
          return t.length > 0 && !t.startsWith('#') && !t.startsWith('//');
        }) || '';

        const pipeCount = (firstLine.match(/\|/g) || []).length;
        const commaCount = (firstLine.match(/,/g) || []).length;
        const tabCount = (firstLine.match(/\t/g) || []).length;
        const semicolonCount = (firstLine.match(/;/g) || []).length;

        if (pipeCount >= 1 && pipeCount >= commaCount) {
          activeDelim = '|';
        } else if (commaCount >= 1) {
          activeDelim = ',';
        } else if (tabCount >= 1) {
          activeDelim = '\t';
        } else if (semicolonCount >= 1) {
          activeDelim = ';';
        } else {
          activeDelim = '|';
        }
      }
    } else if (separator === 'tab') {
      activeDelim = '\t';
    }

    // 3. Phân tách dòng và cột theo chuẩn RFC CSV / Delimited
    let rawRows: string[][] = [];
    if (activeDelim === ',' || activeDelim === ';') {
      rawRows = parseCsvText(cleanText, activeDelim);
    } else {
      const lines = cleanText.split(/[\r\n]+/);
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('//')) continue;
        rawRows.push(trimmed.split(activeDelim).map((p) => p.trim()));
      }
    }

    const list: ParsedAccount[] = [];
    let headerMap: HeaderColumnMap | null = null;

    if (rawRows.length > 0) {
      headerMap = parseHeaderMap(rawRows[0]);
    }

    const startIndex = headerMap ? 1 : (rawRows.length > 0 && isHeaderRow(rawRows[0]) ? 1 : 0);

    for (let i = startIndex; i < rawRows.length; i++) {
      const parts = rawRows[i].map((p) => p.trim());
      if (parts.length === 0 || !parts[0]) continue;

      const acc: ParsedAccount = {
        name: parts[0],
        account_id: parts[0]
      };

      if (headerMap && parts.length >= 8) {
        if (headerMap.name !== undefined && parts[headerMap.name]) {
          acc.name = parts[headerMap.name];
          acc.account_id = acc.name;
        }
        if (headerMap.pass !== undefined) acc.pass = parts[headerMap.pass] || undefined;
        if (headerMap.two_factor !== undefined) acc.two_factor = parts[headerMap.two_factor] || undefined;
        if (headerMap.email !== undefined) acc.email = parts[headerMap.email] || undefined;
        if (headerMap.pass_email !== undefined) acc.pass_email = parts[headerMap.pass_email] || undefined;
        if (headerMap.mail_ao !== undefined) acc.mail_ao = parts[headerMap.mail_ao] || undefined;

        let rawProxy = headerMap.proxy !== undefined ? parts[headerMap.proxy] : undefined;
        let rawCookie = headerMap.cookies !== undefined ? parts[headerMap.cookies] : undefined;
        if (headerMap.group_name !== undefined) acc.group_name = parts[headerMap.group_name] || undefined;

        if (rawProxy && isCookieString(rawProxy)) {
          if (!rawCookie) rawCookie = rawProxy;
          rawProxy = undefined;
        }
        if (rawCookie && isProxyString(rawCookie)) {
          if (!rawProxy) rawProxy = rawCookie;
          rawCookie = undefined;
        }

        acc.proxy = rawProxy || undefined;
        acc.cookies = rawCookie || undefined;
      } else if (parts.length >= 9) {
        // Cấu trúc chuẩn 9 cột MMO: UID | Pass | 2FA | Email | PassMail | MailKP | Proxy | Cookie | Nhóm
        acc.pass = parts[1] || undefined;
        acc.two_factor = parts[2] || undefined;
        acc.email = parts[3] || undefined;
        acc.pass_email = parts[4] || undefined;
        acc.mail_ao = parts[5] || undefined;
        acc.proxy = parts[6] || undefined;
        acc.cookies = parts[7] || undefined;
        acc.group_name = parts[8] || undefined;
      } else if (parts.length === 8) {
        // 8 cột MMO:
        // TH1 (Có Nhóm, không MailKP): UID | Pass | 2FA | Email | PassMail | Proxy | Cookie | Nhóm
        // TH2 (Có MailKP, không Nhóm): UID | Pass | 2FA | Email | PassMail | MailKP | Proxy | Cookie
        acc.pass = parts[1] || undefined;
        acc.two_factor = parts[2] || undefined;
        acc.email = parts[3] || undefined;
        acc.pass_email = parts[4] || undefined;

        const col5 = parts[5] || '';
        const col6 = parts[6] || '';
        const col7 = parts[7] || '';

        if (isCookieString(col6)) {
          // col6 là Cookie -> col7 là Nhóm, col5 là Proxy
          acc.proxy = col5 || undefined;
          acc.cookies = col6;
          acc.group_name = col7 || undefined;
        } else if (isCookieString(col7)) {
          // col7 là Cookie -> col6 là Proxy, col5 là MailKP
          acc.mail_ao = col5 || undefined;
          acc.proxy = col6 || undefined;
          acc.cookies = col7;
        } else if (isProxyString(col5)) {
          acc.proxy = col5;
          acc.cookies = col6 || undefined;
          acc.group_name = col7 || undefined;
        } else {
          acc.mail_ao = col5 || undefined;
          acc.proxy = col6 || undefined;
          acc.cookies = col7 || undefined;
        }
      } else if (parts.length === 7) {
        // 7 cột MMO:
        // TH1: UID | Pass | 2FA | Email | PassMail | Proxy | Cookie
        // TH2: UID | Pass | 2FA | Email | PassMail | Cookie | Nhóm
        // TH3: UID | Pass | 2FA | Email | PassMail | MailKP | Proxy
        acc.pass = parts[1] || undefined;
        acc.two_factor = parts[2] || undefined;
        acc.email = parts[3] || undefined;
        acc.pass_email = parts[4] || undefined;

        const col5 = parts[5] || '';
        const col6 = parts[6] || '';

        if (isCookieString(col6)) {
          acc.proxy = col5 || undefined;
          acc.cookies = col6;
        } else if (isCookieString(col5)) {
          acc.cookies = col5;
          acc.group_name = col6 || undefined;
        } else if (isProxyString(col5)) {
          acc.proxy = col5;
          acc.cookies = col6 || undefined;
        } else if (isProxyString(col6)) {
          acc.mail_ao = col5 || undefined;
          acc.proxy = col6;
        } else {
          acc.proxy = col5 || undefined;
          acc.cookies = col6 || undefined;
        }
      } else if (parts.length === 6) {
        acc.pass = parts[1] || undefined;
        acc.two_factor = parts[2] || undefined;
        acc.email = parts[3] || undefined;
        acc.pass_email = parts[4] || undefined;
        if (isCookieString(parts[5])) {
          acc.cookies = parts[5];
        } else if (isProxyString(parts[5])) {
          acc.proxy = parts[5];
        } else {
          acc.mail_ao = parts[5] || undefined;
        }
      } else if (parts.length === 5) {
        acc.pass = parts[1] || undefined;
        acc.two_factor = parts[2] || undefined;
        acc.email = parts[3] || undefined;
        acc.pass_email = parts[4] || undefined;
      } else if (parts.length === 4) {
        acc.pass = parts[1] || undefined;
        acc.two_factor = parts[2] || undefined;
        if (isCookieString(parts[3])) {
          acc.cookies = parts[3];
        } else if (isProxyString(parts[3])) {
          acc.proxy = parts[3];
        } else {
          acc.email = parts[3] || undefined;
        }
      } else if (parts.length === 3) {
        acc.pass = parts[1] || undefined;
        if (isProxyString(parts[2])) {
          acc.proxy = parts[2];
        } else if (isCookieString(parts[2])) {
          acc.cookies = parts[2];
        } else {
          acc.two_factor = parts[2] || undefined;
        }
      } else if (parts.length === 2) {
        if (isCookieString(parts[1])) {
          acc.cookies = parts[1];
        } else {
          acc.pass = parts[1] || undefined;
        }
      }

      // Universal Sanity Check: Tránh hoàn toàn lỗi gán nhầm Cookie vào Proxy
      if (acc.proxy && isCookieString(acc.proxy)) {
        if (!acc.cookies) {
          acc.cookies = acc.proxy;
        }
        acc.proxy = undefined;
      }
      if (acc.proxy && !isProxyString(acc.proxy)) {
        acc.proxy = undefined;
      }

      list.push(acc);
    }

    return list;
  }, [rawText, separator, loadedFileName]);

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
          two_factor: acc.two_factor || null,
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
      title="Nhập Nhanh Tài Khoản (Excel CSV / TXT / JSON)"
      description="Hỗ trợ file Excel (.csv), file văn bản (.txt) chuẩn MMO TikTok và file backup JSON. Cấu trúc chuẩn cố định: UID|Pass|2FA|Email|PassMail|MailKhoiPhuc|Proxy|Cookie|Nhom."
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
              <FolderOpen className="h-3.5 w-3.5 mr-1 text-sky-600" /> Chọn File TXT / CSV / JSON Từ Máy
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
              <FileSpreadsheet className="h-3.5 w-3.5 text-sky-600" /> Thứ tự 9 cột chuẩn hóa MMO TikTok (Cố định vị trí, không bị đảo cột):
            </span>
            <span className="text-slate-400 text-[10px] flex items-center gap-1">
              <Info className="h-3 w-3" /> Tự động bỏ qua dòng tiêu đề nếu có
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-1 font-mono text-[10px]">
            <span className="bg-white px-1.5 py-0.5 rounded border border-slate-200 text-slate-700 font-bold">1. UID / User</span>
            <span className="text-slate-300">→</span>
            <span className="bg-white px-1.5 py-0.5 rounded border border-slate-200 text-slate-700">2. Password</span>
            <span className="text-slate-300">→</span>
            <span className="bg-purple-50 px-1.5 py-0.5 rounded border border-purple-200 text-purple-700 font-semibold">3. 2FA (Secret)</span>
            <span className="text-slate-300">→</span>
            <span className="bg-white px-1.5 py-0.5 rounded border border-slate-200 text-slate-700">4. Email</span>
            <span className="text-slate-300">→</span>
            <span className="bg-white px-1.5 py-0.5 rounded border border-slate-200 text-slate-700">5. Pass Email</span>
            <span className="text-slate-300">→</span>
            <span className="bg-white px-1.5 py-0.5 rounded border border-slate-200 text-slate-700">6. Mail Khôi Phục</span>
            <span className="text-slate-300">→</span>
            <span className="bg-white px-1.5 py-0.5 rounded border border-slate-200 text-slate-700">7. Proxy</span>
            <span className="text-slate-300">→</span>
            <span className="bg-white px-1.5 py-0.5 rounded border border-slate-200 text-slate-700">8. Cookie</span>
            <span className="text-slate-300">→</span>
            <span className="bg-white px-1.5 py-0.5 rounded border border-slate-200 text-slate-700 font-bold">9. Nhóm</span>
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
            placeholder={`Dán danh sách tài khoản HOẶC kéo thả file .txt / .csv / .json vào đây:\n# Định dạng 1 (Cơ bản): user|pass\ntiktok_user_01|Pass123456\n\n# Định dạng 2 (Có 2FA): user|pass|2fa\ntiktok_user_02|Pass123456|JBSWY3DPEHPK3PXP\n\n# Định dạng 3 (Không có 2FA, để trống cột 2FA): user|pass||email|passmail\ntiktok_user_03|Pass123456||user03@outlook.com|PassMail123\n\n# Định dạng 4 (Đầy đủ 9 cột chuẩn MMO TikTok):\ntiktok_user_04|Pass123456|JBSWY3DPEHPK3PXP|user04@outlook.com|PassMail123|mailao04@gmail.com|http://user:pass@127.0.0.1:8080|sessionid=xyz|Nhóm Nuôi US`}
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
                  <span className="w-28 truncate">Tài khoản / User</span>
                  <span className="w-20 truncate hidden sm:inline">Mật khẩu</span>
                  <span className="w-28 truncate hidden md:inline">Email</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="w-24 text-center truncate">Nhóm</span>
                  <span className="w-12 text-center">2FA</span>
                  <span className="w-12 text-center">Cookie</span>
                  <span className="w-12 text-center">Proxy</span>
                </div>
              </div>

              {parsedAccounts.slice(0, 15).map((acc, idx) => (
                <div key={idx} className="p-2 flex items-center justify-between gap-2 font-mono hover:bg-slate-50/70 transition-colors">
                  <div className="flex items-center gap-2 truncate min-w-0">
                    <span className="text-slate-400 w-5 shrink-0 text-right text-[10px]">{idx + 1}.</span>
                    <strong className="text-slate-800 w-28 truncate" title={acc.name}>{acc.name}</strong>
                    <span className="text-slate-400 w-20 truncate hidden sm:inline" title={acc.pass || ''}>
                      {acc.pass ? `• ${acc.pass}` : '-'}
                    </span>
                    <span className="text-sky-600 w-28 truncate hidden md:inline" title={acc.email || ''}>
                      {acc.email || '-'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] text-sky-700 bg-sky-50 px-1.5 py-0.5 rounded border border-sky-200 font-medium truncate max-w-[100px] text-center" title={acc.group_name || targetGroup}>
                      {acc.group_name || (isNewGroup && newGroupName.trim() ? newGroupName.trim() : targetGroup)}
                    </span>
                    <span className="w-12 text-center">
                      {acc.two_factor ? (
                        <span className="text-[10px] text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded border border-purple-200 font-semibold truncate inline-block max-w-[50px]" title={`Mã 2FA: ${acc.two_factor}`}>
                          🔐 Có
                        </span>
                      ) : (
                        <span className="text-slate-300 text-[10px]">-</span>
                      )}
                    </span>
                    <span className="w-12 text-center">
                      {acc.cookies ? (
                        <span className="text-[10px] text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 font-semibold" title={acc.cookies}>
                          🍪 Có
                        </span>
                      ) : (
                        <span className="text-slate-300 text-[10px]">-</span>
                      )}
                    </span>
                    <span className="w-12 text-center">
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
