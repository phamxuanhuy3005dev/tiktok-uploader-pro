import { describe, expect, it } from "vitest";
import {
  calculateNextGoldenHour,
  calculateNextIncrement,
} from "../main/engine/tasks/task-schedule";

describe("calculateNextIncrement", () => {
  it("Video đầu tiên phải cách hiện tại tối thiểu 16 phút và làm tròn lên mốc 5 phút", () => {
    // Giả sử hiện tại là 10:02:00
    const now = new Date("2026-10-03T10:02:00Z");
    const next = calculateNextIncrement(null, 10, now);

    // 10:02 + 16p = 10:18 -> Làm tròn lên bội số 5p là 10:20
    const expected = new Date("2026-10-03T10:20:00Z");
    expect(next.getTime()).toBe(expected.getTime());
  });

  it("Video tiếp theo phải cách video trước đúng số phút cấu hình và làm tròn lên 5 phút", () => {
    const now = new Date("2026-10-03T10:00:00Z");
    const lastDate = new Date("2026-10-03T11:00:00Z"); // Đã ở tương lai xa

    // interval = 10 phút -> 11:00 + 10p = 11:10
    const next = calculateNextIncrement(lastDate, 10, now);
    expect(next.getTime()).toBe(new Date("2026-10-03T11:10:00Z").getTime());

    // interval = 12 phút -> 11:00 + 12p = 11:12 -> làm tròn lên 11:15
    const nextRound = calculateNextIncrement(lastDate, 12, now);
    expect(nextRound.getTime()).toBe(
      new Date("2026-10-03T11:15:00Z").getTime(),
    );
  });

  it("Nếu video trước đã quá cũ trong quá khứ, video mới phải dời về tối thiểu hiện tại + 16 phút", () => {
    const now = new Date("2026-10-03T15:00:00Z");
    const pastDate = new Date("2026-10-01T10:00:00Z"); // 2 ngày trước

    const next = calculateNextIncrement(pastDate, 10, now);
    // 15:00 + 16p = 15:16 -> Làm tròn lên 15:20
    expect(next.getTime()).toBe(new Date("2026-10-03T15:20:00Z").getTime());
  });
});

describe("calculateNextGoldenHour", () => {
  it("Xác định chính xác khung giờ vàng theo thứ tự index", () => {
    const baseDate = new Date("2026-10-03T08:00:00Z");
    const goldenStr = "11:30,17:30,20:00";

    const slot0 = calculateNextGoldenHour(goldenStr, 0, baseDate);
    expect(slot0.getHours()).toBe(11);
    expect(slot0.getMinutes()).toBe(30);

    const slot1 = calculateNextGoldenHour(goldenStr, 1, baseDate);
    expect(slot1.getHours()).toBe(17);
    expect(slot1.getMinutes()).toBe(30);

    const slot2 = calculateNextGoldenHour(goldenStr, 2, baseDate);
    expect(slot2.getHours()).toBe(20);
    expect(slot2.getMinutes()).toBe(0);
  });
});
