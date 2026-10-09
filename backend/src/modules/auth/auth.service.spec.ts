import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service.js';
import { UserRole } from '../users/entities/user.entity.js';

const config = {
  'auth.jwtSecret': 'access-secret',
  'auth.jwtExpiresIn': '1h',
  'auth.jwtRefreshSecret': 'refresh-secret',
  'auth.jwtRefreshExpiresIn': '7d',
};

describe('AuthService', () => {
  let service: AuthService;
  let users: Record<string, ReturnType<typeof vi.fn>>;
  let storedHash: string | null;

  const makeUser = async (overrides = {}) => ({
    id: 1,
    username: 'admin',
    passwordHash: await bcrypt.hash('secret123', 4),
    fullName: 'Admin',
    role: UserRole.ADMIN,
    isActive: true,
    refreshTokenHash: null as string | null,
    ...overrides,
  });

  beforeEach(() => {
    storedHash = null;
    users = {
      findByUsernameWithSecrets: vi.fn(),
      findByIdWithSecrets: vi.fn(),
      markLoggedIn: vi.fn(async (_id, hash) => void (storedHash = hash)),
      setRefreshTokenHash: vi.fn(async (_id, hash) => void (storedHash = hash)),
      count: vi.fn(),
      create: vi.fn(async (dto) => dto),
    };
    service = new AuthService(
      users as any,
      new JwtService(),
      { getOrThrow: (k: string) => (config as any)[k] } as unknown as ConfigService,
    );
  });

  it('login thành công trả token và không lộ passwordHash', async () => {
    users.findByUsernameWithSecrets.mockResolvedValue(await makeUser());
    const res = await service.login({ username: 'admin', password: 'secret123' });
    expect(res.accessToken).toBeTruthy();
    expect(res.refreshToken).toBeTruthy();
    expect(res.user).not.toHaveProperty('passwordHash');
    expect(res.user).not.toHaveProperty('refreshTokenHash');
  });

  it('login sai mật khẩu hoặc sai username cùng một thông báo', async () => {
    users.findByUsernameWithSecrets.mockResolvedValue(await makeUser());
    await expect(
      service.login({ username: 'admin', password: 'wrong' }),
    ).rejects.toThrow(UnauthorizedException);
    users.findByUsernameWithSecrets.mockResolvedValue(null);
    await expect(
      service.login({ username: 'nobody', password: 'x' }),
    ).rejects.toThrow('Tên đăng nhập hoặc mật khẩu không chính xác.');
  });

  it('login từ chối tài khoản bị khóa', async () => {
    users.findByUsernameWithSecrets.mockResolvedValue(
      await makeUser({ isActive: false }),
    );
    await expect(
      service.login({ username: 'admin', password: 'secret123' }),
    ).rejects.toThrow('khóa');
  });

  it('refresh xoay vòng token; token cũ bị vô hiệu', async () => {
    const user = await makeUser();
    users.findByUsernameWithSecrets.mockResolvedValue(user);
    users.findByIdWithSecrets.mockImplementation(async () => ({
      ...user,
      refreshTokenHash: storedHash,
    }));

    const first = await service.login({ username: 'admin', password: 'secret123' });
    const second = await service.refresh(first.refreshToken);
    expect(second.refreshToken).not.toBe(first.refreshToken);
    await expect(service.refresh(first.refreshToken)).rejects.toThrow(
      UnauthorizedException,
    );
    await expect(service.refresh(second.refreshToken)).resolves.toBeTruthy();
  });

  it('refresh từ chối token rác và access token', async () => {
    const user = await makeUser();
    users.findByUsernameWithSecrets.mockResolvedValue(user);
    const { accessToken } = await service.login({
      username: 'admin',
      password: 'secret123',
    });
    await expect(service.refresh('garbage')).rejects.toThrow(UnauthorizedException);
    await expect(service.refresh(accessToken)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('register chỉ cho phép khi chưa có user nào', async () => {
    users.count.mockResolvedValue(1);
    await expect(
      service.register({ username: 'a', password: '123456', fullName: 'A' }),
    ).rejects.toThrow(ForbiddenException);

    users.count.mockResolvedValue(0);
    await service.register({ username: 'admin', password: '123456', fullName: 'A' });
    expect(users.create).toHaveBeenCalledWith(
      expect.objectContaining({ role: UserRole.ADMIN }),
    );
  });
});
