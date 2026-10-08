import { NextResponse, type NextRequest } from 'next/server';
import {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  clearSessionCookies,
  forgetRefreshToken,
  getBackendUrl,
} from '@/lib/server/session';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const accessToken = req.cookies.get(ACCESS_COOKIE)?.value;
  const refreshToken = req.cookies.get(REFRESH_COOKIE)?.value;
  if (refreshToken) forgetRefreshToken(refreshToken);

  // Thu hồi refresh token ở backend (nếu lỗi vẫn xóa cookie phía trình duyệt)
  if (accessToken) {
    await fetch(`${getBackendUrl()}/auth/logout`, {
      method: 'POST',
      headers: { authorization: `Bearer ${accessToken}` },
      cache: 'no-store',
    }).catch(() => undefined);
  }

  const response = NextResponse.json({ data: { success: true } });
  clearSessionCookies(response);
  return response;
}
