import { describe, expect, it, vi } from 'vitest';
import { OrdersImportService } from './services/orders-import.service.js';
import type { JwtPayload } from '../auth/decorators/current-user.decorator.js';
import { UserRole } from '../users/entities/user.entity.js';
import * as parser from './order-import.parser.js';

describe('OrdersImportService', () => {
  const adminActor: JwtPayload = {
    sub: 1,
    username: 'admin',
    role: UserRole.ADMIN,
  };

  it('should process valid rows and detect duplicate rows in bulk', async () => {
    // Mock parseOrderWorkbook
    vi.spyOn(parser, 'parseOrderWorkbook').mockResolvedValue([
      {
        rowNumber: 2,
        cancelled: false,
        entryDate: '2026-10-15',
        staffName: 'admin',
        customerName: 'Nguyễn Văn A',
        phone: '0912345678',
        routeName: 'Hà Nội - Hải Phòng',
        departureTime: '08:00',
        departureDate: '2026-10-16',
        vehicleType: 'Limousine',
        seatCount: 1,
        seatFront: 1,
        seatMiddle: 0,
        seatBack: 0,
        costPrice: 200000,
        sellPrice: 250000,
        deposit: 0,
        collectOnDelivery: 250000,
        commission: 50000,
        partner: 'XVIP',
        pickupPoint: 'Điểm A',
        dropoffPoint: 'Điểm B',
        note: '',
        errors: [],
      },
      {
        rowNumber: 3,
        cancelled: false,
        entryDate: '2026-10-15',
        staffName: 'admin',
        customerName: 'Trần Văn B',
        phone: '0987654321',
        routeName: 'Hà Nội - Hải Phòng',
        departureTime: '09:00',
        departureDate: '2026-10-16',
        vehicleType: 'Limousine',
        seatCount: 1,
        seatFront: 0,
        seatMiddle: 1,
        seatBack: 0,
        costPrice: 200000,
        sellPrice: 250000,
        deposit: 0,
        collectOnDelivery: 250000,
        commission: 50000,
        partner: 'XVIP',
        pickupPoint: 'Điểm C',
        dropoffPoint: 'Điểm D',
        note: '',
        errors: [],
      },
    ]);

    const mockOrderRepo: any = {
      find: vi.fn().mockResolvedValue([
        // Đơn 1 đã tồn tại trong DB -> trùng
        {
          id: 101,
          phone: '0912345678',
          routeId: 10,
          departureDate: '2026-10-16',
          departureTime: '08:00',
          seatCount: 1,
          seatFront: 1,
          seatMiddle: 0,
          seatBack: 0,
          sellPrice: 250000,
        },
      ]),
    };

    const mockHistoryRepo: any = {};
    const mockUserRepo: any = {
      find: vi.fn().mockResolvedValue([{ id: 1, username: 'admin', fullName: 'Quản trị viên' }]),
      findOne: vi.fn().mockResolvedValue({ id: 1, fullName: 'Quản trị viên' }),
    };
    const mockRouteRepo: any = {
      find: vi.fn().mockResolvedValue([{ id: 10, name: 'Hà Nội - Hải Phòng', isActive: true }]),
    };
    const mockPartnerRepo: any = {
      find: vi.fn().mockResolvedValue([{ id: 1, name: 'XVIP' }]),
    };

    const mockQueryRunner: any = {
      connect: vi.fn().mockResolvedValue(undefined),
      startTransaction: vi.fn().mockResolvedValue(undefined),
      commitTransaction: vi.fn().mockResolvedValue(undefined),
      rollbackTransaction: vi.fn().mockResolvedValue(undefined),
      release: vi.fn().mockResolvedValue(undefined),
      manager: {
        create: vi.fn().mockImplementation((_entity, val) => val),
        save: vi.fn().mockImplementation((_entity, val) => {
          if (Array.isArray(val)) {
            return val.map((item, idx) => ({ ...item, id: 200 + idx }));
          }
          return { ...val, id: 200 };
        }),
      },
    };

    const mockDataSource: any = {
      createQueryRunner: vi.fn().mockReturnValue(mockQueryRunner),
    };

    const service = new OrdersImportService(
      mockDataSource,
      mockOrderRepo,
      mockHistoryRepo,
      mockUserRepo,
      mockRouteRepo,
      mockPartnerRepo,
    );

    const result = await service.importExcel(Buffer.from('fake'), adminActor);

    expect(result.total).toBe(2);
    expect(result.duplicates).toBe(1);
    expect(result.created).toBe(1);
    expect(result.failed).toBe(0);
    expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
  });
});
