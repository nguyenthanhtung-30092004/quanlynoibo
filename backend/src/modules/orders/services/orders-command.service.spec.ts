import { BadRequestException } from '@nestjs/common';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { UserRole } from '../../users/entities/user.entity.js';
import { CabinKind } from '../entities/order.entity.js';
import { getBusinessDate } from '../order-time-lock.js';
import { OrdersCommandService } from './orders-command.service.js';

const admin = { sub: 1, username: 'admin', role: UserRole.ADMIN } as never;
const staff = { sub: 2, username: 'nv', role: UserRole.STAFF } as never;

/** 10:00 giờ Việt Nam: trong khung nhân viên được tạo đơn, tránh test phụ thuộc giờ chạy thật */
const freezeAtMorning = () => vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-10-21T03:00:00Z') });

/** Ngày khởi hành xa trong tương lai để không vướng chặn ngày đã qua */
const FUTURE = '2099-01-01';

function build(existing?: Record<string, unknown>) {
  const saved: Record<string, unknown>[] = [];
  const updates: Record<string, unknown>[] = [];
  const orderRepository = {
    create: (v: Record<string, unknown>) => v,
    save: async (v: Record<string, unknown>) => {
      saved.push(v);
      return { id: 1, ...v };
    },
    update: async (_id: number, v: Record<string, unknown>) => {
      updates.push(v);
    },
  };
  const service = new OrdersCommandService(
    orderRepository as never,
    { save: async (v: unknown) => v, create: (v: unknown) => v } as never,
    { findOne: async () => ({ id: 1, fullName: 'Admin' }) } as never,
    { findOne: async () => ({ id: 1, isActive: true, name: 'Tuyến' }) } as never,
    {} as never,
    {
      getCachedPartners: async () => [],
      findOne: async () => ({ id: 1 }),
      findEntity: async () => existing,
    } as never,
    { clearCache: () => undefined } as never,
    { clearCache: () => undefined } as never,
  );
  return { service, saved, updates };
}

const baseDto = {
  phone: '0912345678',
  routeId: 1,
  departureTime: '08:00',
  departureDate: FUTURE,
};

const lines = [
  { kind: CabinKind.SINGLE, quantity: 2, costPrice: 800_000, sellPrice: 1_000_000 },
  { kind: CabinKind.DOUBLE, quantity: 1, costPrice: 700_000, sellPrice: 900_000 },
  { kind: CabinKind.SINGLE_FLOOR1, quantity: 3, costPrice: 500_000, sellPrice: 650_000 },
];

