import { Page } from "playwright";
import { ProfileRecord } from "../../db/database";
import { dismissPopups } from "./task-navigate";

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
  now: Date = new Date(),
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
  return new Date(
    Math.ceil(baseTime.getTime() / ROUND_STEP_MS) * ROUND_STEP_MS,
  );
}

/**
 * Tính toán mốc thời gian tiếp theo theo Khung Giờ Vàng (Golden Hours)
 */
export function calculateNextGoldenHour(
  goldenHoursStr: string,
  videoIndex: number,
  baseDate = new Date(),
): Date {
  const hours = goldenHoursStr
    .split(",")
    .map((h) => h.trim())
    .filter(Boolean);

  if (hours.length === 0) {
    return calculateNextIncrement(baseDate, 10);
  }

  const slotIndex = videoIndex % hours.length;
  const dayOffset = Math.floor(videoIndex / hours.length);

  const [targetH, targetM] = hours[slotIndex].split(":").map(Number);
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
  log: (msg: string) => void,
): Promise<void> {
  const [targetHour, targetMinute] = timeStr.split(":");
  log(
    `Cài đặt Giờ phát hành: ${timeStr} (Giờ: ${targetHour}, Phút: ${targetMinute})...`,
  );

  await timeInput.scrollIntoViewIfNeeded().catch(() => {});

  for (let attempt = 1; attempt <= 3; attempt++) {
    // 1. Mở popup timepicker bằng cách click vào timeInput
    await timeInput.click().catch(() => {});
    await page.waitForTimeout(350);

    // 2. Tìm và click đúng span của Giờ (.tiktok-timepicker-left) và Phút (.tiktok-timepicker-right)
    const clickedInDom = await page
      .evaluate(
        ({ hour, minute }) => {
          const container = document.querySelector(
            ".tiktok-timepicker-time-picker-container",
          );
          if (!container) return false;

          // Cột giờ bên trái
          const hourSpans = Array.from(
            container.querySelectorAll(".tiktok-timepicker-left"),
          );
          const targetHSpan = hourSpans.find(
            (s) => s.textContent?.trim() === hour,
          );
          if (targetHSpan) {
            (targetHSpan as HTMLElement).scrollIntoView?.({ block: "nearest" });
            (targetHSpan as HTMLElement).click();
          }

          // Cột phút bên phải
          const minSpans = Array.from(
            container.querySelectorAll(".tiktok-timepicker-right"),
          );
          const targetMSpan = minSpans.find(
            (s) => s.textContent?.trim() === minute,
          );
          if (targetMSpan) {
            (targetMSpan as HTMLElement).scrollIntoView?.({ block: "nearest" });
            (targetMSpan as HTMLElement).click();
          }

          return !!(targetHSpan && targetMSpan);
        },
        { hour: targetHour, minute: targetMinute },
      )
      .catch(() => false);

    await page.waitForTimeout(300);

    // 3. Đóng timepicker bằng cách click lại timeInput nếu đang mở
    const isOpen = await page
      .evaluate(() => {
        const c = document.querySelector(
          ".tiktok-timepicker-time-picker-container",
        );
        return c && !c.classList.contains("tiktok-timepicker-invisible");
      })
      .catch(() => false);

    if (isOpen) {
      await timeInput.click().catch(() => {});
      await page.waitForTimeout(200);
    }

    // 4. Kiểm tra lại giá trị sau khi chọn
    const currentVal = (
      (await timeInput.inputValue().catch(() => "")) || ""
    ).trim();
    if (currentVal === timeStr) {
      log(`Đã chọn thành công mốc giờ: ${timeStr} trên TikTok Studio.`);
      return;
    }

    log(
      `Lần ${attempt}: Giờ hiện tại là "${currentVal}" (chờ "${timeStr}"), thử lại...`,
    );
    await page.waitForTimeout(500);
  }
}

/**
 * Thao tác chọn Ngày trực tiếp trong popup Calendar của TikTok Studio
 */
