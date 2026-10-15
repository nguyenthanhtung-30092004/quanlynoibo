import { Injectable, OnModuleInit } from '@nestjs/common';

/**
 * Các bảng chấm công đã được tạo và quản lý qua TypeORM migrations đánh số.
 * Class này giữ lại để tương thích DI module init.
 */
@Injectable()
export class AttendanceSchemaGuard implements OnModuleInit {
  async onModuleInit() {
    // Schema DDL được quản lý an toàn qua TypeORM migrations
  }
}
