import { Page } from 'playwright';
import { dismissPopups } from './task-navigate';

export interface ContentStatusSummary {
  hasScheduledPosts: boolean;
  latestScheduledDate: Date | null;
  totalPublished: number;
}

/**
 * Kiểm tra danh sách bài đăng hiện tại trên https://www.tiktok.com/tiktokstudio/content
 * Phát hiện chính xác các bài đã lên lịch (Scheduled) trong danh sách Posts,
 * để nối tiếp thời gian lên lịch chính xác, tránh bị trùng lịch hoặc đè giờ với các video trước.
 */
export async function checkExistingScheduledTime(
  page: Page,
  log: (msg: string) => void
): Promise<ContentStatusSummary> {
  const manageUrl = 'https://www.tiktok.com/tiktokstudio/content';
  log(`Đang kiểm tra danh sách bài đăng & lịch hẹn giờ tại: ${manageUrl}...`);

  const summary: ContentStatusSummary = {
    hasScheduledPosts: false,
    latestScheduledDate: null,
    totalPublished: 0
  };

  try {
    await page.goto(manageUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 25000
    });

    // Chờ bảng danh sách post xuất hiện
    await page
      .waitForSelector(
        'button:has-text("Posts"), [role="tab"]:has-text("Posts"), [role="tablist"], table, [data-tt*="PostTable"], .post-table',
        { timeout: 8000 }
      )
      .catch(() => null);

    await dismissPopups(page);
    await page.waitForTimeout(1500);

    // 1. Quét số lượng bài đăng đã publish (ví dụ: Posts 636)
    const postCountText = await page
      .evaluate(() => {
        const tabs = Array.from(document.querySelectorAll('[role="tab"], button'));
        for (const t of tabs) {
          const text = (t as HTMLElement).innerText || '';
          const match = text.match(/Posts\s*(\d+)/i);
          if (match) return parseInt(match[1], 10);
        }
        return 0;
      })
      .catch(() => 0);

    summary.totalPublished = postCountText;
    if (postCountText > 0) {
      log(`Kênh hiện có ${postCountText} video trong hệ thống.`);
    }

    // 2. Quét toàn bộ bảng Posts để phát hiện các bài đã lên lịch (Scheduled) trong tương lai
    const scheduledTimestamps = await page
      .evaluate(() => {
        const nowMs = Date.now();
        const currentYear = new Date().getFullYear();
        const detected: number[] = [];

        // Bắt chuỗi ngày giờ tiếng Anh dạng: "Sep 30, 3:25 AM" hoặc "Sep 30, 2026, 3:25 AM"
        const regex = /([A-Za-z]{3}\s+\d{1,2}(?:,\s+\d{4})?,\s+\d{1,2}:\d{2}\s+[AP]M)/gi;

        // Quét các dòng hoặc thẻ chứa bài đăng
        const rows = Array.from(
          document.querySelectorAll(
            'table tr, [data-tt*="PostTable"] tr, div[class*="post-item"], div[class*="table-row"], div[class*="PostCard"], div[class*="content-item"]'
          )
        );

        const targets = rows.length > 0 ? rows : [document.body];

        for (const target of targets) {
          const text = (target as HTMLElement).innerText || '';
          const matches = text.match(regex);
          if (matches) {
            for (const m of matches) {
              let clean = m.trim();
              if (!clean.includes(String(currentYear))) {
                clean = `${clean}, ${currentYear}`;
              }
              const d = new Date(clean);
              // Nếu thời gian này lớn hơn hiện tại + 2 phút -> Đích thị là video đang hẹn giờ!
              if (!isNaN(d.getTime()) && d.getTime() > nowMs + 2 * 60 * 1000) {
                detected.push(d.getTime());
              }
            }
          }
        }

        return detected;
      })
      .catch(() => [] as number[]);

    if (scheduledTimestamps.length > 0) {
      const maxMs = Math.max(...scheduledTimestamps);
      summary.hasScheduledPosts = true;
      summary.latestScheduledDate = new Date(maxMs);
      log(
        `Đã phát hiện ${scheduledTimestamps.length} bài đăng đang hẹn giờ. Mốc hẹn giờ muộn nhất hiện tại: ${summary.latestScheduledDate.toLocaleString('vi-VN')}`
      );
    } else {
      log('Kênh hiện chưa có video nào đang hẹn giờ. Video đầu tiên sẽ được đặt lịch cách thời điểm hiện tại tối thiểu 15-20 phút.');
    }
  } catch (e: any) {
    log(`Lưu ý: Không thể quét bảng quản lý nội dung: ${e.message}. Tiếp tục sang bước upload.`);
  }

  return summary;
}
