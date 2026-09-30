import path from 'path';
import fs from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';
import { chromium, BrowserContext, Page } from 'playwright';
import Database from 'better-sqlite3';
import { ProfileRecord, PROFILES_DIR, profileRepo } from '../db/database';

const execAsync = promisify(exec);
const activeContexts = new Map<string, BrowserContext>();

const CLEAN_CHROME_ARGS = [
  '--disable-blink-features=AutomationControlled',
  '--no-first-run',
  '--no-default-browser-check',
  '--password-store=basic',
  '--disable-direct-composition-video-overlays',
  '--disable-features=UseMultiplaneOverlayForHardwareVideo',
  '--enable-features=PaintHolding',
  '--metrics-recording-only',
  '--disable-breakpad',
  '--disable-prompt-on-repost',
  '--disable-sync',
  '--disable-default-apps',
  '--disable-component-update',
  '--lang=en-US'
];

const LOCK_FILES = ['SingletonLock', 'SingletonCookie', 'SingletonSocket', 'lockfile'];

/**
 * Quét danh sách PID của Chromium/Chrome đang chạy trên thư mục UserDataDir này
 */
export async function getProfilePids(userDataDir: string): Promise<number[]> {
  if (!userDataDir || !fs.existsSync(userDataDir)) return [];
  try {
    if (process.platform === 'win32') {
      const dirName = path.basename(userDataDir).replace(/["'\\]/g, '');
      if (!dirName) return [];
      const psCmd = `powershell -NoProfile -NonInteractive -Command "Get-CimInstance Win32_Process | Where-Object { ($_.Name -like '*chrome*') -and ($_.CommandLine -like '*${dirName}*') } | Select-Object -ExpandProperty ProcessId"`;
      const { stdout } = await execAsync(psCmd).catch(() => ({ stdout: '' }));
      return stdout
        .split('\n')
        .map((s) => parseInt(s.trim(), 10))
        .filter((pid) => pid && !isNaN(pid) && pid > 0);
    } else {
      // macOS và Linux
      const { stdout } = await execAsync('ps -Ao pid,args').catch(() => ({ stdout: '' }));
      const pids: number[] = [];
      for (const line of stdout.split('\n')) {
        if (
          line.includes(userDataDir) &&
          (line.includes('chrome') || line.includes('Chromium') || line.includes('Google Chrome'))
        ) {
          const parts = line.trim().split(/\s+/);
          const pid = parseInt(parts[0], 10);
          if (pid && !isNaN(pid) && pid !== process.pid) {
            pids.push(pid);
          }
        }
      }
      return pids;
    }
  } catch {
    return [];
  }
}

/**
 * Dọn sạch triệt để các tiến trình Chromium chạy ngầm và file lock trên macOS/Win
 * Giải quyết 100% lỗi nhấp nháy, kẹt process khi bấm X đóng rồi mở lại
 */
export async function releaseProfileLocks(userDataDir: string, profileName: string): Promise<void> {
  if (!userDataDir || !fs.existsSync(userDataDir)) return;

  let foundLocks: string[] = [];
  for (const file of LOCK_FILES) {
    const p = path.join(userDataDir, file);
    try {
      const s = fs.lstatSync(p);
      if (s.isSymbolicLink() || s.isFile() || s.isSocket()) {
        foundLocks.push(p);
      }
    } catch (_) {}
  }

  // Nếu không có bất kỳ file lock nào, không cần quét tiến trình ngầm (tăng tốc độ 100x)
  if (foundLocks.length === 0) return;

  // 1. Kill toàn bộ process Chrome cũ đang giữ thư mục này
  const pids = await getProfilePids(userDataDir);
  if (pids.length > 0) {
    console.log(`[${profileName}] Phát hiện ${pids.length} tiến trình Chrome cũ còn chạy ngầm. Đang dọn sạch...`);
    for (const pid of pids) {
      try {
        if (process.platform === 'win32') {
          await execAsync(`taskkill /F /T /PID ${pid}`).catch(() => {});
        } else {
          process.kill(pid, 'SIGKILL');
        }
      } catch (_) {}
    }
    await new Promise((r) => setTimeout(r, 100));
  }

  // 2. Unlink lock files
  for (const lockPath of foundLocks) {
    try {
      fs.unlinkSync(lockPath);
    } catch (_) {}
  }

  await new Promise((r) => setTimeout(r, 100));
}

/**
 * Xóa cache shader GPU tránh lỗi treo WebGL / Captcha
 */
export function cleanProfileGpuCache(userDataDir: string): void {
  if (!fs.existsSync(userDataDir)) return;
  const staleDirs = [
    path.join(userDataDir, 'Default', 'GPUCache'),
    path.join(userDataDir, 'Default', 'DawnGraphiteCache'),
    path.join(userDataDir, 'Default', 'DawnWebGPUCache'),
    path.join(userDataDir, 'GrShaderCache'),
    path.join(userDataDir, 'ShaderCache')
  ];
  for (const dir of staleDirs) {
    try {
      if (fs.existsSync(dir)) {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    } catch (_) {}
  }
}

export interface ParsedProxy {
  server: string;
  username?: string;
  password?: string;
}

export interface ProxyTestResult {
  success: boolean;
  ip?: string;
  latencyMs?: number;
  error?: string;
}

/**
 * Chuẩn hóa và parse mọi định dạng Proxy:
 * - host:port:user:pass
 * - host:port
 * - http://user:pass@host:port
 * - socks5://user:pass@host:port
 * - user:pass@host:port
 */
export function parseProxy(rawProxy?: string | null): ParsedProxy | undefined {
  if (!rawProxy || !rawProxy.trim()) return undefined;
  let str = rawProxy.trim();

  // 1. Format: host:port:username:password
  const colonParts = str.split(':');
  if (!str.includes('://') && !str.includes('@') && colonParts.length === 4) {
    return {
      server: `http://${colonParts[0]}:${colonParts[1]}`,
      username: colonParts[2],
      password: colonParts[3]
    };
  }

  // 2. Format: host:port
  if (!str.includes('://') && !str.includes('@') && colonParts.length === 2) {
    return {
      server: `http://${colonParts[0]}:${colonParts[1]}`
    };
  }

  // 3. Nếu thiếu protocol (ví dụ user:pass@host:port), thêm http://
  if (!str.includes('://')) {
    str = `http://${str}`;
  }

  try {
    const parsed = new URL(str);
    const protocol = parsed.protocol || 'http:';
    const server = `${protocol}//${parsed.hostname}${parsed.port ? `:${parsed.port}` : ''}`;
    const result: ParsedProxy = { server };

    if (parsed.username) {
      result.username = decodeURIComponent(parsed.username);
    }
    if (parsed.password) {
      result.password = decodeURIComponent(parsed.password);
    }

    return result;
  } catch {
    return { server: str };
  }
}

/**
 * Tự động chọn engine trình duyệt:
 * Ưu tiên Chromium Playwright nội bộ -> Fallback sang Google Chrome / Edge có sẵn trên máy người dùng
 */
export function resolveBrowserLaunchOptions(): { channel?: string; executablePath?: string } {
  try {
    const pwPath = chromium.executablePath();
    if (pwPath && fs.existsSync(pwPath)) {
      return {};
    }
  } catch (_) {}

  if (process.platform === 'darwin') {
    if (fs.existsSync('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome')) {
      return { channel: 'chrome' };
    }
  } else if (process.platform === 'win32') {
    const winPaths = [
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      path.join(process.env.LOCALAPPDATA || '', 'Google\\Chrome\\Application\\chrome.exe')
    ];
    if (winPaths.some((p) => fs.existsSync(p))) {
      return { channel: 'chrome' };
    }
    const edgePaths = [
      'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
      'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'
    ];
    if (edgePaths.some((p) => fs.existsSync(p))) {
      return { channel: 'msedge' };
    }
  }

  return { channel: 'chrome' };
}

/**
 * Kiểm tra kết nối thực tế qua Proxy bằng Playwright Chromium
 */
export async function testProxyConnection(rawProxy?: string | null): Promise<ProxyTestResult> {
  const proxyConfig = parseProxy(rawProxy);
  if (!proxyConfig) {
    return { success: false, error: 'Chưa nhập địa chỉ proxy hoặc định dạng không hợp lệ.' };
  }

  const startTime = Date.now();
  let testBrowser;
  try {
    const browserOpts: any = {
      headless: true,
      proxy: proxyConfig,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      ...resolveBrowserLaunchOptions()
    };
    testBrowser = await chromium.launch(browserOpts);

    const context = await testBrowser.newContext({
      locale: 'en-US'
    });
    const page = await context.newPage();

    const response = await page.goto('https://api.ipify.org?format=json', {
      timeout: 15000,
      waitUntil: 'commit'
    });

    if (!response || !response.ok()) {
      throw new Error(`HTTP ${response?.status() || 'Unknown'}`);
    }

    const bodyText = await page.textContent('body');
    const elapsed = Date.now() - startTime;
    const json = JSON.parse(bodyText || '{}');

    return {
      success: true,
      ip: json.ip || 'Unknown IP',
      latencyMs: elapsed
    };
  } catch (err: any) {
    const elapsed = Date.now() - startTime;
    let errMsg = err.message || 'Lỗi không xác định';
    if (errMsg.includes('ERR_TIMED_OUT') || errMsg.includes('Timeout') || errMsg.includes('timeout')) {
      errMsg = 'Quá thời gian chờ (Proxy Timeout - Kiểm tra lại server proxy hoặc whitelist IP mạng nhà).';
    } else if (errMsg.includes('ERR_PROXY_CONNECTION_FAILED')) {
      errMsg = 'Không kết nối được tới Proxy (Sai IP/Port hoặc máy chủ proxy offline).';
    } else if (errMsg.includes('ERR_PROXY_AUTH_REQUESTED') || errMsg.includes('407')) {
      errMsg = 'Proxy yêu cầu tài khoản/mật khẩu xác thực (407 Proxy Authentication Required).';
    }
    return {
      success: false,
      latencyMs: elapsed,
      error: errMsg
    };
  } finally {
    if (testBrowser) {
      await testBrowser.close().catch(() => {});
    }
  }
}

export interface TikTokCookieObject {
  name: string;
  value: string;
  domain?: string;
  path?: string;
  expires?: number;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: 'Strict' | 'Lax' | 'None';
}

/**
 * Universal Cookie Parser cho TikTok & MMO:
 * Hỗ trợ mọi định dạng cookie phổ biến trên thị trường MMO:
 * 1. Chuỗi header: "sessionid=xxxx; sid_tt=yyyy; tt_chain_token=zzzz; ..."
 * 2. JSON Array từ extensions (EditThisCookie, J2TEAM, Cookie-Editor)
 * 3. Base64 encoded JSON hoặc chuỗi cookie
 * 4. Netscape format (tab-separated)
 */
export function normalizeTikTokCookies(rawCookies?: string | any[] | null): TikTokCookieObject[] {
  if (!rawCookies) return [];

  let data: any = rawCookies;

  if (typeof data === 'string') {
    let str = data.trim();
    if (!str) return [];

    // 1. Thử giải mã nếu là chuỗi Base64
    if (!str.startsWith('[') && !str.startsWith('{') && !str.includes(';') && str.length > 30) {
      try {
        const decoded = Buffer.from(str, 'base64').toString('utf-8');
        if (decoded.startsWith('[') || decoded.startsWith('{') || decoded.includes('=')) {
          str = decoded.trim();
        }
      } catch (_) {}
    }

    // 2. Thử parse nếu là JSON
    if (str.startsWith('[') || str.startsWith('{')) {
      try {
        data = JSON.parse(str);
      } catch (_) {
        // Fallback sang xử lý text
      }
    }

    // 3. Nếu vẫn là chuỗi: parse dạng "name=val; name2=val2" hoặc Netscape
    if (typeof data === 'string') {
      const results: TikTokCookieObject[] = [];

      // Netscape tab-separated format
      if (str.includes('\t')) {
        const lines = str.split('\n');
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith('#')) continue;
          const cols = trimmed.split('\t');
          if (cols.length >= 7) {
            results.push({
              domain: cols[0].startsWith('.') ? cols[0] : `.${cols[0]}`,
              path: cols[2] || '/',
              secure: cols[3].toUpperCase() === 'TRUE',
              expires: parseInt(cols[4], 10) || undefined,
              name: cols[5].trim(),
              value: cols[6].trim()
            });
          }
        }
        if (results.length > 0) return results;
      }

      // Chuẩn HTTP Cookie string: name=value; name2=value2
      const pairs = str.split(';');
      for (const pair of pairs) {
        const trimmed = pair.trim();
        if (!trimmed) continue;
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx > 0) {
          const name = trimmed.substring(0, eqIdx).trim();
          let value = trimmed.substring(eqIdx + 1).trim();
          if (value.startsWith('"') && value.endsWith('"')) {
            value = value.slice(1, -1);
          }
          if (name && value) {
            results.push({
              name,
              value,
              domain: '.tiktok.com',
              path: '/'
            });
          }
        }
      }
      return results;
    }
  }

  // 4. Nếu là Array (từ JSON parse hoặc object array)
  if (Array.isArray(data)) {
    return data
      .map((item: any) => {
        if (!item || !item.name || item.value === undefined) return null;
        let domain = item.domain || '.tiktok.com';
        if (!domain.includes('tiktok.com')) {
          domain = '.tiktok.com';
        }
        return {
          name: String(item.name).trim(),
          value: String(item.value).trim(),
          domain,
          path: item.path || '/',
          expires: item.expires || item.expirationDate || undefined,
          httpOnly: item.httpOnly !== undefined ? Boolean(item.httpOnly) : undefined,
          secure: item.secure !== undefined ? Boolean(item.secure) : true
        } as TikTokCookieObject;
      })
      .filter((c): c is TikTokCookieObject => c !== null && Boolean(c.name));
  }

  return [];
}

