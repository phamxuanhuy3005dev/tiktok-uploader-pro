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

  it("Đồng bộ giữa 2 máy: Khi import kênh từ máy A có last_run 4h trước sang máy B thì máy B phải giữ nguyên cooldown còn ~20h", () => {
    // Mô phỏng máy A vừa chạy xong 4 tiếng trước
    const fourHoursAgo = new Date(Date.now() - 4 * 3600 * 1000).toISOString();
    const exportedProfileFromMachineA = {
      name: "kenh_nuoi_us_01",
      group_name: "Nuôi US",
      last_run: fourHoursAgo,
    };

    // Mô phỏng máy B import JSON profile này
    const importedOnMachineB = { ...exportedProfileFromMachineA };
    const statusOnMachineB = getCooldownStatus(
      importedOnMachineB.last_run,
      importedOnMachineB.group_name,
    );

    expect(statusOnMachineB.isUnderCooldown).toBe(true);
    expect(statusOnMachineB.remainingHours).toBeGreaterThanOrEqual(19);
    expect(statusOnMachineB.remainingHours).toBeLessThanOrEqual(20);
    expect(statusOnMachineB.remainingText).toMatch(/(19|20)h/);
  });

  it("Cơ chế giải quyết xung đột: Luôn giữ mốc last_run mới nhất giữa 2 máy", () => {
    const timeMachineA = new Date(Date.now() - 2 * 3600 * 1000).toISOString(); // 2h trước (mới hơn)
    const timeMachineB = new Date(Date.now() - 10 * 3600 * 1000).toISOString(); // 10h trước (cũ hơn)

    const resolveLastRun = (importedTime: string | null, existingTime: string | null) => {
      if (!importedTime) return existingTime;
      if (!existingTime) return importedTime;
      return new Date(importedTime).getTime() > new Date(existingTime).getTime()
        ? importedTime
        : existingTime;
    };

    // Trường hợp 1: File import từ máy A mới hơn dữ liệu cũ trên máy B -> Chọn mốc máy A
    expect(resolveLastRun(timeMachineA, timeMachineB)).toBe(timeMachineA);

    // Trường hợp 2: File import từ máy A cũ hơn dữ liệu vừa chạy trên máy B -> Giữ mốc máy B
    expect(resolveLastRun(timeMachineB, timeMachineA)).toBe(timeMachineA);
  });
});
