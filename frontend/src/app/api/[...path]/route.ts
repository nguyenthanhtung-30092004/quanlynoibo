import { NextResponse, type NextRequest } from 'next/server';
import {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  clearSessionCookies,
  getBackendUrl,
  refreshTokens,
  setSessionCookies,
  type Tokens,
} from '@/lib/server/session';

export const dynamic = 'force-dynamic';

/** Các endpoint xác thực do route riêng xử lý, không cho đi qua proxy chung */
const BLOCKED_PATHS = /^auth\/(login|register|refresh|logout)(\/|$)/;

const FORWARDED_REQUEST_HEADERS = ['content-type', 'accept'];
const FORWARDED_RESPONSE_HEADERS = ['content-type', 'content-disposition'];

type RouteContext = { params: { path: string[] } };

async function handler(req: NextRequest, { params }: RouteContext) {
  const path = params.path.join('/');
  if (BLOCKED_PATHS.test(path)) {
    return NextResponse.json({ message: 'Not Found' }, { status: 404 });
  }

  const refreshToken = req.cookies.get(REFRESH_COOKIE)?.value;
  let accessToken = req.cookies.get(ACCESS_COOKIE)?.value;
  let rotated: Tokens | null = null;

  // Access token đã hết hạn (cookie biến mất) nhưng còn refresh token
  if (!accessToken && refreshToken) {
    rotated = await refreshTokens(refreshToken);
    accessToken = rotated?.accessToken;
  }
  if (!accessToken) return unauthorized();

  const hasBody = req.method !== 'GET' && req.method !== 'HEAD';
  const body = hasBody ? await req.arrayBuffer() : undefined;
  const url = `${getBackendUrl()}/${path}${req.nextUrl.search}`;

  const forward = (token: string) => {
    const headers = new Headers({ authorization: `Bearer ${token}` });
    for (const name of FORWARDED_REQUEST_HEADERS) {
      const value = req.headers.get(name);
      if (value) headers.set(name, value);
    }
    return fetch(url, {
      method: req.method,
      headers,
      body,
      cache: 'no-store',
      redirect: 'manual',
    });
  };

  let upstream: Response;
  try {
    upstream = await forward(accessToken);
    if (upstream.status === 401 && refreshToken && !rotated) {
      rotated = await refreshTokens(refreshToken);
      if (rotated) upstream = await forward(rotated.accessToken);
    }
  } catch {
    return NextResponse.json(
      { message: 'Không kết nối được máy chủ. Vui lòng thử lại sau.' },
      { status: 502 },
    );
  }

  if (upstream.status === 401) return unauthorized();

  const headers = new Headers();
  for (const name of FORWARDED_RESPONSE_HEADERS) {
    const value = upstream.headers.get(name);
    if (value) headers.set(name, value);
  }
  const noBody = upstream.status === 204 || upstream.status === 304;
  const response = new NextResponse(noBody ? null : upstream.body, {
    status: upstream.status,
    headers,
  });
  if (rotated) setSessionCookies(response, rotated);
  return response;
}

function unauthorized() {
  const response = NextResponse.json(
    { message: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.' },
    { status: 401 },
  );
  clearSessionCookies(response);
  return response;
}

export {
  handler as GET,
  handler as POST,
  handler as PATCH,
  handler as PUT,
  handler as DELETE,
};