/**
 * Kiểm tra xem dữ liệu cookies có chứa phiên đăng nhập TikTok hợp lệ hay không.
 * Phiên đăng nhập TikTok bắt buộc phải có sessionid hoặc sessionid_ss hoặc sid_tt.
 * Tránh trường hợp chỉ có các cookie theo dõi ẩn danh (ttwid, tt_csrf_token...) nhưng báo "Đã đăng nhập".
 */
export function isTikTokLoggedIn(rawCookies?: string | any[] | null): boolean {
  if (!rawCookies) return false;
  if (typeof rawCookies === 'string') {
    if (!rawCookies.trim()) return false;
    return /sessionid|sessionid_ss|sid_tt/i.test(rawCookies);
  }
  if (Array.isArray(rawCookies)) {
    return rawCookies.some(
      (c) =>
        c &&
        (c.name === 'sessionid' || c.name === 'sessionid_ss' || c.name === 'sid_tt') &&
        c.value &&
        String(c.value).trim().length > 5
    );
  }
  return false;
}

/**
 * Khởi chạy Browser Context cho một profile
 */
export async function launchProfileContext(
  profile: ProfileRecord,
  headless = false
): Promise<{ context: BrowserContext; page: Page }> {
  const userDataDir = path.join(PROFILES_DIR, profile.name);
  if (!fs.existsSync(userDataDir)) {
    fs.mkdirSync(userDataDir, { recursive: true });
  }

  // Nếu context đang tồn tại từ phiên trước, dọn dẹp trước khi mở mới
  if (activeContexts.has(profile.id)) {
    try {
      const oldCtx = activeContexts.get(profile.id);
      await oldCtx?.close().catch(() => {});
    } catch (_) {}
    activeContexts.delete(profile.id);
  }

  // Dọn sạch hoàn toàn các tiến trình Chrome cũ và lock files trước khi mở
  await releaseProfileLocks(userDataDir, profile.name);
  cleanProfileGpuCache(userDataDir);

  const launchOptions: any = {
    headless,
    viewport: null, // Full màn hình
    args: [...CLEAN_CHROME_ARGS],
    ignoreDefaultArgs: ['--no-sandbox'],
    locale: 'en-US',
    extraHTTPHeaders: {
      'Accept-Language': 'en-US,en;q=0.9'
    },
    ...resolveBrowserLaunchOptions()
  };

  // Cấu hình Proxy nếu có
  const proxyConfig = parseProxy(profile.proxy);
  if (proxyConfig) {
    launchOptions.proxy = proxyConfig;
    console.log(
      `[${profile.name}] 🌐 Kích hoạt Proxy: ${proxyConfig.server} ${
        proxyConfig.username ? `(User: ${proxyConfig.username})` : '(Direct Auth)'
      }`
    );
  }

  const context = await chromium.launchPersistentContext(userDataDir, launchOptions);

  // Nạp cookies thông minh nếu có (hỗ trợ JSON, Base64, string header sessionid=...)
  if (profile.cookies) {
    try {
      const parsedCookies = normalizeTikTokCookies(profile.cookies);
      if (parsedCookies.length > 0) {
        await context.addCookies(parsedCookies as any);
        const hasSession = parsedCookies.some((c) => c.name === 'sessionid' || c.name === 'sessionid_ss');
        console.log(
          `[${profile.name}] 🍪 Đã nạp thành công ${parsedCookies.length} cookies vào trình duyệt ${
            hasSession ? '(Có sessionid login)' : ''
          }.`
        );
      }
    } catch (e: any) {
      console.warn(`[${profile.name}] Cảnh báo khi nạp cookies:`, e.message);
    }
  }

  activeContexts.set(profile.id, context);

  const pages = context.pages();
  const page = pages.length > 0 ? pages[0] : await context.newPage();

  // Tự động đóng context khi TẤT CẢ các tab đều bị đóng (cho phép mở/đóng tab linh hoạt)
  const checkAllPagesClosed = () => {
    setTimeout(async () => {
      try {
        const remaining = context.pages().filter((p) => !p.isClosed());
        if (remaining.length === 0) {
          await context.close().catch(() => {});
        }
      } catch (_) {}
    }, 250);
  };
  page.on('close', checkAllPagesClosed);
  context.on('page', (p) => p.on('close', checkAllPagesClosed));

  return { context, page };
}

