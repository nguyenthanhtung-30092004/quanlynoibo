import { describe, expect, it } from 'vitest';
import { RealtimeService } from './realtime.service.js';

describe('RealtimeService - Presence tracking', () => {
  it('mở 2 kết nối cùng user rồi đóng 1 vẫn online, đóng nốt thì offline', () => {
    const service = new RealtimeService();
    const userId = 10;

    expect(service.isOnline(userId)).toBe(false);

    // Mở kết nối thứ 1 (tab 1)
    service.addConnection(userId);
    expect(service.isOnline(userId)).toBe(true);
    expect(service.getPresence(userId)?.connections).toBe(1);

    // Mở kết nối thứ 2 (tab 2)
    service.addConnection(userId);
    expect(service.isOnline(userId)).toBe(true);
    expect(service.getPresence(userId)?.connections).toBe(2);

    // Đóng tab 1
    service.removeConnection(userId);
    expect(service.isOnline(userId)).toBe(true);
    expect(service.getPresence(userId)?.connections).toBe(1);

    // Đóng tab 2 (hết kết nối -> offline)
    service.removeConnection(userId);
    expect(service.isOnline(userId)).toBe(false);
    expect(service.getPresence(userId)).toBeUndefined();
  });

  it('phát sự kiện presence khi kết nối thay đổi', () => {
    const service = new RealtimeService();
    const events: unknown[] = [];
    service.stream().subscribe((e) => events.push(e));

    service.addConnection(5);
    service.removeConnection(5);

    expect(events).toEqual([
      { topic: 'presence', actorId: 5 },
      { topic: 'presence', actorId: 5 },
    ]);
  });
});
