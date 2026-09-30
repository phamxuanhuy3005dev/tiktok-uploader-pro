import crypto from 'crypto';

/**
 * Giải mã chuỗi Base32 sang Buffer chuẩn RFC 4648
 */
function base32ToBuffer(base32: string): Buffer {
  const clean = base32.replace(/[\s=-]/g, '').toUpperCase();
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  for (let i = 0; i < clean.length; i++) {
    const val = alphabet.indexOf(clean[i]);
    if (val === -1) continue;
    bits += val.toString(2).padStart(5, '0');
  }
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.substr(i, 8), 2));
  }
  return Buffer.from(bytes);
}

/**
 * Sinh mã OTP 6 số theo chuẩn RFC 6238 (Google Authenticator / 2fa.live)
 */
export function generateTotp(
  secret: string,
  step = 30,
  digits = 6
): { otp: string; remainingSec: number } | null {
  try {
    if (!secret || typeof secret !== 'string') return null;
    const cleanSecret = secret.trim();
    if (cleanSecret.length < 8) return null;

    const key = base32ToBuffer(cleanSecret);
    if (key.length === 0) return null;

    const epoch = Math.floor(Date.now() / 1000);
    const timeStep = Math.floor(epoch / step);
    const remainingSec = step - (epoch % step);

    const timeBuffer = Buffer.alloc(8);
    timeBuffer.writeBigInt64BE(BigInt(timeStep));

    const hmac = crypto.createHmac('sha1', key).update(timeBuffer).digest();
    const offset = hmac[hmac.length - 1] & 0xf;
    const codeInt =
      ((hmac[offset] & 0x7f) << 24) |
      ((hmac[offset + 1] & 0xff) << 16) |
      ((hmac[offset + 2] & 0xff) << 8) |
      (hmac[offset + 3] & 0xff);

    const otp = (codeInt % Math.pow(10, digits)).toString().padStart(digits, '0');
    return { otp, remainingSec };
  } catch (_) {
    return null;
  }
}
