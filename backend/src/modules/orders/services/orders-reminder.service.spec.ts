import { BadGatewayException, ServiceUnavailableException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { isReminderDue } from '../order-time-lock.js';
import { PaymentRequiredException } from '../messaging/message.types.js';
import { isCustomerSpecificFailure, OrdersReminderService } from './orders-reminder.service.js';

// 08:00 giờ VN ngày 2026-11-03 = 01:00 UTC
const dep = { date: '2026-11-03', time: '08:00' };
const at = (hhmmVn: string) => new Date(`2026-11-03T${hhmmVn}:00+07:00`);

describe('isReminderDue - khung nhắc 1,5 tiếng trước giờ đi', () => {
  it('chưa tới 1,5 tiếng thì chưa nhắc', () => {
    expect(isReminderDue(dep.date, dep.time, at('06:29'))).toBe(false);
  });
  it('đúng 1,5 tiếng trước thì nhắc', () => {
    expect(isReminderDue(dep.date, dep.time, at('06:30'))).toBe(true);
    expect(isReminderDue(dep.date, dep.time, at('07:45'))).toBe(true);
  });
  it('xe đã khởi hành thì không nhắc', () => {
    expect(isReminderDue(dep.date, dep.time, at('08:00'))).toBe(false);
    expect(isReminderDue(dep.date, dep.time, at('09:00'))).toBe(false);
  });
  it('chuyến 00:30 sáng mai nhắc từ 23:00 tối nay', () => {
    expect(isReminderDue('2026-11-04', '00:30', at('22:59'))).toBe(false);
    expect(isReminderDue('2026-11-04', '00:30', at('23:00'))).toBe(true);
  });
});

describe('isCustomerSpecificFailure', () => {
  it('số không có Zalo (mã -118) là lỗi riêng của khách', () => {
    expect(isCustomerSpecificFailure(new BadGatewayException('Gửi Zalo thất bại (mã -118): số điện thoại này không có Zalo.'))).toBe(true);
  });
  it('token hết hạn, hết tiền, mất mạng, chưa cấu hình là lỗi chung', () => {
    expect(isCustomerSpecificFailure(new BadGatewayException('Gửi Zalo thất bại (mã -124): access token không hợp lệ hoặc đã hết hạn.'))).toBe(false);
    expect(isCustomerSpecificFailure(new PaymentRequiredException('Tài khoản Zalo ZNS đã hết tiền'))).toBe(false);
    expect(isCustomerSpecificFailure(new BadGatewayException('Không kết nối được Zalo. Vui lòng thử lại sau.'))).toBe(false);
    expect(isCustomerSpecificFailure(new ServiceUnavailableException('Chưa cấu hình gửi Zalo'))).toBe(false);
  });
});

function order(id: number, over: Record<string, unknown> = {}) {
  return {
    id,
    phone: '0912345678',
    customerName: 'Khách A',
    routeId: 1,
    route: { name: 'Hà Nội - Hạ Long' },
    departureDate: dep.date,
    departureTime: dep.time,
    pickupPoint: null,
    dropoffPoint: null,
    ...over,
  };
}

function build(orders: unknown[], send: ReturnType<typeof vi.fn>, ready = true) {
  const update = vi.fn().mockResolvedValue({ affected: 1 });
  const qb: Record<string, unknown> = {};
  for (const m of ['innerJoinAndSelect', 'where', 'andWhere', 'orderBy']) qb[m] = vi.fn().mockReturnValue(qb);
  qb.getMany = vi.fn().mockResolvedValue(orders);
  const service = new OrdersReminderService(
    { createQueryBuilder: () => qb, update } as never,
    { isReminderReady: () => ready, send } as never,
  );
  return { service, update };
}

describe('OrdersReminderService.runOnce', () => {
  it('chưa khai báo mẫu nhắc thì không làm gì', async () => {
    const send = vi.fn();
    const { service } = build([order(1)], send, false);
    expect(await service.runOnce(at('07:10'))).toBe(0);
    expect(send).not.toHaveBeenCalled();
  });

  it('chỉ nhắc vé đã tới khung 1,5 tiếng, dùng mẫu nhắc và SĐT của vé', async () => {
    const send = vi.fn().mockResolvedValue({ dryRun: false });
    const { service } = build(
      [order(1), order(2, { phone: '0988888888', departureTime: '10:00' })],
      send,
    );
    expect(await service.runOnce(at('07:10'))).toBe(1);
    expect(send).toHaveBeenCalledTimes(1);
    const msg = send.mock.calls[0][1];
    expect(msg.phone).toBe('0912345678');
    expect(msg.zaloTemplate).toBe('reminder');
    expect(msg.params).toMatchObject({
      customerName: 'Khách A',
      phone: '0912345678',
      route: 'Hà Nội - Hạ Long',
      departureDate: '03/11/2026',
      bookingCode: 'XV1',
    });
  });

  it('một người có hai vé cùng chuyến chỉ nhận một tin', async () => {
    const send = vi.fn().mockResolvedValue({ dryRun: false });
    const { service } = build([order(1), order(2, { phone: '+84912345678' })], send);
    expect(await service.runOnce(at('07:10'))).toBe(1);
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('số không có Zalo thì ghi lỗi, giữ dấu đã thử và đi tiếp vé khác', async () => {
    const send = vi
      .fn()
      .mockRejectedValueOnce(new BadGatewayException('Gửi Zalo thất bại (mã -118): số điện thoại này không có Zalo.'))
      .mockResolvedValueOnce({ dryRun: false });
    const { service, update } = build([order(1), order(2, { phone: '0977777777' })], send);
    expect(await service.runOnce(at('07:10'))).toBe(1);
    expect(send).toHaveBeenCalledTimes(2);
    expect(update).toHaveBeenCalledWith(1, { reminderError: expect.stringContaining('không có Zalo') });
    expect(update).not.toHaveBeenCalledWith(1, { reminderSentAt: null });
  });

  it('lỗi chung (hết tiền) thì trả lại dấu chưa nhắc và dừng lượt này', async () => {
    const send = vi.fn().mockRejectedValue(new PaymentRequiredException('hết tiền'));
    const { service, update } = build([order(1), order(2, { phone: '0977777777' })], send);
    expect(await service.runOnce(at('07:10'))).toBe(0);
    expect(send).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledWith(1, { reminderSentAt: null });
  });

  it('lần quét khác đã giành vé rồi thì không gửi lại', async () => {
    const send = vi.fn().mockResolvedValue({ dryRun: false });
    const { service, update } = build([order(1)], send);
    update.mockResolvedValueOnce({ affected: 0 });
    expect(await service.runOnce(at('07:10'))).toBe(0);
    expect(send).not.toHaveBeenCalled();
  });
});
