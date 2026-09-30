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

  await timeInput.scrollIntoViewIfNeeded().catch(() => {});

  // 1. Mở popup timepicker bằng cách click
  await timeInput.click().catch(() => {});
  await page.waitForTimeout(300);

  // 2. Tìm và click đúng leaf element của Giờ và Phút trong popup (thực thi DOM trực tiếp, 0ms, không bao giờ timeout)
  const clickedInDom = await page.evaluate(
    ({ hour, minute }) => {
      const container = document.querySelector(
        '.tiktok-timepicker-time-picker-container, [class*="time-picker-container"], [class*="timepicker-panel"], [class*="time-picker"]'
      );
      if (!container) return false;

      let hourFound = false;
      let minuteFound = false;

      // Cột giờ bên trái
      const leftCol =
        container.querySelector('.tiktok-timepicker-left, [class*="timepicker-left"]') ||
        container.children[0];
      if (leftCol) {
        const items = Array.from(leftCol.querySelectorAll('li, div, span'));
        const hNum = parseInt(hour, 10);
        for (const item of items) {
          const txt = item.textContent?.trim() || '';
          if (item.children.length === 0 && (txt === hour || parseInt(txt, 10) === hNum)) {
            (item as HTMLElement).scrollIntoView?.({ block: 'center' });
            (item as HTMLElement).click();
            hourFound = true;
            break;
          }
        }
      }

      // Cột phút bên phải
      const rightCol =
        container.querySelector('.tiktok-timepicker-right, [class*="timepicker-right"]') ||
        container.children[1];
      if (rightCol) {
        const items = Array.from(rightCol.querySelectorAll('li, div, span'));
        const mNum = parseInt(minute, 10);
        for (const item of items) {
          const txt = item.textContent?.trim() || '';
          if (item.children.length === 0 && (txt === minute || parseInt(txt, 10) === mNum)) {
            (item as HTMLElement).scrollIntoView?.({ block: 'center' });
            (item as HTMLElement).click();
            minuteFound = true;
            break;
          }
        }
      }

      return hourFound && minuteFound;
    },
    { hour: targetHour, minute: targetMinute }
  ).catch(() => false);

  if (clickedInDom) {
    log(`Đã chọn mốc ${targetHour}:${targetMinute} trong bảng chọn.`);
  }

  // 3. Đảm bảo input value luôn được set qua React native setter (không bị lock bởi thuộc tính readonly)
  await timeInput.evaluate((el: HTMLInputElement, val: string) => {
    el.removeAttribute('readonly');
    const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
    if (nativeSetter) {
      nativeSetter.call(el, val);
    } else {
      el.value = val;
    }
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }, timeStr).catch(() => {});

  // 4. Focus và gõ bằng keyboard (không dùng .fill() vì .fill() sẽ bị treo 30s nếu có readonly)
  await timeInput.focus().catch(() => {});
  const selectAll = process.platform === 'darwin' ? 'Meta+A' : 'Control+A';
  await page.keyboard.press(selectAll).catch(() => {});
  await page.keyboard.type(timeStr, { delay: 20 }).catch(() => {});
  await page.keyboard.press('Enter').catch(() => {});

  // 5. Đóng picker an toàn bằng cách blur (TUYỆT ĐỐI KHÔNG BẤM ESCAPE vì Escape sẽ cancel/revert lại giờ mặc định!)
  await page.evaluate(() => {
    (document.activeElement as HTMLElement)?.blur();
  }).catch(() => {});
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
  await dateInput.scrollIntoViewIfNeeded().catch(() => {});
  const currentVal = ((await dateInput.inputValue().catch(() => '')) || '').trim();

  // Nếu ngày hiện tại trên ô nhập đã là hôm nay hoặc đã khớp sẵn dateStr
  const isSameDay =
    currentVal === dateStr ||
    (currentVal &&
      !isNaN(new Date(currentVal).getTime()) &&
      new Date(currentVal).toDateString() === new Date(dateStr).toDateString());

  if (isSameDay) {
    log(`Ngày phát hành trên TikTok đã là hôm nay (${currentVal}), giữ nguyên không mở popup lịch.`);
    return;
  }

  log(`Cập nhật Ngày phát hành: từ "${currentVal}" sang "${dateStr}"...`);

  // Xóa thuộc tính readonly nếu có và gán giá trị trực tiếp cho input qua React native setter
  await dateInput.evaluate((el: HTMLInputElement, val: string) => {
    el.removeAttribute('readonly');
    const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
    if (nativeSetter) {
      nativeSetter.call(el, val);
    } else {
      el.value = val;
    }
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }, dateStr).catch(() => {});

  // Dùng keyboard thay vì .fill() để tránh Playwright treo 30s
  await dateInput.focus().catch(() => {});
  const selectAll = process.platform === 'darwin' ? 'Meta+A' : 'Control+A';
  await page.keyboard.press(selectAll).catch(() => {});
  await page.keyboard.type(dateStr, { delay: 20 }).catch(() => {});
  await page.keyboard.press('Enter').catch(() => {});

  // Nếu popup calendar đang mở, thử click trực tiếp ngày đích trong calendar grid
  const targetDayNum = parseInt(dateStr.split('-')[2] || '0', 10);
  if (targetDayNum > 0) {
    await page.evaluate(({ day }) => {
      const dayCells = Array.from(
        document.querySelectorAll(
          '.day:not(.disabled), [class*="calendar-day"]:not([class*="disabled"]), [class*="picker-cell"]:not([class*="disabled"]), td:not([class*="disabled"])'
        )
      );
      for (const cell of dayCells) {
        if (cell.textContent?.trim() === String(day)) {
          (cell as HTMLElement).click();
          break;
        }
      }
    }, { day: targetDayNum }).catch(() => {});
  }

  await page.evaluate(() => {
    (document.activeElement as HTMLElement)?.blur();
  }).catch(() => {});
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
      try {
        await selectDateInPicker(page, dateInput, dateStr, log);
      } catch (dateErr: any) {
        log(`Lỗi thiết lập ngày: ${dateErr.message}`);
      }

      // 3.2. Thiết lập Giờ
      try {
        await selectTimeInPicker(page, timeInput, timeStr, log);
      } catch (timeErr: any) {
        log(`Lỗi thiết lập giờ: ${timeErr.message}`);
      }

      // 3.3. Xác thực giá trị thực tế sau khi thiết lập
      let actualDate = (await dateInput.inputValue().catch(() => '')) || '';
      let actualTime = (await timeInput.inputValue().catch(() => '')) || '';

      if (actualTime && actualTime !== timeStr) {
        log(`Cảnh báo: TikTok Studio đang giữ giờ "${actualTime}", đang ép cập nhật lại "${timeStr}"...`);
        await timeInput.evaluate((el: any, val: string) => {
          el.removeAttribute('readonly');
          const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
          if (nativeSetter) nativeSetter.call(el, val);
          else el.value = val;
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
        }, timeStr).catch(() => {});
        await page.waitForTimeout(300);
        actualTime = (await timeInput.inputValue().catch(() => '')) || '';
      }

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
