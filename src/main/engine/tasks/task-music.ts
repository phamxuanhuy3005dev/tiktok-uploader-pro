import { Page } from 'playwright';
import { dismissPopups } from './task-navigate';
import { ProfileRecord } from '../../db/database';

export async function attachFavoriteMusic(
  page: Page,
  profile: ProfileRecord,
  videoIndex: number,
  log: (msg: string) => void
): Promise<void> {
  log('Bắt đầu quy trình gắn nhạc từ mục Favorites (Yêu thích)...');

  let success = false;
  const MAX_RETRY = 3;

  for (let attempt = 1; attempt <= MAX_RETRY; attempt++) {
    log(`[Nhạc Favorites] Lần thử ${attempt}/${MAX_RETRY}...`);

    try {
      // 1. Tìm nút mở Sounds / Web Video Editor
      const soundsBtn = page
        .locator('.editor-entrance[data-button-name="sounds"], button[data-button-name="sounds"], button:has-text("Sounds"), button:has-text("Edit video")')
        .first();

      await soundsBtn.waitFor({ state: 'visible', timeout: 20000 });
      await soundsBtn.scrollIntoViewIfNeeded().catch(() => {});
      await soundsBtn.click({ force: true });
      await page.waitForTimeout(2500);

      await dismissPopups(page);

      // 2. Chuyển sang Tab "Favorites" (Yêu thích)
      log('Đang mở tab "Favorites"...');
      const favTab = page
        .locator('button:has-text("Favorites"), [role="tab"]:has-text("Favorites"), button:has-text("Yêu thích"), [role="tab"]:has-text("Yêu thích")')
        .first();

      await favTab.waitFor({ state: 'visible', timeout: 10000 });
      await favTab.click({ force: true });
      await page.waitForTimeout(2500);

      // 3. Quét danh sách các nút thêm nhạc "+" trong tab Favorites
      // Nút "+" thường có icon cộng hoặc button shape rounded
      const plusButtonSelectors = [
        '.Button__root--shape-rounded',
        'button[class*="Button__root--shape-rounded"]',
        'button[aria-label*="Add"]',
        'button:has(svg[data-icon="plus"])',
        'div[role="listitem"] button'
      ].join(', ');

      const plusButtons = page.locator(plusButtonSelectors);
      const totalFavs = await plusButtons.count();

      log(`Tìm thấy ${totalFavs} bài hát trong mục Favorites.`);

      if (totalFavs === 0) {
        throw new Error(
          'MỤC FAVORITES RỖNG: Kênh chưa lưu bài hát nào vào mục Yêu thích! Dừng upload ngay để tránh mất tiền view.'
        );
      }

      // Xác định vị trí bài hát cần chọn
      let targetIndex = 0;
      if (profile.music_mode === 'favorite_rotate') {
        targetIndex = videoIndex % totalFavs;
        log(`Chế độ xoay vòng nhạc: Chọn bài số ${targetIndex + 1}/${totalFavs}`);
      } else {
        targetIndex = Math.min(profile.favorite_index || 0, totalFavs - 1);
        log(`Chế độ chọn bài cố định: Chọn bài số ${targetIndex + 1}/${totalFavs}`);
      }

      // Bấm nút "+" để thêm bài nhạc vào Timeline
      const chosenButton = plusButtons.nth(targetIndex);
      await chosenButton.scrollIntoViewIfNeeded().catch(() => {});
      await chosenButton.click({ force: true });
      log(`Đã thêm bài nhạc #${targetIndex + 1} vào Timeline. Đợi thanh thuộc tính âm thanh...`);
      await page.waitForTimeout(2500);

      // 4. Giảm âm lượng nhạc nền xuống -50 dB (giữ tiếng gốc video)
      const targetVolume = profile.music_volume ?? -50;
      log(`Đang cài đặt âm lượng nhạc nền về ${targetVolume} dB...`);

      try {
        const volumeInputs = page.locator(
          'input.PropSettingInput__input, input[class*="PropSettingInput"], input[type="number"], .property-panel input'
        );
        const count = await volumeInputs.count();
        if (count > 0) {
          const volInput = volumeInputs.first();
          await volInput.click({ clickCount: 3 });
          const selectAll = process.platform === 'darwin' ? 'Meta+A' : 'Control+A';
          await page.keyboard.press(selectAll);
          await volInput.fill(String(targetVolume));
          await page.keyboard.press('Enter');
          await page.waitForTimeout(500);
          log(`Âm lượng đã được đặt thành công: ${targetVolume} dB.`);
        } else {
          log(`Không tìm thấy ô nhập volume, giữ volume mặc định của editor.`);
        }
      } catch (volErr: any) {
        log(`Bỏ qua chỉnh volume: ${volErr.message}`);
      }

      // 5. Bấm nút "Save" để lưu bản dựng và quay lại màn hình xuất bản
      log('Đang bấm nút "Save" để lưu bản dựng trong Editor...');
      const saveBtn = page
        .locator('button:has-text("Save"), button:has-text("Lưu"), button.editor-save-btn')
        .first();

      await saveBtn.waitFor({ state: 'visible', timeout: 8000 });
      await saveBtn.click({ force: true });

      // Đợi trở về màn hình Upload form
      log('Đang chờ trình duyệt lưu và quay lại màn hình đăng video...');
      await page.waitForSelector(
        'button[data-e2e="post_video_button"], button:has-text("Post"), button:has-text("Schedule")',
        { timeout: 35000 }
      );
      await page.waitForTimeout(2000);

      log('Đã lưu bản dựng thành công! Video đã được gắn nhạc Favorites.');
      success = true;
      break;
    } catch (err: any) {
      log(`Lỗi trong quá trình gắn nhạc: ${err.message}`);

      // Nếu lỗi là do Favorites rỗng -> lập tức dừng, không retry vô ích
      if (err.message.includes('MỤC FAVORITES RỖNG')) {
        throw err;
      }

      // Đóng modal/editor nếu còn mở để chuẩn bị retry
      try {
        const cancelBtn = page.locator('button:has-text("Cancel"), button:has-text("Exit")').first();
        if (await cancelBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
          await cancelBtn.click().catch(() => {});
        }
      } catch (_) {}

      if (attempt === MAX_RETRY) {
        throw new Error(
          `GẮN NHẠC THẤT BẠI sau ${MAX_RETRY} lần thử: ${err.message}. Hủy upload video để bảo toàn doanh thu.`
        );
      }
      await page.waitForTimeout(2000);
    }
  }

  if (!success) {
    throw new Error('Không thể hoàn tất việc gắn nhạc yêu thích cho video.');
  }
}
