import path from 'path';
import fs from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';
import { chromium, BrowserContext, Page } from 'playwright';
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

  // Nạp cookies nếu có
  if (profile.cookies) {
    try {
      const parsedCookies = JSON.parse(profile.cookies);
      if (Array.isArray(parsedCookies) && parsedCookies.length > 0) {
        await context.addCookies(parsedCookies);
      }
    } catch (_) {}
  }

  activeContexts.set(profile.id, context);

  const pages = context.pages();
  const page = pages.length > 0 ? pages[0] : await context.newPage();

  // Tự động đóng context khi tất cả các tab bị đóng (khắc phục treo trên macOS)
  const onPageClosed = () => {
    setTimeout(async () => {
      try {
        if (context.pages().length === 0) {
          await context.close().catch(() => {});
        }
      } catch (_) {}
    }, 150);
  };
  page.on('close', onPageClosed);
  context.on('page', (p) => p.on('close', onPageClosed));

  return { context, page };
}

/**
 * Mở trình duyệt để người dùng đăng nhập thủ công, tự động lưu Cookie khi đóng
 */
export async function openManualBrowser(profile: ProfileRecord, onClosed?: () => void): Promise<void> {
  const { context, page } = await launchProfileContext(profile, false);
  profileRepo.updateStatus(profile.id, 'manual_session');

  await page.goto('https://www.tiktok.com/', { waitUntil: 'domcontentloaded' }).catch(() => {});

  const userDataDir = path.join(PROFILES_DIR, profile.name);
  let isCleanedUp = false;

  const handleClose = async () => {
    if (isCleanedUp) return;
    isCleanedUp = true;

    try {
      const cookies = await context.cookies().catch(() => []);
      if (cookies.length > 0) {
        profileRepo.update({
          id: profile.id,
          cookies: JSON.stringify(cookies),
          status: 'idle'
        });
      } else {
        profileRepo.updateStatus(profile.id, 'idle');
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

  // Lắng nghe cả event đóng của page và context
  page.on('close', handleClose);
  context.on('close', handleClose);
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
      if (cookies.length > 0) {
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
