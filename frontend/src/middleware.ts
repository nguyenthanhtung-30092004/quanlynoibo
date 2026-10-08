import { NextResponse, type NextRequest } from 'next/server';

const REFRESH_COOKIE = 'qlnb_rt';

/**
 * Cổng chặn nhanh ở biên: chưa có phiên thì mọi trang đều về /login (vào link
 * là thấy đăng nhập ngay). Đã đăng nhập thì /login và / chuyển vào giao diện
 * chính. Đây chỉ là điều hướng; việc xác thực token thật do backend đảm nhiệm
 * cho từng API.
 */
export function middleware(req: NextRequest) {
  const hasSession = req.cookies.has(REFRESH_COOKIE);
  const { pathname } = req.nextUrl;
  const isLoginPage = pathname === '/login';

  if (!hasSession && !isLoginPage) {
    return NextResponse.redirect(new URL('/login', req.url));
  }
  if (hasSession && (isLoginPage || pathname === '/')) {
    return NextResponse.redirect(new URL('/xvip', req.url));
  }
  return NextResponse.next();
}

export const config = {
  // Bỏ qua API, tài nguyên của Next.js và file tĩnh (có đuôi như .png, .mp3)
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)'],
};
