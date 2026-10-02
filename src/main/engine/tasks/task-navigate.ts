import { Page } from "playwright";
import { handleCaptchaWait, isCaptchaActive } from "./task-captcha";

/**
 * Đăng ký bộ xử lý tự động ngầm (giữ tương thích ngược)
 */
export function registerAutoDismissHandlers(
  _page: Page,
  _log?: (msg: string) => void,
): void {
  // Không dùng addLocatorHandler ngầm để tránh trigger gián đoạn và spam log
}

/**
 * Xử lý tự động đóng tất cả các loại popup/modal/hướng dẫn của TikTok Studio
 * Theo cơ chế modal-scoped chuẩn từ upload_tiktok
 */
export async function dismissPopups(
  page: Page,
  log?: (msg: string) => void,
): Promise<boolean> {
  if (!page || page.isClosed()) return false;

  // Nếu Captcha đang xuất hiện, không dismiss tránh phá vỡ giao diện Captcha
  if (await isCaptchaActive(page)) {
    return false;
  }

  const modalSelectors = [
    'div[role="dialog"]',
    "div.TUXModal:not(.TUXModal-overlay)",
    'div[class*="common-modal"]:not([class*="overlay"])',
    'div[class*="modal"]:not([class*="overlay"])',
    'div[class*="Modal"]:not([class*="overlay"])',
    ".react-joyride__tooltip",
    '[class*="tutorial-tooltip"]',
    'div[class*="portal"]',
    'div[class*="dialog"]',
  ];

  let dismissedAny = false;

  for (const modalSel of modalSelectors) {
    try {
      const modals = await page.$$(modalSel);
      for (const modal of modals) {
        try {
          if (!(await modal.isVisible())) continue;
          const text = (await modal.innerText().catch(() => "")) || "";
          if (!text.trim()) continue;

          // 1. Popup "Turn on automatic content checks" -> Cancel
          if (
            text.includes("automatic content checks") ||
            text.includes("content checks") ||
            text.includes("Turn on automatic")
          ) {
            const cancelBtn = await modal.$('button:has-text("Cancel")');
            if (cancelBtn && (await cancelBtn.isVisible())) {
              await cancelBtn.scrollIntoViewIfNeeded().catch(() => {});
              try {
                await cancelBtn.click({ timeout: 3000 });
              } catch (_) {
                await cancelBtn
                  .evaluate((el: HTMLElement) => el.click())
                  .catch(() => {});
              }
              if (log)
                log(
                  '[dismissPopups] Đã đóng popup: "Turn on automatic content checks" -> Cancel',
                );
              dismissedAny = true;
              return true;
            }
          }

          // 2. Popup "Are you sure you want to exit / leave?" -> Cancel / Stay
          if (
            text.includes("Are you sure you want to exit") ||
            text.includes("want to leave") ||
            text.includes("Leave page")
          ) {
            const cancelBtn = await modal.$(
              'button:has-text("Cancel"), button:has-text("Stay"), button:has-text("No")',
            );
            if (cancelBtn && (await cancelBtn.isVisible())) {
              await cancelBtn.scrollIntoViewIfNeeded().catch(() => {});
              try {
                await cancelBtn.click({ timeout: 3000 });
              } catch (_) {
                await cancelBtn
                  .evaluate((el: HTMLElement) => el.click())
                  .catch(() => {});
              }
              if (log)
                log(
                  '[dismissPopups] Đã bấm "Cancel" trên popup "Are you sure you want to exit?"',
                );
              dismissedAny = true;
              return true;
            }
          }

          // 3. Popup "Allow your video to be saved for scheduled posting?" -> Allow
          if (
            text.includes("scheduled posting") ||
            text.includes("saved for scheduled")
          ) {
            const allowBtn = await modal.$(
              'button:has-text("Allow"), button:has-text("Cho phép")',
            );
            if (allowBtn && (await allowBtn.isVisible())) {
              await allowBtn.scrollIntoViewIfNeeded().catch(() => {});
              try {
                await allowBtn.click({ timeout: 3000 });
              } catch (_) {
                await allowBtn
                  .evaluate((el: HTMLElement) => el.click())
                  .catch(() => {});
              }
              if (log)
                log(
                  '[dismissPopups] Đã bấm "Allow" trên popup cho phép lưu video lên lịch.',
                );
              dismissedAny = true;
              return true;
            }
          }

          // 4. Các popup generic: Got it, Allow, Skip, OK, Close, Not now, Next
          const genericBtnSelectors = [
            'button:has-text("Got it")',
            'button:has-text("Allow")',
            'button:has-text("Skip")',
            'button:has-text("OK")',
            'button:has-text("Okay")',
            'button:has-text("Close")',
            'button:has-text("Not now")',
            'button:has-text("Next")',
          ];

          for (const btnSel of genericBtnSelectors) {
            const btn = await modal.$(btnSel);
            if (btn && (await btn.isVisible())) {
              await btn.scrollIntoViewIfNeeded().catch(() => {});
              try {
                await btn.click({ timeout: 3000 });
              } catch (_) {
                await btn
                  .evaluate((el: HTMLElement) => el.click())
                  .catch(() => {});
              }
              if (log)
                log(`[dismissPopups] Đã đóng popup hướng dẫn -> ${btnSel}`);
              dismissedAny = true;
              return true;
            }
          }
        } catch (_) {}
      }
    } catch (_) {}
  }

  // Dọn dẹp overlay mờ nếu bị kẹt sau khi modal đã đóng (tránh chặn click)
  await page
    .evaluate(() => {
      const overlays = document.querySelectorAll(".TUXModal-overlay");
      overlays.forEach((o) => {
        const text = (o as HTMLElement).innerText || "";
        if (
          !text.includes("Captcha") &&
          !text.includes("verify") &&
          !text.includes("xác minh") &&
          !o.querySelector('div[role="dialog"]')
        ) {
          try {
            o.remove();
          } catch (_) {}
        }
      });
    })
    .catch(() => {});

  return dismissedAny;
}

