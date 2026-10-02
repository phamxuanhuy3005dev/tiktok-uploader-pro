import fs from "fs";
import path from "path";
import { Page, Response } from "playwright";
import { configRepo, ProfileRecord } from "../../db/database";
import { handleCaptchaWait } from "./task-captcha";
import { dismissPopups } from "./task-navigate";

export async function processCaption(
  page: Page,
  log: (msg: string) => void,
): Promise<void> {
  log("Tiến hành xóa sạch tiêu đề video (để trống tiêu đề)...");
  const captionLocator = page
    .locator(
      '.public-DraftEditor-content, [contenteditable="true"], textarea[placeholder*="caption" i], [role="textbox"]',
    )
    .first();

  await captionLocator
    .waitFor({ state: "visible", timeout: 10000 })
    .catch(() => {});
  if (!(await captionLocator.isVisible().catch(() => false))) {
    log("Không tìm thấy ô nhập Caption. Bỏ qua bước xóa tiêu đề.");
    return;
  }

  await captionLocator.focus();
  const selectAll = process.platform === "darwin" ? "Meta+A" : "Control+A";
  await page.keyboard.press(selectAll);
  await page.keyboard.press("Backspace");

  log("Đã xóa sạch tiêu đề video (để trống tiêu đề).");
  await page.waitForTimeout(1000);
}

