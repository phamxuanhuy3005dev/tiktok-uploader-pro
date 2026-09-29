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
    }
  };

  // Cấu hình Proxy nếu có
  if (profile.proxy && profile.proxy.trim()) {
    const rawProxy = profile.proxy.trim();
    if (rawProxy.includes('://')) {
      launchOptions.proxy = { server: rawProxy };
    } else {
      const parts = rawProxy.split(':');
      if (parts.length === 4) {
        launchOptions.proxy = {
          server: `http://${parts[0]}:${parts[1]}`,
          username: parts[2],
          password: parts[3]
        };
      } else if (parts.length === 2) {
        launchOptions.proxy = {
          server: `http://${parts[0]}:${parts[1]}`
        };
      }
    }
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
