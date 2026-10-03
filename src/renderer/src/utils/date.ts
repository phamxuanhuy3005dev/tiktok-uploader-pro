/**
 * Tiện ích xử lý và định dạng ngày giờ chuẩn xác theo múi giờ địa phương (Việt Nam)
 */

/**
 * Chuyển đổi an toàn chuỗi ngày giờ từ SQLite hoặc ISO sang Date object.
 * SQLite CURRENT_TIMESTAMP lưu UTC dưới dạng 'YYYY-MM-DD HH:MM:SS' (thiếu T và Z).
 * Nếu không có Z hoặc timezone, JavaScript mặc định hiểu là Local time dẫn đến lệch 7 tiếng!
 */
export function parseDate(
  dateInput: string | number | Date | null | undefined,
): Date | null {
  if (!dateInput) return null;
  if (dateInput instanceof Date)
    return isNaN(dateInput.getTime()) ? null : dateInput;
  if (typeof dateInput === "number") {
    const d = new Date(dateInput);
    return isNaN(d.getTime()) ? null : d;
  }
  if (typeof dateInput === "string") {
    let str = dateInput.trim();
    if (!str) return null;

    // Định dạng SQLite UTC 'YYYY-MM-DD HH:MM:SS' hoặc 'YYYY-MM-DD HH:MM:SS.sss'
    if (/^\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}:\d{2}/.test(str)) {
      str = str.replace(" ", "T") + "Z";
    } else if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?$/.test(str)) {
      // Có dạng YYYY-MM-DDTHH:MM:SS nhưng thiếu Z ở cuối
      str = str + "Z";
    }

    const d = new Date(str);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

/**
 * Định dạng ngày giờ chuẩn giờ địa phương Việt Nam (HH:mm:ss DD/MM/YYYY)
 * Ví dụ: 12:07:28 03/10/2026
 */
export function formatDateTime(
  dateInput: string | number | Date | null | undefined,
  fallback = "Chưa xác định",
): string {
  const d = parseDate(dateInput);
  if (!d) return fallback;

  return d.toLocaleString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour12: false,
  });
}

/**
 * Định dạng chỉ giờ (HH:mm:ss)
 * Ví dụ: 12:07:28
 */
export function formatTime(
  dateInput: string | number | Date | null | undefined,
  fallback = "",
): string {
  const d = parseDate(dateInput);
  if (!d) return fallback;

  return d.toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

/**
 * Định dạng chỉ ngày (DD/MM/YYYY)
 * Ví dụ: 03/10/2026
 */
export function formatDate(
  dateInput: string | number | Date | null | undefined,
  fallback = "",
): string {
  const d = parseDate(dateInput);
  if (!d) return fallback;

  return d.toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}
