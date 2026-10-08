import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import authConfig from './config/auth.config.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { AuthGuard } from './modules/auth/guards/auth.guard.js';
import { RolesGuard } from './modules/auth/guards/roles.guard.js';
import { CarriersModule } from './modules/carriers/carriers.module.js';
import { OrdersModule } from './modules/orders/orders.module.js';
import { PartnersModule } from './modules/partners/partners.module.js';
import { RoutesModule } from './modules/routes/routes.module.js';
import { UsersModule } from './modules/users/users.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [authConfig],
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres' as const,
        host: config.get<string>('DATABASE_HOST', 'localhost'),
        port: Number(config.get<string>('DATABASE_PORT', '5432')),
        username: config.get<string>('DATABASE_USERNAME', 'postgres'),
        password: config.getOrThrow<string>('DATABASE_PASSWORD'),
        database: config.get<string>('DATABASE_NAME', 'quan_ly_noi_bo'),
        autoLoadEntities: true,
        synchronize: config.get<string>('DATABASE_SYNCHRONIZE') === 'true',
      }),
    }),
    UsersModule,
    AuthModule,
    OrdersModule,
    CarriersModule,
    PartnersModule,
    RoutesModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // Thứ tự quan trọng: xác thực (gán request.user) trước, rồi mới kiểm tra vai trò
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
