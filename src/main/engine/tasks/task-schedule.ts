import { Page } from 'playwright';
import { ProfileRecord } from '../../db/database';

/**
 * Tính toán mốc thời gian tiếp theo theo chế độ Auto-Increment
 */
export function calculateNextIncrement(
  baseDate: Date,
  intervalMinutes: number
): Date {
  const next = new Date(baseDate.getTime() + intervalMinutes * 60 * 1000);
  // TikTok yêu cầu lên lịch tối thiểu cách hiện tại 15-20 phút
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
  lastScheduledDate: Date | null = null
): Promise<Date> {
  if (profile.schedule_mode === 'immediate' && videoIndex === 0) {
    log('Chế độ Immediate: Đăng video ngay lập tức (Public).');
    return new Date();
  }

  log('Đang kích hoạt chế độ Lên lịch phát hành (Schedule)...');

  // 1. Kích hoạt Radio/Switch "Schedule"
  const scheduleOption = page
    .locator(
      'label:has-text("Schedule"), label:has-text("Lên lịch"), [data-e2e*="schedule"], input[value="schedule"]'
    )
    .first();

  await scheduleOption.waitFor({ state: 'attached', timeout: 10000 });
  await scheduleOption.click({ force: true }).catch(() => {});
  await page.waitForTimeout(2000);

  // 2. Tính toán ngày & giờ
  let scheduledTime: Date;
  if (profile.schedule_mode === 'golden_hours') {
    scheduledTime = calculateNextGoldenHour(
      profile.golden_hours || '11:30,17:30,20:00',
      videoIndex
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

  log(`Mốc thời gian lên lịch: ${dateStr} lúc ${timeStr}`);

  // 3. Tương tác với các ô Date và Time input
  try {
    const inputs = page.locator(
      'input[placeholder*="YYYY"], input[placeholder*="HH"], .date-picker-input input, .time-picker-input input, input.TUXTextInputCore-input'
    );
    const count = await inputs.count();

    if (count >= 2) {
      // Input 1: Date
      const dateInput = inputs.first();
      await dateInput.click({ clickCount: 3 });
      await dateInput.fill(dateStr);
      await page.keyboard.press('Enter');
      await page.keyboard.press('Escape');
      await page.waitForTimeout(400);

      // Input 2: Time
      const timeInput = inputs.nth(1);
      await timeInput.click({ clickCount: 3 });
      await timeInput.fill(timeStr);
      await page.keyboard.press('Enter');
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);

      log(`Đã điền lịch thành công: ${dateStr} ${timeStr}`);
    } else {
      log('Cảnh báo: Không tìm đủ 2 ô nhập ngày giờ, giữ lịch mặc định.');
    }
  } catch (e: any) {
    log(`Lỗi khi điền lịch: ${e.message}`);
  }

  return scheduledTime;
}
