import { ProfileRecord, profileRepo } from '../db/database';
import { launchProfileContext, closeProfileContext } from './browser-pool';

/**
 * Chuyển đổi định dạng rút gọn của TikTok (ví dụ: '1.2K', '25.4M', '300') thành số nguyên
 */
export function parseKMTValue(val: string | number | undefined | null): number {
  if (val === undefined || val === null) return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : Math.round(val);

  const clean = String(val).trim().toUpperCase();
  if (!clean) return 0;

  if (clean.endsWith('K')) {
    const num = parseFloat(clean.replace('K', ''));
    return isNaN(num) ? 0 : Math.round(num * 1000);
  }
  if (clean.endsWith('M')) {
    const num = parseFloat(clean.replace('M', ''));
    return isNaN(num) ? 0 : Math.round(num * 1000000);
  }
  if (clean.endsWith('B')) {
    const num = parseFloat(clean.replace('B', ''));
    return isNaN(num) ? 0 : Math.round(num * 1000000000);
  }

  const raw = parseFloat(clean.replace(/,/g, ''));
  return isNaN(raw) ? 0 : Math.round(raw);
}

export interface ChannelStatsResult {
  success: boolean;
  followers: number;
  error?: string;
}

/**
 * Trích xuất username TikTok chuẩn từ account_id hoặc name
 */
export function extractUsername(profile: ProfileRecord): string {
  const candidate = (profile.account_id && profile.account_id.trim()) 
    ? profile.account_id.trim() 
    : profile.name.trim();

  // Bỏ ký tự @ nếu người dùng gõ @username
  return candidate.replace(/^@/, '').trim();
}

/**
 * Thử cào số lượng followers nhanh qua HTTP request (không cần mở browser)
 */
async function fetchStatsViaHttp(username: string): Promise<ChannelStatsResult | null> {
  try {
    const url = `https://www.tiktok.com/@${encodeURIComponent(username)}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 7000);

    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cache-Control': 'no-cache'
      }
    });
    clearTimeout(timeoutId);

    if (!res.ok) return null;
    const html = await res.text();

    let followerCount = 0;
    let found = false;

    // 1. Phân tích thẻ script __UNIVERSAL_DATA_FOR_REHYDRATION__
    const universalMatch = html.match(/<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__"[^>]*>([\s\S]*?)<\/script>/);
    if (universalMatch && universalMatch[1]) {
      try {
        const json = JSON.parse(universalMatch[1]);
        const userDetail = json?.defaultScope?.['webapp.user-detail'];
        if (userDetail?.userInfo?.stats) {
          followerCount = Number(userDetail.userInfo.stats.followerCount) || 0;
          found = true;
        }
      } catch (_) {}
    }

    // 2. Thử phân tích SIGI_STATE
    if (!found) {
      const sigiMatch = html.match(/<script id="SIGI_STATE"[^>]*>([\s\S]*?)<\/script>/);
      if (sigiMatch && sigiMatch[1]) {
        try {
          const json = JSON.parse(sigiMatch[1]);
          const statsModule = json?.UserModule?.stats?.[username];
          if (statsModule) {
            followerCount = Number(statsModule.followerCount) || 0;
            found = true;
          }
        } catch (_) {}
      }
    }

    if (found) {
      return {
        success: true,
        followers: followerCount
      };
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Lấy số lượng followers bằng Playwright Headless Context (Dùng proxy và cookies của profile)
 */
async function fetchStatsViaBrowser(profile: ProfileRecord): Promise<ChannelStatsResult> {
  const username = extractUsername(profile);
  let context: any = null;

  try {
    const launched = await launchProfileContext(profile, true);
    context = launched.context;
    const page = launched.page;

    const url = `https://www.tiktok.com/@${encodeURIComponent(username)}`;
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});

    // Đợi 2s để script rehydration nạp
    await page.waitForTimeout(2000);

    const data = await page.evaluate(() => {
      let followers = 0;

      // 1. Script JSON Universal
      try {
        const script = document.getElementById('__UNIVERSAL_DATA_FOR_REHYDRATION__');
        if (script && script.textContent) {
          const parsed = JSON.parse(script.textContent);
          const userDetail = parsed?.defaultScope?.['webapp.user-detail'];
          if (userDetail?.userInfo?.stats) {
            followers = userDetail.userInfo.stats.followerCount || 0;
          }
        }
      } catch (_) {}

      // 2. DOM Selector fallback
      if (!followers) {
        const el = document.querySelector('[data-e2e="followers-count"]');
        if (el && el.textContent) {
          const txt = el.textContent.trim();
          followers = txt as any;
        }
      }

      return {
        followers
      };
    });

    const followers = typeof data.followers === 'number' ? data.followers : parseKMTValue(data.followers);

    return {
      success: true,
      followers
    };
  } catch (err: any) {
    return {
      success: false,
      followers: 0,
      error: err.message
    };
  } finally {
    if (context) {
      await closeProfileContext(profile.id).catch(() => {});
    }
  }
}

/**
 * Lấy số lượng Followers của 1 kênh và tự động cập nhật vào Database
 */
export async function fetchAndSaveProfileStats(profile: ProfileRecord): Promise<{
  success: boolean;
  profile: ProfileRecord;
  stats: { followers: number };
  error?: string;
}> {
  const username = extractUsername(profile);
  if (!username) {
    return {
      success: false,
      profile,
      stats: { followers: 0 },
      error: 'Tài khoản chưa có Username hoặc Account ID hợp lệ.'
    };
  }

  // 1. Ưu tiên fetch nhanh qua HTTP (không tốn tài nguyên trình duyệt)
  let result = await fetchStatsViaHttp(username);

  // 2. Nếu HTTP không tìm thấy (TikTok chặn hoặc đổi layout), fallback sang Browser
  if (!result || result.followers === 0) {
    result = await fetchStatsViaBrowser(profile);
  }

  if (result.success) {
    const now = new Date().toISOString();
    profileRepo.updateStats(profile.id, {
      followers_count: result.followers,
      stats_updated_at: now
    });

    const updated = profileRepo.getById(profile.id) || profile;
    return {
      success: true,
      profile: updated,
      stats: {
        followers: result.followers
      }
    };
  }

  return {
    success: false,
    profile,
    stats: { followers: profile.followers_count || 0 },
    error: result.error || 'Không thể lấy số liệu từ TikTok'
  };
}
