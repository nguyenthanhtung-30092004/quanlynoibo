import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Order } from '../orders/entities/order.entity.js';
import { AppSetting } from '../settings/entities/app-setting.entity.js';
import { User } from '../users/entities/user.entity.js';
import { PayrollController } from './payroll.controller.js';
import { PayrollService } from './payroll.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([AppSetting, User, Order])],
  controllers: [PayrollController],
  providers: [PayrollService],
})
export class PayrollModule {}