async function selectDateInPicker(
  page: Page,
  dateInput: any,
  dateStr: string,
  log: (msg: string) => void,
): Promise<void> {
  await dateInput.scrollIntoViewIfNeeded().catch(() => {});
  const currentVal = (
    (await dateInput.inputValue().catch(() => "")) || ""
  ).trim();

  // Nếu ngày hiện tại trên ô nhập đã là hôm nay hoặc đã khớp sẵn dateStr
  const isSameDay =
    currentVal === dateStr ||
    (currentVal &&
      !isNaN(new Date(currentVal).getTime()) &&
      new Date(currentVal).toDateString() === new Date(dateStr).toDateString());

  if (isSameDay) {
    log(
      `Ngày phát hành trên TikTok đã là ngày mong muốn (${currentVal}), giữ nguyên không mở lịch.`,
    );
    return;
  }

  log(`Cập nhật Ngày phát hành: từ "${currentVal}" sang "${dateStr}"...`);

  const targetDayNum = parseInt(dateStr.split("-")[2] || "0", 10);

  for (let attempt = 1; attempt <= 3; attempt++) {
    // 1. Mở popup calendar
    await dateInput.click().catch(() => {});
    await page.waitForTimeout(400);

    // 2. Chọn ngày hợp lệ (.day.valid) trong .calendar-wrapper
    await page
      .evaluate(
        ({ day }) => {
          const calendar = document.querySelector(".calendar-wrapper");
          if (!calendar) return false;
          const validDays = Array.from(calendar.querySelectorAll(".day.valid"));
          const match = validDays.find(
            (d) => d.textContent?.trim() === String(day),
          );
          if (match) {
            (match as HTMLElement).click();
            return true;
          }
          return false;
        },
        { day: targetDayNum },
      )
      .catch(() => false);

    await page.waitForTimeout(300);

    // 3. Đóng calendar nếu vẫn còn mở bằng cách click body
    const isOpen = await page
      .evaluate(() => !!document.querySelector(".calendar-wrapper"))
      .catch(() => false);
    if (isOpen) {
      await page.evaluate(() => document.body.click()).catch(() => {});
      await page.waitForTimeout(200);
    }

    const newVal = (
      (await dateInput.inputValue().catch(() => "")) || ""
    ).trim();
    if (newVal === dateStr) {
      log(`Đã chọn thành công ngày: ${dateStr} trên TikTok Studio.`);
      return;
    }

    log(
      `Lần ${attempt}: Ngày hiện tại là "${newVal}" (chờ "${dateStr}"), thử lại...`,
    );
    await page.waitForTimeout(500);
  }
}

