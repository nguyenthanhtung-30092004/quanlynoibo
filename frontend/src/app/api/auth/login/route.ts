import { NextResponse, type NextRequest } from 'next/server';
import { getBackendUrl, setSessionCookies } from '@/lib/server/session';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const body = await req.text();

  let upstream: Response;
  try {
    upstream = await fetch(`${getBackendUrl()}/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body,
      cache: 'no-store',
    });
  } catch {
    return NextResponse.json(
      { message: 'Không kết nối được máy chủ. Vui lòng thử lại sau.' },
      { status: 502 },
    );
  }

  const json = await upstream.json().catch(() => null);
  if (!upstream.ok || !json?.data?.accessToken) {
    return NextResponse.json(
      { message: json?.message ?? 'Đăng nhập thất bại.' },
      { status: upstream.status === 200 ? 502 : upstream.status },
    );
  }

  // Token chỉ đi vào cookie httpOnly, không trả về cho JavaScript của trang
  const { accessToken, refreshToken, user } = json.data;
  const response = NextResponse.json({ data: { user } });
  setSessionCookies(response, { accessToken, refreshToken });
  return response;
}
