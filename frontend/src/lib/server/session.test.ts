import { afterEach, describe, expect, it, vi } from 'vitest';
import { decodeJwtExp, forgetRefreshToken, refreshTokens } from './session';

const jwt = (payload: object) =>
  `h.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.s`;

describe('decodeJwtExp', () => {
  it('đọc exp từ payload', () => {
    expect(decodeJwtExp(jwt({ exp: 1234 }))).toBe(1234);
  });
  it('trả null với token hỏng', () => {
    expect(decodeJwtExp('abc')).toBeNull();
    expect(decodeJwtExp(jwt({}))).toBeNull();
  });
});

describe('refreshTokens', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('request song song dùng chung một lần refresh', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ data: { accessToken: 'A2', refreshToken: 'R2' } }),
    }));
    vi.stubGlobal('fetch', fetchMock);

    const results = await Promise.all([
      refreshTokens('same-refresh'),
      refreshTokens('same-refresh'),
      refreshTokens('same-refresh'),
    ]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(results.every((r) => r?.accessToken === 'A2')).toBe(true);
  });

  it('trả null khi backend từ chối', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false })));
    expect(await refreshTokens('bad-refresh')).toBeNull();
  });
});

describe('forgetRefreshToken', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('sau logout, refresh token cũ không dùng lại được kết quả đã cache', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue({
        ok: true,
        json: async () => ({ data: { accessToken: 'A2', refreshToken: 'R2' } }),
      });
    vi.stubGlobal('fetch', fetchMock);

    await refreshTokens('old-R1');
    await Promise.resolve();
    forgetRefreshToken('R2'); // người dùng đăng xuất bằng cookie mới
    await refreshTokens('old-R1');

    expect(fetchMock).toHaveBeenCalledTimes(2); // phải hỏi backend lại (và bị từ chối)
  });
});
