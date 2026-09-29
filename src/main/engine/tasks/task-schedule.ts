import { Page } from 'playwright';
import { ProfileRecord } from '../../db/database';
import { dismissPopups } from './task-navigate';

/**
 * Tính toán mốc thời gian tiếp theo theo chế độ Auto-Increment
 */
export function calculateNextIncrement(
  baseDate: Date,
  intervalMinutes: number
): Date {
  const next = new Date(baseDate.getTime() + intervalMinutes * 60 * 1000);
  // TikTok yêu cầu lên lịch tối thiểu cách hiện tại 20 phút
  const minFuture = new Date(Date.now() + 20 * 60 * 1000);
  if (next < minFuture) {
    return minFuture;
  }
  return next;
}

/**
 * Tính toán mốc thời gian tiếp theo theo Khung Giờ Vàng (Golden Hours)
 */
export function calculateNextGoldenHour(
  goldenHoursStr: string,
  videoIndex: number,
  baseDate = new Date()
): Date {
  const hours = goldenHoursStr
    .split(',')
    .map((h) => h.trim())
    .filter(Boolean);

  if (hours.length === 0) {
    return calculateNextIncrement(baseDate, 15);
  }

  const slotIndex = videoIndex % hours.length;
  const dayOffset = Math.floor(videoIndex / hours.length);

  const [targetH, targetM] = hours[slotIndex].split(':').map(Number);
  const targetDate = new Date(baseDate);
  targetDate.setDate(targetDate.getDate() + dayOffset);
  targetDate.setHours(targetH || 12, targetM || 0, 0, 0);

  // Nếu khung giờ đã qua so với hiện tại + 20p -> dời sang ngày tiếp theo
  const minFuture = new Date(Date.now() + 20 * 60 * 1000);
  if (targetDate < minFuture) {
    targetDate.setDate(targetDate.getDate() + 1);
  }

  return targetDate;
}

export async function applySchedule(
  page: Page,
  profile: ProfileRecord,
  videoIndex: number,
  log: (msg: string) => void,
  lastScheduledDate: Date | null = null,
  hasExistingBatch = false
): Promise<Date> {
  // Nếu chế độ immediate và là video đầu tiên (và chưa có batch nào đang schedule)
  if (profile.schedule_mode === 'immediate' && videoIndex === 0 && !hasExistingBatch) {
    log('Chế độ Immediate: Đăng video ngay lập tức (Public).');
    return new Date();
  }

  log('Đang kích hoạt chế độ Lên lịch phát hành (Schedule)...');

  await dismissPopups(page, log);

  // 1. Kích hoạt Radio "Schedule"
  const scheduleRadioLabel = page
    .locator('label.Radio__root:has(input[value="schedule"]), label:has-text("Schedule"), label:has-text("Lên lịch")')
    .first();

  await scheduleRadioLabel.waitFor({ state: 'visible', timeout: 10000 });
  await scheduleRadioLabel.scrollIntoViewIfNeeded().catch(() => {});
  await scheduleRadioLabel.click({ force: true });
  await page.waitForTimeout(2000);

  // 2. Tính toán ngày & giờ
  let scheduledTime: Date;
  if (profile.schedule_mode === 'golden_hours') {
    scheduledTime = calculateNextGoldenHour(
      profile.golden_hours || '11:30,17:30,20:00',
      videoIndex,
      lastScheduledDate || new Date()
    );
  } else {
    // auto_increment
    const base = lastScheduledDate || new Date();
    scheduledTime = calculateNextIncrement(
      base,
      profile.schedule_interval || 10
    );
  }

  const year = scheduledTime.getFullYear();
  const month = String(scheduledTime.getMonth() + 1).padStart(2, '0');
  const day = String(scheduledTime.getDate()).padStart(2, '0');
  const dateStr = `${year}-${month}-${day}`;

  const hour = String(scheduledTime.getHours()).padStart(2, '0');
  const min = String(scheduledTime.getMinutes()).padStart(2, '0');
  const timeStr = `${hour}:${min}`;

  log(`Mốc thời gian lên lịch dự kiến: ${dateStr} lúc ${timeStr}`);

  // 3. Tương tác với các ô Date và Time input (TUXTextInputCore-input)
  try {
    const inputs = page.locator(
      'input.TUXTextInputCore-input, input[placeholder*="YYYY"], input[placeholder*="HH"], .date-picker-input input, .time-picker-input input'
    );

    const count = await inputs.count();
    log(`Tìm thấy ${count} ô nhập cấu hình Lên lịch.`);

    if (count >= 2) {
      // Xác định ô nào là Time, ô nào là Date dựa trên value hiện tại hoặc placeholder
      const val0 = (await inputs.nth(0).inputValue().catch(() => '')) || '';
      const val1 = (await inputs.nth(1).inputValue().catch(() => '')) || '';

      let timeIndex = 0;
      let dateIndex = 1;

      // Nếu ô 0 chứa dấu gạch ngang (2026-09-30) -> ô 0 là Date, ô 1 là Time
      if (val0.includes('-') || val0.includes('/')) {
        dateIndex = 0;
        timeIndex = 1;
      }

      // Điền Date
      const dateInput = inputs.nth(dateIndex);
      await dateInput.evaluate((el: any) => el.removeAttribute('readonly')).catch(() => {});
      await dateInput.click({ clickCount: 3 });
      await dateInput.fill(dateStr);
      await page.keyboard.press('Enter');
      await page.keyboard.press('Escape');
      await page.waitForTimeout(400);

      // Điền Time
      const timeInput = inputs.nth(timeIndex);
      await timeInput.evaluate((el: any) => el.removeAttribute('readonly')).catch(() => {});
      await timeInput.click({ clickCount: 3 });
      await timeInput.fill(timeStr);
      await page.keyboard.press('Enter');
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);

      log(`Đã điền lịch thành công: ${dateStr} ${timeStr}`);
    } else {
      log('Lưu ý: Không tìm đủ 2 ô nhập ngày giờ, giữ mốc thời gian mặc định của TikTok.');
    }
  } catch (e: any) {
    log(`Lỗi khi điền lịch: ${e.message}`);
  }

  return scheduledTime;
}
