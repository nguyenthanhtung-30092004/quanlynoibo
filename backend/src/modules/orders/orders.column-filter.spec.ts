import { describe, expect, it, vi } from 'vitest';
import { OrdersService } from './orders.service.js';
import { UserRole } from '../users/entities/user.entity.js';
import type { JwtPayload } from '../auth/decorators/current-user.decorator.js';

describe('OrdersService - column filter logic and columnValues', () => {
  const adminActor: JwtPayload = {
    sub: 1,
    username: 'admin',
    role: UserRole.ADMIN,
  };

  const staffActor: JwtPayload = {
    sub: 2,
    username: 'staff1',
    role: UserRole.STAFF,
  };

  function createMockQb() {
    const qb: any = {
      whereClauses: [] as Array<{ sql: string; params?: any }>,
      selects: [] as string[],
      groupBys: [] as string[],
      orderBys: [] as Array<{ sort: string; order: string }>,
      limitVal: undefined as number | undefined,

      leftJoin: vi.fn().mockReturnThis(),
      addSelect: vi.fn().mockImplementation((sel: any) => {
        qb.selects.push(sel);
        return qb;
      }),
      select: vi.fn().mockImplementation((sel: any, alias?: string) => {
        qb.selects.push(`${sel} AS ${alias}`);
        return qb;
      }),
      andWhere: vi.fn().mockImplementation((sql: string, params?: any) => {
        qb.whereClauses.push({ sql, params });
        return qb;
      }),
      groupBy: vi.fn().mockImplementation((col: string) => {
        qb.groupBys.push(col);
        return qb;
      }),
      addGroupBy: vi.fn().mockImplementation((col: string) => {
        qb.groupBys.push(col);
        return qb;
      }),
      orderBy: vi.fn().mockImplementation((sort: string, order: string) => {
        qb.orderBys.push({ sort, order });
        return qb;
      }),
      addOrderBy: vi.fn().mockImplementation((sort: string, order: string) => {
        qb.orderBys.push({ sort, order });
        return qb;
      }),
      limit: vi.fn().mockImplementation((l: number) => {
        qb.limitVal = l;
        return qb;
      }),
      getRawMany: vi.fn().mockResolvedValue([]),
    };
    return qb;
  }

  function setupService(mockQb: any) {
    const mockOrderRepo: any = {
      createQueryBuilder: vi.fn().mockReturnValue(mockQb),
    };
    const service = new OrdersService(
      mockOrderRepo,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );
    return service;
  }

  it('lọc nhiều khách hàng (khớp hoa thường)', () => {
    const qb = createMockQb();
    const service = setupService(qb);

    (service as any).buildListQuery(
      { customerNames: ['Nguyễn Văn A', 'Trần Văn B'] },
      adminActor,
    );

    const match = qb.whereClauses.find((c: any) =>
      c.sql.includes('LOWER(order.customerName) IN (:...customerNames)'),
    );
    expect(match).toBeDefined();
    expect(match.params.customerNames).toEqual(['nguyễn văn a', 'trần văn b']);
  });

  it('lọc Khách lẻ khớp tên rỗng hoặc null', () => {
    const qb = createMockQb();
    const service = setupService(qb);

    (service as any).buildListQuery(
      { customerNames: ['Khách lẻ'] },
      adminActor,
    );

    const match = qb.whereClauses.find((c: any) =>
      c.sql.includes('order.customerName IS NULL OR order.customerName = \'\''),
    );
    expect(match).toBeDefined();
  });

  it('kết hợp Khách lẻ và tên khách thật', () => {
    const qb = createMockQb();
    const service = setupService(qb);

    (service as any).buildListQuery(
      { customerNames: ['Khách lẻ', 'Nguyễn Văn A'] },
      adminActor,
    );

    const match = qb.whereClauses.find((c: any) =>
      c.sql.includes('order.customerName IS NULL') && c.sql.includes('LOWER(order.customerName) IN (:...realNames)'),
    );
    expect(match).toBeDefined();
    expect(match.params.realNames).toEqual(['nguyễn văn a']);
  });

  it('lọc khoảng giá bán và hoa hồng', () => {
    const qb = createMockQb();
    const service = setupService(qb);

    (service as any).buildListQuery(
      {
        sellPriceMin: 200000,
        sellPriceMax: 500000,
        commissionMin: 30000,
        commissionMax: 100000,
      },
      adminActor,
    );

    expect(qb.whereClauses.some((c: any) => c.sql.includes('order.sellPrice >= :sellPriceMin') && c.params.sellPriceMin === 200000)).toBe(true);
    expect(qb.whereClauses.some((c: any) => c.sql.includes('order.sellPrice <= :sellPriceMax') && c.params.sellPriceMax === 500000)).toBe(true);
    expect(qb.whereClauses.some((c: any) => c.sql.includes('order.commission >= :commissionMin') && c.params.commissionMin === 30000)).toBe(true);
    expect(qb.whereClauses.some((c: any) => c.sql.includes('order.commission <= :commissionMax') && c.params.commissionMax === 100000)).toBe(true);
  });

  it('kết hợp nhiều cột cùng lúc (AND)', () => {
    const qb = createMockQb();
    const service = setupService(qb);

    (service as any).buildListQuery(
      {
        phones: ['0912345678'],
        departureTimes: ['08:30', '09:00'],
        smsStatus: 'sent',
        orderCode: 'XV123',
      },
      adminActor,
    );

    expect(qb.whereClauses.some((c: any) => c.sql.includes('order.phone IN (:...phones)'))).toBe(true);
    expect(qb.whereClauses.some((c: any) => c.sql.includes('order.departureTime IN (:...departureTimes)'))).toBe(true);
    expect(qb.whereClauses.some((c: any) => c.sql.includes('order.smsSent = true'))).toBe(true);
    expect(qb.whereClauses.some((c: any) => c.sql.includes('order.id = :orderCodeId') && c.params.orderCodeId === 123)).toBe(true);
  });

  it('nhân viên thường không đọc được vé người khác qua staffIds (bị khóa bởi uid)', () => {
    const qb = createMockQb();
    const service = setupService(qb);

    (service as any).buildListQuery(
      { staffIds: [99, 100] },
      staffActor, // role: STAFF, sub: 2
    );

    // Nhân viên thường không được áp staffIds, mà luôn bị ép createdById = uid
    const staffIdsClause = qb.whereClauses.find((c: any) => c.sql.includes('order.createdById IN (:...staffIds)'));
    expect(staffIdsClause).toBeUndefined();

    const uidClause = qb.whereClauses.find((c: any) => c.sql.includes('order.createdById = :uid'));
    expect(uidClause).toBeDefined();
    expect(uidClause.params.uid).toBe(2);
  });

  it('columnValues áp dụng buildListQuery để tôn trọng quyền nhân viên thường', async () => {
    const qb = createMockQb();
    qb.getRawMany.mockResolvedValue([
      { val: '0912345678', cnt: '5' },
    ]);
    const service = setupService(qb);

    const result = await service.columnValues('phone', undefined, {}, staffActor);

    // Kiểm tra nhân viên thường bị lọc createdById = uid
    const uidClause = qb.whereClauses.find((c: any) => c.sql.includes('order.createdById = :uid'));
    expect(uidClause).toBeDefined();
    expect(uidClause.params.uid).toBe(2);

    expect(result).toEqual([
      { value: '0912345678', label: '0912345678', count: 5 },
    ]);
  });

  it('lọc deposits=0 ra đơn cọc 0đ', () => {
    const qb = createMockQb();
    const service = setupService(qb);

    (service as any).buildListQuery(
      { deposits: [0] },
      adminActor,
    );

    const match = qb.whereClauses.find((c: any) =>
      c.sql.includes('order.deposit IN (:...deposits)'),
    );
    expect(match).toBeDefined();
    expect(match.params.deposits).toEqual([0]);
  });

  it('deposits=200000,500000 là OR, kết hợp với sellPrices là AND', () => {
    const qb = createMockQb();
    const service = setupService(qb);

    (service as any).buildListQuery(
      { deposits: [200000, 500000], sellPrices: [300000, 400000], commissions: [50000] },
      adminActor,
    );

    const depositClause = qb.whereClauses.find((c: any) =>
      c.sql.includes('order.deposit IN (:...deposits)'),
    );
    expect(depositClause).toBeDefined();
    expect(depositClause.params.deposits).toEqual([200000, 500000]);

    const sellPriceClause = qb.whereClauses.find((c: any) =>
      c.sql.includes('order.sellPrice IN (:...sellPrices)'),
    );
    expect(sellPriceClause).toBeDefined();
    expect(sellPriceClause.params.sellPrices).toEqual([300000, 400000]);

    const commissionClause = qb.whereClauses.find((c: any) =>
      c.sql.includes('order.commission IN (:...commissions)'),
    );
    expect(commissionClause).toBeDefined();
    expect(commissionClause.params.commissions).toEqual([50000]);
  });

  it('columnValues(deposit) sắp tăng dần và có mức 0 với nhãn 0đ', async () => {
    const qb = createMockQb();
    qb.getRawMany.mockResolvedValue([
      { val: 0, cnt: '3' },
      { val: 200000, cnt: '5' },
    ]);
    const service = setupService(qb);

    const result = await service.columnValues('deposit', undefined, {}, adminActor);

    expect(qb.orderBys).toEqual([{ sort: 'order.deposit', order: 'ASC' }]);
    expect(result).toEqual([
      { value: '0', label: '0đ', count: 3 },
      { value: '200000', label: '200.000đ', count: 5 },
    ]);
  });

  it('nhân viên thường không thấy giá trị vé người khác khi gọi columnValues(deposit)', async () => {
    const qb = createMockQb();
    qb.getRawMany.mockResolvedValue([]);
    const service = setupService(qb);

    await service.columnValues('deposit', undefined, {}, staffActor);

    const uidClause = qb.whereClauses.find((c: any) => c.sql.includes('order.createdById = :uid'));
    expect(uidClause).toBeDefined();
    expect(uidClause.params.uid).toBe(2);
  });

  it('lọc partners gồm XVIP và nhà xe khác', () => {
    const qb = createMockQb();
    const service = setupService(qb);

    (service as any).buildListQuery(
      { partners: ['XVIP', 'Sao Việt'] },
      adminActor,
    );

    const match = qb.whereClauses.find((c: any) =>
      c.sql.includes('LOWER(order.partner) IN (:...partners)') &&
      c.sql.includes('order.partner IS NULL'),
    );
    expect(match).toBeDefined();
    expect(match.params.partners).toEqual(['sao việt']);
  });

  it('Admin lọc nhiều staffIds', () => {
    const qb = createMockQb();
    const service = setupService(qb);

    (service as any).buildListQuery(
      { staffIds: [1, 2, 3] },
      adminActor,
    );

    const match = qb.whereClauses.find((c: any) =>
      c.sql.includes('order.createdById IN (:...staffIds)'),
    );
    expect(match).toBeDefined();
    expect(match.params.staffIds).toEqual([1, 2, 3]);
  });

  it('lọc messageStates từng giá trị (sms, zalo, unsent)', () => {
    const qb = createMockQb();
    const service = setupService(qb);

    (service as any).buildListQuery({ messageStates: ['sms'] }, adminActor);
    expect(
      qb.whereClauses.some((c: any) =>
        c.sql.includes("order.smsSent = true AND (order.messageChannel = 'SMS' OR order.messageChannel IS NULL)"),
      ),
    ).toBe(true);

    const qb2 = createMockQb();
    const service2 = setupService(qb2);
    (service2 as any).buildListQuery({ messageStates: ['zalo'] }, adminActor);
    expect(
      qb2.whereClauses.some((c: any) =>
        c.sql.includes("order.smsSent = true AND order.messageChannel = 'ZALO'"),
      ),
    ).toBe(true);

    const qb3 = createMockQb();
    const service3 = setupService(qb3);
    (service3 as any).buildListQuery({ messageStates: ['unsent'] }, adminActor);
    expect(
      qb3.whereClauses.some((c: any) =>
        c.sql.includes('order.smsSent = false OR order.smsSent IS NULL'),
      ),
    ).toBe(true);
  });

  it('lọc tổ hợp messageStates (sms, unsent) kết hợp bằng OR', () => {
    const qb = createMockQb();
    const service = setupService(qb);

    (service as any).buildListQuery({ messageStates: ['sms', 'unsent'] }, adminActor);

    const match = qb.whereClauses.find((c: any) =>
      c.sql.includes("order.smsSent = true AND (order.messageChannel = 'SMS' OR order.messageChannel IS NULL)") &&
      c.sql.includes('order.smsSent = false OR order.smsSent IS NULL') &&
      c.sql.includes(' OR '),
    );
    expect(match).toBeDefined();
  });

  it('kết hợp messageStates và smsStatus tạo AND', () => {
    const qb = createMockQb();
    const service = setupService(qb);

    (service as any).buildListQuery(
      { messageStates: ['sms', 'zalo'], smsStatus: 'sent' },
      adminActor,
    );

    const hasSmsStatus = qb.whereClauses.some((c: any) => c.sql === 'order.smsSent = true');
    const hasMessageStates = qb.whereClauses.some((c: any) =>
      c.sql.includes("order.smsSent = true AND (order.messageChannel = 'SMS' OR order.messageChannel IS NULL)") &&
      c.sql.includes("order.smsSent = true AND order.messageChannel = 'ZALO'"),
    );
    expect(hasSmsStatus).toBe(true);
    expect(hasMessageStates).toBe(true);
  });

  it("columnValues('message') trả đủ 3 trạng thái cố định kèm count kể cả khi bằng 0", async () => {
    const qb = createMockQb();
    qb.getRawMany.mockResolvedValue([
      { val: 'sms', cnt: '8' },
      { val: 'zalo', cnt: '2' },
    ]);
    const service = setupService(qb);

    const result = await service.columnValues('message', undefined, {}, adminActor);

    expect(result).toEqual([
      { value: 'sms', label: 'Đã gửi SMS', count: 8 },
      { value: 'zalo', label: 'Đã gửi Zalo', count: 2 },
      { value: 'unsent', label: 'Chưa gửi', count: 0 },
    ]);
  });

  it("columnValues('message') lọc theo q", async () => {
    const qb = createMockQb();
    qb.getRawMany.mockResolvedValue([
      { val: 'sms', cnt: '8' },
      { val: 'zalo', cnt: '2' },
      { val: 'unsent', cnt: '5' },
    ]);
    const service = setupService(qb);

    const result = await service.columnValues('message', 'Zalo', {}, adminActor);

    expect(result).toEqual([
      { value: 'zalo', label: 'Đã gửi Zalo', count: 2 },
    ]);
  });
});