export async function submitAndConfirmPost(
  page: Page,
  profile: ProfileRecord,
  videoPath: string,
  log: (msg: string) => void,
): Promise<{ videoId: string | null; videoUrl: string | null }> {
  log("Bắt đầu nhấn nút Xuất bản (Post / Schedule)...");

  let capturedVideoId: string | null = null;

  // Lắng nghe API response để bắt Video ID
  const responseHandler = async (res: Response) => {
    try {
      const url = res.url();
      if (
        res.status() >= 200 &&
        res.status() < 300 &&
        (url.includes("/publish") ||
          url.includes("/create") ||
          url.includes("/post") ||
          url.includes("/item"))
      ) {
        const text = await res.text().catch(() => "");
        const match = text.match(
          /"(?:publish_id|video_id|item_id|aweme_id)"\s*:\s*"(\d+)"/,
        );
        if (match && match[1]) {
          capturedVideoId = match[1];
          log(`[API Capture] Bắt được Video ID chính thức: ${capturedVideoId}`);
        }
      }
    } catch (_) {}
  };

  page.on("response", responseHandler);

  let confirmed = false;

  for (let attempt = 1; attempt <= 10; attempt++) {
    await handleCaptchaWait(page, profile.name, log);
    await dismissPopups(page, log);

    const postSelectors = [
      'button[data-e2e="post_video_button"]',
      "button.common-button-post-video",
      'button:has-text("Schedule")',
      'button:has-text("Lên lịch")',
      'button:has-text("Post"):not(:has-text("draft"))',
    ];

    let targetBtn: any = null;
    for (const sel of postSelectors) {
      const btn = page.locator(sel).first();
      if (await btn.isVisible({ timeout: 1000 }).catch(() => false)) {
        const disabled = await btn.getAttribute("disabled");
        const ariaDisabled = await btn.getAttribute("aria-disabled");
        if (disabled === null && ariaDisabled !== "true") {
          targetBtn = btn;
          break;
        }
      }
    }

    if (targetBtn) {
      const btnLabel = (
        (await targetBtn.innerText().catch(() => "")) || "Post"
      ).trim();
      log(`Nhấn nút ${btnLabel} (Lần ${attempt}/10)...`);
      await targetBtn.scrollIntoViewIfNeeded().catch(() => {});
      try {
        await targetBtn.click({ timeout: 5000 });
      } catch (_) {
        try {
          await targetBtn.click({ force: true, timeout: 5000 });
        } catch (_) {
          // Fallback an toàn qua DOM click nếu bị lỗi Element is out of view khi cửa sổ thu nhỏ
          await targetBtn
            .evaluate((node: HTMLElement) => node.click())
            .catch(() => {});
        }
      }
      await page.waitForTimeout(2000);
      await dismissPopups(page, log);
    }

    // Kiểm tra đã xuất bản thành công chưa
    for (let poll = 0; poll < 3; poll++) {
      await page.waitForTimeout(4000);
      await handleCaptchaWait(page, profile.name, log);

      const isSuccessMsg = await page
        .locator(
          'text="Uploaded", text="Success", text="View video", text="Manage your posts", text="Scheduled"',
        )
        .first()
        .isVisible({ timeout: 1000 })
        .catch(() => false);

      const isRedirected =
        !page.url().includes("upload") ||
        page.url().includes("manage") ||
        page.url().includes("content");

      if (isSuccessMsg || isRedirected) {
        log("Xác nhận đăng bài thành công 100%!");
        confirmed = true;
        break;
      }
    }

    if (confirmed) break;
  }

  page.removeListener("response", responseHandler);

  if (!confirmed) {
    throw new Error(
      "Không thể xác nhận trạng thái xuất bản thành công của video.",
    );
  }

  // Tạo URL video nếu có ID (ưu tiên account_id thật của kênh)
  const cleanUsername = profile.account_id
    ? profile.account_id.replace(/^@/, "").trim()
    : profile.name.trim();
  const videoUrl = capturedVideoId
    ? `https://www.tiktok.com/@${encodeURIComponent(cleanUsername)}/video/${capturedVideoId}`
    : null;

  // Quyết định hành động dọn dẹp file: Xóa luôn (mặc định) hoặc Di chuyển vào done/ theo cài đặt chung trong Settings
  try {
    const effectiveMode = configRepo.get("cleanup_mode", "delete");
    const fileName = path.basename(videoPath);
    const ext = path.extname(videoPath);
    const txtPath = videoPath.slice(0, -ext.length) + ".txt";

    if (effectiveMode === "delete") {
      // XÓA NGAY LẬP TỨC (mặc định cho nhẹ máy)
      try {
        if (fs.existsSync(videoPath)) {
          fs.unlinkSync(videoPath);
        }
      } catch (delErr: any) {
        log(`Cảnh báo xóa file video: ${delErr.message}`);
      }

      // Xóa kèm file txt nếu có
      try {
        if (fs.existsSync(txtPath)) {
          fs.unlinkSync(txtPath);
        }
      } catch (_) {}

      log(
        `[Dọn dẹp] Đã xóa video gốc ${fileName} sau khi đăng thành công (Tiết kiệm dung lượng máy).`,
      );
    } else {
      // GIỮ VÀ CHUYỂN VÀO THƯ MỤC done/
      const videoDir = path.dirname(videoPath);
      const doneDir = path.join(videoDir, "done");
      if (!fs.existsSync(doneDir)) fs.mkdirSync(doneDir, { recursive: true });

      let destPath = path.join(doneDir, fileName);

      if (fs.existsSync(destPath)) {
        const base = path.basename(fileName, ext);
        destPath = path.join(doneDir, `${base}_${Date.now()}${ext}`);
      }

      try {
        fs.renameSync(videoPath, destPath);
      } catch {
        fs.copyFileSync(videoPath, destPath);
        try {
          fs.unlinkSync(videoPath);
        } catch (_) {}
      }
      log(`[Lưu trữ] Đã chuyển file ${fileName} sang thư mục "done/" an toàn.`);

      if (fs.existsSync(txtPath)) {
        const destTxt = path.join(doneDir, path.basename(txtPath));
        try {
          fs.renameSync(txtPath, destTxt);
        } catch {
          try {
            fs.copyFileSync(txtPath, destTxt);
            fs.unlinkSync(txtPath);
          } catch (_) {}
        }
      }
    }
  } catch (cleanErr: any) {
    log(`Cảnh báo xử lý file sau khi đăng: ${cleanErr.message}`);
  }

  return { videoId: capturedVideoId, videoUrl };
}
