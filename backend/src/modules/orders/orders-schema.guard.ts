import { Injectable, OnModuleInit } from '@nestjs/common';

/**
 * Các thay đổi cấu trúc bảng đã được chuyển sang TypeORM migrations đánh số (1710000000001, 1710000000002).
 * Class này giữ lại để tương thích DI module init.
 */
@Injectable()
export class OrdersSchemaGuard implements OnModuleInit {
  async onModuleInit() {
    // Schema DDL được quản lý an toàn qua TypeORM migrations
  }
}
