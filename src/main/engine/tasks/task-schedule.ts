import { Page } from 'playwright';
import { ProfileRecord } from '../../db/database';
import { dismissPopups } from './task-navigate';

/**
 * Tính toán mốc thời gian tiếp theo theo chế độ Auto-Increment (cộng dồn đều đặn, vd: 10 phút)
 * Luôn đảm bảo:
 * 1. Video đầu tiên cách hiện tại ít nhất 16 phút (thỏa mãn quy định tối thiểu 15 phút của TikTok).
 * 2. Các video tiếp theo cách đều nhau chính xác theo số phút cấu hình (intervalMinutes).
 * 3. Làm tròn lên bội số 5 phút để khớp 100% với danh sách dropdown của TikTok Studio.
 */
export function calculateNextIncrement(
  lastScheduledDate: Date | null,
  intervalMinutes: number = 10,
  now: Date = new Date()
): Date {
  const stepMin = Number(intervalMinutes) || 10;
  const stepMs = stepMin * 60 * 1000;
  const MIN_BUFFER_MS = 16 * 60 * 1000; // Tối thiểu cách hiện tại 16 phút (TikTok yêu cầu tối thiểu 15p)
  const ROUND_STEP_MS = 5 * 60 * 1000; // TikTok timepicker hiển thị từng nấc 5 phút (:00, :05, :10, :15, ...)

  let baseTime: Date;
  if (
    lastScheduledDate &&
    lastScheduledDate instanceof Date &&
    !Number.isNaN(lastScheduledDate.getTime())
  ) {
    let validLastTime = new Date(lastScheduledDate.getTime());
    if (validLastTime.getFullYear() < 2020) {
      validLastTime.setFullYear(now.getFullYear());
    }
    // Lấy mốc từ video trước + số phút khoảng cách cấu hình (vd: 10 phút)
    baseTime = new Date(validLastTime.getTime() + stepMs);
  } else {
    // Video đầu tiên: Tối thiểu cách hiện tại 16 phút
    baseTime = new Date(now.getTime() + MIN_BUFFER_MS);
  }

  // Đảm bảo không nhỏ hơn hiện tại + 16 phút
  const minFuture = new Date(now.getTime() + MIN_BUFFER_MS);
  if (baseTime < minFuture) {
    baseTime = minFuture;
  }

  // Làm tròn LÊN mốc chia hết cho 5 phút để khớp với dropdown TikTok
  return new Date(Math.ceil(baseTime.getTime() / ROUND_STEP_MS) * ROUND_STEP_MS);
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
    return calculateNextIncrement(baseDate, 10);
  }

  const slotIndex = videoIndex % hours.length;
  const dayOffset = Math.floor(videoIndex / hours.length);

  const [targetH, targetM] = hours[slotIndex].split(':').map(Number);
  const targetDate = new Date(baseDate);
  targetDate.setDate(targetDate.getDate() + dayOffset);
  targetDate.setHours(targetH || 12, targetM || 0, 0, 0);

  // Nếu khung giờ đã qua so với hiện tại + 16p -> dời sang ngày tiếp theo
  const minFuture = new Date(Date.now() + 16 * 60 * 1000);
  if (targetDate < minFuture) {
    targetDate.setDate(targetDate.getDate() + 1);
  }

  return targetDate;
}

/**
 * Thao tác chọn Giờ trực tiếp trong popup TimePicker của TikTok Studio
 */
