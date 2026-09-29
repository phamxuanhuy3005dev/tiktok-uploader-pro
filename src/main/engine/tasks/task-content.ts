import { Page } from 'playwright';
import { dismissPopups } from './task-navigate';

export interface ContentStatusSummary {
  hasScheduledPosts: boolean;
  latestScheduledDate: Date | null;
  totalPublished: number;
}

/**
 * Kiểm tra danh sách bài đăng hiện tại trên https://www.tiktok.com/tiktokstudio/content
 * Phát hiện các bài đã lên lịch (Scheduled) để nối tiếp thời gian lên lịch chính xác,
 * tránh bị trùng lịch hoặc đè giờ với các video trước.
 */
export async function checkExistingScheduledTime(
  page: Page,
  log: (msg: string) => void
): Promise<ContentStatusSummary> {
  const manageUrl = 'https://www.tiktok.com/tiktokstudio/content';
  log(`Đang kiểm tra danh sách bài đăng & lịch đã lên tại: ${manageUrl}...`);

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
        { timeout: 7000 }
      )
      .catch(() => null);

    await dismissPopups(page);

    // 1. Quét số lượng bài đăng đã publish (ví dụ: Posts 1116)
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
      log(`Kênh hiện có ${postCountText} video đã phát hành.`);
    }

    // 2. Tìm tab "Scheduled" (Đã lên lịch) nếu có
    const scheduledTab = page
      .locator(
        'button:has-text("Scheduled"), [role="tab"]:has-text("Scheduled"), [data-e2e="scheduled-tab"], button:has-text("Đã lên lịch"), [role="tab"]:has-text("Đã lên lịch")'
      )
      .first();

    const hasScheduledTab = await scheduledTab.isVisible({ timeout: 2000 }).catch(() => false);

    if (!hasScheduledTab) {
      log('Kênh hiện chưa có video nào trong hàng chờ Lên lịch (Scheduled: 0).');
      return summary;
    }

    await scheduledTab.click();
    log('Đã bấm tab "Scheduled". Đang đọc thời gian bài đăng cuối cùng...');
    await page.waitForTimeout(2500);

    const latestTimeStr = await page
      .evaluate(() => {
        const bodyText = document.body.innerText;
        // Bắt chuỗi ngày giờ tiếng Anh / số: "Sep 30, 2026, 12:30 PM" hoặc "2026-09-30 14:00"
        const matches = bodyText.match(
          /(?:Scheduled for|Scheduled:?)\s*([A-Za-z]+ \d{1,2}, \d{4}, \d{1,2}:\d{2} [AP]M|\d{4}-\d{2}-\d{2} \d{2}:\d{2})/g
        );
        if (matches && matches.length > 0) {
          return matches[matches.length - 1];
        }

        // Bắt từ bảng PostTable
        const postTable = document.querySelector('table, [data-tt*="PostTable"], [class*="PostTable"]');
        if (postTable) {
          const text = (postTable as HTMLElement).innerText;
          const dateMatch = text.match(/(\d{4}[-/.]\d{1,2}[-/.]\d{1,2}\s+\d{1,2}:\d{2})/);
          if (dateMatch) return dateMatch[1];
        }
        return null;
      })
      .catch(() => null);

    if (latestTimeStr) {
      const cleanStr = latestTimeStr.replace(/(?:Scheduled for|Scheduled:?)\s*/i, '');
      const parsedDate = new Date(cleanStr);
      if (!isNaN(parsedDate.getTime())) {
        summary.hasScheduledPosts = true;
        summary.latestScheduledDate = parsedDate;
        log(`Tìm thấy mốc thời gian video đã lên lịch gần nhất: ${parsedDate.toLocaleString('vi-VN')}`);
      }
    } else {
      log('Tab Scheduled không có bài nào đang chờ.');
    }
  } catch (e: any) {
    log(`Lưu ý: Không thể quét tab quản lý content: ${e.message}. Tiếp tục sang bước upload.`);
  }

  return summary;
}
