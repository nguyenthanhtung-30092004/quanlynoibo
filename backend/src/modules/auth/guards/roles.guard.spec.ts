import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard.js';
import { UserRole } from '../../users/entities/user.entity.js';

function ctx(user: any) {
  return {
    getHandler: () => ctx,
    getClass: () => RolesGuard,
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as any;
}

describe('RolesGuard', () => {
  const make = (meta: { isPublic?: boolean; roles?: UserRole[] }) => {
    const reflector = {
      getAllAndOverride: (key: string) =>
        key === 'isPublic' ? meta.isPublic : meta.roles,
    } as unknown as Reflector;
    return new RolesGuard(reflector);
  };

  it('cho qua route không yêu cầu vai trò', () => {
    expect(make({}).canActivate(ctx({ role: UserRole.STAFF }))).toBe(true);
  });

  it('cho qua route public', () => {
    expect(
      make({ isPublic: true, roles: [UserRole.ADMIN] }).canActivate(ctx(undefined)),
    ).toBe(true);
  });

  it('Staff bị chặn ở route ADMIN', () => {
    expect(() =>
      make({ roles: [UserRole.ADMIN] }).canActivate(ctx({ role: UserRole.STAFF })),
    ).toThrow(ForbiddenException);
  });

  it('Admin được qua mọi route yêu cầu vai trò', () => {
    expect(
      make({ roles: [UserRole.STAFF] }).canActivate(ctx({ role: UserRole.ADMIN })),
    ).toBe(true);
  });
});