export async function navigateToUpload(
  page: Page,
  profileName: string,
  log: (msg: string) => void,
): Promise<void> {
  log("Đang truy cập trang TikTok Studio Upload...");

  let ready = false;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      await page.goto("https://www.tiktok.com/tiktokstudio/upload", {
        waitUntil: "domcontentloaded",
        timeout: 35000,
      });

      // Polling xem đã tải xong giao diện upload chưa
      for (let p = 0; p < 25; p++) {
        await handleCaptchaWait(page, profileName, log);
        await dismissPopups(page, log);

        const isLoginPage = await page.evaluate(() =>
          window.location.href.includes("login"),
        );
        if (isLoginPage) {
          throw new Error(
            "Tài khoản chưa đăng nhập TikTok! Vui lòng mở profile để đăng nhập.",
          );
        }

        // Kiểm tra xem đã có input[type="file"] trong DOM HOẶC nút Select videos hiển thị HOẶC đã ở form edit
        const hasFileInput =
          (await page
            .locator('input[type="file"]')
            .count()
            .catch(() => 0)) > 0;
        const hasUploadButton = await page
          .locator(
            'button.upload-stage-btn, [data-e2e="upload-video-button"], button:has-text("Select videos")',
          )
          .first()
          .isVisible({ timeout: 500 })
          .catch(() => false);
        const hasForm = await page
          .locator(
            'button[data-e2e="post_video_button"], button:has-text("Post"), .caption-editor',
          )
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
    throw new Error(
      "Không thể tải giao diện Upload TikTok Studio. Mạng chậm hoặc tài khoản bị giới hạn.",
    );
  }

  // Kiểm tra và dọn dẹp bản nháp cũ chưa lưu (chỉ làm 1 lần lúc vào trang)
  try {
    const draftBannerDiscard = page
      .locator(
        'div:has-text("wasn’t saved") button:has-text("Discard"), div:has-text("wasn\'t saved") button:has-text("Discard")',
      )
      .first();
    if (
      await draftBannerDiscard.isVisible({ timeout: 500 }).catch(() => false)
    ) {
      log("Phát hiện bản nháp chưa lưu từ lần trước. Đang làm sạch form...");
      await draftBannerDiscard.click({ force: true }).catch(() => {});
      await page.waitForTimeout(400);

      const confirmDiscard = page
        .locator(
          'div[role="dialog"]:has-text("Discard") button:has-text("Discard")',
        )
        .first();
      if (
        await confirmDiscard.isVisible({ timeout: 1000 }).catch(() => false)
      ) {
        await confirmDiscard.click({ force: true }).catch(() => {});
        await page.waitForTimeout(400);
      }
    }
  } catch (_) {}

  log("Giao diện Upload đã sẵn sàng.");
}

