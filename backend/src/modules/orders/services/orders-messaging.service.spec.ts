import { BadGatewayException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { MessageChannel } from '../messaging/message.types.js';
import { OrdersMessagingService } from './orders-messaging.service.js';

const actor = { sub: 1, username: 'admin', role: 'ADMIN' } as never;

function build(send: ReturnType<typeof vi.fn>) {
  const update = vi.fn().mockResolvedValue(undefined);
  const save = vi.fn().mockResolvedValue(undefined);
  const order = {
    id: 7,
    phone: '0912345678',
    customerName: 'Khách A',
    departureDate: '2026-10-20',
    departureTime: '08:00',
    seatCount: 2,
    seatFront: 0,
    seatMiddle: 0,
    seatBack: 0,
    pickupPoint: null,
    dropoffPoint: null,
    route: { name: 'Hà Nội - Hạ Long' },
  };
  const service = new OrdersMessagingService(
    { update } as never,
    { save, create: (x: unknown) => x } as never,
    { findOne: vi.fn().mockResolvedValue({ id: 1, fullName: 'Admin' }) } as never,
    { send } as never,
    {
      findEntity: vi.fn().mockResolvedValue(order),
      findOne: vi.fn().mockResolvedValue({ id: 7 }),
    } as never,
  );
  return { service, update, save };
}

describe('OrdersMessagingService.sendMessage - Zalo lỗi thì tự gửi SMS', () => {
  it('Zalo gửi được thì không gửi SMS', async () => {
    const send = vi.fn().mockResolvedValue({ dryRun: false, referentId: 'z1' });
    const { service, update } = build(send);
    const res = await service.sendMessage(7, MessageChannel.ZALO, actor);
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][0]).toBe(MessageChannel.ZALO);
    expect(res.fallbackReason).toBeNull();
    expect(update.mock.calls[0][1].messageChannel).toBe(MessageChannel.ZALO);
  });

  it('Zalo lỗi thì gửi SMS thay và ghi kênh SMS', async () => {
    const send = vi
      .fn()
      .mockRejectedValueOnce(new BadGatewayException('Gửi Zalo thất bại (mã -118): số điện thoại này không có Zalo.'))
      .mockResolvedValueOnce({ dryRun: false, referentId: 's1' });
    const { service, update, save } = build(send);
    const res = await service.sendMessage(7, MessageChannel.ZALO, actor);
    expect(send).toHaveBeenCalledTimes(2);
    expect(send.mock.calls[1][0]).toBe(MessageChannel.SMS);
    expect(res.channel).toBe(MessageChannel.SMS);
    expect(res.fallbackReason).toContain('không có Zalo');
    expect(update.mock.calls[0][1]).toMatchObject({
      smsSent: true,
      messageChannel: MessageChannel.SMS,
      messageRefId: 's1',
    });
    expect(save.mock.calls[0][0].summary).toContain('đã tự gửi SMS');
  });

  it('Zalo lỗi và SMS cũng lỗi thì báo lỗi, không đánh dấu đã gửi', async () => {
    const send = vi
      .fn()
      .mockRejectedValueOnce(new BadGatewayException('Zalo hỏng'))
      .mockRejectedValueOnce(new BadGatewayException('SMS hỏng'));
    const { service, update } = build(send);
    await expect(service.sendMessage(7, MessageChannel.ZALO, actor)).rejects.toThrow(/Zalo hỏng.*SMS hỏng/);
    expect(update).not.toHaveBeenCalled();
  });

  it('chọn SMS mà lỗi thì báo lỗi luôn, không đổi kênh', async () => {
    const send = vi.fn().mockRejectedValue(new BadGatewayException('SMS hỏng'));
    const { service } = build(send);
    await expect(service.sendMessage(7, MessageChannel.SMS, actor)).rejects.toThrow('SMS hỏng');
    expect(send).toHaveBeenCalledTimes(1);
  });
});
