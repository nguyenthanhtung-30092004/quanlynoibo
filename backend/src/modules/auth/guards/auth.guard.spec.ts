import { UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from './auth.guard.js';
import { UserRole } from '../../users/entities/user.entity.js';

function ctx(authorization?: string) {
  const request: any = { headers: { authorization } };
  return {
    request,
    context: {
      getHandler: () => ctx,
      getClass: () => AuthGuard,
      switchToHttp: () => ({ getRequest: () => request }),
    } as any,
  };
}

describe('AuthGuard', () => {
  const make = (opts: { isPublic?: boolean; account?: any; verifyFails?: boolean }) => {
    const reflector = { getAllAndOverride: () => opts.isPublic } as any;
    const jwt = {
      verifyAsync: async () => {
        if (opts.verifyFails) throw new Error('bad');
        return { sub: 7, username: 'u', role: UserRole.STAFF };
      },
    } as any;
    const config = { getOrThrow: () => 'secret' } as any;
    const users = { findAuthState: async () => opts.account } as any;
    return new AuthGuard(jwt, reflector, config, users);
  };

  it('cho qua route public', async () => {
    const { context } = ctx();
    expect(await make({ isPublic: true }).canActivate(context)).toBe(true);
  });

  it('từ chối khi không có token', async () => {
    const { context } = ctx();
    await expect(make({}).canActivate(context)).rejects.toThrow(UnauthorizedException);
  });

  it('từ chối token sai chữ ký', async () => {
    const { context } = ctx('Bearer x');
    await expect(make({ verifyFails: true }).canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('từ chối token hợp lệ nhưng tài khoản đã bị xóa', async () => {
    const { context } = ctx('Bearer x');
    await expect(make({ account: null }).canActivate(context)).rejects.toThrow(
      'không tồn tại',
    );
  });

  it('từ chối tài khoản bị khóa', async () => {
    const { context } = ctx('Bearer x');
    await expect(
      make({ account: { id: 7, role: UserRole.STAFF, isActive: false } }).canActivate(context),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('dùng vai trò hiện tại trong DB thay vì vai trò trong token', async () => {
    const { context, request } = ctx('Bearer x');
    await make({
      account: { id: 7, role: UserRole.ADMIN, isActive: true },
    }).canActivate(context);
    expect(request.user.role).toBe(UserRole.ADMIN);
  });
});
