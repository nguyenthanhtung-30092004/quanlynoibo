import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppSetting } from '../settings/entities/app-setting.entity.js';
import { User } from '../users/entities/user.entity.js';
import { AttendanceSchemaGuard } from './attendance-schema.guard.js';
import { AttendanceAutoCloseService } from './attendance-auto-close.service.js';
import { AttendanceController } from './attendance.controller.js';
import { AttendanceService } from './attendance.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([AppSetting, User])],
  controllers: [AttendanceController],
  providers: [AttendanceService, AttendanceSchemaGuard, AttendanceAutoCloseService],
  exports: [AttendanceService],
})
export class AttendanceModule {}
