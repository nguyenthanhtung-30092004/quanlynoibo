import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

/**
 * Mã hóa 2 chiều (AES-256-GCM) để Admin xem lại được mật khẩu nhân viên.
 * Khóa lấy từ PASSWORD_VIEW_KEY; chưa đặt thì suy ra từ JWT_SECRET để không làm hỏng việc triển khai.
 * Đổi khóa thì các mật khẩu đã lưu không đọc lại được (hiện "—" tới khi đặt lại mật khẩu).
 */
function vaultKey(): Buffer {
  const secret = process.env.PASSWORD_VIEW_KEY || `pwview:${process.env.JWT_SECRET ?? ''}`;
  return createHash('sha256').update(secret).digest();
}

export function encryptPassword(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', vaultKey(), iv);
  const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), data].map((b) => b.toString('base64')).join('.');
}

/** Trả null khi chưa có bản mã hoặc không giải mã được (sai khóa, dữ liệu hỏng) */
export function decryptPassword(stored: string | null | undefined): string | null {
  if (!stored) return null;
  try {
    const [iv, tag, data] = stored.split('.').map((p) => Buffer.from(p, 'base64'));
    const decipher = createDecipheriv('aes-256-gcm', vaultKey(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
  } catch {
    return null;
  }
}