describe('tạo đơn xe cabin', () => {
  it('server tự tính số ghế và tổng tiền từ các dòng, bỏ qua số client gửi sai', async () => {
    const { service, saved } = build();
    await service.create(
      {
        ...baseDto,
        vehicleType: 'Xe Cabin',
        cabinLines: lines,
        seatCount: 99,
        costPrice: 1,
        sellPrice: 2,
        seatFront: 5,
      } as never,
      admin,
    );
    expect(saved[0]).toMatchObject({
      seatCount: 6,
      seatFront: 0,
      seatMiddle: 0,
      seatBack: 0,
      costPrice: 3_800_000,
      sellPrice: 4_850_000,
    });
    // dòng được lưu theo thứ tự cố định: đơn, đơn tầng 1, đôi
    expect((saved[0].cabinLines as { kind: string }[]).map((l) => l.kind)).toEqual([
      'SINGLE',
      'SINGLE_FLOOR1',
      'DOUBLE',
    ]);
  });

  it('từ chối: thiếu dòng cabin, trùng loại, hoặc dòng cabin gắn vào loại hình khác', async () => {
    const { service } = build();
    await expect(
      service.create({ ...baseDto, vehicleType: 'Xe Cabin' } as never, admin),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.create(
        { ...baseDto, vehicleType: 'Xe Cabin', cabinLines: [lines[0], lines[0]] } as never,
        admin,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.create(
        { ...baseDto, vehicleType: 'Xe Limousine', cabinLines: lines } as never,
        admin,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('từ chối khi tổng tiền vượt giới hạn cột 2 tỷ', async () => {
    const { service } = build();
    await expect(
      service.create(
        {
          ...baseDto,
          vehicleType: 'Xe Cabin',
          cabinLines: [
            { kind: CabinKind.SINGLE, quantity: 60, costPrice: 0, sellPrice: 2_000_000_000 },
          ],
        } as never,
        admin,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('tạo đơn gửi hàng', () => {
  const goods = { goodsType: '  Mỹ phẩm ', quantity: 3, weightKg: 12.5, receiverName: 'nguyễn an', receiverPhone: ' 0900000000 ' };

  it('lưu chi tiết hàng hóa đã chuẩn hóa, không có ghế, cước phí là giá bán và hoa hồng giữ nguyên', async () => {
    const { service, saved } = build();
    await service.create(
      {
        ...baseDto,
        vehicleType: 'Gửi Hàng',
        goods,
        seatCount: 9,
        seatFront: 2,
        sellPrice: 150_000,
        commission: 15_000,
      } as never,
      admin,
    );
    expect(saved[0]).toMatchObject({
      seatCount: 0,
      seatFront: 0,
      seatMiddle: 0,
      seatBack: 0,
      sellPrice: 150_000,
      commission: 15_000,
      cabinLines: null,
      vehicleCount: 0,
      goods: { goodsType: 'Mỹ phẩm', quantity: 3, weightKg: 12.5, receiverName: 'Nguyễn An', receiverPhone: '0900000000' },
    });
  });

  it('từ chối: thiếu hoặc số lượng hàng bằng 0, hoặc gắn chi tiết hàng vào loại hình khác', async () => {
    const { service } = build();
    await expect(
      service.create({ ...baseDto, vehicleType: 'Gửi Hàng' } as never, admin),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.create({ ...baseDto, vehicleType: 'Gửi Hàng', goods: { ...goods, quantity: 0 } } as never, admin),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.create({ ...baseDto, vehicleType: 'Xe Limousine', seatCount: 1, goods } as never, admin),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('đổi đơn gửi hàng sang loại hình khác thì xóa chi tiết hàng hóa', async () => {
    const existing = {
      id: 1,
      cancelledAt: null,
      departureDate: FUTURE,
      departureTime: '08:00',
      routeId: 1,
      vehicleType: 'Gửi Hàng',
      goods: { goodsType: 'Mỹ phẩm', quantity: 3, weightKg: 0, receiverName: '', receiverPhone: '' },
      cabinLines: null,
      vehicleCount: 0,
      seatFront: 0,
      seatMiddle: 0,
      seatBack: 0,
      seatCount: 0,
      seatZone: null,
      costPrice: 0,
      sellPrice: 150_000,
      deposit: 0,
      collectOnDelivery: 0,
      commission: 0,
      customerName: 'Khách',
      phone: '0912345678',
      partner: null,
      pickupPoint: null,
      dropoffPoint: null,
      note: null,
      route: { name: 'Tuyến' },
    };
    const { service, updates } = build(existing);
    await service.update(1, { vehicleType: 'Xe Limousine', seatCount: 2 } as never, admin);
    expect(updates[0]).toMatchObject({ vehicleType: 'Xe Limousine', goods: null, seatCount: 2 });
  });
});

describe('tạo đơn xe riêng và đơn thường', () => {
  it('xe riêng: lưu số xe, số ghế bằng 0, giữ nguyên giá nhập giá bán nhập tay', async () => {
    const { service, saved } = build();
    await service.create(
      {
        ...baseDto,
        vehicleType: 'Xe Riêng',
        vehicleCount: 2,
        seatCount: 7,
        seatFront: 3,
        costPrice: 800_000,
        sellPrice: 1_000_000,
      } as never,
      admin,
    );
    expect(saved[0]).toMatchObject({
      vehicleCount: 2,
      seatCount: 0,
      seatFront: 0,
      costPrice: 800_000,
      sellPrice: 1_000_000,
      cabinLines: null,
    });
  });

  it('xe riêng phải có số xe; số xe không lưu cho loại hình khác', async () => {
    const { service, saved } = build();
    await expect(
      service.create({ ...baseDto, vehicleType: 'Xe Riêng' } as never, admin),
    ).rejects.toBeInstanceOf(BadRequestException);
    await service.create(
      { ...baseDto, vehicleType: 'Xe Limousine', vehicleCount: 4, seatCount: 2 } as never,
      admin,
    );
    expect(saved[0]).toMatchObject({ vehicleCount: 0, seatCount: 2, cabinLines: null });
  });

  it('đơn thường vẫn bắt buộc có ghế', async () => {
    const { service } = build();
    await expect(
      service.create(
        { ...baseDto, vehicleType: 'Xe Limousine', seatCount: 0 } as never,
        admin,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('giờ đi trong ngày hôm nay', () => {
  afterEach(() => vi.useRealTimers());

  it('nhân viên: hôm nay mà giờ đi đã qua hoặc ngày đã qua thì bị từ chối, giờ sắp tới thì được', async () => {
    freezeAtMorning();
    const today = getBusinessDate();
    const { service, saved } = build();
    await expect(
      service.create(
        { ...baseDto, departureDate: today, departureTime: '00:00', vehicleType: 'Xe Limousine', seatCount: 1 } as never,
        staff,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.create(
        { ...baseDto, departureDate: '2000-01-01', vehicleType: 'Xe Limousine', seatCount: 1 } as never,
        staff,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    await service.create(
      { ...baseDto, departureDate: today, departureTime: '23:59', vehicleType: 'Xe Limousine', seatCount: 1 } as never,
      staff,
    );
    expect(saved).toHaveLength(1);
  });

  it('Admin được tạo vé cho giờ đã qua của hôm nay nhưng không được tạo cho ngày đã qua', async () => {
    freezeAtMorning();
    const { service, saved } = build();
    await service.create(
      { ...baseDto, departureDate: getBusinessDate(), departureTime: '00:00', vehicleType: 'Xe Limousine', seatCount: 1 } as never,
      admin,
    );
    expect(saved).toHaveLength(1);
    await expect(
      service.create(
        { ...baseDto, departureDate: '2000-01-01', departureTime: '00:00', vehicleType: 'Xe Limousine', seatCount: 1 } as never,
        admin,
      ),
    ).rejects.toThrow('Không thể tạo vé cho ngày đã qua.');
    expect(saved).toHaveLength(1);
  });
});

describe('sửa đơn', () => {
  const cabinOrder = {
    id: 1,
    routeId: 1,
    phone: '0912345678',
    customerName: 'Khách',
    departureTime: '08:00',
    departureDate: FUTURE,
    partner: null,
    vehicleType: 'Xe Cabin',
    vehicleCount: 0,
    cabinLines: lines,
    seatFront: 0,
    seatMiddle: 0,
    seatBack: 0,
    seatZone: null,
    seatCount: 6,
    costPrice: 3_800_000,
    sellPrice: 4_850_000,
    deposit: 0,
    collectOnDelivery: 0,
    commission: 1_050_000,
    pickupPoint: null,
    dropoffPoint: null,
    note: null,
    cancelledAt: null,
    route: { name: 'Tuyến' },
  };

  it('đổi giá một dòng cabin thì tổng đơn tính lại đúng', async () => {
    const { service, updates } = build(cabinOrder);
    await service.update(
      1,
      {
        vehicleType: 'Xe Cabin',
        cabinLines: [{ ...lines[0], sellPrice: 1_100_000 }, lines[1], lines[2]],
      } as never,
      admin,
    );
    // chỉ cabin đơn tăng 100k x 2
    expect(updates[0]).toMatchObject({ seatCount: 6, costPrice: 3_800_000, sellPrice: 5_050_000 });
  });

  it('sửa trường khác (không gửi dòng cabin) thì giữ nguyên dòng và tổng', async () => {
    const { service, updates } = build(cabinOrder);
    await service.update(1, { note: 'ghi chú mới' } as never, admin);
    expect(updates[0]).toMatchObject({ seatCount: 6, costPrice: 3_800_000, sellPrice: 4_850_000 });
    expect((updates[0].cabinLines as unknown[]).length).toBe(3);
  });

  it('không đổi vé sang ngày đã qua (kể cả Admin), nhưng vé cũ có ngày đã qua vẫn sửa được trường khác', async () => {
    const { service, updates } = build(cabinOrder);
    await expect(service.update(1, { departureDate: '2000-01-01' } as never, admin)).rejects.toThrow(
      'Không thể đổi vé sang ngày đã qua.',
    );
    expect(updates).toHaveLength(0);

    const old = build({ ...cabinOrder, departureDate: '2000-01-01' });
    await old.service.update(1, { note: 'sửa ghi chú', departureDate: '2000-01-01' } as never, admin);
    expect(old.updates).toHaveLength(1);
  });

  it('đổi sang loại hình khác thì xóa dòng cabin và dùng số ghế/giá gửi lên', async () => {
    const { service, updates } = build(cabinOrder);
    await service.update(
      1,
      { vehicleType: 'Xe Limousine', seatCount: 2, costPrice: 300_000, sellPrice: 400_000 } as never,
      admin,
    );
    expect(updates[0]).toMatchObject({
      cabinLines: null,
      seatCount: 2,
      costPrice: 300_000,
      sellPrice: 400_000,
    });
  });
});
