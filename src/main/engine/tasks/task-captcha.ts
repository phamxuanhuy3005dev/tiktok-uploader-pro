import { Page } from 'playwright';
import { Notification } from 'electron';

export async function detectCaptcha(page: Page): Promise<boolean> {
  if (!page || page.isClosed()) return false;
  try {
    // 1. Kiểm tra child frames xem có url verify của TikTok
    const frames = page.frames();
    for (const frame of frames) {
      if (frame === page.mainFrame()) continue;
      const url = frame.url() || '';
      if (
        url.includes('verify.tiktok.com') ||
        url.includes('verify.byteoversea.com') ||
        url.includes('verify.snssdk.com') ||
        url.includes('/captcha/') ||
        url.includes('security/captcha')
      ) {
        return true;
      }
    }

    // 2. Kiểm tra các selector modal captcha
    const captchaSelector = [
      'iframe[src*="verify"]',
      'iframe[src*="captcha"]',
      '#captcha-verify-container',
      '#captcha_container',
      '.captcha_verify_container',
      '.captcha-verify-container',
      '[class*="secsdk-captcha"]',
      'div[class*="captcha-verify-box"]',
      'div[class*="verify-wrap"]'
    ].join(', ');

    const count = await page.locator(captchaSelector).count().catch(() => 0);
    if (count > 0) {
      const loc = page.locator(captchaSelector);
      for (let i = 0; i < Math.min(count, 3); i++) {
        if (await loc.nth(i).isVisible().catch(() => false)) {
          return true;
        }
      }
    }

    return false;
  } catch (_) {
    return false;
  }
}

/**
 * Đợi người dùng giải captcha trên trình duyệt (tối đa 180s), có âm thanh cảnh báo
 */
export async function handleCaptchaWait(
  page: Page,
  profileName: string,
  log: (msg: string) => void,
  maxWaitSeconds = 180
): Promise<boolean> {
  const isCaptcha = await detectCaptcha(page);
  if (!isCaptcha) return true;

  log(`[CAPTCHA] Phát hiện yêu cầu xác minh Captcha từ TikTok!`);

  // Bật cửa sổ trình duyệt lên mặt bàn làm việc
  try {
    await page.bringToFront().catch(() => {});
  } catch (_) {}

  // Bắn Native Notification trên hệ điều hành
  try {
    if (Notification.isSupported()) {
      new Notification({
        title: '⚠️ TikTok Captcha Required',
        body: `Kênh [${profileName}] cần giải Captcha để tiếp tục upload!`,
        silent: false
      }).show();
    }
  } catch (_) {}

  const startTime = Date.now();
  const maxWaitMs = maxWaitSeconds * 1000;

  while (Date.now() - startTime < maxWaitMs) {
    if (page.isClosed()) {
      throw new Error('Trình duyệt đã bị đóng trong khi chờ giải Captcha.');
    }
    await page.waitForTimeout(2000);

    const stillPresent = await detectCaptcha(page);
    if (!stillPresent) {
      log(`[CAPTCHA] Đã giải quyết Captcha thành công! Đang tiếp tục...`);
      await page.waitForTimeout(2000);
      return true;
    }
  }

  throw new Error(`Quá thời gian chờ giải Captcha (${maxWaitSeconds}s).`);
}
