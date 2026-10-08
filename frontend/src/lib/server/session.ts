import type { NextResponse } from 'next/server';

/**
 * Token nằm trong cookie httpOnly: JavaScript trên trình duyệt (kể cả khi bị
 * XSS) không đọc được. Trình duyệt chỉ nói chuyện với Next.js, Next.js mới
 * gọi backend và gắn Bearer token.
 */
export const ACCESS_COOKIE = 'qlnb_at';
export const REFRESH_COOKIE = 'qlnb_rt';

export interface Tokens {
  accessToken: string;
  refreshToken: string;
}

export function getBackendUrl(): string {
  return (process.env.BACKEND_URL || 'http://localhost:3009').replace(/\/$/, '');
}

/** Đọc thời điểm hết hạn (giây epoch) từ payload JWT; không xác thực chữ ký */
export function decodeJwtExp(token: string): number | null {
  try {
    const payload = token.split('.')[1];
    if (!payload) return null;
    const json = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return typeof json.exp === 'number' ? json.exp : null;
  } catch {
    return null;
  }
}

function maxAgeFor(token: string, fallbackSeconds: number): number {
  const exp = decodeJwtExp(token);
  if (!exp) return fallbackSeconds;
  return Math.max(0, exp - Math.floor(Date.now() / 1000));
}

const baseOptions = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  path: '/',
};

export function setSessionCookies(response: NextResponse, tokens: Tokens) {
  response.cookies.set(ACCESS_COOKIE, tokens.accessToken, {
    ...baseOptions,
    maxAge: maxAgeFor(tokens.accessToken, 3600),
  });
  response.cookies.set(REFRESH_COOKIE, tokens.refreshToken, {
    ...baseOptions,
    maxAge: maxAgeFor(tokens.refreshToken, 12 * 3600),
  });
}

export function clearSessionCookies(response: NextResponse) {
  for (const name of [ACCESS_COOKIE, REFRESH_COOKIE]) {
    response.cookies.set(name, '', { ...baseOptions, maxAge: 0 });
  }
}

const inflight = new Map<string, Promise<Tokens | null>>();
/** Kết quả đã xong của từng lần refresh, để biết token nào cần thu hồi khi logout */
const settled = new Map<string, Tokens>();
const REUSE_WINDOW_MS = 15_000;

/**
 * Đổi refresh token lấy cặp token mới. Backend xoay vòng refresh token (token
 * cũ dùng lại là bị từ chối), nên nhiều request song song cùng gặp 401 phải
 * dùng chung MỘT lần refresh, nếu không request đến sau sẽ bị đăng xuất oan.
 * Kết quả được giữ ngắn hạn cho các request vẫn mang cookie cũ.
 */
export function refreshTokens(refreshToken: string): Promise<Tokens | null> {
  const existing = inflight.get(refreshToken);
  if (existing) return existing;

  const promise = (async (): Promise<Tokens | null> => {
    try {
      const res = await fetch(`${getBackendUrl()}/auth/refresh`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
        cache: 'no-store',
      });
      if (!res.ok) return null;
      const json = (await res.json()) as {
        data?: { accessToken?: string; refreshToken?: string };
      };
      const accessToken = json.data?.accessToken;
      const newRefresh = json.data?.refreshToken;
      return accessToken && newRefresh
        ? { accessToken, refreshToken: newRefresh }
        : null;
    } catch {
      return null;
    }
  })();

  inflight.set(refreshToken, promise);
  void promise.then((tokens) => {
    if (tokens) settled.set(refreshToken, tokens);
  });
  setTimeout(() => {
    inflight.delete(refreshToken);
    settled.delete(refreshToken);
  }, REUSE_WINDOW_MS).unref?.();
  return promise;
}

/**
 * Gọi khi đăng xuất: bỏ mọi kết quả refresh đang được giữ lại có liên quan tới
 * refresh token này, để cookie cũ không đổi được access token mới sau logout.
 */
export function forgetRefreshToken(refreshToken: string) {
  settled.forEach((tokens, key) => {
    if (key === refreshToken || tokens.refreshToken === refreshToken) {
      inflight.delete(key);
      settled.delete(key);
    }
  });
  inflight.delete(refreshToken);
}
