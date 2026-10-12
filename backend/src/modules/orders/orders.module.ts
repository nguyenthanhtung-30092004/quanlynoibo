import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Partner } from '../partners/entities/partner.entity.js';
import { Route } from '../routes/entities/route.entity.js';
import { AppSetting } from '../settings/entities/app-setting.entity.js';
import { User } from '../users/entities/user.entity.js';
import { Order } from './entities/order.entity.js';
import { OrderHistory } from './entities/order-history.entity.js';
import { OrdersSchemaGuard } from './orders-schema.guard.js';
import { OrdersController } from './orders.controller.js';
import { VmgCallbackController } from './vmg-callback.controller.js';
import { OrdersService } from './orders.service.js';
import { EsmsProvider } from './messaging/esms.provider.js';
import { MessagingService } from './messaging/messaging.service.js';
import { SpeedSmsProvider } from './messaging/speedsms.provider.js';
import { VmgProvider } from './messaging/vmg.provider.js';
import { ZaloTokenService } from './messaging/zalo-token.service.js';
import { ZaloZnsProvider } from './messaging/zalo-zns.provider.js';

@Module({
  imports: [TypeOrmModule.forFeature([Order, OrderHistory, User, Route, Partner, AppSetting])],
  controllers: [OrdersController, VmgCallbackController],
  providers: [
    OrdersService,
    OrdersSchemaGuard,
    // Gửi tin cho khách: SMS (eSMS/SpeedSMS/VMG) và Zalo (ZNS gọi thẳng API Zalo), khóa trong .env
    MessagingService,
    EsmsProvider,
    SpeedSmsProvider,
    VmgProvider,
    ZaloTokenService,
    ZaloZnsProvider,
  ],
})
export class OrdersModule {}
