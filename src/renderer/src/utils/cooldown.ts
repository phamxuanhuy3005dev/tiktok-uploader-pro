/**
 * Tiện ích kiểm tra nhóm Kênh Đang Nuôi & Cơ chế Khóa Cooldown 24 Giờ
 */

export function isNurturingGroup(groupName?: string | null): boolean {
  if (!groupName) return false;
  const lower = groupName.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return (
    lower.includes('nuoi') ||
    lower.includes('warmup') ||
    lower.includes('warm-up') ||
    lower.includes('nurture') ||
    lower.includes('kenh moi') ||
    lower.includes('moi')
  );
}

export interface CooldownStatus {
  isNurturing: boolean;
  isUnderCooldown: boolean;
  remainingMs: number;
  remainingHours: number;
  remainingMinutes: number;
  remainingText: string;
  elapsedHours: number;
  lastRunFormatted: string;
}

export function getCooldownStatus(
  lastRun?: string | null,
  groupName?: string | null
): CooldownStatus {
  const isNurturing = isNurturingGroup(groupName);

  if (!lastRun) {
    return {
      isNurturing,
      isUnderCooldown: false,
      remainingMs: 0,
      remainingHours: 0,
      remainingMinutes: 0,
      remainingText: 'Chưa từng chạy',
      elapsedHours: 999,
      lastRunFormatted: 'Chưa từng chạy'
    };
  }

  const lastTime = new Date(lastRun).getTime();
  if (isNaN(lastTime)) {
    return {
      isNurturing,
      isUnderCooldown: false,
      remainingMs: 0,
      remainingHours: 0,
      remainingMinutes: 0,
      remainingText: 'Thời gian không hợp lệ',
      elapsedHours: 999,
      lastRunFormatted: 'Không xác định'
    };
  }

  const elapsedMs = Date.now() - lastTime;
  const cooldownDuration = 24 * 60 * 60 * 1000; // 24 giờ
  const remainingMs = cooldownDuration - elapsedMs;

  const elapsedHours = Math.floor(elapsedMs / (3600 * 1000));
  const remainingHours = Math.max(0, Math.floor(remainingMs / (3600 * 1000)));
  const remainingMinutes = Math.max(0, Math.floor((remainingMs % (3600 * 1000)) / (60 * 1000)));

  const isUnderCooldown = isNurturing && remainingMs > 0;
  const remainingText = isUnderCooldown
    ? `${remainingHours}h ${remainingMinutes}m`
    : 'Đã đủ 24h';

  const lastRunDate = new Date(lastRun);
  const lastRunFormatted = lastRunDate.toLocaleTimeString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit'
  });

  return {
    isNurturing,
    isUnderCooldown,
    remainingMs: Math.max(0, remainingMs),
    remainingHours,
    remainingMinutes,
    remainingText,
    elapsedHours,
    lastRunFormatted
  };
}