/**
 * Đưa cửa sổ trình duyệt đang mở của profile lên tiền cảnh (focus / bring to front)
 */
export async function focusProfileBrowser(profileId: string): Promise<boolean> {
  const context = activeContexts.get(profileId);
  if (!context) return false;

  const pages = context.pages().filter((p) => !p.isClosed());
  if (pages.length === 0) return false;

  try {
    const page = pages[pages.length - 1];
    await page.bringToFront().catch(() => {});

    // Trên macOS: Focus chính xác process Chrome/Chromium của profile này bằng unix id (PID)
    if (process.platform === 'darwin') {
      const profile = profileRepo.getById(profileId);
      if (profile) {
        const userDataDir = path.join(PROFILES_DIR, profile.name);
        const pids = await getProfilePids(userDataDir);
        for (const pid of pids) {
          execAsync(
            `osascript -e 'tell application "System Events" to set frontmost of first process whose unix id is ${pid} to true'`
          ).catch(() => {});
        }
      }
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Kiểm tra nhanh trực tiếp file SQLite Cookies trên đĩa cứng xem có chứa sessionid hay không (< 1ms)
 */
export function hasSessionInCookieDb(userDataDir: string): boolean {
  if (!userDataDir || !fs.existsSync(userDataDir)) return false;
  const cookieDb = path.join(userDataDir, 'Default', 'Cookies');
  if (!fs.existsSync(cookieDb)) return false;
  try {
    const tempDb = new Database(cookieDb, { readonly: true, fileMustExist: true });
    const row = tempDb
      .prepare(
        "SELECT 1 FROM cookies WHERE (name = 'sessionid' OR name = 'sessionid_ss' OR name = 'sid_tt') LIMIT 1"
      )
      .get();
    tempDb.close();
    return Boolean(row);
  } catch {
    return false;
  }
}

/**
 * Trích xuất an toàn mảng cookies đầy đủ từ thư mục userDataDir bằng Chromium headless (< 150ms)
 */
export async function extractProfileCookies(userDataDir: string): Promise<any[]> {
  if (!userDataDir || !fs.existsSync(userDataDir)) return [];
  try {
    const headlessCtx = await chromium.launchPersistentContext(userDataDir, {
      headless: true,
      args: [...CLEAN_CHROME_ARGS],
      ...resolveBrowserLaunchOptions()
    });
    const cookies = await headlessCtx.cookies().catch(() => []);
    await headlessCtx.close().catch(() => {});
    return cookies;
  } catch (e: any) {
    console.warn(`[extractProfileCookies] Lỗi khi trích xuất cookies:`, e.message);
    return [];
  }
}

/**
 * Mở trình duyệt để người dùng đăng nhập thủ công, tự động lưu Cookie khi đóng
 */
export async function openManualBrowser(
  profile: ProfileRecord,
  onClosed?: () => void,
  onUpdated?: () => void
): Promise<void> {
  const { context, page } = await launchProfileContext(profile, false);
  profileRepo.updateStatus(profile.id, 'manual_session');

  await page.goto('https://www.tiktok.com/', { waitUntil: 'domcontentloaded' }).catch(() => {});

  const userDataDir = path.join(PROFILES_DIR, profile.name);
  let isCleanedUp = false;

  // 1. Quét định kỳ mỗi 2 giây trong khi người dùng duyệt web
  // Ngay khi vừa đăng nhập thành công là app tự đổi sang "Đã đăng nhập" trong realtime!
  let isSynced = isTikTokLoggedIn(profile.cookies);
  const syncInterval = setInterval(async () => {
    if (isCleanedUp) {
      clearInterval(syncInterval);
      return;
    }
    try {
      const cookies = await context.cookies().catch(() => []);
      if (isTikTokLoggedIn(cookies)) {
        if (!isSynced) {
          isSynced = true;
          profileRepo.update({
            id: profile.id,
            cookies: JSON.stringify(cookies)
          });
          console.log(`[${profile.name}] 🟢 Phát hiện đăng nhập TikTok thành công trong lúc duyệt web!`);
          if (onUpdated) onUpdated();
        }
      }
    } catch (_) {}
  }, 2000);

  const handleClose = async () => {
    if (isCleanedUp) return;
    isCleanedUp = true;
    clearInterval(syncInterval);

    try {
      let cookies: any[] = [];
      try {
        cookies = await context.cookies().catch(() => []);
      } catch (_) {}

      // Nếu context đã đóng trước đó -> trích xuất trực tiếp từ userDataDir trên đĩa
      if (cookies.length === 0 && hasSessionInCookieDb(userDataDir)) {
        console.log(`[${profile.name}] 🔍 Tìm thấy sessionid trên disk, đang đồng bộ cookies...`);
        cookies = await extractProfileCookies(userDataDir);
      }

      const loggedIn = isTikTokLoggedIn(cookies);
      if (loggedIn) {
        profileRepo.update({
          id: profile.id,
          cookies: JSON.stringify(cookies),
          status: 'idle'
        });
        console.log(`[${profile.name}] ✅ Đã xác nhận đăng nhập TikTok thành công (Có sessionid)!`);
      } else {
        profileRepo.update({
          id: profile.id,
          cookies: null,
          status: 'idle'
        });
        console.log(`[${profile.name}] ⚠️ Đóng trình duyệt: Chưa đăng nhập hoặc login thất bại (Không có sessionid).`);
      }
    } catch (_) {
      profileRepo.updateStatus(profile.id, 'idle');
    }

    activeContexts.delete(profile.id);
    await context.close().catch(() => {});

    // Giải phóng triệt để process Chrome còn treo sau khi bấm đóng X trên macOS
    await releaseProfileLocks(userDataDir, profile.name).catch(() => {});

    if (onClosed) onClosed();
  };

  // QUAN TRỌNG: Chỉ lắng nghe context.on('close'), TUYỆT ĐỐI KHÔNG gán page.on('close', handleClose)
  // để người dùng đóng tab đầu tiên (tiktok.com) vẫn không bị đóng luôn toàn bộ trình duyệt!
  context.on('close', handleClose);
}

/**
 * Kiểm tra xem profile có đang mở trình duyệt trong browser pool hay không
 */
export function isProfileActive(profileId: string): boolean {
  return activeContexts.has(profileId);
}

/**
 * Đóng an toàn phiên của một profile
 */
export async function closeProfileContext(profileId: string): Promise<void> {
  const profile = profileRepo.getById(profileId);
  const ctx = activeContexts.get(profileId);
  if (ctx) {
    try {
      const cookies = await ctx.cookies().catch(() => []);
      if (isTikTokLoggedIn(cookies)) {
        profileRepo.update({
          id: profileId,
          cookies: JSON.stringify(cookies)
        });
      }
      await ctx.close().catch(() => {});
    } catch (_) {}
    activeContexts.delete(profileId);
  }

  if (profile) {
    const userDataDir = path.join(PROFILES_DIR, profile.name);
    await releaseProfileLocks(userDataDir, profile.name).catch(() => {});
  }
}

/**
 * Đóng toàn bộ các context browser đang chạy khi app thoát hoặc tắt
 */
export async function closeAllActiveContexts(): Promise<void> {
  const ids = Array.from(activeContexts.keys());
  for (const id of ids) {
    await closeProfileContext(id).catch(() => {});
  }
  activeContexts.clear();
}