async function selectTimeInPicker(
  page: Page,
  timeInput: any,
  timeStr: string,
  log: (msg: string) => void
): Promise<void> {
  const [targetHour, targetMinute] = timeStr.split(':');
  log(`Cài đặt Giờ phát hành: ${timeStr} (Giờ: ${targetHour}, Phút: ${targetMinute})...`);

  // 1. Mở popup timepicker
  await timeInput.scrollIntoViewIfNeeded().catch(() => {});
  await timeInput.click({ clickCount: 3 });
  await page.waitForTimeout(400);

  const picker = page.locator('.tiktok-timepicker-time-picker-container').first();
  const isPickerVisible = await picker.isVisible({ timeout: 2000 }).catch(() => false);

  if (isPickerVisible) {
    // Chọn Cột Giờ (.tiktok-timepicker-left)
    const hourEl = picker.locator(`.tiktok-timepicker-left:has-text("${targetHour}")`).first();
    if ((await hourEl.count()) > 0) {
      await hourEl.scrollIntoViewIfNeeded().catch(() => {});
      await hourEl.click({ force: true }).catch(() => {});
    }
    await page.waitForTimeout(200);

    // Chọn Cột Phút (.tiktok-timepicker-right)
    const minuteEl = picker.locator(`.tiktok-timepicker-right:has-text("${targetMinute}")`).first();
    if ((await minuteEl.count()) > 0) {
      await minuteEl.scrollIntoViewIfNeeded().catch(() => {});
      await minuteEl.click({ force: true }).catch(() => {});
    }
    await page.waitForTimeout(200);
  }

  // 2. Điền trực tiếp giá trị vào ô input và bấm Enter để kích hoạt sự kiện React
  await timeInput.click({ clickCount: 3 });
  await timeInput.fill(timeStr);
  await page.keyboard.press('Enter');
  await page.keyboard.press('Escape'); // Đóng picker overlay an toàn
  await page.waitForTimeout(300);
}

/**
 * Thao tác chọn Ngày trực tiếp trong popup Calendar của TikTok Studio
 */
async function selectDateInPicker(
  page: Page,
  dateInput: any,
  dateStr: string,
  log: (msg: string) => void
): Promise<void> {
  log(`Cài đặt Ngày phát hành: ${dateStr}...`);

  await dateInput.scrollIntoViewIfNeeded().catch(() => {});
  await dateInput.click({ clickCount: 3 });
  await dateInput.fill(dateStr);
  await page.keyboard.press('Enter');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
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
  await page.waitForTimeout(1500);

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
    scheduledTime = calculateNextIncrement(
      lastScheduledDate,
      profile.schedule_interval || 10,
      new Date()
    );
  }

  const year = scheduledTime.getFullYear();
  const month = String(scheduledTime.getMonth() + 1).padStart(2, '0');
  const day = String(scheduledTime.getDate()).padStart(2, '0');
  const dateStr = `${year}-${month}-${day}`;

  const hour = String(scheduledTime.getHours()).padStart(2, '0');
  const min = String(scheduledTime.getMinutes()).padStart(2, '0');
  const timeStr = `${hour}:${min}`;

  log(`Mốc thời gian lên lịch dự kiến: ${dateStr} lúc ${timeStr} (khoảng cách: ${profile.schedule_interval || 10} phút)`);

  // 3. Tương tác với các ô Date và Time input
  try {
    const inputs = page.locator(
      'input.TUXTextInputCore-input, input[placeholder*="YYYY"], input[placeholder*="HH"], .date-picker-input input, .time-picker-input input'
    );

    const count = await inputs.count();
    if (count >= 2) {
      const val0 = (await inputs.nth(0).inputValue().catch(() => '')) || '';
      let timeInput = inputs.nth(0);
      let dateInput = inputs.nth(1);

      if (val0.includes('-') || val0.includes('/')) {
        dateInput = inputs.nth(0);
        timeInput = inputs.nth(1);
      }

      // 3.1. Thiết lập Ngày
      await selectDateInPicker(page, dateInput, dateStr, log);

      // 3.2. Thiết lập Giờ
      await selectTimeInPicker(page, timeInput, timeStr, log);

      // 3.3. Xác thực giá trị thực tế sau khi thiết lập
      const actualDate = (await dateInput.inputValue().catch(() => '')) || '';
      const actualTime = (await timeInput.inputValue().catch(() => '')) || '';
      log(`Xác nhận lịch phát hành trên TikTok Studio: Ngày = "${actualDate}", Giờ = "${actualTime}"`);

      await dismissPopups(page, log);
    } else {
      log('Lưu ý: Không tìm thấy đủ 2 ô nhập ngày giờ, giữ mốc thời gian mặc định của TikTok.');
    }
  } catch (e: any) {
    log(`Lưu ý khi điền lịch: ${e.message}`);
  }

  return scheduledTime;
}
