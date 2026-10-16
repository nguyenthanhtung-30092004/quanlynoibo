import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppSetting } from '../settings/entities/app-setting.entity.js';
import { LeaveDayLimit } from './entities/leave-day-limit.entity.js';
import { LeaveHistory } from './entities/leave-history.entity.js';
import { LeaveRequest } from './entities/leave-request.entity.js';
import { User } from '../users/entities/user.entity.js';
import { LeaveController } from './leave.controller.js';
import { LeaveService } from './leave.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([AppSetting, LeaveRequest, LeaveDayLimit, LeaveHistory, User])],
  controllers: [LeaveController],
  providers: [LeaveService],
})
export class LeaveModule {}
