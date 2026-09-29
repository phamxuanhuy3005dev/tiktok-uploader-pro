import fs from 'fs';
import path from 'path';
import { Page, Response } from 'playwright';
import { ProfileRecord } from '../../db/database';
import { dismissPopups } from './task-navigate';
import { handleCaptchaWait } from './task-captcha';

export async function processCaption(
  page: Page,
  videoPath: string,
  profile: ProfileRecord,
  log: (msg: string) => void
): Promise<void> {
  const captionLocator = page
    .locator('.public-DraftEditor-content, [contenteditable="true"], textarea[placeholder*="caption" i], [role="textbox"]')
    .first();

  await captionLocator.waitFor({ state: 'visible', timeout: 10000 }).catch(() => {});
  if (!(await captionLocator.isVisible().catch(() => false))) {
    log('Không tìm thấy ô nhập Caption. Tiếp tục bước tiếp theo.');
    return;
  }

  await captionLocator.focus();
  const selectAll = process.platform === 'darwin' ? 'Meta+A' : 'Control+A';
  await page.keyboard.press(selectAll);
  await page.keyboard.press('Backspace');

  if (profile.caption_mode === 'from_txt_file') {
    const ext = path.extname(videoPath);
    const txtPath = videoPath.slice(0, -ext.length) + '.txt';

    if (fs.existsSync(txtPath)) {
      const content = fs.readFileSync(txtPath, 'utf-8').trim();
      log(`Tìm thấy file caption text: ${path.basename(txtPath)}. Đang điền caption...`);
      await page.keyboard.type(content, { delay: 20 });
      log('Đã điền xong caption từ file text.');
    } else {
      log(`Không có file .txt tương ứng (${path.basename(txtPath)}). Để trống caption.`);
    }
  } else {
    log('Chế độ remove_title: Đã xóa sạch tiêu đề video.');
  }

  await page.waitForTimeout(1000);
}

export async function submitAndConfirmPost(
  page: Page,
  profile: ProfileRecord,
  videoPath: string,
  log: (msg: string) => void
): Promise<{ videoId: string | null; videoUrl: string | null }> {
  log('Bắt đầu nhấn nút Xuất bản (Post / Schedule)...');

  let capturedVideoId: string | null = null;

  // Lắng nghe API response để bắt Video ID
  const responseHandler = async (res: Response) => {
    try {
      const url = res.url();
      if (
        res.status() >= 200 &&
        res.status() < 300 &&
        (url.includes('/publish') || url.includes('/create') || url.includes('/post') || url.includes('/item'))
      ) {
        const text = await res.text().catch(() => '');
        const match = text.match(/"(?:publish_id|video_id|item_id|aweme_id)"\s*:\s*"(\d+)"/);
        if (match && match[1]) {
          capturedVideoId = match[1];
          log(`[API Capture] Bắt được Video ID chính thức: ${capturedVideoId}`);
        }
      }
    } catch (_) {}
  };

  page.on('response', responseHandler);

  let confirmed = false;

  for (let attempt = 1; attempt <= 10; attempt++) {
    await handleCaptchaWait(page, profile.name, log);
    await dismissPopups(page);

    const postBtn = page
      .locator(
        'button[data-e2e="post_video_button"]:not([disabled]), button:has-text("Schedule"):not([disabled]), button:has-text("Lên lịch"):not([disabled]), button:has-text("Post"):not([disabled])'
      )
      .first();

    if (await postBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      log(`Nhấn nút đăng (Lần ${attempt}/10)...`);
      await postBtn.scrollIntoViewIfNeeded().catch(() => {});
      await postBtn.click({ force: true }).catch(() => {});
      await page.waitForTimeout(2000);
    }

    // Kiểm tra đã xuất bản thành công chưa
    for (let poll = 0; poll < 3; poll++) {
      await page.waitForTimeout(4000);
      await handleCaptchaWait(page, profile.name, log);

      const isSuccessMsg = await page
        .locator('text="Uploaded", text="Success", text="View video", text="Manage your posts", text="Scheduled"')
        .first()
        .isVisible({ timeout: 1000 })
        .catch(() => false);

      const isRedirected =
        !page.url().includes('upload') || page.url().includes('manage') || page.url().includes('content');

      if (isSuccessMsg || isRedirected) {
        log('Xác nhận đăng bài thành công 100%!');
        confirmed = true;
        break;
      }
    }

    if (confirmed) break;
  }

  page.removeListener('response', responseHandler);

  if (!confirmed) {
    throw new Error('Không thể xác nhận trạng thái xuất bản thành công của video.');
  }

  // Tạo URL video nếu có ID
  const videoUrl = capturedVideoId ? `https://www.tiktok.com/@${profile.name}/video/${capturedVideoId}` : null;

  // Di chuyển file sang thư mục "done"
  try {
    const videoDir = path.dirname(videoPath);
    const doneDir = path.join(videoDir, 'done');
    if (!fs.existsSync(doneDir)) fs.mkdirSync(doneDir, { recursive: true });

    const fileName = path.basename(videoPath);
    const destPath = path.join(doneDir, fileName);
    fs.renameSync(videoPath, destPath);
    log(`[Lưu trữ] Đã chuyển file ${fileName} sang thư mục "done/" an toàn.`);

    // Nếu có file text đi kèm thì chuyển luôn
    const ext = path.extname(videoPath);
    const txtPath = videoPath.slice(0, -ext.length) + '.txt';
    if (fs.existsSync(txtPath)) {
      fs.renameSync(txtPath, path.join(doneDir, path.basename(txtPath)));
    }
  } catch (mvErr: any) {
    log(`Cảnh báo di chuyển file: ${mvErr.message}`);
  }

  return { videoId: capturedVideoId, videoUrl };
}
