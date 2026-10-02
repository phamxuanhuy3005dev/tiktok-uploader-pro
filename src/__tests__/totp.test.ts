import { describe, expect, it } from "vitest";
import { generateTotp } from "../main/engine/totp";

describe("generateTotp", () => {
  it("Sinh mã OTP 6 số hợp lệ từ secret key Base32", () => {
    // Secret test chuẩn RFC
    const secret = "JBSWY3DPEHPK3PXP";
    const res = generateTotp(secret);

    expect(res).not.toBeNull();
    expect(res?.otp).toMatch(/^\d{6}$/); // Đúng 6 chữ số
    expect(res?.remainingSec).toBeGreaterThan(0);
    expect(res?.remainingSec).toBeLessThanOrEqual(30);
  });

  it("Tự động chuẩn hóa secret key có chứa khoảng trắng hoặc dấu gạch", () => {
    const rawSecret = " jbsw y3dp-ehpk 3pxp ";
    const res = generateTotp(rawSecret);

    expect(res).not.toBeNull();
    expect(res?.otp).toMatch(/^\d{6}$/);
  });

  it("Trả về null an toàn nếu secret key không hợp lệ hoặc quá ngắn", () => {
    expect(generateTotp("")).toBeNull();
    expect(generateTotp("123")).toBeNull();
    expect(generateTotp(null as any)).toBeNull();
    expect(generateTotp(undefined as any)).toBeNull();
  });
});
