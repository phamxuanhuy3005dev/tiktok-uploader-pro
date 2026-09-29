import path from 'path';
import fs from 'fs';
import { chromium, BrowserContext, Page } from 'playwright';
import { ProfileRecord, PROFILES_DIR, profileRepo } from '../db/database';

const activeContexts = new Map<string, BrowserContext>();

const STEALTH_CHROME_ARGS = [
  '--disable-blink-features=AutomationControlled',
  '--no-first-run',
  '--no-default-browser-check',
  '--password-store=basic',
  '--disable-features=UseMultiplaneOverlayForHardwareVideo,IsolateOrigins,site-per-process',
  '--enable-features=PaintHolding',
  '--metrics-recording-only',
  '--disable-breakpad',
  '--disable-sync',
  '--disable-default-apps',
  '--disable-component-update',
  '--start-maximized'
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
 * Tiêm các script Stealth qua evaluateOnNewDocument để TikTok không phát hiện bot
 */
export async function applyStealthScripts(context: BrowserContext): Promise<void> {
  await context.addInitScript(() => {
    // 1. Ghi đè navigator.webdriver
    Object.defineProperty(navigator, 'webdriver', {
      get: () => undefined
    });

    // 2. Fake chrome.runtime
    // @ts-ignore
    window.chrome = {
      runtime: {
        id: undefined,
        connect: () => {},
        sendMessage: () => {}
      },
      loadTimes: () => {},
      csi: () => {},
      app: {}
    };

    // 3. Fake navigator.languages
    Object.defineProperty(navigator, 'languages', {
      get: () => ['vi-VN', 'vi', 'en-US', 'en']
    });

    // 4. Fake navigator.plugins
    Object.defineProperty(navigator, 'plugins', {
      get: () => [1, 2, 3, 4, 5]
    });
  });
}

/**
 * Khởi chạy Browser Context cho một profile
 */
export async function launchProfileContext(
  profile: ProfileRecord,
  headless = false
): Promise<{ context: BrowserContext; page: Page }> {
  const userDataDir = path.join(PROFILES_DIR, profile.name);
  cleanBrowserLocks(userDataDir);

  const launchOptions: any = {
    headless,
    viewport: null, // Dùng toàn màn hình
    args: [...STEALTH_CHROME_ARGS],
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36',
    locale: 'vi-VN',
    timezoneId: 'Asia/Ho_Chi_Minh'
  };

  // Cấu hình Proxy nếu có
  if (profile.proxy && profile.proxy.trim()) {
    const rawProxy = profile.proxy.trim();
    // Parse proxy dạng http://user:pass@ip:port hoặc ip:port:user:pass
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
  await applyStealthScripts(context);

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