export async function attachVideoFile(
  page: Page,
  videoPath: string,
  log: (msg: string) => void,
): Promise<void> {
  log(`Đang đính kèm file video: ${videoPath}`);
  let attached = false;

  await dismissPopups(page, log);

  // Kiểm tra nếu trang đang ở form edit cũ và có nút "Replace"
  try {
    const replaceBtn = page
      .locator('button:has-text("Replace"), button[class*="replace"]')
      .first();
    if (await replaceBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
      log(
        "Phát hiện màn hình chỉnh sửa cũ có nút Replace. Đang thay thế bằng video mới...",
      );
      const [fileChooser] = await Promise.all([
        page.waitForEvent("filechooser", { timeout: 20000 }),
        (async () => {
          await replaceBtn.scrollIntoViewIfNeeded().catch(() => {});
          try {
            await replaceBtn.click({ force: true, timeout: 3000 });
          } catch (_) {
            await replaceBtn
              .evaluate((b: HTMLElement) => b.click())
              .catch(() => {});
          }
        })(),
      ]);
      await fileChooser.setFiles(videoPath);
      attached = true;
      log("Đã thay thế video thành công qua nút Replace.");
    }
  } catch (err: any) {
    log(`Không dùng được nút Replace: ${err.message}`);
  }

  // Chiến lược 1: Intercept filechooser qua nút bấm Upload (chuẩn theo tiktok-at)
  if (!attached) {
    const uploadButtonSelectors = [
      '[data-e2e="upload-video-button"]',
      "button.upload-stage-btn",
      'button:has-text("Select videos")',
      ".upload-stage-btn",
      'button[class*="upload"]',
    ];

    for (const sel of uploadButtonSelectors) {
      try {
        const el = await page
          .waitForSelector(sel, { timeout: 5000, state: "visible" })
          .catch(() => null);
        if (el) {
          log(`Tìm thấy nút tải video: ${sel}. Đang mở hộp thoại chọn file...`);
          const [fileChooser] = await Promise.all([
            page.waitForEvent("filechooser", { timeout: 20000 }),
            (async () => {
              await el.scrollIntoViewIfNeeded().catch(() => {});
              try {
                await el.click({ force: true, timeout: 3000 });
              } catch (_) {
                await el
                  .evaluate((b: HTMLElement) => b.click())
                  .catch(() => {});
              }
            })(),
          ]);
          await fileChooser.setFiles(videoPath);
          attached = true;
          log(`Chiến lược 1 thành công qua ${sel}.`);
          break;
        }
      } catch (err: any) {
        log(
          `Selector ${sel} gặp lỗi: ${err.message}. Thử selector tiếp theo...`,
        );
      }
    }
  }

  // Chiến lược 2: Unhide input[type="file"] và trigger click (giống tiktok-at)
  if (!attached) {
    try {
      log(
        'Chiến lược 2: Hiển thị input[type="file"] và kích hoạt chọn file...',
      );
      await page.evaluate(() => {
        const input = document.querySelector(
          'input[type="file"]',
        ) as HTMLElement | null;
        if (input) {
          input.style.display = "block";
          input.style.visibility = "visible";
          input.style.opacity = "1";
          input.style.position = "fixed";
          input.style.top = "0";
          input.style.left = "0";
          input.style.zIndex = "99999";
        }
      });
      await page.waitForTimeout(500);

      const [fileChooser] = await Promise.all([
        page.waitForEvent("filechooser", { timeout: 10000 }),
        page.click('input[type="file"]'),
      ]);
      await fileChooser.setFiles(videoPath);
      attached = true;
      log("Chiến lược 2 thành công.");
    } catch (err: any) {
      log(`Chiến lược 2 gặp lỗi: ${err.message}`);
    }
  }

  // Chiến lược 3: Đính kèm trực tiếp Playwright setInputFiles
  if (!attached) {
    try {
      log('Chiến lược 3: Đính kèm trực tiếp vào input[type="file"]...');
      const fileInput = page.locator('input[type="file"]').first();
      await fileInput.setInputFiles(videoPath);
      attached = true;
      log("Chiến lược 3 thành công.");
    } catch (err: any) {
      log(`Chiến lược 3 gặp lỗi: ${err.message}`);
    }
  }

  if (!attached) {
    throw new Error("Không tìm thấy nút hoặc ô tải video để đính kèm file.");
  }

  log(
    "Đã đính kèm file video. Đang chờ chuyển sang màn hình biên tập và xử lý video preview...",
  );

  // Đợi giao diện chuyển sang màn hình Edit / Form và dismiss các popup onboarding
  for (let i = 0; i < 300; i++) {
    // Tối đa 10 phút cho video dài
    await page.waitForTimeout(2000);
    await dismissPopups(page, log);

    // Kiểm tra xem đã xuất hiện nút Sounds / Edit video hoặc nút Post chưa
    const hasEditorOrPost = await page
      .locator(
        'button[data-button-name="sounds"], .editor-entrance[data-button-name="sounds"], button[data-e2e="post_video_button"], button:has-text("Post"), .caption-editor, [contenteditable="true"]',
      )
      .first()
      .isVisible({ timeout: 500 })
      .catch(() => false);

    if (hasEditorOrPost) {
      log("Video đã tải lên, màn hình biên tập & thông tin video đã sẵn sàng!");
      break;
    }
  }

  await dismissPopups(page, log);
  await page.waitForTimeout(1500);
}
