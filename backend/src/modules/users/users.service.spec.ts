import { describe, expect, it, vi } from 'vitest';
import { UsersService } from './users.service.js';
import { UserRole } from './entities/user.entity.js';

describe('UsersService - findAuthState cache', () => {
  const makeService = () => {
    const mockRepo: any = {
      findOne: vi.fn(),
      update: vi.fn().mockResolvedValue({}),
      count: vi.fn(),
    };
    const service = new UsersService(mockRepo);
    return { service, mockRepo };
  };

  it('lưu cache trạng thái người dùng và không gọi lại DB trong thời gian TTL', async () => {
    const { service, mockRepo } = makeService();
    mockRepo.findOne.mockResolvedValueOnce({
      id: 10,
      role: UserRole.STAFF,
      isActive: true,
    });

    const res1 = await service.findAuthState(10);
    const res2 = await service.findAuthState(10);

    expect(res1).toEqual({ id: 10, role: UserRole.STAFF, isActive: true });
    expect(res2).toEqual({ id: 10, role: UserRole.STAFF, isActive: true });
    expect(mockRepo.findOne).toHaveBeenCalledTimes(1);
  });

  it('xóa cache ngay khi gọi invalidateAuthState', async () => {
    const { service, mockRepo } = makeService();
    mockRepo.findOne
      .mockResolvedValueOnce({ id: 10, role: UserRole.STAFF, isActive: true })
      .mockResolvedValueOnce({ id: 10, role: UserRole.ADMIN, isActive: true });

    await service.findAuthState(10);
    service.invalidateAuthState(10);
    const res2 = await service.findAuthState(10);

    expect(res2?.role).toBe(UserRole.ADMIN);
    expect(mockRepo.findOne).toHaveBeenCalledTimes(2);
  });
});
