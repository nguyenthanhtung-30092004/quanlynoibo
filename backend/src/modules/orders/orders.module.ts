import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Route } from '../routes/entities/route.entity.js';
import { User } from '../users/entities/user.entity.js';
import { Order } from './entities/order.entity.js';
import { OrdersController } from './orders.controller.js';
import { VmgCallbackController } from './vmg-callback.controller.js';
import { OrdersService } from './orders.service.js';
import { EsmsProvider } from './messaging/esms.provider.js';
import { MessagingService } from './messaging/messaging.service.js';
import { SpeedSmsProvider } from './messaging/speedsms.provider.js';
import { VmgOttProvider } from './messaging/vmg-ott.provider.js';
import { VmgProvider } from './messaging/vmg.provider.js';
import { ZaloZnsProvider } from './messaging/zalo-zns.provider.js';

@Module({
  imports: [TypeOrmModule.forFeature([Order, User, Route])],
  controllers: [OrdersController, VmgCallbackController],
  providers: [
    OrdersService,
    // Gửi tin cho khách: SMS (eSMS) và Zalo (ZNS), cấu hình khóa trong .env
    MessagingService,
    EsmsProvider,
    SpeedSmsProvider,
    VmgProvider,
    VmgOttProvider,
    ZaloZnsProvider,
  ],
})
export class OrdersModule {}
