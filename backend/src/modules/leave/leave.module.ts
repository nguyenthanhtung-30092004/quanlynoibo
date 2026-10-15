import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppSetting } from '../settings/entities/app-setting.entity.js';
import { LeaveDayLimit } from './entities/leave-day-limit.entity.js';
import { LeaveRequest } from './entities/leave-request.entity.js';
import { LeaveController } from './leave.controller.js';
import { LeaveService } from './leave.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([AppSetting, LeaveRequest, LeaveDayLimit])],
  controllers: [LeaveController],
  providers: [LeaveService],
})
export class LeaveModule {}
