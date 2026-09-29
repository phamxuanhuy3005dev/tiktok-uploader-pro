import { Page } from 'playwright';
import { handleCaptchaWait } from './task-captcha';

export async function dismissPopups(page: Page): Promise<void> {
  if (!page || page.isClosed()) return;
  try {
    // 1. Tutorial / Onboarding "Got it", "Not now", "Skip", "Cancel"
    const genericButtons = [
      'button:has-text("Got it")',
      'button:has-text("Not now")',
      'button:has-text("Skip")',
      'button:has-text("Allow")',
      'button:has-text("Cancel")',
      'div:has-text("Phone mode") button:has-text("Got it")'
    ];

    for (const sel of genericButtons) {
      const btn = page.locator(sel).first();
      if (await btn.isVisible({ timeout: 200 }).catch(() => false)) {
        await btn.click({ force: true }).catch(() => {});
        await page.waitForTimeout(200);
      }
    }
  } catch (_) {}
}

export async function navigateToUpload(
  page: Page,
  profileName: string,
  log: (msg: string) => void
): Promise<void> {
  log('Đang truy cập trang TikTok Studio Upload...');

  let ready = false;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      await page.goto('https://www.tiktok.com/tiktokstudio/upload', {
        waitUntil: 'domcontentloaded',
        timeout: 35000
      });

      // Polling xem đã tải xong giao diện upload chưa
      for (let p = 0; p < 25; p++) {
        await handleCaptchaWait(page, profileName, log);
        await dismissPopups(page);

        const isLoginPage = await page.evaluate(() => window.location.href.includes('login'));
        if (isLoginPage) {
          throw new Error('Tài khoản chưa đăng nhập TikTok! Vui lòng mở profile để đăng nhập.');
        }

        const hasUploadComponent = await page
          .locator('input[type="file"], [data-e2e="upload-video-button"], button.upload-stage-btn')
          .first()
          .isVisible({ timeout: 1000 })
          .catch(() => false);

        if (hasUploadComponent) {
          ready = true;
          break;
        }
        await page.waitForTimeout(1000);
      }

      if (ready) break;
    } catch (e: any) {
      log(`Lần tải trang ${attempt}/3 không thành công: ${e.message}`);
      if (attempt === 3) throw e;
      await page.waitForTimeout(2000);
    }
  }

  if (!ready) {
    throw new Error('Không thể tải giao diện Upload TikTok Studio. Mạng chậm hoặc tài khoản bị giới hạn.');
  }

  log('Giao diện Upload đã sẵn sàng.');
}

export async function attachVideoFile(
  page: Page,
  videoPath: string,
  log: (msg: string) => void
): Promise<void> {
  log(`Đang đính kèm file video: ${videoPath}`);
  let attached = false;

  // Chiến lược 1: Intercept filechooser qua nút bấm
  const uploadButtonSelectors = [
    '[data-e2e="upload-video-button"]',
    'button.upload-stage-btn',
    'button:has-text("Select videos")',
    '.upload-stage-btn',
    'button[class*="upload"]'
  ];

  for (const sel of uploadButtonSelectors) {
    const btn = page.locator(sel).first();
    if (await btn.isVisible({ timeout: 2000 }).catch(() => false)) {
      try {
        const [fileChooser] = await Promise.all([
          page.waitForEvent('filechooser', { timeout: 15000 }),
          btn.click()
        ]);
        await fileChooser.setFiles(videoPath);
        attached = true;
        break;
      } catch (_) {}
    }
  }

  // Chiến lược 2: Gắn trực tiếp qua input[type="file"]
  if (!attached) {
    try {
      const fileInput = page.locator('input[type="file"]').first();
      await fileInput.setInputFiles(videoPath);
      attached = true;
    } catch (_) {}
  }

  if (!attached) {
    throw new Error('Không tìm thấy nút hoặc ô tải video để đính kèm file.');
  }

  log('Đã đính kèm file video. Đang chờ quá trình upload và xử lý preview...');

  // Đợi upload hoàn tất (Nút Post/Schedule xuất hiện và được kích hoạt)
  for (let i = 0; i < 300; i++) {
    // Tối đa 10 phút cho video dài
    await page.waitForTimeout(2000);
    await dismissPopups(page);

    const postBtn = page
      .locator('button[data-e2e="post_video_button"]:not([disabled]), button:has-text("Post"):not([disabled])')
      .first();

    if (await postBtn.isVisible({ timeout: 500 }).catch(() => false)) {
      log('Video đã tải lên và transcode hoàn tất!');
      break;
    }
  }

  await page.waitForTimeout(2000);
}