export async function applySchedule(
  page: Page,
  profile: ProfileRecord,
  videoIndex: number,
  log: (msg: string) => void,
  lastScheduledDate: Date | null = null,
  hasExistingBatch = false,
): Promise<Date> {
  // Nếu chế độ immediate và là video đầu tiên (và chưa có batch nào đang schedule)
  if (
    profile.schedule_mode === "immediate" &&
    videoIndex === 0 &&
    !hasExistingBatch
  ) {
    log("Chế độ Immediate: Đăng video ngay lập tức (Public).");
    return new Date();
  }

  log("Đang kích hoạt chế độ Lên lịch phát hành (Schedule)...");

  await dismissPopups(page, log);

  // Hàm tự động bấm "Allow" cho popup tài khoản mới: "Allow your video to be saved for scheduled posting?"
  const checkAndAllowSchedule = async () => {
    const allowBtn = page
      .locator(
        'div:has-text("scheduled posting") button:has-text("Allow"), div[role="dialog"]:has-text("scheduled posting") button:has-text("Allow"), div[role="dialog"] button:has-text("Allow")',
      )
      .first();
    if (await allowBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
      log(
        'Phát hiện popup "Allow your video to be saved for scheduled posting?". Đang tự động bấm "Allow"...',
      );
      await allowBtn.click({ force: true }).catch(() => {});
      await page.waitForTimeout(800);
      return true;
    }
    return false;
  };

  // 1. Kích hoạt Radio "Schedule"
  const scheduleRadioInput = page.locator('input[value="schedule"]').first();
  let isChecked = await scheduleRadioInput.isChecked().catch(() => false);

  if (!isChecked) {
    const scheduleLabel = page
      .locator(
        'label.Radio__root:has(input[value="schedule"]), label:has-text("Schedule"), *:has-text("Schedule")',
      )
      .last();
    await scheduleLabel.scrollIntoViewIfNeeded().catch(() => {});
    try {
      await scheduleLabel.click({ force: true, timeout: 3000 });
    } catch (_) {
      await scheduleLabel
        .evaluate((el: HTMLElement) => el.click())
        .catch(() => {});
    }
    await page.waitForTimeout(600);
    await checkAndAllowSchedule();
    isChecked = await scheduleRadioInput.isChecked().catch(() => false);
  }

  if (!isChecked) {
    log(
      "Cảnh báo: Chưa kiểm tra được radio Schedule đã chọn, thử click trực tiếp radio...",
    );
    await scheduleRadioInput.check({ force: true }).catch(() => {});
    await page.waitForTimeout(500);
    await checkAndAllowSchedule();
  }

  // 2. Tính toán ngày & giờ
  let scheduledTime: Date;
  if (profile.schedule_mode === "golden_hours") {
    scheduledTime = calculateNextGoldenHour(
      profile.golden_hours || "11:30,17:30,20:00",
      videoIndex,
      lastScheduledDate || new Date(),
    );
  } else {
    // auto_increment
    scheduledTime = calculateNextIncrement(
      lastScheduledDate,
      profile.schedule_interval || 10,
      new Date(),
    );
  }

  const year = scheduledTime.getFullYear();
  const month = String(scheduledTime.getMonth() + 1).padStart(2, "0");
  const day = String(scheduledTime.getDate()).padStart(2, "0");
  const dateStr = `${year}-${month}-${day}`;

  const hour = String(scheduledTime.getHours()).padStart(2, "0");
  const min = String(scheduledTime.getMinutes()).padStart(2, "0");
  const timeStr = `${hour}:${min}`;

  log(
    `Mốc thời gian lên lịch dự kiến: ${dateStr} lúc ${timeStr} (khoảng cách: ${profile.schedule_interval || 10} phút)`,
  );

  // 3. Tương tác với các ô Date và Time input
  try {
    const inputs = page.locator(
      'input.TUXTextInputCore-input, input[placeholder*="YYYY"], input[placeholder*="HH"], .date-picker-input input, .time-picker-input input',
    );

    const count = await inputs.count();
    let timeInput: any = null;
    let dateInput: any = null;

    for (let i = 0; i < count; i++) {
      const val =
        (await inputs
          .nth(i)
          .inputValue()
          .catch(() => "")) || "";
      if (val.includes(":")) {
        timeInput = inputs.nth(i);
      } else if (val.includes("-") || val.includes("/")) {
        dateInput = inputs.nth(i);
      }
    }

    if (!timeInput && count >= 2) timeInput = inputs.nth(0);
    if (!dateInput && count >= 2) dateInput = inputs.nth(1);

    if (timeInput && dateInput) {
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
      const actualDate = (await dateInput.inputValue().catch(() => "")) || "";
      const actualTime = (await timeInput.inputValue().catch(() => "")) || "";

      log(
        `Xác nhận lịch phát hành trên TikTok Studio: Ngày = "${actualDate}", Giờ = "${actualTime}"`,
      );

      await dismissPopups(page, log);
    } else {
      log(
        "Lưu ý: Không tìm thấy đủ 2 ô nhập ngày giờ, giữ mốc thời gian mặc định của TikTok.",
      );
    }
  } catch (e: any) {
    log(`Lưu ý khi điền lịch: ${e.message}`);
  }

  return scheduledTime;
}
