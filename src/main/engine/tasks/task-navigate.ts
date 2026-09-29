import { Page } from 'playwright';
import { handleCaptchaWait, isCaptchaActive } from './task-captcha';

/**
 * Xử lý tự động đóng tất cả các loại popup/modal/hướng dẫn của TikTok Studio
 * Tuyệt đối không bấm nhầm vào Captcha hoặc nút Discard/Exit làm hỏng video.
 */
export async function dismissPopups(page: Page, log?: (msg: string) => void): Promise<boolean> {
  if (!page || page.isClosed()) return false;

  // Nếu Captcha đang xuất hiện, không dismiss tránh phá vỡ giao diện Captcha
  if (await isCaptchaActive(page)) {
    return false;
  }

  let dismissedAny = false;

  try {
    // 1. Popup "Turn on automatic content checks" -> Luôn chọn Cancel
    const contentCheckCancel = page
      .locator(
        'div[role="dialog"]:has-text("content checks") button:has-text("Cancel"), div:has-text("automatic content checks") button:has-text("Cancel"), div.TUXModal button:has-text("Cancel")'
      )
      .first();

    if (await contentCheckCancel.isVisible({ timeout: 400 }).catch(() => false)) {
      await contentCheckCancel.click({ force: true }).catch(() => {});
      if (log) log('Đã đóng popup: "Turn on automatic content checks" -> Cancel');
      dismissedAny = true;
      await page.waitForTimeout(400);
    }

    // 2. Tutorial Tooltips / Joyride modals (Phone mode, features added, etc.)
    const tutorialButtons = [
      'div:has-text("Phone mode") button:has-text("Got it")',
      '.react-joyride__tooltip button:has-text("Got it")',
      '.react-joyride__tooltip button:has-text("Next")',
      '.react-joyride__tooltip button[aria-label="Close"]',
      '[class*="tutorial-tooltip"] button:has-text("Got it")',
      '[class*="tutorial-tooltip"] button:has-text("Next")',
      '[class*="tutorial-tooltip"] button:has-text("Skip")',
      '[class*="editor-guide"] button:has-text("Got it")',
      '[class*="joyride"] button:has-text("Got it")',
      'button:has-text("Got it")',
      'button:has-text("Not now")',
      'button:has-text("Skip")',
      'button:has-text("Allow")'
    ];

    for (const sel of tutorialButtons) {
      const btn = page.locator(sel).first();
      if (await btn.isVisible({ timeout: 250 }).catch(() => false)) {
        await btn.click({ force: true }).catch(() => {});
        dismissedAny = true;
        await page.waitForTimeout(300);
      }
    }

    // 3. Banner bản nháp cũ chưa lưu ("A video you were editing wasn't saved")
    const draftBannerDiscard = page
      .locator(
        'div:has-text("wasn’t saved") button:has-text("Discard"), div:has-text("wasn\'t saved") button:has-text("Discard")'
      )
      .first();
    if (await draftBannerDiscard.isVisible({ timeout: 250 }).catch(() => false)) {
      if (log) log('Phát hiện bản nháp chưa lưu từ lần trước. Đang bấm Discard để làm sạch form...');
      await draftBannerDiscard.click({ force: true }).catch(() => {});
      await page.waitForTimeout(400);

      const confirmDiscard = page
        .locator('div[role="dialog"]:has-text("Discard") button:has-text("Discard")')
        .first();
      if (await confirmDiscard.isVisible({ timeout: 800 }).catch(() => false)) {
        await confirmDiscard.click({ force: true }).catch(() => {});
        if (log) log('Đã xác nhận xoá bản nháp cũ thành công.');
        await page.waitForTimeout(500);
      }
      dismissedAny = true;
    }

    // 4. Popup xác nhận Discard / Exit khác -> Luôn chọn Stay/Cancel/Not now, KHÔNG chọn Discard
    const exitCancelBtn = page
      .locator(
        'div[role="dialog"]:has-text("Discard") button:has-text("Not now"), div[role="dialog"]:has-text("Discard") button:has-text("Cancel"), div[role="dialog"]:has-text("exit") button:has-text("Cancel")'
      )
      .first();
    if (await exitCancelBtn.isVisible({ timeout: 200 }).catch(() => false)) {
      await exitCancelBtn.click({ force: true }).catch(() => {});
      dismissedAny = true;
      await page.waitForTimeout(300);
    }

    // 5. Dọn dẹp overlay mờ nếu bị kẹt sau khi modal đã đóng (tránh chặn click)
    await page.evaluate(() => {
      const overlays = document.querySelectorAll('.TUXModal-overlay, [data-floating-ui-portal]');
      overlays.forEach((o) => {
        const text = (o as HTMLElement).innerText || '';
        // Chỉ gỡ nếu không chứa Captcha/Verification và không còn dialog con
        if (
          !text.includes('Captcha') &&
          !text.includes('verify') &&
          !text.includes('xác minh') &&
          !o.querySelector('div[role="dialog"]')
        ) {
          try {
            o.remove();
          } catch (_) {}
        }
      });
    }).catch(() => {});

  } catch (_) {}

  return dismissedAny;
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
        await dismissPopups(page, log);

        const isLoginPage = await page.evaluate(() => window.location.href.includes('login'));
        if (isLoginPage) {
          throw new Error('Tài khoản chưa đăng nhập TikTok! Vui lòng mở profile để đăng nhập.');
        }

        // Kiểm tra xem đã có input[type="file"] trong DOM HOẶC nút Select videos hiển thị HOẶC đã ở form edit
        const hasFileInput = (await page.locator('input[type="file"]').count().catch(() => 0)) > 0;
        const hasUploadButton = await page
          .locator('button.upload-stage-btn, [data-e2e="upload-video-button"], button:has-text("Select videos")')
          .first()
          .isVisible({ timeout: 500 })
          .catch(() => false);
        const hasForm = await page
          .locator('button[data-e2e="post_video_button"], button:has-text("Post"), .caption-editor')
          .first()
          .isVisible({ timeout: 500 })
          .catch(() => false);

        if (hasFileInput || hasUploadButton || hasForm) {
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

  // Chiến lược 1: Đính kèm trực tiếp qua input[type="file"] (nhanh nhất và chuẩn nhất của Playwright)
  try {
    const fileInput = page.locator('input[type="file"]').first();
    if ((await fileInput.count()) > 0) {
      log('Đang nạp file trực tiếp qua input[type="file"]...');
      await fileInput.setInputFiles(videoPath);
      attached = true;
      log('Đã nạp file video thành công.');
    }
  } catch (err: any) {
    log(`Nạp file trực tiếp qua input[type="file"] gặp lỗi: ${err.message}. Chuyển sang chiến lược dự phòng...`);
  }

  // Chiến lược 2: Intercept filechooser qua nút bấm "Select videos" (dự phòng)
  if (!attached) {
    const uploadButtonSelectors = [
      'button.upload-stage-btn',
      '[data-e2e="upload-video-button"]',
      'button:has-text("Select videos")',
      '.upload-stage-btn',
      'button[class*="upload"]'
    ];

    for (const sel of uploadButtonSelectors) {
      const btn = page.locator(sel).first();
      if (await btn.isVisible({ timeout: 2500 }).catch(() => false)) {
        try {
          log(`Tìm thấy nút tải video: ${sel}. Đang mở hộp thoại chọn file...`);
          const [fileChooser] = await Promise.all([
            page.waitForEvent('filechooser', { timeout: 15000 }),
            btn.click()
          ]);
          await fileChooser.setFiles(videoPath);
          attached = true;
          log('Đã chọn file thành công qua hộp thoại.');
          break;
        } catch (err: any) {
          log(`Chiến lược dự phòng (${sel}) gặp lỗi: ${err.message}`);
        }
      }
    }
  }

  if (!attached) {
    throw new Error('Không tìm thấy nút hoặc ô tải video để đính kèm file.');
  }

  log('Đã đính kèm file video. Đang chờ chuyển sang màn hình biên tập và xử lý video preview...');

  // Đợi giao diện chuyển sang màn hình Edit / Form và dismiss các popup onboarding
  for (let i = 0; i < 300; i++) {
    // Tối đa 10 phút cho video dài
    await page.waitForTimeout(2000);
    await dismissPopups(page, log);

    // Kiểm tra xem đã xuất hiện nút Sounds / Edit video hoặc nút Post chưa
    const hasEditorOrPost = await page
      .locator(
        'button[data-button-name="sounds"], .editor-entrance[data-button-name="sounds"], button[data-e2e="post_video_button"], button:has-text("Post"), .caption-editor, [contenteditable="true"]'
      )
      .first()
      .isVisible({ timeout: 500 })
      .catch(() => false);

    if (hasEditorOrPost) {
      log('Video đã tải lên, màn hình biên tập & thông tin video đã sẵn sàng!');
      break;
    }
  }

  await dismissPopups(page, log);
  await page.waitForTimeout(1500);
}
