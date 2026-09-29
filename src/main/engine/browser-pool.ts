import path from 'path';
import fs from 'fs';
import { chromium, BrowserContext, Page } from 'playwright';
import { ProfileRecord, PROFILES_DIR, profileRepo } from '../db/database';

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

/**
 * Dọn sạch các file lock của Chromium khi phiên trước đó tắt đột ngột
 */
export function cleanBrowserLocks(userDataDir: string): void {
  if (!fs.existsSync(userDataDir)) return;
  const lockFiles = ['SingletonLock', 'SingletonCookie', 'SingletonSocket', 'lockfile'];
  for (const file of lockFiles) {
    const lockPath = path.join(userDataDir, file);
    try {
      if (fs.existsSync(lockPath)) {
        fs.unlinkSync(lockPath);
      }
    } catch (_) {}
  }
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

  cleanBrowserLocks(userDataDir);
  cleanProfileGpuCache(userDataDir);

  const launchOptions: any = {
    headless,
    viewport: null, // Full màn hình
    args: [...CLEAN_CHROME_ARGS],
    // Tắt hoàn toàn cờ --no-sandbox để không hiện thanh cảnh báo của Chrome
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

  // Khởi chạy persistent context thuần với cờ chống bot chuẩn của Chromium
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

  return { context, page };
}

/**
 * Mở trình duyệt để người dùng đăng nhập thủ công, tự động lưu Cookie khi đóng
 */
export async function openManualBrowser(profile: ProfileRecord, onClosed?: () => void): Promise<void> {
  const { context, page } = await launchProfileContext(profile, false);
  profileRepo.updateStatus(profile.id, 'manual_session');

  // Điều hướng vào trang chủ hoặc login TikTok
  await page.goto('https://www.tiktok.com/', { waitUntil: 'domcontentloaded' }).catch(() => {});

  context.on('close', async () => {
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
    if (onClosed) onClosed();
  });
}

/**
 * Đóng an toàn phiên của một profile
 */
export async function closeProfileContext(profileId: string): Promise<void> {
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
}
