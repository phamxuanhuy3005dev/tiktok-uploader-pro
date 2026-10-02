import { describe, expect, it } from "vitest";
import {
  getCooldownStatus,
  isNurturingGroup,
} from "../renderer/src/utils/cooldown";

describe("isNurturingGroup", () => {
  it("Nhận diện chính xác các nhóm nuôi kênh (không phân biệt dấu tiếng Việt hay hoa thường)", () => {
    expect(isNurturingGroup("Nuôi kênh")).toBe(true);
    expect(isNurturingGroup("nuoi_acc_us")).toBe(true);
    expect(isNurturingGroup("Kênh mới")).toBe(true);
    expect(isNurturingGroup("Warmup US")).toBe(true);
    expect(isNurturingGroup("warm-up-batch-1")).toBe(true);
    expect(isNurturingGroup("Nurture accounts")).toBe(true);
  });

  it("Trả về false với các nhóm kênh thông thường", () => {
    expect(isNurturingGroup("Mặc định")).toBe(false);
    expect(isNurturingGroup("Hài hước")).toBe(false);
    expect(isNurturingGroup("Affiliate Shop")).toBe(false);
    expect(isNurturingGroup("Reup Douyin")).toBe(false);
    expect(isNurturingGroup(null)).toBe(false);
    expect(isNurturingGroup(undefined)).toBe(false);
  });
});

describe("getCooldownStatus", () => {
  it("Kênh chưa từng chạy phải có trạng thái Chưa từng chạy và không bị cooldown", () => {
    const status = getCooldownStatus(null, "Nuôi kênh");
    expect(status.isUnderCooldown).toBe(false);
    expect(status.remainingText).toBe("Chưa từng chạy");
  });

  it("Kênh thuộc nhóm nuôi vừa chạy cách đây 2 tiếng phải bị cooldown và tính đúng giờ còn lại", () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 3600 * 1000).toISOString();
    const status = getCooldownStatus(twoHoursAgo, "Nuôi kênh");

    expect(status.isUnderCooldown).toBe(true);
    expect(status.remainingHours).toBeGreaterThanOrEqual(21);
    expect(status.remainingHours).toBeLessThanOrEqual(22);
    expect(status.remainingText).toMatch(/2[12]h/);
  });

  it("Kênh thuộc nhóm nuôi đã chạy cách đây 25 tiếng thì đã đủ 24h và không bị cooldown", () => {
    const twentyFiveHoursAgo = new Date(
      Date.now() - 25 * 3600 * 1000,
    ).toISOString();
    const status = getCooldownStatus(twentyFiveHoursAgo, "Nuôi kênh");

    expect(status.isUnderCooldown).toBe(false);
    expect(status.remainingText).toBe("Đã đủ 24h");
  });

  it("Kênh KHÔNG thuộc nhóm nuôi thì dù vừa chạy xong cũng không bị khóa cooldown", () => {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const status = getCooldownStatus(fiveMinutesAgo, "Mặc định");

    expect(status.isUnderCooldown).toBe(false);
    expect(status.isNurturing).toBe(false);
  });
});
